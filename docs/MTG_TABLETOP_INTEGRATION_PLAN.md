# MTG Virtual Tabletop — Integration Plan (codebase-grounded)

> How to add the full online virtual tabletop **into the existing Magic Table Tracker codebase** so the life tracker, deck builder, and tabletop all share one auth, one backend, one data contract, and one card pipeline.
>
> **Companion doc:** `MTG_PLATFORM_PLAN.md` holds the product vision + the **Model C** philosophy (ship a manual tabletop, build it rules-engine-ready). That philosophy still stands. **This doc supersedes that doc's stack (§3) and transport (§5) assumptions** now that I've read the real code — the app is vanilla JS + Supabase, *not* Next.js/PartyKit.
>
> **Studied:** `C:\Users\Owner\Documents\Codex\2026-06-17\id-like-to-make-a-app\outputs\mtg-life-counter` (web + backend + iOS) and external tabletops (Cockatrice, MTG Node, VirtualTableTop — see §10).

---

## 1. What you already have (and can reuse directly)

The tabletop is **mostly an additive feature**, because the hard infrastructure exists:

| Capability | Where it lives today | Reuse for the tabletop |
|---|---|---|
| **Scryfall card DB** | `backend/supabase/deck_builder.sql` → `card_cache` (oracle_text, type_line, cmc, color_identity, legalities, `image_uris`, `card_faces` via `raw`) | This *is* the card table. Add a couple columns (§3); no new cards table. |
| **Scryfall fetch + image logic** | `deck-builder.js`: `fetchScryfallJson`, `/cards/named`, `/cards/collection` (batch), `normalizeCard`, DFC image fallbacks (`image_uris.normal → card_faces[0]…`) | Card rendering + token search reuse these helpers verbatim. |
| **Decks** | `saved_decks` + `deck_cards` (sections commander/mainboard/sideboard/maybeboard, `card_snapshot`) | "Play this deck" loads `deck_cards` → instantiate the library. |
| **Deck → table flow** | `deck-builder.js`: `normalizeTableDeckCard`, `deckSectionToPlayerBoard`, "Import to table" button | Becomes "Load deck into your seat." |
| **Opening hand draw** | `deck-builder.js` draw-hand modal + grid | Reuse for the real game's opening hand + mulligan. |
| **Event-sourced multiplayer sync** | `game_actions` (typed enum, `version`, `client_action_id` idempotency, `undone_at`), `web-sync.js` `MTGSyncAdapter` (auth, `appendAction`, `subscribeToGame`), realtime publication | The tabletop's net layer is an **extension** of this, not a rewrite (§5). **NB (verified):** `mtgSync` is only `init()`-ed in `app.js` today — `createGameFromState`/`appendAction`/`subscribeToGame` are never called, so wiring them is net-new *activation* of dormant scaffolding, not modification. |
| **Life / commander damage / counters / dice / turns** | `app.js` (`state`, `playerTemplate`, counter types, death rules) + tables `game_participants`, `game_counters`, `commander_damage`, `dice_rolls` | The tabletop's per-seat player panel reuses this logic + UI. |
| **Auth + profiles + RLS + presets** | `schema.sql` (`profiles`, `auth` trigger, RLS), `web-sync.js` auth | Same login powers the tabletop. |
| **iOS parity** | `ios/MTGTableTracker/*` mirrors the data contract | Extend `shared/data-contract.md` so iOS can follow later. |

**Bottom line:** card data, decks, draw logic, the event log, realtime, auth, and the life/counter system are done. The tabletop adds **(a) a card-instance state model, (b) a battlefield/zone UI with drag & tap, (c) a few new action types + one table, (d) multiplayer RLS for non-owner participants, and (e) the Model C engine-ready spine.**

---

## 2. Architectural decisions (revised for THIS codebase)

| Decision | Choice | Why |
|---|---|---|
| Where the tabletop lives | **A 3rd page** ("Play") in `index.html`, new `table.js` (+ `table-core.js`), matching the `data-page-target` tab pattern | Zero new framework; coexists with life counter + deck builder; one deploy |
| Framework | **Vanilla JS, no build step** (globals + `<script>`), like `app.js`/`deck-builder.js` | Matches the codebase; preserves the static-host + iOS-contract model. *Escape hatch:* if state complexity bites, add a Vite build for `table-core` only — but start no-build |
| Realtime transport | **Extend the existing Supabase model**: durable `game_actions` for committed moves + **Supabase Realtime Broadcast** for the hot path (live drag / cursors) | Already built, already in the iOS contract. PartyKit would fork the architecture and break iOS parity |
| Card data | **Reuse `card_cache`** + existing Scryfall helpers; add `layout`/`card_faces` columns + an optional nightly bulk importer | No second card store; tokens use the same `/cards/search` |
| Decks | **Reuse `saved_decks`/`deck_cards`** + existing deck→table normalizers | Deck builder already feeds the table |
| Game model | **Event-sourced** (extends `game_actions`) with a rich **`game_card_instances`** state + periodic snapshot | Same conflict/undo/idempotency machinery you already trust |
| Access control | **Extend RLS from owner-only → participant-based** + a guest model | Current RLS only lets the game *owner* read/write — true online play needs every seat to act (§6). **Biggest backend change.** |
| Hidden info | Owner-only RLS on hidden zones (hand/library) + reveal-by-action | Opponents must not read your hand via the API (§5.3) — the key correctness risk |

---

## 3. New / changed backend (additive SQL)

**Extend `card_cache`** (for the table renderer + DFC/tap behavior):
```sql
alter table public.card_cache
  add column if not exists layout text,            -- normal | transform | modal_dfc | split | adventure | meld …
  add column if not exists card_faces jsonb not null default '[]'::jsonb,
  add column if not exists produced_mana text[] not null default '{}',
  add column if not exists is_token boolean not null default false;
-- (image_uris/oracle_text/type_line/color_identity already exist)
```

**Extend the action enum** with tabletop verbs (additive — existing values untouched):
```sql
alter type public.game_action_type add value if not exists 'card_move';      -- zone/position change
alter type public.game_action_type add value if not exists 'card_tap';
alter type public.game_action_type add value if not exists 'card_counter';
alter type public.game_action_type add value if not exists 'card_flip';       -- face-down / transform
alter type public.game_action_type add value if not exists 'card_attach';
alter type public.game_action_type add value if not exists 'token_create';
alter type public.game_action_type add value if not exists 'library_shuffle';
alter type public.game_action_type add value if not exists 'library_scry';
alter type public.game_action_type add value if not exists 'draw';
alter type public.game_action_type add value if not exists 'mulligan';
alter type public.game_action_type add value if not exists 'reveal';
alter type public.game_action_type add value if not exists 'phase_change';
alter type public.game_action_type add value if not exists 'game_chat';
```

> **⚠️ Migration gotcha (decide in PROMPT 0) — verified against the real schema:** `game_action_type` is a Postgres **enum**, and `ALTER TYPE … ADD VALUE` **cannot be used in the same transaction** that Supabase wraps a migration in (and historically not in a transaction at all). With ~40 new verbs incoming (§3 + §13.10 + research log Part D), evolving the enum is fragile. **Recommendation: migrate `game_actions.action_type` to `TEXT` + a `CHECK` constraint** (or validate in app code) — cheap now, painful later. If you keep the enum, add values in a **separate committed migration** *before* any migration that uses them.

