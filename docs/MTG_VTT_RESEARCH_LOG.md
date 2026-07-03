# MTG Virtual Tabletop — Competitive Research Log (for the cowork migration)

> Durable, code-rich log from a 3-agent teardown of **Kiku.gg** and **Playgroup Live**, plus a comparative sweep of open-source web tabletops. Captured so it survives into the cowork `mtg-app` build. Pairs with `MTG_PLATFORM_PLAN.md` (vision/Model C) and `MTG_TABLETOP_INTEGRATION_PLAN.md` (codebase-grounded build + §13 parity + §14 prompts).
>
> **Method note / honesty:** agents cannot interactively play a live multiplayer game. Kiku findings are unusually strong because its **shipped JS bundle is publicly fetchable** (primary source = their real code). Playgroup Live findings are marketing/help-page confirmed (its app is login-walled). Everything below is tagged where it matters: **[CONFIRMED-JS]** = found in Kiku's shipped bundle; **[CONFIRMED-MKT]** = vendor marketing/help; **[CONFIRMED-DOC]** = third-party docs (Supabase/Scryfall/repos); **[INFERRED]** = our reasoned adaptation. Date: 2026-06-22.

---

## PART A — Kiku.gg teardown (the strongest signal)

### A1. What it is + confirmed tech stack
Free, **no-account, no-download** browser MTG tabletop; **up to 8 players**; manual (renders + syncs, does **not** enforce rules). Funded by Ko-fi donations; WotC non-affiliation disclaimer. [CONFIRMED-MKT https://www.kiku.gg/]

**Confirmed architecture (from the shipped bundle `play.kiku.gg/assets/index-*.js`):** React + **zustand** SPA · **PixiJS (WebGL)** board renderer · **Colyseus** authoritative WebSocket game-server (`@colyseus/schema` state sync, default port 2567) · **Express** behind **Cloudflare** · cards straight from `api.scryfall.com`. [CONFIRMED-JS]

> Strategic read: Kiku = **server-authoritative via Colyseus rooms** (one stateful process per game) + **WebGL rendering**. We replace Colyseus authority with **Supabase (durable `game_actions` + RLS + Edge Functions)** and start DOM-rendered (PixiJS-via-CDN is the perf escape hatch). Their hidden-info handshakes prove honor-system is not competitive.

### A2. The confirmed keybinding map — Kiku's killer UX (hover + one key)
Hover any card, press one key. No right-click menu hunting. **Adopt this as our primary interaction model.** [CONFIRMED-JS]

| Key | Action | Key | Action |
|---|---|---|---|
| `t` | Tap/untap hovered | `c` | Create counter at cursor |
| `f` | Flip face up/down | `Del` | Delete hovered counter |
| `a` | Transform (other DFC face) | `x` | Token-**copy** hovered card |
| `h` | Move to hand | `p` | Play card |
| `g` | Move to graveyard | `r` | Announce "I have a **response**" |
| `e` | Move to exile | `Space` | Announce **pass turn** |
| `l` | To **top** of library | `Esc` | Close/cancel |
| `b` | To **bottom** of library | `Enter` | Confirm |

### A3. Confirmed Colyseus message/action protocol (~80 types) — our durable-action checklist
Grouped from the bundle [CONFIRMED-JS]:
- **Movement:** `DRAG_MOVE`, `DROP_CARD`, `UNDROP_CARD`, `BULK_DRAG_MOVE`, `BULK_MOVE_CARDS`
- **Card state:** `TAP_TOGGLE`, `UNTAP`, `UNTAP_ALL`, `FLIP`, `TRANSFORM`, `PEEK_CARD`, `PLAY_CARD`
- **Tokens/counters:** `CREATE_TOKEN`, `CREATE_TOKEN_COPY`, `CREATE_COUNTER`, `CREATE_COUNTER_ON_CARD`, `UPDATE_COUNTER`, `MOVE_COUNTER`, `DELETE_COUNTER`, `CREATE_MANA_COUNTER`, `UPDATE/MOVE/DELETE_MANA_COUNTER`
- **Labels:** `CREATE_LABEL`, `UPDATE_LABEL`, `MOVE_LABEL`, `DELETE_LABEL`
- **Attach:** `ATTACH`, `ATTACH_START`
- **Library/zones:** `DRAW`, `DRAW_MULTIPLE`, `MILL`, `DISCARD`, `RANDOM_DISCARD`, `SHUFFLE_LIBRARY`, `SCRY_CARDS`, `SURVEIL_CARDS`, `REVEAL_TOP_LIBRARY`, `EXILE_TOP`, `VIEW_ZONE`, `CLOSE_ZONE`, `MULLIGAN`
- **Hidden-info handshakes (important):** `LIBRARY_VIEW_REQUEST` → `LIBRARY_VIEW_ALLOWED`/`DENIED`; `HAND_REVEAL_OFFER` → `HAND_REVEAL_ACCEPTED`/`DECLINED` → `HAND_REVEALED`; `REVEAL`, `REVEAL_TO_ALL`, `REVEAL_TO_PLAYER`, `CARD_REVEALED`
- **Vitals:** `LIFE_UP/DOWN`, `SET_LIFE`, `ADJUST_LIFE`, `ADJUST_COMMANDER_DAMAGE`, `SET_COMMANDER_DAMAGE`, `ROLL_DICE`, `FLIP_COIN`, `ROLL_PLANAR_DIE`
- **Turn/social:** `SET_TURN_BASED`, `ANNOUNCE_PASS` (Space), `ANNOUNCE_RESPONSE` (r)
- **Social/presence:** `CURSOR_MOVE`, `CURSOR_LEAVE`, `SEND_CHAT`, `CLEAR_CHAT_BUBBLE`
- **Planechase:** `PLANESWALK`, `PLANESWALK_BACK`, `UPDATE_PLANECHASE_RULES`, `ROLL_PLANAR_DIE`
- **Draft:** `START_DRAFT`, `DRAFT_READY_CHECK`, `DRAFT_READY`, `DRAFT_ROUND_START`, `DRAFT_SYNERGY_PHASE_START`, `DRAFT_PACKAGE_CLAIMED`, `DRAFT_COMMANDERS_REVEALED`, `GET_DRAFT_DECK`, `LEAVE_DRAFT`, `CANCEL_DRAFT`, `SET_DRAFT_TIMER`
- **Connection:** `HEARTBEAT`/`HEARTBEAT_ACK`, `connectionStale`+`forceReconnect`, `SERVER_ANNOUNCEMENT`/`MOTD_UPDATED`

### A4. The headline differentiator — Realtime Commander Draft [CONFIRMED-JS]
"First of its kind realtime commander draft." Reconstructed mechanic:
- **Server-generated commander pool** weighted by sliders: `cmdPopularPct`, `cmdSweetSpotPct`, `cmdDeepCutsWeight` (UI: "Top-tier everyone knows (Atraxa, Korvold)" vs "Obscure off-meta").
- Players claim pre-built **shared "packages"** in rounds (`packagesPerRound`, `cardsToCut`, `maxRounds`) — not literal 15-card boosters.
- **Synergy/theme phase:** pick 2–3 themes (tokens/graveyard/spellslinger) + a custom creature type to bias the pool.
- Per-round + per-cut **timers** (`roundDuration`, `cutDuration`); turn-based or simultaneous; **bot-controlled seats** to fill a pod; banlist + "allow Unfinity" toggles; live deck-stats readout; settings JSON import/export.

### A5. Other modes & features
- **Modes:** Commander (1–8), **Draft Commander**, **Planechase** (every official plane + custom + random plane sets, JSON import/export), **20 Life** (1v1 Standard/Modern). [CONFIRMED-MKT]
- **Single pan/zoom shared board** (one continuous plane, per-player playmat regions), live cursors, chat bubbles, spectating. [CONFIRMED-MKT+JS]
- **Free-floating text labels**, **mana counters** (distinct primitive), **counters anywhere**, **attachment arrows**. [CONFIRMED-JS]
- **Custom playmat from any image URL** per player. [CONFIRMED-MKT+JS]
- **Exact-print + foil import** (set code + collector number → `isFoil`/`isEtched`, graceful fallback). [CONFIRMED-JS]
- **Browser-saved decks** (localStorage); import Moxfield/Archidekt/plain list. [CONFIRMED-MKT]
- **Full action log.** [CONFIRMED-MKT]
- **No voice** (only text bubbles), **desktop/mouse-first** (no mobile copy), **no stack/priority engine** (manual), **no accounts/stats/scheduling/Discord**. [INFERRED from bundle absence]

---

## PART B — Playgroup Live teardown + §13 corrections

### B1. Confirmed feature set (verifies §13 of the integration plan)
Server-authoritative (*"the server keeps hidden zones hidden"* — no honor system); Commander-only 2–6; desktop/tablet; free; public beta ~Apr 3 2026. Confirmed verbatim: drag every zone; **tap/flip/transform/attach/counter/token/target**; **dedicated Stack zone**; **phase-out/in**; **morph/disguise/manifest/foretell face-down**; **marquee select**; **target arrows**; **equipment/aura shelf**; **per-player reveal permissions**; **group-exile piles ("like Jeska's Will")**; voice chat; scheduling up to 7 days; public/private lobbies + invite tokens + inline primers; Discord bot (`/leaderboard`, `/invite`, auto game notifications); self-serve public REST API; admin (member mgmt, audit logs, integrity); solo no-account playtest + shareable link. [CONFIRMED-MKT — playgroup.gg/playgroup-live, /playtest, /for-communities, /faqs]

### B2. Card Insights (the analytics moat) — and its hard prerequisite
Metrics: **dead-draw detection**, **win-rate impact per card** (on battlefield vs not), **cast-on-curve**, **best opening-hand cards**. [CONFIRMED-MKT]
> **Critical build note:** these are computed off the event log — but you **cannot backfill analytics you didn't log**. You MUST, from day one: stamp the current **`turn`** onto every action payload, and emit an **`opening_hand {card_names[]}`** action at mulligan-keep, plus a distinct **`cast_spell`** action (carrying turn + cmc). This is the single highest-leverage "do it now" item.

### B3. Reverse-engineered ELO / power formulas (so leagues are comparable) [CONFIRMED-MKT /faqs]
- **ELO is a "leech" model:** the winning deck leeches points from losing decks, scaled by rating gap; multiplayer = more potential + more risk. (Not vanilla 1v1 Elo.)
- **Estimated Deck Power:** deck ELO normalized 0–10; new decks start **1500 ELO ≈ 5 power**; confidence grows with games. → `power ≈ clamp((elo-1500)/100 + 5, 0, 10)`.
- **Competitive Rating:** from **average winning turn** — turns 1–5 = Competitive, 5–10 = Casual, 11+ = Jank.
- **Metagame layer:** Meta Diversity Index (Shannon entropy 0–100), monthly risers/fallers, saltiest/most-fun sentiment, **pod-size-normalized win rates**, 5-tier commander list.

### B4. Corrections/additions to integration-plan §13 (agent-verified)
1. **§13.4 over-claims automation.** *"Every Commander rule handled automatically"* is NOT on current public pages; they only list "commander damage, command zone, partners, mulligans, the stack" as built-in. Reframe to **structural bookkeeping, manual resolution** (which is our Model C anyway).
2. **§13.2 face-down is under-modeled.** Need **(a) per-player reveal permissions** AND **(b) group-exile piles**, not a single `face_down` boolean. Add `revealed_to`/`reveal_grants` + a `game_card_piles` container.
3. **§13.5 spectators = [INFERRED], not confirmed.** "Anyone can join the lobby" ≠ read-only spectator. Design it; don't claim parity.
4. **§13.1 phase-out under-specified.** `untap_all` must **skip** phased permanents; phasing skips ETB/LTB (CR 702.26).
5. **§13.1 attachment shelf** needs `attach_order` + host-move propagation (one committed action, not N).
6. **§13.7 Card Insights** is impossible without the day-1 logging changes in B2.

### B5. Net-new from Playgroup not in §13
Guest **"claim game"** funnel (post-hoc attribution via membership or claim-link); the **ELO leech mechanic**; **Estimated Power / Competitive Rating** formulas; the **public metagame product** (MDI, sentiment, tiers); **"pure tabletop" opt-out** (ranked vs unranked flag); **self-serve API keys**; roadmap (chess-clock, **Two-Headed Giant**, automate-upkeep, quest-mode, CSV/JSON export, **offline mode** — cheap for us given the event log).

---

## PART C — Implementation snippet library (vanilla JS + Supabase, no build)

Grounded primarily in **ArnoldSmith86/virtualtabletop** (`mousehandling.js` — production vanilla VTT) [CONFIRMED-DOC], **Steve Ruiz's "Creating a Zoom UI"** camera math [CONFIRMED-DOC], Supabase Realtime docs [CONFIRMED-DOC], and live-tested Scryfall shapes [CONFIRMED-DOC]. Conventions: `table-core.js` = pure `reduce(state,action)`; `table.js` = DOM/input; `appendAction()` commits durable moves to `game_actions` (+ upserts `game_card_instances`); `broadcast()` = ephemeral Realtime. Coords stored as **% of a virtual board** (resolution-independent, web+iOS).

### C1. Pan/zoom camera (cursor-anchored) — Steve Ruiz math, ported to vanilla
```js
const BOARD_W = 1600, BOARD_H = 1000; let camera = { x:0, y:0, z:1 };
const surface = document.getElementById('board-surface'), viewport = document.getElementById('board-viewport');
const screenToCanvas = (p,c)=>({ x:p.x/c.z - c.x, y:p.y/c.z - c.y });
const panCamera  = (c,dx,dy)=>({ x:c.x - dx/c.z, y:c.y - dy/c.z, z:c.z });
function zoomCamera(c, pt, dz){ const z=Math.max(.25,Math.min(4, c.z - dz*c.z));
  const a=screenToCanvas(pt,c), b=screenToCanvas(pt,{...c,z}); return { x:c.x+(b.x-a.x), y:c.y+(b.y-a.y), z }; }
const applyCamera = ()=> surface.style.transform = `scale(${camera.z}) translate(${camera.x}px,${camera.y}px)`; // scale THEN translate
viewport.addEventListener('wheel', e=>{ e.preventDefault(); const r=viewport.getBoundingClientRect();
  const pt={x:e.clientX-r.left,y:e.clientY-r.top};
  camera = e.ctrlKey ? zoomCamera(camera, pt, e.deltaY/100) : panCamera(camera, e.deltaX, e.deltaY); applyCamera();
}, { passive:false });
// Camera is LOCAL-ONLY, never synced (each player pans/zooms independently). Only card %-coords sync.
```

### C2. Pointer drag at 60fps — click-vs-drag decided on `up` (virtualtabletop thresholds: 250ms/10px)
```js
const DRAG_PX=10, CLICK_MS=250; let drag=null;
function toBoardPercent(cx,cy){ const r=viewport.getBoundingClientRect();
  const c=screenToCanvas({x:cx-r.left,y:cy-r.top}, camera);
  return { x:Math.max(0,Math.min(100,(c.x/BOARD_W)*100)), y:Math.max(0,Math.min(100,(c.y/BOARD_H)*100)) }; }
board.addEventListener('pointerdown', e=>{ const el=e.target.closest('.card'); if(!el) return;
  el.setPointerCapture(e.pointerId);
  drag={ el, id:el.dataset.instanceId, pid:e.pointerId, sx:e.clientX, sy:e.clientY, moving:false, t0:performance.now(), raf:0, last:null }; });
board.addEventListener('pointermove', e=>{ if(!drag||e.pointerId!==drag.pid) return;
  if(!drag.moving && Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy) < DRAG_PX) return; // still maybe a click
  drag.moving=true; drag.last=e; if(drag.raf) return;
  drag.raf=requestAnimationFrame(()=>{ drag.raf=0; const p=toBoardPercent(drag.last.clientX,drag.last.clientY);
    drag.el.style.left=p.x+'%'; drag.el.style.top=p.y+'%';        // GPU-only move, NO state/DB
    sendDragGhost(drag.id,p.x,p.y); }); });                        // ephemeral Broadcast (C7)
function endDrag(e){ if(!drag||e.pointerId!==drag.pid) return; drag.el.releasePointerCapture?.(drag.pid);
  if(drag.moving){ const p=toBoardPercent(e.clientX,e.clientY); const z=zoneAtPoint(e.clientX,e.clientY)||'battlefield';
    appendAction('card_move',{instanceId:drag.id,toZone:z,x:p.x,y:p.y}); }   // ONE durable commit on drop
  else onCardClick(drag.id); drag=null; }
board.addEventListener('pointerup', endDrag); board.addEventListener('pointercancel', endDrag);
```

### C3. Tap = 90° rotation (durable)
```js
// table-core.js: case 'card_tap': return upd(state, a.instanceId, { tapped: a.tapped ?? !state.cards[a.instanceId].tapped });
// render: transform: translate(-50%,-50%) rotate(${tapped?90:0}deg);  CSS: transition: transform .12s;
```

### C4. Marquee multi-select → ONE batch action (`card_tap_many` / `bulk_move`)
```js
// On empty-board pointer drag, draw a rect; on up, hit-test card centers in board-% space:
selection = Object.values(getState().cards).filter(c => c.zone==='battlefield'
  && inRect(c.x/100*BOARD_W, c.y/100*BOARD_H, marqueeBox)).map(c=>c.instanceId);
function tapSelected(){ appendAction('card_tap_many', { instanceIds: selection, tapped: true }); } // one DB row, readable log
// table-core: case 'untap_all': untap all controllerSeat battlefield permanents (Ctrl-U, Cockatrice).
```

### C5. Z-order + piles (virtualize)
```js
// bring-to-front on grab: el.style.zIndex = ++localTopZ; commit z with the move.
// Piles (gy/exile/library) = ONE stacked container + count badge; render only top ~5 DOM nodes (don't place 100 absolutely).
```

### C6. Attachment + target arrows
Persistent attachments (`attached_to`) render a stable line/shelf; **target arrows are ephemeral** (Broadcast, auto-expire ~2s, never persisted). Lib option: `leader-line` (CDN) — but it draws in document coords and **drifts under a CSS-transformed board**; for zoom-correctness, hand-roll one `<svg><path>` per arrow **inside** the scaled surface.
```js
// ephemeral target arrow
function fireTargetArrow(fromId,to){ broadcast('target_arrow',{from:fromId,to,by:mySeat,ttl:2000}); showArrow(fromId,to,2000); }
// persistent shelf: children sorted by attach_order render under host; server trigger keeps child x/y/z == host's.
```

### C7. Live cursors + drag-ghosts via Broadcast (throttle 50ms ≈ 20/s; do NOT use Presence.track for cursors)
```js
const channel = supabase.channel(`table:${gameId}`, { config:{ broadcast:{ self:false } } });
function throttle(fn,ms){ let t=0,p=null; return (...a)=>{ const n=Date.now();
  if(n-t>=ms){t=n;fn(...a);} else {clearTimeout(p);p=setTimeout(()=>{t=Date.now();fn(...a);},ms-(n-t));} }; }
const sendCursor    = throttle((x,y)=>channel.send({type:'broadcast',event:'cursor',payload:{seat:mySeat,x,y}}),50);
const sendDragGhost = throttle((id,x,y)=>channel.send({type:'broadcast',event:'drag_ghost',payload:{seat:mySeat,id,x,y}}),50);
window.addEventListener('pointermove', e=>{ const p=toBoardPercent(e.clientX,e.clientY); sendCursor(p.x,p.y); });
channel.on('broadcast',{event:'cursor'},({payload:p})=> p.seat!==mySeat && moveGhostCursor(p.seat,p.x,p.y))
       .on('broadcast',{event:'drag_ghost'},({payload:p})=> p.seat!==mySeat && moveCardGhost(p.id,p.x,p.y))
       .on('broadcast',{event:'target_arrow'},({payload:p})=> p.by!==mySeat && showArrow(p.from,p.to,p.ttl))
       .subscribe();
// render remote cursors with CSS transition so 20fps interpolates smoothly.
```

### C8. Optimistic apply + reconcile-by-version (through your existing `game_actions`)
```js
let state=initial, version=0; const pending=new Map();
async function appendAction(type,payload){ const cid=crypto.randomUUID();
  state=reduce(state,toCore({type,payload,clientActionId:cid})); render(state); pending.set(cid,1);   // optimistic
  const { error } = await sync.appendAction({ game_id:gameId, actor_id:myUid, action_type:type, payload, client_action_id:cid });
  if(error){ state=rebuildFromSnapshotAndRows(); render(state); pending.delete(cid); toast.error('Move failed — reverted'); } }
sync.subscribeToGame(gameId, row=>{                  // postgres_changes on game_actions
  if(pending.has(row.client_action_id)){ pending.delete(row.client_action_id); version=row.version; return; } // my echo
  if(row.version===version+1){ state=reduce(state,toCore(row)); version=row.version; render(state); }
  else if(row.version>version+1){ resyncFromRows(); } });   // gap → resync; stale → ignore
```

### C9. Token search + copy (Scryfall — all shapes live-confirmed)
```js
// search any token: t:token; double_faced_token uses card_faces (no top-level image_uris)
const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent('t:token '+q)}&unique=cards`;
const data = await fetchScryfallJson(url);                 // your existing throttled helper
const img = c => c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '';
// tokens a card makes: read all_parts where component==='token', then batch /cards/collection (≤75 identifiers)
const res = await fetch('https://api.scryfall.com/cards/collection',{method:'POST',
  headers:{'Content-Type':'application/json'}, body:JSON.stringify({identifiers: ids.map(id=>({id}))})}).then(r=>r.json());
// one-key 'x' copy: appendAction('card_clone',{from:srcId,scryfall_id,card_name,ownerSeat,x,y,is_token:true});
// Scryfall asks ~50–100ms between requests + real User-Agent; cache into card_cache.
```

### C10. Hidden zones — RESOLVED via Supabase RLS-per-subscriber [CONFIRMED-DOC]
**Key confirmation:** Supabase `postgres_changes` **re-runs RLS per-subscriber** (assumes each client's identity, drops rows that fail) — *"Realtime RLS in PostgreSQL"* blog. → **owner-only RLS on hidden-zone rows means opponents literally cannot receive your hand/library over Realtime or REST.** The §5.3 spike resolves IN FAVOR of RLS-filtered realtime; the Edge relay becomes a fallback.
```sql
-- public zones: any member; hidden zones (hand/library or face_down): owner only
create policy "members read public zones" on public.game_card_instances for select
using (public.is_game_member(game_id) and zone in ('battlefield','graveyard','exile','command','stack') and face_down=false);
create policy "owner reads hidden zones" on public.game_card_instances for select
using ((zone in ('hand','library') or face_down=true)
  and exists (select 1 from public.game_participants p
              where p.id=game_card_instances.owner_participant_id and p.profile_id=auth.uid()));
-- reveal to specific seats: add column + extend policy
alter table public.game_card_instances add column if not exists revealed_to uuid[] not null default '{}';
--   ... or auth.uid() = any(revealed_to)
-- COUNTS without identities (opponents must see "7 cards"): SECURITY DEFINER view
create or replace view public.zone_counts as
  select game_id, owner_participant_id, zone, count(*)::int n
  from public.game_card_instances where zone in ('hand','library','command') group by 1,2,3;
```
**Caveats:** (1) per-subscriber RLS = N reads per change — fine for 6 players; keep the 60fps hot path on **Broadcast** (no DB, no RLS cost). (2) **Open nuance:** plain row-level owner-only RLS is confirmed; the *column-nulling `security_invoker` VIEW* approach (to reveal partial identity) is less certain — verify in the Phase-0 spike, Edge relay as fallback. (3) v2 scale path: **broadcast-from-database** via a trigger calling `realtime.broadcast_changes('topic:'||id, ...)` on **private channels** (`config:{private:true}` + `setAuth`) gated by `realtime.messages` RLS — lets you emit public board state to `table:{id}` and per-seat secrets to `seat:{id}`.

### C11. Hand fan + pile browser
```js
// fan around bottom pivot: each card transform: translateX((i-mid)*48px) rotate((i-mid)*spreadDeg); lift on hover.
// hand is private (others see only count from zone_counts). Pile click → modal grid (reuse deck-builder draw-hand grid).
```

### C12. Reconnect / resume (snapshot + replay tail)
```js
async function resumeGame(gameId){
  const [{data:insts},{data:snap}] = await Promise.all([
    supabase.from('game_card_instances').select('*').eq('game_id',gameId),                 // RLS hides others' hidden zones
    supabase.from('game_board_snapshots').select('*').eq('game_id',gameId).order('version',{ascending:false}).limit(1).maybeSingle() ]);
  state = snap ? snap.state : stateFromInstances(insts); version = snap?.version ?? 0;
  const { data:tail } = await supabase.from('game_actions').select('*')
    .eq('game_id',gameId).gt('version',version).is('undone_at',null).order('version',{ascending:true});
  for(const row of tail||[]){ state=reduce(state,toCore(row)); version=row.version; } render(state); channel.subscribe();
}
// snapshot every ~50 actions (Edge Function ideally). undone_at filter reuses your undo model.
```

### C13. Realtime Commander Draft (Kiku's moat) — Supabase shape
```sql
create table public.draft_sessions (
  id uuid primary key default gen_random_uuid(), game_id uuid references public.games(id) on delete cascade,
  phase text default 'lobby', round int default 0, max_rounds int default 4, packages_per_round int default 1,
  round_started_at timestamptz, round_duration_sec int default 90, cut_duration_sec int default 60,
  cmd_popular_pct numeric default .4, cmd_sweet_spot_pct numeric default .4, cmd_deep_cuts_weight numeric default .2,
  banlist text default '', allow_unfinity boolean default false, bot_seats int[] default '{}',
  pool jsonb default '[]', packages jsonb default '[]');
create table public.draft_picks (id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.draft_sessions(id) on delete cascade, seat int, round int, package_id text, claimed_at timestamptz default now());
-- pool built by an Edge Function (popular/sweet-spot/deep-cuts buckets over card_cache where is_legal_commander);
-- a pg_cron/Edge tick advances round→cut→…→complete on timer; picks flow as 'draft_claim' actions (replayable).
```

### C14. Card Insights SQL (off the event log) — requires the B2 day-1 logging
```sql
-- DEAD-DRAW: drawn but rarely cast (cast ≈ move hand→stack/battlefield)
with draws as (select payload->>'card_name' card, count(*) n from game_actions where action_type='draw' group by 1),
     casts as (select payload->>'card_name' card, count(*) n from game_actions
               where action_type='card_move' and payload->>'from_zone'='hand'
                 and payload->>'to_zone' in ('stack','battlefield') group by 1)
select d.card, d.n n_drawn, coalesce(c.n,0) n_cast,
       round(1 - coalesce(c.n,0)::numeric/nullif(d.n,0),2) dead_draw_rate
from draws d left join casts c using(card) order by dead_draw_rate desc;
-- CAST-ON-CURVE needs payload->>'turn' (STAMP IT on every action). BEST-OPENING-HAND needs an 'opening_hand' action.
-- WIN-RATE-IMPACT joins "card hit battlefield in game" to match_history winner. (Full queries in Agent B report.)
```

### C15. ELO leech + power (match Playgroup so leagues compare)
```sql
-- winner leeches from each loser, scaled by rating gap (K=32)
-- delta = K*(1 - 1/(1+10^((loser.elo-winner.elo)/400)));  winner += delta; each loser -= delta
-- power = round(clamp((elo-1500)/100 + 5, 0, 10), 1);  competitive_rating from avg(winning_turn): 1-5 Comp /5-10 Casual /11+ Jank
```

---

## PART D — Consolidated data-model deltas (all agents)

**New `game_action_type` values** (union beyond integration §3/§13.10):
```
annotation_create, annotation_update, annotation_move, annotation_delete,   -- free counters + text labels (Kiku)
mana_counter,                                                               -- distinct mana pips (Kiku)
card_tap_many, bulk_move, untap_all, card_raise,                            -- marquee/batch + z (Agent C)
surveil, discard, random_discard, peek_card,                               -- library/hand (Kiku)
announce_response, announce_pass,                                          -- social priority signals (Kiku)
reveal_to, pile_create, pile_move,                                         -- per-player reveal + group-exile piles (Playgroup)
opening_hand, cast_spell,                                                  -- ANALYTICS SEEDS — log from day 1 (Playgroup)
claim_game, lobby_signup, spectator_join,                                  -- guest funnel + lobby (Playgroup)
planeswalk, planeswalk_back, roll_planar_die,                             -- Planechase (Kiku)
draft_start, draft_ready, draft_claim, draft_cut                          -- realtime draft (Kiku)
-- NOTE: cursor / drag_ghost / target_arrow / hover stay EPHEMERAL (Broadcast only) — never enum/rows.
```
**New columns:**
```
game_card_instances: revealed_to uuid[], reveal_grants jsonb, hidden_identity uuid, attach_order int,
                     is_foil bool, is_etched bool, set_code text, collector_number text, phased bool, pile_id uuid
game_participants:   playmat_url text                       -- custom playmat (Kiku)
games:               planechase_state jsonb, rng_seed text, winning_turn int, ranked bool   -- ranked=pure-tabletop opt-out
card_cache:          is_legal_commander bool                -- draft pool tiering
decks:               elo numeric, power_estimate numeric, competitive_rating text
```
**New tables:** `game_board_annotations` (counter/label/mana_counter free objects), `game_card_piles` (+ `game_card_instances.pile_id`), `draft_sessions` + `draft_picks`, `plane_sets`, `api_keys`, `deck_card_insights`, `metagame_snapshots`; **`zone_counts` VIEW** + (optional) `game_card_instances_visible` VIEW that clients subscribe to instead of the base table.

---

## PART E — Decisions resolved & open risks

**Resolved / recommended:**
1. **Hidden info:** RLS-per-subscriber on `postgres_changes` is confirmed → ship RLS-filtered realtime; Edge relay = fallback; keep hot path on Broadcast.
2. **Transport:** stay on **Supabase** (not Colyseus/PartyKit) — confirmed sufficient; v2 scale path = broadcast-from-DB on private channels.
3. **Interaction model:** adopt **Kiku hover + single-key** as primary (keymap A2); right-click menu as discoverable fallback.
4. **Board layout:** **single pan/zoom shared plane** w/ per-seat playmat regions (scales to 8) over fixed seat panels.
5. **Renderer:** **DOM first** (no-build), **PixiJS-via-CDN escape hatch** for 8×100-card perf — prototype an 8-player stress test early.
6. **Interaction layer:** **hand-roll** camera/drag/marquee/arrows (virtualtabletop proves it; no-build libs are React-only or fight %-coords). Lean on Supabase + Scryfall (in-stack) for infra.
7. **Analytics:** stamp `turn` + emit `opening_hand`/`cast_spell` **from day 1** (no backfill).

**Open risks:** (a) arrow drift under zoom (hand-roll SVG inside surface); (b) per-subscriber RLS cost at high spectator fan-out (→ broadcast-from-DB); (c) touch/iOS pinch+drag needs explicit 2-touch math; (d) server-authoritative shuffle/RNG must land (Untap's honor-system gap is what we beat); (e) ELO formulas are reverse-engineered (tune vs real data); (f) Scryfall image caching/ToS at scale; (g) voice = real WebRTC + TURN cost (Playgroup has it, Kiku doesn't); (h) Playgroup Live is beta — re-scrape `/posts` mid-build (2HG, chess-clock, offline mode incoming).

**Recommended manual follow-up:** watch the two Kiku tutorials (UberGuitarDude `QJEqKZZ42K4` / `dTlWUD9yDgk`) to close gaps on exact draft pack structure, spectator read-scope, and `turnBased` mode (transcripts weren't server-fetchable).

---

## PART F — Sources
**Kiku:** [kiku.gg](https://www.kiku.gg/) · shipped bundle `play.kiku.gg/assets/index-*.js` (primary) · [MTG Wiki: Kiku](https://mtg.fandom.com/wiki/Kiku) · tutorials [QJEqKZZ42K4](https://www.youtube.com/watch?v=QJEqKZZ42K4)/[dTlWUD9yDgk](https://www.youtube.com/watch?v=dTlWUD9yDgk).
**Playgroup Live:** [/playgroup-live](https://playgroup.gg/playgroup-live) · [/playtest](https://playgroup.gg/playtest) · [/for-communities](https://playgroup.gg/playgroup-live/for-communities) · [/faqs](https://playgroup.gg/faqs) · [/metagame](https://playgroup.gg/metagame) · [/commanders](https://playgroup.gg/commanders).
**Implementation:** [virtualtabletop](https://github.com/ArnoldSmith86/virtualtabletop) · [Steve Ruiz — Zoom UI](https://www.steveruiz.me/posts/zoom-ui) · [Supabase Realtime](https://supabase.com/docs/guides/realtime) + [RLS-in-Realtime blog](https://supabase.com/blog/realtime-row-level-security-in-postgresql) · [Scryfall API](https://scryfall.com/docs/api) · [Cockatrice](https://github.com/Cockatrice/Cockatrice) · [TableCommander](https://tablecommander.com/) · [Untap.in](https://untap.in/) · [mtgnode](https://github.com/Yomguithereal/mtgnode) · [leader-line](https://github.com/anseki/leader-line).

---

## PART G — Final UI/art/QA pass (5-agent, 2026-06-22): paste-in artifacts

### G1. Kiku in-game palette + 6 land themes (CSS vars, [CONFIRMED-JS bundle])
Paste into `styles.css`; render the board + panels entirely off these vars. Theme picker = `document.documentElement.dataset.theme = id` + persist to localStorage. (~80% of "looks like Kiku" for free.)
```css
:root{ /* default "Wastes" */
  --bg-primary:#111827; --bg-secondary:#1f2937; --bg-tertiary:#374151; --bg-quaternary:#4b5563;
  --text-primary:#fff; --text-secondary:#d1d5db; --text-muted:#9ca3af; --text-faint:#6b7280;
  --border-primary:#4b5563; --border-secondary:#374151;
  --accent-blue:#3b82f6; --accent-green:#22c55e; --accent-red:#dc2626; --accent-purple:#9333ea; --accent-yellow:#facc15;
  --canvas-bg:#1a1a2e; --playmat-bg:#2d3748; --playmat-border:#4a5568; --playmat-panel-bg:rgba(0,0,0,.7);
  --card-bg:#374151; --card-border:#6b7280; --card-hover-glow:#60a5fa; --card-controlled-border:#ed8936;
  --life-normal:#fff; --life-warning:#ff6b6b; --zone-library:#718096; --zone-graveyard:#f56565; --zone-exile:#9f7aea;
}
[data-theme=plains]  { --bg-primary:#1a1a1a; --accent-blue:#f5f5dc; }
[data-theme=island]  { --bg-primary:#0a1628; --accent-blue:#5b9bd5; --canvas-bg:#0a1628; }
[data-theme=swamp]   { --bg-primary:#0a0812; --accent-blue:#9d4edd; }
[data-theme=mountain]{ --bg-primary:#1a0a0a; --accent-blue:#ef4444; }
[data-theme=forest]  { --bg-primary:#0d1a0a; --accent-blue:#5cb85c; }
/* fonts: system stack everywhere; font-mono (ui-monospace,SFMono,Menlo) for life totals/timers/decklists */
```
Playgroup's two registers: a **light** `:root` for stats/lobby chrome (teal accent, near-white bg) + the **dark `.table`** scope above; named themes (Art Deco/RPG Classic/Neoclassic RPG/Retro Pixel/Sci-Fi Pixel/Pixel RPG) reskin only `--frame/--panel-edge/--btn-bg/--accent`.

### G2. Full 16-key keymap (verbatim hint strings, [CONFIRMED-JS])
`t` Tap/Untap · `f` Flip face up/down · `a` Transform/other DFC face · `h` Return to hand · `g` To graveyard · `e` Exile · `l` To top of library · `b` To bottom of library · `c` Create counter at cursor · `x` Create token copy · `d` Draw a card · `m` Play face-down/morph · `p` Play to battlefield · `r` Announce "I have a response" · `↑` Gain 1 life · `↓` Lose 1 life · `Delete` Delete hovered counter · `Space` Announce pass turn · `Esc/Enter` Cancel/Confirm. (Dispatcher: track `hoveredId` via pointerover/out; map key→`appendAction`; `c/Delete` act on cursor/counter, `↑↓` on your life.)

### G3. Context menus (exact item order, [CONFIRMED-JS])
- **Battlefield card:** Transform · Attach to… · Clear Attachment · Return to Hand · To Graveyard · Exile · To Top of Library · To Bottom of Library · Create Token Copy · Create Counter · [+1 / −1 / Set Value / Set Type / Change Color] · Change Print… · Delete. (Tapped→"Untap".)
- **Hand card:** Place on Battlefield · Quick Play · — · Discard · Exile.
- **Empty board:** Create Token… · Create Counter · Create Mana Floater · Create Label · — · Quick Tokens: Treasure · Food · Clue · Blood.
- **Zone-viewer card (reveal/hidden duality):** To Library (Top/Bottom) · To Hand (Reveal/Hidden) · Tutor to Top (Reveal/Hidden) · To Top (Reveal/Hidden) · To Bottom (Reveal/Hidden) · To Battlefield · To Graveyard · To Sideboard · Reveal…
- **Library pile:** Draw X… · Mill… · Scry… · Surveil… · Search Library… · Look at Top… · Reveal Top · Hide Top · Exile Top… · Nth from Top… · Topdeck · Shuffle · Close & Shuffle · All to top/bottom/GY.
- **Dice:** Roll d20 (prominent) · d4/d6/d8/d10/d12 · Flip Coin.
- Render menu items as `<button class="context-menu-item">` with `min-height:44px` + `animate-slide-down .2s`; viewport-flip when `left+width>clientWidth`.

### G4. Art/printing/foil selector — code
**Print-mode fetch + finishes helper:**
```js
async function fetchCardPrints(name, mode="print"){
  const unique = mode==="art" ? "art" : "prints";              // prints = every printing (don't collapse)
  const d = await fetchScryfallJson(new URL(
    `https://api.scryfall.com/cards/search?unique=${unique}&order=released&dir=desc&q=${encodeURIComponent(`!"${name}"`)}`));
  return d.data||[];
}
const cardFinishes = c => (c.finishes?.length ? c.finishes : (c.nonfoil===false?["foil"]:["nonfoil"]));
```
**`card_setart` reducer + dispatch (multiplayer):**
```js
// table-core.js (PURE):
case "card_setart": { const set=ci=>({...ci, scryfall_id:a.scryfall_id, set_code:a.set_code,
  collector_number:a.collector_number, is_foil:!!a.is_foil, is_etched:!!a.is_etched, flipped_face:a.flipped_face??ci.flipped_face});
  return {...state, instances: state.instances.map(ci => ci.id===a.instanceId ? set(ci)
    : (a.applyToAllCopies && ci.owner_participant_id===a._ownerPid && ci.card_name===a.card_name) ? set(ci) : ci)}; }
// table.js dispatch: optimistic apply → upsertCardCache(print) → update game_card_instances cols (RLS: owner/controller)
//   → appendAction("card_setart", payload). Face art is public; on a face-down card it applies silently, shows on flip.
```
**Foil/etched CSS (client-side shimmer — Scryfall has no foil image; technique = simeydotme/pokemon-cards-css):**
```css
.card-img-wrap{position:relative;overflow:hidden}
.card-img-wrap.is-foil::after,.card-img-wrap.is-etched::after{content:"";position:absolute;inset:0;pointer-events:none;
  mix-blend-mode:color-dodge;opacity:.55;background-size:200% 200%,100% 100%;animation:foilShift 6s linear infinite;
  background:repeating-linear-gradient(115deg,#ff00cc22 0 8%,#00ffe122 8% 16%,#ffe10022 16% 24%,transparent 24% 40%),
    radial-gradient(120% 120% at var(--mx,50%) var(--my,40%),#fff5,transparent 60%)}
.card-img-wrap.is-etched::after{mix-blend-mode:overlay;opacity:.4;filter:contrast(1.2) brightness(1.1)}
@keyframes foilShift{0%{background-position:0 0,0 0}100%{background-position:200% 200%,0 0}}
```
**SQL deltas (art):**
```sql
alter table public.deck_cards add column if not exists chosen_scryfall_id uuid references public.card_cache(scryfall_id),
  add column if not exists set_code text, add column if not exists collector_number text,
  add column if not exists is_foil boolean not null default false, add column if not exists is_etched boolean not null default false,
  add column if not exists flipped_face integer not null default 0;
alter table public.game_card_instances add column if not exists is_foil boolean not null default false,
  add column if not exists is_etched boolean not null default false, add column if not exists set_code text,
  add column if not exists collector_number text;
alter table public.card_cache add column if not exists finishes text[] not null default '{}';
```
Scryfall: `unique=` counts (Lightning Bolt) cards=2 / art=29 / prints=64; exact resolve `/cards/:set/:num` or `POST /cards/collection` (≤75 ids, `{set,collector_number}` or `{name}`, returns `finishes[]`+`not_found[]`). DFC art in `card_faces[].image_uris` (no top-level). The existing deck-builder `fetchDeckCardPrints`/`renderDeckArtPicker`/`selectDeckEntryArt` are the base; current bug = `getUniqueDeckArtPrints` collapses prints→art and `normalizeCard` drops set/collector/finishes.

### G5. Bug-testing harness (no build, zero deps)
**`tests/table-core.test.html`** — pure-reducer assertions; title encodes result for agent reads:
```html
<!doctype html><meta charset=utf-8><pre id=o></pre><script src="../table-core.js"></script><script>
let p=0,f=0; const eq=(a,b,m)=>{const ok=JSON.stringify(a)===JSON.stringify(b);o.textContent+=(ok?"✅ ":"❌ ")+m+"\n";ok?p++:f++;};
const s0=MTGCore.init({seats:1}); let s=MTGCore.reduce(s0,{t:'draw',seat:0,count:7}); eq(MTGCore.zoneCount(s,0,'hand'),7,'draw7');
const a={t:'card_move',instanceId:MTGCore.firstId(s,'hand'),toZone:'battlefield',x:10,y:20};
eq(MTGCore.reduce(MTGCore.reduce(s,a),MTGCore.invert(a,s)),s,'card_move∘invert==identity');     // undo round-trip
eq(MTGCore.shuffle([1,2,3,4,5],'seed'),MTGCore.shuffle([1,2,3,4,5],'seed'),'seeded shuffle deterministic');
o.textContent+=`\n${p} passed, ${f} failed`; document.title=f?`FAIL (${f})`:`PASS (${p})`;
</script>
```
**`tests/rls_assertions.sql`** — run under two JWTs via Supabase MCP `execute_sql`:
```sql
set local request.jwt.claims='{"sub":"<B>","role":"authenticated"}';
select count(*) leaked from game_card_instances where game_id='<G>' and zone='hand'
  and owner_participant_id in (select id from game_participants where profile_id='<A>');   -- EXPECT 0
select card_name,scryfall_id from game_card_instances where game_id='<G>' and zone='battlefield' and face_down; -- EXPECT identity NULL to B
select n from zone_counts where owner_participant_id='<A_seat>' and zone='hand';            -- EXPECT 7
set local request.jwt.claims='{"sub":"<anon>","role":"authenticated"}';
insert into game_actions(game_id,actor_id,action_type,payload,client_action_id)
  values('<G>','<anon>','card_tap','{}','t1') returning id;                                  -- EXPECT success (guest FK)
```
Run order for migrations: `schema.sql → deck_builder.sql → tabletop.sql`; `tabletop.sql` uses `drop policy if exists`+`create policy` (not `alter policy`).

---

*Three research agents (Kiku teardown, Playgroup Live consolidation, code-pattern harvest) + a 5-agent final UI/art/QA pass → synthesized by the master thread, 2026-06-22. No live multiplayer playtest was possible; findings are source-grounded as tagged. Part G = paste-in build artifacts.*
