import { useFocusEffect, useRouter } from "expo-router";
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
import { getAvatarImageSource } from "../../../src/lib/avatarImages";
import { formatHobbies } from "../../../src/lib/hobbies";
import { formatDateOfBirth } from "../../../src/lib/profileFields";

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
  iceBreakerTwo?: string;
  iceBreakerThree?: string;
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

  useFocusEffect(
    useCallback(() => {
      // Runs every time this tab/screen becomes active
      loadProfile().catch((e: any) =>
        Alert.alert("Could not load profile", e?.message ?? "Unknown error"),
      );
    }, [loadProfile]),
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

      {data?.photoURL ? (
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
            <Text style={{ color: "#999" }}>No Profile Photo</Text>
          </View>
        </View>
      )}

      {!data ? (
        <View style={styles.userCard}>
          <Text style={styles.metaValue}>
            No profile document found for your account yet.
          </Text>
          <Text style={[styles.metaValue, { marginTop: 8 }]}>
            (This usually means signup didn’t finish writing to Firestore.)
          </Text>
        </View>
      ) : (
        <View style={styles.userCard}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Text style={styles.metaLabel}>Email</Text>
          <Text style={styles.metaValue}>{pretty(data.email)}</Text>

          <Text style={styles.metaLabel}>Created</Text>
          <Text style={styles.metaValue}>
            {data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleString()
              : "-"}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Basics</Text>

          <Text style={styles.metaLabel}>Name</Text>
          <Text style={styles.metaValue}>
            {pretty(data.firstName)} {pretty(data.lastName)}
          </Text>

          <Text style={styles.metaLabel}>Date of Birth</Text>
          <Text style={styles.metaValue}>{formatDateOfBirth(data.dateOfBirth ?? "")}</Text>

          <Text style={styles.metaLabel}>Pronouns</Text>
          <Text style={styles.metaValue}>{pretty(data.pronouns ?? data.Gender)}</Text>

          <Text style={styles.metaLabel}>Graduation Year</Text>
          <Text style={styles.metaValue}>{pretty(data.gradYear)}</Text>

          <Text style={styles.metaLabel}>Major</Text>
          <Text style={styles.metaValue}>{pretty(data.major)}</Text>

          <Text style={styles.metaLabel}>Minor</Text>
          <Text style={styles.metaValue}>{pretty(data.minor)}</Text>

          <Text style={styles.metaLabel}>Bio</Text>
          <Text style={styles.metaValue}>{pretty(data.bio)}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Ice Breakers</Text>

          <Text style={styles.metaLabel}>Ideal weekend</Text>
          <Text style={styles.metaValue}>{pretty(data.iceBreakerOne)}</Text>

          <Text style={styles.metaLabel}>Food you can’t say no to</Text>
          <Text style={styles.metaValue}>{pretty(data.iceBreakerTwo)}</Text>

          <Text style={styles.metaLabel}>Fun fact</Text>
          <Text style={styles.metaValue}>{pretty(data.iceBreakerThree)}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Hobbies</Text>

          <Text style={styles.metaLabel}>Hobbies</Text>
          <Text style={styles.metaValue}>{formatHobbies(data.hobbies)}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // scroll: { flex: 1 },
  // content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // title: {
  //   fontSize: 28,
  //   fontWeight: "700",
  //   marginBottom: 16,
  //   textAlign: "center",
  // },

  // card: {
  //   borderWidth: 1,
  //   borderColor: "#ddd",
  //   borderRadius: 12,
  //   padding: 16,
  //   gap: 6,
  // },

  // sectionTitle: {
  //   fontSize: 16,
  //   fontWeight: "700",
  //   marginTop: 6,
  //   marginBottom: 6,
  // },

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
  //////////
  //////////
  //////////
  //////////
  //////////

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#D9E0F0",
    padding: 24,
  },
  // content: {
  //   padding: 24,
  //   paddingBottom: 48,
  //   backgroundColor: "#D9E0F0",
  //   gap: 20,
  // },
  // title: {
  //   fontSize: 34,
  //   fontWeight: "700",
  //   textAlign: "center",
  //   marginTop: 8,
  // },
  title: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    color: "#101828",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  // emptyCard: {
  //   backgroundColor: "#fff",
  //   borderRadius: 12,
  //   padding: 16,
  //   borderWidth: 1,
  //   borderColor: "#ddd",
  // },
  // emptyTitle: {
  //   fontSize: 16,
  //   fontWeight: "700",
  //   marginBottom: 4,
  // },
  // subtleText: {
  //   fontSize: 13,
  //   color: "#666",
  // },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  // avatar: {
  //   width: 58,
  //   height: 58,
  //   borderRadius: 29,
  //   backgroundColor: "#e5e7eb",
  // },
  // avatarPlaceholder: {
  //   width: 58,
  //   height: 58,
  //   borderRadius: 29,
  //   backgroundColor: "#f0f0f0",
  //   alignItems: "center",
  //   justifyContent: "center",
  // },
  // avatarText: {
  //   fontSize: 10,
  //   color: "#666",
  //   textAlign: "center",
  // },
  nameText: {
    fontSize: 18,
    fontWeight: "700",
  },
  uidText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 800,
    color: "#888",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  acceptButton: {
    backgroundColor: "#2452ce",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  declineButton: {
    backgroundColor: "#888",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  messageButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2452ce",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  connectionMeta: {
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  ///////////
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////

  scroll: { flex: 1, backgroundColor: "#dfe7f6" },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  reportModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  reportBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  reportModalCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#fffdfb",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  reportModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  reportModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
  },
  reportFieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#374151",
    letterSpacing: 0.4,
  },
  reportReasonInput: {
    borderWidth: 1,
    borderColor: "#F3D1D1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFF7F7",
  },
  reportReasonPickerWrap: {
    borderWidth: 1,
    borderColor: "#F3D1D1",
    borderRadius: 14,
    backgroundColor: "#FFF7F7",
    overflow: "hidden",
  },
  reportReasonPicker: {
    color: "#111827",
  },
  reportDetailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reportCharacterCount: {
    fontSize: 12,
    color: "#6B7280",
  },
  reportDetailsInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#F3D1D1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#111827",
    backgroundColor: "#FFF7F7",
  },
  reportActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  reportCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  reportCancelButtonText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
  },
  reportSubmitButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#B91C1C",
  },
  reportSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  // title: {
  //   fontSize: 30,
  //   fontWeight: "800",
  //   textAlign: "center",
  //   color: "#101828",
  // },

  summaryCard: {
    borderWidth: 1,
    borderColor: "#d8e2f2",
    borderRadius: 24,
    padding: 14,
    backgroundColor: "#f9fbff",
    gap: 4,
    shadowColor: "#9aa7c7",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
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
    borderColor: "#e7edf9",
    borderRadius: 28,
    padding: 16,
    backgroundColor: "#fffdfb",
    shadowColor: "#b8c2d9",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },

  userHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },

  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#edf1fa",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },

  avatarText: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
  },
  avatarDebugText: {
    marginTop: 6,
    fontSize: 9,
    color: "#666",
    textAlign: "center",
  },

  userBody: {
    flex: 1,
    gap: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f4aaa",
    letterSpacing: 0.4,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },

  distancePill: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: "#1d4ed8",
    backgroundColor: "#eef4ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    minWidth: 72,
  },
  metaLabel: {
    fontSize: 15,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#303b52",
    letterSpacing: 0.5,
    paddingTop: 5,
    marginTop: 20,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
  },
  hobbiesBlock: {
    gap: 6,
  },
  hobbyWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  hobbyChip: {
    fontSize: 10,
    fontWeight: "800",
    color: "#263248",
    backgroundColor: "#f6efe1",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  promptBlock: {
    backgroundColor: "#f8f9fe",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  promptLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#5b6478",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  promptValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#161b26",
    textAlign: "center",
  },
  promptSubValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 4,
  },
  footerInfo: {
    flex: 1,
    gap: 2,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#404a60",
    letterSpacing: 0.5,
  },
  footerValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#161b26",
  },
  hiddenText: {
    fontSize: 12,
    color: "#666",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  viewPillButton: {
    backgroundColor: "#ffd45f",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  connectPillButton: {
    backgroundColor: "#7db1ff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  reportPillButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  connectedPill: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  disabledPillButton: {
    opacity: 0.65,
  },
  viewPillButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  reportPillButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  connectedPillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  connectPillButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
});
