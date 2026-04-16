import { Stack } from "expo-router";

export default function SignUpLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Sign Up" }} />
      <Stack.Screen name="icebreakers" options={{ title: "Ice Breakers" }} />
      <Stack.Screen name="hobbies" options={{ title: "Hobbies" }} />
      <Stack.Screen
        name="personalProfile"
        options={{ title: "Personal Profile" }}
      />
      <Stack.Screen
        name="academicProfile"
        options={{ title: "Academic Profile" }}
      />
      <Stack.Screen name="avatarPicker" options={{ title: "Avatar Picker" }} />
      <Stack.Screen name="pictures" options={{ title: "Profile Pictures" }} />
      <Stack.Screen name="onboardingIntro" options={{ title: "Onboarding Intro" }} />
      <Stack.Screen
        name="onboardingPermission"
        options={{ title: "Onboarding Permission" }}
      />
      <Stack.Screen
        name="registrationComplete"
        options={{ title: "Registration Complete" }}
      />
    </Stack>
  );
}
