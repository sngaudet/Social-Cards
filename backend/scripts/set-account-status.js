// Administration must update the rule-visible status before invalidating Auth sessions.
const { Timestamp } = require("firebase-admin/firestore");
function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const project = argument("--project"),
  uid = argument("--uid"),
  action = argument("--action");
if (!project || !uid || !["disable", "enable", "revoke"].includes(action))
  throw new Error(
    "Use --project <id> --uid <uid> --action disable|enable|revoke; add --apply after reviewing the dry run.",
  );
process.env.FIREBASE_PROJECT_ID = project;
process.env.GCLOUD_PROJECT = project;
const { getDb, getAdminAuth } = require("../src/firebase");
const { documentId } = require("../src/security");
documentId(uid, "uid");
async function main() {
  const auth = getAdminAuth(),
    db = getDb();
  const record = await auth.getUser(uid);
  console.log(
    JSON.stringify({
      project,
      uid,
      action,
      currentlyDisabled: record.disabled,
      apply: process.argv.includes("--apply"),
    }),
  );
  if (!process.argv.includes("--apply")) return;
  if (action === "enable") await auth.updateUser(uid, { disabled: false });
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`accountState/${uid}`);
    const state = (await tx.get(ref)).data();
    if (state?.deleting)
      throw new Error("Deleting accounts cannot be re-enabled.");
    tx.set(
      ref,
      {
        disabled:
          action === "disable" || (action !== "enable" && record.disabled),
        validAfter: Math.max(
          state?.validAfter ?? 0,
          Math.floor(Date.now() / 1000) + 1,
        ),
        leaseUntil: Timestamp.fromMillis(0),
        emailVerified: record.emailVerified,
      },
      { merge: true },
    );
  });
  if (action === "disable") await auth.updateUser(uid, { disabled: true });
  await auth.revokeRefreshTokens(uid);
}
main().catch((error) => {
  console.error("Account status update failed", error.code ?? error.message);
  process.exitCode = 1;
});
