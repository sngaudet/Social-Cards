const { onCall, HttpsError } = require("firebase-functions/v2/https");
const functionsV1 = require("firebase-functions");
const {
  getAdminAuth,
  getDb,
  serverTimestamp,
  timestampFromDate,
} = require("./firebase");
const {
  REGION,
  DEFAULT_RADIUS_FT,
  IMPACTED_LIMIT,
  FRESHNESS_MS,
  ALLOWED_PERMISSION_STATUS,
} = require("./constants");
const {
  withAuth,
  nowDate,
  getTimestampValue,
  toMeters,
  parseRadiusFt,
  rejectPing,
  validatePingInput,
  geohashForLocation,
  isFreshPresence,
  getPresenceByUid,
  queryNearbyPresence,
  getNeighborsForSubject,
  getExcludedRelationshipUids,
  getUsersByUids,
  buildNearbyUserPayload,
  getThrottleSeconds,
} = require("./helpers");
const {
  maybeSendCrowdAlert,
  connection_requestCreated,
  connection_messageCreated,
} = require("./notifications");

// this gives a user doc reference from a uid
function getUserRef(uid) {
  return getDb().collection("users").doc(uid);
}

function getPublicProfileRef(uid) {
  return getDb().collection("publicProfiles").doc(uid);
}

function chunkArray(items, chunkSize) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function deleteDocRefsInBatches(refs) {
  const db = getDb();
  const uniqueRefs = Array.from(
    new Map(refs.map((ref) => [ref.path, ref])).values(),
  );

  for (const chunk of chunkArray(uniqueRefs, 400)) {
    const batch = db.batch();

    for (const ref of chunk) {
      batch.delete(ref);
    }

    await batch.commit();
  }
}

async function deleteConnectionRef(connectionRef) {
  const db = getDb();

  if (typeof db.recursiveDelete === "function") {
    await db.recursiveDelete(connectionRef).catch(() => {});
    return;
  }

  await connectionRef.delete().catch(() => {});
}

async function cleanupDeletedUserData(uid) {
  const db = getDb();
  const userRef = getUserRef(uid);
  const publicProfileRef = getPublicProfileRef(uid);
  const presenceRef = db.collection("presence").doc(uid);
  const notificationStateRef = db.collection("notificationState").doc(uid);

  const [
    deviceSnap,
    outgoingRequestsSnap,
    incomingRequestsSnap,
    relationshipsSnap,
    connectionsSnap,
  ] = await Promise.all([
    userRef.collection("devices").get(),
    db.collection("connectionRequests").where("fromUid", "==", uid).get(),
    db.collection("connectionRequests").where("toUid", "==", uid).get(),
    db.collection("relationships").where("users", "array-contains", uid).get(),
    db.collection("connections").where("users", "array-contains", uid).get(),
  ]);

  await Promise.all(
    connectionsSnap.docs.map((connectionSnap) =>
      deleteConnectionRef(connectionSnap.ref),
    ),
  );

  await deleteDocRefsInBatches([
    userRef,
    publicProfileRef,
    presenceRef,
    notificationStateRef,
    ...deviceSnap.docs.map((doc) => doc.ref),
    ...outgoingRequestsSnap.docs.map((doc) => doc.ref),
    ...incomingRequestsSnap.docs.map((doc) => doc.ref),
    ...relationshipsSnap.docs.map((doc) => doc.ref),
  ]);
}

function getOtherUidFromUsers(users, uid) {
  if (!Array.isArray(users)) return "";
  return users.find((candidateUid) => candidateUid && candidateUid !== uid) || "";
}

// this makes permission values safe before saving
function normalizePermissionStatus(value) {
  if (ALLOWED_PERMISSION_STATUS.has(value)) return value;
  return "unknown";
}

// this fetches a user doc and falls back to empty data during signup races
async function getUserDataOrEmpty(userRef) {
  const userSnap = await userRef.get();
  if (!userSnap.exists) return {};
  return userSnap.data() || {};
}

// this returns empty nearby response with a timestamp
function buildEmptyNearbyResponse() {
  return {
    users: [],
    crowdCount: 0,
    asOf: nowDate().toISOString(),
  };
}

// this trims report text input and keeps missing values predictable
function getTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Kept as an inert compatibility endpoint until old clients have upgraded.
const auth_checkEmailExists = onCall({ region: REGION, maxInstances: 2 }, () => {
  throw new HttpsError("failed-precondition", "Update the app to continue.");
});

const auth_syncSession = onCall({ region: REGION, maxInstances: 20 },
  withAuth(async () => ({ ok: true }), { verified: false }));

