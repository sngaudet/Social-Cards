import { useRouter } from "expo-router";
import { CircleCheckBig, Megaphone } from "lucide-react-native";
import React, { useState } from "react";
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
      answer: draft.iceBreakerOne?.trim() ?? "",
      fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[0],
    },
    {
      question: draft.iceBreakerTwoQuestion?.trim() ?? "",
      answer: draft.iceBreakerTwo?.trim() ?? "",
      fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[1],
    },
    {
      question: draft.iceBreakerThreeQuestion?.trim() ?? "",
      answer: draft.iceBreakerThree?.trim() ?? "",
      fallbackQuestion: DEFAULT_ICEBREAKER_QUESTIONS[2],
    },
  ];

  return slots.reduce<SelectedIceBreaker[]>((selected, slot) => {
    const question = slot.question || (slot.answer ? slot.fallbackQuestion : "");
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
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [modalValue, setModalValue] = useState("");
  const [selectionWasNew, setSelectionWasNew] = useState(false);

  const icebreakerOptions = Array.from(
    new Set([
      ...AVAILABLE_ICEBREAKER_QUESTIONS,
      ...selectedIceBreakers.map((item) => item.question),
    ]),
  );
  const filledCount = selectedIceBreakers.filter((item) => item.answer.trim()).length;

  const openCard = (question: string) => {
    const selectedIceBreaker = selectedIceBreakers.find(
      (item) => item.question === question,
    );

    if (!selectedIceBreaker) {
      if (selectedIceBreakers.length >= MAX_ICEBREAKERS) {
        showAlert(
          "Selection limit reached",
          `Choose up to ${MAX_ICEBREAKERS} icebreakers. Remove one before picking another.`,
        );
        return;
      }

      setSelectedIceBreakers((current) => [...current, { question, answer: "" }]);
      setSelectionWasNew(true);
      setModalValue("");
    } else {
      setSelectionWasNew(false);
      setModalValue(selectedIceBreaker.answer);
    }

    setActiveQuestion(question);
  };

  const closeModal = () => {
    if (selectionWasNew && activeQuestion) {
      setSelectedIceBreakers((current) =>
        current.filter((item) => item.question !== activeQuestion),
      );
    }

    setActiveQuestion(null);
    setModalValue("");
    setSelectionWasNew(false);
  };

  const saveAndClose = () => {
    if (!activeQuestion) return;
    if (!modalValue.trim()) {
      showAlert("Missing answer", "Please type an answer or remove this prompt.");
      return;
    }

    setSelectedIceBreakers((current) =>
      current.map((item) =>
        item.question === activeQuestion
          ? { ...item, answer: modalValue.trim() }
          : item,
      ),
    );
    setActiveQuestion(null);
    setModalValue("");
    setSelectionWasNew(false);
  };

  const removeSelection = () => {
    if (!activeQuestion) return;

    setSelectedIceBreakers((current) =>
      current.filter((item) => item.question !== activeQuestion),
    );
    setActiveQuestion(null);
    setModalValue("");
    setSelectionWasNew(false);
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
        subtitle="Choose and answer exactly 3 icebreakers. Tap a card to select it, then add your answer."
      />

      <View style={styles.cardList}>
        {icebreakerOptions.map((question) => {
          const selectedIceBreaker = selectedIceBreakers.find(
            (item) => item.question === question,
          );
          const answer = selectedIceBreaker?.answer.trim() ?? "";
          const isSelected = Boolean(selectedIceBreaker);
          const hasAnswer = answer.length > 0;

          return (
            <Pressable
              key={question}
              onPress={() => openCard(question)}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.9 },
                isSelected && styles.cardFilled,
              ]}
            >
              <View style={styles.cardCopy}>
                {isSelected ? (
                  <View style={styles.selectedRow}>
                    <Megaphone color="#89DBFB" size={20} />
                    <Text style={styles.textSelected}>   Selected</Text>
                  </View>
                ) : null}

                <Text style={styles.cardTitle}>{question}</Text>

                <View style={styles.subtitleSpace}>
                  <Text style={styles.cardSubtitle}>
                    {hasAnswer
                      ? answer
                      : isSelected
                        ? "Selected. Tap to add your answer."
                        : "Tap to select this icebreaker."}
                  </Text>

                  {hasAnswer ? (
                    <View style={styles.iconPosition}>
                      <CircleCheckBig color="#007502" size={20} />
                    </View>
                  ) : null}
                </View>
              </View>

              <Text style={styles.cardChevron}>›</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.selectionCount}>
        {filledCount} of {MAX_ICEBREAKERS} icebreakers ready
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
        visible={activeQuestion !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.backdrop} onPress={closeModal} />

        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{activeQuestion}</Text>

          <TextInput
            value={modalValue}
            onChangeText={setModalValue}
            placeholder="Type your answer..."
            placeholderTextColor="#6b7280"
            style={styles.modalInput}
            autoFocus
            multiline
          />

          <View style={styles.modalRow}>
            <TouchableOpacity
              style={styles.modalDanger}
              onPress={removeSelection}
            >
              <Text style={styles.modalDangerText}>Remove</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={closeModal}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={saveAndClose}
            >
              <Text style={styles.modalPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
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

  cardList: { gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "white",
  },
  cardCopy: { flex: 1, gap: 6 },
  cardFilled: {
    borderColor: "#93c5fd",
    borderWidth: 2,
    borderLeftWidth: 4,
    backgroundColor: "white",
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSubtitle: {
    color: "black",
  },
  subtitleSpace: {
    backgroundColor: "#edeeef",
    borderRadius: 20,
    paddingTop: 15,
    paddingBottom: 35,
    paddingLeft: 20,
    paddingRight: 20,
    position: "relative",
  },
  iconPosition: {
    position: "absolute",
    bottom: 10,
    right: 12,
  },
  textSelected: {
    color: "#89DBFB",
  },
  selectedRow: {
    flexDirection: "row",
  },
  cardChevron: { fontSize: 26, color: "#9ca3af", marginLeft: 10 },

  selectionCount: { textAlign: "center", marginBottom: 12 },
  primaryButton: {
    alignSelf: "center",
    marginTop: 18,
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
    left: 20,
    right: 20,
    top: "30%",
    borderRadius: 14,
    backgroundColor: "white",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  modalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalDanger: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  modalDangerText: { color: "#b91c1c", fontWeight: "600" },
  modalSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modalSecondaryText: { color: "#374151", fontWeight: "600" },
  modalPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
  },
  modalPrimaryText: { color: "white", fontWeight: "700" },
});
