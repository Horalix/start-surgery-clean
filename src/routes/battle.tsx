import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  RotateCcw,
  Shield,
  Swords,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { EXAM_QUESTIONS, type Question } from "@/data/questions";
import { TOPIC_BY_ID } from "@/data/topics";
import { grade } from "@/lib/study/types";
import { buildQueue } from "@/lib/study/selectors";
import { getState, recordAnswer, recordBattle, useStore } from "@/lib/study/store";
import { PageTitle, Ring, StatCard } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { levelProgress } from "@/lib/study/companion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/battle")({ component: BattlePage });

type Phase = "config" | "running" | "result";
type BattleMode = "accuracy" | "speed";
type Winner = "player" | "opponent" | "draw";

interface Opponent {
  name: string;
  title: string;
  accuracy: number;
  avgMs: number;
  level: number;
}

interface BattleAnswer {
  q: Question;
  selected: string[];
  correct: boolean;
  ms: number;
  opponentCorrect: boolean;
  opponentMs: number;
}

const BATTLE_SIZE = 8;

const OPPONENTS: Opponent[] = [
  { name: "Calm Intern", title: "Steady and beatable", accuracy: 0.62, avgMs: 17000, level: 3 },
  {
    name: "Fast Resident",
    title: "Good pace, occasional misses",
    accuracy: 0.74,
    avgMs: 12000,
    level: 7,
  },
  {
    name: "Chief Sprint",
    title: "High accuracy under pressure",
    accuracy: 0.84,
    avgMs: 9000,
    level: 12,
  },
];

function sumMs(items: BattleAnswer[], side: "player" | "opponent") {
  return items.reduce((total, item) => total + (side === "player" ? item.ms : item.opponentMs), 0);
}

function correctCount(items: BattleAnswer[], side: "player" | "opponent") {
  return items.filter((item) => (side === "player" ? item.correct : item.opponentCorrect)).length;
}

function winnerFor(items: BattleAnswer[], mode: BattleMode): Winner {
  const playerCorrect = correctCount(items, "player");
  const opponentCorrect = correctCount(items, "opponent");
  const playerMs = sumMs(items, "player");
  const opponentMs = sumMs(items, "opponent");

  if (mode === "accuracy") {
    if (playerCorrect !== opponentCorrect)
      return playerCorrect > opponentCorrect ? "player" : "opponent";
    if (Math.abs(playerMs - opponentMs) < 500) return "draw";
    return playerMs < opponentMs ? "player" : "opponent";
  }

  const playerScore = playerCorrect * 100000 - playerMs;
  const opponentScore = opponentCorrect * 100000 - opponentMs;
  if (Math.abs(playerScore - opponentScore) < 500) return "draw";
  return playerScore > opponentScore ? "player" : "opponent";
}

function simulatedOpponent(opponent: Opponent, mode: BattleMode) {
  const accuracy = mode === "speed" ? opponent.accuracy - 0.04 : opponent.accuracy;
  const correct = Math.random() < accuracy;
  const ms = Math.round(opponent.avgMs * (0.72 + Math.random() * 0.62));
  return { correct, ms };
}

function fmtSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function BattlePage() {
  const [phase, setPhase] = useState<Phase>("config");
  const [mode, setMode] = useState<BattleMode>("accuracy");
  const [opponentIndex, setOpponentIndex] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<BattleAnswer[]>([]);
  const startedRef = useRef(Date.now());
  const xp = useStore((s) => s.profile.xp);
  const profile = useStore((s) => s.profile);

  const opponent = OPPONENTS[opponentIndex];
  const level = levelProgress(xp).level;

  const stats = useMemo(() => {
    const playerCorrect = correctCount(answers, "player");
    const opponentCorrect = correctCount(answers, "opponent");
    const playerMs = sumMs(answers, "player");
    const opponentMs = sumMs(answers, "opponent");
    return {
      playerCorrect,
      opponentCorrect,
      playerMs,
      opponentMs,
      playerAvg: answers.length ? playerMs / answers.length : 0,
      opponentAvg: answers.length ? opponentMs / answers.length : 0,
      winner: answers.length === BATTLE_SIZE ? winnerFor(answers, mode) : "draw",
    };
  }, [answers, mode]);

  const startBattle = () => {
    const pool = buildQueue(getState(), EXAM_QUESTIONS, BATTLE_SIZE);
    setQuestions(pool);
    setIdx(0);
    setSelected([]);
    setAnswers([]);
    startedRef.current = Date.now();
    setPhase("running");
  };

  const finishWith = (nextAnswers: BattleAnswer[]) => {
    const winner = winnerFor(nextAnswers, mode);
    recordBattle(winner === "player");
    setAnswers(nextAnswers);
    setPhase("result");
  };

  const submit = () => {
    const q = questions[idx];
    if (!q || selected.length !== q.select) return;
    const ms = Date.now() - startedRef.current;
    const result = grade(q, selected);
    const opponentResult = simulatedOpponent(opponent, mode);
    recordAnswer({ qid: q.id, correct: result.correct, confidence: "confident", ms, selected });
    const nextAnswers = [
      ...answers,
      {
        q,
        selected,
        correct: result.correct,
        ms,
        opponentCorrect: opponentResult.correct,
        opponentMs: opponentResult.ms,
      },
    ];

    if (nextAnswers.length >= questions.length) {
      finishWith(nextAnswers);
      return;
    }

    setAnswers(nextAnswers);
    setIdx((i) => i + 1);
    setSelected([]);
    startedRef.current = Date.now();
  };

  const toggle = (id: string) => {
    const q = questions[idx];
    if (!q) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (q.select === 1) return [id];
      if (prev.length >= q.select) return prev;
      return [...prev, id];
    });
  };

  if (phase === "running") {
    const q = questions[idx];
    const topic = TOPIC_BY_ID[q.topic];
    const required = q.select === 1 ? "Choose 1" : `Choose ${q.select}`;
    const type = q.polarity === "incorrect" ? "incorrect" : "correct";

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Battle {idx + 1}/{questions.length}
            </div>
            <h1 className="text-xl font-bold">
              {mode === "accuracy" ? "Accuracy duel" : "Speed duel"}
            </h1>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
              You {stats.playerCorrect}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">
              {opponent.name} {stats.opponentCorrect}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
              Final Q{q.examNo}
            </span>
            <span className="rounded px-2 py-1 text-white" style={{ backgroundColor: topic.tone }}>
              {topic.short}
            </span>
            <span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
              {required} {type}
            </span>
          </div>

          <h2 className="text-lg font-semibold leading-snug sm:text-xl">{q.stem}</h2>

          <div className="mt-5 grid gap-2.5">
            {q.options.map((opt) => {
              const active = selected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/40 hover:bg-accent/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold uppercase",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {opt.id}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed sm:text-[15px]">{opt.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {selected.length}/{q.select} selected. Opponent submits after you lock the answer.
            </div>
            <Button onClick={submit} disabled={selected.length !== q.select} className="gap-2">
              Lock answer <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const won = stats.winner === "player";
    const draw = stats.winner === "draw";
    const pct = Math.round((stats.playerCorrect / BATTLE_SIZE) * 100);
    return (
      <div className="space-y-6">
        <PageTitle
          title={draw ? "Battle draw" : won ? "Battle won" : "Battle lost"}
          subtitle={`${mode === "accuracy" ? "Accuracy duel" : "Speed duel"} against ${opponent.name}`}
          icon={<Trophy className="size-5" />}
          action={
            <Button onClick={startBattle} className="gap-2">
              <RotateCcw className="size-4" /> Rematch
            </Button>
          }
        />

        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-4">
              <Companion level={level} size={72} mood={won ? "happy" : draw ? "thinking" : "sad"} />
              <div>
                <h2 className="text-xl font-bold">
                  {draw
                    ? "Dead heat"
                    : won
                      ? "You controlled the round"
                      : "The opponent edged this one"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  You: {stats.playerCorrect}/{BATTLE_SIZE}, avg {fmtSeconds(stats.playerAvg)}.{" "}
                  {opponent.name}: {stats.opponentCorrect}/{BATTLE_SIZE}, avg{" "}
                  {fmtSeconds(stats.opponentAvg)}.
                </p>
              </div>
            </div>
            <Ring
              value={pct}
              tone={won ? "var(--success)" : draw ? "var(--warning)" : "var(--destructive)"}
              label={<span className="text-3xl font-bold tabular-nums">{pct}%</span>}
              sublabel={<span className="text-[11px] text-muted-foreground">accuracy</span>}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard
            label="Your correct"
            value={stats.playerCorrect}
            tone={won ? "success" : "default"}
          />
          <StatCard label="Opponent correct" value={stats.opponentCorrect} />
          <StatCard
            label="Your total time"
            value={fmtSeconds(stats.playerMs)}
            icon={<Clock className="size-4" />}
          />
          <StatCard
            label="Record"
            value={`${profile.battlesWon}/${profile.battlesPlayed}`}
            hint="wins played"
            icon={<Swords className="size-4" />}
          />
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Round review</h2>
          <div className="space-y-2">
            {answers.map((a, i) => (
              <div
                key={a.q.id}
                className="flex items-center gap-3 rounded-lg border bg-background p-2.5"
              >
                <span className="w-7 shrink-0 text-xs font-bold text-muted-foreground">
                  #{i + 1}
                </span>
                {a.correct ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <X className="size-4 text-destructive" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{a.q.stem}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {fmtSeconds(a.ms)}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                    a.opponentCorrect
                      ? "bg-success/15 text-success"
                      : "bg-destructive/15 text-destructive",
                  )}
                >
                  {opponent.name.split(" ")[0]} {a.opponentCorrect ? "hit" : "miss"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Battle Arena"
        subtitle="A focused quiz match mode: beat an opponent by answering more correctly, or by answering correctly faster."
        icon={<Swords className="size-5" />}
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Match setup</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setMode("accuracy")}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-colors",
                mode === "accuracy"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent",
              )}
            >
              <Target className="mb-3 size-5 text-primary" />
              <div className="font-semibold">Accuracy duel</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Most correct wins. Speed breaks ties.
              </p>
            </button>
            <button
              onClick={() => setMode("speed")}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-colors",
                mode === "speed" ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
              )}
            >
              <Zap className="mb-3 size-5 text-primary" />
              <div className="font-semibold">Speed duel</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Correct answers score heavily; time pressure matters.
              </p>
            </button>
          </div>

          <h3 className="mt-6 text-sm font-semibold">Opponent</h3>
          <div className="mt-2 grid gap-2">
            {OPPONENTS.map((item, i) => (
              <button
                key={item.name}
                onClick={() => setOpponentIndex(i)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors",
                  opponentIndex === i
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent",
                )}
              >
                <Companion level={item.level} size={42} bob={false} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.title}</div>
                </div>
                <span className="rounded bg-muted px-2 py-1 text-xs font-semibold">
                  {Math.round(item.accuracy * 100)}%
                </span>
              </button>
            ))}
          </div>

          <Button size="lg" className="mt-6 w-full gap-2" onClick={startBattle}>
            Start {BATTLE_SIZE}-question battle <ArrowRight className="size-4" />
          </Button>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Companion level={level} size={58} />
              <div>
                <h2 className="text-base font-semibold">Your battle record</h2>
                <p className="text-sm text-muted-foreground">
                  {profile.battlesWon} wins in {profile.battlesPlayed} match
                  {profile.battlesPlayed === 1 ? "" : "es"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border bg-background p-3">
                <div className="text-xs font-medium text-muted-foreground">Wins</div>
                <div className="mt-1 text-2xl font-bold text-success">{profile.battlesWon}</div>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <div className="text-xs font-medium text-muted-foreground">Played</div>
                <div className="mt-1 text-2xl font-bold">{profile.battlesPlayed}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 text-primary" />
              Online battles
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Local battles work now. Use the Supabase setup document to turn the same room model
              into live multiplayer through Lovable.
            </p>
            <Button asChild variant="outline" className="mt-4 w-full gap-2">
              <a href="/SUPABASE_BATTLE_SETUP.md">
                View setup notes <Shield className="size-4" />
              </a>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
