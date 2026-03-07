import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type PrimaryButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  showArrow?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  showArrow = false,
  style,
  textStyle,
}: PrimaryButtonProps) {
  return (
    <View style={[styles.shadowWrap, disabled && styles.disabledWrap, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.pressable,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <LinearGradient
          colors={
            disabled
              ? ["#95D6F0", "#90D1EE", "#8BCBEC"]
              : ["#8FDDFC", "#89DBFB", "#84D3FA"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.button}
        >
          <View style={styles.content}>
            <Text style={[styles.text, disabled && styles.disabledText, textStyle]}>
              {title}
            </Text>

            {showArrow && (
              <Text style={[styles.arrow, disabled && styles.disabledText]}>→</Text>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    width: 324,
    height: 60,
    borderRadius: 20,
    backgroundColor: "transparent",
    shadowColor: "#87BCFE",
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 2, height: 8 },
    elevation: 10,
  },

  disabledWrap: {
    opacity: 0.65,
  },

  pressable: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },

  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.98,
  },

  button: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 49,
    paddingVertical: 17,
    backgroundColor: "#89DBFB",
  },

  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  text: {
    fontFamily: "LexendSemiBold",
    fontSize: 18,
    lineHeight: 28,
    color: "#FFFFFF",
    textAlign: "center",
  },

  arrow: {
    fontFamily: "LexendSemiBold",
    fontSize: 18,
    lineHeight: 28,
    color: "#FFFFFF",
    textAlign: "center",
  },

  disabledText: {
    color: "rgba(255,255,255,0.82)",
  },
});