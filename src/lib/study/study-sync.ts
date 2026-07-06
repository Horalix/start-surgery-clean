/**
 * Study leaderboard sync.
 *
 * Pushes each signed-in player's *studying* progress (XP, level, questions
 * mastered, accuracy, best exam) up to the shared `profiles` row so the
 * Leaderboard can rank people on plain studying — not only battles.
 *
 * Best-effort and debounced. If the extra profile columns don't exist yet,
 * the upsert simply fails silently until the SQL in the setup notes is run.
 */
import { supabase } from "@/integrations/supabase/client";
import { QUESTIONS } from "@/data/questions";
import { getState, subscribe } from "./store";
import { levelForXp } from "./companion";
import type { AppState } from "./types";

const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

let inited = false;
let userId: string | null = null;
let displayName = "Player";
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastSignature = "";

export interface StudyStats {
  xp: number;
  level: number;
  mastered: number;
  seen: number;
  attempts: number;
  correct: number;
  accuracyPct: number;
  bestExam: number;
}

export function computeStudyStats(state: AppState): StudyStats {
  let mastered = 0;
  let seen = 0;
  let attempts = 0;
  let correct = 0;
  for (const q of QUESTIONS) {
    const p = state.progress[q.id];
    if (!p || p.seen === 0) continue;
    seen++;
    attempts += p.seen;
    correct += p.correct;
    if (p.mastered) mastered++;
  }
  const xp = state.profile.xp;
  return {
    xp,
    level: levelForXp(xp),
    mastered,
    seen,
    attempts,
    correct,
    accuracyPct: attempts ? Math.round((correct / attempts) * 100) : 0,
    bestExam: state.profile.bestExamScore ?? 0,
  };
}

/** A single "study score" used to rank the study leaderboard. */
export function studyScore(s: StudyStats): number {
  // Mastery is worth the most, then XP, then accuracy, then best exam.
  return s.mastered * 1000 + s.xp + s.accuracyPct * 20 + s.bestExam * 40;
}

async function pushNow() {
  if (!userId) return;
  const stats = computeStudyStats(getState());
  const character = getState().character ?? null;
  try {
    await db.from("profiles").upsert(
      {
        user_id: userId,
        display_name: displayName,
        character: character as never,
        xp: stats.xp,
        study_level: stats.level,
        mastered_count: stats.mastered,
        seen_count: stats.seen,
        study_accuracy: stats.accuracyPct,
        study_score: studyScore(stats),
        best_exam_score: stats.bestExam,
        study_updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );
  } catch {
    /* columns may not exist yet — ignore */
  }
}

function schedulePush() {
  const stats = computeStudyStats(getState());
  const sig = `${stats.xp}|${stats.mastered}|${stats.accuracyPct}|${stats.bestExam}`;
  if (sig === lastSignature) return;
  lastSignature = sig;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1200);
}

export function initStudySync() {
  if (inited || typeof window === "undefined") return;
  inited = true;

  const resolveUser = (user: { id: string; email?: string; user_metadata?: unknown } | null) => {
    if (!user) {
      userId = null;
      return;
    }
    userId = user.id;
    const meta = (user.user_metadata ?? {}) as { display_name?: string; full_name?: string };
    displayName = meta.display_name || meta.full_name || user.email?.split("@")[0] || "Player";
    // push an initial snapshot on login
    lastSignature = "";
    schedulePush();
  };

  supabase.auth.getUser().then(({ data }) => resolveUser(data.user ?? null));
  supabase.auth.onAuthStateChange((_e, session) => resolveUser(session?.user ?? null));

  // push whenever study progress changes
  subscribe(schedulePush);
}
