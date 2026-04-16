import { basketball, football, soccerBall } from "@lucide/lab";
import { createElement, type ComponentType } from "react";
import {
  Bike,
  BookOpen,
  Bot,
  Box,
  Brush,
  Camera,
  ChefHat,
  Code2,
  Cpu,
  Dices,
  Dumbbell,
  Film,
  Flower,
  Footprints,
  Gamepad2,
  Guitar,
  Icon,
  Layers,
  Mic,
  Mountain,
  Music2,
  Palette,
  Pencil,
  PenLine,
  PersonStanding,
  Piano,
  Plane,
  Rocket,
  Shield,
  Utensils,
  Video,
  Volleyball,
} from "lucide-react-native";
import { normalizeHobbies, type HobbiesValue } from "./hobbies";

type HobbyIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export type HobbyDefinition = {
  key: string;
  label: string;
  icon: ComponentType<HobbyIconProps>;
};

export type HobbySection = {
  title: string;
  items: HobbyDefinition[];
};

export const hobbySections: HobbySection[] = [
  {
    title: "CREATIVE",
    items: [
      { key: "art", label: "Art", icon: Palette },
      { key: "drawing", label: "Drawing", icon: Pencil },
      { key: "music", label: "Music", icon: Music2 },
      { key: "guitar", label: "Guitar", icon: Guitar },
      { key: "piano", label: "Piano", icon: Piano },
      { key: "photography", label: "Photography", icon: Camera },
      { key: "filmmaking", label: "Filmmaking", icon: Video },
      { key: "design", label: "Design", icon: Brush },
      { key: "writing", label: "Writing", icon: PenLine },
    ],
  },
  {
    title: "TECH",
    items: [
      { key: "gaming", label: "Gaming", icon: Gamepad2 },
      { key: "coding", label: "Coding", icon: Code2 },
      {
        key: "computer_architecture",
        label: "Computer Architecture",
        icon: Cpu,
      },
      { key: "ai_ml", label: "AI / ML", icon: Bot },
      { key: "startups", label: "Startups", icon: Rocket },
      { key: "cybersecurity", label: "Cybersecurity", icon: Shield },
      { key: "robotics", label: "Robotics", icon: Cpu },
      { key: "3d_printing", label: "3D Printing", icon: Box },
    ],
  },
  {
    title: "GAMING",
    items: [
      { key: "video_games", label: "Video Games", icon: Gamepad2 },
      { key: "board_games", label: "Board Games", icon: Dices },
      { key: "trading_cards", label: "Trading Card Games", icon: Layers },
    ],
  },
  {
    title: "ACTIVE LIFE",
    items: [
      { key: "hiking", label: "Hiking", icon: PersonStanding },
      { key: "running", label: "Running", icon: Footprints },
      { key: "gym", label: "Gym", icon: Dumbbell },
      { key: "volleyball", label: "Volleyball", icon: Volleyball },
      {
        key: "basketball",
        label: "Basketball",
        icon: (props) => createElement(Icon, { iconNode: basketball, ...props }),
      },
      {
        key: "football",
        label: "Football",
        icon: (props) => createElement(Icon, { iconNode: football, ...props }),
      },
      {
        key: "soccer",
        label: "Soccer",
        icon: (props) => createElement(Icon, { iconNode: soccerBall, ...props }),
      },
      { key: "yoga", label: "Yoga", icon: Flower },
      { key: "cycling", label: "Cycling", icon: Bike },
      { key: "climbing", label: "Climbing", icon: Mountain },
    ],
  },
  {
    title: "LIFESTYLE",
    items: [
      { key: "travel", label: "Travel", icon: Plane },
      { key: "reading", label: "Reading", icon: BookOpen },
      { key: "movies", label: "Movies", icon: Film },
      { key: "podcasts", label: "Podcasts", icon: Mic },
      { key: "restaurants", label: "Restaurants", icon: ChefHat },
      { key: "foodie", label: "Foodie", icon: Utensils },
    ],
  },
];

export const hobbyItems = hobbySections.flatMap((section) => section.items);

export function getInitialSelectedHobbyKeys(value: HobbiesValue): string[] {
  const normalized = normalizeHobbies(value);

  return Array.from(
    new Set(
      hobbyItems
        .filter((item) =>
          normalized.some((entry) => {
            const normalizedEntry = entry.trim().toLowerCase();
            return (
              normalizedEntry === item.key
              || normalizedEntry === item.label.trim().toLowerCase()
            );
          }),
        )
        .map((item) => item.key),
    ),
  );
}

export function hobbyKeysToLabels(keys: string[]): string[] {
  return hobbyItems
    .filter((item) => keys.includes(item.key))
    .map((item) => item.label);
}
