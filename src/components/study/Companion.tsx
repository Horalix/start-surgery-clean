import { useMemo } from "react";
import { stageForLevel, type CompanionMood } from "@/lib/study/companion";
import type { CharacterCustomization } from "@/lib/study/types";
import { cn } from "@/lib/utils";

interface Px {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
}

const OUTLINE = "#141c2b";
const MASK = "#eef3f8";
const EYE = "#20293b";

function buildPixels(level: number, mood: CompanionMood, character?: CharacterCustomization): Px[] {
  const st = stageForLevel(level);
  const p = { ...st.palette, ...(character?.palette ?? {}) };
  const props = { ...st.props, ...(character?.props ?? {}) };
  const px: Px[] = [];
  const add = (x: number, y: number, w: number, h: number, c: string) => px.push({ x, y, w, h, c });

  // Body / scrubs
  add(4, 8, 8, 7, p.scrub);
  add(4, 8, 1, 7, p.scrubDark);
  add(11, 8, 1, 7, p.scrubDark);
  add(6, 8, 4, 1, p.scrubDark);
  add(7, 9, 2, 1, p.scrubDark);
  add(3, 9, 1, 4, p.scrub);
  add(12, 9, 1, 4, p.scrub);
  add(3, 13, 1, 1, p.skin);
  add(12, 13, 1, 1, p.skin);
  add(5, 15, 2, 1, p.scrubDark);
  add(9, 15, 2, 1, p.scrubDark);

  if (props.badge) add(9, 10, 1, 1, p.accent);

  // Neck + head
  add(7, 7, 2, 1, p.skin);
  add(5, 3, 6, 5, p.skin);
  add(4, 4, 1, 3, p.skin);
  add(11, 4, 1, 3, p.skin);

  if (props.cap) {
    add(4, 1, 8, 2, p.scrub);
    add(4, 3, 8, 1, p.scrubDark);
    add(3, 2, 1, 1, p.scrubDark);
    add(12, 2, 1, 1, p.scrubDark);
    add(4, 1, 8, 1, MASK);
  } else {
    add(4, 2, 8, 2, p.hair);
    add(4, 3, 1, 2, p.hair);
    add(11, 3, 1, 2, p.hair);
    add(5, 2, 6, 1, p.hair);
  }

  const eyeY = mood === "sad" ? 5 : mood === "thinking" ? 4 : 4;
  if (mood === "happy") {
    add(6, 5, 1, 1, EYE);
    add(9, 5, 1, 1, EYE);
    add(5, 6, 1, 1, p.accent);
    add(10, 6, 1, 1, p.accent);
  } else if (mood === "sad") {
    add(6, 5, 1, 1, EYE);
    add(9, 5, 1, 1, EYE);
    add(6, 4, 1, 1, p.skin);
  } else {
    add(6, eyeY, 1, 1, EYE);
    add(9, eyeY, 1, 1, EYE);
  }

  if (props.glasses) {
    add(5, 4, 2, 1, OUTLINE);
    add(9, 4, 2, 1, OUTLINE);
    add(8, 4, 1, 1, OUTLINE);
    if (props.loupe) add(9, 4, 1, 1, p.accent);
  }

  if (props.mask) {
    add(5, 6, 6, 2, MASK);
    add(4, 6, 1, 1, MASK);
    add(11, 6, 1, 1, MASK);
    add(5, 7, 6, 1, "#dfe7ef");
  } else {
    if (mood === "happy") {
      add(6, 6, 4, 1, "#b45c52");
      add(7, 7, 2, 1, "#b45c52");
    } else if (mood === "sad") {
      add(7, 7, 2, 1, "#b45c52");
      add(6, 8, 1, 1, "#b45c52");
      add(9, 8, 1, 1, "#b45c52");
    } else {
      add(7, 6, 2, 1, "#b45c52");
    }
  }

  return px;
}

