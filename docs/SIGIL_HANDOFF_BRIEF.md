# Sigil — Handoff Brief (for continuing the VANILLA client)

> **Read this first.** You (Fable) are taking over work on **Sigil**, Cole's Magic: The Gathering Commander web app. This brief summarizes everything Cole has asked for across a long build session, how he likes to work, the current state, and where to pick up. The **vanilla JS client is the real product** — that's what you're extending. A separate React rebuild exists (`web/`) but is secondary; most of its new features have already been ported back into vanilla.

---

## 1. What Sigil is

A browser MTG Commander app: **paper life tracker**, **deck builder**, a **three.js 3D landing**, and a **virtual tabletop** ("Play" tab) modeled on **playgroup.gg** with a rules/combat engine inspired by **xMage**. Integrations: **Scryfall** (cards), **Moxfield/Archidekt** (deck import), **Supabase** (auth, cloud decks, realtime multiplayer, stats). Vanilla stack = **plain JS, no build step, `<script>` tags in `index.html`**; feature files are isolated IIFE/UMD modules exposing globals (e.g. `window.MTGTable`, `window.MTGCore`). Backend = Supabase project ref **`nvosctybynqsjrfuvkek`** ("magic-table-tracker").

## 2. How Cole works — preferences & constraints (FOLLOW THESE)

- **Communication:** concise and direct, minimal formatting, bulletize instructions. Don't over-explain.
- **Workflow for existing app:** don't assume — **ask with options if anything is unclear**; follow steps in order. He likes: read the docs/specs first, analyze what's built, propose a few ideas, spec work into issues, plan tests, then implement.
- **Local testing:** he tests locally. If an env change is needed, tell him and he'll test.
- **Secrets (hard rule):** **never push `.env` / `.env.local` / `.env.production` to GitHub.** If unsure, **stop and ask**. Guide him to set secrets as GH secrets or in a cloud secret manager. The client uses only the **public Supabase anon key** (in `supabase-config.js`, gitignored) — that key is publishable/safe, but the file must be present in any deploy for online features to work.
- **Autonomy:** he often says "continue" / "run until out of tokens" — he wants hands-off, back-to-back progress with brief checkpoints, pausing only for things that truly need him (deploy, OAuth, live tests). He'll say "pause" when he wants you to stop.
- He runs a **task-observer** skill at session start and keeps an observation log; honor it if present.

## 3. The full arc of what Cole asked for

**3a. Early Play-tab polish (all done in vanilla):** playmat background only on the mat (similar color elsewhere); life status in the mat corner not the whole window; fix invisible +/− on mana counter; exploded card preview fades unless hovering; dice/coin roll animations + white-flash result; button centering/scaling + restyle; prepopulate all counters in the counter menu; heal-tracking UI; Create-token UI from reference images + full-height playmat; remove "Magic Table Tracker" logo/text; grey out non-Commander modes; sign-in to top-right; counters tick as one integer and read like `+3/+3`; counters must not hide P/T (put above); P/T readout on all cards; token art hover/click to explode; don't import sideboard/maybeboard; fix life-tab search closing on scroll; on-board stack (grey the card, keep it, Resolve/Destroy) + always-visible hand; **pin trackers to the board (thumbtack)**.

**3b. Rules/combat engine (done in vanilla):** "make a polished plan for a rule/combat engine like xMage, run a loop until complete" → ~40 `rules-*.js` modules + `engine-*.js` + `table-core.js`, ~1036 node tests. **Combat auto-duel** (compare P/T, loser dies, respects indestructible/deathtouch/double-strike/trample/lifelink). "Take the rules deeper into the live board" → opt-in **SBA enforcement** (0-toughness deaths, +1/+1 ⊗ −1/−1 annihilation, token cleanup, player-loss flagging), **effective P/T badges**, **turn structure** (Pass Turn advances + untaps next player), commander tax. Manual/auto engine toggle.

