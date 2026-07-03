# Magic Table Tracker

Static web app plus native iOS scaffold for a shared, synced MTG table tracker.

## What Exists Now

- Existing static web app remains functional from `index.html`.
- Optional Supabase sync adapter added in `web-sync.js`.
- Shared backend schema in `backend/supabase/schema.sql`.
- Deck builder backend extension in `backend/supabase/deck_builder.sql`.
- Shared data contract in `shared/data-contract.md`.
- SwiftUI iOS app scaffold in `ios/MTGTableTracker/MTGTableTracker`.
- HyperFrames promo-video composition in `hyperframes/mtg-table-tracker`.

## Virtual Tabletop (Play tab)

A playgroup.gg / kiku-style online virtual tabletop built into the app (the **Play** tab). Vanilla JS, no build step.

**Architecture (Model C):**

- `table-core.js` — a pure, dependency-free reducer (`reduce(state, action)`) with exact `invert(action, state)` for undo round-trips and a deterministic seeded shuffle. Node tests: `node tests/table-core.node.cjs` (63 assertions).
- `table.js` — renderer + input (pan/zoom board, drag/tap, context menus, all panels below).
- `table-sync.js` + `web-sync.js` — Supabase realtime multiplayer. The server (RLS-filtered `game_card_instances`) is the source of truth, so hidden zones are enforced by Postgres, not the client.
- `tests/table-smoke.cjs` — headless jsdom render harness (25 assertions): boots the Play tab, loads solo + a 4-player pod, opens every panel, asserts zero console errors. Run: `npm i jsdom && node tests/table-smoke.cjs`.

**Solo / goldfish:** pan/zoom board, draw/play/tap/drag, hand drag-and-drop, all zones (library/hand/battlefield/graveyard/exile/command/stack), tokens, counters GUI, scry/surveil, London mulligan, clickable phase bar, undo, action log, auto card art (Scryfall), double-faced flip, foil + alternate-print picker, power/toughness with live +1/+1 and -1/-1 math.

**Pod (hotseat pass-and-play):** the Pod selector seats 1–4 players as separate playmats in a spaced 2×2 grid — you at the bottom, opponents rotated to face their seats, each with its own board (battlefield + piles + life), distinct felt tint, and active-seat glow. In a solo pod every seat is dealt the loaded deck and **Pass turn hands control to the next player** (the board reorients and shows their hand) for a full local game. Commander-damage matrix (21 = lethal), editable opponent life, and game-end results recorded to match history. Online multiplayer instead has each player join with their own deck.

**Formats / extras:** Planechase (planar deck + planar die), Commander Draft (pick-a-pack pool, then play it), Combat helper (declare attackers, deal summed power), Deck Insights (mana curve / colors / types), Paste-a-decklist (Moxfield / Archidekt / MTGA), Playmat backgrounds, Save/Load board (localStorage), shareable playtest link.

**Online multiplayer:** sign in, Host public/private game, Find-games lobby, Join by ID. Hidden-info verified under two JWTs (`tests/rls_assertions.sql`).

**Controls:** primary actions on the bar (Pass turn · Mulligan · End game · Pod · Combat · Cmd dmg) plus **Table ▾ / Deck ▾ / Online ▾** dropdowns. Right-click any card or pile for its menu; hover a card and press a hotkey (press `?` in the Play tab for the full list); double-click the board or press `0` to recenter.

**Run locally:** open `index.html` (no build). The tabletop is fully usable offline; sign-in/online features need `supabase-config.js` (see Backend Setup). **Never commit** `supabase-config.js` or any `.env*` — they are gitignored, and the Supabase `service_role` key lives only in Edge Function secrets.

## Current Sync Status

The web app and iOS scaffold now share the same documented data shapes, Supabase schema, action names, and counter/death-rule vocabulary. The web app remains fully usable in local mode.

Full production cross-device sync still requires the final Supabase client wiring:

- Add real sign-in UI/session handling on web and iOS.
- Create or resume a shared game before appending actions.
- Persist participant IDs so queued actions target backend rows, not just local player IDs.
- Replay subscribed rows back into each client's local state.
- Run the iOS target in Xcode with the Supabase Swift package installed.

## Current Web App Features Preserved

- Multiplayer table tracker
- Life total tracking with tap and hold increments
- Source-aware commander damage modal and commander tax counter
- Poison, energy, experience, storm, token and custom counter types
- Smart counters from decklists/Moxfield imports
- Scryfall commander art search and alternate art picker
- Deck browser grouped by card type
- Dice roller and coin flip
- Random player
- Turn cycle counter
- Official Magic rules TXT search suggestions
- Death logic and death overlay
- Responsive web layouts
- Deck builder with Scryfall search, autocomplete, filters, local saved decks, deck stats, validation warnings, favorites, and import-to-table
- Local deck coach preview plus backend AI review contract in `backend/ai-deck-review-contract.md`

