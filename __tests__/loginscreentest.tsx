import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import React from "react";
import { Alert } from "react-native";

import Login from "../app/(auth)/login";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
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

    getByText("Welcome");
    getByPlaceholderText("Email");
    getByPlaceholderText("Password");
    getByText("Log In");
    getByText("Need an account? Sign Up Here");
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
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({});

    const { getByText, getByPlaceholderText } = render(<Login />);

    fireEvent.changeText(getByPlaceholderText("Email"), "test@test.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.press(getByText("Log In"));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
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
