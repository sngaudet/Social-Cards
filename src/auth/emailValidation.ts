export function isEduEmail(email: string): boolean {
  const trimmedEmail = email.trim().toLowerCase();
  const atIndex = trimmedEmail.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === trimmedEmail.length - 1) {
    return false;
  }

  const domain = trimmedEmail.slice(atIndex + 1);
  return domain.endsWith(".edu");
}
