import { useRouter } from "expo-router";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>

      <TextInput
        placeholder="Username"
        style={styles.input}
        autoCapitalize="none"
      />

      <TextInput placeholder="Password" style={styles.input} secureTextEntry />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push("/create_account")}
      >
        <Text style={styles.primaryText}>Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => {}}>
        <Text style={styles.secondaryText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: {
    color: "white",
    fontWeight: "600",
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryText: {
    color: "#666",
  },
});
