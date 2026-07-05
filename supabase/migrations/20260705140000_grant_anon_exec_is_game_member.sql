-- Signed-out visitors could not load the public lobby list: the games RLS policy
-- "games member read" calls public.is_game_member(uuid), but EXECUTE was granted only
-- to authenticated/service_role. An anon SELECT on games therefore failed with
-- "permission denied for function is_game_member" (42501), aborting the query before
-- the public-discovery policy could apply. is_game_member is SECURITY DEFINER and
-- returns only a boolean membership check, so granting anon EXECUTE is safe (anon is a
-- member of nothing -> returns false; row visibility stays governed by RLS).
grant execute on function public.is_game_member(uuid) to anon;
