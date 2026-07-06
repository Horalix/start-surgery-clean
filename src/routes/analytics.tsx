import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Zap,
  Trophy,
  Flame,
} from "lucide-react";
import { getState, useStore } from "@/lib/study/store";
import { readiness, topicStats, typeStats, mostLikelyToMiss } from "@/lib/study/selectors";
import { TOPIC_BY_ID } from "@/data/topics";
import { levelProgress, stageForLevel, nextStage, STAGES } from "@/lib/study/companion";
import { computeTier } from "@/lib/study/character-progression";
import { PageTitle, StatCard, Ring, TopicBar } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { cn } from "@/lib/utils";
import type { AppState } from "@/lib/study/types";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

const READY_META = {
  "not-ready": { label: "Not ready", tone: "var(--destructive)", cls: "text-destructive" },
  almost: { label: "Almost ready", tone: "var(--warning)", cls: "text-warning-foreground" },
  ready: { label: "Exam ready", tone: "var(--success)", cls: "text-success" },
} as const;

/** Bucket every recorded attempt into local day → daily XP earned (approximation). */
function dailyXpSeries(state: AppState): { day: string; xp: number }[] {
  const map = new Map<string, number>();
  for (const p of Object.values(state.progress)) {
    for (const h of p.history) {
      const day = new Date(h.at).toISOString().slice(0, 10);
      const gained = h.correct
        ? h.confidence === "certain"
          ? 10
          : h.confidence === "confident"
            ? 8
            : h.confidence === "unsure"
              ? 6
              : 4
        : 1;
      map.set(day, (map.get(day) ?? 0) + gained);
    }
  }
  for (const e of state.examAttempts) {
    const day = new Date(e.at).toISOString().slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + Math.round(e.score * 3));
  }
  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.slice(-30).map(([day, xp]) => ({ day, xp }));
}

/** Rolling accuracy over the last N attempts, sampled at each attempt. */
function rollingAccuracy(state: AppState, windowN = 20): { i: number; acc: number }[] {
  const all = Object.values(state.progress)
    .flatMap((p) => p.history.map((h) => ({ ...h })))
    .sort((a, b) => a.at - b.at);
  const points: { i: number; acc: number }[] = [];
  for (let i = 0; i < all.length; i++) {
    const slice = all.slice(Math.max(0, i - windowN + 1), i + 1);
    const acc = slice.filter((h) => h.correct).length / slice.length;
    points.push({ i, acc });
  }
  return points.slice(-60);
}

/** For each confidence bucket, actual accuracy — surfaces overconfidence. */
function confidenceCalibration(state: AppState) {
  const buckets: Record<string, { total: number; correct: number }> = {
    guess: { total: 0, correct: 0 },
    unsure: { total: 0, correct: 0 },
    confident: { total: 0, correct: 0 },
    certain: { total: 0, correct: 0 },
  };
  for (const p of Object.values(state.progress)) {
    for (const h of p.history) {
      const b = buckets[h.confidence];
      if (!b) continue;
      b.total += 1;
      if (h.correct) b.correct += 1;
    }
  }
  return (["guess", "unsure", "confident", "certain"] as const).map((k) => {
    const b = buckets[k];
    return {
      key: k,
      total: b.total,
      accuracy: b.total ? b.correct / b.total : 0,
    };
  });
}

