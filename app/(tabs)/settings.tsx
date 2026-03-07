import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useState } from "react";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";

import { auth } from "../../firebaseConfig";



export default function settingsPage(){
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false)
    
    // const onLogin = () => {
    //     router.replace("/(auth)/signup/hobbies");
    // }
    const handleLogout = async () => {
        await signOut(auth);
    };
    
    const toggleQ1 = () => {
        setIsVisible(prev => !prev);
    };
    
    return (
        <ScrollView contentContainerStyle = {styles.content} >
            {/* this is how to reference an image */}
            {/* <Image
              source={require('../assets/images/Ice Cube Photopea 1.png')} style={styles.welcomeLogo}
            /> */}

            <Text style={styles.title}>Settings Page</Text>
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
    primaryButton2: {
    backgroundColor: "#3b82f6",
    width: 400,
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    textAlign: "center",
    justifyContent: "center",
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
    title3: {
    color: "black", 
    fontSize: 20, 
    fontWeight: "bold", 
    textAlign: "center",
    marginBottom: 30,
  },
  secondaryButton: { 
    padding: 16, 
    borderRadius: 8,
    backgroundColor: "#89DBFB", 
    textAlign: "center",
    marginBottom: 30,
    marginTop: 30, 
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
    foruthText: {
    color: "black", 
    fontSize: 16, 
    textAlign: "center",
    marginBottom: 30,
    width: 600
  },
  welcomeLogo: {
    width: 300,
    height: 300,
  },
    cardFormat: {
    width: 500,
    height: 500,
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
    thirdButtonText: {
    color: "black",
    fontWeight: "700",
    fontSize: 17,
  },
});
