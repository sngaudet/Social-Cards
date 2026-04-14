import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../../firebaseConfig";
import { useAuth } from "../../../src/auth/AuthContext";
import {
  hobbiesToInputValue,
  parseHobbiesInput,
} from "../../../src/lib/hobbies";
import { uploadProfilePhotoAsync } from "../../../src/lib/picture_upload";
import {
  calculateAgeFromDateOfBirth,
  normalizeDateOfBirth,
} from "../../../src/lib/profileFields";
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

const DEFAULT_ICEBREAKER_QUESTIONS = [
  "What's your ideal weekend?",
  "What food can you never say no to?",
  "Share one fun fact about yourself",
];

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
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [gradYear, setGradYear] = useState<number | null>(null);
  const [major, setMajor] = useState("");
  const [minor, setMinor] = useState("");
  const [ice1, setIce1] = useState("");
  const [ice1Question, setIce1Question] = useState(DEFAULT_ICEBREAKER_QUESTIONS[0]);
  const [ice2, setIce2] = useState("");
  const [ice2Question, setIce2Question] = useState(DEFAULT_ICEBREAKER_QUESTIONS[1]);
  const [ice3, setIce3] = useState("");
  const [ice3Question, setIce3Question] = useState(DEFAULT_ICEBREAKER_QUESTIONS[2]);
  const [hobbies, setHobbies] = useState("");
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
      setMinor("");
      setIce1("");
      setIce1Question(DEFAULT_ICEBREAKER_QUESTIONS[0]);
      setIce2("");
      setIce2Question(DEFAULT_ICEBREAKER_QUESTIONS[1]);
      setIce3("");
      setIce3Question(DEFAULT_ICEBREAKER_QUESTIONS[2]);
      setHobbies("");
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
    setMajor(d.major ?? "");
    setMinor(d.minor ?? "");

    setIce1(d.iceBreakerOne ?? "");
    setIce1Question(
      d.iceBreakerOneQuestion?.trim() || DEFAULT_ICEBREAKER_QUESTIONS[0],
    );
    setIce2(d.iceBreakerTwo ?? "");
    setIce2Question(
      d.iceBreakerTwoQuestion?.trim() || DEFAULT_ICEBREAKER_QUESTIONS[1],
    );
    setIce3(d.iceBreakerThree ?? "");
    setIce3Question(
      d.iceBreakerThreeQuestion?.trim() || DEFAULT_ICEBREAKER_QUESTIONS[2],
    );
    setHobbies(hobbiesToInputValue(d.hobbies));
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
          Alert.alert("Could not load profile", e?.message ?? "Unknown error");
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
          Alert.alert(
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
      Alert.alert("Photo pick failed", e?.message ?? "Unknown error");
    }
  };

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing fields", "Please enter your first and last name.");
      return false;
    }
    if (!normalizeDateOfBirth(dateOfBirth)) {
      Alert.alert("Invalid date", "Please enter a valid date of birth.");
      return false;
    }
    if (!bio.trim()) {
      Alert.alert("Missing fields", "Please enter a short bio.");
      return false;
    }
    if (!pronouns.trim()) {
      Alert.alert("Missing fields", "Please select your pronouns.");
      return false;
    }
    if (gradYear == null) {
      Alert.alert("Missing fields", "Please select your graduation year.");
      return false;
    }
    if (!major.trim()) {
      Alert.alert("Missing fields", "Please enter your major.");
      return false;
    }
    if (!minor.trim()) {
      Alert.alert("Missing fields", "Please enter your minor.");
      return false;
    }
    if (!ice1.trim() || !ice2.trim() || !ice3.trim()) {
      Alert.alert("Missing fields", "Please fill out all three ice breakers.");
      return false;
    }
    if (parseHobbiesInput(hobbies).length === 0) {
      Alert.alert("Missing fields", "Please enter at least one hobby.");
      return false;
    }
    return true;
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

      const normalizedHobbies = parseHobbiesInput(hobbies);
      const normalizedDateOfBirth = normalizeDateOfBirth(dateOfBirth);
      const derivedAge = calculateAgeFromDateOfBirth(normalizedDateOfBirth);

      await updateDoc(doc(db, "users", uid), {
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

        iceBreakerOne: ice1.trim(),
        iceBreakerOneQuestion: ice1Question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[0],
        iceBreakerTwo: ice2.trim(),
        iceBreakerTwoQuestion: ice2Question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[1],
        iceBreakerThree: ice3.trim(),
        iceBreakerThreeQuestion:
          ice3Question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[2],
        hobbies: normalizedHobbies,
        preConnectionVisibility,

        // profile photo
        photoURL: updatedPhotoURL,

        updatedAt: serverTimestamp(),
      });

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
          iceBreakerOne: ice1.trim(),
          iceBreakerOneQuestion:
            ice1Question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[0],
          iceBreakerTwo: ice2.trim(),
          iceBreakerTwoQuestion:
            ice2Question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[1],
          iceBreakerThree: ice3.trim(),
          iceBreakerThreeQuestion:
            ice3Question.trim() || DEFAULT_ICEBREAKER_QUESTIONS[2],
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
      setHobbies(hobbiesToInputValue(normalizedHobbies));
      Alert.alert("Saved", "Your profile has been updated.", [
        { text: "OK", onPress: () => router.replace("/profile/view") },
      ]);
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Unknown error");
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
      Alert.alert(
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
        <TextInput
          value={dateOfBirth}
          onChangeText={(value) => setDateOfBirth(value)}
          style={styles.input}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />

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
        <TextInput value={major} onChangeText={setMajor} style={styles.input} />

        <Text style={styles.metaLabel}>Minor</Text>
        <TextInput value={minor} onChangeText={setMinor} style={styles.input} />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Ice Breakers</Text>

        <Text style={styles.metaLabel}>{ice1Question}</Text>
        <TextInput
          value={ice1}
          onChangeText={setIce1}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.metaLabel}>{ice2Question}</Text>
        <TextInput
          value={ice2}
          onChangeText={setIce2}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.metaLabel}>{ice3Question}</Text>
        <TextInput
          value={ice3}
          onChangeText={setIce3}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Hobbies</Text>

        <Text style={styles.metaLabel}>Hobbies</Text>
        <TextInput
          value={hobbies}
          onChangeText={setHobbies}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
          placeholder="Basketball, Reading, Cooking…"
        />
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
