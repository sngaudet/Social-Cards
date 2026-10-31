import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";
import {
  ConnectionDoc,
  getConnectionExpiresAt,
  getUserProfile,
  isConnectionActive,
  pruneDeletedAccounts,
  PublicUserProfile,
  subscribeToConnections,
} from "../../src/connections/service";
import { getAvatarImageSource } from "../../src/lib/avatarImages";
import { NavigationService } from "../../src/navigation/NavigationService";
import { iceColors as colors, iceMascot } from "../../src/theme/icebreakers";

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

//helper function to format remaining time until expiration
function formatRemainingTime(expiresAt: Date | null, nowMs: number): string {
  if (!expiresAt) return "";

  const diffMs = expiresAt.getTime() - nowMs;
  if (diffMs <= 0) return "Expired";

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}hr ${minutes}min remaining`;
  }
  return `${minutes}min remaining`;
}

export default function MessagesPage() {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;
  const { width, fontScale } = useWindowDimensions();
  const showBackLabel = width >= 360 && fontScale <= 1.15;
  const [showCurrent, setShowCurrent] = useState(true);
  const [connections, setConnections] = useState<ConnectionDoc[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicUserProfile>>(
    {},
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!currentUid) return;

    pruneDeletedAccounts().catch((error) => {
      console.warn("Failed to prune deleted accounts from messages", error);
    });
  }, [currentUid]);

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
        isConnectionActive(connection, new Date(now)),
      ),
    [connectionsWithProfiles, now],
  );
  const pastConnections = useMemo(
    () =>
      connectionsWithProfiles.filter(
        (connection) => !isConnectionActive(connection, new Date(now)),
      ),
    [connectionsWithProfiles, now],
  );

  // this keeps the remaining-time label fresh without manual refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => NavigationService.goBack("/(tabs)")}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="arrow-left" size={20} color={colors.blue} />
              {showBackLabel ? (
                <Text style={styles.backButtonText}>Back</Text>
              ) : null}
            </TouchableOpacity>
          </View>
          <View style={styles.brand}>
            <Image
              source={iceMascot}
              style={styles.mascot}
              resizeMode="contain"
              accessible={false}
            />
            <Text style={styles.brandName}>Icebreakers</Text>
          </View>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.title}>
            Messages
          </Text>
          <Text style={styles.subtitle}>
            Current connections can chat for 24 hours. Past connections stay
            here as read-only history.
          </Text>
        </View>

        <View style={styles.toggleRow} accessibilityRole="tablist">
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityLabel={"Current (" + currentConnections.length + ")"}
            accessibilityState={{ selected: showCurrent }}
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
            accessibilityRole="tab"
            accessibilityLabel={"Past (" + pastConnections.length + ")"}
            accessibilityState={{ selected: !showCurrent }}
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
            <View style={styles.emptyIcon}>
              <Feather name="message-circle" size={32} color={colors.blue} />
            </View>
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
            const active = isConnectionActive(connection, new Date(now));
            const name = connection.otherUser?.firstName || connection.otherUid;
            const avatarSource = getAvatarImageSource(
              connection.otherUser?.avatarId,
            );

            return (
              <TouchableOpacity
                key={connection.id}
                accessibilityRole="button"
                accessibilityLabel={
                  active
                    ? "Open chat with " + name
                    : "View read-only messages with " + name
                }
                style={styles.threadRow}
                onPress={() => openMessages(connection.id, connection.otherUid)}
              >
                {connection.otherUser?.photoURL ? (
                  <Image
                    source={{ uri: connection.otherUser.photoURL }}
                    style={styles.threadAvatar}
                  />
                ) : avatarSource ? (
                  <Image source={avatarSource} style={styles.threadAvatar} />
                ) : (
                  <View
                    style={[
                      styles.threadAvatar,
                      styles.threadAvatarPlaceholder,
                    ]}
                  >
                    <Feather name="user" size={24} color={colors.muted} />
                  </View>
                )}
                <View style={styles.threadBody}>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.threadTime}>
                    {active ? "Chat expires" : "Expired"}{" "}
                    {formatDateTime(expiresAt)}
                  </Text>
                  <Text
                    style={
                      active ? styles.threadRemaining : styles.threadHistory
                    }
                  >
                    {active
                      ? formatRemainingTime(expiresAt, now)
                      : "Read-only history"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={19} color={colors.muted} />
              </TouchableOpacity>
            );
          })
        )}
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
  page: { width: "100%", maxWidth: 600, alignSelf: "center", gap: 16 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    marginBottom: 4,
  },
  headerSide: { flex: 1, minWidth: 44 },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
    gap: 5,
  },
  backButtonText: { fontSize: 14, fontWeight: "600", color: colors.blue },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
    gap: 7,
  },
  mascot: { width: 38, height: 42 },
  brandName: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: "LexendSemiBold",
    fontSize: 21,
    lineHeight: 29,
    color: colors.ink,
  },
  intro: { gap: 10, paddingHorizontal: 6, marginBottom: 2 },
  title: {
    fontFamily: "LexendSemiBold",
    fontSize: 29,
    lineHeight: 39,
    textAlign: "center",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
  toggleRow: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#DCE9F9",
  },
  toggleButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  toggleButtonActive: { backgroundColor: colors.blue },
  toggleButtonText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    fontWeight: "700",
    textAlign: "center",
  },
  toggleButtonTextActive: { color: colors.surface },
  emptyCard: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.surface,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 12,
    backgroundColor: colors.surface,
    shadowColor: "#8EAFD0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.frost,
    marginBottom: 2,
  },
  emptyTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center",
    color: colors.ink,
  },
  subtleText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: colors.muted,
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  threadAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.frost,
  },
  threadAvatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  threadBody: { flex: 1, minWidth: 0, gap: 4 },
  threadName: {
    fontFamily: "LexendSemiBold",
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink,
  },
  threadTime: { fontSize: 12, lineHeight: 18, color: colors.muted },
  threadRemaining: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.blue,
  },
  threadHistory: { fontSize: 12, lineHeight: 18, color: colors.muted },
});
