/* profile.js — Profile + Match History + Badges (ported from the React /profile page).
   Classic script. Lazily renders on the Profile tab via window.mtgGetClient() + window.mtgSync.session.
   Tables: profiles, match_history, achievements, user_achievements (shared Supabase). Defensive. */
(function () {
  "use strict";
  function client() { return (window.mtgGetClient && window.mtgGetClient()) || null; }
  function session() { return (window.mtgSync && window.mtgSync.session) || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function relDate(iso) { if (!iso) return ""; var d = (Date.now() - new Date(iso).getTime()) / 1000; if (d < 60) return "just now"; if (d < 3600) return Math.floor(d / 60) + "m ago"; if (d < 86400) return Math.floor(d / 3600) + "h ago"; return Math.floor(d / 86400) + "d ago"; }

  var TIER = { bronze: { bg: "rgba(176,114,67,0.18)", bd: "#b07243", lb: "#d99a63" }, silver: { bg: "rgba(170,178,190,0.16)", bd: "#aab2be", lb: "#cdd5e0" }, gold: { bg: "rgba(215,161,58,0.18)", bd: "#d7a13a", lb: "#facc15" }, platinum: { bg: "rgba(74,163,230,0.18)", bd: "#4aa3e6", lb: "#7cc4ff" } };

  // Local match history (recorded by table.js on game-over) — shows real W/L even offline.
  function readLocalMatches() { try { var a = JSON.parse(localStorage.getItem("mtg-match-history-v1") || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  // Saved-deck showcase — reads the local deck library (kept in sync with the cloud by deck-cloud.js).
  function readDeckLib() { try { return JSON.parse(localStorage.getItem("magic-table-tracker-decks-v1") || "{}"); } catch (e) { return {}; } }
  function decksSection() {
    var lib = readDeckLib();
    var decks = Array.isArray(lib.decks) ? lib.decks : [];
    var favs = {}; (Array.isArray(lib.favorites) ? lib.favorites : []).forEach(function (id) { favs[id] = 1; });
    if (!decks.length) {
      return '<h3 style="color:#f3f6fb;margin:0 0 8px">Decks</h3><p style="color:#6f7d92;padding:16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);margin-bottom:24px">No saved decks yet — build or import one in the Deck Builder to show it off here.</p>';
    }
    var sorted = decks.slice().sort(function (a, b) {
      var fa = favs[a.id] ? 0 : 1, fb = favs[b.id] ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    var favCount = decks.filter(function (d) { return favs[d.id]; }).length;
    var cards = sorted.map(function (d) {
      var art = String(d.commanderArtUrl || "").replace(/["']/g, "");
      var isFav = !!favs[d.id];
      var style = art
        ? "background-image:linear-gradient(180deg,rgba(6,12,20,0.12),rgba(6,12,20,0.9)),url('" + art + "')"
        : "background:linear-gradient(135deg,#1a2740,#0d1626)";
      return '<button type="button" class="prof-deck' + (isFav ? " fav" : "") + '" data-deck="' + esc(String(d.id || "")) + '" style="' + style + '">' +
        (isFav ? '<span class="prof-deck-fav" title="Favorite">★</span>' : "") +
        '<div class="prof-deck-meta"><b>' + esc(d.name || "Untitled deck") + '</b>' +
        '<span>' + esc(d.commanderName || (d.format || "Commander")) + '</span></div></button>';
    }).join("");
    return '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:0 0 8px"><h3 style="color:#f3f6fb;margin:0">Decks</h3>' +
      '<span style="color:#9aa6b8;font-size:12px">' + decks.length + ' saved' + (favCount ? ' · ' + favCount + ' ★' : '') + '</span></div>' +
      '<div class="prof-decks">' + cards + '</div>';
  }

  async function load(root) {
    var c = client(), s = session();
    var signedIn = !!(s && s.user);
    root.innerHTML = msg("Loading profile…");

    var localMatches = readLocalMatches();
    var profile = null, cloudMatches = [], catalog = [], earned = [], uid = signedIn ? s.user.id : null;
    // When signed in, layer cloud profile/match/badge data over the always-available local data.
    if (c && signedIn) {
      var _p = await Promise.all([
        c.from("profiles").select("*").eq("id", uid).maybeSingle().then(function (r) { return (r && r.data) || null; }, function () { return null; }),
        c.from("match_history").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(20).then(function (r) { return (r && r.data) || []; }, function () { return []; }),
        c.from("achievements").select("*").then(function (r) { return (r && r.data) || []; }, function () { return []; }),
        c.from("user_achievements").select("*").eq("user_id", uid).then(function (r) { return (r && r.data) || []; }, function () { return []; })
      ]);
      profile = _p[0]; cloudMatches = _p[1]; catalog = _p[2]; earned = _p[3];
    }

    var name = signedIn ? ((profile && profile.display_name) || (s.user.email ? s.user.email.split("@")[0] : "Player")) : "Guest";
    var localWins = localMatches.filter(function (m) { return m && m.won; }).length;
    var localLosses = localMatches.length - localWins;
    var matches = cloudMatches.length ? cloudMatches : localMatches;   // prefer cloud once it has data
    var hasCloudStats = !!(profile && (profile.wins != null || profile.losses != null));
    var wins = hasCloudStats ? (profile.wins || 0) : localWins;
    var losses = hasCloudStats ? (profile.losses || 0) : localLosses;
    var elo = (profile && profile.elo != null) ? profile.elo : 1200;
    var wr = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : null;

    var earnedSet = {};
    earned.forEach(function (e) { earnedSet[e.achievement_id || e.achievementId || e.code] = e.earned_at || e.created_at || true; });

    var statCard = function (label, val, color) { return '<div style="flex:1;text-align:center;padding:12px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)"><div style="font-size:24px;font-weight:700;color:' + color + '">' + val + '</div><div style="font-size:11px;color:#9aa6b8;text-transform:uppercase;letter-spacing:0.05em">' + label + "</div></div>"; };

    var badges = catalog.length ? catalog.map(function (ach) {
      var got = !!earnedSet[ach.id] || !!earnedSet[ach.code];
      var t = TIER[ach.tier] || TIER.bronze;
      return '<div title="' + esc(ach.description || "") + '" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;border-radius:12px;background:' + (got ? t.bg : "rgba(255,255,255,0.03)") + ";border:1px solid " + (got ? t.bd : "rgba(255,255,255,0.08)") + ";opacity:" + (got ? "1" : "0.5") + '">' +
        (ach.icon ? '<span style="font-size:26px;filter:' + (got ? "none" : "grayscale(1)") + '">' + esc(ach.icon) + "</span>"
          : '<span class="msym" style="font-size:28px;margin:0;color:' + (got ? t.lb : "#9aa6b8") + '">military_tech</span>') +
        '<span style="font-size:12px;font-weight:600;color:' + (got ? t.lb : "#9aa6b8") + ';text-align:center">' + esc(ach.name || ach.code) + "</span></div>";
    }).join("") : '<p style="color:#6f7d92;grid-column:1/-1">No achievements catalog yet.</p>';

    var BR_COL = { "1": "#3fb27f", "2": "#4f8fe0", "3": "#9b5de5", "4": "#e08a1a", "5": "#e0556e" };
    var matchRows = matches.length ? matches.map(function (mm) {
      var won = mm.won === true || mm.result === "win";
      var br = (mm.bracket != null) ? String(mm.bracket) : null;
      var brChip = br ? '<span style="display:inline-grid;place-items:center;width:20px;height:20px;border-radius:5px;font-size:11px;font-weight:800;color:#04101f;background:' + (BR_COL[br] || "#6f7d92") + '" title="Bracket ' + esc(br) + '">' + esc(br) + "</span>" : "";
      var delta = (mm.elo_delta != null) ? mm.elo_delta : (mm.elo_change != null ? mm.elo_change : null);
      var deltaChip = (delta != null) ? '<span style="font-family:monospace;font-size:12px;width:44px;text-align:right;color:' + (delta >= 0 ? "#4ade80" : "#f87171") + '">' + (delta >= 0 ? "+" : "") + delta + "</span>" : "";
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06)">' +
        '<span style="color:' + (won ? "#4ade80" : "#f87171") + ';font-weight:700;width:44px">' + (won ? "WIN" : "LOSS") + "</span>" +
        brChip +
        '<span style="flex:1;color:#c7d1de">' + esc(mm.commander_name || mm.format || "Game") + "</span>" +
        deltaChip +
        '<span style="color:#6f7d92;font-size:12px;width:60px;text-align:right">' + esc(relDate(mm.created_at)) + "</span></div>";
    }).join("") : '<p style="color:#6f7d92;padding:14px">No matches yet — your game history will appear here.</p>';

    var earnedCount = catalog.reduce(function (n, ach) { return n + ((earnedSet[ach.id] || earnedSet[ach.code]) ? 1 : 0); }, 0);

    var headerHtml = signedIn
      ? '<div style="flex:1"><input id="profName" value="' + esc(name) + '" style="background:transparent;border:none;border-bottom:1px solid transparent;color:#f3f6fb;font-size:20px;font-weight:700;outline:none;width:100%" /><div style="color:#6f7d92;font-size:12px">' + esc((s.user && s.user.email) || "") + "</div></div>" +
          '<button id="profSave" style="padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:var(--accent,#4aa3e6);color:#04101f;font-weight:700;cursor:pointer;display:none">Save name</button>'
      : '<div style="flex:1"><div style="color:#f3f6fb;font-size:20px;font-weight:700">Guest</div><div style="color:#6f7d92;font-size:12px">Sign in (top-right) to sync your profile, ELO &amp; badges across devices</div></div>';

    var badgesBlock = signedIn
      ? '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:0 0 8px"><h3 style="color:#f3f6fb;margin:0">Badges</h3>' + (catalog.length ? '<span style="color:#9aa6b8;font-size:12px">' + earnedCount + " / " + catalog.length + " earned</span>" : "") + "</div>" +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-bottom:24px">' + badges + "</div>"
      : "";

    root.innerHTML =
      '<div class="svc-page">' +
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">' +
          '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#4aa3e6,#9b5de5);display:grid;place-items:center;font-size:24px;font-weight:700;color:#04101f">' + esc((name[0] || "?").toUpperCase()) + "</div>" +
          headerHtml +
        "</div>" +
        '<div style="display:flex;gap:10px;margin-bottom:24px">' + statCard("ELO", signedIn ? elo : "—", "#4aa3e6") + statCard("Wins", wins, "#4ade80") + statCard("Losses", losses, "#f87171") + statCard("Win rate", wr == null ? "—" : wr + "%", "#f3f6fb") + "</div>" +
        decksSection() +
        badgesBlock +
        '<h3 style="color:#f3f6fb;margin:0 0 8px">Match history</h3><div style="border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);overflow:hidden">' + matchRows + "</div>" +
      "</div>";

    var inp = root.querySelector("#profName"), save = root.querySelector("#profSave");
    if (inp && save && c && uid) {
      inp.addEventListener("input", function () { save.style.display = (inp.value.trim() && inp.value.trim() !== name) ? "block" : "none"; });
      save.addEventListener("click", async function () {
        save.disabled = true; save.textContent = "Saving…";
        try { await c.from("profiles").upsert({ id: uid, display_name: inp.value.trim() }); name = inp.value.trim(); save.style.display = "none"; }
        catch (e) { save.textContent = "Failed"; }
        finally { save.disabled = false; save.textContent = "Save name"; }
      });
    }
    // Clicking a deck tile opens the Deck Builder.
    Array.prototype.forEach.call(root.querySelectorAll(".prof-deck"), function (b) {
      b.addEventListener("click", function () { var t = document.querySelector('[data-page-target="deck"]'); if (t) t.click(); });
    });
  }
  function msg(t) { return '<div class="svc-page"><p class="svc-empty">' + esc(t) + "</p></div>"; }

  var busy = false;
  function render() { var root = document.querySelector("#profileRoot"); if (!root || busy) return; busy = true; load(root).then(function () { busy = false; }, function () { busy = false; }); }
  document.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest('[data-page-target="profile"]'); if (t) setTimeout(render, 40); });
  window.addEventListener("mtg-page-changed", function (e) { if (e && e.detail && e.detail.page === "profile") render(); });
  window.MTGProfile = { render: render };
})();
