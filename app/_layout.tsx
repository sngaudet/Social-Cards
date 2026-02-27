import { Stack } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";

import { bootstrapLocationServicesForSession, stopLocationUpdatesForCurrentUser } from "@/src/location/service";
import { auth } from "../firebaseConfig";

export default function RootLayout() {
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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
