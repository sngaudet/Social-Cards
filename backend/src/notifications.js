const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getDb, timestampFromDate, logger } = require("./firebase");
const { REGION, COOLDOWN_MS, CROWD_ALERT_MIN_USERS } = require("./constants");
const { nowDate, getTimestampValue } = require("./helpers");

// this reads enabled expo push tokens for one user
async function getPushTokens(uid) {
  const db = getDb();
  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("devices")
    .where("enabled", "==", true)
    .get();

  const tokens = [];

  for (const doc of snap.docs) {
    const token = doc.data().expoPushToken;
    if (typeof token === "string" && token.startsWith("ExponentPushToken")) {
      tokens.push(token);
    }
  }

  return tokens;
}

// this sends push messages in small batches expo accepts
async function sendExpoPush(tokens, title, body, data = {}) {
  if (!tokens.length) return;

  const messages = tokens.map((to) => ({
    to,
    channelId: "default",
    sound: "default",
    priority: "high",
    title,
    body,
    data,
  }));

  const chunkSize = 100;

  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error("Expo push failed", { status: res.status, body: text });
    }
  }
}

// this trims profile names into notification-safe display text
function normalizeFirstName(value) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean || null;
}

// this prefers public profile data but falls back to private user data
async function getUserFirstName(uid) {
  const db = getDb();

  const publicSnap = await db.collection("publicProfiles").doc(uid).get();
  const publicName = normalizeFirstName(publicSnap.data()?.firstName);
  if (publicName) return publicName;

  const userSnap = await db.collection("users").doc(uid).get();
  return normalizeFirstName(userSnap.data()?.firstName);
}

// this formats a clear connection request push body
function buildConnectionRequestBody(firstName) {
  if (firstName) return `${firstName} sent you a connection request.`;
  return "You received a new connection request.";
}

// this builds a simple key so we do not repeat the same alert
function makeAlertFingerprint(subjectUid, nearbyUsers) {
  const sample = nearbyUsers
    .map((user) => user.uid)
    .sort()
    .slice(0, 10)
    .join("|");
  return `crowd:${subjectUid}:${sample}`;
}

// this checks cooldown and repeat key before sending alert
async function canSendCrowdAlert(uid, fingerprint, now) {
  const db = getDb();
  const ref = db.collection("notificationState").doc(uid);
  const snap = await ref.get();
  const state = snap.exists ? snap.data() : {};

  const lastCrowdAt = getTimestampValue(state.lastCrowdAt);
  const lastAnyAt = getTimestampValue(state.lastAnyAt);
  const lastFingerprint = state.lastFingerprint || null;

  const inCooldown =
    lastCrowdAt && now.getTime() - lastCrowdAt.getTime() < COOLDOWN_MS;

  const sameFingerprint =
    lastFingerprint === fingerprint &&
    lastAnyAt &&
    now.getTime() - lastAnyAt.getTime() < COOLDOWN_MS;

  if (inCooldown || sameFingerprint) return false;

  await ref.set(
    {
      lastCrowdAt: timestampFromDate(now),
      lastAnyAt: timestampFromDate(now),
      lastFingerprint: fingerprint,
    },
    { merge: true },
  );

  return true;
}

// this is the only crowd notification entry point
async function maybeSendCrowdAlert(subjectUid, nearbyUsers) {
  const crowdCount = nearbyUsers.length;
  if (crowdCount < CROWD_ALERT_MIN_USERS) return;

  const tokens = await getPushTokens(subjectUid);
  if (!tokens.length) return;

  const now = nowDate();
  const fingerprint = makeAlertFingerprint(subjectUid, nearbyUsers);
  const allowed = await canSendCrowdAlert(subjectUid, fingerprint, now);
  if (!allowed) return;

  await sendExpoPush(
    tokens,
    "Crowd nearby",
    `There are ${crowdCount} people within 50 ft of you.`,
    { type: "crowd", crowdCount },
  );
}

// this sends one push when a new pending request is created
const connection_requestCreated = onDocumentCreated(
  {
    region: REGION,
    document: "connectionRequests/{requestId}",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const requestId = event.params.requestId;
    const fromUid = typeof data.fromUid === "string" ? data.fromUid.trim() : "";
    const toUid = typeof data.toUid === "string" ? data.toUid.trim() : "";
    const status = typeof data.status === "string" ? data.status : "";

    if (!requestId || !fromUid || !toUid || status !== "pending") {
      logger.warn("Skipping malformed connection request notification", {
        requestId,
        fromUid,
        toUid,
        status,
      });
      return;
    }

    if (fromUid === toUid) return;

    const tokens = await getPushTokens(toUid);
    if (!tokens.length) return;

    const senderName = await getUserFirstName(fromUid);

    await sendExpoPush(
      tokens,
      "New connection request",
      buildConnectionRequestBody(senderName),
      {
        type: "connection_request",
        requestId,
        fromUid,
      },
    );
  },
);

module.exports = {
  maybeSendCrowdAlert,
  connection_requestCreated,
};
