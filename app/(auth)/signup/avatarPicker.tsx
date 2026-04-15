import { Href, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AvatarOptionTile from "../../../src/components/AvatarOptionTile";
import PrimaryButton from "../../../src/components/PrimaryButton";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import { AVATAR_IMAGE_OPTIONS } from "../../../src/lib/avatarImages";
import { useSignup } from "../../../src/signup/context";

const GRID_SIZE = 15;

const AVATAR_CELLS = Array.from({ length: GRID_SIZE }, (_, index) => {
  const option = AVATAR_IMAGE_OPTIONS[index];
  return option
    ? option
    : {
      id: `blank-${index}`,
      imageSource: undefined,
    };
});

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function SignupAvatarPickerStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();
  const [selectedAvatarId, setSelectedAvatarId] = useState(draft.avatarId ?? "");

  const onNext = () => {
    if (!selectedAvatarId) {
      showAlert("Choose an avatar", "Pick an avatar before continuing.");
      return;
    }

    updateDraft({ avatarId: selectedAvatarId });
    router.push("/(auth)/signup/pictures" as Href);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ProgressHeader currentStep={6} />

      <SignupScreenHeader
        title="Pick your avatar"
        subtitle="This is what others see before you connect. You can reveal your real photo later."
      />

      <View style={styles.grid}>
        {AVATAR_CELLS.map((option) => (
          <AvatarOptionTile
            key={option.id}
            imageSource={option.imageSource}
            selected={Boolean(option.imageSource) && option.id === selectedAvatarId}
            onPress={
              option.imageSource
                ? () => {
                  setSelectedAvatarId(option.id);
                  updateDraft({ avatarId: option.id });
                }
                : undefined
            }
          />
        ))}
      </View>

      <PrimaryButton
        title="Next Step"
        showArrow
        style={styles.primaryButton}
        onPress={onNext}
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
    backgroundColor: "#D9E0F0",
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  primaryButton: {
    alignSelf: "center",
    marginTop: 20,
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
