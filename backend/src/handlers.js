const { onCall, HttpsError } = require("firebase-functions/v2/https");
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

function sortedPair(uid1, uid2) {
  return [uid1, uid2].sort();
}

function pairDocId(uid1, uid2) {
  const [a, b] = sortedPair(uid1, uid2);
  return `${a}_${b}`;
}

function getPublicProfileRef(uid) {
  return getDb().collection("publicProfiles").doc(uid);
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

// this checks whether an auth account already exists for an email
const auth_checkEmailExists = onCall(
  { region: REGION },
  async (request) => {
    const email = getTrimmedString(request.data?.email).toLowerCase();

    if (!email) {
      throw new HttpsError("invalid-argument", "email is required.");
    }

    try {
      await getAdminAuth().getUserByEmail(email);
      return { exists: true };
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        return { exists: false };
      }

      throw new HttpsError("internal", "Could not check email availability.");
    }
  },
);

async function getBlockPreviewForUid(targetUid) {
  const [publicSnap, userSnap] = await Promise.all([
    getPublicProfileRef(targetUid).get(),
    getUserRef(targetUid).get(),
  ]);

  const publicData = publicSnap.exists ? publicSnap.data() || {} : {};
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  return {
    firstName: publicData.firstName || userData.firstName || "",
    avatarId: publicData.avatarId || userData.avatarId || "",
    photoURL: publicData.photoURL || userData.photoURL || "",
  };
}

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

// this lets user turn location sharing on or off
const location_setSharing = onCall(
  { region: REGION },
  withAuth(async (uid, request) => {
    const { sharingEnabled, permissionStatus } = request.data || {};

    if (typeof sharingEnabled !== "boolean") {
      throw new HttpsError(
        "invalid-argument",
        "sharingEnabled must be boolean.",
      );
    }

    if (!ALLOWED_PERMISSION_STATUS.has(permissionStatus)) {
      throw new HttpsError("invalid-argument", "permissionStatus is invalid.");
    }

    const userRef = getUserRef(uid);

    await userRef.set(
      {
        locationControl: {
          sharingEnabled,
          permissionStatus,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true },
    );

    // this clears live location right away when sharing is off
    if (!sharingEnabled) {
      const db = getDb();
      await db
        .collection("presence")
        .doc(uid)
        .delete()
        .catch(() => {});
    }

    const userSnap = await userRef.get();
    const lastLocationAt = getTimestampValue(
      userSnap.data()?.locationStatus?.lastLocationAt,
    );

    return {
      sharingEnabled,
      lastLocationAt: lastLocationAt ? lastLocationAt.toISOString() : null,
    };
  }),
);

// this gives the app current location status values
const location_getControlStatus = onCall(
  { region: REGION },
  withAuth(async (uid) => {
    const userSnap = await getUserRef(uid).get();

    if (!userSnap.exists) {
      return {
        sharingEnabled: true,
        permissionStatus: "unknown",
        lastLocationAt: null,
        lastAccuracyM: null,
      };
    }

    const data = userSnap.data() || {};
    const sharingEnabled = data.locationControl?.sharingEnabled !== false;
    const permissionStatus = normalizePermissionStatus(
      data.locationControl?.permissionStatus,
    );
    const lastLocationAt = getTimestampValue(
      data.locationStatus?.lastLocationAt,
    );
    const lastAccuracyM =
      typeof data.locationStatus?.lastAccuracyM === "number"
        ? data.locationStatus.lastAccuracyM
        : null;

    return {
      sharingEnabled,
      permissionStatus,
      lastLocationAt: lastLocationAt ? lastLocationAt.toISOString() : null,
      lastAccuracyM,
    };
  }),
);

// this saves latest location and runs crowd alert checks
const location_upsertPing = onCall(
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid, request) => {
    const parsedPing = validatePingInput(request.data);
    if (!parsedPing.ok) return parsedPing.response;

    const { lat, lng, accuracyM, source } = parsedPing.value;

    const userRef = getUserRef(uid);
    const user = await getUserDataOrEmpty(userRef);

    const sharingEnabled = user.locationControl?.sharingEnabled !== false;
    if (!sharingEnabled) {
      return rejectPing("paused");
    }

    // this ignores very fast repeat pings with tiny movement
    const previousPresence = await getPresenceByUid(uid);
    const throttleSeconds = getThrottleSeconds(previousPresence, { lat, lng });
    if (throttleSeconds !== null) {
      return rejectPing("throttled", throttleSeconds);
    }

    // this keeps one live location record per user
    const now = nowDate();
    const updatedAt = timestampFromDate(now);
    const expiresAt = timestampFromDate(new Date(now.getTime() + FRESHNESS_MS));

    const db = getDb();
    await db
      .collection("presence")
      .doc(uid)
      .set(
        {
          uid,
          lat,
          lng,
          geohash: geohashForLocation([lat, lng]),
          accuracyM,
          source,
          updatedAt,
          expiresAt,
        },
        { merge: true },
      );

    // this also saves quick status fields on user profile
    await userRef.set(
      {
        locationStatus: {
          lastLocationAt: updatedAt,
          lastAccuracyM: accuracyM,
          lastSource: source,
        },
        locationControl: {
          sharingEnabled: true,
          permissionStatus: normalizePermissionStatus(
            user.locationControl?.permissionStatus,
          ),
          updatedAt,
        },
      },
      { merge: true },
    );

    // this checks sender and nearby users for crowd alerts
    const radiusM = toMeters(DEFAULT_RADIUS_FT);
    // this keeps crowd alerts on strict distance
    const aroundSender = await queryNearbyPresence({ lat, lng }, radiusM, {
      useAccuracyBuffer: false,
    });
    const nearbyWithoutSender = aroundSender.filter(
      (presence) => presence.uid !== uid,
    );

    const impactedUsers = [
      { uid, lat, lng },
      ...nearbyWithoutSender.slice(0, IMPACTED_LIMIT),
    ];

    for (const subject of impactedUsers) {
      const neighbors = getNeighborsForSubject(subject, impactedUsers, radiusM);
      await maybeSendCrowdAlert(subject.uid, neighbors);
    }

    return { accepted: true };
  }),
);

