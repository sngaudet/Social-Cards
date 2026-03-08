import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";

type SubButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function SubButton({
  title,
  onPress,
  disabled = false,
  style,
  textStyle,
}: SubButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, disabled && styles.textDisabled, textStyle]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "transparent",
  },

  pressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.45,
  },

  text: {
    fontFamily: "LexendSemiBold",
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0.2,
    color: "#64748B",
    textAlign: "center",
  },

  textDisabled: {
    color: "#94A3B8",
  },
});
