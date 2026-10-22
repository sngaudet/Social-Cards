import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";
import NearbyProfileCard from "../../src/components/NearbyProfileCard";
import {
  blockUser,
  getRelationshipStatus,
  getUserProfile,
  isConnectionActive,
  PublicUserProfile,
  sendConnectionRequest,
  subscribeToConnections,
} from "../../src/connections/service";
import { showAlert } from "../../src/lib/showAlert";
import {
  fetchNearbyUsers,
  NearbyResponse,
  sendForegroundPing,
} from "../../src/location/service";
import { reportUser } from "../../src/reporting/service";
import { iceColors as colors, iceMascot } from "../../src/theme/icebreakers";

const emptyNearby: NearbyResponse = {
  users: [],
  crowdCount: 0,
  asOf: new Date().toISOString(),
};

const AUTO_REFRESH_MS = 5000;
const AUTO_PING_MS = 30000;
const MAX_PING_WAIT_MS = 1500;
const REPORT_DETAILS_MAX_LENGTH = 1000;
const REPORT_REASON_OPTIONS = [
  "Harassment or bullying",
  "Spam or scam",
  "Inappropriate profile content",
  "Impersonation or fake account",
  "Hate speech or discrimination",
  "Threatening behavior",
  "Other",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function HomeTab() {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;
  const { width: windowWidth } = useWindowDimensions();
  const isNarrowScreen = windowWidth < 360;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearby, setNearby] = useState<NearbyResponse>(emptyNearby);
  const [connectedUids, setConnectedUids] = useState<Set<string>>(new Set());
  const [connectionIdsByUid, setConnectionIdsByUid] = useState<
    Record<string, string>
  >({});
  const [reportingUid, setReportingUid] = useState<string | null>(null);
  const [blockingUid, setBlockingUid] = useState<string | null>(null);
  const [optionsUser, setOptionsUser] = useState<
    NearbyResponse["users"][number] | null
  >(null);
  const [reportModalUser, setReportModalUser] = useState<
    NearbyResponse["users"][number] | null
  >(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [nearbyProfileFallbacks, setNearbyProfileFallbacks] = useState<
    Record<string, PublicUserProfile>
  >({});
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

  const closeReportModal = useCallback(() => {
    if (reportingUid) return;
    setReportModalUser(null);
    setReportReason("");
    setReportDetails("");
  }, [reportingUid]);

  const submitReport = useCallback(
    async (reportedUid: string, reason: string, details?: string) => {
      setReportingUid(reportedUid);

      try {
        await reportUser(reportedUid, reason, details);
        showAlert("Report submitted", "Thanks. Your report has been saved.");
        setReportModalUser(null);
        setReportReason("");
        setReportDetails("");
      } catch (e: any) {
        const code = e?.code ? ` (${e.code})` : "";
        showAlert(
          "Could not submit report",
          `${e?.message ?? "Unknown error"}${code}`,
        );
      } finally {
        setReportingUid((current) =>
          current === reportedUid ? null : current,
        );
      }
    },
    [],
  );

  const openReportModal = useCallback(
    (user: NearbyResponse["users"][number]) => {
      if (reportingUid === user.uid) return;
      setReportModalUser(user);
      setReportReason("");
      setReportDetails("");
    },
    [reportingUid],
  );

  const handleSubmitReport = useCallback(() => {
    if (!reportModalUser) return;

    const trimmedReason = reportReason.trim();
    const trimmedDetails = reportDetails.trim();

    if (!trimmedReason) {
      showAlert(
        "Missing reason",
        "Please enter a short reason for the report.",
      );
      return;
    }

    const confirmSubmit = () => {
      submitReport(
        reportModalUser.uid,
        trimmedReason,
        trimmedDetails || undefined,
      ).catch(() => {});
    };

    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(
        "Are you sure you want to submit this report?",
      );
      if (confirmed) {
        confirmSubmit();
      }
      return;
    }

    Alert.alert(
      "Submit report?",
      "Are you sure you want to send this report?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Submit",
          style: "destructive",
          onPress: confirmSubmit,
        },
      ],
    );
  }, [reportDetails, reportModalUser, reportReason, submitReport]);

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

  const handleBlockUser = useCallback(
    (user: NearbyResponse["users"][number]) => {
      if (blockingUid === user.uid) return;

      const confirmBlock = async () => {
        try {
          setBlockingUid(user.uid);
          await blockUser(user.uid);
          setNearby((current) => ({
            ...current,
            users: current.users.filter((entry) => entry.uid !== user.uid),
            crowdCount: Math.max(
              0,
              current.crowdCount -
                current.users.filter((entry) => entry.uid === user.uid).length,
            ),
          }));
          setConnectedUids((current) => {
            const next = new Set(current);
            next.delete(user.uid);
            return next;
          });
          setConnectionIdsByUid((current) => {
            const next = { ...current };
            delete next[user.uid];
            return next;
          });
          await loadNearby({ includePing: false });
          showAlert(
            "User blocked",
            "They can no longer see your profile, connection record, or messages.",
          );
        } catch (e: any) {
          const code = e?.code ? ` (${e.code})` : "";
          showAlert(
            "Could not block user",
            `${e?.message ?? "Unknown error"}${code}`,
          );
        } finally {
          setBlockingUid((current) => (current === user.uid ? null : current));
        }
      };

      if (Platform.OS === "web") {
        const confirmed = globalThis.confirm?.(
          `Block ${user.firstName || "this user"}? They will immediately lose access to your profile, messages, and connection history.`,
        );
        if (confirmed) {
          confirmBlock().catch(() => {});
        }
        return;
      }

      Alert.alert(
        "Block user?",
        `Block ${user.firstName || "this user"}? They will immediately lose access to your profile, messages, and connection history.`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Block",
            style: "destructive",
            onPress: () => {
              confirmBlock().catch(() => {});
            },
          },
        ],
      );
    },
    [blockingUid, loadNearby],
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

  useEffect(() => {
    if (!currentUid) {
      setConnectedUids(new Set());
      setConnectionIdsByUid({});
      return;
    }

    const unsub = subscribeToConnections(
      currentUid,
      (connections) => {
        const next = new Set<string>();
        const nextIds: Record<string, string> = {};

        for (const connection of connections) {
          if (!isConnectionActive(connection)) continue;
          const otherUid = connection.users.find((uid) => uid !== currentUid);
          if (otherUid) {
            next.add(otherUid);
            nextIds[otherUid] = connection.id;
          }
        }

        setConnectedUids(next);
        setConnectionIdsByUid(nextIds);
      },
      (error) => {
        if ((error as any)?.code === "permission-denied") {
          setConnectedUids(new Set());
          setConnectionIdsByUid({});
          return;
        }
        console.warn("Failed to watch home connections", error);
      },
    );

    return () => {
      unsub();
    };
  }, [currentUid]);

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

  useEffect(() => {
    let cancelled = false;

    const loadFallbackProfiles = async () => {
      const usersNeedingFallback = nearby.users.filter(
        (user) => !user.avatarId?.trim(),
      );

      if (usersNeedingFallback.length === 0) {
        if (!cancelled) {
          setNearbyProfileFallbacks({});
        }
        return;
      }

      const uniqueUids = Array.from(
        new Set(usersNeedingFallback.map((user) => user.uid)),
      );

      const entries = await Promise.all(
        uniqueUids.map(
          async (uid) => [uid, await getUserProfile(uid)] as const,
        ),
      );

      if (!cancelled) {
        setNearbyProfileFallbacks(Object.fromEntries(entries));
      }
    };

    loadFallbackProfiles().catch((error) => {
      console.warn("Could not load nearby avatar fallbacks", error);
    });

    return () => {
      cancelled = true;
    };
  }, [nearby.users]);

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
    async (uid: string) => {
      try {
        if (currentUid && currentUid !== uid) {
          const status = await getRelationshipStatus(uid);
          if (status === "declined" || status === "blocked") {
            showAlert(
              "Profile unavailable",
              "You can't view this profile anymore.",
            );
            return;
          }
        }

        router.push({ pathname: "/(tabs)/uid", params: { uid } });
      } catch (error: any) {
        showAlert("Could not open profile", error?.message ?? "Unknown error");
      }
    },
    [currentUid, router],
  );

  const openChat = useCallback(
    (connectionId: string, otherUid: string) => {
      router.push({
        pathname: "/(tabs)/chat/[connectionId]",
        params: { connectionId, otherUid },
      });
    },
    [router],
  );

  const closeUserModal = () => {
    if (reportModalUser) closeReportModal();
    else setOptionsUser(null);
  };

  return (
    <>
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
              style={styles.brandMascot}
              resizeMode="contain"
              accessible={false}
            />
            <Text style={styles.brandName}>Icebreakers</Text>
          </View>

          <View style={styles.heading}>
            <Text
              accessibilityRole="header"
              style={[styles.title, isNarrowScreen && styles.titleNarrow]}
            >
              Nearby Icebreakers
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryDetails}>
                <View style={styles.countRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.summaryText}>
                    {loading
                      ? "Finding people nearby"
                      : nearby.crowdCount +
                        " " +
                        (nearby.crowdCount === 1 ? "person" : "people") +
                        " nearby"}
                  </Text>
                </View>
                {!loading ? (
                  <Text style={styles.updatedText}>
                    Updated{" "}
                    {new Date(nearby.asOf).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh nearby people"
                accessibilityState={{
                  busy: refreshing || loading,
                  disabled: refreshing || loading,
                }}
                onPress={onRefresh}
                disabled={refreshing || loading}
                style={({ pressed }) => [
                  styles.refreshButton,
                  pressed && styles.pressed,
                ]}
              >
                {refreshing ? (
                  <ActivityIndicator color={colors.blue} />
                ) : (
                  <Feather name="refresh-cw" size={22} color={colors.ink} />
                )}
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator
                size="large"
                color={colors.blue}
                accessibilityLabel="Loading nearby people"
              />
              <Text style={styles.subtleText}>
                Looking for your next hello?
              </Text>
            </View>
          ) : nearby.users.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image
                source={iceMascot}
                style={styles.emptyMascot}
                resizeMode="contain"
                accessible={false}
              />
              <Text style={styles.emptyTitle}>No one nearby right now</Text>
              <Text style={styles.subtleText}>
                Keep location sharing on and pull to refresh.
              </Text>
            </View>
          ) : (
            nearby.users.map((user) => (
              <NearbyProfileCard
                key={user.uid}
                user={user}
                isConnected={connectedUids.has(user.uid)}
                fallbackAvatarId={nearbyProfileFallbacks[user.uid]?.avatarId}
                actionsDisabled={
                  reportingUid === user.uid || blockingUid === user.uid
                }
                onConnect={() => handleConnect(user.uid)}
                onViewProfile={() => openUserProfile(user.uid)}
                onMessage={() =>
                  openChat(connectionIdsByUid[user.uid], user.uid)
                }
                onMore={() => setOptionsUser(user)}
              />
            ))
          )}
        </View>
      </ScrollView>
      <Modal
        visible={!!optionsUser || !!reportModalUser}
        transparent
        animationType="fade"
        onRequestClose={closeUserModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.reportModalRoot}
        >
          <Pressable
            style={styles.reportBackdrop}
            onPress={closeUserModal}
            accessibilityLabel="Close profile options"
          />
          <View style={styles.reportModalCard}>
            {optionsUser ? (
              <>
                <View style={styles.optionsHeader}>
                  <Text style={styles.reportModalTitle}>Profile options</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close profile options"
                    onPress={closeUserModal}
                    style={styles.optionsClose}
                  >
                    <Feather name="x" size={22} color={colors.ink} />
                  </Pressable>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Report user"
                  style={styles.optionButton}
                  onPress={() => {
                    openReportModal(optionsUser);
                    setOptionsUser(null);
                  }}
                >
                  <Feather name="flag" size={20} color={colors.ink} />
                  <Text style={styles.optionText}>Report user</Text>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.muted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Block user"
                  style={styles.optionButton}
                  onPress={() => {
                    handleBlockUser(optionsUser);
                    setOptionsUser(null);
                  }}
                >
                  <Feather name="slash" size={20} color="#B91C1C" />
                  <Text style={[styles.optionText, styles.blockOptionText]}>
                    Block user
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.reportModalTitle}>Report user</Text>
                <Text style={styles.reportModalSubtitle}>
                  {reportModalUser
                    ? `Tell us what happened with ${reportModalUser.firstName || "this user"}.`
                    : "Tell us what happened."}
                </Text>

                <Text style={styles.reportFieldLabel}>Reason</Text>
                <View style={styles.reportReasonPickerWrap}>
                  <Picker
                    selectedValue={reportReason}
                    onValueChange={(value) => setReportReason(String(value))}
                    enabled={!reportingUid}
                    style={styles.reportReasonPicker}
                    dropdownIconColor="#7F1D1D"
                  >
                    <Picker.Item label="Select a reason..." value="" />
                    {REPORT_REASON_OPTIONS.map((reason) => (
                      <Picker.Item key={reason} label={reason} value={reason} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.reportDetailsHeader}>
                  <Text style={styles.reportFieldLabel}>Details</Text>
                  <Text style={styles.reportCharacterCount}>
                    {reportDetails.length}/{REPORT_DETAILS_MAX_LENGTH}
                  </Text>
                </View>
                <TextInput
                  value={reportDetails}
                  onChangeText={(value) =>
                    setReportDetails(value.slice(0, REPORT_DETAILS_MAX_LENGTH))
                  }
                  placeholder="Add any context that would help explain the issue."
                  placeholderTextColor="#9CA3AF"
                  style={styles.reportDetailsInput}
                  multiline
                  textAlignVertical="top"
                  maxLength={REPORT_DETAILS_MAX_LENGTH}
                  editable={!reportingUid}
                />

                <View style={styles.reportActionRow}>
                  <TouchableOpacity
                    style={styles.reportCancelButton}
                    onPress={closeReportModal}
                    disabled={!!reportingUid}
                  >
                    <Text style={styles.reportCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reportSubmitButton,
                      reportingUid && styles.disabledPillButton,
                    ]}
                    onPress={handleSubmitReport}
                    disabled={!!reportingUid}
                  >
                    <Text style={styles.reportSubmitButtonText}>
                      {reportingUid ? "Submitting..." : "Submit report"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 5,
    marginBottom: 2,
  },
  brandMascot: { width: 45, height: 48 },
  brandName: { fontFamily: "LexendSemiBold", fontSize: 23, color: colors.ink },
  heading: { gap: 8, paddingHorizontal: 5 },
  title: {
    fontFamily: "LexendSemiBold",
    textAlign: "center",
    fontSize: 28,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  titleNarrow: { fontSize: 24, lineHeight: 33 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryDetails: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 4,
  },
  countRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.green,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: colors.ink,
  },
  updatedText: { fontSize: 12, lineHeight: 19, color: colors.muted },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F6FAFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  emptyMascot: { width: 76, height: 82, marginBottom: 4 },
  emptyTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 19,
    lineHeight: 27,
    color: colors.ink,
    textAlign: "center",
  },
  subtleText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
  pressed: { opacity: 0.7 },
  disabledPillButton: { opacity: 0.65 },
  optionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionsClose: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  optionButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.frost,
  },
  optionText: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.ink },
  blockOptionText: { color: "#B91C1C" },
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
});
