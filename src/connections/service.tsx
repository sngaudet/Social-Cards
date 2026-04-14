import { FirebaseError } from "firebase/app";
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
  where,
  writeBatch,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth, db } from "../../firebaseConfig";

export const CONNECTION_DURATION_MS = 24 * 60 * 60 * 1000;

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

export type BlockedRelationshipPreview = {
  firstName?: string;
  avatarId?: string;
  photoURL?: string;
};

export type BlockedRelationship = {
  id: string;
  users: string[];
  blockedByUid: string;
  blockedAt?: any;
  blockedPreview?: BlockedRelationshipPreview;
  hasMessageHistory: boolean;
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

type BlockUserPayload = {
  targetUid: string;
};

type AcceptConnectionRequestPayload = {
  requestId: string;
};

type AcceptConnectionRequestResponse = {
  ok: true;
  connectionId: string;
};

type DeclineConnectionRequestPayload = {
  requestId: string;
};

type DeclineConnectionRequestResponse = {
  ok: true;
  requestId: string;
};

type BlockUserResponse = {
  ok: true;
  relationshipId: string;
  hasMessageHistory: boolean;
};

type PruneDeletedAccountsResponse = {
  ok: true;
  prunedUidCount: number;
};

const functions = getFunctions(app, "us-central1");
const blockUserCallable = httpsCallable<BlockUserPayload, BlockUserResponse>(
  functions,
  "blockUser",
);
const acceptConnectionRequestCallable = httpsCallable<
  AcceptConnectionRequestPayload,
  AcceptConnectionRequestResponse
>(functions, "acceptConnectionRequest");
const declineConnectionRequestCallable = httpsCallable<
  DeclineConnectionRequestPayload,
  DeclineConnectionRequestResponse
>(functions, "declineConnectionRequest");
const pruneDeletedAccountsCallable = httpsCallable<
  Record<string, never>,
  PruneDeletedAccountsResponse
>(functions, "pruneDeletedAccounts");

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

function isMissingRelationshipPermissionError(error: unknown): boolean {
  return error instanceof FirebaseError && error.code === "permission-denied";
}

export async function getRelationshipStatusForPair(
  uid1: string,
  uid2: string,
): Promise<RelationshipStatus> {
  try {
    const snap = await getDoc(
      doc(db, "relationships", relationshipDocId(uid1, uid2)),
    );
    if (!snap.exists()) return "none";

    const status = snap.data()?.status;
    return isStoredRelationshipStatus(status) ? status : "none";
  } catch (error) {
    // this treats missing pair docs as no relationship instead of surfacing
    // a permission error from the rules' existing-doc read guard.
    if (isMissingRelationshipPermissionError(error)) {
      return "none";
    }
    throw error;
  }
}

export async function getRelationshipStatus(
  otherUid: string,
): Promise<RelationshipStatus> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("You must be logged in.");
  if (currentUid === otherUid) return "accepted";

  return getRelationshipStatusForPair(currentUid, otherUid);
}

export async function blockUser(otherUid: string): Promise<BlockUserResponse> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("You must be logged in.");
  if (currentUid === otherUid) throw new Error("You cannot block yourself.");

  const result = await blockUserCallable({ targetUid: otherUid });
  return result.data;
}

export async function pruneDeletedAccounts(): Promise<number> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return 0;

  const result = await pruneDeletedAccountsCallable({});
  return result.data?.prunedUidCount ?? 0;
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

  await acceptConnectionRequestCallable({ requestId });
}

export async function declineConnectionRequest(
  requestId: string,
): Promise<void> {
  const currentUid = auth.currentUser?.uid;

  if (!currentUid) throw new Error("You must be logged in.");
  await declineConnectionRequestCallable({ requestId });
}

export function subscribeToIncomingRequests(
  uid: string,
  callback: (requests: ConnectionRequest[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(
    collection(db, "connectionRequests"),
    where("toUid", "==", uid),
  );

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
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
    },
    onError,
  );
}

export function subscribeToConnections(
  uid: string,
  callback: (connections: ConnectionDoc[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(
    collection(db, "relationships"),
    where("users", "array-contains", uid),
    where("status", "==", "accepted"),
  );

  return onSnapshot(
    q,
    async (snapshot: QuerySnapshot<DocumentData>) => {
      try {
        const connectionSnaps = await Promise.all(
          snapshot.docs.map((relationshipSnap) =>
            getDoc(doc(db, "connections", relationshipSnap.id)).catch(
              (error) => {
                if (
                  error instanceof FirebaseError &&
                  error.code === "permission-denied"
                ) {
                  return null;
                }
                throw error;
              },
            ),
          ),
        );

        const connections: ConnectionDoc[] = connectionSnaps
          .filter(
            (
              connectionSnap,
            ): connectionSnap is NonNullable<typeof connectionSnap> =>
              Boolean(connectionSnap?.exists()),
          )
          .map((connectionSnap) => {
            const data = connectionSnap.data() ?? {};

            return {
              id: connectionSnap.id,
              users: data.users ?? [],
              createdAt: data.createdAt,
              expiresAt: data.expiresAt,
            };
          });

        callback(connections);
      } catch (error) {
        onError?.(error);
      }
    },
    onError,
  );
}

export function subscribeToBlockedRelationships(
  uid: string,
  callback: (relationships: BlockedRelationship[]) => void,
  onError?: (error: unknown) => void,
) {
  const q = query(
    collection(db, "relationships"),
    where("users", "array-contains", uid),
    where("status", "==", "blocked"),
    where("blockedByUid", "==", uid),
  );

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const relationships: BlockedRelationship[] = snapshot.docs.map(
        (docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            users: Array.isArray(data.users) ? data.users : [],
            blockedByUid: data.blockedByUid ?? "",
            blockedAt: data.blockedAt,
            blockedPreview:
              data.blockedPreview && typeof data.blockedPreview === "object"
                ? {
                    firstName: data.blockedPreview.firstName ?? "",
                    avatarId: data.blockedPreview.avatarId ?? "",
                    photoURL: data.blockedPreview.photoURL ?? "",
                  }
                : undefined,
            hasMessageHistory: data.hasMessageHistory === true,
          };
        },
      );

      callback(relationships);
    },
    onError,
  );
}

export async function getBlockedRelationshipForPair(
  uid1: string,
  uid2: string,
): Promise<BlockedRelationship | null> {
  try {
    const snap = await getDoc(
      doc(db, "relationships", relationshipDocId(uid1, uid2)),
    );
    if (!snap.exists()) return null;

    const data = snap.data();
    if (data?.status !== "blocked") return null;

    return {
      id: snap.id,
      users: Array.isArray(data.users) ? data.users : [],
      blockedByUid: data.blockedByUid ?? "",
      blockedAt: data.blockedAt,
      blockedPreview:
        data.blockedPreview && typeof data.blockedPreview === "object"
          ? {
              firstName: data.blockedPreview.firstName ?? "",
              avatarId: data.blockedPreview.avatarId ?? "",
              photoURL: data.blockedPreview.photoURL ?? "",
            }
          : undefined,
      hasMessageHistory: data.hasMessageHistory === true,
    };
  } catch (error) {
    if (isMissingRelationshipPermissionError(error)) {
      return null;
    }
    throw error;
  }
}

function getDateFromTimestamp(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  return null;
}

export function getConnectionCreatedAt(
  connection: Pick<ConnectionDoc, "createdAt">,
): Date | null {
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
