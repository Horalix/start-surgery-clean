GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_answers TO authenticated;
GRANT ALL ON public.battle_rooms TO service_role;
GRANT ALL ON public.battle_players TO service_role;
GRANT ALL ON public.battle_answers TO service_role;

DROP POLICY IF EXISTS "authenticated users can host rooms" ON public.battle_rooms;
DROP POLICY IF EXISTS "rooms are visible to authenticated joiners and participants" ON public.battle_rooms;
DROP POLICY IF EXISTS "hosts can update their rooms" ON public.battle_rooms;
DROP POLICY IF EXISTS "authenticated users can join waiting rooms as themselves" ON public.battle_players;
DROP POLICY IF EXISTS "players can see room rosters" ON public.battle_players;
DROP POLICY IF EXISTS "players can update their own score row" ON public.battle_players;
DROP POLICY IF EXISTS "players can submit their own answers" ON public.battle_answers;
DROP POLICY IF EXISTS "room participants can read battle answers" ON public.battle_answers;
DROP POLICY IF EXISTS "players can correct only their own answer rows" ON public.battle_answers;

CREATE POLICY "authenticated users can host rooms"
ON public.battle_rooms
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND host_user_id = auth.uid());

CREATE POLICY "rooms are visible to authenticated joiners and participants"
ON public.battle_rooms
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    status = 'waiting'
    OR host_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.battle_players p
      WHERE p.room_id = battle_rooms.id AND p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "hosts can update their rooms"
ON public.battle_rooms
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND host_user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND host_user_id = auth.uid());

CREATE POLICY "authenticated users can join waiting rooms as themselves"
ON public.battle_players
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.battle_rooms r
    WHERE r.id = battle_players.room_id AND r.status = 'waiting'
  )
);

CREATE POLICY "players can see room rosters"
ON public.battle_players
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.battle_rooms r
    WHERE r.id = battle_players.room_id
      AND (
        r.status = 'waiting'
        OR r.host_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.battle_players mine
          WHERE mine.room_id = r.id AND mine.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "players can update their own score row"
ON public.battle_players
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "players can submit their own answers"
ON public.battle_answers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.battle_players p
    WHERE p.room_id = battle_answers.room_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "room participants can read battle answers"
ON public.battle_answers
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.battle_players p
    WHERE p.room_id = battle_answers.room_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "players can correct only their own answer rows"
ON public.battle_answers
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_special_character()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_special text;
  v_email   text;
  v_name    text;
  v_is_kerim boolean := false;
  v_is_amrudin boolean := false;
  v_allowed boolean := false;
BEGIN
  IF NEW.character IS NULL THEN
    RETURN NEW;
  END IF;

  v_special := lower(coalesce(NEW.character ->> 'special', ''));

  IF v_special = '' THEN
    RETURN NEW;
  END IF;

  IF v_special NOT IN ('angel','devil','phoenix','void','titan','professor') THEN
    NEW.character := NEW.character - 'special';
    RETURN NEW;
  END IF;

  SELECT lower(coalesce(email, '')) INTO v_email
  FROM auth.users WHERE id = NEW.user_id;

  v_name := lower(coalesce(NEW.display_name, ''));

  v_is_kerim   := (v_email = 'kerim.sabic@gmail.com' OR v_name LIKE '%kerim%');
  v_is_amrudin := (v_email = 'amrudin.naser@gmail.com' OR v_name LIKE '%amrudin%');

  IF v_special = 'angel' AND v_is_kerim THEN
    v_allowed := true;
  ELSIF v_special = 'devil' AND v_is_amrudin THEN
    v_allowed := true;
  ELSIF v_special IN ('phoenix','void','titan') AND (v_is_kerim OR v_is_amrudin) THEN
    v_allowed := true;
  ELSIF v_special = 'professor' THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    NEW.character := NEW.character - 'special';
  END IF;

  RETURN NEW;
END;
$function$;