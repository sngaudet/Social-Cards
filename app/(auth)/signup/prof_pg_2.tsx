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

export default function SignupIceBreakersStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [iceBreakerOne, setIceBreakerOne] = useState(draft.iceBreakerOne ?? "");
  const [iceBreakerTwo, setIceBreakerTwo] = useState(draft.iceBreakerTwo ?? "");
  const [iceBreakerThree, setIceBreakerThree] = useState(
    draft.iceBreakerThree ?? ""
  );

  const onNext = () => {
    if (!iceBreakerOne.trim() || !iceBreakerTwo.trim() || !iceBreakerThree.trim()) {
      Alert.alert("Missing fields", "Please answer all ice breaker questions.");
      return;
    }

    updateDraft({
      iceBreakerOne: iceBreakerOne.trim(),
      iceBreakerTwo: iceBreakerTwo.trim(),
      iceBreakerThree: iceBreakerThree.trim(),
    });

    router.replace("/(auth)/signup/prof_pg_3");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ice Breakers</Text>

      <TextInput
        placeholder="What's your ideal weekend?"
        placeholderTextColor="#4f4f4f"
        value={iceBreakerOne}
        onChangeText={setIceBreakerOne}
        style={styles.input}
      />

      <TextInput
        placeholder="What food can you never say no to?"
        placeholderTextColor="#4f4f4f"
        value={iceBreakerTwo}
        onChangeText={setIceBreakerTwo}
        style={styles.input}
      />

      <TextInput
        placeholder="Share one fun fact about yourself"
        placeholderTextColor="#4f4f4f"
        value={iceBreakerThree}
        onChangeText={setIceBreakerThree}
        style={styles.input}
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
