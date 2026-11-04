import {
  sessionCallable as httpsCallable,
  captureUserSession,
  assertUserSession,
} from "../auth/sessionCallable";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { FirebaseError } from "firebase/app";
import { getFunctions } from "firebase/functions";
import { Platform } from "react-native";

import { app, auth } from "../../firebaseConfig";
import { shouldShowForegroundPushAlert } from "../notifications/runtime";
import {
  clearProfilePhotoCache,
  resolveProfilePhoto,
} from "../lib/picture_upload";
import { PreConnectionVisibility } from "../profile/visibility";

export type LocationPermissionStatus =
  | "always"
  | "while_in_use"
  | "denied"
  | "unknown";

export type NearbyUser = {
  uid: string;
  firstName: string;
  lastName?: string;
  preConnectionVisibility?: PreConnectionVisibility;
  pronouns?: string;
  dateOfBirth?: string;
  gradYear?: number | string;
  major: string;
  minor?: string;
  bio?: string;
  hobbies: string[];
  avatarId?: string;
  photoURL: string;
  iceBreakerOne: string;
  iceBreakerOneQuestion: string;
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
  generation: number;
  permissionStatus: LocationPermissionStatus;
  lastLocationAt: string | null;
  lastAccuracyM: number | null;
};

type PingSource = "foreground" | "background";
type NotificationsModule = typeof import("expo-notifications");

const LOCATION_TASK_NAME = "ICEBREAKERS_LOCATION_TASK_V1";
const functions = getFunctions(app, "us-central1");
let locationEpoch = 0;
let locationControl: (LocationControlStatus & { uid: string }) | null = null;
let sessionExiting = false;
let notificationsModulePromise: Promise<NotificationsModule> | null = null;

// these are temporary function errors worth retrying once
const RETRYABLE_FUNCTION_CODES = new Set([
  "functions/internal",
  "functions/unavailable",
  "functions/deadline-exceeded",
]);

// this saves push token info for the signed in user
const registerPushTokenCallable = httpsCallable<
  {
    deviceId: string;
    installationSecret: string;
    generation: number;
    platform: "ios" | "android";
    expoPushToken: string;
  },
  { ok: true }
>(functions, "location_registerPushToken");

// this updates backend sharing state for location
const setSharingCallable = httpsCallable<
  {
    sharingEnabled: boolean;
    permissionStatus: LocationPermissionStatus;
    generation: number;
  },
  LocationControlStatus
>(functions, "location_setSharing");

// this sends one location ping to backend
const upsertPingCallable = httpsCallable<
  {
    lat: number;
    lng: number;
    accuracyM: number;
    source: PingSource;
    recordedAtMs: number;
    generation: number;
  },
  {
    accepted: boolean;
    reason?: "paused" | "throttled" | "invalid";
    nextPingAfterSec?: number;
  }
>(functions, "location_upsertPing");

// this fetches nearby users from backend
const getNearbyCallable = httpsCallable<{ radiusFt?: number }, NearbyResponse>(
  functions,
  "location_getNearby",
);

// this fetches user location control status from backend
const getControlStatusCallable = httpsCallable<
  Record<string, never>,
  LocationControlStatus
>(functions, "location_getControlStatus");

// this clears current user's live presence on logout or account removal
const clearPresenceCallable = httpsCallable<
  Record<string, never>,
  { ok: true }
>(functions, "location_clearPresence");

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
  return (
    error instanceof FirebaseError && RETRYABLE_FUNCTION_CODES.has(error.code)
  );
}

// this retries once for temporary firebase function failures
async function callWithRetry<T>(action: () => Promise<T>): Promise<T> {
  const session = captureUserSession();
  try {
    return await action();
  } catch (firstError) {
    if (!isRetryableFunctionsError(firstError)) throw firstError;
    await sleep(900);
    assertUserSession(session);
    return action();
  }
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === "web") return null;

  notificationsModulePromise ??= import("expo-notifications");
  return notificationsModulePromise;
}

