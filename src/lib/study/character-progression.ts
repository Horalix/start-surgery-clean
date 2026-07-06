import type { AppState, CharacterCustomization, Profile } from "./types";

export interface Mission {
  key: string;
  label: string;
  progress: number; // 0..1
  progressLabel: string;
  complete: boolean;
}

export interface TierStatus {
  tier: 1 | 2 | 3;
  missionsForNext: Mission[];
  levelForNext: number | null;
  currentLevel: number;
  nextTier: 2 | 3 | null;
}

function masteredCount(state: AppState): number {
  let n = 0;
  for (const p of Object.values(state.progress)) if (p.mastered) n++;
  return n;
}

/**
 * Derive the current Angel/Devil ascension tier from the owner's live profile.
 * Tier II: Level 10 AND 5 battle wins.
 * Tier III: Level 20 AND 74/74 exam AND 100 questions mastered.
 * Any user can hold `angel`/`devil` in their JSON (server enforces who), but tier only
 * lights up for the owner whose stats qualify.
 */
export function computeTier(state: AppState): TierStatus {
  const profile: Profile = state.profile;
  const level = deriveLevel(profile.xp);
  const wins = profile.battlesWon;
  const bestExam = profile.bestExamScore ?? 0;
  const mastered = masteredCount(state);

  const tier2Ok = level >= 10 && wins >= 5;
  const tier3Ok = level >= 20 && bestExam >= 74 && mastered >= 100;

  let tier: 1 | 2 | 3 = 1;
  if (tier3Ok) tier = 3;
  else if (tier2Ok) tier = 2;

  const nextTier: 2 | 3 | null = tier === 1 ? 2 : tier === 2 ? 3 : null;
  const missionsForNext: Mission[] = [];
  let levelForNext: number | null = null;

  if (nextTier === 2) {
    levelForNext = 10;
    missionsForNext.push({
      key: "wins5",
      label: "Win 5 battles",
      progress: Math.min(1, wins / 5),
      progressLabel: `${Math.min(wins, 5)}/5`,
      complete: wins >= 5,
    });
  } else if (nextTier === 3) {
    levelForNext = 20;
    missionsForNext.push({
      key: "exam74",
      label: "Score 74/74 on Exam",
      progress: Math.min(1, bestExam / 74),
      progressLabel: `${bestExam}/74`,
      complete: bestExam >= 74,
    });
    missionsForNext.push({
      key: "master100",
      label: "Master 100 questions",
      progress: Math.min(1, mastered / 100),
      progressLabel: `${Math.min(mastered, 100)}/100`,
      complete: mastered >= 100,
    });
  }

  return { tier, missionsForNext, levelForNext, currentLevel: level, nextTier };
}

/** Small helper duplicating levelForXp to avoid circular import in future consumers. */
function deriveLevel(xp: number): number {
  if (xp <= 0) return 1;
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 20)) / 2));
}

/** Apply the derived tier onto a character object, keeping other fields intact. */
export function withDerivedTier(
  character: CharacterCustomization | undefined,
  state: AppState,
): CharacterCustomization | undefined {
  if (!character?.special) return character;
  if (character.special !== "angel" && character.special !== "devil") return character;
  const { tier } = computeTier(state);
  return { ...character, tier };
}