// ─── ANGEL: Celestial Healer ───────────────────────────────────────────────
function buildAngel(mood: CompanionMood): Px[] {
  const px: Px[] = [];
  const add = (x: number, y: number, w: number, h: number, c: string) => px.push({ x, y, w, h, c });

  const SKIN = "#ffe6cc";
  const SKIN_S = "#e9c9a7";
  const HAIR = "#f6d874";
  const HAIR_L = "#fff2b0";
  const ROBE = "#ffffff";
  const ROBE_S = "#e6ecf5";
  const GOLD = "#f2c94c";
  const GOLD_D = "#b8860b";
  const GOLD_L = "#fff2a8";
  const HALO = "#fff29a";
  const LIP = "#c97a7a";

  // Wings — layered feathers (outer to inner)
  // Left wing
  add(-1, 6, 1, 5, GOLD_L);
  add(0, 5, 1, 7, ROBE_S);
  add(1, 4, 1, 9, ROBE);
  add(2, 5, 1, 8, ROBE_S);
  add(3, 7, 1, 5, ROBE);
  // wing tip highlight
  add(1, 4, 1, 1, GOLD_L);
  add(0, 5, 1, 1, GOLD);
  // feather lines
  add(1, 6, 1, 1, GOLD_L);
  add(1, 8, 1, 1, GOLD_L);
  add(1, 10, 1, 1, GOLD_L);
  add(2, 7, 1, 1, GOLD_L);
  add(2, 9, 1, 1, GOLD_L);
  add(2, 11, 1, 1, GOLD_L);

  // Right wing (mirror)
  add(16, 6, 1, 5, GOLD_L);
  add(15, 5, 1, 7, ROBE_S);
  add(14, 4, 1, 9, ROBE);
  add(13, 5, 1, 8, ROBE_S);
  add(12, 7, 1, 5, ROBE);
  add(14, 4, 1, 1, GOLD_L);
  add(15, 5, 1, 1, GOLD);
  add(14, 6, 1, 1, GOLD_L);
  add(14, 8, 1, 1, GOLD_L);
  add(14, 10, 1, 1, GOLD_L);
  add(13, 7, 1, 1, GOLD_L);
  add(13, 9, 1, 1, GOLD_L);
  add(13, 11, 1, 1, GOLD_L);

  // Robe body (flowing, wider at bottom)
  add(4, 8, 8, 7, ROBE);
  add(4, 8, 1, 7, ROBE_S);
  add(11, 8, 1, 7, ROBE_S);
  // gold sash across chest
  add(4, 10, 8, 1, GOLD);
  add(4, 11, 8, 1, GOLD_D);
  // gemstone clasp
  add(7, 10, 2, 1, GOLD_L);
  add(7, 11, 2, 1, "#7ec8f5");
  // v-neck
  add(6, 8, 4, 1, ROBE_S);
  add(7, 9, 2, 1, SKIN);
  // sleeves flare
  add(3, 9, 1, 5, ROBE);
  add(12, 9, 1, 5, ROBE);
  add(2, 12, 1, 2, ROBE_S);
  add(13, 12, 1, 2, ROBE_S);
  // hands
  add(3, 13, 1, 1, SKIN);
  add(12, 13, 1, 1, SKIN);
  // hem
  add(3, 15, 10, 1, ROBE_S);
  add(4, 16, 8, 1, GOLD);

  // Neck & head
  add(7, 7, 2, 1, SKIN);
  add(5, 3, 6, 5, SKIN);
  add(4, 4, 1, 3, SKIN);
  add(11, 4, 1, 3, SKIN);
  // face shading
  add(5, 7, 1, 1, SKIN_S);
  add(10, 7, 1, 1, SKIN_S);

  // Hair — soft blonde with a middle part
  add(4, 2, 8, 2, HAIR);
  add(4, 3, 1, 2, HAIR);
  add(11, 3, 1, 2, HAIR);
  add(5, 2, 6, 1, HAIR_L);
  add(7, 3, 2, 1, HAIR_L);
  // gentle curls
  add(3, 4, 1, 1, HAIR);
  add(12, 4, 1, 1, HAIR);

  // Halo — floating ring above head
  add(4, 0, 8, 1, HALO);
  add(3, 1, 1, 1, GOLD);
  add(12, 1, 1, 1, GOLD);
  add(5, 0, 6, 1, GOLD_L);
  add(4, 1, 8, 1, "#00000000"); // spacer
  // halo inner glow
  add(6, 1, 4, 1, HALO);

  // Eyes — gentle blue
  const eyeC = "#3b6fb0";
  if (mood === "happy") {
    add(6, 5, 1, 1, eyeC);
    add(9, 5, 1, 1, eyeC);
    add(5, 6, 1, 1, "#f5b6b6");
    add(10, 6, 1, 1, "#f5b6b6");
  } else {
    add(6, 5, 1, 1, eyeC);
    add(9, 5, 1, 1, eyeC);
  }
  // eye sparkle
  add(6, 4, 1, 1, "#ffffff");
  add(9, 4, 1, 1, "#ffffff");

  // Mouth — calm smile
  add(7, 6, 2, 1, LIP);

  return px;
}

