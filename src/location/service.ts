import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app, auth } from "../../firebaseConfig";

export type LocationPermissionStatus =
  | "always"
  | "while_in_use"
  | "denied"
  | "unknown";

export type NearbyUser = {
  uid: string;
  firstName: string;
  major: string;
  hobbies: string;
  photoURL: string;
  iceBreakerOne: string;
  iceBreakerTwo: string;
  iceBreakerThree: string;
  distanceFt: number;
};

export type NearbyResponse = {
  users: NearbyUser[];
  crowdCount: number;
  asOf: string;
};

export type LocationControlStatus = {
  sharingEnabled: boolean;
  permissionStatus: LocationPermissionStatus;
  lastLocationAt: string | null;
  lastAccuracyM: number | null;
};

type PingSource = "foreground" | "background";

const LOCATION_TASK_NAME = "ICEBREAKERS_LOCATION_TASK_V1";
const functions = getFunctions(app, "us-central1");

const RETRYABLE_FUNCTION_CODES = new Set([
  "functions/internal",
  "functions/unavailable",
  "functions/deadline-exceeded",
]);

const registerPushTokenCallable = httpsCallable<
  { deviceId: string; platform: "ios" | "android"; expoPushToken: string },
  { ok: true }
>(functions, "location_registerPushToken");

const setSharingCallable = httpsCallable<
  { sharingEnabled: boolean; permissionStatus: LocationPermissionStatus },
  { sharingEnabled: boolean; lastLocationAt: string | null }
>(functions, "location_setSharing");

const upsertPingCallable = httpsCallable<
  {
    lat: number;
    lng: number;
    accuracyM: number;
    source: PingSource;
    recordedAtMs: number;
  },
  { accepted: boolean; reason?: "paused" | "throttled" | "invalid"; nextPingAfterSec?: number }
>(functions, "location_upsertPing");

const getNearbyCallable = httpsCallable<{ radiusFt?: number }, NearbyResponse>(
  functions,
  "location_getNearby",
);

const getControlStatusCallable = httpsCallable<Record<string, never>, LocationControlStatus>(
  functions,
  "location_getControlStatus",
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRetryableFunctionsError(error: unknown): boolean {
  return error instanceof FirebaseError && RETRYABLE_FUNCTION_CODES.has(error.code);
}

async function callWithRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (firstError) {
    if (!isRetryableFunctionsError(firstError)) throw firstError;
    await sleep(900);
    return action();
  }
}

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function mapPermissionStatus(
  foregroundStatus: Location.PermissionStatus,
  backgroundStatus: Location.PermissionStatus,
): LocationPermissionStatus {
  if (backgroundStatus === "granted") return "always";
  if (foregroundStatus === "granted") return "while_in_use";
  if (foregroundStatus === "denied" || backgroundStatus === "denied") {
    return "denied";
  }
  return "unknown";
}

async function getCurrentLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  if (Platform.OS === "web") return "unknown";

  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return mapPermissionStatus(foreground.status, background.status);
}

async function requestLocationPermissions(): Promise<LocationPermissionStatus> {
  if (Platform.OS === "web") return "unknown";

  const foreground = await Location.requestForegroundPermissionsAsync();
  let background = await Location.getBackgroundPermissionsAsync();

  if (foreground.status === "granted") {
    try {
      background = await Location.requestBackgroundPermissionsAsync();
    } catch {
      // Some Android/iOS paths can throw if background permission flow is interrupted.
    }
  }

  return mapPermissionStatus(foreground.status, background.status);
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

function makeDeviceId(expoPushToken: string): string {
  const cleanToken = expoPushToken.replace(/[^a-zA-Z0-9]/g, "").slice(-24);
  const model = Device.modelId ?? Device.modelName ?? "device";
  return `${Platform.OS}-${model}-${cleanToken}`;
}

export async function registerPushTokenIfPossible(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!Device.isDevice) return false;
  if (!auth.currentUser) return false;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") return false;

  const projectId = getProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const expoPushToken = tokenResponse.data;

  if (!expoPushToken) return false;

  const platform = Platform.OS === "ios" ? "ios" : "android";
  const deviceId = makeDeviceId(expoPushToken);

  await callWithRetry(() =>
    registerPushTokenCallable({
      deviceId,
      platform,
      expoPushToken,
    }),
  );

  return true;
}

