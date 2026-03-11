import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";
import SubButton from "../../../src/components/SubButton";
import { requestLocationPermissions } from "../../../src/location/service";
import { useSignup } from "../../../src/signup/context";


export default function OnboardingPermissionPage(){
    const router = useRouter();
    const { updateDraft } = useSignup();
    const [requesting, setRequesting] = useState(false);

    const handleEnablePermissions = async () => {
      try {
        setRequesting(true);
        const permissionStatus = await requestLocationPermissions();
        const sharingEnabled =
          permissionStatus === "always" || permissionStatus === "while_in_use";

        updateDraft({
          locationSharingEnabled: sharingEnabled,
          locationPermissionStatus: permissionStatus,
        });

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

            <Image
              source={require('../../../assets/images/onPermissionIcon.png')} style={styles.permissionLogo}
              />

            <Text style={styles.title}>Onboarding Permission Page / Let’s get you connected</Text>


            <Text style={styles.subtitle}>
             To help you meet students nearby we need a couple of permissions.
            </Text>

            {/* PERMISSIONS CARD */}
            <View style={styles.permissionCard}>
        
              {/* Location */}
              <View style={styles.permissionRow}>
                <Ionicons name="location-outline" size={26} color="#4A7CFF" />

                <View style={styles.permissionTextContainer}>
                  <Text style={styles.permissionTitle}>Location Access</Text>
                  <Text style={styles.permissionDescription}>
                    Required to find students within walking distance. Your exact
                    location is never shared publicly.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Notifications  */}
              <View style={styles.permissionRow}>
              <Ionicons name="notifications-outline" size={26} color="#9C27B0" />

                <View style={styles.permissionTextContainer}>
                  <Text style={styles.permissionTitle}>Notifications</Text>
                  <Text style={styles.permissionDescription}>
                    Get notified immediately when 8+ people nearby or when a timed
                    chat is about to expire.
                  </Text>
                </View>
              </View>

            </View>

            <View style={styles.infoContainer}>
              <Ionicons name="information-circle-outline" size={18} color="#F59E0B" />

              <Text style={styles.infoText}>
                Without location access, discovery features will be disabled. You can
                change these settings anytime in your phone settings.
              </Text>
            </View>

            {/* Buttons  */}
            <PrimaryButton
              title={requesting ? "Enabling..." : "Enable Permissions"}
              style={styles.primaryButton}
              onPress={handleEnablePermissions}
              disabled={requesting}
            />

            <SubButton
              title="Not Now"
              style={styles.skipButton}
              onPress={() => {
                updateDraft({
                  locationSharingEnabled: false,
                  locationPermissionStatus: "unknown",
                });
                router.replace("/(auth)/signup/registrationComplete");
              }}
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
 
  primaryButton: {
    marginBottom: 12,
  },
  
  permissionLogo: {
    width: 300,
    height: 300,
    marginBottom: 20,
  },
  
  skipButton: {
    marginTop: 8,
  },


  floatingLocation: {
    position: "absolute",
    right: 0,
    top: 20,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 20,
  },

  floatingBell: {
    position: "absolute",
    left: 0,
    bottom: 20,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 20,
  },

  permissionCard: {
    width: "100%",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
  },

  permissionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  permissionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },

  permissionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },

  permissionDescription: {
    fontSize: 14,
    color: "#666",
  },

  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 30,
    maxWidth: 320,
  },

  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 16,
  },

  infoContainer: {
  flexDirection: "row",
  alignItems: "flex-start",
  marginBottom: 30,
  maxWidth: 320,
  },

  infoText: {
    fontSize: 13,
    color: "#777",
    marginLeft: 8,
    flex: 1,
  },

});
