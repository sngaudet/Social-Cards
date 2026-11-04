// Run with --project <id> --bucket <bucket>; inspect the dry run before adding --apply.
// Deploy deny rules first, then migrate, then release the compatible client/functions.
const {
  Timestamp,
  FieldValue,
  FieldPath,
} = require("firebase-admin/firestore");
function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const project = argument("--project"),
  bucketName = argument("--bucket");
if (
  !project ||
  !bucketName ||
  !/^[a-z0-9.-]+$/.test(project) ||
  !/^[a-z0-9.-]+$/.test(bucketName)
)
  throw new Error("Explicit --project and --bucket are required.");
process.env.FIREBASE_PROJECT_ID = project;
process.env.GCLOUD_PROJECT = project;
process.env.PROFILE_STORAGE_BUCKET = bucketName;
const { getDb, getAdminAuth } = require("../src/firebase");
const { bucket, photoPaths, validatePhoto } = require("../src/photos");
const { authorizedRelationship } = require("../src/connectionState");
const apply = process.argv.includes("--apply");
function legacyPhotoPath(value, uid) {
  if (typeof value !== "string" || !value) return "";
  let path = value;
  if (value.startsWith("https://")) {
    const url = new URL(value);
    const prefix = `/v0/b/${bucketName}/o/`;
    if (
      url.hostname !== "firebasestorage.googleapis.com" ||
      !url.pathname.startsWith(prefix)
    )
      return "";
    path = decodeURIComponent(url.pathname.slice(prefix.length));
  }
  return photoPaths({ photoURL: path }).includes(path) &&
    path.startsWith(`users/${uid}/profilePictures/`)
    ? path
    : "";
}
async function eachDocument(collection, action) {
  let after;
  for (;;) {
    let query = getDb()
      .collection(collection)
      .orderBy(FieldPath.documentId())
      .limit(100);
    if (after) query = query.startAfter(after);
    const page = await query.get();
    if (page.empty) return;
    for (const doc of page.docs) await action(doc);
    after = page.docs.at(-1);
  }
}
async function migrate() {
  const counts = {
    users: 0,
    publicProfiles: 0,
    photos: 0,
    relationships: 0,
    reports: 0,
    devices: 0,
  };
  await eachDocument("users", async (doc) => {
    counts.users++;
    const user = doc.data();
    const record = await getAdminAuth()
      .getUser(doc.id)
      .catch((error) => {
        if (error.code === "auth/user-not-found") return null;
        throw error;
      });
    if (!apply) return;
    if (!record) {
      await getDb()
        .doc(`accountState/${doc.id}`)
        .set(
          {
            disabled: true,
            deleting: true,
            validAfter: Math.floor(Date.now() / 1000) + 1,
            leaseUntil: Timestamp.fromMillis(0),
          },
          { merge: true },
        );
      await getDb()
        .doc(`accountDeletion/${doc.id}`)
        .set(
          { uid: doc.id, status: "pending", requestedAt: Timestamp.now() },
          { merge: true },
        );
      return;
    }
    const main = legacyPhotoPath(user.photoURL, doc.id);
    const photos = [
      ...new Set(
        [
          main,
          ...(Array.isArray(user.photoUrls) ? user.photoUrls : []).map((path) =>
            legacyPhotoPath(path, doc.id),
          ),
        ].filter(Boolean),
      ),
    ];
    await getDb().runTransaction(async (tx) => {
      const ref = getDb().doc(`accountState/${doc.id}`);
      const state = (await tx.get(ref)).data();
      if (state?.deleting) return;
      tx.set(
        ref,
        {
          disabled: record.disabled,
          deleting: false,
          emailVerified: record.emailVerified,
          validAfter: Math.max(
            state?.validAfter ?? 0,
            Math.floor(Date.parse(record.tokensValidAfterTime) / 1000),
          ),
          leaseUntil: Timestamp.fromMillis(0),
        },
        { merge: true },
      );
      tx.update(doc.ref, {
        photoURL: main,
        photoUrls: photos,
        emailVerified: FieldValue.delete(),
        "locationControl.generation":
          (user.locationControl?.generation ?? 0) + 1,
        "locationControl.sharingEnabled": false,
      });
      tx.delete(getDb().doc(`presence/${doc.id}`));
    });
  });
  // Old deletions may have left graph records after the private user doc disappeared.
  const referenced = new Set();
  for (const collection of [
    "relationships",
    "connections",
    "connectionRequests",
    "presence",
  ]) {
    await eachDocument(collection, async (doc) => {
      const data = doc.data();
      const uids =
        collection === "presence"
          ? [doc.id]
          : collection === "connectionRequests"
            ? [data.fromUid, data.toUid]
            : Array.isArray(data.users)
              ? data.users
              : [];
      for (const uid of uids)
        if (typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid))
          referenced.add(uid);
    });
  }
  for (const uid of referenced) {
    const record = await getAdminAuth()
      .getUser(uid)
      .catch((error) => {
        if (error.code === "auth/user-not-found") return null;
        throw error;
      });
    if (record || !apply) continue;
    await getDb()
      .doc(`accountState/${uid}`)
      .set(
        {
          disabled: true,
          deleting: true,
          validAfter: Math.floor(Date.now() / 1000) + 1,
          leaseUntil: Timestamp.fromMillis(0),
        },
        { merge: true },
      );
    await getDb()
      .doc(`accountDeletion/${uid}`)
      .set(
        { uid, status: "pending", requestedAt: Timestamp.now() },
        { merge: true },
      );
  }
  await eachDocument("publicProfiles", async (doc) => {
    counts.publicProfiles++;
    if (apply) await doc.ref.delete();
  });
  await eachDocument("relationships", async (doc) => {
    const data = doc.data();
    const authorizationRef = getDb().doc(`connectionAuthorizations/${doc.id}`);
    const authorization = (await authorizationRef.get()).data();
    if (
      data.status === "accepted" &&
      !authorizedRelationship(data, authorization)
    ) {
      counts.relationships++;
      if (apply) {
        const connection = getDb().doc(`connections/${doc.id}`);
        await getDb().runTransaction(async (tx) => {
          const current = (await tx.get(doc.ref)).data();
          const history = await tx.get(connection);
          const authorization = (await tx.get(authorizationRef)).data();
          if (
            current?.status !== "accepted" ||
            authorizedRelationship(current, authorization)
          )
            return;
          tx.update(doc.ref, { status: "history" });
          if (history.exists)
            tx.update(connection, {
              expiresAt: Timestamp.fromMillis(Date.now()),
            });
        });
      }
      return;
    }
    if (data.status !== "blocked") return;
    counts.relationships++;
    if (apply)
      await doc.ref.update({
        blockerUids: [
          ...new Set(
            [...(data.blockerUids ?? []), data.blockedByUid].filter(Boolean),
          ),
        ],
        historyReaderUid: data.historyReaderUid ?? data.blockedByUid ?? "",
        blockedPreview: {
          firstName: data.blockedPreview?.firstName ?? "",
          avatarId: data.blockedPreview?.avatarId ?? "",
        },
      });
  });
  await eachDocument("reports", async (doc) => {
    counts.reports++;
    if (apply)
      await doc.ref.update({
        expiresAt: Timestamp.fromMillis(
          (doc.data().createdAt?.toMillis() ?? Date.now()) + 90 * 86400000,
        ),
      });
  });
  const devices = await getDb().collectionGroup("devices").get();
  for (const doc of devices.docs) {
    counts.devices++;
    if (apply) await doc.ref.delete();
  }
  let pageToken;
  do {
    const [files, next] = await bucket().getFiles({
      prefix: "users/",
      maxResults: 100,
      autoPaginate: false,
      ...(pageToken ? { pageToken } : {}),
    });
    for (const file of files) {
      counts.photos++;
      if (!apply) continue;
      // Revoke every legacy download token, including orphaned or unexpected object paths.
      await file.setMetadata({
        cacheControl: "private, no-store",
        metadata: { firebaseStorageDownloadTokens: null },
      });
      const uid = file.name.split("/")[1];
      const profile = (await getDb().doc(`users/${uid}`).get()).data();
      if (!photoPaths(profile).includes(file.name))
        await file.delete({ ignoreNotFound: true });
      else {
        try {
          await validatePhoto(file.name, uid);
        } catch (error) {
          if (error.code !== "invalid-argument") throw error;
          await file.delete({ ignoreNotFound: true });
        }
      }
    }
    pageToken = next?.pageToken;
  } while (pageToken);
  // Disabled/deleted accounts cannot regain access even if they had legacy authorization fields.
  console.log(
    JSON.stringify({ project, bucket: bucketName, applied: apply, counts }),
  );
}
migrate().catch((error) => {
  console.error("Security migration failed", error.code ?? error.message);
  process.exitCode = 1;
});
