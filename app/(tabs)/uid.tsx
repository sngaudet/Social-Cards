import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
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
  useWindowDimensions,
  View,
} from "react-native";

import { db } from "../../firebaseConfig";
import { useAuth } from "../../src/auth/AuthContext";
import { getAvatarImageSource } from "../../src/lib/avatarImages";
import {
  getRelationshipStatusForPair,
  subscribeToConnections,
} from "../../src/connections/service";
import { normalizeHobbies } from "../../src/lib/hobbies";
import { DEFAULT_ICEBREAKER_QUESTIONS } from "../../src/lib/icebreakers";
import { iceColors as colors, iceMascot } from "../../src/theme/icebreakers";
import { calculateAgeFromDateOfBirth } from "../../src/lib/profileFields";
import {
  normalizePreConnectionVisibility,
  PreConnectionVisibility,
} from "../../src/profile/visibility";

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
  const { fontScale } = useWindowDimensions();
  const { user, initializing } = useAuth();
  const params = useLocalSearchParams<{ uid?: string | string[] }>();
  const uid = Array.isArray(params.uid) ? params.uid[0] : params.uid;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<UserDoc | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [profileUnavailable, setProfileUnavailable] = useState(false);
  const currentUid = user?.uid;

  const loadProfile = useCallback(async () => {
    if (!uid) {
      setData(null);
      setProfileUnavailable(false);
      return;
    }

    if (currentUid && currentUid !== uid) {
      const relationshipStatus = await getRelationshipStatusForPair(
        currentUid,
        uid,
      );

      if (
        relationshipStatus === "declined" ||
        relationshipStatus === "blocked"
      ) {
        setData(null);
        setProfileUnavailable(true);
        return;
      }
    }

    const publicProfileRef = doc(db, "publicProfiles", uid);
    const publicProfileSnap = await getDoc(publicProfileRef);
    const shouldLoadPrivateProfile = currentUid === uid;
    const userSnap = shouldLoadPrivateProfile
      ? await getDoc(doc(db, "users", uid))
      : null;

    if (!publicProfileSnap.exists() && !userSnap?.exists()) {
      setData(null);
      setProfileUnavailable(false);
      return;
    }

    const publicProfileData = publicProfileSnap.exists()
      ? (publicProfileSnap.data() as UserDoc)
      : {};
    const userData = userSnap?.exists() ? (userSnap.data() as UserDoc) : {};

    setData({
      ...userData,
      ...publicProfileData,
      avatarId: publicProfileData.avatarId ?? userData.avatarId,
    });
    setProfileUnavailable(false);
  }, [currentUid, uid]);

  useEffect(() => {
    if (!currentUid || !uid || currentUid === uid) {
      setIsConnected(currentUid === uid);
      return;
    }

    const unsub = subscribeToConnections(
      currentUid,
      (connections) => {
        setIsConnected(
          connections.some((connection) => connection.users.includes(uid)),
        );
      },
      (error) => {
        if ((error as any)?.code === "permission-denied") {
          setIsConnected(false);
          return;
        }
        console.warn("Failed to watch profile connections", error);
      },
    );

    return () => {
      unsub();
    };
  }, [currentUid, uid]);

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      setLoading(false);
      setRefreshing(false);
      setData(null);
      setProfileUnavailable(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        await loadProfile();
      } catch (error: any) {
        if (error?.code === "permission-denied") {
          setData(null);
          setProfileUnavailable(true);
        } else if (!cancelled) {
          Alert.alert(
            "Could not load profile",
            error?.message ?? "Unknown error",
          );
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

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadProfile();
    } catch (error: any) {
      if (error?.code === "permission-denied") {
        setData(null);
        setProfileUnavailable(true);
      } else {
        Alert.alert("Refresh failed", error?.message ?? "Unknown error");
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const visibility = normalizePreConnectionVisibility(
    data?.preConnectionVisibility,
  );
  const canSeeAllFields =
    Boolean(currentUid && uid && currentUid === uid) || isConnected;
  const canSeeField = (field: keyof PreConnectionVisibility) =>
    canSeeAllFields || visibility[field];
  const visibleName = [
    data?.firstName,
    canSeeField("lastName") ? data?.lastName : "",
  ]
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
  const ageFromDateOfBirth = calculateAgeFromDateOfBirth(
    data?.dateOfBirth ?? "",
  );
  const hasVisibleDetails =
    hasVisibleBasics || hasVisibleIceBreakers || canSeeField("hobbies");
  const iceBreakers = data
    ? [
        {
          field: "iceBreakerOne" as const,
          question:
            data.iceBreakerOneQuestion?.trim() ||
            DEFAULT_ICEBREAKER_QUESTIONS[0],
          answer: data.iceBreakerOne,
        },
        {
          field: "iceBreakerTwo" as const,
          question:
            data.iceBreakerTwoQuestion?.trim() ||
            DEFAULT_ICEBREAKER_QUESTIONS[1],
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

  const photo = data?.photoURL && showPhoto ? { uri: data.photoURL } : null;
  const profileImage =
    isConnected || currentUid === uid
      ? photo || avatarSource
      : avatarSource || photo;
  const fallbackImageLabel =
    isConnected || currentUid === uid
      ? showPhoto
        ? "No Profile Photo"
        : "Hidden Before Connection"
      : "No Avatar";
  const basicFields = [
    {
      field: "pronouns" as const,
      label: "Pronouns",
      value: pretty(data?.pronouns ?? data?.Gender),
    },
    {
      field: "dateOfBirth" as const,
      label: "Age",
      value: String(ageFromDateOfBirth ?? "-"),
    },
    {
      field: "gradYear" as const,
      label: "Graduation Year",
      value: pretty(data?.gradYear),
    },
    { field: "minor" as const, label: "Minor", value: pretty(data?.minor) },
  ].filter((item) => canSeeField(item.field));
  const hobbies = canSeeField("hobbies") ? normalizeHobbies(data?.hobbies) : [];
  const singleColumn = fontScale > 1.2;

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
        <View style={styles.brand}>
          <Image
            source={iceMascot}
            style={styles.mascot}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>Icebreakers</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          User Profile
        </Text>
        {profileUnavailable ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile unavailable.</Text>
            <Text style={styles.value}>
              You can no longer view this profile.
            </Text>
          </View>
        ) : !data ? (
          <View style={styles.card}>
            <Text style={styles.value}>Profile not found.</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, styles.identityCard]}>
              {profileImage ? (
                <Image
                  accessibilityLabel={
                    (visibleName || "User") + "'s profile image"
                  }
                  source={profileImage}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Feather name="user" size={34} color={colors.muted} />
                  <Text style={styles.placeholderText}>
                    {fallbackImageLabel}
                  </Text>
                </View>
              )}
              <Text style={styles.name}>
                {visibleName || pretty(data.firstName)}
              </Text>
              {canSeeField("major") && (
                <Text style={styles.major}>{pretty(data.major)}</Text>
              )}
            </View>

            {basicFields.length > 0 && (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Basics
                </Text>
                <View style={styles.basicsGrid}>
                  {basicFields.map((item, index) => (
                    <View
                      key={item.field}
                      style={[
                        styles.basicField,
                        singleColumn && styles.basicFieldFull,
                        !singleColumn &&
                          index % 2 === 1 &&
                          styles.basicFieldRight,
                        index >= (singleColumn ? 1 : 2) &&
                          styles.basicFieldDivider,
                      ]}
                    >
                      <Text style={styles.label}>{item.label}</Text>
                      <Text style={styles.value}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {(canSeeField("bio") || canSeeField("hobbies")) && (
              <View style={styles.card}>
                {canSeeField("bio") && (
                  <View style={styles.section}>
                    <Text
                      accessibilityRole="header"
                      style={styles.sectionTitle}
                    >
                      Bio
                    </Text>
                    <Text style={styles.value}>{pretty(data.bio)}</Text>
                  </View>
                )}
                {canSeeField("bio") && canSeeField("hobbies") && (
                  <View style={styles.divider} />
                )}
                {canSeeField("hobbies") && (
                  <View style={styles.section}>
                    <Text
                      accessibilityRole="header"
                      style={styles.sectionTitle}
                    >
                      Hobbies
                    </Text>
                    <View style={styles.hobbies}>
                      {hobbies.length ? (
                        hobbies.map((hobby, index) => (
                          <View key={index} style={styles.hobby}>
                            <Text style={styles.hobbyText}>{hobby}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.value}>-</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}

            {hasVisibleIceBreakers && (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Ice Breakers
                </Text>
                {iceBreakers.map((item) =>
                  canSeeField(item.field) ? (
                    <View key={item.field} style={styles.icebreaker}>
                      {(item.field !== "iceBreakerOne" ||
                        canSeeField("iceBreakerOneQuestion")) && (
                        <Text style={styles.question}>{item.question}</Text>
                      )}
                      <Text style={styles.value}>{pretty(item.answer)}</Text>
                    </View>
                  ) : null,
                )}
              </View>
            )}

            {!canSeeAllFields && !hasVisibleDetails && (
              <View style={styles.card}>
                <Text style={styles.hiddenText}>
                  This user hides the rest of their profile until you connect.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24 },
  page: { width: "100%", maxWidth: 600, alignSelf: "center", gap: 14 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
    gap: 10,
  },
  loadingText: { fontSize: 14, lineHeight: 21, color: colors.muted },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  mascot: { width: 45, height: 48 },
  brandName: { fontFamily: "LexendSemiBold", fontSize: 23, color: colors.ink },
  title: {
    fontFamily: "LexendSemiBold",
    fontSize: 29,
    lineHeight: 39,
    textAlign: "center",
    color: colors.ink,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.surface,
    shadowColor: "#8EAFD0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  identityCard: { alignItems: "center", gap: 8, paddingVertical: 20 },
  profileImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.frost,
  },
  placeholderImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.frost,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
  },
  placeholderText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    color: colors.muted,
  },
  name: {
    fontFamily: "LexendSemiBold",
    fontSize: 22,
    lineHeight: 30,
    textAlign: "center",
    color: colors.ink,
    alignSelf: "stretch",
  },
  major: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: colors.muted,
    alignSelf: "stretch",
  },
  sectionTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 19,
    lineHeight: 27,
    color: colors.ink,
  },
  basicsGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  basicField: {
    flexBasis: "50%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingRight: 12,
    gap: 5,
  },
  basicFieldFull: { flexBasis: "100%" },
  basicFieldRight: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 14,
    paddingRight: 0,
  },
  basicFieldDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  label: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.muted,
  },
  value: { fontSize: 15, lineHeight: 22, color: colors.ink },
  section: { gap: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  hobbies: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hobby: {
    maxWidth: "100%",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#E3F0FF",
  },
  hobbyText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    color: colors.ink,
  },
  icebreaker: {
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    gap: 7,
    backgroundColor: colors.frost,
  },
  question: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.muted,
  },
  hiddenText: { fontSize: 14, lineHeight: 21, color: colors.muted },
});
