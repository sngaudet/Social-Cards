import { onAuthStateChanged, User } from "firebase/auth";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Platform } from "react-native";
import { auth } from "../../firebaseConfig";
import {
  subscribeToIncomingRequests,
} from "../connections/service";
import { showAlert } from "../lib/showAlert";
import {
  registerPushTokenIfPossible,
  requestNotificationPermissions,
  stopLocationUpdatesForCurrentUser,
} from "../location/service";

type AuthContextType = {
  user: User | null;
  initializing: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const WEB_NOTIFICATION_GRACE_MS = 15000;

function getTimestampMs(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.getTime();
  }
  return null;
}

function showWebRequestNotification(
  NotificationApi: typeof Notification,
): void {
  const title = "New connection request";
  const body = "You received a new connection request.";
  const documentRef =
    typeof globalThis !== "undefined" ? globalThis.document : undefined;
  const isVisible = documentRef?.visibilityState === "visible";
  const isFocused =
    typeof documentRef?.hasFocus === "function" && documentRef.hasFocus();

  if (isVisible || isFocused) {
    showAlert(title, body);
    return;
  }

  const notification = new NotificationApi(title, {
    body,
    tag: "connection_request",
    requireInteraction: true,
  });

  notification.onclick = () => {
    notification.close();
    if (typeof globalThis.window?.focus === "function") {
      globalThis.window.focus();
    }
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [webNotificationsGranted, setWebNotificationsGranted] = useState(() => {
    if (Platform.OS !== "web") return false;
    const notificationApi =
      typeof globalThis !== "undefined" ? globalThis.Notification : undefined;
    return notificationApi?.permission === "granted";
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initializing || user) return;

    stopLocationUpdatesForCurrentUser().catch((error) => {
      console.warn("Could not stop location updates after sign-out", error);
    });
  }, [initializing, user]);

  useEffect(() => {
    if (!user?.emailVerified) return;

    registerPushTokenIfPossible({ promptIfNeeded: false }).catch((error) => {
      console.warn("Push token registration failed", error);
    });
  }, [user]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const notificationApi =
      typeof globalThis !== "undefined" ? globalThis.Notification : undefined;
    if (!notificationApi) {
      setWebNotificationsGranted(false);
      return;
    }

    if (!user?.emailVerified) {
      setWebNotificationsGranted(notificationApi.permission === "granted");
      return;
    }

    if (notificationApi.permission === "granted") {
      setWebNotificationsGranted(true);
      return;
    }

    if (notificationApi.permission === "denied") {
      setWebNotificationsGranted(false);
      return;
    }

    const requestOnFirstInteraction = () => {
      void requestNotificationPermissions()
        .then((granted) => {
          setWebNotificationsGranted(granted);
        })
        .catch((error) => {
          console.warn("Web notification permission request failed", error);
          setWebNotificationsGranted(false);
        });
    };

    globalThis.addEventListener("click", requestOnFirstInteraction, {
      once: true,
    });

    return () => {
      globalThis.removeEventListener("click", requestOnFirstInteraction);
    };
  }, [user]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!user?.emailVerified || !webNotificationsGranted) return;

    const notificationApi =
      typeof globalThis !== "undefined" ? globalThis.Notification : undefined;
    if (!notificationApi || notificationApi.permission !== "granted") return;

    let initialized = false;
    let seenRequestIds = new Set<string>();
    const listenerStartedAt = Date.now();

    const unsubscribe = subscribeToIncomingRequests(
      user.uid,
      (requests) => {
        const nextIds = new Set(requests.map((request) => request.id));
        const freshRequests = requests.filter((request) => {
          const createdAtMs = getTimestampMs(request.createdAt);
          return (
            createdAtMs !== null
            && createdAtMs >= listenerStartedAt - WEB_NOTIFICATION_GRACE_MS
          );
        });

        if (!initialized) {
          initialized = true;
          for (const requestId of freshRequests.map((request) => request.id)) {
            if (!seenRequestIds.has(requestId)) {
              showWebRequestNotification(notificationApi);
            }
          }
          seenRequestIds = nextIds;
          return;
        }

        const newRequests = requests.filter(
          (request) => !seenRequestIds.has(request.id),
        );
        seenRequestIds = nextIds;

        for (let i = 0; i < newRequests.length; i += 1) {
          try {
            showWebRequestNotification(notificationApi);
          } catch (error) {
            console.warn("Web notification failed", error);
          }
        }
      },
      (error) => {
        if ((error as any)?.code === "permission-denied") {
          seenRequestIds = new Set();
          return;
        }
        console.warn("Incoming request notification listener failed", error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [user, webNotificationsGranted]);

  const value = useMemo(
    () => ({
      user,
      initializing,
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
