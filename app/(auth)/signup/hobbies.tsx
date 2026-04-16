import { Href, useRouter } from "expo-router";
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
import {
  getInitialSelectedHobbyKeys,
  hobbyKeysToLabels,
  hobbySections,
} from "../../../src/lib/hobbyCatalog";
import { useSignup } from "../../../src/signup/context";

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
    getInitialSelectedHobbyKeys(draft.hobbies),
  );

  const toggleHobby = (key: string) => {
    const next = selectedHobbies.includes(key)
      ? selectedHobbies.filter((item) => item !== key)
      : [...selectedHobbies, key];

    setSelectedHobbies(next);
    updateDraft({ hobbies: hobbyKeysToLabels(next) });
  };

  const onNext = () => {
    const hobbies = hobbyKeysToLabels(selectedHobbies);

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
