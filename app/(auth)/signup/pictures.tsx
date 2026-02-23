// app/(auth)/signup/pictures.tsx
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSignup } from "../../../src/signup/context"; // adjust if your path differs

export default function SignupPictures() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  // We store local URIs in draft.photoUris for later upload in review.tsx
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

      setImages((prev) => {
        // de-dupe just in case
        if (prev.includes(uri)) return prev;
        return [...prev, uri];
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to pick image.");
    } finally {
      setBusy(false);
    }
  };

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((x) => x !== uri));
  };

  const handleNext = () => {
    if (images.length === 0) {
      Alert.alert(
        "Missing photo",
        "Please select at least one photo (or tap Skip).",
      );
      return;
    }

    // Save local URIs in draft for review.tsx to upload AFTER createUserWithEmailAndPassword
    updateDraft({ photoUris: images });

    // Go to next step — change this route to your actual next signup file
    router.push("/(auth)/signup/review");
  };

  const handleSkip = () => {
    updateDraft({ photoUris: [] });
    router.push("/(auth)/signup/review");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Upload Your Photos</Text>
      <Text style={styles.subtitle}>
        Choose one or more photos now. We’ll upload them after your account is
        created.
      </Text>

      <View style={{ width: "100%", gap: 10 }}>
        <Button
          title={busy ? "Opening..." : "Pick a Photo"}
          onPress={pickImage}
          disabled={busy}
        />
      </View>

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

      <TouchableOpacity
        style={styles.nextButton}
        onPress={handleNext}
        disabled={busy}
      >
        {busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator />
            <Text style={styles.nextButtonText}>Working...</Text>
          </View>
        ) : (
          <Text style={styles.nextButtonText}>Next</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={busy}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  subtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 14,
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

  nextButton: {
    backgroundColor: "#3399ff",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    minWidth: 200,
    alignItems: "center",
  },
  nextButtonText: { color: "#fff", fontWeight: "bold" },

  skipButton: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderColor: "#999",
    borderWidth: 1,
    backgroundColor: "#eee",
    minWidth: 200,
    alignItems: "center",
  },
  skipButtonText: { color: "#333", fontWeight: "bold" },
});
