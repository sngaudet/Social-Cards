import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { auth, storage } from "../../firebaseConfig"; // adjust path to your firebaseConfig

export async function uploadProfilePhotoAsync(
  localUri: string,
  userId?: string,
) {
  const resolvedUserId = userId ?? auth.currentUser?.uid;
  if (!resolvedUserId) throw new Error("Not signed in.");

  const response = await fetch(localUri);
  const blob = await response.blob();

  // Put photos under the user id so you can manage them later
  const fileName = `profile_${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`;
  const storageRef = ref(
    storage,
    `users/${resolvedUserId}/profilePictures/${fileName}`,
  );

  const uploadTask = uploadBytesResumable(storageRef, blob);

  const downloadUrl = await new Promise<string>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      () => {},
      (err) => reject(err),
      async () => resolve(await getDownloadURL(uploadTask.snapshot.ref)),
    );
  });

  return downloadUrl;
}

export async function deleteUploadedProfilePhotoAsync(downloadUrl: string) {
  if (!downloadUrl) return;

  await deleteObject(ref(storage, downloadUrl));
}
