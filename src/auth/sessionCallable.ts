import { User } from "firebase/auth";
import {
  Functions,
  HttpsCallableResult,
  httpsCallable,
} from "firebase/functions";
import { auth } from "../../firebaseConfig";

export function captureUserSession(expectedUid = auth.currentUser?.uid): User {
  const user = auth.currentUser;
  if (!user || user.uid !== expectedUid)
    throw new Error("Your session changed. Please try again.");
  return user;
}
export function assertUserSession(user: User): void {
  if (auth.currentUser !== user)
    throw new Error("Your session changed. Please try again.");
}

// Ignore delayed listener results once their captured account has changed.
export function guardSessionCallback<T>(
  uid: string,
  callback: (value: T) => void,
): (value: T) => void {
  const session = auth.currentUser;
  return (value) => {
    if (session?.uid === uid && auth.currentUser === session) callback(value);
  };
}

// Bind the payload to the caller captured before the SDK asynchronously obtains a token.
export function sessionCallable<Input = unknown, Output = unknown>(
  functions: Functions,
  name: string,
) {
  const invoke = httpsCallable<Record<string, unknown>, Output>(
    functions,
    name,
  );
  return async (data: Input): Promise<HttpsCallableResult<Output>> => {
    const user = captureUserSession();
    try {
      const result = await invoke({
        ...(data as Record<string, unknown>),
        actorUid: user.uid,
      });
      assertUserSession(user);
      return result;
    } catch (error) {
      assertUserSession(user);
      throw error;
    }
  };
}
