import { Feather } from "@expo/vector-icons";
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
  View,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
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

  const [email, setEmail] = useState(draft.email ?? "");
  const [password, setPassword] = useState(draft.password ?? "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const getPasswordStrength = () => {
    if (password.length >= 12) return "strong";
    if (password.length >= 8) return "medium";
    if (password.length > 0) return "weak";
    return "empty";
  };

  const passwordColor = () => {
    switch (getPasswordStrength()) {
      case "weak": return "#f44336"; // red
      case "medium": return "#ff9800"; // orange
      case "strong": return "#4caf50"; // green
      default: return "#e0e0e0"; // grey
    }
  };

  const onNext = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || !confirmPassword.trim()) {
      showAlert("Missing fields", "Enter email and password.");
      return;
    }
    if (!cleanEmail.includes("@") || !cleanEmail.includes("edu")) {
      showAlert("Invalid email - Use a student email");
      return;
    }
    if (password.length < 6) {
      showAlert("Weak password", "Use at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Passwords do not match");
      return;
    }
    updateDraft({ email: cleanEmail, password });
    router.push("/(auth)/signup/profile");
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ProgressHeader currentStep={1} />

<SignupScreenHeader
  title="Create your account"
  subtitle="Join the campus network to break the ice. Your data stays with you."
/>

      {/* Email input */}
      <Text style={styles.label}>College Email</Text>
      <View style={styles.inputWrapper}>
        <Feather name="mail" size={20} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="you@uwm.edu"
          placeholderTextColor="#4f4f4f"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
      </View>
      <Text style={styles.infoText}>We never share your email address.</Text>

      {/* Password input */}
<Text style={styles.label}>Password</Text>
<View style={styles.inputWrapper}>
  <Feather name="lock" size={20} color="#999" style={{ marginRight: 8 }} />
  <TextInput
    placeholder="Min. 8 characters"
    placeholderTextColor="#4f4f4f"
    secureTextEntry={!showPassword}
    value={password}
    onChangeText={setPassword}
    style={styles.input}
  />
  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
    <Feather
      name={showPassword ? "eye" : "eye-off"}
      size={20}
      color="#999"
    />
  </TouchableOpacity>
</View>
      {/* Password strength bar */}
      <View style={styles.strengthBarContainer}>
        <View style={[styles.strengthBar, { backgroundColor: passwordColor() }]} />
      </View>

      {/* Confirm Password */}
<Text style={styles.label}>Confirm Password</Text>
<View style={styles.inputWrapper}>
  <Feather name="lock" size={20} color="#999" style={{ marginRight: 8 }} />
  <TextInput
    placeholder="Min. 8 characters"
    placeholderTextColor="#4f4f4f"
    secureTextEntry={!showConfirmPassword}
    value={confirmPassword}
    onChangeText={setConfirmPassword}
    style={styles.input}
  />
  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
    <Feather
      name={showConfirmPassword ? "eye" : "eye-off"}
      size={20}
      color="#999"
    />
  </TouchableOpacity>
</View>

      <PrimaryButton title="Next Step" showArrow style={styles.primaryButton} onPress={onNext} />
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/")}>
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },


  label: { fontWeight: "600", color: "#333", marginBottom: 6 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f6fb", borderRadius: 8, borderWidth: 1, borderColor: "#ccc", paddingHorizontal: 12, marginBottom: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16 },

  infoText: { fontSize: 12, color: "#777", marginBottom: 16 },

  strengthBarContainer: { height: 6, borderRadius: 3, backgroundColor: "#e0e0e0", marginBottom: 20, overflow: "hidden" },
  strengthBar: { height: 6, width: "100%" },

  primaryButton: { alignSelf: "center", marginBottom: 16 },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryText: { color: "#444", fontSize: 14 },
});
