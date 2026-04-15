import { Lexend_600SemiBold } from "@expo-google-fonts/lexend";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/auth/AuthContext";
import { SignupProvider } from "../src/signup/context";

export const unstable_settings = {
  initialRouteName: "index",
};

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#D9E0F0",
    card: "#D9E0F0",
  },
};

SystemUI.setBackgroundColorAsync("#D9E0F0").catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    LexendSemiBold: Lexend_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: "#D9E0F0" }}>
      <ThemeProvider value={appTheme}>
        <SignupProvider>
          <AuthProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                headerStyle: { backgroundColor: "#D9E0F0" },
                contentStyle: { backgroundColor: "#D9E0F0" },
              }}
            >
              <Stack.Screen
                name="index"
                options={{ contentStyle: { backgroundColor: "#D9E0F0" } }}
              />
              <Stack.Screen
                name="welcome"
                options={{
                  title: "Welcome Page",
                  contentStyle: { backgroundColor: "#D9E0F0" },
                }}
              />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AuthProvider>
        </SignupProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
