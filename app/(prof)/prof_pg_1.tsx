import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';


export default function Profile_One(){
    
    // this references the page and how we will get to other pages
    const router = useRouter()
    
    const[first_name, setFirstName] = useState("");
    const[last_name, setLastName] = useState("");
    const[gender, setGender] = useState("");
    const[age, setAge] = useState("");
    const[grad_year, setGrad_Year] = useState("");
    const[major, setMajor] = useState("");

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Profile Setup Page 1</Text>
            
            {/* this is the first name field */}
            <TextInput 
                placeholder="First Name"
                placeholderTextColor="#4f4f4f"
                value= {first_name}
                onChangeText={setFirstName}
            />


            {/* this is the last name field */}
            <TextInput 
                placeholder="Last Name"
                placeholderTextColor="#4f4f4f"
                value= {last_name}
                onChangeText={setLastName}
            />

            {/* this is the gender field */}
            <TextInput 
                placeholder="Gender"
                placeholderTextColor="#4f4f4f"
                value= {gender}
                onChangeText={setGender}
            />

            {/* this is the name field */}
            <TextInput 
                placeholder="Age"
                placeholderTextColor="#4f4f4f"
                value= {age}
                onChangeText={setAge}
            />

            {/* this is the name field */}
            <TextInput 
                placeholder="Grad Year"
                placeholderTextColor="#4f4f4f"
                value= {grad_year}
                onChangeText={setGrad_Year}
            />

            {/* this is the name field */}
            <TextInput 
                placeholder="Major Name"
                placeholderTextColor="#4f4f4f"
                value= {major}
                onChangeText={setMajor}
            />
            
            <Text>{'\n'}</Text>
            <Button
                title = "Next Page"
                onPress={() => router.replace("/(prof)/prof_pg_2")}
            />

            
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
});