import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, Check, Megaphone, Plus, X } from "lucide-react-native";

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

export default function EditProfile() {
  const router = useRouter();
  const { user, initializing } = useAuth();


  
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
const [pickerDate, setPickerDate] = useState<Date>(new Date());
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
    item.answer.trim()
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

  const loadProfile = useCallback(async (userId: string) => {
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // doc missing: keep everything blank
      setFirstName("");
      setLastName("");
      setDateOfBirth("");
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
    setDateOfBirth(normalizeDateOfBirth(d.dateOfBirth));
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
  }, [user]);

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

  const pickNewPhoto = async () => {
    try {
      // Ask permission (mobile). On web, this is typically handled by the browser.
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          showAlert(
            "Permission needed",
            "Please allow photo library access.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setNewPhotoUri(uri);
    } catch (e: any) {
      showAlert("Photo pick failed", e?.message ?? "Unknown error");
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
  setShowDatePicker(true);
};

const onDateChange = (_: any, selectedDate?: Date) => {
  setShowDatePicker(false);
  if (selectedDate) {
    setPickerDate(selectedDate);

    // convert to YYYY-MM-DD (your existing format)
    const iso = selectedDate.toISOString().split("T")[0];
    setDateOfBirth(iso);
  }
};
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
        item.answer.trim()
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

  // // ===== Delete account (Firestore doc + Auth user) =====

  // const confirmDeleteAccount = () => {
  //   if (Platform.OS === "web") {
  //     const first = (globalThis as any).confirm?.(
  //       "Delete account?\nThis will permanently delete your profile.",
  //     );
  //     if (!first) return Promise.resolve(false);

  //     const second = (globalThis as any).confirm?.(
  //       "This cannot be undone. Delete your account?",
  //     );
  //     return Promise.resolve(Boolean(second));
  //   }

  //   return new Promise<boolean>((resolve) => {
  //     Alert.alert(
  //       "Delete account?",
  //       "This will permanently delete your account.",
  //       [
  //         { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
  //         {
  //           text: "Delete",
  //           style: "destructive",
  //           onPress: () => resolve(true),
  //         },
  //       ],
  //     );
  //   });
  // };

  // const deleteFirestoreProfile = async (userId: string) => {
  //   // If you later store more collections (matches/chats/photos), you’ll delete those here too.
  //   await deleteDoc(doc(db, "users", userId));
  // };

  // const onDeleteAccount = async () => {
  //   if (!uid) return;

  //   const confirmed = await confirmDeleteAccount();
  //   if (!confirmed) return;

  //   const user: User | null = auth.currentUser;
  //   if (!user) {
  //     router.replace("/(auth)/login");
  //     return;
  //   }

  //   try {
  //     setDeleting(true);

  //     //   // 1) Delete Firestore profile doc first (so you don't leave orphaned data)
  //     //   await deleteFirestoreProfile(uid);

  //     // 2) Delete Auth user
  //     await deleteUser(user);

  //     Alert.alert("Account deleted", "Your account has been deleted.", [
  //       { text: "OK", onPress: () => router.replace("/(auth)/login") },
  //     ]);
  //   } catch (e: any) {
  //     const code = e?.code as string | undefined;

  //     if (code === "auth/requires-recent-login") {
  //       Alert.alert(
  //         "Please log in again",
  //         "For security, please log in again and then try deleting your account.",
  //       );
  //       // optional: sign out and send them to login
  //       try {
  //         await signOut(auth);
  //       } catch {}
  //       router.replace("/(auth)/login");
  //     } else {
  //       Alert.alert(
  //         "Delete failed",
  //         e?.message ?? "Please log in again and try deleting your account.",
  //       );
  //     }
  //   } finally {
  //     setDeleting(false);
  //   }
  // };

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      {/* {saveComplete && router.replace("/(auth)/login")} */}

      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.sectionTitle}>Profile Photo</Text>

      <View style={styles.photoRow}>
        {newPhotoUri || photoURL ? (
          <Image
            source={{ uri: newPhotoUri ?? photoURL }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={{ color: "#999" }}>No Photo</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={[
              styles.secondaryOutlineButton,
              (saving) && styles.disabledButton,
              // (saving || deleting) && styles.disabledButton,
            ]}
            onPress={pickNewPhoto}
            // disabled={saving || deleting}
            disabled={saving}
          >
            <Text style={styles.secondaryOutlineText}>
              {newPhotoUri ? "Change Selected Photo" : "Choose Photo"}
            </Text>
          </TouchableOpacity>

          {newPhotoUri ? (
            <Text style={styles.helperText}>
              New photo selected. Tap “Save Changes” to upload.
            </Text>
          ) : (
            <Text style={styles.helperText}>
              Tap “Choose Photo” to change or set your profile picture. Users
              without a photo will have their avatar displayed instead.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.userCard}>
        <Text style={styles.sectionTitle}>Account</Text>

        <Text style={styles.metaLabel}>Email (read-only)</Text>
        <Text style={styles.readonlyValue}>{email || "-"}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Location Control</Text>

        <View style={styles.locationRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLabel}>
              Share my location for nearby matches
            </Text>
            <Text style={styles.helperText}>
              Background/minimized updates are supported. iOS force-closed
              behavior is best effort.
            </Text>
          </View>
          <Switch
            value={locationControl?.sharingEnabled ?? true}
            onValueChange={onToggleLocationSharing}
            // disabled={locationBusy || saving || deleting}
            disabled={locationBusy || saving}
          />
        </View>

        <Text style={styles.metaLabel}>Permission</Text>
        <Text style={styles.readonlyValue}>
          {prettyPermission(locationControl?.permissionStatus)}
        </Text>

        <Text style={styles.metaLabel}>Last location update</Text>
        <Text style={styles.readonlyValue}>
          {prettyLastSeen(locationControl?.lastLocationAt)}
        </Text>

        <Text style={styles.metaLabel}>Last accuracy (meters)</Text>
        <Text style={styles.readonlyValue}>
          {locationControl?.lastAccuracyM == null
            ? "-"
            : String(Math.round(locationControl.lastAccuracyM))}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Visible Before Connection</Text>
        <Text style={styles.helperText}>
          Connected users can always see your full profile. These toggles only
          control what non-connections can see first.
        </Text>

        {PRE_CONNECTION_VISIBILITY_FIELDS.map((field) => (
          <View key={field.key} style={styles.visibilityRow}>
            <Text style={styles.metaLabel}>{field.label}</Text>
            <Switch
              value={preConnectionVisibility[field.key]}
              onValueChange={(value) =>
                setPreConnectionVisibility((current) => ({
                  ...current,
                  [field.key]: value,
                }))
              }
              // disabled={saving || deleting}
              disabled={saving}
            />
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Basics</Text>

        <Text style={styles.metaLabel}>First Name</Text>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />

        <Text style={styles.metaLabel}>Last Name</Text>
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
        />
<Text style={styles.metaLabel}>Date of Birth</Text>

{Platform.OS === "web" ? (
  <View style={styles.input}>
    <input
      type="date"
      value={dateOfBirth || ""}
      onChange={(e: any) => {
        const value = e.target.value;
        setDateOfBirth(value);
        if (value) {
          setPickerDate(new Date(value));
        }
      }}
      style={{
        width: "100%",
        border: "none",
        outline: "none",
        backgroundColor: "transparent",
        fontSize: 16,
      }}
    />
  </View>
) : (
  <>
    <TouchableOpacity
      style={styles.input}
      onPress={openDatePicker}
      activeOpacity={0.7}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: dateOfBirth ? "#000" : "#999" }}>
          {dateOfBirth || "Select date of birth"}
        </Text>

        <CalendarDays size={20} color="#0b0b0b" />
      </View>
    </TouchableOpacity>

    {showDatePicker && (
      <DateTimePicker
        value={pickerDate}
        mode="date"
        display="default"
        maximumDate={new Date()}
        onChange={onDateChange}
      />
    )}
  </>
)}
        <Text style={styles.metaLabel}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={(value) => setBio(value.slice(0, 140))}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.metaLabel}>Pronouns</Text>
        <View style={styles.pickerContainer}>
          <Picker
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
            <Picker.Item label="Prefer not to say" value="prefer_not_to_say" />
          </Picker>
        </View>

        <Text style={styles.metaLabel}>Graduation Year</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={gradYear}
            onValueChange={(v) => setGradYear(v === null ? null : Number(v))}
          >
            <Picker.Item label="Select graduation year..." value={null} />
            {years.map((y) => (
              <Picker.Item key={y} label={String(y)} value={y} />
            ))}
          </Picker>
        </View>

        <Text style={styles.metaLabel}>Major</Text>
        <View
          style={[styles.autocompleteFieldShell, styles.topAutocompleteShell]}
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
                  setMajorSearchText("");
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
              closeOnBlur
              closeOnSubmit
              showChevron={false}
              showClear
              inputHeight={44}
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
        </View>

        <Text style={styles.metaLabel}>Minor</Text>
        <View style={styles.autocompleteFieldShell}>
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
                  setMinorSearchText("");
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
              closeOnBlur
              closeOnSubmit
              showChevron={false}
              showClear
              inputHeight={44}
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
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Ice Breakers</Text>

        <Pressable
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

        <View style={styles.divider} />

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

      <TouchableOpacity
        style={[
          styles.primaryButton,
          // (saving || deleting) && styles.disabledButton,
          (saving) && styles.disabledButton,
        ]}
        onPress={onSave}
        // disabled={saving || deleting}
        disabled={saving}
      >
        <Text style={styles.primaryText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={isIceBreakerPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsIceBreakerPickerOpen(false)}
      >
        <Pressable
          style={styles.iceBackdrop}
          onPress={() => setIsIceBreakerPickerOpen(false)}
        />

        <View style={styles.iceModalCard}>
          <View style={styles.iceModalHeader}>
            <View>
              <Text style={styles.iceModalTitle}>Choose 3 Icebreakers</Text>
              <Text style={styles.iceModalSubtitle}>
                Scroll the list, select up to 3, and add answers below each one.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iceModalClose}
              onPress={() => setIsIceBreakerPickerOpen(false)}
            >
              <Text style={styles.iceModalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.iceProgressTrack}>
            <View
              style={[styles.iceProgressFill, { width: icebreakerProgressWidth }]}
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
                          <Megaphone color="#89DBFB" size={14} />
                          <Text style={styles.iceSelectedBadgeText}>
                            SELECTED
                          </Text>
                        </View>

                        <TouchableOpacity
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
      </Modal>

      {/* <TouchableOpacity
        style={[
          styles.dangerButton,
          (saving || deleting) && styles.disabledButton,
        ]}
        onPress={onDeleteAccount}
        disabled={saving || deleting}
      >
        <Text style={styles.dangerText}>
          {deleting ? "Deleting..." : "Delete Account"}
        </Text>
      </TouchableOpacity> */}
      </ScrollView>
    </AutocompleteDropdownContextProvider>
  );
}

const styles = StyleSheet.create({
  // scroll: { flex: 1 },
  // content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // title: {
  //   fontSize: 28,
  //   fontWeight: "700",
  //   marginBottom: 16,
  //   textAlign: "center",
  // },

  // card: {
  //   borderWidth: 1,
  //   borderColor: "#ddd",
  //   borderRadius: 12,
  //   padding: 16,
  //   gap: 6,
  // },

  // sectionTitle: {
  //   fontSize: 16,
  //   fontWeight: "700",
  //   marginTop: 6,
  //   marginBottom: 6,
  // },

  label: { fontSize: 12, color: "#666" },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "white",
  },

  multiline: { minHeight: 90 },

  autocompleteFieldShell: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
    minHeight: 56,
    backgroundColor: "white",
    alignItems: "stretch",
    overflow: "visible",
    position: "relative",
    zIndex: 1,
  },
  topAutocompleteShell: {
    zIndex: 2,
  },
  autocompleteContainer: {
    flex: 1,
  },
  autocompleteInputContainer: {
    backgroundColor: "transparent",
    borderWidth: 0,
    minHeight: 44,
    justifyContent: "center",
  },
  autocompleteInput: {
    fontSize: 16,
    lineHeight: 22,
    color: "#000000",
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
  autocompleteIcon: {
    alignSelf: "center",
  },
  customInputRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  customInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: "#000000",
    paddingLeft: 4,
    paddingVertical: 8,
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
  iceSummaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "white",
    padding: 18,
    gap: 14,
    marginTop: 12,
  },
  iceSummaryCardPressed: {
    opacity: 0.96,
  },
  iceSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iceSummaryTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  iceSummarySubtitle: {
    color: "#6b7280",
    marginTop: 2,
  },
  iceSummaryCount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  iceProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  iceProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#89DBFB",
  },
  iceProgressText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  iceSlotList: {
    gap: 10,
  },
  iceSlotCard: {
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    padding: 14,
    gap: 6,
  },
  iceSlotLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  iceSlotQuestion: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  iceSlotAnswer: {
    color: "#374151",
  },
  iceSlotAnswerPending: {
    color: "#9ca3af",
  },
  iceEditHint: {
    textAlign: "center",
    color: "#6b7280",
    fontWeight: "600",
  },
  iceSelectionCount: {
    textAlign: "center",
    marginTop: 12,
    marginBottom: 12,
    color: "#374151",
    fontWeight: "600",
  },
  hobbySelectionCount: {
    textAlign: "center",
    marginTop: 12,
    marginBottom: 12,
    color: "#374151",
    fontWeight: "600",
  },
  hobbySelectionSection: {
    marginBottom: 22,
  },
  hobbySelectionSectionTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: "#64748B",
    marginBottom: 12,
  },
  hobbyButtonsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  iceBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  iceModalCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 115,
    bottom: 36,
    borderRadius: 18,
    backgroundColor: "white",
    padding: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  iceModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  iceModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  iceModalSubtitle: {
    color: "#6b7280",
    marginTop: 4,
    maxWidth: 250,
  },
  iceModalClose: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#89DBFB",
    shadowColor: "#87BCFE",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  iceModalCloseText: {
    color: "white",
    fontWeight: "700",
  },
  iceModalProgressText: {
    color: "#374151",
    fontWeight: "600",
  },
  iceModalScroll: {
    flex: 1,
  },
  iceModalScrollContent: {
    gap: 10,
    paddingBottom: 8,
  },
  iceOptionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 18,
    backgroundColor: "white",
    gap: 14,
  },
  iceOptionCardSelected: {
    borderColor: "#89DBFB",
    shadowColor: "#89DBFB",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iceOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  iceOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  iceOptionTitleSelected: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2a44",
  },
  iceSelectedRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iceSelectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iceSelectedBadgeText: {
    color: "#89DBFB",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  iceOptionCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  iceOptionPlusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iceAnswerBubble: {
    borderRadius: 26,
    backgroundColor: "#f2f4f7",
    padding: 16,
    paddingBottom: 18,
    position: "relative",
  },
  iceOptionInput: {
    padding: 0,
    minHeight: 90,
    textAlignVertical: "top",
    color: "#374151",
    paddingRight: 54,
  },
  iceAnswerCheck: {
    position: "absolute",
    right: 16,
    bottom: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    backgroundColor: "white",
  },

  readonlyValue: {
    fontSize: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 10,
  },

  primaryButton: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { color: "white", fontWeight: "700" },

  dangerButton: {
    marginTop: 12,
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  dangerText: { color: "white", fontWeight: "800" },

  // disabledButton: { opacity: 0.6 },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f3f4f6",
  },

  placeholderImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  secondaryOutlineButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  secondaryOutlineText: {
    color: "#111",
    fontWeight: "600",
  },

  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: "#666",
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  visibilityLabel: {
    flex: 1,
    fontSize: 14,
  },
  
  //////////
  //////////
  //////////
  //////////
  //////////

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#D9E0F0",
    padding: 24,
  },
  // content: {
  //   padding: 24,
  //   paddingBottom: 48,
  //   backgroundColor: "#D9E0F0",
  //   gap: 20,
  // },
  // title: {
  //   fontSize: 34,
  //   fontWeight: "700",
  //   textAlign: "center",
  //   marginTop: 8,
  // },
  title: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    color: "#101828",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  // emptyCard: {
  //   backgroundColor: "#fff",
  //   borderRadius: 12,
  //   padding: 16,
  //   borderWidth: 1,
  //   borderColor: "#ddd",
  // },
  // emptyTitle: {
  //   fontSize: 16,
  //   fontWeight: "700",
  //   marginBottom: 4,
  // },
  // subtleText: {
  //   fontSize: 13,
  //   color: "#666",
  // },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  // avatar: {
  //   width: 58,
  //   height: 58,
  //   borderRadius: 29,
  //   backgroundColor: "#e5e7eb",
  // },
  // avatarPlaceholder: {
  //   width: 58,
  //   height: 58,
  //   borderRadius: 29,
  //   backgroundColor: "#f0f0f0",
  //   alignItems: "center",
  //   justifyContent: "center",
  // },
  // avatarText: {
  //   fontSize: 10,
  //   color: "#666",
  //   textAlign: "center",
  // },
  nameText: {
    fontSize: 18,
    fontWeight: "700",
  },
  uidText: {
    marginTop: 4,
    fontSize: 12,
    color: "#888",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  acceptButton: {
    backgroundColor: "#2452ce",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  declineButton: {
    backgroundColor: "#888",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  messageButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2452ce",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  connectionMeta: {
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////
  ///////////

  scroll: { flex: 1, backgroundColor: "#dfe7f6" },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  reportModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  reportBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  reportModalCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#fffdfb",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  reportModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  reportModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
  },
  reportFieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#374151",
    letterSpacing: 0.4,
  },
  reportReasonInput: {
    borderWidth: 1,
    borderColor: "#F3D1D1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFF7F7",
  },
  reportReasonPickerWrap: {
    borderWidth: 1,
    borderColor: "#F3D1D1",
    borderRadius: 14,
    backgroundColor: "#FFF7F7",
    overflow: "hidden",
  },
  reportReasonPicker: {
    color: "#111827",
  },
  reportDetailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reportCharacterCount: {
    fontSize: 12,
    color: "#6B7280",
  },
  reportDetailsInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#F3D1D1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#111827",
    backgroundColor: "#FFF7F7",
  },
  reportActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  reportCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  reportCancelButtonText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
  },
  reportSubmitButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#B91C1C",
  },
  reportSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  // title: {
  //   fontSize: 30,
  //   fontWeight: "800",
  //   textAlign: "center",
  //   color: "#101828",
  // },

  summaryCard: {
    borderWidth: 1,
    borderColor: "#d8e2f2",
    borderRadius: 24,
    padding: 14,
    backgroundColor: "#f9fbff",
    gap: 4,
    shadowColor: "#9aa7c7",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },

  summaryText: {
    fontSize: 15,
    fontWeight: "600",
  },

  subtleText: {
    fontSize: 12,
    color: "#666",
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },

  userCard: {
    borderWidth: 1,
    borderColor: "#e7edf9",
    borderRadius: 28,
    padding: 16,
    backgroundColor: "#fffdfb",
    shadowColor: "#b8c2d9",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },

  userHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },

  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#edf1fa",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },

  avatarText: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
  },
  avatarDebugText: {
    marginTop: 6,
    fontSize: 9,
    color: "#666",
    textAlign: "center",
  },

  userBody: {
    flex: 1,
    gap: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f4aaa",
    letterSpacing: 0.4,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },

  distancePill: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: "#1d4ed8",
    backgroundColor: "#eef4ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    minWidth: 72,
  },
  metaLabel: {
    fontSize: 15,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#303b52",
    letterSpacing: 0.5,
    paddingTop: 5,
    marginTop: 20,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
  },
  hobbiesBlock: {
    gap: 6,
  },
  hobbyWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  hobbyChip: {
    fontSize: 10,
    fontWeight: "800",
    color: "#263248",
    backgroundColor: "#f6efe1",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  promptBlock: {
    backgroundColor: "#f8f9fe",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  promptLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#5b6478",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  promptValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#161b26",
    textAlign: "center",
  },
  promptSubValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 4,
  },
  footerInfo: {
    flex: 1,
    gap: 2,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#404a60",
    letterSpacing: 0.5,
  },
  footerValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#161b26",
  },
  hiddenText: {
    fontSize: 12,
    color: "#666",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  viewPillButton: {
    backgroundColor: "#ffd45f",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  connectPillButton: {
    backgroundColor: "#7db1ff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  reportPillButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  connectedPill: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  disabledPillButton: {
    opacity: 0.65,
  },
  viewPillButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  reportPillButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  connectedPillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  connectPillButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

});
