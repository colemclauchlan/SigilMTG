/* ranked.js — Ranked ELO leaderboard + metagame (ported from the React /ranked page).
   Classic script. Lazily queries the shared Supabase project via window.supabase when the
   Ranked tab is opened. Tables: profiles (elo/wins/losses), match_history (bracket/commander). */
(function () {
  "use strict";
  function sb() {
    if (window.mtgSync && window.mtgSync.client) return window.mtgSync.client;
    var cfg = window.MTG_SYNC_CONFIG;
    if (window.supabase && window.supabase.createClient && cfg && cfg.supabaseUrl) {
      if (!window.__mtgClient) window.__mtgClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      return window.__mtgClient;
    }
    return null;
  }
  window.mtgGetClient = sb;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function medal(i) { var col = i === 0 ? "#f6c453" : i === 1 ? "#cbd5e1" : "#d08a54"; return i <= 2 ? '<span class="msym" style="margin:0;font-size:18px;vertical-align:-4px;color:' + col + '">workspace_premium</span>' : "#" + (i + 1); }
  // ELO tiers: 1400+ elite (green), 1300–1399 strong (gold), below muted.
  function eloColor(elo) { var e = elo == null ? 1000 : elo; return e >= 1400 ? "#7be0a8" : e >= 1300 ? "#f6c453" : "#8fa3bd"; }

  var seasonDays = 0; // 0 = all-time

  async function fetchLeaderboard() {
    var res = await sb().from("profiles").select("*").limit(200);
    if (res.error) throw res.error;
    return (res.data || [])
      // Only players who have actually played — hides the wall of default 1200 "Planeswalker"
      // profiles that every fresh account creates (ranked dedupe).
      .filter(function (p) { return ((p.wins || 0) + (p.losses || 0)) > 0; })
      .sort(function (a, b) { return (b.elo || 0) - (a.elo || 0) || (b.wins || 0) - (a.wins || 0); })
      .slice(0, 50)
      .map(function (p, i) { p.rank = i + 1; return p; });
  }

  async function fetchMetagame() {
    var q = sb().from("match_history").select("*").order("created_at", { ascending: false }).limit(2000);
    if (seasonDays > 0) {
      var since = new Date(Date.now() - seasonDays * 86400000).toISOString();
      q = sb().from("match_history").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
    }
    var res = await q;
    if (res.error) throw res.error;
    var rows = res.data || [];
    var byB = {}, byC = {};
    rows.forEach(function (r) {
      var b = (r.bracket == null) ? "?" : String(r.bracket);
      byB[b] = byB[b] || { w: 0, n: 0 }; byB[b].n++; if (r.won) byB[b].w++;
      if (r.commander_name) { byC[r.commander_name] = byC[r.commander_name] || { w: 0, n: 0 }; byC[r.commander_name].n++; if (r.won) byC[r.commander_name].w++; }
    });
    var brackets = Object.keys(byB).sort().map(function (b) { return { bracket: b, games: byB[b].n, winRate: byB[b].n ? Math.round((byB[b].w / byB[b].n) * 100) : 0 }; });
    var commanders = Object.keys(byC).map(function (c) { return { name: c, games: byC[c].n, winRate: byC[c].n ? Math.round((byC[c].w / byC[c].n) * 100) : 0 }; }).sort(function (a, b) { return b.games - a.games; }).slice(0, 10);
    // 14-day activity (games per day) for a sparkline.
    var days = 14, activity = new Array(days).fill(0), now = Date.now();
    rows.forEach(function (r) {
      if (!r.created_at) return;
      var d = Math.floor((now - new Date(r.created_at).getTime()) / 86400000);
      if (d >= 0 && d < days) activity[days - 1 - d]++;
    });
    return { totalGames: rows.length, brackets: brackets, commanders: commanders, activity: activity };
  }

  function bar(pct, color) {
    return '<div style="flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,0.08);overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + color + '"></div></div>';
  }

  function buildHtml(lb, mg) {
    var cell = "padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06)";
    var rows = lb.length ? lb.map(function (e, i) {
      var w = e.wins || 0, l = e.losses || 0, g = w + l;
      var wr = g ? Math.round((w / g) * 100) : 0;
      return '<tr>' +
        '<td style="' + cell + ';width:42px">' + medal(i) + "</td>" +
        '<td style="' + cell + ';color:#f3f6fb;font-weight:600">' + esc(e.display_name || "Anonymous") + "</td>" +
        '<td style="' + cell + ';text-align:right;font-weight:700;color:' + eloColor(e.elo) + '">' + (e.elo == null ? 1000 : e.elo) + "</td>" +
        '<td style="' + cell + ';text-align:right;color:#4ade80;font-family:monospace">' + w + "</td>" +
        '<td style="' + cell + ';text-align:right;color:#f87171;font-family:monospace">' + l + "</td>" +
        '<td style="' + cell + ';text-align:right;color:#c7d1de;font-family:monospace">' + (g ? wr + "%" : "—") + "</td></tr>";
    }).join("") : '<tr><td colspan="6" style="text-align:center;color:#9aa6b8;padding:28px">No ranked players yet — play some online games.</td></tr>';

    var th = "padding:6px 10px;color:#6f7d92;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;text-align:left";
    var lbHtml =
      '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr><th style="' + th + '">#</th><th style="' + th + '">Player</th>' +
        '<th style="' + th + ';text-align:right">ELO</th><th style="' + th + ';text-align:right">W</th><th style="' + th + ';text-align:right">L</th><th style="' + th + ';text-align:right">Win%</th></tr></thead>' +
        "<tbody>" + rows + "</tbody></table>";

    var mgHtml = "";
    if (mg) {
      var maxB = Math.max.apply(null, mg.brackets.map(function (b) { return b.games; }).concat([1]));
      // 14-day activity sparkline (SVG polyline).
      var spark = "";
      if (mg.activity && mg.activity.some(function (v) { return v > 0; })) {
        var w = 220, h = 40, mx = Math.max.apply(null, mg.activity.concat([1]));
        var pts = mg.activity.map(function (v, i) { return (i / (mg.activity.length - 1) * w).toFixed(1) + "," + (h - (v / mx) * (h - 4) - 2).toFixed(1); }).join(" ");
        spark = '<div style="margin:14px 0 0"><p style="color:#9aa6b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Activity · last 14 days</p>' +
          '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" height="46" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="#4aa3e6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" /></svg></div>';
      }
      mgHtml =
        '<h3 style="color:#f3f6fb;margin:26px 0 10px">Metagame · ' + mg.totalGames + ' games</h3>' +
        spark +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' +
          '<div><p style="color:#9aa6b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Win rate by bracket</p>' +
            (mg.brackets.length ? mg.brackets.map(function (b) {
              return '<div style="display:flex;align-items:center;gap:8px;margin:6px 0;color:#c7d1de;font-size:13px"><span style="width:64px">Bracket ' + esc(b.bracket) + "</span>" + bar(b.winRate, "#4aa3e6") + '<span style="width:80px;text-align:right;color:#9aa6b8">' + b.winRate + "% (" + b.games + ")</span></div>";
            }).join("") : '<p style="color:#6f7d92">No data.</p>') + "</div>" +
          '<div><p style="color:#9aa6b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Top commanders</p>' +
            (mg.commanders.length ? mg.commanders.map(function (c) {
              return '<div style="display:flex;justify-content:space-between;margin:6px 0;color:#c7d1de;font-size:13px"><span>' + esc(c.name) + '</span><span style="color:#9aa6b8">' + c.games + " · " + c.winRate + "%</span></div>";
            }).join("") : '<p style="color:#6f7d92">No data.</p>') + "</div>" +
        "</div>";
    }

    return '<div class="svc-page">' +
      '<div class="svc-head"><div class="svc-head-tt"><span class="svc-eyebrow">Competitive</span><h2 class="svc-title">Ranked</h2></div>' +
        '<select id="rankedSeason" class="svc-select"><option value="0">All-time</option><option value="30">Last 30 days</option><option value="7">Last 7 days</option></select>' +
      "</div>" + lbHtml + mgHtml + "</div>";
  }

  var busy = false;
  async function render() {
    var root = document.querySelector("#rankedRoot");
    if (!root) return;
    if (!sb()) { root.innerHTML = '<div class="svc-page"><p class="svc-empty">Sign in (top-right) to view the ranked leaderboard and metagame.</p></div>'; return; }
    if (busy) return; busy = true;
    root.innerHTML = '<div class="svc-page"><p class="svc-empty">Loading rankings…</p></div>';
    try {
      var lb = [];
      try { lb = await fetchLeaderboard(); } catch (e1) { lb = []; }
      var mg = null;
      try { mg = await fetchMetagame(); } catch (e2) { mg = null; }
      root.innerHTML = buildHtml(lb, mg);
      var sel = root.querySelector("#rankedSeason");
      if (sel) { sel.value = String(seasonDays); sel.addEventListener("change", function () { seasonDays = Number(this.value); render(); }); }
    } catch (e) {
      root.innerHTML = '<p style="color:#e0655c;padding:40px;text-align:center">Could not load rankings (' + esc(e && e.message) + ").</p>";
    } finally { busy = false; }
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest('[data-page-target="ranked"]');
    if (t) setTimeout(render, 40);
  });
  window.addEventListener("mtg-page-changed", function (e) { if (e && e.detail && e.detail.page === "ranked") render(); });
  window.MTGRanked = { render: render };
})();
