-- ============================================================
-- Sigil — account / match-history / ELO alignment
-- ============================================================
-- The Ranked + Profile UIs read columns the base schema never had:
--   profiles.elo / wins / losses  and  match_history.user_id / won / commander_name / bracket / elo_delta
-- Apply this in the Supabase project so those pages populate from online play.
-- All additive (IF NOT EXISTS) — safe to run once against the live schema.
-- ============================================================

-- profiles: ranked identity columns the leaderboard + profile read.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS elo    integer NOT NULL DEFAULT 1200;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wins   integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0;

-- match_history: per-participant fields the profile + metagame read.
-- (Existing rows keep owner_id / winner_participant_id / summary; these add the read shape.)
ALTER TABLE public.match_history ADD COLUMN IF NOT EXISTS user_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.match_history ADD COLUMN IF NOT EXISTS won            boolean;
ALTER TABLE public.match_history ADD COLUMN IF NOT EXISTS commander_name text;
ALTER TABLE public.match_history ADD COLUMN IF NOT EXISTS bracket        integer;
ALTER TABLE public.match_history ADD COLUMN IF NOT EXISTS elo_delta      integer;

CREATE INDEX IF NOT EXISTS match_history_user_id_idx ON public.match_history (user_id, created_at DESC);

-- Ranked leaderboard + metagame need to read every player's public stats (not just their own rows).
-- profiles are non-sensitive here (display_name / elo / w-l), so allow public read.
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);

-- Let a signed-in user insert their OWN per-participant match rows, and read all rows for the metagame.
DROP POLICY IF EXISTS "match_history self insert" ON public.match_history;
CREATE POLICY "match_history self insert" ON public.match_history FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = owner_id);
DROP POLICY IF EXISTS "match_history public read" ON public.match_history;
CREATE POLICY "match_history public read" ON public.match_history FOR SELECT USING (true);
