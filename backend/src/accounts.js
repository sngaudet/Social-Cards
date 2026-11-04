const { onCall, HttpsError } = require("firebase-functions/v2/https");
const functionsV1 = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { Timestamp } = require("firebase-admin/firestore");
const { getDb, getAdminAuth, serverTimestamp, logger } = require("./firebase");
const {
  CALLABLE_OPTIONS,
  withAuth,
  digest,
  requireAccount,
} = require("./security");
const { clearPresenceInTransaction } = require("./location");
const { disableUserDevices } = require("./devices");
const { bucket } = require("./photos");

async function markDeleting(uid, authenticated = false) {
  const db = getDb();
  await db.runTransaction(async (tx) => {
    if (authenticated) await requireAccount(tx, uid);
    const stateRef = db.doc(`accountState/${uid}`);
    const jobRef = db.doc(`accountDeletion/${uid}`);
    const state = (await tx.get(stateRef)).data();
    const job = (await tx.get(jobRef)).data();
    tx.set(
      stateRef,
      {
        disabled: true,
        deleting: true,
        leaseUntil: Timestamp.fromMillis(0),
        validAfter: Math.max(
          state?.validAfter ?? 0,
          Math.floor(Date.now() / 1000) + 1,
        ),
      },
      { merge: true },
    );
    tx.set(
      jobRef,
      {
        uid,
        status: job?.status === "complete" ? "complete" : "pending",
        requestedAt: job?.requestedAt ?? serverTimestamp(),
      },
      { merge: true },
    );
  });
}
async function deleteQuery(query, transform) {
  // Paging by deleting each completed page keeps retries bounded and repeatable.
  for (;;) {
    const page = await query.limit(200).get();
    if (page.empty) return;
    if (transform) {
      for (const doc of page.docs) await transform(doc);
    } else {
      const batch = getDb().batch();
      for (const doc of page.docs) batch.delete(doc.ref);
      await batch.commit();
    }
  }
}
async function cleanupDeletedUserData(uid) {
  await markDeleting(uid);
  const db = getDb();
  const jobRef = db.doc(`accountDeletion/${uid}`);
  try {
    await disableUserDevices(uid);
    const record = await getAdminAuth()
      .getUser(uid)
      .catch((error) => {
        if (error.code === "auth/user-not-found") return null;
        throw error;
      });
    if (record) {
      const ignoreMissing = (error) => {
        if (error.code !== "auth/user-not-found") throw error;
      };
      await getAdminAuth().revokeRefreshTokens(uid).catch(ignoreMissing);
      await getAdminAuth().deleteUser(uid).catch(ignoreMissing);
    }
    // Shared conversation retention is zero: deletion removes the conversation for both people.
    const connections = await db
      .collection("connections")
      .where("users", "array-contains", uid)
      .get();
    for (const connection of connections.docs)
      await db.recursiveDelete(connection.ref);
    // Legacy orphan messages without a parent still carry the sender identity.
    await deleteQuery(
      db.collectionGroup("messages").where("senderUid", "==", uid),
    );
    for (const [collection, field, op] of [
      ["connectionRequests", "fromUid", "=="],
      ["connectionRequests", "toUid", "=="],
      ["relationships", "users", "array-contains"],
      ["connectionAuthorizations", "users", "array-contains"],
      ["rateLimits", "uid", "=="],
      ["requestOperations", "uid", "=="],
      ["requestOperations", "target", "=="],
      ["photoGarbage", "uid", "=="],
      ["photoUploads", "uid", "=="],
      ["pushReceipts", "uid", "=="],
      ["notificationEvents", "uid", "=="],
    ]) {
      await deleteQuery(db.collection(collection).where(field, op, uid));
    }
    for (const field of ["reporterUid", "reportedUid"]) {
      // Reports retain moderation evidence for 90 days, with account references pseudonymized.
      await deleteQuery(
        db.collection("reports").where(field, "==", uid),
        async (doc) => {
          const created = doc.data().createdAt?.toMillis() ?? Date.now();
          await doc.ref.update({
            [field]: `deleted:${digest(uid)}`,
            expiresAt: Timestamp.fromMillis(created + 90 * 86400000),
          });
        },
      );
    }
    for (const collection of ["pushTokens", "pushInstallations"]) {
      const docs = await db
        .collection(collection)
        .where("uid", "==", uid)
        .get();
      for (const snap of docs.docs)
        await db.runTransaction(async (tx) => {
          if ((await tx.get(snap.ref)).data()?.uid === uid) tx.delete(snap.ref);
        });
    }
    // Prefix deletion includes replaced, orphaned, and interrupted uploads.
    await bucket().deleteFiles({ prefix: `users/${uid}/`, force: true });
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await Promise.all([
      db.doc(`publicProfiles/${uid}`).delete(),
      db.doc(`presence/${uid}`).delete(),
      db.doc(`notificationState/${uid}`).delete(),
    ]);
    await jobRef.set(
      { uid, status: "complete", completedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    await jobRef.set(
      {
        status: "pending",
        lastAttemptAt: serverTimestamp(),
        errorCode: String(error.code ?? "cleanup-failed").slice(0, 100),
      },
      { merge: true },
    );
    throw error;
  }
}
const auth_deleteAccount = onCall(
  CALLABLE_OPTIONS,
  withAuth(
    async (uid, request) => {
      if (Date.now() / 1000 - request.auth.token.auth_time > 300)
        throw new HttpsError(
          "failed-precondition",
          "Sign in again before deleting your account.",
          { reason: "recent-login-required" },
        );
      await markDeleting(uid, true);
      try {
        await cleanupDeletedUserData(uid);
        return { ok: true, pending: false };
      } catch (error) {
        logger.error("Deletion queued for retry", { uid, code: error.code });
        return { ok: true, pending: true };
      }
    },
    { verified: false },
  ),
);
const auth_endSession = onCall(
  CALLABLE_OPTIONS,
  withAuth(
    async (uid) => {
      // Revocation applies to the account's existing sessions, including old tokens on shared devices.
      const db = getDb();
      await db.runTransaction(async (tx) => {
        const state = await requireAccount(tx, uid);
        await clearPresenceInTransaction(tx, uid);
        tx.set(
          db.doc(`accountState/${uid}`),
          {
            validAfter: Math.max(
              state.validAfter,
              Math.floor(Date.now() / 1000) + 1,
            ),
            leaseUntil: Timestamp.fromMillis(0),
          },
          { merge: true },
        );
      });
      await getAdminAuth().revokeRefreshTokens(uid);
      await disableUserDevices(uid);
      return { ok: true };
    },
    { verified: false },
  ),
);
const auth_cleanupDeletedUser = functionsV1
  .region(CALLABLE_OPTIONS.region)
  .runWith({ failurePolicy: true, timeoutSeconds: 540 })
  .auth.user()
  .onDelete(async (user) => {
    await cleanupDeletedUserData(user.uid);
  });
const accounts_retryCleanup = onSchedule(
  {
    region: CALLABLE_OPTIONS.region,
    schedule: "every 60 minutes",
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  async () => {
    const jobs = await getDb()
      .collection("accountDeletion")
      .where("status", "==", "pending")
      .limit(50)
      .get();
    for (const job of jobs.docs) {
      try {
        await cleanupDeletedUserData(job.id);
      } catch (error) {
        logger.error("Account cleanup will retry", {
          uid: job.id,
          code: error.code,
        });
      }
    }
    // Sweep shared-history orphans whose parent was removed by older clients.
    for (const ref of await getDb().collection("connections").listDocuments()) {
      if (!(await ref.get()).exists) await getDb().recursiveDelete(ref);
    }
    // TTL is a second line of defense; explicit retention does not depend on TTL being enabled.
    for (const collection of [
      "reports",
      "rateLimits",
      "notificationEvents",
      "pushReceipts",
      "photoUploads",
    ]) {
      await deleteQuery(
        getDb()
          .collection(collection)
          .where("expiresAt", "<=", Timestamp.now()),
      );
    }
  },
);
module.exports = {
  auth_deleteAccount,
  auth_endSession,
  auth_cleanupDeletedUser,
  accounts_retryCleanup,
  cleanupDeletedUserData,
};
