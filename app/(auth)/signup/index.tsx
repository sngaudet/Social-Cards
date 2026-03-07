import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";
import { useSignup } from "../../../src/signup/context";


function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function SignupAccountStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  // Prefill from draft so Back keeps values
  const [email, setEmail] = useState(draft.email ?? "");
  const [password, setPassword] = useState(draft.password ?? "");
  const [confirmPassword, setConfirmPassword] = useState("");

  const onNext = () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password || !confirmPassword.trim()) {
      showAlert("Missing fields", "Enter email and password.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      showAlert("Invalid email", "Enter a valid email address.");
      return;
    }

    if (!cleanEmail.includes("edu")) {
      showAlert("Invalid email - Use a student email");
      return;
    }

    // Firebase requires 6+ for email/password accounts
    if (password.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Passwords do not match");
      return;
    }

    // Save this step into the shared draft
    updateDraft({ email: cleanEmail, password });

    // Go to the next signup screen
    router.push("/(auth)/signup/profile");
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#4f4f4f"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#4f4f4f"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor="#4f4f4f"
        style={styles.input}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />


      <PrimaryButton
        title="Next Step"
        showArrow
        style={styles.primaryButton}
        onPress={onNext}
      />

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48, justifyContent: "center" },

  title: {
    fontSize: 40,
    fontWeight: "400",
    marginBottom: 32,
    textAlign: "center",
    color: "#000",
  },
  input: {
    backgroundColor: "#e9eef6",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
  },
  primaryButton: {
    alignSelf: "center",
    marginBottom: 16,
  },
  primaryText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },

  secondaryButton: { padding: 12, alignItems: "center" },

  secondaryText: {
    color: "#444",
    fontSize: 14,
  },
});
