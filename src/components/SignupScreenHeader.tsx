import React from "react";
import { View, Text, StyleSheet } from "react-native";

type SignupScreenHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function SignupScreenHeader({
  title,
  subtitle,
}: SignupScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {subtitle ? (
        <Text style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 46,
    marginBottom: 36,
  },

  title: {
    fontSize: 32,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -1.3,
    color: "#0B1533",
    maxWidth: 300,
  },

  subtitle: {
    marginTop: 18,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "400",
    color: "#64748B",
    maxWidth: 330,
  },
});