**New table — the live card objects (the §4 spine):**
```sql
create table public.game_card_instances (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  owner_participant_id uuid not null references public.game_participants(id) on delete cascade,
  controller_participant_id uuid not null references public.game_participants(id) on delete cascade,
  scryfall_id uuid references public.card_cache(scryfall_id) on delete set null,
  card_name text not null,
  zone text not null default 'library',           -- library|hand|battlefield|graveyard|exile|command|stack
  pos numeric,                                     -- order within a pile / library index
  x numeric, y numeric, z integer,                -- battlefield placement (% of board)
  tapped boolean not null default false,
  face_down boolean not null default false,
  flipped_face integer not null default 0,         -- DFC/transform face index
  counters jsonb not null default '{}'::jsonb,      -- {"+1/+1":3,...}
  attached_to uuid references public.game_card_instances(id) on delete set null,
  is_token boolean not null default false,
  is_commander boolean not null default false,
  -- Model C engine-ready fields (unused while manual; read by the engine later):
  characteristics jsonb not null default '{}'::jsonb,  -- types, P/T, abilities[] (denormalized for the engine)
  updated_at timestamptz not null default now()
);
create index on public.game_card_instances(game_id, zone);
-- optional crash-recovery snapshots
create table public.game_board_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  version bigint not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);
```

> Note: the existing `games`/`game_participants` already carry life, layout, turns, commander damage, counters, decks — the tabletop **reuses all of it** and only adds card instances + actions.

---

## 4. The card-instance model = the Model C spine

`game_card_instances` is deliberately richer than a pure tabletop needs. While play is manual, the engine-ready fields just sit there; when automation starts (post-v1, Model C Track B), the engine reads them with **no schema migration**:

- `zone`, `tapped`, `face_down`, `flipped_face`, `counters`, `attached_to`, `x/y/z` → drive the **manual** tabletop today.
- `characteristics` (types, power/toughness, `abilities[]`, color) + the game-level **stack / priority / phase** state (stored on `games`/actions) → the seams a rules engine grows into. Built now, dormant now.
- Unscripted cards always fall back to manual on the same board, so automation is purely additive.

Client-side, this maps to the same `CardInstance` shape from `MTG_PLATFORM_PLAN.md` §4 — keep `table-core.js` as a pure reducer `(state, action) → state` so the (future) engine is "just a smarter reducer," exactly like the existing `game_actions` flow.

---

## 5. Realtime design (extends what you have)

### 5.1 Two tiers
- **Committed actions (durable):** draw, move-zone, tap, counter, token, flip, reveal, shuffle, life/damage, phase. → `appendAction()` into `game_actions` (extended enum) **and** upsert `game_card_instances`. Reuses your `version` + `client_action_id` idempotency + undo-as-action. Broadcast to clients via the existing `postgres_changes` subscription (add `game_card_instances` to the realtime publication).
- **Ephemeral (hot path):** live drag position while a card is in-hand-being-moved, cursor pings, "I'm hovering this" highlights. → **Supabase Realtime Broadcast** (no DB write); only the **final drop** is committed as a `card_move`. Keeps DB writes bounded and dragging at 60fps.

### 5.2 Presence & reconnect
- **Presence** (Supabase Realtime Presence) = who's seated / spectating / connected.
- **Reconnect/resume:** pull `games` + `game_participants` + `game_card_instances` (+ latest snapshot) → rebuild board. Same "pull latest, replay queued, bump version" loop the contract already specifies.

### 5.3 Hidden information — the one hard correctness problem ⚠️
A player's **hand and library must not be readable by opponents** through the Supabase API/Realtime. Plan:
- Card instances in `zone in ('hand','library')` are visible **only to their owner** via RLS; opponents receive only a **count** (face-down placeholder).
- **Reveal** = an explicit `reveal` action that exposes specific instances to specific seats (or all).
- **Validate early (Phase 3 spike):** confirm Supabase Realtime `postgres_changes` honors RLS per-subscriber for these rows. If it leaks, fall back to a tiny **Edge Function relay** that emits per-recipient filtered state (still in-stack). This is the single biggest thing to de-risk first.

### 5.4 RNG
Shuffles/dice generated client-side today; for fairness in PvP, move shuffle/seed generation server-side (Edge Function) or seed per game (`games.rng_seed`) so libraries aren't client-manipulable. Flag for competitive integrity.

---

## 6. Access control: the required RLS upgrade

**Today:** `games`/participants/actions are **owner-only** (`g.owner_id = auth.uid()`). That fits the current "one host device, others mirror" model — but a true online table needs every seat on its own device.

**Change to participant-based access** (sketch):
```sql
-- A profile is a member of a game if they hold a seat
create or replace function public.is_game_member(g uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.game_participants p
    where p.game_id = g and p.profile_id = auth.uid()
  ) or exists (select 1 from public.games gm where gm.id = g and gm.owner_id = auth.uid());
$$;

-- Read game state if you're a member; write actions only as yourself
alter policy "actions through owned games" on public.game_actions
  using (public.is_game_member(game_id))
  with check (public.is_game_member(game_id) and actor_id = auth.uid());
-- + analogous member-read policies for games, game_participants, game_counters,
--   commander_damage, game_card_instances; hidden-zone rows add an owner-only filter (§5.3).
```
**Guests (no account):** recommend Supabase **anonymous sign-in** (each guest gets a real ephemeral `auth.uid`, so RLS/idempotency "just work") plus a **join-by-code/link** that inserts a `game_participants` seat. *(Open decision in §11.)*

---

## 6.5 Accounts, deck persistence & hosting (backend & infra)

This is the "stand up the backend" workstream: **logins, cloud deck saving, and hosting**. Most of the *schema* exists; the gap is **wiring + deployment**.

