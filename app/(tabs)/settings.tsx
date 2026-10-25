import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  User,
} from "firebase/auth";
import React, { useState } from "react";
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { iceColors as colors, iceMascot } from "../../src/theme/icebreakers";
import { auth } from "../../firebaseConfig";
import { signOutCurrentUser } from "../../src/auth/session";
import { prepareLocationServicesForSessionExit } from "../../src/location/service";
import { useSignup } from "../../src/signup/context";

const SETTINGS_FAQS = [
  {
    question: "What does my Social Card look like?",
    answer:
      "While Social Cards have specific fields available to fill out, there is no one way that it should look. Each Social Card is unique to the user! But we understand that it may be difficult to make one from scratch, so here is a template you can look at from our old pal Icey the Ice Cube!",
  },
  {
    question: "What do I do with unfriendly accounts?",
    answer:
      'There are a couple of things you can do if there is an account that is acting unfriendly towards you. If they are not inherently breaking any of the Terms of Service rules, the best thing you can do is block them. This will make it so that the user you blocked can no longer see your profile and will appear in a special section in the connections page titled "Blocked Users". You can still see chats you had with blocked users but they will be read-only. If a user is being unfriendly and harassing you in a way that does break Terms of Service, please select "Report" from their card options or chat. Fill out the report form and it will be investigated. If we find the allegations to be accurate the offending user will recieve a fitting punishment. Some examples of punishment would be a temporary ban or account deletion.',
  },
  {
    question: "How do I recover my password or account?",
    answer:
      'This is a common question we have here at Social Cards. Currently, there is no way to recover an account that you do not know the email of. However, password recovery is a feature implemented in this application. To start this process, go to the Login Page and click "Forgot Password". This will prompt you to check your email and click the link. This link will bring you to a page where you can update your password.',
  },
  {
    question:
      "What is the difference between an avatar icon and a profile picture, and can I update my profile picture even if I skipped it initially?",
    answer:
      'Avatar icons are required to be chosen on signup. There is no way to make an account without choosing one. By default, the avatar icon you choose will be the image displayed on your social card for others to see. Also, in the signup process, you can choose to take a picture through the app. As it currently stands, if you have both a profile picture and an avatar icon, your social card will display the profile picture. However, if a user is not comfortable with displaying their profile picture, they can go to Profile, then Edit, then select Profile Photo under Visible Before Connection, and toggle it so that it is showing grey. This will make it so that people who initially see your social card see your avatar icon, and only those that match with you will see your profile picture. If you have made an account and opted to skip taking a profile picture, worry not! To add your first profile picture or update your current picture, simply go to Profile, then click Edit, then on the top of the page, under Profile Photo, click "Take Photo". Then tap "Save Changes" to upload your photo.',
  },
  {
    question: "How do I report abusive or spam behavior?",
    answer:
      'There are two locations where you can report another user. The first option is on the Home page. On the offending user\'s social card, open the options menu and select "Report". This will display a report form which, after being filled out, will be investigated by someone on the Icebreakers team and an appropriate punishment will be given to the offending user. The second location that the report button can be found is in the personal message page between two users. On the top right of the message page, there should be a similar red button titled "Report", that gives the same report form as the one on the Home Page. It is also recomended that if you report a user for malicious behavior that you also Block them so that they have no further way of contacting you or viewing your profile.',
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { resetDraft } = useSignup();

  const [isVisible, setIsVisible] = useState(false);
  const [isVisible2, setIsVisible2] = useState(false);
  const [isVisible3, setIsVisible3] = useState(false);
  const [isVisible4, setIsVisible4] = useState(false);
  const [isVisible5, setIsVisible5] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [reauthModalVisible, setReauthModalVisible] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthenticating, setReauthenticating] = useState(false);
  const handleLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await signOutCurrentUser();
      router.replace("/(auth)/login");
    } catch (e: any) {
      Alert.alert(
        "Logout failed",
        e?.message ?? "We could not log you out right now. Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  const toggleQ1 = () => {
    setIsVisible((prev) => !prev);
  };
  const toggleQ2 = () => {
    setIsVisible2((prev) => !prev);
  };
  const toggleQ3 = () => {
    setIsVisible3((prev) => !prev);
  };
  const toggleQ4 = () => {
    setIsVisible4((prev) => !prev);
  };
  const toggleQ5 = () => {
    setIsVisible5((prev) => !prev);
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

  const closeReauthModal = () => {
    if (reauthenticating) return;
    setReauthPassword("");
    setReauthModalVisible(false);
  };

  const redirectToDeletedAccountLogin = () => {
    resetDraft();
    router.replace({
      pathname: "/(auth)/login",
      params: { showMessage: "DeletedAccount" },
    });
  };

  const finalizeDeleteAccount = async (userToDelete: User) => {
    await prepareLocationServicesForSessionExit();
    await deleteUser(userToDelete);
    await signOut(auth).catch(() => {});
    setReauthPassword("");
    setReauthModalVisible(false);

    if (Platform.OS === "web") {
      (globalThis as any).alert?.("Your account has been deleted.");
      redirectToDeletedAccountLogin();
      return;
    }

    Alert.alert("Account deleted", "Your account has been deleted.", [
      {
        text: "OK",
        onPress: redirectToDeletedAccountLogin,
      },
    ]);
  };

  const handleReauthenticateAndDelete = async () => {
    const user = auth.currentUser;
    if (!user) {
      closeReauthModal();
      router.replace("/(auth)/login");
      return;
    }

    if (!user.email) {
      Alert.alert(
        "Delete failed",
        "This account cannot be reauthenticated automatically. Please log in again and try deleting your account.",
      );
      closeReauthModal();
      await signOutCurrentUser().catch(() => {});
      router.replace("/(auth)/login");
      return;
    }

    if (!reauthPassword.trim()) {
      Alert.alert(
        "Password required",
        "Enter your current password to delete your account.",
      );
      return;
    }

    try {
      setReauthenticating(true);
      const credential = EmailAuthProvider.credential(
        user.email,
        reauthPassword,
      );

      await reauthenticateWithCredential(user, credential);
      setDeleting(true);
      await finalizeDeleteAccount(auth.currentUser ?? user);
    } catch (e: any) {
      const code = e?.code as string | undefined;

      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        Alert.alert(
          "Incorrect password",
          "Enter the current password for this account and try again.",
        );
      } else if (code === "auth/too-many-requests") {
        Alert.alert(
          "Too many attempts",
          "Wait a moment, then try entering your password again.",
        );
      } else {
        Alert.alert(
          "Delete failed",
          e?.message ?? "We could not verify your account. Try again.",
        );
      }
    } finally {
      setReauthenticating(false);
      setDeleting(false);
    }
  };

  const onDeleteAccount = async () => {
    // if (!uid) return;

    const confirmed = await confirmDeleteAccount();
    if (!confirmed) return;

    const user: User | null = auth.currentUser;
    if (!user) {
      Alert.alert(
        "Please log in again",
        "Your session expired. Log in again, then retry deleting your account.",
      );
      router.replace("/(auth)/login");
      return;
    }

    try {
      setDeleting(true);
      await finalizeDeleteAccount(user);
    } catch (e: any) {
      const code = e?.code as string | undefined;

      if (code === "auth/requires-recent-login") {
        if (!user.email) {
          Alert.alert(
            "Please log in again",
            "For security, please log in again and then try deleting your account.",
          );
          await signOutCurrentUser().catch(() => {});
          router.replace("/(auth)/login");
          return;
        }

        setReauthPassword("");
        setReauthModalVisible(true);
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

  const accountBusy = loggingOut || deleting || reauthenticating;
  const faqStates = [
    { expanded: isVisible, onPress: toggleQ1 },
    { expanded: isVisible2, onPress: toggleQ2 },
    { expanded: isVisible3, onPress: toggleQ3 },
    { expanded: isVisible4, onPress: toggleQ4 },
    { expanded: isVisible5, onPress: toggleQ5 },
  ];

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.page}>
          <View style={styles.brand}>
            <Image
              source={iceMascot}
              style={styles.mascot}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>Icebreakers</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Settings
          </Text>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Commonly Asked Questions
            </Text>
            <View style={styles.faqCard}>
              {SETTINGS_FAQS.map((faq, index) => {
                const { expanded, onPress } = faqStates[index];
                return (
                  <View
                    key={faq.question}
                    style={index > 0 && styles.faqDivider}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={faq.question}
                      accessibilityState={{ expanded }}
                      aria-expanded={expanded}
                      onPress={onPress}
                      style={({ pressed }) => [
                        styles.questionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.question}>{faq.question}</Text>
                      <Feather
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={19}
                        color={colors.muted}
                      />
                    </Pressable>
                    {expanded && (
                      <View style={styles.answerBody}>
                        <Text style={styles.answer}>{faq.answer}</Text>
                        {index === 0 && (
                          <Image
                            accessibilityLabel="Icey's example Social Card"
                            source={require("../../assets/images/Icy_Card.png")}
                            style={styles.exampleCard}
                            resizeMode="contain"
                          />
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.accountActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={loggingOut ? "Logging out..." : "Log Out"}
              accessibilityState={{ disabled: accountBusy, busy: loggingOut }}
              style={[
                styles.accountButton,
                accountBusy && styles.disabledButton,
              ]}
              onPress={handleLogout}
              disabled={accountBusy}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={colors.blue} />
              ) : (
                <Feather name="log-out" size={21} color={colors.blue} />
              )}
              <Text style={styles.logoutText}>
                {loggingOut ? "Logging out..." : "Log Out"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={deleting ? "Deleting..." : "Delete Account"}
              accessibilityState={{ disabled: accountBusy, busy: deleting }}
              style={[
                styles.accountButton,
                styles.deleteButton,
                accountBusy && styles.disabledButton,
              ]}
              onPress={onDeleteAccount}
              disabled={accountBusy}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#E74652" />
              ) : (
                <Feather name="trash-2" size={21} color="#E74652" />
              )}
              <Text style={styles.deleteText}>
                {deleting ? "Deleting..." : "Delete Account"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={reauthModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeReauthModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.reauthModalRoot}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel account deletion"
            style={styles.reauthBackdrop}
            onPress={closeReauthModal}
            disabled={reauthenticating}
          />
          <View style={styles.reauthCard} accessibilityViewIsModal>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.reauthContent}
            >
              <Text accessibilityRole="header" style={styles.reauthTitle}>
                Confirm your password
              </Text>
              <Text style={styles.reauthSubtitle}>
                For your security, enter your current password to delete your
                account.
              </Text>
              <TextInput
                accessibilityLabel="Current password"
                value={reauthPassword}
                onChangeText={setReauthPassword}
                placeholder="Current password"
                placeholderTextColor={colors.muted}
                style={styles.reauthInput}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!reauthenticating}
                returnKeyType="done"
                onSubmitEditing={() => {
                  handleReauthenticateAndDelete().catch(() => {});
                }}
              />
              <View style={styles.reauthActionRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.reauthCancelButton}
                  onPress={closeReauthModal}
                  disabled={reauthenticating}
                >
                  <Text style={styles.reauthCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.reauthDeleteButton,
                    reauthenticating && styles.disabledButton,
                  ]}
                  onPress={() => {
                    handleReauthenticateAndDelete().catch(() => {});
                  }}
                  disabled={reauthenticating}
                >
                  <Text style={styles.reauthDeleteText}>
                    {reauthenticating ? "Verifying..." : "Delete account"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24 },
  page: { width: "100%", maxWidth: 600, alignSelf: "center", gap: 20 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  mascot: { width: 45, height: 48 },
  brandName: { fontFamily: "LexendSemiBold", fontSize: 23, color: colors.ink },
  title: {
    fontFamily: "LexendSemiBold",
    fontSize: 29,
    lineHeight: 39,
    textAlign: "center",
    color: colors.ink,
  },
  section: { gap: 14 },
  sectionTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 19,
    lineHeight: 27,
    color: colors.ink,
    paddingHorizontal: 2,
  },
  faqCard: {
    borderRadius: 20,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    shadowColor: "#8EAFD0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  faqDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 18,
  },
  question: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
  },
  pressed: { opacity: 0.65 },
  answerBody: { gap: 14, paddingBottom: 18 },
  answer: { fontSize: 13, lineHeight: 21, color: colors.muted },
  exampleCard: {
    width: "100%",
    aspectRatio: 432 / 267,
    borderRadius: 12,
    backgroundColor: colors.frost,
  },
  accountActions: { gap: 12 },
  accountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: colors.surface,
  },
  logoutText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
    color: colors.blue,
  },
  deleteButton: { borderColor: "#E74652" },
  deleteText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
    color: "#E74652",
  },
  disabledButton: { opacity: 0.6 },
  reauthModalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  reauthBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,23,73,0.35)",
  },
  reauthCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    borderRadius: 20,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  reauthContent: { padding: 20, gap: 14 },
  reauthTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 21,
    lineHeight: 29,
    color: colors.ink,
  },
  reauthSubtitle: { fontSize: 14, lineHeight: 21, color: colors.muted },
  reauthInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.frost,
  },
  reauthActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
  },
  reauthCancelButton: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.frost,
    justifyContent: "center",
  },
  reauthCancelText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.muted,
  },
  reauthDeleteButton: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#D93443",
    justifyContent: "center",
  },
  reauthDeleteText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.surface,
  },
});
