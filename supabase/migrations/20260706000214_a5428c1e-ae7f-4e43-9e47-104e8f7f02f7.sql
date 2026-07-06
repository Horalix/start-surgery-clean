ALTER TABLE public.battle_rooms
ADD COLUMN IF NOT EXISTS player_user_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.battle_rooms br
SET player_user_ids = COALESCE(players.ids, ARRAY[br.host_user_id]::uuid[])
FROM (
  SELECT room_id, array_agg(DISTINCT user_id) AS ids
  FROM public.battle_players
  GROUP BY room_id
) players
WHERE players.room_id = br.id;

UPDATE public.battle_rooms
SET player_user_ids = ARRAY[host_user_id]::uuid[]
WHERE array_length(player_user_ids, 1) IS NULL;

CREATE OR REPLACE FUNCTION public.add_battle_room_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.battle_rooms
  SET player_user_ids = (
    SELECT array_agg(DISTINCT x)
    FROM unnest(player_user_ids || NEW.user_id) AS x
  )
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_battle_room_participant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS add_battle_room_participant_trigger ON public.battle_players;
CREATE TRIGGER add_battle_room_participant_trigger
AFTER INSERT ON public.battle_players
FOR EACH ROW EXECUTE FUNCTION public.add_battle_room_participant();

DROP POLICY IF EXISTS "rooms are visible to authenticated joiners and hosts" ON public.battle_rooms;
DROP POLICY IF EXISTS "players can read answers in visible rooms" ON public.battle_answers;

CREATE POLICY "rooms are visible to authenticated participants"
ON public.battle_rooms
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    status = 'waiting'
    OR host_user_id = auth.uid()
    OR auth.uid() = ANY(player_user_ids)
  )
);

CREATE POLICY "players can read answers in their rooms"
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
        r.host_user_id = auth.uid()
        OR auth.uid() = ANY(r.player_user_ids)
      )
  )
);

DROP FUNCTION IF EXISTS public.is_current_battle_participant(uuid);
DROP FUNCTION IF EXISTS public.is_battle_room_waiting(uuid);
DROP FUNCTION IF EXISTS public.is_battle_participant(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_battle_waiting(uuid);