### A. Accounts & authentication
**Have:** Supabase Auth + `profiles` (+ auto-create trigger) + `user_settings`; `web-sync.js` already implements `signUpWithEmail` / `signInWithEmail` / `signOut`.
**Gap (per the README's "remaining" list):** no real sign-in **UI**, no **session handling/guard**, and deck/game writes assume a session that isn't established yet.
**Build:**
- **Auth UI** in the header/modal: sign up, sign in, sign out, **password reset** (`resetPasswordForEmail` + a reset page), email verification, and **"continue as guest"** (Supabase **anonymous sign-in**).
- **Session handling:** on load call `getSession()`, subscribe to `onAuthStateChange`, reflect signed-in state in the header, and gate cloud features (local mode still works offline — keep the existing behavior).
- **OAuth:** Google + **Sign in with Apple** (Apple is App-Store-required once any third-party login ships on iOS); configure redirect URLs in Supabase.
- **Guest → permanent upgrade:** let an anonymous user link an email/OAuth identity so their decks/history carry over (ties to the §6 guest model).
- **Profile & settings:** display name, avatar, default starting life, preferred layout, theme — all already columns on `profiles`.
- **Account deletion** (privacy / App Store): an **Edge Function** (service role) that deletes the user; FK cascades clear their data.

### B. Deck saving → cloud persistence
**Have:** `saved_decks` + `deck_cards` + `favorite_cards` + `card_cache` tables, all RLS-protected and realtime-published; shapes defined in `shared/data-contract.md`.
**Gap (important):** the web deck builder currently persists to **localStorage** (`magic-table-tracker-decks-v1`) — decks are **not** cloud-backed or cross-device yet.
**Build:**
- **Wire saves to Supabase when signed in:** on save, upsert `saved_decks` + replace its `deck_cards`; keep **localStorage as the offline/guest fallback** (don't remove it).
- **One-time local → cloud migration:** on first sign-in, offer to push existing local decks up; the unique index `saved_decks_owner_source_deck_id_idx` already dedupes by source.
- **Cross-device sync:** subscribe to the already-published `saved_decks`/`deck_cards` realtime so decks appear on web + iOS instantly.
- **Shared card cache:** upsert fetched Scryfall cards into `card_cache` (public-read) on search/save so the table renderer and other users reuse them.
- **Conflict:** reuse `saved_decks.version` (same strategy as games).
- These cloud decks are exactly what the table's **"Play deck"** loads into `game_card_instances`.

### C. Hosting & deployment (where it all runs)
- **Supabase backend (provision once):** create the project → run `schema.sql`, `deck_builder.sql`, the **§3 migration**, and the **§6 RLS upgrade** → enable Auth providers + redirect URLs → realtime is already enabled in SQL. Secrets: `SUPABASE_URL` + **anon key** (public, in `supabase-config.js`, gitignored) and **service-role key** (server-only — never shipped to the browser).
- **Web app hosting (static):** the app is plain static files (no build step), so host on any static/CDN platform — **Vercel / Netlify / Cloudflare Pages / Supabase Hosting** — with a custom domain + HTTPS. Deploy = push the folder (git-connected or CLI).
- **Server-side endpoints — Supabase Edge Functions (Deno), in-stack:** these must hold secrets the browser can't see —
  - **AI deck review** (the `ai-deck-review-contract.md` already says: private endpoint, not a public browser key),
  - **account deletion** (service role),
  - **server-authoritative shuffle/RNG** for fair PvP (§5.4),
  - **hidden-info relay** fallback (§5.3) if the RLS spike fails,
  - **Scryfall bulk import** (scheduled) to seed/refresh `card_cache`.
- **Environments:** separate **dev vs prod** Supabase projects (or branches); document required vars in the existing `.env.example`.
- **iOS:** same backend; the SwiftUI app just needs URL + anon key via xcconfig (README covers it).

### D. Game hosting (multiplayer sessions — distinct from web hosting)
**Have:** `games.owner_id`, `game_participants`, the realtime + action model.
**Build:** a **lobby** to **host/create a game** (insert `games`), generate a **join link/code**, let others **join** (insert a `game_participants` seat; guests via anon auth), plus host controls (start, kick, reset, end) and reconnect/resume. This is the §9 **Phase 3** lobby work — calling it out here so "hosting a table" is explicitly part of the backend plan.

---

## 7. Feature & UX parity checklist (from external tabletops, §10)

Cockatrice is the gold standard for *what a manual tabletop must do*. Each maps to an action type or local interaction:

**Card interactions** (battlefield): double-click = **tap/untap**; click-drag marquee = **multi-select** → tap/untap many; `Ctrl-U` = **untap all**; drag = **move/position**; right-click menu = **move to zone** (hand/grave/exile/library top|bottom/command), **add/remove counter**, **create token / related card**, **clone**, **attach/unattach** (aura/equipment), **flip face-down**, **transform** (DFC), **reveal/peek**, **set P/T annotation / note**.

**Zones:** **Library** (face-down pile + count; draw, draw N, mill, **scry N**, **surveil**, **search/tutor** with reveal-or-secret, shuffle, reveal top, move to top/bottom); **Hand** (private, public count, fan layout); **Graveyard** & **Exile** (public browsable piles); **Command zone** (commanders + **commander tax** counter, recast); **Stack** (optional manual visualization); **Sideboard** (from deck).

**Vitals (reuse `app.js`):** life ±, **commander-damage matrix** (source-aware, 21 = death), **poison/infect** (10 = death), energy/experience/storm/treasure/etc. counters, **dice & coin** (`dice_rolls`), turn/phase pass + **untap-step** auto-untap (optional convenience).

**Session:** lobby + **join by link/code**, seat assignment, deck pick per seat, opening hand + **London mulligan**, **spectators** (read-only), **chat + action log** (reuse the table-log modal), **point/ping** + live cursors, **concede / declare winner** → `match_history`.

**Multiplayer layout:** your hand anchored bottom + your battlefield above it; each opponent = a seat panel (reuse `playerTemplate`: name, life, commander damage, counters) with a zoomable mini-battlefield; 1v1 and 4-player Commander arrangements.

---

## 8. Cross-feature integration map (so everything works together)

```
 Deck Builder (deck-builder.js, saved_decks/deck_cards, Scryfall)
        │  "Play deck" → instantiate game_card_instances for a seat
        ▼
 TABLE / PLAY page (table.js + table-core.js)  ◄── card_cache (images, faces, oracle)
        │  committed moves → game_actions (+ game_card_instances)   ephemeral → Broadcast
        ▼
 Supabase (auth, RLS, realtime)  ──►  Life/Counter panel reuses app.js logic
        │  game end → match_history.summary {winner, placements, turns, duration}
        ▼
 Stats / "paper tracker" you already built  ◄── consumes match_history
        │
 Shared data-contract.md  ──►  iOS (SwiftUI) mirrors the same actions later
```

Concrete seams:
1. **Deck builder → table:** add a "Play" button beside "Import to table" that creates/uses a `game`, loads the selected `saved_deck` into the caller's seat as 99+1 `game_card_instances` (library + command zone), and routes to the Play page.
2. **Table → stats:** on "declare winner," write `match_history.summary` (winner, placements, commander-damage dealt, turns, duration) — feeds the stats/ELO system you already have.
3. **Life panel reuse:** the Play page's per-seat panel imports the life/commander-damage/counter/death logic from `app.js` (refactor those into a shared `vitals.js` so both the standalone Life Counter page and the Table page use one implementation — avoids divergence).
4. **iOS:** extend `shared/data-contract.md` with the §3 entities + §7 action vocabulary so the SwiftUI app can add the table later without backend changes.

---

## 9. Phased delivery (referencing real files)

**Phase 0 — Backend + spike (de-risk first)**
- **Provision Supabase** (run `schema.sql`, `deck_builder.sql`, the §3 migration, the §6 RLS upgrade; enable Auth providers + redirect URLs; set secrets per §6.5C); add `game_card_instances` to the realtime publication.
- **Hidden-info spike (§5.3):** prove RLS-filtered realtime (or fall back to an Edge relay). *Verify:* opponent cannot read your hand rows.

**Phase 0.5 — Accounts, cloud decks & hosting (§6.5)**
- Auth UI (sign up/in/out, password reset, OAuth, guest/anon) + session handling; migrate deck saving from localStorage → `saved_decks`/`deck_cards` with a one-time local→cloud import; deploy the static app + Edge Functions (AI review, account delete). *Verify:* sign in on two devices, save a deck on one, see it on the other.

**Phase 1 — Card render + deck load (no networking)**
- New "Play" tab in `index.html`; `table.js` shell; render a `card_cache`/Scryfall card with hover-zoom and DFC faces (reuse deck-builder image helpers).
- "Play deck" loads a `saved_deck` into a local board (library + command zone). *Verify:* a real Commander deck loads, 100 cards, commander in command zone.

**Phase 2 — Solo tabletop engine (`table-core.js`, manual, Model C spine)**
- Reducer + `CardInstance`; all zones; draw/move/tap/untap/counters/tokens/dice/shuffle/scry/mulligan/reveal/attach/flip; battlefield drag + tap-rotate; right-click menu; reuse the table-log for the action log.
- Bake the engine-ready spine (rich `characteristics`, stack/priority/phase state present, layer/SBA/targeting as no-op stubs). *Verify:* full solo goldfish turn; log correct.

**Phase 3 — Realtime multiplayer (extend `MTGSyncAdapter`)**
- Wire `table-core` actions → `appendAction` + `game_card_instances`; subscribe via existing channel; add **Broadcast** for drag/cursors; Presence; reconnect via snapshot; lobby + **join link** + seats + spectators; chat.
- 2-player first, then 4-player Commander layout. *Verify:* two browsers play live; refresh mid-game resumes; hands stay hidden.

**Phase 4 — Commander layer + results handoff**
- Command zone + commander tax + commander-damage matrix (reuse `app.js`/`commander_damage`), color-identity-aware load, declare-winner → `match_history`. Optional convenience automation toggles (auto-untap/draw/tax). *Verify:* 4-player game start→finish; result in stats.

**Phase 5 — Polish & platform (deferred)**
- Game finder, richer spectating, mobile-web tuning; extend `data-contract.md` for **iOS**; optional WebRTC voice later.

**Track B — Incremental rules automation (post-v1, open-ended)** — per `MTG_PLATFORM_PLAN.md` §0.1/§11: SBAs+phases → mana/casting → stack/priority → templated effects → keywords → 613 layers → long tail; unscripted = manual forever.

---

## 10. External codebases studied (what to borrow)

- **Cockatrice** (open source, C++/Qt) — *the* feature spec for a manual tabletop: card right-click vocabulary, double-click tap / `Ctrl-U` untap-all / marquee multi-select, zone counts (Library/Graveyard/Exile/Hand), token & "related cards" creation, attach, 7 counters, phases bar, load-deck/sideboard. **Borrow:** the complete action/interaction list in §7. ([wiki](https://github.com/Cockatrice/Cockatrice/wiki/One-minute-game-guide))
- **MTG Node** (`Yomguithereal/mtgnode`, Node + Socket.io) — browser MTG table: click deck to draw, **drag card where you want**. **Borrow:** the simplest viable web drag/draw interaction model. ([repo](https://github.com/Yomguithereal/mtgnode))
- **VirtualTableTop** (`ArnoldSmith86/virtualtabletop`) — generic browser VTT, real-time sync of drag/flip/dice to all players, self-host, no accounts. **Borrow:** real-time table-sync UX patterns + free-form piece manipulation. ([repo](https://github.com/ArnoldSmith86/virtualtabletop))
- **OpenSourcerer** (`arrdem/OpenSourcerer`) & **XMage**/`magefree` — reference only for the *future* rules engine (design + card-behavior spec), not code to import (see `MTG_PLATFORM_PLAN.md` §0.1).
- **Scryfall API** — already your card source; for tokens use `/cards/search t:token`, for related cards use the `all_parts` field on a card's `raw` JSON.

---

## 11. Open decisions to confirm

All resolved with defaults so the build needs no design input:
1. **Vanilla JS, no build** — LOCKED (Vite only as an escape hatch if `table-core` complexity demands).
2. **Guest model — Supabase anonymous auth** — LOCKED.
3. **Hidden-info — RLS-per-subscriber + owner-only secret-identity table** (Edge relay fallback); PROMPT 0 verifies — LOCKED.
4. **`vitals.js` extraction — yes** (PROMPT 0.75) — LOCKED.
5. **Server-authoritative RNG — yes** (Edge shuffle) — LOCKED.
6. **iOS — web-first**; extend `data-contract.md` now — LOCKED.
7. **Web host — default Cloudflare Pages / Netlify** (any static host; owner may override at deploy).
8. **OAuth — Email + Google now; Apple before iOS** — LOCKED.
9. **Supabase — one project until launch, then split** — LOCKED.

> Only owner inputs: the **voice TURN provider** (⏸ gate, PROMPT 4b) + the **web-host** pick + **operational secrets** (Supabase keys, ANTHROPIC_API_KEY, OAuth creds, domain). Everything else proceeds without input.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Hidden-info leak** via Realtime/RLS | Phase 0 spike; owner-only hidden zones + reveal action; Edge relay fallback (§5.3) |
| **Owner-only RLS** blocks multiplayer | Participant-based policies + `is_game_member()` (§6) — do in Phase 0 |
| Vanilla-JS complexity ceiling for live game state | Keep `table-core.js` a pure reducer; Vite escape hatch; the existing 108KB `app.js` proves the pattern scales |
| Drag latency / DB write storms | Broadcast for the hot path; only commit drops (§5.1) |
| Divergence between Life page and Table panel | Shared `vitals.js` (§8.3) |
| Scryfall image hosting/limits | Reuse existing fetch + cache in `card_cache`; lazy-load; size tiers; optional nightly bulk import |
| iOS drift from web | Extend `shared/data-contract.md` in lockstep with §3/§7 |
| Legal/IP — **resolved: non-commercial** | Site is never monetized → non-commercial fan tool under WotC Fan Content Policy; **no restrictions on card imagery for play**. Only Scryfall API etiquette (cache/UA/rate-limit) + a fan-content disclaimer remain. Full note in `MTG_PLATFORM_PLAN.md` §6. |
| **Service-role key leakage** | Keep service-role only in Edge Functions; browser uses the anon key + RLS exclusively (§6.5C) |
| **Local→cloud deck migration data loss** | Idempotent import keyed on `saved_decks_owner_source_deck_id_idx`; keep localStorage copy until confirmed |
| Deck saves silently staying local (today's behavior) | Wire cloud persistence in Phase 0.5; show a signed-out "local only" indicator |

---

## 13. Playgroup Live — exhaustive feature parity & how we build each

Researched from playgroup.gg's live pages (`/playgroup-live`, `/playtest`, `/playgroup-live/for-communities`, `/live_sessions`). This is the **target feature set** for the digital tabletop. Each item below is mapped to concrete work in our stack (action types extend `game_action_type`; UI lives in `table.js`; state in `table-core.js` + `game_card_instances`; server logic in Edge Functions).

> **Architecture confirmation from their design:** Playgroup Live is **server-authoritative** — *"the server keeps hidden zones hidden,"* explicitly rejecting *"honor system."* This settles §5.3: we go **server-validated actions via an Edge Function (or small WS service)** for anything touching hidden zones or game integrity, with the client optimistic and the DB/RLS as the durable backstop. Honor-system/client-trust is a competitive disadvantage we won't ship.

> **UPDATE (2026-06-22 competitive teardown — see `MTG_VTT_RESEARCH_LOG.md`):** A 3-agent study of Kiku.gg + Playgroup Live refined this section. Key changes: (1) the hidden-info question is **resolved** — Supabase `postgres_changes` enforces **RLS per-subscriber**, so owner-only RLS is sufficient (Edge relay = fallback); (2) §13.4's "every Commander rule automatically" **over-claims** — it's structural bookkeeping (Model C), reframe accordingly; (3) face-down needs **per-player reveals + group-exile piles**, not one boolean; (4) spectators are **unconfirmed**, not parity; (5) add Kiku's **hover + single-key** model, **single pan/zoom board**, **realtime draft**, **Planechase**, **custom playmats**, **free annotations**, **attachment/target arrows**; (6) **log `turn` + `opening_hand` + `cast_spell` from day 1** or Card Insights can't be built. Full code snippets, the decompiled Kiku protocol, and consolidated data-model deltas are in the research log.

### 13.1 Card interactions & rendering
| Playgroup Live (quoted) | How we build it |
|---|---|
| "Drag cards between every zone you expect" | Pointer-drag in `table.js`; drop → `card_move` action (zone + x/y). Hot-path drag deltas over Broadcast, commit on drop (§5.1) |
| "Tap, flip, transform, attach, counter, token, target" | Actions `card_tap`, `card_flip` (face-down), `card_flip`+`flipped_face` (transform DFC), `card_attach`, `card_counter`, `token_create`, + ephemeral target arrows (below) |
| "Clean flip and transform on double-faced cards" | `card_cache.card_faces` + `layout`; `flipped_face` index; CSS 3D flip; render the active face's `image_uris` |
| "Phase-out and phase-in fully supported" | New action `card_phase`; `characteristics.phased` flag; render dimmed/offset; phased permanents skip untap and are "not there" until phase-in (rules-correct) |
| "Attached cards live on a dedicated shelf next to the creature they enchant" | `attached_to` FK already in `game_card_instances`; render Auras/Equipment/Fortifications as a stacked "shelf" offset under the host; moving the host moves the shelf |
| "Marquee select… tap, move, or token them at once" | Client marquee box → multi-select set → batch actions (one action with an `instanceIds[]` payload) |
| "Target arrows… the whole table sees what you are pointing at" | **Ephemeral Broadcast** event `target_arrow {fromInstance,toInstance/seat}`; SVG arrow overlay; auto-expires (not persisted) |
| "Clean animations… layout that keeps the board readable" | `framer-motion`-style transitions are out (no build); use CSS transitions on transforms; battlefield auto-tidy into rows (lands/nonlands) optional |

### 13.2 Zones (incl. the hard ones)
- **Hand, Battlefield, Graveyard, Exile, Library, Command Zone, dedicated Stack zone** → `zone` enum on `game_card_instances`. The **Stack** is a first-class managed zone (LIFO list with the spell/ability + its targets) — this is also a Model C spine seam (the engine later resolves it; now players resolve manually).
- **Hidden zones, server-enforced:** "Morph, disguise, manifest, and foretell stay face down," "Face-down exile with per-player reveal permissions." → hidden-zone rows are **owner-only at the API layer**; a server action mediates reveals; face-down cards carry a server-held true identity the client never receives until revealed. **This is why §5.3 must be server-authoritative.**
- **Attachment shelf** = a render grouping of `attached_to` children, not a separate DB zone.

### 13.3 Library, hand & turn actions
- "Draw your opening hand, mulligan, cast and move cards between zones, tap, add counters, roll dice, and undo" + "draw phases" + "event log" → actions `draw`, `mulligan` (London: draw 7, then bottom N per mulligan count), `card_move`, `card_tap`, `card_counter`, `dice_roll` (reuse `dice_rolls`), and **undo** (reuse existing `game_actions.undone_at` + inverse-apply — already built!). The **event log** reuses the table-log modal.
- Library ops: `library_shuffle` (server RNG, §5.4), `library_scry` (reorder top N, owner-only), search/tutor (browse library → move, with reveal-or-secret), mill, reveal-top. "Playgroup pulls the cards, resolves prints, and shuffles your library" → our deck loader resolves `deck_cards`→`card_cache` and server-shuffles into `game_card_instances` (zone=library).

### 13.4 Commander rules & "every Commander rule handled automatically"
Senior-MTG read: their automation is **structural bookkeeping**, not full Oracle-text enforcement. We match that (and it's exactly Model C convenience automation):
- **Commander damage** — source-aware matrix, 21-from-one-commander = loss (reuse `commander_damage` table + `app.js` logic). Auto-attribute combat damage marked from a commander.
- **Command zone + tax** — commander starts in command zone; each cast from there adds **+2 generic** (commander tax) tracked on `commander_tax`; recast button.
- **Partners / backgrounds / "Friends forever" / Doctor's companion** — allow **two commanders**; color identity = union; both tracked for tax & damage.
- **Mulligans** — London mulligan flow with free first mull optional (pod setting).
- **The stack** — managed LIFO zone; pass-priority UI; players resolve top item manually.
- **Phases/turn structure** — turn + phase tracker (reuse `turn_tracker`); optional auto-untap at untap step, auto-draw at draw step (toggles).
- **Death rules** — reuse contract: life ≤ 0, poison/infect ≥ 10, 21 commander damage from one source.
> What we do NOT auto-enforce (long tail, Track B): individual card Oracle effects, targeting legality, triggered abilities. Those stay manual with reminders, per Model C.

### 13.5 Lobbies, scheduling, game finder, spectating
- "Start a game now or schedule one for later" / "up to seven days out" / "players sign up… lobby opens automatically" → new tables `scheduled_games` + `lobby_signups`; an Edge Function (cron) flips a scheduled game to active at start time. (Builds on `games`.)
- "Keep the lobby private and share the link, or open it up and let anyone join" → `games.visibility` (public/private) + join-by-code; **Find a Game** page lists `visibility='public' and status='lobby'`.
- **Spectators** → `game_participants.role` (player|spectator); spectators get public-zone reads only (RLS), no hidden zones.
- "Primers expand inline on the lobby card" → store deck primer/notes (already `saved_decks.notes`); render in the lobby.

### 13.6 Voice chat
- "voice chat built in" → **WebRTC mesh** for 2–6 peers; Supabase Realtime Broadcast as the **signaling** channel (SDP/ICE exchange) — in-stack, no new infra. Mute/PTT controls. (Larger pods could need an SFU later; mesh is fine to 6.)

### 13.7 Card Insights & stats integration (our event log makes this natural)
Because every draw/cast/win is already an **action in `game_actions`**, we can compute Card Insights with SQL/Edge jobs over that log:
- "Dead draw detection — cards you draw but rarely cast" → per card: count `draw` vs `card_move(to=battlefield/stack)`.
- "Win rate impact per card" → join card-hit-battlefield events to `match_history` outcomes.
- "Cast-on-curve analysis" → compare cast turn vs `cmc` from `card_cache`.
- "Best opening hand cards" → opening-hand snapshot (a `mulligan`/`draw` opener event) × win rate.
- "ELO leaderboards update the moment a game ends," "per-deck stats: win rate, power level, arch-enemies," "achievements & history," "Playscore leagues" → these are **your existing tracker's job**; the tabletop just writes `match_history.summary` on game end and the tracker ingests it (§8.2). Same account/data, per their "same account, same data."

### 13.8 Solo playtest (no account)
- "Goldfish… no account at all," "sessions… cleared automatically," "shareable one-click playtest URL" → a **local-only** mode of `table-core.js` (no Supabase writes); deck via paste/Archidekt/Moxfield; `?deck=<id|url>` shareable link that loads + server-resolves prints + shuffles client-side. This is also our **Phase 2 dev harness**.

### 13.9 Community/back-office (later — Phase 5+)
- Discord bot (leaderboards, game notifications, invite links), **public REST API** (players/games/decks/leaderboards — Supabase auto-generates REST; or a thin Edge API), playgroups, admin (member mgmt, audit logs, game integrity). These mostly sit on data the schema already has.

### 13.10 New action types to add (beyond §3)
```sql
alter type public.game_action_type add value if not exists 'card_phase';
alter type public.game_action_type add value if not exists 'card_clone';
alter type public.game_action_type add value if not exists 'card_target';   -- (also broadcast ephemerally)
alter type public.game_action_type add value if not exists 'priority_pass';
alter type public.game_action_type add value if not exists 'game_end';       -- declare winner → match_history
```

---

## 14. Cached execution prompts (build playbook)

Copy-paste these into the build chat **in order**. Each is self-contained: it names the docs, files, and acceptance criteria so a fresh agent can execute without re-deriving context. Assume the repo = `mtg-life-counter`; conventions = vanilla JS globals + Supabase via CDN (match `app.js`/`deck-builder.js`); docs = `MTG_PLATFORM_PLAN.md` (vision/Model C) + `MTG_VTT_RESEARCH_LOG.md` (code snippets) + this file. **Build server-authoritative for anything touching hidden zones or integrity (§13 intro).**

**UI-FEEL RULE (every UI/UX prompt — non-negotiable):** Before writing any markup/CSS, **open the reference screenshots in `ui-reference/`**. **Playgroup.gg (platform-plan §22) is the PRIMARY feel target** — teal accent, **full-bleed card-art playmat**, polished glassy panels, **turn timer**, art-forward hand fan, and the **richest menus** (it's a Rails/Hotwire/Stimulus app, architecturally close to ours — its menus are built client-side via `buildMenuHTML()` + `data-action`, exactly our pattern). **Kiku (§21) is the SECONDARY reference** for the single pan/zoom board + the hover+hotkey model. When they differ, **match Playgroup's chrome/feel and adopt the UNION of both menus** — Playgroup's add **Put Ability on Stack, Reveal & Cast, Tutor Card, Fetch Land, View Library, Play with Top Revealed, Give to Player, Highlight Card, Inspect, Counters & Labels, Place marker, Phase Out, Auto-organise battlefield, Draw Targets** (+ new actions `stack_item`/`give_card`/`highlight`/`reveal_and_cast`/`auto_organise`/`place_marker`). The screenshot wins on any ambiguity; reproduce the **exact menu items, dividers, and hotkey hints** — don't invent your own. Image maps: §22 (`playgroup-01`…`05`, PRIMARY) + §21 (`kiku-01`…`10`). The VERIFY step includes "UI visually matches the referenced screenshot."

### Agentic execution policy (pre-planned — when I'll spawn sub-agents)
Default: **execute these prompts solo, in order.** Spawn parallel sub-agents only at these pre-identified high-fan-out checkpoints — always **research/audit-only, reporting to me as master**, **never parallel writers to shared files** (parallel edits corrupted files in a past session; the master applies all edits):
- **At PROMPT 1–2 (renderer):** an **8-player DOM stress-test** agent to settle DOM vs PixiJS-via-CDN before the renderer is locked.
- **At PROMPT 3 (realtime):** a **hidden-zone security/RLS audit** agent once multiplayer is wired (try to read an opponent's hand every way possible).
- **At PROMPT 5 / 8 (Insights & Draft):** a **comparative-UI** agent (re-study Kiku/Playgroup tutorials + the two YouTube videos in the log) for parity polish.
- **Before any monetization:** a **legal / Fan-Content-Policy posture** agent.
Otherwise no agents — they start cold and re-derive context (expensive). Each spawned agent gets the three plan docs, a CONFIRMED-vs-INFERRED output contract, and a "write no files" rule.

### Final-audit fixes, VERIFY protocol & sequencing (apply as you build)
A 5-agent audit (platform-plan §20 has the full hole table) cross-referenced the plan against the real code. Bake these in as you hit each prompt; **every prompt ends with the VERIFY block GREEN before the next begins** — this is how "all code is bug-tested before implemented."

**VERIFY block — append to every prompt:**
```text
VERIFY (code is not "done" until this passes; paste the PASS line, never "looks right"):
1. PURE CORE: extend tests/table-core.test.html for every new action; open via the preview tool;
   document.title === "PASS (n)", 0 fails. Mandatory: reduce(s, invert(a,s)) deep-equals s per new action.
2. NO REGRESSION: full test page green. For SQL: re-run tests/rls_assertions.sql under BOTH a player and an
   opponent JWT — every EXPECT holds (opponent hand AND face-down identity = 0 rows / NULL; zone_counts = 7).
3. UI SMOKE: load index.html in the preview tool, exercise the feature, screenshot, zero console errors,
   AND confirm it visually matches the referenced ui-reference/ Kiku screenshot (layout / palette / menu items).
4. SYNC (if realtime touched): tests/realtime_smoke.html, two sessions — propagates AND no hidden-zone leak.
5. STATE INTEGRITY: app loads; Life Counter + Deck Builder still work; hard refresh mid-feature restores state.
6. REPORT which assertions/queries ran and their result.
```

**Critical pre-edits / fixes (full table = platform §20):**
- **P0:** `action_type` = **TEXT, validate in the reducer, NO enum** [H7]; add `is_legal_commander` + `game_participants.role` to the ALTERs [H4/H14]; restrict `card_cache` writes to **service-role only** [H15]; run-order `schema → deck_builder → tabletop`, use `drop/create policy` (not `alter policy`) [H20]; the spike MUST assert a **face-down battlefield card's identity = NULL to opponents** AND a **guest (anon) `appendAction` succeeds** (not just hand hiding) — store true identity in an owner-only `game_card_hidden` table [H6/H8].
- **P1:** add the **deck-instantiation contract** — explode `deck_cards.quantity` to N `game_card_instances`; `zone='command'` if `section='commander'` else `library`; characteristics from `card_cache.raw`; `pos` = shuffled index; partners = 2 command rows [H9]; upsert tokens into `card_cache` before instancing [H21].
- **P2:** build **undo-as-inverse** (`reduce(s, invert(a,s))` == `s`) — the snapshot stack in `app.js` is NOT reusable for multiplayer [H1]; **stamp `turn` centrally in `appendAction`** + emit explicit `cast_spell` (turn+cmc) & `opening_hand` actions [H11/H12]; reducer must **not throw on unknown action** [H24].
- **P3:** REQUIRED pre-edit — refactor `MTGSyncAdapter.appendAction` to **object-args + caller-supplied `client_action_id`** (real code is positional and makes its own id → silent reconcile break) [H2]; build the optimistic + reconcile loop **net-new** [H3]; a Postgres **trigger / Edge `commit_action` is the single writer** of `game_card_instances` + snapshots [H10/H22].
- **P4:** partners tracked per `source_commander_id`; 21-damage loss **never summed** [H13].

**New + moved prompts:**
- **NEW PROMPT 0.75 — `vitals.js` extraction (early, single-threaded).** Extract life / commander-damage / counter / death logic from `app.js` into `vitals.js` used by both the Life Counter page and the table. *Verify:* the standalone Life Counter page behaves identically. (Done early so the table reuses it; shared-file edits corrupt under parallelism.)
- **NEW PROMPT 1.5 — input chrome (split from P2).** The Kiku hover + single-key dispatcher (16-key map, platform §17) + pointer drag (research log C2) + marquee, wired to stub actions on the P1 board. *Verify:* hotkeys fire the right (stubbed) actions; drag is 60fps; keeps `table.js` (DOM/input) and `table-core.js` (pure) cleanly separable.
- **MOVE PROMPT 6 (solo no-account playtest) to right after PROMPT 2** — it's the primary dev/test harness.

```text
PROMPT 0 — Backend migration + multiplayer RLS + hidden-info verify
Context: Read MTG_TABLETOP_INTEGRATION_PLAN.md §3, §5.3, §6, §13.2 + research log C10/Part D. Existing
schema in backend/supabase/schema.sql + deck_builder.sql.
Task:
1) Write backend/supabase/tabletop.sql: the §3 card_cache columns; game_card_instances + game_board_snapshots;
   add game_card_instances to the realtime publication. ENUM DECISION (§3 gotcha): migrate
   game_actions.action_type from the game_action_type enum to TEXT + a CHECK (or app-validated) — ~40 new
   verbs are coming and ALTER TYPE ADD VALUE can't run in the transaction Supabase wraps migrations in.
   (If keeping the enum: add values in a SEPARATE committed migration before any that uses them.)
2) Write the §6 participant RLS: is_game_member() + member-read policies for games, game_participants,
   game_counters, commander_damage, game_card_instances, game_actions; hidden-zone rows (zone in
   ('hand','library') or face_down) readable ONLY by the owner participant's profile; a zone_counts view so
   opponents see hand/library COUNTS without identities (research log C10).
3) Hidden-info VERIFY (RLS-per-subscriber is already CONFIRMED — research log C10): prove an opponent CANNOT
   read another player's hand rows via REST or a postgres_changes subscription. Only the column-nulling VIEW
   variant is unproven — if it leaks, fall back to a Supabase Edge Function relay (supabase/functions/game-relay).
Acceptance: Two anon users in one game; user B's API/realtime never returns user A's hand identities; B sees the
correct hand COUNT; existing single-owner flows still pass.
```

```text
PROMPT 0.5a — Auth UI + session handling
Context: §6.5A. web-sync.js already has signUp/signIn/signOut. Match app.js DOM style.
Task: Add an auth modal + header state to index.html/app.js: email sign up/in/out, password reset
(resetPasswordForEmail + a reset view), "continue as guest" (supabase.auth.signInAnonymously), Google +
Apple OAuth buttons, and onAuthStateChange wiring that toggles a "local only / synced" indicator.
Keep full offline/local mode working when signed out.
Acceptance: Sign up, verify, sign in, refresh keeps session, sign out; guest gets an anon uid; OAuth
round-trips to the configured redirect.
```

```text
PROMPT 0.5b — Cloud deck persistence + local→cloud migration
Context: §6.5B. Decks currently save to localStorage key "magic-table-tracker-decks-v1" in deck-builder.js.
Tables saved_decks/deck_cards/card_cache exist.
Task: When signed in, persist decks to Supabase (upsert saved_decks + replace deck_cards; upsert fetched
Scryfall cards into card_cache). Keep localStorage as offline/guest fallback. On first sign-in, offer a
one-time push of local decks (idempotent via saved_decks_owner_source_deck_id_idx). Subscribe to
saved_decks/deck_cards realtime so decks appear cross-device.
Acceptance: Save a deck signed-in on device A → appears on device B; guest still saves locally; no dupes
after re-running migration.
```

```text
PROMPT 0.5c — Hosting + Edge Functions scaffold
Context: §6.5C. Static app, no build step.
Task: Document/scaffold deploy (static host of choice) + supabase-config.js (gitignored). Scaffold Edge
Functions: ai-deck-review (uses the ai-deck-review-contract.md, holds the AI key), account-delete
(service role), shuffle (server RNG → returns seeded library order). Wire the deck builder's "Review deck"
to ai-deck-review. SCRYFALL CACHING (platform §26): scryfall-bulk-import (nightly → card_cache, so metadata
never hits the API per-card); card-image cache (download size-tiered images to Supabase Storage
`card-images/{scryfall_id}-{size}.jpg`, lazy backfill, return our CDN URL); route ALL Scryfall fetches through
one throttled path (User-Agent + Accept, 50–100ms spacing, 429 backoff, in-flight de-dupe, DB-first).
Acceptance: Deployed URL loads; AI review returns the contract JSON; account-delete removes the user;
shuffle returns a deterministic order from a seed; a card image loads from OUR Supabase Storage on the second
view (not Scryfall) and metadata resolves from card_cache with no API call. Service-role key never reaches the browser.
```

```text
PROMPT 1 — Card render + pan/zoom board + deck load (no networking)
Context: §1, §13.1, research log §15 (single pan/zoom board) + C1/C9. Reuse deck-builder.js helpers VERBATIM:
fetchScryfallJson, normalizeCard, and the image fallback (image_uris.normal → card_faces[0].image_uris.normal).
Task: Add a 3rd "Play" tab (data-page-target="table") to index.html + table.js. Build ONE pan/zoom shared board
(camera = LOCAL-only CSS transform; cards positioned in % of a virtual board — research log C1), with a per-seat
playmat region. Render a card (front/back faces, hover-zoom, tapped rotation, counters badge). "Play deck": load a
saved_deck into a local board (library + command zone), commander by section='commander'.
Acceptance: A real 100-card Commander deck loads; commander in the command zone; correct art + DFC backs; pan/zoom works.
```

```text
PROMPT 2 — table-core reducer + zones + hover-hotkey input (solo, Model C spine)
Context: §4, §7, §13.2–13.4, research log A2 (keymap) + C2 (drag) + B2 (analytics). Keep table-core.js a PURE
reducer (state,action)->state.
Task: Implement CardInstance state + zones (hand/battlefield/graveyard/exile/library/command/stack). Actions:
draw, mulligan(London), card_move, card_tap/untap, untap_all, card_tap_many, card_counter, token_create
(Scryfall t:token), card_flip (face-down + DFC), card_phase (skips untap), card_attach (shelf + attach_order),
library_shuffle, library_scry, surveil, search, mill, reveal, dice, annotation_create (label/mana counter).
INPUT: Kiku-style hover + single-key dispatcher as PRIMARY (keymap research log A2: t/f/a/x/c/h/g/e/l/b/p/r/Space)
+ 60fps pointer drag (research log C2); right-click menu as fallback. ANALYTICS (NON-BACKFILLABLE — do NOW per
research log B2): stamp the current `turn` onto every action payload, and emit opening_hand{card_names[]} at
mulligan-keep + a distinct cast_spell action. Engine-ready fields (characteristics, stack/priority/phase) present
as dormant stubs. Reuse the table-log as the event log.
Acceptance: Full solo goldfish turn driven by hotkeys works; undo reverses each; event log + turn stamps correct;
an opening_hand action is logged at keep.
```

```text
PROMPT 2b — Hard zones polish: Stack, attachment shelf, DFC/phase/morph
Context: §13.1–13.2. Senior MTG correctness required.
Task: Dedicated Stack zone (LIFO list with item + targets, manual resolve). Attachment shelf rendering for
attached_to (Auras/Equipment/Fortifications stack under host; host move carries them; unattach on host
leave). DFC flip/transform; phase-out/in (skip untap, render dimmed); face-down morph/manifest/foretell/
disguise as a generic 2/2-or-hidden card with server-held true identity.
Acceptance: Cast→stack→resolve flow; equip moves with creature; a DFC transforms; a phased permanent
skips untap; a face-down card's identity is not in the opponent's client state.
```

```text
PROMPT 2c — Targeting arrows + marquee multi-select
Context: §13.1. Ephemeral, not persisted.
Task: Marquee box selects multiple permanents → batch tap/move/token (one action, instanceIds[]). Target
arrows: drag from a card to a card/player → SVG overlay broadcast to the table (Realtime Broadcast,
auto-expire). 
Acceptance: Select 5 lands, tap all in one action; draw an arrow that every client sees for ~2s.
```

```text
PROMPT 3 — Realtime multiplayer (extend MTGSyncAdapter)
Context: §5, §13. Durable actions via game_actions + game_card_instances; hot-path via Broadcast; hidden
zones via the server path from PROMPT 0.
Task: Route table-core actions through appendAction + game_card_instances upserts (reuse version +
client_action_id idempotency + undo). Subscribe via the existing channel + add Broadcast for drag/cursor/
arrows + Presence for seating/spectating. Reconnect rebuilds from rows + latest snapshot. 2 players first,
then the 4-player Commander seat layout (reuse playerTemplate panels for opponents).
Acceptance: Two browsers play live <150ms; refresh mid-game resumes exact state; opponent hands stay hidden;
undo syncs.
```

```text
PROMPT 3b — Lobby, join link, seats, spectators
Context: §6.5D, §13.5.
Task: A lobby view: host creates a game (games row, visibility public/private), share join code/link, others
join (game_participants seat; guests via anon auth), choose deck per seat, host controls (start/kick/reset/
end). Spectator role = public-zone reads only. "Find a Game" page lists public lobbies. COMMS (§25): durable
text chat via a new game_messages table (RLS members read/write + realtime) docked in the lobby AND in-game;
establish WebRTC voice AT THE LOBBY (Supabase Broadcast signaling + a TURN server) so players talk while picking
decks, carrying into the game.
Acceptance: Host + 3 joiners (incl. a guest) seat up, pick decks, start; a spectator watches without seeing hands;
two players in the lobby can text-chat (persists on reload) AND hear each other over voice before the game starts.
```

```text
PROMPT 3c — Scheduled games + auto-open
Context: §13.5.
Task: scheduled_games + lobby_signups tables; UI to schedule up to 7 days out, others sign up; a cron Edge
Function flips scheduled→lobby/active at start time and notifies signups.
Acceptance: Schedule a game +1h, sign up a second account, confirm it auto-opens at the time.
```

```text
PROMPT 4 — Commander bookkeeping automation + game end → stats
Context: §13.4, §8.2. Reuse app.js vitals (refactor into shared vitals.js per §8.3).
Task: Command zone + commander tax (+2/recast), source-aware commander-damage matrix (21=loss), partners/
backgrounds (two commanders, color-identity union), London mulligan with optional free-first (pod setting),
death rules, optional auto-untap/auto-draw toggles. On "declare winner": write match_history.summary
{winner, placements, commanderDamage, turns, durationSec}.
Acceptance: 4-player Commander game start→finish; tax/commander-damage correct; result lands in match_history
and the tracker picks it up.
```

```text
PROMPT 4b — Built-in voice chat (WebRTC mesh)
Context: §13.6 + §25. Voice is ESTABLISHED at the lobby (PROMPT 3b) and persists into the game.
⏸ DECISION GATE: before building voice infra, PROMPT the owner via AskUserQuestion to choose the TURN/voice
provider (platform §25 candidate set: self-hosted coturn / Cloudflare Calls / Twilio / Metered / managed SFU) —
do NOT pick silently. Then proceed with their choice.
Task: WebRTC mesh for up to 6–8 peers using Supabase Realtime Broadcast as the signaling channel (SDP/ICE),
with the chosen TURN server for NAT traversal (Google STUN for easy cases).
Per-seat mute + push-to-talk, a mic device picker, a speaking indicator on the seat panel, deafen, join/leave
sounds; Presence for who's connected/talking; spectators listen-only. iOS: NSMicrophoneUsageDescription.
Pair with the docked text-chat panel (§25 game_messages).
Acceptance: Two+ browsers hear each other from the lobby through the game; mute/PTT works; the speaking indicator
lights up; reconnect re-establishes peers; text chat persists across reload.
```

```text
PROMPT 5 — Card Insights analytics from the event log
Context: §13.7. game_actions already records draw/cast/move; match_history holds outcomes.
Task: Edge/SQL jobs computing per-deck, per-card: dead-draw rate (drawn vs cast), win-rate-impact
(card-on-battlefield vs game outcome), cast-on-curve (cast turn vs card_cache.cmc), best-opening-hand
(opener × win rate). Surface in the deck builder as "Card Insights."
Acceptance: After N logged games, a deck shows ranked cut/keep suggestions with the four metrics.
```

```text
PROMPT 6 — Solo no-account playtest + shareable link
Context: §13.8.
Task: A local-only table-core mode (no Supabase writes) reachable at ?play=<deckId|moxfield|archidekt>;
paste/link import → resolve prints (Scryfall) → client shuffle → goldfish with draw/mulligan/undo/log.
Nothing persisted without an account.
Acceptance: Open a playtest link with no session; goldfish a deck; refresh clears it.
```

```text
PROMPT 7 — Community: Discord bot + public API (later, Phase 5+)
Context: §13.9.
Task: A thin Edge API (players/games/decks/leaderboards) over existing tables; a Discord bot posting
leaderboards/game notifications/invite links. Read-only API keys; rate limit.
Acceptance: API returns a leaderboard JSON; the bot posts a game-finished notification to a test server.
```

```text
PROMPT 8 — Realtime Commander Draft (Kiku's moat differentiator)
Context: Research log A4 + C13. New tables draft_sessions + draft_picks; pool tiers over card_cache
(is_legal_commander). Builds on the lobby (PROMPT 3b) and the deck loader (PROMPT 1).
Task: Lobby→synergy→round→cut→complete state machine. An Edge Function builds a weighted commander pool
(popular / sweet-spot / deep-cuts sliders) + claimable packages; a pg_cron/Edge tick advances rounds on
per-round/per-cut timers; bot seats fill an incomplete pod; picks flow as draft_claim actions (replayable).
Synergy phase = pick 2–3 themes + a custom creature type to bias the pool. On complete, assemble each seat's
deck and hand off to the table loader.
Acceptance: 4 seats (incl. 1 bot) draft a full pod within timers; each finishes with a legal Commander deck loaded.
```

```text
PROMPT 9 — Planechase, custom playmats & free annotations
Context: Research log A5 + Part D. Net-new features from the Kiku teardown.
Task: (a) Planechase: games.planechase_state, a plane_sets table, planeswalk/planeswalk_back/roll_planar_die
actions, a plane-card UI + random/custom plane sets with JSON import/export. (b) Custom playmat:
game_participants.playmat_url, rendered behind a seat's cards. (c) Free annotations: game_board_annotations
(kind = counter|label|mana_counter) as draggable board objects (keys c=counter, L=label), ephemeral drag over
Broadcast + durable commit.
Acceptance: Planeswalk through a custom plane set; set a playmat image; drop a counter and a text label that peers see.
```

```text
PROMPT 10 — Art / printing / foil selector (platform §18 + research log Part G)
Context: EXTEND the EXISTING deck-builder picker (deck-builder.js: deckImageModal, fetchDeckCardPrints,
renderDeckArtPicker, selectDeckEntryArt; index.html deckImageModal markup) — do NOT duplicate. In-game picker
is greenfield.
Task:
(a) Deck builder: add PRINT mode (Scryfall unique=prints, don't collapse to art), a set filter, Foil/Etched
    toggles (derive from the print's finishes[], auto-disable when absent), and a DFC face flip. Persist
    chosen_scryfall_id/set_code/collector_number/is_foil/is_etched/flipped_face to deck_cards. FIX
    normalizeCard/normalizeSavedCard to stop dropping set/collector/finishes.
(b) In-game: right-click "Change art/print" on a game_card_instances card → same modal → a card_setart action
    (validate owner/controller; optional applyToAllCopies; commit to game_actions; broadcast).
(c) CRITICAL: the deck→game loader must resolve by chosen_scryfall_id (or {set,collector} via /cards/collection)
    and copy is_foil/etched/flipped_face onto the new instances — currently it resolves by NAME and loses the print.
(d) Foil/etched = a CSS shimmer overlay (Part G); Scryfall serves no foil image.
(e) Tokens + custom playmat reuse the same picker.
VERIFY: pick a non-default printing + foil in the builder, save, reload → it persists; Play the deck → the card
enters the game with that exact print/foil; right-click "Change art" in-game → all seats see it via card_setart;
tests/table-core.test.html covers card_setart incl. its undo round-trip.
```

---

*Prepared by studying the `mtg-life-counter` codebase (web + Supabase + iOS) and external tabletops, plus an intense pass over Playgroup Live (`/playgroup-live`, `/playtest`, `/for-communities`, `/live_sessions`). Pairs with `MTG_PLATFORM_PLAN.md` (vision + Model C). Move both into the repo's `/docs` when ready.*
