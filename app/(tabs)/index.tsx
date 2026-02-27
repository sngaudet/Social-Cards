import {
  fetchNearbyUsers,
  NearbyResponse,
  sendForegroundPing,
} from "@/src/location/service";
import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { auth } from "../../firebaseConfig";

const emptyNearby: NearbyResponse = {
  users: [],
  crowdCount: 0,
  asOf: new Date().toISOString(),
};

export default function HomeTab() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearby, setNearby] = useState<NearbyResponse>(emptyNearby);

  const loadNearby = useCallback(async () => {
    await sendForegroundPing();
    const response = await fetchNearbyUsers(50);
    setNearby(response);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      try {
        setLoading(true);
        await loadNearby();
      } catch (e: any) {
        Alert.alert("Could not load nearby users", e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [router, loadNearby]);

  useFocusEffect(
    useCallback(() => {
      loadNearby().catch((e: any) =>
        Alert.alert("Could not refresh nearby users", e?.message ?? "Unknown error"),
      );
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

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading nearby users…</Text>
      </View>
    );
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
        <Text style={styles.summaryText}>Within 50 ft: {nearby.crowdCount}</Text>
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
                <Text style={styles.userName}>{user.firstName || "Unknown"}</Text>
                <Text style={styles.subtleText}>{user.major || "Undeclared"}</Text>
                <Text style={styles.distanceText}>{user.distanceFt} ft away</Text>
              </View>
            </View>

            <Text style={styles.label}>Hobbies</Text>
            <Text style={styles.value}>{user.hobbies || "-"}</Text>

            <Text style={styles.label}>Icebreaker prompts</Text>
            <Text style={styles.value}>• {user.iceBreakerOne || "-"}</Text>
            <Text style={styles.value}>• {user.iceBreakerTwo || "-"}</Text>
            <Text style={styles.value}>• {user.iceBreakerThree || "-"}</Text>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.secondaryButton} onPress={handleLogout}>
        <Text style={styles.secondaryButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 48, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
});
