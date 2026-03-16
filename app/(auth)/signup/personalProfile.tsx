import { useRouter } from "expo-router";
import { CalendarDays, IdCard } from "lucide-react-native";
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
import SignupFormField from "../../../src/components/SignupFormField";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import { normalizeDateOfBirth } from "../../../src/lib/profileFields";
import { useSignup } from "../../../src/signup/context";

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function toDisplayDateOfBirth(dateOfBirth: string) {
  const normalized = normalizeDateOfBirth(dateOfBirth);
  if (!normalized) {
    return "";
  }

  const [year, month, day] = normalized.split("-").map(Number);
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function SignupPersonalProfileStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [firstName, setFirstName] = useState(draft.firstName ?? "");
  const [lastName, setLastName] = useState(draft.lastName ?? "");
  const [dateOfBirthInput, setDateOfBirthInput] = useState(toDisplayDateOfBirth(draft.dateOfBirth));
  const [bio, setBio] = useState(draft.bio ?? "");

  const onNext = () => {
    const trimmedBio = bio.trim();
    const dateOfBirth = normalizeDateOfBirth(dateOfBirthInput);

    if (!firstName.trim() || !lastName.trim() || !dateOfBirth || !trimmedBio) {
      showAlert("Missing fields", "Please complete all fields.");
      return;
    }

    updateDraft({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth,
      bio: trimmedBio,
    });

    router.push("/(auth)/signup/academicProfile");
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ProgressHeader currentStep={4} />

      <SignupScreenHeader
        title="Let's get personal"
        subtitle="Share a bit about yourself so others can break the ice."
      />

      <SignupFormField label="First Name">
        <TextInput
          placeholder="e.g. Alex"
          placeholderTextColor="#9CA3AF"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />
        <IdCard size={20} color="#90AEFF" strokeWidth={2} style={styles.trailingIcon} />
      </SignupFormField>

      <SignupFormField label="Last Name">
        <TextInput
          placeholder="e.g. Fauly"
          placeholderTextColor="#9CA3AF"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
        />
        <IdCard size={20} color="#90AEFF" strokeWidth={2} style={styles.trailingIcon} />
      </SignupFormField>

      <SignupFormField label="Date of Birth">
        <TextInput
          placeholder="mm/dd/yyyy"
          placeholderTextColor="#9CA3AF"
          value={dateOfBirthInput}
          onChangeText={(value) => setDateOfBirthInput(formatDateInput(value))}
          style={styles.dateInput}
          keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
          maxLength={10}
        />
        <CalendarDays size={20} color="#90AEFF" strokeWidth={2} style={styles.trailingIcon} />
      </SignupFormField>
      <Text style={styles.dateHint}>You must be 18 or older to use Icebreakers.</Text>

      <SignupFormField
        label="Short Bio"
        rightLabel={`${bio.length}/140`}
        contentStyle={styles.bioWrapper}
      >
        <TextInput
          placeholder="I'm a sophomore studying Bio. I love coffee, late night coding, and..."
          placeholderTextColor="#9CA3AF"
          value={bio}
          onChangeText={(value) => setBio(value.slice(0, 140))}
          style={styles.bioInput}
          multiline
          textAlignVertical="top"
          maxLength={140}
        />
      </SignupFormField>

      <PrimaryButton
        title="Next Step"
        showArrow
        style={styles.primaryButton}
        onPress={onNext}
      />

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },
  trailingIcon: {
    marginLeft: 12,
  },
  dateHint: {
    marginTop: -4,
    marginBottom: 16,
    marginLeft: 4,
    color: "#4F8C7A",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    lineHeight: 24,
    color: "#6B7280",
  },
  dateInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    lineHeight: 24,
    color: "#6B7280",
  },
  bioWrapper: {
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: "flex-start",
  },
  bioInput: {
    width: "100%",
    minHeight: 110,
    fontSize: 18,
    lineHeight: 24,
    color: "#6B7280",
  },
  primaryButton: { alignSelf: "center", marginBottom: 16 },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryText: { color: "#444", fontSize: 14 },
});