**3c. THE BIG PLATFORM PROMPT (66-item spec).** A giant message specified: LIFO stack with images synced across boards + engine + manual toggle; full account system/backend, match history, win/loss, profile page, auto-populated player name, deck saving; **all WotC precons** under a "PreCons" button (from Moxfield); damage/health tracker fixes (hover-spread buttons, "Types" modal with Normal/Poison-Infect/Cmdr circle picker/Lifelink/Apply, solo commander damage, 21-cmdr-dmg death, 10-poison death, 0-life board-grey + "DEAD!"); library right-click action menu; tutor filterable grouped search; fetch-land UI; remade library/graveyard viewers (icon buttons + tooltips + hover-colorize); **inspect UI** (art + Scryfall/TCGPlayer/Moxfield + add-to-deckbuilder + alt-prints); hover glow; pass-turn flash + "Turn passed!"/"Your turn!" popups; board-wipe + undo-with-`(undone)`; keyword/slang/terms helper in the top bar; **3D dice/coin roll across screen**; **+ hovers green / − hovers red** everywhere; large pan/zoom playmats (scroll out to see the pod); mulligan disables after first card; pinned-counter overlap fix + drag-anywhere; **full-window board** with overlaid movable/minimize/close panels; **deck viewer + AI review → bracket + upgrade suggestions**; **green P/T box** on cards when modified + a "granted-keyword" green box + right-click keyword token; engine covering "every keyword in every set" (framework + manual fallback); **MOBA-style deck bracket draft-select** (B1–B5 circles + U/L, opponents see brackets before Lock In); extend SBAs + turn phases (auto-draw, upkeep, cleanup discard-to-7 with a chooser + max-hand-size checks); untap-all respecting "doesn't untap"; highlight/ping a card (logs it); bug report + What's New changelog; drag zone-color highlights; top-bar submenu grouping + back-to-lobby moved top-left; counters & labels + set±X + set P/T + place-marker UIs matching images; zones moved bottom-right; **host/find-table lobby**; **proliferate**; redesigned targeting arrows + combat attacker/blocker windows (let damage through); right-click hotkeys + submenus; card-stack viewer rework + double-click-to-play; hand menu with play/play-face-down; **spectate ongoing matches**; **log card hyperlinks**; per-commander damage icons (yellow circles) on the life total. Plus a **meta plan**: research → plan → execute → auto-test → deck-bracket/draft → profile → invite/online → audio+text chat → new icons → finish engine → self-critique → code review → no-breakage → turnkey → ideate → repeat; use appropriate skills/agents; a master agent coordinating workers; offload light tasks to cheaper models; ask before starting the loop.
Follow-up: **"ensure every single fix/image fix is in the plan"** (→ the 66-item checklist in `docs/PLATFORM_BUILD_PLAN_V2.md` §5).

**3d. Ranked scene:** ELO leaderboard, metagame analytics, **tournaments** (Swiss/elim, ELO-seeded), **seasons**, **achievements/badges**, **spectator mode**, **replay/VOD**.

**3e. Branding / playmats (IMPORTANT correction):** the real Sigil logo is the **mana-seal** (glow + outer ring + pentagon + five WUBRG nodes: W `#eef0ea`, U `#4aa3e6`, B `#9b86c4`, R `#e0655c`, G `#46b277`) — used on card backs, the D6 face, and the nav (`.brand-mark` SVG in `index.html`; `drawSigilSeal` in `home.js`). **Do NOT change the branding without instruction** — the React scaffold wrongly swapped it to a "swords" icon and he called that out. Playmats: high-res, non-stretched, plus **Sigil-brand** mats. Image gen is available via connected **OpenArt / OpenRouter** MCPs ("Nano Banana" = `google/gemini-2.5-flash-image`); costs credits.

**3f. Deploy:** he wants it live. **Deploying is a human gate** (Vercel/Fly CLIs + auth are not available to the agent). Root `vercel.json` deploys the **vanilla** app as a static site (fastest, includes Supabase config). See `DEPLOY.md`.

**3g. The pivot (current direction):** after deploying the React app he found it buggy + missing the original pages (life tracker, 3D landing, deck builder) → decided the **vanilla client is the product** and the React-only features should be **ported into vanilla** (this is your main job). See `docs/VANILLA_PORT_FEATURE_LIST.md` — most §A items are now done in vanilla (`profile.js`, `ranked.js`, `tournaments.js`, `watch.js`, `onboarding.js`, `precons.js`, `deck-builder.js` bracket/insights, and `table.js`/`play-shell.js` lobby/draft/stack/reconnect/card-links).

