import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";

type HobbyButtonProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  renderIcon: (color: string) => React.ReactNode;
};

export default function HobbyButton({
  label,
  selected = false,
  onPress,
  style,
  renderIcon,
}: HobbyButtonProps) {
  const iconColor = selected ? "#FFFFFF" : "#475569";
  const textColor = selected ? "#FFFFFF" : "#475569";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        selected ? styles.buttonSelected : styles.buttonUnselected,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      {selected ? (
        <View style={styles.innerSelectedRing}>
          <View style={styles.content}>
            <View style={styles.iconWrap}>{renderIcon(iconColor)}</View>
            <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.iconWrap}>{renderIcon(iconColor)}</View>
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },

  buttonUnselected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.25,
    borderColor: "#D9E2EC",
  },

  buttonSelected: {
    backgroundColor: "#7DD3FC",
    borderWidth: 1,
    borderColor: "#7DD3FC",
    paddingHorizontal: 2,
    paddingVertical: 0,
  },

  innerSelectedRing: {
    minHeight: 51,
    width: "100%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14.3,
  },

  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  iconWrap: {
    marginRight: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  buttonPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
});