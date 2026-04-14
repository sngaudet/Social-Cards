import { signOut } from "firebase/auth";

import { auth } from "../../firebaseConfig";
import { prepareLocationServicesForSessionExit } from "../location/service";

// this signs the user out after clearing presence and stopping tracking
export async function signOutCurrentUser(): Promise<void> {
  try {
    await prepareLocationServicesForSessionExit();
  } catch (error) {
    console.warn("Could not fully clean up location services before sign-out", error);
  }

  await signOut(auth);
}
