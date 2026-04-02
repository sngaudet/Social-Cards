export type SignupLocationPermissionStatus =
  | "always"
  | "while_in_use"
  | "denied"
  | "unknown";

export type SignupDraft = {
  email: string;
  password: string;

  firstName: string;
  lastName: string;
  dateOfBirth: string;
  bio: string;
  pronouns: string;
  gradYear: number | null;
  major: string;
  minor: string;
  iceBreakerOne: string;
  iceBreakerOneQuestion: string;
  iceBreakerTwo: string;
  iceBreakerTwoQuestion: string;
  iceBreakerThree: string;
  iceBreakerThreeQuestion: string;
  hobbies: string[];
  avatarId: string;

  photoUris: string[];
  locationSharingEnabled: boolean;
  locationPermissionStatus: SignupLocationPermissionStatus;
};

export const emptySignupDraft: SignupDraft = {
  email: "",
  password: "",

  firstName: "",
  lastName: "",
  dateOfBirth: "",
  bio: "",
  pronouns: "",
  gradYear: null,
  major: "",
  minor: "",
  iceBreakerOne: "",
  iceBreakerOneQuestion: "",
  iceBreakerTwo: "",
  iceBreakerTwoQuestion: "",
  iceBreakerThree: "",
  iceBreakerThreeQuestion: "",
  hobbies: [],
  avatarId: "",

  photoUris: [],
  locationSharingEnabled: false,
  locationPermissionStatus: "unknown",
};
