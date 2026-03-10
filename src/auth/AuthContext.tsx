import { onAuthStateChanged, User } from "firebase/auth";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { auth } from "../../firebaseConfig";
import { registerPushTokenIfPossible } from "../location/service";

type AuthContextType = {
  user: User | null;
  initializing: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    console.log("AuthProvider mounted");
    console.log("Initial auth.currentUser =", auth.currentUser?.uid ?? null);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log(
        "onAuthStateChanged fired, firebaseUser =",
        firebaseUser?.uid ?? null,
      );

      setUser(firebaseUser);
      setInitializing(false);

      console.log("After setUser, initializing -> false");
    });

    return () => {
      console.log("AuthProvider unmounted");
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    registerPushTokenIfPossible().catch((error) => {
      console.warn("Push token registration failed", error);
    });
  }, [user?.uid]);

  const value = useMemo(
    () => ({
      user,
      initializing,
    }),
    [user, initializing],
  );

  console.log("AuthProvider render", {
    user: user?.uid ?? null,
    initializing,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
