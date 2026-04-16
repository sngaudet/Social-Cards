import { Feather, Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs, usePathname } from "expo-router";
import React, { ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import NotificationCoordinator from "../../src/notifications/NotificationCoordinator";

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

export default function TabDisplay() {
  const { user, initializing } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  if (!user.emailVerified) {
    return (
      <Redirect
        href={{
          pathname: "/(auth)/login",
          params: {
            showMessage: "VerifyEmail",
            email: user.email ?? undefined,
          },
        }}
      />
    );
  }

  const backgroundColor =
    pathname === "/(tabs)" ||
    pathname === "/(tabs)/index" ||
    pathname.startsWith("/(tabs)/profile")
      ? "#DFE7F6"
      : "#D9E0F0";

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top - 20,
        backgroundColor,
      }}
    >
      <NotificationCoordinator />
      <Tabs
        screenOptions={{
          headerShown: false,

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
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused, color }) => (
              <AnimatedIcon focused={focused}>
                <Ionicons name="star" size={22} color={color} />
              </AnimatedIcon>
            ),
          }}
        />

        <Tabs.Screen
          name="message_cur"
          options={{
            title: "Messages",
            tabBarIcon: ({ focused, color }) => (
              <AnimatedIcon focused={focused}>
                <Feather name="message-circle" size={22} color={color} />
              </AnimatedIcon>
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused, color }) => (
              <AnimatedIcon focused={focused}>
                <Feather name="user" size={22} color={color} />
              </AnimatedIcon>
            ),
          }}
        />

        <Tabs.Screen
          name="connections"
          options={{
            title: "Connections",
            tabBarIcon: ({ focused, color }) => (
              <AnimatedIcon focused={focused}>
                <Feather name="menu" size={22} color={color} />
              </AnimatedIcon>
            ),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ focused, color }) => (
              <AnimatedIcon focused={focused}>
                <Ionicons name="settings-outline" size={22} color={color} />
              </AnimatedIcon>
            ),
          }}
        />

        <Tabs.Screen name="chat/[connectionId]" options={{ href: null }} />
        <Tabs.Screen name="uid" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
