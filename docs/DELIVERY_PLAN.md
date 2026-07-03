# MTG Virtual Tabletop — Delivery Plan & Issue Backlog

Derived from `MTG_TABLETOP_INTEGRATION_PLAN.md` §14 (PROMPT 0–10), `MTG_PLATFORM_PLAN.md`, and `MTG_VTT_RESEARCH_LOG.md`. This is the spec-to-issues mapping with acceptance criteria + the test strategy. Run `scripts/github_setup.sh` to push the repo and open these as GitHub issues.

**Current status:** PROMPT 0 (backend) ✅ done & verified. Backend = Supabase project `magic-table-tracker` (ref `nvosctybynqsjrfuvkek`).

---

## ⚙️ Execution mode: AUTONOMOUS (updated 2026-06-24)

Per the owner's directive, the remaining plan runs **end-to-end with minimal check-ins**. The agent proceeds through every milestone without pausing for per-step approval, takes the reasonable **default** at any "decide on review" / "⏸ decision gate" (recording it under *Auto-decisions* below), and surfaces **one consolidated review at the very end**.

**Non-negotiable constraints that still hold (never auto-skip):**

- **Secrets:** never commit `.env` / `.env.local` / `.env.production` / `supabase-config.js`. The Supabase `service_role` key lives only in Edge Function secrets. If a step needs a secret/env value, **stop and tell the owner exactly how to set it** (GitHub secret or Cloud Secrets Manager) — never invent, hardcode, or push it.
- **Local testing:** the owner tests locally. Any required env/config change is called out explicitly and concisely.
- **Each milestone still ends GREEN before the next starts**, but the gate is now **self-verified**: `node tests/table-core.node.cjs` → `PASS`, `node tests/table-smoke.cjs` → green, every new reducer action has an `invert` round-trip test, and no console errors. The owner is not in the loop per-gate.
- The only things deferred to the final review are the items under *Auto-decisions*.

