import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthContext";

export default function Index() {
  const { user, initializing } = useAuth();

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

  return <Redirect href="/welcome" />;
}
