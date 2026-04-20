import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      
      <Image
        source={require("../assets/images/sad-pingu.png")}
        style={{ width: 200, height: 200, marginBottom: 20 }}
        resizeMode="contain"
      />

      <Text style={{ fontSize: 20, marginBottom: 12 }}>
        404 - Page Not Found
      </Text>

      <Pressable onPress={() => router.replace("/")}>
        <Text style={{ color: "blue" }}>Go Home</Text>
      </Pressable>
    </View>
  );
}