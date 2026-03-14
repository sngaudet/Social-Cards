import { Lexend_600SemiBold } from "@expo-google-fonts/lexend";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/auth/AuthContext";
import { SignupProvider } from "../src/signup/context";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    LexendSemiBold: Lexend_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SignupProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="welcome" options={{ title: "Welcome Page" }} />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AuthProvider>
      </SignupProvider>
    </SafeAreaProvider>
  );
}
