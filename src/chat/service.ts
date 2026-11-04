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
import { getFunctions, httpsCallable } from "firebase/functions";

export type ChatMessage = {
  id: string;
  senderUid: string;
  text: string;
  createdAt?: any;
};

export async function getConnectionMembers(
  connectionId: string,
): Promise<string[]> {
  const snap = await getDoc(doc(db, "connections", connectionId));
  if (!snap.exists()) {
    throw new Error("Connection not found.");
  }

  const data = snap.data();
  return Array.isArray(data.users) ? data.users : [];
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

  return onSnapshot(
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

      callback(messages);
    },
    onError,
  );
}

export function createMessageOperationId(): string {
  return doc(collection(db, "messageOperations")).id;
}

const sendChatMessage = httpsCallable(getFunctions(app, "us-central1"), "sendChatMessage");

export async function sendMessage(
  connectionId: string,
  text: string,
  operationId: string,
): Promise<void> {
  if (!auth.currentUser) throw new Error("You must be logged in.");
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000) throw new Error("Message must contain 1–2000 characters.");
  await sendChatMessage({ connectionId, text: trimmed, operationId });
}
