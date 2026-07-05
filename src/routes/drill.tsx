import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Dumbbell, RefreshCw, Sparkles } from "lucide-react";
import { getState } from "@/lib/study/store";
import { buildQueue, questionsForFilter, weaknessPool } from "@/lib/study/selectors";
import { QuestionRunner } from "@/components/study/QuestionRunner";
import { PageTitle, EmptyState } from "@/components/study/primitives";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/drill")({ component: DrillPage });

function DrillPage() {
  const [nonce, setNonce] = useState(0);
  const { queue, empty } = useMemo(() => {
    const s = getState();
    const pool = weaknessPool(s);
    if (pool.length === 0) return { queue: [], empty: true };
    return { queue: buildQueue(s, pool, 12), empty: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <div>
      <PageTitle
        title="Weakness Drill"
        subtitle="A short, intense set built only from questions you've missed, guessed, answered slowly, or haven't retained."
        icon={<Dumbbell className="size-5" />}
        action={
          !empty && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setNonce((n) => n + 1)}
            >
              <RefreshCw className="size-3.5" />
              Rebuild
            </Button>
          )
        }
      />
      {empty ? (
        <EmptyState
          title="No weak spots yet"
          body="Once you've answered some questions, your misses, slow answers, and low-confidence items collect here for targeted drilling."
          action={
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/learn">
                  <Sparkles className="size-4" /> Start learning
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <QuestionRunner key={nonce} questions={queue} mode="Weakness Drill" />
      )}
    </div>
  );
}
