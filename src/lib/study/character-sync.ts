/**
 * Cloud sync for the character customization.
 * - On sign-in: pull `profiles.character` and overwrite local (server wins for that session).
 * - On local setCharacter: debounced upsert back to `profiles`.
 * Keeps the surgeon skin (including the legendary forms + Angel/Devil tier) consistent
 * across devices for the same user.
 */
import { supabase } from "@/integrations/supabase/client";
import { applyRemoteCharacter, getState, onCharacterChange } from "./store";
import type { CharacterCustomization } from "./types";

let inited = false;
let currentUserId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchAndApply(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("character")
    .eq("user_id", userId)
    .maybeSingle();
  const remote = (data?.character ?? null) as CharacterCustomization | null;
  if (remote) {
    applyRemoteCharacter(remote);
  } else {
    // No cloud copy yet — push whatever the device has so the next login sees it.
    const local = getState().character;
    if (local) pushCharacterNow(userId, local);
  }
}

async function pushCharacterNow(userId: string, character: CharacterCustomization) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const meta = userData.user?.user_metadata as
      { display_name?: string; full_name?: string } | undefined;
    const displayName =
      meta?.display_name || meta?.full_name || userData.user?.email?.split("@")[0] || "Player";
    await supabase.from("profiles").upsert(
      {
        user_id: userId,
        display_name: displayName,
        character: character as never,
      } as never,
      { onConflict: "user_id" },
    );
  } catch {
    /* ignore — best-effort sync */
  }
}

function schedulePush(character: CharacterCustomization | undefined) {
  if (!currentUserId || !character) return;
  if (pushTimer) clearTimeout(pushTimer);
  const uid = currentUserId;
  pushTimer = setTimeout(() => pushCharacterNow(uid, character), 600);
}

export function initCharacterSync() {
  if (inited || typeof window === "undefined") return;
  inited = true;

  onCharacterChange(schedulePush);

  supabase.auth.getUser().then(({ data }) => {
    if (data.user) {
      currentUserId = data.user.id;
      fetchAndApply(data.user.id);
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      currentUserId = session.user.id;
      fetchAndApply(session.user.id);
    } else if (event === "SIGNED_OUT") {
      currentUserId = null;
    }
  });
}
