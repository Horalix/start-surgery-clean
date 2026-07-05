import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  LogIn,
  RotateCcw,
  Swords,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EXAM_QUESTIONS, type Question } from "@/data/questions";
import { TOPIC_BY_ID } from "@/data/topics";
import { grade } from "@/lib/study/types";
import { recordAnswer, recordBattle, useStore } from "@/lib/study/store";
import { PageTitle, StatCard } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { levelProgress } from "@/lib/study/companion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/battle")({ component: BattlePage });

const BATTLE_SIZE = 8;

type BattleMode = "accuracy" | "speed";
type RoomStatus = "waiting" | "running" | "finished" | "cancelled";

interface Room {
  id: string;
  code: string;
  host_user_id: string;
  mode: BattleMode;
  question_ids: string[];
  status: RoomStatus;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

interface Player {
  room_id: string;
  user_id: string;
  display_name: string;
  score: number;
  correct_count: number;
  total_ms: number;
  joined_at: string;
}

interface AnswerRow {
  id: string;
  room_id: string;
  user_id: string;
  qid: string;
  selected: string[];
  correct: boolean;
  ms: number;
  answered_at: string;
}

// Untyped Supabase table access — DB types are managed separately from the app.
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
};

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function pickQuestionIds(): string[] {
  const shuffled = [...EXAM_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, BATTLE_SIZE).map((q) => q.id);
}

function computeScore(mode: BattleMode, correct: number, totalMs: number): number {
  return mode === "speed" ? correct * 100000 - totalMs : correct * 1000 - Math.floor(totalMs / 100);
}

function fmtSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function BattlePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("Player");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        const meta = data.user.user_metadata as { display_name?: string; full_name?: string };
        setDisplayName(
          meta.display_name ||
            meta.full_name ||
            data.user.email?.split("@")[0] ||
            "Player",
        );
      }
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authChecked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!userId) return <SignedOutView />;
  return <BattleAuthenticated userId={userId} displayName={displayName} />;
}

function SignedOutView() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Battle Arena"
        subtitle="Sign in to host a room, share the code, and battle a friend in real time."
        icon={<Swords className="size-5" />}
      />
      <div className="rounded-2xl border bg-card p-6 shadow-sm text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Online battles need an account so we can sync questions, scores, and answers between
          players.
        </p>
        <Button asChild className="gap-2">
          <Link to="/auth">
            <LogIn className="size-4" /> Sign in to battle
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Authenticated view: lobby / room
// ─────────────────────────────────────────────────────────────

