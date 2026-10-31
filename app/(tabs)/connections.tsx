import { Feather } from "@expo/vector-icons";
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
  BlockedRelationship,
  ConnectionDoc,
  ConnectionRequest,
  declineConnectionRequest,
  getConnectionExpiresAt,
  getUserProfile,
  isConnectionActive,
  pruneDeletedAccounts,
  PublicUserProfile,
  subscribeToBlockedRelationships,
  subscribeToConnections,
  subscribeToIncomingRequests,
} from "../../src/connections/service";
import { getAvatarImageSource } from "../../src/lib/avatarImages";
import { showAlert } from "../../src/lib/showAlert";
import { iceColors as colors, iceMascot } from "../../src/theme/icebreakers";

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
  const [blockedRelationships, setBlockedRelationships] = useState<
    BlockedRelationship[]
  >([]);
  const [requestProfiles, setRequestProfiles] = useState<
    Record<string, PublicUserProfile>
  >({});
  const [connectionProfiles, setConnectionProfiles] = useState<
    Record<string, PublicUserProfile>
  >({});
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUid) return;

    pruneDeletedAccounts().catch((error) => {
      console.warn("Failed to prune deleted accounts from connections", error);
    });
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;

    const unsubRequests = subscribeToIncomingRequests(
      currentUid,
      setRequests,
      (error) => {
        if ((error as any)?.code === "permission-denied") {
          setRequests([]);
          return;
        }
        console.warn("Failed to watch incoming requests", error);
      },
    );
    const unsubConnections = subscribeToConnections(
      currentUid,
      setConnections,
      (error) => {
        if ((error as any)?.code === "permission-denied") {
          setConnections([]);
          return;
        }
        console.warn("Failed to watch connections", error);
      },
    );
    const unsubBlocked = subscribeToBlockedRelationships(
      currentUid,
      setBlockedRelationships,
      (error) => {
        if ((error as any)?.code === "permission-denied") {
          setBlockedRelationships([]);
          return;
        }
        console.warn("Failed to watch blocked relationships", error);
      },
    );

    return () => {
      unsubRequests();
      unsubConnections();
      unsubBlocked();
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

      const blockedIds = new Set(
        blockedRelationships.map((relationship) => relationship.id),
      );
      const visibleConnections = connections.filter(
        (connection) => !blockedIds.has(connection.id),
      );
      const otherUids = Array.from(
        new Set(
          visibleConnections.map(
            (connection) =>
              connection.users.find((uid) => uid !== currentUid) || "",
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
  }, [blockedRelationships, connections, currentUid]);

  const requestsWithProfiles: RequestWithProfile[] = useMemo(() => {
    return requests.map((request) => ({
      ...request,
      fromUser: requestProfiles[request.fromUid],
    }));
  }, [requestProfiles, requests]);

  const blockedRelationshipIds = useMemo(() => {
    return new Set(blockedRelationships.map((relationship) => relationship.id));
  }, [blockedRelationships]);

  const connectionsWithProfiles: ConnectionWithProfile[] = useMemo(() => {
    if (!currentUid) return [];

    return connections
      .filter((connection) => !blockedRelationshipIds.has(connection.id))
      .map((connection) => {
        const otherUid =
          connection.users.find((uid) => uid !== currentUid) || "";
        return {
          ...connection,
          otherUid,
          otherUser: connectionProfiles[otherUid],
        };
      });
  }, [blockedRelationshipIds, connectionProfiles, connections, currentUid]);

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

  const openMessages = (
    connectionId: string,
    otherUid: string,
    options?: { blocked?: boolean; otherName?: string },
  ) => {
    router.push({
      pathname: "/(tabs)/chat/[connectionId]",
      params: {
        connectionId,
        otherUid,
        blocked: options?.blocked ? "1" : "0",
        otherName: options?.otherName ?? "",
      },
    });
  };

  const renderProfileAvatar = (profile?: PublicUserProfile) => {
    const avatarSource = getAvatarImageSource(profile?.avatarId);

    if (profile?.photoURL) {
      return <Image source={{ uri: profile.photoURL }} style={styles.avatar} />;
    }

    if (avatarSource) {
      return <Image source={avatarSource} style={styles.avatar} />;
    }

    return (
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarText}>No Photo</Text>
      </View>
    );
  };

  const renderBlockedAvatar = (relationship: BlockedRelationship) => {
    const avatarSource = getAvatarImageSource(
      relationship.blockedPreview?.avatarId,
    );

    if (relationship.blockedPreview?.photoURL) {
      return (
        <Image
          source={{ uri: relationship.blockedPreview.photoURL }}
          style={styles.avatar}
        />
      );
    }

    if (avatarSource) {
      return <Image source={avatarSource} style={styles.avatar} />;
    }

    return (
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarText}>No Photo</Text>
      </View>
    );
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.page}>
        <View style={styles.brand}>
          <Image
            source={iceMascot}
            style={styles.mascot}
            resizeMode="contain"
            accessible={false}
          />
          <Text style={styles.brandName}>Icebreakers</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Connections
        </Text>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Pending Requests
          </Text>

          {requestsWithProfiles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.subtleText}>
                When someone sends you a connection request, it will appear
                here.
              </Text>
            </View>
          ) : (
            requestsWithProfiles.map((request) => (
              <View key={request.id} style={styles.card}>
                <View style={styles.row}>
                  {renderProfileAvatar(request.fromUser)}

                  <View style={styles.metaBody}>
                    <Text style={styles.nameText}>
                      {request.fromUser?.firstName || request.fromUid}
                    </Text>
                    <Text style={styles.subtleText}>
                      {request.fromUser?.major || "No major listed"}
                    </Text>
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Accept request from ${request.fromUser?.firstName || request.fromUid}`}
                    accessibilityState={{
                      disabled: busyRequestId === request.id,
                      busy: busyRequestId === request.id,
                    }}
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
                    accessibilityRole="button"
                    accessibilityLabel={`Decline request from ${request.fromUser?.firstName || request.fromUid}`}
                    accessibilityState={{
                      disabled: busyRequestId === request.id,
                      busy: busyRequestId === request.id,
                    }}
                    style={[
                      styles.declineButton,
                      busyRequestId === request.id && styles.disabledButton,
                    ]}
                    disabled={busyRequestId === request.id}
                    onPress={() => handleDecline(request.id)}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Connection History
          </Text>

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
                  {renderProfileAvatar(connection.otherUser)}

                  <View style={styles.metaBody}>
                    <Text style={styles.nameText}>
                      {connection.otherUser?.firstName || connection.otherUid}
                    </Text>
                    <Text style={styles.subtleText}>
                      {connection.otherUser?.major || "No major listed"}
                    </Text>
                  </View>
                </View>

                <View style={styles.connectionMeta}>
                  <View style={styles.expiryRow}>
                    <Feather name="clock" size={17} color={colors.muted} />
                    <Text style={styles.expiryText}>
                      {isConnectionActive(connection)
                        ? `Current until ${
                            getConnectionExpiresAt(
                              connection,
                            )?.toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            }) ?? "unknown"
                          }`
                        : `Expired ${
                            getConnectionExpiresAt(connection)?.toLocaleString(
                              [],
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            ) ?? "unknown"
                          }`}
                    </Text>
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${isConnectionActive(connection) ? "Open messages with" : "View read-only messages with"} ${connection.otherUser?.firstName || connection.otherUid}`}
                    style={styles.messageButton}
                    onPress={() =>
                      openMessages(connection.id, connection.otherUid)
                    }
                  >
                    <Feather
                      name="message-circle"
                      size={18}
                      color={colors.surface}
                    />
                    <Text style={styles.buttonText}>
                      {isConnectionActive(connection)
                        ? "Open in Messages"
                        : "View Read-Only Messages"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Blocked Users
          </Text>

          {blockedRelationships.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No blocked users</Text>
              <Text style={styles.subtleText}>
                Users you block will appear here with read-only message history.
              </Text>
            </View>
          ) : (
            blockedRelationships.map((relationship) => {
              const otherUid =
                relationship.users.find((uid) => uid !== currentUid) || "";
              const firstName =
                relationship.blockedPreview?.firstName?.trim() ||
                "Blocked user";

              return (
                <View key={relationship.id} style={styles.card}>
                  <View style={styles.row}>
                    {renderBlockedAvatar(relationship)}

                    <View style={styles.metaBody}>
                      <Text style={styles.nameText}>{firstName}</Text>
                      <Text style={styles.subtleText}>
                        Blocked users cannot view your profile, messages, or
                        connection record.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.connectionMeta}>
                    {relationship.hasMessageHistory ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`View message history with ${firstName}`}
                        style={styles.messageButton}
                        onPress={() =>
                          openMessages(relationship.id, otherUid, {
                            blocked: true,
                            otherName: firstName,
                          })
                        }
                      >
                        <Feather
                          name="message-circle"
                          size={18}
                          color={colors.surface}
                        />
                        <Text style={styles.buttonText}>
                          View message history
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.subtleText}>
                        No saved message history for this user.
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
  },
  page: { width: "100%", maxWidth: 600, alignSelf: "center", gap: 20 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  mascot: { width: 45, height: 48 },
  brandName: { fontFamily: "LexendSemiBold", fontSize: 23, color: colors.ink },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: "LexendSemiBold",
    fontSize: 29,
    lineHeight: 39,
    textAlign: "center",
    color: colors.ink,
  },
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 19,
    lineHeight: 27,
    color: colors.ink,
    paddingHorizontal: 2,
  },
  emptyCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    shadowColor: "#8EAFD0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  emptyTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: 5,
  },
  subtleText: { fontSize: 13, lineHeight: 20, color: colors.muted },
  card: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    gap: 12,
    shadowColor: "#8EAFD0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaBody: { flex: 1, minWidth: 0, gap: 4 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.frost,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.frost,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 10, color: colors.muted, textAlign: "center" },
  nameText: {
    fontFamily: "LexendSemiBold",
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink,
  },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  acceptButton: {
    flex: 1,
    flexBasis: 110,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 12,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    flex: 1,
    flexBasis: 110,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.blue,
    textAlign: "center",
  },
  messageButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.blue,
  },
  connectionMeta: { gap: 12 },
  expiryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  expiryText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.muted },
  disabledButton: { opacity: 0.6 },
  buttonText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.surface,
    textAlign: "center",
  },
});