async function sendPingFromLocationObject(
  location: Pick<Location.LocationObject, "coords" | "timestamp">,
  source: PingSource,
): Promise<void> {
  if (!auth.currentUser) return;

  const { latitude, longitude, accuracy } = location.coords;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    typeof accuracy !== "number"
  ) {
    return;
  }

  await callWithRetry(() =>
    upsertPingCallable({
      lat: latitude,
      lng: longitude,
      accuracyM: Math.max(0, accuracy),
      source,
      recordedAtMs: location.timestamp || Date.now(),
    }),
  );
}

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn("Background location task error:", error.message);
      return;
    }

    const payload = data as { locations?: Location.LocationObject[] } | undefined;
    const locations = payload?.locations;

    if (!locations?.length) return;

    const newest = locations[locations.length - 1];

    try {
      await sendPingFromLocationObject(newest, "background");
    } catch (e) {
      console.warn("Background ping failed", e);
    }
  });
}

export async function startBackgroundLocationUpdates(): Promise<void> {
  if (Platform.OS === "web") return;

  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (started) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 5,
    timeInterval: 30000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: "Icebreakers nearby mode",
      notificationBody:
        "Location updates are active so we can show nearby people and send alerts.",
      notificationColor: "#3b82f6",
    },
  });
}

export async function stopLocationUpdatesForCurrentUser(): Promise<void> {
  if (Platform.OS === "web") return;

  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!started) return;

  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function sendForegroundPing(): Promise<void> {
  if (Platform.OS === "web") return;
  if (!auth.currentUser) return;

  const permissionStatus = await getCurrentLocationPermissionStatus();
  if (permissionStatus === "denied" || permissionStatus === "unknown") return;

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  await sendPingFromLocationObject(location, "foreground");
}

export async function getLocationControlStatus(): Promise<LocationControlStatus> {
  const result = await callWithRetry(() => getControlStatusCallable({}));
  return result.data;
}

export async function setLocationSharingEnabled(
  sharingEnabled: boolean,
): Promise<LocationControlStatus> {
  let permissionStatus = await getCurrentLocationPermissionStatus();

  if (sharingEnabled && permissionStatus !== "always") {
    permissionStatus = await requestLocationPermissions();
  }

  const canShare =
    sharingEnabled && (permissionStatus === "always" || permissionStatus === "while_in_use");

  await callWithRetry(() =>
    setSharingCallable({
      sharingEnabled: canShare,
      permissionStatus,
    }),
  );

  if (canShare) {
    try {
      await startBackgroundLocationUpdates();
    } catch (e) {
      console.warn("Could not start background location updates", e);
    }

    try {
      await sendForegroundPing();
    } catch (e) {
      console.warn("Could not send foreground ping", e);
    }
  } else {
    await stopLocationUpdatesForCurrentUser();
  }

  return getLocationControlStatus();
}

export async function fetchNearbyUsers(radiusFt = 50): Promise<NearbyResponse> {
  const result = await callWithRetry(() => getNearbyCallable({ radiusFt }));
  return result.data;
}

export async function bootstrapLocationServicesForSession(): Promise<void> {
  if (!auth.currentUser) {
    await stopLocationUpdatesForCurrentUser();
    return;
  }

  try {
    await registerPushTokenIfPossible();
  } catch (e) {
    console.warn("Push token registration failed", formatError(e));
  }

  let control: LocationControlStatus;
  try {
    control = await getLocationControlStatus();
  } catch (e) {
    console.warn("Could not load location control status", formatError(e));
    return;
  }

  let currentPermissionStatus = await getCurrentLocationPermissionStatus();

  if (
    control.sharingEnabled &&
    currentPermissionStatus !== "always" &&
    currentPermissionStatus !== "while_in_use"
  ) {
    currentPermissionStatus = await requestLocationPermissions();
  }

  const canShare =
    control.sharingEnabled &&
    (currentPermissionStatus === "always" ||
      currentPermissionStatus === "while_in_use");

  try {
    await callWithRetry(() =>
      setSharingCallable({
        sharingEnabled: canShare,
        permissionStatus: currentPermissionStatus,
      }),
    );
  } catch (e) {
    console.warn("Could not sync sharing status", formatError(e));
    return;
  }

  if (canShare) {
    try {
      await startBackgroundLocationUpdates();
    } catch (e) {
      console.warn("Background updates bootstrap failed", e);
    }

    try {
      await sendForegroundPing();
    } catch {
      // Non-fatal. Nearby data will still populate from the next successful ping.
    }
  } else {
    await stopLocationUpdatesForCurrentUser();
  }
}
