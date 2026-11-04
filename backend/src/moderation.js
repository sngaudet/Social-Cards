const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");
const { getDb, serverTimestamp } = require("./firebase");
const {
  CALLABLE_OPTIONS,
  withAuth,
  documentId,
  digest,
  requireAccount,
  consumeQuota,
} = require("./security");
const reportUser = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid, request) => {
    const {
      reportedUid,
      operationId,
      reason,
      details = "",
    } = request.data ?? {};
    documentId(reportedUid, "reportedUid");
    documentId(operationId, "operationId");
    if (
      uid === reportedUid ||
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.length > 100 ||
      typeof details !== "string" ||
      details.length > 1000
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Provide a valid report reason and at most 1000 characters of detail.",
      );
    }
    const db = getDb();
    const ref = db.doc(`reports/${digest(`${uid}:${operationId}`)}`);
    return db.runTransaction(async (tx) => {
      await requireAccount(tx, uid);
      const target = (
        await tx.get(db.doc(`accountState/${reportedUid}`))
      ).data();
      const previous = await tx.get(ref);
      if (previous.exists) return { ok: true, reportId: ref.id };
      if (!target || target.deleting || target.disabled)
        throw new HttpsError("not-found", "User unavailable.");
      await consumeQuota(tx, uid, "reports");
      tx.create(ref, {
        reportId: ref.id,
        reporterUid: uid,
        reportedUid,
        reason: reason.trim(),
        details: details.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 90 * 86400000),
      });
      return { ok: true, reportId: ref.id };
    });
  }),
);
// Compatibility with older clients; Auth triggers and persistent cleanup jobs own deletion.
const pruneDeletedAccounts = onCall(
  CALLABLE_OPTIONS,
  withAuth(async () => {
    return { ok: true, prunedUidCount: 0 };
  }),
);
module.exports = { reportUser, pruneDeletedAccounts };
