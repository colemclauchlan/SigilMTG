/* watch.js — Watch: live games + replays + read-only LIVE spectator + VOD (ported from the React
   Watch / ReplayList / SpectatorView / Replay pages). Classic script, defensive queries.
   Live mirror reads PUBLIC games only — RLS (20260702010000_public_spectate_read.sql) lets anon+auth
   SELECT games/participants/counters/commander_damage/actions/dice for visibility='public', and
   game_card_instances EXCLUDING zone in ('hand','library') and face-down cards (those rows never come
   back, so we never try to show them — opponents' hidden zones are simply absent).
   Tables: games, game_participants, game_card_instances, game_counters, commander_damage, game_actions,
   dice_rolls, match_replays (players/intent_log/winner_seat/created_at). */
(function () {
  "use strict";
  function client() { return (window.mtgGetClient && window.mtgGetClient()) || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safe(p) { return p.then(function (r) { return r && r.error ? null : (r ? r.data : null); }, function () { return null; }); }
  function relDate(iso) { if (!iso) return ""; var d = (Date.now() - new Date(iso).getTime()) / 1000; if (d < 60) return "just now"; if (d < 3600) return Math.floor(d / 60) + "m ago"; if (d < 86400) return Math.floor(d / 3600) + "h ago"; return Math.floor(d / 86400) + "d ago"; }
  function arr(v) { if (Array.isArray(v)) return v; if (typeof v === "string") { try { var p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (e) { return []; } } return []; }

  // ---- Scryfall image from a scryfall_id UUID (same CDN pattern table.js uses; front face) ----
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function scryImg(id, size) {
    if (!id || !UUID_RE.test(String(id))) return "";
    var s = String(id).toLowerCase();
    return "https://cards.scryfall.io/" + (size || "normal") + "/front/" + s.charAt(0) + "/" + s.charAt(1) + "/" + s + ".jpg";
  }
  // Lazy identity cache for scryfall ids we only know by uuid (art fallback via API), tiny + de-duped.
  var artCache = {}, artPending = {};
  function lazyArt(id, cb) {
    if (!id || !UUID_RE.test(String(id))) return;
    if (artCache[id]) { cb(artCache[id]); return; }
    if (artPending[id]) { artPending[id].push(cb); return; }
    artPending[id] = [cb];
    fetch("https://api.scryfall.com/cards/" + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (j) {
      var img = (j && j.image_uris && (j.image_uris.normal || j.image_uris.large || j.image_uris.small)) ||
        (j && j.card_faces && j.card_faces[0] && j.card_faces[0].image_uris && j.card_faces[0].image_uris.normal) || "";
      if (img) artCache[id] = img;
      (artPending[id] || []).forEach(function (f) { try { f(img); } catch (e) {} });
      artPending[id] = null;
    }, function () { artPending[id] = null; });
  }

  var state = { mode: "list", replayId: null, gameId: null, gameName: "" };

  // ---- list queries ----
  // Public live games readable by anon+auth now (spectate RLS) — no sign-in gate.
  async function fetchLiveGames() {
    var c = client(); if (!c) return null;
    var q = c.from("games").select("*").eq("visibility", "public").is("completed_at", null).order("created_at", { ascending: false }).limit(30);
    var data = await safe(q);
    // Older client/schema without visibility column → fall back to an unfiltered read so the tab still shows something.
    if (data === null) data = await safe(c.from("games").select("*").order("created_at", { ascending: false }).limit(30));
    return data || [];
  }
  async function fetchReplays() { var c = client(); if (!c) return []; return (await safe(c.from("match_replays").select("id, game_id, players, winner_seat, created_at, intent_log").order("created_at", { ascending: false }).limit(30))) || []; }
  async function fetchReplay(id) { var c = client(); if (!c) return null; return await safe(c.from("match_replays").select("*").eq("id", id).single()); }

  // ---- live-mirror queries (all gated by public RLS server-side) ----
  async function fetchGame(id) { var c = client(); if (!c) return null; return await safe(c.from("games").select("*").eq("id", id).maybeSingle()); }
  async function fetchMirror(id) {
    var c = client(); if (!c) return null;
    var _m = await Promise.all([
      safe(c.from("game_participants").select("*").eq("game_id", id).order("seat_index")),
      safe(c.from("game_card_instances").select("*").eq("game_id", id)),          // RLS: no hand/library/face-down rows
      safe(c.from("game_counters").select("*").eq("game_id", id)),
      safe(c.from("commander_damage").select("*").eq("game_id", id)),
      safe(c.from("game_actions").select("action_type,payload,actor_id,created_at").eq("game_id", id).order("created_at", { ascending: false }).limit(40)),
    ]);
    return { participants: _m[0] || [], instances: _m[1] || [], counters: _m[2] || [], cmdDamage: _m[3] || [], actions: _m[4] || [] };
  }

  function msg(t) { return '<p class="svc-empty">' + esc(t) + "</p>"; }

  // ================= LIST =================
  async function renderList(root) {
    root.innerHTML = msg("Loading…");
    var _wl = await Promise.all([fetchLiveGames(), fetchReplays()]); // independent reads → parallel
    var games = _wl[0], replays = _wl[1];

    var gamesHtml = (games === null) ? msg("Online features need Supabase.") : games.length ? games.map(function (g) {
      var n = (g.player_count != null) ? g.player_count : (arr(g.players).length || "?");
      var live = (g.status === "active" || g.status == null) && !g.completed_at;
      return '<button class="watch-live-row" data-gid="' + esc(g.id) + '" data-gname="' + esc(g.name || "") + '" style="display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#f3f6fb;cursor:pointer;margin-bottom:8px">' +
        '<span style="color:#f3f6fb"><strong>' + esc(g.name || ("Game " + String(g.id || "").slice(0, 6))) + '</strong>' + (g.bracket ? ' <span style="color:#6f7d92;font-size:12px">B' + esc(g.bracket) + "</span>" : "") + '</span>' +
        '<span style="color:' + (live ? "#46b277" : "#6f7d92") + ';font-size:12px;font-weight:700">' + (live ? "● LIVE" : esc(g.status || "open")) + " · " + n + "p ‹watch›</span></button>";
    }).join("") : msg("No public games to watch right now — host one from the Play tab and invite a friend.");

    var repHtml = replays.length ? replays.map(function (r) {
      var players = arr(r.players), actions = arr(r.intent_log);
      return '<button class="rep-row" data-id="' + esc(r.id) + '" style="display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#f3f6fb;cursor:pointer;margin-bottom:8px">' +
        '<span><strong>Replay ' + esc(String(r.id || "").slice(0, 6)) + '</strong> <span style="color:#6f7d92;font-size:12px">' + players.length + " players · " + actions.length + " actions</span></span>" +
        '<span style="color:#6f7d92;font-size:12px">' + (r.winner_seat != null ? "winner: seat " + esc(r.winner_seat) + " · " : "") + esc(relDate(r.created_at)) + "</span></button>";
    }).join("") : msg("No saved replays yet — finished online games will appear here to re-watch.");

    root.innerHTML =
      '<div class="svc-page">' +
        '<div class="svc-head"><div class="svc-head-tt"><span class="svc-eyebrow">Spectate</span><h2 class="svc-title">Watch</h2></div></div>' +
        '<p class="svc-section" style="margin-top:0">Live games</p>' + gamesHtml +
        '<p class="svc-section">Replays</p>' + repHtml +
      "</div>";
    Array.prototype.forEach.call(root.querySelectorAll(".watch-live-row"), function (b) {
      b.addEventListener("click", function () { state.mode = "live"; state.gameId = b.dataset.gid; state.gameName = b.dataset.gname || ""; render(); });
    });
    Array.prototype.forEach.call(root.querySelectorAll(".rep-row"), function (b) { b.addEventListener("click", function () { state.mode = "vod"; state.replayId = b.dataset.id; render(); }); });
  }

  // ================= LIVE MIRROR =================
  var liveTimer = null, liveChannel = null, liveGen = 0;
  function stopLive() {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    if (liveChannel) { try { var c = client(); if (c && c.removeChannel) c.removeChannel(liveChannel); } catch (e) {} liveChannel = null; }
    liveGen++;
  }

  function partMap(participants) { var m = {}; participants.forEach(function (p) { m[p.id] = p; m["seat:" + p.seat_index] = p; }); return m; }

  // Poison/energy/exp/rad/other player counter → icon (Material Symbols); life is shown separately.
  var CTR_ICON = { poison: "coronavirus", energy: "bolt", experience: "star", rad: "radioactive", tax: "account_balance" };
  function counterBadge(key, val) {
    var ic = CTR_ICON[key] || "casino";
    return '<span class="wsp-ctr" title="' + esc(key) + '"><span class="msym">' + ic + '</span>' + esc(val) + '</span>';
  }

  function cardTile(ci, pm) {
    var tapped = !!ci.tapped;
    var img = scryImg(ci.scryfall_id, "normal");
    var name = ci.card_name || "";
    var ctrs = ci.counters && typeof ci.counters === "object" ? ci.counters : {};
    var ctrKeys = Object.keys(ctrs).filter(function (k) { return ctrs[k]; });
    var badges = ctrKeys.length ? '<span class="wsp-tile-ctrs">' + ctrKeys.map(function (k) {
      var v = ctrs[k]; var lab = (k === "p1p1" || k === "+1/+1") ? "+" + v : (k === "m1m1" || k === "-1/-1") ? "−" + Math.abs(v) : (v + "");
      return '<span class="wsp-tb" title="' + esc(k) + '">' + esc(lab) + '</span>';
    }).join("") + '</span>' : "";
    var inner;
    if (img) {
      inner = '<img loading="lazy" alt="' + esc(name) + '" src="' + esc(img) + '">';
    } else if (name) {
      inner = '<span class="wsp-tile-nm">' + esc(name) + '</span>';
    } else if (ci.scryfall_id) {
      // No card_name but we have a uuid → lazily resolve art; show a placeholder meanwhile.
      inner = '<span class="wsp-tile-nm wsp-lazy" data-sid="' + esc(ci.scryfall_id) + '">…</span>';
    } else {
      inner = '<span class="wsp-tile-nm">Card</span>';
    }
    return '<div class="wsp-tile' + (tapped ? " tapped" : "") + '" title="' + esc(name) + '">' + inner + badges + '</div>';
  }

  function seatPanel(p, ctx) {
    var seat = p.seat_index;
    var pm = ctx.pm;
    // battlefield cards this seat controls (fall back to owner if controller absent)
    var bf = ctx.instances.filter(function (ci) {
      if (ci.zone !== "battlefield") return false;
      var ctrl = ci.controller_participant_id || ci.owner_participant_id;
      return ctrl === p.id;
    });
    // pile counts derivable from public rows (graveyard/exile/command). Hand/library are hidden by RLS → omit.
    var counts = { graveyard: 0, exile: 0, command: 0 };
    ctx.instances.forEach(function (ci) {
      var own = ci.owner_participant_id;
      if (own !== p.id) return;
      if (counts[ci.zone] != null) counts[ci.zone]++;
    });
    // player counters (poison/energy/…)
    var pctrs = ctx.counters.filter(function (c) { return c.participant_id === p.id && c.value; });
    // commander damage dealt TO this seat, grouped by source commander
    var cmdIn = ctx.cmdDamage.filter(function (d) { return d.target_participant_id === p.id && d.value; });

    var art = p.commander_art_url || scryImg(p.commander_scryfall_id, "art_crop") || "";
    var dead = !!p.is_dead;
    var isActive = ctx.activeSeat === seat;

    var headStyle = "background:" + (art ? "linear-gradient(180deg,rgba(8,13,22,0.15),rgba(8,13,22,0.82)),url('" + esc(art).replace(/'/g, "%27") + "') center/cover" : "linear-gradient(180deg,#16202f,#0e1723)") + ";";

    var ctrHtml = pctrs.map(function (c) { return counterBadge(c.counter_key, c.value); }).join("");
    var cmdHtml = cmdIn.length ? '<div class="wsp-cmd">' + cmdIn.map(function (d) {
      var src = ctx.pm[d.source_participant_id];
      var who = (d.source_commander_name) || (src && src.display_name) || "Seat";
      var crit = d.value >= 21;
      return '<span class="wsp-cmd-chip' + (crit ? " crit" : "") + '" title="' + esc(who) + '"><span class="msym">swords</span>' + esc(d.value) + '</span>';
    }).join("") + '</div>' : "";

    var piles = [];
    if (counts.graveyard) piles.push('<span class="wsp-pile" title="Graveyard"><span class="msym">delete</span>' + counts.graveyard + '</span>');
    if (counts.exile) piles.push('<span class="wsp-pile" title="Exile"><span class="msym">block</span>' + counts.exile + '</span>');
    if (counts.command) piles.push('<span class="wsp-pile" title="Command zone"><span class="msym">military_tech</span>' + counts.command + '</span>');

    var tiles = bf.length ? bf.map(function (ci) { return cardTile(ci, pm); }).join("") : '<span class="wsp-bf-empty">No permanents on the battlefield.</span>';

    return '<div class="wsp-panel' + (dead ? " dead" : "") + (isActive ? " active" : "") + '">' +
      '<div class="wsp-head" style="' + headStyle + '">' +
        '<div class="wsp-head-row">' +
          '<div class="wsp-name">' + esc(p.display_name || ("Seat " + (seat + 1))) + (isActive ? ' <span class="wsp-turn" title="Active turn">●</span>' : "") + '</div>' +
          '<div class="wsp-life' + (dead ? " dead" : "") + '">' + (dead ? "DEAD" : esc(p.life_total != null ? p.life_total : 40)) + '</div>' +
        '</div>' +
        '<div class="wsp-sub">' +
          (p.commander_name ? '<span class="wsp-cmdr">' + esc(p.commander_name) + '</span>' : '<span class="wsp-cmdr wsp-cmdr-none">No commander set</span>') +
          (p.commander_tax ? '<span class="wsp-tax" title="Commander tax">+' + esc(p.commander_tax) + '</span>' : "") +
        '</div>' +
      '</div>' +
      '<div class="wsp-meta">' + ctrHtml + (piles.length ? '<span class="wsp-piles">' + piles.join("") + '</span>' : "") + '</div>' +
      cmdHtml +
      '<div class="wsp-bf">' + tiles + '</div>' +
    '</div>';
  }

  function actionLabel(a) {
    var t = (a && (a.action_type || (a.payload && a.payload.type))) || "action";
    return String(t).replace(/_/g, " ");
  }

  function renderMirror(root, game, mirror) {
    var participants = mirror.participants || [];
    var pm = partMap(participants);
    var ctx = {
      pm: pm, instances: mirror.instances || [], counters: mirror.counters || [],
      cmdDamage: mirror.cmdDamage || [], activeSeat: (game && game.active_seat_index) || 0,
    };
    var n = participants.length;
    var cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
    var panels = n ? participants.map(function (p) { return seatPanel(p, ctx); }).join("") : msg("No players in this game yet.");

    var actions = mirror.actions || [];
    var logRows = actions.length ? actions.map(function (a) {
      var who = pm[a.actor_id];
      var whoName = who ? (who.display_name || "") : "";
      return '<div class="wsp-log-row"><span class="wsp-log-act">' + esc(actionLabel(a)) + '</span>' +
        (whoName ? '<span class="wsp-log-who">' + esc(whoName) + '</span>' : "") +
        '<span class="wsp-log-t">' + esc(relDate(a.created_at)) + '</span></div>';
    }).join("") : '<div class="wsp-log-empty">No actions recorded yet.</div>';

    var back = '<button id="wspBack" class="wsp-back">‹ Back to Watch</button>';
    var title = esc((game && game.name) || state.gameName || "Live game");

    root.innerHTML =
      '<div class="svc-page wsp-page">' +
        '<div class="wsp-topbar">' + back +
          '<div class="wsp-title-wrap"><span class="wsp-badge">LIVE</span><h2 class="wsp-title">' + title + '</h2>' +
            '<span class="wsp-turnmeta">Turn ' + esc((game && game.total_turns) || 0) + '</span></div>' +
        '</div>' +
        '<div class="wsp-layout">' +
          '<div class="wsp-grid" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' + panels + '</div>' +
          '<aside class="wsp-rail"><div class="wsp-rail-head">Action log</div><div class="wsp-log">' + logRows + '</div></aside>' +
        '</div>' +
      '</div>';

    var b = root.querySelector("#wspBack");
    if (b) b.addEventListener("click", function () { stopLive(); state.mode = "list"; state.gameId = null; render(); });

    // resolve any lazy tiles (uuid-only, no card_name) via the Scryfall API cache
    Array.prototype.forEach.call(root.querySelectorAll(".wsp-lazy"), function (el) {
      var sid = el.dataset.sid;
      lazyArt(sid, function (img) {
        if (!img) return; var tile = el.parentNode; if (!tile) return;
        tile.innerHTML = '<img loading="lazy" src="' + esc(img) + '">' + (tile.querySelector ? "" : "");
      });
    });
  }

  // Live loop: initial paint, poll ~4s, and (if the client supports it) subscribe to postgres_changes
  // for the spectated game_id — purely read-only; any change just re-pulls. Falls back to polling only.
  async function renderLive(root) {
    stopLive();
    var myGen = liveGen;
    var gid = state.gameId;
    if (!gid) { state.mode = "list"; return renderList(root); }
    root.innerHTML = msg("Loading live board…");

    async function pull(first) {
      if (myGen !== liveGen) return; // superseded (navigated away / back)
      var _g = await Promise.all([fetchGame(gid), fetchMirror(gid)]);
      if (myGen !== liveGen) return;
      var game = _g[0], mirror = _g[1];
      if (!mirror || (!game && !(mirror.participants && mirror.participants.length))) {
        if (first) { root.innerHTML = '<div class="svc-page wsp-page"><button id="wspBack" class="wsp-back">‹ Back to Watch</button>' + msg("This game is not public, has ended, or is unavailable to spectate.") + '</div>'; var bb = root.querySelector("#wspBack"); if (bb) bb.addEventListener("click", function () { stopLive(); state.mode = "list"; render(); }); }
        return;
      }
      renderMirror(root, game || { id: gid, name: state.gameName }, mirror);
    }

    await pull(true);
    if (myGen !== liveGen) return;

    // realtime feature-detect: reuse web-sync's subscribeToGame pattern read-only, else poll only.
    var c = client();
    var refresh = function () { pull(false); };
    if (c && c.channel) {
      try {
        var tables = ["games", "game_participants", "game_counters", "commander_damage", "game_actions", "game_card_instances", "dice_rolls"];
        var ch = c.channel("spectate:" + gid, { config: { broadcast: { self: false } } });
        tables.forEach(function (t) {
          var filter = t === "games" ? "id=eq." + gid : "game_id=eq." + gid;
          ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: filter }, refresh);
        });
        liveChannel = ch.subscribe(function () {});
      } catch (e) { liveChannel = null; }
    }
    // Always poll too (covers realtime-disabled projects + guarantees freshness); guarded by generation.
    liveTimer = setInterval(function () { if (myGen === liveGen) pull(false); else stopLive(); }, 4000);
  }

  // ================= VOD (unchanged) =================
  async function renderVod(root) {
    root.innerHTML = msg("Loading replay…");
    var r = await fetchReplay(state.replayId);
    var back = '<button id="wBack" style="background:none;border:none;color:#4aa3e6;cursor:pointer;font-size:13px;padding:0">‹ Back to Watch</button>';
    if (!r) { root.innerHTML = '<div class="svc-page">' + back + msg("Replay unavailable.") + "</div>"; wireBack(root); return; }
    var players = arr(r.players), actions = arr(r.intent_log);
    var seats = players.map(function (p, i) { return '<span style="padding:4px 10px;border-radius:8px;background:rgba(255,255,255,0.05);color:#c7d1de;font-size:12px;margin-right:6px">Seat ' + (p.seat != null ? p.seat : i) + (r.winner_seat == (p.seat != null ? p.seat : i) ? ' <span class="msym" style="font-size:14px;margin:0;vertical-align:-2px;color:#f6c453">emoji_events</span>' : "") + "</span>"; }).join("");
    var shown = actions.slice(0, 400);
    var timeline = shown.length ? shown.map(function (a, i) {
      var label = (a && (a.type || a.action || a.kind)) || "action";
      var who = (a && (a.seat != null ? "seat " + a.seat : (a.actor != null ? a.actor : ""))) || "";
      return '<div class="vod-step" data-step="' + i + '" style="display:flex;gap:10px;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;transition:opacity .15s,background .15s"><span style="color:#6f7d92;width:42px;text-align:right">' + (i + 1) + '</span><span style="color:#4aa3e6;width:120px">' + esc(label) + '</span><span style="color:#c7d1de">' + esc(who) + "</span></div>";
    }).join("") : msg("This replay has no recorded action log.");
    var hasSteps = shown.length > 0;
    var controls = hasSteps ?
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">' +
        '<button id="vodPlay" title="Play/Pause" style="width:38px;height:34px;border-radius:8px;border:none;background:#4aa3e6;color:#04101f;cursor:pointer;display:grid;place-items:center"><span class="msym" style="margin:0">play_arrow</span></button>' +
        '<button id="vodPrev" title="Step back" style="width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#dbe4f3;cursor:pointer;display:grid;place-items:center"><span class="msym" style="margin:0;font-size:18px">skip_previous</span></button>' +
        '<button id="vodNext" title="Step forward" style="width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#dbe4f3;cursor:pointer;display:grid;place-items:center"><span class="msym" style="margin:0;font-size:18px">skip_next</span></button>' +
        '<input id="vodSeek" type="range" min="0" max="' + shown.length + '" value="0" style="flex:1;min-width:120px;accent-color:#4aa3e6" />' +
        '<span id="vodCount" style="color:#9aa6b8;font-size:12px;width:64px;text-align:right">0 / ' + shown.length + "</span>" +
        '<select id="vodSpeed" style="height:30px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:#0c1320;color:#f3f6fb"><option value="1">1×</option><option value="0.5">0.5×</option><option value="2">2×</option><option value="4">4×</option></select>' +
      "</div>" : "";
    root.innerHTML =
      '<div class="svc-page">' + back +
        '<h2 style="color:#f3f6fb;font-size:20px;margin:8px 0">Replay ' + esc(String(r.id || "").slice(0, 8)) + '</h2>' +
        '<div style="margin-bottom:14px">' + (seats || '<span style="color:#6f7d92">No seat data.</span>') + "</div>" +
        '<p style="color:#9aa6b8;font-size:12px;margin-bottom:8px">Action timeline (' + actions.length + " events) — step through the recorded game.</p>" +
        controls +
        '<div id="vodList" style="border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);max-height:52vh;overflow-y:auto">' + timeline + "</div>" +
      "</div>";
    wireBack(root);
    if (hasSteps) wirePlayback(root, shown.length);
  }

  var vodTimer = null;
  function stopPlayback() { if (vodTimer) { clearInterval(vodTimer); vodTimer = null; } }
  // Drive the VOD playhead: highlight steps up to `step`, dim the rest; play/pause/seek/speed.
  function wirePlayback(root, total) {
    stopPlayback();
    var step = 0, speed = 1;
    var rows = root.querySelectorAll(".vod-step");
    var playBtn = root.querySelector("#vodPlay"), seek = root.querySelector("#vodSeek");
    var count = root.querySelector("#vodCount"), speedSel = root.querySelector("#vodSpeed");
    function apply(n) {
      step = Math.max(0, Math.min(total, n));
      Array.prototype.forEach.call(rows, function (row) {
        var idx = parseInt(row.dataset.step, 10);
        var cur = idx === step - 1;
        row.style.opacity = idx < step ? "1" : "0.32";
        row.style.background = cur ? "rgba(74,163,230,0.16)" : "transparent";
        if (cur) row.scrollIntoView({ block: "nearest" });
      });
      if (seek) seek.value = String(step);
      if (count) count.textContent = step + " / " + total;
    }
    function setPlaying(on) {
      stopPlayback();
      playBtn.innerHTML = '<span class="msym" style="margin:0">' + (on ? "pause" : "play_arrow") + "</span>";
      if (!on) return;
      if (step >= total) apply(0);
      vodTimer = setInterval(function () {
        if (step >= total) { setPlaying(false); return; }
        apply(step + 1);
      }, 900 / speed);
    }
    playBtn.addEventListener("click", function () { setPlaying(!vodTimer); });
    root.querySelector("#vodPrev").addEventListener("click", function () { setPlaying(false); apply(step - 1); });
    root.querySelector("#vodNext").addEventListener("click", function () { setPlaying(false); apply(step + 1); });
    if (seek) seek.addEventListener("input", function () { setPlaying(false); apply(parseInt(seek.value, 10) || 0); });
    if (speedSel) speedSel.addEventListener("change", function () { speed = parseFloat(speedSel.value) || 1; if (vodTimer) setPlaying(true); });
    apply(0);
  }
  function wireBack(root) { var b = root.querySelector("#wBack"); if (b) b.addEventListener("click", function () { stopPlayback(); state.mode = "list"; state.replayId = null; render(); }); }

  var busy = false;
  function render() {
    var root = document.querySelector("#watchRoot");
    if (!root) return;
    if (!client()) { root.innerHTML = msg("Online features need Supabase."); return; }
    if (busy) return; busy = true;
    stopPlayback();
    if (state.mode !== "live") stopLive();
    var done = function () { busy = false; };
    var fn = state.mode === "vod" ? renderVod(root) : state.mode === "live" ? renderLive(root) : renderList(root);
    fn.then(done, done);
  }

  // G7.57 — external entry point (play-shell.js) for "share link opened after the game started":
  // jump straight into the live spectator mirror for a known gameId, skipping the games list. Only
  // ever succeeds for a public game (existing "public spectate read" RLS) — private games surface
  // the same honest "not public / unavailable to spectate" message renderLive() already shows.
  function openLive(gameId, gameName) {
    if (!gameId) return;
    state.mode = "live"; state.gameId = gameId; state.gameName = gameName || "";
    render();
  }

  ensureStyles();
  document.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest('[data-page-target="watch"]'); if (t) { stopLive(); state.mode = "list"; setTimeout(render, 40); } });
  // Stop live/VOD polling+subscription when the user navigates away from the Watch tab (prevents leaked timers/channels).
  window.addEventListener("mtg-page-changed", function (e) { if (!e || !e.detail) return; if (e.detail.page === "watch") { if (state.mode !== "live" && state.mode !== "vod") { state.mode = "list"; render(); } } else { stopPlayback(); stopLive(); } });
  window.MTGWatch = { render: render, openLive: openLive };

  // ---- self-injected styles (mirrors onboarding.js pattern; references .svc-* tokens from pages.css) ----
  function ensureStyles() {
    if (document.getElementById("watchSpectateStyles")) return;
    var st = document.createElement("style"); st.id = "watchSpectateStyles";
    st.textContent = [
      ".wsp-page{max-width:1180px}",
      ".wsp-topbar{display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap}",
      ".wsp-back{background:none;border:none;color:#4aa3e6;cursor:pointer;font-size:13px;padding:0}",
      ".wsp-title-wrap{display:flex;align-items:center;gap:10px}",
      ".wsp-title{color:#f3f6fb;font-size:20px;margin:0}",
      ".wsp-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.06em;color:#04101f;background:#f0555f;border-radius:6px;padding:3px 8px;animation:wspPulse 1.8s ease-in-out infinite}",
      ".wsp-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:#04101f;display:inline-block}",
      "@keyframes wspPulse{0%,100%{opacity:1}50%{opacity:.55}}",
      ".wsp-turnmeta{color:#8fa3bd;font-size:12px}",
      ".wsp-layout{display:grid;grid-template-columns:1fr 260px;gap:16px;align-items:start}",
      ".wsp-grid{display:grid;gap:14px}",
      ".wsp-panel{border:1px solid rgba(255,255,255,0.09);border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.02);display:flex;flex-direction:column;min-height:180px}",
      ".wsp-panel.active{border-color:rgba(90,160,255,.55);box-shadow:0 0 0 1px rgba(90,160,255,.35),0 8px 30px rgba(20,60,120,.25)}",
      ".wsp-panel.dead{opacity:.62;filter:grayscale(.5)}",
      ".wsp-head{padding:12px 12px 10px;position:relative}",
      ".wsp-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
      ".wsp-name{color:#f6f9ff;font-weight:700;font-size:15px;text-shadow:0 1px 4px rgba(0,0,0,.6)}",
      ".wsp-turn{color:#7be0a8;font-size:11px;vertical-align:middle}",
      ".wsp-life{font-size:26px;font-weight:800;color:#f6f9ff;line-height:1;text-shadow:0 1px 5px rgba(0,0,0,.7)}",
      ".wsp-life.dead{font-size:15px;color:#f0555f}",
      ".wsp-sub{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}",
      ".wsp-cmdr{color:#dbe4f3;font-size:12px;text-shadow:0 1px 4px rgba(0,0,0,.6)}",
      ".wsp-cmdr-none{color:#8fa3bd;font-style:italic}",
      ".wsp-tax{color:#f6c453;font-size:11px;font-weight:700;background:rgba(0,0,0,.4);border-radius:5px;padding:1px 5px}",
      ".wsp-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px 0;min-height:0}",
      ".wsp-ctr,.wsp-pile{display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:700;color:#c7d1de;background:rgba(255,255,255,.05);border-radius:6px;padding:2px 7px}",
      ".wsp-piles{display:inline-flex;gap:5px;margin-left:auto}",
      ".wsp-ctr .msym,.wsp-pile .msym,.wsp-cmd-chip .msym{font-size:15px;margin:0;vertical-align:-3px}",
      ".wsp-cmd{display:flex;flex-wrap:wrap;gap:5px;padding:8px 12px 0}",
      ".wsp-cmd-chip{display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:700;color:#ffd7a0;background:rgba(240,120,60,.14);border:1px solid rgba(240,120,60,.3);border-radius:6px;padding:2px 7px}",
      ".wsp-cmd-chip.crit{color:#04101f;background:#f0555f;border-color:#f0555f}",
      ".wsp-bf{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 12px;align-content:flex-start;flex:1}",
      ".wsp-bf-empty{color:#6f7d92;font-size:12px;font-style:italic}",
      ".wsp-tile{position:relative;width:52px;height:73px;border-radius:5px;overflow:hidden;background:#0b1320;border:1px solid rgba(255,255,255,.08);transition:transform .12s;flex:0 0 auto}",
      ".wsp-tile img{width:100%;height:100%;object-fit:cover;display:block}",
      ".wsp-tile.tapped{transform:rotate(90deg) scale(.82)}",
      ".wsp-tile-nm{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:9px;line-height:1.1;text-align:center;color:#c7d1de;padding:3px;box-sizing:border-box}",
      ".wsp-tile-ctrs{position:absolute;left:2px;bottom:2px;display:flex;gap:2px;flex-wrap:wrap}",
      ".wsp-tb{font-size:9px;font-weight:800;color:#04101f;background:#7be0a8;border-radius:3px;padding:0 3px;line-height:1.4}",
      ".wsp-rail{border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);overflow:hidden;position:sticky;top:12px;max-height:74vh;display:flex;flex-direction:column}",
      ".wsp-rail-head{padding:10px 12px;font-size:12px;font-weight:700;letter-spacing:.04em;color:#9aa6b8;border-bottom:1px solid rgba(255,255,255,.06)}",
      ".wsp-log{overflow-y:auto;flex:1}",
      ".wsp-log-row{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}",
      ".wsp-log-act{color:#8fd5ff;font-weight:600;flex:1;text-transform:capitalize;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".wsp-log-who{color:#c7d1de;font-size:11px}",
      ".wsp-log-t{color:#6f7d92;font-size:11px;white-space:nowrap}",
      ".wsp-log-empty{padding:14px 12px;color:#6f7d92;font-size:12px;font-style:italic}",
      "@media (max-width:820px){.wsp-layout{grid-template-columns:1fr}.wsp-rail{position:static;max-height:40vh}.wsp-grid{grid-template-columns:1fr 1fr!important}}",
      "@media (max-width:540px){.wsp-grid{grid-template-columns:1fr!important}}",
      "@media (prefers-reduced-motion:reduce){.wsp-badge{animation:none}.wsp-tile{transition:none}}",
    ].join("");
    document.head.appendChild(st);
  }
})();
