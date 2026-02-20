export type SignupDraft = {
  email: string;
  password: string;

  firstName: string;
  lastName: string;
  Gender: string;
  age: number | null;
  gradYear: number | null;
  major: string;
  iceBreakerOne: string;
  iceBreakerTwo: string;
  iceBreakerThree: string;
  hobbies: string;

  photoUris: string[];
};

export const emptySignupDraft: SignupDraft = {
  email: "",
  password: "",

  firstName: "",
  lastName: "",
  Gender: "",
  age: null,
  gradYear: null,
  major: "",
  iceBreakerOne: "",
  iceBreakerTwo: "",
  iceBreakerThree: "",
  hobbies: "",

  photoUris: [],
};
