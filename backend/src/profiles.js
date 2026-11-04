const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, serverTimestamp } = require("./firebase");
const {
  CALLABLE_OPTIONS,
  withAuth,
  documentId,
  pairId,
  isBlocked,
  requireAccount,
  rateLimit,
  requireEnabledAccount,
} = require("./security");
const { authorizedRelationship } = require("./connectionState");
const {
  validateProfile,
  projectProfile,
  visibility,
} = require("./profileSchema");
const { ALLOWED_PERMISSION_STATUS, MAX_RADIUS_FT } = require("./constants");

async function profileForViewer(uid, target) {
  if (uid !== target) await requireEnabledAccount(target);
  const db = getDb();
  return db.runTransaction(async (tx) => {
    await requireAccount(tx, uid);
    const profile = (await tx.get(db.doc(`users/${target}`))).data();
    const targetState = (await tx.get(db.doc(`accountState/${target}`))).data();
    if (
      !profile ||
      !targetState ||
      targetState.disabled ||
      targetState.deleting
    )
      throw new HttpsError("not-found", "Profile unavailable.");
    if (uid === target) return projectProfile(target, profile, true);
    const relation = (
      await tx.get(db.doc(`relationships/${pairId(uid, target)}`))
    ).data();
    const authorization = (
      await tx.get(db.doc(`connectionAuthorizations/${pairId(uid, target)}`))
    ).data();
    if (
      isBlocked(relation) ||
      relation?.status === "declined" ||
      !targetState.emailVerified
    )
      throw new HttpsError("permission-denied", "Profile unavailable.");
    if (!["accepted", "pending", "history"].includes(relation?.status)) {
      const [mine, theirs] = await Promise.all([
        tx.get(db.doc(`presence/${uid}`)),
        tx.get(db.doc(`presence/${target}`)),
      ]);
      const a = mine.data(),
        b = theirs.data();
      const { distanceBetween } = require("geofire-common");
      if (
        !a ||
        !b ||
        a.expiresAt.toMillis() <= Date.now() ||
        b.expiresAt.toMillis() <= Date.now() ||
        distanceBetween([a.lat, a.lng], [b.lat, b.lng]) * 1000 >
          MAX_RADIUS_FT * 0.3048
      )
        throw new HttpsError("permission-denied", "Profile unavailable.");
    }
    return projectProfile(
      target,
      profile,
      authorizedRelationship(relation, authorization),
    );
  });
}
const profile_get = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid, request) => {
    await rateLimit(uid, "profiles");
    return profileForViewer(uid, documentId(request.data?.uid, "uid"));
  }),
);
const profile_save = onCall(
  CALLABLE_OPTIONS,
  withAuth(
    async (uid, request) => {
      await rateLimit(uid, "profileWrite");
      const profile = validateProfile(request.data?.profile);
      const onboarding = request.data?.onboardingLocation;
      if (
        onboarding &&
        (typeof onboarding.sharingEnabled !== "boolean" ||
          !ALLOWED_PERMISSION_STATUS.has(onboarding.permissionStatus))
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Invalid location preferences.",
        );
      }
      const {
        ownedPhotoPath,
        photoPaths,
        validatePhoto,
        deletePhotoIfUnused,
      } = require("./photos");
      if ("photoURL" in profile) ownedPhotoPath(profile.photoURL, uid);
      for (const path of profile.photoUrls ?? []) ownedPhotoPath(path, uid);
      const attaching = photoPaths(profile);
      for (const path of attaching) await validatePhoto(path, uid);
      const db = getDb();
      let replaced = [];
      await db.runTransaction(async (tx) => {
        await requireAccount(tx, uid);
        const ref = db.doc(`users/${uid}`);
        const previous = (await tx.get(ref)).data();
        for (const path of attaching) {
          const garbage = await tx.get(
            db.doc(`photoGarbage/${require("./security").digest(path)}`),
          );
          if (garbage.exists)
            throw new HttpsError(
              "failed-precondition",
              "Photo is no longer available. Upload it again.",
            );
        }
        const updates = {
          ...profile,
          ...(profile.preConnectionVisibility
            ? {
                preConnectionVisibility: visibility({
                  ...previous?.preConnectionVisibility,
                  ...profile.preConnectionVisibility,
                }),
              }
            : {}),
        };
        const merged = { ...previous, ...updates };
        if ("photoURL" in profile && !("photoUrls" in profile))
          merged.photoUrls = profile.photoURL ? [profile.photoURL] : [];
        replaced = photoPaths(previous).filter(
          (path) => !photoPaths(merged).includes(path),
        );
        tx.set(
          ref,
          {
            ...updates,
            ...(merged.photoUrls ? { photoUrls: merged.photoUrls } : {}),
            email: request.auth.token.email ?? "",
            updatedAt: serverTimestamp(),
            ...(!previous
              ? {
                  createdAt: serverTimestamp(),
                  locationControl: {
                    sharingEnabled: onboarding?.sharingEnabled === true,
                    permissionStatus: onboarding?.permissionStatus ?? "unknown",
                    generation: 0,
                    updatedAt: serverTimestamp(),
                  },
                }
              : {}),
          },
          { merge: true },
        );
        tx.delete(db.doc(`publicProfiles/${uid}`));
      });
      // Failed deletes remain discoverable by the scheduled orphan sweep.
      await Promise.allSettled(
        replaced.map((path) => deletePhotoIfUnused(path)),
      );
      return { ok: true };
    },
    { verified: false },
  ),
);
module.exports = { profile_get, profile_save, profileForViewer };
