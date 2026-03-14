const { HttpsError } = require("firebase-functions/v2/https");
const {
  geohashForLocation,
  geohashQueryBounds,
  distanceBetween,
} = require("geofire-common");
const { getDb } = require("./firebase");
const {
  DEFAULT_RADIUS_FT,
  MAX_RADIUS_FT,
  FRESHNESS_MS,
  THROTTLE_MS,
  THROTTLE_DISTANCE_M,
  MAX_ACCURACY_BUFFER_M,
  MAX_RECORDED_AT_AGE_MS,
  MAX_RECORDED_AT_FUTURE_MS,
} = require("./constants");

// this checks login and gives the handler the user id
function withAuth(handler) {
  return async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    return handler(uid, request);
  };
}

// this keeps date creation the same everywhere
function nowDate() {
  return new Date();
}

// this turns firestore time into normal time we can compare
function getTimestampValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

// this makes sure number input is usable
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// this keeps array-like profile fields in a clean string list
function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizePreConnectionVisibility(value) {
  const record = value && typeof value === "object" ? value : {};

  return {
    photoURL:
      typeof record.photoURL === "boolean" ? record.photoURL : false,
    lastName:
      typeof record.lastName === "boolean" ? record.lastName : false,
    Gender:
      typeof record.Gender === "boolean" ? record.Gender : true,
    age:
      typeof record.age === "boolean" ? record.age : true,
    gradYear:
      typeof record.gradYear === "boolean" ? record.gradYear : true,
    major:
      typeof record.major === "boolean" ? record.major : true,
    iceBreakerOne:
      typeof record.iceBreakerOne === "boolean" ? record.iceBreakerOne : true,
    iceBreakerTwo:
      typeof record.iceBreakerTwo === "boolean" ? record.iceBreakerTwo : true,
    iceBreakerThree:
      typeof record.iceBreakerThree === "boolean" ? record.iceBreakerThree : true,
    hobbies:
      typeof record.hobbies === "boolean" ? record.hobbies : true,
  };
}

// this turns feet into meters for distance math
function toMeters(feet) {
  return feet * 0.3048;
}

// this turns meters into feet for ui output
function toFeet(meters) {
  return meters / 0.3048;
}

// this keeps distance output clean and rounded
function roundDistanceFeet(meters) {
  return Math.max(0, Math.round(toFeet(meters)));
}

// this picks a safe radius even if input is missing or too big
function parseRadiusFt(input) {
  if (!isFiniteNumber(input)) return DEFAULT_RADIUS_FT;
  return Math.max(1, Math.min(MAX_RADIUS_FT, input));
}

// this keeps ping fail responses in one format
function rejectPing(reason, nextPingAfterSec) {
  if (isFiniteNumber(nextPingAfterSec)) {
    return { accepted: false, reason, nextPingAfterSec };
  }
  return { accepted: false, reason };
}

// this checks ping input once in one place
function validatePingInput(data) {
  const payload = data || {};
  const { lat, lng, accuracyM, source, recordedAtMs } = payload;

  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return { ok: false, response: rejectPing("invalid") };
  }

  if (!isFiniteNumber(accuracyM) || accuracyM < 0 || accuracyM > 500) {
    return { ok: false, response: rejectPing("invalid") };
  }

  if (source !== "foreground" && source !== "background") {
    return { ok: false, response: rejectPing("invalid") };
  }

  if (!isFiniteNumber(recordedAtMs)) {
    return { ok: false, response: rejectPing("invalid") };
  }

  const nowMs = nowDate().getTime();

  // this blocks stale pings that would make presence jump around
  if (recordedAtMs < nowMs - MAX_RECORDED_AT_AGE_MS) {
    return { ok: false, response: rejectPing("invalid") };
  }

  // this blocks future timestamps from clock drift or spoofing
  if (recordedAtMs > nowMs + MAX_RECORDED_AT_FUTURE_MS) {
    return { ok: false, response: rejectPing("invalid") };
  }

  return {
    ok: true,
    value: { lat, lng, accuracyM, source, recordedAtMs },
  };
}

// this reads one live location doc and makes a clean object
function extractPresence(docSnap) {
  const data = docSnap.data();
  if (!data) return null;

  if (!isFiniteNumber(data.lat) || !isFiniteNumber(data.lng)) return null;

  return {
    uid: data.uid || docSnap.id,
    lat: data.lat,
    lng: data.lng,
    geohash: data.geohash || "",
    accuracyM: isFiniteNumber(data.accuracyM) ? data.accuracyM : null,
    source: data.source || null,
    updatedAt: getTimestampValue(data.updatedAt),
    expiresAt: getTimestampValue(data.expiresAt),
  };
}

// this checks if location is still recent enough
function isFreshPresence(presence, now = nowDate()) {
  if (!presence?.updatedAt) return false;
  return now.getTime() - presence.updatedAt.getTime() <= FRESHNESS_MS;
}

// this gets distance in meters between two locations
function distanceMeters(a, b) {
  return distanceBetween([a.lat, a.lng], [b.lat, b.lng]) * 1000;
}

