const { Buffer } = require("node:buffer");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getStorage } = require("firebase-admin/storage");
const { getAdminApp, getDb, logger } = require("./firebase");
const {
  CALLABLE_OPTIONS,
  withAuth,
  documentId,
  digest,
  rateLimit,
} = require("./security");
const { profileForViewer } = require("./profiles");
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const { PHOTO_PATH, ownedPhotoPath, photoPaths } = require("./photoPaths");
function bucket() {
  return getStorage(getAdminApp()).bucket();
}
function validImage(bytes, contentType) {
  if (contentType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/webp")
    return (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  return false;
}
async function validatePhoto(path, uid) {
  ownedPhotoPath(path, uid);
  const file = bucket().file(path);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) <= 0 || Number(metadata.size) > MAX_PHOTO_BYTES)
    throw new HttpsError("invalid-argument", "Photo must be at most 2 MB.");
  const [header] = await file.download({ start: 0, end: 15 });
  if (!validImage(header, metadata.contentType))
    throw new HttpsError("invalid-argument", "Use a JPEG, PNG, or WebP photo.");
  // Rewrite token-bearing objects as a new private generation. Old Firebase
  // download URLs then fail, including when metadata-token removal is emulated poorly.
  if (metadata.metadata?.firebaseStorageDownloadTokens) {
    const [contents] = await file.download();
    try {
      await file.save(contents, {
        resumable: false,
        contentType: metadata.contentType,
        metadata: { cacheControl: "private, no-store", metadata: {} },
        preconditionOpts: { ifGenerationMatch: metadata.generation },
      });
    } catch (error) {
      if (error.code !== 412) throw error;
      // A concurrent validation may already have revoked the same generation.
      const [current] = await file.getMetadata();
      if (current.metadata?.firebaseStorageDownloadTokens) throw error;
    }
  } else if (metadata.cacheControl !== "private, no-store") {
    await file.setMetadata({ cacheControl: "private, no-store" });
  }
  return metadata;
}
const profile_preparePhotoUpload = onCall(
  CALLABLE_OPTIONS,
  withAuth(
    async (uid, request) => {
      const { size, contentType } = request.data ?? {};
      if (
        !Number.isInteger(size) ||
        size <= 0 ||
        size > MAX_PHOTO_BYTES ||
        !["image/jpeg", "image/png", "image/webp"].includes(contentType)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Use a JPEG, PNG, or WebP photo up to 2 MB.",
        );
      }
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      }[contentType];
      const name = `${require("node:crypto").randomUUID()}.${extension}`;
      const db = getDb();
      await db.runTransaction(async (tx) => {
        await require("./security").requireAccount(tx, uid);
        await require("./security").consumeQuota(tx, uid, "photos");
        tx.create(db.doc(`photoUploads/${uid}_${name}`), {
          uid,
          size,
          contentType,
          expiresAt: require("firebase-admin/firestore").Timestamp.fromMillis(
            Date.now() + 120000,
          ),
        });
      });
      return { path: `users/${uid}/profilePictures/${name}` };
    },
    { verified: false },
  ),
);
const profile_getPhoto = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid, request) => {
    const target = documentId(request.data?.uid, "uid");
    await rateLimit(uid, "profiles");
    const profile = await profileForViewer(uid, target);
    const path = ownedPhotoPath(profile.photoURL ?? "", target);
    if (!path) return { dataUri: "" };
    const metadata = await validatePhoto(path, target);
    const [contents] = await bucket().file(path).download();
    const latest = await profileForViewer(uid, target);
    if (latest.photoURL !== path) return { dataUri: "" };
    // The caller is authorized before any bytes are returned. No shareable bearer URL exists.
    return {
      dataUri: `data:${metadata.contentType};base64,${contents.toString("base64")}`,
    };
  }),
);
const profile_photoUploaded = onObjectFinalized(
  { region: CALLABLE_OPTIONS.region, maxInstances: 10 },
  async (event) => {
    const name = event.data.name;
    const match = PHOTO_PATH.exec(name ?? "");
    if (!match) return;
    const uid = match[1];
    const state = (await getDb().doc(`accountState/${uid}`).get()).data();
    if (!state || state.deleting || state.disabled) {
      await bucket().file(name).delete({ ignoreNotFound: true });
      return;
    }
    try {
      await validatePhoto(name, uid);
    } catch (error) {
      if (error.code === "invalid-argument")
        await bucket().file(name).delete({ ignoreNotFound: true });
      else throw error;
    }
  },
);
async function deletePhotoIfUnused(path, minAgeMs = 0) {
  const match = PHOTO_PATH.exec(path);
  if (!match) return;
  const db = getDb();
  const file = bucket().file(path);
  if (minAgeMs) {
    const [metadata] = await file.getMetadata().catch((error) => {
      if (error.code === 404) return [{}];
      throw error;
    });
    if (Date.parse(metadata.timeCreated) > Date.now() - minAgeMs) return;
  }
  const lock = db.doc(`photoGarbage/${digest(path)}`);
  // A save must read this same tombstone before attaching an immutable object.
  const remove = await db.runTransaction(async (tx) => {
    const profile = (await tx.get(db.doc(`users/${match[1]}`))).data();
    if (photoPaths(profile).includes(path)) return false;
    tx.set(lock, { path, uid: match[1], deleting: true });
    return true;
  });
  if (!remove) return;
  await file.delete({ ignoreNotFound: true });
}
const profile_collectPhotos = onSchedule(
  {
    region: CALLABLE_OPTIONS.region,
    schedule: "every 24 hours",
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  async () => {
    let pageToken;
    do {
      const [files, next] = await bucket().getFiles({
        prefix: "users/",
        maxResults: 200,
        autoPaginate: false,
        ...(pageToken ? { pageToken } : {}),
      });
      for (const file of files) {
        try {
          await deletePhotoIfUnused(file.name, 24 * 60 * 60 * 1000);
        } catch (error) {
          logger.error("Photo cleanup failed", {
            path: file.name,
            code: error.code,
          });
          throw error;
        }
      }
      pageToken = next?.pageToken;
    } while (pageToken);
  },
);
module.exports = {
  profile_preparePhotoUpload,
  profile_getPhoto,
  profile_photoUploaded,
  profile_collectPhotos,
  ownedPhotoPath,
  photoPaths,
  validatePhoto,
  deletePhotoIfUnused,
  bucket,
  validImage,
};
