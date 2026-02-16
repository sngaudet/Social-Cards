import { Stack } from "expo-router";

export default function SignUpLayout() {
  return (
    <Stack>
      <Stack.Screen name="prof_pg_1" options={{ title: "Profile Page 1" }} />
      <Stack.Screen name="prof_pg_2" options={{ title: "Profile Page 2" }} />
      <Stack.Screen name="prof_pg_3" options={{ title: "Profile Page 3" }} />
    </Stack>
  );
}
