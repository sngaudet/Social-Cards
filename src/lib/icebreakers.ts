export const MAX_ICEBREAKERS = 3;

export const DEFAULT_ICEBREAKER_QUESTIONS = [
  "What's your ideal weekend?",
  "What food can you never say no to?",
  "Share one fun fact about yourself",
];

export const AVAILABLE_ICEBREAKER_QUESTIONS = [
  ...DEFAULT_ICEBREAKER_QUESTIONS,
  "What's your go-to coffee or energy drink?",
  "Early bird or night owl?",
  "What's one class you're excited about this semester?",
  "Sweet snacks or salty snacks?",
  "What music do you listen to while studying?",
  "iPhone or Android?",
  "What's your favorite campus spot to hang out?",
  "What's the weirdest food combo you like?",
  "If you could only eat one meal on campus forever, what would it be?",
  "What's a TV show you can rewatch endlessly?",
  "What's your most unpopular opinion?",
  "If your life had a theme song, what would it be?",
  "Would you rather have no homework ever again or free tuition?",
  "What's the last thing you Googled?",
  "What fictional world would you want to live in?",
  "What's the best place to study on campus?",
  "What class has challenged you the most so far?",
  "Commuter or on-campus?",
  "What's one campus event everyone should attend at least once?",
  "What's your favorite thing about this school?",
  "What's a campus secret or life hack you've learned?",
  "Dining hall favorite or least favorite?",
  "What building do you get lost in every time?",
];

export type SelectedIceBreaker = {
  question: string;
  answer: string;
};

type IceBreakerSlot = {
  question?: string;
  answer?: string;
  fallbackQuestion: string;
};

export function getInitialSelectedIceBreakers(slots: IceBreakerSlot[]) {
  return slots.reduce<SelectedIceBreaker[]>((selected, slot) => {
    const answer = slot.answer ?? "";
    const question = slot.question?.trim()
      || (answer.trim() ? slot.fallbackQuestion : "");

    if (!question) return selected;
    if (selected.some((item) => item.question === question)) return selected;

    selected.push({
      question,
      answer,
    });
    return selected;
  }, []);
}
