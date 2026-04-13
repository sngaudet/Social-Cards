import { Href, Redirect, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { useSignup } from "../src/signup/context";

export default function Index() {
  const { user, initializing } = useAuth();
  const { resumeRoute, shouldResumeSignup } = useSignup();

    const params = useLocalSearchParams();
    console.log("Current Params while in index:", params);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if(params.showMessage === 'DeletedAccount'){
    return <Redirect href={{ pathname: "/(auth)/login", params }} />;
  }

  if (user) {
    return <Redirect href={{ pathname: "/(tabs)", params }} />;
  }

  if (shouldResumeSignup) {
    return <Redirect href={resumeRoute as Href} />;
  }

  return <Redirect href="/welcome" />;
}