## 4. Current state

- **Vanilla client:** feature-complete tabletop + engine + life tracker + deck builder + 3D landing, PLUS the ported platform features (profile, ranked, tournaments, spectate/replay, onboarding, precons, bracket review, LIFO stack, lobby, draft-select, reconnect, log card-links). Multiplayer stays **client-authoritative + Supabase sync** (the server-authoritative rewrite was intentionally NOT ported).
- **React app (`web/`):** a parallel rebuild; secondary. Real logo + three.js landing just restored; still has beta bugs and needs `cd web && npm i` (for `three`) before redeploy.
- **Supabase:** all tables RLS-protected incl. `tournaments*`, `match_replays`, `seasons`/`achievements`/`user_achievements` (migrations applied). Advisors clean except 3 minor pre-existing warnings.

## 5. What's left on the vanilla client (suggested next work)

- Finish the port-list TODOs: **suggested-bracket badge** on lobby rows (store bracket on the game row); **live 2×2 spectator board mirror** (needs a public-games RLS policy); polish the ported profile/ranked/tournaments/watch UIs to match the app's look.
- The ⬜ gaps: **Arena-style combat attack animations**; **voice-over-NAT** (needs a TURN server — his gate); deeper engine keyword coverage; the 2K AI-baked Sigil playmats (OpenArt credit top-up).
- General: keep the vanilla app's look/feel consistent (the "Arcane Foil / Midnight Azure" theme; the mana-seal logo).

## 6. Key files & docs

- **Docs:** `docs/PLATFORM_BUILD_PLAN_V2.md` (the plan; **§5 = the 66-item feature checklist**), `docs/VANILLA_PORT_FEATURE_LIST.md` (React↔vanilla gap + what's ported), `DEPLOY.md`, `COWORK_LEDGER.md` (see §7), plus `docs/RULES_ENGINE*.md`, `docs/MTG_VTT_RESEARCH_LOG.md`.
- **Vanilla core:** `index.html` (script includes + nav), `table.js` (tabletop engine + `MTGTable` API), `table-core.js` (`MTGCore` reducer), `play-shell.js` (screens/lobby/draft), `play-hud.js` (in-game HUD), `play-life.js` (life/commander-damage cluster), `app.js` (life tracker), `deck-builder.js`, `home.js` (3D landing), `web-sync.js` + `table-sync.js` + `supabase-config.js` (multiplayer/backend), the `rules-*.js`/`engine-*.js` engine, and the newly-ported `profile.js`/`ranked.js`/`tournaments.js`/`watch.js`/`onboarding.js`/`precons.js`. Tests: `node tests/run-all.cjs`.

## 7. Gotchas (read before editing)

- **Concurrent agents + ledger:** another agent may edit this repo at the same time and **git is non-functional**, so `COWORK_LEDGER.md` is the only guard. **Read it before working, claim a file before editing it, re-read a file right before editing, never edit a file another agent has an open claim on, release claims when done.** Protocol detail in `PLATFORM_BUILD_PLAN_V2.md` §13.
- **Mount/read truncation:** in some sandboxes, `bash`/`cat`/`node --check` can serve **truncated** copies of heavily-edited files (`table.js`, `play-shell.js`, `play-hud.js`, etc.), causing false end-of-file syntax errors. The file tools (Read/Write/Edit) see the **real** complete file. To node-check a big edited file, reconstruct it into a fresh filename via Read→Write, then check that. Watch for stray `\0` null bytes after edits (`tr -cd '\000' | wc -c` should be 0).
- Vanilla is **no-build**: top-level functions are globals; keep new features as isolated `<script>` modules and add the include to `index.html`.

## 8. How to continue

1. Read `COWORK_LEDGER.md`, then this brief, `VANILLA_PORT_FEATURE_LIST.md`, and `PLATFORM_BUILD_PLAN_V2.md` §5.
2. Ask Cole which items he wants next (or take the ticked boxes he hands you). Don't assume; offer options if unclear.
3. Build in vanilla, claim files in the ledger, keep the mana-seal branding + theme, don't push secrets, and let Cole test locally.
4. Verify with `node tests/run-all.cjs` + a null-byte sweep; report concisely.
