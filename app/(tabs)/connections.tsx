import { useRouter } from "expo-router";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text
} from "react-native";


export default function connectionsPage(){
    const router = useRouter();
    // const onLogin = () => {
    //     router.replace("/(auth)/signup/prof_pg_3");
    // }
    
    return (
        <ScrollView contentContainerStyle = {styles.content} >
            {/* this is how to reference an image */}
            {/* <Image
              source={require('../assets/images/Ice Cube Photopea 1.png')} style={styles.welcomeLogo}
            /> */}

            <Text style={styles.title}>Previous Connections</Text>
            
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

