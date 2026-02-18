import { useRouter } from "expo-router";
import { deleteUser, onAuthStateChanged, signOut } from "firebase/auth";
import { useEffect, useRef } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";

export default function EditProfile() {
  const router = useRouter();
  const isDeletingRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user && !isDeletingRef.current) {
        router.replace("/(auth)/login");
      }
    });

    return unsub;
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleHome = () => {
    router.replace("/(tabs)");
  };

  const confirmDeleteProfile = () => {
    if (Platform.OS === "web") {
      const first = (globalThis as any).confirm?.(
        "Delete profile?\nThis will permanently delete your account."
      );
      if (!first) return Promise.resolve(false);
      const second = (globalThis as any).confirm?.(
        "This cannot be undone. Delete your account?"
      );
      return Promise.resolve(Boolean(second));
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        "Delete profile?",
        "This will permanently delete your account.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Delete", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });
  };

  const handleDeleteProfile = async () => {
    const confirmed = await confirmDeleteProfile();
    if (!confirmed) return;

    const user = auth.currentUser;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    try {
      isDeletingRef.current = true;
      await deleteUser(user);
      if (Platform.OS === "web") {
        (globalThis as any).alert?.("Account deleted. Your account has been deleted.");
        router.replace("/(auth)/login");
      } else {
        Alert.alert("Account deleted", "Your account has been deleted.", [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]);
      }
    } catch (err) {
      isDeletingRef.current = false;
      Alert.alert(
        "Delete failed",
        "Please log in again and try deleting your account."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Edit Profile Page</Text>

      {/* <View style={styles.navbar}>
        <Link href="/">
            <Text style={styles.linkText}>Home</Text>
        </Link>

        <Link href="/edit_profile">
            <Text style={styles.linkText}>Edit Profile</Text>
        </Link>
      </View> */}

      

      <TouchableOpacity style={styles.button} onPress={handleHome}>
        <Text style={styles.buttonText}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProfile}>
        <Text style={styles.deleteButtonText}>Delete Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  deleteButton: {
    marginTop: 12,
    backgroundColor: "#ef4444",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "600",
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: 'Dark-Green'
  },
    linkText: {
    color: "#3b82f6",
    textAlign: "center",
    textDecorationLine: "underline",
    fontWeight: "500",
  },
});
