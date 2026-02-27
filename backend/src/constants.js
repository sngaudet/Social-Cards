// numbers and limits used by the location backend
const REGION = "us-central1";
const DEFAULT_RADIUS_FT = 50;
const MAX_RADIUS_FT = 100;
const CROWD_ALERT_MIN_USERS = 8;
const FRESHNESS_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 30 * 60 * 1000;
const IMPACTED_LIMIT = 30;
const THROTTLE_MS = 20 * 1000;
const THROTTLE_DISTANCE_M = 3;

// permission values the app can send
const ALLOWED_PERMISSION_STATUS = new Set([
  "always",
  "while_in_use",
  "denied",
  "unknown",
]);

module.exports = {
  REGION,
  DEFAULT_RADIUS_FT,
  MAX_RADIUS_FT,
  CROWD_ALERT_MIN_USERS,
  FRESHNESS_MS,
  COOLDOWN_MS,
  IMPACTED_LIMIT,
  THROTTLE_MS,
  THROTTLE_DISTANCE_M,
  ALLOWED_PERMISSION_STATUS,
};
