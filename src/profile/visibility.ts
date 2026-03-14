export type PreConnectionVisibility = {
  photoURL: boolean;
  lastName: boolean;
  Gender: boolean;
  age: boolean;
  gradYear: boolean;
  major: boolean;
  iceBreakerOne: boolean;
  iceBreakerTwo: boolean;
  iceBreakerThree: boolean;
  hobbies: boolean;
};

export const DEFAULT_PRE_CONNECTION_VISIBILITY: PreConnectionVisibility = {
  photoURL: false,
  lastName: false,
  Gender: true,
  age: true,
  gradYear: true,
  major: true,
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
  { key: "Gender", label: "Gender" },
  { key: "age", label: "Age" },
  { key: "gradYear", label: "Graduation Year" },
  { key: "major", label: "Major" },
  { key: "iceBreakerOne", label: "Ideal Weekend" },
  { key: "iceBreakerTwo", label: "Favorite Food Prompt" },
  { key: "iceBreakerThree", label: "Fun Fact" },
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
    Gender:
      typeof record.Gender === "boolean"
        ? record.Gender
        : DEFAULT_PRE_CONNECTION_VISIBILITY.Gender,
    age:
      typeof record.age === "boolean"
        ? record.age
        : DEFAULT_PRE_CONNECTION_VISIBILITY.age,
    gradYear:
      typeof record.gradYear === "boolean"
        ? record.gradYear
        : DEFAULT_PRE_CONNECTION_VISIBILITY.gradYear,
    major:
      typeof record.major === "boolean"
        ? record.major
        : DEFAULT_PRE_CONNECTION_VISIBILITY.major,
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
