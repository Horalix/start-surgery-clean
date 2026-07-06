ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS best_exam_score integer NOT NULL DEFAULT 0;

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
  v_best_exam integer := 0;
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
  v_best_exam := greatest(coalesce(NEW.best_exam_score, 0), 0);

  v_is_kerim   := (v_email = 'kerim.sabic@gmail.com' OR v_name LIKE '%kerim%');
  v_is_amrudin := (v_email = 'amrudin.naser@gmail.com' OR v_name LIKE '%amrudin%');

  IF v_special = 'angel' AND v_is_kerim THEN
    v_allowed := true;
  ELSIF v_special = 'devil' AND v_is_amrudin THEN
    v_allowed := true;
  ELSIF v_special IN ('phoenix','void','titan') AND (v_is_kerim OR v_is_amrudin) THEN
    v_allowed := true;
  ELSIF v_special = 'professor' AND v_best_exam >= 74 THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    NEW.character := NEW.character - 'special';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_special_character() FROM PUBLIC, anon, authenticated;