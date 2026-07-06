import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Target, Zap, Medal, GraduationCap, Flame, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { levelForXp } from "@/lib/study/companion";
import { computeStudyStats, studyScore } from "@/lib/study/study-sync";
import { getState, useStore } from "@/lib/study/store";
import type { CharacterCustomization } from "@/lib/study/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({ component: LeaderboardPage });

type Mode = "study" | "accuracy" | "speed";

interface LbRow {
  user_id: string;
  mode: "accuracy" | "speed";
  display_name: string;
  best_score: number;
  best_correct: number;
  best_total_ms: number;
  wins: number;
  matches: number;
}

interface ProfileRow {
  user_id: string;
  display_name: string;
  character: CharacterCustomization | null;
  xp: number | null;
  study_level: number | null;
  mastered_count: number | null;
  study_accuracy: number | null;
  study_score: number | null;
  best_exam_score: number | null;
}

const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

function LeaderboardPage() {
  const [rows, setRows] = useState<LbRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});
  const [mode, setMode] = useState<Mode>("study");
  const [meId, setMeId] = useState<string | null>(null);

  // local snapshot so the signed-out / not-yet-synced player still sees themselves
  const localName = useStore((s) => s.profile.name);
  const localChar = useStore((s) => s.character);
  const localTick = useStore((s) => s.profile.xp + Object.keys(s.progress).length);
  const localStats = useMemo(() => computeStudyStats(getState()), [localTick]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const [{ data: lb }, { data: profs }] = await Promise.all([
        db
          .from("leaderboard_entries")
          .select("*")
          .order("best_score", { ascending: false })
          .limit(300),
        db.from("profiles").select("*").limit(300),
      ]);
      if (cancelled) return;
      const lbList = (lb ?? []) as LbRow[];
      const profList = (profs ?? []) as ProfileRow[];
      setRows(lbList);
      setProfiles(profList);
      const map: Record<string, ProfileRow> = {};
      for (const p of profList) map[p.user_id] = p;
      setProfileMap(map);
    };
    refresh();
    const ch = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leaderboard_entries" }, () =>
        refresh(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refresh())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const battleRows = useMemo(
    () =>
      rows
        .filter((r) => r.mode === mode)
        .sort((a, b) => b.best_score - a.best_score)
        .slice(0, 100),
    [rows, mode],
  );

  // Study rows: server profiles + a live local row for me (so it never looks empty).
  const studyRows = useMemo(() => {
    const list = profiles
      .filter((p) => (p.study_score ?? 0) > 0 || (p.xp ?? 0) > 0)
      .map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        character: p.character ?? undefined,
        xp: p.xp ?? 0,
        level: p.study_level ?? levelForXp(p.xp ?? 0),
        mastered: p.mastered_count ?? 0,
        accuracy: p.study_accuracy ?? 0,
        bestExam: p.best_exam_score ?? 0,
        score: p.study_score ?? 0,
      }));
    const hasMe = meId ? list.some((r) => r.user_id === meId) : false;
    if (!hasMe && (localStats.xp > 0 || localStats.mastered > 0)) {
      list.push({
        user_id: meId ?? "local-me",
        display_name: localName,
        character: localChar,
        xp: localStats.xp,
        level: localStats.level,
        mastered: localStats.mastered,
        accuracy: localStats.accuracyPct,
        bestExam: localStats.bestExam,
        score: studyScore(localStats),
      });
    }
    return list.sort((a, b) => b.score - a.score).slice(0, 100);
  }, [profiles, meId, localStats, localName, localChar]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Leaderboard"
        subtitle="Compete on pure studying, or in the Battle Arena. Updates in real time."
        icon={<Trophy className="size-5" />}
      />

      <div className="inline-flex flex-wrap rounded-xl border bg-card p-1 shadow-sm">
        <ModeTab
          active={mode === "study"}
          onClick={() => setMode("study")}
          icon={<GraduationCap className="size-4" />}
          label="Study"
        />
        <ModeTab
          active={mode === "accuracy"}
          onClick={() => setMode("accuracy")}
          icon={<Target className="size-4" />}
          label="Battle · Accuracy"
        />
        <ModeTab
          active={mode === "speed"}
          onClick={() => setMode("speed")}
          icon={<Zap className="size-4" />}
          label="Battle · Speed"
        />
      </div>

      {mode === "study" ? (
        <StudyBoard rows={studyRows} meId={meId} />
      ) : (
        <BattleBoard rows={battleRows} profileMap={profileMap} meId={meId} />
      )}
    </div>
  );
}

function StudyBoard({
  rows,
  meId,
}: {
  rows: {
    user_id: string;
    display_name: string;
    character?: CharacterCustomization;
    xp: number;
    level: number;
    mastered: number;
    accuracy: number;
    bestExam: number;
    score: number;
  }[];
  meId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
        No study scores yet. Answer questions in Learn, Drill, or the Master Bank to climb the
        board.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="hidden grid-cols-[auto_1fr_auto_auto_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
        <span className="w-9">#</span>
        <span>Player</span>
        <span className="w-16 text-right">Mastered</span>
        <span className="w-16 text-right">Accuracy</span>
        <span className="w-16 text-right">XP</span>
      </div>
      <ul className="divide-y">
        {rows.map((r, i) => {
          const isMe = r.user_id === meId || r.user_id === "local-me";
          return (
            <li
              key={r.user_id}
              className={cn(
                "grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:gap-4",
                isMe && "bg-primary/5",
                i === 0 && "bg-gradient-to-r from-yellow-400/10 to-transparent",
              )}
            >
              <RankBadge rank={i + 1} />
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-border">
                  <Companion level={r.level} size={38} bob={false} character={r.character} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {r.display_name}
                    {isMe && (
                      <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="size-3 text-primary" /> Lv {r.level}
                    </span>
                    {r.bestExam >= 74 && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Flame className="size-3" /> 74/74
                      </span>
                    )}
                    <span className="sm:hidden">
                      · {r.mastered} mastered · {r.accuracy}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="hidden w-16 text-right text-sm font-bold tabular-nums sm:block">
                {r.mastered}
              </div>
              <div className="hidden w-16 text-right text-sm tabular-nums text-muted-foreground sm:block">
                {r.accuracy}%
              </div>
              <div className="w-16 text-right">
                <div className="text-base font-bold tabular-nums">{r.xp.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:hidden">
                  xp
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BattleBoard({
  rows,
  profileMap,
  meId,
}: {
  rows: LbRow[];
  profileMap: Record<string, ProfileRow>;
  meId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
        No battle scores yet. Play a match in the Battle Arena to set the first record.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <ul className="divide-y">
        {rows.map((r, i) => {
          const prof = profileMap[r.user_id];
          const displayName = prof?.display_name || r.display_name;
          const character = prof?.character ?? undefined;
          const isMe = r.user_id === meId;
          return (
            <li
              key={r.user_id}
              className={cn("flex items-center gap-4 px-4 py-3", isMe && "bg-primary/5")}
            >
              <RankBadge rank={i + 1} />
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-border">
                <Companion
                  level={prof?.study_level ?? 5}
                  size={38}
                  bob={false}
                  character={character}
                />
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
                  {r.best_correct} correct · {(r.best_total_ms / 1000).toFixed(1)}s · {r.wins}W/
                  {r.matches}
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
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(" · ").pop()}</span>
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