if (Platform.OS !== "web") {
  // this allows foreground notifications to display
  void getNotificationsModule()
    .then((Notifications) => {
      Notifications?.setNotificationHandler({
        handleNotification: async (notification) => {
          const shouldShowAlert = shouldShowForegroundPushAlert(
            notification.request.content.data as
              | Record<string, unknown>
              | undefined,
          );

          return {
            shouldShowAlert,
            shouldPlaySound: shouldShowAlert,
            shouldSetBadge: false,
            shouldShowBanner: shouldShowAlert,
            shouldShowList: shouldShowAlert,
          };
        },
      });
    })
    .catch((error) => {
      console.warn("Could not load notifications module", error);
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

// this maps browser geolocation permission states into app values
function mapWebPermissionState(state: unknown): LocationPermissionStatus {
  if (state === "granted") return "while_in_use";
  if (state === "denied") return "denied";
  return "unknown";
}

// this reads browser geolocation object safely across environments
function getWebGeolocation(): {
  getCurrentPosition: (
    success: (position: any) => void,
    error?: (err: { code?: number }) => void,
    options?: {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    },
  ) => void;
} | null {
  if (Platform.OS !== "web") return null;

  const navigatorRef = (globalThis as { navigator?: any }).navigator;
  return navigatorRef?.geolocation ?? null;
}

// this reads browser geolocation permission without prompting
async function getWebPermissionStatus(): Promise<LocationPermissionStatus> {
  const geolocation = getWebGeolocation();
  if (!geolocation) return "denied";

  const navigatorRef = (globalThis as { navigator?: any }).navigator;
  const query = navigatorRef?.permissions?.query;
  if (typeof query !== "function") return "unknown";

  try {
    const result = await query.call(navigatorRef.permissions, {
      name: "geolocation",
    });
    return mapWebPermissionState(result?.state);
  } catch {
    return "unknown";
  }
}

// this prompts browser geolocation permission by requesting one position
async function requestWebLocationPermission(): Promise<LocationPermissionStatus> {
  const geolocation = getWebGeolocation();
  if (!geolocation) return "denied";

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      () => resolve("while_in_use"),
      (error) => {
        if (error?.code === 1) {
          resolve("denied");
          return;
        }
        resolve("unknown");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  });
}

// this reads current location permission without prompting
async function getCurrentLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  if (Platform.OS === "web") {
    return getWebPermissionStatus();
  }

  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return mapPermissionStatus(foreground.status, background.status);
}

// this asks for location permission and attempts background permission too
export async function requestLocationPermissions(): Promise<LocationPermissionStatus> {
  if (Platform.OS === "web") {
    return requestWebLocationPermission();
  }

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

type Installation = {
  deviceId: string;
  installationSecret: string;
  generation: number;
};
let registrationQueue: Promise<unknown> = Promise.resolve();
async function nextInstallationRegistration(): Promise<Installation> {
  const key = "icebreakers_push_installation_v2";
  const stored = await AsyncStorage.getItem(key);
  const previous = stored ? (JSON.parse(stored) as Installation) : null;
  const next = previous ?? {
    deviceId: Crypto.randomUUID(),
    installationSecret: Array.from(
      await Crypto.getRandomBytesAsync(32),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
    generation: 0,
  };
  next.generation += 1;
  await AsyncStorage.setItem(key, JSON.stringify(next));
  return next;
}

// this creates the android channel required before requesting push permissions
async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    enableLights: true,
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3b82f6",
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    const notificationApi =
      typeof globalThis !== "undefined" ? globalThis.Notification : undefined;
    if (!notificationApi) return false;
    if (notificationApi.permission === "granted") return true;
    if (notificationApi.permission === "denied") return false;

    const result = await notificationApi.requestPermission();
    return result === "granted";
  }
  if (!Device.isDevice) return false;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  await ensureAndroidNotificationChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  return status === "granted";
}

// this registers push token when user and device are valid
async function performPushRegistration(options?: {
  promptIfNeeded?: boolean;
}): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!Device.isDevice) return false;
  const callerUid = auth.currentUser?.uid;
  if (!callerUid || sessionExiting) return false;
  const epoch = locationEpoch;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  await ensureAndroidNotificationChannel();

  // this checks existing permission first before asking
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted" && options?.promptIfNeeded) {
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
  const installation = await nextInstallationRegistration();
  if (
    auth.currentUser?.uid !== callerUid ||
    locationEpoch !== epoch ||
    sessionExiting
  )
    return false;

  await callWithRetry(async () => {
    if (
      auth.currentUser?.uid !== callerUid ||
      sessionExiting ||
      locationEpoch !== epoch
    )
      return;
    await registerPushTokenCallable({
      ...installation,
      platform,
      expoPushToken,
    });
  });

  return true;
}

