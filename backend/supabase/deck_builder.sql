-- MTG Table Tracker deck builder extension.
-- Apply after backend/supabase/schema.sql.

do $$
begin
  create type public.deck_card_section as enum ('commander', 'mainboard', 'sideboard', 'maybeboard');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ai_review_status as enum ('queued', 'complete', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.card_cache (
  scryfall_id uuid primary key,
  oracle_id uuid,
  name text not null,
  type_line text,
  oracle_text text,
  mana_cost text,
  cmc numeric,
  color_identity text[] not null default '{}',
  legalities jsonb not null default '{}'::jsonb,
  image_uris jsonb not null default '{}'::jsonb,
  prices jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists public.saved_decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  format text not null default 'commander',
  commander_name text,
  commander_scryfall_id uuid,
  commander_art_url text,
  bracket integer,
  power_level numeric,
  tags text[] not null default '{}',
  notes text not null default '',
  is_favorite boolean not null default false,
  source_url text,
  source_deck_id text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_decks_owner_source_deck_id_idx
  on public.saved_decks(owner_id, source_deck_id)
  where source_deck_id is not null;

create table if not exists public.deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.saved_decks(id) on delete cascade,
  scryfall_id uuid references public.card_cache(scryfall_id) on delete set null,
  section public.deck_card_section not null default 'mainboard',
  quantity integer not null default 1 check (quantity > 0),
  card_name text not null,
  card_snapshot jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deck_id, card_name, section)
);

create table if not exists public.favorite_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  scryfall_id uuid references public.card_cache(scryfall_id) on delete cascade,
  card_name text not null,
  card_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(owner_id, scryfall_id)
);

create table if not exists public.ai_deck_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid not null references public.saved_decks(id) on delete cascade,
  status public.ai_review_status not null default 'queued',
  prompt jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_coach_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid references public.saved_decks(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists touch_saved_decks on public.saved_decks;
drop trigger if exists touch_deck_cards on public.deck_cards;
drop trigger if exists touch_ai_deck_reviews on public.ai_deck_reviews;

create trigger touch_saved_decks before update on public.saved_decks
for each row execute function public.touch_updated_at();

create trigger touch_deck_cards before update on public.deck_cards
for each row execute function public.touch_updated_at();

create trigger touch_ai_deck_reviews before update on public.ai_deck_reviews
for each row execute function public.touch_updated_at();

alter table public.card_cache enable row level security;
alter table public.saved_decks enable row level security;
alter table public.deck_cards enable row level security;
alter table public.favorite_cards enable row level security;
alter table public.ai_deck_reviews enable row level security;
alter table public.ai_coach_messages enable row level security;

drop policy if exists "card cache readable" on public.card_cache;
drop policy if exists "card cache authenticated write" on public.card_cache;
drop policy if exists "decks owned" on public.saved_decks;
drop policy if exists "deck cards through owned deck" on public.deck_cards;
drop policy if exists "favorite cards owned" on public.favorite_cards;
drop policy if exists "ai reviews owned" on public.ai_deck_reviews;
drop policy if exists "ai coach messages owned" on public.ai_coach_messages;

create policy "card cache readable" on public.card_cache
for select using (true);

create policy "card cache authenticated write" on public.card_cache
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "decks owned" on public.saved_decks
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "deck cards through owned deck" on public.deck_cards
for all using (
  exists (select 1 from public.saved_decks d where d.id = deck_id and d.owner_id = auth.uid())
) with check (
  exists (select 1 from public.saved_decks d where d.id = deck_id and d.owner_id = auth.uid())
);

create policy "favorite cards owned" on public.favorite_cards
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "ai reviews owned" on public.ai_deck_reviews
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "ai coach messages owned" on public.ai_coach_messages
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

do $$
begin
  alter publication supabase_realtime add table public.saved_decks;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.deck_cards;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.favorite_cards;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ai_deck_reviews;
exception
  when duplicate_object then null;
end $$;
