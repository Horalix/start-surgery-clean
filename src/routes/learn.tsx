import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GraduationCap, RefreshCw } from "lucide-react";
import { getState } from "@/lib/study/store";
import { buildQueue, questionsForFilter } from "@/lib/study/selectors";
import { QuestionRunner } from "@/components/study/QuestionRunner";
import { PageTitle } from "@/components/study/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/learn")({ component: LearnPage });

function LearnPage() {
  const [nonce, setNonce] = useState(0);
  const queue = useMemo(() => {
    const s = getState();
    let pool = questionsForFilter(s, "unmastered");
    if (pool.length === 0) pool = questionsForFilter(s, "all");
    return buildQueue(s, pool, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <div>
      <PageTitle
        title="Learn"
        subtitle="One question at a time, with the reasoning and clinical nuance revealed after each honest attempt."
        icon={<GraduationCap className="size-5" />}
        action={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setNonce((n) => n + 1)}
          >
            <RefreshCw className="size-3.5" />
            New set
          </Button>
        }
      />
      <QuestionRunner key={nonce} questions={queue} mode="Learn" />
    </div>
  );
}
