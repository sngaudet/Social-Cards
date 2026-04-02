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
import {
  AutocompleteDropdown,
  AutocompleteDropdownContextProvider,
  AutocompleteDropdownItem,
} from "react-native-autocomplete-dropdown";
import PrimaryButton from "../../../src/components/PrimaryButton";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupFormField from "../../../src/components/SignupFormField";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import { useSignup } from "../../../src/signup/context";

const LEFT_PRONOUN_OPTIONS = ["She/Her", "He/Him", "They/Them"] as const;
// const RIGHT_PRONOUN_OPTIONS = ["her", "him", "they", "them"] as const;
const OTHER_PROGRAM_OPTION_ID = "other";
const ACADEMIC_PROGRAM_OPTIONS: AutocompleteDropdownItem[] = [
  { id: "computer-science", title: "Computer Science" },
  { id: "data-science", title: "Data Science" },
  { id: "information-technology", title: "Information Technology" },
  { id: "cybersecurity", title: "Cybersecurity" },
  { id: "electrical-engineering", title: "Electrical Engineering" },
  { id: "mechanical-engineering", title: "Mechanical Engineering" },
  { id: "civil-engineering", title: "Civil Engineering" },
  { id: "chemical-engineering", title: "Chemical Engineering" },
  { id: "biomedical-engineering", title: "Biomedical Engineering" },
  { id: "mathematics", title: "Mathematics" },
  { id: "statistics", title: "Statistics" },
  { id: "physics", title: "Physics" },
  { id: "astrophysics", title: "Astrophysics" },
  { id: "chemistry", title: "Chemistry" },
  { id: "biology", title: "Biology" },
  { id: "geology", title: "Geology" },
  { id: "environmental-science", title: "Environmental Science" },
  { id: "business-administration", title: "Business Administration" },
  { id: "entrepreneurship", title: "Entrepreneurship" },
  { id: "supply-chain", title: "Supply Chain" },
  { id: "economics", title: "Economics" },
  { id: "finance", title: "Finance" },
  { id: "accounting", title: "Accounting" },
  { id: "marketing", title: "Marketing" },
  { id: "graphic-design", title: "Graphic Design" },
  { id: "fine-arts", title: "Fine Arts" },
  { id: "film-studies", title: "Film Studies" },
  { id: "photography", title: "Photography" },
  { id: "animation", title: "Animation" },
  { id: "music", title: "Music" },
  { id: "theater", title: "Theater" },
  { id: "performing-arts", title: "Performing Arts" },
  { id: "english", title: "English" },
  { id: "literature", title: "Literature" },
  { id: "creative-writing", title: "Creative Writing" },
  { id: "game-design", title: "Game Design" },
  { id: "psychology", title: "Psychology" },
  { id: "sociology", title: "Sociology" },
  { id: "political-science", title: "Political Science" },
  { id: "history", title: "History" },
  { id: "philosophy", title: "Philosophy" },
  { id: "communications", title: "Communications" },
  { id: "anthropology", title: "Anthropology" },
  { id: "international-relations", title: "International Relations" },
  { id: "nursing", title: "Nursing" },
  { id: "public-health", title: "Public Health" },
  { id: "kinesiology", title: "Kinesiology" },
  { id: "nutrition", title: "Nutrition" },
  { id: "pharmacy", title: "Pharmacy" },
  { id: "health-sciences", title: "Health Sciences" },
  { id: "criminal-justice", title: "Criminal Justice" },
  { id: "legal-studies", title: "Legal Studies" },
  { id: "public-administration", title: "Public Administration" },
  { id: "homeland-security", title: "Homeland Security" },
  { id: "criminology", title: "Criminology" },
  { id: "elementary-education", title: "Elementary Education" },
  { id: "secondary-education", title: "Secondary Education" },
  { id: "special-education", title: "Special Education" },
  { id: "early-childhood-education", title: "Early Childhood Education" },
  { id: "educational-psychology", title: "Educational Psychology" },
  { id: "architecture", title: "Architecture" },
  { id: "urban-planning", title: "Urban Planning" },
  { id: "agriculture", title: "Agriculture" },
  { id: "environmental-studies", title: "Environmental Studies" },
  { id: "hospitality", title: "Hospitality" },
  { id: "sports-management", title: "Sports Management" },
  { id: "aviation", title: "Aviation" },
  { id: OTHER_PROGRAM_OPTION_ID, title: "Other" },
];

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
/////////////
/////////////
/////////////
// function getInitialPronouns(value: string | undefined) {
//   const [left, right] = (value ?? "").split("/");
//   const normalizedLeft = LEFT_PRONOUN_OPTIONS.includes(
//     left as (typeof LEFT_PRONOUN_OPTIONS)[number],
//   )
//     ? left
//     : "she";
//   const normalizedRight = RIGHT_PRONOUN_OPTIONS.includes(
//     right as (typeof RIGHT_PRONOUN_OPTIONS)[number],
//   )
//     ? right
//     : normalizedLeft === "he"
//       ? "him"
//       : normalizedLeft === "they"
//         ? "them"
//         : "her";

