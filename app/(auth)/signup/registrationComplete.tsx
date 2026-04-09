import { Href, useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  User,
} from "firebase/auth";
import {
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import React, { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";
import PrimaryButton from "../../../src/components/PrimaryButton";
import { getAvatarImageSource } from "../../../src/lib/avatarImages";
import { normalizeHobbies } from "../../../src/lib/hobbies";
import {
  deleteUploadedProfilePhotoAsync,
  uploadProfilePhotoAsync,
} from "../../../src/lib/picture_upload";
import { calculateAgeFromDateOfBirth } from "../../../src/lib/profileFields";
import { DEFAULT_PRE_CONNECTION_VISIBILITY } from "../../../src/profile/visibility";
import { useSignup } from "../../../src/signup/context";

const FALLBACK_ICEBREAKER_QUESTIONS = [
  "What's your ideal weekend?",
  "What food can you never say no to?",
  "Share one fun fact about yourself",
];

export default function RegistrationCompletePage() {
  const router = useRouter();
  const { draft, resetDraft } = useSignup();

  const avatarSource = getAvatarImageSource(draft.avatarId);

  const [submitting, setSubmitting] = useState(false);
  const hobbies = useMemo(
    () => normalizeHobbies(draft.hobbies),
    [draft.hobbies],
  );
  const derivedAge = useMemo(
    () => calculateAgeFromDateOfBirth(draft.dateOfBirth),
    [draft.dateOfBirth],
  );

  
  const primaryIcebreaker = useMemo(() => {
    if (!draft.iceBreakerOne?.trim()) return null;
      return {
        question:
          draft.iceBreakerOneQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[0],
          answer: draft.iceBreakerOne,
      };
  }, [draft.iceBreakerOne, draft.iceBreakerOneQuestion]);


  const missing = useMemo(() => {
    const fields: string[] = [];
    const completedIceBreakers = [
      draft.iceBreakerOne,
      draft.iceBreakerTwo,
      draft.iceBreakerThree,
    ].filter((value) => value?.trim()).length;

    if (!draft.email?.trim()) fields.push("email");
    if (!draft.password) fields.push("password");
    if (!draft.firstName?.trim()) fields.push("first name");
    if (!draft.lastName?.trim()) fields.push("last name");
    if (!draft.dateOfBirth?.trim()) fields.push("date of birth");
    if (!draft.bio?.trim()) fields.push("bio");
    if (!draft.pronouns?.trim()) fields.push("pronouns");
    if (draft.gradYear == null) fields.push("grad year");
    if (!draft.major?.trim()) fields.push("major");
    if (completedIceBreakers < 3) fields.push("3 icebreakers");
    if (hobbies.length === 0) fields.push("hobbies");
    if (!draft.avatarId?.trim()) fields.push("avatar");
    return fields;
  }, [draft, hobbies]);

  const redirectToSignupWithError = (title: string, message: string) => {
    router.replace({
      pathname: "/(auth)/signup",
      params: {
        errorTitle: title,
        errorMessage: message,
      },
    } as Href);
  };

  const handleSubmit = async () => {
    if (missing.length > 0) {
      redirectToSignupWithError(
        "Missing info",
        `Please finish: ${missing.join(", ")}.`,
      );
      return;
    }

    const email = draft.email.trim();
    const password = draft.password;

    if (!email.includes("@")) {
      redirectToSignupWithError(
        "Invalid email",
        "Enter a valid email address.",
      );
      return;
    }

    if (password.length < 6) {
      redirectToSignupWithError("Weak password", "Use at least 6 characters.");
      return;
    }

    let createdUser: User | null = null;
    const uploadedPhotoUrls: string[] = [];

    try {
      setSubmitting(true);

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = cred.user;

      for (const uri of draft.photoUris ?? []) {
        const url = await uploadProfilePhotoAsync(uri, cred.user.uid);
        uploadedPhotoUrls.push(url);
      }

      const photoURL = uploadedPhotoUrls[0] ?? "";
      const userRef = doc(db, "users", cred.user.uid);
      const publicProfileRef = doc(db, "publicProfiles", cred.user.uid);
      const batch = writeBatch(db);

      batch.set(userRef, {
        email: cred.user.email,
        firstName: draft.firstName ?? "",
        lastName: draft.lastName ?? "",
        dateOfBirth: draft.dateOfBirth ?? "",
        bio: draft.bio ?? "",
        pronouns: draft.pronouns ?? "",
        age: derivedAge ?? "",
        gradYear: draft.gradYear ?? "",
        major: draft.major ?? "",
        minor: draft.minor ?? "",
        iceBreakerOne: draft.iceBreakerOne ?? "",
        iceBreakerOneQuestion:
          draft.iceBreakerOneQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[0],
        iceBreakerTwo: draft.iceBreakerTwo ?? "",
        iceBreakerTwoQuestion:
          draft.iceBreakerTwoQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[1],
        iceBreakerThree: draft.iceBreakerThree ?? "",
        iceBreakerThreeQuestion:
          draft.iceBreakerThreeQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[2],
        hobbies,
        avatarId: draft.avatarId ?? "",
        photoURL,
        photoUrls: uploadedPhotoUrls,
        preConnectionVisibility: DEFAULT_PRE_CONNECTION_VISIBILITY,
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

      batch.set(publicProfileRef, {
        firstName: draft.firstName ?? "",
        lastName: draft.lastName ?? "",
        dateOfBirth: draft.dateOfBirth ?? "",
        bio: draft.bio ?? "",
        pronouns: draft.pronouns ?? "",
        age: derivedAge ?? "",
        gradYear: draft.gradYear ?? "",
        major: draft.major ?? "",
        minor: draft.minor ?? "",
        iceBreakerOne: draft.iceBreakerOne ?? "",
        iceBreakerOneQuestion:
          draft.iceBreakerOneQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[0],
        iceBreakerTwo: draft.iceBreakerTwo ?? "",
        iceBreakerTwoQuestion:
          draft.iceBreakerTwoQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[1],
        iceBreakerThree: draft.iceBreakerThree ?? "",
        iceBreakerThreeQuestion:
          draft.iceBreakerThreeQuestion?.trim() ||
          FALLBACK_ICEBREAKER_QUESTIONS[2],
        hobbies,
        avatarId: draft.avatarId ?? "",
        photoURL,
        preConnectionVisibility: DEFAULT_PRE_CONNECTION_VISIBILITY,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      resetDraft();
      router.replace("/(tabs)");
    } catch (e: any) {
      if (createdUser) {
        const cleanupTasks: Promise<unknown>[] = [
          deleteDoc(doc(db, "users", createdUser.uid)),
          deleteDoc(doc(db, "publicProfiles", createdUser.uid)),
          ...uploadedPhotoUrls.map((url) =>
            deleteUploadedProfilePhotoAsync(url),
          ),
        ];

        await Promise.allSettled(cleanupTasks);

        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          console.warn(
            "Could not roll back partially created auth user",
            cleanupError,
          );
          if (auth.currentUser?.uid === createdUser.uid) {
            await signOut(auth).catch((signOutError) => {
              console.warn(
                "Could not sign out after failed signup cleanup",
                signOutError,
              );
            });
          }
        }
      }

      const code = e?.code as string | undefined;

      if (code === "auth/email-already-in-use") {
        redirectToSignupWithError(
          "Email already in use",
          "Try logging in instead or use a different email.",
        );
      } else if (code === "auth/invalid-email") {
        redirectToSignupWithError(
          "Invalid email",
          "Check your email address and try again.",
        );
      } else if (code === "auth/weak-password") {
        redirectToSignupWithError(
          "Weak password",
          "Use at least 6 characters.",
        );
      } else {
        redirectToSignupWithError("Error", e?.message ?? "Signup failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Welcome to Icebreakers!</Text>

      <Text style={styles.subtitle}>
        You&apos;re all set and ready to connect. Here {"\n"}
        is how you look to other students nearby.
      </Text>

      {/* CARD INFO */}
      


      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          {avatarSource ? (
            <Image source={avatarSource} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarTextKeep}>No Avatar</Text>
            </View>
          )}
          
          <View style={styles.userBody}>
            <View style={styles.headerTopRow}>
              <Text style={styles.userName}>
                {/*{[draft.firstName, draft.lastName].filter(Boolean).join(" ") || "Unknown"}*/}
                {draft.firstName || "Unknown"}
              </Text>
            </View>

            <View style={styles.metaRow}>
              {!!draft.pronouns && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Pronouns</Text>
                  <Text style={styles.metaValue}>{draft.pronouns.toUpperCase()}</Text>
                </View>
              )}

              {derivedAge != null && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Age</Text>
                  <Text style={styles.metaValue}>{derivedAge}</Text>
                </View>
              )}

              {!!draft.gradYear && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Exp Graduation</Text>
                  <Text style={styles.metaValue}>{draft.gradYear}</Text>
                </View>
              )}
            </View>

            {hobbies.length > 0 && (
              <View style={styles.hobbiesBlock}>
                <Text style={styles.metaLabel}>Hobbies</Text>
                <View style={styles.hobbyWrap}>
                  {hobbies.slice(0, 4).map((hobby) => (
                    <Text key={hobby} style={styles.hobbyChip}>
                      {hobby.toUpperCase()}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {primaryIcebreaker && (
              <View style={styles.promptBlock}>
                <Text style={styles.promptLabel}>Conversation Starter</Text>

                <Text style={styles.promptQuestion}>
                  {primaryIcebreaker.question}
                </Text>

                <Text style={styles.promptValue}>
                  {primaryIcebreaker.answer}
                </Text>
              </View>
            )}

            <View style={styles.footerRow}>
              <View style={styles.footerInfo}>
                {!!draft.major && (
                  <>
                  <Text style={styles.footerLabel}>Major</Text>
                  <Text style={styles.footerValue}>{draft.major.toUpperCase()}</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.subCard}>
        <Text style={styles.upperSub}>Nearby into cards, not a map</Text>

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

      <Text style={styles.warningText}>
        By creating an account, you agree to our Terms.
      </Text>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.replace("/(auth)/signup/onboardingPermission")}
      >
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>
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
    backgroundColor: "#D9E0F0",
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
  avatarTextKeep: {
    fontSize: 10,
    color: "#666",
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

  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    width: "100%",
    //maxWidth: 360,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
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
  },

  avatarText: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  profileMeta: {
    fontSize: 13,
    color: "#6B7280",
  },

  hobbies: {
    marginTop: 14,
    fontSize: 13,
    color: "#374151",
  },
  bio: {
    marginTop: 10,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  icebreakers: {
    marginTop: 12,
  },
  icebreaker: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  academics: {
    fontSize: 14,
    color: "#111827",
    marginTop: 4,
    fontWeight: "600",
  },
  profileTextBlock: {
    marginLeft: 14,
    flex: 1,
  },
  bold: {
    fontWeight: "700",
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 8,
    textAlign: "center",
    marginBottom: 30,
  },
  secondaryText: {
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
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
    width: "100%",
    marginBottom: 24,
  },

  userHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  userBody: {
    flex: 1,
    gap: 8,
  },

  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  userName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f4aaa",
    letterSpacing: 0.4,
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
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#303b52",
    letterSpacing: 0.5,
  },

  metaValue: {
    fontSize: 12,
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

  footerRow: {
    marginTop: 4,
    flexDirection: "row",
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

  promptQuestion: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0e3365",
    textAlign: "center",
  },
});
