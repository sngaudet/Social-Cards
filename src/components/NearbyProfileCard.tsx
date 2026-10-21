import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { getAvatarImageSource } from "../lib/avatarImages";
import { hobbyItems } from "../lib/hobbyCatalog";
import { DEFAULT_ICEBREAKER_QUESTIONS } from "../lib/icebreakers";
import { calculateAgeFromDateOfBirth } from "../lib/profileFields";
import type { NearbyUser } from "../location/service";
import {
  normalizePreConnectionVisibility,
  type PreConnectionVisibility,
} from "../profile/visibility";
import { iceColors as colors, iceMascot } from "../theme/icebreakers";

type NearbyProfileCardProps = {
  user: NearbyUser;
  isConnected: boolean;
  fallbackAvatarId?: string;
  actionsDisabled?: boolean;
  onConnect: () => void;
  onViewProfile: () => void;
  onMessage: () => void;
  onMore: () => void;
};

const HOBBY_PREVIEW_LIMIT = 4;

function formatPronouns(value?: string) {
  const normalized = value?.trim().toLowerCase().replaceAll("_", " ") ?? "";
  const legacyPronouns: Record<string, string> = {
    male: "he/him",
    female: "she/her",
    nonbinary: "they/them",
    mtf: "she/her",
    ftm: "he/him",
    genderfluid: "they/them",
    agender: "they/them",
    androgynous: "they/them",
  };
  const pronouns = legacyPronouns[normalized] ?? normalized;
  return pronouns.charAt(0).toUpperCase() + pronouns.slice(1);
}