// ─── DEVIL: Shadow Surgeon ─────────────────────────────────────────────────
function buildDevil(mood: CompanionMood): Px[] {
  const px: Px[] = [];
  const add = (x: number, y: number, w: number, h: number, c: string) => px.push({ x, y, w, h, c });

  const SKIN = "#c98a7a";
  const SKIN_S = "#8f5b52";
  const ROBE = "#2b0f14";
  const ROBE_L = "#4a1520";
  const CRIMSON = "#c9302c";
  const CRIMSON_D = "#7a1a1a";
  const CRIMSON_L = "#ff6b5c";
  const BLACK = "#0d0608";
  const HORN = "#3a1a1a";
  const HORN_L = "#7a2a2a";
  const EYE_GLOW = "#ff2a2a";
  const GOLD = "#c9a24a";

  // Bat wings — black with crimson membrane
  // Left wing
  add(-1, 5, 1, 2, BLACK);
  add(0, 4, 1, 4, BLACK);
  add(1, 5, 1, 6, CRIMSON_D);
  add(2, 6, 1, 6, CRIMSON_D);
  add(3, 7, 1, 5, CRIMSON_D);
  // spikes / bone
  add(0, 4, 1, 1, HORN);
  add(1, 5, 1, 1, BLACK);
  add(1, 8, 1, 1, BLACK);
  add(1, 10, 1, 1, BLACK);
  add(2, 12, 1, 1, BLACK);
  // membrane highlight
  add(2, 7, 1, 1, CRIMSON);
  add(3, 9, 1, 1, CRIMSON);

  // Right wing
  add(16, 5, 1, 2, BLACK);
  add(15, 4, 1, 4, BLACK);
  add(14, 5, 1, 6, CRIMSON_D);
  add(13, 6, 1, 6, CRIMSON_D);
  add(12, 7, 1, 5, CRIMSON_D);
  add(15, 4, 1, 1, HORN);
  add(14, 5, 1, 1, BLACK);
  add(14, 8, 1, 1, BLACK);
  add(14, 10, 1, 1, BLACK);
  add(13, 12, 1, 1, BLACK);
  add(13, 7, 1, 1, CRIMSON);
  add(12, 9, 1, 1, CRIMSON);

  // Hooded robe body
  add(4, 8, 8, 7, ROBE);
  add(4, 8, 1, 7, BLACK);
  add(11, 8, 1, 7, BLACK);
  // jagged trim
  add(3, 15, 1, 1, ROBE);
  add(4, 16, 1, 1, ROBE);
  add(6, 16, 1, 1, ROBE);
  add(8, 16, 1, 1, ROBE);
  add(10, 16, 1, 1, ROBE);
  add(12, 15, 1, 1, ROBE);
  // crimson trim on chest
  add(6, 8, 4, 1, CRIMSON_D);
  add(7, 9, 2, 1, CRIMSON);
  // gold clasp
  add(7, 10, 2, 1, GOLD);
  add(7, 11, 2, 1, CRIMSON_D);
  // sleeves
  add(3, 9, 1, 4, ROBE);
  add(12, 9, 1, 4, ROBE);
  add(3, 13, 1, 1, SKIN);
  add(12, 13, 1, 1, SKIN);

  // Hood over head sides
  add(3, 3, 1, 5, ROBE);
  add(12, 3, 1, 5, ROBE);
  add(4, 2, 8, 1, ROBE);
  add(4, 3, 1, 1, BLACK);
  add(11, 3, 1, 1, BLACK);

  // Neck & head (in shadow)
  add(7, 7, 2, 1, SKIN);
  add(5, 3, 6, 5, SKIN);
  add(4, 4, 1, 3, SKIN);
  add(11, 4, 1, 3, SKIN);
  // face shadow from hood
  add(5, 3, 6, 1, SKIN_S);
  add(5, 7, 1, 1, SKIN_S);
  add(10, 7, 1, 1, SKIN_S);
  add(4, 4, 1, 1, SKIN_S);
  add(11, 4, 1, 1, SKIN_S);

  // Curled ram horns
  add(4, 1, 1, 2, HORN);
  add(3, 0, 1, 1, HORN);
  add(4, 0, 1, 1, HORN_L);
  add(5, 1, 1, 1, HORN_L);
  add(11, 1, 1, 2, HORN);
  add(12, 0, 1, 1, HORN);
  add(11, 0, 1, 1, HORN_L);
  add(10, 1, 1, 1, HORN_L);
  // horn tips glow
  add(3, 0, 1, 1, CRIMSON_D);
  add(12, 0, 1, 1, CRIMSON_D);

  // Pointed ears
  add(4, 5, 1, 1, SKIN);
  add(11, 5, 1, 1, SKIN);

  // Glowing red eyes
  add(6, 5, 1, 1, EYE_GLOW);
  add(9, 5, 1, 1, EYE_GLOW);
  add(6, 4, 1, 1, CRIMSON_L);
  add(9, 4, 1, 1, CRIMSON_L);

  // Menacing smirk
  if (mood === "sad") {
    add(7, 7, 2, 1, BLACK);
  } else {
    add(6, 6, 3, 1, BLACK);
    add(9, 7, 1, 1, BLACK);
  }
  // fangs
  add(6, 7, 1, 1, "#f5e5c0");
  add(8, 7, 1, 1, "#f5e5c0");

  // Trident — held by right hand
  add(13, 8, 1, 1, GOLD); // left prong
  add(15, 8, 1, 1, GOLD); // right prong
  add(14, 8, 1, 1, CRIMSON_L); // middle prong glow
  add(14, 7, 1, 1, GOLD);
  add(14, 9, 1, 5, "#5a3a1a"); // shaft
  add(14, 14, 1, 1, GOLD);

  // Tail with pointed tip
  add(12, 15, 1, 1, ROBE_L);
  add(13, 15, 1, 1, ROBE_L);
  add(13, 16, 1, 1, CRIMSON);
  add(14, 16, 1, 1, CRIMSON_L);

  return px;
}

