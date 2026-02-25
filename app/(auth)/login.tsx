import { Link, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      showAlert(
        "Missing fields",
        "Enter email, password, and confirm password.",
      );
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Passwords do not match");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert("Login failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#4f4f4f"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#4f4f4f"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor="#4f4f4f"
        style={styles.input}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
        <Text style={styles.primaryText}>Log In</Text>
      </TouchableOpacity>

      <Link href="/(auth)/signup" asChild>
        <TouchableOpacity>
          <Text style={styles.linkText}>Need an account? Sign Up Here</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: {
    color: "white",
    fontWeight: "600",
  },
  linkText: {
    color: "#3b82f6",
    textAlign: "center",
    textDecorationLine: "underline",
    fontWeight: "500",
  },
});
