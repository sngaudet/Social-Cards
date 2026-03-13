import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";
import {
  acceptConnectionRequest,
  ConnectionDoc,
  ConnectionRequest,
  declineConnectionRequest,
  getUserProfile,
  PublicUserProfile,
  subscribeToConnections,
  subscribeToIncomingRequests,
} from "../../src/connections/service";
import { showAlert } from "../../src/lib/showAlert";

type RequestWithProfile = ConnectionRequest & {
  fromUser?: PublicUserProfile;
};

type ConnectionWithProfile = ConnectionDoc & {
  otherUid: string;
  otherUser?: PublicUserProfile;
};

export default function ConnectionsPage() {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;

  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<ConnectionDoc[]>([]);
  const [requestProfiles, setRequestProfiles] = useState<
    Record<string, PublicUserProfile>
  >({});
  const [connectionProfiles, setConnectionProfiles] = useState<
    Record<string, PublicUserProfile>
  >({});
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUid) return;

    const unsubRequests = subscribeToIncomingRequests(currentUid, setRequests);
    const unsubConnections = subscribeToConnections(currentUid, setConnections);

    return () => {
      unsubRequests();
      unsubConnections();
    };
  }, [currentUid]);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      const uniqueFromUids = Array.from(
        new Set(requests.map((r) => r.fromUid)),
      );

      const entries = await Promise.all(
        uniqueFromUids.map(async (uid) => {
          const profile = await getUserProfile(uid);
          return [uid, profile] as const;
        }),
      );

      if (!cancelled) {
        setRequestProfiles(Object.fromEntries(entries));
      }
    };

    loadProfiles().catch((e) => {
      console.warn("Failed to load request profiles", e);
    });

    return () => {
      cancelled = true;
    };
  }, [requests]);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      if (!currentUid) return;

      const otherUids = Array.from(
        new Set(
          connections.map(
            (c) => c.users.find((uid) => uid !== currentUid) || "",
          ),
        ),
      ).filter(Boolean);

      const entries = await Promise.all(
        otherUids.map(async (uid) => {
          const profile = await getUserProfile(uid);
          return [uid, profile] as const;
        }),
      );

      if (!cancelled) {
        setConnectionProfiles(Object.fromEntries(entries));
      }
    };

    loadProfiles().catch((e) => {
      console.warn("Failed to load connection profiles", e);
    });

    return () => {
      cancelled = true;
    };
  }, [connections, currentUid]);

  const requestsWithProfiles: RequestWithProfile[] = useMemo(() => {
    return requests.map((r) => ({
      ...r,
      fromUser: requestProfiles[r.fromUid],
    }));
  }, [requests, requestProfiles]);

  const connectionsWithProfiles: ConnectionWithProfile[] = useMemo(() => {
    if (!currentUid) return [];

    return connections.map((c) => {
      const otherUid = c.users.find((uid) => uid !== currentUid) || "";
      return {
        ...c,
        otherUid,
        otherUser: connectionProfiles[otherUid],
      };
    });
  }, [connections, connectionProfiles, currentUid]);

  const handleAccept = async (request: ConnectionRequest) => {
    try {
      setBusyRequestId(request.id);
      await acceptConnectionRequest(request.id, request.fromUid, request.toUid);
      showAlert("Accepted", "Connection request accepted.");
    } catch (e: any) {
      showAlert("Could not accept", e?.message ?? "Unknown error");
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      setBusyRequestId(requestId);
      await declineConnectionRequest(requestId);
      showAlert("Declined", "Connection request declined.");
    } catch (e: any) {
      showAlert("Could not decline", e?.message ?? "Unknown error");
    } finally {
      setBusyRequestId(null);
    }
  };

  const openChat = (connectionId: string, otherUid: string) => {
    router.push({
      pathname: "/(tabs)/chat/[connectionId]",
      params: { connectionId, otherUid },
    });
  };

  if (!currentUid) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Connections</Text>
        <Text style={styles.subtleText}>You must be logged in.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Connections</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Requests</Text>

        {requestsWithProfiles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No pending requests</Text>
            <Text style={styles.subtleText}>
              When someone sends you a connection request, it will appear here.
            </Text>
          </View>
        ) : (
          requestsWithProfiles.map((request) => (
            <View key={request.id} style={styles.card}>
              <View style={styles.row}>
                {request.fromUser?.photoURL ? (
                  <Image
                    source={{ uri: request.fromUser.photoURL }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>No Photo</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.nameText}>
                    {request.fromUser?.firstName || request.fromUid}
                  </Text>
                  <Text style={styles.subtleText}>
                    {request.fromUser?.major || "No major listed"}
                  </Text>
                  <Text style={styles.uidText}>UID: {request.fromUid}</Text>
                </View>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.acceptButton,
                    busyRequestId === request.id && styles.disabledButton,
                  ]}
                  disabled={busyRequestId === request.id}
                  onPress={() => handleAccept(request)}
                >
                  <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.declineButton,
                    busyRequestId === request.id && styles.disabledButton,
                  ]}
                  disabled={busyRequestId === request.id}
                  onPress={() => handleDecline(request.id)}
                >
                  <Text style={styles.buttonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accepted Connections</Text>

        {connectionsWithProfiles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No connections yet</Text>
            <Text style={styles.subtleText}>
              Accepted connections will appear here.
            </Text>
          </View>
        ) : (
          connectionsWithProfiles.map((connection) => (
            <View key={connection.id} style={styles.card}>
              <View style={styles.row}>
                {connection.otherUser?.photoURL ? (
                  <Image
                    source={{ uri: connection.otherUser.photoURL }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>No Photo</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.nameText}>
                    {connection.otherUser?.firstName || connection.otherUid}
                  </Text>
                  <Text style={styles.subtleText}>
                    {connection.otherUser?.major || "No major listed"}
                  </Text>
                  <Text style={styles.uidText}>UID: {connection.otherUid}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => openChat(connection.id, connection.otherUid)}
              >
                <Text style={styles.buttonText}>Text</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#D9E0F0",
    padding: 24,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    backgroundColor: "#D9E0F0",
    gap: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtleText: {
    fontSize: 13,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#e5e7eb",
  },
  avatarPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
  },
  nameText: {
    fontSize: 18,
    fontWeight: "700",
  },
  uidText: {
    marginTop: 4,
    fontSize: 12,
    color: "#888",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  acceptButton: {
    backgroundColor: "#2452ce",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  declineButton: {
    backgroundColor: "#888",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  messageButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2452ce",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
