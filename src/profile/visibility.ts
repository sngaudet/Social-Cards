export type PreConnectionVisibility = {
  photoURL: boolean;
  lastName: boolean;
  pronouns: boolean;
  dateOfBirth: boolean;
  gradYear: boolean;
  major: boolean;
  minor: boolean;
  bio: boolean;
  iceBreakerOneQuestion: boolean;
  iceBreakerOne: boolean;
  iceBreakerTwo: boolean;
  iceBreakerThree: boolean;
  hobbies: boolean;
};

export const DEFAULT_PRE_CONNECTION_VISIBILITY: PreConnectionVisibility = {
  photoURL: false,
  lastName: false,
  pronouns: true,
  dateOfBirth: true,
  gradYear: true,
  major: true,
  minor: true,
  bio: true,
  iceBreakerOneQuestion: true,
  iceBreakerOne: true,
  iceBreakerTwo: true,
  iceBreakerThree: true,
  hobbies: true,
};

export const PRE_CONNECTION_VISIBILITY_FIELDS: {
  key: keyof PreConnectionVisibility;
  label: string;
}[] = [
  { key: "photoURL", label: "Profile Photo" },
  { key: "lastName", label: "Last Name" },
  { key: "pronouns", label: "Pronouns" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "gradYear", label: "Graduation Year" },
  { key: "major", label: "Major" },
  { key: "minor", label: "Minor" },
  { key: "bio", label: "Bio" },
  { key: "iceBreakerOneQuestion", label: "Ice Breaker 1 Question" },
  { key: "iceBreakerOne", label: "Ice Breaker 1" },
  { key: "iceBreakerTwo", label: "Ice Breaker 2" },
  { key: "iceBreakerThree", label: "Ice Breaker 3" },
  { key: "hobbies", label: "Hobbies" },
];

export function normalizePreConnectionVisibility(
  value: unknown,
): PreConnectionVisibility {
  const record =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof PreConnectionVisibility, unknown>>)
      : {};

  return {
    photoURL:
      typeof record.photoURL === "boolean"
        ? record.photoURL
        : DEFAULT_PRE_CONNECTION_VISIBILITY.photoURL,
    lastName:
      typeof record.lastName === "boolean"
        ? record.lastName
        : DEFAULT_PRE_CONNECTION_VISIBILITY.lastName,
    pronouns:
      typeof record.pronouns === "boolean"
        ? record.pronouns
        : typeof (record as Record<string, unknown>).Gender === "boolean"
          ? ((record as Record<string, unknown>).Gender as boolean)
          : DEFAULT_PRE_CONNECTION_VISIBILITY.pronouns,
    dateOfBirth:
      typeof record.dateOfBirth === "boolean"
        ? record.dateOfBirth
        : typeof (record as Record<string, unknown>).age === "boolean"
          ? ((record as Record<string, unknown>).age as boolean)
          : DEFAULT_PRE_CONNECTION_VISIBILITY.dateOfBirth,
    gradYear:
      typeof record.gradYear === "boolean"
        ? record.gradYear
        : DEFAULT_PRE_CONNECTION_VISIBILITY.gradYear,
    major:
      typeof record.major === "boolean"
        ? record.major
        : DEFAULT_PRE_CONNECTION_VISIBILITY.major,
    minor:
      typeof record.minor === "boolean"
        ? record.minor
        : DEFAULT_PRE_CONNECTION_VISIBILITY.minor,
    bio:
      typeof record.bio === "boolean"
        ? record.bio
        : DEFAULT_PRE_CONNECTION_VISIBILITY.bio,
    iceBreakerOneQuestion:
      typeof record.iceBreakerOneQuestion === "boolean"
        ? record.iceBreakerOneQuestion
        : DEFAULT_PRE_CONNECTION_VISIBILITY.iceBreakerOneQuestion,
    iceBreakerOne:
      typeof record.iceBreakerOne === "boolean"
        ? record.iceBreakerOne
        : DEFAULT_PRE_CONNECTION_VISIBILITY.iceBreakerOne,
    iceBreakerTwo:
      typeof record.iceBreakerTwo === "boolean"
        ? record.iceBreakerTwo
        : DEFAULT_PRE_CONNECTION_VISIBILITY.iceBreakerTwo,
    iceBreakerThree:
      typeof record.iceBreakerThree === "boolean"
        ? record.iceBreakerThree
        : DEFAULT_PRE_CONNECTION_VISIBILITY.iceBreakerThree,
    hobbies:
      typeof record.hobbies === "boolean"
        ? record.hobbies
        : DEFAULT_PRE_CONNECTION_VISIBILITY.hobbies,
  };
}
