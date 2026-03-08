import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { sendConnectionRequest } from "../../src/connections/service";
import { formatHobbies } from "../../src/lib/hobbies";
import { showAlert } from "../../src/lib/showAlert";
import {
  fetchNearbyUsers,
  NearbyResponse,
  sendForegroundPing,
} from "../../src/location/service";

const emptyNearby: NearbyResponse = {
  users: [],
  crowdCount: 0,
  asOf: new Date().toISOString(),
};

const AUTO_REFRESH_MS = 5000;
const AUTO_PING_MS = 30000;
const MAX_PING_WAIT_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function HomeTab() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearby, setNearby] = useState<NearbyResponse>(emptyNearby);
  const periodicRefreshBusyRef = useRef(false);
  const lastPingAtRef = useRef(0);

  const handleConnect = useCallback(async (toUid: string) => {
    try {
      await sendConnectionRequest(toUid);
      showAlert("Success", "Connection request sent.");
    } catch (e: any) {
      const code = e?.code ? ` (${e.code})` : "";
      showAlert(
        "Could not send request",
        `${e?.message ?? "Unknown error"}${code}`,
      );
    }
  }, []);

  const loadNearby = useCallback(
    async (options?: { includePing?: boolean }) => {
      const includePing = options?.includePing !== false;

      if (includePing) {
        lastPingAtRef.current = Date.now();

        const pingPromise = sendForegroundPing().catch((e) => {
          console.warn("Foreground ping failed", e);
        });

        await Promise.race([pingPromise, sleep(MAX_PING_WAIT_MS)]);
      }

      const response = await fetchNearbyUsers(300);
      setNearby(response);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadNearby();
      } catch (e: any) {
        if (!cancelled) {
          Alert.alert(
            "Could not load nearby users",
            e?.message ?? "Unknown error",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [loadNearby]);

  useFocusEffect(
    useCallback(() => {
      loadNearby().catch((e: any) => {
        console.warn(
          "Could not refresh nearby users",
          e?.message ?? "Unknown error",
        );
      });
    }, [loadNearby]),
  );

  useFocusEffect(
    useCallback(() => {
      const intervalId = setInterval(() => {
        if (periodicRefreshBusyRef.current) return;
        periodicRefreshBusyRef.current = true;

        const shouldPing = Date.now() - lastPingAtRef.current >= AUTO_PING_MS;

        loadNearby({ includePing: shouldPing })
          .catch((e) => {
            console.warn("Periodic nearby refresh failed", e);
          })
          .finally(() => {
            periodicRefreshBusyRef.current = false;
          });
      }, AUTO_REFRESH_MS);

      return () => {
        clearInterval(intervalId);
        periodicRefreshBusyRef.current = false;
      };
    }, [loadNearby]),
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadNearby();
    } catch (e: any) {
      Alert.alert("Refresh failed", e?.message ?? "Unknown error");
    } finally {
      setRefreshing(false);
    }
  }, [loadNearby]);

  const openUserProfile = useCallback(
    (uid: string) => {
      router.push({ pathname: "/(tabs)/user/[uid]", params: { uid } });
    },
    [router],
  );

  if (loading) {
    return <View style={styles.scroll} />;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Nearby Icebreakers</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>
          Within 300 ft: {nearby.crowdCount}
        </Text>
        <Text style={styles.subtleText}>
          Updated: {new Date(nearby.asOf).toLocaleTimeString()}
        </Text>
      </View>

      {nearby.users.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No one nearby right now</Text>
          <Text style={styles.subtleText}>
            Keep location sharing on and pull to refresh.
          </Text>
        </View>
      ) : (
        nearby.users.map((user) => (
          <View key={user.uid} style={styles.userCard}>
            <View style={styles.userHeader}>
              {user.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>No Photo</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {user.firstName || "Unknown"}
                </Text>
                <Text style={styles.subtleText}>
                  {user.major || "Undeclared"}
                </Text>
                <Text style={styles.distanceText}>
                  {user.distanceFt} ft away
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Hobbies</Text>
            <Text style={styles.value}>{formatHobbies(user.hobbies)}</Text>

            <Text style={styles.label}>Icebreaker prompts</Text>
            <Text style={styles.value}>- {user.iceBreakerOne || "-"}</Text>
            <Text style={styles.value}>- {user.iceBreakerTwo || "-"}</Text>
            <Text style={styles.value}>- {user.iceBreakerThree || "-"}</Text>

            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={() => openUserProfile(user.uid)}
            >
              <Text style={styles.viewProfileButtonText}>View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => handleConnect(user.uid)}
            >
              <Text style={styles.viewProfileButtonText}>Connect</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 48, gap: 12 },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },

  summaryCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#eff6ff",
    gap: 4,
  },

  summaryText: {
    fontSize: 15,
    fontWeight: "600",
  },

  subtleText: {
    fontSize: 12,
    color: "#666",
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },

  userCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
  },

  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e5e7eb",
  },

  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 10,
    color: "#666",
  },

  userName: {
    fontSize: 18,
    fontWeight: "700",
  },

  distanceText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#1d4ed8",
  },

  label: {
    fontSize: 12,
    color: "#666",
    marginTop: 6,
  },

  value: {
    fontSize: 14,
    marginTop: 2,
  },

  secondaryButton: {
    marginTop: 8,
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  viewProfileButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#fac104",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },

  connectButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#2452ce",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },

  viewProfileButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
