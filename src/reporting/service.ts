import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app } from "../../firebaseConfig";

type ReportUserPayload = {
  reportedUid: string;
  reason: string;
  details?: string;
};

type ReportUserResponse = {
  ok: true;
  reportId: string;
};

const functions = getFunctions(app, "us-central1");

// these are temporary function errors worth retrying once
const RETRYABLE_FUNCTION_CODES = new Set([
  "functions/internal",
  "functions/unavailable",
  "functions/deadline-exceeded",
]);

const reportUserCallable = httpsCallable<ReportUserPayload, ReportUserResponse>(
  functions,
  "reportUser",
);

// this is a tiny delay helper for retries
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// this checks if a failed call should be retried
function isRetryableFunctionsError(error: unknown): boolean {
  return error instanceof FirebaseError && RETRYABLE_FUNCTION_CODES.has(error.code);
}

// this retries once for temporary firebase function failures
async function callWithRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (firstError) {
    if (!isRetryableFunctionsError(firstError)) throw firstError;
    await sleep(900);
    return action();
  }
}

// this sends one moderation report for another user
export async function reportUser(
  reportedUid: string,
  reason: string,
  details?: string,
): Promise<ReportUserResponse> {
  const result = await callWithRetry(() =>
    reportUserCallable({
      reportedUid,
      reason,
      details,
    }),
  );

  return result.data;
}