//   return { leftPronoun: normalizedLeft, rightPronoun: normalizedRight };
// }
function getInitialPronouns(value: string | undefined) {
  const [left, right] = (value ?? "").split("/")[0];
  const normalizedLeft = LEFT_PRONOUN_OPTIONS.includes(
    left as (typeof LEFT_PRONOUN_OPTIONS)[number],
  )
    ? left
    : "she";
  // const normalizedRight = RIGHT_PRONOUN_OPTIONS.includes(
  //   right as (typeof RIGHT_PRONOUN_OPTIONS)[number],
  // )
  //   ? right
  //   : normalizedLeft === "he"
  //     ? "him"
  //     : normalizedLeft === "they"
  //       ? "them"
  //       : "her";

  return { leftPronoun: normalizedLeft };
}

function getAcademicProgramInitialValue(value: string) {
  if (!value.trim()) return undefined;

  const matchingOption = findAcademicProgramByTitle(value);

  return (
    matchingOption ??
    ACADEMIC_PROGRAM_OPTIONS.find(
      (option) => option.id === OTHER_PROGRAM_OPTION_ID,
    )
  );
}

function isPresetAcademicProgram(value: string) {
  return ACADEMIC_PROGRAM_OPTIONS.some(
    (option) => option.id !== OTHER_PROGRAM_OPTION_ID && option.title === value,
  );
}

function findAcademicProgramByTitle(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return undefined;
  }

  return ACADEMIC_PROGRAM_OPTIONS.find(
    (option) => option.title?.trim().toLowerCase() === normalizedValue,
  );
}

