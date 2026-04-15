import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import {
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
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
import { signOutCurrentUser } from "../../src/auth/session";
import PrimaryButton from "../../src/components/PrimaryButton";

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function Login() {
  const router = useRouter();
  
  const params = useLocalSearchParams<{
    showMessage?: string | string[];
    email?: string | string[];
  }>();
  const [removeMessage, setRemoveMessage] = useState("");

  // const curRoute = useRoute()
  // const curNav = useNavigation()
  // const [displayRemove, setDisplayRemove] = useState(false)

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  

  useEffect ( () => {
    const checkStoredMessage = async () => {
        const wasDeleted = await AsyncStorage.getItem('accountDeleted');

        if (wasDeleted === 'true'){
          setRemoveMessage("Your account has been successfully deleted!")
          setShowResendVerification(false);
          await AsyncStorage.removeItem('accountDeleted');
        }
    };
    
    const showMessage = Array.isArray(params.showMessage)
      ? params.showMessage[0]
      : params.showMessage;

    if (showMessage === 'DeletedAccount') {
      setRemoveMessage("Your account has been sucessfully deleted");
      setShowResendVerification(false);
    } else if (showMessage === "VerifyEmail") {
      const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;
      setRemoveMessage(
        emailParam
          ? `Check ${emailParam} and tap the verification link before logging in.`
          : "Check your inbox and tap the verification link before logging in.",
      );
      setShowResendVerification(true);
    } else {
      setRemoveMessage("");
      setShowResendVerification(false);
    }

    checkStoredMessage();
  }, [params.email, params.showMessage]);


  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert(
        "Missing fields",
        "Enter email, password, and confirm password.",
      );
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await credential.user.reload();

      if (!credential.user.emailVerified) {
        await signOutCurrentUser();
        setShowResendVerification(true);
        showAlert(
          "Verify your email",
          "Your email is not verified yet. Use the resend button if you need a fresh verification email.",
        );
        return;
      }

      setShowResendVerification(false);
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert("Login failed", e?.message ?? "Unknown error");
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert(
        "Missing fields",
        "Enter your email and password first so we can resend the verification email.",
      );
      return;
    }

    try {
      setResendingVerification(true);
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await credential.user.reload();

      if (credential.user.emailVerified) {
        setShowResendVerification(false);
        router.replace("/(tabs)");
        return;
      }

      await sendEmailVerification(credential.user);
      await signOutCurrentUser();
      setShowResendVerification(true);
      setRemoveMessage(
        `We sent a new verification email to ${email.trim()}. Check your inbox and spam folder.`,
      );
      showAlert(
        "Verification email sent",
        "We sent a new verification email. Please use the newest message in your inbox.",
      );
    } catch (e: any) {
      showAlert("Could not resend email", e?.message ?? "Unknown error");
    } finally {
      setResendingVerification(false);
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

      {showResendVerification ? (
        <TouchableOpacity
          onPress={handleResendVerification}
          disabled={resendingVerification}
        >
          <Text style={styles.linkText}>
            {resendingVerification
              ? "Sending verification email..."
              : "Resend verification email"}
          </Text>
        </TouchableOpacity>
      ) : null}

      <Link href="/(auth)/signup" asChild>
        <TouchableOpacity>
          <Text style={styles.linkText}>Need an account? Sign Up Here</Text>
        </TouchableOpacity>
      </Link>

      <TouchableOpacity onPress={() => router.replace("/")}>
        <Text style={styles.backLinkText}>Back</Text>
      </TouchableOpacity>
      
      {removeMessage ? <Text style={styles.goodText}>{removeMessage}</Text> : null}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#D9E0F0",
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
  
  goodText:{
    color: "black",
    backgroundColor: "rgba(41, 235, 106, 0.99)",
    textAlign: "center",
    marginTop: 16,
  },

});
