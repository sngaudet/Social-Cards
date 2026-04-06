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
  ConnectionDoc,
  getConnectionExpiresAt,
  getUserProfile,
  isConnectionActive,
  PublicUserProfile,
  subscribeToConnections,
} from "../../src/connections/service";
import { getAvatarImageSource } from "../../src/lib/avatarImages";

type InboxConnection = ConnectionDoc & {
  otherUid: string;
  otherUser?: PublicUserProfile;
};

function formatDateTime(value: Date | null): string {
  if (!value) return "Unknown";
  return value.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MessagesPage() {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;
  const [showCurrent, setShowCurrent] = useState(true);
  const [connections, setConnections] = useState<ConnectionDoc[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicUserProfile>>(
    {},
  );

  useEffect(() => {
    if (!currentUid) return;
    return subscribeToConnections(currentUid, setConnections, (error) => {
      if ((error as any)?.code === "permission-denied") {
        setConnections([]);
        return;
      }
      console.warn("Failed to watch message connections", error);
    });
  }, [currentUid]);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      if (!currentUid) return;

      const otherUids = Array.from(
        new Set(
          connections.map(
            (connection) =>
              connection.users.find((uid) => uid !== currentUid) ?? "",
          ),
        ),
      ).filter(Boolean);

      const entries = await Promise.all(
        otherUids.map(async (uid) => [uid, await getUserProfile(uid)] as const),
      );

      if (!cancelled) {
        setProfiles(Object.fromEntries(entries));
      }
    };

    loadProfiles().catch((error) => {
      console.warn("Failed to load message profiles", error);
    });

    return () => {
      cancelled = true;
    };
  }, [connections, currentUid]);

  const connectionsWithProfiles = useMemo<InboxConnection[]>(() => {
    if (!currentUid) return [];

    return connections
      .map((connection) => {
        const otherUid =
          connection.users.find((uid) => uid !== currentUid) ?? "";
        return {
          ...connection,
          otherUid,
          otherUser: profiles[otherUid],
        };
      })
      .filter((connection) => Boolean(connection.otherUid))
      .sort((a, b) => {
        const aExpiresAt = getConnectionExpiresAt(a)?.getTime() ?? 0;
        const bExpiresAt = getConnectionExpiresAt(b)?.getTime() ?? 0;
        return bExpiresAt - aExpiresAt;
      });
  }, [connections, currentUid, profiles]);

  const currentConnections = useMemo(
    () =>
      connectionsWithProfiles.filter((connection) =>
        isConnectionActive(connection),
      ),
    [connectionsWithProfiles],
  );
  const pastConnections = useMemo(
    () =>
      connectionsWithProfiles.filter(
        (connection) => !isConnectionActive(connection),
      ),
    [connectionsWithProfiles],
  );

  const visibleConnections = showCurrent ? currentConnections : pastConnections;

  if (!currentUid) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtleText}>You must be logged in.</Text>
      </View>
    );
  }

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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>
        Current connections can chat for 24 hours. Past connections stay here as
        read-only history.
      </Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            showCurrent && styles.toggleButtonActive,
          ]}
          onPress={() => setShowCurrent(true)}
        >
          <Text
            style={[
              styles.toggleButtonText,
              showCurrent && styles.toggleButtonTextActive,
            ]}
          >
            Current ({currentConnections.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            !showCurrent && styles.toggleButtonActive,
          ]}
          onPress={() => setShowCurrent(false)}
        >
          <Text
            style={[
              styles.toggleButtonText,
              !showCurrent && styles.toggleButtonTextActive,
            ]}
          >
            Past ({pastConnections.length})
          </Text>
        </TouchableOpacity>
      </View>

      {visibleConnections.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {showCurrent ? "No current connections" : "No past connections"}
          </Text>
          <Text style={styles.subtleText}>
            {showCurrent
              ? "When you accept a connection, it will appear here until the chat window expires."
              : "Expired connections will stay here so you can remember who you met."}
          </Text>
        </View>
      ) : (
        visibleConnections.map((connection) => {
          const expiresAt = getConnectionExpiresAt(connection);
          const active = isConnectionActive(connection);
          const avatarSource = getAvatarImageSource(
            connection.otherUser?.avatarId,
          );

          return (
            <View key={connection.id} style={styles.card}>
              <View style={styles.row}>
                {connection.otherUser?.photoURL ? (
                  <Image
                    source={{ uri: connection.otherUser.photoURL }}
                    style={styles.avatar}
                  />
                ) : avatarSource ? (
                  <Image source={avatarSource} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>No Photo</Text>
                  </View>
                )}

                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.nameText}>
                      {connection.otherUser?.firstName || connection.otherUid}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        active ? styles.activePill : styles.pastPill,
                      ]}
                    >
                      <Text style={styles.statusPillText}>
                        {active ? "Current" : "Past"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.subtleText}>
                    {connection.otherUser?.major || "No major listed"}
                  </Text>
                  <Text style={styles.uidText}>UID: {connection.otherUid}</Text>
                  <Text style={styles.timeText}>
                    {active
                      ? `Chat expires ${formatDateTime(expiresAt)}`
                      : `Connection expired ${formatDateTime(expiresAt)}`}
                  </Text>
                </View>
              </View>

              {active ? (
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() =>
                    openMessages(connection.id, connection.otherUid)
                  }
                >
                  <Text style={styles.primaryButtonText}>Open Chat</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() =>
                    openMessages(connection.id, connection.otherUid)
                  }
                >
                  <Text style={styles.buttonText}>View Read-Only Messages</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
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
    gap: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#556070",
    textAlign: "center",
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#b7c4d9",
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#2452ce",
  },
  toggleButtonText: {
    color: "#20304d",
    fontWeight: "700",
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    gap: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#d6dce8",
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
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  nameText: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  subtleText: {
    fontSize: 13,
    color: "#666",
  },
  uidText: {
    fontSize: 12,
    color: "#7a8290",
  },
  timeText: {
    fontSize: 12,
    color: "#2452ce",
    marginTop: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activePill: {
    backgroundColor: "#dcfce7",
  },
  pastPill: {
    backgroundColor: "#e5e7eb",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#243042",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabledButton: {
    alignSelf: "flex-start",
    backgroundColor: "#d5d9e2",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  disabledButtonText: {
    color: "#596273",
    fontWeight: "700",
  },
  messageButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2452ce",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
