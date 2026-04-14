import { Href, Redirect, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { useSignup } from "../src/signup/context";
import WelcomePage from "./welcome";

export default function Index() {
  const { user, initializing } = useAuth();
  const { resumeRoute, shouldResumeSignup } = useSignup();
  const params = useLocalSearchParams<{
    showMessage?: string | string[];
  }>();

  const showMessage = Array.isArray(params.showMessage)
    ? params.showMessage[0]
    : params.showMessage;

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (showMessage === "DeletedAccount") {
    return (
      <Redirect
        href={{
          pathname: "/(auth)/login",
          params: { showMessage: "DeletedAccount" },
        }}
      />
    );
  }

  if (user?.emailVerified) {
    return <Redirect href="/(tabs)" />;
  }

  if (user && !user.emailVerified) {
    return (
      <Redirect
        href={{
          pathname: "/(auth)/login",
          params: { showMessage: "VerifyEmail", email: user.email ?? undefined },
        }}
      />
    );
  }

  if (shouldResumeSignup) {
    return <Redirect href={resumeRoute as Href} />;
  }

  return <WelcomePage />;
}
