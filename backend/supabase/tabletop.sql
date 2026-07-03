-- MTG Table Tracker — Virtual Tabletop migration (PROMPT 0).
-- Apply AFTER schema.sql + deck_builder.sql. Run order: schema -> deck_builder -> tabletop.
-- All changes are additive/delta; the existing files stay pristine.
--
-- What this adds:
--   * card_cache render/print columns (layout, card_faces, finishes, is_legal_commander, ...)
--   * game_actions.action_type: enum -> TEXT (validate in the reducer; ~40 verbs incoming) [H7]
--   * structural columns on games/game_participants/saved_decks/deck_cards (dormant until used)
--   * game_card_instances (the Model C live-state spine) + game_card_hidden + snapshots
--   * is_game_member() + participant-based RLS (replaces owner-only) [§6]
--   * hidden-info boundary: owner-only hand/library, owner-only face-down identity, zone_counts view [C10/H6/H8]

-- 1. card_cache: tabletop render fields + draft/print metadata
alter table public.card_cache
  add column if not exists layout text,
  add column if not exists card_faces jsonb not null default '[]'::jsonb,
  add column if not exists produced_mana text[] not null default '{}',
  add column if not exists is_token boolean not null default false,
  add column if not exists is_legal_commander boolean not null default false,
  add column if not exists finishes text[] not null default '{}';

-- [H15] card_cache writes = service-role only (drop authenticated-write; public read stays)
drop policy if exists "card cache authenticated write" on public.card_cache;

-- 2. game_actions.action_type: enum -> TEXT [H7]
alter table public.game_actions alter column action_type type text using action_type::text;
drop type if exists public.game_action_type;

-- 3. Structural columns (cheap, dormant until used)
alter table public.games
  add column if not exists rng_seed text,
  add column if not exists ranked boolean not null default true,
  add column if not exists winning_turn integer,
  add column if not exists visibility text not null default 'private',
  add column if not exists planechase_state jsonb not null default '{}'::jsonb;
alter table public.game_participants
  add column if not exists role text not null default 'player',
  add column if not exists playmat_url text;
alter table public.saved_decks
  add column if not exists elo numeric,
  add column if not exists power_estimate numeric,
  add column if not exists competitive_rating text;
alter table public.deck_cards
  add column if not exists chosen_scryfall_id uuid references public.card_cache(scryfall_id),
  add column if not exists set_code text,
  add column if not exists collector_number text,
  add column if not exists is_foil boolean not null default false,
  add column if not exists is_etched boolean not null default false,
  add column if not exists flipped_face integer not null default 0;

-- 4. Live card-instance state (Model C spine)
create table if not exists public.game_card_instances (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  owner_participant_id uuid not null references public.game_participants(id) on delete cascade,
  controller_participant_id uuid not null references public.game_participants(id) on delete cascade,
  scryfall_id uuid references public.card_cache(scryfall_id) on delete set null,
  card_name text not null default '',
  zone text not null default 'library',
  pos numeric,
  x numeric, y numeric, z integer,
  tapped boolean not null default false,
  face_down boolean not null default false,
  flipped_face integer not null default 0,
  counters jsonb not null default '{}'::jsonb,
  attached_to uuid references public.game_card_instances(id) on delete set null,
  attach_order integer,
  is_token boolean not null default false,
  is_commander boolean not null default false,
  phased boolean not null default false,
  is_foil boolean not null default false,
  is_etched boolean not null default false,
  set_code text,
  collector_number text,
  revealed_to uuid[] not null default '{}',
  characteristics jsonb not null default '{}'::jsonb,   -- Model C engine-ready (dormant while manual)
  updated_at timestamptz not null default now()
);
create index if not exists game_card_instances_game_zone_idx on public.game_card_instances(game_id, zone);
create index if not exists game_card_instances_owner_idx on public.game_card_instances(owner_participant_id);
drop trigger if exists touch_game_card_instances on public.game_card_instances;
create trigger touch_game_card_instances before update on public.game_card_instances for each row execute function public.touch_updated_at();

