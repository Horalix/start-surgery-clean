import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Play,
  Zap,
  Dumbbell,
  ClipboardCheck,
  CalendarClock,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useStore, getState } from "@/lib/study/store";
import { readiness, weakestTopics, topicStats } from "@/lib/study/selectors";
import { levelProgress, stageForLevel, nextStage } from "@/lib/study/companion";
import { withDerivedTier } from "@/lib/study/character-progression";
import { Companion } from "@/components/study/Companion";
import { StatCard, Ring, TopicBar } from "@/components/study/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: Today });

const READY_META = {
  "not-ready": { label: "Not ready", tone: "var(--destructive)", cls: "text-destructive" },
  almost: { label: "Almost ready", tone: "var(--warning)", cls: "text-warning-foreground" },
  ready: { label: "Exam ready", tone: "var(--success)", cls: "text-success" },
} as const;

function Today() {
  const tick = useStore((s) => s.profile.xp + Object.keys(s.progress).length);
  const name = useStore((s) => s.profile.name);
  const xp = useStore((s) => s.profile.xp);
  const character = useStore((s) => s.character);

  const data = useMemo(() => {
    const s = getState();
    return {
      r: readiness(s),
      weak: weakestTopics(s, 4),
      stats: topicStats(s),
      resolvedCharacter: withDerivedTier(s.character, s),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, character]);

  const { r, weak, resolvedCharacter } = data;
  const lp = levelProgress(xp);
  const stage = stageForLevel(lp.level);
  const next = nextStage(lp.level);
  const ready = READY_META[r.state];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Level-up burst + toast
  const prevLevelRef = useRef<number | null>(null);
  const prevXpRef = useRef<number>(xp);
  const [burst, setBurst] = useState(false);
  const [xpPulse, setXpPulse] = useState(false);
  useEffect(() => {
    if (prevLevelRef.current == null) {
      prevLevelRef.current = lp.level;
      return;
    }
    if (lp.level > prevLevelRef.current) {
      setBurst(true);
      toast.success(`Level up! You reached Level ${lp.level} — ${stageForLevel(lp.level).name}.`);
      setTimeout(() => setBurst(false), 950);
    }
    prevLevelRef.current = lp.level;
  }, [lp.level]);

  useEffect(() => {
    if (xp > prevXpRef.current) {
      setXpPulse(true);
      setTimeout(() => setXpPulse(false), 520);
    }
    prevXpRef.current = xp;
  }, [xp]);


  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-background/70 shadow-inner">
              <Companion level={lp.level} size={72} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {greeting}, {name}
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">
                Let's master the Surgery I final
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {stage.title} · Level {lp.level}
                {next && (
                  <span className="text-muted-foreground/70">
                    {" "}
                    · {next.minLevel - lp.level} level{next.minLevel - lp.level === 1 ? "" : "s"} to{" "}
                    {next.name}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Ring
              value={r.examScorePct}
              tone={ready.tone}
              label={<span className="text-3xl font-bold tabular-nums">{r.examScorePct}%</span>}
              sublabel={
                <span className="text-[11px] font-medium text-muted-foreground">predicted</span>
              }
            />
            <div className="max-w-[180px]">
              <div className={cn("text-lg font-bold", ready.cls)}>{ready.label}</div>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {r.reasons.slice(0, 2).map((reason, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    {r.state === "ready" ? (
                      <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" />
                    )}
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg" className="gap-2">
            <Link to="/learn">
              <Play className="size-4" />
              Continue studying
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <Link to="/exam">
              <ClipboardCheck className="size-4" />
              Start Exam Simulation
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Due for review"
          value={r.dueCount}
          hint={r.dueCount ? "resurfacing now" : "all caught up"}
          tone={r.dueCount ? "primary" : "success"}
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Recent accuracy"
          value={`${Math.round(r.recentAccuracy * 100)}%`}
          hint="last 40 answers"
          tone="default"
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Bank mastered"
          value={`${r.masteryPct}%`}
          hint={`${r.seenPct}% seen · 156 total`}
          tone="default"
          icon={<Target className="size-4" />}
        />
        <StatCard
          label="Repeated misses"
          value={r.repeatedErrors}
          hint={r.dangerous ? `${r.dangerous} confident errors` : "no danger errors"}
          tone={r.repeatedErrors ? "danger" : "success"}
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      {/* Priority + weak topics */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's review */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="size-4 text-primary" />
              Today's priority review
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.dueCount > 0
              ? `${r.dueCount} question${r.dueCount === 1 ? "" : "s"} are scheduled or overdue. Clearing these keeps the exam questions in memory.`
              : "Nothing overdue right now. Start a fresh Learn session or drill your weak spots to stay sharp."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant={r.dueCount ? "default" : "outline"} className="gap-2">
              <Link to="/drill">
                <Dumbbell className="size-4" />
                {r.dueCount ? `Review ${Math.min(r.dueCount, 15)} due` : "Weakness drill"}
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/rapid">
                <Zap className="size-4" />
                Rapid recall
              </Link>
            </Button>
          </div>
        </div>

        {/* Weakest topics */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Target className="size-4 text-primary" />
            Weakest topics
          </h2>
          <div className="mt-4 space-y-3">
            {weak.map((t) => (
              <Link key={t.id} to="/bank" search={{ topic: t.id } as never} className="block">
                <TopicBar label={t.short} value={t.strength} tone={t.tone} />
              </Link>
            ))}
          </div>
          <Link
            to="/analytics"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Full analytics <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Mode grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Study modes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModeCard
            to="/learn"
            title="Learn"
            desc="One at a time with full explanations and clinical nuance."
            icon={<Play className="size-5" />}
          />
          <ModeCard
            to="/rapid"
            title="Rapid Recall"
            desc="High-speed active recall on your highest-yield gaps."
            icon={<Zap className="size-5" />}
          />
          <ModeCard
            to="/drill"
            title="Weakness Drill"
            desc="Short intense sets built from what you keep missing."
            icon={<Dumbbell className="size-5" />}
          />
          <ModeCard
            to="/exam"
            title="Exam Simulation"
            desc="The exact 74-question final, timed, no feedback until the end."
            icon={<ClipboardCheck className="size-5" />}
          />
          <ModeCard
            to="/bank"
            title="Master Bank"
            desc="Browse and filter all 156 source questions."
            icon={<Target className="size-5" />}
          />
          <ModeCard
            to="/battle"
            title="Battle Arena"
            desc="Quiz matches — most correct or fastest-correct."
            icon={<Zap className="size-5" />}
          />
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  to,
  title,
  desc,
  icon,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="mt-3 flex items-center gap-1 text-sm font-semibold">
        {title}
        <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </Link>
  );
}
