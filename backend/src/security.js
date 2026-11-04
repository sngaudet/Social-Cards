const { HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");
const { AsyncLocalStorage } = require("node:async_hooks");
const callerContext = new AsyncLocalStorage();
const { createHash } = require("node:crypto");
const { getAdminAuth, getDb } = require("./firebase");
const { REGION } = require("./constants");

// Leases bound direct SDK reads; every callable checks live Auth state as well.
const AUTH_LEASE_MS = 2 * 60 * 1000;
const CALLABLE_OPTIONS = {
  region: REGION,
  maxInstances: 20,
  timeoutSeconds: 60,
};
const LIMITS = {
  photos: [20, 3600000],
  calls: [180, 60000],
  sessions: [30, 60000],
  requests: [30, 3600000],
  decisions: [120, 60000],
  messages: [60, 60000],
  controls: [30, 60000],
  discovery: [12, 60000],
  ping: [6, 60000],
  profiles: [120, 60000],
  profileWrite: [20, 60000],
  reports: [10, 3600000],
  devices: [12, 60000],
};
function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
function documentId(value, name = "id") {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError("invalid-argument", `Invalid ${name}.`);
  }
  return value;
}
function pairId(a, b) {
  return [a, b].sort().join("_");
}
function isBlocked(relationship) {
  return (
    relationship?.status === "blocked" ||
    (relationship?.blockerUids?.length ?? 0) > 0
  );
}
function assertActiveState(snap) {
  const state = snap.data();
  if (
    !state ||
    state.disabled ||
    state.deleting ||
    !state.leaseUntil ||
    state.leaseUntil.toMillis() <= Date.now()
  ) {
    throw new HttpsError(
      "permission-denied",
      "Account is unavailable. Sign in again.",
    );
  }
  return state;
}
async function requireAccount(tx, uid) {
  const state = assertActiveState(
    await tx.get(getDb().doc(`accountState/${uid}`)),
  );
  const caller = callerContext.getStore();
  if (
    caller?.uid === uid &&
    (caller.authTime < state.validAfter ||
      (caller.verified && !state.emailVerified))
  ) {
    throw new HttpsError("unauthenticated", "Session changed. Sign in again.");
  }
  return state;
}
async function getAuthAccount(uid) {
  return getAdminAuth()
    .getUser(uid)
    .catch((error) => {
      if (error.code === "auth/user-not-found") return null;
      throw new HttpsError(
        "unavailable",
        "Authentication is temporarily unavailable.",
      );
    });
}
async function requireEnabledAccount(uid) {
  const record = await getAuthAccount(uid);
  if (!record || record.disabled || !record.emailVerified)
    throw new HttpsError("not-found", "Account unavailable.");
  return record;
}
async function authorize(request, { verified = true } = {}) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const record = await getAuthAccount(uid);
  const authTime = Number(request.auth.token.auth_time);
  const validAfter = record
    ? Math.floor(Date.parse(record.tokensValidAfterTime) / 1000)
    : 0;
  if (
    !record ||
    record.disabled ||
    !Number.isFinite(authTime) ||
    authTime < validAfter
  ) {
    throw new HttpsError("unauthenticated", "Session expired. Sign in again.");
  }
  if (
    verified &&
    (!record.emailVerified || request.auth.token.email_verified !== true)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Verify your email and sign in again.",
    );
  }
  const db = getDb();
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`accountState/${uid}`);
    const previous = (await tx.get(ref)).data();
    if (
      previous?.deleting ||
      previous?.disabled ||
      authTime < (previous?.validAfter ?? 0)
    ) {
      throw new HttpsError(
        "unauthenticated",
        "Account or session is unavailable.",
      );
    }
    tx.set(
      ref,
      {
        disabled: false,
        deleting: false,
        emailVerified: record.emailVerified,
        validAfter: Math.max(validAfter, previous?.validAfter ?? 0),
        leaseUntil: Timestamp.fromMillis(Date.now() + AUTH_LEASE_MS),
      },
      { merge: true },
    );
  });
  return uid;
}
function withAuth(handler, options) {
  return async (request) => {
    if (request.auth?.uid && request.data?.actorUid !== request.auth.uid)
      throw new HttpsError(
        "permission-denied",
        "The request belongs to a different session.",
      );
    const uid = await authorize(request, options);
    return callerContext.run(
      {
        uid,
        authTime: Number(request.auth.token.auth_time),
        verified: options?.verified !== false,
      },
      async () => {
        await rateLimit(uid, "calls");
        return handler(uid, request);
      },
    );
  };
}
// Transactional fixed windows are shared by all instances and survive retries.
async function consumeQuota(tx, uid, scope) {
  const [limit, windowMs] = LIMITS[scope];
  const window = Math.floor(Date.now() / windowMs);
  const ref = getDb().doc(`rateLimits/${digest(`${uid}:${scope}:${window}`)}`);
  const snap = await tx.get(ref);
  const count = snap.data()?.count ?? 0;
  if (count >= limit)
    throw new HttpsError(
      "resource-exhausted",
      "Please wait before trying again.",
    );
  tx.set(ref, {
    count: count + 1,
    uid,
    expiresAt: Timestamp.fromMillis((window + 2) * windowMs),
  });
}
async function rateLimit(uid, scope) {
  await getDb().runTransaction(async (tx) => {
    await requireAccount(tx, uid);
    await consumeQuota(tx, uid, scope);
  });
}
module.exports = {
  AUTH_LEASE_MS,
  CALLABLE_OPTIONS,
  authorize,
  getAuthAccount,
  requireEnabledAccount,
  withAuth,
  documentId,
  pairId,
  digest,
  isBlocked,
  assertActiveState,
  requireAccount,
  consumeQuota,
  rateLimit,
};