function AnalyticsPage() {
  const tick = useStore(
    (s) => s.profile.xp + Object.keys(s.progress).length + s.examAttempts.length,
  );
  const xp = useStore((s) => s.profile.xp);
  const bestExamScore = useStore((s) => s.profile.bestExamScore);
  const streak = useStore((s) => s.profile.streakDays);
  const battlesWon = useStore((s) => s.profile.battlesWon);
  const battlesPlayed = useStore((s) => s.profile.battlesPlayed);

  const d = useMemo(() => {
    const s = getState();
    return {
      r: readiness(s),
      topics: topicStats(s),
      types: typeStats(s),
      miss: mostLikelyToMiss(s, 8),
      exams: s.examAttempts.slice(-12),
      xpSeries: dailyXpSeries(s),
      rolling: rollingAccuracy(s),
      calibration: confidenceCalibration(s),
      tier: computeTier(s),
      character: s.character,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const { r } = d;
  const ready = READY_META[r.state];
  const lp = levelProgress(xp);
  const stage = stageForLevel(lp.level);
  const next = nextStage(lp.level);
  const winRate = battlesPlayed ? Math.round((battlesWon / battlesPlayed) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Analytics & Readiness"
        subtitle="An honest picture of where you stand for the 74-question final."
        icon={<BarChart3 className="size-5" />}
      />

      {/* Hero: level ring + companion + XP progress */}
      <div className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm lg:grid-cols-[auto_1fr] lg:p-6">
        <div className="flex items-center gap-5">
          <div className="flex size-24 items-center justify-center rounded-2xl bg-primary/10">
            <Companion level={lp.level} size={80} character={d.character} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {stage.title}
            </div>
            <div className="text-3xl font-black tracking-tight">Level {lp.level}</div>
            <div className="mt-1 text-xs text-muted-foreground tabular-nums">
              {lp.into.toLocaleString()} / {lp.need.toLocaleString()} XP
              {next && (
                <>
                  {" "}
                  · {next.minLevel - lp.level} to {next.name}
                </>
              )}
            </div>
            <div className="mt-2 h-2 w-56 max-w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${lp.pct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 lg:justify-end">
          <Ring
            value={r.examScorePct}
            size={128}
            tone={ready.tone}
            label={<span className="text-3xl font-bold tabular-nums">{r.examScorePct}%</span>}
            sublabel={<span className="text-xs text-muted-foreground">predicted</span>}
          />
          <div className="max-w-[220px]">
            <div className={cn("text-lg font-bold", ready.cls)}>{ready.label}</div>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {r.reasons.slice(0, 3).map((reason, i) => (
                <li key={i} className="flex items-start gap-2">
                  {r.state === "ready" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  )}
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Mastered" value={`${r.masteryPct}%`} hint="of 156" tone="success" />
        <StatCard
          label="Recent accuracy"
          value={`${Math.round(r.recentAccuracy * 100)}%`}
          hint="last 40"
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Best exam"
          value={bestExamScore ?? "—"}
          hint="/ 74"
          icon={<Trophy className="size-4" />}
        />
        <StatCard
          label="Day streak"
          value={streak}
          hint={streak ? "keep it alive" : "start today"}
          tone={streak ? "primary" : "default"}
          icon={<Flame className="size-4" />}
        />
        <StatCard label="Due now" value={r.dueCount} tone={r.dueCount ? "primary" : "success"} />
        <StatCard
          label="Repeated misses"
          value={r.repeatedErrors}
          tone={r.repeatedErrors ? "danger" : "success"}
        />
        <StatCard
          label="Confident errors"
          value={r.dangerous}
          hint="wrong while sure"
          tone={r.dangerous ? "danger" : "success"}
        />
        <StatCard
          label="Battles"
          value={`${battlesWon}/${battlesPlayed}`}
          hint={`${winRate}% win rate`}
          icon={<Zap className="size-4" />}
        />
      </div>

      {/* XP over time + rolling accuracy */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="XP earned per day" subtitle="Last 30 active days">
          {d.xpSeries.length === 0 ? (
            <Empty>Answer questions to start tracking XP over time.</Empty>
          ) : (
            <BarChart
              data={d.xpSeries.map((p) => p.xp)}
              labels={d.xpSeries.map((p) => p.day.slice(5))}
            />
          )}
        </ChartCard>
        <ChartCard title="Rolling accuracy" subtitle="20-answer moving average">
          {d.rolling.length === 0 ? (
            <Empty>Start a study session to see your accuracy trend.</Empty>
          ) : (
            <LineChart points={d.rolling.map((p) => p.acc * 100)} />
          )}
        </ChartCard>
      </div>

      {/* Confidence calibration */}
      <ChartCard
        title="Confidence calibration"
        subtitle="Are you as sure as you should be? Bars show actual accuracy per confidence tier."
      >
        <div className="space-y-2.5">
          {d.calibration.map((c) => {
            const target =
              c.key === "certain"
                ? 0.95
                : c.key === "confident"
                  ? 0.85
                  : c.key === "unsure"
                    ? 0.55
                    : 0.35;
            const danger = c.total > 0 && c.accuracy < target - 0.15;
            return (
              <div key={c.key} className="rounded-lg border bg-background p-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold capitalize">{c.key}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.total ? `${Math.round(c.accuracy * 100)}% (${c.total} tries)` : "no data"}
                  </span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      danger ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${c.accuracy * 100}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-px bg-foreground/40"
                    style={{ left: `${target * 100}%` }}
                    aria-label={`target ${Math.round(target * 100)}%`}
                  />
                </div>
                {danger && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Overconfident — accuracy is well below the {Math.round(target * 100)}% target.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </ChartCard>

      {/* Topic mastery */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Mastery by topic</h2>
        <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
          {d.topics.map((t) => (
            <Link key={t.id} to="/bank" search={{ topic: t.id } as never}>
              <TopicBar
                label={`${t.short} · ${t.mastered}/${t.total}`}
                value={t.strength}
                tone={t.tone}
              />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Accuracy by question type</h2>
          <div className="space-y-3.5">
            {d.types.map((t) => (
              <TopicBar
                key={t.key}
                label={`${t.label} · ${t.correct}/${t.attempts || 0}`}
                value={t.attempts ? t.correct / t.attempts : 0}
                tone="var(--viz-1)"
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Multi-answer and "find the incorrect" items are the classic traps — they require exact
            selection.
          </p>
        </div>

        <ChartCard
          title="Exam attempts over time"
          subtitle={`${d.exams.length} attempt${d.exams.length === 1 ? "" : "s"}`}
        >
          {d.exams.length === 0 ? (
            <Empty>No exam attempts yet. Take the simulation to start tracking.</Empty>
          ) : (
            <LineChart points={d.exams.map((e) => (e.score / e.total) * 100)} />
          )}
          <div className="mt-3 text-right">
            <Link
              to="/exam"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Take exam <ArrowRight className="size-3" />
            </Link>
          </div>
        </ChartCard>
      </div>

      {/* Most likely to miss */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold">Most likely to miss on the final</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Exam questions your data flags as your biggest risks right now.
        </p>
        {d.miss.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Great — no high-risk exam questions detected. Keep reviewing to stay sharp.
          </p>
        ) : (
          <div className="space-y-2">
            {d.miss.map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-3 rounded-lg border bg-background p-2.5"
              >
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                  Q{q.examNo}
                </span>
                <span className="text-xs" style={{ color: TOPIC_BY_ID[q.topic].tone }}>
                  {TOPIC_BY_ID[q.topic].short}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{q.stem}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Companion progress */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Your companion's journey</h2>
        <div className="flex flex-wrap items-end justify-between gap-4">
          {STAGES.map((st) => {
            const reached = lp.level >= st.minLevel;
            return (
              <div
                key={st.index}
                className={cn(
                  "flex flex-col items-center gap-1",
                  !reached && "opacity-35 grayscale",
                )}
              >
                <Companion level={st.minLevel} size={48} bob={false} />
                <span className="text-[11px] font-semibold">{st.name}</span>
                <span className="text-[10px] text-muted-foreground">Lv {st.minLevel}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{stage.title}</span>
            {next && (
              <span>
                {lp.need - lp.into} XP to {next.name}
              </span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${lp.pct}%` }}
            />
          </div>
        </div>

        {(d.character?.special === "angel" || d.character?.special === "devil") &&
          d.tier.nextTier && (
            <div className="mt-5 rounded-xl border bg-background/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ascension to Tier {d.tier.nextTier}
              </div>
              <div className="space-y-2">
                <MissionBar
                  label={`Reach Level ${d.tier.levelForNext}`}
                  progress={Math.min(1, lp.level / (d.tier.levelForNext ?? 1))}
                  progressLabel={`Lv ${lp.level}/${d.tier.levelForNext}`}
                  done={lp.level >= (d.tier.levelForNext ?? 0)}
                />
                {d.tier.missionsForNext.map((m) => (
                  <MissionBar
                    key={m.key}
                    label={m.label}
                    progress={m.progress}
                    progressLabel={m.progressLabel}
                    done={m.complete}
                  />
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 mb-3 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function MissionBar({
  label,
  progress,
  progressLabel,
  done,
}: {
  label: string;
  progress: number;
  progressLabel: string;
  done: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium", done && "text-success")}>
          {done ? "✓ " : ""}
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">{progressLabel}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", done ? "bg-success" : "bg-primary")}
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function LineChart({ points }: { points: number[] }) {
  const w = 320;
  const h = 90;
  const pad = 6;
  const max = 100;
  const min = 0;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (p - min) / (max - min)) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" preserveAspectRatio="none">
      <line
        x1={pad}
        y1={pad + (h - pad * 2) * 0.15}
        x2={w - pad}
        y2={pad + (h - pad * 2) * 0.15}
        stroke="var(--border)"
        strokeDasharray="3 3"
      />
      <path d={area} fill="var(--primary)" opacity={0.15} />
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.4} fill="var(--primary)" />
      ))}
    </svg>
  );
}

function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const w = 320;
  const h = 100;
  const pad = 8;
  const maxV = Math.max(1, ...data);
  const bw = (w - pad * 2) / Math.max(1, data.length);
  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-28 w-full min-w-[280px]"
        preserveAspectRatio="none"
      >
        {data.map((v, i) => {
          const barH = (v / maxV) * (h - pad * 2);
          return (
            <rect
              key={i}
              x={pad + i * bw + 0.6}
              y={h - pad - barH}
              width={bw - 1.2}
              height={barH}
              fill="var(--primary)"
              rx={1.2}
            />
          );
        })}
      </svg>
      <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
        <span>{labels[0]}</span>
        {labels.length > 1 && <span>{labels[labels.length - 1]}</span>}
      </div>
    </div>
  );
}
