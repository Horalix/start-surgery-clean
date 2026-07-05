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

function buildPixels(level: number, mood: CompanionMood): Px[] {
  const st = stageForLevel(level);
  const p = st.palette;
  const px: Px[] = [];
  const add = (x: number, y: number, w: number, h: number, c: string) => px.push({ x, y, w, h, c });

  // ── Body / scrubs ──
  add(4, 8, 8, 7, p.scrub);
  add(4, 8, 1, 7, p.scrubDark); // left shade
  add(11, 8, 1, 7, p.scrubDark); // right shade
  add(6, 8, 4, 1, p.scrubDark); // V-neck collar
  add(7, 9, 2, 1, p.scrubDark); // V-neck notch
  // arms
  add(3, 9, 1, 4, p.scrub);
  add(12, 9, 1, 4, p.scrub);
  add(3, 13, 1, 1, p.skin); // hands
  add(12, 13, 1, 1, p.skin);
  // legs hint
  add(5, 15, 2, 1, p.scrubDark);
  add(9, 15, 2, 1, p.scrubDark);

  if (st.props.badge) add(9, 10, 1, 1, p.accent);

  // ── Neck + head ──
  add(7, 7, 2, 1, p.skin); // neck
  add(5, 3, 6, 5, p.skin); // face
  add(4, 4, 1, 3, p.skin); // ears
  add(11, 4, 1, 3, p.skin);

  // ── Hair / cap ──
  if (st.props.cap) {
    add(4, 1, 8, 2, p.scrub); // cap dome
    add(4, 3, 8, 1, p.scrubDark); // cap band
    add(3, 2, 1, 1, p.scrubDark); // tie left
    add(12, 2, 1, 1, p.scrubDark); // tie right
    add(4, 1, 8, 1, MASK); // highlight
  } else {
    add(4, 2, 8, 2, p.hair);
    add(4, 3, 1, 2, p.hair);
    add(11, 3, 1, 2, p.hair);
    add(5, 2, 6, 1, p.hair);
  }

  // ── Eyes ──
  const eyeY = mood === "sad" ? 5 : mood === "thinking" ? 4 : 4;
  if (mood === "happy") {
    // ^ ^ happy eyes
    add(6, 5, 1, 1, EYE);
    add(9, 5, 1, 1, EYE);
    add(5, 6, 1, 1, p.accent); // cheeks
    add(10, 6, 1, 1, p.accent);
  } else if (mood === "sad") {
    add(6, 5, 1, 1, EYE);
    add(9, 5, 1, 1, EYE);
    add(6, 4, 1, 1, p.skin);
  } else {
    add(6, eyeY, 1, 1, EYE);
    add(9, eyeY, 1, 1, EYE);
  }

  // ── Glasses / loupe ──
  if (st.props.glasses) {
    add(5, 4, 2, 1, OUTLINE);
    add(9, 4, 2, 1, OUTLINE);
    add(8, 4, 1, 1, OUTLINE); // bridge
    if (st.props.loupe) add(9, 4, 1, 1, p.accent); // loupe lens glint
  }

  // ── Mask or mouth ──
  if (st.props.mask) {
    add(5, 6, 6, 2, MASK);
    add(4, 6, 1, 1, MASK); // straps
    add(11, 6, 1, 1, MASK);
    add(5, 7, 6, 1, "#dfe7ef"); // mask shade
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

export function Companion({
  level,
  mood = "idle",
  size = 96,
  bob = true,
  className,
}: {
  level: number;
  mood?: CompanionMood;
  size?: number;
  bob?: boolean;
  className?: string;
}) {
  const pixels = useMemo(() => buildPixels(level, mood), [level, mood]);
  const moodClass =
    mood === "happy"
      ? "companion-happy"
      : mood === "sad"
        ? "companion-sad"
        : bob
          ? "companion-bob"
          : "";

  return (
    <svg
      viewBox="0 0 16 18"
      width={size}
      height={size * (18 / 16)}
      shapeRendering="crispEdges"
      className={cn("pixelated select-none", moodClass, className)}
      role="img"
      aria-label={`Study companion, ${stageForLevel(level).title}`}
    >
      {pixels.map((px, i) => (
        <rect key={i} x={px.x} y={px.y} width={px.w} height={px.h} fill={px.c} />
      ))}
    </svg>
  );
}
