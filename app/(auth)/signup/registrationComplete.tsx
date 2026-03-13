import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";
import PrimaryButton from "../../../src/components/PrimaryButton";
import { normalizeHobbies } from "../../../src/lib/hobbies";
import { uploadProfilePhotoAsync } from "../../../src/lib/picture_upload";
import { useSignup } from "../../../src/signup/context";

export default function RegistrationCompletePage(){
    const router = useRouter();
    const { draft, resetDraft } = useSignup();
    const [submitting, setSubmitting] = useState(false);
    const hobbies = useMemo(() => normalizeHobbies(draft.hobbies), [draft.hobbies]);

    const missing = useMemo(() => {
      const fields: string[] = [];
      if (!draft.email?.trim()) fields.push("email");
      if (!draft.password) fields.push("password");
      if (!draft.firstName?.trim()) fields.push("first name");
      if (!draft.lastName?.trim()) fields.push("last name");
      if (!draft.Gender?.trim()) fields.push("gender");
      if (draft.age == null) fields.push("age");
      if (draft.gradYear == null) fields.push("grad year");
      if (!draft.major?.trim()) fields.push("major");
      if (!draft.iceBreakerOne?.trim()) fields.push("ice breaker 1");
      if (!draft.iceBreakerTwo?.trim()) fields.push("ice breaker 2");
      if (!draft.iceBreakerThree?.trim()) fields.push("ice breaker 3");
      if (hobbies.length === 0) fields.push("hobbies");
      return fields;
    }, [draft, hobbies]);

    const handleSubmit = async () => {
      if (missing.length > 0) {
        Alert.alert(
          "Missing info",
          `Please go back and fill: ${missing.join(", ")}.`,
        );
        return;
      }

      const email = draft.email.trim();
      const password = draft.password;

      if (!email.includes("@")) {
        Alert.alert("Invalid email", "Enter a valid email address.");
        return;
      }

      if (password.length < 6) {
        Alert.alert("Weak password", "Use at least 6 characters.");
        return;
      }

      try {
        setSubmitting(true);

        const cred = await createUserWithEmailAndPassword(auth, email, password);

        const photoUrls: string[] = [];
        for (const uri of draft.photoUris ?? []) {
          const url = await uploadProfilePhotoAsync(uri, cred.user.uid);
          photoUrls.push(url);
        }

        const photoURL = photoUrls[0] ?? "";

        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email,
          firstName: draft.firstName ?? "",
          lastName: draft.lastName ?? "",
          Gender: draft.Gender ?? "",
          age: draft.age ?? "",
          gradYear: draft.gradYear ?? "",
          major: draft.major ?? "",
          iceBreakerOne: draft.iceBreakerOne ?? "",
          iceBreakerTwo: draft.iceBreakerTwo ?? "",
          iceBreakerThree: draft.iceBreakerThree ?? "",
          hobbies,
          photoURL,
          photoUrls,
          locationControl: {
            sharingEnabled: draft.locationSharingEnabled,
            permissionStatus: draft.locationPermissionStatus,
            updatedAt: serverTimestamp(),
          },
          locationStatus: {
            lastLocationAt: null,
            lastAccuracyM: null,
            lastSource: null,
          },
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, "publicProfiles", cred.user.uid), {
          firstName: draft.firstName ?? "",
          lastName: draft.lastName ?? "",
          Gender: draft.Gender ?? "",
          age: draft.age ?? "",
          gradYear: draft.gradYear ?? "",
          major: draft.major ?? "",
          iceBreakerOne: draft.iceBreakerOne ?? "",
          iceBreakerTwo: draft.iceBreakerTwo ?? "",
          iceBreakerThree: draft.iceBreakerThree ?? "",
          hobbies,
          photoURL,
          updatedAt: serverTimestamp(),
        });

        resetDraft();
        router.replace("/(tabs)");
      } catch (e: any) {
        console.error("registrationComplete.handleSubmit failed", e);
        const code = e?.code as string | undefined;

        if (code === "auth/email-already-in-use") {
          Alert.alert("Email already in use", "Try logging in instead.");
        } 
        else if (code === "auth/invalid-email") {
          Alert.alert("Invalid email", "Check your email address and try again.");
        } 
        else if (code === "auth/weak-password") {
          Alert.alert("Weak password", "Use at least 6 characters.");
        } 
        else {
          Alert.alert("Error", e?.message ?? "Signup failed.");
        }
      } finally {
        setSubmitting(false);
      }
    };
    
    return (
        <ScrollView contentContainerStyle = {styles.content} >
            <Text style={styles.title}>Welcome to Icebreakers!</Text>

            <Text style={styles.subtitle}>
              You’re all set up and ready to connect. Here{"\n"}
              is how you look to students nearby.  
            </Text>

            {/* CARD WITH REGISTRATION INFO */}
            <View style={styles.userCard}>
              <View style={styles.userHeader}>
                {/* Photo */}
                {draft.photoUris?.[0] ? (
                  <Image source={{ uri: draft.photoUris[0] }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>No Photo</Text>
                  </View>
                )}

                <Text style={styles.name}>
                  {[draft.firstName, draft.lastName]
                    .map((s) => (typeof s === "string" ? s.trim() : s))
                    .filter((s) => typeof s === "string" && s.length > 0)
                    .join(" ") || "Unknown"}
                </Text>
              </View>

              {/* Major */}
              <Text style={styles.label}>Major</Text>
              <Text style={styles.value}>{draft.major ?? "-"}</Text>

              {/* Hobbies */}
              <Text style={styles.label}>Hobbies</Text>
              <Text style={styles.value}>
                {hobbies.length > 0 ? hobbies.join(", ") : "-"}
              </Text>
   
              {/* Icebreakers */}
              <Text style={styles.label}>Icebreakers</Text>
              <Text style={styles.value}>- {draft.iceBreakerOne || "-"}</Text>
              <Text style={styles.value}>- {draft.iceBreakerTwo || "-"}</Text>
              <Text style={styles.value}>- {draft.iceBreakerThree || "-"}</Text>
            </View>

            <View style={styles.subCard}>
              <Text style={styles.upperSub}>
                Nearby into cards, not a map
              </Text>

              <Text style={styles.subtitle}>
                See who is nearby. Your location is {"\n"}
                private, but is needed to make {"\n"}
                connections with others users.
              </Text>
            </View>
            
            <PrimaryButton
              title={submitting ? "Submitting..." : "Start Discovering Nearby"}
              showArrow={!submitting}
              style={styles.primaryButton}
              onPress={handleSubmit}
              disabled={submitting}
            />

            <Text style={styles.warningText}>By creating an account, you agree to our Terms.</Text>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { 
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48, 
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#D9E0F0', 
  },
  title: {
    fontSize: 38,
    fontWeight: "600",
    marginBottom: 44,
    textAlign: "center",
  },
  primaryButton: {
    marginBottom: 12,
  },

  
/* PREVIEW CARD STYLES */
  userCard: {
    width: "50%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 20,
  },

  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e5e7eb",
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 10,
    color: "#666",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  
  label: {
    marginTop: 8,
    color: "#666",
    fontSize: 12,
  },
  value: {
    fontSize: 14,
  },
  subCard: {
    width: "20%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  upperSub: {
    fontSize: 18,
    textAlign: "center",
    color: "#000000",
    marginBottom: 10,
    maxWidth: 320,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 30,
    maxWidth: 320,
  },
  warningText: {
    fontSize: 14,
    textAlign: "center",
    color: "#646363",
    marginBottom: 30,
    maxWidth: 320,
  },

});

