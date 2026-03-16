import {
  addDoc,
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  query,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";

export type ConnectionRequestStatus = "pending" | "accepted" | "declined";

export type ConnectionRequest = {
  id: string;
  fromUid: string;
  toUid: string;
  status: ConnectionRequestStatus;
  createdAt?: any;
  respondedAt?: any;
};

export type ConnectionDoc = {
  id: string;
  users: string[];
  createdAt?: any;
};

export type PublicUserProfile = {
  uid: string;
  firstName?: string;
  pronouns?: string;
  major?: string;
  minor?: string;
  bio?: string;
  avatarId?: string;
  photoURL?: string;
};

function sortedPair(uid1: string, uid2: string): [string, string] {
  return [uid1, uid2].sort() as [string, string];
}

function connectionDocId(uid1: string, uid2: string): string {
  const [a, b] = sortedPair(uid1, uid2);
  return `${a}_${b}`;
}

export async function sendConnectionRequest(toUid: string): Promise<void> {
  const fromUid = auth.currentUser?.uid;

  if (!fromUid) throw new Error("You must be logged in.");
  if (fromUid === toUid) throw new Error("You cannot connect with yourself.");

  await addDoc(collection(db, "connectionRequests"), {
    fromUid,
    toUid,
    status: "pending",
    createdAt: serverTimestamp(),
    respondedAt: null,
  });
}

export async function acceptConnectionRequest(
  requestId: string,
  fromUid: string,
  toUid: string,
): Promise<void> {
  const currentUid = auth.currentUser?.uid;

  if (!currentUid) throw new Error("You must be logged in.");
  if (currentUid !== toUid) {
    throw new Error("Only the receiving user can accept this request.");
  }

  const requestRef = doc(db, "connectionRequests", requestId);

  await updateDoc(requestRef, {
    status: "accepted",
    respondedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "connections", connectionDocId(fromUid, toUid)), {
    users: sortedPair(fromUid, toUid),
    createdAt: serverTimestamp(),
  });
}

export async function declineConnectionRequest(
  requestId: string,
): Promise<void> {
  const currentUid = auth.currentUser?.uid;

  if (!currentUid) throw new Error("You must be logged in.");

  await updateDoc(doc(db, "connectionRequests", requestId), {
    status: "declined",
    respondedAt: serverTimestamp(),
  });
}

export function subscribeToIncomingRequests(
  uid: string,
  callback: (requests: ConnectionRequest[]) => void,
) {
  const q = query(
    collection(db, "connectionRequests"),
    where("toUid", "==", uid),
  );

  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const requests: ConnectionRequest[] = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          fromUid: data.fromUid,
          toUid: data.toUid,
          status: data.status,
          createdAt: data.createdAt,
          respondedAt: data.respondedAt,
        };
      })
      .filter((request) => request.status === "pending");

    callback(requests);
  });
}

export function subscribeToConnections(
  uid: string,
  callback: (connections: ConnectionDoc[]) => void,
) {
  const q = query(
    collection(db, "connections"),
    where("users", "array-contains", uid),
  );

  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const connections: ConnectionDoc[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        users: data.users ?? [],
        createdAt: data.createdAt,
      };
    });

    callback(connections);
  });
}

export async function getUserProfile(uid: string): Promise<PublicUserProfile> {
  const userRef = doc(db, "publicProfiles", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    return { uid };
  }

  const data = snap.data();

  return {
    uid,
    firstName: data.firstName ?? "",
    pronouns: data.pronouns ?? data.Gender ?? "",
    major: data.major ?? "",
    minor: data.minor ?? "",
    bio: data.bio ?? "",
    avatarId: data.avatarId ?? "",
    photoURL: data.photoURL ?? "",
  };
}
