import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { BarChart3, CheckCircle2, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import { getState, useStore } from "@/lib/study/store";
import { readiness, topicStats, typeStats, mostLikelyToMiss } from "@/lib/study/selectors";
import { TOPIC_BY_ID } from "@/data/topics";
import { levelProgress, stageForLevel, nextStage, STAGES } from "@/lib/study/companion";
import { PageTitle, StatCard, Ring, TopicBar } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

const READY_META = {
  "not-ready": { label: "Not ready", tone: "var(--destructive)", cls: "text-destructive" },
  almost: { label: "Almost ready", tone: "var(--warning)", cls: "text-warning-foreground" },
  ready: { label: "Exam ready", tone: "var(--success)", cls: "text-success" },
} as const;

function AnalyticsPage() {
  const tick = useStore(
    (s) => s.profile.xp + Object.keys(s.progress).length + s.examAttempts.length,
  );
  const xp = useStore((s) => s.profile.xp);

  const d = useMemo(() => {
    const s = getState();
    return {
      r: readiness(s),
      topics: topicStats(s),
      types: typeStats(s),
      miss: mostLikelyToMiss(s, 8),
      exams: s.examAttempts.slice(-12),
      sessions: s.sessions.slice(-20),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const { r } = d;
  const ready = READY_META[r.state];
  const lp = levelProgress(xp);
  const stage = stageForLevel(lp.level);
  const next = nextStage(lp.level);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Analytics & Readiness"
        subtitle="An honest picture of where you stand for the 74-question final."
        icon={<BarChart3 className="size-5" />}
      />

      {/* Readiness banner */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Ring
            value={r.examScorePct}
            size={148}
            tone={ready.tone}
            label={<span className="text-4xl font-bold tabular-nums">{r.examScorePct}%</span>}
            sublabel={<span className="text-xs text-muted-foreground">predicted exam</span>}
          />
          <div className="flex-1">
            <div className={cn("text-xl font-bold", ready.cls)}>{ready.label}</div>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {r.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2">
                  {r.state === "ready" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  )}
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Mastered" value={`${r.masteryPct}%`} hint="of 156" tone="success" />
        <StatCard label="Seen" value={`${r.seenPct}%`} hint={`${r.neverSeen} never attempted`} />
        <StatCard
          label="Recent accuracy"
          value={`${Math.round(r.recentAccuracy * 100)}%`}
          hint="last 40"
          icon={<TrendingUp className="size-4" />}
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
          label="Best exam"
          value={useStore((s) => s.profile.bestExamScore) ?? "—"}
          hint="/ 74"
        />
        <StatCard label="Level" value={lp.level} hint={stage.name} tone="primary" />
      </div>

      {/* Topic accuracy */}
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
        {/* Accuracy by type */}
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
            Multi-answer and "find the incorrect" items are the classic trap — they require exact
            selection.
          </p>
        </div>

        {/* Progress over time */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Exam attempts over time</h2>
          {d.exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No exam attempts yet. Take the simulation to start tracking.
            </p>
          ) : (
            <Sparkline
              points={d.exams.map((e) => (e.score / e.total) * 100)}
              labels={d.exams.map((e) =>
                new Date(e.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
              )}
            />
          )}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {d.exams.length} attempt{d.exams.length === 1 ? "" : "s"}
            </span>
            <Link
              to="/exam"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Take exam <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
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

      {/* Companion journey */}
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
      </div>
    </div>
  );
}

function Sparkline({ points, labels }: { points: number[]; labels: string[] }) {
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
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-24 w-full min-w-[280px]"
        preserveAspectRatio="none"
      >
        <line
          x1={pad}
          y1={pad + (h - pad * 2) * 0.15}
          x2={w - pad}
          y2={pad + (h - pad * 2) * 0.15}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <path d={area} fill="var(--primary)" opacity={0.12} />
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="var(--primary)" />
        ))}
      </svg>
      <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
        <span>{labels[0]}</span>
        {labels.length > 1 && <span>{labels[labels.length - 1]}</span>}
      </div>
    </div>
  );
}
