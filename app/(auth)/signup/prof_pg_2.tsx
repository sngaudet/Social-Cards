import { useRouter } from "expo-router";
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
import { useSignup } from "../../../src/signup/context";

function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

type IceKey = "one" | "two" | "three";

export default function SignupIceBreakersStep() {
  const router = useRouter();
  const { draft, updateDraft } = useSignup();

  const [iceBreakerOne, setIceBreakerOne] = useState(draft.iceBreakerOne ?? "");
  const [iceBreakerTwo, setIceBreakerTwo] = useState(draft.iceBreakerTwo ?? "");
  const [iceBreakerThree, setIceBreakerThree] = useState(
    draft.iceBreakerThree ?? "",
  );

  const filledCount = [iceBreakerOne, iceBreakerTwo, iceBreakerThree].filter(
    (v) => v.trim().length > 0,
  ).length;

  const [activeKey, setActiveKey] = useState<IceKey | null>(null);

  const questions = useMemo(
    () => ({
      one: "What's your ideal weekend?",
      two: "What food can you never say no to?",
      three: "Share one fun fact about yourself",
    }),
    [],
  );

  const answers = useMemo(
    () => ({
      one: iceBreakerOne,
      two: iceBreakerTwo,
      three: iceBreakerThree,
    }),
    [iceBreakerOne, iceBreakerTwo, iceBreakerThree],
  );

  const setAnswer = (key: IceKey, value: string) => {
    if (key === "one") setIceBreakerOne(value);
    if (key === "two") setIceBreakerTwo(value);
    if (key === "three") setIceBreakerThree(value);
  };

  const onNext = () => {
    if (
      !iceBreakerOne.trim() ||
      !iceBreakerTwo.trim() ||
      !iceBreakerThree.trim()
    ) {
      showAlert("Missing fields", "Please answer all ice breaker questions.");
      return;
    }

    updateDraft({
      iceBreakerOne: iceBreakerOne.trim(),
      iceBreakerTwo: iceBreakerTwo.trim(),
      iceBreakerThree: iceBreakerThree.trim(),
    });

    router.replace("/(auth)/signup/prof_pg_3");
  };

  const renderCard = (key: IceKey) => {
    const hasAnswer = !!answers[key]?.trim();
    return (
      <Pressable
        key={key}
        onPress={() => setActiveKey(key)}
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.9 },
          hasAnswer && styles.cardFilled,
        ]}
      >
        <View style={{ gap: 6 }}>
          <Text style={styles.cardTitle}>{questions[key]}</Text>
          <Text style={styles.cardSubtitle}>
            {hasAnswer ? answers[key].trim() : "Tap to answer"}
          </Text>
        </View>
        <Text style={styles.cardChevron}>›</Text>
      </Pressable>
    );
  };

  const activeQuestion = activeKey ? questions[activeKey] : "";
  const activeValue = activeKey ? answers[activeKey] : "";

  const closeModal = () => setActiveKey(null);

  const saveAndClose = () => {
    // optional: enforce non-empty per question when saving
    if (activeKey && !activeValue.trim()) {
      showAlert("Missing answer", "Please type an answer or press Cancel.");
      return;
    }
    closeModal();
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Ice Breakers</Text>

      <View style={{ gap: 12 }}>
        {renderCard("one")}
        {renderCard("two")}
        {renderCard("three")}
      </View>

      <Text style={{ textAlign: "center", marginBottom: 12 }}>
        {filledCount} Icebreakers selected
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
        <Text style={styles.primaryText}>Next</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.back()}
      >
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>

      <Modal
        visible={activeKey !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.backdrop} onPress={closeModal} />

        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{activeQuestion}</Text>

          <TextInput
            value={activeValue}
            onChangeText={(t) => activeKey && setAnswer(activeKey, t)}
            placeholder="Type your answer..."
            placeholderTextColor="#6b7280"
            style={styles.modalInput}
            autoFocus
            multiline
          />

          <View style={styles.modalRow}>
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
  content: { flexGrow: 1, padding: 24, paddingBottom: 48, justifyContent: "center" },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },

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
  cardFilled: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSubtitle: { color: "#6b7280" },
  cardChevron: { fontSize: 26, color: "#9ca3af", marginLeft: 10 },

  primaryButton: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 18,
    marginBottom: 12,
  },
  primaryText: { color: "white", fontWeight: "600" },
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
