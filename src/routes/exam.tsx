import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck,
  Timer,
  TimerOff,
  ChevronLeft,
  ChevronRight,
  Flag,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { EXAM_QUESTIONS, type Question } from "@/data/questions";
import { TOPIC_BY_ID } from "@/data/topics";
import { grade, CONFIDENCE_META, type Confidence } from "@/lib/study/types";
import { recordAnswer, logExam, useStore } from "@/lib/study/store";
import { instruction } from "@/lib/study/instruction";
import { PageTitle, StatCard, Ring } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { levelProgress } from "@/lib/study/companion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncExamAttempt } from "@/lib/study/exam.functions";

export const Route = createFileRoute("/exam")({ component: ExamPage });

type Phase = "config" | "running" | "review";
interface Answer {
  selected: string[];
  confidence: Confidence | null;
  review: boolean;
}

function ExamPage() {
  const [phase, setPhase] = useState<Phase>("config");
  const [timed, setTimed] = useState(true);
  const defMinutes = useStore((s) => s.settings.examTimerMinutes);
  const [minutes, setMinutes] = useState(defMinutes);

  if (phase === "config") {
    return (
      <ExamConfig
        timed={timed}
        setTimed={setTimed}
        minutes={minutes}
        setMinutes={setMinutes}
        onStart={() => setPhase("running")}
      />
    );
  }
  if (phase === "running") {
    return <ExamRunner timed={timed} minutes={minutes} onFinish={() => setPhase("review")} />;
  }
  return <ExamReviewGate onRetake={() => setPhase("config")} />;
}

