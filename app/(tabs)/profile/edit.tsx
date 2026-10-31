import { Feather } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { CalendarDays, Check, Megaphone, Plus, X } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { iceColors as colors } from "../../../src/theme/icebreakers";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../../src/auth/AuthContext";
import HobbyButton from "../../../src/components/HobbyButton";
import {
  ACADEMIC_PROGRAM_OPTIONS,
  findAcademicProgramByTitle,
  getAcademicProgramInitialValue,
  isPresetAcademicProgram,
  OTHER_PROGRAM_OPTION_ID,
} from "../../../src/lib/academicPrograms";
import {
  getInitialSelectedHobbyKeys,
  hobbyKeysToLabels,
  hobbySections,
} from "../../../src/lib/hobbyCatalog";
import {
  AVAILABLE_ICEBREAKER_QUESTIONS,
  DEFAULT_ICEBREAKER_QUESTIONS,
  getInitialSelectedIceBreakers,
  MAX_ICEBREAKERS,
  type SelectedIceBreaker,
} from "../../../src/lib/icebreakers";
import { uploadProfilePhotoAsync } from "../../../src/lib/picture_upload";
import {
  calculateAgeFromDateOfBirth,
  normalizeDateOfBirth,
} from "../../../src/lib/profileFields";
import { showAlert } from "../../../src/lib/showAlert";
import {
  getLocationControlStatus,
  LocationControlStatus,
  setLocationSharingEnabled,
} from "../../../src/location/service";
import {
  normalizePreConnectionVisibility,
  PRE_CONNECTION_VISIBILITY_FIELDS,
  PreConnectionVisibility,
} from "../../../src/profile/visibility";

type UserDoc = {
  email?: string;
  firstName?: string;
  lastName?: string;
  Gender?: string;
  dateOfBirth?: string;
  bio?: string;
  pronouns?: string;
  gradYear?: number | string;
  major?: string;
  minor?: string;
  iceBreakerOne?: string;
  iceBreakerOneQuestion?: string;
  iceBreakerTwo?: string;
  iceBreakerTwoQuestion?: string;
  iceBreakerThree?: string;
  iceBreakerThreeQuestion?: string;
  hobbies?: string[] | string;
  photoURL?: string;
  photoUrls?: string[];
  preConnectionVisibility?: PreConnectionVisibility;
  locationControl?: {
    sharingEnabled?: boolean;
    permissionStatus?: string;
  };
  locationStatus?: {
    lastLocationAt?: { toDate?: () => Date } | null;
    lastAccuracyM?: number | null;
    lastSource?: "foreground" | "background" | null;
  };
};

