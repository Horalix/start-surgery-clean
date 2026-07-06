import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapIcon,
  Star,
  Swords,
  Trophy,
  Lock,
  Check,
  X,
  Heart,
  ArrowLeft,
  ArrowRight,
  Crown,
} from "lucide-react";
import { QUESTIONS, type Question, type TopicId } from "@/data/questions";
import { TOPIC_BY_ID } from "@/data/topics";
import { grade } from "@/lib/study/types";
import { instruction } from "@/lib/study/instruction";
import { recordAnswer, recordBossWin, logSession, getState, useStore } from "@/lib/study/store";
import { topicQuests, ACHIEVEMENTS } from "@/lib/study/gamify";
import { levelProgress } from "@/lib/study/companion";
import { PageTitle } from "@/components/study/primitives";
import { Companion } from "@/components/study/Companion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quest")({ component: QuestPage });

const BOSS_NAMES: Record<TopicId, string> = {
  trauma: "The Polytrauma Titan",
  "hernia-lap": "The Incarcerated Colossus",
  "acute-abdomen": "Lord Peritoneum",
  pancreas: "The Necrotizing Fury",
  "spleen-adrenal": "The Ruptured Sentinel",
  "ulcer-gastric": "The Perforated Warlord",
  "small-bowel": "The Strangulation Serpent",
  "crohn-meckel": "The Fistula Phantom",
  appendix: "The Rupturing Appendix",
  liver: "The Echinococcal Hydra",
  biliary: "Baron Cholangitis",
  colorectal: "The Volvulus Leviathan",
  transfusion: "The Crossmatch Golem",
};

