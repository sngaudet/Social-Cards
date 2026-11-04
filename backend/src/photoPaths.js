const { HttpsError } = require("firebase-functions/v2/https");
const PHOTO_PATH =
  /^users\/([A-Za-z0-9_-]{1,128})\/profilePictures\/([A-Za-z0-9_-]{1,100})\.(jpg|png|webp)$/;
function ownedPhotoPath(value, uid) {
  if (value === "") return "";
  if (
    typeof value !== "string" ||
    !PHOTO_PATH.test(value) ||
    PHOTO_PATH.exec(value)[1] !== uid
  ) {
    throw new HttpsError("invalid-argument", "Invalid owned photo path.");
  }
  return value;
}
function photoPaths(profile) {
  return [
    ...new Set(
      [
        profile?.photoURL,
        ...(Array.isArray(profile?.photoUrls) ? profile.photoUrls : []),
      ].filter((path) => typeof path === "string" && PHOTO_PATH.test(path)),
    ),
  ];
}

module.exports = { PHOTO_PATH, ownedPhotoPath, photoPaths };
