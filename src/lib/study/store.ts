import { useSyncExternalStore } from "react";
import type {
  AppState,
  CharacterCustomization,
  Confidence,
  ExamAttempt,
  QuestionProgress,
  SessionSummary,
  Settings,
} from "./types";
import { emptyProgress, schedule } from "./srs";


const KEY = "surgery1-mastery-v1";
const VERSION = 1;

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function defaultState(): AppState {
  return {
    version: VERSION,
    profile: {
      name: "Student",
      createdAt: Date.now(),
      xp: 0,
      streakDays: 0,
      lastActiveDay: null,
      bestExamScore: null,
      battlesWon: 0,
      battlesPlayed: 0,
    },
    settings: {
      theme: "light",
      keyboardHints: true,
      examTimerMinutes: 60,
    },
    progress: {},
    sessions: [],
    examAttempts: [],
    flagged: {},
    notUnderstood: {},
  };
}

let state: AppState = defaultState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Load from localStorage (client only). Safe to call multiple times. */
export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === VERSION) {
        state = { ...defaultState(), ...parsed };
      }
    }
  } catch {
    /* corrupt — keep default */
  }
  // apply theme immediately
  applyThemeClass(state.settings.theme);
  emit();
}

function set(updater: (s: AppState) => AppState) {
  state = updater(state);
  persist();
  emit();
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getState(): AppState {
  return state;
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(defaultState()),
  );
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => false,
  );
}

// ── Theme ────────────────────────────────────────────────────────────────────
export function applyThemeClass(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function toggleTheme() {
  set((s) => {
    const theme = s.settings.theme === "dark" ? "light" : "dark";
    applyThemeClass(theme);
    return { ...s, settings: { ...s.settings, theme } };
  });
}

export function updateSettings(patch: Partial<Settings>) {
  set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  if (patch.theme) applyThemeClass(patch.theme);
}

export function setName(name: string) {
  set((s) => ({ ...s, profile: { ...s.profile, name: name.trim() || "Student" } }));
}

// ── XP + streak ──────────────────────────────────────────────────────────────
function bumpStreak(profile: AppState["profile"]): AppState["profile"] {
  const today = todayKey();
  if (profile.lastActiveDay === today) return profile;
  let streakDays = 1;
  if (profile.lastActiveDay) {
    const prev = new Date(profile.lastActiveDay);
    const diff = Math.round((Date.parse(today) - prev.getTime()) / 86400000);
    streakDays = diff === 1 ? profile.streakDays + 1 : 1;
  }
  return { ...profile, lastActiveDay: today, streakDays };
}

// ── Answering ────────────────────────────────────────────────────────────────
export interface RecordAnswerInput {
  qid: string;
  correct: boolean;
  confidence: Confidence;
  ms: number;
  selected?: string[];
}

export function recordAnswer(input: RecordAnswerInput): QuestionProgress {
  const { qid, correct, confidence, ms, selected } = input;
  const now = Date.now();
  let updated: QuestionProgress = emptyProgress(qid);
  set((s) => {
    const prev = s.progress[qid] ?? emptyProgress(qid);
    updated = schedule(prev, { correct, confidence, ms, now, selected });
    const gained = correct
      ? confidence === "certain"
        ? 12
        : confidence === "confident"
          ? 10
          : 8
      : 3;
    const profile = bumpStreak({ ...s.profile, xp: s.profile.xp + gained });
    return { ...s, progress: { ...s.progress, [qid]: updated }, profile };
  });
  return updated;
}

export function logSession(summary: Omit<SessionSummary, "at">) {
  set((s) => ({
    ...s,
    sessions: [...s.sessions, { ...summary, at: Date.now() }].slice(-200),
  }));
}

export function logExam(attempt: Omit<ExamAttempt, "at">) {
  set((s) => {
    const at: ExamAttempt = { ...attempt, at: Date.now() };
    const best =
      s.profile.bestExamScore == null
        ? attempt.score
        : Math.max(s.profile.bestExamScore, attempt.score);
    return {
      ...s,
      examAttempts: [...s.examAttempts, at].slice(-50),
      profile: bumpStreak({ ...s.profile, bestExamScore: best, xp: s.profile.xp + 40 }),
    };
  });
}

export function recordBattle(won: boolean) {
  set((s) => ({
    ...s,
    profile: {
      ...s.profile,
      battlesPlayed: s.profile.battlesPlayed + 1,
      battlesWon: s.profile.battlesWon + (won ? 1 : 0),
      xp: s.profile.xp + (won ? 25 : 8),
    },
  }));
}

// ── Flags / notes ────────────────────────────────────────────────────────────
export function toggleFlag(qid: string) {
  set((s) => {
    const flagged = { ...s.flagged };
    if (flagged[qid]) delete flagged[qid];
    else flagged[qid] = true;
    return { ...s, flagged };
  });
}

export function toggleNotUnderstood(qid: string) {
  set((s) => {
    const notUnderstood = { ...s.notUnderstood };
    if (notUnderstood[qid]) delete notUnderstood[qid];
    else notUnderstood[qid] = true;
    return { ...s, notUnderstood };
  });
}

export function resetAllProgress() {
  set((s) => ({
    ...defaultState(),
    settings: s.settings,
    profile: { ...defaultState().profile, name: s.profile.name, createdAt: s.profile.createdAt },
  }));
}

// ── Character customization ──────────────────────────────────────────────────
export function setCharacter(character: CharacterCustomization) {
  set((s) => ({ ...s, character }));
}
