import { Href, useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  User,
} from "firebase/auth";
import {
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { auth, db } from "../../../firebaseConfig";
import PrimaryButton from "../../../src/components/PrimaryButton";
import { normalizeHobbies } from "../../../src/lib/hobbies";
import { calculateAgeFromDateOfBirth } from "../../../src/lib/profileFields";
import {
  deleteUploadedProfilePhotoAsync,
  uploadProfilePhotoAsync,
} from "../../../src/lib/picture_upload";
import { DEFAULT_PRE_CONNECTION_VISIBILITY } from "../../../src/profile/visibility";
import { useSignup } from "../../../src/signup/context";

const FALLBACK_ICEBREAKER_QUESTIONS = [
  "What's your ideal weekend?",
  "What food can you never say no to?",
  "Share one fun fact about yourself",
];

export default function RegistrationCompletePage() {
  const router = useRouter();
  const { draft, resetDraft } = useSignup();
  const [submitting, setSubmitting] = useState(false);
  const hobbies = useMemo(
    () => normalizeHobbies(draft.hobbies),
    [draft.hobbies],
  );
  const derivedAge = useMemo(
    () => calculateAgeFromDateOfBirth(draft.dateOfBirth),
    [draft.dateOfBirth],
  );

  const missing = useMemo(() => {
    const fields: string[] = [];
    const completedIceBreakers = [
      draft.iceBreakerOne,
      draft.iceBreakerTwo,
      draft.iceBreakerThree,
    ].filter((value) => value?.trim()).length;

    if (!draft.email?.trim()) fields.push("email");
    if (!draft.password) fields.push("password");
    if (!draft.firstName?.trim()) fields.push("first name");
    if (!draft.lastName?.trim()) fields.push("last name");
    if (!draft.dateOfBirth?.trim()) fields.push("date of birth");
    if (!draft.bio?.trim()) fields.push("bio");
    if (!draft.pronouns?.trim()) fields.push("pronouns");
    if (draft.gradYear == null) fields.push("grad year");
    if (!draft.major?.trim()) fields.push("major");
    if (completedIceBreakers < 3) fields.push("3 icebreakers");
    if (hobbies.length === 0) fields.push("hobbies");
    if (!draft.avatarId?.trim()) fields.push("avatar");
    return fields;
  }, [draft, hobbies]);

  const redirectToSignupWithError = (title: string, message: string) => {
    router.replace({
      pathname: "/(auth)/signup",
      params: {
        errorTitle: title,
        errorMessage: message,
      },
    } as Href);
  };

  const handleSubmit = async () => {
    if (missing.length > 0) {
      redirectToSignupWithError(
        "Missing info",
        `Please finish: ${missing.join(", ")}.`,
      );
      return;
    }

    const email = draft.email.trim();
    const password = draft.password;

    if (!email.includes("@")) {
      redirectToSignupWithError("Invalid email", "Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      redirectToSignupWithError("Weak password", "Use at least 6 characters.");
      return;
    }

    let createdUser: User | null = null;
    const uploadedPhotoUrls: string[] = [];

    try {
      setSubmitting(true);

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = cred.user;

      for (const uri of draft.photoUris ?? []) {
        const url = await uploadProfilePhotoAsync(uri, cred.user.uid);
        uploadedPhotoUrls.push(url);
      }

      const photoURL = uploadedPhotoUrls[0] ?? "";
      const userRef = doc(db, "users", cred.user.uid);
      const publicProfileRef = doc(db, "publicProfiles", cred.user.uid);
      const batch = writeBatch(db);

      batch.set(userRef, {
        email: cred.user.email,
        firstName: draft.firstName ?? "",
        lastName: draft.lastName ?? "",
        dateOfBirth: draft.dateOfBirth ?? "",
        bio: draft.bio ?? "",
        pronouns: draft.pronouns ?? "",
        age: derivedAge ?? "",
        gradYear: draft.gradYear ?? "",
        major: draft.major ?? "",
        minor: draft.minor ?? "",
        iceBreakerOne: draft.iceBreakerOne ?? "",
        iceBreakerOneQuestion:
          draft.iceBreakerOneQuestion?.trim() || FALLBACK_ICEBREAKER_QUESTIONS[0],
        iceBreakerTwo: draft.iceBreakerTwo ?? "",
        iceBreakerTwoQuestion:
          draft.iceBreakerTwoQuestion?.trim() || FALLBACK_ICEBREAKER_QUESTIONS[1],
        iceBreakerThree: draft.iceBreakerThree ?? "",
        iceBreakerThreeQuestion:
          draft.iceBreakerThreeQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[2],
        hobbies,
        avatarId: draft.avatarId ?? "",
        photoURL,
        photoUrls: uploadedPhotoUrls,
        preConnectionVisibility: DEFAULT_PRE_CONNECTION_VISIBILITY,
        locationControl: {
          sharingEnabled: draft.locationSharingEnabled,
          permissionStatus: draft.locationPermissionStatus,
          updatedAt: serverTimestamp(),
        },
        locationStatus: {
          lastLocationAt: null,
          lastAccuracyM: null,
          lastSource: null,
        },
        createdAt: serverTimestamp(),
      });

      batch.set(publicProfileRef, {
        firstName: draft.firstName ?? "",
        lastName: draft.lastName ?? "",
        dateOfBirth: draft.dateOfBirth ?? "",
        bio: draft.bio ?? "",
        pronouns: draft.pronouns ?? "",
        age: derivedAge ?? "",
        gradYear: draft.gradYear ?? "",
        major: draft.major ?? "",
        minor: draft.minor ?? "",
        iceBreakerOne: draft.iceBreakerOne ?? "",
        iceBreakerOneQuestion:
          draft.iceBreakerOneQuestion?.trim() || FALLBACK_ICEBREAKER_QUESTIONS[0],
        iceBreakerTwo: draft.iceBreakerTwo ?? "",
        iceBreakerTwoQuestion:
          draft.iceBreakerTwoQuestion?.trim() || FALLBACK_ICEBREAKER_QUESTIONS[1],
        iceBreakerThree: draft.iceBreakerThree ?? "",
        iceBreakerThreeQuestion:
          draft.iceBreakerThreeQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[2],
        hobbies,
        avatarId: draft.avatarId ?? "",
        photoURL,
        preConnectionVisibility: DEFAULT_PRE_CONNECTION_VISIBILITY,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      resetDraft();
      router.replace("/(tabs)");
    } catch (e: any) {
      if (createdUser) {
        const cleanupTasks: Promise<unknown>[] = [
          deleteDoc(doc(db, "users", createdUser.uid)),
          deleteDoc(doc(db, "publicProfiles", createdUser.uid)),
          ...uploadedPhotoUrls.map((url) => deleteUploadedProfilePhotoAsync(url)),
        ];

        await Promise.allSettled(cleanupTasks);

        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          console.warn("Could not roll back partially created auth user", cleanupError);
          if (auth.currentUser?.uid === createdUser.uid) {
            await signOut(auth).catch((signOutError) => {
              console.warn("Could not sign out after failed signup cleanup", signOutError);
            });
          }
        }
      }

      const code = e?.code as string | undefined;

      if (code === "auth/email-already-in-use") {
        redirectToSignupWithError(
          "Email already in use",
          "Try logging in instead or use a different email.",
        );
      } else if (code === "auth/invalid-email") {
        redirectToSignupWithError(
          "Invalid email",
          "Check your email address and try again.",
        );
      } else if (code === "auth/weak-password") {
        redirectToSignupWithError(
          "Weak password",
          "Use at least 6 characters.",
        );
      } else {
        redirectToSignupWithError("Error", e?.message ?? "Signup failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Welcome to Icebreakers!</Text>

      <PrimaryButton
        title={submitting ? "Submitting..." : "Start Discovering Nearby"}
        showArrow={!submitting}
        style={styles.primaryButton}
        onPress={handleSubmit}
        disabled={submitting}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#D9E0F0",
  },
  title: {
    fontSize: 38,
    fontWeight: "600",
    marginBottom: 44,
    textAlign: "center",
  },
  primaryButton: {
    marginBottom: 12,
  },
});
