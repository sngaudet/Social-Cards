const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { CALLABLE_OPTIONS, withAuth, rateLimit } = require("./security");

// Keep the legacy endpoint inert so an older app cannot enumerate registered emails.
const auth_checkEmailExists = onCall(
  { ...CALLABLE_OPTIONS, maxInstances: 2 },
  () => {
    throw new HttpsError("failed-precondition", "Update the app to continue.");
  },
);
const auth_syncSession = onCall(
  CALLABLE_OPTIONS,
  withAuth(
    async (uid) => {
      await rateLimit(uid, "sessions");
      return { ok: true };
    },
    { verified: false },
  ),
);

// Export deployable handlers only; internal helpers are never public endpoints.
const modules = [
  "accounts",
  "devices",
  "notifications",
  "location",
  "moderation",
  "connections",
  "messages",
  "profiles",
  "photos",
];
module.exports = { auth_checkEmailExists, auth_syncSession };
for (const name of modules) {
  for (const [key, value] of Object.entries(require(`./${name}`))) {
    if (value?.__endpoint || value?.__trigger) module.exports[key] = value;
  }
}
