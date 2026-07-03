-- ============================================================
-- Sigil — Tournament tables (§79)
-- ============================================================
-- Tables: tournaments, tournament_players, tournament_rounds, tournament_pairings
-- RLS: public read; owner write on tournaments; players report their own result.
-- ============================================================

-- ── tournaments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournaments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  format      text NOT NULL CHECK (format IN ('swiss', 'single_elim')),
  bracket_cap integer NOT NULL DEFAULT 8,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'finished')),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "tournaments_select_public"
  ON public.tournaments FOR SELECT USING (true);

-- Owner can insert
CREATE POLICY "tournaments_insert_owner"
  ON public.tournaments FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Owner can update (name, status, bracket_cap)
CREATE POLICY "tournaments_update_owner"
  ON public.tournaments FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Owner can delete (only while open)
CREATE POLICY "tournaments_delete_owner"
  ON public.tournaments FOR DELETE
  USING (auth.uid() = owner_id AND status = 'open');

-- ── tournament_players ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_players (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed          integer,
  dropped       boolean NOT NULL DEFAULT false,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, profile_id)
);

ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "tournament_players_select_public"
  ON public.tournament_players FOR SELECT USING (true);

-- Players can join (insert themselves)
CREATE POLICY "tournament_players_insert_self"
  ON public.tournament_players FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Players can drop (update their own row)
CREATE POLICY "tournament_players_update_self"
  ON public.tournament_players FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Tournament owner can update seed for any player
CREATE POLICY "tournament_players_update_owner"
  ON public.tournament_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_players.tournament_id AND t.owner_id = auth.uid()
    )
  );

-- ── tournament_rounds ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_no      integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round_no)
);

ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "tournament_rounds_select_public"
  ON public.tournament_rounds FOR SELECT USING (true);

-- Owner can insert rounds
CREATE POLICY "tournament_rounds_insert_owner"
  ON public.tournament_rounds FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_rounds.tournament_id AND t.owner_id = auth.uid()
    )
  );

-- ── tournament_pairings ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_pairings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id           uuid NOT NULL REFERENCES public.tournament_rounds(id) ON DELETE CASCADE,
  table_no           integer NOT NULL,
  player_ids         uuid[] NOT NULL,
  winner_profile_id  uuid REFERENCES auth.users(id),
  reported           boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_pairings ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "tournament_pairings_select_public"
  ON public.tournament_pairings FOR SELECT USING (true);

-- Owner can insert pairings
CREATE POLICY "tournament_pairings_insert_owner"
  ON public.tournament_pairings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournament_rounds tr
      JOIN public.tournaments t ON t.id = tr.tournament_id
      WHERE tr.id = tournament_pairings.round_id AND t.owner_id = auth.uid()
    )
  );

-- Players can report their own result (if they are in player_ids)
CREATE POLICY "tournament_pairings_update_player"
  ON public.tournament_pairings FOR UPDATE
  USING (auth.uid() = ANY(player_ids))
  WITH CHECK (auth.uid() = ANY(player_ids));

-- Owner can also update pairings
CREATE POLICY "tournament_pairings_update_owner"
  ON public.tournament_pairings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_rounds tr
      JOIN public.tournaments t ON t.id = tr.tournament_id
      WHERE tr.id = tournament_pairings.round_id AND t.owner_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tournaments_status       ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_owner        ON public.tournaments(owner_id);
CREATE INDEX IF NOT EXISTS idx_tp_tournament            ON public.tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tr_tournament            ON public.tournament_rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tpr_round                ON public.tournament_pairings(round_id);