export function registerPushTokenIfPossible(options?: {
  promptIfNeeded?: boolean;
}): Promise<boolean> {
  const run = registrationQueue.then(() => performPushRegistration(options));
  registrationQueue = run.catch(() => {});
  return run;
}

type LocationSession = { uid: string; epoch: number; generation: number };
function sessionIsCurrent(session: LocationSession): boolean {
  return (
    !sessionExiting &&
    auth.currentUser?.uid === session.uid &&
    locationEpoch === session.epoch &&
    locationControl?.uid === session.uid &&
    locationControl.sharingEnabled &&
    locationControl.generation === session.generation
  );
}
async function captureLocationSession(): Promise<LocationSession | null> {
  const uid = auth.currentUser?.uid;
  const epoch = locationEpoch;
  if (!uid || sessionExiting) return null;
  if (locationControl?.uid !== uid) await getLocationControlStatus();
  if (
    epoch !== locationEpoch ||
    auth.currentUser?.uid !== uid ||
    !locationControl?.sharingEnabled
  )
    return null;
  return { uid, epoch, generation: locationControl.generation };
}
async function sendPingFromCoordinates(
  latitude: number,
  longitude: number,
  accuracy: number | null | undefined,
  source: PingSource,
  timestampMs: number | null | undefined,
  session: LocationSession,
): Promise<void> {
  if (
    !sessionIsCurrent(session) ||
    !Number.isFinite(timestampMs) ||
    !Number.isFinite(accuracy)
  )
    return;
  await callWithRetry(async () => {
    if (!sessionIsCurrent(session)) return;
    await upsertPingCallable({
      lat: latitude,
      lng: longitude,
      accuracyM: accuracy as number,
      source,
      recordedAtMs: timestampMs as number,
      generation: session.generation,
    });
  });
}
async function sendPingFromLocationObject(
  location: Pick<Location.LocationObject, "coords" | "timestamp">,
  source: PingSource,
  session: LocationSession,
): Promise<void> {
  const { latitude, longitude, accuracy } = location.coords;
  await sendPingFromCoordinates(
    latitude,
    longitude,
    accuracy,
    source,
    location.timestamp,
    session,
  );
}

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  // this runs whenever background location updates fire
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn("Background location task error:", error.message);
      return;
    }

    const payload = data as
      | { locations?: Location.LocationObject[] }
      | undefined;
    const locations = payload?.locations;

    if (!locations?.length) return;

    // this uses newest sample to avoid duplicate pings
    const newest = locations[locations.length - 1];

    try {
      const session = await captureLocationSession();
      if (session)
        await sendPingFromLocationObject(newest, "background", session);
    } catch (e) {
      console.warn("Background ping failed", e);
    }
  });
}

// Serialize OS start/stop calls so an in-flight start cannot outlast opt-out or logout.
let locationUpdateQueue: Promise<void> = Promise.resolve();
function queueLocationUpdate(action: () => Promise<void>): Promise<void> {
  const operation = locationUpdateQueue.then(action);
  locationUpdateQueue = operation.catch(() => {});
  return operation;
}
export async function startBackgroundLocationUpdates(): Promise<void> {
  if (Platform.OS === "web") return;
  const session = await captureLocationSession();
  if (!session) return;
  return queueLocationUpdate(async () => {
    if (!sessionIsCurrent(session)) return;
    const started =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started || !sessionIsCurrent(session)) return;
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
    if (!sessionIsCurrent(session))
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  });
}
export async function stopLocationUpdatesForCurrentUser(): Promise<void> {
  if (Platform.OS === "web") return;
  return queueLocationUpdate(async () => {
    const started =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  });
}

// this removes live presence and stops local tracking before session exit
export function invalidateLocalSession(): void {
  clearProfilePhotoCache();
  sessionExiting = true;
  locationEpoch += 1;
  locationControl = null;
}
export async function prepareLocationServicesForSessionExit(): Promise<void> {
  invalidateLocalSession();
  const cleanupTasks: Promise<unknown>[] = [
    stopLocationUpdatesForCurrentUser(),
  ];

  if (auth.currentUser) {
    cleanupTasks.push(callWithRetry(() => clearPresenceCallable({})));
  }

  const results = await Promise.allSettled(cleanupTasks);

  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }
}

