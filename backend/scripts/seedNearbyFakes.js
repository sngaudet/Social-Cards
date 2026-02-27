const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { geohashForLocation } = require("geofire-common");

// this reads a flag like --lat=43.0 or --lat 43.0
function getArg(name, fallback = null) {
  const equalsPrefix = `--${name}=`;
  const directPrefix = `--${name}`;
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (value.startsWith(equalsPrefix)) {
      return value.slice(equalsPrefix.length);
    }
    if (value === directPrefix) {
      return args[i + 1] ?? fallback;
    }
  }

  return fallback;
}

// this turns a flag into a number safely
function getNumberArg(name, fallback = null) {
  const raw = getArg(name, null);
  if (raw === null || raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// this prints help text for quick copy/paste usage
function printUsage() {
  console.log(`
usage:
  npm run seed:nearby-fakes -- --lat <number> --lng <number> [options]

required:
  --lat            base latitude
  --lng            base longitude

optional:
  --geohash        base geohash (auto-computed if omitted)
  --count          number of fake users (default: 8)
  --ttlMinutes     presence ttl in minutes (default: 60)
  --spreadFt       spread fakes in a small ring around base point (default: 0)
  --prefix         uid prefix for fakes (default: fake)
  --project        firebase project id (default: social-cards-b8e6f)

example:
  npm run seed:nearby-fakes -- --lat 43.072178704337965 --lng -87.88516313602382 --geohash dp9t015cxk --count 8
`);
}

// this converts feet to meters for simple offset math
function toMeters(feet) {
  return feet * 0.3048;
}

// this offsets a lat/lng point by distance+bearing
function offsetPoint(baseLat, baseLng, meters, radians) {
  if (meters <= 0) return { lat: baseLat, lng: baseLng };

  const latRad = (baseLat * Math.PI) / 180;
  const dLat = (meters * Math.cos(radians)) / 111320;
  const dLng = (meters * Math.sin(radians)) / (111320 * Math.max(0.1, Math.cos(latRad)));

  return {
    lat: baseLat + dLat,
    lng: baseLng + dLng,
  };
}

async function main() {
  const projectId = getArg("project", process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "social-cards-b8e6f");
  const lat = getNumberArg("lat");
  const lng = getNumberArg("lng");
  const geohash = getArg("geohash", null);
  const count = Math.max(1, Math.trunc(getNumberArg("count", 8)));
  const ttlMinutes = Math.max(1, Math.trunc(getNumberArg("ttlMinutes", 60)));
  const spreadFt = Math.max(0, getNumberArg("spreadFt", 0));
  const prefix = String(getArg("prefix", "fake")).trim() || "fake";

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.error("error: --lat and --lng are required and must be numbers");
    printUsage();
    process.exit(1);
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    console.error("error: lat/lng values are out of range");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ projectId });
  }

  const db = getFirestore();
  const nowMs = Date.now();
  const updatedAt = Timestamp.fromMillis(nowMs);
  const expiresAt = Timestamp.fromMillis(nowMs + ttlMinutes * 60 * 1000);
  const spreadM = toMeters(spreadFt);

  const majors = [
    "computer science",
    "business",
    "nursing",
    "psychology",
    "engineering",
    "marketing",
    "biology",
    "finance",
  ];

  const hobbies = [
    "coffee, music, gym",
    "hiking, gaming, photography",
    "basketball, movies, food",
    "reading, travel, cooking",
    "running, music, coding",
    "fashion, art, volleyball",
    "anime, lifting, tacos",
    "soccer, podcasts, boba",
  ];

  const breakerOne = [
    "what is your go-to comfort food",
    "what song are you replaying this week",
    "what is your favorite off-campus spot",
    "what hobby did you pick up recently",
  ];

  const breakerTwo = [
    "what is your ideal friday night",
    "what show can you rewatch forever",
    "what is your dream travel destination",
    "what is your favorite local restaurant",
  ];

  const breakerThree = [
    "what is one skill you want to learn",
    "what is your favorite way to relax",
    "what is your best study tip",
    "what is your favorite thing about campus",
  ];

  let batch = db.batch();
  let opsInBatch = 0;
  const createdUids = [];

  for (let i = 0; i < count; i += 1) {
    const uid = `${prefix}_${String(i + 1).padStart(2, "0")}`;
    createdUids.push(uid);

    // this spreads users in a ring if spreadFt > 0
    const ringAngle = (2 * Math.PI * i) / count;
    const ringDistance = spreadM > 0 ? spreadM * (0.6 + (i % 3) * 0.2) : 0;
    const point = offsetPoint(lat, lng, ringDistance, ringAngle);
    const pointGeohash =
      spreadM === 0 && geohash
        ? geohash
        : geohashForLocation([point.lat, point.lng]);

    const userDoc = {
      firstName: `test${i + 1}`,
      major: majors[i % majors.length],
      hobbies: hobbies[i % hobbies.length],
      photoURL: "",
      iceBreakerOne: breakerOne[i % breakerOne.length],
      iceBreakerTwo: breakerTwo[i % breakerTwo.length],
      iceBreakerThree: breakerThree[i % breakerThree.length],
      updatedAt,
    };

    const presenceDoc = {
      uid,
      lat: point.lat,
      lng: point.lng,
      geohash: pointGeohash,
      accuracyM: 8,
      source: "foreground",
      updatedAt,
      expiresAt,
    };

    batch.set(db.collection("users").doc(uid), userDoc, { merge: true });
    batch.set(db.collection("presence").doc(uid), presenceDoc, { merge: true });
    opsInBatch += 2;

    // this keeps batch writes under firestore limits
    if (opsInBatch >= 400) {
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`seeded ${count} fake users in project ${projectId}`);
  console.log(`uids: ${createdUids.join(", ")}`);
  console.log(`base point: ${lat}, ${lng}`);
}

main().catch((error) => {
  const message = error?.message || String(error);
  console.error(`seed failed: ${message}`);

  if (message.toLowerCase().includes("default credentials")) {
    console.error("tip: run 'gcloud auth application-default login' once, then retry");
  }

  process.exit(1);
});