// this returns nearby people sorted from closest to farthest
const location_getNearby = onCall(
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid, request) => {
    const radiusFt = parseRadiusFt(request.data?.radiusFt);
    const radiusM = toMeters(radiusFt);

    // this returns empty if caller has no recent live location
    const callerPresence = await getPresenceByUid(uid);
    if (!callerPresence || !isFreshPresence(callerPresence)) {
      return buildEmptyNearbyResponse();
    }

    const nearbyPresence = await queryNearbyPresence(callerPresence, radiusM, {
      useAccuracyBuffer: true,
    });
    const withoutCaller = nearbyPresence.filter(
      (presence) => presence.uid !== uid,
    );
    const excludedUids = await getExcludedRelationshipUids(
      uid,
      withoutCaller.map((presence) => presence.uid),
    );
    const filtered = withoutCaller.filter(
      (presence) => !excludedUids.has(presence.uid),
    );
    const userMap = await getUsersByUids(
      filtered.map((presence) => presence.uid),
    );

    // this skips missing profiles and sorts by distance
    const users = filtered
      .map((presence) => {
        const userDoc = userMap.get(presence.uid);
        if (!userDoc) return null;
        return buildNearbyUserPayload(presence.uid, userDoc, presence);
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceFt - b.distanceFt);

    return {
      users,
      crowdCount: users.length,
      asOf: nowDate().toISOString(),
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

// this accepts a pending connection request and creates the connection record
const acceptConnectionRequest = onCall(
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid, request) => {
    const requestId = getTrimmedString(request.data?.requestId);

    if (!requestId) {
      throw new HttpsError("invalid-argument", "requestId is required.");
    }

    const db = getDb();
    const requestRef = db.collection("connectionRequests").doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Connection request not found.");
    }

    const requestData = requestSnap.data() || {};
    const fromUid = getTrimmedString(requestData.fromUid);
    const toUid = getTrimmedString(requestData.toUid);
    const status = getTrimmedString(requestData.status);

    if (!fromUid || !toUid) {
      throw new HttpsError(
        "failed-precondition",
        "Malformed connection request.",
      );
    }

    if (toUid !== uid) {
      throw new HttpsError(
        "permission-denied",
        "Only the receiving user can accept this request.",
      );
    }

    if (status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "This connection request is no longer pending.",
      );
    }

    const relationshipId = pairDocId(fromUid, toUid);
    const blockedRef = db.collection("relationships").doc(relationshipId);
    const blockedSnap = await blockedRef.get();
    const blockedStatus = blockedSnap.exists
      ? getTrimmedString(blockedSnap.data()?.status)
      : "none";

    if (blockedStatus === "blocked") {
      throw new HttpsError(
        "failed-precondition",
        "You cannot accept a blocked relationship.",
      );
    }

    const respondedAt = serverTimestamp();
    const connectionRef = db.collection("connections").doc(relationshipId);
    const batch = db.batch();

    batch.update(requestRef, {
      status: "accepted",
      respondedAt,
    });
    batch.set(connectionRef, {
      users: sortedPair(fromUid, toUid),
      createdAt: respondedAt,
      expiresAt: timestampFromDate(
        new Date(nowDate().getTime() + 24 * 60 * 60 * 1000),
      ),
    });
    batch.set(
      db.collection("relationships").doc(relationshipId),
      {
        users: sortedPair(fromUid, toUid),
        status: "accepted",
        updatedAt: respondedAt,
      },
      { merge: true },
    );

    await batch.commit();

    return {
      ok: true,
      connectionId: relationshipId,
    };
  }),
);