function BattleAuthenticated({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const [roomId, setRoomId] = useState<string | null>(null);

  if (!roomId) {
    return <Lobby userId={userId} displayName={displayName} onEnter={setRoomId} />;
  }
  return (
    <BattleRoom
      roomId={roomId}
      userId={userId}
      displayName={displayName}
      onLeave={() => setRoomId(null)}
    />
  );
}

function Lobby({
  userId,
  displayName,
  onEnter,
}: {
  userId: string;
  displayName: string;
  onEnter: (roomId: string) => void;
}) {
  const [mode, setMode] = useState<BattleMode>("accuracy");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const profile = useStore((s) => s.profile);

  const host = async () => {
    setBusy(true);
    try {
      const code = generateCode();
      const { data, error } = await db
        .from("battle_rooms")
        .insert({
          code,
          host_user_id: userId,
          mode,
          question_ids: pickQuestionIds(),
        })
        .select("id")
        .single();
      if (error) throw error;
      const room = data as { id: string };
      const { error: joinErr } = await db.from("battle_players").insert({
        room_id: room.id,
        user_id: userId,
        display_name: displayName,
      });
      if (joinErr) throw joinErr;
      onEnter(room.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to host");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    try {
      const { data: room, error } = (await db
        .from("battle_rooms")
        .select("*")
        .eq("code", code)
        .eq("status", "waiting")
        .maybeSingle()) as { data: Room | null; error: unknown };
      if (error) throw error;
      if (!room) {
        toast.error("No open room with that code");
        return;
      }
      const { error: joinErr } = await db
        .from("battle_players")
        .upsert(
          {
            room_id: room.id,
            user_id: userId,
            display_name: displayName,
          },
          { onConflict: "room_id,user_id" },
        );
      if (joinErr) throw joinErr;
      onEnter(room.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  };

  const level = levelProgress(profile.xp).level;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Battle Arena"
        subtitle="Live head-to-head. Host a room and share the code, or enter a friend's code."
        icon={<Swords className="size-5" />}
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold">Match mode</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setMode("accuracy")}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-colors",
                  mode === "accuracy"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent",
                )}
              >
                <Target className="mb-3 size-5 text-primary" />
                <div className="font-semibold">Accuracy duel</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Most correct wins. Speed breaks ties.
                </p>
              </button>
              <button
                onClick={() => setMode("speed")}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-colors",
                  mode === "speed" ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                )}
              >
                <Zap className="mb-3 size-5 text-primary" />
                <div className="font-semibold">Speed duel</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Correct answers score heavily, time pressure matters.
                </p>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Host a room</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Get a room code, share it with an opponent.
              </p>
              <Button className="mt-3 w-full gap-2" onClick={host} disabled={busy}>
                Create room <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Join a room</h3>
              <div className="mt-2 space-y-2">
                <Label htmlFor="code" className="sr-only">
                  Room code
                </Label>
                <Input
                  id="code"
                  placeholder="Enter code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={5}
                  className="uppercase tracking-widest text-center font-mono"
                />
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={join}
                  disabled={busy || !joinCode.trim()}
                >
                  Join battle
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Companion level={level} size={58} />
            <div>
              <h2 className="text-base font-semibold">Your record</h2>
              <p className="text-sm text-muted-foreground">
                {profile.battlesWon} wins in {profile.battlesPlayed} match
                {profile.battlesPlayed === 1 ? "" : "es"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Playing as <span className="font-semibold text-foreground">{displayName}</span>.
          </p>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// In-room: waiting → running → result
// ─────────────────────────────────────────────────────────────

function BattleRoom({
  roomId,
  userId,
  displayName,
  onLeave,
}: {
  roomId: string;
  userId: string;
  displayName: string;
  onLeave: () => void;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch + realtime subscription
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const [{ data: r }, { data: p }, { data: a }] = await Promise.all([
        db.from("battle_rooms").select("*").eq("id", roomId).maybeSingle(),
        db.from("battle_players").select("*").eq("room_id", roomId),
        db.from("battle_answers").select("*").eq("room_id", roomId),
      ]);
      if (cancelled) return;
      setRoom((r ?? null) as Room | null);
      setPlayers((p ?? []) as Player[]);
      setAnswers((a ?? []) as AnswerRow[]);
      setLoading(false);
    };
    refresh();

    const channel = supabase
      .channel(`battle-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_rooms", filter: `id=eq.${roomId}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_players", filter: `room_id=eq.${roomId}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_answers", filter: `room_id=eq.${roomId}` },
        () => refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  if (loading || !room) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading room…
      </div>
    );
  }

  if (room.status === "cancelled") {
    return (
      <div className="space-y-4">
        <PageTitle title="Room cancelled" icon={<Swords className="size-5" />} />
        <Button onClick={onLeave}>Back to lobby</Button>
      </div>
    );
  }

  if (room.status === "waiting") {
    return (
      <WaitingRoom
        room={room}
        players={players}
        userId={userId}
        onLeave={onLeave}
      />
    );
  }

  return (
    <PlayingRoom
      room={room}
      players={players}
      answers={answers}
      userId={userId}
      displayName={displayName}
      onLeave={onLeave}
    />
  );
}

