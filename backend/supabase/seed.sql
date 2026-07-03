-- Optional seed helpers. Run after creating a real auth user, replacing the UUID.
-- select id, email from auth.users;

-- Example:
-- insert into public.game_presets (owner_id, name, starting_life, player_count, layout, visible_counter_keys)
-- values ('00000000-0000-0000-0000-000000000000', 'Commander pod', 40, 4, 'auto', array['tax','poison']);

-- insert into public.player_profiles (owner_id, display_name, favorite_commander_name, color_index)
-- values
--   ('00000000-0000-0000-0000-000000000000', 'Player 1', 'Atraxa, Praetors'' Voice', 1),
--   ('00000000-0000-0000-0000-000000000000', 'Player 2', 'Edgar Markov', 0);
