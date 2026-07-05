import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Target, Zap, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import type { CharacterCustomization } from "@/lib/study/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({ component: LeaderboardPage });

type Mode = "accuracy" | "speed";

interface LbRow {
  user_id: string;
  mode: Mode;
  display_name: string;
  best_score: number;
  best_correct: number;
  best_total_ms: number;
  wins: number;
  matches: number;
  updated_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string;
  character: CharacterCustomization | null;
}

const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

function LeaderboardPage() {
  const [rows, setRows] = useState<LbRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [mode, setMode] = useState<Mode>("accuracy");
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { data } = await db
        .from("leaderboard_entries")
        .select("*")
        .order("best_score", { ascending: false })
        .limit(200);
      if (cancelled) return;
      const list = (data ?? []) as LbRow[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await db.from("profiles").select("*").in("user_id", ids);
        if (!cancelled) {
          const map: Record<string, ProfileRow> = {};
          for (const p of (profs ?? []) as ProfileRow[]) map[p.user_id] = p;
          setProfiles(map);
        }
      }
    };
    refresh();
    const ch = supabase
      .channel("leaderboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaderboard_entries" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => r.mode === mode)
        .sort((a, b) => b.best_score - a.best_score)
        .slice(0, 100),
    [rows, mode],
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="Global Leaderboard"
        subtitle="Best score per player across every Battle Arena mode. Updates in real time."
        icon={<Trophy className="size-5" />}
      />

      <div className="inline-flex rounded-xl border bg-card p-1 shadow-sm">
        <ModeTab
          active={mode === "accuracy"}
          onClick={() => setMode("accuracy")}
          icon={<Target className="size-4" />}
          label="Accuracy"
        />
        <ModeTab
          active={mode === "speed"}
          onClick={() => setMode("speed")}
          icon={<Zap className="size-4" />}
          label="Speed"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No scores yet. Play a battle to set the first record.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((r, i) => {
              const prof = profiles[r.user_id];
              const displayName = prof?.display_name || r.display_name;
              const character = prof?.character ?? undefined;
              const isMe = r.user_id === meId;
              return (
                <li
                  key={r.user_id}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3",
                    isMe && "bg-primary/5",
                  )}
                >
                  <RankBadge rank={i + 1} />
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                    <Companion level={5} size={38} bob={false} character={character} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {displayName}
                      {isMe && (
                        <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.best_correct} correct · {(r.best_total_ms / 1000).toFixed(1)}s · {r.wins}W
                      /{r.matches}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold tabular-nums">
                      {r.best_score.toLocaleString()}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      best
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const color =
    rank === 1
      ? "bg-yellow-400 text-yellow-950"
      : rank === 2
        ? "bg-slate-300 text-slate-900"
        : rank === 3
          ? "bg-amber-600 text-amber-50"
          : "bg-muted text-muted-foreground";
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        color,
      )}
    >
      {rank <= 3 ? <Medal className="size-4" /> : rank}
    </div>
  );
}
