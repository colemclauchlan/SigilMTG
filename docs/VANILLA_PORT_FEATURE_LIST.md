# Sigil — Feature Gap: React vs Vanilla (port list)

> **Purpose.** Everything you asked for when the React rebuild started (the big build prompt + the ranked-scene work), marked by where it lives today. Hand back the **⚛️ React-only** and **⬜ Not-built** items you want me to implement in the **vanilla** client.
>
> **Legend:** ✅ already in vanilla · 🟡 in vanilla but more advanced in React · ⚛️ React-only (not in vanilla) · ⬜ not built anywhere yet (or only partial/stub).
>
> Tick the boxes you want ported to vanilla; this is the list to give back to me.

---

## A. ⚛️ React-only — the main "port to vanilla" candidates

These were built only in the React app and do **not** exist in your vanilla client.

### Accounts, profile & identity
- [x] **Profile page / viewer** (avatar, stats, decks) — `profile.js` (Phase 3).
- [x] **Account onboarding** (3-step: add deck → who you play with → first game) — `onboarding.js`, first-run wizard, stores playgroup pref + best-effort profile upsert.
- [x] **Auto-populated player name** from the account (guest vs account) in-game — `accountPlayerName()` in `table.js`, respects an explicit user override.

### Lobby & matchmaking
- [x] **Host-a-table / Find-a-table lobby** (browse open games, player counts) — `openLobby()` in `table.js` (Online menu). *Suggested-bracket badge per row still TODO (needs bracket stored on the game row).*
- [x] **MOBA-style draft-select screen** — `buildDraftSelect()` in `play-shell.js`: bracket circle B1–B5 with U/L half, colorized, Lock In; when online, picks are broadcast and pod picks surface (best-effort ephemeral, never clobbers in-game handler).
- [x] **Ongoing-matches menu** + **Spectate** button — `watch.js` live-games + spectator/VOD.
- [x] **Reconnect/resume** + "Reconnected" indicator — realtime channel status threaded through `web-sync.js` → `table-sync.js` (`onConn`) → `showConnStatus()` badge + auto re-pull in `table.js`.

### Ranked / competitive scene
- [x] **ELO rating** + win/loss + match history surfacing — `ranked.js` / `profile.js` (Phase 3).
- [x] **ELO leaderboard** — `ranked.js` (Ranked tab).
- [x] **Metagame analytics** (win-rate by bracket, top commanders, activity) — `ranked.js`.
- [x] **Tournaments** — create, Swiss / single-elim pairings, rounds/standings — `tournaments.js`.
- [x] **Seasons** (season-scoped leaderboard) — `ranked.js` season selector.
- [x] **Achievements / badges** (catalog × earned grid, tier colors) — `profile.js`.

### Spectate / replay
- [x] **Spectator mode** — read-only viewer with hidden info enforced — `watch.js`. *(Single-board VOD timeline; full live 2×2 board mirror still depends on a public-games RLS policy.)*
- [x] **Replay / VOD** — replay list + step-through action timeline — `watch.js`.

### Deck tools
- [x] **Deck-review / Bracket engine** — `analyzeDeckForBracket()` in `deck-builder.js`: Bracket 1–5 from Game Changers + mass-land-denial / tutors / combos / **extra-turns** (added); type counts, **color %** (added), upgrade suggestions.
- [x] **PreCons browser** — `precons.js` (Phase 2).
- [x] **Card Insights** analytics — `computeCardInsights()` in `deck-builder.js`: hypergeometric mana-screw/keepable/flood odds, early-play density, avg CMC, simulated best opener.
- [x] **Log card hyperlinks** — `cardLink()` + delegated handler in `table.js`; hover previews, click explodes (inspect).

### Engine / backend (architectural — biggest lift)
- [ ] **Server-authoritative engine** (game server owns state, hidden info server-enforced). **Intentionally NOT ported** — vanilla stays client-authoritative + Supabase sync (the pragmatic path; all UI features above ported without this rewrite).
- [x] **Full LIFO stack** with card images, reorder, resolve/remove/inspect — `renderStack()` in `table.js` now uses an explicit `stackOrder` LIFO array with thumbnails, ▲/▼ reorder, Inspect/Resolve/Remove, hover-preview. *(Cross-board sync of the stack still rides the existing client-auth board sync, not a dedicated shared stack.)*

---

## B. 🟡 In vanilla, but the React version is more built-out

You have these in vanilla already; port only if you want the upgraded behavior.
- ✅ **Stack** — upgraded: LIFO order array, card thumbnails, ▲/▼ reorder, Inspect/Resolve/Remove, hover-preview (`renderStack()` in `table.js`). Cross-board sync still rides the existing board sync.
- 🟡 **Dice / coin** — vanilla: 2D roll popup with animation. React: 3D tumbling dice/coin across screen.
- 🟡 **Health / commander-damage cluster** — vanilla `play-life.js` has Types modal, running-math, poison, +green/−red, commander damage. React `#P4` is the same feature set, slightly re-styled.
- 🟡 **Multiplayer invite/host** — vanilla: `table-sync.js` client-auth host/join. React: Colyseus rooms.

---

## C. ✅ Already in vanilla (no port needed — for reference)

- ✅ Paper **life tracker** page · ✅ **Deck builder** page · ✅ **three.js 3D landing**
- ✅ Virtual tabletop: board, pan/zoom, drag, marquee, all zones
- ✅ Right-click card menu (hotkeys + submenus) · counters & labels · set ±X / set P/T · place marker · keyword token · proliferate · highlight/ping · **inspect** modal
- ✅ Library right-click actions · **tutor** filterable search · **fetch land** · library/graveyard/pile viewers
- ✅ **Create token** search popup (+ hover-explode) · **pinned trackers** · mulligan/opening hand
- ✅ **Playmat picker** (solid + MTG images) · hand cards hi-res · colorized zones
- ✅ **Keywords / slang / terms** helper menus
- ✅ Mana counters · commander-damage modal · life panel + commander art bg · action log / stack panel
- ✅ **Engine**: ~40 rules modules, stack/turn/combat/SBA, ~1036 tests · opt-in **SBA enforcement** · effective P/T badges · turn structure (Pass Turn untaps) · **combat auto-duel** (keywords, trample, token cleanup)
- ✅ Pass-turn flow · board-wipe / undo (in engine)

---

## D. ⬜ Not fully built anywhere (true gaps from the original vision)

- [ ] **Arena-style combat attack animations** (cards lunging to attack/block).
- [ ] **Voice chat working over NAT** — React has a WebRTC mesh + vanilla has `voice.js`, both behind a flag; needs a **TURN server** (your gate).
- [ ] **AI-generated playmats** baked at 2K (needs OpenArt credit top-up).
- [ ] **"Every keyword/mechanic in every set"** engine coverage — framework exists; long-tail cards still fall back to manual (by design).
- [ ] **Programmatic SEO / marketing pages** beyond the landing.
- [ ] **Mobile / iOS** companion.

---

### Suggested approach
If the **vanilla client is your real product**, the highest-value ports from **§A** are: profile page, the lobby + draft-select, the ranked stack (leaderboard / metagame / tournaments / seasons / achievements), spectator, replay, and the deck-review/bracket + PreCons. The **server-authoritative engine** is the one item I'd think hard about — your vanilla client-auth multiplayer already works, so porting the *features* without that rewrite is the pragmatic path.
