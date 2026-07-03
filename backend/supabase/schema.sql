-- MTG Table Tracker shared backend schema
-- Apply in Supabase SQL editor or via supabase db push.

create extension if not exists "pgcrypto";

create type public.game_status as enum ('active', 'completed', 'archived');
create type public.game_action_type as enum (
  'life_change',
  'counter_change',
  'commander_damage_change',
  'commander_tax_change',
  'turn_cycle_change',
  'dice_roll',
  'coin_flip',
  'random_player',
  'player_update',
  'table_reset',
  'undo',
  'redo'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Planeswalker',
  avatar_url text,
  default_starting_life integer not null default 40,
  preferred_layout text not null default 'auto',
  theme text not null default 'dark',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  favorite_commander_name text,
  favorite_commander_scryfall_id uuid,
  favorite_commander_art_url text,
  color_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  starting_life integer not null default 40,
  player_count integer not null default 4,
  layout text not null default 'auto',
  visible_counter_keys text[] not null default array['tax'],
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  preset_id uuid references public.game_presets(id) on delete set null,
  name text not null default 'Commander table',
  status public.game_status not null default 'active',
  starting_life integer not null default 40,
  layout text not null default 'auto',
  total_turns integer not null default 0,
  turn_cycle integer not null default 0,
  turn_tracking_enabled boolean not null default true,
  active_seat_index integer not null default 0,
  version bigint not null default 1,
  last_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.game_participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  player_profile_id uuid references public.player_profiles(id) on delete set null,
  seat_index integer not null,
  display_name text not null,
  life_total integer not null default 40,
  color_index integer not null default 0,
  commander_name text,
  commander_scryfall_id uuid,
  commander_art_url text,
  commander_tax integer not null default 0,
  is_dead boolean not null default false,
  death_reason text,
  visible_counter_keys text[] not null default array['tax'],
  deck_source text,
  deck_cards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique(game_id, seat_index)
);

create table public.game_counters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  participant_id uuid not null references public.game_participants(id) on delete cascade,
  counter_key text not null,
  label text not null,
  value integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(participant_id, counter_key)
);

create table public.commander_damage (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  source_participant_id uuid not null references public.game_participants(id) on delete cascade,
  source_commander_id text not null default 'primary',
  source_commander_name text,
  source_commander_art_url text,
  target_participant_id uuid not null references public.game_participants(id) on delete cascade,
  value integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(source_participant_id, target_participant_id, source_commander_id)
);

create table public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action_type public.game_action_type not null,
  payload jsonb not null default '{}'::jsonb,
  client_action_id text not null,
  client_created_at timestamptz,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  unique(game_id, client_action_id)
);

create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  result text not null,
  created_at timestamptz not null default now()
);

create table public.match_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  winner_participant_id uuid references public.game_participants(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  client_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_player_profiles before update on public.player_profiles for each row execute function public.touch_updated_at();
create trigger touch_game_presets before update on public.game_presets for each row execute function public.touch_updated_at();
create trigger touch_games before update on public.games for each row execute function public.touch_updated_at();
create trigger touch_game_participants before update on public.game_participants for each row execute function public.touch_updated_at();
create trigger touch_game_counters before update on public.game_counters for each row execute function public.touch_updated_at();
create trigger touch_commander_damage before update on public.commander_damage for each row execute function public.touch_updated_at();
create trigger touch_user_settings before update on public.user_settings for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Planeswalker'));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.player_profiles enable row level security;
alter table public.game_presets enable row level security;
alter table public.games enable row level security;
alter table public.game_participants enable row level security;
alter table public.game_counters enable row level security;
alter table public.commander_damage enable row level security;
alter table public.game_actions enable row level security;
alter table public.dice_rolls enable row level security;
alter table public.match_history enable row level security;
alter table public.user_settings enable row level security;
alter table public.sync_events enable row level security;

create policy "profiles own row" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "player profiles owned" on public.player_profiles
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "presets owned" on public.game_presets
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "games owned" on public.games
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "participants through owned games" on public.game_participants
for all using (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
) with check (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
);

create policy "counters through owned games" on public.game_counters
for all using (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
) with check (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
);

create policy "commander damage through owned games" on public.commander_damage
for all using (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
) with check (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
);

create policy "actions through owned games" on public.game_actions
for all using (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
) with check (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
);

create policy "dice through owned games" on public.dice_rolls
for all using (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
) with check (
  exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
);

create policy "history owned" on public.match_history
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "settings owned" on public.user_settings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sync events owned" on public.sync_events
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Enable realtime publication for shared table state.
do $$
begin
  alter publication supabase_realtime add table public.games;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.game_participants;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.game_counters;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.commander_damage;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.game_actions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.dice_rolls;
exception
  when duplicate_object then null;
end $$;