function ExamConfig({
  timed,
  setTimed,
  minutes,
  setMinutes,
  onStart,
}: {
  timed: boolean;
  setTimed: (v: boolean) => void;
  minutes: number;
  setMinutes: (v: number) => void;
  onStart: () => void;
}) {
  const best = useStore((s) => s.profile.bestExamScore);
  const attempts = useStore((s) => s.examAttempts.length);
  return (
    <div>
      <PageTitle
        title="Exam Simulation"
        subtitle="An exact replica of the TEST SURGERY 1 — FINAL: 74 questions, original order, numbering, and instructions."
        icon={<ClipboardCheck className="size-5" />}
      />
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Questions" value={74} />
          <StatCard
            label="Best score"
            value={best == null ? "—" : `${best}/74`}
            tone={best ? "success" : "default"}
          />
          <StatCard label="Attempts" value={attempts} />
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">Timer</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => setTimed(true)}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 p-3 text-left text-sm font-medium transition-colors",
                timed ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
              )}
            >
              <Timer className="size-4 text-primary" />
              Timed
            </button>
            <button
              onClick={() => setTimed(false)}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 p-3 text-left text-sm font-medium transition-colors",
                !timed ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
              )}
            >
              <TimerOff className="size-4" />
              Untimed
            </button>
          </div>
          {timed && (
            <div className="mt-3 flex items-center gap-2">
              {[45, 60, 90].map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className={cn(
                    "flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-colors",
                    minutes === m
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="mt-6 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            No feedback until you submit — just like the real final.
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            Navigator tracks answered, flagged, and to-review questions.
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            Multi-answer and "select the incorrect" items are graded exactly.
          </li>
        </ul>

        <Button size="lg" className="mt-6 w-full gap-2" onClick={onStart}>
          Begin exam <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Persist last result across the running→review transition via a module ref.
let lastExamResult: ExamResult | null = null;

interface ExamResult {
  score: number;
  total: number;
  durationMs: number;
  timed: boolean;
  items: {
    examNo: number;
    q: Question;
    selected: string[];
    correct: boolean;
    confidence: Confidence | null;
  }[];
}

function ExamRunner({
  timed,
  minutes,
  onFinish,
}: {
  timed: boolean;
  minutes: number;
  onFinish: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [cur, setCur] = useState(0);
  const [remaining, setRemaining] = useState(minutes * 60);
  const [confirming, setConfirming] = useState(false);
  const startRef = useRef(Date.now());
  const syncExam = useServerFn(syncExamAttempt);

  const q = EXAM_QUESTIONS[cur];
  const a = answers[q.examNo!] ?? { selected: [], confidence: null, review: false };

  const finish = useCallback(() => {
    const durationMs = Date.now() - startRef.current;
    const items = EXAM_QUESTIONS.map((eq) => {
      const ans = answers[eq.examNo!] ?? { selected: [], confidence: null, review: false };
      const g = grade(eq, ans.selected);
      recordAnswer({
        qid: eq.id,
        correct: g.correct,
        confidence: ans.confidence ?? "unsure",
        ms: 30000,
        selected: ans.selected,
      });
      return {
        examNo: eq.examNo!,
        q: eq,
        selected: ans.selected,
        correct: g.correct,
        confidence: ans.confidence,
      };
    });
    const score = items.filter((i) => i.correct).length;
    lastExamResult = { score, total: EXAM_QUESTIONS.length, durationMs, timed, items };
    logExam({
      score,
      total: EXAM_QUESTIONS.length,
      durationMs,
      timed,
      perQuestion: items.map((i) => ({
        examNo: i.examNo,
        qid: i.q.id,
        correct: i.correct,
        confidence: i.confidence,
      })),
    });
    void syncExam({
      data: {
        answers: items.map((item) => ({ examNo: item.examNo, selected: item.selected })),
      },
    });
    onFinish();
  }, [answers, timed, onFinish, syncExam]);

  // timer
  useEffect(() => {
    if (!timed) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timed, finish]);

  const setAnswer = (patch: Partial<Answer>) =>
    setAnswers((prev) => ({ ...prev, [q.examNo!]: { ...a, ...patch } }));

  const toggle = (id: string) => {
    if (a.selected.includes(id)) setAnswer({ selected: a.selected.filter((x) => x !== id) });
    else if (q.select === 1) setAnswer({ selected: [id] });
    else if (a.selected.length < q.select) setAnswer({ selected: [...a.selected, id] });
  };

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (confirming) return;
      const k = e.key.toLowerCase();
      const opt = q.options.find((o) => o.id === k);
      if (opt) {
        e.preventDefault();
        toggle(opt.id);
      } else if (k === "arrowright") setCur((c) => Math.min(EXAM_QUESTIONS.length - 1, c + 1));
      else if (k === "arrowleft") setCur((c) => Math.max(0, c - 1));
      else if (k === "f") setAnswer({ review: !a.review });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const answeredCount = Object.values(answers).filter((x) => x.selected.length > 0).length;
  const inst = instruction(q);
  const topic = TOPIC_BY_ID[q.topic];

  return (
    <div>
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">TEST SURGERY 1 — FINAL</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {answeredCount}/74 answered
          </span>
        </div>
        <div className="flex items-center gap-2">
          {timed && (
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums",
                remaining < 300
                  ? "bg-destructive/15 text-destructive"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <Timer className="size-3.5" />
              {fmtTime(remaining)}
            </span>
          )}
          <Button size="sm" onClick={() => setConfirming(true)}>
            Submit
          </Button>
        </div>
      </div>

      {/* Question */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-muted-foreground">Question {q.examNo}</span>
          <button
            onClick={() => setAnswer({ review: !a.review })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              a.review
                ? "border-warning bg-warning/15 text-warning-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            <Flag className="size-3.5" />
            {a.review ? "Marked" : "Mark for review"}
          </button>
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
          {q.polarity === "incorrect" ? (
            <X className="size-3.5 text-destructive" />
          ) : (
            <Check className="size-3.5 text-success" />
          )}
          {inst.text}
        </div>

        <h2 className="mb-5 text-lg font-semibold leading-snug sm:text-xl">{q.stem}</h2>

        <div className="grid gap-2.5">
          {q.options.map((opt) => {
            const sel = a.selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggle(opt.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all",
                  sel
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/40 hover:bg-accent/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold uppercase",
                    sel
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {opt.id}
                </span>
                <span className="flex-1 pt-0.5 text-sm leading-relaxed sm:text-[15px]">
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>

        {/* optional confidence (kept subtle to preserve exam feel) */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Confidence (optional):</span>
          {(["guess", "unsure", "confident", "certain"] as Confidence[]).map((c) => (
            <button
              key={c}
              onClick={() => setAnswer({ confidence: a.confidence === c ? null : c })}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                a.confidence === c
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {CONFIDENCE_META[c].short}
            </button>
          ))}
        </div>

        {/* nav */}
        <div className="mt-5 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={cur === 0}
            onClick={() => setCur((c) => c - 1)}
            className="gap-1"
          >
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground" style={{ color: topic.tone }}>
            {topic.short}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={cur === EXAM_QUESTIONS.length - 1}
            onClick={() => setCur((c) => c + 1)}
            className="gap-1"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Navigator */}
      <div className="mt-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide">Navigator</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded bg-primary" /> answered
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded bg-warning" /> review
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded bg-muted" /> empty
            </span>
          </span>
        </div>
        <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-[repeat(19,minmax(0,1fr))]">
          {EXAM_QUESTIONS.map((eq, i) => {
            const ans = answers[eq.examNo!];
            const answered = ans && ans.selected.length > 0;
            const review = ans?.review;
            return (
              <button
                key={eq.examNo}
                onClick={() => setCur(i)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-all",
                  i === cur && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                  review
                    ? "bg-warning/25 text-warning-foreground"
                    : answered
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {eq.examNo}
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setConfirming(false)}
          />
          <div className="relative w-full max-w-sm animate-pop-in rounded-2xl border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-bold">Submit exam?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You've answered <strong>{answeredCount}</strong> of 74.
              {answeredCount < 74 && (
                <span className="text-destructive">
                  {" "}
                  {74 - answeredCount} unanswered will be marked wrong.
                </span>
              )}
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
                Keep working
              </Button>
              <Button className="flex-1" onClick={finish}>
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamReviewGate({ onRetake }: { onRetake: () => void }) {
  if (!lastExamResult) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
        No exam result to show.{" "}
        <button className="text-primary underline" onClick={onRetake}>
          Take the exam
        </button>
        .
      </div>
    );
  }
  return <ExamReview result={lastExamResult} onRetake={onRetake} />;
}

function ExamReview({ result, onRetake }: { result: ExamResult; onRetake: () => void }) {
  const xp = useStore((s) => s.profile.xp);
  const level = levelProgress(xp).level;
  const pct = Math.round((result.score / result.total) * 100);
  const passed = pct >= 60;
  const excellent = pct >= 85;

  const byTopic = useMemo(() => {
    const map = new Map<string, { label: string; tone: string; total: number; correct: number }>();
    for (const item of result.items) {
      const t = TOPIC_BY_ID[item.q.topic];
      const e = map.get(t.id) ?? { label: t.short, tone: t.tone, total: 0, correct: 0 };
      e.total++;
      if (item.correct) e.correct++;
      map.set(t.id, e);
    }
    return [...map.values()].sort((a, b) => a.correct / a.total - b.correct / b.total);
  }, [result]);

  const mistakes = result.items.filter((i) => !i.correct);
  const confidentMistakes = mistakes.filter(
    (i) => i.confidence === "confident" || i.confidence === "certain",
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Companion
              level={level}
              size={72}
              mood={excellent ? "happy" : passed ? "idle" : "sad"}
            />
            <div>
              <h1 className="text-2xl font-bold">Exam complete</h1>
              <p className="text-sm text-muted-foreground">
                {result.score} / {result.total} correct ·{" "}
                {result.timed ? `${Math.round(result.durationMs / 60000)} min` : "untimed"}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-semibold",
                  excellent ? "text-success" : passed ? "text-primary" : "text-destructive",
                )}
              >
                {excellent
                  ? "Excellent — exam ready"
                  : passed
                    ? "Passing, keep polishing"
                    : "Below passing — drill the gaps"}
              </p>
            </div>
          </div>
          <Ring
            value={pct}
            tone={excellent ? "var(--success)" : passed ? "var(--primary)" : "var(--destructive)"}
            label={<span className="text-3xl font-bold tabular-nums">{pct}%</span>}
            sublabel={<span className="text-[11px] text-muted-foreground">score</span>}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onRetake} className="gap-2">
            <RotateCcw className="size-4" /> Retake exam
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/drill">
              <ArrowRight className="size-4" /> Drill my {mistakes.length} mistakes
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Correct" value={result.score} tone="success" />
        <StatCard
          label="Mistakes"
          value={mistakes.length}
          tone={mistakes.length ? "danger" : "success"}
        />
        <StatCard
          label="Confident errors"
          value={confidentMistakes.length}
          tone={confidentMistakes.length ? "danger" : "success"}
          hint="wrong while sure"
        />
        <StatCard label="Score" value={`${pct}%`} tone={excellent ? "success" : "primary"} />
      </div>

      {/* Topic breakdown */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Topic breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {byTopic.map((t) => (
            <TopicScore key={t.label} {...t} />
          ))}
        </div>
      </div>

      {/* Mistakes */}
      {mistakes.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold">Review your {mistakes.length} mistakes</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Correct answers and reasoning — study these before your next attempt.
          </p>
          <div className="space-y-3">
            {mistakes.map((m) => (
              <MistakeItem key={m.examNo} item={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopicScore({
  label,
  tone,
  total,
  correct,
}: {
  label: string;
  tone: string;
  total: number;
  correct: number;
}) {
  const pct = Math.round((correct / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {correct}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tone }} />
      </div>
    </div>
  );
}

function MistakeItem({
  item,
}: {
  item: { examNo: number; q: Question; selected: string[]; confidence: Confidence | null };
}) {
  const q = item.q;
  const correctText = q.answer.map((id) => q.options.find((o) => o.id === id)!.text);
  const yourText =
    item.selected.length === 0
      ? ["(left blank)"]
      : item.selected.map((id) => q.options.find((o) => o.id === id)!.text);
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">Q{item.examNo}</span>
        <span>{TOPIC_BY_ID[q.topic].short}</span>
        {(item.confidence === "confident" || item.confidence === "certain") && (
          <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
            <AlertTriangle className="size-3" /> confident error
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium">{q.stem}</p>
      <div className="mt-2 grid gap-1.5 text-sm">
        <div className="flex items-start gap-2">
          <X className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="text-muted-foreground">
            You: <span className="text-foreground">{yourText.join("; ")}</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-success" />
          <span className="text-muted-foreground">
            Correct: <span className="font-medium text-foreground">{correctText.join("; ")}</span>
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{q.explain}</p>
      {q.nuance && (
        <p className="mt-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning-foreground">
          <strong>Clinical nuance:</strong> {q.nuance}
        </p>
      )}
    </div>
  );
}