const toIntOrNull = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const DEFAULT_BIRTH_DATE = new Date(2000, 0, 1);
const MIN_BIRTH_DATE = new Date(1930, 0, 1);
const MAX_BIRTH_DATE = new Date();
const webSwitchProps =
  Platform.OS === "web" ? { activeThumbColor: colors.surface } : {};

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

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, initializing } = useAuth();
  const webDateInputRef = useRef<HTMLInputElement>(null);

  // const viewSave = () => {
  //       setSaveComplete(true);
  //   };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // const [deleting, setDeleting] = useState(false);

  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  // editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(DEFAULT_BIRTH_DATE);
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [gradYear, setGradYear] = useState<number | null>(null);
  const [major, setMajor] = useState("");
  const [majorSearchText, setMajorSearchText] = useState("");
  const [minor, setMinor] = useState("");
  const [minorSearchText, setMinorSearchText] = useState("");
  const [isCustomMajor, setIsCustomMajor] = useState(false);
  const [isCustomMinor, setIsCustomMinor] = useState(false);
  const [selectedIceBreakers, setSelectedIceBreakers] = useState<
    SelectedIceBreaker[]
  >([]);
  const [isIceBreakerPickerOpen, setIsIceBreakerPickerOpen] = useState(false);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [preConnectionVisibility, setPreConnectionVisibility] =
    useState<PreConnectionVisibility>(
      normalizePreConnectionVisibility(undefined),
    );

  const [photoURL, setPhotoURL] = useState<string>("");
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [locationControl, setLocationControl] =
    useState<LocationControlStatus | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);

  const years = useMemo(() => {
    const start = 2026;
    return Array.from({ length: 25 }, (_, i) => start + i);
  }, []);

  const selectedIceBreakerCount = selectedIceBreakers.length;
  const filledIceBreakerCount = selectedIceBreakers.filter((item) =>
    item.answer.trim(),
  ).length;
  const icebreakerProgressWidth =
    `${(selectedIceBreakerCount / MAX_ICEBREAKERS) * 100}%` as `${number}%`;
  const icebreakerOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...AVAILABLE_ICEBREAKER_QUESTIONS,
          ...selectedIceBreakers.map((item) => item.question),
        ]),
      ),
    [selectedIceBreakers],
  );

  const toggleIceBreaker = (question: string) => {
    const isSelected = selectedIceBreakers.some(
      (item) => item.question === question,
    );

    if (isSelected) {
      setSelectedIceBreakers((current) =>
        current.filter((item) => item.question !== question),
      );
      return;
    }

    if (selectedIceBreakers.length >= MAX_ICEBREAKERS) {
      showAlert(
        "Selection limit reached",
        `Choose up to ${MAX_ICEBREAKERS} icebreakers. Remove one before picking another.`,
      );
      return;
    }

    setSelectedIceBreakers((current) => [...current, { question, answer: "" }]);
  };

  const updateIceBreakerAnswer = (question: string, answer: string) => {
    setSelectedIceBreakers((current) =>
      current.map((item) =>
        item.question === question ? { ...item, answer } : item,
      ),
    );
  };

  const toggleHobby = (key: string) => {
    setSelectedHobbies((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

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

  const refreshLocationControl = useCallback(async () => {
    const status = await getLocationControlStatus();
    setLocationControl(status);
  }, []);

  const loadProfile = useCallback(
    async (userId: string) => {
      const ref = doc(db, "users", userId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        // doc missing: keep everything blank
        setFirstName("");
        setLastName("");
        setDateOfBirth("");
        setPickerDate(DEFAULT_BIRTH_DATE);
        setBio("");
        setPronouns("");
        setGradYear(null);
        setMajor("");
        setMajorSearchText("");
        setIsCustomMajor(false);
        setMinor("");
        setMinorSearchText("");
        setIsCustomMinor(false);
        setSelectedIceBreakers([]);
        setSelectedHobbies([]);
        setPreConnectionVisibility(normalizePreConnectionVisibility(undefined));
        return;
      }

      const d = snap.data() as UserDoc;

      setPhotoURL(d.photoURL ?? "");
      setNewPhotoUri(null); // reset local selection when reloading

      setEmail(d.email ?? user?.email ?? "");

      setFirstName(d.firstName ?? "");
      setLastName(d.lastName ?? "");
      const normalizedDateOfBirth = normalizeDateOfBirth(d.dateOfBirth);
      setDateOfBirth(normalizedDateOfBirth);
      setPickerDate(
        parseStoredDateOfBirth(normalizedDateOfBirth) ?? DEFAULT_BIRTH_DATE,
      );
      setBio(d.bio ?? "");
      setPronouns(d.pronouns ?? d.Gender ?? "");
      setGradYear(toIntOrNull(d.gradYear));
      const nextMajor = d.major ?? "";
      const nextMinor = d.minor ?? "";
      setMajor(nextMajor);
      setMajorSearchText(nextMajor);
      setIsCustomMajor(
        Boolean(nextMajor.trim()) && !isPresetAcademicProgram(nextMajor),
      );
      setMinor(nextMinor);
      setMinorSearchText(nextMinor);
      setIsCustomMinor(
        Boolean(nextMinor.trim()) && !isPresetAcademicProgram(nextMinor),
      );
      setSelectedIceBreakers(
        getInitialSelectedIceBreakers([
          {
            question: d.iceBreakerOneQuestion?.trim() ?? "",
            answer: d.iceBreakerOne ?? "",
            fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[0],
          },
          {
            question: d.iceBreakerTwoQuestion?.trim() ?? "",
            answer: d.iceBreakerTwo ?? "",
            fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[1],
          },
          {
            question: d.iceBreakerThreeQuestion?.trim() ?? "",
            answer: d.iceBreakerThree ?? "",
            fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[2],
          },
        ]),
      );
      setSelectedHobbies(getInitialSelectedHobbyKeys(d.hobbies));
      setPreConnectionVisibility(
        normalizePreConnectionVisibility(d.preConnectionVisibility),
      );
    },
    [user],
  );

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      setUid(null);
      setEmail("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setUid(user.uid);
        setEmail(user.email ?? "");
        await loadProfile(user.uid);
        await refreshLocationControl();
      } catch (e: any) {
        if (!cancelled) {
          showAlert("Could not load profile", e?.message ?? "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initializing, loadProfile, refreshLocationControl, user]);

  // const pickNewPhoto = async () => {
  //   try {
  //     // Ask permission (mobile). On web, this is typically handled by the browser.
  //     if (Platform.OS !== "web") {
  //       const { status } =
  //         await ImagePicker.requestMediaLibraryPermissionsAsync();
  //       if (status !== "granted") {
  //         showAlert(
  //           "Permission needed",
  //           "Please allow photo library access.",
  //         );
  //         return;
  //       }
  //     }

  //     const result = await ImagePicker.launchImageLibraryAsync({
  //       mediaTypes: ImagePicker.MediaTypeOptions.Images,
  //       allowsEditing: true,
  //       aspect: [1, 1],
  //       quality: 0.85,
  //     });

  //     if (result.canceled) return;

  //     const uri = result.assets?.[0]?.uri;
  //     if (!uri) return;

  //     setNewPhotoUri(uri);
  //   } catch (e: any) {
  //     showAlert("Photo pick failed", e?.message ?? "Unknown error");
  //   }
  // };

  const takePhoto = async () => {
    try {
      // Ask permission (mobile). On web, this is typically handled by the browser.
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          showAlert(
            "Permission needed",
            "Please allow camera access to take a profile picture.",
          );
          return;
        }
      }
      // else if (Platform.OS === "web"){
      //   const input = document.createElement("input");
      //   input.type = "file";
      //   input.accept = "image/*"
      //   input.setAttribute("capture", "user");

      //   input.onchange = (event: any) => {
      //     const file = event.target.files?.[0];
      //     if (file) {
      //       const uri = URL.createObjectURL(file);
      //       setNewPhotoUri(uri);
      //     }
      //   };

      //   input.click();
      //   return;
      // }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setNewPhotoUri(uri);
    } catch (e: any) {
      showAlert("Camera failed", e?.message ?? "Unknown error");
    }
  };

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) {
      showAlert("Missing fields", "Please enter your first and last name.");
      return false;
    }
    if (!normalizeDateOfBirth(dateOfBirth)) {
      showAlert("Invalid date", "Please enter a valid date of birth.");
      return false;
    }
    if (!bio.trim()) {
      showAlert("Missing fields", "Please enter a short bio.");
      return false;
    }
    if (!pronouns.trim()) {
      showAlert("Missing fields", "Please select your pronouns.");
      return false;
    }
    if (gradYear == null) {
      showAlert("Missing fields", "Please select your graduation year.");
      return false;
    }
    if (!major.trim()) {
      showAlert("Missing fields", "Please enter your major.");
      return false;
    }
    if (filledIceBreakerCount < MAX_ICEBREAKERS) {
      showAlert(
        "Choose 3 icebreakers",
        "Select and answer 3 icebreakers before saving.",
      );
      return false;
    }
    if (selectedHobbies.length === 0) {
      showAlert("Missing fields", "Please add at least one hobby.");
      return false;
    }
    return true;
  };
  const openDatePicker = () => {
    const currentValue = parseStoredDateOfBirth(dateOfBirth) ?? pickerDate;

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: currentValue,
        mode: "date",
        display: "calendar",
        maximumDate: MAX_BIRTH_DATE,
        minimumDate: MIN_BIRTH_DATE,
        onChange: (event, selectedDate) => {
          if (event.type !== "set" || !selectedDate) return;
          setDateOfBirth(formatDateForStorage(selectedDate));
          setPickerDate(selectedDate);
        },
      });
      return;
    }

    setPickerDate(currentValue);
    setShowDatePicker(true);
  };

  const openWebDatePicker = () => {
    const input = webDateInputRef.current as
      (HTMLInputElement & { showPicker?: () => void }) | null;

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
    setShowDatePicker(false);
    setPickerDate(parseStoredDateOfBirth(dateOfBirth) ?? DEFAULT_BIRTH_DATE);
  };

  const confirmDatePicker = () => {
    setDateOfBirth(formatDateForStorage(pickerDate));
    setShowDatePicker(false);
  };

  const displayedDateOfBirth = parseStoredDateOfBirth(dateOfBirth);

  const onSave = async () => {
    if (!uid) return;
    if (!validate()) return;

    try {
      setSaving(true);

      let updatedPhotoURL = photoURL;

      // If user picked a new photo, upload it now and store the download URL
      if (newPhotoUri) {
        updatedPhotoURL = await uploadProfilePhotoAsync(newPhotoUri, uid);
      }

      const normalizedHobbies = hobbyKeysToLabels(selectedHobbies);
      const normalizedDateOfBirth = normalizeDateOfBirth(dateOfBirth);
      const derivedAge = calculateAgeFromDateOfBirth(normalizedDateOfBirth);
      const completedIceBreakers = selectedIceBreakers.filter((item) =>
        item.answer.trim(),
      );

      if (completedIceBreakers.length < MAX_ICEBREAKERS) {
        showAlert(
          "Choose 3 icebreakers",
          "Select and answer 3 icebreakers before saving.",
        );
        return;
      }

      const [firstIceBreaker, secondIceBreaker, thirdIceBreaker] =
        completedIceBreakers as [
          SelectedIceBreaker,
          SelectedIceBreaker,
          SelectedIceBreaker,
        ];
      const privateProfileData = {
        email: user?.email ?? email,

        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: normalizedDateOfBirth,
        bio: bio.trim(),
        pronouns: pronouns.trim(),
        age: derivedAge,
        gradYear: gradYear,
        major: major.trim(),
        minor: minor.trim(),

        iceBreakerOne: firstIceBreaker.answer.trim(),
        iceBreakerOneQuestion:
          firstIceBreaker.question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[0],
        iceBreakerTwo: secondIceBreaker.answer.trim(),
        iceBreakerTwoQuestion:
          secondIceBreaker.question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[1],
        iceBreakerThree: thirdIceBreaker.answer.trim(),
        iceBreakerThreeQuestion:
          thirdIceBreaker.question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[2],
        hobbies: normalizedHobbies,
        preConnectionVisibility,

        // profile photo
        photoURL: updatedPhotoURL,

        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", uid), privateProfileData, { merge: true });

      await setDoc(
        doc(db, "publicProfiles", uid),
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: normalizedDateOfBirth,
          bio: bio.trim(),
          pronouns: pronouns.trim(),
          age: derivedAge,
          gradYear: gradYear,
          major: major.trim(),
          minor: minor.trim(),
          iceBreakerOne: firstIceBreaker.answer.trim(),
          iceBreakerOneQuestion:
            firstIceBreaker.question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[0],
          iceBreakerTwo: secondIceBreaker.answer.trim(),
          iceBreakerTwoQuestion:
            secondIceBreaker.question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[1],
          iceBreakerThree: thirdIceBreaker.answer.trim(),
          iceBreakerThreeQuestion:
            thirdIceBreaker.question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[2],
          hobbies: normalizedHobbies,
          photoURL: updatedPhotoURL,
          preConnectionVisibility,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Update local UI state after successful save
      setPhotoURL(updatedPhotoURL);
      setNewPhotoUri(null);
      if (Platform.OS === "web") {
        showAlert("Saved", "Your profile has been updated.");
        router.replace("/profile/view");
      } else {
        Alert.alert("Saved", "Your profile has been updated.", [
          { text: "OK", onPress: () => router.replace("/profile/view") },
        ]);
      }
    } catch (e: any) {
      showAlert("Save failed", e?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const onToggleLocationSharing = async (nextValue: boolean) => {
    try {
      setLocationBusy(true);
      const updated = await setLocationSharingEnabled(nextValue);
      setLocationControl(updated);
    } catch (e: any) {
      showAlert(
        "Location update failed",
        e?.message ?? "Could not update location sharing right now.",
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const prettyPermission = (value?: string) => {
    if (!value) return "unknown";
    if (value === "always") return "Always";
    if (value === "while_in_use") return "While in use";
    if (value === "denied") return "Denied";
    return "Unknown";
  };

  const prettyLastSeen = (value?: string | null) => {
    if (!value) return "No location update yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No location update yet";
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <AutocompleteDropdownContextProvider>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.page}>
            <View style={styles.userCard}>
              <Text style={styles.sectionTitle}>Profile Photo</Text>
              <View style={styles.photoRow}>
                {newPhotoUri || photoURL ? (
                  <Image
                    accessibilityLabel="Your profile photo"
                    source={{ uri: newPhotoUri ?? photoURL }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Feather name="user" size={32} color="#9AA9BD" />
                    <Text style={styles.placeholderText}>No photo</Text>
                  </View>
                )}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    newPhotoUri ? "Retake Photo" : "Take Photo"
                  }
                  style={[
                    styles.secondaryOutlineButton,
                    saving && styles.disabledButton,
                  ]}
                  onPress={takePhoto}
                  disabled={saving}
                >
                  <Feather name="camera" size={21} color={colors.blue} />
                  <Text style={styles.secondaryOutlineText}>
                    {newPhotoUri ? "Retake Photo" : "Take Photo"}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                {newPhotoUri
                  ? "New photo selected. Tap Save Changes to upload."
                  : "Without a photo, your avatar is displayed instead."}
              </Text>
            </View>

            <View style={styles.userCard}>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.emailRow}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.metaLabel}>Email (read-only)</Text>
                  <Text selectable style={styles.readonlyValue}>
                    {email || "-"}
                  </Text>
                </View>
                <Feather name="lock" size={20} color={colors.muted} />
              </View>
            </View>

            <View style={styles.userCard}>
              <Text style={styles.sectionTitle}>Location Control</Text>
              <View style={styles.locationRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationLabel}>
                    Share my location for nearby matches
                  </Text>
                  <Text style={styles.helperText}>
                    Used to find people nearby.
                  </Text>
                </View>
                <Switch
                  {...webSwitchProps}
                  accessibilityLabel="Share my location for nearby matches"
                  value={locationControl?.sharingEnabled ?? true}
                  onValueChange={onToggleLocationSharing}
                  disabled={locationBusy || saving}
                  trackColor={{ false: "#DDE2EA", true: colors.blue }}
                  thumbColor={colors.surface}
                  ios_backgroundColor="#DDE2EA"
                />
              </View>
              <LocationDetail
                label="Permission"
                value={prettyPermission(locationControl?.permissionStatus)}
              />
              <LocationDetail
                label="Last location update"
                value={prettyLastSeen(locationControl?.lastLocationAt)}
              />
              <LocationDetail
                label="Last accuracy (meters)"
                value={
                  locationControl?.lastAccuracyM == null
                    ? "-"
                    : String(Math.round(locationControl.lastAccuracyM))
                }
              />
            </View>

            <View style={styles.userCard}>
              <Text style={styles.sectionTitle}>Visible Before Connection</Text>
              <Text style={styles.helperText}>
                Choose what people see before you connect.
              </Text>
              {PRE_CONNECTION_VISIBILITY_FIELDS.map((field) => (
                <View key={field.key} style={styles.visibilityRow}>
                  <Text style={styles.visibilityLabel}>{field.label}</Text>
                  <Switch
                    {...webSwitchProps}
                    accessibilityLabel={
                      "Show " + field.label + " before connecting"
                    }
                    value={preConnectionVisibility[field.key]}
                    onValueChange={(value) =>
                      setPreConnectionVisibility((current) => ({
                        ...current,
                        [field.key]: value,
                      }))
                    }
                    disabled={saving}
                    trackColor={{ false: "#DDE2EA", true: colors.blue }}
                    thumbColor={colors.surface}
                    ios_backgroundColor="#DDE2EA"
                  />
                </View>
              ))}
            </View>

            <View style={styles.userCard}>
              <Text style={styles.sectionTitle}>Basics</Text>

              <Text style={styles.metaLabel}>First Name</Text>
              <TextInput
                accessibilityLabel="First name"
                value={firstName}
                onChangeText={setFirstName}
                style={styles.input}
              />

              <Text style={styles.metaLabel}>Last Name</Text>
              <TextInput
                accessibilityLabel="Last name"
                value={lastName}
                onChangeText={setLastName}
                style={styles.input}
              />
              <Text style={styles.metaLabel}>Date of Birth</Text>

              {Platform.OS === "web" ? (
                <Pressable
                  style={[styles.input, styles.webDateField]}
                  onPress={openWebDatePicker}
                  accessibilityRole="button"
                  accessibilityLabel="Date of birth"
                >
                  <View style={styles.webDateDisplay} pointerEvents="none">
                    <Text
                      style={
                        dateOfBirth ? styles.dateText : styles.datePlaceholder
                      }
                    >
                      {displayedDateOfBirth
                        ? formatDateForDisplay(displayedDateOfBirth)
                        : "Select date of birth"}
                    </Text>
                    <CalendarDays size={20} color={colors.muted} />
                  </View>
                  <input
                    ref={webDateInputRef}
                    type="date"
                    value={dateOfBirth || ""}
                    min={formatDateForStorage(MIN_BIRTH_DATE)}
                    max={formatDateForStorage(MAX_BIRTH_DATE)}
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {
                      const nextDate = parseStoredDateOfBirth(e.target.value);
                      setDateOfBirth(
                        nextDate ? formatDateForStorage(nextDate) : "",
                      );
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
                  style={[styles.input, styles.datePressable]}
                  accessibilityRole="button"
                  accessibilityLabel="Date of birth"
                  onPress={openDatePicker}
                  activeOpacity={0.7}
                >
                  <Text
                    style={
                      dateOfBirth ? styles.dateText : styles.datePlaceholder
                    }
                  >
                    {displayedDateOfBirth
                      ? formatDateForDisplay(displayedDateOfBirth)
                      : "Select date of birth"}
                  </Text>
                  <CalendarDays size={20} color={colors.muted} />
                </TouchableOpacity>
              )}
              <Text style={styles.metaLabel}>Bio</Text>
              <TextInput
                accessibilityLabel="Bio"
                value={bio}
                onChangeText={(value) => setBio(value.slice(0, 140))}
                style={[styles.input, styles.multiline]}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.metaLabel}>Pronouns</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  accessibilityLabel="Pronouns"
                  style={styles.picker}
                  selectedValue={pronouns}
                  onValueChange={(v) => setPronouns(String(v))}
                >
                  <Picker.Item label="Select pronouns..." value="" />
                  <Picker.Item label="He / Him" value="he/him" />
                  <Picker.Item label="She / Her" value="she/her" />
                  <Picker.Item label="They / Them" value="they/them" />
                  <Picker.Item label="He / They" value="he/they" />
                  <Picker.Item label="She / They" value="she/they" />
                  <Picker.Item label="Other" value="other" />
                  <Picker.Item
                    label="Prefer not to say"
                    value="prefer_not_to_say"
                  />
                </Picker>
              </View>

              <Text style={styles.metaLabel}>Graduation Year</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  accessibilityLabel="Graduation year"
                  style={styles.picker}
                  selectedValue={gradYear}
                  onValueChange={(v) =>
                    setGradYear(v === null ? null : Number(v))
                  }
                >
                  <Picker.Item label="Select graduation year..." value={null} />
                  {years.map((y) => (
                    <Picker.Item key={y} label={String(y)} value={y} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.metaLabel}>Major</Text>
              <View
                style={[
                  styles.autocompleteFieldShell,
                  styles.topAutocompleteShell,
                ]}
              >
                {isCustomMajor ? (
                  <View style={styles.customInputRow}>
                    <TextInput
                      placeholder="Type your major"
                      placeholderTextColor="#9CA3AF"
                      accessibilityLabel="Major"
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
                        setMajorSearchText("");
                      }}
                      style={styles.swapFieldButton}
                    >
                      <Text style={styles.swapFieldButtonText}>
                        Back to list
                      </Text>
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
                    closeOnBlur
                    closeOnSubmit
                    showChevron={false}
                    showClear
                    inputHeight={44}
                    suggestionsListMaxHeight={220}
                    containerStyle={styles.autocompleteContainer}
                    inputContainerStyle={styles.autocompleteInputContainer}
                    rightButtonsContainerStyle={styles.autocompleteRightButtons}
                    suggestionsListContainerStyle={
                      styles.suggestionsListContainer
                    }
                    suggestionsListTextStyle={styles.suggestionsListText}
                    textInputProps={{
                      accessibilityLabel: "Major",
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
              </View>

              <Text style={styles.metaLabel}>Minor</Text>
              <View style={styles.autocompleteFieldShell}>
                {isCustomMinor ? (
                  <View style={styles.customInputRow}>
                    <TextInput
                      placeholder="Type your minor"
                      placeholderTextColor="#9CA3AF"
                      accessibilityLabel="Minor"
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
                        setMinorSearchText("");
                      }}
                      style={styles.swapFieldButton}
                    >
                      <Text style={styles.swapFieldButtonText}>
                        Back to list
                      </Text>
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
                    closeOnBlur
                    closeOnSubmit
                    showChevron={false}
                    showClear
                    inputHeight={44}
                    suggestionsListMaxHeight={220}
                    containerStyle={styles.autocompleteContainer}
                    inputContainerStyle={styles.autocompleteInputContainer}
                    rightButtonsContainerStyle={styles.autocompleteRightButtons}
                    suggestionsListContainerStyle={
                      styles.suggestionsListContainer
                    }
                    suggestionsListTextStyle={styles.suggestionsListText}
                    textInputProps={{
                      accessibilityLabel: "Minor",
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
              </View>
            </View>
            <View style={styles.userCard}>
              <Text style={styles.sectionTitle}>Ice Breakers</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit your icebreakers"
                onPress={() => setIsIceBreakerPickerOpen(true)}
                style={({ pressed }) => [
                  styles.iceSummaryCard,
                  pressed && styles.iceSummaryCardPressed,
                ]}
              >
                <View style={styles.iceSummaryHeader}>
                  <View>
                    <Text style={styles.iceSummaryTitle}>Your Icebreakers</Text>
                    <Text style={styles.iceSummarySubtitle}>3 required</Text>
                  </View>
                  <Text style={styles.iceSummaryCount}>
                    {selectedIceBreakerCount}/{MAX_ICEBREAKERS}
                  </Text>
                </View>

                <View style={styles.iceProgressTrack}>
                  <View
                    style={[
                      styles.iceProgressFill,
                      { width: icebreakerProgressWidth },
                    ]}
                  />
                </View>

                <Text style={styles.iceProgressText}>
                  {selectedIceBreakerCount} of {MAX_ICEBREAKERS} selected
                </Text>

                <View style={styles.iceSlotList}>
                  {Array.from({ length: MAX_ICEBREAKERS }, (_, index) => {
                    const iceBreaker = selectedIceBreakers[index];
                    const hasAnswer = Boolean(iceBreaker?.answer.trim());

                    return (
                      <View key={index} style={styles.iceSlotCard}>
                        <Text style={styles.iceSlotLabel}>
                          Icebreaker {index + 1}
                        </Text>
                        <Text style={styles.iceSlotQuestion} numberOfLines={2}>
                          {iceBreaker?.question || "Not selected yet"}
                        </Text>
                        <Text
                          style={[
                            styles.iceSlotAnswer,
                            !hasAnswer && styles.iceSlotAnswerPending,
                          ]}
                          numberOfLines={2}
                        >
                          {iceBreaker
                            ? hasAnswer
                              ? iceBreaker.answer.trim()
                              : "Answer needed"
                            : "Tap to choose a question"}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Text style={styles.iceEditHint}>
                  Tap to choose or edit your 3 icebreakers
                </Text>
              </Pressable>

              <Text style={styles.iceSelectionCount}>
                {filledIceBreakerCount} of {MAX_ICEBREAKERS} answered
              </Text>
            </View>
            <View style={styles.userCard}>
              <Text style={styles.sectionTitle}>Hobbies</Text>

              <Text style={styles.hobbySelectionCount}>
                {selectedHobbies.length} selected
              </Text>
              {hobbySections.map((section) => (
                <View key={section.title} style={styles.hobbySelectionSection}>
                  <Text style={styles.hobbySelectionSectionTitle}>
                    {section.title}
                  </Text>

                  <View style={styles.hobbyButtonsWrap}>
                    {section.items.map((hobby) => {
                      const Icon = hobby.icon;
                      const isSelected = selectedHobbies.includes(hobby.key);

                      return (
                        <HobbyButton
                          key={hobby.key}
                          label={hobby.label}
                          selected={isSelected}
                          style={[
                            styles.hobbyButton,
                            isSelected && styles.hobbyButtonSelected,
                          ]}
                          onPress={() => toggleHobby(hobby.key)}
                          renderIcon={(color) => (
                            <Icon size={20} color={color} strokeWidth={2.1} />
                          )}
                        />
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={styles.saveDock}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={saving ? "Saving..." : "Save Changes"}
            accessibilityState={{ disabled: saving, busy: saving }}
            style={[styles.primaryButton, saving && styles.disabledButton]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Feather name="check" size={21} color={colors.surface} />
            )}
            <Text style={styles.primaryText}>
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {Platform.OS === "ios" ? (
        <Modal
          visible={showDatePicker}
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

      <Modal
        visible={isIceBreakerPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsIceBreakerPickerOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboard}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[
              styles.iceModalRoot,
              {
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close icebreakers"
              style={styles.iceBackdrop}
              onPress={() => setIsIceBreakerPickerOpen(false)}
            />

            <View style={styles.iceModalCard}>
              <View style={styles.iceModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.iceModalTitle}>Choose 3 Icebreakers</Text>
                  <Text style={styles.iceModalSubtitle}>
                    Scroll the list, select up to 3, and add answers below each
                    one.
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Done editing icebreakers"
                  style={styles.iceModalClose}
                  onPress={() => setIsIceBreakerPickerOpen(false)}
                >
                  <Text style={styles.iceModalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.iceProgressTrack}>
                <View
                  style={[
                    styles.iceProgressFill,
                    { width: icebreakerProgressWidth },
                  ]}
                />
              </View>

              <Text style={styles.iceModalProgressText}>
                {selectedIceBreakerCount} of {MAX_ICEBREAKERS} selected -{" "}
                {filledIceBreakerCount} of {MAX_ICEBREAKERS} answered
              </Text>

              <ScrollView
                style={styles.iceModalScroll}
                contentContainerStyle={styles.iceModalScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {icebreakerOptions.map((question) => {
                  const selectedIceBreaker = selectedIceBreakers.find(
                    (item) => item.question === question,
                  );
                  const isSelected = Boolean(selectedIceBreaker);
                  const hasAnswer = Boolean(selectedIceBreaker?.answer.trim());

                  return (
                    <View
                      key={question}
                      style={[
                        styles.iceOptionCard,
                        isSelected && styles.iceOptionCardSelected,
                      ]}
                    >
                      {isSelected ? (
                        <>
                          <View style={styles.iceSelectedRowTop}>
                            <View style={styles.iceSelectedBadge}>
                              <Megaphone color={colors.blue} size={14} />
                              <Text style={styles.iceSelectedBadgeText}>
                                SELECTED
                              </Text>
                            </View>

                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel={
                                "Remove icebreaker: " + question
                              }
                              style={styles.iceOptionCloseButton}
                              onPress={() => toggleIceBreaker(question)}
                            >
                              <X color="#94a3b8" size={18} />
                            </TouchableOpacity>
                          </View>

                          <Text style={styles.iceOptionTitleSelected}>
                            {question}
                          </Text>

                          <View style={styles.iceAnswerBubble}>
                            <TextInput
                              accessibilityLabel={"Answer: " + question}
                              value={selectedIceBreaker?.answer ?? ""}
                              onChangeText={(value) =>
                                updateIceBreakerAnswer(question, value)
                              }
                              placeholder="Type your answer..."
                              placeholderTextColor="#9ca3af"
                              style={styles.iceOptionInput}
                              multiline
                            />

                            {hasAnswer ? (
                              <View style={styles.iceAnswerCheck}>
                                <Check color="white" size={18} />
                              </View>
                            ) : null}
                          </View>
                        </>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={"Choose icebreaker: " + question}
                          onPress={() => toggleIceBreaker(question)}
                          style={styles.iceOptionHeader}
                        >
                          <Text style={styles.iceOptionTitle}>{question}</Text>

                          <View style={styles.iceOptionPlusCircle}>
                            <Plus color="#94a3b8" size={22} />
                          </View>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AutocompleteDropdownContextProvider>
  );
}

function LocationDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.locationDetail}>
      <Text style={styles.locationMetaLabel}>{label}</Text>
      <Text style={styles.locationMetaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 14, paddingBottom: 24 },
  page: { width: "100%", maxWidth: 600, alignSelf: "center", gap: 14 },
  userCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: "#8EAFD0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 19,
    lineHeight: 27,
    color: colors.ink,
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.muted,
    marginBottom: 6,
  },
  readonlyValue: { fontSize: 15, lineHeight: 22, color: colors.ink },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 4,
  },
  profileImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.frost,
  },
  placeholderImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#F2F5F8",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  placeholderText: { fontSize: 11, color: "#7E8DA5" },
  secondaryOutlineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.blue,
  },
  secondaryOutlineText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: colors.blue,
    textAlign: "center",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
  },
  locationLabel: { fontSize: 14, lineHeight: 21, color: colors.ink },
  locationDetail: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  locationMetaLabel: {
    flexGrow: 1,
    flexBasis: 130,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: colors.muted,
  },
  locationMetaValue: {
    flexGrow: 1,
    flexBasis: 110,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
    textAlign: "right",
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  visibilityLabel: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: colors.frost,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  multiline: { minHeight: 100 },
  datePressable: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  webDateField: { position: "relative", overflow: "hidden" },
  webDateDisplay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  dateText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.ink },
  datePlaceholder: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: colors.frost,
  },
  picker: {
    minHeight: 48,
    color: colors.ink,
    backgroundColor: colors.frost,
    borderWidth: 0,
    fontSize: 15,
  },
  autocompleteFieldShell: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 16,
    minHeight: 48,
    backgroundColor: colors.frost,
    alignItems: "stretch",
    overflow: "visible",
    position: "relative",
    zIndex: 1,
  },
  topAutocompleteShell: { zIndex: 2 },
  autocompleteContainer: { flex: 1 },
  autocompleteInputContainer: {
    backgroundColor: "transparent",
    borderWidth: 0,
    minHeight: 44,
    justifyContent: "center",
  },
  autocompleteInput: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    paddingLeft: 4,
    paddingRight: 46,
  },
  autocompleteRightButtons: {
    width: 46,
    flexDirection: "row",
    transform: [{ translateX: -1 }],
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 9,
  },
  autocompleteIcon: { alignSelf: "center" },
  customInputRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  customInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    paddingLeft: 4,
    paddingVertical: 8,
  },
  customInputIcon: { marginLeft: 4 },
  swapFieldButton: {
    paddingHorizontal: 6,
    minHeight: 44,
    justifyContent: "center",
  },
  swapFieldButtonText: { color: colors.blue, fontSize: 11, fontWeight: "600" },
  suggestionsListContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  suggestionsListText: { color: colors.ink, fontSize: 15 },
  iceSummaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.frost,
    padding: 14,
    gap: 12,
  },
  iceSummaryCardPressed: { opacity: 0.8 },
  iceSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  iceSummaryTitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
    color: colors.ink,
  },
  iceSummarySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 2,
  },
  iceSummaryCount: { fontSize: 22, fontWeight: "700", color: colors.blue },
  iceProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  iceProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  iceProgressText: { fontSize: 12, lineHeight: 18, color: colors.muted },
  iceSlotList: { gap: 10 },
  iceSlotCard: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 6,
  },
  iceSlotLabel: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  iceSlotQuestion: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: colors.ink,
  },
  iceSlotAnswer: { fontSize: 13, lineHeight: 20, color: colors.ink },
  iceSlotAnswerPending: { color: colors.muted },
  iceEditHint: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: colors.blue,
    fontWeight: "600",
  },
  iceSelectionCount: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  hobbySelectionCount: {
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  hobbySelectionSection: { marginBottom: 20 },
  hobbySelectionSectionTitle: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: colors.muted,
    marginBottom: 12,
  },
  hobbyButtonsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  hobbyButton: {
    maxWidth: "100%",
    minHeight: 48,
    shadowOpacity: 0,
    elevation: 0,
  },
  hobbyButtonSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  saveDock: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    width: "100%",
    maxWidth: 572,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 48,
    padding: 12,
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  primaryText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.surface,
  },
  disabledButton: { opacity: 0.6 },
  dateModalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 16 },
  dateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,23,73,0.35)",
  },
  dateModalCard: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.surface,
  },
  dateModalTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink,
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
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.frost,
  },
  dateModalCancelText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.muted,
  },
  dateModalConfirmButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  dateModalConfirmText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.surface,
  },
  modalKeyboard: { flex: 1 },
  iceModalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 16 },
  iceBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,23,73,0.35)",
  },
  iceModalCard: {
    flex: 1,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
  },
  iceModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  iceModalTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink,
  },
  iceModalSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 4,
  },
  iceModalClose: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.blue,
    justifyContent: "center",
  },
  iceModalCloseText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.surface,
    fontWeight: "600",
  },
  iceModalProgressText: { fontSize: 12, lineHeight: 18, color: colors.muted },
  iceModalScroll: { flex: 1 },
  iceModalScrollContent: { gap: 10, paddingBottom: 8 },
  iceOptionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    backgroundColor: colors.surface,
    gap: 12,
  },
  iceOptionCardSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.frost,
  },
  iceOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 44,
  },
  iceOptionTitle: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: colors.ink,
    flex: 1,
  },
  iceOptionTitleSelected: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.ink,
  },
  iceSelectedRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iceSelectedBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  iceSelectedBadgeText: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.blue,
  },
  iceOptionCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iceOptionPlusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.frost,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iceAnswerBubble: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    position: "relative",
  },
  iceOptionInput: {
    padding: 0,
    minHeight: 90,
    textAlignVertical: "top",
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
    paddingRight: 42,
  },
  iceAnswerCheck: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
