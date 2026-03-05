import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { auth, db } from "../../../firebaseConfig";

type UserDoc = {
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
  photoURL?: string;
};

const pretty = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() ? value : "-";
  return String(value);
};

export default function UserProfileView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uid?: string | string[] }>();
  const uid = Array.isArray(params.uid) ? params.uid[0] : params.uid;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<UserDoc | null>(null);

  const loadProfile = useCallback(async () => {
    if (!uid) {
      setData(null);
      return;
    }

    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      setData(null);
      return;
    }

    setData(snap.data() as UserDoc);
  }, [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      try {
        setLoading(true);
        await loadProfile();
      } catch (error: any) {
        Alert.alert("Could not load profile", error?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [loadProfile, router]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadProfile();
    } catch (error: any) {
      Alert.alert("Refresh failed", error?.message ?? "Unknown error");
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading profile...</Text>
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
      <Text style={styles.title}>User Profile</Text>

      {data?.photoURL ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: data.photoURL }} style={styles.profileImage} />
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No Profile Photo</Text>
          </View>
        </View>
      )}

      {!data ? (
        <View style={styles.card}>
          <Text style={styles.value}>Profile not found.</Text>
        </View>
      ) : (
        <View style={styles.card}>
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

          <Text style={styles.label}>Food you cannot say no to</Text>
          <Text style={styles.value}>{pretty(data.iceBreakerTwo)}</Text>

          <Text style={styles.label}>Fun fact</Text>
          <Text style={styles.value}>{pretty(data.iceBreakerThree)}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Hobbies</Text>
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
  loadingText: { marginTop: 10 },

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

  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },

  profileImage: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  placeholderImage: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },

  placeholderText: {
    color: "#999",
  },
});
