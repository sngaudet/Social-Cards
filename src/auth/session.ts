import {
  sessionCallable as httpsCallable,
  captureUserSession,
  assertUserSession,
} from "./sessionCallable";
import { FirebaseError } from "firebase/app";
import { signOut } from "firebase/auth";

import { getFunctions } from "firebase/functions";
import { app, auth } from "../../firebaseConfig";
import { prepareLocationServicesForSessionExit } from "../location/service";

const SESSION_EXIT_CLEANUP_TIMEOUT_MS = 3000;

// this signs the user out after clearing presence and stopping tracking
export async function signOutCurrentUser(): Promise<void> {
  const session = captureUserSession();
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
    console.warn(
      "Could not fully clean up location services before sign-out",
      error,
    );
  }

  assertUserSession(session);
  await httpsCallable(
    getFunctions(app, "us-central1"),
    "auth_endSession",
  )({}).catch((error) => {
    console.warn("Server session cleanup will expire automatically", error);
  });
  assertUserSession(session);
  await signOut(auth);
}

export async function deleteCurrentAccount(
  expectedUid = auth.currentUser?.uid,
): Promise<{ pending: boolean }> {
  const session = captureUserSession(expectedUid);
  try {
    const response = await httpsCallable<
      Record<string, never>,
      { pending: boolean }
    >(
      getFunctions(app, "us-central1"),
      "auth_deleteAccount",
    )({});
    assertUserSession(session);
    return response.data;
  } catch (error) {
    const failure = error as { code?: string; details?: { reason?: string } };
    if (
      failure.code === "functions/failed-precondition" &&
      failure.details?.reason === "recent-login-required"
    ) {
      throw new FirebaseError(
        "auth/requires-recent-login",
        "Sign in again before deleting your account.",
      );
    }
    throw error;
  }
}
