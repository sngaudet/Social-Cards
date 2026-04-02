import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React, { ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, View } from "react-native";
import { useAuth } from "../../../src/auth/AuthContext";

function AnimatedIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        backgroundColor: focused ? "#F3D36A" : "transparent",
        // backgroundColor: focused ? "#2452ce" : "transparent",
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        padding: 4, // just a little padding so icon isn't flush
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function ProfileLayout() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'top',

        tabBarStyle: {
        height: 80,
        paddingTop: 10,
        backgroundColor: "#DADDE5",
        borderTopWidth: 0,
        overflow: "visible",
    },

        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 4,
        },

        tabBarActiveTintColor: "#333",
        tabBarInactiveTintColor: "#555",
      }}
    >
      <Tabs.Screen
        name="view"
        options={{
          title: "View",
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon focused={focused}>
              <Ionicons name="binoculars" size={22} color={color} />
            </AnimatedIcon>
          ),
        }}
      />

      <Tabs.Screen
        name="edit"
        options={{
          title: "Edit",
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon focused={focused}>
              <Ionicons name="brush" size={22} color={color} />
            </AnimatedIcon>
          ),
        }}
      />


      <Tabs.Screen name="chat/[connectionId]" options={{ href: null }} />
      <Tabs.Screen name="uid" options={{ href: null }} />
    </Tabs>
  );
}


// export default function ProfileLayout() {
//   return (
//     <Tabs screenOptions={{headerShown: false}}>
//       <Tabs.Screen name="view" options={{ title: "View"}} />
//       <Tabs.Screen name="edit" options={{ title: "Edit" }} />
//     </Tabs>
//   );
// }

// export default function ProfileLayout() {
//   return (
//     <Tabs screenOptions={{headerShown: false}}>
//       <Tabs.Screen name="view" options={{ title: "View"}} />
//       <Tabs.Screen name="edit" options={{ title: "Edit" }} />
//     </Tabs>
//   );
// }