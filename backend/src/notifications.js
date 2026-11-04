const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { Timestamp } = require("firebase-admin/firestore");
const { getDb, getAdminAuth, serverTimestamp } = require("./firebase");
const { REGION } = require("./constants");
const {
  authorizedConnection,
  authorizedRelationship,
} = require("./connectionState");
const { digest, isBlocked } = require("./security");

async function liveAccount(uid) {
  const [record, stateSnap] = await Promise.all([
    getAdminAuth()
      .getUser(uid)
      .catch(() => null),
    getDb().doc(`accountState/${uid}`).get(),
  ]);
  const state = stateSnap.data();
  return record &&
    !record.disabled &&
    record.emailVerified &&
    state &&
    !state.disabled &&
    !state.deleting
    ? {
        validAfter: Math.max(
          state.validAfter,
          Math.floor(Date.parse(record.tokensValidAfterTime) / 1000),
        ),
      }
    : null;
}
async function authorizedEvent(kind, id, sender, recipient) {
  const db = getDb();
  if (!(await liveAccount(sender)) || !(await liveAccount(recipient)))
    return false;
  if (kind === "crowd") {
    const user = (await db.doc(`users/${recipient}`).get()).data();
    const presence = (await db.doc(`presence/${recipient}`).get()).data();
    return (
      user?.locationControl?.sharingEnabled === true &&
      presence?.expiresAt?.toMillis() > Date.now()
    );
  }
  const pair = [sender, recipient].sort().join("_");
  const relation = (await db.doc(`relationships/${pair}`).get()).data();
  if (isBlocked(relation)) return false;
  if (kind === "request") {
    const current = (await db.doc(`connectionRequests/${id}`).get()).data();
    return (
      current?.status === "pending" &&
      current.fromUid === sender &&
      current.toUid === recipient &&
      relation?.status === "pending" &&
      (!relation.latestRequestId || relation.latestRequestId === id)
    );
  }
  const connection = (await db.doc(`connections/${id}`).get()).data();
  const authorization = (
    await db.doc(`connectionAuthorizations/${id}`).get()
  ).data();
  return (
    authorizedRelationship(relation, authorization) &&
    authorizedConnection(connection, authorization) &&
    connection?.users?.length === 2 &&
    connection.users.includes(sender) &&
    connection.users.includes(recipient)
  );
}
async function sendNotification(kind, id, eventId, sender, recipient) {
  const db = getDb();
  if (!(await authorizedEvent(kind, id, sender, recipient))) return;
  const tokens = await db
    .collection("pushTokens")
    .where("uid", "==", recipient)
    .where("enabled", "==", true)
    .limit(20)
    .get();
  for (const snap of tokens.docs) {
    // Claim before external delivery: at most one send attempt per event/device.
    // This favors omission over duplicate delivery after an ambiguous network failure.
    const receipt = db.doc(
      `notificationEvents/${digest(`${eventId}:${snap.id}`)}`,
    );
    const claimed = await db.runTransaction(async (tx) => {
      const existing = await tx.get(receipt);
      const token = (await tx.get(snap.ref)).data();
      const state = (await tx.get(db.doc(`accountState/${recipient}`))).data();
      if (
        existing.exists ||
        !token?.enabled ||
        token.uid !== recipient ||
        !state ||
        state.deleting ||
        state.disabled ||
        token.authTime < state.validAfter
      )
        return false;
      tx.create(receipt, {
        uid: recipient,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400000),
      });
      return true;
    });
    if (!claimed) continue;
    const current = (await snap.ref.get()).data();
    const account = await liveAccount(recipient);
    if (
      !current?.enabled ||
      current.uid !== recipient ||
      !account ||
      current.authTime < account.validAfter ||
      !(await authorizedEvent(kind, id, sender, recipient))
    )
      continue;
    // No names, message text, location, IDs, or navigation data survive on a shared device.
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify([
        {
          to: current.expoPushToken,
          title: "Icebreakers",
          body: "Open the app to check for updates.",
          data: { type: "activity" },
        },
      ]),
    });
    if (!response.ok) continue;
    const payload = await response.json();
    const ticket = payload.data?.[0];
    if (ticket?.details?.error === "DeviceNotRegistered")
      await invalidateToken(snap.ref, current);
    if (ticket?.id) {
      await db.runTransaction(async (tx) => {
        const state = (
          await tx.get(db.doc(`accountState/${recipient}`))
        ).data();
        const token = (await tx.get(snap.ref)).data();
        if (
          !state ||
          state.deleting ||
          state.disabled ||
          token?.uid !== recipient ||
          token.generation !== current.generation
        )
          return;
        tx.set(db.doc(`pushReceipts/${digest(ticket.id)}`), {
          ticketId: ticket.id,
          tokenId: snap.id,
          generation: current.generation,
          uid: recipient,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
        });
      });
    }
  }
}
async function invalidateToken(ref, registration) {
  await getDb().runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data();
    if (
      current?.uid === registration.uid &&
      current.generation === registration.generation
    )
      tx.update(ref, { enabled: false });
  });
}
const connection_requestCreated = onDocumentCreated(
  {
    region: REGION,
    document: "connectionRequests/{requestId}",
    maxInstances: 10,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "pending" || data.fromUid === data.toUid)
      return;
    await sendNotification(
      "request",
      event.params.requestId,
      event.id,
      data.fromUid,
      data.toUid,
    );
  },
);
const connection_messageCreated = onDocumentCreated(
  {
    region: REGION,
    document: "connections/{connectionId}/messages/{messageId}",
    maxInstances: 10,
  },
  async (event) => {
    const message = event.data?.data();
    const connection = (
      await getDb().doc(`connections/${event.params.connectionId}`).get()
    ).data();
    if (
      !message ||
      !connection?.users?.includes(message.senderUid) ||
      connection.users.length !== 2
    )
      return;
    const recipient = connection.users.find((uid) => uid !== message.senderUid);
    await sendNotification(
      "message",
      event.params.connectionId,
      event.id,
      message.senderUid,
      recipient,
    );
  },
);
const notifications_checkReceipts = onSchedule(
  { region: REGION, schedule: "every 15 minutes", maxInstances: 1 },
  async () => {
    const db = getDb();
    const receipts = await db
      .collection("pushReceipts")
      .where("createdAt", "<", Timestamp.fromMillis(Date.now() - 15 * 60000))
      .limit(200)
      .get();
    if (receipts.empty) return;
    const response = await fetch(
      "https://exp.host/--/api/v2/push/getReceipts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          ids: receipts.docs.map((doc) => doc.data().ticketId),
        }),
      },
    );
    if (!response.ok) throw new Error("Push receipt lookup failed");
    const result = (await response.json()).data ?? {};
    for (const receipt of receipts.docs) {
      const data = receipt.data();
      if (result[data.ticketId]?.details?.error === "DeviceNotRegistered")
        await invalidateToken(db.doc(`pushTokens/${data.tokenId}`), data);
      // Expo may not have produced a receipt yet; keep it until the next run or TTL.
      if (result[data.ticketId]) await receipt.ref.delete();
    }
  },
);
async function maybeSendCrowdAlert(uid, nearbyUsers) {
  if (nearbyUsers.length < 8) return;
  // A stable half-hour event key deduplicates repeated pings without exposing locations.
  await sendNotification(
    "crowd",
    uid,
    `crowd:${uid}:${Math.floor(Date.now() / 1800000)}`,
    uid,
    uid,
  );
}
module.exports = {
  connection_requestCreated,
  connection_messageCreated,
  notifications_checkReceipts,
  maybeSendCrowdAlert,
};
