import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";
import SignupAccountStep from "../app/(auth)/signup/index";

// ---- shared router mocks ----
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockUpdateDraft = jest.fn();
const mockUseSignup = jest.fn();

jest.mock("../src/signup/context", () => ({
  useSignup: () => mockUseSignup(),
}));

describe("<SignupAccountStep />", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: prefill draft empty
    mockUseSignup.mockReturnValue({
      draft: { email: "", password: "" },
      updateDraft: mockUpdateDraft,
    });

    // Silence actual alerts
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
  });

  test("renders the basic signup UI", () => {
    const { getByText, getByPlaceholderText } = render(<SignupAccountStep />);

    expect(getByText("Sign Up")).toBeTruthy();
    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
    expect(getByPlaceholderText("Confirm Password")).toBeTruthy();
    expect(getByText("Next")).toBeTruthy();
    expect(getByText("Back")).toBeTruthy();
  });

  test("shows missing fields alert when Next pressed with empty inputs", () => {
    const { getByText } = render(<SignupAccountStep />);

    fireEvent.press(getByText("Next"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Missing fields",
      "Enter email and password.",
    );
  });

  test("shows invalid email alert when email missing @", () => {
    const { getByText, getByPlaceholderText } = render(<SignupAccountStep />);

    fireEvent.changeText(getByPlaceholderText("Email"), "notanemail");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(
      getByPlaceholderText("Confirm Password"),
      "password123",
    );

    fireEvent.press(getByText("Next"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Invalid email",
      "Enter a valid email address.",
    );
  });

  test("requires .edu email", () => {
    const { getByText, getByPlaceholderText } = render(<SignupAccountStep />);

    fireEvent.changeText(getByPlaceholderText("Email"), "test@gmail.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(
      getByPlaceholderText("Confirm Password"),
      "password123",
    );

    fireEvent.press(getByText("Next"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Invalid email - Use a student email",
      undefined,
    );
  });

  test("shows weak password alert when password < 6 chars", () => {
    const { getByText, getByPlaceholderText } = render(<SignupAccountStep />);

    fireEvent.changeText(getByPlaceholderText("Email"), "test@uwm.edu");
    fireEvent.changeText(getByPlaceholderText("Password"), "12345");
    fireEvent.changeText(getByPlaceholderText("Confirm Password"), "12345");

    fireEvent.press(getByText("Next"));

    // NOTE: your code uses Alert.alert here (not showAlert), so same expected call.
    expect(Alert.alert).toHaveBeenCalledWith(
      "Weak password",
      "Use at least 6 characters.",
    );
  });

  test("shows passwords do not match alert", () => {
    const { getByText, getByPlaceholderText } = render(<SignupAccountStep />);

    fireEvent.changeText(getByPlaceholderText("Email"), "test@uwm.edu");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(getByPlaceholderText("Confirm Password"), "different");

    fireEvent.press(getByText("Next"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Passwords do not match",
      undefined,
    );
  });

  test("successful Next updates draft and navigates to profile step", async () => {
    const { getByText, getByPlaceholderText } = render(<SignupAccountStep />);

    fireEvent.changeText(getByPlaceholderText("Email"), "  test@uwm.edu  "); // includes spaces to test trim
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(
      getByPlaceholderText("Confirm Password"),
      "password123",
    );

    fireEvent.press(getByText("Next"));

    await waitFor(() => {
      expect(mockUpdateDraft).toHaveBeenCalledWith({
        email: "test@uwm.edu",
        password: "password123",
      });
      expect(mockPush).toHaveBeenCalledWith("/(auth)/signup/profile");
    });
  });

  test("Back button replaces to login", () => {
    const { getByText } = render(<SignupAccountStep />);

    fireEvent.press(getByText("Back"));

    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  test("prefills email/password from draft", () => {
    mockUseSignup.mockReturnValueOnce({
      draft: { email: "prefill@uwm.edu", password: "abc12345" },
      updateDraft: mockUpdateDraft,
    });

    const { getByDisplayValue } = render(<SignupAccountStep />);

    expect(getByDisplayValue("prefill@uwm.edu")).toBeTruthy();
    expect(getByDisplayValue("abc12345")).toBeTruthy();
  });
});
