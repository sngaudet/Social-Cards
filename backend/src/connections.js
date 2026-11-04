const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");
const { getDb, serverTimestamp } = require("./firebase");
const {
  CALLABLE_OPTIONS,
  withAuth,
  documentId,
  pairId,
  digest,
  isBlocked,
  requireAccount,
  consumeQuota,
  requireEnabledAccount,
} = require("./security");
const { authorizedConnection } = require("./connectionState");
const CHAT_DURATION_MS = 24 * 60 * 60 * 1000;
function expiresAt(connection) {
  return (
    connection?.expiresAt?.toMillis() ??
    (connection?.createdAt?.toMillis() ?? 0) + CHAT_DURATION_MS
  );
}
async function pendingRequests(tx, fromUid, toUid, limit) {
  const db = getDb();
  const query = (from, to) =>
    db
      .collection("connectionRequests")
      .where("fromUid", "==", from)
      .where("toUid", "==", to)
      .where("status", "==", "pending")
      .limit(limit);
  const [outgoing, incoming] = await Promise.all([
    tx.get(query(fromUid, toUid)),
    tx.get(query(toUid, fromUid)),
  ]);
  return [...outgoing.docs, ...incoming.docs];
}
async function currentPendingRequest(tx, relationship, uid, target) {
  let requestId;
  try {
    requestId = documentId(relationship?.latestRequestId, "requestId");
  } catch {
    return null;
  }
  const data = (
    await tx.get(getDb().doc(`connectionRequests/${requestId}`))
  ).data();
  return data?.status === "pending" &&
    ((data.fromUid === uid && data.toUid === target) ||
      (data.fromUid === target && data.toUid === uid))
    ? requestId
    : null;
}
function requireAvailable(relationship) {
  if (isBlocked(relationship))
    throw new HttpsError("permission-denied", "Connection unavailable.");
}
const createConnectionRequest = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid, request) => {
    const target = documentId(request.data?.toUid, "recipient");
    const operationId = documentId(request.data?.operationId, "operationId");
    if (target === uid)
      throw new HttpsError("invalid-argument", "Choose another user.");
    await requireEnabledAccount(target);
    const db = getDb();
    const id = pairId(uid, target);
    const relationshipRef = db.doc(`relationships/${id}`);
    const requestRef = db.doc(
      `connectionRequests/${digest(`${uid}:${operationId}`)}`,
    );
    const operationRef = db.doc(
      `requestOperations/${digest(`${uid}:${operationId}`)}`,
    );
    return db.runTransaction(async (tx) => {
      const relationship = (await tx.get(relationshipRef)).data();
      await requireAccount(tx, uid);
      const targetProfile = await tx.get(db.doc(`users/${target}`));
      const targetState = await tx.get(db.doc(`accountState/${target}`));
      const operation = (await tx.get(operationRef)).data();
      const previousRequest = (await tx.get(requestRef)).data();
      const connection = (await tx.get(db.doc(`connections/${id}`))).data();
      const authorization = (
        await tx.get(db.doc(`connectionAuthorizations/${id}`))
      ).data();
      requireAvailable(relationship);
      if (
        !targetProfile.exists ||
        !targetState.data()?.emailVerified ||
        targetState.data()?.deleting ||
        targetState.data()?.disabled
      ) {
        throw new HttpsError("not-found", "User unavailable.");
      }
      if (operation) {
        if (operation.target !== target)
          throw new HttpsError("already-exists", "Operation already used.");
        return { ok: true, requestId: operation.requestId };
      }
      const rememberOperation = (requestId) =>
        tx.create(operationRef, { uid, target, requestId });
      if (previousRequest) {
        if (previousRequest.toUid !== target)
          throw new HttpsError("already-exists", "Operation already used.");
        rememberOperation(requestRef.id);
        return { ok: true, requestId: requestRef.id };
      }
      if (relationship?.status === "declined")
        throw new HttpsError("permission-denied", "Connection unavailable.");
      const pendingId =
        relationship?.status === "pending"
          ? await currentPendingRequest(tx, relationship, uid, target)
          : null;
      if (pendingId) {
        await consumeQuota(tx, uid, "requests");
        rememberOperation(pendingId);
        return { ok: true, requestId: pendingId };
      }
      // Adopt existing requests from older clients without creating duplicates.
      const legacy = await pendingRequests(tx, uid, target, 1);
      const existing = legacy[0];
      if (existing) {
        await consumeQuota(tx, uid, "requests");
        rememberOperation(existing.id);
        tx.set(
          relationshipRef,
          {
            users: [uid, target].sort(),
            status: "pending",
            latestRequestId: existing.id,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        return { ok: true, requestId: existing.id };
      }
      if (
        authorizedConnection(connection, authorization) &&
        expiresAt(connection) > Date.now()
      )
        throw new HttpsError(
          "failed-precondition",
          "Connection is already active.",
        );
      await consumeQuota(tx, uid, "requests");
      rememberOperation(requestRef.id);
      tx.create(requestRef, {
        fromUid: uid,
        toUid: target,
        status: "pending",
        createdAt: serverTimestamp(),
        respondedAt: null,
      });
      tx.set(relationshipRef, {
        users: [uid, target].sort(),
        status: "pending",
        authorizationVersion: 1,
        latestRequestId: requestRef.id,
        updatedAt: serverTimestamp(),
      });
      return { ok: true, requestId: requestRef.id };
    });
  }),
);

