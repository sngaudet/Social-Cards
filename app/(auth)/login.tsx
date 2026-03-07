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
import PrimaryButton from "../../src/components/PrimaryButton";
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

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert(
        "Missing fields",
        "Enter email, password, and confirm password.",
      );
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

      <PrimaryButton
        title="Log In"
        showArrow
        style={styles.primaryButton}
        onPress={handleLogin}
      />

      <Link href="/(auth)/signup" asChild>
        <TouchableOpacity>
          <Text style={styles.linkText}>Need an account? Sign Up Here</Text>
        </TouchableOpacity>
      </Link>

      <TouchableOpacity onPress={() => router.replace("/")}>
        <Text style={styles.backLinkText}>Back</Text>
      </TouchableOpacity>
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
    fontSize: 40,
    fontWeight: "400",
    marginBottom: 32,
    textAlign: "center",
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

  linkText: {
    color: "#3b82f6",
    textAlign: "center",
    fontWeight: "500",
    marginTop: 8,
  },

  backLinkText: {
    color: "#444",
    textAlign: "center",
    marginTop: 16,
  },

});
