import { Redirect, Stack, usePathname } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";

const SIGNUP_BACKGROUND_COLOR = "#D9E0F0";

export default function AuthLayout() {
  const { user, initializing } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user?.emailVerified) {
    return <Redirect href="/(tabs)" />;
  }

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/");
  const backgroundColor = isAuthRoute ? SIGNUP_BACKGROUND_COLOR : "#FFFFFF";

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top - 20,
        backgroundColor,
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ title: "Login" }} />
        <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
      </Stack>
    </View>
  );
}
