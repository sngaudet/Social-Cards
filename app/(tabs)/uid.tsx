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

import { auth, db } from "../../firebaseConfig";
import { getAvatarImageSource } from "../../src/lib/avatarImages";
import { subscribeToConnections } from "../../src/connections/service";
import { formatHobbies } from "../../src/lib/hobbies";
import { calculateAgeFromDateOfBirth } from "../../src/lib/profileFields";
import {
  normalizePreConnectionVisibility,
  PreConnectionVisibility,
} from "../../src/profile/visibility";

const DEFAULT_ICEBREAKER_QUESTIONS = [
  "What's your ideal weekend?",
  "What food can you never say no to?",
  "Share one fun fact about yourself",
];

type UserDoc = {
  firstName?: string;
  lastName?: string;
  Gender?: string;
  dateOfBirth?: string;
  bio?: string;
  pronouns?: string;
  gradYear?: number | string;
  major?: string;
  minor?: string;
  iceBreakerOne?: string;
  iceBreakerOneQuestion?: string;
  iceBreakerTwo?: string;
  iceBreakerTwoQuestion?: string;
  iceBreakerThree?: string;
  iceBreakerThreeQuestion?: string;
  hobbies?: string[] | string;
  avatarId?: string;
  photoURL?: string;
  preConnectionVisibility?: PreConnectionVisibility;
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
  const [isConnected, setIsConnected] = useState(false);
  const currentUid = auth.currentUser?.uid;

  const loadProfile = useCallback(async () => {
    if (!uid) {
      setData(null);
      return;
    }

    const publicProfileRef = doc(db, "publicProfiles", uid);
    const userRef = doc(db, "users", uid);
    const [publicProfileSnap, userSnap] = await Promise.all([
      getDoc(publicProfileRef),
      getDoc(userRef),
    ]);

    if (!publicProfileSnap.exists() && !userSnap.exists()) {
      setData(null);
      return;
    }

    const publicProfileData = publicProfileSnap.exists()
      ? (publicProfileSnap.data() as UserDoc)
      : {};
    const userData = userSnap.exists() ? (userSnap.data() as UserDoc) : {};

    setData({
      ...userData,
      ...publicProfileData,
      avatarId: publicProfileData.avatarId ?? userData.avatarId,
    });
  }, [uid]);

  useEffect(() => {
    if (!currentUid || !uid || currentUid === uid) {
      setIsConnected(currentUid === uid);
      return;
    }

    const unsub = subscribeToConnections(currentUid, (connections) => {
      setIsConnected(
        connections.some((connection) => connection.users.includes(uid)),
      );
    });

    return () => {
      unsub();
    };
  }, [currentUid, uid]);

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
        Alert.alert(
          "Could not load profile",
          error?.message ?? "Unknown error",
        );
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

  const visibility = normalizePreConnectionVisibility(
    data?.preConnectionVisibility,
  );
  const canSeeAllFields = Boolean(currentUid && uid && currentUid === uid) || isConnected;
  const canSeeField = (field: keyof PreConnectionVisibility) =>
    canSeeAllFields || visibility[field];
  const visibleName = [data?.firstName, canSeeField("lastName") ? data?.lastName : ""]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .trim();
  const hasVisibleBasics =
    canSeeField("pronouns") ||
    canSeeField("dateOfBirth") ||
    canSeeField("gradYear") ||
    canSeeField("major") ||
    canSeeField("minor") ||
    canSeeField("bio");
  const hasVisibleIceBreakers =
    canSeeField("iceBreakerOne") ||
    canSeeField("iceBreakerTwo") ||
    canSeeField("iceBreakerThree");
  const avatarSource = getAvatarImageSource(data?.avatarId);
  const showPhoto = canSeeField("photoURL");
  const ageFromDateOfBirth = calculateAgeFromDateOfBirth(data?.dateOfBirth ?? "");
  const hasVisibleDetails = hasVisibleBasics || hasVisibleIceBreakers || canSeeField("hobbies");
  const iceBreakers = data
    ? [
        {
          field: "iceBreakerOne" as const,
          question:
            data.iceBreakerOneQuestion?.trim() || DEFAULT_ICEBREAKER_QUESTIONS[0],
          answer: data.iceBreakerOne,
        },
        {
          field: "iceBreakerTwo" as const,
          question:
            data.iceBreakerTwoQuestion?.trim() || DEFAULT_ICEBREAKER_QUESTIONS[1],
          answer: data.iceBreakerTwo,
        },
        {
          field: "iceBreakerThree" as const,
          question:
            data.iceBreakerThreeQuestion?.trim() ||
            DEFAULT_ICEBREAKER_QUESTIONS[2],
          answer: data.iceBreakerThree,
        },
      ]
    : [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>User Profile</Text>

      {isConnected || currentUid === uid ? (
        data?.photoURL && showPhoto ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: data.photoURL }} style={styles.profileImage} />
          </View>
        ) : avatarSource ? (
          <View style={styles.imageContainer}>
            <Image source={avatarSource} style={styles.profileImage} />
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>
                {showPhoto ? "No Profile Photo" : "Hidden Before Connection"}
              </Text>
            </View>
          </View>
        )
      ) : avatarSource ? (
        <View style={styles.imageContainer}>
          <Image source={avatarSource} style={styles.profileImage} />
        </View>
      ) : data?.photoURL && showPhoto ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: data.photoURL }} style={styles.profileImage} />
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>
              No Avatar
            </Text>
            {__DEV__ ? (
              <Text style={styles.debugText}>
                avatarId: {data?.avatarId?.trim() || "missing"}
              </Text>
            ) : null}
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
          <Text style={styles.value}>{visibleName || pretty(data.firstName)}</Text>

          {hasVisibleBasics ? (
            <>
              {canSeeField("pronouns") ? (
                <>
                  <Text style={styles.label}>Pronouns</Text>
                  <Text style={styles.value}>{pretty(data.pronouns ?? data.Gender)}</Text>
                </>
              ) : null}

              {canSeeField("dateOfBirth") ? (
                <>
                  <Text style={styles.label}>Age</Text>
                  <Text style={styles.value}>{ageFromDateOfBirth ?? "-"}</Text>
                </>
              ) : null}

              {canSeeField("gradYear") ? (
                <>
                  <Text style={styles.label}>Graduation Year</Text>
                  <Text style={styles.value}>{pretty(data.gradYear)}</Text>
                </>
              ) : null}

              {canSeeField("major") ? (
                <>
                  <Text style={styles.label}>Major</Text>
                  <Text style={styles.value}>{pretty(data.major)}</Text>
                </>
              ) : null}

              {canSeeField("minor") ? (
                <>
                  <Text style={styles.label}>Minor</Text>
                  <Text style={styles.value}>{pretty(data.minor)}</Text>
                </>
              ) : null}

              {canSeeField("bio") ? (
                <>
                  <Text style={styles.label}>Bio</Text>
                  <Text style={styles.value}>{pretty(data.bio)}</Text>
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.value}>This user hides their basic details before connection.</Text>
          )}

          {hasVisibleIceBreakers || canSeeField("hobbies") ? (
            <View style={styles.divider} />
          ) : null}

          {hasVisibleIceBreakers ? (
            <>
              <Text style={styles.sectionTitle}>Ice Breakers</Text>

              {iceBreakers.map((iceBreaker) =>
                canSeeField(iceBreaker.field) ? (
                  <React.Fragment key={iceBreaker.field}>
                    <Text style={styles.label}>{iceBreaker.question}</Text>
                    <Text style={styles.value}>{pretty(iceBreaker.answer)}</Text>
                  </React.Fragment>
                ) : null,
              )}
            </>
          ) : null}

          {hasVisibleIceBreakers && canSeeField("hobbies") ? (
            <View style={styles.divider} />
          ) : null}

          {canSeeField("hobbies") ? (
            <>
              <Text style={styles.sectionTitle}>Hobbies</Text>
              <Text style={styles.value}>{formatHobbies(data.hobbies)}</Text>
            </>
          ) : null}

          {!canSeeAllFields && !hasVisibleDetails ? (
            <Text style={styles.value}>
              This user hides the rest of their profile until you connect.
            </Text>
          ) : null}
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
  debugText: {
    marginTop: 8,
    fontSize: 11,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
