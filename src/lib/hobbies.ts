export type HobbiesValue = string[] | string | null | undefined;

function cleanHobby(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeHobbies(value: HobbiesValue): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanHobby(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((item) => cleanHobby(item))
      .filter((item): item is string => Boolean(item));
  }

  return [];
}

export function parseHobbiesInput(value: string): string[] {
  return normalizeHobbies(value);
}

export function hobbiesToInputValue(value: HobbiesValue): string {
  return normalizeHobbies(value).join(", ");
}

export function formatHobbies(value: HobbiesValue): string {
  const hobbies = normalizeHobbies(value);
  return hobbies.length ? hobbies.join(", ") : "-";
}
