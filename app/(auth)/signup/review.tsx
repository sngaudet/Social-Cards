import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { uploadProfilePhotoAsync } from "@/src/lib/picture_upload";
import { auth, db } from "../../../firebaseConfig";
import { useSignup } from "../../../src/signup/context";

export default function SignupReview() {
  const router = useRouter();
  const { draft, resetDraft } = useSignup();

  const [submitting, setSubmitting] = useState(false);

  // Compute missing fields (memoized so it doesn't rebuild every render unnecessarily)
  const missing = useMemo(() => {
    const m: string[] = [];
    if (!draft.email?.trim()) m.push("email");
    if (!draft.password) m.push("password");
    if (!draft.firstName?.trim()) m.push("first name");
    if (!draft.lastName?.trim()) m.push("last name");
    if (!draft.Gender?.trim()) m.push("gender");
    if (draft.age == null) m.push("age"); // catches null or undefined
    if (draft.gradYear == null) m.push("grad year");
    if (!draft.major?.trim()) m.push("major");
    if (!draft.iceBreakerOne?.trim()) m.push("ice breaker 1");
    if (!draft.iceBreakerTwo?.trim()) m.push("ice breaker 2");
    if (!draft.iceBreakerThree?.trim()) m.push("ice breaker 3");
    if (!draft.hobbies?.trim()) m.push("hobbies");
    return m;
  }, [draft]);

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

    try {
      setSubmitting(true);

      // 1) Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 2) Store the photo in Firebase storage
      const photoUrls: string[] = [];
      for (const uri of draft.photoUris ?? []) {
        const url = await uploadProfilePhotoAsync(uri);
        photoUrls.push(url);
      }

      // Save your user profile (include photoUrls)
      await setDoc(doc(db, "users", cred.user.uid), {
        // ...other profile fields from draft
        photoUrls,
        createdAt: serverTimestamp(),
      });

      // 2) Create Firestore user document
      await setDoc(doc(db, "users", cred.user.uid), {
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
        hobbies: draft.hobbies ?? "",
        createdAt: serverTimestamp(),
      });

      resetDraft();
      Alert.alert("Account created!");
      router.replace("/(tabs)");
    } catch (e: any) {
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
    <ScrollView
      style={styles.scroll} // ScrollView container styling
      contentContainerStyle={styles.content} // CHILD layout styling goes here (RN-web requirement)
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Review</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{draft.email || "-"}</Text>

        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>
          {(draft.firstName || "-") + " " + (draft.lastName || "")}
        </Text>

        <Text style={styles.label}>Gender</Text>
        <Text style={styles.value}>{draft.Gender || "-"}</Text>

        <Text style={styles.label}>Age</Text>
        <Text style={styles.value}>{draft.age || "-"}</Text>

        <Text style={styles.value}>
          {draft.gradYear != null ? String(draft.gradYear) : "-"}
        </Text>

        <Text style={styles.label}>Major</Text>
        <Text style={styles.value}>{draft.major || "-"}</Text>

        <Text style={styles.label}>Ice Breaker 1</Text>
        <Text style={styles.value}>{draft.iceBreakerOne || "-"}</Text>

        <Text style={styles.label}>Ice Breaker 2</Text>
        <Text style={styles.value}>{draft.iceBreakerTwo || "-"}</Text>

        <Text style={styles.label}>Ice Breaker 3</Text>
        <Text style={styles.value}>{draft.iceBreakerThree || "-"}</Text>

        <Text style={styles.label}>Hobbies</Text>
        <Text style={styles.value}>{draft.hobbies || "-"}</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, submitting && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.primaryText}>
          {submitting ? "Submitting..." : "Submit"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.back()}
        disabled={submitting}
      >
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ScrollView style: applies to the outer scroll view itself
  scroll: {
    flex: 1,
  },

  // contentContainerStyle: applies to the inner content layout
  content: {
    padding: 24,
    paddingBottom: 48, // extra room at bottom
    // IMPORTANT: flexGrow lets the content stretch on tall screens
    // but still scroll on small screens.
    flexGrow: 1,

    // If you DO NOT want vertical centering, leave this OFF.
    // If you want "center when short, scroll when long", uncomment:
    // justifyContent: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 18,
    textAlign: "center",
  },

  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 16,
    marginBottom: 18,
    gap: 8,
  },

  label: { fontSize: 12, color: "#666" },
  value: { fontSize: 16, marginBottom: 6 },

  primaryButton: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "white", fontWeight: "600" },

  secondaryButton: { padding: 16, borderRadius: 8, alignItems: "center" },
  secondaryText: { color: "#666" },
});