// this declines a pending connection request and updates the relationship state
const declineConnectionRequest = onCall(
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid, request) => {
    const requestId = getTrimmedString(request.data?.requestId);

    if (!requestId) {
      throw new HttpsError("invalid-argument", "requestId is required.");
    }

    const db = getDb();
    const requestRef = db.collection("connectionRequests").doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Connection request not found.");
    }

    const requestData = requestSnap.data() || {};
    const fromUid = getTrimmedString(requestData.fromUid);
    const toUid = getTrimmedString(requestData.toUid);
    const status = getTrimmedString(requestData.status);

    if (!fromUid || !toUid) {
      throw new HttpsError(
        "failed-precondition",
        "Malformed connection request.",
      );
    }

    if (toUid !== uid && fromUid !== uid) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this connection request.",
      );
    }

    if (status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "This connection request is no longer pending.",
      );
    }

    const respondedAt = serverTimestamp();
    const batch = db.batch();

    batch.update(requestRef, {
      status: "declined",
      respondedAt,
    });
    batch.set(
      db.collection("relationships").doc(pairDocId(fromUid, toUid)),
      {
        users: sortedPair(fromUid, toUid),
        status: "declined",
        updatedAt: respondedAt,
      },
      { merge: true },
    );

    await batch.commit();

    return {
      ok: true,
      requestId,
    };
  }),
);

// this blocks another user and preserves blocker-only history access
const blockUser = onCall(
  { region: REGION, timeoutSeconds: 60 },
  withAuth(async (uid, request) => {
    const targetUid = getTrimmedString(request.data?.targetUid);

    if (!targetUid) {
      throw new HttpsError("invalid-argument", "targetUid is required.");
    }

    if (targetUid === uid) {
      throw new HttpsError(
        "invalid-argument",
        "Users cannot block themselves.",
      );
    }

    const targetUserSnap = await getUserRef(targetUid).get();
    if (!targetUserSnap.exists) {
      throw new HttpsError("not-found", "Target user does not exist.");
    }

    const db = getDb();
    const relationshipId = pairDocId(uid, targetUid);
    const relationshipRef = db.collection("relationships").doc(relationshipId);
    const connectionRef = db.collection("connections").doc(relationshipId);
    const preview = await getBlockPreviewForUid(targetUid);
    const [connectionSnap, outgoingPendingSnap, incomingPendingSnap] =
      await Promise.all([
        connectionRef.get(),
        db
          .collection("connectionRequests")
          .where("fromUid", "==", uid)
          .where("toUid", "==", targetUid)
          .where("status", "==", "pending")
          .get(),
        db
          .collection("connectionRequests")
          .where("fromUid", "==", targetUid)
          .where("toUid", "==", uid)
          .where("status", "==", "pending")
          .get(),
      ]);

    const batch = db.batch();
    const blockedAt = serverTimestamp();

    batch.set(
      relationshipRef,
      {
        users: sortedPair(uid, targetUid),
        status: "blocked",
        blockedByUid: uid,
        blockedAt,
        updatedAt: blockedAt,
        blockedPreview: preview,
        hasMessageHistory: connectionSnap.exists,
      },
      { merge: true },
    );

    for (const requestSnap of [
      ...outgoingPendingSnap.docs,
      ...incomingPendingSnap.docs,
    ]) {
      batch.update(requestSnap.ref, {
        status: "declined",
        respondedAt: blockedAt,
      });
    }

    await batch.commit();

    return {
      ok: true,
      relationshipId,
      hasMessageHistory: connectionSnap.exists,
    };
  }),
);

module.exports = {
  auth_checkEmailExists,
  location_registerPushToken,
  location_setSharing,
  location_getControlStatus,
  location_upsertPing,
  location_getNearby,
  reportUser,
  acceptConnectionRequest,
  declineConnectionRequest,
  blockUser,
  connection_requestCreated,
  connection_messageCreated,
};
