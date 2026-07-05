## Plan

### 1. Angel & Devil — full custom skins (as cool as possible)

Rewrite the `Companion` renderer so `character.special` completely replaces the base scrubs surgeon with a hand-crafted pixel character. Both skins render everywhere the avatar appears: `/character` preview, sidebar footer, header chip, and leaderboard.

**Angel — "Celestial Healer"**
- Flowing white + gold robe with a gold chest sash and gemstone clasp
- Two large layered feathered wings (cream / white / soft gold shading)
- Glowing halo floating above the head with a soft radial glow
- Warm gold aura behind the whole character
- Soft blonde hair, gentle blue eyes, calm smile
- Subtle slow floating bob animation + faint sparkle particles

**Devil — "Shadow Surgeon"**
- Dark crimson + black hooded robe with jagged trim
- Curled ram horns and pointed ears
- Glowing red eyes with a soft red glow
- Two bat wings behind (black with crimson membrane)
- Small floating trident by the side
- Dark ember aura + rising red particles behind the body
- Slight menacing float animation

Both:
- Animated glow ring behind the avatar
- Rendered at proper size in every avatar slot (not just the /character page)

### 2. Restrict the skins — enforce on the server, not just the UI

Right now anyone could edit their `profiles.character` JSON in devtools and pick a skin. To make it truly exclusive but still visible to everyone:

- Add a database trigger on `profiles` that inspects the incoming `character` JSON. If it sets `special = "angel"` and the user's email/display_name isn't on the angel allow-list, strip the field. Same for `devil`. The allow-list lives in the trigger (kerim.sabic@gmail.com / name contains "kerim" → angel; amrudin.naser@gmail.com / name contains "amrudin" → devil).
- Same rule applied to `leaderboard_entries.character` so leaderboard rows can't sneak the skin in either.
- Client-side UI still hides the "Secret forms" section from non-eligible users (nice UX), but the trigger is the real gate.
- Everyone else's app renders whatever `special` value is stored — so if Kerim or Amrudin pick a skin, every player sees it on the leaderboard, in battle, everywhere.

### 3. Remove Google sign-in entirely

Since you're hosting on Netlify:
- Delete the "Continue with Google" button and the `lovable` OAuth import from `/auth`.
- Remove the divider and simplify the auth card to a clean email + password form.

### 4. Make login work perfectly

Rewrite `/auth` and tighten the `AppShell` gate to fix the real bugs:

- **Signup without confirmation**: after `signUp`, check if a session was returned. If not, show a clear message ("Check your email to confirm your account, then sign in") and switch to sign-in mode instead of lying with "You're signed in."
- **Race between auth listener and redirects**: use a single `onAuthStateChange` listener, don't manually navigate on submit. Add a proper `INITIAL_SESSION` handler so hard refreshes don't briefly bounce to `/auth`.
- **AppShell gate**: keep `authState = "loading"` until the first `onAuthStateChange` event fires (which supabase-js always fires on subscribe with the initial session), so we never redirect based on a stale "no session" read.
- **Clearer errors**: display Supabase's message inline under the form instead of only a toast, and translate the common ones ("Invalid login credentials" → "Wrong email or password", "Email not confirmed" → "Please confirm your email first — check your inbox").
- **Forgot password**: add a "Forgot password?" link that calls `resetPasswordForEmail` with `redirectTo: <origin>/reset-password`, plus a new `/reset-password` public route that lets the user set a new password via `supabase.auth.updateUser`.
- **Post sign-in destination**: land on `/` (Today) rather than `/battle`, so returning users see their study dashboard.

### Technical notes

- Database migration adds a `BEFORE INSERT OR UPDATE` trigger + function on `profiles` and `leaderboard_entries` to validate the `character.special` field against the allow-list. Uses `auth.email()` + display_name from the row.
- Skins are pure canvas drawing in `Companion.tsx` — no new assets, no dependencies.
- New file: `src/routes/reset-password.tsx` (public route).
- Files touched: `src/routes/auth.tsx`, `src/components/study/AppShell.tsx`, `src/components/study/Companion.tsx`, `src/routes/character.tsx`, plus the new migration + `reset-password.tsx`.
