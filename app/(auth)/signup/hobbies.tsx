import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Bot,
  Brush,
  Camera,
  Code2,
  Dumbbell,
  Footprints,
  Gamepad2,
  Music2,
  Palette,
  PersonStanding,
  Rocket,
  Volleyball,
} from "lucide-react-native";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
      { key: "music", label: "Music", icon: Music2 },
      { key: "photography", label: "Photography", icon: Camera },
      { key: "design", label: "Design", icon: Brush },
    ],
  },
  {
    title: "TECH & GAMING",
    items: [
      { key: "gaming", label: "Gaming", icon: Gamepad2 },
      { key: "coding", label: "Coding", icon: Code2 },
      { key: "ai_ml", label: "AI / ML", icon: Bot },
      { key: "startups", label: "Startups", icon: Rocket },
    ],
  },
  {
    title: "ACTIVE LIFE",
    items: [
      { key: "hiking", label: "Hiking", icon: PersonStanding },
      { key: "gym", label: "Gym", icon: Dumbbell },
      { key: "running", label: "Running", icon: Footprints },
      { key: "volleyball", label: "Volleyball", icon: Volleyball },
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
    router.replace("/(auth)/signup/pictures");
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
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },
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
});