// this saves a phone push token for the logged in user
const location_registerPushToken = onCall(
  { region: REGION },
  withAuth(async (uid, request) => {
    const { deviceId, platform, expoPushToken } = request.data || {};

    // this blocks bad input before writing data
    if (typeof deviceId !== "string" || !deviceId.trim()) {
      throw new HttpsError("invalid-argument", "deviceId is required.");
    }

    if (platform !== "ios" && platform !== "android") {
      throw new HttpsError(
        "invalid-argument",
        "platform must be ios or android.",
      );
    }

    if (typeof expoPushToken !== "string" || !expoPushToken.trim()) {
      throw new HttpsError("invalid-argument", "expoPushToken is required.");
    }

    await getUserRef(uid).collection("devices").doc(deviceId).set(
      {
        expoPushToken: expoPushToken.trim(),
        platform,
        enabled: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true };
  }),
);

// this removes stale relationship data that points at deleted auth accounts
const pruneDeletedAccounts = onCall(
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid) => {
    const db = getDb();
    const [relationshipsSnap, outgoingRequestsSnap, incomingRequestsSnap] =
      await Promise.all([
        db.collection("relationships").where("users", "array-contains", uid).get(),
        db.collection("connectionRequests").where("fromUid", "==", uid).get(),
        db.collection("connectionRequests").where("toUid", "==", uid).get(),
      ]);

    const relatedUids = new Set();

    for (const relationshipSnap of relationshipsSnap.docs) {
      const otherUid = getOtherUidFromUsers(relationshipSnap.data()?.users, uid);
      if (otherUid) relatedUids.add(otherUid);
    }

    for (const requestSnap of [...outgoingRequestsSnap.docs, ...incomingRequestsSnap.docs]) {
      const data = requestSnap.data() || {};
      const otherUid =
        getTrimmedString(data.fromUid) === uid
          ? getTrimmedString(data.toUid)
          : getTrimmedString(data.fromUid);
      if (otherUid) relatedUids.add(otherUid);
    }

    const deletedUids = new Set();

    for (const chunk of chunkArray(Array.from(relatedUids), 100)) {
      const result = await getAdminAuth().getUsers(
        chunk.map((relatedUid) => ({ uid: relatedUid })),
      );

      for (const identifier of result.notFound) {
        if ("uid" in identifier && identifier.uid) {
          deletedUids.add(identifier.uid);
        }
      }
    }

    await Promise.all(
      Array.from(deletedUids).map((deletedUid) => cleanupDeletedUserData(deletedUid)),
    );

    return {
      ok: true,
      prunedUidCount: deletedUids.size,
    };
  }),
);

// this saves a moderation report about another user
const reportUser = onCall(
  // region relates to the firebase region
  // timeoutSeconds is how long the function has to do its work, if it longer it fails, nothing to do with user typing
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid, request) => {
    const reportedUid = getTrimmedString(request.data?.reportedUid);
    const reason = getTrimmedString(request.data?.reason);
    const details = getTrimmedString(request.data?.details);

    if (!reportedUid) {
      throw new HttpsError("invalid-argument", "reportedUid is required.");
    }

    if (reportedUid === uid) {
      throw new HttpsError(
        "invalid-argument",
        "Users cannot report themselves.",
      );
    }

    if (!reason) {
      throw new HttpsError("invalid-argument", "reason is required.");
    }

    if (reason.length > 100) {
      throw new HttpsError(
        "invalid-argument",
        "reason must be 100 characters or less.",
      );
    }

    if (details.length > 1000) {
      throw new HttpsError(
        "invalid-argument",
        "details must be 1000 characters or less.",
      );
    }

    const reportedUserSnap = await getUserRef(reportedUid).get();
    if (!reportedUserSnap.exists) {
      throw new HttpsError("not-found", "Reported user does not exist.");
    }

    const db = getDb();
    const reportRef = db.collection("reports").doc();

    await reportRef.set({
      reportId: reportRef.id,
      reporterUid: uid,
      reportedUid,
      reason,
      details,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      ok: true,
      reportId: reportRef.id,
    };
  }),
);

// this cleans up Firestore records after a Firebase Auth account is deleted
const auth_cleanupDeletedUser = functionsV1
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    await cleanupDeletedUserData(user.uid);
  });

module.exports = {
  auth_checkEmailExists,
  auth_syncSession,
  auth_cleanupDeletedUser,
  location_registerPushToken,
  ...require("./location"),
  pruneDeletedAccounts,
  reportUser,
  ...require("./connections"),
  ...require("./messages"),
  ...require("./profiles"),
  ...require("./photos"),
  connection_requestCreated,
  connection_messageCreated,
};
