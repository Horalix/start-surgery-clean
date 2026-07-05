import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Zap, RefreshCw } from "lucide-react";
import { getState } from "@/lib/study/store";
import { buildQueue, questionsForFilter, weaknessPool } from "@/lib/study/selectors";
import { QuestionRunner } from "@/components/study/QuestionRunner";
import { PageTitle } from "@/components/study/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/rapid")({ component: RapidPage });

function RapidPage() {
  const [nonce, setNonce] = useState(0);
  const queue = useMemo(() => {
    const s = getState();
    let pool = weaknessPool(s);
    if (pool.length < 10) pool = pool.concat(questionsForFilter(s, "never"));
    if (pool.length < 10) pool = questionsForFilter(s, "all");
    return buildQueue(s, pool, 25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <div>
      <PageTitle
        title="Rapid Recall"
        subtitle="Fast, low-friction retrieval on your highest-yield gaps. Answer, get instant feedback, auto-advance."
        icon={<Zap className="size-5" />}
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
      <QuestionRunner key={nonce} questions={queue} mode="Rapid Recall" rapid />
    </div>
  );
}
