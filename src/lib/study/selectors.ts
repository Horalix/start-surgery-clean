import {
  QUESTIONS,
  ABD_QUESTIONS,
  TX_QUESTIONS,
  EXAM_QUESTIONS,
  QUESTION_BY_ID,
  type Question,
  type TopicId,
} from "@/data/questions";
import { TOPICS } from "@/data/topics";
import type { AppState, QuestionProgress } from "./types";
import { isDue, masteryStrength } from "./srs";

export interface TopicStat {
  id: TopicId;
  label: string;
  short: string;
  tone: string;
  total: number;
  seen: number;
  mastered: number;
  accuracy: number; // 0..1 over attempts
  strength: number; // 0..1 avg mastery
}

export interface Readiness {
  examScorePct: number; // predicted % on the 74-question exam
  masteryPct: number; // % of all 156 mastered
  seenPct: number;
  recentAccuracy: number; // 0..1
  dueCount: number;
  neverSeen: number;
  repeatedErrors: number;
  dangerous: number;
  state: "not-ready" | "almost" | "ready";
  reasons: string[];
}

function prog(state: AppState, id: string): QuestionProgress | undefined {
  return state.progress[id];
}

export function topicStats(state: AppState): TopicStat[] {
  return TOPICS.map((t) => {
    const qs = QUESTIONS.filter((q) => q.topic === t.id);
    let seen = 0;
    let mastered = 0;
    let attempts = 0;
    let correct = 0;
    let strengthSum = 0;
    for (const q of qs) {
      const p = prog(state, q.id);
      strengthSum += masteryStrength(p);
      if (p && p.seen > 0) {
        seen++;
        attempts += p.seen;
        correct += p.correct;
        if (p.mastered) mastered++;
      }
    }
    return {
      id: t.id,
      label: t.label,
      short: t.short,
      tone: t.tone,
      total: qs.length,
      seen,
      mastered,
      accuracy: attempts ? correct / attempts : 0,
      strength: qs.length ? strengthSum / qs.length : 0,
    };
  });
}

export function weakestTopics(state: AppState, n = 3): TopicStat[] {
  const stats = topicStats(state);
  // only consider topics with some exposure, else the never-started ones
  const touched = stats.filter((s) => s.seen > 0);
  const pool = touched.length >= n ? touched : stats;
  return [...pool].sort((a, b) => a.strength - b.strength).slice(0, n);
}

export function recentAccuracy(state: AppState, windowN = 40): number {
  const all = Object.values(state.progress)
    .flatMap((p) => p.history.map((h) => ({ ...h })))
    .sort((a, b) => a.at - b.at);
  const recent = all.slice(-windowN);
  if (!recent.length) return 0;
  return recent.filter((h) => h.correct).length / recent.length;
}

/** Predicted exam score: strength over the 74 exam questions, blended with recent accuracy. */
export function predictedExamPct(state: AppState): number {
  let sum = 0;
  let touched = 0;
  for (const q of EXAM_QUESTIONS) {
    const p = prog(state, q.id);
    sum += masteryStrength(p);
    if (p && p.seen > 0) touched++;
  }
  const base = (sum / EXAM_QUESTIONS.length) * 100;
  // if barely touched, keep the estimate conservative
  const coverage = touched / EXAM_QUESTIONS.length;
  return Math.round(base * (0.5 + 0.5 * coverage));
}

export function readiness(state: AppState): Readiness {
  const now = Date.now();
  const examScorePct = predictedExamPct(state);
  const masteredAll = QUESTIONS.filter((q) => prog(state, q.id)?.mastered).length;
  const seenAll = QUESTIONS.filter((q) => (prog(state, q.id)?.seen ?? 0) > 0).length;
  const dueCount = QUESTIONS.filter((q) => isDue(prog(state, q.id), now)).length;
  const neverSeen = QUESTIONS.length - seenAll;
  const repeatedErrors = QUESTIONS.filter((q) => (prog(state, q.id)?.incorrect ?? 0) >= 2).length;
  const dangerous = QUESTIONS.filter((q) =>
    prog(state, q.id)?.history.some((h) => h.dangerous),
  ).length;
  const recAcc = recentAccuracy(state);

  const masteryPct = Math.round((masteredAll / QUESTIONS.length) * 100);
  const seenPct = Math.round((seenAll / QUESTIONS.length) * 100);

  const reasons: string[] = [];
  let ready: Readiness["state"] = "ready";

  if (seenPct < 90) {
    reasons.push(`${neverSeen} questions not yet attempted`);
    ready = "not-ready";
  }
  if (examScorePct < 85) {
    reasons.push(`Predicted exam score ${examScorePct}% is below the 85% target`);
    if (ready !== "not-ready") ready = examScorePct < 70 ? "not-ready" : "almost";
    else if (examScorePct < 70) ready = "not-ready";
  }
  if (dangerous > 4) {
    reasons.push(`${dangerous} "dangerous confidence" errors (wrong while sure)`);
    if (ready === "ready") ready = "almost";
  }
  if (repeatedErrors > 6) {
    reasons.push(`${repeatedErrors} questions missed 2+ times`);
    if (ready === "ready") ready = "almost";
  }
  if (masteryPct < 60 && ready === "ready") {
    reasons.push(`Only ${masteryPct}% of the bank is fully mastered`);
    ready = "almost";
  }

  if (ready === "ready" && reasons.length === 0) {
    reasons.push("Broad coverage, high predicted score, and few dangerous errors");
  }

  return {
    examScorePct,
    masteryPct,
    seenPct,
    recentAccuracy: recAcc,
    dueCount,
    neverSeen,
    repeatedErrors,
    dangerous,
    state: ready,
    reasons,
  };
}

