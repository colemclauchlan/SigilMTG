-- Member-writable turn/phase/settings RPCs (2026-07-06).
--
-- ROOT CAUSE (verified live against the "Sigil" project, nvosctybynqsjrfuvkek):
--   "games owner manage" is an ALL-command RLS policy requiring auth.uid() = owner_id.
--   There is no member-level UPDATE policy on public.games. A non-host (guest) calling
--   games.update({...}) -- exactly what web-sync.js updateGameTurn()/updateGamePhase() do --
--   is silently filtered to zero rows by RLS: PostgREST returns { data: [], error: null }.
--   No exception is thrown, so the app's fire-and-forget writers have nothing to catch.
--   The active client's local (optimistic) state advances, but the DB row never changes,
--   so no other client's postgres_changes subscription ever fires. This is the sync bug:
--   turn-pass and phase changes from a guest never reach the host or any other client.
--
-- FIX: SECURITY DEFINER RPCs, granted to authenticated + anon, that any game MEMBER
-- (is_game_member) may call to mutate ONLY the turn/phase/settings columns on games --
-- never ownership, visibility, or other host-only fields. This keeps "games owner manage"
-- intact (defense in depth for direct table writes) while giving every seated player a
-- legitimate, membership-checked path to advance the shared game clock.

-- games.settings: host-set table config (e.g. { allowInteract: bool }). Referenced by
-- web-sync.js updateGameSettings() since 2026-07-05 but the column was never migrated --
-- that writer has been failing silently (wrapped in try/catch) ever since.
alter table public.games
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- ---- set_game_turn: advance whose turn it is + the turn counter ----
create or replace function public.set_game_turn(p_game uuid, p_active_seat int, p_total_turns int)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.is_game_member(p_game) then
    raise exception 'not a member of this game';
  end if;
  update public.games
    set active_seat_index = p_active_seat,
        total_turns = p_total_turns
    where id = p_game;
end;
$function$;

-- ---- set_game_phase: advance the turn-structure phase (untap/upkeep/.../cleanup) ----
create or replace function public.set_game_phase(p_game uuid, p_phase text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.is_game_member(p_game) then
    raise exception 'not a member of this game';
  end if;
  if p_phase is null or length(trim(p_phase)) = 0 then
    raise exception 'phase required';
  end if;
  update public.games
    set phase = p_phase
    where id = p_game;
end;
$function$;

-- ---- set_game_settings: host-only table config toggle (e.g. cross-player card interaction) ----
-- Membership-gated like the others, but ALSO host-gated inside the function (host-only setting per
-- Task 2 of the 2026-07-06 sync fix) -- a non-host caller gets a clean exception, not a silent no-op.
create or replace function public.set_game_settings(p_game uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_next jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not public.is_game_member(p_game) then
    raise exception 'not a member of this game';
  end if;
  select owner_id into v_owner from public.games where id = p_game;
  if v_owner is null then
    raise exception 'game not found';
  end if;
  if v_owner <> v_uid then
    raise exception 'only the host can change table settings';
  end if;
  update public.games
    set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    where id = p_game
    returning settings into v_next;
  return v_next;
end;
$function$;

grant execute on function public.set_game_turn(uuid, int, int) to authenticated, anon;
grant execute on function public.set_game_phase(uuid, text) to authenticated, anon;
grant execute on function public.set_game_settings(uuid, jsonb) to authenticated, anon;
