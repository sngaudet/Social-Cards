function isValidDateOfBirthParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const candidate = new Date(year, month - 1, day);
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

export function normalizeDateOfBirth(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isValidDateOfBirthParts(year, month, day) ? normalized : "";
  }

  const slashMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (!isValidDateOfBirthParts(year, month, day)) {
      return "";
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return "";
}

export function calculateAgeFromDateOfBirth(dateOfBirth: string): number | null {
  const normalized = normalizeDateOfBirth(dateOfBirth);
  if (!normalized) return null;

  const birthDate = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function formatDateOfBirth(dateOfBirth: string): string {
  const normalized = normalizeDateOfBirth(dateOfBirth);
  if (!normalized) return "-";

  const [year, month, day] = normalized.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  if (Number.isNaN(value.getTime())) return "-";

  return value.toLocaleDateString();
}