// ─── PHOENIX: Reborn Flame ─────────────────────────────────────────────────
function buildPhoenix(mood: CompanionMood): Px[] {
  const px: Px[] = [];
  const add = (x: number, y: number, w: number, h: number, c: string) => px.push({ x, y, w, h, c });

  const SKIN = "#ffd6a5";
  const SKIN_S = "#c98a5a";
  const FIRE_D = "#7a1500";
  const FIRE = "#e63900";
  const FIRE_L = "#ff7a1a";
  const EMBER = "#ffd23a";
  const WHITE_HOT = "#fff2a8";
  const ROBE = "#2a0a0a";
  const GOLD = "#ffb800";

  // Flame wings — feathered fire spreading out
  // Left
  add(-1, 6, 1, 2, FIRE_D);
  add(0, 5, 1, 5, FIRE_D);
  add(1, 4, 1, 8, FIRE);
  add(2, 5, 1, 8, FIRE_L);
  add(3, 7, 1, 5, EMBER);
  // flame tips
  add(0, 4, 1, 1, EMBER);
  add(1, 3, 1, 1, WHITE_HOT);
  add(1, 12, 1, 1, EMBER);
  add(2, 4, 1, 1, WHITE_HOT);
  add(3, 6, 1, 1, WHITE_HOT);
  add(3, 12, 1, 1, EMBER);
  // Right
  add(16, 6, 1, 2, FIRE_D);
  add(15, 5, 1, 5, FIRE_D);
  add(14, 4, 1, 8, FIRE);
  add(13, 5, 1, 8, FIRE_L);
  add(12, 7, 1, 5, EMBER);
  add(15, 4, 1, 1, EMBER);
  add(14, 3, 1, 1, WHITE_HOT);
  add(14, 12, 1, 1, EMBER);
  add(13, 4, 1, 1, WHITE_HOT);
  add(12, 6, 1, 1, WHITE_HOT);
  add(12, 12, 1, 1, EMBER);

  // Body — dark under-robe with flame gradient
  add(4, 8, 8, 7, ROBE);
  add(4, 8, 1, 7, "#180505");
  add(11, 8, 1, 7, "#180505");
  // fire trim
  add(4, 8, 8, 1, FIRE_D);
  add(5, 9, 6, 1, FIRE);
  add(6, 10, 4, 1, FIRE_L);
  // molten sash
  add(4, 12, 8, 1, FIRE_D);
  add(4, 13, 8, 1, FIRE);
  add(5, 14, 6, 1, EMBER);
  // sleeves w/ flame cuffs
  add(3, 9, 1, 4, ROBE);
  add(12, 9, 1, 4, ROBE);
  add(3, 12, 1, 1, FIRE);
  add(12, 12, 1, 1, FIRE);
  add(3, 13, 1, 1, SKIN);
  add(12, 13, 1, 1, SKIN);
  // hem
  add(4, 15, 8, 1, FIRE_D);
  add(4, 16, 1, 1, FIRE);
  add(6, 16, 1, 1, FIRE);
  add(8, 16, 1, 1, FIRE);
  add(10, 16, 1, 1, FIRE);
  add(11, 16, 1, 1, FIRE);

  // Neck & head
  add(7, 7, 2, 1, SKIN);
  add(5, 3, 6, 5, SKIN);
  add(4, 4, 1, 3, SKIN);
  add(11, 4, 1, 3, SKIN);
  add(5, 7, 1, 1, SKIN_S);
  add(10, 7, 1, 1, SKIN_S);

  // Fire crown
  add(4, 2, 8, 1, FIRE_D);
  add(4, 1, 1, 1, FIRE);
  add(6, 0, 1, 2, FIRE);
  add(8, 0, 1, 2, EMBER);
  add(10, 0, 1, 2, FIRE);
  add(11, 1, 1, 1, FIRE);
  add(5, 1, 1, 1, EMBER);
  add(9, 1, 1, 1, WHITE_HOT);
  add(7, 1, 1, 1, WHITE_HOT);
  // crown gem
  add(7, 2, 2, 1, GOLD);

  // Blazing eyes
  add(6, 5, 1, 1, EMBER);
  add(9, 5, 1, 1, EMBER);
  add(6, 4, 1, 1, WHITE_HOT);
  add(9, 4, 1, 1, WHITE_HOT);

  // Confident smirk
  if (mood === "sad") add(7, 7, 2, 1, "#7a1500");
  else add(6, 6, 4, 1, "#7a1500");

  return px;
}

