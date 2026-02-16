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

export default function SignupProfileStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [firstName, setFirstName] = useState(draft.firstName ?? "");
  const [lastName, setLastName] = useState(draft.lastName ?? "");
  const [gender, setGender] = useState(draft.Gender ?? "");
  const [age, setAge] = useState(draft.age ?? "");
  const [gradYear, setGradYear] = useState(draft.gradYear ?? "");
  const [major, setMajor] = useState(draft.major ?? "");

  const onNext = () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !gender.trim() ||
      !age.trim() ||
      !gradYear.trim() ||
      !major.trim()
    ) {
      Alert.alert("Missing fields", "Please complete all profile fields.");
      return;
    }

    updateDraft({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      Gender: gender.trim(),
      age: age.trim(),
      gradYear: gradYear.trim(),
      major: major.trim(),
    });

    router.replace("/(auth)/signup/prof_pg_2");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Setup</Text>

      <TextInput
        placeholder="First Name"
        placeholderTextColor="#4f4f4f"
        value={firstName}
        onChangeText={setFirstName}
        style={styles.input}
      />

      <TextInput
        placeholder="Last Name"
        placeholderTextColor="#4f4f4f"
        value={lastName}
        onChangeText={setLastName}
        style={styles.input}
      />

      <TextInput
        placeholder="Gender"
        placeholderTextColor="#4f4f4f"
        value={gender}
        onChangeText={setGender}
        style={styles.input}
      />

      <TextInput
        placeholder="Age"
        placeholderTextColor="#4f4f4f"
        keyboardType="numeric"
        value={age}
        onChangeText={setAge}
        style={styles.input}
      />

      <TextInput
        placeholder="Grad Year"
        placeholderTextColor="#4f4f4f"
        keyboardType="numeric"
        value={gradYear}
        onChangeText={setGradYear}
        style={styles.input}
      />

      <TextInput
        placeholder="Major"
        placeholderTextColor="#4f4f4f"
        value={major}
        onChangeText={setMajor}
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
