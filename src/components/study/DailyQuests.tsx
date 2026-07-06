import { useMemo } from "react";
import { Check, Gift, Sparkles } from "lucide-react";
import { getState, claimQuest, useStore } from "@/lib/study/store";
import { questStatuses, comboLabel } from "@/lib/study/gamify";
import { cn } from "@/lib/utils";

export function DailyQuests() {
  const tick = useStore(
    (s) =>
      s.profile.xp + Object.keys(s.progress).length + Object.values(s.questClaims).flat().length,
  );
  const combo = useStore((s) => s.profile.combo);

  const quests = useMemo(() => questStatuses(getState()), [tick]);
  const claimable = quests.filter((q) => q.complete && !q.claimed).length;
  const doneCount = quests.filter((q) => q.claimed).length;

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4 text-primary" />
          Daily Quests
        </h2>
        <div className="flex items-center gap-2">
          {combo >= 3 && (
            <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-bold text-orange-500">
              🔥 x{combo} {comboLabel(combo)}
            </span>
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {doneCount}/{quests.length} done
          </span>
        </div>
      </div>
      {claimable > 0 && (
        <p className="mt-1 text-xs font-medium text-primary">
          {claimable} quest{claimable === 1 ? "" : "s"} ready to claim!
        </p>
      )}

      <div className="mt-4 space-y-2.5">
        {quests.map((quest) => {
          const pct = Math.round((quest.value / quest.target) * 100);
          return (
            <div
              key={quest.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-2.5 transition-colors",
                quest.claimed
                  ? "border-success/30 bg-success/5"
                  : quest.complete
                    ? "border-primary/40 bg-primary/5"
                    : "border-border",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-lg">
                {quest.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{quest.title}</span>
                  <span className="shrink-0 text-[11px] font-bold text-primary">
                    +{quest.xp} XP
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        quest.complete ? "bg-success" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {quest.value}/{quest.target}
                  </span>
                </div>
              </div>
              {quest.claimed ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
                  <Check className="size-4" />
                </span>
              ) : quest.complete ? (
                <button
                  onClick={() => claimQuest(quest.id, quest.xp)}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                >
                  <Gift className="size-3.5" /> Claim
                </button>
              ) : (
                <span className="w-8 shrink-0 text-center text-[10px] font-medium text-muted-foreground">
                  {pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Quests reset at midnight. Progress is measured from what you actually study today.
      </p>
    </div>
  );
}
