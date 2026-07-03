#!/usr/bin/env bash
# Run this from the repo root ON YOUR MACHINE (Git Bash on Windows, or any shell).
# Prereqs: git + GitHub CLI (`gh`) installed and authenticated (`gh auth login`).
#
# It (1) clears the broken .git the cloud sandbox left behind, (2) inits a clean repo,
# (3) creates a PRIVATE GitHub repo and pushes, (4) opens the delivery issues.
#
# Safe to re-run the ISSUES section alone (comment out the repo section) if the repo already exists.
set -euo pipefail

REPO_NAME="${1:-magic-table-tracker}"     # pass a name as arg 1 to override
VISIBILITY="--private"                      # change to --public if you want

echo "==> 1/4  Removing the corrupt .git left by the cloud sandbox (if any)"
rm -rf .git 2>/dev/null || { echo "   couldn't remove .git automatically — delete the .git folder in Explorer, then re-run"; }

echo "==> 2/4  Fresh git init + first commit"
git init -b main
git add -A
git status --short | grep -Ei 'supabase-config\.js$|(^|/)\.env$|(^|/)\.env\.' && { echo "REFUSING: a secret file is staged. Check .gitignore."; exit 1; } || true
git commit -m "Initial commit: MTG table tracker + tabletop backend (PROMPT 0) + plan docs"

echo "==> 3/4  Create GitHub repo and push"
gh repo create "$REPO_NAME" $VISIBILITY --source=. --remote=origin --push

echo "==> 4/4  Creating issues"
mk() { gh issue create --title "$1" --body "$2" >/dev/null && echo "   + $1"; }

mk "PROMPT 0 — Backend migration + RLS + hidden-info (DONE)" \
"DONE & verified. Acceptance: opponent cannot read another player's hand/library or a face-down card's true identity; sees hand COUNT; member appends actions only as self; existing flows pass. Verified via tests/rls_assertions.sql. See docs/DELIVERY_PLAN.md."

mk "PROMPT 0.75 — Extract shared vitals.js" \
"Refactor life/commander-damage/counter/death from app.js into vitals.js used by the Life Counter page and the table. AC: Life Counter behaves identically."

mk "PROMPT 0.5a — Auth UI + session handling" \
"Auth modal + header state (email, guest/anon, Google/Apple), onAuthStateChange indicator; offline still works. AC: sign up/verify/sign in/refresh-keeps-session/sign out; guest anon uid; OAuth round-trips."

mk "PROMPT 0.5b — Cloud deck persistence + local->cloud migration" \
"Signed-in: upsert saved_decks + replace deck_cards; localStorage fallback; one-time idempotent import; realtime cross-device. AC: deck saved on A appears on B; guest saves locally; no dupes on re-run."

mk "PROMPT 0.5c — Hosting + Edge Functions scaffold" \
"Deploy static app; Edge fns: ai-deck-review, account-delete, shuffle (seeded RNG), scryfall-bulk-import, image cache; one throttled Scryfall path. AC: URL loads; AI review returns contract JSON; account-delete works; shuffle deterministic; image from our Storage on 2nd view; service-role never in browser."

mk "PROMPT 1 — Card render + pan/zoom board + deck load" \
"3rd Play tab; one pan/zoom board (% coords); render card (faces, hover-zoom, tap, counters) reusing deck-builder helpers; Play deck loads a saved_deck. AC: 100-card deck loads; commander in command zone; correct art + DFC backs; pan/zoom works."

mk "PROMPT 1.5 — Input chrome (hotkeys + 60fps drag + marquee)" \
"Kiku hover+single-key dispatcher (16 keys), 60fps pointer drag, marquee — wired to stub actions; table.js/table-core.js separable. AC: hotkeys fire right stubbed actions; drag 60fps."

mk "PROMPT 2 — table-core reducer + zones (solo) + test harness" \
"Pure reducer + all zones + actions (draw/mulligan/move/tap/counter/token/flip/phase/attach/shuffle/scry/surveil/search/mill/reveal/dice/annotation); analytics stamps; engine-ready stubs; tests/table-core.test.html. AC: solo goldfish turn via hotkeys; undo reverses each; opening_hand logged; test page PASS 0 fails."

