import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserCog, Save, RotateCcw, Lock, Sparkles } from "lucide-react";
import { PageTitle } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStore, setCharacter, getState } from "@/lib/study/store";
import { levelProgress, stageForLevel } from "@/lib/study/companion";
import { computeTier, withDerivedTier } from "@/lib/study/character-progression";
import type { CharacterCustomization } from "@/lib/study/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/character")({ component: CharacterPage });

const SKIN = ["#f0c9a4", "#e9bd97", "#e3b48c", "#c48a63", "#8a5a3b", "#5a3b28"];
const HAIR = ["#7a4a2b", "#5a3720", "#3f2717", "#2c1a10", "#cfcfd6", "#d9a441", "#c94b4b", "#4a2ea8"];
const SCRUB_SETS: { name: string; scrub: string; scrubDark: string }[] = [
  { name: "Teal", scrub: "#8fd3c6", scrubDark: "#5cb3a4" },
  { name: "Sky", scrub: "#6fc3e6", scrubDark: "#3f9dc7" },
  { name: "Blue", scrub: "#5aa9f2", scrubDark: "#3573c9" },
  { name: "Indigo", scrub: "#3f7ff0", scrubDark: "#2a56c8" },
  { name: "Navy", scrub: "#3457d5", scrubDark: "#22399e" },
  { name: "Plum", scrub: "#8f4fd6", scrubDark: "#5a2c8f" },
  { name: "Rose", scrub: "#e57ea6", scrubDark: "#b64d78" },
  { name: "Slate", scrub: "#556676", scrubDark: "#333f4a" },
];
const ACCENT = ["#2bb3a3", "#2b8fd8", "#2f6fe0", "#6b8cff", "#ffd45e", "#ff8a5c", "#ff5e88"];

const PROPS: { key: "cap" | "mask" | "glasses" | "badge" | "loupe"; label: string }[] = [
  { key: "cap", label: "Surgical cap" },
  { key: "mask", label: "Mask" },
  { key: "glasses", label: "Glasses" },
  { key: "badge", label: "ID badge" },
  { key: "loupe", label: "Surgical loupe" },
];

const ANGEL_EMAILS = ["kerim.sabic@gmail.com"];
const ANGEL_NAMES = ["kerim"];
const DEVIL_EMAILS = ["amrudin.naser@gmail.com"];
const DEVIL_NAMES = ["amrudin"];
const OWNER_EMAILS = ["kerim.sabic@gmail.com", "amrudin.naser@gmail.com"];
const OWNER_NAMES = ["kerim", "amrudin"];

type Special = NonNullable<CharacterCustomization["special"]>;

const LEGENDARY: { key: Special; emoji: string; label: string; sub: string }[] = [
  { key: "phoenix", emoji: "🔥", label: "Phoenix", sub: "Reborn in Flame" },
  { key: "void", emoji: "🌌", label: "Void", sub: "Cosmic Wanderer" },
  { key: "titan", emoji: "⚔️", label: "Titan", sub: "Golden Warrior" },
  { key: "reaper", emoji: "🗡️", label: "Shadow Reaper", sub: "Violet Scythe" },
  { key: "oracle", emoji: "🔮", label: "Celestial Oracle", sub: "Runic Halo" },
  { key: "samurai", emoji: "🤖", label: "Cyber Samurai", sub: "Neon Blade" },
];

