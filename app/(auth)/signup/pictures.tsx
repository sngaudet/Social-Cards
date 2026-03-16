// app/(auth)/signup/pictures.tsx
import { Feather } from "@expo/vector-icons";
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
      router.push("/(auth)/signup/onboardingIntro");
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
    <ScrollView contentContainerStyle={styles.container}>
      <ProgressHeader currentStep={7} />

      <SignupScreenHeader
        title="Upload Your Photos"
        subtitle="Choose one or more photos now. We’ll upload them after your account is created."
      />

      <PrimaryButton
        title={busy ? "Opening..." : "Upload Photo"}
        leftIcon={<Feather name="upload" size={18} color="#FFFFFF" />}
        style={styles.uploadButton}
        onPress={pickImage}
        disabled={busy}
      />

      <View style={styles.previewContainer}>
        {images.map((uri) => (
          <View key={uri} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.image} resizeMode="cover" />
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

      <SubButton
        title="Not Now"
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    alignItems: "center",
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

  image: { width: 110, height: 110, borderRadius: 10 },

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
});
