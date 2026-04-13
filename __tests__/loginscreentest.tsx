import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import React from "react";
import { Alert } from "react-native";

import Login from "../app/(auth)/login";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: jest.fn(),
  sendEmailVerification: jest.fn(),
  signOut: jest.fn(),
  getAuth: jest.fn(() => ({})),
  initializeAuth: jest.fn(() => ({})),
  getReactNativePersistence: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
}));

jest.mock("firebase/storage", () => ({ getStorage: jest.fn(() => ({})) }));
jest.mock("firebase/functions", () => ({ getFunctions: jest.fn(() => ({})) }));

describe("<Login />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders the basic login UI", () => {
    const { getByText, getByPlaceholderText } = render(<Login />);

    expect(getByText("Welcome")).toBeTruthy();
    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
    expect(getByText("Log In")).toBeTruthy();
    expect(getByText("Need an account? Sign Up Here")).toBeTruthy();
  });

  test("shows missing fields alert when pressing Log In with empty inputs", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const { getByText } = render(<Login />);
    fireEvent.press(getByText("Log In"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Missing fields",
      "Enter email, password, and confirm password.",
    );

    alertSpy.mockRestore();
  });

  test("successful login calls firebase auth and navigates to tabs", async () => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
      user: {
        emailVerified: true,
        reload: jest.fn().mockResolvedValue(undefined),
      },
    });

    const { getByText, getByPlaceholderText } = render(<Login />);

    fireEvent.changeText(getByPlaceholderText("Email"), "test@test.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.press(getByText("Log In"));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  test("unverified login resends verification and blocks tabs access", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const reload = jest.fn().mockResolvedValue(undefined);
    const user = {
      emailVerified: false,
      reload,
    };

    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({ user });

    const { getByText, getByPlaceholderText } = render(<Login />);

    fireEvent.changeText(getByPlaceholderText("Email"), "test@school.edu");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.press(getByText("Log In"));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        "Verify your email",
        "Your email is not verified yet. Use the resend button if you need a fresh verification email.",
      );
    });

    alertSpy.mockRestore();
  });

  test("resend verification button sends a fresh email", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const reload = jest.fn().mockResolvedValue(undefined);
    const user = {
      emailVerified: false,
      reload,
    };

    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({ user });
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({ user });

    const { getByText, getByPlaceholderText } = render(<Login />);

    fireEvent.changeText(getByPlaceholderText("Email"), "test@school.edu");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.press(getByText("Log In"));

    await waitFor(() => {
      expect(getByText("Resend verification email")).toBeTruthy();
    });

    fireEvent.press(getByText("Resend verification email"));

    await waitFor(() => {
      expect(sendEmailVerification).toHaveBeenCalledWith(user);
      expect(signOut).toHaveBeenCalledTimes(2);
      expect(alertSpy).toHaveBeenCalledWith(
        "Verification email sent",
        "We sent a new verification email. Please use the newest message in your inbox.",
      );
    });

    alertSpy.mockRestore();
  });

  test("failed login shows an alert", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(
      new Error("Invalid credentials"),
    );

    const { getByText, getByPlaceholderText } = render(<Login />);

    fireEvent.changeText(getByPlaceholderText("Email"), "test@test.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "wrongpassword");
    fireEvent.press(getByText("Log In"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Login failed",
        "Invalid credentials",
      );
    });

    alertSpy.mockRestore();
  });
});
