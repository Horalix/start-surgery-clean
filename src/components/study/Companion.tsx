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

  // Extend viewBox for wings/aura on special skins
  const viewBox = special ? "-2 -1 20 20" : "0 0 16 18";
  const aspectW = special ? 20 : 16;
  const aspectH = special ? 20 : 18;

  const auraId = useMemo(
    () => `aura-${special ?? "n"}-${Math.random().toString(36).slice(2, 7)}`,
    [special],
  );

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size * (aspectH / aspectW)}
      shapeRendering="crispEdges"
      className={cn("pixelated select-none", moodClass, className)}
      role="img"
      aria-label={
        special === "angel"
          ? "Celestial Healer"
          : special === "devil"
            ? "Shadow Surgeon"
            : `Study companion, ${stageForLevel(level).title}`
      }
    >
      {special && (
        <defs>
          <radialGradient id={auraId}>
            {special === "angel" ? (
              <>
                <stop offset="0%" stopColor="#fff2a8" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#f2c94c" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f2c94c" stopOpacity="0" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#ff2a2a" stopOpacity="0.65" />
                <stop offset="55%" stopColor="#7a1a1a" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#2b0f14" stopOpacity="0" />
              </>
            )}
          </radialGradient>
        </defs>
      )}
      {special && (
        <circle
          cx={8}
          cy={9}
          r={11}
          fill={`url(#${auraId})`}
          style={{ mixBlendMode: special === "angel" ? "screen" : "normal" }}
        />
      )}
      {pixels.map((px, i) => (
        <rect key={i} x={px.x} y={px.y} width={px.w} height={px.h} fill={px.c} />
      ))}
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
    </svg>
  );
}
