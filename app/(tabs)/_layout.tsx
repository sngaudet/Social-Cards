import { Tabs } from "expo-router";

export default function TabDisplay() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="connections" options= {{ title: "Connections"}}/>
      <Tabs.Screen name="settings" options= {{ title: "Settings"}}/>
    </Tabs>
  );
}
