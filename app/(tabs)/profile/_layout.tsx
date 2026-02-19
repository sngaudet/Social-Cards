import { Tabs } from "expo-router";

export default function ProfileLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="view" options={{ title: "View" }} />
      <Tabs.Screen name="edit" options={{ title: "Edit" }} />
    </Tabs>
  );
}
