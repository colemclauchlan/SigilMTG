-- G7.61: enforce the 8-seat cap + started-gate at the TABLE level, not only inside join_game.
-- The "participants self join" INSERT policy only checks profile_id = auth.uid(), so any signed-in
-- client that could READ the participants (all PUBLIC games) could bypass a join_game rejection by
-- self-inserting a 9th+ seat directly (the legacy client fallback did exactly that). A BEFORE INSERT
-- trigger closes the raw-INSERT path for every current and future client.
create or replace function public.enforce_participant_gates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_owner uuid;
  v_started boolean;
begin
  -- Same lock key as join_game: raw INSERTs serialize with the RPC's seat logic (lock is
  -- re-entrant within the transaction, so the RPC's own insert re-acquires it harmlessly).
  perform pg_advisory_xact_lock(hashtext(new.game_id::text));
  select count(*) into v_count from public.game_participants where game_id = new.game_id;
  if v_count >= 8 then
    raise exception 'game is full';
  end if;
  select g.owner_id, coalesce((g.settings->>'started')::boolean, false)
    into v_owner, v_started
    from public.games g where g.id = new.game_id;
  -- Fresh seats only before the game starts. Rejoins never INSERT (join_game returns the existing
  -- row), so this only blocks post-start gate-crashing. The owner stays exempt for host-side
  -- tooling (tracker imports seat players on a table the host may already have marked live).
  if v_started and v_owner is distinct from auth.uid() then
    raise exception 'game already started';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_participant_gates on public.game_participants;
create trigger trg_participant_gates
before insert on public.game_participants
for each row execute function public.enforce_participant_gates();
