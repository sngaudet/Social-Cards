import React from "react";
import { View, Text, StyleSheet } from "react-native";

type ProgressHeaderProps = {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  totalSteps?: 6;
  title?: string;
};

export default function ProgressHeader({
  currentStep,
  totalSteps = 6,
  title = "Account Setup",
}: ProgressHeaderProps) {
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.stepText}>
          Step {currentStep} of {totalSteps}
        </Text>

        <Text style={styles.titleText}>{title}</Text>
      </View>

      <View style={[styles.track]}>
        <View style={[styles.fill, { width: `${progressPercent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  stepText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#89DBFB",
  },

  titleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },

  track: {
    width: "100%",
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    overflow: "hidden",
  },

  fill: {
    height: "100%",
    backgroundColor: "#89DBFB",
    borderRadius: 999,
  },

});