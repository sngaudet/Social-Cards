import {
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  QuerySnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";

export const CONNECTION_DURATION_MS = 3 * 60 * 60 * 1000;

export type ConnectionRequestStatus = "pending" | "accepted" | "declined";
export type RelationshipStatus =
  | "none"
  | "pending"
  | "accepted"
  | "declined"
  | "blocked";

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
  expiresAt?: any;
};

type StoredRelationshipStatus = Exclude<RelationshipStatus, "none">;

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

function relationshipDocId(uid1: string, uid2: string): string {
  return connectionDocId(uid1, uid2);
}

function isStoredRelationshipStatus(
  value: unknown,
): value is StoredRelationshipStatus {
  return (
    value === "pending" ||
    value === "accepted" ||
    value === "declined" ||
    value === "blocked"
  );
}

export async function getRelationshipStatusForPair(
  uid1: string,
  uid2: string,
): Promise<RelationshipStatus> {
  const snap = await getDoc(doc(db, "relationships", relationshipDocId(uid1, uid2)));
  if (!snap.exists()) return "none";

  const status = snap.data()?.status;
  return isStoredRelationshipStatus(status) ? status : "none";
}

export async function getRelationshipStatus(
  otherUid: string,
): Promise<RelationshipStatus> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("You must be logged in.");
  if (currentUid === otherUid) return "accepted";

  return getRelationshipStatusForPair(currentUid, otherUid);
}

export async function sendConnectionRequest(toUid: string): Promise<void> {
  const fromUid = auth.currentUser?.uid;

  if (!fromUid) throw new Error("You must be logged in.");
  if (fromUid === toUid) throw new Error("You cannot connect with yourself.");

  const relationshipStatus = await getRelationshipStatusForPair(fromUid, toUid);
  if (relationshipStatus === "blocked") {
    throw new Error("You cannot connect with this user.");
  }

  const outgoingPendingQuery = query(
    collection(db, "connectionRequests"),
    where("fromUid", "==", fromUid),
    where("toUid", "==", toUid),
    where("status", "==", "pending"),
  );
  const incomingPendingQuery = query(
    collection(db, "connectionRequests"),
    where("fromUid", "==", toUid),
    where("toUid", "==", fromUid),
    where("status", "==", "pending"),
  );

  const [outgoingPendingSnap, incomingPendingSnap] = await Promise.all([
    getDocs(outgoingPendingQuery),
    getDocs(incomingPendingQuery),
  ]);

  if (!outgoingPendingSnap.empty) {
    throw new Error("You already sent this user a connection request.");
  }

  if (!incomingPendingSnap.empty) {
    throw new Error("This user has already sent you a connection request.");
  }

  const requestRef = doc(collection(db, "connectionRequests"));
  const batch = writeBatch(db);

  batch.set(requestRef, {
    fromUid,
    toUid,
    status: "pending",
    createdAt: serverTimestamp(),
    respondedAt: null,
  });
  batch.set(
    doc(db, "relationships", relationshipDocId(fromUid, toUid)),
    {
      users: sortedPair(fromUid, toUid),
      status: "pending",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
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
  const batch = writeBatch(db);

  batch.update(requestRef, {
    status: "accepted",
    respondedAt: serverTimestamp(),
  });
  batch.set(doc(db, "connections", connectionDocId(fromUid, toUid)), {
    users: sortedPair(fromUid, toUid),
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(
      new Date(Date.now() + CONNECTION_DURATION_MS),
    ),
  });
  batch.set(
    doc(db, "relationships", relationshipDocId(fromUid, toUid)),
    {
      users: sortedPair(fromUid, toUid),
      status: "accepted",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
}

export async function declineConnectionRequest(
  requestId: string,
): Promise<void> {
  const currentUid = auth.currentUser?.uid;

  if (!currentUid) throw new Error("You must be logged in.");

  const requestRef = doc(db, "connectionRequests", requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) {
    throw new Error("Connection request not found.");
  }

  const request = requestSnap.data();
  const fromUid = request?.fromUid;
  const toUid = request?.toUid;

  if (typeof fromUid !== "string" || typeof toUid !== "string") {
    throw new Error("Malformed connection request.");
  }

  const batch = writeBatch(db);

  batch.update(requestRef, {
    status: "declined",
    respondedAt: serverTimestamp(),
  });
  batch.set(
    doc(db, "relationships", relationshipDocId(fromUid, toUid)),
    {
      users: sortedPair(fromUid, toUid),
      status: "declined",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
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
        expiresAt: data.expiresAt,
      };
    });

    callback(connections);
  });
}

function getDateFromTimestamp(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  return null;
}

export function getConnectionCreatedAt(connection: Pick<ConnectionDoc, "createdAt">): Date | null {
  return getDateFromTimestamp(connection.createdAt);
}

export function getConnectionExpiresAt(
  connection: Pick<ConnectionDoc, "createdAt" | "expiresAt">,
): Date | null {
  const explicitExpiresAt = getDateFromTimestamp(connection.expiresAt);
  if (explicitExpiresAt) return explicitExpiresAt;

  const createdAt = getConnectionCreatedAt(connection);
  if (!createdAt) return null;

  return new Date(createdAt.getTime() + CONNECTION_DURATION_MS);
}

export function isConnectionActive(
  connection: Pick<ConnectionDoc, "createdAt" | "expiresAt">,
  now = new Date(),
): boolean {
  const expiresAt = getConnectionExpiresAt(connection);
  if (!expiresAt) return true;
  return expiresAt.getTime() > now.getTime();
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
