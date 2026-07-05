import type { Confidence, QuestionProgress, AttemptRecord } from "./types";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export function emptyProgress(id: string): QuestionProgress {
  return {
    id,
    seen: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    ease: 2.3,
    intervalDays: 0,
    dueAt: 0,
    lastResult: null,
    lastConfidence: null,
    lastSeenAt: 0,
    lastMs: 0,
    lastSelected: [],
    mastered: false,
    history: [],
  };
}

/**
 * Adaptive retrieval schedule.
 * - Wrong answers resurface within minutes.
 * - Low-confidence correct answers resurface much sooner than confident ones.
 * - Intervals only lengthen after repeated clean, confident recalls.
 * - Mastery requires 3 consecutive fully-correct recalls at confident/certain.
 */
export function schedule(
  prev: QuestionProgress,
  opts: { correct: boolean; confidence: Confidence; ms: number; now: number; selected?: string[] },
): QuestionProgress {
  const { correct, confidence, ms, now, selected } = opts;
  const lastSelected = selected ?? prev.lastSelected;
  const confW = { guess: 0, unsure: 1, confident: 2, certain: 3 }[confidence];
  const dangerous = !correct && confW >= 2;

  const attempt: AttemptRecord = { at: now, correct, confidence, ms, dangerous };
  const history = [...prev.history, attempt].slice(-40);

  let { ease, streak } = prev;
  let intervalDays: number;

  if (!correct) {
    streak = 0;
    ease = Math.max(1.3, ease - 0.25);
    // resurface soon: 8 min for a plain miss, even sooner if it was a confident miss
    const soonMin = dangerous ? 4 : 8;
    const dueAt = now + soonMin * MIN;
    return {
      ...prev,
      seen: prev.seen + 1,
      incorrect: prev.incorrect + 1,
      streak,
      ease,
      intervalDays: 0,
      dueAt,
      lastResult: "incorrect",
      lastConfidence: confidence,
      lastSeenAt: now,
      lastMs: ms,
      lastSelected,
      mastered: false,
      history,
    };
  }

  // correct
  streak = prev.streak + 1;
  if (confW <= 0) {
    // correct but guessing → treat almost like a miss for spacing
    intervalDays = 0;
    ease = Math.max(1.3, ease - 0.1);
  } else if (confW === 1) {
    // unsure → short interval
    intervalDays = prev.intervalDays > 0 ? prev.intervalDays * 1.3 : 0.02; // ~30 min first time
  } else {
    ease = Math.min(2.8, ease + (confW === 3 ? 0.12 : 0.05));
    if (prev.intervalDays <= 0) intervalDays = confW === 3 ? 1 : 0.5;
    else intervalDays = prev.intervalDays * ease;
  }
  intervalDays = Math.min(intervalDays, 60);

  const dueAt = intervalDays <= 0 ? now + 25 * MIN : now + Math.round(intervalDays * DAY);

  const cleanConfidentStreak = countCleanConfident(history);
  const mastered = cleanConfidentStreak >= 3;

  return {
    ...prev,
    seen: prev.seen + 1,
    correct: prev.correct + 1,
    streak,
    ease,
    intervalDays,
    dueAt,
    lastResult: "correct",
    lastConfidence: confidence,
    lastSeenAt: now,
    lastMs: ms,
    lastSelected,
    mastered,
    history,
  };
}

function countCleanConfident(history: AttemptRecord[]): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const confW = { guess: 0, unsure: 1, confident: 2, certain: 3 }[h.confidence];
    if (h.correct && confW >= 2) n++;
    else break;
  }
  return n;
}

export function isDue(p: QuestionProgress | undefined, now: number): boolean {
  if (!p || p.seen === 0) return false;
  return p.dueAt <= now;
}

/** Mastery strength 0..1 for a single question, for analytics. */
export function masteryStrength(p: QuestionProgress | undefined): number {
  if (!p || p.seen === 0) return 0;
  if (p.mastered) return 1;
  const acc = p.correct / Math.max(1, p.seen);
  const streakBoost = Math.min(0.3, p.streak * 0.1);
  const dangerPenalty = p.history.some((h) => h.dangerous) ? 0.15 : 0;
  return Math.max(0, Math.min(0.95, acc * 0.7 + streakBoost - dangerPenalty));
}
