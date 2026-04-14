import DateTimePicker from "@react-native-community/datetimepicker";
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
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupFormField from "../../../src/components/SignupFormField";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import { useSignup } from "../../../src/signup/context";

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}


export default function SignupPersonalProfileStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [firstName, setFirstName] = useState(draft.firstName ?? "");
  const [lastName, setLastName] = useState(draft.lastName ?? "");
 
  const [bio, setBio] = useState(draft.bio ?? "");

  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const onNext = () => {
  const trimmedBio = bio.trim();

  if (!firstName.trim() || !lastName.trim() || !dateOfBirth || !trimmedBio) {
    showAlert("Missing fields", "Please complete all fields.");
    return;
  }

  const normalizedDOB = dateOfBirth.toISOString().split("T")[0];

  updateDraft({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    dateOfBirth: normalizedDOB,
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
      {/* <Text style={styles.requiredText}>* All fields are required to be filled in</Text> */}
      <Text> </Text>
      <SignupFormField label={<Text>First Name<Text style={styles.requiredText}>*</Text></Text>} >
        <TextInput
          placeholder="e.g. Alex"
          placeholderTextColor="#9CA3AF"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />
        <IdCard size={20} color="#0b0b0b" strokeWidth={2} style={styles.trailingIcon} />
      </SignupFormField>

      <SignupFormField label={<Text>Last Name<Text style={styles.requiredText}>*</Text></Text>}>
        <TextInput
          placeholder="e.g. Fauly"
          placeholderTextColor="#9CA3AF"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
        />
        <IdCard size={20} color="#0b0b0b" strokeWidth={2} style={styles.trailingIcon} />
      </SignupFormField>

      <SignupFormField label={<Text>Date of Birth<Text style={styles.requiredText}>*</Text></Text>}>
        {Platform.OS === "web" ? (
          <input
            type="date"
            value={dateOfBirth ? dateOfBirth.toISOString().split("T")[0] : ""}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => {
              if (e.target.value) {
                setDateOfBirth(new Date(e.target.value));
              }
            }}
            style={{
              width: "100%",
              padding: "16px 0",
              fontSize: "18px",
              border: "none",
              background: "transparent",
              color: "#6B7280",
              outline: "none",
              cursor: "pointer",
            }}
          />
        ) : (
          <TouchableOpacity
            style={styles.datePressable}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={dateOfBirth ? styles.dateText : styles.datePlaceholder}>
              {dateOfBirth ? `${dateOfBirth.toLocaleString("default", { month: "long" })} ${dateOfBirth.getDate()} ${dateOfBirth.getFullYear()}` : "Select date of birth"}
            </Text>
            <CalendarDays size={20} color="#0b0b0b" />
          </TouchableOpacity>
        )}
      </SignupFormField>

      <Text style={styles.dateHint}>You must be 18 or older to use Icebreakers.</Text>

      <SignupFormField
        label={<Text>Short Bio<Text style={styles.requiredText}>*</Text></Text>}
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

      {showPicker && Platform.OS !== "web" && (
        <DateTimePicker
          value={dateOfBirth ?? new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowPicker(false);
            if (selectedDate) {
              setDateOfBirth(selectedDate);
            }
          }}
        />
      )}
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
  datePressable: {
    flex: 1,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 18,
    color: "#6B7280",
  },
  datePlaceholder: {
    fontSize: 18,
    color: "#9CA3AF",
  },
  requiredText: { color: "#aa1515", fontSize: 20,},
  primaryButton: { alignSelf: "center", marginBottom: 16 },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryText: { color: "#444", fontSize: 14 },
});
