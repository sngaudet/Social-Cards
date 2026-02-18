import { Tabs } from "expo-router";

export default function TabDisplay() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="edit_profile" options={{title: "Edit Profile"}}/>
    </Tabs>
  );
}
