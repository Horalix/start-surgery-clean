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

function sanitizeState(next: AppState): AppState {
  if (next.character?.special === "professor" && (next.profile.bestExamScore ?? 0) < 74) {
    const { special: _locked, ...character } = next.character;
    return { ...next, character };
  }
  return next;
}

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

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === VERSION) {
        state = sanitizeState({ ...defaultState(), ...parsed });
      }
    }
  } catch {
    /* corrupt — keep default */
  }
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
function bumpStreak(profile: AppState["profile"]): { profile: AppState["profile"]; bonus: number } {
  const today = todayKey();
  if (profile.lastActiveDay === today) return { profile, bonus: 0 };
  let streakDays = 1;
  if (profile.lastActiveDay) {
    const prev = new Date(profile.lastActiveDay);
    const diff = Math.round((Date.parse(today) - prev.getTime()) / 86400000);
    streakDays = diff === 1 ? profile.streakDays + 1 : 1;
  }
  // +5 XP first activity of the day
  return {
    profile: { ...profile, lastActiveDay: today, streakDays, xp: profile.xp + 5 },
    bonus: 5,
  };
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
    // Tightened XP economy — real answers matter, guessing barely does.
    const gained = correct
      ? confidence === "certain"
        ? 10
        : confidence === "confident"
          ? 8
          : confidence === "unsure"
            ? 6
            : 4
      : 1;
    const { profile } = bumpStreak({ ...s.profile, xp: s.profile.xp + gained });
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
    // Exam XP scales with actual score, capped high for a perfect run.
    const examXp = Math.round(attempt.score * 3);
    const { profile } = bumpStreak({
      ...s.profile,
      bestExamScore: best,
      xp: s.profile.xp + examXp,
    });
    return {
      ...s,
      examAttempts: [...s.examAttempts, at].slice(-50),
      profile,
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
      xp: s.profile.xp + (won ? 30 : 5),
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
const characterListeners = new Set<(c: CharacterCustomization | undefined) => void>();

export function setCharacter(character: CharacterCustomization) {
  set((s) => sanitizeState({ ...s, character }));
  for (const l of characterListeners) l(character);
}

/** Apply character from a remote source (cloud sync) without re-emitting a change. */
export function applyRemoteCharacter(character: CharacterCustomization | undefined) {
  set((s) => sanitizeState({ ...s, character }));
}

export function onCharacterChange(cb: (c: CharacterCustomization | undefined) => void) {
  characterListeners.add(cb);
  return () => characterListeners.delete(cb);
}
