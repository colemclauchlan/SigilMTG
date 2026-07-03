-- ============================================================
-- Sigil — scheduled games (playgroup.gg parity)
-- ============================================================
-- A public game can advertise a future start time in the lobby ("Find a game"
-- shows a Starts-in badge). Additive + safe to run once.
-- APPLIED to nvosctybynqsjrfuvkek on 2026-07-02 via MCP.
-- ============================================================

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
CREATE INDEX IF NOT EXISTS games_scheduled_at_idx ON public.games (scheduled_at) WHERE scheduled_at IS NOT NULL;
