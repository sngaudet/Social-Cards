import { Stack } from "expo-router";
import { SignupProvider } from "../../../src/signup/context";

export default function SignUpLayout() {
  return (
    <SignupProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Sign Up" }} />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen name="prof_pg_2" options={{ title: "Ice Breakers" }} />
        <Stack.Screen name="prof_pg_3" options={{ title: "Hobbies" }} />
        <Stack.Screen name="review" options={{ title: "Review" }} />
      </Stack>
    </SignupProvider>
  );
}
