import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { Lexend_600SemiBold } from "@expo-google-fonts/lexend";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";

import { auth } from "../firebaseConfig";
import { bootstrapLocationServicesForSession, stopLocationUpdatesForCurrentUser } from "../src/location/service";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    LexendSemiBold: Lexend_600SemiBold,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          await stopLocationUpdatesForCurrentUser();
          return;
        }

        await bootstrapLocationServicesForSession();
      } catch (e) {
        console.warn("Location bootstrap failed", e);
      }
    });

    return unsub;
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="index" options={{ title: "Welcome Page"}}/>
    </Stack>
  );
}