## HyperFrames Video Integration

HyperFrames is integrated as a renderable video composition for the app, not as a replacement for the tracker UI.

- Composition: `hyperframes/mtg-table-tracker/index.html`
- Local browser shortcut: use the `Video` button in the app header.
- Render output: `dist/magic-table-tracker-promo.mp4`

Prerequisites for rendering:

- Node.js 22 or newer
- npm/npx on PATH
- FFmpeg on PATH

Commands from this folder:

```powershell
npm install
npm run hyperframes:lint
npm run hyperframes:validate
npm run hyperframes:preview
npm run hyperframes:render
```

Codex HyperFrames skills were installed locally from `heygen-com/hyperframes`. Restart Codex to pick up the new skills in future turns.

## Backend Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `backend/supabase/schema.sql`.
4. Run `backend/supabase/deck_builder.sql`.
   - For the virtual tabletop also run `backend/supabase/tabletop.sql` and `backend/supabase/lobby_public_game_discovery.sql` (RLS + hidden-info + public-game discovery for the lobby).
5. Optional: adjust and run `backend/supabase/seed.sql`.
6. In Supabase Auth, enable:
   - Email/password
   - Google OAuth if desired
   - Sign in with Apple if desired
7. Copy `.env.example` to your deployment environment.
8. Copy `supabase-config.example.js` to `supabase-config.js`, fill in:
   - `supabaseUrl`
   - `supabaseAnonKey`
9. Add this line before `web-sync.js` in `index.html` once configured:

```html
<script src="supabase-config.js"></script>
```

The web app intentionally runs without this file so local/offline use still works.

## iOS Setup

The iOS source is generated, but final Xcode project creation/signing must happen on a Mac.

1. Open Xcode.
2. Create a new iOS SwiftUI app named `MTGTableTracker`.
3. Use bundle id from `.env.example`, for example `com.yourcompany.mtgtabletracker`.
4. Drag the files from `ios/MTGTableTracker/MTGTableTracker` into the Xcode target.
5. Add Swift Package dependency:

```text
https://github.com/supabase/supabase-swift
```

6. Add the `Supabase` product to the app target.
7. Add build settings or xcconfig values:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
8. Confirm `Info.plist` is included in the target.
9. Replace generated icons with final App Store icon sizes if Xcode requests them.

## Manual Actions Required

- Create Supabase project.
- Apply SQL schema.
- Configure OAuth redirect URLs in Supabase.
- Configure Sign in with Apple in Apple Developer portal.
- Open/build/sign iOS app on a Mac with Xcode.
- Add real App Store metadata, privacy labels, screenshots, and TestFlight build.

## Sync Architecture

- Supabase Auth owns users.
- Supabase Postgres stores profiles, games, participants, counters, commander damage, dice rolls, match history, and queued sync events.
- Decks, deck cards, favorite cards, card cache, and AI deck reviews are stored in the deck builder extension tables.
- Realtime publication is enabled for game state tables.
- Clients should write optimistic local state and append `game_actions`.
- Conflict strategy is version-based:
  - pull latest game
  - replay queued local actions
  - write incremented version

## Testing Checklist

- Web app still opens from `index.html`.
- Email/password auth works after Supabase config is added.
- Same user can sign in on web and iOS.
- Life changes sync both directions.
- Counters sync both directions.
- Dice rolls and coin flips append history.
- Offline iOS actions queue locally.
- Reconnect flushes queued actions.
- Reset creates a `table_reset` action.
- Death rules trigger at 0 life, 10 poison/infect, and 21 damage from one commander source.
- Scryfall search returns cards and autocomplete suggestions.
- Deck validation counts commander totals, duplicates, basic lands, and format legality.
- Deck import sends the active deck to Player 1 and sets commander art when available.
- iPhone portrait and landscape layouts are usable.
- iPad two-column layout is usable.

## App Store Readiness Checklist

- App icon final 1024x1024 and generated sizes.
- Launch screen verified.
- Bundle ID and signing configured.
- Privacy labels prepared:
  - Account info
  - User-generated gameplay data
  - Diagnostics if added later
- Sign in with Apple enabled if any third-party login is enabled.
- TestFlight internal testing complete.
- Terms/privacy URLs created before submission.

## Notes

This workspace cannot run Xcode or iOS Simulator because it is on Windows. The SwiftUI code is structured for Xcode import and further native build verification on macOS.
