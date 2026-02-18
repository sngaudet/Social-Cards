import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
  const [age, setAge] = useState<number | null>(
    draft.age ? Number(draft.age) : null,
  );
  const [gradYear, setGradYear] = useState<number | null>(
    draft.gradYear ?? null,
  );
  const [major, setMajor] = useState(draft.major ?? "");

  const onNext = () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !gender.trim() ||
      !age ||
      !gradYear ||
      !major.trim()
    ) {
      Alert.alert("Missing fields", "Please complete all profile fields.");
      return;
    }

    updateDraft({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      Gender: gender.trim(),
      age: age,
      gradYear: gradYear,
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

      <Text style={styles.label}>Gender</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={gender}
          onValueChange={(value) => setGender(value)}
        >
          <Picker.Item label="Select gender..." value="" />
          <Picker.Item label="Male" value="male" />
          <Picker.Item label="Female" value="female" />
          <Picker.Item label="MTF (Trans Woman)" value="mtf" />
          <Picker.Item label="FTM (Trans Man)" value="ftm" />
          <Picker.Item label="Androgynous" value="androgynous" />
          <Picker.Item label="Non-binary" value="nonbinary" />
          <Picker.Item label="Genderfluid" value="genderfluid" />
          <Picker.Item label="Agender" value="agender" />
          <Picker.Item label="Other" value="other" />
          <Picker.Item label="Prefer not to say" value="prefer_not_to_say" />
        </Picker>
      </View>

      <Text style={styles.label}>Age</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={age}
          onValueChange={(itemValue) => setAge(itemValue)}
        >
          <Picker.Item label="Select age..." value={null} />
          {Array.from({ length: 63 }, (_, i) => 18 + i).map((num) => (
            <Picker.Item key={num} label={num.toString()} value={num} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Graduation Year</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={gradYear}
          onValueChange={(value) => setGradYear(value)}
        >
          <Picker.Item label="Select graduation year..." value={null} />
          {Array.from({ length: 25 }, (_, i) => 2026 + i).map((year) => (
            <Picker.Item key={year} label={year.toString()} value={year} />
          ))}
        </Picker>
      </View>

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

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.back()}
      >
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
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: "#444",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 16,
  },
});
