import { signOut } from "firebase/auth";

import { auth } from "../../firebaseConfig";
import { prepareLocationServicesForSessionExit } from "../location/service";

const SESSION_EXIT_CLEANUP_TIMEOUT_MS = 3000;

// this signs the user out after clearing presence and stopping tracking
export async function signOutCurrentUser(): Promise<void> {
  try {
    await Promise.race([
      prepareLocationServicesForSessionExit(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Session exit cleanup timed out"));
        }, SESSION_EXIT_CLEANUP_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn("Could not fully clean up location services before sign-out", error);
  }

  await signOut(auth);
}
