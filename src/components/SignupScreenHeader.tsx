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

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginTop: 32,
    marginBottom: 24,
  },

  title: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -1.2,
  },

  subtitle: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 30,
    fontWeight: "400",
    color: "#64748B",
    maxWidth: 460,
  },
});