export default function SignupAcademicProfileStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();
  const initialPronouns = getInitialPronouns(draft.pronouns);

  const [leftPronoun, setLeftPronoun] = useState(initialPronouns.leftPronoun);
  // const [rightPronoun, setRightPronoun] = useState(
  //   initialPronouns.rightPronoun,
  // );
  const [major, setMajor] = useState(draft.major ?? "");
  const [majorSearchText, setMajorSearchText] = useState(draft.major ?? "");
  const [minor, setMinor] = useState(draft.minor ?? "");
  const [minorSearchText, setMinorSearchText] = useState(draft.minor ?? "");
  const [isCustomMajor, setIsCustomMajor] = useState(
    Boolean(draft.major?.trim()) && !isPresetAcademicProgram(draft.major ?? ""),
  );
  const [isCustomMinor, setIsCustomMinor] = useState(
    Boolean(draft.minor?.trim()) && !isPresetAcademicProgram(draft.minor ?? ""),
  );
  const [gradYear, setGradYear] = useState<number | null>(
    draft.gradYear ?? null,
  );

  const years = useMemo(() => {
    const start = 2026;
    return Array.from({ length: 25 }, (_, i) => start + i);
  }, []);

  const commitPresetAcademicProgram = (
    field: "major" | "minor",
    item?: AutocompleteDropdownItem | null,
  ) => {
    const nextValue = item?.title ?? "";

    if (field === "major") {
      setMajor(nextValue);
      setMajorSearchText(nextValue);
      return;
    }

    setMinor(nextValue);
    setMinorSearchText(nextValue);
  };

  const handleAcademicProgramBlur = (field: "major" | "minor") => {
    const typedValue = field === "major" ? majorSearchText : minorSearchText;
    const committedValue = field === "major" ? major : minor;
    const matchingOption = findAcademicProgramByTitle(typedValue);

    if (matchingOption && matchingOption.id !== OTHER_PROGRAM_OPTION_ID) {
      commitPresetAcademicProgram(field, matchingOption);
      return;
    }

    if (field === "major") {
      setMajorSearchText(committedValue);
      return;
    }

    setMinorSearchText(committedValue);
  };

  const onNext = () => {
    if (!major.trim() || gradYear == null) {
      showAlert("Missing fields", "Please complete all fields.");
      return;
    }

    updateDraft({
      // pronouns: `${leftPronoun}/${rightPronoun}`,
      pronouns: `${leftPronoun}`,
      major: major.trim(),
      minor: minor.trim(),
      gradYear,
    });

    router.push("/(auth)/signup/avatarPicker");
  };

  return (
    <AutocompleteDropdownContextProvider>
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

        <SignupFormField label="Pronouns" contentStyle={styles.pronounsField}>
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
          {/* <View style={styles.pronounDivider}>
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
          </View> */}
        </SignupFormField>

        <SignupFormField
          label="Major"
          contentStyle={styles.autocompleteFieldShell}
        >
          {isCustomMajor ? (
            <View style={styles.customInputRow}>
              <TextInput
                placeholder="Type your major"
                placeholderTextColor="#9CA3AF"
                value={major}
                onChangeText={setMajor}
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.customInput}
              />
              <TouchableOpacity
                onPress={() => {
                  setIsCustomMajor(false);
                  setMajor("");
                }}
                style={styles.swapFieldButton}
              >
                <Text style={styles.swapFieldButtonText}>Back to list</Text>
              </TouchableOpacity>
              <Feather
                name="book"
                size={20}
                color="#90AEFF"
                style={styles.customInputIcon}
              />
            </View>
          ) : (
            <AutocompleteDropdown
              dataSet={ACADEMIC_PROGRAM_OPTIONS}
              initialValue={getAcademicProgramInitialValue(major)}
              onSelectItem={(item) => {
                if (item?.id === OTHER_PROGRAM_OPTION_ID) {
                  setIsCustomMajor(true);
                  setMajor("");
                  setMajorSearchText("");
                  return;
                }

                commitPresetAcademicProgram("major", item);
              }}
              onChangeText={setMajorSearchText}
              onClear={() => {
                setMajor("");
                setMajorSearchText("");
              }}
              clearOnFocus={false}
              closeOnBlur={true}
              closeOnSubmit={true}
              showChevron={false}
              showClear={true}
              inputHeight={56}
              suggestionsListMaxHeight={220}
              containerStyle={styles.autocompleteContainer}
              inputContainerStyle={styles.autocompleteInputContainer}
              rightButtonsContainerStyle={styles.autocompleteRightButtons}
              suggestionsListContainerStyle={styles.suggestionsListContainer}
              suggestionsListTextStyle={styles.suggestionsListText}
              textInputProps={{
                placeholder: "Choose a major or select Other",
                placeholderTextColor: "#9CA3AF",
                value: majorSearchText,
                autoCapitalize: "words",
                autoCorrect: false,
                onBlur: () => handleAcademicProgramBlur("major"),
                style: styles.autocompleteInput,
              }}
              RightIconComponent={
                <Feather
                  name="book"
                  size={20}
                  color="#90AEFF"
                  style={styles.autocompleteIcon}
                />
              }
            />
          )}
        </SignupFormField>

        <SignupFormField
          label="Minor"
          contentStyle={styles.autocompleteFieldShell}
        >
          {isCustomMinor ? (
            <View style={styles.customInputRow}>
              <TextInput
                placeholder="Type your minor"
                placeholderTextColor="#9CA3AF"
                value={minor}
                onChangeText={setMinor}
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.customInput}
              />
              <TouchableOpacity
                onPress={() => {
                  setIsCustomMinor(false);
                  setMinor("");
                }}
                style={styles.swapFieldButton}
              >
                <Text style={styles.swapFieldButtonText}>Back to list</Text>
              </TouchableOpacity>
              <Feather
                name="book-open"
                size={20}
                color="#90AEFF"
                style={styles.customInputIcon}
              />
            </View>
          ) : (
            <AutocompleteDropdown
              dataSet={ACADEMIC_PROGRAM_OPTIONS}
              initialValue={getAcademicProgramInitialValue(minor)}
              onSelectItem={(item) => {
                if (item?.id === OTHER_PROGRAM_OPTION_ID) {
                  setIsCustomMinor(true);
                  setMinor("");
                  setMinorSearchText("");
                  return;
                }

                commitPresetAcademicProgram("minor", item);
              }}
              onChangeText={setMinorSearchText}
              onClear={() => {
                setMinor("");
                setMinorSearchText("");
              }}
              clearOnFocus={false}
              closeOnBlur={true}
              closeOnSubmit={true}
              showChevron={false}
              showClear={true}
              inputHeight={56}
              suggestionsListMaxHeight={220}
              containerStyle={styles.autocompleteContainer}
              inputContainerStyle={styles.autocompleteInputContainer}
              rightButtonsContainerStyle={styles.autocompleteRightButtons}
              suggestionsListContainerStyle={styles.suggestionsListContainer}
              suggestionsListTextStyle={styles.suggestionsListText}
              textInputProps={{
                placeholder: "Choose a minor or select Other",
                placeholderTextColor: "#9CA3AF",
                value: minorSearchText,
                autoCapitalize: "words",
                autoCorrect: false,
                onBlur: () => handleAcademicProgramBlur("minor"),
                style: styles.autocompleteInput,
              }}
              RightIconComponent={
                <Feather
                  name="book-open"
                  size={20}
                  color="#90AEFF"
                  style={styles.autocompleteIcon}
                />
              }
            />
          )}
        </SignupFormField>

        <SignupFormField
          label="Graduation Year"
          contentStyle={styles.yearField}
        >
          <Picker
            selectedValue={gradYear}
            onValueChange={(value) =>
              setGradYear(value === null ? null : Number(value))
            }
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

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </AutocompleteDropdownContextProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },
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
  autocompleteFieldShell: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 76,
    alignItems: "stretch",
    overflow: "visible",
  },
  autocompleteContainer: {
    flex: 1,
  },
  autocompleteInputContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    minHeight: 56,
  },
  autocompleteInput: {
    fontSize: 18,
    lineHeight: 24,
    color: "#000000",
    paddingLeft: 10,
  },
  autocompleteRightButtons: {
    right: 10,
  },
  autocompleteIcon: {
    marginRight: 2,
  },
  customInputRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
  },
  customInput: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    color: "#000000",
    paddingLeft: 10,
    paddingVertical: 12,
  },
  customInputIcon: {
    marginLeft: 8,
  },
  swapFieldButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  swapFieldButtonText: {
    color: "#5D7FC9",
    fontSize: 12,
    fontWeight: "600",
  },
  suggestionsListContainer: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CFE2FF",
    backgroundColor: "#FFFFFF",
  },
  suggestionsListText: {
    color: "#0B1533",
    fontSize: 18,
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
