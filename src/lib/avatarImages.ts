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
  {
    id: "icecubedefaultpfp",
    imageSource: require("../images/icecubedefaultpfp.png"),
  },
  {
    id: "penguin1defaultpfp",
    imageSource: require("../images/penguin1defaultpfp.png"),
  },
  {
    id: "penguin2defaultpfp",
    imageSource: require("../images/penguin2defaultpfp.png"),
  },
  {
    id: "defaultpfp1",
    imageSource: require("../images/defaultpfp1.jpg"),
  },
  {
    id: "defaultpfp2",
    imageSource: require("../images/defaultpfp2.png"),
  },
  {
    id: "defaultpfp3",
    imageSource: require("../images/defaultpfp3.jpg"),
  },
  {
    id: "defaultpfp4",
    imageSource: require("../images/defaultpfp4.jpg"),
  },
  {
    id: "defaultpfp5",
    imageSource: require("../images/defaultpfp5.jpg"),
  },
  {
    id: "defaultpfp6",
    imageSource: require("../images/defaultpfp6.jpg"),
  },
  {
    id: "defaultpfp7",
    imageSource: require("../images/defaultpfp7.jpg"),
  },
  {
    id: "defaultpfp8",
    imageSource: require("../images/defaultpfp8.jpg"),
    
  },
  {
    id: "defaultpfp9",
    imageSource: require("../images/defaultpfp9.webp"),
  },
  {
    id: "defaultpfp10",
    imageSource: require("../images/defaultpfp10.png"),
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
    ["icecubedefaultpfp", AVATAR_IMAGE_SOURCES.get("icecubedefaultpfp")!],
    ["icecubedefaultpfp.png", AVATAR_IMAGE_SOURCES.get("icecubedefaultpfp")!],
    ["penguin1defaultpfp", AVATAR_IMAGE_SOURCES.get("penguin1defaultpfp")!],
    ["penguin1defaultpfp.png", AVATAR_IMAGE_SOURCES.get("penguin1defaultpfp")!],
    ["penguin2defaultpfp", AVATAR_IMAGE_SOURCES.get("penguin2defaultpfp")!],
    ["penguin2defaultpfp.png", AVATAR_IMAGE_SOURCES.get("penguin2defaultpfp")!],
    ["defaultpfp1", AVATAR_IMAGE_SOURCES.get("defaultpfp1")!],
  ["defaultpfp1.jpg", AVATAR_IMAGE_SOURCES.get("defaultpfp1")!],
  ["defaultpfp2", AVATAR_IMAGE_SOURCES.get("defaultpfp2")!],
  ["defaultpfp2.png", AVATAR_IMAGE_SOURCES.get("defaultpfp2")!],
  ["defaultpfp3", AVATAR_IMAGE_SOURCES.get("defaultpfp3")!],
  ["defaultpfp3.jpg", AVATAR_IMAGE_SOURCES.get("defaultpfp3")!],
  ["defaultpfp4", AVATAR_IMAGE_SOURCES.get("defaultpfp4")!],
  ["defaultpfp4.jpg", AVATAR_IMAGE_SOURCES.get("defaultpfp4")!],
  ["defaultpfp5", AVATAR_IMAGE_SOURCES.get("defaultpfp5")!],
  ["defaultpfp5.jpg", AVATAR_IMAGE_SOURCES.get("defaultpfp5")!],
  ["defaultpfp6", AVATAR_IMAGE_SOURCES.get("defaultpfp6")!],
  ["defaultpfp6.jpg", AVATAR_IMAGE_SOURCES.get("defaultpfp6")!],
  ["defaultpfp7", AVATAR_IMAGE_SOURCES.get("defaultpfp7")!],
  ["defaultpfp7.jpg", AVATAR_IMAGE_SOURCES.get("defaultpfp7")!],
  ["defaultpfp8", AVATAR_IMAGE_SOURCES.get("defaultpfp8")!],
  ["defaultpfp8.jpg", AVATAR_IMAGE_SOURCES.get("defaultpfp8")!],
  ["defaultpfp9", AVATAR_IMAGE_SOURCES.get("defaultpfp9")!],
  ["defaultpfp9.webp", AVATAR_IMAGE_SOURCES.get("defaultpfp9")!],
  ["defaultpfp10", AVATAR_IMAGE_SOURCES.get("defaultpfp10")!],
  ["defaultpfp10.png", AVATAR_IMAGE_SOURCES.get("defaultpfp10")!],
  ]);

  return aliases.get(normalizedId) ?? null;
}
