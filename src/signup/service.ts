// Legacy callers must not fall back to an account-enumerating lookup.
export async function checkEmailExists(_email: string): Promise<boolean> {
  throw new Error("Email availability lookup is no longer supported.");
}