async function decide(uid, requestId, accept) {
  const db = getDb();
  const requestRef = db.doc(
    `connectionRequests/${documentId(requestId, "requestId")}`,
  );
  // Request participants are immutable. Discover the pair, then lock its relationship
  // before any other record, consistently with creation, blocking, and messaging.
  const routing = (await requestRef.get()).data();
  if (!routing) throw new HttpsError("not-found", "Request unavailable.");
  documentId(routing.fromUid, "sender");
  documentId(routing.toUid, "recipient");
  if (routing.fromUid === routing.toUid)
    throw new HttpsError("failed-precondition", "Malformed request.");
  if (![routing.fromUid, routing.toUid].includes(uid))
    throw new HttpsError("permission-denied", "Request unavailable.");
  await requireEnabledAccount(
    uid === routing.toUid ? routing.fromUid : routing.toUid,
  );
  const id = pairId(routing.fromUid, routing.toUid);
  const relationshipRef = db.doc(`relationships/${id}`);
  return db.runTransaction(async (tx) => {
    const relationship = (await tx.get(relationshipRef)).data();
    await requireAccount(tx, uid);
    const data = (await tx.get(requestRef)).data();
    if (!data) throw new HttpsError("not-found", "Request unavailable.");
    if (
      accept ? data.toUid !== uid : ![data.fromUid, data.toUid].includes(uid)
    ) {
      throw new HttpsError(
        "permission-denied",
        "Only the recipient may accept a request.",
      );
    }
    const connectionRef = db.doc(`connections/${id}`);
    const connection = (await tx.get(connectionRef)).data();
    const authorizationRef = db.doc(`connectionAuthorizations/${id}`);
    const authorization = (await tx.get(authorizationRef)).data();
    const otherState = (
      await tx.get(
        db.doc(
          `accountState/${uid === data.toUid ? data.fromUid : data.toUid}`,
        ),
      )
    ).data();
    requireAvailable(relationship);
    if (!otherState || otherState.deleting || otherState.disabled)
      throw new HttpsError("permission-denied", "User unavailable.");
    const status = accept
      ? "accepted"
      : data.fromUid === uid
        ? "cancelled"
        : "declined";
    // A retry returns the original result without extending its deadline.
    if (data.status === status)
      return { ok: true, requestId, connectionId: id };
    if (
      data.status !== "pending" ||
      (relationship?.latestRequestId &&
        relationship.latestRequestId !== requestId)
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Request has already been decided.",
      );
    }
    if (
      accept &&
      authorizedConnection(connection, authorization) &&
      expiresAt(connection) > Date.now()
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Connection is already active.",
      );
    }
    await consumeQuota(tx, uid, "decisions");
    tx.update(requestRef, { status, respondedAt: serverTimestamp() });
    tx.set(
      relationshipRef,
      {
        users: [data.fromUid, data.toUid].sort(),
        status: status === "cancelled" ? "none" : status,
        authorizationVersion: 1,
        latestRequestId: requestId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    if (accept) {
      tx.set(authorizationRef, {
        users: [data.fromUid, data.toUid].sort(),
        requestId,
        acceptedAt: serverTimestamp(),
      });
      tx.set(connectionRef, {
        users: [data.fromUid, data.toUid].sort(),
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + CHAT_DURATION_MS),
        requestId,
        authorizationVersion: 1,
      });
    }
    return { ok: true, requestId, connectionId: id };
  });
}
const acceptConnectionRequest = onCall(
  CALLABLE_OPTIONS,
  withAuth((uid, request) => decide(uid, request.data?.requestId, true)),
);
const declineConnectionRequest = onCall(
  CALLABLE_OPTIONS,
  withAuth((uid, request) => decide(uid, request.data?.requestId, false)),
);
const blockUser = onCall(
  CALLABLE_OPTIONS,
  withAuth(async (uid, request) => {
    const target = documentId(request.data?.targetUid, "targetUid");
    if (target === uid)
      throw new HttpsError("invalid-argument", "Choose another user.");
    const db = getDb();
    const id = pairId(uid, target);
    return db.runTransaction(async (tx) => {
      const ref = db.doc(`relationships/${id}`);
      const relationship = (await tx.get(ref)).data();
      await requireAccount(tx, uid);
      const connection = await tx.get(db.doc(`connections/${id}`));
      const profile = (await tx.get(db.doc(`users/${target}`))).data();
      const targetState = (
        await tx.get(db.doc(`accountState/${target}`))
      ).data();
      if (!targetState || targetState.deleting)
        throw new HttpsError("not-found", "User unavailable.");
      const requests = await pendingRequests(tx, uid, target, 100);
      const firstBlocker = isBlocked(relationship)
        ? relationship.blockedByUid
        : uid;
      const blockers = [
        ...new Set([...(relationship?.blockerUids ?? []), firstBlocker, uid]),
      ].filter(Boolean);
      await consumeQuota(tx, uid, "decisions");
      tx.set(
        ref,
        {
          users: [uid, target].sort(),
          status: "blocked",
          blockerUids: blockers,
          blockedByUid: firstBlocker,
          historyReaderUid: isBlocked(relationship)
            ? (relationship.historyReaderUid ?? firstBlocker)
            : connection.exists
              ? uid
              : "",
          blockedAt: relationship?.blockedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          blockedPreview: isBlocked(relationship)
            ? {
                firstName: relationship.blockedPreview?.firstName ?? "",
                avatarId: relationship.blockedPreview?.avatarId ?? "",
              }
            : {
                firstName: profile?.firstName ?? "",
                avatarId: profile?.avatarId ?? "",
              },
          hasMessageHistory: connection.exists,
        },
        { merge: true },
      );
      for (const snap of requests) {
        tx.update(snap.ref, {
          status: "declined",
          respondedAt: serverTimestamp(),
        });
      }
      return {
        ok: true,
        relationshipId: id,
        hasMessageHistory: connection.exists,
      };
    });
  }),
);
module.exports = {
  createConnectionRequest,
  acceptConnectionRequest,
  declineConnectionRequest,
  blockUser,
  expiresAt,
};
