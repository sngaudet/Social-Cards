import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";
import {
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

function formatTimestamp(value: any): string {
  if (!value?.toDate) return "";
  const date: Date = value.toDate();
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ConnectionChatPage() {
  const params = useLocalSearchParams<{ connectionId?: string; otherUid?: string }>();
  const connectionId = params.connectionId ?? "";
  const currentUid = auth.currentUser?.uid ?? "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [otherUid, setOtherUid] = useState(params.otherUid ?? "");
  const [otherProfile, setOtherProfile] = useState<PublicUserProfile | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!connectionId || !currentUid) return;

    let cancelled = false;
    getConnectionMembers(connectionId)
      .then((members) => {
        if (cancelled) return;
        const peerUid = members.find((uid) => uid !== currentUid) ?? "";
        setOtherUid(peerUid);
      })
      .catch((e) => {
        showAlert("Could not load chat", e?.message ?? "Unknown error");
      });

    return () => {
      cancelled = true;
    };
  }, [connectionId, currentUid]);

  useEffect(() => {
    if (!connectionId) return;

    return onSnapshot(doc(db, "connections", connectionId), (snapshot) => {
      if (!snapshot.exists()) {
        setExpiresAt(null);
        return;
      }

      setExpiresAt(getConnectionExpiresAt(snapshot.data()));
    });
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
  }, [otherUid]);

  useEffect(() => {
    if (!connectionId) return;
    return subscribeToMessages(connectionId, setMessages);
  }, [connectionId]);

  const title = useMemo(() => {
    return otherProfile?.firstName || otherUid || "Chat";
  }, [otherProfile, otherUid]);
  const isActive = useMemo(
    () => isConnectionActive({ expiresAt }, new Date(nowMs)),
    [expiresAt, nowMs],
  );

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

  if (!connectionId || !currentUid) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Chat unavailable</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.statusText}>
          {isActive
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
          placeholder={isActive ? "Type a message..." : "Chat expired"}
          multiline
          maxLength={2000}
          editable={isActive && !sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (sending || !isActive) && styles.disabledButton]}
          onPress={handleSend}
          disabled={sending || !isActive}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
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
  title: {
    fontSize: 28,
    fontWeight: "700",
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
});
