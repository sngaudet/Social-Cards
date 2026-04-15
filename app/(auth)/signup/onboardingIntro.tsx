import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";

export default function Onboarding() {
  const router = useRouter();
  // const onLogin = () => {
  //     router.replace("/(auth)/signup/hobbies");
  // }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* this is how to reference an image */}
      <LinearGradient
        colors={["#EEF5FF", "#DDEBFF"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.imageWrap}
      >
        <Image
          source={require("../../../assets/images/Ice Cube Photopea 1.png")}
          style={styles.welcomeLogo}
        />
      </LinearGradient>

      {/*<Text style={styles.title}>Onboarding Intro Page</Text>*/}
      <Text style={styles.title}>Nearby intro Cards, {"\n"} not a map</Text>

      <Text style={styles.thirdText}>
        See who is nearby. Your location is {"\n"}
        private, but is needed to make {"\n"}
        connections with other users.
      </Text>

      <PrimaryButton
        title="Next Step"
        showArrow
        style={styles.primaryButton}
        onPress={() => router.replace("/(auth)/signup/onboardingPermission")}
      />
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.back()}
      >
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#D9E0F0" },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#D9E0F0",
  },
  title: {
    fontSize: 38,
    fontWeight: "600",
    marginBottom: 44,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 14,
    marginBottom: 36,
  },
  primaryButton: {
    marginBottom: 12,
  },

  secondaryButton: {
    padding: 16,
    borderRadius: 8,
    textAlign: "center",
    marginBottom: 30,
  },
  secondaryText: {
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  thirdText: {
    color: "black",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    width: 300,
  },

  imageWrap: {
    width: 400,
    height: 400,
    borderRadius: 25,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    backgroundColor: "#F3F7FF", // solid, not gradient
    shadowColor: "#8AB4FF",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  welcomeLogo: {
    width: 300,
    height: 300,
  },
});
