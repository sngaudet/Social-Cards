import React, { createContext, useContext, useState } from "react";
import { SignupDraft, emptySignupDraft } from "./types";

type SignupContextType = {
  draft: SignupDraft;
  updateDraft: (partial: Partial<SignupDraft>) => void;
  resetDraft: () => void;
};

const SignupContext = createContext<SignupContextType | undefined>(undefined);

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState(emptySignupDraft);

  function updateDraft(partial: Partial<SignupDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function resetDraft() {
    setDraft(emptySignupDraft);
  }

  return (
    <SignupContext.Provider value={{ draft, updateDraft, resetDraft }}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error("useSignup must be used inside SignupProvider");
  return ctx;
}