// ── Queue building ───────────────────────────────────────────────────────────
export type BankFilter =
  | "all"
  | "abd"
  | "tx"
  | "exam"
  | "due"
  | "missed"
  | "never"
  | "low-confidence"
  | "flagged"
  | "mastered"
  | "unmastered"
  | { topic: TopicId };

export function questionsForFilter(state: AppState, filter: BankFilter): Question[] {
  const now = Date.now();
  if (typeof filter === "object") return QUESTIONS.filter((q) => q.topic === filter.topic);
  switch (filter) {
    case "all":
      return QUESTIONS.slice();
    case "abd":
      return ABD_QUESTIONS.slice();
    case "tx":
      return TX_QUESTIONS.slice();
    case "exam":
      return EXAM_QUESTIONS.slice();
    case "due":
      return QUESTIONS.filter((q) => isDue(prog(state, q.id), now));
    case "missed":
      return QUESTIONS.filter((q) => (prog(state, q.id)?.incorrect ?? 0) > 0);
    case "never":
      return QUESTIONS.filter((q) => (prog(state, q.id)?.seen ?? 0) === 0);
    case "low-confidence":
      return QUESTIONS.filter((q) => {
        const p = prog(state, q.id);
        return (
          p && p.lastConfidence && (p.lastConfidence === "guess" || p.lastConfidence === "unsure")
        );
      });
    case "flagged":
      return QUESTIONS.filter((q) => state.flagged[q.id]);
    case "mastered":
      return QUESTIONS.filter((q) => prog(state, q.id)?.mastered);
    case "unmastered":
      return QUESTIONS.filter((q) => !prog(state, q.id)?.mastered);
  }
}

/** Priority score for a question in adaptive/weakness sessions (higher = show sooner). */
export function priority(state: AppState, q: Question, now: number): number {
  const p = prog(state, q.id);
  if (!p || p.seen === 0) return 55; // never seen: fairly high but below active misses
  let score = 0;
  if (isDue(p, now)) score += 40 + Math.min(30, (now - p.dueAt) / (60 * 60 * 1000)); // overdue boost
  if (p.lastResult === "incorrect") score += 45;
  if (p.history.some((h) => h.dangerous)) score += 25;
  if (p.lastConfidence === "guess" || p.lastConfidence === "unsure") score += 18;
  if (p.incorrect >= 2) score += 20;
  if (p.lastMs > 45000) score += 8; // took a long time
  score -= masteryStrength(p) * 30;
  return score;
}

/** Build an ordered study queue from a pool, most-needed first, with light shuffle. */
export function buildQueue(state: AppState, pool: Question[], limit?: number): Question[] {
  const now = Date.now();
  const scored = pool.map((q) => ({ q, s: priority(state, q, now) + Math.random() * 6 }));
  scored.sort((a, b) => b.s - a.s);
  const ordered = scored.map((x) => x.q);
  return limit ? ordered.slice(0, limit) : ordered;
}

/** The weakness pool: wrong, low-confidence, slow, dangerous, or not retained. */
export function weaknessPool(state: AppState): Question[] {
  const now = Date.now();
  return QUESTIONS.filter((q) => {
    const p = prog(state, q.id);
    if (!p || p.seen === 0) return false;
    return (
      p.lastResult === "incorrect" ||
      p.incorrect >= 1 ||
      p.lastConfidence === "guess" ||
      p.lastConfidence === "unsure" ||
      p.lastMs > 45000 ||
      p.history.some((h) => h.dangerous) ||
      (isDue(p, now) && !p.mastered)
    );
  });
}

export function mistakeList(state: AppState): { q: Question; p: QuestionProgress }[] {
  return QUESTIONS.filter((q) => (state.progress[q.id]?.incorrect ?? 0) > 0)
    .map((q) => ({ q, p: state.progress[q.id]! }))
    .sort((a, b) => {
      // most recent miss first
      const am = a.p.lastResult === "incorrect" ? 1 : 0;
      const bm = b.p.lastResult === "incorrect" ? 1 : 0;
      if (am !== bm) return bm - am;
      return b.p.lastSeenAt - a.p.lastSeenAt;
    });
}

