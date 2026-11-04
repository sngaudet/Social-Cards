import {
  sessionCallable as httpsCallable,
  captureUserSession,
  assertUserSession,
} from "../auth/sessionCallable";
import { ref, uploadBytes } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { refreshServerAuthorization } from "../auth/authorization";
import { app, auth, storage } from "../../firebaseConfig";

export async function uploadProfilePhotoAsync(
  localUri: string,
  userId?: string,
): Promise<string> {
  const session = captureUserSession(userId);
  const uid = session.uid;
  if (!uid || (userId && userId !== uid))
    throw new Error("Not signed in as the photo owner.");
  await refreshServerAuthorization();
  if (auth.currentUser?.uid !== uid)
    throw new Error("Session changed before upload.");
  const response = await fetch(localUri);
  const blob = await response.blob();
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[blob.type];
  if (!extension || !blob.size || blob.size > 2 * 1024 * 1024)
    throw new Error("Choose a JPEG, PNG, or WebP photo smaller than 2 MB.");
  assertUserSession(session);
  const ticket = await httpsCallable<
    { size: number; contentType: string },
    { path: string }
  >(
    getFunctions(app, "us-central1"),
    "profile_preparePhotoUpload",
  )({ size: blob.size, contentType: blob.type });
  const path = ticket.data.path;
  await uploadBytes(ref(storage, path), blob, { contentType: blob.type });
  if (auth.currentUser?.uid !== uid)
    throw new Error("Session changed during upload.");
  return path;
}

const photoCache = new Map<
  string,
  { dataUri: string; expiresAt: number; bytes: number }
>();
const PHOTO_CACHE_BYTES = 8 * 1024 * 1024;
let photoCacheEpoch = 0;
export function clearProfilePhotoCache(): void {
  photoCacheEpoch += 1;
  photoCache.clear();
}

export async function resolveProfilePhoto(
  uid: string,
  photoPath?: string,
): Promise<string> {
  if (!photoPath) return "";
  // Never render old Firebase download URLs; migration revokes their bearer tokens.
  if (!photoPath.startsWith(`users/${uid}/profilePictures/`)) return "";
  const caller = auth.currentUser?.uid;
  if (!caller) return "";
  const epoch = photoCacheEpoch;
  const key = `${caller}:${uid}:${photoPath}`;
  const cached = photoCache.get(key);
  // Callers first fetch the current server profile projection; cache only bytes
  // already downloaded for that session, never authorization or profile fields.
  if (cached && cached.expiresAt > Date.now()) return cached.dataUri;
  photoCache.delete(key);
  const result = await httpsCallable<{ uid: string }, { dataUri: string }>(
    getFunctions(app, "us-central1"),
    "profile_getPhoto",
  )({ uid });
  if (caller !== auth.currentUser?.uid || epoch !== photoCacheEpoch) return "";
  const dataUri = result.data.dataUri;
  for (const [entryKey, entry] of photoCache)
    if (entry.expiresAt <= Date.now()) photoCache.delete(entryKey);
  let usedBytes = [...photoCache.values()].reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  );
  while (photoCache.size && usedBytes + dataUri.length > PHOTO_CACHE_BYTES) {
    const oldest = photoCache.keys().next().value!;
    usedBytes -= photoCache.get(oldest)!.bytes;
    photoCache.delete(oldest);
  }
  if (dataUri && dataUri.length <= PHOTO_CACHE_BYTES)
    photoCache.set(key, {
      dataUri,
      expiresAt: Date.now() + 60000,
      bytes: dataUri.length,
    });
  return dataUri;
}

export async function deleteUploadedProfilePhotoAsync(
  photoPath: string,
): Promise<void> {
  // The server sweeps unattached uploads, including interrupted signup attempts.
  void photoPath;
}
