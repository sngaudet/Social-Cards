import { Picker } from "@react-native-picker/picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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
import {
  blockUser,
  getRelationshipStatus,
  getUserProfile,
  isConnectionActive,
  PublicUserProfile,
  sendConnectionRequest,
  subscribeToConnections,
} from "../../src/connections/service";
import { getAvatarImageSource } from "../../src/lib/avatarImages";
import { calculateAgeFromDateOfBirth } from "../../src/lib/profileFields";
import { showAlert } from "../../src/lib/showAlert";
import {
  fetchNearbyUsers,
  NearbyResponse,
  sendForegroundPing,
} from "../../src/location/service";
import {
  normalizePreConnectionVisibility,
  PreConnectionVisibility,
} from "../../src/profile/visibility";
import { reportUser } from "../../src/reporting/service";

const emptyNearby: NearbyResponse = {
  users: [],
  crowdCount: 0,
  asOf: new Date().toISOString(),
};

const AUTO_REFRESH_MS = 5000;
const AUTO_PING_MS = 30000;
const MAX_PING_WAIT_MS = 1500;
const HOBBY_PREVIEW_LIMIT = 4;
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

function formatPronouns(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "male":
      return "HE/HIM";
    case "female":
      return "SHE/HER";
    case "nonbinary":
      return "THEY/THEM";
    case "mtf":
      return "SHE/HER";
    case "ftm":
      return "HE/HIM";
    case "genderfluid":
      return "THEY/THEM";
    case "agender":
      return "THEY/THEM";
    case "androgynous":
      return "THEY/THEM";
    default:
      return normalized ? normalized.replaceAll("_", " ").toUpperCase() : "";
  }
}

