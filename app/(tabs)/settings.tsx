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

import { auth } from "../../firebaseConfig";
import { signOutCurrentUser } from "../../src/auth/session";
import { prepareLocationServicesForSessionExit } from "../../src/location/service";
import { useSignup } from "../../src/signup/context";



export default function SettingsPage(){
    // const router = useRouter();
    const router = useRouter();
    const { resetDraft } = useSignup();
    
    const [isVisible, setIsVisible] = useState(false)
    const [isVisible2, setIsVisible2] = useState(false)
    const [isVisible3, setIsVisible3] = useState(false)
    const [isVisible4, setIsVisible4] = useState(false)
    const [isVisible5, setIsVisible5] = useState(false)
    const [deleting, setDeleting] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [reauthModalVisible, setReauthModalVisible] = useState(false);
    const [reauthPassword, setReauthPassword] = useState("");
    const [reauthenticating, setReauthenticating] = useState(false);
    // const onLogin = () => {
    //     router.replace("/(auth)/signup/hobbies");
    // }
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
        setIsVisible(prev => !prev);
    };
    const toggleQ2 = () => {
        setIsVisible2(prev => !prev);
    };
    const toggleQ3 = () => {
        setIsVisible3(prev => !prev);
    };
    const toggleQ4 = () => {
        setIsVisible4(prev => !prev);
    };    
    const toggleQ5 = () => {
        setIsVisible5(prev => !prev);
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
            code === "auth/wrong-password"
            || code === "auth/invalid-credential"
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

    
    return (
      <>
        <ScrollView contentContainerStyle = {styles.content} >
            {/* this is how to reference an image */}
            {/* <Image
              source={require('../assets/images/Ice Cube Photopea 1.png')} style={styles.welcomeLogo}
            /> */}

            <Text style={styles.title}>Settings</Text>
            <Text style={styles.title3}>Commonly Asked Questions:</Text>
            
            {/* Question 1 */}
            <TouchableOpacity style={styles.primaryButton2} onPress={toggleQ1}>
                <Text style={styles.thirdButtonText}>What Should my Social Card Look Like?</Text>
            </TouchableOpacity>
            
            { isVisible && (
            <Text style={styles.foruthText}>
                While Social Cards have a specific fields available to fill out, there is no 
                way that it should look like. Each Social Card is unique to the user! But we understand
                that it may be difficult to make one from scratch, so here is a template you can look at
                from our old pal Icy the Icecube!
            </Text>
            )
            }
            { isVisible && (
              <Image source={require('../../assets/images/Icy_Card.png')} 
                resizeMode="contain"/>  
            )
            }

            {/* Question 2 */}
            <TouchableOpacity style={styles.primaryButton2} onPress={toggleQ2}>
                <Text style={styles.thirdButtonText}>What Do I Do With Unfriendly Accounts?</Text>
            </TouchableOpacity>
            
            { isVisible2 && (
            <Text style={styles.foruthText}>
                There are a couple of things you can do if there is account that is acting unfriendly towards you. If
                they are not inherently breaking any of the Terms of Service rules, the best thing you can do is block them.
                This will make it so that the user you blocked can no longer see your profile and will appear in a special section in the connections
                page titled &quot;Blocked Users&quot;. You can still see chats had with blocked users bu they will be read-only.
                If a user is being unfriendly and harrasing you in a way that does break Terms of Service, please Report them 
                using the red &quot;Report&quot; button. Fill out the report form and it be investigated and the offending user will recieve
                an fitting punishment for said misconduct whether that be temporarily banning or account deletion. 
            </Text>
            )
            }

            {/* Question 3 */}
            <TouchableOpacity style={styles.primaryButton2} onPress={toggleQ3}>
                <Text style={styles.thirdButtonText}>How Do I Recover my Password or Account?</Text>
            </TouchableOpacity>
            
            { isVisible3 && (
            <Text style={styles.foruthText}>
                This is a common question we have here at Social Cards. Currently there is no way to recover an account
                that you do not know the email of. However, password recovery is a feature implemented on this application.
                To start this process, go to the Login Page and click &quot;Forgot Password&quot;. This will prompt the user to check out their
                email and click the link. This link will bring you to a page where you can update your password, which will update for all 
                future uses on the page.


            </Text>
            )
            }
            {/* Question 4 */}
            <TouchableOpacity style={styles.primaryButton2} onPress={toggleQ4}>
                <Text style={styles.thirdButtonText}>What is the Difference between an Avatar Icon and a Profile Picture, and Can I update my Profile Picture Even If I Skipped it Initally?</Text>
            </TouchableOpacity>
            
            { isVisible4 && (
            <Text style={styles.foruthText}>
                Avatar icons are mandatory to choose, and part of the signup process. By default, the avatar icon you choose will be the image displayed
                on your social card for others to see. Also in the signup process, you can choose to take a picture using the application. As it currently stands,
                if you have both a profile picture and a avatar icon, your social card will display the profile picture. However, if a user is not comfortable with displaying
                their profile picture, they can go to Profile, then Edit, then select Profile Picture under Visible Before Connection, and toggle it so that it is showing grey.
                This will make it so that people who intially see your social card see you avatar icon, and only those that match with you will see your profile picture.
              
                If you have made an account and opted to skip taking a profile picture, worry not! To add your first profile picture or update your current pciture, simply go to
                Profile, then click Edit, then on the top of the page, under Profile Image, click &quot;Take New Photo&quot;. This will then update after the user
                confirms that this picture is the one that they would like to overwrite their current photo with.
            </Text>
            )
            }
            {/* Question 5 */}
            <TouchableOpacity style={styles.primaryButton2} onPress={toggleQ5}>
                <Text style={styles.thirdButtonText}>How Do I Report Abussive or Spam Behvaior?</Text>
            </TouchableOpacity>
            
            { isVisible5 && (
            <Text style={styles.foruthText}>
                There are two locations where you can report another user from. The first option is on the Home page. On the offending user&apos;s social card, there is 
                several buttons on the bottom right of the card. The red button titled &quot;Report&quot;, when clicked, will display a report form that after being filled out will be
                investigated by someone on the Social Cards Developemnt team and an appropriate punishment will be given to the offending user. The second location that the report button
                can be found is in the personal message page between two users. On the top right of the message page, there should be a similar red button titled &quot;Report&quot;, that gives the same report form 
                as the one on the Home Page. It is also recomended that if you report a user for malicous behavior that you also Block them as well so that the have no further way of contacting you or viewing 
                your profile.
            </Text>
            )
            }

            {/* end of questions */}
            <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  loggingOut && styles.disabledButton,
                ]}
                onPress={handleLogout}
                disabled={loggingOut}
            >
                <Text style={styles.secondaryButtonText}>
                  {loggingOut ? "Logging out..." : "Log Out"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                    style={[
                      styles.dangerButton,
                      (deleting || reauthenticating) && styles.disabledButton,
                    ]}
                    onPress={onDeleteAccount}
                    disabled={deleting || reauthenticating}
                  >
                    <Text style={styles.dangerText}>
                      {deleting ? "Deleting..." : "Delete Account"}
                    </Text>
              </TouchableOpacity>

            {/* <TouchableOpacity style={styles.primaryButton} 
                onPress={() => router.replace("/(auth)/signup/onboardingPermission")}>
                <Text>Next Step</Text>
            </TouchableOpacity> */}
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
            <Pressable style={styles.reauthBackdrop} onPress={closeReauthModal} />
            <View style={styles.reauthCard}>
              <Text style={styles.reauthTitle}>Confirm your password</Text>
              <Text style={styles.reauthSubtitle}>
                Firebase requires a recent login before deleting your account.
                Enter your current password to continue.
              </Text>

              <TextInput
                value={reauthPassword}
                onChangeText={setReauthPassword}
                placeholder="Current password"
                placeholderTextColor="#6B7280"
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
                  style={styles.reauthCancelButton}
                  onPress={closeReauthModal}
                  disabled={reauthenticating}
                >
                  <Text style={styles.reauthCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
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
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </>
    );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },

  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    backgroundColor: "#D9E0F0",
    gap: 20,
  },

  title: {
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },

  title2: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },

  title3: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },

  input: {
    fontSize: 16,
  },

  // FAQ button → card style
  primaryButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    marginBottom: 12,
  },

  primaryButton2: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    marginBottom: 12,
  },

  primaryText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },

  // Logout button 
  secondaryButton: {
    backgroundColor: "#888",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },

  secondaryText: {
    color: "#fff",
    fontSize: 14,
  },

  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  thirdText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },

  thirdButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
  },

  foruthText: {
    fontSize: 16,
    // color: "#666",
    color: "#000000",
    backgroundColor: "#89DBFB",
    borderRadius: 8,
    padding: 10,
    textAlign: "center",
    marginBottom: 8,
  },

  welcomeLogo: {
    width: 200,
    height: 200,
    alignSelf: "center",
  },

  cardFormat: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },

  // Delete button
  dangerButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },

  dangerText: {
    color: "#fff",
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.6,
  },

  reauthModalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },

  reauthBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },

  reauthCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },

  reauthTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },

  reauthSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },

  reauthInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },

  reauthActionRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },

  reauthCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },

  reauthCancelText: {
    color: "#0F172A",
    fontWeight: "600",
  },

  reauthDeleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#DC2626",
  },

  reauthDeleteText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
