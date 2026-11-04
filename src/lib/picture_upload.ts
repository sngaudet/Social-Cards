import { ref, uploadBytes } from "firebase/storage";
import { collection, doc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth, db, storage } from "../../firebaseConfig";

export async function uploadProfilePhotoAsync(localUri: string, userId?: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid || (userId && userId !== uid)) throw new Error("Not signed in as the photo owner.");
  const response = await fetch(localUri);
  const blob = await response.blob();
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = extensions[blob.type];
  if (!extension || !blob.size || blob.size > 2 * 1024 * 1024) throw new Error("Choose a JPEG, PNG, or WebP photo smaller than 2 MB.");
  const path = `users/${uid}/profilePictures/${doc(collection(db, "photoUploads")).id}.${extension}`;
  await uploadBytes(ref(storage, path), blob, { contentType: blob.type });
  if (auth.currentUser?.uid !== uid) throw new Error("Session changed during upload.");
  return path;
}

export async function resolveProfilePhoto(uid: string, photoPath?: string): Promise<string> {
  if (!photoPath) return "";
  // Never render old Firebase download URLs; migration revokes their bearer tokens.
  if (!photoPath.startsWith(`users/${uid}/profilePictures/`)) return "";
  const caller = auth.currentUser?.uid;
  const result = await httpsCallable<{ uid: string }, { dataUri: string }>(getFunctions(app, "us-central1"), "profile_getPhoto")({ uid });
  return caller === auth.currentUser?.uid ? result.data.dataUri : "";
}

export async function deleteUploadedProfilePhotoAsync(photoPath: string): Promise<void> {
  // The server sweeps unattached uploads, including interrupted signup attempts.
  void photoPath;
}
