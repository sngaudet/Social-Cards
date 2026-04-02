import { useRouter } from "expo-router";
import { deleteUser, signOut, User } from "firebase/auth";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

import { auth } from "../../firebaseConfig";



export default function SettingsPage(){
    // const router = useRouter();
    const router = useRouter();
    
    const [isVisible, setIsVisible] = useState(false)
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uid, setUid] = useState<string | null>(null);
    
    // 1. Add a piece of state at the top of your component
    const [isProcessingDeletion, setIsProcessingDeletion] = useState(false);
    // const onLogin = () => {
    //     router.replace("/(auth)/signup/hobbies");
    // }
    const handleLogout = async () => {
        await signOut(auth);
    };
    
    const toggleQ1 = () => {
        setIsVisible(prev => !prev);
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


    const onDeleteAccount = async () => {
        // if (!uid) return;
    
        const confirmed = await confirmDeleteAccount();
        if (!confirmed) return;
    
        const user: User | null = auth.currentUser;
        if (!user) {
          // router.replace("/(auth)/login");
          // router.replace({pathname: '/(auth)/login', params: { showMessage: 'DeletedAccount' },});
          router.replace({
            pathname: "/(auth)/login", 
            params: { showMessage: 'DeletedAccount' }}
          );
          return;
        }
    
        try {
          setDeleting(true);
          
          // 2. SET THE FLAG: This tells the rest of the app to stay quiet
          setIsProcessingDeletion(true);
          //   // 1) Delete Firestore profile doc first (so you don't leave orphaned data)
          //   await deleteFirestoreProfile(uid);
          
          // 2) Delete Auth user
          await deleteUser(user);
    
          await signOut(auth);
          // Alert.alert("Account deleted", "Your account has been deleted.", [
          //   { text: "OK", onPress: () => router.replace("/(auth)/login") },
          // ]);
          
          Alert.alert("Account deleted", "Your account has been deleted.", [
            { text: "OK", onPress: () => router.replace({pathname: "/", params: { showMessage: 'DeletedAccount' }}) },
          ]);
          // 4. RESET THE FLAG: After we've safely arrived
          setIsProcessingDeletion(false);

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

    
    return (
        <ScrollView contentContainerStyle = {styles.content} >
            {/* this is how to reference an image */}
            {/* <Image
              source={require('../assets/images/Ice Cube Photopea 1.png')} style={styles.welcomeLogo}
            /> */}

            <Text style={styles.title}>Settings</Text>
            <Text style={styles.title3}>Commonly Asked Questions:</Text>
            
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


            <TouchableOpacity style={styles.secondaryButton} onPress={handleLogout}>
                <Text style={styles.secondaryButtonText}>Log Out</Text>
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

            {/* <TouchableOpacity style={styles.primaryButton} 
                onPress={() => router.replace("/(auth)/signup/onboardingPermission")}>
                <Text>Next Step</Text>
            </TouchableOpacity> */}
        </ScrollView>
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
    fontSize: 13,
    color: "#666",
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
});
