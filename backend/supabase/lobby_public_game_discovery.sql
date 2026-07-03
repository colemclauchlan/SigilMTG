-- Migration: lobby_public_game_discovery (applied 2026-06-24 to nvosctybynqsjrfuvkek)
-- Lobby support: let any signed-in user discover PUBLIC, not-yet-completed games.
-- Additive only — existing "member read" + "owner manage" policies are unchanged and
-- private games stay member-only (multiple permissive SELECT policies are OR'd).
-- Exposes only non-secret metadata (games row + participant seat/name/life; no card identities).

create policy "games public discover" on public.games
  for select to authenticated
  using (visibility = 'public' and completed_at is null);

create policy "participants public read" on public.game_participants
  for select to authenticated
  using (exists (
    select 1 from public.games g
    where g.id = game_participants.game_id
      and g.visibility = 'public'
      and g.completed_at is null
  ));
