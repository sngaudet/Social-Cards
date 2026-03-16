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
        selected ? styles.tileSelected : styles.tileUnselected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.innerBox}>
        <Image source={imageSource} style={styles.image} resizeMode="contain" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 122,
    height: 122,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F6F7F9",
  },

  tileUnselected: {
    borderWidth: 1,
    borderColor: "#D9DEE5",
  },

  tileSelected: {
    borderWidth: 2,
    borderColor: "#78C8F8",
  },

  innerBox: {
    width: 86,
    height: 86,
    borderRadius: 20,
    backgroundColor: "#E9EDF2",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  pressed: {
    opacity: 0.96,
  },
});
