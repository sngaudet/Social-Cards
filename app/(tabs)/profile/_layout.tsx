import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../src/auth/AuthContext";
import { iceColors as colors, iceMascot } from "../../../src/theme/icebreakers";

function ProfileHeader({ state, navigation }: BottomTabBarProps) {
  const isEditing = state.routes[state.index].name === "edit";

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={iceMascot} style={styles.mascot} resizeMode="contain" />
        <Text style={styles.brandName}>Icebreakers</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {isEditing ? "Edit Profile" : "Your Profile"}
      </Text>
      <View style={styles.segments} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = route.name === "edit" ? "Edit" : "View";
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label + " profile"}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
              style={({ pressed }) => [
                styles.segment,
                focused && styles.segmentSelected,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather
                name={route.name === "edit" ? "edit-2" : "eye"}
                size={19}
                color={focused ? colors.surface : colors.ink}
              />
              <Text
                style={[
                  styles.segmentText,
                  focused && styles.segmentTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ProfileLayout() {
  const { user, initializing } = useAuth();
  const insets = useSafeAreaInsets();

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/welcome" />;
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <Tabs
        backBehavior="fullHistory"
        tabBar={(props) => <ProfileHeader {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarPosition: "top",
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="view" options={{ title: "View" }} />
        <Tabs.Screen name="edit" options={{ title: "Edit" }} />
      </Tabs>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  header: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 14,
    backgroundColor: colors.background,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  mascot: { width: 45, height: 48 },
  brandName: { fontFamily: "LexendSemiBold", fontSize: 23, color: colors.ink },
  title: {
    fontFamily: "LexendSemiBold",
    fontSize: 29,
    lineHeight: 39,
    textAlign: "center",
    color: colors.ink,
  },
  segments: {
    flexDirection: "row",
    backgroundColor: "#D6E7FB",
    borderRadius: 999,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  segmentSelected: { backgroundColor: colors.blue },
  segmentText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.ink,
  },
  segmentTextSelected: { color: colors.surface },
});