// this keeps huge accuracy readings from widening too much
function getAccuracyBufferM(presence) {
  const raw = presence?.accuracyM;
  if (!isFiniteNumber(raw) || raw <= 0) return 0;
  return Math.min(raw, MAX_ACCURACY_BUFFER_M);
}

// this adds gps wiggle room for nearby matching
function isWithinRadiusWithAccuracy(center, candidate, radiusM, useAccuracyBuffer) {
  const meters = distanceMeters(center, candidate);
  if (!useAccuracyBuffer) return { within: meters <= radiusM, meters };

  const centerBufferM = getAccuracyBufferM(center);
  const candidateBufferM = getAccuracyBufferM(candidate);
  const allowedRadiusM = radiusM + centerBufferM + candidateBufferM;

  return { within: meters <= allowedRadiusM, meters };
}

// this gets latest live location for one user
async function getPresenceByUid(uid) {
  const db = getDb();
  const snap = await db.collection("presence").doc(uid).get();
  if (!snap.exists) return null;
  return extractPresence(snap);
}

// this finds nearby users with a broad search then radius filtering
async function queryNearbyPresence(center, radiusM, options = {}) {
  // this toggles gps wiggle room without duplicate query code
  const useAccuracyBuffer = options.useAccuracyBuffer === true;
  const db = getDb();
  const bounds = geohashQueryBounds([center.lat, center.lng], radiusM);
  const queries = bounds.map(([start, end]) =>
    db
      .collection("presence")
      .orderBy("geohash")
      .startAt(start)
      .endAt(end)
      .limit(200)
      .get(),
  );

  const snapshots = await Promise.all(queries);
  const byUid = new Map();

  // this avoids repeats when the same user appears in many search ranges
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      if (byUid.has(doc.id)) continue;
      const parsed = extractPresence(doc);
      if (parsed) byUid.set(doc.id, parsed);
    }
  }

  const now = nowDate();
  const results = [];

  // this keeps only recent users that are truly inside the radius
  for (const presence of byUid.values()) {
    if (!isFreshPresence(presence, now)) continue;
    const { within, meters } = isWithinRadiusWithAccuracy(
      center,
      presence,
      radiusM,
      useAccuracyBuffer,
    );
    if (within) {
      results.push({ ...presence, distanceM: meters });
    }
  }

  return results;
}

// this gets who is close to one person
function getNeighborsForSubject(subject, people, radiusM) {
  const neighbors = [];

  for (const person of people) {
    if (person.uid === subject.uid) continue;
    if (distanceMeters(subject, person) <= radiusM) {
      neighbors.push(person);
    }
  }

  return neighbors;
}

// firestore lets in-query use max 10 ids so we split the list
async function getUsersByUids(uids) {
  if (!uids.length) return new Map();

  const db = getDb();
  const userMap = new Map();
  const refs = uids.map((uid) => db.collection("users").doc(uid));
  const snaps = await db.getAll(...refs);

  for (const snap of snaps) {
    if (!snap.exists) continue;
    userMap.set(snap.id, snap.data());
  }

  return userMap;
}

// this returns only the profile fields we want in nearby results
function buildNearbyUserPayload(uid, userDoc, presence) {
  return {
    uid,
    firstName: userDoc?.firstName || "",
    lastName: userDoc?.lastName || "",
    preConnectionVisibility: normalizePreConnectionVisibility(
      userDoc?.preConnectionVisibility,
    ),
    Gender: userDoc?.Gender || "",
    age: userDoc?.age ?? "",
    gradYear: userDoc?.gradYear ?? "",
    major: userDoc?.major || "",
    hobbies: normalizeStringArray(userDoc?.hobbies),
    photoURL: userDoc?.photoURL || "",
    iceBreakerOne: userDoc?.iceBreakerOne || "",
    iceBreakerTwo: userDoc?.iceBreakerTwo || "",
    iceBreakerThree: userDoc?.iceBreakerThree || "",
    distanceFt: roundDistanceFeet(presence.distanceM),
  };
}

// this tells us if user should wait before sending next ping
function getThrottleSeconds(previousPresence, nextPoint) {
  if (!previousPresence?.updatedAt) return null;

  const now = nowDate();
  const elapsedMs = now.getTime() - previousPresence.updatedAt.getTime();
  if (elapsedMs >= THROTTLE_MS) return null;

  const movedMeters = distanceMeters(previousPresence, nextPoint);
  if (movedMeters >= THROTTLE_DISTANCE_M) return null;

  return Math.ceil((THROTTLE_MS - elapsedMs) / 1000);
}

module.exports = {
  withAuth,
  nowDate,
  getTimestampValue,
  isFiniteNumber,
  toMeters,
  parseRadiusFt,
  rejectPing,
  validatePingInput,
  geohashForLocation,
  isFreshPresence,
  getPresenceByUid,
  queryNearbyPresence,
  getNeighborsForSubject,
  getUsersByUids,
  buildNearbyUserPayload,
  getThrottleSeconds,
};
