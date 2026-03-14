import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { useSignup } from "../src/signup/context";

export default function Index() {
  const { user, initializing } = useAuth();
  const { resumeRoute, shouldResumeSignup } = useSignup();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  if (shouldResumeSignup) {
    return <Redirect href={resumeRoute} />;
  }

  return <Redirect href="/welcome" />;
}
