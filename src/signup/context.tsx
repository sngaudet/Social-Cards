import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  SignupDraft,
  SignupLocationPermissionStatus,
  emptySignupDraft,
} from "./types";
import { normalizeHobbies } from "../lib/hobbies";
import { normalizeDateOfBirth } from "../lib/profileFields";

type SignupResumeRoute =
  | "/(auth)/signup"
  | "/(auth)/signup/personalProfile"
  | "/(auth)/signup/academicProfile"
  | "/(auth)/signup/icebreakers"
  | "/(auth)/signup/hobbies"
  | "/(auth)/signup/avatarPicker"
  | "/(auth)/signup/pictures"
  | "/(auth)/signup/onboardingIntro"
  | "/(auth)/signup/onboardingPermission"
  | "/(auth)/signup/registrationComplete";

type SignupContextType = {
  draft: SignupDraft;
  hasDraftProgress: boolean;
  resumeRoute: SignupResumeRoute;
  shouldResumeSignup: boolean;
  updateDraft: (partial: Partial<SignupDraft>) => void;
  resetDraft: () => void;
};

const SignupContext = createContext<SignupContextType | undefined>(undefined);
const SIGNUP_DRAFT_STORAGE_KEY = "icebreakers_signup_draft_v1";
const DEFAULT_SIGNUP_ROUTE: SignupResumeRoute = "/(auth)/signup";
const SIGNUP_ROUTES = new Set<SignupResumeRoute>([
  "/(auth)/signup",
  "/(auth)/signup/personalProfile",
  "/(auth)/signup/academicProfile",
  "/(auth)/signup/icebreakers",
  "/(auth)/signup/hobbies",
  "/(auth)/signup/avatarPicker",
  "/(auth)/signup/pictures",
  "/(auth)/signup/onboardingIntro",
  "/(auth)/signup/onboardingPermission",
  "/(auth)/signup/registrationComplete",
]);

type PersistedSignupState = {
  draft?: unknown;
  resumeRoute?: unknown;
};

function normalizeRoutePath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  if (value === "/signup" || value.startsWith("/signup/")) {
    return `/(auth)${value}`;
  }

  if (value === "/(auth)/signup" || value.startsWith("/(auth)/signup/")) {
    return value;
  }

  return null;
}

function normalizeLocationPermissionStatus(
  value: unknown,
): SignupLocationPermissionStatus {
  if (
    value === "always" ||
    value === "while_in_use" ||
    value === "denied" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeDraft(value: unknown): SignupDraft {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<SignupDraft> & {
    hobbies?: string[] | string;
    avatarId?: unknown;
    photoUris?: unknown;
    Gender?: unknown;
  };

  return {
    ...emptySignupDraft,
    ...raw,
    gradYear:
      typeof raw.gradYear === "number"
        ? raw.gradYear
        : raw.gradYear == null
          ? null
          : Number(raw.gradYear) || null,
    dateOfBirth: normalizeDateOfBirth(raw.dateOfBirth),
    bio: typeof raw.bio === "string" ? raw.bio : "",
    pronouns:
      typeof raw.pronouns === "string"
        ? raw.pronouns
        : typeof raw.Gender === "string"
          ? raw.Gender
          : "",
    major: typeof raw.major === "string" ? raw.major : "",
    minor: typeof raw.minor === "string" ? raw.minor : "",
    locationSharingEnabled: raw.locationSharingEnabled === true,
    locationPermissionStatus: normalizeLocationPermissionStatus(
      raw.locationPermissionStatus,
    ),
    hobbies: normalizeHobbies(raw.hobbies),
    avatarId: typeof raw.avatarId === "string" ? raw.avatarId : "",
    photoUris: Array.isArray(raw.photoUris)
      ? raw.photoUris.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeResumeRoute(value: unknown): SignupResumeRoute {
  const normalizedRoute = normalizeRoutePath(value);
  return normalizedRoute && SIGNUP_ROUTES.has(normalizedRoute as SignupResumeRoute)
    ? (normalizedRoute as SignupResumeRoute)
    : DEFAULT_SIGNUP_ROUTE;
}

function hasDraftProgress(draft: SignupDraft): boolean {
  return Boolean(
    draft.email.trim() ||
      draft.password ||
      draft.firstName.trim() ||
      draft.lastName.trim() ||
      draft.dateOfBirth.trim() ||
      draft.bio.trim() ||
      draft.pronouns.trim() ||
      draft.gradYear != null ||
      draft.major.trim() ||
      draft.minor.trim() ||
      draft.iceBreakerOne.trim() ||
      draft.iceBreakerTwo.trim() ||
      draft.iceBreakerThree.trim() ||
      draft.hobbies.length > 0 ||
      draft.avatarId.trim() ||
      draft.photoUris.length > 0 ||
      draft.locationSharingEnabled ||
      draft.locationPermissionStatus !== "unknown",
  );
}

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [draft, setDraft] = useState(emptySignupDraft);
  const [resumeRoute, setResumeRoute] =
    useState<SignupResumeRoute>(DEFAULT_SIGNUP_ROUTE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
        if (!saved || cancelled) return;

        const parsed = JSON.parse(saved) as PersistedSignupState;
        if (!cancelled) {
          setDraft(normalizeDraft(parsed?.draft));
          setResumeRoute(normalizeResumeRoute(parsed?.resumeRoute));
        }
      } catch (error) {
        console.warn("Could not restore signup draft", error);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    loadDraft();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const nextResumeRoute = normalizeRoutePath(pathname);
    if (!nextResumeRoute) return;

    setResumeRoute(nextResumeRoute as SignupResumeRoute);
  }, [hydrated, pathname]);

  useEffect(() => {
    if (!hydrated) return;

    AsyncStorage.setItem(
      SIGNUP_DRAFT_STORAGE_KEY,
      JSON.stringify({ draft, resumeRoute }),
    ).catch((error) => {
      console.warn("Could not persist signup draft", error);
    });
  }, [draft, hydrated, resumeRoute]);

  function updateDraft(partial: Partial<SignupDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function resetDraft() {
    setDraft(emptySignupDraft);
    setResumeRoute(DEFAULT_SIGNUP_ROUTE);
    AsyncStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY).catch((error) => {
      console.warn("Could not clear signup draft", error);
    });
  }

  if (!hydrated) return null;

  const hasProgress = hasDraftProgress(draft);
  const shouldResumeSignup =
    hasProgress || resumeRoute !== DEFAULT_SIGNUP_ROUTE;

  return (
    <SignupContext.Provider
      value={{
        draft,
        hasDraftProgress: hasProgress,
        resumeRoute,
        shouldResumeSignup,
        updateDraft,
        resetDraft,
      }}
    >
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error("useSignup must be used inside SignupProvider");
  return ctx;
}
