const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, serverTimestamp, timestampFromDate } = require("./firebase");
const {
  REGION,
  DEFAULT_RADIUS_FT,
  IMPACTED_LIMIT,
  FRESHNESS_MS,
  ALLOWED_PERMISSION_STATUS,
} = require("./constants");
const {
  withAuth,
  nowDate,
  getTimestampValue,
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
} = require("./helpers");
const { maybeSendCrowdAlert } = require("./notifications");

// this gives a user doc reference from a uid
function getUserRef(uid) {
  return getDb().collection("users").doc(uid);
}

// this makes permission values safe before saving
function normalizePermissionStatus(value) {
  if (ALLOWED_PERMISSION_STATUS.has(value)) return value;
  return "unknown";
}

// this fetches a user doc and throws if it does not exist
async function getUserDataOrThrow(userRef) {
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("failed-precondition", "User profile is missing.");
  }
  return userSnap.data() || {};
}

// this returns empty nearby response with a timestamp
function buildEmptyNearbyResponse() {
  return {
    users: [],
    crowdCount: 0,
    asOf: nowDate().toISOString(),
  };
}

// this saves a phone push token for the logged in user
const location_registerPushToken = onCall(
  { region: REGION },
  withAuth(async (uid, request) => {
    const { deviceId, platform, expoPushToken } = request.data || {};

    // this blocks bad input before writing data
    if (typeof deviceId !== "string" || !deviceId.trim()) {
      throw new HttpsError("invalid-argument", "deviceId is required.");
    }

    if (platform !== "ios" && platform !== "android") {
      throw new HttpsError("invalid-argument", "platform must be ios or android.");
    }

    if (typeof expoPushToken !== "string" || !expoPushToken.trim()) {
      throw new HttpsError("invalid-argument", "expoPushToken is required.");
    }

    await getUserRef(uid)
      .collection("devices")
      .doc(deviceId)
      .set(
        {
          expoPushToken: expoPushToken.trim(),
          platform,
          enabled: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

    return { ok: true };
  }),
);

// this lets user turn location sharing on or off
const location_setSharing = onCall(
  { region: REGION },
  withAuth(async (uid, request) => {
    const { sharingEnabled, permissionStatus } = request.data || {};

    if (typeof sharingEnabled !== "boolean") {
      throw new HttpsError("invalid-argument", "sharingEnabled must be boolean.");
    }

    if (!ALLOWED_PERMISSION_STATUS.has(permissionStatus)) {
      throw new HttpsError("invalid-argument", "permissionStatus is invalid.");
    }

    const userRef = getUserRef(uid);

    await userRef.set(
      {
        locationControl: {
          sharingEnabled,
          permissionStatus,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true },
    );

    // this clears live location right away when sharing is off
    if (!sharingEnabled) {
      const db = getDb();
      await db.collection("presence").doc(uid).delete().catch(() => {});
    }

    const userSnap = await userRef.get();
    const lastLocationAt = getTimestampValue(userSnap.data()?.locationStatus?.lastLocationAt);

    return {
      sharingEnabled,
      lastLocationAt: lastLocationAt ? lastLocationAt.toISOString() : null,
    };
  }),
);

// this gives the app current location status values
const location_getControlStatus = onCall(
  { region: REGION },
  withAuth(async (uid) => {
    const userSnap = await getUserRef(uid).get();

    if (!userSnap.exists) {
      return {
        sharingEnabled: true,
        permissionStatus: "unknown",
        lastLocationAt: null,
        lastAccuracyM: null,
      };
    }

    const data = userSnap.data() || {};
    const sharingEnabled = data.locationControl?.sharingEnabled !== false;
    const permissionStatus = normalizePermissionStatus(data.locationControl?.permissionStatus);
    const lastLocationAt = getTimestampValue(data.locationStatus?.lastLocationAt);
    const lastAccuracyM =
      typeof data.locationStatus?.lastAccuracyM === "number"
        ? data.locationStatus.lastAccuracyM
        : null;

    return {
      sharingEnabled,
      permissionStatus,
      lastLocationAt: lastLocationAt ? lastLocationAt.toISOString() : null,
      lastAccuracyM,
    };
  }),
);

// this saves latest location and runs crowd alert checks
const location_upsertPing = onCall(
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid, request) => {
    const parsedPing = validatePingInput(request.data);
    if (!parsedPing.ok) return parsedPing.response;

    const { lat, lng, accuracyM, source } = parsedPing.value;

    const userRef = getUserRef(uid);
    const user = await getUserDataOrThrow(userRef);

    const sharingEnabled = user.locationControl?.sharingEnabled !== false;
    if (!sharingEnabled) {
      return rejectPing("paused");
    }

    // this ignores very fast repeat pings with tiny movement
    const previousPresence = await getPresenceByUid(uid);
    const throttleSeconds = getThrottleSeconds(previousPresence, { lat, lng });
    if (throttleSeconds !== null) {
      return rejectPing("throttled", throttleSeconds);
    }

    // this keeps one live location record per user
    const now = nowDate();
    const updatedAt = timestampFromDate(now);
    const expiresAt = timestampFromDate(
      new Date(now.getTime() + FRESHNESS_MS),
    );

    const db = getDb();
    await db.collection("presence").doc(uid).set(
      {
        uid,
        lat,
        lng,
        geohash: geohashForLocation([lat, lng]),
        accuracyM,
        source,
        updatedAt,
        expiresAt,
      },
      { merge: true },
    );

    // this also saves quick status fields on user profile
    await userRef.set(
      {
        locationStatus: {
          lastLocationAt: updatedAt,
          lastAccuracyM: accuracyM,
          lastSource: source,
        },
        locationControl: {
          sharingEnabled: true,
          permissionStatus: normalizePermissionStatus(user.locationControl?.permissionStatus),
          updatedAt,
        },
      },
      { merge: true },
    );

    // this checks sender and nearby users for crowd alerts
    const radiusM = toMeters(DEFAULT_RADIUS_FT);
    const aroundSender = await queryNearbyPresence({ lat, lng }, radiusM);
    const nearbyWithoutSender = aroundSender.filter((presence) => presence.uid !== uid);

    const impactedUsers = [
      { uid, lat, lng },
      ...nearbyWithoutSender.slice(0, IMPACTED_LIMIT),
    ];

    for (const subject of impactedUsers) {
      const neighbors = getNeighborsForSubject(subject, impactedUsers, radiusM);
      await maybeSendCrowdAlert(subject.uid, neighbors);
    }

    return { accepted: true };
  }),
);

// this returns nearby people sorted from closest to farthest
const location_getNearby = onCall(
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid, request) => {
    const radiusFt = parseRadiusFt(request.data?.radiusFt);
    const radiusM = toMeters(radiusFt);

    // this returns empty if caller has no recent live location
    const callerPresence = await getPresenceByUid(uid);
    if (!callerPresence || !isFreshPresence(callerPresence)) {
      return buildEmptyNearbyResponse();
    }

    const nearbyPresence = await queryNearbyPresence(callerPresence, radiusM);
    const filtered = nearbyPresence.filter((presence) => presence.uid !== uid);
    const userMap = await getUsersByUids(filtered.map((presence) => presence.uid));

    // this skips missing profiles and sorts by distance
    const users = filtered
      .map((presence) => {
        const userDoc = userMap.get(presence.uid);
        if (!userDoc) return null;
        return buildNearbyUserPayload(presence.uid, userDoc, presence);
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceFt - b.distanceFt);

    return {
      users,
      crowdCount: users.length,
      asOf: nowDate().toISOString(),
    };
  }),
);

module.exports = {
  location_registerPushToken,
  location_setSharing,
  location_getControlStatus,
  location_upsertPing,
  location_getNearby,
};
