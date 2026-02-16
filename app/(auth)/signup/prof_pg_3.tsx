import React, { useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSignup } from "../../../src/signup/context";

export default function SignupHobbiesStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [hobbies, setHobbies] = useState(draft.hobbies ?? "");

  const onNext = () => {
    if (!hobbies.trim()) {
      Alert.alert("Missing fields", "Please add at least one hobby.");
      return;
    }

    updateDraft({ hobbies: hobbies.trim() });
    router.replace("/(auth)/signup/review");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hobbies</Text>

      <TextInput
        placeholder="List your hobbies (ex: Basketball, Reading, Cooking)"
        placeholderTextColor="#4f4f4f"
        value={hobbies}
        onChangeText={setHobbies}
        style={[styles.input, styles.multilineInput]}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
        <Text style={styles.primaryText}>Next</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
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
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: { color: "white", fontWeight: "600" },
  secondaryButton: { padding: 16, borderRadius: 8, alignItems: "center" },
  secondaryText: { color: "#666" },
});
