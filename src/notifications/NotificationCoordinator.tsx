import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { subscribeToMessages } from "../chat/service";
import {
  getUserProfile,
  isConnectionActive,
  subscribeToConnections,
} from "../connections/service";
import { showAlert } from "../lib/showAlert";
import {
  setActiveNotificationPathname,
  shouldShowMessageNotification,
} from "./runtime";
import { useAuth } from "../auth/AuthContext";

function showWebMessageNotification(senderName?: string): void {
  const cleanName = senderName?.trim();
  const title = cleanName ? `New message from ${cleanName}` : "New message";
  const body = cleanName
    ? `${cleanName} sent you a message.`
    : "You received a new message.";
  const notificationApi =
    typeof globalThis !== "undefined" ? globalThis.Notification : undefined;
  const documentRef =
    typeof globalThis !== "undefined" ? globalThis.document : undefined;
  const isVisible = documentRef?.visibilityState === "visible";
  const isFocused =
    typeof documentRef?.hasFocus === "function" && documentRef.hasFocus();

  if (isVisible || isFocused || !notificationApi || notificationApi.permission !== "granted") {
    showAlert(title, body);
    return;
  }

  const notification = new notificationApi(title, {
    body,
    tag: "chat_message",
    requireInteraction: true,
  });

  notification.onclick = () => {
    notification.close();
    if (typeof globalThis.window?.focus === "function") {
      globalThis.window.focus();
    }
  };
}

export default function NotificationCoordinator() {
  const pathname = usePathname();
  const { user } = useAuth();
  const seenMessageIdsRef = useRef<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    setActiveNotificationPathname(pathname);
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!user?.uid) return;

    const unsubscribeByConnection = new Map<string, () => void>();
    const seenMessageIds = seenMessageIdsRef.current;

    const unsubscribeConnections = subscribeToConnections(
      user.uid,
      (connections) => {
        const activeConnections = connections.filter((connection) =>
          isConnectionActive(connection),
        );
        const activeConnectionIds = new Set(
          activeConnections.map((connection) => connection.id),
        );

        for (const [connectionId, unsubscribe] of unsubscribeByConnection) {
          if (activeConnectionIds.has(connectionId)) continue;
          unsubscribe();
          unsubscribeByConnection.delete(connectionId);
          seenMessageIds.delete(connectionId);
        }

        for (const connection of activeConnections) {
          if (unsubscribeByConnection.has(connection.id)) continue;

          const unsubscribeMessages = subscribeToMessages(
            connection.id,
            (messages) => {
              const nextIds = new Set(messages.map((message) => message.id));
              const seenIds = seenMessageIds.get(connection.id);

              if (!seenIds) {
                seenMessageIds.set(connection.id, nextIds);
                return;
              }

              const latestIncomingMessage = [...messages]
                .reverse()
                .find(
                  (message) =>
                    !seenIds.has(message.id) && message.senderUid !== user.uid,
                );

              seenMessageIds.set(connection.id, nextIds);

              if (!latestIncomingMessage) return;
              if (!shouldShowMessageNotification()) return;

              void getUserProfile(latestIncomingMessage.senderUid)
                .then((profile) => {
                  showWebMessageNotification(profile.firstName);
                })
                .catch(() => {
                  showWebMessageNotification();
                });
            },
          );

          unsubscribeByConnection.set(connection.id, unsubscribeMessages);
        }
      },
    );

    return () => {
      unsubscribeConnections();
      for (const unsubscribe of unsubscribeByConnection.values()) {
        unsubscribe();
      }
      unsubscribeByConnection.clear();
      seenMessageIds.clear();
    };
  }, [user?.uid]);

  return null;
}
