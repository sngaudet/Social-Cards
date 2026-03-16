import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupFormField from "../../../src/components/SignupFormField";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import { useSignup } from "../../../src/signup/context";

const LEFT_PRONOUN_OPTIONS = ["she", "he", "they"] as const;
const RIGHT_PRONOUN_OPTIONS = ["her", "him", "they", "them"] as const;

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function getInitialPronouns(value: string | undefined) {
  const [left, right] = (value ?? "").split("/");
  const normalizedLeft = LEFT_PRONOUN_OPTIONS.includes(left as (typeof LEFT_PRONOUN_OPTIONS)[number])
    ? left
    : "she";
  const normalizedRight = RIGHT_PRONOUN_OPTIONS.includes(right as (typeof RIGHT_PRONOUN_OPTIONS)[number])
    ? right
    : normalizedLeft === "he"
      ? "him"
      : normalizedLeft === "they"
        ? "them"
        : "her";

  return { leftPronoun: normalizedLeft, rightPronoun: normalizedRight };
}

export default function SignupAcademicProfileStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();
  const initialPronouns = getInitialPronouns(draft.pronouns);

  const [leftPronoun, setLeftPronoun] = useState(initialPronouns.leftPronoun);
  const [rightPronoun, setRightPronoun] = useState(initialPronouns.rightPronoun);
  const [major, setMajor] = useState(draft.major ?? "");
  const [minor, setMinor] = useState(draft.minor ?? "");
  const [gradYear, setGradYear] = useState<number | null>(draft.gradYear ?? null);

  const years = useMemo(() => {
    const start = 2026;
    return Array.from({ length: 25 }, (_, i) => start + i);
  }, []);

  const onNext = () => {
    if (!major.trim() || !minor.trim() || gradYear == null) {
      showAlert("Missing fields", "Please complete all fields.");
      return;
    }

    updateDraft({
      pronouns: `${leftPronoun}/${rightPronoun}`,
      major: major.trim(),
      minor: minor.trim(),
      gradYear,
    });

    router.push("/(auth)/signup/avatarPicker");
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ProgressHeader currentStep={5} />

      <SignupScreenHeader
        title="Academic profile"
        subtitle="Tell us a bit about your studies. This helps find students in your classes."
      />

      <SignupFormField
        label="Pronouns"
        contentStyle={styles.pronounsField}
      >
        <View style={styles.pronounPickerColumn}>
          <Picker
            selectedValue={leftPronoun}
            onValueChange={(value) => setLeftPronoun(String(value))}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            dropdownIconColor="#0B1533"
          >
            {LEFT_PRONOUN_OPTIONS.map((option) => (
              <Picker.Item
                key={option}
                label={option.charAt(0).toUpperCase() + option.slice(1)}
                value={option}
              />
            ))}
          </Picker>
        </View>
        <View style={styles.pronounDivider}>
          <Text style={styles.pronounDividerText}>/</Text>
        </View>
        <View style={styles.pronounPickerColumn}>
          <Picker
            selectedValue={rightPronoun}
            onValueChange={(value) => setRightPronoun(String(value))}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            dropdownIconColor="#0B1533"
          >
            {RIGHT_PRONOUN_OPTIONS.map((option) => (
              <Picker.Item
                key={option}
                label={option.charAt(0).toUpperCase() + option.slice(1)}
                value={option}
              />
            ))}
          </Picker>
        </View>
      </SignupFormField>

      <SignupFormField label="Major">
        <TextInput
          placeholder="e.g. Computer Science"
          placeholderTextColor="#9CA3AF"
          value={major}
          onChangeText={setMajor}
          style={styles.input}
        />
        <Feather name="book" size={20} color="#90AEFF" style={styles.trailingIcon} />
      </SignupFormField>

      <SignupFormField label="Minor">
        <TextInput
          placeholder="e.g. Math"
          placeholderTextColor="#9CA3AF"
          value={minor}
          onChangeText={setMinor}
          style={styles.input}
        />
        <Feather name="book-open" size={20} color="#90AEFF" style={styles.trailingIcon} />
      </SignupFormField>

      <SignupFormField label="Graduation Year" contentStyle={styles.yearField}>
        <Picker
          selectedValue={gradYear}
          onValueChange={(value) => setGradYear(value === null ? null : Number(value))}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          dropdownIconColor="#0B1533"
        >
          <Picker.Item label="Select graduation year..." value={null} />
          {years.map((year) => (
            <Picker.Item key={year} label={String(year)} value={year} />
          ))}
        </Picker>
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
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    lineHeight: 24,
    color: "#6B7280",
  },
  pronounsField: {
    paddingHorizontal: Platform.OS === "ios" ? 8 : 12,
    minHeight: Platform.OS === "ios" ? 170 : 64,
    alignItems: "stretch",
    paddingTop: 0,
    paddingBottom: 0,
  },
  pronounPickerColumn: {
    flex: 1,
    justifyContent: "center",
  },
  pronounDivider: {
    alignSelf: "center",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EAF4FF",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  pronounDividerText: {
    fontSize: 20,
    lineHeight: 24,
    color: "#5D7FC9",
    fontWeight: "700",
  },
  yearField: {
    paddingHorizontal: Platform.OS === "ios" ? 8 : 12,
    minHeight: Platform.OS === "ios" ? 170 : 64,
    alignItems: "stretch",
    paddingTop: 0,
    paddingBottom: 0,
  },
  picker: {
    flex: 1,
    color: "#0B1533",
    marginTop: Platform.OS === "ios" ? -12 : 0,
    marginBottom: Platform.OS === "ios" ? -12 : 0,
  },
  pickerItem: {
    color: "#0B1533",
    fontSize: 18,
  },
  primaryButton: { alignSelf: "center", marginBottom: 16 },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryText: { color: "#444", fontSize: 14 },
});
