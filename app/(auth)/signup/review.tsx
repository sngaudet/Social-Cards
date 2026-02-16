import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { useSignup } from "../../../src/signup/context";
import { auth, db } from "../../../firebaseConfig";

export default function SignupReview() {
  const router = useRouter();
  const { draft, resetDraft } = useSignup();

  const [submitting, setSubmitting] = useState(false);

  const missing: string[] = [];
  if (!draft.email?.trim()) missing.push("email");
  if (!draft.password) missing.push("password");
  if (!draft.firstName?.trim()) missing.push("first name");
  if (!draft.lastName?.trim()) missing.push("last name");
  if (!draft.Gender?.trim()) missing.push("gender");
  if (!draft.age?.trim()) missing.push("age");
  if (!draft.gradYear?.trim()) missing.push("grad year");
  if (!draft.major?.trim()) missing.push("major");
  if (!draft.iceBreakerOne?.trim()) missing.push("ice breaker 1");
  if (!draft.iceBreakerTwo?.trim()) missing.push("ice breaker 2");
  if (!draft.iceBreakerThree?.trim()) missing.push("ice breaker 3");
  if (!draft.hobbies?.trim()) missing.push("hobbies");

  const handleSubmit = async () => {
    if (missing.length > 0) {
      Alert.alert(
        "Missing info",
        `Please go back and fill: ${missing.join(", ")}.`
      );
      return;
    }

    const email = draft.email.trim();
    const password = draft.password;

    // Basic client-side checks (Firebase will also validate)
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

      // 3) Clear local draft + navigate
      resetDraft();
      Alert.alert("Account created!");
      router.replace("/");
    } catch (e: any) {
      // Friendly Firebase error mapping
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
    <View style={styles.container}>
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

        <Text style={styles.label}>Grad Year</Text>
        <Text style={styles.value}>{draft.gradYear || "-"}</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
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
