import { uploadProfilePhotoAsync } from "../../../src/lib/picture_upload";
import {
  getLocationControlStatus,
  LocationControlStatus,
  setLocationSharingEnabled,
} from "../../../src/location/service";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { deleteUser, onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
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
import { auth, db } from "../../../firebaseConfig";
import {
  hobbiesToInputValue,
  parseHobbiesInput,
} from "../../../src/lib/hobbies";
import {
  calculateAgeFromDateOfBirth,
  normalizeDateOfBirth,
} from "../../../src/lib/profileFields";
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
  iceBreakerTwo?: string;
  iceBreakerThree?: string;
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const [ice2, setIce2] = useState("");
  const [ice3, setIce3] = useState("");
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
      setIce2("");
      setIce3("");
      setHobbies("");
      setPreConnectionVisibility(normalizePreConnectionVisibility(undefined));
      return;
    }

    const d = snap.data() as UserDoc;

    setPhotoURL(d.photoURL ?? "");
    setNewPhotoUri(null); // reset local selection when reloading

    setEmail(d.email ?? auth.currentUser?.email ?? "");

    setFirstName(d.firstName ?? "");
    setLastName(d.lastName ?? "");
    setDateOfBirth(normalizeDateOfBirth(d.dateOfBirth));
    setBio(d.bio ?? "");
    setPronouns(d.pronouns ?? d.Gender ?? "");
    setGradYear(toIntOrNull(d.gradYear));
    setMajor(d.major ?? "");
    setMinor(d.minor ?? "");

    setIce1(d.iceBreakerOne ?? "");
    setIce2(d.iceBreakerTwo ?? "");
    setIce3(d.iceBreakerThree ?? "");
    setHobbies(hobbiesToInputValue(d.hobbies));
    setPreConnectionVisibility(
      normalizePreConnectionVisibility(d.preConnectionVisibility),
    );
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      try {
        setLoading(true);
        setUid(user.uid);
        setEmail(user.email ?? "");
        await loadProfile(user.uid);
        await refreshLocationControl();
      } catch (e: any) {
        Alert.alert("Could not load profile", e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [router, loadProfile, refreshLocationControl]);

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
        updatedPhotoURL = await uploadProfilePhotoAsync(newPhotoUri);
      }

      const normalizedHobbies = parseHobbiesInput(hobbies);
      const normalizedDateOfBirth = normalizeDateOfBirth(dateOfBirth);
      const derivedAge = calculateAgeFromDateOfBirth(normalizedDateOfBirth);

      await updateDoc(doc(db, "users", uid), {
        email: auth.currentUser?.email ?? email,

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
        iceBreakerTwo: ice2.trim(),
        iceBreakerThree: ice3.trim(),
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
          iceBreakerTwo: ice2.trim(),
          iceBreakerThree: ice3.trim(),
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

      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  // ===== Delete account (Firestore doc + Auth user) =====

  const confirmDeleteAccount = () => {
    if (Platform.OS === "web") {
      const first = (globalThis as any).confirm?.(
        "Delete account?\nThis will permanently delete your profile.",
      );
      if (!first) return Promise.resolve(false);

      const second = (globalThis as any).confirm?.(
        "This cannot be undone. Delete your account?",
      );
      return Promise.resolve(Boolean(second));
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        "Delete account?",
        "This will permanently delete your account.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
      );
    });
  };

  // const deleteFirestoreProfile = async (userId: string) => {
  //   // If you later store more collections (matches/chats/photos), you’ll delete those here too.
  //   await deleteDoc(doc(db, "users", userId));
  // };

  const onDeleteAccount = async () => {
    if (!uid) return;

    const confirmed = await confirmDeleteAccount();
    if (!confirmed) return;

    const user: User | null = auth.currentUser;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    try {
      setDeleting(true);

      //   // 1) Delete Firestore profile doc first (so you don't leave orphaned data)
      //   await deleteFirestoreProfile(uid);

      // 2) Delete Auth user
      await deleteUser(user);

      Alert.alert("Account deleted", "Your account has been deleted.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (e: any) {
      const code = e?.code as string | undefined;

      if (code === "auth/requires-recent-login") {
        Alert.alert(
          "Please log in again",
          "For security, please log in again and then try deleting your account.",
        );
        // optional: sign out and send them to login
        try {
          await signOut(auth);
        } catch {}
        router.replace("/(auth)/login");
      } else {
        Alert.alert(
          "Delete failed",
          e?.message ?? "Please log in again and try deleting your account.",
        );
      }
    } finally {
      setDeleting(false);
    }
  };

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
              (saving || deleting) && styles.disabledButton,
            ]}
            onPress={pickNewPhoto}
            disabled={saving || deleting}
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
              Tap “Choose Photo” to update your profile picture.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>

        <Text style={styles.label}>Email (read-only)</Text>
        <Text style={styles.readonlyValue}>{email || "-"}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Location Control</Text>

        <View style={styles.locationRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Share my location for nearby matches</Text>
            <Text style={styles.helperText}>
              Background/minimized updates are supported. iOS force-closed
              behavior is best effort.
            </Text>
          </View>
          <Switch
            value={locationControl?.sharingEnabled ?? true}
            onValueChange={onToggleLocationSharing}
            disabled={locationBusy || saving || deleting}
          />
        </View>

        <Text style={styles.label}>Permission</Text>
        <Text style={styles.readonlyValue}>
          {prettyPermission(locationControl?.permissionStatus)}
        </Text>

        <Text style={styles.label}>Last location update</Text>
        <Text style={styles.readonlyValue}>
          {prettyLastSeen(locationControl?.lastLocationAt)}
        </Text>

        <Text style={styles.label}>Last accuracy (meters)</Text>
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
            <Text style={styles.visibilityLabel}>{field.label}</Text>
            <Switch
              value={preConnectionVisibility[field.key]}
              onValueChange={(value) =>
                setPreConnectionVisibility((current) => ({
                  ...current,
                  [field.key]: value,
                }))
              }
              disabled={saving || deleting}
            />
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Basics</Text>

        <Text style={styles.label}>First Name</Text>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
        />

        <Text style={styles.label}>Date of Birth</Text>
        <TextInput
          value={dateOfBirth}
          onChangeText={(value) => setDateOfBirth(value)}
          style={styles.input}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={(value) => setBio(value.slice(0, 140))}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Pronouns</Text>
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

        <Text style={styles.label}>Graduation Year</Text>
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

        <Text style={styles.label}>Major</Text>
        <TextInput value={major} onChangeText={setMajor} style={styles.input} />

        <Text style={styles.label}>Minor</Text>
        <TextInput value={minor} onChangeText={setMinor} style={styles.input} />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Ice Breakers</Text>

        <Text style={styles.label}>Ideal weekend</Text>
        <TextInput
          value={ice1}
          onChangeText={setIce1}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Food you can’t say no to</Text>
        <TextInput
          value={ice2}
          onChangeText={setIce2}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Fun fact</Text>
        <TextInput
          value={ice3}
          onChangeText={setIce3}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Hobbies</Text>

        <Text style={styles.label}>Hobbies</Text>
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
          (saving || deleting) && styles.disabledButton,
        ]}
        onPress={onSave}
        disabled={saving || deleting}
      >
        <Text style={styles.primaryText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
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
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },

  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 6,
  },

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

  disabledButton: { opacity: 0.6 },

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
});
