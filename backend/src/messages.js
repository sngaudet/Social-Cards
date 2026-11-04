const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, serverTimestamp } = require("./firebase");
const { CALLABLE_OPTIONS, withAuth, documentId, digest, isBlocked, requireAccount, consumeQuota } = require("./security");
const { expiresAt } = require("./connections");

const sendChatMessage = onCall(CALLABLE_OPTIONS, withAuth(async (uid, request) => {
  const data = request.data;
  if (!data || Object.keys(data).sort().join(",") !== "connectionId,operationId,text" ||
      typeof data.text !== "string" || !data.text.trim() || data.text.length > 2000) {
    throw new HttpsError("invalid-argument", "Provide a message of 1–2000 characters.");
  }
  const id = documentId(data.connectionId, "connectionId");
  const operationId = documentId(data.operationId, "operationId");
  const text = data.text.trim();
  const db = getDb();
  const connectionRef = db.doc(`connections/${id}`);
  const messageRef = connectionRef.collection("messages").doc(digest(`${uid}:${operationId}`));
  return db.runTransaction(async (tx) => {
    await requireAccount(tx, uid);
    const connection = (await tx.get(connectionRef)).data();
    if (!connection || connection.users?.length !== 2 || !connection.users.includes(uid)) {
      throw new HttpsError("permission-denied", "Connection unavailable.");
    }
    const otherUid = connection.users.find((member) => member !== uid);
    const otherState = (await tx.get(db.doc(`accountState/${otherUid}`))).data();
    const relationship = (await tx.get(db.doc(`relationships/${id}`))).data();
    const previous = (await tx.get(messageRef)).data();
    if (isBlocked(relationship) || otherState?.deleting || otherState?.disabled || !otherState) {
      throw new HttpsError("permission-denied", "Connection unavailable.");
    }
    if (previous) {
      if (previous.senderUid !== uid || previous.text !== text) throw new HttpsError("already-exists", "Operation already used.");
      return { ok: true, messageId: messageRef.id };
    }
    if (relationship?.status !== "accepted" || expiresAt(connection) <= Date.now()) {
      throw new HttpsError("failed-precondition", "Connection has expired.");
    }
    await consumeQuota(tx, uid, "messages");
    // Only this operation can create messages. Identity, exact schema, and commit time are server owned.
    tx.create(messageRef, { senderUid: uid, text, createdAt: serverTimestamp() });
    return { ok: true, messageId: messageRef.id };
  });
}));
module.exports = { sendChatMessage };
