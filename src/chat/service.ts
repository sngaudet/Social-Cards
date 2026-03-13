import {
  addDoc,
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";

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
) {
  const q = query(
    collection(db, "connections", connectionId, "messages"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
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
  });
}

export async function sendMessage(
  connectionId: string,
  text: string,
): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("You must be logged in.");

  const trimmed = text.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  await addDoc(collection(db, "connections", connectionId, "messages"), {
    senderUid: currentUid,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}