mk "PROMPT 2b — Hard zones: Stack, attachment shelf, DFC/phase/morph" \
"Stack (LIFO+targets); attachment shelf (attach_order+host move); DFC; phase-out/in (skip untap); face-down morph with server-held identity. AC: cast->stack->resolve; equip moves with creature; DFC transforms; phased skips untap; face-down identity not in opponent state."

mk "PROMPT 2c — Targeting arrows + marquee multi-select" \
"Marquee batch action (instanceIds[]); ephemeral target arrows broadcast, auto-expire. AC: select 5 lands tap in one action; arrow visible to all ~2s."

mk "PROMPT 6 — Solo no-account playtest + shareable link" \
"Local-only table-core at ?play=<deck>; import->resolve->shuffle->goldfish; nothing persisted. AC: open link with no session; goldfish; refresh clears."

mk "PROMPT 3 — Realtime multiplayer (extend MTGSyncAdapter)" \
"Object-args appendAction + caller client_action_id; optimistic+reconcile; actions->game_actions+game_card_instances; Broadcast hot path; Presence; reconnect via snapshot; 2- then 4-player. AC: two browsers live <150ms; refresh resumes; hands hidden; undo syncs."

mk "PROMPT 3b — Lobby, join link, seats, spectators (+chat/voice)" \
"Host/join (guests anon), deck per seat, host controls; spectator public-zone reads; Find a Game; durable game_messages chat; WebRTC voice at lobby. AC: host+3 joiners (incl guest) start; spectator can't see hands; chat persists; voice connects."

mk "PROMPT 3c — Scheduled games + auto-open" \
"scheduled_games + lobby_signups; schedule up to 7 days; cron Edge flips scheduled->active. AC: schedule +1h, 2nd account signs up, auto-opens."

mk "PROMPT 4 — Commander automation + game end -> stats" \
"Command zone+tax; source-aware commander-damage matrix (21=loss, never summed); partners; London mulligan; death rules; auto-untap/draw toggles; declare winner->match_history. AC: 4-player start->finish; tax+damage correct; result in match_history."

mk "PROMPT 4b — Built-in voice chat (WebRTC mesh) [DECISION GATE: TURN provider]" \
"WebRTC mesh 6-8 peers, Supabase signaling, chosen TURN. Prompt owner for provider first. Mute/PTT, device picker, speaking indicator, spectators listen-only. AC: lobby->game audio; mute/PTT; reconnect."

mk "PROMPT 5 — Card Insights analytics" \
"Edge/SQL: dead-draw, win-rate impact, cast-on-curve, best opening hand; surface in deck builder. AC: after N games, ranked cut/keep with 4 metrics."

mk "PROMPT 7 — Community: Discord bot + public API" \
"Thin Edge API (players/games/decks/leaderboards) + Discord bot; read-only keys, rate limited. AC: API returns leaderboard JSON; bot posts game-finished."

mk "PROMPT 8 — Realtime Commander Draft" \
"draft_sessions+draft_picks; weighted pool; synergy phase; timers; bot seats; draft_claim actions; assemble decks->loader. AC: 4 seats (1 bot) draft a pod within timers; each gets a legal deck loaded."

mk "PROMPT 9 — Planechase, custom playmats & free annotations" \
"Planechase (planechase_state, plane_sets, planeswalk actions, plane UI); per-seat playmat; annotations (counter/label/mana). AC: planeswalk custom set; set playmat; drop counter+label peers see."

mk "PROMPT 10 — Art / printing / foil selector" \
"Extend deck-builder picker (PRINT mode, set filter, foil/etched, DFC flip); persist chosen print on deck_cards; in-game card_setart; loader resolves chosen print + foil. AC: pick print+foil saves/persists; play deck enters with it; in-game change-art syncs; test covers card_setart undo."

echo "==> Done. Issues created on $REPO_NAME."
