import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Flag,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { EXAM_QUESTIONS, QUESTIONS } from "@/data/questions";
import { TOPIC_BY_ID } from "@/data/topics";
import { integrityReport } from "@/lib/study/selectors";
import { PageTitle, StatCard } from "@/components/study/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/integrity")({ component: IntegrityPage });

function examNoAudit() {
  const nums = EXAM_QUESTIONS.map((q) => q.examNo!).sort((a, b) => a - b);
  const missing = Array.from({ length: 74 }, (_, i) => i + 1).filter((n) => !nums.includes(n));
  const duplicate = nums.filter((n, i) => nums.indexOf(n) !== i);
  return { nums, missing, duplicate };
}

function IntegrityPage() {
  const report = integrityReport();
  const exam = examNoAudit();
  const passed = report.checks.filter((c) => c.ok).length;
  const failed = report.checks.length - passed;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Content Integrity"
        subtitle="Admin audit for the fixed Surgery I source bank, exam replica, answer keys, and flagged nuance items."
        icon={<ShieldCheck className="size-5" />}
        action={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/bank">
              Review bank <ExternalLink className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Abdominal"
          value={report.abdCount}
          hint="required 146"
          tone={report.abdCount === 146 ? "success" : "danger"}
        />
        <StatCard
          label="Transfusion"
          value={report.txCount}
          hint="required 10"
          tone={report.txCount === 10 ? "success" : "danger"}
        />
        <StatCard
          label="Total bank"
          value={report.total}
          hint="required 156"
          tone={report.total === 156 ? "success" : "danger"}
        />
        <StatCard
          label="Final replica"
          value={report.examCount}
          hint="required 74"
          tone={report.examCount === 74 ? "success" : "danger"}
        />
        <StatCard
          label="Checks"
          value={`${passed}/${report.checks.length}`}
          hint={failed ? `${failed} failing` : "all passing"}
          tone={failed ? "danger" : "success"}
        />
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Audit checks</h2>
            <p className="text-sm text-muted-foreground">
              These checks must pass before the app can claim a complete exam replica.
            </p>
          </div>
          <Database className="size-5 text-muted-foreground" />
        </div>
        <div className="grid gap-2">
          {report.checks.map((check) => (
            <div
              key={check.label}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3",
                check.ok
                  ? "border-success/30 bg-success/10"
                  : "border-destructive/30 bg-destructive/10",
              )}
            >
              {check.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{check.label}</div>
                <div className="mt-0.5 break-words text-xs text-muted-foreground">
                  {check.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Final exam mapping</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every exam number from 1 to 74 must map to exactly one source-bank question. Missing or
          duplicated numbers break the exam simulation.
        </p>
        <div className="mt-4 grid grid-cols-10 gap-1.5 sm:grid-cols-[repeat(19,minmax(0,1fr))]">
          {Array.from({ length: 74 }, (_, i) => i + 1).map((n) => {
            const q = EXAM_QUESTIONS.find((item) => item.examNo === n);
            return (
              <Link
                key={n}
                to="/bank"
                search={{ filter: "exam" }}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors",
                  q
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-destructive text-destructive-foreground",
                )}
                title={q ? `${q.id}: ${q.stem}` : `Missing final Q${n}`}
              >
                {n}
              </Link>
            );
          })}
        </div>
        {(exam.missing.length > 0 || exam.duplicate.length > 0) && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Missing: {exam.missing.join(", ") || "none"}; duplicates:{" "}
            {exam.duplicate.join(", ") || "none"}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Flag className="size-4 text-warning" />
          <h2 className="text-base font-semibold">Flagged source questions</h2>
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning-foreground">
            {report.flaggedQuestions.length}
          </span>
        </div>
        <div className="space-y-2">
          {report.flaggedQuestions.map((q) => {
            const topic = TOPIC_BY_ID[q.topic];
            return (
              <div key={q.id} className="rounded-xl border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded bg-muted px-1.5 py-0.5">#{q.srcNo}</span>
                  {q.examNo && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                      Final Q{q.examNo}
                    </span>
                  )}
                  <span className="uppercase text-warning-foreground">{q.flag}</span>
                  <span style={{ color: topic.tone }}>{topic.short}</span>
                </div>
                <p className="mt-2 text-sm font-medium">{q.stem}</p>
                {q.nuance && (
                  <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    {q.nuance}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Source coverage</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The app contains {QUESTIONS.length} interactive questions converted from the supplied
          source PDFs. The source PDFs are not embedded as viewers; they are represented as
          structured, scoreable question records.
        </p>
      </section>
    </div>
  );
}
