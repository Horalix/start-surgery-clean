export interface CompanionStage {
  index: number;
  name: string;
  title: string;
  minLevel: number;
  palette: {
    skin: string;
    scrub: string;
    scrubDark: string;
    hair: string;
    accent: string;
  };
  props: { cap: boolean; mask: boolean; glasses: boolean; badge: boolean; loupe: boolean };
}

export type CompanionMood = "idle" | "happy" | "sad" | "thinking";

/**
 * Quadratic XP curve. Cumulative XP required to reach a level:
 *   xpForLevel(n) = 80 * n * (n - 1)
 * L2=160, L3=480, L5=1600, L10=7200, L15=16800, L20=30400, L28=60480
 * Each level costs 160 * (n - 1) more XP than the previous, so climbing feels earned.
 */
export function xpForLevel(n: number): number {
  if (n <= 1) return 0;
  return 80 * n * (n - 1);
}

export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  // Solve 80 * n * (n - 1) <= xp for n.
  // n = floor((1 + sqrt(1 + xp/20)) / 2)
  const n = Math.floor((1 + Math.sqrt(1 + xp / 20)) / 2);
  return Math.max(1, n);
}

export function levelProgress(xp: number): {
  level: number;
  into: number;
  need: number;
  pct: number;
} {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const need = ceil - floor;
  const into = xp - floor;
  return { level, into, need, pct: Math.max(0, Math.min(100, Math.round((into / need) * 100))) };
}

export const STAGES: CompanionStage[] = [
  {
    index: 0,
    name: "Sprout",
    title: "Pre-Med Sprout",
    minLevel: 1,
    palette: {
      skin: "#f0c9a4",
      scrub: "#8fd3c6",
      scrubDark: "#5cb3a4",
      hair: "#7a4a2b",
      accent: "#2bb3a3",
    },
    props: { cap: false, mask: false, glasses: false, badge: false, loupe: false },
  },
  {
    index: 1,
    name: "Intern",
    title: "Surgical Intern",
    minLevel: 4,
    palette: {
      skin: "#f0c9a4",
      scrub: "#6fc3e6",
      scrubDark: "#3f9dc7",
      hair: "#5a3720",
      accent: "#2b8fd8",
    },
    props: { cap: true, mask: false, glasses: false, badge: false, loupe: false },
  },
  {
    index: 2,
    name: "Resident",
    title: "Resident",
    minLevel: 8,
    palette: {
      skin: "#e9bd97",
      scrub: "#5aa9f2",
      scrubDark: "#3573c9",
      hair: "#3f2717",
      accent: "#2f6fe0",
    },
    props: { cap: true, mask: true, glasses: false, badge: true, loupe: false },
  },
  {
    index: 3,
    name: "Chief",
    title: "Chief Resident",
    minLevel: 13,
    palette: {
      skin: "#e9bd97",
      scrub: "#3f7ff0",
      scrubDark: "#2a56c8",
      hair: "#2c1a10",
      accent: "#6b8cff",
    },
    props: { cap: true, mask: true, glasses: true, badge: true, loupe: false },
  },
  {
    index: 4,
    name: "Attending",
    title: "Attending Surgeon",
    minLevel: 19,
    palette: {
      skin: "#e3b48c",
      scrub: "#3457d5",
      scrubDark: "#22399e",
      hair: "#241209",
      accent: "#8aa0ff",
    },
    props: { cap: true, mask: true, glasses: true, badge: true, loupe: true },
  },
  {
    index: 5,
    name: "Professor",
    title: "Professor of Surgery",
    minLevel: 28,
    palette: {
      skin: "#e3b48c",
      scrub: "#2d2f8f",
      scrubDark: "#1d1e63",
      hair: "#cfcfd6",
      accent: "#ffd45e",
    },
    props: { cap: true, mask: true, glasses: true, badge: true, loupe: true },
  },
];

export function stageForLevel(level: number): CompanionStage {
  let s = STAGES[0];
  for (const stage of STAGES) if (level >= stage.minLevel) s = stage;
  return s;
}

export function nextStage(level: number): CompanionStage | null {
  for (const stage of STAGES) if (level < stage.minLevel) return stage;
  return null;
}
