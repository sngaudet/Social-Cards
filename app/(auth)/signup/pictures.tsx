// app/(auth)/signup/pictures.tsx
import { Feather } from "@expo/vector-icons";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import SubButton from "../../../src/components/SubButton";
import { useSignup } from "../../../src/signup/context"; // adjust if your path differs

export default function SignupPictures() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  // We store local URIs in draft.photoUris for final account creation.
  const initial = useMemo(
    () => (draft.photoUris as string[] | undefined) ?? [],
    [draft.photoUris],
  );
  const [images, setImages] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);

  const pickImage = async () => {
    try {
      setBusy(true);

      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        quality: 0.7,
        // New API: ImagePicker.MediaType / array of types
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      const nextImages = images.includes(uri) ? images : [...images, uri];

      setImages(nextImages);
      updateDraft({ photoUris: nextImages });
      //    router.push("/(auth)/signup/onboardingIntro");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to pick image.");
    } finally {
      setBusy(false);
    }
  };

  const removeImage = (uri: string) => {
    const nextImages = images.filter((x) => x !== uri);
    setImages(nextImages);
    updateDraft({ photoUris: nextImages });
  };

  const handleSkip = () => {
    updateDraft({ photoUris: [] });
    router.push("/(auth)/signup/onboardingIntro");
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ProgressHeader currentStep={7} />

      <SignupScreenHeader
        title="Put a face to the name"
        subtitle="Help people recognize you on campus when you decide to connect."
      />

      <View style={styles.uploadContainer}>
        {images.length === 0 ? (
          <View style={styles.placeholder}>
            <Feather name="image" size={40} color="#999" />
            <Text style={styles.placeholderText}>Upload a photo</Text>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            {images.map((uri) => (
              <View key={uri} style={styles.thumbWrap}>
                <Image
                  source={{ uri }}
                  style={styles.image}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => removeImage(uri)}
                  style={styles.removeBadge}
                  accessibilityLabel="Remove photo"
                >
                  <Text style={styles.removeBadgeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.privacyCard}>
        <View style={styles.permissionRow}>
          {/* <Ionicons name="notifications-outline" size={26} color="#9C27B0" /> */}
          <FontAwesome6 name="user-lock" size={24} color="#f4e071" />

          <View style={styles.privacyInfo}>
            <Text style={styles.privacyTitle}>Privacy First</Text>
            <Text style={styles.privacyDescription}>
              Your photos is{" "}
              <Text style={{ color: "blue" }}>hidden by default</Text>, it is
              only {"\n"}
              revealed after you match and both agree to connect.
            </Text>
          </View>
        </View>
      </View>

      <PrimaryButton
        //title={busy ? "Opening..." : "Upload Photo"}
        title={
          images.length === 0
            ? busy
              ? "Opening..."
              : "Upload Photo"
            : "Keep Photo"
        }
        //leftIcon={<Feather name="upload" size={18} color="#FFFFFF" />}
        leftIcon={
          images.length === 0 ? (
            <Feather name="upload" size={18} color="#FFFFFF" />
          ) : undefined
        }
        style={styles.uploadButton}
        //onPress={pickImage}
        onPress={() => {
          if (images.length === 0) {
            pickImage();
          } else {
            router.push("/(auth)/signup/onboardingIntro");
          }
        }}
        disabled={busy}
      />

      <SubButton
        title="Not Now"
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={busy}
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
  scroll: {
    flex: 1,
    backgroundColor: "#D9E0F0",
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    alignItems: "center",
    backgroundColor: "#D9E0F0",
  },
  uploadButton: {
    marginBottom: 4,
  },
  previewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginVertical: 14,
    justifyContent: "center",
    gap: 10,
  },

  thumbWrap: {
    position: "relative",
  },

  //image: { width: 110, height: 110, borderRadius: 10 },
  image: { width: 175, height: 175, borderRadius: 10 },

  removeBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBadgeText: { color: "white", fontWeight: "800", fontSize: 14 },

  skipButton: {
    marginTop: 8,
  },

  uploadContainer: {
    //width: "100%",
    width: 180,
    //maxWidth: 180,
    height: 180,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
    //overflow: "hidden",
  },

  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
  },
  placeholderText: {
    marginTop: 8,
    color: "#999",
    fontSize: 16,
  },

  permissionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  privacyInfo: {
    marginLeft: 12,
    flex: 1,
  },

  privacyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },

  privacyDescription: {
    fontSize: 14,
    color: "#666",
  },

  privacyCard: {
    width: "100%",
    maxWidth: 350,
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
  },
  secondaryButton: {
    padding: 12,
    alignItems: "center",
  },
  secondaryText: {
    color: "#444",
    fontSize: 14,
  },
});
