const { getAuth } = require("firebase-admin/auth");
const { getAdminApp, getDb } = require("../src/firebase");

function parseArgs(argv) {
  const parsed = {
    emails: [],
    uids: [],
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--email" || arg === "-e") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value after --email");
      }
      parsed.emails.push(value.trim());
      i += 1;
      continue;
    }

    if (arg === "--uid" || arg === "-u") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value after --uid");
      }
      parsed.uids.push(value.trim());
      i += 1;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/mark-email-verified.js --email test@uwm.edu
  node scripts/mark-email-verified.js --uid abc123
  node scripts/mark-email-verified.js --email test1@uwm.edu --email test2@uwm.edu
  node scripts/mark-email-verified.js --email test@uwm.edu --dry-run

Notes:
  - You can pass multiple --email and --uid values.
  - The script marks Firebase Auth users as emailVerified=true.
  - It also reports whether matching Firestore profile docs exist.
`);
}

async function resolveUsers(auth, emails, uids) {
  const usersByUid = new Map();

  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      usersByUid.set(user.uid, user);
    } catch (error) {
      console.error(`Could not find auth user for email ${email}:`, error.message);
    }
  }

  for (const uid of uids) {
    try {
      const user = await auth.getUser(uid);
      usersByUid.set(user.uid, user);
    } catch (error) {
      console.error(`Could not find auth user for uid ${uid}:`, error.message);
    }
  }

  return [...usersByUid.values()];
}

async function getProfileStatus(db, uid) {
  const [userDoc, publicProfileDoc] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("publicProfiles").doc(uid).get(),
  ]);

  return {
    hasUserDoc: userDoc.exists,
    hasPublicProfileDoc: publicProfileDoc.exists,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.emails.length === 0 && args.uids.length === 0) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  getAdminApp();
  const auth = getAuth();
  const db = getDb();
  const users = await resolveUsers(auth, args.emails, args.uids);

  if (users.length === 0) {
    console.log("No matching auth users found.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `${args.dryRun ? "Dry run for" : "Updating"} ${users.length} user(s)...`,
  );

  for (const user of users) {
    const profileStatus = await getProfileStatus(db, user.uid);

    console.log("");
    console.log(`Email: ${user.email ?? "(no email)"}`);
    console.log(`UID: ${user.uid}`);
    console.log(`Currently verified: ${user.emailVerified}`);
    console.log(
      `Firestore docs: users=${profileStatus.hasUserDoc}, publicProfiles=${profileStatus.hasPublicProfileDoc}`,
    );

    if (args.dryRun) {
      continue;
    }

    if (user.emailVerified) {
      console.log("Skipped: already verified.");
      continue;
    }

    await auth.updateUser(user.uid, { emailVerified: true });
    console.log("Updated: emailVerified=true");
  }
}

main().catch((error) => {
  console.error("");
  console.error("mark-email-verified failed.");
  console.error(error);
  console.error("");
  console.error(
    "If this is a credentials error, run the script from an environment that has Firebase Admin access.",
  );
  process.exitCode = 1;
});
