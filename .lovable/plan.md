
# Level up the game — v2

Six focused upgrades. Character JSON already exists on `profiles`; DB changes are just trigger allow-list + a small `character_missions` progress column.

## 1. Harder XP curve + real leveling feel

Flat 120 XP/level → quadratic curve in `src/lib/study/companion.ts`:
- `xpForLevel(n) = 80 * n * (n - 1)` cumulative (L2=160, L5=1600, L10=7200, L15=16800, L22=36960).
- Rewrite `levelForXp` / `levelProgress` around it.
- Bump stage minLevels (Sprout 1, Intern 4, Resident 8, Chief 13, Attending 19, Professor 28).

Tighten XP in `src/lib/study/store.ts`:
- Correct: 4 / 6 / 8 / 10 by confidence (was 8–12); wrong: 1 (was 3).
- Exam: `round(score * 3)` (was flat 40).
- Battle: win 30, loss 5.
- +5 once/day streak bonus.

Level-up toast + refreshed progress ring on Today.

## 2. Character syncs across devices (mobile too)

`profiles.character` JSON already exists. Add `src/lib/study/character-sync.ts`:
- On `SIGNED_IN` (and initial session), fetch server character → merge into local store (server wins for that session).
- Debounced upsert to `profiles` whenever `setCharacter` runs.
- Register once in `__root.tsx` next to existing auth listener.
- Trigger `enforce_special_character` still strips unauthorized skins server-side.

## 3. Today page: live animated companion

- Pass `character` from store into hero `<Companion />` in `src/routes/index.tsx` so the selected skin (Devil/Angel/Phoenix/Void/Titan/Professor + legendary tiers) shows.
- Idle-breathe + blink loop in `Companion.tsx` (CSS + SVG `<animate>`).
- One-shot "happy bounce" + sparkle burst when `profile.xp` increases; level-up fires toast.

## 4. Angel & Devil become upgradeable (XP + missions)

Angel stays Kerim-only, Devil stays Amrudin-only, but they now have **3 tiers each** that get visibly cooler as the owner grinds:

Devil tiers (Amrudin):
- **I — Imp**: current design.
- **II — Fiend**: bigger horns, molten cracks glowing on skin, floating ember particles, tail flame.
- **III — Archdemon**: massive spread wings with animated flame trails, crown of fire, pulsing hellfire aura, red lightning around feet.

Angel tiers (Kerim):
- **I — Cherub**: current.
- **II — Seraph**: six wings (animated flap), rotating halo of runes, twin light orbs.
- **III — Archangel**: radiant golden armor, huge feathered wings with aurora trail, holy sword, sunburst backdrop pulsing.

Upgrade requirements (checked in a new `character-progression.ts` selector, both must be true):
- Tier II: Level 10 **and** mission "Win 5 battles" complete.
- Tier III: Level 20 **and** mission "Score 74/74 on exam" **and** mission "Master 100 questions" complete.

New "Owner missions" panel on `character.tsx` for Kerim/Amrudin only — shows current tier, next-tier missions with live progress bars. Auto-applies highest unlocked tier on load. Tier is derived, not stored, so it can't be spoofed; DB trigger just needs to know the special name (`angel` / `devil`) — actual tier is a client render decision keyed off the owner's real profile stats.

## 5. Legendary forms remain Kerim/Amrudin exclusive — and much cooler

Trigger already restricts `phoenix`/`void`/`titan` to those two emails. Add three more with the same restriction:

- **Shadow Reaper** (`reaper`): obsidian hooded robe swaying, animated violet scythe trail, drifting smoke particles, red eye-glint pulse, cracked ground shadow.
- **Celestial Oracle** (`oracle`): white/gold priestess robes, rotating halo of runes, twin star orbs orbiting on elliptical paths, aurora aura, floating spellbook.
- **Cyber Samurai** (`samurai`): neon-cyan armor with animated circuit lines, holographic katana with scanline glow, glitching HUD reticle over one eye, hover-thrust ember trail.

All rendered in `Companion.tsx` with SVG `<animate>` / `<animateTransform>` + CSS — no new deps. Character page's legendary grid becomes 6 cards (phoenix, void, titan, reaper, oracle, samurai) shown only when the current user is Kerim or Amrudin; hidden for everyone else. DB trigger extended to allow `reaper`/`oracle`/`samurai` for those two emails only.

## 6. Battles that feel like actual battles

`src/routes/battle.tsx` PlayingRoom:
- **Arena view**: two players' `Companion`s face off across a dojo/arena background, big center vs., HP bars driven by remaining correct answers.
- Snapshot character onto `battle_players.character` at join so opponents render your exact skin (no join needed).
- **Attack FX**: correct answer → your companion lunges, slash + spark hits the opponent card; wrong → self shake + red flash.
- **Live action feed**: "Kerim answered Q3 in 4.2s ✅" ticker from existing realtime `battle_answers`.
- **Round header**: big "Round 3 / 8" + per-question timer ring.
- **Victory screen**: winner's companion does a victory pose, confetti, XP breakdown.

## 7. Analytics page overhaul (`src/routes/analytics.tsx`)

Rebuild into a real dashboard:
- **Header KPIs**: Level + XP-to-next progress, Accuracy (last 40), Mastery %, Current streak, Battles W/L.
- **XP over time**: sparkline of daily XP earned last 30 days (from `sessions` + `examAttempts`).
- **Accuracy trend**: line chart of rolling 20-answer accuracy over recent history.
- **Topic mastery heatmap**: grid of all topics colored by strength (weak → strong), click to jump into Bank filtered.
- **Confidence calibration**: bar chart — for each confidence level, actual accuracy vs. self-reported confidence (surfaces "dangerous overconfidence").
- **Fastest & slowest topics**: median answer time per topic.
- **Battle stats**: win rate, avg answer speed vs. opponents.
- **Companion progress panel**: current stage + missions toward next tier (mirrors character.tsx for Kerim/Amrudin).

Charts use `recharts` (already installed via shadcn's chart component). No new deps.

## Technical notes

- Level curve deterministic integer math.
- Character sync: single upsert on `profiles`, keyed by `user_id`; local write is source of truth after hydrate, server is source on fresh sign-in.
- Animations: pure CSS keyframes + SVG animate elements.
- Tier gating for Angel/Devil is purely a render decision from the owner's own profile — cannot be spoofed to affect anyone else because the owner check itself is the constraint.
- Battle FX: framer-motion not installed; use CSS + short-lived React state.
- Migration: allow new legendary names in trigger, restrict them to the two emails (mirrors existing phoenix/void/titan clause), add `battle_players.character JSONB`.

## Files touched

- `src/lib/study/companion.ts` — new curve + stages
- `src/lib/study/store.ts` — XP awards, streak bonus
- `src/lib/study/types.ts` — SpecialCharacter union (+ reaper/oracle/samurai)
- `src/lib/study/character-sync.ts` — new, cross-device sync
- `src/lib/study/character-progression.ts` — new, derives Angel/Devil tier + mission progress
- `src/routes/__root.tsx` — register sync
- `src/components/study/Companion.tsx` — animations, 3 tiers of Angel/Devil, 3 new legendaries
- `src/routes/index.tsx` — animated hero with selected skin
- `src/routes/character.tsx` — owner missions panel, tier previews, 6 legendary cards (Kerim/Amrudin only)
- `src/routes/battle.tsx` — arena UI, HP, feed, FX, victory
- `src/routes/analytics.tsx` — full dashboard rewrite
- `supabase/migrations/…` — trigger allow-list + battle_players.character