export interface TypeStat {
  key: string;
  label: string;
  total: number;
  attempts: number;
  correct: number;
}

export function typeStats(state: AppState): TypeStat[] {
  const groups: Record<string, { label: string; qids: string[] }> = {
    "one-correct": { label: "Single correct", qids: [] },
    "multi-correct": { label: "Multiple correct", qids: [] },
    incorrect: { label: "Find the incorrect", qids: [] },
  };
  for (const q of QUESTIONS) {
    const key =
      q.polarity === "incorrect" ? "incorrect" : q.select > 1 ? "multi-correct" : "one-correct";
    groups[key].qids.push(q.id);
  }
  return Object.entries(groups).map(([key, g]) => {
    let attempts = 0;
    let correct = 0;
    for (const id of g.qids) {
      const p = state.progress[id];
      if (p) {
        attempts += p.seen;
        correct += p.correct;
      }
    }
    return { key, label: g.label, total: g.qids.length, attempts, correct };
  });
}

export function mostLikelyToMiss(state: AppState, n = 8): Question[] {
  const now = Date.now();
  return EXAM_QUESTIONS.map((q) => ({
    q,
    s: priority(state, q, now) - masteryStrength(prog(state, q.id)) * 10,
  }))
    .filter((x) => {
      const p = prog(state, x.q.id);
      return !p || !p.mastered;
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.q);
}

// ── Content integrity audit ──────────────────────────────────────────────────
export interface IntegrityReport {
  abdCount: number;
  txCount: number;
  total: number;
  examCount: number;
  duplicates: string[];
  missingAnswerType: string[];
  invalidKey: string[];
  everyExamMaps: boolean;
  flaggedQuestions: Question[];
  checks: { label: string; ok: boolean; detail: string }[];
}

export function integrityReport(): IntegrityReport {
  const abdCount = ABD_QUESTIONS.length;
  const txCount = TX_QUESTIONS.length;
  const total = QUESTIONS.length;
  const examCount = EXAM_QUESTIONS.length;

  // duplicate ids
  const seenIds = new Set<string>();
  const duplicates: string[] = [];
  for (const q of QUESTIONS) {
    if (seenIds.has(q.id)) duplicates.push(q.id);
    seenIds.add(q.id);
  }

  // duplicate stems (normalized)
  const stemMap = new Map<string, string>();
  for (const q of QUESTIONS) {
    const norm = q.stem.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (stemMap.has(norm)) duplicates.push(`${q.id}≈${stemMap.get(norm)}`);
    else stemMap.set(norm, q.id);
  }

  const missingAnswerType: string[] = [];
  const invalidKey: string[] = [];
  for (const q of QUESTIONS) {
    if (!q.polarity || !q.select || q.select < 1) missingAnswerType.push(q.id);
    const optionIds = new Set(q.options.map((o) => o.id));
    const keyOk =
      q.answer.length === q.select &&
      q.answer.every((a) => optionIds.has(a)) &&
      new Set(q.answer).size === q.answer.length;
    if (!keyOk) invalidKey.push(q.id);
  }

  // exam mapping: every examNo 1..74 present exactly once
  const examNos = EXAM_QUESTIONS.map((q) => q.examNo!).sort((a, b) => a - b);
  let everyExamMaps = examNos.length === 74;
  for (let i = 0; i < 74; i++) if (examNos[i] !== i + 1) everyExamMaps = false;

  const flaggedQuestions = QUESTIONS.filter((q) => q.flag);

  const checks = [
    { label: "Abdominal Surgery count = 146", ok: abdCount === 146, detail: `${abdCount}` },
    { label: "Blood Transfusion count = 10", ok: txCount === 10, detail: `${txCount}` },
    { label: "Total count = 156", ok: total === 156, detail: `${total}` },
    { label: "Final Exam replica count = 74", ok: examCount === 74, detail: `${examCount}` },
    {
      label: "No duplicate questions",
      ok: duplicates.length === 0,
      detail: duplicates.join(", ") || "none",
    },
    {
      label: "Every question has an answer type",
      ok: missingAnswerType.length === 0,
      detail: missingAnswerType.join(", ") || "all defined",
    },
    {
      label: "Every answer key is valid",
      ok: invalidKey.length === 0,
      detail: invalidKey.join(", ") || "all valid",
    },
    {
      label: "Exam Q1–74 each map to a source question",
      ok: everyExamMaps,
      detail: everyExamMaps ? "1–74 contiguous" : "gap detected",
    },
  ];

  return {
    abdCount,
    txCount,
    total,
    examCount,
    duplicates,
    missingAnswerType,
    invalidKey,
    everyExamMaps,
    flaggedQuestions,
    checks,
  };
}

export { QUESTION_BY_ID };
