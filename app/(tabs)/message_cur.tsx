import { useRouter } from "expo-router";
// import { View } from "lucide-react-native";
import React, { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";



export default function Onboarding(){
    const router = useRouter();
    // const onLogin = () => {
    //     router.replace("/(auth)/signup/hobbies");
    // }
    const [curIsPressed, setCurIsPressed] = useState(true)
    const [oldIsPressed, setOldIsPressed] = useState(false)

    const whenCurPressed = () => hitNewButton()
    const whenOldPressed = () => hitOldButton()
    
    // useEffect(() =>{
    //     if(curIsPressed == true){
    //         setOldIsPressed(false)
    //     }
    //     else if(oldIsPressed == true){
    //         setCurIsPressed(false)
    //     }
    // })


    const hitNewButton= () => {
        setCurIsPressed(true)
        setOldIsPressed(false)
    }

    const hitOldButton= () => {
        setOldIsPressed(true)
        setCurIsPressed(false)
    }
    return (
        <ScrollView contentContainerStyle = {styles.content} >
            {/* this is how to reference an image */}

            <Text style={styles.title}>Messages</Text>
            {/* <Text style={styles.title}>Nearby intro Cards, {"\n"} not a map</Text> */}

            {/* <Text style={styles.thirdText}>See who is nearby. Your location is {"\n"}
              private, but is needed to make {"\n"}
              connections with other users.</Text> */}
            
                <View style={styles.sideButtons}>
                    <TouchableOpacity
                        style={[styles.primaryButton, curIsPressed==true ? styles.clickedButton : styles.notClickedButton]}
                        onPress={whenCurPressed}>
                            <Text>Current Connections</Text>        
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryButton, oldIsPressed==true ? styles.clickedButton : styles.notClickedButton]}
                        onPress={whenOldPressed}>
                            <Text>Old Connections</Text>        
                    </TouchableOpacity>
                    {/* <PrimaryButton
                    title="Current Connections"
                    style={styles.primaryButton}
                    onPress={() => router.replace("/(auth)/signup/onboardingPermission")}
                    />
                
                    <PrimaryButton
                    title="Past Connections"
                    style={styles.primaryButton}
                    onPress={() => router.replace("/(auth)/signup/onboardingPermission")}
                    /> */}
                </View>
            

        </ScrollView>
    );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#D9E0F0',},
  content: { 
    padding: 24,
    paddingBottom: 48, 
    justifyContent: "center",
    alignItems: "center",
    // backgroundColor: '#D9E0F0', 
  },
  sideButtons:{
    flex:1,
    flexDirection: "row",
    // justifyContent: "space-between"
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
    marginBottom: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    borderRadius: 8,
    borderColor: "black",
    borderBottomWidth: 3,
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

  imageWrap: {
    width: 400,
    height: 400,
    borderRadius: 25,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    backgroundColor: "#F3F7FF", // solid, not gradient
    shadowColor: "#8AB4FF",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  welcomeLogo: {
    width: 300,
    height: 300,
  },

  clickedButton:{
    backgroundColor:"#407fd7"
  },
  notClickedButton:{
    backgroundColor:"#b0c1d8"
  },
});
