import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  X,
  Flag,
  HelpCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Info,
  Timer,
  Flame,
} from "lucide-react";
import type { Question } from "@/data/questions";
import { TOPIC_BY_ID } from "@/data/topics";
import { grade, CONFIDENCE_META, type Confidence } from "@/lib/study/types";
import { instruction } from "@/lib/study/instruction";
import { comboLabel } from "@/lib/study/gamify";
import {
  recordAnswer,
  getLastReward,
  logSession,
  toggleFlag,
  toggleNotUnderstood,
  useStore,
} from "@/lib/study/store";
import { levelProgress } from "@/lib/study/companion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Companion } from "./Companion";

const CONF_ORDER: Confidence[] = ["guess", "unsure", "confident", "certain"];
const DIFF_LABEL = { 1: "Foundational", 2: "Moderate", 3: "Tricky" } as const;

export function QuestionRunner({
  questions,
  mode,
  rapid = false,
  onComplete,
}: {
  questions: Question[];
  mode: string;
  rapid?: boolean;
  onComplete?: (result: { total: number; correct: number }) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef<number>(Date.now());

  const [reward, setReward] = useState<{ baseXp: number; comboXp: number } | null>(null);

  const q = questions[idx];
  const flagged = useStore((s) => (q ? !!s.flagged[q.id] : false));
  const notUnderstood = useStore((s) => (q ? !!s.notUnderstood[q.id] : false));
  const xp = useStore((s) => s.profile.xp);
  const combo = useStore((s) => s.profile.combo);

  const result = useMemo(
    () => (revealed && q ? grade(q, selected) : null),
    [revealed, q, selected],
  );

  const reset = useCallback(() => {
    setSelected([]);
    setConfidence(null);
    setRevealed(false);
    setReward(null);
    startRef.current = Date.now();
  }, []);

  const toggleOption = useCallback(
    (id: string) => {
      if (revealed || !q) return;
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (q.select === 1) return [id];
        if (prev.length >= q.select) return prev; // cannot exceed required count
        return [...prev, id];
      });
    },
    [revealed, q],
  );

  const submit = useCallback(
    (conf: Confidence) => {
      if (!q || revealed || selected.length !== q.select) return;
      const ms = Date.now() - startRef.current;
      const g = grade(q, selected);
      setConfidence(conf);
      setRevealed(true);
      if (g.correct) setCorrectCount((c) => c + 1);
      recordAnswer({ qid: q.id, correct: g.correct, confidence: conf, ms, selected });
      const r = getLastReward();
      setReward(r ? { baseXp: r.baseXp, comboXp: r.comboXp } : null);
      if (rapid) {
        window.setTimeout(() => advance(g.correct), g.correct ? 750 : 1600);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, revealed, selected, rapid],
  );

  const advance = useCallback(
    (_lastCorrect?: boolean) => {
      if (idx + 1 >= questions.length) {
        setDone(true);
        logSession({ mode, total: questions.length, correct: correctCountRef.current });
        onComplete?.({ total: questions.length, correct: correctCountRef.current });
        return;
      }
      setIdx((i) => i + 1);
      reset();
    },
    [idx, questions.length, mode, reset, onComplete],
  );

  // keep a ref of correctCount for the completion callback closure
  const correctCountRef = useRef(0);
  useEffect(() => {
    correctCountRef.current = correctCount;
  }, [correctCount]);

  // keyboard
  useEffect(() => {
    if (done) return;
    const handler = (e: KeyboardEvent) => {
      if (!q) return;
      const key = e.key.toLowerCase();
      if (revealed) {
        if (key === "enter" || key === " ") {
          e.preventDefault();
          advance();
        }
        return;
      }
      // option letters (a–e) toggle answers
      const opt = q.options.find((o) => o.id === key);
      if (opt) {
        e.preventDefault();
        toggleOption(opt.id);
        return;
      }
      // number keys 1–4 pick confidence once the selection is complete
      if (/^[1-4]$/.test(key) && selected.length === q.select) {
        e.preventDefault();
        submit(CONF_ORDER[parseInt(key, 10) - 1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [q, revealed, selected, done, toggleOption, submit, advance]);

  if (done) {
    return <SessionSummary total={questions.length} correct={correctCount} mode={mode} />;
  }
  if (!q) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        No questions match this set. Try another mode or filter.
      </div>
    );
  }

  const topic = TOPIC_BY_ID[q.topic];
  const inst = instruction(q);
  const canConfirm = selected.length === q.select;
  const level = levelProgress(xp).level;

  return (
    <div className="animate-pop-in">
      {/* progress */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(idx / questions.length) * 100}%` }}
          />
        </div>
        {combo >= 3 && (
          <span
            className={cn(
              "xp-pulse flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
              combo >= 10
                ? "bg-orange-500/20 text-orange-500"
                : combo >= 5
                  ? "bg-amber-500/20 text-amber-600"
                  : "bg-primary/15 text-primary",
            )}
            title="Consecutive correct answers"
          >
            <Flame className="size-3.5" /> x{combo}
            {comboLabel(combo) && <span className="hidden sm:inline">· {comboLabel(combo)}</span>}
          </span>
        )}
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {idx + 1} / {questions.length}
        </span>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        {/* meta row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor: `color-mix(in oklch, ${topic.tone} 16%, transparent)`,
              color: topic.tone,
            }}
          >
            {topic.short}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {DIFF_LABEL[q.difficulty]}
          </span>
          {q.examNo != null && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              Final Q{q.examNo}
            </span>
          )}
          <span className="ml-auto text-xs font-medium text-muted-foreground">Bank #{q.srcNo}</span>
        </div>

        {/* instruction pill */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
          {q.polarity === "incorrect" ? (
            <X className="size-3.5 text-destructive" />
          ) : (
            <Check className="size-3.5 text-success" />
          )}
          {inst.text}
        </div>

        {/* stem */}
        <h2 className="mb-5 text-lg font-semibold leading-snug text-foreground sm:text-xl">
          {q.stem}
        </h2>

        {/* options */}
        <div className="grid gap-2.5">
          {q.options.map((opt) => {
            const isSel = selected.includes(opt.id);
            const isAnswer = q.answer.includes(opt.id);
            let state: "idle" | "sel" | "correct" | "wrong" | "missed" = "idle";
            if (!revealed) state = isSel ? "sel" : "idle";
            else if (isSel && isAnswer) state = "correct";
            else if (isSel && !isAnswer) state = "wrong";
            else if (!isSel && isAnswer) state = "missed";
            return (
              <button
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                disabled={revealed}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all sm:p-4",
                  "disabled:cursor-default",
                  state === "idle" &&
                    "border-border bg-background hover:border-primary/40 hover:bg-accent/50",
                  state === "sel" && "border-primary bg-primary/5",
                  state === "correct" && "border-success bg-success/10",
                  state === "wrong" && "border-destructive bg-destructive/10",
                  state === "missed" && "border-success/60 bg-success/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold uppercase transition-colors",
                    state === "idle" &&
                      "border-border text-muted-foreground group-hover:border-primary/50",
                    state === "sel" && "border-primary bg-primary text-primary-foreground",
                    state === "correct" && "border-success bg-success text-success-foreground",
                    state === "wrong" &&
                      "border-destructive bg-destructive text-destructive-foreground",
                    state === "missed" && "border-success bg-success/20 text-success",
                  )}
                >
                  {state === "correct" || state === "missed" ? (
                    <Check className="size-4" />
                  ) : state === "wrong" ? (
                    <X className="size-4" />
                  ) : (
                    opt.id
                  )}
                </span>
                <span className="flex-1 pt-0.5 text-sm leading-relaxed text-foreground sm:text-[15px]">
                  {opt.text}
                  {state === "missed" && (
                    <span className="ml-2 text-xs font-semibold text-success">
                      ← correct answer
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* confidence / submit */}
        {!revealed && (
          <div
            className={cn(
              "mt-5 rounded-xl border bg-secondary/40 p-3 transition-opacity",
              canConfirm ? "opacity-100" : "pointer-events-none opacity-45",
            )}
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5" />
              {canConfirm
                ? "How sure are you? (this schedules your reviews)"
                : `Select ${q.select - selected.length} more to answer`}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CONF_ORDER.map((c, i) => (
                <button
                  key={c}
                  disabled={!canConfirm}
                  onClick={() => submit(c)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg border-2 border-transparent bg-background px-2 py-2.5 text-sm font-semibold shadow-sm transition-all hover:border-primary hover:bg-primary/5",
                    "disabled:cursor-not-allowed",
                  )}
                >
                  <span>{CONFIDENCE_META[c].label}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    press {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* feedback */}
        {revealed && result && (
          <Feedback
            q={q}
            result={result}
            confidence={confidence}
            flagged={flagged}
            notUnderstood={notUnderstood}
            onNext={() => advance()}
            onRetry={reset}
            rapid={rapid}
            level={level}
            reward={reward}
            combo={combo}
            isLast={idx + 1 >= questions.length}
          />
        )}
      </div>
    </div>
  );
}

function Feedback({
  q,
  result,
  confidence,
  flagged,
  notUnderstood,
  onNext,
  onRetry,
  rapid,
  level,
  reward,
  combo,
  isLast,
}: {
  q: Question;
  result: ReturnType<typeof grade>;
  confidence: Confidence | null;
  flagged: boolean;
  notUnderstood: boolean;
  onNext: () => void;
  onRetry: () => void;
  rapid: boolean;
  level: number;
  reward: { baseXp: number; comboXp: number } | null;
  combo: number;
  isLast: boolean;
}) {
  const good = result.correct;
  const dangerous = !good && confidence && (confidence === "confident" || confidence === "certain");
  const totalXp = reward ? reward.baseXp + reward.comboXp : 0;

  return (
    <div className="mt-5 animate-pop-in">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border-2 p-4",
          good ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10",
        )}
      >
        <div className="shrink-0">
          <Companion level={level} size={44} mood={good ? "happy" : "sad"} bob={false} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-bold">
            {good ? (
              <span className="text-success">Correct</span>
            ) : (
              <span className="text-destructive">Not quite</span>
            )}
            {good && reward && (
              <span className="xp-pulse rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                +{totalXp} XP
                {reward.comboXp > 0 && (
                  <span className="text-orange-500">
                    {" "}
                    (+{reward.comboXp} combo x{combo})
                  </span>
                )}
              </span>
            )}
            {dangerous && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                Dangerous confidence — you were sure
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{q.explain}</p>

          {!good && result.wrongSelected.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Your pick{result.wrongSelected.length > 1 ? "s" : ""}{" "}
              <strong className="uppercase">{result.wrongSelected.join(", ")}</strong>{" "}
              {result.wrongSelected.length > 1 ? "are" : "is"} not part of the correct selection.
            </p>
          )}

          {q.hook && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 text-xs font-medium text-foreground">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>{q.hook}</span>
            </p>
          )}

          {q.nuance && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>
                <strong>Clinical nuance:</strong> {q.nuance}
              </span>
            </p>
          )}
        </div>
      </div>

      {!rapid && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={onNext} className="gap-2">
            {isLast ? "Finish" : "Next"}
            <ArrowRight className="size-4" />
            <kbd className="ml-1 hidden rounded bg-primary-foreground/20 px-1.5 text-[10px] sm:inline">
              ↵
            </kbd>
          </Button>
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Retry
          </Button>
          <button
            onClick={() => toggleNotUnderstood(q.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              notUnderstood
                ? "border-warning bg-warning/15 text-warning-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            <HelpCircle className="size-3.5" />
            {notUnderstood ? "Marked unclear" : "Still unclear"}
          </button>
          <button
            onClick={() => toggleFlag(q.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              flagged
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            <Flag className="size-3.5" />
            {flagged ? "Flagged" : "Flag ambiguous"}
          </button>
          {q.flag && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning-foreground">
              Source item flagged: {q.flag}
            </span>
          )}
        </div>
      )}
      {rapid && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="size-3.5" />
          Advancing…
        </div>
      )}
    </div>
  );
}

function SessionSummary({
  total,
  correct,
  mode,
}: {
  total: number;
  correct: number;
  mode: string;
}) {
  const xp = useStore((s) => s.profile.xp);
  const level = levelProgress(xp).level;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const great = pct >= 80;
  return (
    <div className="animate-pop-in rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 flex size-24 items-center justify-center rounded-2xl bg-primary/10">
        <Companion level={level} size={84} mood={great ? "happy" : "thinking"} />
      </div>
      <h2 className="text-2xl font-bold">Session complete</h2>
      <p className="mt-1 text-muted-foreground">
        {mode} · {correct} of {total} fully correct
      </p>
      <div className="mx-auto mt-5 max-w-xs">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              great ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums">{pct}%</p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/drill">Drill my weak spots</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Back to Today</Link>
        </Button>
      </div>
    </div>
  );
}
