import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Library, Check, X, ChevronDown, Play, ArrowLeft, Search, Flag, Info } from "lucide-react";
import { QUESTIONS, type Question, type TopicId } from "@/data/questions";
import { TOPICS, TOPIC_BY_ID } from "@/data/topics";
import { getState, useStore } from "@/lib/study/store";
import { questionsForFilter, type BankFilter } from "@/lib/study/selectors";
import { masteryStrength } from "@/lib/study/srs";
import { instruction } from "@/lib/study/instruction";
import { QuestionRunner } from "@/components/study/QuestionRunner";
import { PageTitle, EmptyState } from "@/components/study/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BankSearch {
  filter?: string;
  topic?: TopicId;
}

export const Route = createFileRoute("/bank")({
  validateSearch: (s: Record<string, unknown>): BankSearch => ({
    filter: typeof s.filter === "string" ? s.filter : undefined,
    topic: typeof s.topic === "string" ? (s.topic as TopicId) : undefined,
  }),
  component: BankPage,
});

const QUICK_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All 156" },
  { key: "exam", label: "Final 74" },
  { key: "abd", label: "Abdominal" },
  { key: "tx", label: "Transfusion" },
  { key: "never", label: "Never answered" },
  { key: "missed", label: "Previously missed" },
  { key: "low-confidence", label: "Low confidence" },
  { key: "unmastered", label: "Not mastered" },
  { key: "mastered", label: "Mastered" },
  { key: "flagged", label: "Flagged" },
];

function BankPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/bank" });
  const [practice, setPractice] = useState<Question[] | null>(null);
  const [query, setQuery] = useState("");
  const tick = useStore(
    (s) => s.profile.xp + Object.keys(s.progress).length + Object.keys(s.flagged).length,
  );

  const activeTopic = search.topic;
  const activeFilter = (search.filter as BankFilter) ?? "all";

  const list = useMemo(() => {
    const s = getState();
    let qs: Question[];
    if (activeTopic) qs = questionsForFilter(s, { topic: activeTopic });
    else qs = questionsForFilter(s, activeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      qs = qs.filter(
        (x) =>
          x.stem.toLowerCase().includes(q) ||
          x.options.some((o) => o.text.toLowerCase().includes(q)),
      );
    }
    return qs.sort((a, b) =>
      a.section === b.section ? a.srcNo - b.srcNo : a.section === "abd" ? -1 : 1,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic, activeFilter, query, tick]);

  if (practice) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 gap-1.5"
          onClick={() => setPractice(null)}
        >
          <ArrowLeft className="size-4" /> Back to bank
        </Button>
        <QuestionRunner questions={practice} mode="Master Bank" />
      </div>
    );
  }

  const setFilter = (filter: string) => navigate({ search: { filter, topic: undefined } });
  const setTopic = (topic: TopicId | undefined) =>
    navigate({ search: { topic, filter: undefined } });

  return (
    <div>
      <PageTitle
        title="Master Bank"
        subtitle="Every source question, browsable and practisable. Answers are shown here for reference — use practice for testing."
        icon={<Library className="size-5" />}
        action={
          list.length > 0 && (
            <Button className="gap-2" onClick={() => setPractice(list.slice())}>
              <Play className="size-4" /> Practice {list.length}
            </Button>
          )
        }
      />

      {/* search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search question text…"
          className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* quick filters */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !activeTopic && activeFilter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {/* topics */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTopic(activeTopic === t.id ? undefined : t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeTopic === t.id
                ? "text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
            style={
              activeTopic === t.id ? { backgroundColor: t.tone, borderColor: t.tone } : undefined
            }
          >
            {t.short}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No questions here yet"
          body="Try a different filter or clear your search."
        />
      ) : (
        <div className="space-y-2">
          {list.map((q) => (
            <BankRow key={q.id} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function BankRow({ q }: { q: Question }) {
  const [open, setOpen] = useState(false);
  const p = useStore((s) => s.progress[q.id]);
  const flagged = useStore((s) => !!s.flagged[q.id]);
  const strength = masteryStrength(p);
  const topic = TOPIC_BY_ID[q.topic];
  const inst = instruction(q);

  const status =
    !p || p.seen === 0
      ? "new"
      : p.mastered
        ? "mastered"
        : p.lastResult === "incorrect"
          ? "missed"
          : "learning";
  const dot = {
    new: "bg-muted-foreground/40",
    learning: "bg-warning",
    missed: "bg-destructive",
    mastered: "bg-success",
  }[status];

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-accent/40"
      >
        <span className={cn("size-2.5 shrink-0 rounded-full", dot)} title={status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">#{q.srcNo}</span>
            {q.examNo && (
              <span className="rounded bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                Q{q.examNo}
              </span>
            )}
            {flagged && <Flag className="size-3 text-primary" />}
            {q.flag && <Info className="size-3 text-warning" />}
            <span className="text-xs" style={{ color: topic.tone }}>
              {topic.short}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium">{q.stem}</p>
        </div>
        {p && p.seen > 0 && (
          <span className="hidden shrink-0 text-xs font-medium tabular-nums text-muted-foreground sm:block">
            {Math.round(strength * 100)}%
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t bg-background/50 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {inst.text}
          </div>
          <div className="space-y-1.5">
            {q.options.map((o) => {
              const isAns = q.answer.includes(o.id);
              return (
                <div
                  key={o.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-2.5 text-sm",
                    isAns ? "border-success/50 bg-success/10" : "border-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold uppercase",
                      isAns
                        ? "border-success bg-success text-success-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {isAns ? <Check className="size-3.5" /> : o.id}
                  </span>
                  <span className="pt-0.5">{o.text}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{q.explain}</p>
          {q.hook && <p className="mt-2 text-xs font-medium text-primary">💡 {q.hook}</p>}
          {q.nuance && (
            <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning-foreground">
              <strong>Clinical nuance:</strong> {q.nuance}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export { QUESTIONS };