-- Owner-only true identity of FACE-DOWN cards in public zones [H8]
create table if not exists public.game_card_hidden (
  instance_id uuid primary key references public.game_card_instances(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  owner_participant_id uuid not null references public.game_participants(id) on delete cascade,
  scryfall_id uuid,
  card_name text not null default '',
  characteristics jsonb not null default '{}'::jsonb
);

-- Crash-recovery snapshots
create table if not exists public.game_board_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  version bigint not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);

-- 5. Membership helper (SECURITY DEFINER avoids RLS recursion)
create or replace function public.is_game_member(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_participants p where p.game_id = g and p.profile_id = auth.uid())
      or exists (select 1 from public.games gm where gm.id = g and gm.owner_id = auth.uid());
$$;

-- 6. Participant-based RLS (replaces owner-only) [drop/create, not alter]
drop policy if exists "games owned" on public.games;
create policy "games member read" on public.games for select using (public.is_game_member(id));
create policy "games owner manage" on public.games for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "participants through owned games" on public.game_participants;
create policy "participants member read" on public.game_participants for select using (public.is_game_member(game_id));
create policy "participants owner manage" on public.game_participants for all
  using (exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid()))
  with check (exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid()));
create policy "participants self join" on public.game_participants for insert with check (profile_id = auth.uid());
create policy "participants self update" on public.game_participants for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "counters through owned games" on public.game_counters;
create policy "counters member rw" on public.game_counters for all using (public.is_game_member(game_id)) with check (public.is_game_member(game_id));

drop policy if exists "commander damage through owned games" on public.commander_damage;
create policy "commander damage member rw" on public.commander_damage for all using (public.is_game_member(game_id)) with check (public.is_game_member(game_id));

drop policy if exists "actions through owned games" on public.game_actions;
create policy "actions member read" on public.game_actions for select using (public.is_game_member(game_id));
create policy "actions member append" on public.game_actions for insert with check (public.is_game_member(game_id) and actor_id = auth.uid());

drop policy if exists "dice through owned games" on public.dice_rolls;
create policy "dice member read" on public.dice_rolls for select using (public.is_game_member(game_id));
create policy "dice member insert" on public.dice_rolls for insert with check (public.is_game_member(game_id));

-- 7. game_card_instances RLS — the hidden-info boundary [C10, H6/H8]
alter table public.game_card_instances enable row level security;
alter table public.game_card_hidden enable row level security;
alter table public.game_board_snapshots enable row level security;

create policy "instances public zones" on public.game_card_instances for select
  using (public.is_game_member(game_id) and zone in ('battlefield','graveyard','exile','command','stack'));
create policy "instances hidden zones owner" on public.game_card_instances for select
  using (zone in ('hand','library')
         and exists (select 1 from public.game_participants p where p.id = owner_participant_id and p.profile_id = auth.uid()));
create policy "instances revealed peek" on public.game_card_instances for select
  using (auth.uid() = any(revealed_to));
create policy "instances member ins" on public.game_card_instances for insert with check (public.is_game_member(game_id));
create policy "instances member upd" on public.game_card_instances for update using (public.is_game_member(game_id)) with check (public.is_game_member(game_id));
create policy "instances member del" on public.game_card_instances for delete using (public.is_game_member(game_id));

create policy "hidden owner only" on public.game_card_hidden for all
  using (exists (select 1 from public.game_participants p where p.id = owner_participant_id and p.profile_id = auth.uid()))
  with check (exists (select 1 from public.game_participants p where p.id = owner_participant_id and p.profile_id = auth.uid()));

create policy "snapshots member read" on public.game_board_snapshots for select using (public.is_game_member(game_id));
create policy "snapshots member write" on public.game_board_snapshots for insert with check (public.is_game_member(game_id));

-- 8. zone_counts — opponents see counts without identities (definer view; counts only)
create or replace view public.zone_counts as
  select game_id, owner_participant_id, zone, count(*)::int as n
  from public.game_card_instances
  where zone in ('hand','library','command','graveyard','exile')
  group by game_id, owner_participant_id, zone;
grant select on public.zone_counts to anon, authenticated;

-- 9. Realtime publication
do $$ begin alter publication supabase_realtime add table public.game_card_instances; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.game_board_snapshots; exception when duplicate_object then null; end $$;
