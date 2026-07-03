-- =============================================================================
-- Sigil — §83: Seasons + Achievements
-- Migration: 20260629000100_seasons_achievements.sql
--
-- Creates:
--   seasons           — named ranked windows (admin-managed)
--   achievements      — catalog of 12 badge definitions
--   user_achievements — earned rows per user
--
-- RLS:
--   seasons           → public SELECT (no INSERT/UPDATE from client)
--   achievements      → public SELECT
--   user_achievements → public SELECT + owner INSERT
--                       unique(user_id, achievement_id) prevents duplicates
-- =============================================================================

-- ── Seasons ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT seasons_window_check CHECK (ends_at > starts_at)
);

-- Only one active season at a time (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active
  ON seasons (is_active)
  WHERE is_active = true;

-- Fast lookup for active season
CREATE INDEX IF NOT EXISTS seasons_active_idx ON seasons (is_active, starts_at DESC);

-- RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons_public_read"
  ON seasons FOR SELECT
  USING (true);

-- ── Achievements catalog ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text NOT NULL,
  icon        text NOT NULL,   -- emoji displayed in the badge
  tier        text NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_public_read"
  ON achievements FOR SELECT
  USING (true);

-- ── User achievements ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_idx ON user_achievements (user_id);
CREATE INDEX IF NOT EXISTS user_achievements_ach_idx  ON user_achievements (achievement_id);

-- RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_achievements_public_read"
  ON user_achievements FOR SELECT
  USING (true);

CREATE POLICY "user_achievements_owner_insert"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── Seed: achievements catalog ────────────────────────────────────────────────
-- 12 achievements across 4 tiers.
-- ON CONFLICT DO NOTHING = safe to re-run.

INSERT INTO achievements (code, name, description, icon, tier) VALUES
  -- Bronze (entry-level)
  ('first_game',       'First Steps',        'Play your very first game on Sigil.',                         '🎮', 'bronze'),
  ('first_blood',      'First Blood',        'Win your first game.',                                        '⚔️', 'bronze'),
  ('five_wins',        'On a Roll',          'Accumulate 5 wins.',                                          '🔥', 'bronze'),

  -- Silver (mid-tier)
  ('bracket_climber',  'Bracket Climber',    'Win at least 3 games on the platform.',                       '📈', 'silver'),
  ('road_warrior',     'Road Warrior',       'Play 20 total games.',                                        '🛡️', 'silver'),
  ('commander_carnage','Commander Carnage',  'Deal 21 or more commander damage in a single game.',          '👑', 'silver'),
  ('come_back_kid',    'Come Back Kid',      'Win a game while at 5 life or less.',                         '💀', 'silver'),

  -- Gold
  ('pod_slayer',       'Pod Slayer',         'Win 10 games.',                                               '🏆', 'gold'),
  ('untouchable',      'Untouchable',        'Win a game while ending at 40 life or more.',                 '💎', 'gold'),
  ('veteran',          'Veteran',            'Win 25 games.',                                               '🌟', 'gold'),

  -- Platinum
  ('marathon',         'Marathon Runner',    'Play 100 total games.',                                       '⚡', 'platinum'),
  ('legend',           'Legend',             'Win 50 games. You are the Sigil.',                            '🔮', 'platinum')

ON CONFLICT (code) DO NOTHING;

-- ── Seed: initial active season ───────────────────────────────────────────────
-- Season 1 runs for 90 days from 2026-07-01.
-- ON CONFLICT on partial unique index for is_active=true means this is a no-op
-- if a season already exists.

INSERT INTO seasons (name, starts_at, ends_at, is_active)
VALUES (
  'Season 1 — The Gathering',
  '2026-07-01T00:00:00Z',
  '2026-09-29T23:59:59Z',
  true
)
ON CONFLICT DO NOTHING;
