import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app } from "../../firebaseConfig";

type CheckEmailExistsPayload = {
  email: string;
};

type CheckEmailExistsResponse = {
  exists: boolean;
};

const functions = getFunctions(app, "us-central1");

const RETRYABLE_FUNCTION_CODES = new Set([
  "functions/internal",
  "functions/unavailable",
  "functions/deadline-exceeded",
]);

const checkEmailExistsCallable = httpsCallable<
  CheckEmailExistsPayload,
  CheckEmailExistsResponse
>(functions, "auth_checkEmailExists");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFunctionsError(error: unknown): boolean {
  return error instanceof FirebaseError && RETRYABLE_FUNCTION_CODES.has(error.code);
}

async function callWithRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (firstError) {
    if (!isRetryableFunctionsError(firstError)) throw firstError;
    await sleep(900);
    return action();
  }
}

export async function checkEmailExists(email: string): Promise<boolean> {
  const result = await callWithRetry(() => checkEmailExistsCallable({ email }));
  return result.data.exists === true;
}
