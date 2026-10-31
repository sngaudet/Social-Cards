import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { iceColors as colors, iceMascot } from "../../../src/theme/icebreakers";
import { auth, db } from "../../../firebaseConfig";
import {
  blockUser,
  getBlockedRelationshipForPair,
  getConnectionExpiresAt,
  getUserProfile,
  isConnectionActive,
  PublicUserProfile,
} from "../../../src/connections/service";
import {
  ChatMessage,
  getConnectionMembers,
  sendMessage,
  subscribeToMessages,
} from "../../../src/chat/service";
import { showAlert } from "../../../src/lib/showAlert";
import { NavigationService } from "../../../src/navigation/NavigationService";
import { reportUser } from "../../../src/reporting/service";

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

function formatTimestamp(value: any): string {
  if (!value?.toDate) return "";
  const date: Date = value.toDate();
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ConnectionChatPage() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackHeaderActions = width < 360 || fontScale > 1.2;
  const showBackLabel = width >= 375 && fontScale <= 1.15;
  const params = useLocalSearchParams<{
    connectionId?: string;
    otherUid?: string;
    blocked?: string;
    otherName?: string;
  }>();
  const connectionId = params.connectionId ?? "";
  const currentUid = auth.currentUser?.uid ?? "";
  const blockedParam = params.blocked === "1";
  const otherNameParam = params.otherName ?? "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [otherUid, setOtherUid] = useState(params.otherUid ?? "");
  const [otherProfile, setOtherProfile] = useState<PublicUserProfile | null>(
    null,
  );
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [blockedByCurrentUser, setBlockedByCurrentUser] =
    useState(blockedParam);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!connectionId || !currentUid) return;

    let cancelled = false;
    getConnectionMembers(connectionId)
      .then((members) => {
        if (cancelled) return;
        const peerUid = members.find((uid) => uid !== currentUid) ?? "";
        setOtherUid(peerUid);
        setAccessDenied(false);
      })
      .catch((e) => {
        if (e?.code === "permission-denied") {
          setAccessDenied(true);
          return;
        }
        showAlert("Could not load chat", e?.message ?? "Unknown error");
      });

    return () => {
      cancelled = true;
    };
  }, [connectionId, currentUid]);

  useEffect(() => {
    if (!connectionId) return;

    return onSnapshot(
      doc(db, "connections", connectionId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setExpiresAt(null);
          return;
        }

        setExpiresAt(getConnectionExpiresAt(snapshot.data()));
      },
      (error) => {
        if ((error as any)?.code === "permission-denied") {
          setAccessDenied(true);
          return;
        }
        console.warn("Failed to watch connection", error);
      },
    );
  }, [connectionId]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!otherUid) return;

    let cancelled = false;
    getBlockedRelationshipForPair(currentUid, otherUid)
      .then((relationship) => {
        if (cancelled) return;
        setBlockedByCurrentUser(
          relationship?.blockedByUid === currentUid || blockedParam,
        );
      })
      .catch((e) => {
        console.warn("Failed to load block relationship", e);
      });

    getUserProfile(otherUid)
      .then((profile) => {
        if (!cancelled) setOtherProfile(profile);
      })
      .catch((e) => {
        console.warn("Failed to load chat profile", e);
      });

    return () => {
      cancelled = true;
    };
  }, [blockedParam, currentUid, otherUid]);

  useEffect(() => {
    if (!connectionId) return;

    return subscribeToMessages(connectionId, setMessages, (error) => {
      if ((error as any)?.code === "permission-denied") {
        setAccessDenied(true);
        return;
      }
      console.warn("Failed to subscribe to messages", error);
    });
  }, [connectionId]);

  const title = useMemo(() => {
    return otherProfile?.firstName || otherNameParam || otherUid || "Chat";
  }, [otherNameParam, otherProfile, otherUid]);
  const isActive = useMemo(
    () => isConnectionActive({ expiresAt }, new Date(nowMs)),
    [expiresAt, nowMs],
  );
  const isReadOnly = blockedByCurrentUser || !isActive;

  const handleSend = async () => {
    try {
      setSending(true);
      await sendMessage(connectionId, draft);
      setDraft("");
    } catch (e: any) {
      showAlert("Could not send", e?.message ?? "Unknown error");
    } finally {
      setSending(false);
    }
  };

  const handleBlock = useCallback(() => {
    if (!otherUid || blocking || blockedByCurrentUser) return;

    const confirmBlock = async () => {
      try {
        setBlocking(true);
        await blockUser(otherUid);
        setBlockedByCurrentUser(true);
        showAlert(
          "User blocked",
          "This chat is now read-only for you, and the other user can no longer access it.",
        );
      } catch (e: any) {
        const code = e?.code ? ` (${e.code})` : "";
        showAlert(
          "Could not block user",
          `${e?.message ?? "Unknown error"}${code}`,
        );
      } finally {
        setBlocking(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(
        `Block ${title || "this user"}? They will immediately lose access to your profile, messages, and connection history.`,
      );
      if (confirmed) {
        confirmBlock().catch(() => {});
      }
      return;
    }

    Alert.alert(
      "Block user?",
      `Block ${title || "this user"}? They will immediately lose access to your profile, messages, and connection history.`,
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
  }, [blockedByCurrentUser, blocking, otherUid, title]);

  const closeReportModal = useCallback(() => {
    if (reporting) return;
    setReportModalVisible(false);
    setReportReason("");
    setReportDetails("");
  }, [reporting]);

  const openReportModal = useCallback(() => {
    if (!otherUid || reporting) return;
    setReportModalVisible(true);
    setReportReason("");
    setReportDetails("");
  }, [otherUid, reporting]);

  const submitReport = useCallback(async () => {
    if (!otherUid) return;

    const trimmedReason = reportReason.trim();
    const trimmedDetails = reportDetails.trim();

    if (!trimmedReason) {
      showAlert("Missing reason", "Please choose a reason for the report.");
      return;
    }

    const confirmSubmit = async () => {
      try {
        setReporting(true);
        await reportUser(otherUid, trimmedReason, trimmedDetails || undefined);
        showAlert("Report submitted", "Thanks. Your report has been saved.");
        setReportModalVisible(false);
        setReportReason("");
        setReportDetails("");
      } catch (e: any) {
        const code = e?.code ? ` (${e.code})` : "";
        showAlert(
          "Could not submit report",
          `${e?.message ?? "Unknown error"}${code}`,
        );
      } finally {
        setReporting(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(
        "Are you sure you want to submit this report?",
      );
      if (confirmed) {
        confirmSubmit().catch(() => {});
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
          onPress: () => {
            confirmSubmit().catch(() => {});
          },
        },
      ],
    );
  }, [otherUid, reportDetails, reportReason]);

  if (!connectionId || !currentUid) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Chat unavailable</Text>
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Chat unavailable</Text>
        <Text style={styles.statusText}>
          You no longer have access to this conversation.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.brand}>
            <Image
              source={iceMascot}
              style={styles.mascot}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>Icebreakers</Text>
          </View>
          <View
            style={[
              styles.toolbar,
              stackHeaderActions && styles.toolbarStacked,
            ]}
          >
            <View
              style={[
                styles.headerMain,
                stackHeaderActions && styles.stackedMain,
              ]}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => NavigationService.goBack("/(tabs)/message_cur")}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Feather name="arrow-left" size={21} color={colors.blue} />
                {showBackLabel && (
                  <Text style={styles.backButtonText}>Back</Text>
                )}
              </TouchableOpacity>
              <Text
                accessibilityRole="header"
                style={styles.headerTitle}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
            <View
              style={[
                styles.headerActionRow,
                stackHeaderActions && styles.stackedActions,
              ]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.reportButton,
                  reporting && styles.disabledButton,
                ]}
                onPress={openReportModal}
                disabled={reporting || !otherUid}
              >
                <Text style={styles.reportButtonText}>
                  {reporting ? "Reporting..." : "Report"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.blockButton,
                  (blocking || blockedByCurrentUser) && styles.disabledButton,
                ]}
                onPress={handleBlock}
                disabled={blocking || blockedByCurrentUser || !otherUid}
              >
                <Text style={styles.blockButtonText}>
                  {blockedByCurrentUser
                    ? "Blocked"
                    : blocking
                      ? "Blocking..."
                      : "Block"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.statusCard}>
            <Feather
              name={blockedByCurrentUser ? "slash" : "clock"}
              size={24}
              color={colors.muted}
            />
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>
                {blockedByCurrentUser
                  ? "User blocked"
                  : isActive
                    ? "Connected"
                    : "Connection expired"}
              </Text>
              <Text style={styles.statusText}>
                {blockedByCurrentUser
                  ? "You can read message history, but neither side can send new messages."
                  : isActive
                    ? "Chat available until " +
                      (expiresAt?.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      }) ?? "unknown")
                    : "You can still read previous messages."}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        style={styles.messageScroll}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => {
          const own = item.senderUid === currentUid;
          return (
            <View
              style={[
                styles.bubble,
                own ? styles.ownBubble : styles.otherBubble,
              ]}
            >
              <Text style={[styles.bubbleText, own && styles.ownBubbleText]}>
                {item.text}
              </Text>
              <Text style={[styles.timeText, own && styles.ownTimeText]}>
                {formatTimestamp(item.createdAt)}
              </Text>
            </View>
          );
        }}
      />
      <View style={styles.composeDock}>
        <View style={styles.composeRow}>
          <TextInput
            accessibilityLabel="Message"
            style={[styles.input, isReadOnly && styles.readOnlyInput]}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              blockedByCurrentUser
                ? "Chat is read-only after blocking"
                : isActive
                  ? "Type a message..."
                  : "Chat expired"
            }
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={1}
            maxLength={2000}
            editable={!isReadOnly && !sending}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={sending ? "Sending..." : "Send"}
            accessibilityState={{
              disabled: sending || isReadOnly,
              busy: sending,
            }}
            style={[
              styles.sendButton,
              (sending || isReadOnly) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={sending || isReadOnly}
          >
            {sending ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeReportModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.reportModalRoot}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close report"
            style={styles.reportBackdrop}
            onPress={closeReportModal}
            disabled={reporting}
          />
          <View style={styles.reportModalCard} accessibilityViewIsModal>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.reportContent}
            >
              <Text accessibilityRole="header" style={styles.reportModalTitle}>
                Report user
              </Text>
              <Text style={styles.reportModalSubtitle}>
                Tell us what happened with {title}.
              </Text>

              <Text style={styles.reportFieldLabel}>Reason</Text>
              <View style={styles.reportReasonPickerWrap}>
                <Picker
                  accessibilityLabel="Report reason"
                  selectedValue={reportReason}
                  onValueChange={(value) => setReportReason(String(value))}
                  enabled={!reporting}
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
                accessibilityLabel="Report details"
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
                editable={!reporting}
              />

              <View style={styles.reportActionRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.reportCancelButton}
                  onPress={closeReportModal}
                  disabled={reporting}
                >
                  <Text style={styles.reportCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.reportSubmitButton,
                    reporting && styles.disabledButton,
                  ]}
                  onPress={() => {
                    submitReport().catch(() => {});
                  }}
                  disabled={reporting}
                >
                  <Text style={styles.reportSubmitButtonText}>
                    {reporting ? "Submitting..." : "Submit report"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: "LexendSemiBold",
    fontSize: 26,
    lineHeight: 36,
    color: colors.ink,
    textAlign: "center",
  },
  header: { paddingTop: 8, paddingBottom: 14, paddingHorizontal: 12 },
  headerContent: { width: "100%", maxWidth: 600, alignSelf: "center", gap: 12 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  mascot: { width: 36, height: 40 },
  brandName: { fontFamily: "LexendSemiBold", fontSize: 20, color: colors.ink },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  toolbarStacked: { flexWrap: "wrap" },
  headerMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stackedMain: { flexBasis: "100%" },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    minHeight: 44,
    gap: 6,
  },
  backButtonText: { fontSize: 14, lineHeight: 21, color: colors.blue },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: "LexendSemiBold",
    fontSize: 20,
    lineHeight: 28,
    color: colors.ink,
    textAlign: "center",
  },
  headerActionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stackedActions: { width: "100%", justifyContent: "flex-end" },
  reportButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E74652",
    borderRadius: 999,
  },
  reportButtonText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: "#D93443",
  },
  blockButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 999,
  },
  blockButtonText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.ink,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FCFF",
  },
  statusBody: { flex: 1, minWidth: 0, gap: 4 },
  statusTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  statusText: { fontSize: 13, lineHeight: 20, color: colors.muted },
  messageScroll: { flex: 1 },
  messagesList: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 16,
    gap: 12,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
    gap: 5,
    borderWidth: 1,
  },
  ownBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  otherBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, color: colors.ink },
  ownBubbleText: { color: colors.surface },
  timeText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    alignSelf: "flex-end",
  },
  ownTimeText: { color: "#E0ECFF" },
  composeDock: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  composeRow: {
    width: "100%",
    maxWidth: 576,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.frost,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
  },
  readOnlyInput: { backgroundColor: "#EDF1F8", color: colors.muted },
  sendButton: {
    minWidth: 62,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.blue,
  },
  sendButtonDisabled: { backgroundColor: "#9DB4E2" },
  disabledButton: { opacity: 0.55 },
  sendButtonText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.surface,
  },
  reportModalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  reportBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,23,73,0.35)",
  },
  reportModalCard: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "100%",
    borderRadius: 20,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  reportContent: { padding: 20, gap: 12 },
  reportModalTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 22,
    lineHeight: 30,
    color: colors.ink,
  },
  reportModalSubtitle: { fontSize: 14, lineHeight: 21, color: colors.muted },
  reportFieldLabel: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.muted,
  },
  reportReasonPickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.frost,
    overflow: "hidden",
  },
  reportReasonPicker: {
    minHeight: 48,
    borderWidth: 0,
    color: colors.ink,
    backgroundColor: colors.frost,
  },
  reportDetailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  reportCharacterCount: { fontSize: 12, lineHeight: 18, color: colors.muted },
  reportDetailsInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
    backgroundColor: colors.frost,
  },
  reportActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  reportCancelButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.frost,
  },
  reportCancelButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.muted,
  },
  reportSubmitButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#D93443",
  },
  reportSubmitButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.surface,
  },
});
