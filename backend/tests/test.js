const assert = require("node:assert/strict");
const test = require("node:test");
const { HttpsError } = require("firebase-functions/v2/https");

const {
  DEFAULT_RADIUS_FT,
  MAX_RADIUS_FT,
  FRESHNESS_MS,
  THROTTLE_MS,
  MAX_RECORDED_AT_AGE_MS,
} = require("../src/constants");

const {
  withAuth,
  toMeters,
  parseRadiusFt,
  rejectPing,
  validatePingInput,
  isFreshPresence,
  getThrottleSeconds,
  buildNearbyUserPayload,
} = require("../src/helpers");

test("radius default", () => {
  // this checks we use the default radius when no value is given
  assert.equal(parseRadiusFt(undefined), DEFAULT_RADIUS_FT);
});

test("radius min", () => {
  // this checks tiny values are bumped up to the minimum radius
  assert.equal(parseRadiusFt(0), 1);
});

test("radius max", () => {
  // this checks huge values are capped at the max radius
  assert.equal(parseRadiusFt(MAX_RADIUS_FT + 1000), MAX_RADIUS_FT);
});

test("feet meters", () => {
  // this checks feet are converted to meters correctly
  assert.equal(toMeters(10), 3.048);
});

test("reject basic", () => {
  // this checks rejectPing returns the basic failure shape
  assert.deepEqual(rejectPing("invalid"), {
    accepted: false,
    reason: "invalid",
  });
});

test("ping valid", () => {
  // this checks a normal ping payload is accepted
  const recordedAtMs = Date.now();
  const parsed = validatePingInput({
    lat: 43.1,
    lng: -87.9,
    accuracyM: 8,
    source: "foreground",
    recordedAtMs,
  });

  assert.equal(parsed.ok, true);
});

test("ping stale", () => {
  // this checks old ping timestamps are rejected
  const parsed = validatePingInput({
    lat: 43.1,
    lng: -87.9,
    accuracyM: 8,
    source: "foreground",
    recordedAtMs: Date.now() - MAX_RECORDED_AT_AGE_MS - 5000,
  });

  assert.equal(parsed.ok, false);
  assert.equal(parsed.response.reason, "invalid");
});

test("fresh true", () => {
  // this checks a recently updated presence is treated as fresh
  const now = new Date("2026-03-01T12:00:00.000Z");
  const presence = { updatedAt: new Date(now.getTime() - 1000) };
  assert.equal(isFreshPresence(presence, now), true);
});

test("fresh false", () => {
  // this checks an old presence is treated as stale
  const now = new Date("2026-03-01T12:00:00.000Z");
  const presence = { updatedAt: new Date(now.getTime() - FRESHNESS_MS - 1000) };
  assert.equal(isFreshPresence(presence, now), false);
});

test("throttle wait", () => {
  // this checks quick tiny moves return a wait time
  const previous = {
    lat: 43.0772,
    lng: -87.8798,
    updatedAt: new Date(Date.now() - 5000),
  };
  const next = { lat: 43.0772, lng: -87.8798 };
  const waitSec = getThrottleSeconds(previous, next);

  assert.equal(typeof waitSec, "number");
  assert.ok(waitSec >= 1);
  assert.ok(waitSec <= Math.ceil(THROTTLE_MS / 1000));
});

test("auth blocks", async () => {
  // this checks unauthenticated requests are blocked
  const wrapped = withAuth(async () => ({ ok: true }));

  await assert.rejects(
    wrapped({ auth: null }),
    (error) => error instanceof HttpsError && error.code === "unauthenticated",
  );
});

test("payload rounds", () => {
  // this checks nearby payload keeps fields and rounds distance
  const payload = buildNearbyUserPayload(
    "u1",
    { firstName: "sam", major: "cs", hobbies: "music" },
    { distanceM: 10 },
  );

  assert.equal(payload.uid, "u1");
  assert.equal(payload.firstName, "sam");
  assert.equal(payload.distanceFt, 33);
});