function WaitingRoom({
  room,
  players,
  userId,
  onLeave,
}: {
  room: Room;
  players: Player[];
  userId: string;
  onLeave: () => void;
}) {
  const isHost = room.host_user_id === userId;
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      const { error } = await db
        .from("battle_rooms")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", room.id);
      if (error) throw error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start");
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (isHost) {
      await db.from("battle_rooms").update({ status: "cancelled" }).eq("id", room.id);
    }
    onLeave();
  };

  const copy = () => {
    navigator.clipboard.writeText(room.code).catch(() => {});
    toast.success("Code copied");
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Waiting for opponent"
        subtitle={room.mode === "accuracy" ? "Accuracy duel" : "Speed duel"}
        icon={<Swords className="size-5" />}
      />

      <div className="rounded-2xl border bg-card p-6 shadow-sm text-center space-y-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Room code
        </div>
        <div className="flex items-center justify-center gap-3">
          <div className="rounded-xl bg-muted px-6 py-3 font-mono text-4xl font-bold tracking-widest">
            {room.code}
          </div>
          <Button variant="outline" size="icon" onClick={copy} aria-label="Copy code">
            <Copy className="size-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Share this code. The battle starts when the host clicks Start.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Players ({players.length})</h2>
        <ul className="mt-3 divide-y">
          {players.map((p) => (
            <li key={p.user_id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium">
                {p.display_name}
                {p.user_id === room.host_user_id && (
                  <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                    Host
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">joined</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        {isHost && (
          <Button onClick={start} disabled={starting || players.length < 2} className="gap-2">
            Start battle <ArrowRight className="size-4" />
          </Button>
        )}
        <Button variant="outline" onClick={cancel}>
          {isHost ? "Cancel room" : "Leave"}
        </Button>
      </div>
      {isHost && players.length < 2 && (
        <p className="text-xs text-muted-foreground">Need at least one opponent to start.</p>
      )}
    </div>
  );
}

function PlayingRoom({
  room,
  players,
  answers,
  userId,
  displayName,
  onLeave,
}: {
  room: Room;
  players: Player[];
  answers: AnswerRow[];
  userId: string;
  displayName: string;
  onLeave: () => void;
}) {
  const questions = useMemo(
    () =>
      room.question_ids
        .map((id) => EXAM_QUESTIONS.find((q) => q.id === id))
        .filter((q): q is Question => Boolean(q)),
    [room.question_ids],
  );

  const myAnswers = useMemo(() => answers.filter((a) => a.user_id === userId), [answers, userId]);
  const myIdx = myAnswers.length;
  const currentQ = questions[myIdx];

  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const questionStartRef = useRef<number>(Date.now());
  const submittedForRef = useRef<string | null>(null);
  const battleRecordedRef = useRef(false);

  // Reset per-question state
  useEffect(() => {
    setSelected([]);
    questionStartRef.current = Date.now();
    submittedForRef.current = null;
  }, [myIdx]);

  const me = players.find((p) => p.user_id === userId);
  const opponents = players.filter((p) => p.user_id !== userId);
  const opponent = opponents[0]; // 1v1 for now
  const opponentAnswers = opponent
    ? answers.filter((a) => a.user_id === opponent.user_id).length
    : 0;

  const iFinished = myIdx >= questions.length;
  const allFinished = players.every(
    (p) => answers.filter((a) => a.user_id === p.user_id).length >= questions.length,
  );

  const submit = useCallback(async () => {
    if (!currentQ || submitting) return;
    if (selected.length !== currentQ.select) return;
    if (submittedForRef.current === currentQ.id) return;
    submittedForRef.current = currentQ.id;
    setSubmitting(true);
    try {
      const ms = Date.now() - questionStartRef.current;
      const result = grade(currentQ, selected);

      // Local per-user learning store
      recordAnswer({
        qid: currentQ.id,
        correct: result.correct,
        confidence: "confident",
        ms,
        selected,
      });

      // Insert answer row
      const { error } = await db.from("battle_answers").insert({
        room_id: room.id,
        user_id: userId,
        qid: currentQ.id,
        selected,
        correct: result.correct,
        ms,
      });
      if (error) throw error;

      // Update player aggregates
      const newCorrect = (me?.correct_count ?? 0) + (result.correct ? 1 : 0);
      const newTotalMs = (me?.total_ms ?? 0) + ms;
      const newScore = computeScore(room.mode, newCorrect, newTotalMs);
      await db
        .from("battle_players")
        .update({ correct_count: newCorrect, total_ms: newTotalMs, score: newScore })
        .eq("room_id", room.id)
        .eq("user_id", userId);
    } catch (e) {
      submittedForRef.current = null;
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }, [currentQ, selected, submitting, room.id, room.mode, userId, me]);

  // Host closes room when everyone is done
  useEffect(() => {
    if (allFinished && room.host_user_id === userId && room.status === "running") {
      db.from("battle_rooms")
        .update({ status: "finished", ended_at: new Date().toISOString() })
        .eq("id", room.id);
    }
  }, [allFinished, room.host_user_id, room.status, room.id, userId]);

  // Record local win/loss + upsert global leaderboard when finished
  useEffect(() => {
    if (!allFinished || battleRecordedRef.current) return;
    if (!me || !opponent) return;
    battleRecordedRef.current = true;
    const won = me.score > opponent.score;
    recordBattle(won);

    (async () => {
      try {
        const { data: existing } = (await db
          .from("leaderboard_entries")
          .select("*")
          .eq("user_id", userId)
          .eq("mode", room.mode)
          .maybeSingle()) as { data: {
            best_score: number;
            wins: number;
            matches: number;
          } | null };
        const prevBest = existing?.best_score ?? -Infinity;
        const isNewBest = me.score > prevBest;
        const payload = {
          user_id: userId,
          mode: room.mode,
          display_name: displayName,
          best_score: isNewBest ? me.score : (existing?.best_score ?? me.score),
          best_correct: isNewBest ? me.correct_count : (existing?.best_score ?? 0) === me.score ? me.correct_count : existing?.best_score !== undefined ? undefined as unknown as number : me.correct_count,
          best_total_ms: isNewBest ? me.total_ms : undefined as unknown as number,
          wins: (existing?.wins ?? 0) + (won ? 1 : 0),
          matches: (existing?.matches ?? 0) + 1,
        };
        // Clean undefined fields
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(payload)) if (v !== undefined) clean[k] = v;
        await db
          .from("leaderboard_entries")
          .upsert(clean, { onConflict: "user_id,mode" });
      } catch {
        /* ignore leaderboard errors */
      }
    })();
  }, [allFinished, me, opponent, userId, displayName, room.mode]);


  const toggle = (id: string) => {
    if (!currentQ) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (currentQ.select === 1) return [id];
      if (prev.length >= currentQ.select) return prev;
      return [...prev, id];
    });
  };

  // ── Result view ──
  if (iFinished) {
    const meScore = me?.score ?? 0;
    const oppScore = opponent?.score ?? 0;
    const draw = !opponent || !allFinished ? false : meScore === oppScore;
    const won = allFinished && !!opponent && meScore > oppScore;

    return (
      <div className="space-y-6">
        <PageTitle
          title={
            !allFinished
              ? "Waiting for opponent to finish…"
              : draw
                ? "Battle draw"
                : won
                  ? "Battle won"
                  : "Battle lost"
          }
          subtitle={`${room.mode === "accuracy" ? "Accuracy duel" : "Speed duel"} · room ${room.code}`}
          icon={<Trophy className="size-5" />}
          action={
            <Button onClick={onLeave} className="gap-2">
              <RotateCcw className="size-4" /> Back to lobby
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label={`${displayName} (you)`}
            value={`${me?.correct_count ?? 0}/${questions.length}`}
            hint={`${fmtSeconds(me?.total_ms ?? 0)} · ${me?.score ?? 0} pts`}
            tone={won ? "success" : "default"}
          />
          {opponent && (
            <StatCard
              label={opponent.display_name}
              value={`${opponent.correct_count}/${questions.length}`}
              hint={`${fmtSeconds(opponent.total_ms)} · ${opponent.score} pts · ${opponentAnswers}/${questions.length} done`}
            />
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Your review</h2>
          <div className="space-y-2">
            {myAnswers.map((a, i) => {
              const q = questions.find((qq) => qq.id === a.qid);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border bg-background p-2.5"
                >
                  <span className="w-7 shrink-0 text-xs font-bold text-muted-foreground">
                    #{i + 1}
                  </span>
                  {a.correct ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <X className="size-4 text-destructive" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{q?.stem ?? a.qid}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {fmtSeconds(a.ms)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Playing view ──
  if (!currentQ) {
    return <div className="p-4 text-sm text-muted-foreground">Loading question…</div>;
  }
  const topic = TOPIC_BY_ID[currentQ.topic];
  const required = currentQ.select === 1 ? "Choose 1" : `Choose ${currentQ.select}`;
  const type = currentQ.polarity === "incorrect" ? "incorrect" : "correct";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Question {myIdx + 1}/{questions.length}
          </div>
          <h1 className="text-xl font-bold">
            {room.mode === "accuracy" ? "Accuracy duel" : "Speed duel"} · {room.code}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
            You {me?.correct_count ?? 0}
          </span>
          {opponent && (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">
              {opponent.display_name} {opponent.correct_count} ({opponentAnswers}/{questions.length})
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
            Final Q{currentQ.examNo}
          </span>
          <span className="rounded px-2 py-1 text-white" style={{ backgroundColor: topic.tone }}>
            {topic.short}
          </span>
          <span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
            {required} {type}
          </span>
        </div>

        <h2 className="text-lg font-semibold leading-snug sm:text-xl">{currentQ.stem}</h2>

        <div className="mt-5 grid gap-2.5">
          {currentQ.options.map((opt) => {
            const active = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggle(opt.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/40 hover:bg-accent/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold uppercase",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {opt.id}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed sm:text-[15px]">{opt.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {selected.length}/{currentQ.select} selected
          </div>
          <Button
            onClick={submit}
            disabled={selected.length !== currentQ.select || submitting}
            className="gap-2"
          >
            {submitting ? "Locking…" : "Lock answer"} <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
