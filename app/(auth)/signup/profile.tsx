import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";


import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";
import { useSignup } from "../../../src/signup/context";

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function SignupProfileStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [firstName, setFirstName] = useState(draft.firstName ?? "");
  const [lastName, setLastName] = useState(draft.lastName ?? "");
  const [gender, setGender] = useState(draft.Gender ?? "");
  const [age, setAge] = useState<number | null>(draft.age ?? null);
  const [gradYear, setGradYear] = useState<number | null>(draft.gradYear ?? null);
  const [major, setMajor] = useState(draft.major ?? "");

  const onNext = () => {
    if (!firstName || !lastName || !gender || !age || !gradYear || !major) {
      showAlert("Missing fields", "Please complete all fields.");
      return;
    }

    updateDraft({
      firstName,
      lastName,
      Gender: gender,
      age,
      gradYear,
      major,
    });

    router.push("/(auth)/signup/avatarPicker");
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Progress Bar */}
<ProgressHeader currentStep={4} />


      {/* Header */}
<SignupScreenHeader
  title="Profile Setup"
  subtitle="Tell other students a bit about yourself."
/>

      {/* First Name */}
      <Text style={styles.label}>First Name</Text>
      <View style={styles.inputWrapper}>
        <Feather name="user" size={20} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="e.g. Alex"
          placeholderTextColor="#4f4f4f"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />
      </View>

      {/* Last Name */}
      <Text style={styles.label}>Last Name</Text>
      <View style={styles.inputWrapper}>
        <Feather name="user" size={20} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="e.g. Smith"
          placeholderTextColor="#4f4f4f"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
        />
      </View>

      {/* Gender */}
      <Text style={styles.label}>Gender</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={gender} onValueChange={(v) => setGender(v)}>
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

      {/* Age */}
      <Text style={styles.label}>Age</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={age} onValueChange={(v) => setAge(v)}>
          <Picker.Item label="Select age..." value={null} />
          {Array.from({ length: 79 }, (_, i) => 12 + i).map((num) => (
            <Picker.Item key={num} label={num.toString()} value={num} />
          ))}
        </Picker>
      </View>

      {/* Grad Year */}
      <Text style={styles.label}>Graduation Year</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={gradYear} onValueChange={(v) => setGradYear(v)}>
          <Picker.Item label="Select graduation year..." value={null} />
          {Array.from({ length: 25 }, (_, i) => 2026 + i).map((year) => (
            <Picker.Item key={year} label={year.toString()} value={year} />
          ))}
        </Picker>
      </View>

      {/* Major */}
      <Text style={styles.label}>Major</Text>
      <View style={styles.inputWrapper}>
        <Feather name="book" size={20} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="e.g. Computer Science"
          placeholderTextColor="#4f4f4f"
          value={major}
          onChangeText={setMajor}
          style={styles.input}
        />
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
  scroll: { flex: 1 },

  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },

  
  label: { fontWeight: "600", color: "#333", marginBottom: 6 },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f6fb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  input: { flex: 1, paddingVertical: 12, fontSize: 16 },

  pickerWrapper: {
    backgroundColor: "#f3f6fb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 16,
  },

  primaryButton: { alignSelf: "center", marginBottom: 16 },

  secondaryButton: { padding: 12, alignItems: "center" },

  secondaryText: { color: "#444", fontSize: 14 },
});
