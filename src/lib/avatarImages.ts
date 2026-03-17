import { ImageSourcePropType } from "react-native";

export type AvatarImageOption = {
  id: string;
  imageSource: ImageSourcePropType;
};

function normalizeAvatarKey(value?: string | null) {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

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
  AVATAR_IMAGE_OPTIONS.map((option) => [
    normalizeAvatarKey(option.id),
    option.imageSource,
  ]),
);

export function getAvatarImageSource(avatarId?: string | null) {
  if (!avatarId) return null;

  const normalizedId = normalizeAvatarKey(avatarId);
  const directMatch = AVATAR_IMAGE_SOURCES.get(normalizedId);
  if (directMatch) return directMatch;

  const aliases = new Map<string, ImageSourcePropType>([
    ["rainbow-unicorn", AVATAR_IMAGE_SOURCES.get("rainbow-unicorn-avatar")!],
    ["rainbow-unicorn-avatar.png", AVATAR_IMAGE_SOURCES.get("rainbow-unicorn-avatar")!],
    ["rainbow-unicorn-avatar.jpg", AVATAR_IMAGE_SOURCES.get("rainbow-unicorn-avatar")!],
    ["cat-man", AVATAR_IMAGE_SOURCES.get("catman")!],
    ["catman.jpg", AVATAR_IMAGE_SOURCES.get("catman")!],
  ]);

  return aliases.get(normalizedId) ?? null;
}
