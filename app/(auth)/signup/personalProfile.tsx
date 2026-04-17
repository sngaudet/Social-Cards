import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { CalendarDays, IdCard } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
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
import { normalizeDateOfBirth } from "../../../src/lib/profileFields";
import { useSignup } from "../../../src/signup/context";

const DEFAULT_BIRTH_DATE = new Date(2000, 0, 1);
const MIN_BIRTH_DATE = new Date(1930, 0, 1);
const MAX_BIRTH_DATE = new Date();

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function parseStoredDateOfBirth(value: string | undefined): Date | null {
  const normalized = normalizeDateOfBirth(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForStorage(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDateForDisplay(value: Date): string {
  return value.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SignupPersonalProfileStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();
  const initialDateOfBirth = parseStoredDateOfBirth(draft.dateOfBirth);
  const webDateInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(draft.firstName ?? "");
  const [lastName, setLastName] = useState(draft.lastName ?? "");

  const [bio, setBio] = useState(draft.bio ?? "");

  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(
    initialDateOfBirth,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(
    initialDateOfBirth ?? DEFAULT_BIRTH_DATE,
  );

  const openDatePicker = () => {
    const currentValue = dateOfBirth ?? pickerDate;

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: currentValue,
        mode: "date",
        display: "calendar",
        maximumDate: MAX_BIRTH_DATE,
        minimumDate: MIN_BIRTH_DATE,
        onChange: (event, selectedDate) => {
          if (event.type !== "set" || !selectedDate) return;
          setDateOfBirth(selectedDate);
          setPickerDate(selectedDate);
        },
      });
      return;
    }

    setPickerDate(currentValue);
    setShowPicker(true);
  };

  const openWebDatePicker = () => {
    const input = webDateInputRef.current as
      | (HTMLInputElement & { showPicker?: () => void })
      | null;

    if (!input) return;

    try {
      input.showPicker?.();
    } catch {
      // Fall through to click/focus for browsers without showPicker support.
    }

    if (!input.showPicker) {
      input.focus();
      input.click();
    }
  };

  const closeDatePicker = () => {
    setShowPicker(false);
    setPickerDate(dateOfBirth ?? DEFAULT_BIRTH_DATE);
  };

  const confirmDatePicker = () => {
    setDateOfBirth(pickerDate);
    setShowPicker(false);
  };

  const onNext = () => {
    const trimmedBio = bio.trim();

    if (!firstName.trim() || !lastName.trim() || !dateOfBirth || !trimmedBio) {
      showAlert("Missing fields", "Please complete all fields.");
      return;
    }

    const normalizedDOB = formatDateForStorage(dateOfBirth);

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
      <SignupFormField
        label={
          <Text>
            First Name<Text style={styles.requiredText}>*</Text>
          </Text>
        }
      >
        <TextInput
          placeholder="e.g. Alex"
          placeholderTextColor="#9CA3AF"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />
        <IdCard
          size={20}
          color="#0b0b0b"
          strokeWidth={2}
          style={styles.trailingIcon}
        />
      </SignupFormField>

      <SignupFormField
        label={
          <Text>
            Last Name<Text style={styles.requiredText}>*</Text>
          </Text>
        }
      >
        <TextInput
          placeholder="e.g. Fauly"
          placeholderTextColor="#9CA3AF"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
        />
        <IdCard
          size={20}
          color="#0b0b0b"
          strokeWidth={2}
          style={styles.trailingIcon}
        />
      </SignupFormField>

      <SignupFormField
        label={
          <Text>
            Date of Birth<Text style={styles.requiredText}>*</Text>
          </Text>
        }
      >
        {Platform.OS === "web" ? (
          <Pressable
            style={styles.webDateField}
            onPress={openWebDatePicker}
            accessibilityRole="button"
          >
            <View style={styles.webDateDisplay} pointerEvents="none">
              <Text
                style={dateOfBirth ? styles.dateText : styles.datePlaceholder}
              >
                {dateOfBirth
                  ? formatDateForDisplay(dateOfBirth)
                  : "Select date of birth"}
              </Text>
              <CalendarDays size={20} color="#000000" />
            </View>
            <input
              ref={webDateInputRef}
              type="date"
              value={dateOfBirth ? formatDateForStorage(dateOfBirth) : ""}
              min={formatDateForStorage(MIN_BIRTH_DATE)}
              max={formatDateForStorage(MAX_BIRTH_DATE)}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const nextDate = parseStoredDateOfBirth(e.target.value);
                setDateOfBirth(nextDate);
                if (nextDate) {
                  setPickerDate(nextDate);
                }
              }}
              onKeyDown={(event) => {
                if (
                  event.key.length === 1 ||
                  [
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "ArrowUp",
                    "Backspace",
                    "Delete",
                    "End",
                    "Home",
                    "PageDown",
                    "PageUp",
                  ].includes(event.key)
                ) {
                  event.preventDefault();
                }
              }}
              onPaste={(event) => event.preventDefault()}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          </Pressable>
        ) : (
          <TouchableOpacity
            style={styles.datePressable}
            onPress={openDatePicker}
            activeOpacity={0.7}
          >
            <Text
              style={dateOfBirth ? styles.dateText : styles.datePlaceholder}
            >
              {dateOfBirth
                ? formatDateForDisplay(dateOfBirth)
                : "Select date of birth"}
            </Text>
            <CalendarDays size={20} color="#000000" />
          </TouchableOpacity>
        )}
      </SignupFormField>

      <Text style={styles.dateHint}>
        You must be 18 or older to use Icebreakers.
      </Text>

      <SignupFormField
        label={
          <Text>
            Short Bio<Text style={styles.requiredText}>*</Text>
          </Text>
        }
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

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.back()}
      >
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>

      {Platform.OS === "ios" ? (
        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          onRequestClose={closeDatePicker}
        >
          <View style={styles.dateModalRoot}>
            <Pressable
              style={styles.dateModalBackdrop}
              onPress={closeDatePicker}
            />
            <View style={styles.dateModalCard}>
              <Text style={styles.dateModalTitle}>
                Select your date of birth
              </Text>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="inline"
                maximumDate={MAX_BIRTH_DATE}
                minimumDate={MIN_BIRTH_DATE}
                themeVariant="light"
                onChange={(_, selectedDate) => {
                  if (!selectedDate) return;
                  setPickerDate(selectedDate);
                }}
              />
              <View style={styles.dateModalActionRow}>
                <TouchableOpacity
                  style={styles.dateModalCancelButton}
                  onPress={closeDatePicker}
                >
                  <Text style={styles.dateModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateModalConfirmButton}
                  onPress={confirmDatePicker}
                >
                  <Text style={styles.dateModalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
  webDateField: {
    flex: 1,
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
  webDateDisplay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  dateText: {
    fontSize: 18,
    color: "#6B7280",
  },
  datePlaceholder: {
    fontSize: 18,
    color: "#9CA3AF",
  },
  dateModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  dateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  dateModalCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#FFFDFB",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  dateModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  dateModalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  dateModalCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  dateModalCancelText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
  },
  dateModalConfirmButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#89DBFB",
  },
  dateModalConfirmText: {
    color: "#0B1533",
    fontSize: 13,
    fontWeight: "800",
  },
  requiredText: { color: "#aa1515", fontSize: 20 },
  primaryButton: { alignSelf: "center", marginBottom: 16 },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryText: { color: "#444", fontSize: 14 },
});
