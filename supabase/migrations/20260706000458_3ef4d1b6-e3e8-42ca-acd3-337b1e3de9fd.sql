DROP POLICY IF EXISTS "signed in users can see battle rosters" ON public.battle_players;
DROP POLICY IF EXISTS "players can submit their own answers" ON public.battle_answers;

CREATE POLICY "players can see rosters for visible rooms"
ON public.battle_players
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.battle_rooms r
    WHERE r.id = battle_players.room_id
      AND (
        r.status = 'waiting'
        OR r.host_user_id = auth.uid()
        OR auth.uid() = ANY(r.player_user_ids)
      )
  )
);

CREATE POLICY "players can submit answers in their rooms"
ON public.battle_answers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.battle_rooms r
    WHERE r.id = battle_answers.room_id
      AND auth.uid() = ANY(r.player_user_ids)
  )
);