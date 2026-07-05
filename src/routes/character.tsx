import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserCog, Save, RotateCcw } from "lucide-react";
import { PageTitle } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStore, setCharacter } from "@/lib/study/store";
import { levelProgress, stageForLevel } from "@/lib/study/companion";
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
const SHARED_EMAILS = ["kerim.sabic@gmail.com", "amrudin.naser@gmail.com"];
const SHARED_NAMES = ["kerim", "amrudin"];

type Special = NonNullable<CharacterCustomization["special"]>;
const SPECIAL_FORMS: { key: Special; emoji: string; label: string; sub: string }[] = [
  { key: "angel", emoji: "😇", label: "Angel", sub: "Celestial Healer" },
  { key: "devil", emoji: "😈", label: "Devil", sub: "Shadow Surgeon" },
  { key: "phoenix", emoji: "🔥", label: "Phoenix", sub: "Reborn in Flame" },
  { key: "void", emoji: "🌌", label: "Void", sub: "Cosmic Wanderer" },
  { key: "titan", emoji: "⚔️", label: "Titan", sub: "Golden Warrior" },
];

function CharacterPage() {
  const xp = useStore((s) => s.profile.xp);
  const profileName = useStore((s) => s.profile.name);
  const saved = useStore((s) => s.character);
  const lp = levelProgress(xp);
  const stage = stageForLevel(lp.level);

  const [draft, setDraft] = useState<CharacterCustomization>(saved ?? {});
  const [savingCloud, setSavingCloud] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => setDraft(saved ?? {}), [saved]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const nameLc = (profileName ?? "").trim().toLowerCase();
  const emailLc = (email ?? "").trim().toLowerCase();
  const canAngel = ANGEL_EMAILS.includes(emailLc) || ANGEL_NAMES.some((n) => nameLc.includes(n));
  const canDevil = DEVIL_EMAILS.includes(emailLc) || DEVIL_NAMES.some((n) => nameLc.includes(n));
  const canShared =
    SHARED_EMAILS.includes(emailLc) || SHARED_NAMES.some((n) => nameLc.includes(n));

  const availableSpecials = SPECIAL_FORMS.filter((f) => {
    if (f.key === "angel") return canAngel;
    if (f.key === "devil") return canDevil;
    return canShared;
  });

  const palette = { ...stage.palette, ...(draft.palette ?? {}) };
  const props = { ...stage.props, ...(draft.props ?? {}) };

  const patchPalette = (p: Partial<typeof palette>) =>
    setDraft((d) => ({ ...d, palette: { ...(d.palette ?? {}), ...p } }));
  const toggleProp = (k: (typeof PROPS)[number]["key"]) =>
    setDraft((d) => ({ ...d, props: { ...(d.props ?? {}), [k]: !props[k] } }));
  const setSpecial = (s: Special | undefined) =>
    setDraft((d) => ({ ...d, special: d.special === s ? undefined : s }));

  const save = async () => {
    setCharacter(draft);
    toast.success("Character saved locally");
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
            { user_id: data.user.id, display_name: displayName, character: draft as never },
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
        subtitle="Adjust your surgeon's look. Changes appear across the app and on the leaderboard."
        icon={<UserCog className="size-5" />}
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-40 items-center justify-center rounded-2xl bg-primary/10">
              <Companion level={lp.level} size={140} character={draft} />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold">{stage.title}</div>
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
          <Group label="Skin tone">
            {SKIN.map((c) => (
              <Swatch
                key={c}
                color={c}
                active={palette.skin === c}
                onClick={() => patchPalette({ skin: c })}
              />
            ))}
          </Group>

          <Group label="Hair color">
            {HAIR.map((c) => (
              <Swatch
                key={c}
                color={c}
                active={palette.hair === c}
                onClick={() => patchPalette({ hair: c })}
              />
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
                    <span
                      className="size-4 rounded-sm border"
                      style={{ backgroundColor: s.scrub }}
                    />
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <Group label="Accent">
            {ACCENT.map((c) => (
              <Swatch
                key={c}
                color={c}
                active={palette.accent === c}
                onClick={() => patchPalette({ accent: c })}
              />
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
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    {on ? "✓ " : ""}
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Some gear also unlocks automatically as you level up.
            </p>
          </div>

          {(canAngel || canDevil) && (
            <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent p-4">
              <Label className="mb-2 block text-sm font-semibold">
                ✨ Secret forms{" "}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (unlocked for you)
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {canAngel && (
                  <button
                    onClick={() => setSpecial("angel")}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors",
                      draft.special === "angel"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    😇 Angel
                  </button>
                )}
                {canDevil && (
                  <button
                    onClick={() => setSpecial("devil")}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors",
                      draft.special === "devil"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    😈 Devil
                  </button>
                )}
                {draft.special && (
                  <button
                    onClick={() => setSpecial(undefined)}
                    className="rounded-lg border-2 border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
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

function Swatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
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
