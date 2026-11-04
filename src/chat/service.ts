import {
  sessionCallable as httpsCallable,
  captureUserSession,
  assertUserSession,
  guardSessionCallback,
} from "../auth/sessionCallable";
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
} from "firebase/firestore";
import { app, auth, db } from "../../firebaseConfig";
import { getFunctions } from "firebase/functions";

export type ChatMessage = {
  id: string;
  senderUid: string;
  text: string;
  createdAt?: any;
};

export async function getConnectionMembers(
  connectionId: string,
): Promise<string[]> {
  const session = captureUserSession();
  const snap = await getDoc(doc(db, "connections", connectionId));
  assertUserSession(session);
  if (!snap.exists()) {
    throw new Error("Connection not found.");
  }

  const data = snap.data();
  if (!Array.isArray(data.users) || !data.users.includes(session.uid))
    throw new Error("Connection unavailable for this account.");
  return data.users;
}

export function subscribeToMessages(
  connectionId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(
    collection(db, "connections", connectionId, "messages"),
    orderBy("createdAt", "asc"),
  );

  const session = captureUserSession();
  const notify = guardSessionCallback(session.uid, callback);
  const fail = onError ? guardSessionCallback(session.uid, onError) : undefined;
  let cancelled = false;
  let unsubscribe = () => {};
  void getConnectionMembers(connectionId)
    .then(() => {
      if (cancelled) return;
      assertUserSession(session);
      unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const messages = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              senderUid: data.senderUid ?? "",
              text: data.text ?? "",
              createdAt: data.createdAt,
            };
          });
          notify(messages);
        },
        fail,
      );
    })
    .catch((error) => {
      if (!cancelled) fail?.(error);
    });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export function createMessageOperationId(): string {
  return doc(collection(db, "messageOperations")).id;
}

const sendChatMessage = httpsCallable(
  getFunctions(app, "us-central1"),
  "sendChatMessage",
);

export async function sendMessage(
  connectionId: string,
  text: string,
  operationId: string,
  expectedUid = auth.currentUser?.uid,
): Promise<void> {
  const session = captureUserSession(expectedUid);
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000)
    throw new Error("Message must contain 1–2000 characters.");
  await sendChatMessage({ connectionId, text: trimmed, operationId });
  assertUserSession(session);
}
