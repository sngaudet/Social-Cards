import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { deleteUser, onAuthStateChanged, signOut, User } from "firebase/auth";
import {
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";

type UserDoc = {
  email?: string;
  firstName?: string;
  lastName?: string;
  Gender?: string;
  age?: number | string;
  gradYear?: number | string;
  major?: string;
  iceBreakerOne?: string;
  iceBreakerTwo?: string;
  iceBreakerThree?: string;
  hobbies?: string;
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
  const [gender, setGender] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [gradYear, setGradYear] = useState<number | null>(null);
  const [major, setMajor] = useState("");
  const [ice1, setIce1] = useState("");
  const [ice2, setIce2] = useState("");
  const [ice3, setIce3] = useState("");
  const [hobbies, setHobbies] = useState("");

  const years = useMemo(() => {
    const start = 2026;
    return Array.from({ length: 25 }, (_, i) => start + i);
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // doc missing: keep everything blank
      setFirstName("");
      setLastName("");
      setGender("");
      setAge(null);
      setGradYear(null);
      setMajor("");
      setIce1("");
      setIce2("");
      setIce3("");
      setHobbies("");
      return;
    }

    const d = snap.data() as UserDoc;

    setEmail(d.email ?? auth.currentUser?.email ?? "");

    setFirstName(d.firstName ?? "");
    setLastName(d.lastName ?? "");
    setGender(d.Gender ?? "");
    setAge(toIntOrNull(d.age));
    setGradYear(toIntOrNull(d.gradYear));
    setMajor(d.major ?? "");

    setIce1(d.iceBreakerOne ?? "");
    setIce2(d.iceBreakerTwo ?? "");
    setIce3(d.iceBreakerThree ?? "");
    setHobbies(d.hobbies ?? "");
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
      } catch (e: any) {
        Alert.alert("Could not load profile", e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [router, loadProfile]);

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing fields", "Please enter your first and last name.");
      return false;
    }
    if (!gender.trim()) {
      Alert.alert("Missing fields", "Please select a gender.");
      return false;
    }
    if (age == null || age < 18 || age > 80) {
      Alert.alert("Invalid age", "Please select a valid age.");
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
    if (!ice1.trim() || !ice2.trim() || !ice3.trim()) {
      Alert.alert("Missing fields", "Please fill out all three ice breakers.");
      return false;
    }
    if (!hobbies.trim()) {
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

      await updateDoc(doc(db, "users", uid), {
        email: auth.currentUser?.email ?? email,

        firstName: firstName.trim(),
        lastName: lastName.trim(),
        Gender: gender.trim(),
        age: age,
        gradYear: gradYear,
        major: major.trim(),

        iceBreakerOne: ice1.trim(),
        iceBreakerTwo: ice2.trim(),
        iceBreakerThree: ice3.trim(),
        hobbies: hobbies.trim(),

        updatedAt: serverTimestamp(),
      });

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

  const deleteFirestoreProfile = async (userId: string) => {
    // If you later store more collections (matches/chats/photos), you’ll delete those here too.
    await deleteDoc(doc(db, "users", userId));
  };

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

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>

        <Text style={styles.label}>Email (read-only)</Text>
        <Text style={styles.readonlyValue}>{email || "-"}</Text>

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

        <Text style={styles.label}>Gender</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={gender}
            onValueChange={(v) => setGender(String(v))}
          >
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

        <Text style={styles.label}>Age</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={age}
            onValueChange={(v) => setAge(v === null ? null : Number(v))}
          >
            <Picker.Item label="Select age..." value={null} />
            {Array.from({ length: 63 }, (_, i) => 18 + i).map((n) => (
              <Picker.Item key={n} label={String(n)} value={n} />
            ))}
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
});