**Auto-decisions (defaults chosen so work isn't blocked):**

- **Renderer:** DOM (already shipped). Revisit only if the 8-player DOM stress test regresses.
- **Transport:** Supabase Realtime, RLS-filtered (Edge relay stays a fallback).
- **#4b Voice chat:** built **last, behind a feature flag, with a pluggable TURN-provider interface**; voice ships **disabled** until the owner picks a TURN vendor at the final review — so it blocks nothing.
- **Deck import:** Scryfall + paste-a-decklist are in; Moxfield/Manabox/Archidekt URL import is added where CORS permits, otherwise via paste/file export.

---

## 3 delivery ideas (pick a first ship)

The full plan is large; these are three coherent, shippable slices built from the same spec.

1. **Solo Tabletop / Goldfish (recommended first ship).** A fully playable *single-player* virtual table — render real cards, pan/zoom board, all zones, drag/tap/counters/tokens, hotkeys, load a real deck, draw/mulligan/undo. Zero multiplayer risk, immediately demoable, and doubles as the dev/test harness. Issues: **0.75, 1, 1.5, 2, 2b, 2c, 6.**
2. **Accounts + Cloud Decks.** Real sign-in, cloud deck saving with a one-time local→cloud migration, deploy + Edge Functions (AI review, account delete, server shuffle, Scryfall cache). Makes the *existing* app multi-device today. Issues: **0.5a, 0.5b, 0.5c.**
3. **Live Multiplayer Commander.** The headline: realtime sync, lobby/join/seats/spectators, commander bookkeeping, game-end → stats. Builds on #1 and #2. Issues: **3, 3b, 3c, 4.**

**Recommendation:** ship #1 first (it's the product's spine and the test harness), stand up #2 in parallel (backend is already done), then #3.

---

## Test strategy (every issue ends GREEN before the next starts)

- **`tests/table-core.test.html`** — pure-reducer assertions, no build/deps. Title encodes result (`PASS (n)` / `FAIL (n)`). **Mandatory:** every new action has `reduce(s, invert(a,s)) deep-equals s` (undo round-trip) + a seeded-shuffle determinism check.
- **`tests/rls_assertions.sql`** — ✅ in place. Hidden-info under two JWTs: opponent hand + face-down identity = 0 rows / blank; `zone_counts` = correct; member appends only as self.
- **`tests/realtime_smoke.html`** — two sessions: an action propagates AND no hidden-zone leak.
- **UI smoke** — load `index.html`, exercise the feature, screenshot, zero console errors, and it matches the `ui-reference/` target (Playgroup primary, Kiku secondary).
- **No regression** — Life Counter + Deck Builder still work; hard refresh mid-feature restores state.

---

## Issue backlog (PROMPT 0–10)

### #0 — Backend migration + multiplayer RLS + hidden-info verify ✅ DONE
**Acceptance:** two users in one game; B's API/realtime never returns A's hand identities or a face-down card's true identity; B sees correct hand COUNT; a member appends `game_actions` only as itself; existing single-owner flows still pass. **Verified** via `tests/rls_assertions.sql`.

### #0.75 — Extract shared `vitals.js`
Refactor life / commander-damage / counter / death logic out of `app.js` into `vitals.js`, used by both the Life Counter page and the table.
**Acceptance:** the standalone Life Counter page behaves identically (no visual/behavioral diff); `app.js` imports from `vitals.js`.

### #0.5a — Auth UI + session handling
Auth modal + header state: email sign up/in/out, password reset, "continue as guest" (anon), Google/Apple OAuth, `onAuthStateChange` → local/synced indicator. Offline mode still works signed-out.
**Acceptance:** sign up → verify → sign in → refresh keeps session → sign out; guest gets an anon uid; OAuth round-trips to the configured redirect.

### #0.5b — Cloud deck persistence + local→cloud migration
When signed in, upsert `saved_decks` + replace `deck_cards`; keep localStorage as guest/offline fallback; one-time idempotent local→cloud import; subscribe to realtime for cross-device.
**Acceptance:** save a deck signed-in on device A → appears on B; guest still saves locally; no dupes after re-running migration.

### #0.5c — Hosting + Edge Functions scaffold
Deploy the static app; Edge Functions: `ai-deck-review` (holds AI key), `account-delete` (service role), `shuffle` (seeded server RNG), `scryfall-bulk-import` (nightly), card-image cache to Storage. Route all Scryfall through one throttled path.
**Acceptance:** deployed URL loads; AI review returns the contract JSON; account-delete removes the user; shuffle is deterministic from a seed; a card image loads from our Storage on 2nd view; service-role key never reaches the browser.

### #1 — Card render + pan/zoom board + deck load (no networking)
3rd "Play" tab; one pan/zoom shared board (camera = local CSS transform; cards in % coords); render a card (faces, hover-zoom, tap rotation, counter badge) reusing `deck-builder.js` Scryfall helpers; "Play deck" loads a `saved_deck`.
**Acceptance:** a real 100-card Commander deck loads; commander in the command zone; correct art + DFC backs; pan/zoom works.

### #1.5 — Input chrome (hotkeys + 60fps drag + marquee)
Kiku hover + single-key dispatcher (16-key map), pointer drag at 60fps, marquee select — wired to stub actions; `table.js` (DOM/input) cleanly separable from `table-core.js` (pure).
**Acceptance:** hotkeys fire the right (stubbed) actions; drag is 60fps; the two files stay separable.

### #2 — `table-core` reducer + zones (solo, Model C spine) + test harness
Pure reducer; `CardInstance` + all zones; actions: draw, mulligan (London), move, tap/untap, untap_all, tap_many, counter, token, flip (face-down + DFC), phase, attach, shuffle, scry, surveil, search, mill, reveal, dice, annotation. Analytics: stamp `turn`, emit `opening_hand` + `cast_spell`. Engine-ready stubs present.
**Acceptance:** full solo goldfish turn via hotkeys; undo reverses each; event log + turn stamps correct; `opening_hand` logged at keep; `table-core.test.html` = PASS, 0 fails.

### #2b — Hard zones: Stack, attachment shelf, DFC/phase/morph
Dedicated Stack (LIFO + targets, manual resolve); attachment shelf (`attach_order` + host-move); DFC flip/transform; phase-out/in (skips untap); face-down morph/manifest/foretell with server-held identity.
**Acceptance:** cast→stack→resolve; equip moves with the creature; a DFC transforms; a phased permanent skips untap; a face-down card's identity is not in the opponent's client state.

### #2c — Targeting arrows + marquee multi-select
Marquee selects multiple permanents → batch action (`instanceIds[]`); target arrows drag card→card/player → SVG overlay broadcast, auto-expire.
**Acceptance:** select 5 lands, tap all in one action; draw an arrow every client sees for ~2s.

### #6 — Solo no-account playtest + shareable link
Local-only `table-core` mode at `?play=<deckId|moxfield|archidekt>`; import → resolve prints → client shuffle → goldfish with draw/mulligan/undo/log; nothing persisted without an account.
**Acceptance:** open a playtest link with no session; goldfish a deck; refresh clears it.

### #3 — Realtime multiplayer (extend `MTGSyncAdapter`)
Refactor `appendAction` to object-args + caller `client_action_id`; optimistic + reconcile-by-version; route actions → `game_actions` + `game_card_instances`; Broadcast for drag/cursor/arrows; Presence; reconnect via snapshot; 2-player then 4-player layout.
**Acceptance:** two browsers play live <150ms; refresh mid-game resumes exact state; opponent hands stay hidden; undo syncs.

### #3b — Lobby, join link, seats, spectators (+ chat/voice at lobby)
Host creates a game (visibility public/private), share join code/link, others join (guests via anon), pick deck per seat, host controls; spectator = public-zone reads only; "Find a Game" lists public lobbies; durable `game_messages` chat; establish WebRTC voice at the lobby.
**Acceptance:** host + 3 joiners (incl. a guest) seat up, pick decks, start; a spectator watches without seeing hands; lobby text chat persists on reload; two players hear each other before start.

### #3c — Scheduled games + auto-open
`scheduled_games` + `lobby_signups`; schedule up to 7 days out; cron Edge Function flips scheduled→active and notifies.
**Acceptance:** schedule a game +1h, a 2nd account signs up, it auto-opens at the time.

### #4 — Commander bookkeeping automation + game end → stats
Command zone + tax (+2/recast); source-aware commander-damage matrix (21 = loss, never summed); partners/backgrounds (two commanders, color-identity union); London mulligan with optional free-first; death rules; optional auto-untap/draw toggles; declare winner → `match_history.summary`.
**Acceptance:** 4-player Commander game start→finish; tax + commander damage correct; result lands in `match_history` and the tracker picks it up.

### #4b — Built-in voice chat (WebRTC mesh) — ⏸ DECISION GATE
WebRTC mesh for up to 6–8 peers, Supabase Broadcast signaling, chosen TURN provider. **Prompt the owner** to pick the TURN/voice provider before building. Per-seat mute + PTT, device picker, speaking indicator, deafen, spectators listen-only.
**Acceptance:** two+ browsers hear each other lobby→game; mute/PTT works; speaking indicator lights; reconnect re-establishes peers.

### #5 — Card Insights analytics from the event log
Edge/SQL jobs: dead-draw rate, win-rate impact, cast-on-curve, best opening-hand. Surface in the deck builder.
**Acceptance:** after N logged games, a deck shows ranked cut/keep suggestions with the four metrics.

### #7 — Community: Discord bot + public API (later)
Thin Edge API (players/games/decks/leaderboards) + a Discord bot (leaderboards, game notifications, invites). Read-only API keys, rate limited.
**Acceptance:** API returns a leaderboard JSON; the bot posts a game-finished notification to a test server.

### #8 — Realtime Commander Draft (the Kiku moat)
`draft_sessions` + `draft_picks`; weighted commander pool (popular/sweet-spot/deep-cuts) over `card_cache`; synergy phase; per-round/cut timers; bot seats; picks as `draft_claim` actions; on complete, assemble each seat's deck → table loader.
**Acceptance:** 4 seats (incl. 1 bot) draft a full pod within timers; each finishes with a legal Commander deck loaded.

### #9 — Planechase, custom playmats & free annotations
Planechase (`planechase_state`, `plane_sets`, planeswalk actions, plane UI, random/custom sets, JSON import/export); custom playmat per seat; free annotations (counter/label/mana_counter draggable objects).
**Acceptance:** planeswalk through a custom plane set; set a playmat image; drop a counter + a text label that peers see.

### #10 — Art / printing / foil selector
Extend the existing deck-builder picker with PRINT mode (Scryfall `unique=prints`), set filter, Foil/Etched toggles, DFC face flip; persist `chosen_scryfall_id/set_code/collector_number/is_foil/is_etched/flipped_face`. In-game right-click "Change art/print" → `card_setart` action. Deck→game loader resolves by chosen print, copies foil/etched.
**Acceptance:** pick a non-default printing + foil, save, reload → persists; Play the deck → card enters with that exact print/foil; in-game change-art syncs to all seats; `table-core.test.html` covers `card_setart` + its undo round-trip.
