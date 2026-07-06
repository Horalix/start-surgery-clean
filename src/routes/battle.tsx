import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Heart,
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
import type { CharacterCustomization } from "@/lib/study/types";
import { recordAnswer, recordBattle, useStore, getState } from "@/lib/study/store";
import { withDerivedTier } from "@/lib/study/character-progression";
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
  character: CharacterCustomization | null;
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

function safeDisplayName(name: string): string {
  const clean = name.trim() || "Player";
  return clean.slice(0, 40);
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
        setDisplayName(safeDisplayName(
          meta.display_name ||
            meta.full_name ||
            data.user.email?.split("@")[0] ||
            "Player",
        ));
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
  const character = useStore((s) => s.character);

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
          status: "waiting",
          question_ids: pickQuestionIds(),
        })
        .select("id")
        .single();
      if (error) {
        console.error("[battle] host room insert failed:", error);
        const err = error as { message?: string; details?: string; hint?: string; code?: string };
        throw new Error(err.message || err.details || err.hint || "Room creation was blocked");
      }
      const room = data as { id: string };
      const snapshotChar = withDerivedTier(character, getState()) ?? character ?? null;
      const { error: joinErr } = await db.from("battle_players").insert({
        room_id: room.id,
        user_id: userId,
        display_name: safeDisplayName(displayName),
        character: snapshotChar as never,
      });

      if (joinErr) {
        console.error("[battle] host self-join failed:", joinErr);
        const err = joinErr as { message?: string; details?: string; hint?: string };
        throw new Error(err.message || err.details || err.hint || "Failed to join own room");
      }
      toast.success(`Room ${code} created`);
      onEnter(room.id);
    } catch (e) {
      console.error("[battle] host() error:", e);
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
      const snapshotChar = withDerivedTier(character, getState()) ?? character ?? null;
      const { error: joinErr } = await db
        .from("battle_players")
        .upsert(
          {
            room_id: room.id,
            user_id: userId,
            display_name: safeDisplayName(displayName),
            character: snapshotChar as never,
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
            <Companion level={level} size={58} character={character} />
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

  // ── Battle FX state ──────────────────────────────────────────
  const [myFx, setMyFx] = useState<"lunge" | "shake" | null>(null);
  const [oppFx, setOppFx] = useState<"lunge" | "shake" | null>(null);
  const [slashOn, setSlashOn] = useState<"me->opp" | "opp->me" | null>(null);
  const prevMyAnswerCountRef = useRef(0);
  const prevOppAnswerCountRef = useRef(0);

  const submit = useCallback(async () => {
    if (!currentQ || submitting) return;
    if (selected.length !== currentQ.select) return;
    if (submittedForRef.current === currentQ.id) return;
    submittedForRef.current = currentQ.id;
    setSubmitting(true);
    try {
      const ms = Date.now() - questionStartRef.current;
      const result = grade(currentQ, selected);

      // Trigger my FX immediately (don't wait for realtime bounce)
      if (result.correct) {
        setMyFx("lunge");
        setSlashOn("me->opp");
        setTimeout(() => setSlashOn(null), 550);
        setTimeout(() => setMyFx(null), 650);
      } else {
        setMyFx("shake");
        setTimeout(() => setMyFx(null), 550);
      }

      // Local per-user learning store
      recordAnswer({
        qid: currentQ.id,
        correct: result.correct,
        confidence: "confident",
        ms,
        selected,
      });

      const { error } = await db.from("battle_answers").insert({
        room_id: room.id,
        user_id: userId,
        qid: currentQ.id,
        selected,
        correct: result.correct,
        ms,
      });
      if (error) throw error;

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

  // React to opponent answers landing via realtime → FX on their side
  useEffect(() => {
    if (!opponent) return;
    const oppAnswered = answers.filter((a) => a.user_id === opponent.user_id);
    if (oppAnswered.length > prevOppAnswerCountRef.current) {
      const latest = oppAnswered[oppAnswered.length - 1];
      if (latest.correct) {
        setOppFx("lunge");
        setSlashOn("opp->me");
        setTimeout(() => setSlashOn(null), 550);
        setTimeout(() => setOppFx(null), 650);
      } else {
        setOppFx("shake");
        setTimeout(() => setOppFx(null), 550);
      }
    }
    prevOppAnswerCountRef.current = oppAnswered.length;
    prevMyAnswerCountRef.current = myAnswers.length;
  }, [answers, opponent, myAnswers.length]);


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
          .maybeSingle()) as {
          data: {
            best_score: number;
            best_correct: number;
            best_total_ms: number;
            wins: number;
            matches: number;
          } | null;
        };
        const isNewBest = !existing || me.score > existing.best_score;
        await db.from("leaderboard_entries").upsert(
          {
            user_id: userId,
            mode: room.mode,
            display_name: displayName,
            best_score: isNewBest ? me.score : existing!.best_score,
            best_correct: isNewBest ? me.correct_count : existing!.best_correct,
            best_total_ms: isNewBest ? me.total_ms : existing!.best_total_ms,
            wins: (existing?.wins ?? 0) + (won ? 1 : 0),
            matches: (existing?.matches ?? 0) + 1,
          },
          { onConflict: "user_id,mode" },
        );
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

  // Derived HP: starts at 100, each wrong answer chips away at your HP; opponent
  // "attacks" via their correct answers.
  const myHP = Math.max(
    0,
    100 - opponentAnswers /* nudged */ - opponentAnswers * 3 -
      (answers.filter((a) => a.user_id === opponent?.user_id && a.correct).length * 8) -
      (myAnswers.filter((a) => !a.correct).length * 5),
  );
  const oppHP = Math.max(
    0,
    100 -
      (myAnswers.filter((a) => a.correct).length * 8) -
      ((opponent ? answers.filter((a) => a.user_id === opponent.user_id && !a.correct).length : 0) * 5),
  );

  // Live action feed
  const feed = useMemo(() => {
    const items = answers
      .slice()
      .sort((a, b) => a.answered_at.localeCompare(b.answered_at))
      .slice(-6)
      .reverse();
    return items.map((a) => {
      const p = players.find((x) => x.user_id === a.user_id);
      const label = p ? (p.user_id === userId ? "You" : p.display_name) : "Player";
      const idx = answers
        .filter((x) => x.user_id === a.user_id && x.answered_at <= a.answered_at)
        .length;
      return { id: a.id, label, idx, ms: a.ms, correct: a.correct };
    });
  }, [answers, players, userId]);

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

        {allFinished && me && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-8 text-center shadow-lg">
            <div className="flex items-center justify-center">
              <div className={cn("flex size-32 items-center justify-center", won && "battle-victory")}>
                <Companion
                  level={levelProgress(getState().profile.xp).level}
                  size={120}
                  character={(won ? me.character : opponent?.character) ?? undefined}
                  mood={won ? "happy" : "sad"}
                />
              </div>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              {draw ? "Draw" : won ? "Victory!" : "Defeated"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {won
                ? `+30 XP · You bested ${opponent?.display_name ?? "your opponent"}`
                : draw
                  ? "A close match — tied scores."
                  : `+5 XP for playing · ${opponent?.display_name ?? "Opponent"} took this round`}
            </p>
            {won && (
              <>
                {Array.from({ length: 22 }).map((_, i) => (
                  <span
                    key={i}
                    className="confetti-piece"
                    style={{
                      left: `${(i * 4.5) % 100}%`,
                      top: "-10px",
                      background: ["#f2c94c", "#22d3ee", "#ff5ac9", "#a8fdff", "#c78cff"][i % 5],
                      animationDelay: `${(i % 6) * 0.1}s`,
                    }}
                  />
                ))}
              </>
            )}
          </div>
        )}

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
                <div key={a.id} className="flex items-center gap-3 rounded-lg border bg-background p-2.5">
                  <span className="w-7 shrink-0 text-xs font-bold text-muted-foreground">#{i + 1}</span>
                  {a.correct ? <Check className="size-4 text-success" /> : <X className="size-4 text-destructive" />}
                  <span className="min-w-0 flex-1 truncate text-sm">{q?.stem ?? a.qid}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{fmtSeconds(a.ms)}</span>
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
            Round {myIdx + 1} / {questions.length}
          </div>
          <h1 className="text-xl font-bold">
            {room.mode === "accuracy" ? "Accuracy duel" : "Speed duel"} · {room.code}
          </h1>
        </div>
      </div>

      {/* ── Arena ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-slate-900 via-indigo-950 to-black p-4 shadow-lg sm:p-6">
        {/* Ground line */}
        <div
          className="absolute inset-x-0 bottom-0 h-16 opacity-40"
          style={{ background: "radial-gradient(ellipse at center, rgba(255,255,255,0.15), transparent 70%)" }}
        />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          {/* Me */}
          <ArenaFighter
            name={`${displayName} (you)`}
            hp={myHP}
            correct={me?.correct_count ?? 0}
            total={questions.length}
            character={me?.character ?? undefined}
            fx={myFx}
            side="left"
            flash={myFx === "shake"}
          />
          <div className="relative flex flex-col items-center justify-center pb-6 text-white/80">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">VS</div>
            {slashOn && (
              <span
                className={cn(
                  "battle-slash absolute left-1/2 top-1/2 h-1 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  slashOn === "me->opp" ? "bg-primary" : "bg-destructive",
                )}
              />
            )}
          </div>
          {opponent ? (
            <ArenaFighter
              name={opponent.display_name}
              hp={oppHP}
              correct={opponent.correct_count}
              total={questions.length}
              character={opponent.character ?? undefined}
              fx={oppFx}
              side="right"
              flash={oppFx === "shake"}
            />
          ) : (
            <div className="pb-4 text-right text-xs text-white/60">Waiting for opponent…</div>
          )}
        </div>

        {/* Live feed */}
        {feed.length > 0 && (
          <div className="mt-4 max-h-24 overflow-hidden border-t border-white/10 pt-2">
            <ul className="space-y-1 text-[11px] text-white/80">
              {feed.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  {f.correct ? <Check className="size-3 text-emerald-400" /> : <X className="size-3 text-rose-400" />}
                  <span className="font-semibold">{f.label}</span>
                  <span className="text-white/50">answered in {fmtSeconds(f.ms)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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

function ArenaFighter({
  name,
  hp,
  correct,
  total,
  character,
  fx,
  side,
  flash,
}: {
  name: string;
  hp: number;
  correct: number;
  total: number;
  character: CharacterCustomization | undefined;
  fx: "lunge" | "shake" | null;
  side: "left" | "right";
  flash: boolean;
}) {
  const lungeClass = fx === "lunge" ? (side === "left" ? "battle-lunge-left" : "battle-lunge-right") : "";
  const shakeClass = fx === "shake" ? "battle-shake" : "";
  return (
    <div className={cn("relative flex flex-col gap-2", side === "right" && "items-end", flash && "battle-flash-red rounded-xl")}>
      <div className={cn("relative flex", side === "left" ? "justify-start" : "justify-end")}>
        <div className={cn("relative", lungeClass, shakeClass)} style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}>
          <Companion level={12} size={96} character={character} mood={fx === "shake" ? "sad" : "idle"} />
        </div>
      </div>
      <div className={cn("w-full max-w-[220px]", side === "right" && "ml-auto")}>
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white">
          <span className="flex items-center gap-1"><Heart className="size-3 text-rose-400" /> {name}</span>
          <span className="tabular-nums text-white/70">{correct}/{total}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              hp > 60 ? "bg-emerald-400" : hp > 30 ? "bg-amber-400" : "bg-rose-500",
            )}
            style={{ width: `${hp}%` }}
          />
        </div>
      </div>
    </div>
  );
}

