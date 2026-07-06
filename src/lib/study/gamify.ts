/**
 * Gamification core: daily quests, achievements, combo XP, and topic stars.
 *
 * Everything here is a pure function of AppState so it stays deterministic,
 * cheap to recompute, and impossible to desync from real study data. Quests
 * derive their progress from attempt history/sessions rather than separate
 * counters, so they can never drift from what the student actually did.
 */
import { QUESTIONS, type TopicId } from "@/data/questions";
import { TOPICS } from "@/data/topics";
import type { AppState } from "./types";

// ── Day helpers ──────────────────────────────────────────────────────────────
export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function dayStartMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

// ── Today's raw activity, derived from real history ─────────────────────────
export interface DayActivity {
  attempts: number;
  correct: number;
  drillOrRapidSessions: number;
  bossFights: number;
  examAttempts: number;
  accuracyPct: number; // 0 when < 1 attempt
}

export function todayActivity(state: AppState): DayActivity {
  const start = dayStartMs();
  let attempts = 0;
  let correct = 0;
  for (const p of Object.values(state.progress)) {
    for (const h of p.history) {
      if (h.at >= start) {
        attempts++;
        if (h.correct) correct++;
      }
    }
  }
  const sessionsToday = state.sessions.filter((s) => s.at >= start);
  const drillOrRapidSessions = sessionsToday.filter(
    (s) => s.mode === "Weakness Drill" || s.mode === "Rapid Recall",
  ).length;
  const bossFights = sessionsToday.filter((s) => s.mode === "Boss Fight").length;
  const examAttempts = state.examAttempts.filter((e) => e.at >= start).length;
  return {
    attempts,
    correct,
    drillOrRapidSessions,
    bossFights,
    examAttempts,
    accuracyPct: attempts ? Math.round((correct / attempts) * 100) : 0,
  };
}

// ── Daily quests ─────────────────────────────────────────────────────────────
export interface QuestDef {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  xp: number;
  /** progress 0..target */
  progress: (a: DayActivity) => number;
  target: number;
}

export const DAILY_QUESTS: QuestDef[] = [
  {
    id: "warmup",
    title: "Morning Rounds",
    desc: "Answer 20 questions today",
    emoji: "🩺",
    xp: 30,
    progress: (a) => a.attempts,
    target: 20,
  },
  {
    id: "sharp",
    title: "Sharp Scalpel",
    desc: "Get 15 answers fully correct",
    emoji: "🔪",
    xp: 40,
    progress: (a) => a.correct,
    target: 15,
  },
  {
    id: "focus",
    title: "Targeted Therapy",
    desc: "Finish a Weakness Drill or Rapid Recall set",
    emoji: "🎯",
    xp: 35,
    progress: (a) => a.drillOrRapidSessions,
    target: 1,
  },
  {
    id: "precision",
    title: "Steady Hands",
    desc: "Hold ≥80% accuracy over 10+ answers today",
    emoji: "🫀",
    xp: 50,
    progress: (a) => (a.attempts >= 10 && a.accuracyPct >= 80 ? 1 : 0),
    target: 1,
  },
  {
    id: "bigfight",
    title: "Face the Examiner",
    desc: "Defeat a topic boss or sit the exam simulation",
    emoji: "⚔️",
    xp: 60,
    progress: (a) => a.bossFights + a.examAttempts,
    target: 1,
  },
];

export interface QuestStatus extends QuestDef {
  value: number;
  complete: boolean;
  claimed: boolean;
}

export function questStatuses(state: AppState): QuestStatus[] {
  const a = todayActivity(state);
  const claimedToday = state.questClaims[dayKey()] ?? [];
  return DAILY_QUESTS.map((q) => {
    const value = Math.min(q.target, q.progress(a));
    return {
      ...q,
      value,
      complete: value >= q.target,
      claimed: claimedToday.includes(q.id),
    };
  });
}

// ── Combo XP ─────────────────────────────────────────────────────────────────
/** Extra XP for the current global correct-answer combo (after increment). */
export function comboBonus(combo: number): number {
  if (combo >= 20) return 8;
  if (combo >= 10) return 5;
  if (combo >= 5) return 3;
  if (combo >= 3) return 1;
  return 0;
}

export function comboLabel(combo: number): string | null {
  if (combo >= 20) return "UNSTOPPABLE";
  if (combo >= 10) return "ON FIRE";
  if (combo >= 5) return "HOT STREAK";
  if (combo >= 3) return "COMBO";
  return null;
}

// ── Achievements ─────────────────────────────────────────────────────────────
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  secret?: boolean;
  check: (state: AppState, ctx: { hour: number; today: DayActivity }) => boolean;
}

