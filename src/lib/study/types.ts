import type { Question } from "@/data/questions";

export type Confidence = "guess" | "unsure" | "confident" | "certain";

export const CONFIDENCE_META: Record<Confidence, { label: string; weight: number; short: string }> =
  {
    guess: { label: "Guessing", weight: 0, short: "Guess" },
    unsure: { label: "Unsure", weight: 1, short: "Unsure" },
    confident: { label: "Confident", weight: 2, short: "Confident" },
    certain: { label: "Certain", weight: 3, short: "Certain" },
  };

export interface AttemptRecord {
  at: number;
  correct: boolean;
  confidence: Confidence;
  ms: number;
  /** dangerous = wrong while confident/certain */
  dangerous: boolean;
}

export interface QuestionProgress {
  id: string;
  seen: number;
  correct: number;
  incorrect: number;
  streak: number;
  ease: number;
  intervalDays: number;
  dueAt: number;
  lastResult: "correct" | "incorrect" | null;
  lastConfidence: Confidence | null;
  lastSeenAt: number;
  lastMs: number;
  lastSelected: string[];
  mastered: boolean;
  history: AttemptRecord[];
}

export type CompanionMood = "idle" | "happy" | "sad" | "thinking";

export interface Profile {
  name: string;
  createdAt: number;
  xp: number;
  streakDays: number;
  lastActiveDay: string | null;
  bestExamScore: number | null;
  battlesWon: number;
  battlesPlayed: number;
  /** current global consecutive-correct combo */
  combo: number;
  /** best combo ever reached */
  bestCombo: number;
}

export interface SessionSummary {
  at: number;
  mode: string;
  total: number;
  correct: number;
}

export interface ExamAttempt {
  at: number;
  score: number;
  total: number;
  durationMs: number;
  timed: boolean;
  perQuestion: { examNo: number; qid: string; correct: boolean; confidence: Confidence | null }[];
}

export interface Settings {
  theme: "light" | "dark";
  keyboardHints: boolean;
  examTimerMinutes: number;
}

export type SpecialCharacter =
  "angel" | "devil" | "phoenix" | "void" | "titan" | "professor" | "reaper" | "oracle" | "samurai";

export interface CharacterCustomization {
  palette?: Partial<{
    skin: string;
    scrub: string;
    scrubDark: string;
    hair: string;
    accent: string;
  }>;
  props?: Partial<{
    cap: boolean;
    mask: boolean;
    glasses: boolean;
    badge: boolean;
    loupe: boolean;
  }>;
  special?: SpecialCharacter;
  /** Ascension tier for Angel/Devil (1..3). Derived from owner profile, snapshot to server. */
  tier?: 1 | 2 | 3;
}

export interface AppState {
  version: number;
  profile: Profile;
  settings: Settings;
  character?: CharacterCustomization;
  progress: Record<string, QuestionProgress>;
  sessions: SessionSummary[];
  examAttempts: ExamAttempt[];
  flagged: Record<string, boolean>;
  notUnderstood: Record<string, boolean>;
  /** achievement id → unlockedAt epoch ms */
  achievements: Record<string, number>;
  /** day key (YYYY-MM-DD) → claimed quest ids */
  questClaims: Record<string, string[]>;
  /** topic id → boss victories */
  bossWins: Record<string, number>;
}

export interface GradeResult {
  correct: boolean;
  hits: string[];
  wrongSelected: string[];
  missed: string[];
}

/** Set-equality grading that works for every polarity/count. */
export function grade(q: Question, selected: string[]): GradeResult {
  const answer = new Set(q.answer);
  const sel = new Set(selected);
  const hits = selected.filter((s) => answer.has(s));
  const wrongSelected = selected.filter((s) => !answer.has(s));
  const missed = q.answer.filter((a) => !sel.has(a));
  const correct = wrongSelected.length === 0 && missed.length === 0 && sel.size === answer.size;
  return { correct, hits, wrongSelected, missed };
}
