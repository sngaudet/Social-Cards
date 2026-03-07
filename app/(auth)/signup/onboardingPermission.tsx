import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";
import SubButton from "../../../src/components/SubButton";
import { requestLocationPermissions } from "../../../src/location/service";


export default function OnboardingPermissionPage(){
    const router = useRouter();
    const [requesting, setRequesting] = useState(false);

    const handleEnablePermissions = async () => {
      try {
        setRequesting(true);
        await requestLocationPermissions();
        router.replace("/(auth)/signup/registrationComplete");
      } catch (e: any) {
        Alert.alert(
          "Permission request failed",
          e?.message ?? "Could not request location permissions.",
        );
      } finally {
        setRequesting(false);
      }
    };
    
    return (
        <ScrollView contentContainerStyle = {styles.content} >
            {/* this is how to reference an image */}
            {/* <Image
              source={require('../assets/images/Ice Cube Photopea 1.png')} style={styles.welcomeLogo}
            /> */}

            <Text style={styles.title}>Onboarding Permission Page</Text>
            
            <PrimaryButton
              title={requesting ? "Enabling..." : "Enable Permissions"}
              style={styles.primaryButton}
              onPress={handleEnablePermissions}
              disabled={requesting}
            />

            <SubButton
              title="Not Now"
              style={styles.skipButton}
              onPress={() => router.replace("/(auth)/signup/registrationComplete")}
              disabled={requesting}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { 
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48, 
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#D9E0F0', 
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
  primaryText: { 
    color: "white", 
    fontWeight: "600", 
    textAlign: "center",
    marginBottom: 30, 
  },
  title2: {
    color: "black", 
    fontSize: 20, 
    fontWeight: "bold", 
    textAlign: "center",
    textShadowRadius: 2, 
    textShadowColor: "yellow",
    marginBottom: 30,
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
    width: 300
  },
  welcomeLogo: {
    width: 300,
    height: 300,
  },
  skipButton: {
    marginTop: 8,
  },
});
