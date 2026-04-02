import { useRouter } from "expo-router";
import { Check, Megaphone, Plus, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import PrimaryButton from "../../../src/components/PrimaryButton";
import ProgressHeader from "../../../src/components/ProgressHeader";
import SignupScreenHeader from "../../../src/components/SignupScreenHeader";
import { useSignup } from "../../../src/signup/context";
import type { SignupDraft } from "../../../src/signup/types";

const MAX_ICEBREAKERS = 3;

const DEFAULT_ICEBREAKER_QUESTIONS = [
  "What's your ideal weekend?",
  "What food can you never say no to?",
  "Share one fun fact about yourself",
];

const AVAILABLE_ICEBREAKER_QUESTIONS = [
  ...DEFAULT_ICEBREAKER_QUESTIONS,
  "What's your go-to coffee or energy drink?",
  "Early bird or night owl?",
  "What's one class you're excited about this semester?",
  "Sweet snacks or salty snacks?",
  "What music do you listen to while studying?",
  "iPhone or Android?",
  "What's your favorite campus spot to hang out?",
  "What's the weirdest food combo you like?",
  "If you could only eat one meal on campus forever, what would it be?",
  "What's a TV show you can rewatch endlessly?",
  "What's your most unpopular opinion?",
  "If your life had a theme song, what would it be?",
  "Would you rather have no homework ever again or free tuition?",
  "What's the last thing you Googled?",
  "What fictional world would you want to live in?",
  "What's the best place to study on campus?",
  "What class has challenged you the most so far?",
  "Commuter or on-campus?",
  "What's one campus event everyone should attend at least once?",
  "What's your favorite thing about this school?",
  "What's a campus secret or life hack you've learned?",
  "Dining hall favorite or least favorite?",
  "What building do you get lost in every time?",
];

type SelectedIceBreaker = {
  question: string;
  answer: string;
};

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function getInitialIceBreakers(draft: SignupDraft) {
  const slots = [
    {
      question: draft.iceBreakerOneQuestion?.trim() ?? "",
      answer: draft.iceBreakerOne ?? "",
      fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[0],
    },
    {
      question: draft.iceBreakerTwoQuestion?.trim() ?? "",
      answer: draft.iceBreakerTwo ?? "",
      fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[1],
    },
    {
      question: draft.iceBreakerThreeQuestion?.trim() ?? "",
      answer: draft.iceBreakerThree ?? "",
      fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[2],
    },
  ];

  return slots.reduce<SelectedIceBreaker[]>((selected, slot) => {
    const question = slot.question || (slot.answer.trim() ? slot.fallbackQuestion : "");
    if (!question) return selected;
    if (selected.some((item) => item.question === question)) return selected;

    selected.push({
      question,
      answer: slot.answer,
    });
    return selected;
  }, []);
}

export default function SignupIceBreakersStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [selectedIceBreakers, setSelectedIceBreakers] = useState<
    SelectedIceBreaker[]
  >(() => getInitialIceBreakers(draft));
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const icebreakerOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...AVAILABLE_ICEBREAKER_QUESTIONS,
          ...selectedIceBreakers.map((item) => item.question),
        ]),
      ),
    [selectedIceBreakers],
  );

  const selectedCount = selectedIceBreakers.length;
  const filledCount = selectedIceBreakers.filter((item) => item.answer.trim()).length;
  const selectionProgressWidth =
    `${(selectedCount / MAX_ICEBREAKERS) * 100}%` as `${number}%`;

  const toggleIceBreaker = (question: string) => {
    const isSelected = selectedIceBreakers.some((item) => item.question === question);

    if (isSelected) {
      setSelectedIceBreakers((current) =>
        current.filter((item) => item.question !== question),
      );
      return;
    }

    if (selectedIceBreakers.length >= MAX_ICEBREAKERS) {
      showAlert(
        "Selection limit reached",
        `Choose up to ${MAX_ICEBREAKERS} icebreakers. Remove one before picking another.`,
      );
      return;
    }

    setSelectedIceBreakers((current) => [...current, { question, answer: "" }]);
  };

  const updateAnswer = (question: string, answer: string) => {
    setSelectedIceBreakers((current) =>
      current.map((item) =>
        item.question === question ? { ...item, answer } : item,
      ),
    );
  };

  const onNext = () => {
    if (filledCount < MAX_ICEBREAKERS) {
      showAlert(
        "Choose 3 icebreakers",
        "Select and answer 3 icebreakers before continuing.",
      );
      return;
    }

    const [first, second, third] = selectedIceBreakers;

    updateDraft({
      iceBreakerOneQuestion: first.question.trim(),
      iceBreakerOne: first.answer.trim(),
      iceBreakerTwoQuestion: second.question.trim(),
      iceBreakerTwo: second.answer.trim(),
      iceBreakerThreeQuestion: third.question.trim(),
      iceBreakerThree: third.answer.trim(),
    });

    router.push("/(auth)/signup/hobbies");
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ProgressHeader currentStep={2} />

      <SignupScreenHeader
        title="Pick Your Icebreakers"
        subtitle="Tap the box below to choose and answer 3 icebreakers."
      />

      <Pressable
        onPress={() => setIsPickerOpen(true)}
        style={({ pressed }) => [
          styles.summaryCard,
          pressed && { opacity: 0.96 },
        ]}
      >
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryTitle}>Your Icebreakers</Text>
            <Text style={styles.summarySubtitle}>3 required</Text>
          </View>
          <Text style={styles.summaryCount}>
            {selectedCount}/{MAX_ICEBREAKERS}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: selectionProgressWidth }]}
          />
        </View>

        <Text style={styles.progressText}>
          {selectedCount} of {MAX_ICEBREAKERS} selected
        </Text>

        <View style={styles.slotList}>
          {Array.from({ length: MAX_ICEBREAKERS }, (_, index) => {
            const iceBreaker = selectedIceBreakers[index];
            const hasAnswer = Boolean(iceBreaker?.answer.trim());

            return (
              <View key={index} style={styles.slotCard}>
                <Text style={styles.slotLabel}>Icebreaker {index + 1}</Text>
                <Text style={styles.slotQuestion} numberOfLines={2}>
                  {iceBreaker?.question || "Not selected yet"}
                </Text>
                <Text
                  style={[
                    styles.slotAnswer,
                    !hasAnswer && styles.slotAnswerPending,
                  ]}
                  numberOfLines={2}
                >
                  {iceBreaker
                    ? hasAnswer
                      ? iceBreaker.answer.trim()
                      : "Answer needed"
                    : "Tap to choose a question"}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.editHint}>Tap to choose or edit your 3 icebreakers</Text>
      </Pressable>

      <Text style={styles.selectionCount}>
        {filledCount} of {MAX_ICEBREAKERS} answered
      </Text>

      <PrimaryButton
        title="Next Step"
        showArrow
        style={styles.primaryButton}
        onPress={onNext}
        disabled={filledCount < MAX_ICEBREAKERS}
      />

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.back()}
      >
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>

      <Modal
        visible={isPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPickerOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setIsPickerOpen(false)}
        />

        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Choose 3 Icebreakers</Text>
              <Text style={styles.modalSubtitle}>
                Scroll the list, select up to 3, and add answers below each one.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsPickerOpen(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: selectionProgressWidth }]}
            />
          </View>

          <Text style={styles.modalProgressText}>
            {selectedCount} of {MAX_ICEBREAKERS} selected • {filledCount} of{" "}
            {MAX_ICEBREAKERS} answered
          </Text>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {icebreakerOptions.map((question) => {
              const selectedIceBreaker = selectedIceBreakers.find(
                (item) => item.question === question,
              );
              const isSelected = Boolean(selectedIceBreaker);
              const hasAnswer = Boolean(selectedIceBreaker?.answer.trim());

              return (
                <View
                  key={question}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                >
                  {isSelected ? (
                    <>
                      <View style={styles.selectedRowTop}>
                        <View style={styles.selectedBadge}>
                          <Megaphone color="#89DBFB" size={14} />
                          <Text style={styles.selectedBadgeText}>SELECTED</Text>
                        </View>

                        <TouchableOpacity
                          style={styles.optionCloseButton}
                          onPress={() => toggleIceBreaker(question)}
                        >
                          <X color="#94a3b8" size={18} />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.optionTitleSelected}>{question}</Text>

                      <View style={styles.answerBubble}>
                        <TextInput
                          value={selectedIceBreaker?.answer ?? ""}
                          onChangeText={(value) => updateAnswer(question, value)}
                          placeholder="Type your answer..."
                          placeholderTextColor="#9ca3af"
                          style={styles.optionInput}
                          multiline
                        />

                        {hasAnswer ? (
                          <View style={styles.answerCheck}>
                            <Check color="white" size={18} />
                          </View>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <Pressable
                      onPress={() => toggleIceBreaker(question)}
                      style={styles.optionHeader}
                    >
                      <Text style={styles.optionTitle}>{question}</Text>

                      <View style={styles.optionPlusCircle}>
                        <Plus color="#94a3b8" size={22} />
                      </View>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    justifyContent: "center",
  },

  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "white",
    padding: 18,
    gap: 14,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  summarySubtitle: {
    color: "#6b7280",
    marginTop: 2,
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#89DBFB",
  },
  progressText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  slotList: {
    gap: 10,
  },
  slotCard: {
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    padding: 14,
    gap: 6,
  },
  slotLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  slotQuestion: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  slotAnswer: {
    color: "#374151",
  },
  slotAnswerPending: {
    color: "#9ca3af",
  },
  editHint: {
    textAlign: "center",
    color: "#6b7280",
    fontWeight: "600",
  },

  selectionCount: {
    textAlign: "center",
    marginTop: 12,
    marginBottom: 12,
    color: "#374151",
    fontWeight: "600",
  },
  primaryButton: {
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  secondaryButton: { padding: 16, borderRadius: 8, alignItems: "center" },
  secondaryText: { color: "#666" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 75,
    bottom: 36,
    borderRadius: 18,
    backgroundColor: "white",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: "#6b7280",
    marginTop: 4,
    maxWidth: 250,
  },
  modalClose: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#89DBFB",
    shadowColor: "#87BCFE",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  modalCloseText: {
    color: "white",
    fontWeight: "700",
  },
  modalProgressText: {
    color: "#374151",
    fontWeight: "600",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    gap: 10,
    paddingBottom: 8,
  },
  optionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 18,
    backgroundColor: "white",
    gap: 14,
  },
  optionCardSelected: {
    borderColor: "#89DBFB",
    shadowColor: "#89DBFB",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  optionTitleSelected: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2a44",
  },
  selectedRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectedBadgeText: {
    color: "#89DBFB",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  optionCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  optionPlusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  answerBubble: {
    borderRadius: 26,
    backgroundColor: "#f2f4f7",
    padding: 16,
    paddingBottom: 18,
    position: "relative",
  },
  optionInput: {
    padding: 0,
    minHeight: 90,
    textAlignVertical: "top",
    color: "#374151",
    paddingRight: 54,
  },
  answerCheck: {
    position: "absolute",
    right: 16,
    bottom: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
