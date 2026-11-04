const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");
const { getDb, getAdminAuth, serverTimestamp } = require("./firebase");
const {
  CALLABLE_OPTIONS,
  withAuth,
  requireAccount,
  consumeQuota,
  rateLimit,
  pairId,
  isBlocked,
} = require("./security");
const {
  ALLOWED_PERMISSION_STATUS,
  FRESHNESS_MS,
  MAX_RADIUS_FT,
} = require("./constants");
const {
  validatePingInput,
  queryNearbyPresence,
  toMeters,
  geohashForLocation,
  buildNearbyUserPayload,
} = require("./helpers");
function controlPayload(user) {
  return {
    sharingEnabled: user?.locationControl?.sharingEnabled === true,
    generation: user?.locationControl?.generation ?? 0,
    permissionStatus: user?.locationControl?.permissionStatus ?? "unknown",
    lastLocationAt:
      user?.locationStatus?.lastLocationAt?.toDate().toISOString() ?? null,
    lastAccuracyM: user?.locationStatus?.lastAccuracyM ?? null,
  };
}
const location_getControlStatus = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid) => {
    await rateLimit(uid, "controls");
    return controlPayload((await getDb().doc(`users/${uid}`).get()).data());
  }),
);
const location_setSharing = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid, request) => {
    const { sharingEnabled, permissionStatus, generation } = request.data ?? {};
    if (
      typeof sharingEnabled !== "boolean" ||
      !ALLOWED_PERMISSION_STATUS.has(permissionStatus) ||
      !Number.isSafeInteger(generation)
    ) {
      throw new HttpsError("invalid-argument", "Invalid sharing preferences.");
    }
    const db = getDb();
    return db.runTransaction(async (tx) => {
      await requireAccount(tx, uid);
      const ref = db.doc(`users/${uid}`);
      const user = (await tx.get(ref)).data();
      if (!user)
        throw new HttpsError("failed-precondition", "Finish onboarding first.");
      const control = controlPayload(user);
      if (generation !== control.generation)
        throw new HttpsError(
          "failed-precondition",
          "Sharing settings changed. Refresh and try again.",
        );
      await consumeQuota(tx, uid, "profileWrite");
      const next = {
        sharingEnabled,
        permissionStatus,
        generation: generation + 1,
        updatedAt: serverTimestamp(),
      };
      tx.update(ref, { locationControl: next });
      tx.delete(db.doc(`presence/${uid}`));
      return {
        ...control,
        sharingEnabled,
        permissionStatus,
        generation: generation + 1,
      };
    });
  }),
);
async function clearPresenceInTransaction(tx, uid) {
  const db = getDb();
  const ref = db.doc(`users/${uid}`);
  const user = (await tx.get(ref)).data();
  if (user)
    tx.update(ref, {
      "locationControl.sharingEnabled": false,
      "locationControl.generation": (user.locationControl?.generation ?? 0) + 1,
      "locationControl.updatedAt": serverTimestamp(),
    });
  tx.delete(db.doc(`presence/${uid}`));
}
async function clearPresence(uid) {
  await getDb().runTransaction(async (tx) => {
    await requireAccount(tx, uid);
    await clearPresenceInTransaction(tx, uid);
  });
}
const location_clearPresence = onCall(
  CALLABLE_OPTIONS,
  withAuth(
    async (uid) => {
      await clearPresence(uid);
      return { ok: true };
    },
    { verified: false },
  ),
);
const location_upsertPing = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid, request) => {
    const parsed = validatePingInput(request.data);
    if (!parsed.ok) return parsed.response;
    const { lat, lng, accuracyM, source, recordedAtMs } = parsed.value;
    const generation = request.data.generation;
    if (!Number.isSafeInteger(generation))
      return { accepted: false, reason: "invalid" };
    const db = getDb();
    const result = await db.runTransaction(async (tx) => {
      await requireAccount(tx, uid);
      const userRef = db.doc(`users/${uid}`),
        presenceRef = db.doc(`presence/${uid}`);
      const user = (await tx.get(userRef)).data();
      const previous = (await tx.get(presenceRef)).data();
      if (
        !user ||
        user.locationControl?.sharingEnabled !== true ||
        generation !== (user.locationControl?.generation ?? 0)
      )
        return { accepted: false, reason: "paused" };
      if (recordedAtMs <= (user.locationStatus?.lastRecordedAtMs ?? 0))
        return { accepted: false, reason: "invalid" };
      if (
        previous &&
        Date.now() -
          (previous.receivedAt?.toMillis() ??
            previous.updatedAt?.toMillis() ??
            0) <
          10000
      )
        return { accepted: false, reason: "throttled", nextPingAfterSec: 10 };
      await consumeQuota(tx, uid, "ping");
      const sampledAt = Timestamp.fromMillis(recordedAtMs);
      tx.set(presenceRef, {
        uid,
        lat,
        lng,
        accuracyM,
        source,
        generation,
        recordedAtMs,
        geohash: geohashForLocation([lat, lng]),
        updatedAt: sampledAt,
        receivedAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(recordedAtMs + FRESHNESS_MS),
      });
      // A ping never changes sharing intent, and expiry always starts at sample time.
      tx.update(userRef, {
        locationStatus: {
          lastLocationAt: sampledAt,
          lastRecordedAtMs: recordedAtMs,
          lastAccuracyM: accuracyM,
          lastSource: source,
        },
      });
      return { accepted: true };
    });
    if (result.accepted) {
      const candidates = (
        await queryNearbyPresence({ lat, lng }, toMeters(50), {
          useAccuracyBuffer: false,
        })
      )
        .filter((person) => person.uid !== uid)
        .slice(0, 30);
      const allowed = [];
      for (const person of candidates) {
        const relation = (
          await db.doc(`relationships/${pairId(uid, person.uid)}`).get()
        ).data();
        const state = (await db.doc(`accountState/${person.uid}`).get()).data();
        if (
          !isBlocked(relation) &&
          relation?.status !== "declined" &&
          state?.emailVerified &&
          !state.disabled &&
          !state.deleting
        )
          allowed.push(person);
      }
      await require("./notifications").maybeSendCrowdAlert(uid, allowed);
    }
    return result;
  }),
);
const location_getNearby = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid) => {
    await rateLimit(uid, "discovery");
    const db = getDb();
    const empty = () => ({
      users: [],
      crowdCount: 0,
      asOf: new Date().toISOString(),
    });
    const center = (await db.doc(`presence/${uid}`).get()).data();
    if (!center || center.expiresAt.toMillis() <= Date.now()) return empty();
    // Fixed radius, no coordinates, coarse distances, bounded results and a per-account budget.
    // Client-supplied GPS is a discovery hint, never proof of physical proximity.
    const nearby = (
      await queryNearbyPresence(center, toMeters(MAX_RADIUS_FT), {
        useAccuracyBuffer: false,
      })
    )
      .filter((person) => person.uid !== uid)
      .sort((a, b) => a.uid.localeCompare(b.uid))
      .slice(0, 30);
    const authRecords = nearby.length
      ? (
          await getAdminAuth().getUsers(
            nearby.map((person) => ({ uid: person.uid })),
          )
        ).users
      : [];
    const activeUids = new Set(
      authRecords
        .filter((record) => !record.disabled && record.emailVerified)
        .map((record) => record.uid),
    );
    return db.runTransaction(async (tx) => {
      await requireAccount(tx, uid);
      const caller = (await tx.get(db.doc(`users/${uid}`))).data();
      const latest = (await tx.get(db.doc(`presence/${uid}`))).data();
      if (
        !caller?.locationControl?.sharingEnabled ||
        !latest ||
        latest.generation !== center.generation ||
        latest.recordedAtMs !== center.recordedAtMs ||
        latest.expiresAt.toMillis() <= Date.now()
      )
        return empty();
      const users = [];
      for (const person of nearby) {
        if (!activeUids.has(person.uid)) continue;
        const profile = (await tx.get(db.doc(`users/${person.uid}`))).data();
        const state = (
          await tx.get(db.doc(`accountState/${person.uid}`))
        ).data();
        const presence = (
          await tx.get(db.doc(`presence/${person.uid}`))
        ).data();
        const relation = (
          await tx.get(db.doc(`relationships/${pairId(uid, person.uid)}`))
        ).data();
        if (
          !profile?.locationControl?.sharingEnabled ||
          !state?.emailVerified ||
          state.disabled ||
          state.deleting ||
          !presence ||
          presence.expiresAt.toMillis() <= Date.now() ||
          presence.generation !== (profile.locationControl.generation ?? 0) ||
          presence.recordedAtMs !== person.recordedAtMs ||
          isBlocked(relation) ||
          relation?.status === "declined"
        )
          continue;
        users.push(buildNearbyUserPayload(person.uid, profile, person));
      }
      return {
        users,
        crowdCount: users.length,
        asOf: new Date().toISOString(),
      };
    });
  }),
);
module.exports = {
  location_setSharing,
  location_getControlStatus,
  location_clearPresence,
  location_upsertPing,
  location_getNearby,
  clearPresence,
  clearPresenceInTransaction,
};
