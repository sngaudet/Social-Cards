import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebaseConfig";

const functions = getFunctions(app, "us-central1");
export async function saveProfile(profile: Record<string, unknown>, onboardingLocation?: { sharingEnabled: boolean; permissionStatus: string }): Promise<void> {
  await httpsCallable(functions, "profile_save")({ profile, ...(onboardingLocation ? { onboardingLocation } : {}) });
}
export async function fetchProfile(uid: string): Promise<Record<string, any>> {
  const result = await httpsCallable<{ uid: string }, Record<string, any>>(functions, "profile_get")({ uid });
  return result.data;
}
