import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import {
  hobbiesToInputValue,
  parseHobbiesInput,
} from "../../../src/lib/hobbies";
import { useSignup } from "../../../src/signup/context";

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function SignupHobbiesStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [hobbiesInput, setHobbiesInput] = useState(
    hobbiesToInputValue(draft.hobbies),
  );

  const onNext = () => {
    const hobbies = parseHobbiesInput(hobbiesInput);

    if (hobbies.length === 0) {
      showAlert("Missing fields", "Please add at least one hobby.");
      return;
    }

    updateDraft({ hobbies });
    router.replace("/(auth)/signup/pictures");
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ProgressHeader currentStep={3} />

      <SignupScreenHeader
        title="What are you into?"
        subtitle="Pick your interests to help us match you with the right crowd."
      />

      <TextInput
        placeholder="List your hobbies (ex: Basketball, Reading, Cooking)"
        placeholderTextColor="#4f4f4f"
        value={hobbiesInput}
        onChangeText={setHobbiesInput}
        style={[styles.input, styles.multilineInput]}
        multiline
        textAlignVertical="top"
      />

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
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  multilineInput: {
    minHeight: 120,
  },
  primaryButton: {
    alignSelf: "center",
    marginBottom: 12,
  },
  secondaryButton: { padding: 16, borderRadius: 8, alignItems: "center" },
  secondaryText: { color: "#666" },
});