// ─── VOID: Cosmic Wanderer ─────────────────────────────────────────────────
function buildVoid(mood: CompanionMood): Px[] {
  const px: Px[] = [];
  const add = (x: number, y: number, w: number, h: number, c: string) => px.push({ x, y, w, h, c });

  const SKIN = "#a68eb8";
  const SKIN_S = "#5f3f7a";
  const ROBE = "#0a0518";
  const ROBE_L = "#1a0f3d";
  const PURPLE = "#5b2ea8";
  const PURPLE_L = "#8b5cf6";
  const MAGENTA = "#c026d3";
  const CYAN = "#22d3ee";
  const STAR = "#ffffff";
  const GOLD = "#e0a63a";

  // Nebula cloak — cosmic gradient wings
  // Left
  add(0, 4, 1, 9, ROBE_L);
  add(1, 3, 1, 11, PURPLE);
  add(2, 5, 1, 10, PURPLE_L);
  add(3, 7, 1, 6, MAGENTA);
  // stars
  add(0, 5, 1, 1, STAR);
  add(1, 8, 1, 1, STAR);
  add(2, 6, 1, 1, CYAN);
  add(2, 11, 1, 1, STAR);
  add(0, 10, 1, 1, CYAN);
  // Right
  add(16, 4, 1, 9, ROBE_L);
  add(15, 3, 1, 11, PURPLE);
  add(14, 5, 1, 10, PURPLE_L);
  add(13, 7, 1, 6, MAGENTA);
  add(16, 5, 1, 1, STAR);
  add(15, 8, 1, 1, STAR);
  add(14, 6, 1, 1, CYAN);
  add(14, 11, 1, 1, STAR);
  add(16, 10, 1, 1, CYAN);

  // Robe body — cosmic dark
  add(4, 8, 8, 7, ROBE);
  add(4, 8, 1, 7, "#000000");
  add(11, 8, 1, 7, "#000000");
  // constellation trim
  add(6, 8, 4, 1, PURPLE);
  add(7, 9, 2, 1, PURPLE_L);
  // portal medallion
  add(7, 10, 2, 2, CYAN);
  add(7, 10, 1, 1, PURPLE_L);
  add(8, 11, 1, 1, MAGENTA);
  // sash
  add(4, 13, 8, 1, PURPLE);
  add(5, 14, 6, 1, MAGENTA);
  // sleeves
  add(3, 9, 1, 4, ROBE);
  add(12, 9, 1, 4, ROBE);
  add(3, 13, 1, 1, SKIN);
  add(12, 13, 1, 1, SKIN);
  // stars on robe
  add(5, 11, 1, 1, STAR);
  add(10, 12, 1, 1, STAR);
  add(6, 14, 1, 1, CYAN);
  add(9, 11, 1, 1, STAR);
  // hem
  add(4, 15, 8, 1, ROBE_L);
  add(4, 16, 8, 1, PURPLE);

  // Neck & head
  add(7, 7, 2, 1, SKIN);
  add(5, 3, 6, 5, SKIN);
  add(4, 4, 1, 3, SKIN);
  add(11, 4, 1, 3, SKIN);
  add(5, 7, 1, 1, SKIN_S);
  add(10, 7, 1, 1, SKIN_S);
  add(5, 3, 6, 1, SKIN_S);

  // Cosmic hood
  add(3, 3, 1, 5, ROBE);
  add(12, 3, 1, 5, ROBE);
  add(4, 2, 8, 1, ROBE);
  add(3, 3, 1, 1, PURPLE);
  add(12, 3, 1, 1, PURPLE);

  // Astral crown — floating stars
  add(4, 0, 1, 1, STAR);
  add(6, 0, 1, 1, CYAN);
  add(8, 0, 1, 1, MAGENTA);
  add(10, 0, 1, 1, CYAN);
  add(11, 0, 1, 1, STAR);
  add(7, 1, 1, 1, GOLD);
  add(9, 1, 1, 1, GOLD);

  // Glowing cyan eyes
  add(6, 5, 1, 1, CYAN);
  add(9, 5, 1, 1, CYAN);
  add(6, 4, 1, 1, PURPLE_L);
  add(9, 4, 1, 1, PURPLE_L);

  // Serene mouth
  if (mood === "sad") add(7, 7, 2, 1, PURPLE);
  else add(7, 6, 2, 1, PURPLE_L);

  return px;
}

