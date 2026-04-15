import { Href, useRouter } from "expo-router";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PrimaryButton from "../src/components/PrimaryButton";
import SecondaryButton from "../src/components/SecondaryButton";
import { useSignup } from "../src/signup/context";


export default function WelcomePage(){
    const router = useRouter();
    const { resumeRoute, shouldResumeSignup } = useSignup();
    const insets = useSafeAreaInsets();
    // const onLogin = () => {
    //     router.replace("/(auth)/signup/hobbies");
    // }
    
    return (
      <View style={styles.page}>
        <View
          pointerEvents="none"
          style={[
            styles.topBleed,
            { height: insets.top + 160, top: -(insets.top + 120) },
          ]}
        />
        <ScrollView
          style={styles.scroll}
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.content}
        >
            
            <Image
              source={require('../assets/images/Ice Cube Photopea 1.png')} style={styles.welcomeLogo}
            />

            <Text style={styles.title}>Icebreaker</Text>
            {/* image will go here */}
            <Text style={styles.title2}>Break the Ice on Campus</Text>
            
            <Text style={styles.thirdText} >Make your introduction not your elevator pitch. 
                Find study buddies, friends, and meet people nearby. 
                Discovering your community starts here! </Text>
            
            <PrimaryButton
              title="Get Started"
              style={styles.getStartedButton}
              onPress={() =>
                router.push(
                  (shouldResumeSignup ? resumeRoute : "/(auth)/signup") as Href,
                )
              }
            />

            <SecondaryButton
              title="Login"
              style={styles.loginButton}
              onPress={() => router.push("/(auth)/login")}
            />
            <Text style={styles.secondaryText}>University email is required</Text>
        </ScrollView>
      </View>
    );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#D9E0F0",
    position: "relative",
  },
  topBleed: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#D9E0F0",
  },
  scroll: { flex: 1, backgroundColor: "#D9E0F0" },
  content: { 
    flexGrow: 1,
    padding: 24,
    paddingTop: 0,
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
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 14,
    marginBottom: 36,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    width: 400,
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    textAlign: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  getStartedButton: {
    marginBottom: 12,
  },
  primaryText: { 
    color: "white", 
    fontWeight: "600", 
    textAlign: "center",
    marginBottom: 30, 
  },
  title2: {
    color: "black", 
    fontSize: 20, 
    fontWeight: "bold", 
    textAlign: "center",
    textShadowRadius: 2, 
    textShadowColor: "yellow",
    marginBottom: 30,
  },
  secondaryButton: { 
    padding: 16, 
    borderRadius: 8, 
    textAlign: "center",
    marginBottom: 30, 
  },
  loginButton: {
    marginBottom: 30,
  },
  secondaryText: { 
    color: "#666", 
    textAlign: "center",
    marginBottom: 30, 
  },
  thirdText: {
    color: "black", 
    fontSize: 16, 
    textAlign: "center",
    marginBottom: 30,
    width: 300
  },
  welcomeLogo: {
    width: 300,
    height: 300,
  },
});



  // // button text for index.tsx in the (tabs) folder
  // const toWelcome = () => {
  //   router.navigate('../welcome')
  // };
  
  // // button for return in the index.tsx in the (tabs) folder
  //     <TouchableOpacity style={styles.secondaryButton} onPress={toWelcome}>
  //                     <Text style={styles.secondaryButtonText}>To the Welcome Page</Text>
  //     </TouchableOpacity>


  // // for the _layout.tsx in the (tabs) folder
  //       <Stack.Screen name="welcome" options={{ title: "Welcome Page"}}/>
