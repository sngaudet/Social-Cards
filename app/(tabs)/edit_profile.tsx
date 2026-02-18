import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../firebaseConfig";

export default function EditProfile() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
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