// ─── TITAN: Golden Warrior ─────────────────────────────────────────────────
function buildTitan(mood: CompanionMood): Px[] {
  const px: Px[] = [];
  const add = (x: number, y: number, w: number, h: number, c: string) => px.push({ x, y, w, h, c });

  const SKIN = "#f0c9a4";
  const SKIN_S = "#b78862";
  const GOLD = "#f2c94c";
  const GOLD_D = "#b8860b";
  const GOLD_L = "#fff2a8";
  const BRONZE = "#c17817";
  const ARMOR = "#d4a017";
  const ARMOR_D = "#7a5010";
  const CAPE = "#7a1a1a";
  const CAPE_D = "#3d0a0a";
  const HAIR = "#c9924a";

  // Blazing aureole behind head — sun rays
  add(2, 3, 1, 1, GOLD);
  add(1, 4, 1, 1, GOLD_D);
  add(1, 6, 1, 1, GOLD);
  add(1, 8, 1, 1, GOLD_D);
  add(2, 10, 1, 1, GOLD);
  add(13, 3, 1, 1, GOLD);
  add(14, 4, 1, 1, GOLD_D);
  add(14, 6, 1, 1, GOLD);
  add(14, 8, 1, 1, GOLD_D);
  add(13, 10, 1, 1, GOLD);
  add(2, 1, 1, 1, GOLD_L);
  add(13, 1, 1, 1, GOLD_L);
  add(0, 5, 1, 1, GOLD_L);
  add(15, 5, 1, 1, GOLD_L);

  // Crimson cape behind
  add(1, 9, 1, 6, CAPE_D);
  add(2, 8, 1, 8, CAPE);
  add(3, 8, 1, 8, CAPE);
  add(12, 8, 1, 8, CAPE);
  add(13, 8, 1, 8, CAPE);
  add(14, 9, 1, 6, CAPE_D);

  // Golden armor body
  add(4, 8, 8, 7, ARMOR);
  add(4, 8, 1, 7, ARMOR_D);
  add(11, 8, 1, 7, ARMOR_D);
  // chest muscle contours
  add(5, 9, 2, 2, GOLD);
  add(9, 9, 2, 2, GOLD);
  add(6, 9, 1, 1, GOLD_L);
  add(10, 9, 1, 1, GOLD_L);
  add(7, 10, 2, 1, ARMOR_D);
  // laurel medallion
  add(7, 11, 2, 2, BRONZE);
  add(7, 11, 1, 1, GOLD_L);
  add(8, 12, 1, 1, GOLD);
  // belt
  add(4, 13, 8, 1, ARMOR_D);
  add(4, 14, 8, 1, BRONZE);
  add(7, 14, 2, 1, GOLD_L);
  // shoulder pauldrons
  add(3, 8, 1, 2, GOLD);
  add(12, 8, 1, 2, GOLD);
  add(3, 8, 1, 1, GOLD_L);
  add(12, 8, 1, 1, GOLD_L);
  // arms
  add(3, 10, 1, 3, ARMOR);
  add(12, 10, 1, 3, ARMOR);
  add(3, 13, 1, 1, SKIN);
  add(12, 13, 1, 1, SKIN);
  // greaves
  add(5, 15, 2, 1, GOLD);
  add(9, 15, 2, 1, GOLD);

  // Neck & head
  add(7, 7, 2, 1, SKIN);
  add(5, 3, 6, 5, SKIN);
  add(4, 4, 1, 3, SKIN);
  add(11, 4, 1, 3, SKIN);
  add(5, 7, 1, 1, SKIN_S);
  add(10, 7, 1, 1, SKIN_S);

  // Golden hair
  add(4, 2, 8, 2, HAIR);
  add(5, 2, 6, 1, GOLD_L);
  add(4, 3, 1, 2, HAIR);
  add(11, 3, 1, 2, HAIR);

  // Laurel crown
  add(3, 2, 1, 1, "#1a5c2a");
  add(4, 1, 1, 1, "#1a5c2a");
  add(5, 0, 1, 1, "#2a8040");
  add(7, 0, 1, 1, "#2a8040");
  add(9, 0, 1, 1, "#2a8040");
  add(10, 1, 1, 1, "#1a5c2a");
  add(11, 2, 1, 1, "#1a5c2a");
  add(6, 1, 1, 1, "#2a8040");
  add(8, 1, 1, 1, "#2a8040");
  add(7, 2, 2, 1, GOLD_L);

  // Eyes — piercing gold
  add(6, 5, 1, 1, GOLD_D);
  add(9, 5, 1, 1, GOLD_D);
  add(6, 4, 1, 1, GOLD);
  add(9, 4, 1, 1, GOLD);

  // Stoic mouth
  if (mood === "sad") add(7, 7, 2, 1, ARMOR_D);
  else add(6, 6, 4, 1, "#5a2a1a");

  return px;
}