export default function NearbyProfileCard({
  user,
  isConnected,
  fallbackAvatarId,
  actionsDisabled = false,
  onConnect,
  onViewProfile,
  onMessage,
  onMore,
}: NearbyProfileCardProps) {
  const visibility = normalizePreConnectionVisibility(
    user.preConnectionVisibility,
  );
  const canSee = (field: keyof PreConnectionVisibility) =>
    isConnected || visibility[field];
  const displayName =
    [user.firstName, canSee("lastName") ? user.lastName : ""]
      .filter(Boolean)
      .join(" ")
      .trim() || "Someone nearby";
  const firstName = user.firstName?.trim() || "Their";
  const possessiveName = user.firstName?.trim() ? `${firstName}'s` : "Their";
  const age = canSee("dateOfBirth")
    ? calculateAgeFromDateOfBirth(user.dateOfBirth ?? "")
    : null;
  const basics = [
    canSee("pronouns") ? formatPronouns(user.pronouns) : "",
    age != null ? `${age} years old` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const avatar = getAvatarImageSource(user.avatarId || fallbackAvatarId);
  const photo =
    canSee("photoURL") && user.photoURL ? { uri: user.photoURL } : null;
  const image = isConnected ? photo || avatar : avatar || photo;
  const hobbies = canSee("hobbies")
    ? user.hobbies.slice(0, HOBBY_PREVIEW_LIMIT)
    : [];
  const bio = canSee("bio") ? user.bio?.trim() : "";
  const answer = canSee("iceBreakerOne") ? user.iceBreakerOne?.trim() : "";
  const question = canSee("iceBreakerOneQuestion")
    ? user.iceBreakerOneQuestion?.trim() || DEFAULT_ICEBREAKER_QUESTIONS[0]
    : "";

  return (
    <View style={styles.card}>
      <View style={styles.profileHeader}>
        {image ? (
          <Image
            source={image}
            style={styles.avatar}
            accessibilityLabel={`${displayName}'s profile image`}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Feather name="user" size={34} color={colors.muted} />
          </View>
        )}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{displayName}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`More options for ${displayName}`}
              disabled={actionsDisabled}
              onPress={onMore}
              style={({ pressed }) => [
                styles.moreButton,
                pressed && styles.pressed,
                actionsDisabled && styles.disabled,
              ]}
            >
              <Feather name="more-horizontal" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.nearbyRow}>
            <View style={styles.statusDot} />
            <Text style={styles.nearbyText}>
              {isConnected ? "Connected" : "Nearby"}
            </Text>
          </View>
          {basics ? <Text style={styles.basics}>{basics}</Text> : null}
          {canSee("gradYear") && user.gradYear ? (
            <Text style={styles.basics}>Class of {user.gradYear}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {canSee("major") ? (
          <View style={styles.detailRow}>
            <Ionicons name="school-outline" size={24} color={colors.ink} />
            <View style={styles.detailContent}>
              <Text style={styles.label}>MAJOR</Text>
              <Text style={styles.major}>
                {user.major?.trim() || "Undeclared"}
              </Text>
            </View>
          </View>
        ) : null}

        {hobbies.length ? (
          <View style={styles.detailRow}>
            <Feather name="heart" size={24} color={colors.ink} />
            <View style={styles.detailContent}>
              <Text style={styles.label}>HOBBIES</Text>
              <View style={styles.hobbies}>
                {hobbies.map((hobby, index) => {
                  const normalized = hobby.trim().toLowerCase();
                  const definition = hobbyItems.find(
                    (item) =>
                      item.key === normalized ||
                      item.label.toLowerCase() === normalized,
                  );
                  const Icon = definition?.icon;
                  return (
                    <View key={`${hobby}-${index}`} style={styles.hobby}>
                      {Icon ? <Icon size={18} color={colors.ink} /> : null}
                      <Text style={styles.hobbyText}>
                        {definition?.label || hobby}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {bio ? (
          <View style={styles.bio}>
            <View style={styles.bioIcon}>
              <Feather name="message-square" size={18} color={colors.surface} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.label}>BIO</Text>
              <Text style={styles.bioText}>{bio}</Text>
            </View>
          </View>
        ) : null}

        {answer ? (
          <View style={styles.icebreaker}>
            <View style={styles.icebreakerHeader}>
              <View style={styles.icebreakerHeading}>
                <Text style={styles.icebreakerTitle}>Break the ice</Text>
                <Text style={styles.icebreakerSubtitle}>
                  {possessiveName} icebreaker
                </Text>
              </View>
              <Image
                source={iceMascot}
                style={styles.icebreakerMascot}
                resizeMode="contain"
                accessible={false}
              />
            </View>
            <View style={styles.answerCard}>
              {question ? (
                <Text style={styles.question}>{question}</Text>
              ) : null}
              <View style={question ? styles.answerSection : undefined}>
                <Text style={styles.answerLabel}>{possessiveName} answer</Text>
                <Text style={styles.answer}>{answer}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isConnected
                ? `Message ${displayName}`
                : `Connect with ${displayName}`
            }
            onPress={isConnected ? onMessage : onConnect}
            style={({ pressed }) => [
              styles.button,
              styles.connectButton,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={isConnected ? "message-circle" : "user-plus"}
              size={21}
              color={colors.surface}
            />
            <Text style={styles.connectText}>
              {isConnected ? "Message" : "Connect"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${displayName}'s profile`}
            onPress={onViewProfile}
            style={({ pressed }) => [
              styles.button,
              styles.profileButton,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="eye" size={21} color={colors.blue} />
            <Text style={styles.profileButtonText}>View profile</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    shadowColor: "#8EAFD0",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 2,
    overflow: "hidden",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: "#F5FAFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 88,
    height: 98,
    borderRadius: 15,
    backgroundColor: colors.frost,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  identity: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: "LexendSemiBold",
    fontSize: 25,
    lineHeight: 33,
    color: colors.ink,
  },
  moreButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -6,
    marginRight: -8,
  },
  nearbyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  nearbyText: { fontSize: 12, color: colors.muted },
  basics: { fontSize: 13, lineHeight: 19, color: colors.ink },
  body: { padding: 12, gap: 12 },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 4,
  },
  detailContent: { flex: 1, minWidth: 0, gap: 5 },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.muted,
  },
  major: { fontSize: 16, lineHeight: 21, fontWeight: "700", color: colors.ink },
  hobbies: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hobby: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: colors.butter,
  },
  hobbyText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.ink,
  },
  bio: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 15,
    backgroundColor: colors.frost,
  },
  bioIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue,
  },
  bioText: { fontSize: 14, lineHeight: 21, color: colors.ink },
  icebreaker: { padding: 12, borderRadius: 16, backgroundColor: colors.butter },
  icebreakerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 3,
    paddingBottom: 8,
  },
  icebreakerHeading: { flex: 1, gap: 3 },
  icebreakerTitle: {
    fontFamily: "LexendSemiBold",
    fontSize: 23,
    lineHeight: 31,
    color: colors.ink,
  },
  icebreakerSubtitle: { fontSize: 12, lineHeight: 18, color: colors.muted },
  icebreakerMascot: { width: 58, height: 62 },
  answerCard: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: colors.surface,
    gap: 10,
  },
  question: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  answerSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  answerLabel: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: 4,
  },
  answer: { fontSize: 14, lineHeight: 21, color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 1 },
  button: {
    flex: 1,
    flexBasis: 130,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 12,
  },
  connectButton: {
    backgroundColor: colors.blue,
    borderWidth: 1,
    borderColor: colors.blue,
  },
  connectText: {
    color: colors.surface,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  profileButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  profileButtonText: {
    color: colors.blue,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
