import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  SignupDraft,
  SignupLocationPermissionStatus,
  emptySignupDraft,
} from "./types";
import { normalizeHobbies } from "../lib/hobbies";

type SignupContextType = {
  draft: SignupDraft;
  updateDraft: (partial: Partial<SignupDraft>) => void;
  resetDraft: () => void;
};

const SignupContext = createContext<SignupContextType | undefined>(undefined);
const SIGNUP_DRAFT_STORAGE_KEY = "icebreakers_signup_draft_v1";

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
    photoUris?: unknown;
  };

  return {
    ...emptySignupDraft,
    ...raw,
    age:
      typeof raw.age === "number"
        ? raw.age
        : raw.age == null
          ? null
          : Number(raw.age) || null,
    gradYear:
      typeof raw.gradYear === "number"
        ? raw.gradYear
        : raw.gradYear == null
          ? null
          : Number(raw.gradYear) || null,
    locationSharingEnabled: raw.locationSharingEnabled === true,
    locationPermissionStatus: normalizeLocationPermissionStatus(
      raw.locationPermissionStatus,
    ),
    hobbies: normalizeHobbies(raw.hobbies),
    photoUris: Array.isArray(raw.photoUris)
      ? raw.photoUris.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState(emptySignupDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
        if (!saved || cancelled) return;

        const parsed = JSON.parse(saved);
        if (!cancelled) {
          setDraft(normalizeDraft(parsed));
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

    AsyncStorage.setItem(SIGNUP_DRAFT_STORAGE_KEY, JSON.stringify(draft)).catch(
      (error) => {
        console.warn("Could not persist signup draft", error);
      },
    );
  }, [draft, hydrated]);

  function updateDraft(partial: Partial<SignupDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function resetDraft() {
    setDraft(emptySignupDraft);
    AsyncStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY).catch((error) => {
      console.warn("Could not clear signup draft", error);
    });
  }

  if (!hydrated) return null;

  return (
    <SignupContext.Provider value={{ draft, updateDraft, resetDraft }}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error("useSignup must be used inside SignupProvider");
  return ctx;
}
