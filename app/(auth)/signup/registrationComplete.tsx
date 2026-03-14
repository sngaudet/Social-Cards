import { useRouter } from "expo-router";
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
import { Alert, ScrollView, StyleSheet, Text } from "react-native";
import { auth, db } from "../../../firebaseConfig";
import PrimaryButton from "../../../src/components/PrimaryButton";
import { normalizeHobbies } from "../../../src/lib/hobbies";
import {
  deleteUploadedProfilePhotoAsync,
  uploadProfilePhotoAsync,
} from "../../../src/lib/picture_upload";
import { useSignup } from "../../../src/signup/context";

export default function RegistrationCompletePage() {
  const router = useRouter();
  const { draft, resetDraft } = useSignup();
  const [submitting, setSubmitting] = useState(false);
  const hobbies = useMemo(
    () => normalizeHobbies(draft.hobbies),
    [draft.hobbies],
  );

  const missing = useMemo(() => {
    const fields: string[] = [];
    if (!draft.email?.trim()) fields.push("email");
    if (!draft.password) fields.push("password");
    if (!draft.firstName?.trim()) fields.push("first name");
    if (!draft.lastName?.trim()) fields.push("last name");
    if (!draft.Gender?.trim()) fields.push("gender");
    if (draft.age == null) fields.push("age");
    if (draft.gradYear == null) fields.push("grad year");
    if (!draft.major?.trim()) fields.push("major");
    if (!draft.iceBreakerOne?.trim()) fields.push("ice breaker 1");
    if (!draft.iceBreakerTwo?.trim()) fields.push("ice breaker 2");
    if (!draft.iceBreakerThree?.trim()) fields.push("ice breaker 3");
    if (hobbies.length === 0) fields.push("hobbies");
    return fields;
  }, [draft, hobbies]);

  const handleSubmit = async () => {
    if (missing.length > 0) {
      Alert.alert(
        "Missing info",
        `Please go back and fill: ${missing.join(", ")}.`,
      );
      return;
    }

    const email = draft.email.trim();
    const password = draft.password;

    if (!email.includes("@")) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters.");
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
        Gender: draft.Gender ?? "",
        age: draft.age ?? "",
        gradYear: draft.gradYear ?? "",
        major: draft.major ?? "",
        iceBreakerOne: draft.iceBreakerOne ?? "",
        iceBreakerTwo: draft.iceBreakerTwo ?? "",
        iceBreakerThree: draft.iceBreakerThree ?? "",
        hobbies,
        photoURL,
        photoUrls: uploadedPhotoUrls,
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
        Gender: draft.Gender ?? "",
        age: draft.age ?? "",
        gradYear: draft.gradYear ?? "",
        major: draft.major ?? "",
        iceBreakerOne: draft.iceBreakerOne ?? "",
        iceBreakerTwo: draft.iceBreakerTwo ?? "",
        iceBreakerThree: draft.iceBreakerThree ?? "",
        hobbies,
        photoURL,
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
        Alert.alert("Email already in use", "Try logging in instead.");
      } else if (code === "auth/invalid-email") {
        Alert.alert("Invalid email", "Check your email address and try again.");
      } else if (code === "auth/weak-password") {
        Alert.alert("Weak password", "Use at least 6 characters.");
      } else {
        Alert.alert("Error", e?.message ?? "Signup failed.");
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
