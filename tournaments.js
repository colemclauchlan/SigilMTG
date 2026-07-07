/* tournaments.js — Tournaments: list, create, detail (players/rounds/pairings), join, generate round
   (ported from the React /tournaments page + lib/tournaments.ts). Classic script, defensive queries.
   Tables: tournaments, tournament_players, tournament_rounds, tournament_pairings (shared Supabase). */
(function () {
  "use strict";
  function client() { return (window.mtgGetClient && window.mtgGetClient()) || null; }
  function session() { return (window.mtgSync && window.mtgSync.session) || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safe(p) { return p.then(function (r) { return r && r.error ? null : (r ? r.data : null); }, function () { return null; }); }

  var state = { mode: "list", id: null };

  async function fetchTournaments() {
    return (await safe(client().from("tournaments").select("*").order("created_at", { ascending: false }).limit(50))) || [];
  }
  async function fetchDetail(id) {
    var t = await safe(client().from("tournaments").select("*").eq("id", id).single());
    if (!t) return null;
    // NOTE: profile_id FKs to auth.users, so a PostgREST profiles(...) embed 400s silently.
    // Fetch players plain, then look profiles up by id in a second query.
    var players = (await safe(client().from("tournament_players").select("tournament_id, profile_id, seed, dropped").eq("tournament_id", id).order("seed", { ascending: true }))) || [];
    var pids = players.map(function (p) { return p.profile_id; });
    var profs = pids.length ? ((await safe(client().from("profiles").select("id, display_name, elo").in("id", pids))) || []) : [];
    var pmap = {}; profs.forEach(function (pr) { pmap[pr.id] = pr; });
    players = players.map(function (p) { var pr = pmap[p.profile_id] || {}; return { profile_id: p.profile_id, seed: p.seed, dropped: p.dropped, display_name: pr.display_name || null, elo: pr.elo }; });
    var rounds = (await safe(client().from("tournament_rounds").select("*").eq("tournament_id", id).order("round_no", { ascending: true }))) || [];
    // Load all rounds' pairings in one query (globally table_no-ordered) instead of one per round (N+1).
    if (rounds.length) {
      var rids = rounds.map(function (r) { return r.id; });
      var allPairings = (await safe(client().from("tournament_pairings").select("*").in("round_id", rids).order("table_no", { ascending: true }))) || [];
      var grouped = {};
      allPairings.forEach(function (p) { (grouped[p.round_id] = grouped[p.round_id] || []).push(p); }); // encounter-order preserves table_no
      rounds.forEach(function (r) { r.pairings = grouped[r.id] || []; });
    }
    t.players = players; t.rounds = rounds;
    return t;
  }
  async function createTournament(name, format) {
    var s = session(); if (!s) return null;
    return await safe(client().from("tournaments").insert({ name: name, format: format, bracket_cap: 8, status: "open", owner_id: s.user.id }).select().single());
  }
  async function joinTournament(id) {
    var s = session(); if (!s) return false;
    // An upsert without .select() returns null data on success — only a returned error means failure.
    var r = await client().from("tournament_players").upsert({ tournament_id: id, profile_id: s.user.id, dropped: false }, { onConflict: "tournament_id,profile_id" }).then(function (x) { return x; }, function () { return { error: true }; });
    return !(r && r.error);
  }
  function mkPair(roundId, tableNo, a, b) { return { round_id: roundId, table_no: tableNo, player_ids: [a, b], winner_profile_id: null, reported: false }; }
  // Result codes: false = nothing generated; "unreported" = finish current round first; "done" = champion decided (single-elim).
  async function generateRound(id, format) {
    // Gather prior rounds + pairings to know winners/losers and already-played matchups.
    var priorRounds = (await safe(client().from("tournament_rounds").select("id, round_no").eq("tournament_id", id).order("round_no", { ascending: true }))) || [];
    var next = ((priorRounds.length && priorRounds[priorRounds.length - 1].round_no) || 0) + 1;
    var priorPairings = [];
    if (priorRounds.length) {
      var rids = priorRounds.map(function (r) { return r.id; });
      priorPairings = (await safe(client().from("tournament_pairings").select("*").in("round_id", rids))) || [];
    }
    // Must finish (report) the current round before generating the next one.
    if (priorPairings.some(function (p) { return (p.player_ids || []).length === 2 && !p.reported; })) return "unreported";

    var lost = {}, playedPairs = {}, winCount = {};
    priorPairings.forEach(function (p) {
      var ids = p.player_ids || [];
      if (ids.length === 2) playedPairs[[ids[0], ids[1]].slice().sort().join("|")] = true;
      if (p.reported && p.winner_profile_id) {
        winCount[p.winner_profile_id] = (winCount[p.winner_profile_id] || 0) + 1;
        if (ids.length === 2) ids.forEach(function (pid) { if (pid !== p.winner_profile_id) lost[pid] = true; });
      }
    });

    var players = (await safe(client().from("tournament_players").select("profile_id, seed").eq("tournament_id", id).eq("dropped", false).order("seed", { ascending: true }))) || [];

    // single_elim: only players who have never lost advance. swiss: everyone active, ordered by standings.
    var pool;
    if (format === "single_elim") pool = players.filter(function (p) { return !lost[p.profile_id]; });
    else pool = players.slice().sort(function (a, b) { return (winCount[b.profile_id] || 0) - (winCount[a.profile_id] || 0) || a.seed - b.seed; });

    if (pool.length < 2) return priorRounds.length ? "done" : "need2"; // champion decided, or not enough players yet

    var round = await safe(client().from("tournament_rounds").insert({ tournament_id: id, round_no: next }).select().single());
    if (!round) return false;

    var active = pool.slice(), bye = null;
    if (active.length % 2 !== 0) { bye = active[active.length - 1].profile_id; active.pop(); }

    var pairings = [];
    if (format === "single_elim") {
      for (var i = 0; i < active.length / 2; i++) pairings.push(mkPair(round.id, pairings.length + 1, active[i].profile_id, active[active.length - 1 - i].profile_id));
    } else {
      // swiss: greedy pairing down the standings, skipping rematches when a fresh opponent exists.
      var remaining = active.map(function (p) { return p.profile_id; });
      while (remaining.length >= 2) {
        var a = remaining.shift(), oppIdx = -1;
        for (var k = 0; k < remaining.length; k++) { if (!playedPairs[[a, remaining[k]].slice().sort().join("|")]) { oppIdx = k; break; } }
        if (oppIdx < 0) oppIdx = 0; // everyone already played — accept the rematch
        var b = remaining.splice(oppIdx, 1)[0];
        pairings.push(mkPair(round.id, pairings.length + 1, a, b));
      }
    }
    if (bye) pairings.push({ round_id: round.id, table_no: pairings.length + 1, player_ids: [bye], winner_profile_id: bye, reported: true });
    if (pairings.length) await safe(client().from("tournament_pairings").insert(pairings));
    await safe(client().from("tournaments").update({ status: "active" }).eq("id", id));
    return true;
  }

  async function reportResult(pairingId, winnerId) {
    return (await safe(client().from("tournament_pairings").update({ winner_profile_id: winnerId, reported: true }).eq("id", pairingId))) !== null;
  }
  async function finishTournament(id) {
    return (await safe(client().from("tournaments").update({ status: "complete" }).eq("id", id))) !== null;
  }
  async function dropSelf(id) {
    var s = session(); if (!s) return false;
    return (await safe(client().from("tournament_players").update({ dropped: true }).eq("tournament_id", id).eq("profile_id", s.user.id))) !== null;
  }
  // Win/loss tally across all reported pairings → standings (used in the detail view).
  function computeStandings(d) {
    var rec = {};
    (d.players || []).forEach(function (p) { rec[p.profile_id] = { id: p.profile_id, name: p.display_name || "Player", w: 0, l: 0, dropped: p.dropped }; });
    (d.rounds || []).forEach(function (r) {
      (r.pairings || []).forEach(function (p) {
        if (!p.reported || !p.winner_profile_id) return;
        var ids = p.player_ids || [];
        ids.forEach(function (id) { if (!rec[id]) return; if (id === p.winner_profile_id) rec[id].w++; else if (ids.length > 1) rec[id].l++; });
      });
    });
    return Object.keys(rec).map(function (k) { return rec[k]; }).sort(function (a, b) { return (b.w - b.l) - (a.w - a.l) || b.w - a.w; });
  }

  function msg(t) { return '<div class="svc-page"><p class="svc-empty">' + esc(t) + "</p></div>"; }
  var STATUS_COLOR = { open: "#46b277", active: "#4aa3e6", complete: "#9aa6b8" };

  async function renderList(root) {
    root.innerHTML = msg("Loading tournaments…");
    var list = await fetchTournaments();
    var signedIn = !!session();
    var createBox = signedIn ?
      '<div style="display:flex;gap:8px;margin-bottom:20px"><input id="tNewName" class="svc-input" placeholder="New tournament name" style="flex:1" /><select id="tNewFmt" class="svc-select"><option value="swiss">Swiss</option><option value="single_elim">Single elim</option></select><button id="tCreate" class="svc-btn">Create</button></div>'
      : '<p style="color:#9aa6b8;margin-bottom:16px">Sign in (top-right) to create or join a tournament.</p>';
    var rows = list.length ? list.map(function (t) {
      return '<button class="t-row" data-id="' + esc(t.id) + '" style="display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#f3f6fb;cursor:pointer;margin-bottom:8px">' +
        '<span><strong>' + esc(t.name || "Untitled") + '</strong><span style="color:#6f7d92;font-size:12px;margin-left:8px">' + esc(t.format || "swiss") + "</span></span>" +
        '<span style="color:' + (STATUS_COLOR[t.status] || "#9aa6b8") + ';font-size:12px;text-transform:uppercase;font-weight:700">' + esc(t.status || "open") + "</span></button>";
    }).join("") : '<p style="color:#6f7d92;padding:20px;text-align:center">No tournaments yet — create one to get started.</p>';
    root.innerHTML = '<div class="svc-page"><div class="svc-head"><div class="svc-head-tt"><span class="svc-eyebrow">Organized play</span><h2 class="svc-title">Tournaments</h2></div></div>' + createBox + rows + "</div>";
    var c = root.querySelector("#tCreate");
    if (c) c.addEventListener("click", async function () {
      var name = (root.querySelector("#tNewName").value || "").trim(); if (!name) return;
      c.disabled = true; c.textContent = "…";
      var t = await createTournament(name, root.querySelector("#tNewFmt").value);
      if (t) { state.mode = "detail"; state.id = t.id; render(); } else { c.disabled = false; c.textContent = "Create"; }
    });
    Array.prototype.forEach.call(root.querySelectorAll(".t-row"), function (b) { b.addEventListener("click", function () { state.mode = "detail"; state.id = b.dataset.id; render(); }); });
  }

  async function renderDetail(root) {
    root.innerHTML = msg("Loading…");
    var d = await fetchDetail(state.id);
    if (!d) { root.innerHTML = msg("Tournament not found.") + backBtnHtml(); wireBack(root); return; }
    var s = session();
    var isOwner = s && d.owner_id === s.user.id;
    var nameOf = {}; (d.players || []).forEach(function (p) { nameOf[p.profile_id] = p.display_name || (p.profile_id || "").slice(0, 6); });
    var playersHtml = (d.players && d.players.length) ? d.players.map(function (p, i) {
      return '<div style="display:flex;justify-content:space-between;padding:6px 10px;color:#c7d1de;border-bottom:1px solid rgba(255,255,255,0.05)' + (p.dropped ? ';opacity:0.5;text-decoration:line-through' : '') + '"><span>' + (i + 1) + ". " + esc(p.display_name || "Player") + "</span><span style='color:#6f7d92'>ELO " + (p.elo || "—") + "</span></div>";
    }).join("") : '<p style="color:#6f7d92;padding:10px">No players yet.</p>';
    var canReport = isOwner && d.status === "active";
    var roundsHtml = (d.rounds && d.rounds.length) ? d.rounds.map(function (r) {
      var pr = (r.pairings || []).map(function (p) {
        var ids = p.player_ids || [];
        var label = ids.length > 1 ? (esc(nameOf[ids[0]] || "P1") + " vs " + esc(nameOf[ids[1]] || "P2")) : (esc(nameOf[ids[0]] || "Player") + " (bye)");
        var win = p.winner_profile_id ? ' · <span style="color:#f6c453">winner: ' + esc(nameOf[p.winner_profile_id] || "?") + "</span>" : "";
        var report = "";
        if (canReport && !p.reported && ids.length > 1) {
          report = '<div style="display:flex;gap:6px;margin:3px 0 6px 12px">' +
            '<button class="t-report" data-pid="' + esc(p.id) + '" data-win="' + esc(ids[0]) + '" style="font-size:11px;padding:2px 8px;border-radius:6px;border:1px solid rgba(70,178,119,.5);background:rgba(70,178,119,.12);color:#7be0a8;cursor:pointer">' + esc(nameOf[ids[0]] || "P1") + " won</button>" +
            '<button class="t-report" data-pid="' + esc(p.id) + '" data-win="' + esc(ids[1]) + '" style="font-size:11px;padding:2px 8px;border-radius:6px;border:1px solid rgba(70,178,119,.5);background:rgba(70,178,119,.12);color:#7be0a8;cursor:pointer">' + esc(nameOf[ids[1]] || "P2") + " won</button></div>";
        }
        return '<div style="padding:4px 10px;color:#c7d1de;font-size:13px">Table ' + (p.table_no || "?") + ": " + label + win + report + "</div>";
      }).join("");
      return '<div style="margin-bottom:10px"><strong style="color:#4aa3e6">Round ' + (r.round_no || "?") + "</strong>" + pr + "</div>";
    }).join("") : '<p style="color:#6f7d92;padding:10px">No rounds yet.</p>';

    // Standings (win-loss) once any result is reported.
    var standings = computeStandings(d);
    var anyReported = (d.rounds || []).some(function (r) { return (r.pairings || []).some(function (p) { return p.reported && p.winner_profile_id; }); });
    var standingsHtml = anyReported ? '<div style="margin-top:18px"><h3 style="color:#f3f6fb;margin:0 0 6px">Standings</h3><div style="border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08)">' +
      standings.map(function (r, i) { return '<div style="display:flex;justify-content:space-between;padding:6px 10px;color:#c7d1de;border-bottom:1px solid rgba(255,255,255,0.05)' + (r.dropped ? ';opacity:0.5' : '') + '"><span>' + (i + 1) + ". " + esc(r.name) + "</span><span style='color:#6f7d92'>" + r.w + "–" + r.l + "</span></div>"; }).join("") +
      "</div></div>" : "";

    var actions = "";
    if (s) {
      var joined = (d.players || []).some(function (p) { return p.profile_id === s.user.id && !p.dropped; });
      if (!joined && d.status === "open") actions += '<button id="tJoin" style="height:34px;padding:0 14px;border-radius:8px;border:none;background:#46b277;color:#04101f;font-weight:700;cursor:pointer">Join</button>';
      if (joined && !isOwner && d.status !== "complete") actions += ' <button id="tDrop" style="height:34px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,120,120,.4);background:rgba(255,120,120,.12);color:#ff9a9a;font-weight:700;cursor:pointer">Drop</button>';
      if (isOwner && d.status !== "complete") actions += ' <button id="tGenRound" style="height:34px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:#4aa3e6;color:#04101f;font-weight:700;cursor:pointer">Generate round</button>';
      if (isOwner && d.status === "active") actions += ' <button id="tFinish" style="height:34px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:#dbe4f3;font-weight:700;cursor:pointer">Finish tournament</button>';
    }
    root.innerHTML = '<div class="svc-page">' + backBtnHtml() +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 16px"><h2 style="color:#f3f6fb;font-size:22px">' + esc(d.name || "Tournament") + '</h2><span style="color:' + (STATUS_COLOR[d.status] || "#9aa6b8") + ';text-transform:uppercase;font-weight:700;font-size:12px">' + esc(d.status || "open") + " · " + esc(d.format || "swiss") + "</span></div>" +
      '<div style="margin-bottom:12px">' + actions + "</div>" +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px"><div><h3 style="color:#f3f6fb;margin:0 0 6px">Players</h3><div style="border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08)">' + playersHtml + "</div></div>" +
      '<div><h3 style="color:#f3f6fb;margin:0 0 6px">Rounds</h3><div style="border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:4px 0">' + roundsHtml + "</div></div></div>" + standingsHtml + "</div>";
    wireBack(root);
    var jb = root.querySelector("#tJoin");
    if (jb) jb.addEventListener("click", async function () {
      jb.disabled = true; jb.textContent = "…";
      var ok = await joinTournament(state.id);
      if (!ok) { jb.disabled = false; jb.textContent = "Couldn't join — try again"; setTimeout(function () { jb.textContent = "Join"; }, 2200); return; }
      render();
    });
    var gb = root.querySelector("#tGenRound");
    if (gb) gb.addEventListener("click", async function () {
      gb.disabled = true; gb.textContent = "…";
      var res = await generateRound(state.id, d.format || "swiss");
      if (res === "unreported") { gb.disabled = false; gb.textContent = "Report all results first"; setTimeout(function () { gb.textContent = "Generate round"; }, 2200); return; }
      if (res === "done") { gb.disabled = false; gb.textContent = "Champion decided"; setTimeout(function () { gb.textContent = "Generate round"; }, 2200); return; }
      if (res === "need2") { gb.disabled = false; gb.textContent = "Need at least 2 players"; setTimeout(function () { gb.textContent = "Generate round"; }, 2200); return; }
      if (!res) { gb.disabled = false; gb.textContent = "Couldn't generate — try again"; setTimeout(function () { gb.textContent = "Generate round"; }, 2200); return; }
      render();
    });
    var db = root.querySelector("#tDrop");
    if (db) db.addEventListener("click", async function () { db.disabled = true; db.textContent = "…"; await dropSelf(state.id); render(); });
    var fb = root.querySelector("#tFinish");
    if (fb) fb.addEventListener("click", async function () { fb.disabled = true; fb.textContent = "…"; await finishTournament(state.id); render(); });
    Array.prototype.forEach.call(root.querySelectorAll(".t-report"), function (b) {
      b.addEventListener("click", async function () { b.disabled = true; await reportResult(b.dataset.pid, b.dataset.win); render(); });
    });
  }
  function backBtnHtml() { return '<button id="tBack" style="background:none;border:none;color:#4aa3e6;cursor:pointer;font-size:13px;padding:0">‹ All tournaments</button>'; }
  function wireBack(root) { var b = root.querySelector("#tBack"); if (b) b.addEventListener("click", function () { state.mode = "list"; state.id = null; render(); }); }

  var busy = false;
  function render() {
    var root = document.querySelector("#tournamentsRoot");
    if (!root) return;
    if (!client()) { root.innerHTML = msg("Online features need Supabase."); return; }
    if (busy) return; busy = true;
    var done = function () { busy = false; };
    (state.mode === "detail" ? renderDetail(root) : renderList(root)).then(done, done);
  }
  document.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest('[data-page-target="tournaments"]'); if (t) { state.mode = "list"; setTimeout(render, 40); } });
  window.addEventListener("mtg-page-changed", function (e) { if (e && e.detail && e.detail.page === "tournaments") render(); });
  window.MTGTournaments = { render: render };
})();
