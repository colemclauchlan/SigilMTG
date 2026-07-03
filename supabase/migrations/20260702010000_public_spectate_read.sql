-- ============================================================
-- Sigil — public spectate (live 2x2 board mirror), hidden-info safe
-- ============================================================
-- Read-only visibility into PUBLIC games for everyone (incl. anon):
--   games / participants / counters / commander damage / actions / dice,
--   and card instances ONLY outside hidden zones (no hand/library rows,
--   no face-down cards). Hidden information never leaves RLS.
-- Additive policies (OR with existing member policies).
-- APPLIED to nvosctybynqsjrfuvkek on 2026-07-02 via MCP.
-- NOTE: game_participants.deck_cards (the decklist) is readable for public
-- games — decklists are treated like playgroup.gg lobby primers (public);
-- in-game hidden zones (hand/library order, face-down) are NOT exposed.
-- ============================================================

DROP POLICY IF EXISTS "spectate public games" ON public.games;
CREATE POLICY "spectate public games" ON public.games
  FOR SELECT USING (visibility = 'public');

DROP POLICY IF EXISTS "spectate public participants" ON public.game_participants;
CREATE POLICY "spectate public participants" ON public.game_participants
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.visibility = 'public'));

DROP POLICY IF EXISTS "spectate public cards" ON public.game_card_instances;
CREATE POLICY "spectate public cards" ON public.game_card_instances
  FOR SELECT USING (
    zone NOT IN ('hand','library')
    AND face_down IS NOT TRUE
    AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.visibility = 'public')
  );

DROP POLICY IF EXISTS "spectate public counters" ON public.game_counters;
CREATE POLICY "spectate public counters" ON public.game_counters
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.visibility = 'public'));

DROP POLICY IF EXISTS "spectate public cmdr damage" ON public.commander_damage;
CREATE POLICY "spectate public cmdr damage" ON public.commander_damage
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.visibility = 'public'));

DROP POLICY IF EXISTS "spectate public actions" ON public.game_actions;
CREATE POLICY "spectate public actions" ON public.game_actions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.visibility = 'public'));

DROP POLICY IF EXISTS "spectate public dice" ON public.dice_rolls;
CREATE POLICY "spectate public dice" ON public.dice_rolls
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.visibility = 'public'));
