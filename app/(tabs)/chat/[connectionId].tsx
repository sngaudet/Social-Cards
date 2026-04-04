import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
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
  const [otherProfile, setOtherProfile] = useState<PublicUserProfile | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [blockedByCurrentUser, setBlockedByCurrentUser] = useState(blockedParam);
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

    return subscribeToMessages(
      connectionId,
      setMessages,
      (error) => {
        if ((error as any)?.code === "permission-denied") {
          setAccessDenied(true);
          return;
        }
        console.warn("Failed to subscribe to messages", error);
      },
    );
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
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerActionRow}>
            <TouchableOpacity
              style={[styles.reportButton, reporting && styles.disabledButton]}
              onPress={openReportModal}
              disabled={reporting || !otherUid}
            >
              <Text style={styles.reportButtonText}>
                {reporting ? "Reporting..." : "Report"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.blockButton, (blocking || blockedByCurrentUser) && styles.disabledButton]}
              onPress={handleBlock}
              disabled={blocking || blockedByCurrentUser || !otherUid}
            >
              <Text style={styles.blockButtonText}>
                {blockedByCurrentUser ? "Blocked" : blocking ? "Blocking..." : "Block"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.statusText}>
          {blockedByCurrentUser
            ? "This user is blocked. You can read message history, but neither side can send new messages."
            : isActive
            ? `Chat available until ${expiresAt?.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              }) ?? "unknown"}`
            : "This connection has expired. You can still read previous messages."}
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
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

      <View style={styles.composeRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={
            blockedByCurrentUser
              ? "Chat is read-only after blocking"
              : isActive
                ? "Type a message..."
                : "Chat expired"
          }
          multiline
          maxLength={2000}
          editable={!isReadOnly && !sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (sending || isReadOnly) && styles.disabledButton]}
          onPress={handleSend}
          disabled={sending || isReadOnly}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
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
          <Pressable style={styles.reportBackdrop} onPress={closeReportModal} />
          <View style={styles.reportModalCard}>
            <Text style={styles.reportModalTitle}>Report user</Text>
            <Text style={styles.reportModalSubtitle}>
              Tell us what happened with {otherProfile?.firstName || otherUid || "this user"}.
            </Text>

            <Text style={styles.reportFieldLabel}>Reason</Text>
            <View style={styles.reportReasonPickerWrap}>
              <Picker
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
              value={reportDetails}
              onChangeText={(value) => setReportDetails(value.slice(0, REPORT_DETAILS_MAX_LENGTH))}
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
                style={styles.reportCancelButton}
                onPress={closeReportModal}
                disabled={reporting}
              >
                <Text style={styles.reportCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportSubmitButton, reporting && styles.disabledButton]}
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#D9E0F0",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9E0F0",
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  reportButton: {
    backgroundColor: "#dc2626",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  blockButton: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  reportButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  blockButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  statusText: {
    fontSize: 13,
    color: "#546075",
    marginTop: 6,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  ownBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2452ce",
    borderColor: "#1f46ae",
  },
  otherBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderColor: "#ddd",
  },
  bubbleText: {
    color: "#111",
  },
  ownBubbleText: {
    color: "#fff",
  },
  timeText: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  ownTimeText: {
    color: "#dce8ff",
  },
  composeRow: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#c9d2e5",
    backgroundColor: "#edf2ff",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bcc7df",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: "#2452ce",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
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
