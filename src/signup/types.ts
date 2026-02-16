export type SignupDraft = {
  email: string;
  password: string;

  firstName: string;
  lastName: string;
  Gender: string;
  age: string;
  gradYear: string;
  major: string;
  iceBreakerOne: string;
  iceBreakerTwo: string;
  iceBreakerThree: string;
  hobbies: string;
};

export const emptySignupDraft: SignupDraft = {
  email: "",
  password: "",

  firstName: "",
  lastName: "",
  Gender: "",
  age: "",
  gradYear: "",
  major: "",
  iceBreakerOne: "",
  iceBreakerTwo: "",
  iceBreakerThree: "",
  hobbies: "",
};
