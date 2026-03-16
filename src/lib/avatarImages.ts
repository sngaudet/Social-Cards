import { ImageSourcePropType } from "react-native";

export type AvatarImageOption = {
  id: string;
  imageSource: ImageSourcePropType;
};

export const AVATAR_IMAGE_OPTIONS: AvatarImageOption[] = [
  {
    id: "rainbow-unicorn-avatar",
    imageSource: require("../images/Rainbow Unicorn Avatar.png"),
  },
  {
    id: "catman",
    imageSource: require("../images/catman.jpg"),
  },
];

const AVATAR_IMAGE_SOURCES = new Map(
  AVATAR_IMAGE_OPTIONS.map((option) => [option.id, option.imageSource]),
);

export function getAvatarImageSource(avatarId?: string | null) {
  if (!avatarId) return null;
  return AVATAR_IMAGE_SOURCES.get(avatarId) ?? null;
}
