import { AutocompleteDropdownItem } from "react-native-autocomplete-dropdown";

export const OTHER_PROGRAM_OPTION_ID = "other";

export const ACADEMIC_PROGRAM_OPTIONS: AutocompleteDropdownItem[] = [
  { id: "computer-science", title: "Computer Science" },
  { id: "data-science", title: "Data Science" },
  { id: "information-technology", title: "Information Technology" },
  { id: "cybersecurity", title: "Cybersecurity" },
  { id: "electrical-engineering", title: "Electrical Engineering" },
  { id: "mechanical-engineering", title: "Mechanical Engineering" },
  { id: "civil-engineering", title: "Civil Engineering" },
  { id: "chemical-engineering", title: "Chemical Engineering" },
  { id: "biomedical-engineering", title: "Biomedical Engineering" },
  { id: "mathematics", title: "Mathematics" },
  { id: "statistics", title: "Statistics" },
  { id: "physics", title: "Physics" },
  { id: "astrophysics", title: "Astrophysics" },
  { id: "chemistry", title: "Chemistry" },
  { id: "biology", title: "Biology" },
  { id: "geology", title: "Geology" },
  { id: "environmental-science", title: "Environmental Science" },
  { id: "business-administration", title: "Business Administration" },
  { id: "entrepreneurship", title: "Entrepreneurship" },
  { id: "supply-chain", title: "Supply Chain" },
  { id: "economics", title: "Economics" },
  { id: "finance", title: "Finance" },
  { id: "accounting", title: "Accounting" },
  { id: "marketing", title: "Marketing" },
  { id: "graphic-design", title: "Graphic Design" },
  { id: "fine-arts", title: "Fine Arts" },
  { id: "film-studies", title: "Film Studies" },
  { id: "photography", title: "Photography" },
  { id: "animation", title: "Animation" },
  { id: "music", title: "Music" },
  { id: "theater", title: "Theater" },
  { id: "performing-arts", title: "Performing Arts" },
  { id: "english", title: "English" },
  { id: "literature", title: "Literature" },
  { id: "creative-writing", title: "Creative Writing" },
  { id: "game-design", title: "Game Design" },
  { id: "psychology", title: "Psychology" },
  { id: "sociology", title: "Sociology" },
  { id: "political-science", title: "Political Science" },
  { id: "history", title: "History" },
  { id: "philosophy", title: "Philosophy" },
  { id: "communications", title: "Communications" },
  { id: "anthropology", title: "Anthropology" },
  { id: "international-relations", title: "International Relations" },
  { id: "nursing", title: "Nursing" },
  { id: "public-health", title: "Public Health" },
  { id: "kinesiology", title: "Kinesiology" },
  { id: "nutrition", title: "Nutrition" },
  { id: "pharmacy", title: "Pharmacy" },
  { id: "health-sciences", title: "Health Sciences" },
  { id: "criminal-justice", title: "Criminal Justice" },
  { id: "legal-studies", title: "Legal Studies" },
  { id: "public-administration", title: "Public Administration" },
  { id: "homeland-security", title: "Homeland Security" },
  { id: "criminology", title: "Criminology" },
  { id: "elementary-education", title: "Elementary Education" },
  { id: "secondary-education", title: "Secondary Education" },
  { id: "special-education", title: "Special Education" },
  { id: "early-childhood-education", title: "Early Childhood Education" },
  { id: "educational-psychology", title: "Educational Psychology" },
  { id: "architecture", title: "Architecture" },
  { id: "urban-planning", title: "Urban Planning" },
  { id: "agriculture", title: "Agriculture" },
  { id: "environmental-studies", title: "Environmental Studies" },
  { id: "hospitality", title: "Hospitality" },
  { id: "sports-management", title: "Sports Management" },
  { id: "aviation", title: "Aviation" },
  { id: OTHER_PROGRAM_OPTION_ID, title: "Other" },
];

export function findAcademicProgramByTitle(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return undefined;
  }

  return ACADEMIC_PROGRAM_OPTIONS.find(
    (option) => option.title?.trim().toLowerCase() === normalizedValue,
  );
}

export function getAcademicProgramInitialValue(value: string) {
  if (!value.trim()) return undefined;

  const matchingOption = findAcademicProgramByTitle(value);

  return (
    matchingOption ??
    ACADEMIC_PROGRAM_OPTIONS.find(
      (option) => option.id === OTHER_PROGRAM_OPTION_ID,
    )
  );
}

export function isPresetAcademicProgram(value: string) {
  return ACADEMIC_PROGRAM_OPTIONS.some(
    (option) => option.id !== OTHER_PROGRAM_OPTION_ID && option.title === value,
  );
}
