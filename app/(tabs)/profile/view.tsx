import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
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
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../../src/auth/AuthContext";
import { getAvatarImageSource } from "../../../src/lib/avatarImages";
import { normalizeHobbies } from "../../../src/lib/hobbies";
import { DEFAULT_ICEBREAKER_QUESTIONS } from "../../../src/lib/icebreakers";
import { formatDateOfBirth } from "../../../src/lib/profileFields";
import { iceColors as colors } from "../../../src/theme/icebreakers";

type UserDoc = {
  email?: string;
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
  createdAt?: any; // Firestore Timestamp (or serverTimestamp placeholder)
  photoURL?: string;
  photoUrls?: string[];
};

const pretty = (v: unknown) => {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v.trim() ? v : "-";
  return String(v);
};

export default function ViewProfile() {
  const { user, initializing } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<UserDoc | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      setData(null);
      return;
    }

    setData(snap.data() as UserDoc);
  }, [user]);

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      setLoading(false);
      setRefreshing(false);
      setData(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        await loadProfile();
      } catch (e: any) {
        if (!cancelled) {
          Alert.alert("Could not load profile", e?.message ?? "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initializing, loadProfile, user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return undefined;

      // Runs every time this tab/screen becomes active
      loadProfile().catch((e: any) =>
        Alert.alert("Could not load profile", e?.message ?? "Unknown error"),
      );
      return undefined;
    }, [loadProfile, user]),
  );

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

  const avatarSource = getAvatarImageSource(data?.avatarId);
  const iceBreakers = data
    ? [
        {
          question:
            data.iceBreakerOneQuestion?.trim() ||
            DEFAULT_ICEBREAKER_QUESTIONS[0],
          answer: data.iceBreakerOne,
        },
        {
          question:
            data.iceBreakerTwoQuestion?.trim() ||
            DEFAULT_ICEBREAKER_QUESTIONS[1],
          answer: data.iceBreakerTwo,
        },
        {
          question:
            data.iceBreakerThreeQuestion?.trim() ||
            DEFAULT_ICEBREAKER_QUESTIONS[2],
          answer: data.iceBreakerThree,
        },
      ]
    : [];

  const hobbies = normalizeHobbies(data?.hobbies);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.blue}
          colors={[colors.blue]}
        />
      }
    >
      <View style={styles.page}>
        <View style={[styles.card, styles.images]}>
          <View style={styles.imageColumn}>
            <Text style={styles.imageLabel}>Profile Photo</Text>
            {data?.photoURL ? (
              <Image
                accessibilityLabel="Your profile photo"
                source={{ uri: data.photoURL }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Feather name="user" size={36} color="#9AA9BD" />
                <Text style={styles.placeholderText}>No photo</Text>
              </View>
            )}
          </View>
          <View style={styles.imageColumn}>
            <Text style={styles.imageLabel}>Avatar Icon</Text>
            {avatarSource ? (
              <Image
                accessibilityLabel="Your avatar"
                source={avatarSource}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Feather name="user" size={36} color="#9AA9BD" />
                <Text style={styles.placeholderText}>No avatar</Text>
              </View>
            )}
          </View>
        </View>

        {!data ? (
          <View style={styles.card}>
            <Text style={styles.metaValue}>
              Your profile is not available yet.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Account</Text>
              <ProfileField label="Email" value={pretty(data.email)} first />
              <ProfileField
                label="Created"
                value={
                  data.createdAt?.toDate
                    ? data.createdAt.toDate().toLocaleString()
                    : "-"
                }
              />
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Basics</Text>
              <ProfileField
                label="Name"
                value={pretty(
                  [data.firstName, data.lastName].filter(Boolean).join(" "),
                )}
                first
              />
              <ProfileField
                label="Date of Birth"
                value={formatDateOfBirth(data.dateOfBirth ?? "")}
              />
              <ProfileField
                label="Pronouns"
                value={pretty(data.pronouns ?? data.Gender)}
              />
              <ProfileField
                label="Graduation Year"
                value={pretty(data.gradYear)}
              />
              <ProfileField label="Major" value={pretty(data.major)} />
              <ProfileField label="Minor" value={pretty(data.minor)} />
              <ProfileField label="Bio" value={pretty(data.bio)} />
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ice Breakers</Text>
              {iceBreakers.map((item, index) => (
                <View key={index} style={styles.icebreaker}>
                  <Text style={styles.question}>{item.question}</Text>
                  <Text style={styles.metaValue}>{pretty(item.answer)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Hobbies</Text>
              <View style={styles.hobbies}>
                {hobbies.length ? (
                  hobbies.map((hobby, index) => (
                    <View key={index} style={styles.hobby}>
                      <Text style={styles.hobbyText}>{hobby}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.metaValue}>-</Text>
                )}
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function ProfileField({
  label,
  value,
  first = false,
}: {
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.field, !first && styles.fieldDivider]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.muted, fontSize: 14 },
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 14, paddingBottom: 24 },
  page: { width: "100%", maxWidth: 600, alignSelf: "center", gap: 14 },
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: "#8EAFD0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  images: { flexDirection: "row", gap: 14, paddingVertical: 20 },
  imageColumn: { flex: 1, minWidth: 0, alignItems: "center", gap: 12 },
  imageLabel: {
    fontFamily: "LexendSemiBold",
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    textAlign: "center",
  },
  profileImage: {
    width: 112,
    height: 112,
    maxWidth: "100%",
    borderRadius: 56,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.frost,
  },
  placeholderImage: {
    width: 112,
    height: 112,
    maxWidth: "100%",
    borderRadius: 56,
    backgroundColor: "#F2F5F8",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  placeholderText: { fontSize: 12, color: "#7E8DA5" },
  sectionTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 19,
    lineHeight: 27,
    color: colors.ink,
    marginBottom: 2,
  },
  field: { gap: 5, paddingVertical: 13 },
  fieldDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  metaLabel: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.muted,
  },
  metaValue: { fontSize: 15, lineHeight: 22, color: colors.ink },
  icebreaker: {
    backgroundColor: colors.frost,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  question: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: colors.ink,
  },
  hobbies: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  hobby: {
    maxWidth: "100%",
    backgroundColor: colors.frost,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  hobbyText: { fontSize: 13, lineHeight: 19, color: colors.ink },
});
