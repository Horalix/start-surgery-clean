import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NotebookPen, Check, X, RotateCcw, ArrowLeft, Sparkles } from "lucide-react";
import type { Question } from "@/data/questions";
import { TOPIC_BY_ID } from "@/data/topics";
import { getState, useStore } from "@/lib/study/store";
import { mistakeList } from "@/lib/study/selectors";
import type { QuestionProgress } from "@/lib/study/types";
import { QuestionRunner } from "@/components/study/QuestionRunner";
import { PageTitle, EmptyState } from "@/components/study/primitives";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/notebook")({ component: NotebookPage });

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function NotebookPage() {
  const [retry, setRetry] = useState<Question[] | null>(null);
  useStore((s) => Object.keys(s.progress).length + s.profile.xp);
  const items = mistakeList(getState());

  if (retry) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-3 gap-1.5" onClick={() => setRetry(null)}>
          <ArrowLeft className="size-4" /> Back to notebook
        </Button>
        <QuestionRunner questions={retry} mode="Mistake Retry" />
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Mistake Notebook"
        subtitle="Every question you've missed, with the correct answer, your answer, and a memory hook. Retry any of them."
        icon={<NotebookPen className="size-5" />}
        action={
          items.length > 0 && (
            <Button className="gap-2" onClick={() => setRetry(items.map((i) => i.q))}>
              <RotateCcw className="size-4" /> Retry all {items.length}
            </Button>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="No mistakes yet"
          body="When you miss a question it lands here so you can hunt down every weak point before the final."
          action={
            <Button asChild>
              <Link to="/learn">
                <Sparkles className="size-4" /> Start learning
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map(({ q, p }) => (
            <NotebookCard
              key={q.id}
              q={q}
              p={p}
              onRetry={() => setRetry([q])}
              timeAgo={timeAgo(p.lastSeenAt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotebookCard({
  q,
  p,
  onRetry,
  timeAgo,
}: {
  q: Question;
  p: QuestionProgress;
  onRetry: () => void;
  timeAgo: string;
}) {
  const topic = TOPIC_BY_ID[q.topic];
  const correctText = q.answer.map((id) => q.options.find((o) => o.id === id)!.text);
  const yourText =
    p.lastSelected.length > 0
      ? p.lastSelected.map((id) => q.options.find((o) => o.id === id)?.text ?? id)
      : ["(no recorded answer)"];
  const resolved = p.lastResult === "correct";

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">#{q.srcNo}</span>
        {q.examNo && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
            Final Q{q.examNo}
          </span>
        )}
        <span style={{ color: topic.tone }}>{topic.short}</span>
        <span className="ml-auto flex items-center gap-2 font-normal">
          <span>missed {p.incorrect}×</span>
          <span>·</span>
          <span>{timeAgo}</span>
          {resolved && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">recovered</span>
          )}
        </span>
      </div>

      <p className="mt-2 text-sm font-medium leading-snug">{q.stem}</p>

      <div className="mt-2.5 grid gap-1.5 text-sm">
        <div className="flex items-start gap-2">
          <X className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="text-muted-foreground">
            Your answer: <span className="text-foreground">{yourText.join("; ")}</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-success" />
          <span className="text-muted-foreground">
            Correct: <span className="font-medium text-foreground">{correctText.join("; ")}</span>
          </span>
        </div>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{q.explain}</p>
      {q.hook && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {q.hook}
        </p>
      )}

      <div className="mt-3">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
          <RotateCcw className="size-3.5" /> Retry this
        </Button>
      </div>
    </div>
  );
}
