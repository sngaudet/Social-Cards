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

// these are temporary function errors worth retrying once
const RETRYABLE_FUNCTION_CODES = new Set([
  "functions/internal",
  "functions/unavailable",
  "functions/deadline-exceeded",
]);

// this saves push token info for the signed in user
const registerPushTokenCallable = httpsCallable<
  { deviceId: string; platform: "ios" | "android"; expoPushToken: string },
  { ok: true }
>(functions, "location_registerPushToken");

// this updates backend sharing state for location
const setSharingCallable = httpsCallable<
  { sharingEnabled: boolean; permissionStatus: LocationPermissionStatus },
  { sharingEnabled: boolean; lastLocationAt: string | null }
>(functions, "location_setSharing");

// this sends one location ping to backend
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

// this fetches nearby users from backend
const getNearbyCallable = httpsCallable<{ radiusFt?: number }, NearbyResponse>(
  functions,
  "location_getNearby",
);

// this fetches user location control status from backend
const getControlStatusCallable = httpsCallable<Record<string, never>, LocationControlStatus>(
  functions,
  "location_getControlStatus",
);

// this is a tiny delay helper for retries
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// this makes warning logs easier to read
function formatError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

// this checks if a failed call should be retried
function isRetryableFunctionsError(error: unknown): boolean {
  return error instanceof FirebaseError && RETRYABLE_FUNCTION_CODES.has(error.code);
}

// this retries once for temporary firebase function failures
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
  // this allows foreground notifications to display
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

// this maps expo permission values into our app values
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

// this reads current location permission without prompting
async function getCurrentLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  if (Platform.OS === "web") return "unknown";

  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return mapPermissionStatus(foreground.status, background.status);
}

// this asks for location permission and attempts background permission too
async function requestLocationPermissions(): Promise<LocationPermissionStatus> {
  if (Platform.OS === "web") return "unknown";

  const foreground = await Location.requestForegroundPermissionsAsync();
  let background = await Location.getBackgroundPermissionsAsync();

  if (foreground.status === "granted") {
    try {
      background = await Location.requestBackgroundPermissionsAsync();
    } catch {
      // this can fail if user interrupts the permission flow
    }
  }

  return mapPermissionStatus(foreground.status, background.status);
}

// this finds eas project id for push token registration
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

// this builds a stable device id from platform model and token tail
function makeDeviceId(expoPushToken: string): string {
  const cleanToken = expoPushToken.replace(/[^a-zA-Z0-9]/g, "").slice(-24);
  const model = Device.modelId ?? Device.modelName ?? "device";
  return `${Platform.OS}-${model}-${cleanToken}`;
}

// this registers push token when user and device are valid
export async function registerPushTokenIfPossible(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!Device.isDevice) return false;
  if (!auth.currentUser) return false;

  // this checks existing permission first before asking
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") return false;

  // this handles both eas and non-eas setups
  const projectId = getProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const expoPushToken = tokenResponse.data;

  if (!expoPushToken) return false;

  // this maps platform to backend accepted type
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

// this converts a location object into one upsert ping call
async function sendPingFromLocationObject(
  location: Pick<Location.LocationObject, "coords" | "timestamp">,
  source: PingSource,
): Promise<void> {
  if (!auth.currentUser) return;

  const { latitude, longitude, accuracy } = location.coords;

  // this guards against invalid location payloads
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
  // this runs whenever background location updates fire
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn("Background location task error:", error.message);
      return;
    }

    const payload = data as { locations?: Location.LocationObject[] } | undefined;
    const locations = payload?.locations;

    if (!locations?.length) return;

    // this uses newest sample to avoid duplicate pings
    const newest = locations[locations.length - 1];

    try {
      await sendPingFromLocationObject(newest, "background");
    } catch (e) {
      console.warn("Background ping failed", e);
    }
  });
}

// this starts os background location updates for this app
export async function startBackgroundLocationUpdates(): Promise<void> {
  if (Platform.OS === "web") return;

  // this prevents duplicate starts
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

// this stops background location updates for current session
export async function stopLocationUpdatesForCurrentUser(): Promise<void> {
  if (Platform.OS === "web") return;

  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!started) return;

  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

// this sends one immediate foreground ping
export async function sendForegroundPing(): Promise<void> {
  if (Platform.OS === "web") return;
  if (!auth.currentUser) return;

  // this skips ping when permission cannot provide location
  const permissionStatus = await getCurrentLocationPermissionStatus();
  if (permissionStatus === "denied" || permissionStatus === "unknown") return;

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  await sendPingFromLocationObject(location, "foreground");
}

// this returns backend location sharing status for current user
export async function getLocationControlStatus(): Promise<LocationControlStatus> {
  const result = await callWithRetry(() => getControlStatusCallable({}));
  return result.data;
}

// this toggles sharing and syncs local location behavior
export async function setLocationSharingEnabled(
  sharingEnabled: boolean,
): Promise<LocationControlStatus> {
  // this gets current permission before deciding final state
  let permissionStatus = await getCurrentLocationPermissionStatus();

  // this asks permission only when user turns sharing on
  if (sharingEnabled && permissionStatus !== "always") {
    permissionStatus = await requestLocationPermissions();
  }

  // this forces off if permission is not usable
  const canShare =
    sharingEnabled && (permissionStatus === "always" || permissionStatus === "while_in_use");

  await callWithRetry(() =>
    setSharingCallable({
      sharingEnabled: canShare,
      permissionStatus,
    }),
  );

  // this keeps local background updates aligned with backend state
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

// this fetches nearby users list for home screen
export async function fetchNearbyUsers(radiusFt = 50): Promise<NearbyResponse> {
  const result = await callWithRetry(() => getNearbyCallable({ radiusFt }));
  return result.data;
}

// this bootstraps location services when a session starts
export async function bootstrapLocationServicesForSession(): Promise<void> {
  // this stops tracking if there is no signed in user
  if (!auth.currentUser) {
    await stopLocationUpdatesForCurrentUser();
    return;
  }

  // this is optional so location still works if push setup fails
  try {
    await registerPushTokenIfPossible();
  } catch (e) {
    console.warn("Push token registration failed", formatError(e));
  }

  let control: LocationControlStatus;
  try {
    // this reads server side sharing state and last location info
    control = await getLocationControlStatus();
  } catch (e) {
    console.warn("Could not load location control status", formatError(e));
    return;
  }

  let currentPermissionStatus = await getCurrentLocationPermissionStatus();

  // this re-requests permission if sharing is on but permission is missing
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
    // this syncs backend sharing with actual device permission
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

  // this starts or stops updates based on final share state
  if (canShare) {
    try {
      await startBackgroundLocationUpdates();
    } catch (e) {
      console.warn("Background updates bootstrap failed", e);
    }

    try {
      await sendForegroundPing();
    } catch {
      // this is non fatal and next successful ping will update nearby
    }
  } else {
    await stopLocationUpdatesForCurrentUser();
  }
}
