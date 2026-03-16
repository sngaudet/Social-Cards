import React from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

type AvatarOptionTileProps = {
  imageSource?: ImageSourcePropType;
  selected?: boolean;
  onPress?: () => void;
};

export default function AvatarOptionTile({
  imageSource,
  selected = false,
  onPress,
}: AvatarOptionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!imageSource}
      style={({ pressed }) => [
        styles.tile,
        !imageSource && styles.tileBlank,
        selected ? styles.tileSelected : styles.tileUnselected,
        pressed && !!imageSource && styles.pressed,
      ]}
    >
      <View style={styles.inner}>
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.blankFill} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.25,
  },

  tileUnselected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E0EA",
  },

  tileSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#7DD3FC",
    borderWidth: 3,
  },

  tileBlank: {
    backgroundColor: "#F8FAFC",
  },

  inner: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  pressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },

  blankFill: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EEF2F6",
  },
});
