import React, { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

type SignupFormFieldProps = {
  // label: string;
  label: ReactNode;
  rightLabel?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function SignupFormField({
  label,
  rightLabel,
  children,
  style,
  contentStyle,
}: SignupFormFieldProps) {
  return (
    <View style={style}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {rightLabel ? <Text style={styles.rightLabel}>{rightLabel}</Text> : null}
      </View>
      <View style={[styles.fieldShell, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontWeight: "600",
    color: "#333",
  },
  rightLabel: {
    color: "#64748B",
    marginBottom: 8,
  },
  fieldShell: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#CFE2FF",
    paddingHorizontal: 18,
    minHeight: 64,
    marginBottom: 16,
  },
});
