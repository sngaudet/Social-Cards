import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { sendPasswordResetEmail } from "firebase/auth";
import React from "react";

import ForgotPasswordScreen from "../app/(auth)/forgot-password";
import { showAlert } from "../src/lib/showAlert";
import { checkEmailExists } from "../src/signup/service";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  Link: ({ children }: any) => children,
}));

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock("firebase/auth", () => ({
  sendPasswordResetEmail: jest.fn(),
  getAuth: jest.fn(() => ({})),
  initializeAuth: jest.fn(() => ({})),
  getReactNativePersistence: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
}));

jest.mock("firebase/storage", () => ({ getStorage: jest.fn(() => ({})) }));

jest.mock("../src/lib/showAlert", () => ({
  showAlert: jest.fn(),
}));

jest.mock("../src/signup/service", () => ({
  checkEmailExists: jest.fn(),
}));

describe("<ForgotPasswordScreen />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows an alert when email is missing", async () => {
    const { getByText } = render(<ForgotPasswordScreen />);

    fireEvent.press(getByText("Send Reset Email"));

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        "Missing email",
        "Enter the email for your existing account.",
      );
    });
  });

  test("blocks reset requests for non-existent accounts", async () => {
    (checkEmailExists as jest.Mock).mockResolvedValueOnce(false);

    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText("Email"), "missing@test.edu");
    fireEvent.press(getByText("Send Reset Email"));

    await waitFor(() => {
      expect(checkEmailExists).toHaveBeenCalledWith("missing@test.edu");
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(showAlert).toHaveBeenCalledWith(
        "Account not found",
        "No account exists for that email address. Enter the email tied to your SocialCards account.",
      );
    });
  });

  test("sends password reset email for an existing account", async () => {
    (checkEmailExists as jest.Mock).mockResolvedValueOnce(true);
    (sendPasswordResetEmail as jest.Mock).mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText("Email"), "  TEST@School.edu ");
    fireEvent.press(getByText("Send Reset Email"));

    await waitFor(() => {
      expect(checkEmailExists).toHaveBeenCalledWith("test@school.edu");
      expect(sendPasswordResetEmail).toHaveBeenCalledWith({}, "test@school.edu");
      expect(showAlert).toHaveBeenCalledWith(
        "Reset email sent",
        "We sent a password reset email to test@school.edu. Check your inbox and spam folder.",
      );
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/(auth)/login",
        params: {
          showMessage: "PasswordResetSent",
          email: "test@school.edu",
        },
      });
    });
  });
});
