
CREATE OR REPLACE FUNCTION public.enforce_special_character()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_special text;
  v_email   text;
  v_name    text;
  v_allowed boolean;
BEGIN
  IF NEW.character IS NULL THEN
    RETURN NEW;
  END IF;

  v_special := lower(coalesce(NEW.character ->> 'special', ''));

  IF v_special NOT IN ('angel', 'devil') THEN
    RETURN NEW;
  END IF;

  SELECT lower(coalesce(email, '')) INTO v_email
  FROM auth.users WHERE id = NEW.user_id;

  v_name := lower(coalesce(NEW.display_name, ''));
  v_allowed := false;

  IF v_special = 'angel' THEN
    IF v_email = 'kerim.sabic@gmail.com' OR v_name LIKE '%kerim%' THEN
      v_allowed := true;
    END IF;
  ELSIF v_special = 'devil' THEN
    IF v_email = 'amrudin.naser@gmail.com' OR v_name LIKE '%amrudin%' THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    NEW.character := NEW.character - 'special';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_special_character_trigger ON public.profiles;
CREATE TRIGGER enforce_special_character_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_special_character();
