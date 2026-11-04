const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, serverTimestamp } = require("./firebase");
const {
  CALLABLE_OPTIONS,
  withAuth,
  documentId,
  digest,
  requireAccount,
  consumeQuota,
} = require("./security");
const TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/;
const location_registerPushToken = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid, request) => {
    const {
      deviceId,
      installationSecret,
      generation,
      expoPushToken,
      platform,
    } = request.data ?? {};
    documentId(deviceId, "deviceId");
    if (
      typeof installationSecret !== "string" ||
      !/^[A-Za-z0-9_-]{40,128}$/.test(installationSecret) ||
      !Number.isSafeInteger(generation) ||
      generation < 1 ||
      !TOKEN.test(expoPushToken) ||
      !["ios", "android"].includes(platform)
    ) {
      throw new HttpsError("invalid-argument", "Invalid device registration.");
    }
    const db = getDb();
    const installationRef = db.doc(`pushInstallations/${digest(deviceId)}`);
    const tokenRef = db.doc(`pushTokens/${digest(expoPushToken)}`);
    return db.runTransaction(async (tx) => {
      await requireAccount(tx, uid);
      const installation = (await tx.get(installationRef)).data();
      const token = (await tx.get(tokenRef)).data();
      if (
        (installation &&
          installation.secretHash !== digest(installationSecret)) ||
        (token && token.installationId !== installationRef.id)
      )
        throw new HttpsError(
          "permission-denied",
          "Device ownership could not be verified.",
        );
      if (installation && generation <= installation.generation) {
        if (
          generation === installation.generation &&
          installation.uid === uid &&
          installation.tokenId === tokenRef.id &&
          token?.enabled
        )
          return { ok: true };
        throw new HttpsError(
          "failed-precondition",
          "Device registration has changed.",
        );
      }
      await consumeQuota(tx, uid, "devices");
      if (installation?.tokenId && installation.tokenId !== tokenRef.id)
        tx.delete(db.doc(`pushTokens/${installation.tokenId}`));
      if (installation?.uid && installation.uid !== uid)
        tx.delete(
          db.doc(`users/${installation.uid}/devices/${installationRef.id}`),
        );
      tx.set(installationRef, {
        uid,
        secretHash: digest(installationSecret),
        generation,
        tokenId: tokenRef.id,
        updatedAt: serverTimestamp(),
      });
      tx.set(tokenRef, {
        uid,
        installationId: installationRef.id,
        expoPushToken,
        platform,
        enabled: true,
        authTime: request.auth.token.auth_time,
        generation,
        updatedAt: serverTimestamp(),
      });
      tx.set(db.doc(`users/${uid}/devices/${installationRef.id}`), {
        tokenId: tokenRef.id,
        enabled: true,
        platform,
        updatedAt: serverTimestamp(),
      });
      return { ok: true };
    });
  }),
);
async function disableUserDevices(uid) {
  const db = getDb();
  const tokens = await db
    .collection("pushTokens")
    .where("uid", "==", uid)
    .get();
  for (const snap of tokens.docs) {
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(snap.ref)).data();
      if (current?.uid === uid) tx.update(snap.ref, { enabled: false });
    });
  }
}
module.exports = { location_registerPushToken, disableUserDevices, TOKEN };
