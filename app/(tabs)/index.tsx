import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../firebaseConfig";

export default function HomeTab() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/(auth)/login");
    });
    return unsub;
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const goToProfileArea = () => {
    router.push("/(tabs)/profile/view");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home Page</Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 24, fontWeight: "600", marginBottom: 16 },
  button: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: "white", fontWeight: "600" },
});