const SPECIAL_LABELS: Record<string, string> = {
  angel: "Celestial Healer",
  devil: "Shadow Surgeon",
  phoenix: "Phoenix Reborn",
  void: "Cosmic Wanderer",
  titan: "Golden Titan",
};

function auraStops(special: string) {
  switch (special) {
    case "angel":
      return { c1: "#fff2a8", c2: "#f2c94c", c3: "#f2c94c", o1: 0.85, o2: 0.35, blend: "screen" };
    case "devil":
      return { c1: "#ff2a2a", c2: "#7a1a1a", c3: "#2b0f14", o1: 0.65, o2: 0.4, blend: "normal" };
    case "phoenix":
      return { c1: "#ffd23a", c2: "#e63900", c3: "#7a1500", o1: 0.9, o2: 0.5, blend: "screen" };
    case "void":
      return { c1: "#c026d3", c2: "#5b2ea8", c3: "#0a0518", o1: 0.75, o2: 0.45, blend: "screen" };
    case "titan":
      return { c1: "#fff2a8", c2: "#f2c94c", c3: "#b8860b", o1: 0.85, o2: 0.4, blend: "screen" };
    default:
      return { c1: "#fff", c2: "#fff", c3: "#fff", o1: 0, o2: 0, blend: "normal" };
  }
}

