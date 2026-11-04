import {
  sessionCallable as httpsCallable,
  captureUserSession,
  assertUserSession,
} from "../auth/sessionCallable";
import { getFunctions } from "firebase/functions";
import { resolveProfilePhoto } from "../lib/picture_upload";
import { app, auth } from "../../firebaseConfig";

const functions = getFunctions(app, "us-central1");
export async function saveProfile(
  profile: Record<string, unknown>,
  onboardingLocation?: { sharingEnabled: boolean; permissionStatus: string },
  expectedUid = auth.currentUser?.uid,
): Promise<void> {
  const session = captureUserSession(expectedUid);
  await httpsCallable(
    functions,
    "profile_save",
  )({ profile, ...(onboardingLocation ? { onboardingLocation } : {}) });
  assertUserSession(session);
}
export async function fetchProfile(uid: string): Promise<Record<string, any>> {
  const caller = auth.currentUser?.uid;
  const result = await httpsCallable<{ uid: string }, Record<string, any>>(
    functions,
    "profile_get",
  )({ uid });
  if (auth.currentUser?.uid !== caller)
    throw new Error("Session changed while loading profile.");
  const photoURL = await resolveProfilePhoto(uid, result.data.photoURL).catch(
    () => "",
  );
  if (auth.currentUser?.uid !== caller)
    throw new Error("Session changed while loading profile.");
  return { ...result.data, photoURL };
}
