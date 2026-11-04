const { HttpsError } = require("firebase-functions/v2/https");
const STRING_LIMITS = { firstName: 80, lastName: 80, pronouns: 80, dateOfBirth: 10,
  bio: 1000, major: 160, minor: 160, avatarId: 80, photoURL: 1024,
  iceBreakerOne: 500, iceBreakerTwo: 500, iceBreakerThree: 500,
  iceBreakerOneQuestion: 250, iceBreakerTwoQuestion: 250, iceBreakerThreeQuestion: 250 };
const VISIBILITY = { photoURL: false, lastName: false, pronouns: true, dateOfBirth: true,
  gradYear: true, major: true, minor: true, bio: true, iceBreakerOne: true,
  iceBreakerOneQuestion: true, iceBreakerTwo: true, iceBreakerThree: true, hobbies: true };
function visibility(value) {
  const raw = value ?? {};
  return Object.fromEntries(Object.entries(VISIBILITY).map(([key, fallback]) => [key,
    typeof raw[key] === "boolean" ? raw[key] : typeof raw[key === "pronouns" ? "Gender" : key === "dateOfBirth" ? "age" : key] === "boolean"
      ? raw[key === "pronouns" ? "Gender" : key === "dateOfBirth" ? "age" : key] : fallback]));
}
function validateProfile(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpsError("invalid-argument", "Invalid profile.");
  const allowed = new Set([...Object.keys(STRING_LIMITS), "gradYear", "hobbies", "preConnectionVisibility", "photoUrls"]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) throw new HttpsError("invalid-argument", "Unknown profile field.");
  const result = {};
  for (const [key, max] of Object.entries(STRING_LIMITS)) {
    if (!(key in raw)) continue;
    if (typeof raw[key] !== "string" || raw[key].length > max) throw new HttpsError("invalid-argument", `Invalid ${key}.`);
    result[key] = raw[key].trim();
  }
  if (result.dateOfBirth) {
    const date = new Date(`${result.dateOfBirth}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.dateOfBirth) || !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== result.dateOfBirth || date.getTime() > Date.now() || date.getUTCFullYear() < 1900) {
      throw new HttpsError("invalid-argument", "Invalid birth date.");
    }
  }
  if ("gradYear" in raw) {
    if (raw.gradYear !== null && (!Number.isInteger(raw.gradYear) || raw.gradYear < 1900 || raw.gradYear > 2200)) throw new HttpsError("invalid-argument", "Invalid graduation year.");
    result.gradYear = raw.gradYear;
  }
  if ("hobbies" in raw) {
    if (!Array.isArray(raw.hobbies) || raw.hobbies.length > 30 || raw.hobbies.some((item) => typeof item !== "string" || item.length > 80)) throw new HttpsError("invalid-argument", "Invalid hobbies.");
    result.hobbies = [...new Set(raw.hobbies.map((item) => item.trim()).filter(Boolean))];
  }
  if ("preConnectionVisibility" in raw) {
    const flags = raw.preConnectionVisibility;
    if (!flags || typeof flags !== "object" || Array.isArray(flags) || Object.entries(flags).some(([key, value]) => !(key in VISIBILITY) || typeof value !== "boolean")) throw new HttpsError("invalid-argument", "Invalid visibility settings.");
    result.preConnectionVisibility = visibility(flags);
  }
  if ("photoUrls" in raw) {
    if (!Array.isArray(raw.photoUrls) || raw.photoUrls.length > 5 || raw.photoUrls.some((path) => typeof path !== "string" || path.length > 1024)) throw new HttpsError("invalid-argument", "Invalid photos.");
    result.photoUrls = [...new Set(raw.photoUrls)];
  }
  return result;
}
// This is the only projection used for other users, including discovery.
function projectProfile(uid, profile, connected = false) {
  const flags = visibility(profile.preConnectionVisibility);
  const result = { uid, firstName: profile.firstName ?? "", avatarId: profile.avatarId ?? "", preConnectionVisibility: flags };
  for (const key of [...Object.keys(STRING_LIMITS), "gradYear", "hobbies"]) {
    if (key in result) continue;
    const flag = key === "iceBreakerTwoQuestion" ? "iceBreakerTwo" : key === "iceBreakerThreeQuestion" ? "iceBreakerThree" : key;
    if (connected || flags[flag] === true) result[key] = profile[key] ?? (key === "hobbies" ? [] : "");
  }
  return result;
}
module.exports = { validateProfile, projectProfile, visibility };