export default function HomeTab() {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;
  const { width: windowWidth } = useWindowDimensions();
  const isCompactCardLayout = windowWidth < 430;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearby, setNearby] = useState<NearbyResponse>(emptyNearby);
  const [connectedUids, setConnectedUids] = useState<Set<string>>(new Set());
  const [connectionIdsByUid, setConnectionIdsByUid] = useState<
    Record<string, string>
  >({});
  const [reportingUid, setReportingUid] = useState<string | null>(null);
  const [blockingUid, setBlockingUid] = useState<string | null>(null);
  const [reportModalUser, setReportModalUser] = useState<NearbyResponse["users"][number] | null>(null);
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

  const submitReport = useCallback(async (
    reportedUid: string,
    reason: string,
    details?: string,
  ) => {
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
      setReportingUid((current) => (current === reportedUid ? null : current));
    }
  }, []);

  const openReportModal = useCallback((user: NearbyResponse["users"][number]) => {
    if (reportingUid === user.uid) return;
    setReportModalUser(user);
    setReportReason("");
    setReportDetails("");
  }, [reportingUid]);

  const handleSubmitReport = useCallback(() => {
    if (!reportModalUser) return;

    const trimmedReason = reportReason.trim();
    const trimmedDetails = reportDetails.trim();

    if (!trimmedReason) {
      showAlert("Missing reason", "Please enter a short reason for the report.");
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
        uniqueUids.map(async (uid) => [uid, await getUserProfile(uid)] as const),
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
        showAlert(
          "Could not open profile",
          error?.message ?? "Unknown error",
        );
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

  if (loading) {
    return <View style={styles.scroll} />;
  }

  return (
    <>
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
            Nearby users: {nearby.crowdCount}
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
          nearby.users.map((user) => {
          const isConnected = connectedUids.has(user.uid);
          const visibility = normalizePreConnectionVisibility(
            user.preConnectionVisibility,
          );
          const canSeeField = (field: keyof PreConnectionVisibility) =>
            isConnected || visibility[field];
          const displayName =
            [user.firstName, canSeeField("lastName") ? user.lastName : ""]
              .filter(Boolean)
              .join(" ")
              .trim() || "Unknown";
          const showMajor = canSeeField("major");
          const showPronouns = canSeeField("pronouns");
          const showDateOfBirth = canSeeField("dateOfBirth");
          const showGradYear = canSeeField("gradYear");
          const showHobbies = canSeeField("hobbies");
          const showIceBreakerOne = canSeeField("iceBreakerOne");
          const showBio = canSeeField("bio");
          const showPhotoBeforeConnection = canSeeField("photoURL");
          const fallbackProfile = nearbyProfileFallbacks[user.uid];
          const effectiveAvatarId = user.avatarId || fallbackProfile?.avatarId;
          const pronouns = formatPronouns(user.pronouns);
          const ageFromDateOfBirth = calculateAgeFromDateOfBirth(user.dateOfBirth ?? "");
          const avatarSource = getAvatarImageSource(effectiveAvatarId);
          const hobbyPreview = user.hobbies.slice(0, HOBBY_PREVIEW_LIMIT);
          //const primaryPrompt =
          //   (showIceBreakerOne && user.iceBreakerOne) ||
          //   (showIceBreakerTwo && user.iceBreakerTwo) ||
          //   (showIceBreakerThree && user.iceBreakerThree) ||
          //   "";
          // const secondaryPrompt =
          //   (showIceBreakerTwo &&
          //   user.iceBreakerTwo &&
          //   user.iceBreakerTwo !== primaryPrompt
          //     ? user.iceBreakerTwo
          //     : "") ||
          //   (showIceBreakerThree &&
          //   user.iceBreakerThree &&
          //   user.iceBreakerThree !== primaryPrompt
          //     ? user.iceBreakerThree
          //     : "");
          const primaryIcebreaker =
            showIceBreakerOne && user.iceBreakerOne
              ? {
                question: user.iceBreakerOneQuestion,
                answer: user.iceBreakerOne,
              }
            : null;


          return (
            <View key={user.uid} style={styles.userCard}>
              <View style={styles.userHeader}>
                {isConnected && showPhotoBeforeConnection && user.photoURL ? (
                  <Image
                    source={{ uri: user.photoURL }}
                    style={styles.avatar}
                  />
                ) : avatarSource ? (
                  <Image source={avatarSource} style={styles.avatar} />
                ) : !isConnected && showPhotoBeforeConnection && user.photoURL ? (
                  <Image
                    source={{ uri: user.photoURL }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {isConnected && showPhotoBeforeConnection
                        ? "No Photo"
                        : "No Avatar"}
                    </Text>
                    {__DEV__ ? (
                      <Text style={styles.avatarDebugText}>
                        avatarId: {effectiveAvatarId?.trim() || "missing"}
                      </Text>
                    ) : null}
                  </View>
                )}

                <View style={styles.userBody}>
                  <View style={styles.headerTopRow}>
                    <Text style={styles.userName}>{displayName}</Text>
                  </View> 

                  <View style={styles.metaRow}>
                    {showPronouns && pronouns ? (
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Pronouns</Text>
                        <Text style={styles.metaValue}>{pronouns}</Text>
                      </View>
                    ) : null}

                    {showDateOfBirth && ageFromDateOfBirth != null ? (
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Age</Text>
                        <Text style={styles.metaValue}>{ageFromDateOfBirth}</Text>
                      </View>
                    ) : null}

                    {showGradYear && user.gradYear ? (
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Exp Graduation</Text>
                        <Text style={styles.metaValue}>{user.gradYear}</Text>
                      </View>
                    ) : null}
                  </View>

                  {showHobbies && hobbyPreview.length > 0 ? (
                    <View style={styles.hobbiesBlock}>
                      <Text style={styles.metaLabel}>Hobbies</Text>
                      <View style={styles.hobbyWrap}>
                        {hobbyPreview.map((hobby) => (
                          <Text
                            key={`${user.uid}-${hobby}`}
                            style={styles.hobbyChip}
                          >
                            {hobby.toUpperCase()}
                          </Text>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  
                  {primaryIcebreaker ? (
                    <View style={styles.promptBlock}>
                      <Text style={styles.promptLabel}>
                        Conversation Starter
                      </Text>

                      
                  {showBio && user.bio ? (
                    <View style={styles.bioBlock}>
                      <Text style={styles.bioText}>
                        <Text style={styles.bioLabel}>Bio: </Text>                       
                        {user.bio}
                      </Text>
                    </View>
                  ) : null}

                      {!!primaryIcebreaker.question && (
                        <Text style={styles.promptQuestion}>
                          {primaryIcebreaker.question}
                        </Text>
                      )}

                      <Text style={styles.promptValue}>
                        {primaryIcebreaker.answer}
                      </Text>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.footerRow,
                      isCompactCardLayout && styles.footerRowCompact,
                    ]}
                  >
                    <View
                      style={[
                        styles.footerInfo,
                        isCompactCardLayout && styles.footerInfoCompact,
                      ]}
                    >
                      {showMajor ? (
                        <>
                          <Text style={styles.footerLabel}>Major</Text>
                          <Text style={styles.footerValue}>
                            {(user.major || "Undeclared").toUpperCase()}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.hiddenText}>
                          This user hides most profile details until you
                          connect.
                        </Text>
                      )}
                    </View>

                    <View
                      style={[
                        styles.actionRow,
                        isCompactCardLayout && styles.actionRowCompact,
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.viewPillButton,
                          isCompactCardLayout && styles.actionPillButtonCompact,
                        ]}
                        onPress={() => openUserProfile(user.uid)}
                      >
                        <Text style={styles.viewPillButtonText}>
                          View Profile
                        </Text>
                      </TouchableOpacity>

                      {isConnected ? (
                        <>
                          <View
                            style={[
                              styles.connectedPill,
                              isCompactCardLayout && styles.actionPillButtonCompact,
                            ]}
                          >
                            <Text style={styles.connectedPillText}>
                              Connected
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.connectPillButton,
                              isCompactCardLayout && styles.actionPillButtonCompact,
                            ]}
                            onPress={() =>
                              openChat(connectionIdsByUid[user.uid], user.uid)
                            }
                          >
                            <Text style={styles.connectPillButtonText}>
                              Text
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.connectPillButton,
                            isCompactCardLayout && styles.actionPillButtonCompact,
                          ]}
                          onPress={() => handleConnect(user.uid)}
                        >
                          <Text style={styles.connectPillButtonText}>
                            Connect
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.reportPillButton,
                          isCompactCardLayout && styles.actionPillButtonCompact,
                          reportingUid === user.uid && styles.disabledPillButton,
                        ]}
                        onPress={() => openReportModal(user)}
                        disabled={reportingUid === user.uid}
                      >
                        <Text style={styles.reportPillButtonText}>
                          {reportingUid === user.uid ? "Reporting..." : "Report"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.blockPillButton,
                          isCompactCardLayout && styles.actionPillButtonCompact,
                          blockingUid === user.uid && styles.disabledPillButton,
                        ]}
                        onPress={() => handleBlockUser(user)}
                        disabled={blockingUid === user.uid}
                      >
                        <Text style={styles.blockPillButtonText}>
                          {blockingUid === user.uid ? "Blocking..." : "Block"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
          })
        )}
      </ScrollView>
      <Modal
        visible={!!reportModalUser}
        transparent
        animationType="fade"
        onRequestClose={closeReportModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.reportModalRoot}
        >
          <Pressable style={styles.reportBackdrop} onPress={closeReportModal} />
          <View style={styles.reportModalCard}>
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
              onChangeText={(value) => setReportDetails(value.slice(0, REPORT_DETAILS_MAX_LENGTH))}
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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

  title: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    color: "#101828",
  },

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

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    minWidth: 72,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#303b52",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 12,
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
  footerRowCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  footerInfo: {
    flex: 1,
    gap: 2,
  },
  footerInfoCompact: {
    width: "100%",
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
  actionRowCompact: {
    width: "100%",
    flexWrap: "wrap",
    alignItems: "stretch",
    justifyContent: "space-between",
    rowGap: 8,
  },
  actionPillButtonCompact: {
    width: "48%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
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
  blockPillButton: {
    backgroundColor: "#111827",
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
  blockPillButtonText: {
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

  
promptQuestion: {
  fontSize: 12,
  fontWeight: "700",
  color: "#0e3365",
  textAlign: "center",
},
bioBlock: {
 marginTop: 4,
},

bioLabel: {
  fontWeight: "500",
  color: "#374151",
   textAlign: "center",
},

bioText: {
  fontSize: 13,
  lineHeight: 20,
  color: "#374151",
   textAlign: "center",
},

});