function masteredCount(state: AppState): number {
  let n = 0;
  for (const p of Object.values(state.progress)) if (p.mastered) n++;
  return n;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first-cut",
    name: "First Incision",
    desc: "Answer your first question",
    emoji: "🩹",
    check: (s) => Object.values(s.progress).some((p) => p.seen > 0),
  },
  {
    id: "combo-5",
    name: "Hot Streak",
    desc: "5 correct answers in a row",
    emoji: "🔥",
    check: (s) => s.profile.bestCombo >= 5,
  },
  {
    id: "combo-10",
    name: "On Fire",
    desc: "10 correct answers in a row",
    emoji: "🚒",
    check: (s) => s.profile.bestCombo >= 10,
  },
  {
    id: "combo-20",
    name: "Unstoppable",
    desc: "20 correct answers in a row",
    emoji: "⚡",
    check: (s) => s.profile.bestCombo >= 20,
  },
  {
    id: "mastered-25",
    name: "Resident Knowledge",
    desc: "Master 25 questions",
    emoji: "📗",
    check: (s) => masteredCount(s) >= 25,
  },
  {
    id: "mastered-75",
    name: "Attending Material",
    desc: "Master 75 questions",
    emoji: "📘",
    check: (s) => masteredCount(s) >= 75,
  },
  {
    id: "mastered-156",
    name: "The Perfect Bank",
    desc: "Master all 156 questions",
    emoji: "🏆",
    check: (s) => masteredCount(s) >= QUESTIONS.length,
  },
  {
    id: "boss-slayer",
    name: "Boss Slayer",
    desc: "Defeat your first topic boss",
    emoji: "⚔️",
    check: (s) => Object.values(s.bossWins).some((n) => n > 0),
  },
  {
    id: "boss-all",
    name: "Department Head",
    desc: "Defeat the boss of every topic",
    emoji: "👑",
    check: (s) => TOPICS.every((t) => (s.bossWins[t.id] ?? 0) > 0),
  },
  {
    id: "exam-pass",
    name: "Green Light",
    desc: "Score 60+ on the exam simulation",
    emoji: "✅",
    check: (s) => (s.profile.bestExamScore ?? 0) >= 60,
  },
  {
    id: "exam-perfect",
    name: "Flawless Final",
    desc: "Score a perfect 74/74",
    emoji: "💯",
    check: (s) => (s.profile.bestExamScore ?? 0) >= 74,
  },
  {
    id: "streak-7",
    name: "Week One",
    desc: "Study 7 days in a row",
    emoji: "📅",
    check: (s) => s.profile.streakDays >= 7,
  },
  {
    id: "battle-first",
    name: "First Blood",
    desc: "Win a Battle Arena match",
    emoji: "🗡️",
    check: (s) => s.profile.battlesWon >= 1,
  },
  {
    id: "comeback",
    name: "Comeback Kid",
    desc: "Master a question you had missed 3+ times",
    emoji: "🔄",
    check: (s) => Object.values(s.progress).some((p) => p.incorrect >= 3 && p.mastered),
  },
  {
    id: "centurion",
    name: "Centurion",
    desc: "100 answers in a single day",
    emoji: "💪",
    check: (_s, ctx) => ctx.today.attempts >= 100,
  },
  {
    id: "night-owl",
    name: "Night Shift",
    desc: "Study between midnight and 5 am",
    emoji: "🦉",
    secret: true,
    check: (_s, ctx) => ctx.hour >= 0 && ctx.hour < 5 && ctx.today.attempts > 0,
  },
];

/** Returns ids newly unlocked given current state (excluding already unlocked). */
export function newlyUnlocked(state: AppState): AchievementDef[] {
  const ctx = { hour: new Date().getHours(), today: todayActivity(state) };
  const out: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    try {
      if (a.check(state, ctx)) out.push(a);
    } catch {
      /* never let a bad check break answering */
    }
  }
  return out;
}

// ── Topic stars for the Quest Map ────────────────────────────────────────────
export interface TopicQuest {
  id: TopicId;
  label: string;
  short: string;
  tone: string;
  total: number;
  mastered: number;
  seen: number;
  stars: 0 | 1 | 2 | 3;
  bossDefeated: boolean;
}

export function topicQuests(state: AppState): TopicQuest[] {
  return TOPICS.map((t) => {
    const qs = QUESTIONS.filter((q) => q.topic === t.id);
    let mastered = 0;
    let seen = 0;
    for (const q of qs) {
      const p = state.progress[q.id];
      if (p && p.seen > 0) seen++;
      if (p?.mastered) mastered++;
    }
    const frac = qs.length ? mastered / qs.length : 0;
    const stars: 0 | 1 | 2 | 3 = frac >= 1 ? 3 : frac >= 2 / 3 ? 2 : frac >= 1 / 3 ? 1 : 0;
    return {
      id: t.id,
      label: t.label,
      short: t.short,
      tone: t.tone,
      total: qs.length,
      mastered,
      seen,
      stars,
      bossDefeated: (state.bossWins[t.id] ?? 0) > 0,
    };
  });
}
