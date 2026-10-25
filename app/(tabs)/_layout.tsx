import { Feather, Ionicons } from "@expo/vector-icons";
import { PlatformPressable } from "@react-navigation/elements";
import { Redirect, Tabs, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import NotificationCoordinator from "../../src/notifications/NotificationCoordinator";
import { iceColors as colors } from "../../src/theme/icebreakers";

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
    return <Redirect href="/welcome" />;
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

  const isHome =
    pathname === "/" ||
    pathname === "/index" ||
    pathname === "/(tabs)" ||
    pathname === "/(tabs)/index";
  const isMessages =
    pathname === "/message_cur" || pathname === "/(tabs)/message_cur";
  const isConnections =
    pathname === "/connections" || pathname === "/(tabs)/connections";
  const isProfile =
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname.startsWith("/(tabs)/profile");
  const isSettings =
    pathname === "/settings" || pathname === "/(tabs)/settings";
  const isChat =
    pathname.startsWith("/chat/") || pathname.startsWith("/(tabs)/chat/");
  const isUserProfile = pathname === "/uid" || pathname === "/(tabs)/uid";
  const usesIceTheme =
    isHome ||
    isMessages ||
    isConnections ||
    isProfile ||
    isSettings ||
    isChat ||
    isUserProfile;
  const backgroundColor = usesIceTheme ? colors.background : "#D9E0F0";

  return (
    <View
      style={{
        flex: 1,
        paddingTop: usesIceTheme ? insets.top : Math.max(0, insets.top - 20),
        backgroundColor,
      }}
    >
      <StatusBar style="dark" />
      <NotificationCoordinator />
      <Tabs
        backBehavior="fullHistory"
        screenOptions={{
          headerShown: false,

          tabBarStyle: {
            height: 60 + Math.max(insets.bottom, 8),
            paddingTop: 7,
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
          tabBarLabelPosition: "below-icon",
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "500",
            marginTop: 2,
          },
          tabBarActiveTintColor: colors.blue,
          tabBarInactiveTintColor: "#617195",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarInactiveTintColor: isUserProfile ? colors.blue : "#617195",
            tabBarButton: isUserProfile
              ? (props) => <PlatformPressable {...props} aria-selected />
              : undefined,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="message_cur"
          options={{
            title: "Messages",
            tabBarInactiveTintColor: isChat ? colors.blue : "#617195",
            tabBarButton: isChat
              ? (props) => <PlatformPressable {...props} aria-selected />
              : undefined,
            tabBarIcon: ({ color }) => (
              <Feather name="message-circle" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="connections"
          options={{
            title: "Connections",
            tabBarIcon: ({ color }) => (
              <Feather name="users" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarHideOnKeyboard: true,
            tabBarIcon: ({ color }) => (
              <Feather name="user" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <Ionicons name="settings-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="chat/[connectionId]"
          options={{ href: null, tabBarHideOnKeyboard: true }}
        />
        <Tabs.Screen name="uid" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