function QuestPage() {
  const [fight, setFight] = useState<TopicId | null>(null);
  const tick = useStore(
    (s) =>
      s.profile.xp +
      Object.keys(s.progress).length +
      Object.values(s.bossWins).reduce((a, b) => a + b, 0) +
      Object.keys(s.achievements).length,
  );
  const quests = useMemo(() => topicQuests(getState()), [tick]);
  const achievements = useStore((s) => s.achievements);

  if (fight) {
    return <BossFight topic={fight} onExit={() => setFight(null)} />;
  }

  const totalStars = quests.reduce((a, q) => a + q.stars, 0);
  const maxStars = quests.length * 3;
  const bossesDown = quests.filter((q) => q.bossDefeated).length;
  const unlockedAch = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Quest Map"
        subtitle="Clear every department to master the whole bank. Earn 3 stars per topic, then defeat its boss."
        icon={<MapIcon className="size-5" />}
      />

      {/* campaign progress */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-yellow-400/20 text-yellow-500">
              <Star className="size-6 fill-current" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {totalStars}
                <span className="text-base text-muted-foreground">/{maxStars} stars</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {bossesDown}/{quests.length} bosses defeated · {unlockedAch}/{ACHIEVEMENTS.length}{" "}
                trophies
              </div>
            </div>
          </div>
          <div className="min-w-[160px] flex-1 sm:max-w-xs">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-yellow-400 transition-all"
                style={{ width: `${(totalStars / maxStars) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* topic level cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quests.map((tq, i) => {
          const prevCleared = i === 0 || quests[i - 1].seen > 0;
          const bossReady = tq.stars >= 2;
          return (
            <div
              key={tq.id}
              className={cn(
                "relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all",
                tq.bossDefeated && "border-yellow-400/50",
              )}
            >
              {tq.bossDefeated && (
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-600">
                  <Crown className="size-3" /> Cleared
                </span>
              )}
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: tq.tone }}
                >
                  Stage {i + 1}
                </span>
              </div>
              <h3 className="mt-0.5 text-sm font-semibold leading-tight">{tq.label}</h3>

              <div className="mt-2 flex items-center gap-1">
                {[0, 1, 2].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      "size-5",
                      s < tq.stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30",
                    )}
                  />
                ))}
                <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                  {tq.mastered}/{tq.total} mastered
                </span>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(tq.mastered / tq.total) * 100}%`, backgroundColor: tq.tone }}
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={bossReady ? "default" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => setFight(tq.id)}
                  disabled={!prevCleared && !bossReady && tq.seen === 0 && i > 0}
                >
                  <Swords className="size-3.5" />
                  {tq.bossDefeated ? "Rematch boss" : bossReady ? "Fight boss" : "Challenge"}
                </Button>
              </div>
              {!bossReady && !tq.bossDefeated && (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Reach 2★ to fully arm the boss fight — but you can challenge early.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* trophy case */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Trophy className="size-4 text-yellow-500" />
          Trophy Case
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {unlockedAch} of {ACHIEVEMENTS.length} unlocked
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const got = !!achievements[a.id];
            const hidden = a.secret && !got;
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-2.5",
                  got ? "border-primary/40 bg-primary/5" : "border-dashed opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg text-lg",
                    got ? "bg-background" : "bg-muted grayscale",
                  )}
                >
                  {hidden ? <Lock className="size-4 text-muted-foreground" /> : a.emoji}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">
                    {hidden ? "Hidden trophy" : a.name}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {hidden ? "Keep studying to reveal" : a.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Boss fight ────────────────────────────────────────────────────────────────
const BOSS_MAX = 100;
const YOU_MAX = 100;

function BossFight({ topic, onExit }: { topic: TopicId; onExit: () => void }) {
  const meta = TOPIC_BY_ID[topic];
  const bossName = BOSS_NAMES[topic];
  const xp = useStore((s) => s.profile.xp);
  const level = levelProgress(xp).level;

  const pool = useMemo(() => QUESTIONS.filter((q) => q.topic === topic), [topic]);
  const queueRef = useRef<Question[]>([]);
  const [round, setRound] = useState(0);
  const [bossHp, setBossHp] = useState(BOSS_MAX);
  const [youHp, setYouHp] = useState(YOU_MAX);
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<"fight" | "won" | "lost">("fight");
  const [feedback, setFeedback] = useState<null | { correct: boolean; dmg: number }>(null);
  const [hits, setHits] = useState(0);
  const [answered, setAnswered] = useState(0);
  const startRef = useRef(Date.now());
  const [shake, setShake] = useState<"boss" | "you" | null>(null);

  // build/refill queue
  const nextQueue = useCallback(() => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    queueRef.current = queueRef.current.concat(shuffled);
  }, [pool]);

  if (queueRef.current.length === 0) nextQueue();
  const q = queueRef.current[round];

  useEffect(() => {
    setSelected([]);
    setFeedback(null);
    startRef.current = Date.now();
    if (round >= queueRef.current.length - 1) nextQueue();
  }, [round, nextQueue]);

  const toggle = (id: string) => {
    if (feedback || !q) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (q.select === 1) return [id];
      if (prev.length >= q.select) return prev;
      return [...prev, id];
    });
  };

  const commit = () => {
    if (!q || feedback || selected.length !== q.select) return;
    const ms = Date.now() - startRef.current;
    const g = grade(q, selected);
    const fast = ms < 8000;
    recordAnswer({
      qid: q.id,
      correct: g.correct,
      confidence: g.correct ? (fast ? "confident" : "unsure") : "unsure",
      ms,
      selected,
    });
    setAnswered((n) => n + 1);

    if (g.correct) {
      const dmg = fast ? 22 : 16;
      const nb = Math.max(0, bossHp - dmg);
      setBossHp(nb);
      setHits((h) => h + 1);
      setShake("boss");
      setFeedback({ correct: true, dmg });
      if (nb <= 0) {
        setPhase("won");
        recordBossWin(topic);
        logSession({ mode: "Boss Fight", total: answered + 1, correct: hits + 1 });
      }
    } else {
      const dmg = 20;
      const ny = Math.max(0, youHp - dmg);
      setYouHp(ny);
      setShake("you");
      setFeedback({ correct: false, dmg });
      if (ny <= 0) {
        setPhase("lost");
        logSession({ mode: "Boss Fight", total: answered + 1, correct: hits });
      }
    }
    setTimeout(() => setShake(null), 500);
  };

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (phase !== "fight") return;
      const k = e.key.toLowerCase();
      if (feedback) {
        if (k === "enter" || k === " ") {
          e.preventDefault();
          setRound((r) => r + 1);
        }
        return;
      }
      const opt = q?.options.find((o) => o.id === k);
      if (opt) {
        e.preventDefault();
        toggle(opt.id);
      } else if (k === "enter" && q && selected.length === q.select) {
        e.preventDefault();
        commit();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (phase !== "fight") {
    const won = phase === "won";
    return (
      <div className="mx-auto max-w-lg">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border-2 p-8 text-center shadow-lg",
            won
              ? "border-yellow-400/50 bg-gradient-to-br from-yellow-400/15 to-card"
              : "border-destructive/40 bg-gradient-to-br from-destructive/10 to-card",
          )}
        >
          <div
            className={cn(
              "mx-auto flex size-28 items-center justify-center",
              won && "battle-victory",
            )}
          >
            <Companion level={level} size={104} mood={won ? "happy" : "sad"} />
          </div>
          <h2 className="mt-3 text-3xl font-black">{won ? "Boss Defeated!" : "You fell…"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {won
              ? `You bested ${bossName} · +45 XP · ${meta.short} boss cleared`
              : `${bossName} got the better of you. Master a few more ${meta.short} questions and try again.`}
          </p>
          {won &&
            Array.from({ length: 20 }).map((_, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: `${(i * 5) % 100}%`,
                  top: "-10px",
                  background: ["#f2c94c", "#22d3ee", "#ff5ac9", "#a8fdff", "#c78cff"][i % 5],
                  animationDelay: `${(i % 6) * 0.12}s`,
                }}
              />
            ))}
          <div className="mt-6 flex justify-center gap-2">
            {!won && (
              <Button
                onClick={() => {
                  setBossHp(BOSS_MAX);
                  setYouHp(YOU_MAX);
                  setHits(0);
                  setAnswered(0);
                  setRound((r) => r + 1);
                  setPhase("fight");
                }}
              >
                Try again
              </Button>
            )}
            <Button variant={won ? "default" : "outline"} onClick={onExit} className="gap-2">
              <ArrowLeft className="size-4" /> Quest map
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const inst = instruction(q);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onExit}>
        <ArrowLeft className="size-4" /> Retreat
      </Button>

      {/* Boss arena */}
      <div className="relative overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-slate-900 via-indigo-950 to-black p-4 shadow-lg sm:p-5">
        <div className="grid grid-cols-2 items-end gap-3">
          {/* You */}
          <HpFighter name="You" hp={youHp} max={YOU_MAX} side="left" shake={shake === "you"}>
            <Companion level={level} size={64} mood={shake === "you" ? "sad" : "idle"} />
          </HpFighter>
          {/* Boss */}
          <HpFighter
            name={bossName}
            hp={bossHp}
            max={BOSS_MAX}
            side="right"
            shake={shake === "boss"}
            boss
          >
            <div
              className="text-4xl"
              style={{ filter: "drop-shadow(0 0 8px rgba(255,80,80,0.6))" }}
            >
              {BOSS_EMOJI[topic]}
            </div>
          </HpFighter>
        </div>
        {feedback && (
          <div className="mt-3 text-center">
            <span
              className={cn(
                "dmg-float inline-block text-xl font-black",
                feedback.correct ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {feedback.correct ? `-${feedback.dmg} to boss!` : `-${feedback.dmg} to you`}
            </span>
          </div>
        )}
      </div>

      {/* Question */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded px-2 py-1 text-white" style={{ backgroundColor: meta.tone }}>
            {meta.short}
          </span>
          <span className="rounded bg-secondary px-2 py-1 uppercase tracking-wide text-secondary-foreground">
            {inst.text}
          </span>
          {q.examNo && (
            <span className="rounded bg-primary/10 px-2 py-1 text-primary">Final Q{q.examNo}</span>
          )}
        </div>
        <h2 className="text-lg font-semibold leading-snug">{q.stem}</h2>

        <div className="mt-4 grid gap-2.5">
          {q.options.map((opt) => {
            const sel = selected.includes(opt.id);
            const isAns = q.answer.includes(opt.id);
            let stateCls = "border-border bg-background hover:border-primary/40 hover:bg-accent/50";
            if (feedback) {
              if (isAns) stateCls = "border-success bg-success/10";
              else if (sel) stateCls = "border-destructive bg-destructive/10";
            } else if (sel) stateCls = "border-primary bg-primary/5";
            return (
              <button
                key={opt.id}
                onClick={() => toggle(opt.id)}
                disabled={!!feedback}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all",
                  stateCls,
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold uppercase",
                    feedback && isAns
                      ? "border-success bg-success text-success-foreground"
                      : sel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {feedback && isAns ? (
                    <Check className="size-4" />
                  ) : feedback && sel ? (
                    <X className="size-4" />
                  ) : (
                    opt.id
                  )}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed sm:text-[15px]">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {feedback ? (
          <div className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">{q.explain}</p>
            <Button className="w-full gap-2" onClick={() => setRound((r) => r + 1)}>
              Next strike <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selected.length}/{q.select} selected · {hits} hits landed
            </span>
            <Button onClick={commit} disabled={selected.length !== q.select} className="gap-2">
              <Swords className="size-4" /> Strike
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const BOSS_EMOJI: Record<TopicId, string> = {
  trauma: "💥",
  "hernia-lap": "🧬",
  "acute-abdomen": "🌋",
  pancreas: "🔥",
  "spleen-adrenal": "🩸",
  "ulcer-gastric": "⚔️",
  "small-bowel": "🐍",
  "crohn-meckel": "👻",
  appendix: "💣",
  liver: "🐉",
  biliary: "🦠",
  colorectal: "🦑",
  transfusion: "🤖",
};

function HpFighter({
  name,
  hp,
  max,
  side,
  shake,
  boss,
  children,
}: {
  name: string;
  hp: number;
  max: number;
  side: "left" | "right";
  shake: boolean;
  boss?: boolean;
  children: React.ReactNode;
}) {
  const pct = (hp / max) * 100;
  return (
    <div className={cn("flex flex-col gap-2", side === "right" && "items-end")}>
      <div
        className={cn(
          "flex",
          side === "left" ? "justify-start" : "justify-end",
          shake && "battle-shake",
        )}
      >
        <div style={{ transform: side === "right" && !boss ? "scaleX(-1)" : undefined }}>
          {children}
        </div>
      </div>
      <div className={cn("w-full max-w-[200px]", side === "right" && "ml-auto")}>
        <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-white">
          <span className="flex items-center gap-1 truncate">
            {boss ? (
              <Swords className="size-3 text-rose-400" />
            ) : (
              <Heart className="size-3 text-emerald-400" />
            )}
            <span className="truncate">{name}</span>
          </span>
          <span className="tabular-nums text-white/70">{hp}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              boss
                ? "bg-rose-500"
                : pct > 50
                  ? "bg-emerald-400"
                  : pct > 25
                    ? "bg-amber-400"
                    : "bg-rose-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
