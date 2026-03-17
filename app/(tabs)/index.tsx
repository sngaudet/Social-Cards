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
import { auth } from "../../firebaseConfig";
import {
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
import { getAvatarImageSource } from "../../src/lib/avatarImages";
import { calculateAgeFromDateOfBirth } from "../../src/lib/profileFields";
import {
  normalizePreConnectionVisibility,
  PreConnectionVisibility,
} from "../../src/profile/visibility";

const emptyNearby: NearbyResponse = {
  users: [],
  crowdCount: 0,
  asOf: new Date().toISOString(),
};

const AUTO_REFRESH_MS = 5000;
const AUTO_PING_MS = 30000;
const MAX_PING_WAIT_MS = 1500;
const HOBBY_PREVIEW_LIMIT = 4;

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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearby, setNearby] = useState<NearbyResponse>(emptyNearby);
  const [connectedUids, setConnectedUids] = useState<Set<string>>(new Set());
  const [connectionIdsByUid, setConnectionIdsByUid] = useState<
    Record<string, string>
  >({});
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

  useEffect(() => {
    if (!currentUid) {
      setConnectedUids(new Set());
      setConnectionIdsByUid({});
      return;
    }

    const unsub = subscribeToConnections(currentUid, (connections) => {
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
    });

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
    (uid: string) => {
      router.push({ pathname: "/(tabs)/uid", params: { uid } });
    },
    [router],
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
          const showIceBreakerTwo = canSeeField("iceBreakerTwo");
          const showIceBreakerThree = canSeeField("iceBreakerThree");
          const showPhotoBeforeConnection = canSeeField("photoURL");
          const fallbackProfile = nearbyProfileFallbacks[user.uid];
          const effectiveAvatarId = user.avatarId || fallbackProfile?.avatarId;
          const pronouns = formatPronouns(user.pronouns);
          const ageFromDateOfBirth = calculateAgeFromDateOfBirth(user.dateOfBirth ?? "");
          const avatarSource = getAvatarImageSource(effectiveAvatarId);
          const hobbyPreview = user.hobbies.slice(0, HOBBY_PREVIEW_LIMIT);
          const primaryPrompt =
            (showIceBreakerOne && user.iceBreakerOne) ||
            (showIceBreakerTwo && user.iceBreakerTwo) ||
            (showIceBreakerThree && user.iceBreakerThree) ||
            "";
          const secondaryPrompt =
            (showIceBreakerTwo &&
            user.iceBreakerTwo &&
            user.iceBreakerTwo !== primaryPrompt
              ? user.iceBreakerTwo
              : "") ||
            (showIceBreakerThree &&
            user.iceBreakerThree &&
            user.iceBreakerThree !== primaryPrompt
              ? user.iceBreakerThree
              : "");

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
                    <Text style={styles.distancePill}>
                      {user.distanceFt} ft away
                    </Text>
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

                  {primaryPrompt ? (
                    <View style={styles.promptBlock}>
                      <Text style={styles.promptLabel}>
                        Conversation Starter
                      </Text>
                      <Text style={styles.promptValue}>{primaryPrompt}</Text>
                      {secondaryPrompt ? (
                        <Text style={styles.promptSubValue}>
                          {secondaryPrompt}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.footerRow}>
                    <View style={styles.footerInfo}>
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

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.viewPillButton}
                        onPress={() => openUserProfile(user.uid)}
                      >
                        <Text style={styles.viewPillButtonText}>
                          View Profile
                        </Text>
                      </TouchableOpacity>

                      {isConnected ? (
                        <>
                          <View style={styles.connectedPill}>
                            <Text style={styles.connectedPillText}>
                              Connected
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.connectPillButton}
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
                          style={styles.connectPillButton}
                          onPress={() => handleConnect(user.uid)}
                        >
                          <Text style={styles.connectPillButtonText}>
                            Connect
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#dfe7f6" },
  content: { padding: 18, paddingBottom: 48, gap: 14 },

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
  connectedPill: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  viewPillButtonText: {
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