function CharacterPage() {
  const xp = useStore((s) => s.profile.xp);
  const bestExamScore = useStore((s) => s.profile.bestExamScore);
  const profileName = useStore((s) => s.profile.name);
  const saved = useStore((s) => s.character);
  const battlesWon = useStore((s) => s.profile.battlesWon);
  const lp = levelProgress(xp);
  const stage = stageForLevel(lp.level);

  const [draft, setDraft] = useState<CharacterCustomization>(saved ?? {});
  const [savingCloud, setSavingCloud] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [verifiedBestExamScore, setVerifiedBestExamScore] = useState<number | null>(null);

  useEffect(() => setDraft(saved ?? {}), [saved]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("best_exam_score")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setVerifiedBestExamScore(profile?.best_exam_score ?? 0);
    });
  }, []);

  const nameLc = (profileName ?? "").trim().toLowerCase();
  const emailLc = (email ?? "").trim().toLowerCase();
  const canAngel = ANGEL_EMAILS.includes(emailLc) || ANGEL_NAMES.some((n) => nameLc.includes(n));
  const canDevil = DEVIL_EMAILS.includes(emailLc) || DEVIL_NAMES.some((n) => nameLc.includes(n));
  const isOwner = OWNER_EMAILS.includes(emailLc) || OWNER_NAMES.some((n) => nameLc.includes(n));
  const displayBestExamScore = Math.max(bestExamScore ?? 0, verifiedBestExamScore ?? 0);
  const hasPerfectExam = (verifiedBestExamScore ?? 0) >= 74;

  const tierStatus = computeTier(getState());
  // Preview draft with derived tier so Angel/Devil show their current ascension.
  const previewCharacter = withDerivedTier(draft, getState());

  const palette = { ...stage.palette, ...(draft.palette ?? {}) };
  const props = { ...stage.props, ...(draft.props ?? {}) };

  const patchPalette = (p: Partial<typeof palette>) =>
    setDraft((d) => ({ ...d, palette: { ...(d.palette ?? {}), ...p } }));
  const toggleProp = (k: (typeof PROPS)[number]["key"]) =>
    setDraft((d) => ({ ...d, props: { ...(d.props ?? {}), [k]: !props[k] } }));
  const setSpecial = (s: Special | undefined) =>
    setDraft((d) => ({ ...d, special: d.special === s ? undefined : s }));

  const save = async () => {
    // Bake the derived tier into what we persist so it flows to server + battle snapshots.
    const withTier = withDerivedTier(draft, getState()) ?? draft;
    setCharacter(withTier);
    toast.success("Character saved");
    setSavingCloud(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const meta = data.user.user_metadata as { display_name?: string; full_name?: string };
        const displayName =
          meta.display_name || meta.full_name || data.user.email?.split("@")[0] || "Player";
        await supabase
          .from("profiles")
          .upsert(
            {
              user_id: data.user.id,
              display_name: displayName,
              character: withTier as never,
              best_exam_score: verifiedBestExamScore ?? 0,
            } as never,
            { onConflict: "user_id" },
          );
      }
    } catch {
      /* ignore cloud sync errors */
    } finally {
      setSavingCloud(false);
    }
  };

  const reset = () => setDraft({});

  return (
    <div className="space-y-6">
      <PageTitle
        title="Customize character"
        subtitle="Your surgeon appears on Today, on the leaderboard, and in every battle."
        icon={<UserCog className="size-5" />}
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-40 items-center justify-center rounded-2xl bg-primary/10">
              <Companion level={lp.level} size={140} character={previewCharacter} />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold">
                {previewCharacter?.special
                  ? previewCharacter.special.charAt(0).toUpperCase() + previewCharacter.special.slice(1)
                  : stage.title}
                {(previewCharacter?.special === "angel" || previewCharacter?.special === "devil") && (
                  <span className="ml-1 text-primary">
                    · Tier {previewCharacter.tier ?? 1}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">Level {lp.level}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1 gap-2" onClick={save} disabled={savingCloud}>
              <Save className="size-4" /> Save
            </Button>
            <Button variant="outline" onClick={reset} className="gap-2">
              <RotateCcw className="size-4" /> Reset
            </Button>
          </div>
        </section>

        <section className="space-y-6">
          {/* Owner Angel/Devil ascension panel */}
          {(canAngel || canDevil) && (
            <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
              <Label className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4" /> Signature form ascension
              </Label>
              <p className="mb-3 text-xs text-muted-foreground">
                Your {canAngel ? "Angel" : "Devil"} form transforms as you grind. Current tier:{" "}
                <span className="font-bold text-foreground">Tier {tierStatus.tier}</span>.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((t) => {
                  const unlocked = tierStatus.tier >= t;
                  return (
                    <div
                      key={t}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 p-2",
                        unlocked ? "border-primary bg-primary/10" : "border-border opacity-60 grayscale",
                      )}
                    >
                      <div className="flex size-16 items-center justify-center">
                        <Companion
                          level={lp.level}
                          size={56}
                          character={{ special: canAngel ? "angel" : "devil", tier: t as 1 | 2 | 3 }}
                          bob={false}
                        />
                      </div>
                      <div className="text-xs font-bold">Tier {t}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {canAngel
                          ? t === 1 ? "Cherub" : t === 2 ? "Seraph" : "Archangel"
                          : t === 1 ? "Imp" : t === 2 ? "Fiend" : "Archdemon"}
                      </div>
                    </div>
                  );
                })}
              </div>
              {tierStatus.nextTier && (
                <div className="mt-3 rounded-lg border bg-background/60 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Missions to Tier {tierStatus.nextTier}
                  </div>
                  <div className="space-y-2">
                    <MissionRow
                      label={`Reach Level ${tierStatus.levelForNext}`}
                      value={Math.min(1, lp.level / (tierStatus.levelForNext ?? 1))}
                      progressLabel={`Lv ${lp.level}/${tierStatus.levelForNext}`}
                      done={lp.level >= (tierStatus.levelForNext ?? 0)}
                    />
                    {tierStatus.missionsForNext.map((m) => (
                      <MissionRow
                        key={m.key}
                        label={m.label}
                        value={m.progress}
                        progressLabel={m.progressLabel}
                        done={m.complete}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {canAngel && (
                  <button
                    onClick={() => setSpecial("angel")}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-xs font-semibold",
                      draft.special === "angel" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    😇 Wear Angel form
                  </button>
                )}
                {canDevil && (
                  <button
                    onClick={() => setSpecial("devil")}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-xs font-semibold",
                      draft.special === "devil" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    😈 Wear Devil form
                  </button>
                )}
                {draft.special && (
                  <button
                    onClick={() => setSpecial(undefined)}
                    className="rounded-lg border-2 border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                  >
                    Remove form
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Battles won: {battlesWon} · Best exam: {displayBestExamScore}/74
              </p>
            </div>
          )}

          <Group label="Skin tone">
            {SKIN.map((c) => (
              <Swatch key={c} color={c} active={palette.skin === c} onClick={() => patchPalette({ skin: c })} />
            ))}
          </Group>

          <Group label="Hair color">
            {HAIR.map((c) => (
              <Swatch key={c} color={c} active={palette.hair === c} onClick={() => patchPalette({ hair: c })} />
            ))}
          </Group>

          <div>
            <Label className="mb-2 block text-sm font-semibold">Scrubs</Label>
            <div className="flex flex-wrap gap-2">
              {SCRUB_SETS.map((s) => {
                const active = palette.scrub === s.scrub;
                return (
                  <button
                    key={s.name}
                    onClick={() => patchPalette({ scrub: s.scrub, scrubDark: s.scrubDark })}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="size-4 rounded-sm border" style={{ backgroundColor: s.scrub }} />
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <Group label="Accent">
            {ACCENT.map((c) => (
              <Swatch key={c} color={c} active={palette.accent === c} onClick={() => patchPalette({ accent: c })} />
            ))}
          </Group>

          <div>
            <Label className="mb-2 block text-sm font-semibold">Gear</Label>
            <div className="flex flex-wrap gap-2">
              {PROPS.map((p) => {
                const on = !!props[p.key];
                return (
                  <button
                    key={p.key}
                    onClick={() => toggleProp(p.key)}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors",
                      on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    {on ? "✓ " : ""}
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Some gear also unlocks automatically as you level up.</p>
          </div>

          {/* Legendary unlocks — Kerim & Amrudin exclusive */}
          {isOwner && (
            <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
              <Label className="mb-1 block text-sm font-semibold">✨ Legendary forms</Label>
              <p className="mb-3 text-xs text-muted-foreground">
                Six full custom skins. Everyone sees them in battle when you wear one.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {LEGENDARY.map((f) => {
                  const active = draft.special === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setSpecial(f.key)}
                      className={cn(
                        "group flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-all",
                        active ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30" : "border-border hover:bg-accent",
                      )}
                    >
                      <div className="flex size-16 items-center justify-center rounded-lg bg-background/60">
                        <Companion level={lp.level} size={56} character={{ special: f.key }} bob={false} />
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-none">{f.emoji} {f.label}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{f.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!hasPerfectExam && (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
              <Label className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                <Lock className="size-3.5" /> Perfect exam form
              </Label>
              <div className="flex items-center gap-4">
                <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-primary/10 opacity-70 grayscale">
                  <Companion level={lp.level} size={70} character={{ special: "professor" }} bob={false} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold">Professor · 100% Exam Boss</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unlocks at 74/74 on Exam Simulation. Best: {displayBestExamScore}/74.
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasPerfectExam && (
            <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-transparent p-4">
              <Label className="mb-1 block text-sm font-semibold">🎓 Professor unlocked</Label>
              <button
                onClick={() => setSpecial("professor")}
                className={cn(
                  "mt-2 flex items-center gap-3 rounded-lg border-2 p-2",
                  draft.special === "professor" ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                <div className="flex size-14 items-center justify-center rounded-lg bg-background/60">
                  <Companion level={lp.level} size={50} character={{ special: "professor" }} bob={false} />
                </div>
                <span className="text-sm font-semibold">Wear Professor form</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MissionRow({
  label,
  value,
  progressLabel,
  done,
}: {
  label: string;
  value: number;
  progressLabel: string;
  done: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium", done && "text-success")}>{done ? "✓ " : ""}{label}</span>
        <span className="tabular-nums text-muted-foreground">{progressLabel}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", done ? "bg-success" : "bg-primary")}
          style={{ width: `${Math.min(100, value * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={color}
      className={cn(
        "size-9 rounded-full border-2 shadow-sm transition-transform",
        active ? "border-primary ring-2 ring-primary/40 scale-110" : "border-border",
      )}
      style={{ backgroundColor: color }}
    />
  );
}
