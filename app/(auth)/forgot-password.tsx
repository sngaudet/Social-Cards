import { Href, Link, useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth } from "../../firebaseConfig";
import PrimaryButton from "../../src/components/PrimaryButton";
import { checkEmailExists } from "../../src/signup/service";
import { showAlert } from "../../src/lib/showAlert";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  const handleSendResetEmail = async () => {
    if (!normalizedEmail) {
      showAlert("Missing email", "Enter the email for your existing account.");
      return;
    }

    try {
      setSubmitting(true);

      const exists = await checkEmailExists(normalizedEmail);
      if (!exists) {
        showAlert(
          "Account not found",
          "No account exists for that email address. Enter the email tied to your SocialCards account.",
        );
        return;
      }

      await sendPasswordResetEmail(auth, normalizedEmail);
      showAlert(
        "Reset email sent",
        `We sent a password reset email to ${normalizedEmail}. Check your inbox and spam folder.`,
      );
      router.replace({
        pathname: "/(auth)/login",
        params: {
          showMessage: "PasswordResetSent",
          email: normalizedEmail,
        },
      });
    } catch (error: any) {
      showAlert(
        "Could not send reset email",
        error?.message ?? "Unknown error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter the email for your existing account and we&apos;ll send you a
          password reset link.
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#4f4f4f"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <PrimaryButton
          title={submitting ? "Sending..." : "Send Reset Email"}
          showArrow={!submitting}
          style={styles.primaryButton}
          onPress={handleSendResetEmail}
          disabled={submitting}
        />

        <Link href={"/(auth)/login" as Href} asChild>
          <TouchableOpacity disabled={submitting}>
            <Text style={styles.linkText}>Back to login</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: "400",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 28,
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
  linkText: {
    color: "#3b82f6",
    textAlign: "center",
    fontWeight: "500",
    marginTop: 8,
  },
});
