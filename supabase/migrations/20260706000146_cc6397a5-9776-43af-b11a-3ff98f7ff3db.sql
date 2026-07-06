DROP POLICY IF EXISTS "rooms are visible to authenticated joiners and participants" ON public.battle_rooms;
DROP POLICY IF EXISTS "authenticated users can join waiting rooms as themselves" ON public.battle_players;
DROP POLICY IF EXISTS "players can see room rosters" ON public.battle_players;
DROP POLICY IF EXISTS "players can submit their own answers" ON public.battle_answers;
DROP POLICY IF EXISTS "room participants can read battle answers" ON public.battle_answers;

CREATE POLICY "rooms are visible to authenticated joiners and hosts"
ON public.battle_rooms
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    status = 'waiting'
    OR host_user_id = auth.uid()
  )
);

CREATE POLICY "authenticated users can join waiting rooms as themselves"
ON public.battle_players
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.battle_rooms r
    WHERE r.id = battle_players.room_id
      AND r.status = 'waiting'
  )
);

CREATE POLICY "signed in users can see battle rosters"
ON public.battle_players
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "players can submit their own answers"
ON public.battle_answers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

CREATE POLICY "players can read answers in visible rooms"
ON public.battle_answers
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.battle_rooms r
    WHERE r.id = battle_answers.room_id
      AND (
        r.status = 'waiting'
        OR r.host_user_id = auth.uid()
      )
  )
);

REVOKE EXECUTE ON FUNCTION public.is_current_battle_participant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_battle_room_waiting(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_battle_participant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_battle_waiting(uuid) FROM PUBLIC, anon, authenticated;