import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";

type SecondaryButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function SecondaryButton({
  title,
  onPress,
  disabled = false,
  style,
  textStyle,
}: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
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
  button: {
    width: 324,
    height: 60,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
  },

  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.55,
  },

  text: {
    fontFamily: "LexendSemiBold",
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0.4,
    color: "#2B6CEE",
    textAlign: "center",
  },

  textDisabled: {
    color: "#8AA8F3",
  },
});
