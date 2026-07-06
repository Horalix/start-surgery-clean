CREATE OR REPLACE FUNCTION public.is_current_battle_participant(_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.battle_players bp
    WHERE bp.room_id = _room_id
      AND bp.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_battle_room_waiting(_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.battle_rooms br
    WHERE br.id = _room_id
      AND br.status = 'waiting'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_current_battle_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_battle_room_waiting(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_battle_participant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_battle_waiting(uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "rooms are visible to authenticated joiners and participants" ON public.battle_rooms;
DROP POLICY IF EXISTS "authenticated users can join waiting rooms as themselves" ON public.battle_players;
DROP POLICY IF EXISTS "players can see room rosters" ON public.battle_players;
DROP POLICY IF EXISTS "players can submit their own answers" ON public.battle_answers;
DROP POLICY IF EXISTS "room participants can read battle answers" ON public.battle_answers;

CREATE POLICY "rooms are visible to authenticated joiners and participants"
ON public.battle_rooms
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    status = 'waiting'
    OR host_user_id = auth.uid()
    OR public.is_current_battle_participant(id)
  )
);

CREATE POLICY "authenticated users can join waiting rooms as themselves"
ON public.battle_players
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND public.is_battle_room_waiting(room_id)
);

CREATE POLICY "players can see room rosters"
ON public.battle_players
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.is_battle_room_waiting(room_id)
    OR public.is_current_battle_participant(room_id)
  )
);

CREATE POLICY "players can submit their own answers"
ON public.battle_answers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND public.is_current_battle_participant(room_id)
);

CREATE POLICY "room participants can read battle answers"
ON public.battle_answers
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_current_battle_participant(room_id)
);