// this sends one immediate foreground ping
export async function sendForegroundPing(): Promise<void> {
  const session = await captureLocationSession();
  if (!session) return;

  // this skips ping when permission cannot provide location
  const permissionStatus = await getCurrentLocationPermissionStatus();
  if (permissionStatus === "denied") return;
  if (permissionStatus === "unknown" && Platform.OS !== "web") return;

  if (Platform.OS === "web") {
    const geolocation = getWebGeolocation();
    if (!geolocation) return;

    const position = await new Promise<{
      coords: { latitude: number; longitude: number; accuracy?: number | null };
      timestamp?: number;
    }>((resolve, reject) => {
      geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      });
    });

    await sendPingFromCoordinates(
      position.coords.latitude,
      position.coords.longitude,
      position.coords.accuracy,
      "foreground",
      position.timestamp,
      session,
    );
    return;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  await sendPingFromLocationObject(location, "foreground", session);
}

// this returns backend location sharing status for current user
export async function getLocationControlStatus(): Promise<LocationControlStatus> {
  const caller = auth.currentUser?.uid;
  const epoch = locationEpoch;
  const result = await callWithRetry(() => getControlStatusCallable({}));
  const uid = auth.currentUser?.uid;
  if (uid && uid === caller && epoch === locationEpoch && !sessionExiting)
    locationControl = { ...result.data, uid };
  return result.data;
}

// this toggles sharing and syncs local location behavior
export async function setLocationSharingEnabled(
  sharingEnabled: boolean,
): Promise<LocationControlStatus> {
  locationEpoch += 1;
  const epoch = locationEpoch;
  const uid = auth.currentUser?.uid;
  if (locationControl) locationControl.sharingEnabled = false;
  const control = await getLocationControlStatus();
  // this gets current permission before deciding final state
  let permissionStatus = await getCurrentLocationPermissionStatus();

  // this asks permission only when user turns sharing on
  if (sharingEnabled && permissionStatus !== "always") {
    permissionStatus = await requestLocationPermissions();
  }

  // this forces off if permission is not usable
  const canShare =
    sharingEnabled &&
    (permissionStatus === "always" ||
      permissionStatus === "while_in_use" ||
      (Platform.OS === "web" && permissionStatus === "unknown"));

  if (
    epoch !== locationEpoch ||
    auth.currentUser?.uid !== uid ||
    sessionExiting
  )
    return control;
  const changed = await setSharingCallable({
    sharingEnabled: canShare,
    permissionStatus,
    generation: control.generation,
  });
  if (auth.currentUser?.uid !== uid || epoch !== locationEpoch)
    return changed.data;
  locationControl = { ...changed.data, uid: uid! };

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
  const caller = auth.currentUser?.uid;
  const result = await callWithRetry(() => getNearbyCallable({ radiusFt }));
  if (auth.currentUser?.uid !== caller)
    return { users: [], crowdCount: 0, asOf: new Date().toISOString() };
  const users = await Promise.all(
    result.data.users.map(async (person) => ({
      ...person,
      photoURL: await resolveProfilePhoto(person.uid, person.photoURL).catch(
        () => "",
      ),
    })),
  );
  if (auth.currentUser?.uid !== caller)
    return { users: [], crowdCount: 0, asOf: new Date().toISOString() };
  return { ...result.data, users };
}

// this bootstraps location services when a session starts
export async function bootstrapLocationServicesForSession(): Promise<void> {
  sessionExiting = false;
  locationEpoch += 1;
  const epoch = locationEpoch;
  const uid = auth.currentUser?.uid;
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
      currentPermissionStatus === "while_in_use" ||
      (Platform.OS === "web" && currentPermissionStatus === "unknown"));

  if (
    epoch !== locationEpoch ||
    auth.currentUser?.uid !== uid ||
    sessionExiting
  )
    return;
  // Bootstrap never re-enables sharing; only an explicit user action can enable it.
  if (control.sharingEnabled && !canShare) {
    await setSharingCallable({
      sharingEnabled: false,
      permissionStatus: currentPermissionStatus,
      generation: control.generation,
    });
    locationControl = null;
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

export function resetServicesForAuthenticatedUser(): void {
  clearProfilePhotoCache();
  locationEpoch += 1;
  locationControl = null;
  sessionExiting = false;
}
