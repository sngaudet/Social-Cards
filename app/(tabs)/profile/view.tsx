import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";

type UserDoc = {
  email?: string;
  firstName?: string;
  lastName?: string;
  Gender?: string;
  age?: number | string;
  gradYear?: number | string;
  major?: string;
  iceBreakerOne?: string;
  iceBreakerTwo?: string;
  iceBreakerThree?: string;
  hobbies?: string;
  createdAt?: any; // Firestore Timestamp (or serverTimestamp placeholder)
};

const pretty = (v: unknown) => {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v.trim() ? v : "-";
  return String(v);
};

export default function ViewProfile() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<UserDoc | null>(null);

  const loadProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      setData(null);
      return;
    }

    setData(snap.data() as UserDoc);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      try {
        setLoading(true);
        await loadProfile();
      } catch (e: any) {
        Alert.alert("Could not load profile", e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [router, loadProfile]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadProfile();
    } catch (e: any) {
      Alert.alert("Refresh failed", e?.message ?? "Unknown error");
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading profile…</Text>
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
      <Text style={styles.title}>Your Profile</Text>

      {!data ? (
        <View style={styles.card}>
          <Text style={styles.value}>
            No profile document found for your account yet.
          </Text>
          <Text style={[styles.value, { marginTop: 8 }]}>
            (This usually means signup didn’t finish writing to Firestore.)
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{pretty(data.email)}</Text>

          <Text style={styles.label}>Created</Text>
          <Text style={styles.value}>
            {data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleString()
              : "-"}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Basics</Text>

          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>
            {pretty(data.firstName)} {pretty(data.lastName)}
          </Text>

          <Text style={styles.label}>Gender</Text>
          <Text style={styles.value}>{pretty(data.Gender)}</Text>

          <Text style={styles.label}>Age</Text>
          <Text style={styles.value}>{pretty(data.age)}</Text>

          <Text style={styles.label}>Graduation Year</Text>
          <Text style={styles.value}>{pretty(data.gradYear)}</Text>

          <Text style={styles.label}>Major</Text>
          <Text style={styles.value}>{pretty(data.major)}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Ice Breakers</Text>

          <Text style={styles.label}>Ideal weekend</Text>
          <Text style={styles.value}>{pretty(data.iceBreakerOne)}</Text>

          <Text style={styles.label}>Food you can’t say no to</Text>
          <Text style={styles.value}>{pretty(data.iceBreakerTwo)}</Text>

          <Text style={styles.label}>Fun fact</Text>
          <Text style={styles.value}>{pretty(data.iceBreakerThree)}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Hobbies</Text>

          <Text style={styles.label}>Hobbies</Text>
          <Text style={styles.value}>{pretty(data.hobbies)}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },

  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 6,
  },

  label: { fontSize: 12, color: "#666" },
  value: { fontSize: 16, marginBottom: 8 },

  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 10,
  },
});
