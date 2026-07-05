GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_answers TO authenticated;
GRANT ALL ON public.battle_rooms TO service_role;
GRANT ALL ON public.battle_players TO service_role;
GRANT ALL ON public.battle_answers TO service_role;