export function Companion({
  level,
  mood = "idle",
  size = 96,
  bob = true,
  className,
  character,
}: {
  level: number;
  mood?: CompanionMood;
  size?: number;
  bob?: boolean;
  className?: string;
  character?: CharacterCustomization;
}) {
  const special = character?.special;

  const pixels = useMemo(() => {
    if (special === "angel") return buildAngel(mood);
    if (special === "devil") return buildDevil(mood);
    if (special === "phoenix") return buildPhoenix(mood);
    if (special === "void") return buildVoid(mood);
    if (special === "titan") return buildTitan(mood);
    return buildPixels(level, mood, character);
  }, [level, mood, character, special]);

  const moodClass =
    mood === "happy"
      ? "companion-happy"
      : mood === "sad"
        ? "companion-sad"
        : bob
          ? "companion-bob"
          : "";

  const viewBox = special ? "-2 -1 20 20" : "0 0 16 18";
  const aspectW = special ? 20 : 16;
  const aspectH = special ? 20 : 18;

  const auraId = useMemo(
    () => `aura-${special ?? "n"}-${Math.random().toString(36).slice(2, 7)}`,
    [special],
  );

  const aura = special ? auraStops(special) : null;

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size * (aspectH / aspectW)}
      shapeRendering="crispEdges"
      className={cn("pixelated select-none", moodClass, className)}
      role="img"
      aria-label={
        special
          ? SPECIAL_LABELS[special]
          : `Study companion, ${stageForLevel(level).title}`
      }
    >
      {special && aura && (
        <defs>
          <radialGradient id={auraId}>
            <stop offset="0%" stopColor={aura.c1} stopOpacity={aura.o1} />
            <stop offset="60%" stopColor={aura.c2} stopOpacity={aura.o2} />
            <stop offset="100%" stopColor={aura.c3} stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      {special && aura && (
        <circle
          cx={8}
          cy={9}
          r={11}
          fill={`url(#${auraId})`}
          style={{ mixBlendMode: aura.blend as "screen" | "normal" }}
        />
      )}
      {pixels.map((px, i) => (
        <rect key={i} x={px.x} y={px.y} width={px.w} height={px.h} fill={px.c} />
      ))}
      {/* Particle sparkles / embers */}
      {special === "angel" && (
        <>
          <rect x={-1} y={2} width={1} height={1} fill="#ffffff" opacity="0.9" />
          <rect x={17} y={1} width={1} height={1} fill="#ffffff" opacity="0.9" />
          <rect x={2} y={15} width={1} height={1} fill="#fff2a8" opacity="0.9" />
          <rect x={15} y={14} width={1} height={1} fill="#fff2a8" opacity="0.9" />
        </>
      )}
      {special === "devil" && (
        <>
          <rect x={-1} y={16} width={1} height={1} fill="#ff6b5c" opacity="0.85" />
          <rect x={2} y={17} width={1} height={1} fill="#c9302c" opacity="0.85" />
          <rect x={15} y={17} width={1} height={1} fill="#ff6b5c" opacity="0.85" />
          <rect x={17} y={15} width={1} height={1} fill="#c9302c" opacity="0.85" />
        </>
      )}
      {special === "phoenix" && (
        <>
          <rect x={-1} y={2} width={1} height={1} fill="#ffd23a" opacity="0.9" />
          <rect x={17} y={1} width={1} height={1} fill="#ff7a1a" opacity="0.9" />
          <rect x={-1} y={13} width={1} height={1} fill="#ff7a1a" opacity="0.9" />
          <rect x={17} y={14} width={1} height={1} fill="#ffd23a" opacity="0.9" />
          <rect x={4} y={17} width={1} height={1} fill="#e63900" opacity="0.9" />
          <rect x={11} y={17} width={1} height={1} fill="#e63900" opacity="0.9" />
        </>
      )}
      {special === "void" && (
        <>
          <rect x={-1} y={1} width={1} height={1} fill="#ffffff" opacity="0.9" />
          <rect x={17} y={2} width={1} height={1} fill="#22d3ee" opacity="0.9" />
          <rect x={-2} y={9} width={1} height={1} fill="#c026d3" opacity="0.9" />
          <rect x={17} y={11} width={1} height={1} fill="#ffffff" opacity="0.9" />
          <rect x={5} y={17} width={1} height={1} fill="#22d3ee" opacity="0.9" />
          <rect x={11} y={17} width={1} height={1} fill="#c026d3" opacity="0.9" />
        </>
      )}
      {special === "titan" && (
        <>
          <rect x={-1} y={2} width={1} height={1} fill="#fff2a8" opacity="0.95" />
          <rect x={17} y={2} width={1} height={1} fill="#fff2a8" opacity="0.95" />
          <rect x={-2} y={7} width={1} height={1} fill="#f2c94c" opacity="0.9" />
          <rect x={17} y={7} width={1} height={1} fill="#f2c94c" opacity="0.9" />
        </>
      )}
    </svg>
  );
}

