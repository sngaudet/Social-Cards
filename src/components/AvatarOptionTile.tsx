import React from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type AvatarOptionTileProps = {
  selected?: boolean;
  onPress?: () => void;
  imageSource: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
};

export default function AvatarOptionTile({
  selected = false,
  onPress,
  imageSource,
  style,
}: AvatarOptionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.selectedGlow,
        selected ? styles.tileSelected : styles.tileUnselected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View
        style={[
          styles.innerSelectedRing,
          !selected && styles.innerSelectedRingInactive,
        ]}
      >
        <View style={styles.innerBox}>
          <View style={styles.imageSurface}>
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="contain"
              fadeDuration={0}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 110,
    height: 110,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F6F7F9",
  },

  selectedGlow: {
    shadowColor: "#2B6CEE",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },

  tileUnselected: {
    borderWidth: 0,
    padding: 0,
  },

  tileSelected: {
    backgroundColor: "#e8eaed",
    borderWidth: 2,
    borderColor: "#89DBFB",
    padding: 2,
  },

  innerSelectedRing: {
    width: "100%",
    height: "100%",
    borderRadius: 21,
    borderWidth: 0,
    borderColor: "#F6F6F8",
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
    backgroundColor: "#F6F6F8",
  },

  innerSelectedRingInactive: {
    borderWidth: 0,
    backgroundColor: "transparent",
  },

  innerBox: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    padding: 7,
  },

  imageSurface: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    backgroundColor: "#EEF2F6",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },

  pressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
});
