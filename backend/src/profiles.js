const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, serverTimestamp } = require("./firebase");
const { CALLABLE_OPTIONS, withAuth, documentId, pairId, isBlocked, requireAccount, consumeQuota, rateLimit } = require("./security");
const { validateProfile, projectProfile } = require("./profileSchema");
const { ALLOWED_PERMISSION_STATUS } = require("./constants");

async function profileForViewer(uid, target) {
  const db = getDb();
  return db.runTransaction(async (tx) => {
    await requireAccount(tx, uid);
    const profile = (await tx.get(db.doc(`users/${target}`))).data();
    const targetState = (await tx.get(db.doc(`accountState/${target}`))).data();
    if (!profile || !targetState || targetState.disabled || targetState.deleting) throw new HttpsError("not-found", "Profile unavailable.");
    if (uid === target) return projectProfile(target, profile, true);
    const relation = (await tx.get(db.doc(`relationships/${pairId(uid, target)}`))).data();
    if (isBlocked(relation) || relation?.status === "declined" || !targetState.emailVerified) throw new HttpsError("permission-denied", "Profile unavailable.");
    if (!["accepted", "pending"].includes(relation?.status)) {
      const [mine, theirs] = await Promise.all([tx.get(db.doc(`presence/${uid}`)), tx.get(db.doc(`presence/${target}`))]);
      const a = mine.data(), b = theirs.data();
      const { distanceBetween } = require("geofire-common");
      if (!a || !b || a.expiresAt.toMillis() <= Date.now() || b.expiresAt.toMillis() <= Date.now() ||
          distanceBetween([a.lat, a.lng], [b.lat, b.lng]) * 1000 > 152) throw new HttpsError("permission-denied", "Profile unavailable.");
    }
    return projectProfile(target, profile, relation?.status === "accepted");
  });
}
const profile_get = onCall(CALLABLE_OPTIONS, withAuth(async (uid, request) => {
  await rateLimit(uid, "profiles");
  return profileForViewer(uid, documentId(request.data?.uid, "uid"));
}));
const profile_save = onCall(CALLABLE_OPTIONS, withAuth(async (uid, request) => {
  const profile = validateProfile(request.data?.profile);
  const onboarding = request.data?.onboardingLocation;
  if (onboarding && (typeof onboarding.sharingEnabled !== "boolean" || !ALLOWED_PERMISSION_STATUS.has(onboarding.permissionStatus))) {
    throw new HttpsError("invalid-argument", "Invalid location preferences.");
  }
  const db = getDb();
  await db.runTransaction(async (tx) => {
    await requireAccount(tx, uid);
    const ref = db.doc(`users/${uid}`);
    const previous = (await tx.get(ref)).data();
    await consumeQuota(tx, uid, "profileWrite");
    tx.set(ref, { ...profile, email: request.auth.token.email ?? "", updatedAt: serverTimestamp(),
      ...(!previous ? { createdAt: serverTimestamp(), locationControl: { sharingEnabled: onboarding?.sharingEnabled === true,
        permissionStatus: onboarding?.permissionStatus ?? "unknown", generation: 0, updatedAt: serverTimestamp() } } : {}),
    }, { merge: true });
    tx.delete(db.doc(`publicProfiles/${uid}`));
  });
  return { ok: true };
}, { verified: false }));
module.exports = { profile_get, profile_save, profileForViewer };
