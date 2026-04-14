import { basketball, football, soccerBall } from "@lucide/lab";
import { Href, useRouter } from "expo-router";
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

import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import HobbyButton from "../../../src/components/HobbyButton";
import PrimaryButton from "../../../src/components/PrimaryButton";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import { useSignup } from "../../../src/signup/context";

// All hobbies and sections
export const hobbySections = [
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
        icon: (props: any) => <Icon iconNode={basketball} {...props} />,
      },
      {
        key: "football",
        label: "Football",
        icon: (props: any) => <Icon iconNode={football} {...props} />,
      },
      {
        key: "soccer",
        label: "Soccer",
        icon: (props: any) => <Icon iconNode={soccerBall} {...props} />,
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

const hobbyItems = hobbySections.flatMap((section) => section.items);

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function SignupHobbiesStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [selectedHobbies, setSelectedHobbies] = useState<string[]>(
    Array.from(
      new Set(
        hobbyItems
          .filter((item) =>
            draft.hobbies.some((value) => {
              const normalizedValue = value.trim().toLowerCase();
              return (
                normalizedValue === item.key ||
                normalizedValue === item.label.trim().toLowerCase()
              );
            }),
          )
          .map((item) => item.key),
      ),
    ),
  );

  const toHobbyLabels = (keys: string[]) =>
    hobbyItems
      .filter((item) => keys.includes(item.key))
      .map((item) => item.label);

  const toggleHobby = (key: string) => {
    const next = selectedHobbies.includes(key)
      ? selectedHobbies.filter((item) => item !== key)
      : [...selectedHobbies, key];

    setSelectedHobbies(next);
    updateDraft({ hobbies: toHobbyLabels(next) });
  };

  const onNext = () => {
    const hobbies = toHobbyLabels(selectedHobbies);

    if (hobbies.length === 0) {
      showAlert("Missing fields", "Please add at least one hobby.");
      return;
    }

    updateDraft({ hobbies });
    router.push("/(auth)/signup/personalProfile" as Href);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Progress Bar */}
      <ProgressHeader currentStep={3} />

      {/* Header */}
      <SignupScreenHeader
        title="What are you into?"
        subtitle="Pick your interests to help us match you with the right crowd."
      />

      <Text style={styles.requiredText}>* You must choose at least 1 hobby</Text>
      <Text> </Text>
      {/* Buttons */}
      {hobbySections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>

          <View style={styles.buttonsWrap}>
            {section.items.map((hobby) => {
              const Icon = hobby.icon;
              const isSelected = selectedHobbies.includes(hobby.key);

              return (
                <HobbyButton
                  key={hobby.key}
                  label={hobby.label}
                  selected={isSelected}
                  onPress={() => toggleHobby(hobby.key)}
                  renderIcon={(color) => (
                    <Icon size={20} color={color} strokeWidth={2.1} />
                  )}
                />
              );
            })}
          </View>
        </View>
      ))}

      {/* Next Button */}
      <PrimaryButton
        title="Next Step"
        showArrow
        style={styles.primaryButton}
        onPress={onNext}
      />
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryText}>Back</Text>
            </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#D9E0F0" },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    backgroundColor: "#D9E0F0",
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: "#64748B",
    marginBottom: 12,
  },
  buttonsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  primaryButton: {
    alignSelf: "center",
    marginBottom: 12,
  },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryText: { color: "#444", fontSize: 14 },
    requiredText: {
    color: "#aa1515",
    fontSize: 20,},

});
