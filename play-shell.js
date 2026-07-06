/*
 * play-shell.js — front-end flow for the Play tab: a full-screen shell that wraps the existing
 * tabletop with a mode-select entry screen (→ lobby → playmat → game). Kept self-contained (like
 * keywords.js / slang.js) so a bug here can never break table.js. It only shows/hides its own
 * overlay and calls the public window.MTGTable surface.
 *
 * QA 2026-07-02 (G5): cosmic mode-select w/ Sigil constellation + account badge + online readout
 * + Spectate / View-all-lobbies; League-style deck-select lobby (saved-deck tiles w/ commander
 * art + bracket badges, Lock In, pick broadcast), full WotC precon picker, collapsible
 * Moxfield/Archidekt/ManaBox link import, host-only "Precons only" toggle.
 */
(function () {
  "use strict";

  var shell = null, leaveBtn = null, current = null;
  var screens = {};
  var choice = { mode: null, name: "", color: "#4f7bf0", guest: true, locked: false, deckMeta: null };

  var MODES = [
    { key: "commander",  title: "Commander",       sub: "40 life, command zone",                                  c1: "#6d36c4", c2: "#3a1a73", life: 40 },
    { key: "draft",      title: "Draft Commander",  sub: "Draft a pool pack by pack, then play it",                c1: "#c4631a", c2: "#7a3a0e", life: 40, disabled: true },
    { key: "planechase", title: "Planechase",       sub: "Commander rules plus a shared planar deck and the die",  c1: "#1c7a52", c2: "#0e3f2b", life: 40, disabled: true },
    { key: "standard",   title: "20 Life",          sub: "Standard, Modern, and other 20-life formats",            c1: "#2a5bd0", c2: "#173a8f", life: 20, disabled: true }
  ];
  var COLORS = ["#4f7bf0", "#e0556e", "#3fb27f", "#d7a13a", "#9b5de5", "#46c2d8"];

  // Commander brackets (shared by the lobby deck tiles + the draft bracket screen).
  var BRACKETS = [
    { n: 1, name: "Exhibition", desc: "Ultra-casual, jank & themes", c1: "#3fb27f", c2: "#1e6b4a" },
    { n: 2, name: "Core",       desc: "Precon-level, average power", c1: "#4f8fe0", c2: "#274f8f" },
    { n: 3, name: "Upgraded",   desc: "Tuned precon, some spice",    c1: "#9b5de5", c2: "#5a2f8f" },
    { n: 4, name: "Optimized",  desc: "High power, Game Changers",   c1: "#e08a1a", c2: "#8f550e" },
    { n: 5, name: "cEDH",       desc: "Competitive, fast combos",    c1: "#e0556e", c2: "#8f2f40" }
  ];

  function eln(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function escapeAttr(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function modeMeta(key) { for (var i = 0; i < MODES.length; i++) if (MODES[i].key === key) return MODES[i]; return MODES[0]; }

  // ---- account identity: signed-in display name, or a stable "Guest ####" ----
  function accountName() {
    try {
      var sess = window.mtgSync && window.mtgSync.session;
      if (sess && sess.user) {
        var md = sess.user.user_metadata || {};
        var n = md.display_name || md.name || (sess.user.email ? String(sess.user.email).split("@")[0] : "");
        if (n) return { name: String(n).slice(0, 24), guest: false };
      }
    } catch (e) {}
    var g = "";
    try { g = localStorage.getItem("sigil-guest-name") || ""; } catch (e) {}
    if (!g) {
      g = "Guest " + Math.floor(1000 + Math.random() * 9000);
      try { localStorage.setItem("sigil-guest-name", g); } catch (e) {}
    }
    return { name: g, guest: true };
  }

  // ---- the canonical Sigil mana-seal (same geometry as the .brand-mark SVG in index.html) ----
  function sealSvg(size) {
    return '<svg viewBox="0 0 48 48" width="' + size + '" height="' + size + '" role="img" aria-hidden="true">' +
      '<defs><radialGradient id="psSealGlow" cx="50%" cy="42%" r="60%">' +
      '<stop offset="0%" stop-color="#8fd0ff" stop-opacity="0.55"/><stop offset="100%" stop-color="#4da3ff" stop-opacity="0"/>' +
      '</radialGradient></defs>' +
      '<circle cx="24" cy="24" r="21" fill="url(#psSealGlow)"/>' +
      '<circle cx="24" cy="24" r="18.5" fill="none" stroke="#8fd0ff" stroke-width="1.3" opacity="0.85"/>' +
      '<polygon points="24,7 40.2,18.8 34,37.8 14,37.8 7.8,18.8" fill="none" stroke="#6fa8e0" stroke-width="1.1" opacity="0.7"/>' +
      '<circle cx="24" cy="7" r="3.1" fill="#eef0ea" stroke="#070d1a" stroke-width="0.6"/>' +
      '<circle cx="40.2" cy="18.8" r="3.1" fill="#4aa3e6" stroke="#070d1a" stroke-width="0.6"/>' +
      '<circle cx="34" cy="37.8" r="3.1" fill="#9b86c4" stroke="#070d1a" stroke-width="0.6"/>' +
      '<circle cx="14" cy="37.8" r="3.1" fill="#e0655c" stroke="#070d1a" stroke-width="0.6"/>' +
      '<circle cx="7.8" cy="18.8" r="3.1" fill="#46b277" stroke="#070d1a" stroke-width="0.6"/>' +
      '</svg>';
  }

  // Cosmic backdrop: scattered stars + the mana seal drawn as a constellation (ring, pentagon,
  // 5 WUBRG node-stars). Static SVG (cheap); twinkle is CSS-only + reduced-motion aware.
  function cosmosSvg() {
    var W = 900, H = 640, cx = W / 2, cy = 292, R = 132;
    var seed = 20260702;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var parts = [];
    for (var i = 0; i < 90; i++) {
      var x = (rnd() * W).toFixed(1), y = (rnd() * H).toFixed(1);
      var r = (0.5 + rnd() * 1.1).toFixed(2), o = (0.12 + rnd() * 0.45).toFixed(2);
      var twinkle = rnd() > 0.65; // only some background stars pulse — keeps it subtle + cheap
      parts.push('<circle' + (twinkle ? ' class="tw"' : '') + ' cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#cfe0f2" opacity="' + o + '"' + (twinkle ? ' style="animation-delay:-' + (rnd() * 6).toFixed(1) + 's"' : '') + '/>');
    }
    // faint constellation ring + ring stars
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="#8fd0ff" stroke-opacity="0.10" stroke-width="1" stroke-dasharray="2 7"/>');
    for (var k = 0; k < 20; k++) {
      var ra = (Math.PI * 2 * k) / 20 - Math.PI / 2;
      parts.push('<circle class="tw" cx="' + (cx + Math.cos(ra) * R).toFixed(1) + '" cy="' + (cy + Math.sin(ra) * R).toFixed(1) + '" r="1.1" fill="#8fd0ff" opacity="0.45" style="animation-delay:-' + (k * 0.35).toFixed(2) + 's"/>');
    }
    // pentagon lines + 5 WUBRG node stars (top W, then clockwise U B R G — matches the seal)
    var cols = ["#eef0ea", "#4aa3e6", "#9b86c4", "#e0655c", "#46b277"];
    var pts = [];
    for (var n = 0; n < 5; n++) {
      var ang = (-90 + n * 72) * Math.PI / 180;
      pts.push([+(cx + Math.cos(ang) * R).toFixed(1), +(cy + Math.sin(ang) * R).toFixed(1)]);
    }
    var poly = pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    parts.push('<polygon points="' + poly + '" fill="none" stroke="#6fa8e0" stroke-opacity="0.14" stroke-width="1"/>');
    pts.forEach(function (p, pi) {
      parts.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="' + cols[pi] + '" opacity="0.10"/>');
      parts.push('<circle class="tw" cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="' + cols[pi] + '" opacity="0.85" style="animation-delay:-' + (pi * 0.8).toFixed(1) + 's"/>');
    });
    return '<svg viewBox="0 0 900 640" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">' + parts.join("") + '</svg>';
  }

  function ensureShell() {
    if (shell) return;
    var page = document.getElementById("playPage");
    if (!page) return;
    shell = eln("div", "play-shell"); shell.id = "playShell";
    page.appendChild(shell);
    buildModeScreen();
  }

  function buildModeScreen() {
    var s = eln("div", "ps-screen ps-mode");
    var acct = accountName();
    choice.name = acct.name; choice.guest = acct.guest;
    s.innerHTML =
      '<div class="ps-cosmos" aria-hidden="true">' + cosmosSvg() + '</div>' +
      '<div class="ps-topbar"><button class="ps-back" type="button" id="psExit">‹ Back to app</button></div>' +
      '<div class="ps-hero">' +
        '<div class="ps-seal" aria-hidden="true">' + sealSvg(64) + '</div>' +
        '<h1 class="ps-title">Sigil</h1>' +
        '<p class="ps-tag">A free multiplayer tabletop for Magic: The Gathering</p>' +
        '<div class="ps-account">' +
          '<button class="ps-swatch" id="psSwatch" type="button" aria-label="Change your color"></button>' +
          '<span class="ps-acct" id="psAcct">' + escapeHtml(acct.name) + (acct.guest ? ' <em>guest</em>' : '') + '</span>' +
          '<span class="ps-online" id="psOnline" title="Approximate — players seated in open public games"></span>' +
        '</div>' +
        '<div class="ps-modes" id="psModes"></div>' +
        '<div class="ps-mode-extra">' +
          '<button class="ps-extra-btn" id="psSpectate" type="button">Spectate live games</button>' +
          '<button class="ps-extra-btn" id="psLobbies" type="button">View all lobbies</button>' +
        '</div>' +
        '<p class="ps-foot">Solo or online — plays in your browser, nothing to install.</p>' +
      '</div>';
    screens.mode = s; shell.appendChild(s);

    var grid = s.querySelector("#psModes");
    MODES.forEach(function (m) {
      var c = eln("button", "ps-mode-card"); c.type = "button"; c.dataset.mode = m.key;
      c.style.setProperty("--c1", m.c1); c.style.setProperty("--c2", m.c2);
      c.innerHTML =
        '<span class="ps-mc-arrow">›</span>' +
        '<span class="ps-mc-title">' + m.title + (m.disabled ? ' <em class="ps-beta">Soon</em>' : (m.beta ? ' <em class="ps-beta">Beta</em>' : '')) + '</span>' +
        '<span class="ps-mc-sub">' + m.sub + '</span>';
      if (m.disabled) { c.disabled = true; c.setAttribute("aria-disabled", "true"); }
      else c.addEventListener("click", function () { choice.mode = m.key; onPickMode(m.key); });
      grid.appendChild(c);
    });

    s.querySelector("#psExit").addEventListener("click", exitPlay);
    s.querySelector("#psSpectate").addEventListener("click", goWatch);
    s.querySelector("#psLobbies").addEventListener("click", openLobbyBrowser);

    var sw = s.querySelector("#psSwatch"); sw.style.background = choice.color;
    sw.addEventListener("click", function () {
      var i = COLORS.indexOf(choice.color); choice.color = COLORS[(i + 1) % COLORS.length]; sw.style.background = choice.color;
    });

    refreshOnlineCount(s.querySelector("#psOnline"));
  }

  function refreshAccount() {
    var s = screens.mode; if (!s) return;
    var acct = accountName();
    choice.name = acct.name; choice.guest = acct.guest;
    var badge = s.querySelector("#psAcct");
    if (badge) badge.innerHTML = escapeHtml(acct.name) + (acct.guest ? ' <em>guest</em>' : '');
  }

  function refreshOnlineCount(out) {
    if (!out) return;
    if (!window.MTGTableSync || !MTGTableSync.listOpenGames) { out.textContent = ""; return; }
    try {
      Promise.resolve(MTGTableSync.listOpenGames(50)).then(function (games) {
        var n = 0; (games || []).forEach(function (g) { n += Number(g && g.players) || 0; });
        out.textContent = "≈" + n + " playing online now";
      }, function () { out.textContent = ""; });
    } catch (e) { out.textContent = ""; }
  }

  // Spectate → route to the site's Watch page (live games).
  function goWatch() {
    close();
    var b = document.querySelector('[data-page-target="watch"]');
    if (b) b.click(); else location.hash = "#watch";
  }

  // View all lobbies → the table's lobby browser if exported, else a lightweight built-in list.
  function openLobbyBrowser() {
    if (window.MTGTable && typeof MTGTable.openLobby === "function") { try { MTGTable.openLobby(); return; } catch (e) {} }
    var ov = eln("div", "ps-prec-ov");
    ov.innerHTML =
      '<div class="ps-prec-panel"><div class="ps-prec-head"><h3>Open lobbies</h3><span id="psLobCount"></span>' +
        '<button type="button" class="ps-prec-x" id="psLobX" aria-label="Close">' + (window.MTGIcons ? MTGIcons.get("close", "1em") : "") + '</button></div>' +
        '<div class="ps-prec-list" id="psLobList"><p class="ps-prec-note">Looking for open games…</p></div></div>';
    shell.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector("#psLobX").onclick = function () { ov.remove(); };
    var listEl = ov.querySelector("#psLobList"), countEl = ov.querySelector("#psLobCount");
    if (!window.MTGTableSync || !MTGTableSync.listOpenGames) { listEl.innerHTML = '<p class="ps-prec-note">Online play isn\'t configured on this site yet.</p>'; return; }
    Promise.resolve(MTGTableSync.listOpenGames(50)).then(function (games) {
      games = games || [];
      countEl.textContent = games.length + " open";
      if (!games.length) { listEl.innerHTML = '<p class="ps-prec-note">No public games right now — host one from a lobby!</p>'; return; }
      listEl.innerHTML = "";
      games.forEach(function (g) {
        var np = Number(g.players) || 0;
        var row = eln("button", "ps-prec-row"); row.type = "button";
        row.innerHTML = '<span class="ps-pr-nm"><b>' + escapeHtml(g.name || "Commander table") + '</b><i>host: ' + escapeHtml(g.host || "Host") + '</i></span>' +
          '<span class="ps-pr-set">' + np + ' player' + (np === 1 ? "" : "s") + '</span>' +
          '<span class="ps-pr-go">Join ›</span>';
        row.onclick = function () { ov.remove(); openForJoin(g.id); };
        listEl.appendChild(row);
      });
    }, function () { listEl.innerHTML = '<p class="ps-prec-note">Couldn\'t load the lobby list.</p>'; });
  }

  function show(name) {
    current = name;
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle("active", k === name); });
  }

  // ---- open / close the shell ----
  function open() {
    ensureShell(); if (!shell) return;
    document.body.classList.add("play-fs");
    hideLeave();
    shell.classList.add("active");
    refreshAccount();
    if (screens.mode) refreshOnlineCount(screens.mode.querySelector("#psOnline"));
    if (!current) current = "mode";
    show("mode");
  }
  function close() {
    if (shell) shell.classList.remove("active");
    teardownOppoSync(); // ensure the draft bracket-sync handler is removed on any exit path
    teardownLobbySync();
    hideLeave(); hideTracker(); hideInvite(); if (window.MTGHUD) MTGHUD.hide();
    document.body.classList.remove("play-fs");
  }
  function exitPlay() {
    close();
    var life = document.querySelector('[data-page-target="life"]');
    if (life) life.click();
  }

  // Opened via an invite link (?join=CODE): jump straight to the lobby with the code loaded.
  function openForJoin(code) {
    // Enter the Play view the way the Play tab does so #playPage becomes active — the shell lives
    // inside #playPage, so calling open() while on Home leaves it mounted in a hidden parent.
    var pb = document.getElementById("playTabButton");
    if (pb) pb.click(); else open();
    buildLobby("commander");
    show("lobby");
    choice.online = true; choice.joinCode = code;
    var s = screens.lobby; if (!s) return;
    var ci = s.querySelector("#psJoinCode"); if (ci) ci.value = code;
    applyHostUi(s);
    renderPlayers(s);
    // Connect to the host's realtime lobby channel so both sides see each other before Start Game.
    var connectLobby = function () {
      try {
        if (window.MTGTableSync && MTGTableSync.joinLobby && MTGTableSync.joinLobby(code)) {
          setupLobbySync(s);
          var ping = function () { broadcastPresence(); if (choice.locked) broadcastDeckPick(); };
          ping(); setTimeout(ping, 700); setTimeout(ping, 1800);
        }
      } catch (e) {}
    };
    try {
      if (window.mtgSync && window.mtgSync.session) connectLobby();
      else if (window.mtgSync && window.mtgSync.enabled && window.mtgSync.signInAnonymously) {
        window.mtgSync.signInAnonymously().then(function () {
          try { refreshAccount(); } catch (e) {}
          logLine(s, 'Joined as <b>guest</b> — pick a deck and Start Game to play. You can make a free account after.');
          connectLobby();
        }).catch(function () { logLine(s, 'To join, sign in (top-right) — guest play may be disabled.'); });
      }
    } catch (e) {}
    logLine(s, 'Invite code <b>' + escapeHtml(code) + '</b> loaded — lock in a deck, then Start Game to join.');
  }

  function onPickMode(mode) { buildLobby(mode); show("lobby"); }

  // ============================== LOBBY ==============================
  var lobbyCfg = { preconsOnly: false, lookingForPlayers: false };
  var lobbyState = { picks: {} };
  var lobbySync = { prev: null, active: false };
  var deckTiles = [];
  var selTileId = null;

  function isHost() { return !choice.joinCode; }

  function buildLobby(mode) {
    var m = modeMeta(mode);
    teardownLobbySync();
    if (screens.lobby) { shell.removeChild(screens.lobby); delete screens.lobby; }
    lobbyState.picks = {};
    lobbyCfg.preconsOnly = false; lobbyCfg.lookingForPlayers = false;
    choice.locked = false; choice.deckMeta = null; choice.deck = null;
    choice.joinCode = null; choice.hostedCode = null; choice.online = false;
    selTileId = null;
    var s = eln("div", "ps-screen ps-lobby");
    s.innerHTML =
      '<div class="ps-lobby-head">' +
        '<button class="ps-back" id="psLobbyBack" type="button">‹ Modes</button>' +
        '<div class="ps-lobby-title"><span class="ps-lobby-seal">' + sealSvg(40) + '</span><h2>' + m.title + '</h2></div>' +
      '</div>' +
      '<div class="ps-lobby-body">' +
        '<div class="ps-panel ps-deckselect">' +
          '<div class="ps-ds-head"><h3>Choose your deck</h3><div class="ps-ds-actions">' +
            '<button type="button" id="psPreconBtn" class="ps-host-btn">Select a precon</button>' +
            '<button type="button" id="psImportBtn" class="ps-host-btn">Import deck from link</button></div></div>' +
          '<div class="ps-import-wrap" id="psImportWrap" hidden></div>' +
          '<div class="ps-deck-grid" id="psDeckGrid"></div>' +
          '<div class="ps-lockbar">' +
            '<div class="ps-locksel" id="psLockSel">Pick a deck, then lock it in.</div>' +
            '<button type="button" id="psLockIn" class="ps-lock-btn" disabled>Lock In</button>' +
            '<button type="button" id="psStartGo" class="ps-start-btn" disabled>Start Game ›</button></div>' +
        '</div>' +
        '<div class="ps-lobby-cols">' +
          '<div class="ps-panel"><h3>Players <span id="psPlayerCount">(1)</span></h3><div class="ps-players" id="psPlayers"></div></div>' +
          '<div class="ps-panel"><h3>Action Log</h3><div class="ps-log" id="psLog"><p class="ps-log-row">You joined the table.</p></div></div>' +
        '</div>' +
        '<div class="ps-panel ps-host"><h3>Invite friends</h3>' +
          '<div class="ps-host-row">' +
            '<button type="button" id="psInviteBtn" class="ps-host-btn primary">Generate invite link</button>' +
            '<button type="button" id="psViewLobbies" class="ps-host-btn">View all lobbies</button>' +
            '<label class="ps-preconly" id="psLfpWrap" title="Host only — when on, your game is listed publicly so random players can find and join it"><input type="checkbox" id="psLfp" /> Looking for players</label>' +
            '<label class="ps-preconly" id="psPreconOnlyWrap" title="Host only — when on, everyone must play a WotC precon">' +
              '<input type="checkbox" id="psPreconOnly" /> Precons only</label>' +
          '</div>' +
          '<div class="ps-invite-out" id="psInviteOut" hidden></div>' +
          '<div class="ps-join" id="psJoin"><input id="psJoinCode" type="text" placeholder="Have an invite code? Paste it to join a friend’s game" /><button id="psJoinGo" type="button">Join game</button></div>' +
        '</div>' +
      '</div>';
    screens.lobby = s; shell.appendChild(s);

    s.querySelector("#psLobbyBack").onclick = function () { teardownLobbySync(); show("mode"); };

    buildDeckGrid(s);

    s.querySelector("#psPreconBtn").onclick = function () { openPreconPicker(s); };
    s.querySelector("#psImportBtn").onclick = function () {
      if (lobbyCfg.preconsOnly) { logLine(s, "Precons only is on — use the precon picker."); return; }
      var w = s.querySelector("#psImportWrap");
      w.hidden = !w.hidden;
      if (!w.hidden && !w.dataset.built) { buildImportPanel(s, w); w.dataset.built = "1"; }
    };

    s.querySelector("#psLockIn").onclick = function () { lockInDeck(s); };
    s.querySelector("#psStartGo").onclick = function () {
      if (!choice.locked || !choice.deck) return;
      teardownLobbySync();
      chooseDeck(choice.deck);
    };

    // Invite friends (host) — creates the online room, then shares the link.
    var invBtn = s.querySelector("#psInviteBtn"), invOut = s.querySelector("#psInviteOut");
    var vlb = s.querySelector("#psViewLobbies"); if (vlb) vlb.onclick = openLobbyBrowser;
    var lfpCb0 = s.querySelector("#psLfp"); if (lfpCb0) lfpCb0.onclick = function () { lobbyCfg.lookingForPlayers = lfpCb0.checked; };
    invBtn.onclick = function () {
      var syncOn = !!(window.mtgSync && window.mtgSync.enabled);
      var signedIn = !!(window.mtgSync && window.mtgSync.session);
      if (!syncOn || !window.MTGTable || !MTGTable.hostRoom) {
        invOut.hidden = false; invOut.innerHTML = '<span class="ps-invite-code">Online play isn’t configured on this site yet. Multiplayer needs the Supabase config present in the deployment.</span>'; return;
      }
      if (!signedIn) {
        invOut.hidden = false; invOut.innerHTML = '<span class="ps-invite-code">Sign in (top-right) to create an online game — multiplayer needs an account so friends can join securely.</span>'; return;
      }
      choice.online = true;
      invBtn.disabled = true; invBtn.textContent = "Creating room…";
      var _lfp = !!lobbyCfg.lookingForPlayers, _nm = choice.name + (_lfp ? " [LFP]" : "");
      Promise.resolve(MTGTable.hostRoom({ visibility: _lfp ? "public" : "private", name: _nm })).then(function (code) {
        invBtn.disabled = false; invBtn.textContent = "Generate invite link";
        if (!code) { invOut.hidden = false; invOut.textContent = "Couldn't create a game — try again."; return; }
        choice.hostedCode = code;
        var link = location.origin + location.pathname + "?join=" + encodeURIComponent(code);
        invOut.hidden = false;
        invOut.innerHTML = '<input class="ps-invite-link" readonly value="' + escapeAttr(link) + '" /><div class="ps-invite-btns"><button type="button" class="ps-invite-copy">Copy link</button><button type="button" class="ps-invite-copycode">Copy code</button></div><span class="ps-invite-code">Room code <b>' + escapeHtml(code) + '</b> — share the link, or share this code to paste into &ldquo;Join game&rdquo;.</span>';
        var cp = invOut.querySelector(".ps-invite-copy"), li = invOut.querySelector(".ps-invite-link"), cc = invOut.querySelector(".ps-invite-copycode");
        cp.onclick = function () { try { if (li) { li.focus(); li.select(); } if (navigator.clipboard) navigator.clipboard.writeText(link); } catch (e) {} cp.textContent = "Copied!"; setTimeout(function () { cp.textContent = "Copy link"; }, 1600); };
        if (cc) cc.onclick = function () { try { if (navigator.clipboard) navigator.clipboard.writeText(code); } catch (e) {} cc.textContent = "Copied!"; setTimeout(function () { cc.textContent = "Copy code"; }, 1600); };
        if (li) li.onclick = function () { li.focus(); li.select(); };
        // Hosting rewired MTGTableSync.onEphemeral — re-arm the lobby listener, then re-share state.
        setupLobbySync(s);
        broadcastPresence();
        broadcastLobbyCfg();
        broadcastDeckPick();
        logLine(s, 'Room <b>' + escapeHtml(code) + '</b> created — share the link with your pod.');
      }, function (e) { invBtn.disabled = false; invBtn.textContent = "Generate invite link"; invOut.hidden = false; invOut.textContent = "Couldn't create a game: " + ((e && e.message) || e); });
    };

    // Join by invite code (grouped with the invite-friends UI).
    var jg = s.querySelector("#psJoinGo");
    jg.onclick = function () {
      var code = (s.querySelector("#psJoinCode").value || "").trim();
      if (!code) { s.querySelector("#psJoinCode").focus(); return; }
      choice.joinCode = code; choice.online = true;
      applyHostUi(s);
      renderPlayers(s);
      logLine(s, 'Joining room <b>' + escapeHtml(code) + '</b> — lock in a deck, then Start Game to take your seat.');
    };

    // Host-only "Precons only" toggle — broadcast so joiners see it enforced.
    var cb = s.querySelector("#psPreconOnly");
    cb.onchange = function () {
      if (!isHost()) { cb.checked = lobbyCfg.preconsOnly; return; }
      lobbyCfg.preconsOnly = cb.checked;
      applyPreconsOnly(s);
      broadcastLobbyCfg();
      logLine(s, "Precons only " + (cb.checked ? "<b>enabled</b> — everyone must play a WotC precon." : "<b>disabled</b>."));
    };

    applyHostUi(s);
    renderPlayers(s);
    setupLobbySync(s);
  }

  function applyHostUi(s) {
    var host = isHost();
    var cb = s.querySelector("#psPreconOnly"), wrap = s.querySelector("#psPreconOnlyWrap"), inv = s.querySelector("#psInviteBtn");
    if (cb) { cb.disabled = !host; cb.checked = !!lobbyCfg.preconsOnly; }
    var lfpc = s.querySelector("#psLfp"), lfpw = s.querySelector("#psLfpWrap");
    if (lfpc) { lfpc.disabled = !host; lfpc.checked = !!lobbyCfg.lookingForPlayers; }
    if (lfpw) lfpw.classList.toggle("view", !host);
    if (wrap) wrap.classList.toggle("view", !host);
    if (inv) inv.disabled = !host;
  }

  function logLine(s, html) {
    var lg = s.querySelector("#psLog"); if (!lg) return;
    var p = eln("p", "ps-log-row"); p.innerHTML = html;
    lg.appendChild(p);
    lg.scrollTop = lg.scrollHeight;
  }

  // ---- deck tiles (League-style select) ----
  function artFromCard(card) {
    if (!card) return "";
    var u = card.image_uris || (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris) || {};
    return u.art_crop || u.normal || u.large || "";
  }

  function savedDeckTiles() {
    var lib = [];
    try { var raw = JSON.parse(localStorage.getItem("magic-table-tracker-decks-v1") || "{}"); lib = Array.isArray(raw.decks) ? raw.decks : []; } catch (e) { lib = []; }
    var tiles = [];
    lib.forEach(function (d, i) {
      if (!d) return;
      var cmd = null;
      try { (d.cards || []).some(function (en) { if (en && en.section === "commander") { cmd = en; return true; } return false; }); } catch (e) {}
      var br = Number(d.bracket) || null;
      if (!br && typeof window.analyzeDeckForBracket === "function") {
        try { var an = window.analyzeDeckForBracket(d); br = (an && Number(an.bracket)) || null; } catch (e) {}
      }
      tiles.push({
        id: "saved-" + i, kind: "saved", ref: { index: i },
        name: d.name || ("Deck " + (i + 1)),
        commander: (cmd && cmd.card && cmd.card.name) || "",
        art: d.commanderArtUrl || artFromCard(cmd && cmd.card),
        bracket: br
      });
    });
    return tiles;
  }

  function tileHtml(t) {
    var br = t.bracket ? Math.min(5, Math.max(1, Number(t.bracket))) : null;
    var b = br ? BRACKETS[br - 1] : null;
    return '<button type="button" class="ps-deck-tile" data-tile="' + escapeAttr(t.id) + '" aria-pressed="false">' +
      '<span class="ps-dt-art"' + (t.art ? ' style="background-image:url(&quot;' + escapeAttr(String(t.art).replace(/"/g, "")) + '&quot;)"' : ' data-empty="1"') + '></span>' +
      (b ? '<span class="ps-dt-br" title="Bracket ' + br + ' · ' + b.name + '" style="background:linear-gradient(135deg,' + b.c1 + ',' + b.c2 + ')">B' + br + '</span>' : '') +
      (t.kind === "precon" ? '<span class="ps-dt-tag">Precon</span>' : (t.kind === "import" ? '<span class="ps-dt-tag">Import</span>' : '')) +
      '<span class="ps-dt-info"><b>' + escapeHtml(t.name) + '</b>' + (t.commander ? '<i>' + escapeHtml(t.commander) + '</i>' : '') + '</span>' +
      '</button>';
  }

  function buildDeckGrid(s) {
    deckTiles = [{ id: "sample", kind: "sample", ref: {}, name: "Sample deck (Krenko)", commander: "Krenko, Mob Boss", art: "", bracket: null }]
      .concat(savedDeckTiles());
    paintDeckGrid(s);
  }

  function paintDeckGrid(s) {
    var g = s.querySelector("#psDeckGrid"); if (!g) return;
    var html = deckTiles.map(tileHtml).join("");
    if (!deckTiles.some(function (t) { return t.kind === "saved"; })) {
      html += '<p class="ps-deck-empty">No saved decks yet — build one in the Deck Builder, pick a precon, or import from a link.</p>';
    }
    g.innerHTML = html;
    Array.prototype.forEach.call(g.querySelectorAll(".ps-deck-tile"), function (btn) {
      btn.onclick = function () { selectTile(s, btn.dataset.tile); };
    });
    syncGridSelection(s);
    applyPreconsOnly(s);
  }

  function tileById(id) { for (var i = 0; i < deckTiles.length; i++) if (deckTiles[i].id === id) return deckTiles[i]; return null; }
  function tileAllowed(t) { return !lobbyCfg.preconsOnly || (t && t.kind === "precon"); }

  function selectTile(s, id) {
    var t = tileById(id); if (!t) return;
    if (!tileAllowed(t)) { logLine(s, "Precons only is on — pick a precon instead."); return; }
    selTileId = id; choice.locked = false;
    syncGridSelection(s);
    var sel = s.querySelector("#psLockSel");
    if (sel) sel.innerHTML = 'Selected: <b>' + escapeHtml(t.name) + '</b>' + (t.commander ? ' · ' + escapeHtml(t.commander) : '');
    var lk = s.querySelector("#psLockIn"); if (lk) { lk.disabled = false; lk.textContent = "Lock In"; }
    var st = s.querySelector("#psStartGo"); if (st) st.disabled = true;
  }

  function syncGridSelection(s) {
    Array.prototype.forEach.call(s.querySelectorAll(".ps-deck-tile"), function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.tile === selTileId ? "true" : "false");
      btn.classList.toggle("locked", choice.locked && btn.dataset.tile === selTileId);
    });
  }

  function lockInDeck(s) {
    var t = tileById(selTileId); if (!t) return;
    if (!tileAllowed(t)) { logLine(s, "Precons only is on — pick a precon instead."); return; }
    choice.deck = t.ref;
    choice.deckMeta = { name: t.name, commander: t.commander || "", bracket: t.bracket || null };
    choice.locked = true;
    var lk = s.querySelector("#psLockIn"); if (lk) { lk.innerHTML = "Locked " + (window.MTGIcons ? MTGIcons.get("check", "1em") : ""); lk.disabled = true; }
    var st = s.querySelector("#psStartGo"); if (st) st.disabled = false;
    syncGridSelection(s);
    renderPlayers(s);
    broadcastDeckPick();
    logLine(s, 'You locked in <b>' + escapeHtml(t.name) + '</b>' + (t.commander ? ' (' + escapeHtml(t.commander) + ')' : '') + '.');
  }

  function applyPreconsOnly(s) {
    var on = !!lobbyCfg.preconsOnly;
    Array.prototype.forEach.call(s.querySelectorAll(".ps-deck-tile"), function (btn) {
      var t = tileById(btn.dataset.tile);
      btn.classList.toggle("off", on && !!t && t.kind !== "precon");
    });
    var imp = s.querySelector("#psImportBtn"); if (imp) imp.disabled = on;
    var iw = s.querySelector("#psImportWrap"); if (iw && on) iw.hidden = true;
    var cb = s.querySelector("#psPreconOnly"); if (cb) cb.checked = on;
    if (on && choice.locked && selTileId) {
      var t2 = tileById(selTileId);
      if (t2 && t2.kind !== "precon") {
        choice.locked = false;
        var st = s.querySelector("#psStartGo"); if (st) st.disabled = true;
        var lk = s.querySelector("#psLockIn"); if (lk) { lk.textContent = "Lock In"; lk.disabled = false; }
        syncGridSelection(s);
        renderPlayers(s);
        logLine(s, "Precons only turned on — your custom deck was unlocked.");
      }
    }
  }

  // ---- players list (with deck picks) ----
  function deckLineHtml(d) {
    if (!d) return "";
    var br = d.bracket ? Math.min(5, Math.max(1, Number(d.bracket))) : null;
    var b = br ? BRACKETS[br - 1] : null;
    return '<span class="ps-pl-deck">' +
      (b ? '<span class="ps-pl-br" style="background:linear-gradient(135deg,' + b.c1 + ',' + b.c2 + ')">B' + br + '</span>' : '') +
      '<b>' + escapeHtml(d.name || "Deck") + '</b>' +
      (d.commander ? '<i>· ' + escapeHtml(d.commander) + '</i>' : '') + '</span>';
  }

  function renderPlayers(s) {
    var box = s.querySelector("#psPlayers"); if (!box) return;
    var html = '<div class="ps-player"><span class="ps-pl-sw" style="background:' + escapeAttr(choice.color) + '"></span>' +
      '<span class="ps-pl-name">' + escapeHtml(choice.name || "You") + '</span>' +
      '<span class="ps-badge you">You</span>' + (isHost() ? '<span class="ps-badge host">Host</span>' : '') +
      (choice.locked && choice.deckMeta ? deckLineHtml(choice.deckMeta) : '<span class="ps-pl-deck none">Choosing a deck…</span>') +
      '</div>';
    var names = Object.keys(lobbyState.picks);
    names.forEach(function (k) {
      var p = lobbyState.picks[k];
      html += '<div class="ps-player"><span class="ps-pl-sw" style="background:' + escapeAttr(p.color || "#4f7bf0") + '"></span>' +
        '<span class="ps-pl-name">' + escapeHtml(p.name) + '</span>' +
        (p.deck ? deckLineHtml(p.deck) : '<span class="ps-pl-deck none">Choosing a deck…</span>') + '</div>';
    });
    box.innerHTML = html;
    var cnt = s.querySelector("#psPlayerCount"); if (cnt) cnt.textContent = "(" + (1 + names.length) + ")";
  }

  // ---- lobby ephemeral sync (mirrors the draft bracket-broadcast pattern) ----
  function broadcastDeckPick() {
    try {
      if (!window.MTGTableSync || !MTGTableSync.broadcastEphemeral || !choice.locked || !choice.deckMeta) return;
      MTGTableSync.broadcastEphemeral({
        type: "deckpick", name: choice.name || "Player", color: choice.color,
        deck: { name: choice.deckMeta.name, commander: choice.deckMeta.commander, bracket: choice.deckMeta.bracket }
      });
    } catch (e) {}
  }
  function broadcastLobbyCfg() {
    try {
      if (!isHost() || !window.MTGTableSync || !MTGTableSync.broadcastEphemeral) return;
      MTGTableSync.broadcastEphemeral({ type: "lobbycfg", preconsOnly: !!lobbyCfg.preconsOnly });
    } catch (e) {}
  }
  // "I'm here" ping so players appear in each other's lobby before anyone locks a deck.
  function broadcastPresence() {
    try {
      if (!choice.online || !window.MTGTableSync || !MTGTableSync.broadcastEphemeral) return;
      MTGTableSync.broadcastEphemeral({ type: "presence", name: choice.name || "Player", color: choice.color });
    } catch (e) {}
  }
  function setupLobbySync(s) {
    if (!window.MTGTableSync) return;
    teardownLobbySync(); // idempotent: never capture our own wrapper as prev (avoids stacked handlers)
    lobbySync.active = true;
    lobbySync.prev = MTGTableSync.onEphemeral || null;
    MTGTableSync.onEphemeral = function (pl) {
      try { handleLobbyEphemeral(s, pl); } catch (e) {}
      if (lobbySync.prev) { try { lobbySync.prev(pl); } catch (e) {} }
    };
  }
  function teardownLobbySync() {
    if (!lobbySync.active) return;
    try { if (window.MTGTableSync) MTGTableSync.onEphemeral = lobbySync.prev; } catch (e) {}
    lobbySync.active = false; lobbySync.prev = null;
  }
  function handleLobbyEphemeral(s, pl) {
    if (!pl || !s) return;
    if (pl.type === "presence" && pl.name && pl.name !== choice.name) {
      var ppk = String(pl.name).slice(0, 24);
      var isNewPeer = !lobbyState.picks[ppk];
      if (isNewPeer) lobbyState.picks[ppk] = { name: ppk, color: typeof pl.color === "string" ? pl.color : "#4f7bf0", deck: null };
      renderPlayers(s);
      if (isNewPeer) { logLine(s, escapeHtml(ppk) + " joined the lobby."); broadcastPresence(); if (choice.locked) broadcastDeckPick(); if (isHost()) broadcastLobbyCfg(); }
      return;
    }
    if (pl.type === "deckpick" && pl.name && pl.name !== choice.name) {
      var key = String(pl.name).slice(0, 24);
      var first = !lobbyState.picks[key];
      var prevDeck = !first && lobbyState.picks[key].deck ? lobbyState.picks[key].deck.name : null;
      lobbyState.picks[key] = { name: key, color: typeof pl.color === "string" ? pl.color : "#4f7bf0", deck: pl.deck || null };
      renderPlayers(s);
      var dn = (pl.deck && pl.deck.name) || "a deck";
      if (first || prevDeck !== dn) logLine(s, escapeHtml(key) + " locked in <b>" + escapeHtml(dn) + "</b>.");
      if (first) { broadcastDeckPick(); if (isHost()) broadcastLobbyCfg(); } // one echo so newcomers see existing picks
    } else if (pl.type === "lobbycfg" && !isHost()) {
      var on = !!pl.preconsOnly;
      if (on !== lobbyCfg.preconsOnly) {
        lobbyCfg.preconsOnly = on;
        applyPreconsOnly(s);
        logLine(s, "Host turned Precons only <b>" + (on ? "on" : "off") + "</b>.");
      }
    }
  }

  // ---- precon picker: EVERY WotC Commander precon (MTGJSON catalog via precons.js) ----
  function fetchJsonRelay(url) {
    if (typeof window.deckFetchJsonWithRelay === "function") {
      try { return Promise.resolve(window.deckFetchJsonWithRelay(url)); } catch (e) {}
    }
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  function mtgjsonToPaste(data) {
    var lines = [], commander = "";
    var cmd = data.commander || [];
    if (cmd.length) {
      lines.push("Commander");
      cmd.forEach(function (c) {
        if (!c || !c.name) return;
        var nm = String(c.name).split(" // ")[0].trim();
        if (!commander) commander = nm;
        lines.push(Math.max(1, Number(c.count) || 1) + " " + nm);
      });
      lines.push("");
    }
    lines.push("Deck");
    (data.mainBoard || []).forEach(function (c) {
      if (!c || !c.name) return;
      lines.push(Math.max(1, Number(c.count) || 1) + " " + String(c.name).split(" // ")[0].trim());
    });
    return { text: lines.join("\n"), commander: commander };
  }

  function openPreconPicker(s) {
    var ov = eln("div", "ps-prec-ov");
    ov.innerHTML =
      '<div class="ps-prec-panel">' +
        '<div class="ps-prec-head"><h3>Commander precons</h3><span id="psPrecCount"></span>' +
          '<input id="psPrecSearch" type="text" placeholder="Search deck, commander, or set…" />' +
          '<button type="button" class="ps-prec-x" id="psPrecX" aria-label="Close">' + (window.MTGIcons ? MTGIcons.get("close", "1em") : "") + '</button></div>' +
        '<div class="ps-prec-list" id="psPrecList"><p class="ps-prec-note">Loading every WotC Commander precon…</p></div>' +
      '</div>';
    shell.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector("#psPrecX").onclick = function () { ov.remove(); };
    var listEl = ov.querySelector("#psPrecList"), countEl = ov.querySelector("#psPrecCount");
    var all = [];
    function paint(q) {
      q = String(q || "").toLowerCase();
      var data = all.filter(function (p) {
        if (!q) return true;
        return String(p.name || "").toLowerCase().indexOf(q) !== -1 ||
          String(p.setName || "").toLowerCase().indexOf(q) !== -1 ||
          String(p.commanderName || "").toLowerCase().indexOf(q) !== -1;
      });
      countEl.textContent = data.length + " deck" + (data.length === 1 ? "" : "s");
      listEl.innerHTML = data.length ? "" : '<p class="ps-prec-note">No precons match.</p>';
      var frag = document.createDocumentFragment();
      data.slice(0, 400).forEach(function (p) {
        var row = eln("button", "ps-prec-row"); row.type = "button";
        var avImg = p.commanderName ? '<img loading="lazy" src="https://api.scryfall.com/cards/named?exact=' + encodeURIComponent(p.commanderName) + '&format=image&version=art_crop" alt="">' : '';
        row.innerHTML = '<span class="ps-pr-av">' + avImg + '</span>' +
          '<span class="ps-pr-nm"><b>' + escapeHtml(p.name) + '</b>' +
          (p.commanderName ? '<i>' + escapeHtml(p.commanderName) + '</i>' : '') + '</span>' +
          '<span class="ps-pr-set">' + escapeHtml(p.setName || p.set || "") + (p.year ? " · " + p.year : "") + '</span>' +
          '<span class="ps-pr-go">Select ›</span>';
        var _im = row.querySelector(".ps-pr-av img"); if (_im) _im.onerror = function () { this.style.display = "none"; };
        row.onclick = function () { choosePrecon(s, p, row, ov); };
        frag.appendChild(row);
      });
      listEl.appendChild(frag);
      if (data.length > 400) listEl.appendChild(eln("p", "ps-prec-note", (data.length - 400) + " more — refine your search."));
    }
    ov.querySelector("#psPrecSearch").addEventListener("input", function () { paint(this.value); });
    if (window.MTGPreconsUI && MTGPreconsUI._loadCatalog) {
      MTGPreconsUI._loadCatalog().then(function (cat) {
        all = (cat && cat.decks) ? cat.decks.slice() : [];
        // bundled featured precons carry commander names + offline lists — surface them first
        try {
          var bundledList = Array.isArray(window.MTGPrecons) ? window.MTGPrecons : [];
          var names = {};
          bundledList.forEach(function (p) { names[String(p.name).toLowerCase()] = 1; });
          all = bundledList.concat(all.filter(function (p) { return !names[String(p.name).toLowerCase()]; }));
        } catch (e) {}
        paint(ov.querySelector("#psPrecSearch").value);
      }, function () {
        listEl.innerHTML = '<p class="ps-prec-note">Couldn\'t load the precon catalog (offline?).</p>';
      });
    } else {
      listEl.innerHTML = '<p class="ps-prec-note">The precon catalog isn\'t loaded on this page.</p>';
    }
  }

  function upsertSpecialTile(s, tile) {
    var i = -1;
    deckTiles.forEach(function (t, k) { if (t.id === tile.id) i = k; });
    if (i >= 0) deckTiles[i] = tile; else deckTiles.unshift(tile);
    paintDeckGrid(s);
    selectTile(s, tile.id);
    if (tile.commander && !tile.art) fetchCommanderArt(tile, s);
  }

  function choosePrecon(s, p, row, ov) {
    var go = row.querySelector(".ps-pr-go");
    var finish = function (paste, commander) {
      upsertSpecialTile(s, {
        id: "precon", kind: "precon", ref: { paste: paste },
        name: p.name, commander: commander || p.commanderName || "", art: "", bracket: 2 // precons are Bracket 2 by definition
      });
      ov.remove();
      logLine(s, 'Precon selected: <b>' + escapeHtml(p.name) + '</b> — press Lock In.');
    };
    if (p.fileName) {
      if (go) go.textContent = "Fetching…";
      fetchJsonRelay("https://mtgjson.com/api/v5/decks/" + p.fileName + ".json").then(function (res) {
        var data = res && res.data ? res.data : res;
        if (!data) { if (go) go.textContent = "Failed — retry"; return; }
        var pc = mtgjsonToPaste(data);
        finish(pc.text, pc.commander);
      }, function () { if (go) go.textContent = "Failed — retry"; });
    } else if (p.decklist) {
      finish(String(p.decklist), p.commanderName || "");
    } else if (go) { go.textContent = "Unavailable"; }
  }

  function fetchCommanderArt(tile, s) {
    try {
      fetch("https://api.scryfall.com/cards/named?fuzzy=" + encodeURIComponent(tile.commander))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (card) {
          if (!card) return;
          var art = artFromCard(card);
          if (!art) return;
          tile.art = art;
          var span = s.querySelector('.ps-deck-tile[data-tile="' + tile.id + '"] .ps-dt-art');
          if (span) { span.style.backgroundImage = 'url("' + String(art).replace(/"/g, "") + '")'; span.removeAttribute("data-empty"); }
        })
        .catch(function () {});
    } catch (e) {}
  }

  // ---- deck-link import (Moxfield / Archidekt / ManaBox) — collapsed behind a button ----
  var MANABOX_HINT = "ManaBox has no public deck API — in ManaBox open the deck, tap Share → Export decklist, then paste the list below.";

  function cardsToPaste(cards) {
    var cmd = [], main = [], commander = "";
    (cards || []).forEach(function (c) {
      if (!c || !c.name) return;
      var line = Math.max(1, Number(c.qty) || 1) + " " + c.name;
      if (c.isCommander) { cmd.push(line); if (!commander) commander = c.name; } else main.push(line);
    });
    var lines = [];
    if (cmd.length) { lines.push("Commander"); lines.push.apply(lines, cmd); lines.push(""); }
    lines.push("Deck"); lines.push.apply(lines, main);
    return { text: lines.join("\n"), commander: commander };
  }

  function importFromLink(input, done) {
    var url = String(input || "").trim();
    if (/manabox\.app\/decks\//i.test(url)) return importManabox(url, done);
    if (typeof window.MTGDeckUrlImport !== "function") return done("Deck link import isn't available on this page.");
    Promise.resolve(window.MTGDeckUrlImport(url)).then(function (res) {
      if (!res || !res.cards || !res.cards.length) return done("Couldn't fetch that deck (it may be private). Paste the exported decklist below instead.");
      var pc = cardsToPaste(res.cards);
      done(null, { name: res.name || "Imported deck", paste: pc.text, commander: pc.commander });
    }, function () { done("Couldn't fetch that deck. Paste the exported decklist below instead."); });
  }

  function importManabox(url, done) {
    var id = (url.match(/manabox\.app\/decks\/([A-Za-z0-9_-]+)/i) || [])[1];
    if (!id || typeof window.deckFetchJsonWithRelay !== "function") return done(MANABOX_HINT);
    Promise.resolve(window.deckFetchJsonWithRelay("https://cloud.manabox.app/decks/" + encodeURIComponent(id))).then(function (data) {
      var mb = manaboxToCards(data);
      if (!mb || !mb.cards.length) return done(MANABOX_HINT);
      var pc = cardsToPaste(mb.cards);
      done(null, { name: mb.name || "ManaBox deck", paste: pc.text, commander: pc.commander });
    }, function () { done(MANABOX_HINT); });
  }

  // Defensive mapper — ManaBox's cloud payload isn't documented, so scan for card-ish arrays.
  function manaboxToCards(data) {
    if (!data || typeof data !== "object") return null;
    var name = data.name || (data.deck && data.deck.name) || "";
    var out = [];
    function grab(arr, isCmd) {
      if (!Array.isArray(arr)) return;
      arr.forEach(function (e) {
        if (!e) return;
        var nm = e.name || (e.card && e.card.name) || "";
        if (!nm) return;
        var qty = Number(e.quantity != null ? e.quantity : e.count) || 1;
        var cat = String(e.category || e.zone || e.board || "").toLowerCase();
        out.push({ name: String(nm).split(" // ")[0].trim(), qty: qty, isCommander: isCmd || cat.indexOf("commander") !== -1 });
      });
    }
    grab(data.commanders || (data.deck && data.deck.commanders), true);
    grab(data.cards || data.mainboard || (data.deck && data.deck.cards), false);
    if (!out.length) {
      for (var k in data) {
        if (Array.isArray(data[k]) && data[k].length && data[k][0] && (data[k][0].name || (data[k][0].card && data[k][0].card.name))) { grab(data[k], false); break; }
      }
    }
    return { name: name, cards: out };
  }

  function buildImportPanel(s, w) {
    w.innerHTML =
      '<label for="psImpUrl">Import from a link — Moxfield, Archidekt, or ManaBox</label>' +
      '<div class="ps-imp-row"><input id="psImpUrl" type="text" placeholder="https://moxfield.com/decks/… · https://archidekt.com/decks/… · https://manabox.app/decks/…" />' +
      '<button type="button" id="psImpGo">Import</button></div>' +
      '<p class="ps-imp-msg" id="psImpMsg" hidden></p>' +
      '<textarea id="psImpPaste" spellcheck="false" placeholder="…or paste a decklist (put a &quot;Commander&quot; line above your commander)&#10;Commander&#10;1 Atraxa, Praetors&#39; Voice&#10;&#10;1 Sol Ring"></textarea>' +
      '<button type="button" class="ps-import-go" id="psImpPasteGo">Use pasted list</button>';
    var msg = w.querySelector("#psImpMsg");
    function note(t, isErr) { msg.hidden = false; msg.textContent = t; msg.classList.toggle("err", !!isErr); }
    w.querySelector("#psImpGo").onclick = function () {
      var url = (w.querySelector("#psImpUrl").value || "").trim();
      if (!url) { w.querySelector("#psImpUrl").focus(); return; }
      var btn = this; btn.disabled = true; btn.textContent = "Fetching…";
      importFromLink(url, function (err, deck) {
        btn.disabled = false; btn.textContent = "Import";
        if (err || !deck) { note(err || "Couldn't import that link.", true); return; }
        msg.hidden = true;
        addImportTile(s, deck);
      });
    };
    w.querySelector("#psImpPasteGo").onclick = function () {
      var t = (w.querySelector("#psImpPaste").value || "").trim();
      if (!t) { w.querySelector("#psImpPaste").focus(); return; }
      var commander = "";
      try {
        if (window.MTGPreconsUI && MTGPreconsUI._parseDeckText) {
          var cs = MTGPreconsUI._parseDeckText(t);
          cs.some(function (c) { if (c.board === "commanders") { commander = c.name; return true; } return false; });
        }
      } catch (e) {}
      addImportTile(s, { name: "Pasted deck", paste: t, commander: commander });
    };
  }

  function addImportTile(s, deck) {
    upsertSpecialTile(s, {
      id: "import", kind: "import", ref: { paste: deck.paste },
      name: deck.name || "Imported deck", commander: deck.commander || "", art: "", bracket: null
    });
    logLine(s, 'Imported <b>' + escapeHtml(deck.name || "deck") + '</b> — press Lock In.');
  }

  // ============================== PLAYMAT + DRAFT + GAME ==============================
  function chooseDeck(ref) {
    choice.deck = ref;
    buildPlaymat();
    show("playmat");
  }

  function buildPlaymat() {
    if (screens.playmat) { shell.removeChild(screens.playmat); delete screens.playmat; }
    var mats = [];
    try { if (window.MTGTable && MTGTable.playmats) mats = MTGTable.playmats() || []; } catch (e) { mats = []; }
    var s = eln("div", "ps-screen ps-mat");
    s.innerHTML =
      '<div class="ps-mat-modal">' +
        '<div class="ps-mat-head"><h2>Select your playmat</h2><button class="ps-mat-x" id="psMatX" type="button" aria-label="Back">' + (window.MTGIcons ? MTGIcons.get("close", "1em") : "") + '</button></div>' +
        '<div class="ps-mat-tabs" id="psMatTabs"><button data-t="colors" class="on" type="button">Colors</button><button data-t="art" type="button">MTG art</button><button data-t="upload" type="button">Upload</button></div>' +
        '<div class="ps-mat-grid" id="psMatGrid"></div>' +
        '<div class="ps-mat-upload" id="psMatUpload" hidden><input id="psMatUrl" type="text" placeholder="Paste an image URL (https://…)" />' +
          '<button id="psMatUrlGo" type="button">Use image</button></div>' +
        '<div class="ps-mat-foot"><button class="ps-mat-cancel" id="psMatCancel" type="button">‹ Back</button>' +
          '<button class="ps-mat-go" id="psMatGo" type="button">Select &amp; Place ›</button></div>' +
      '</div>';
    screens.playmat = s; shell.appendChild(s);

    var gridEl = s.querySelector("#psMatGrid"), upload = s.querySelector("#psMatUpload"), artLoaded = false;
    choice.mat = mats.length ? mats[0].css : null;
    function selectCell(cell, css) { choice.mat = css; Array.prototype.forEach.call(gridEl.querySelectorAll(".ps-mat-card"), function (x) { x.setAttribute("aria-pressed", x === cell ? "true" : "false"); }); }
    function showColors() {
      gridEl.hidden = false; upload.hidden = true;
      gridEl.innerHTML = mats.map(function (m) { return '<button class="ps-mat-card" type="button" aria-pressed="' + (m.css === choice.mat ? "true" : "false") + '" style="background:' + m.css + '"><span class="ps-mat-name">' + escapeHtml(m.name) + '</span></button>'; }).join("");
      Array.prototype.forEach.call(gridEl.querySelectorAll(".ps-mat-card"), function (b, i) { b.onclick = function () { selectCell(b, mats[i].css); }; });
    }
    function showArt() {
      upload.hidden = true; gridEl.hidden = false;
      if (artLoaded) return; artLoaded = true;
      gridEl.innerHTML = '<p class="ps-mat-loading">Loading MTG art…</p>';
      fetch("https://api.scryfall.com/cards/search?unique=art&order=released&dir=desc&q=" + encodeURIComponent("is:fullart type:land")).then(function (r) { return r.json(); }).then(function (j) {
        var data = (j && j.data) || []; if (!data.length) { gridEl.innerHTML = '<p class="ps-mat-loading">No art found.</p>'; return; }
        gridEl.innerHTML = "";
        data.slice(0, 24).forEach(function (card) {
          var u = card.image_uris || (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris) || {};
          var art = u.art_crop; if (!art) return;
          var css = 'url("' + art + '") center/cover no-repeat, #0b1322';
          var b = eln("button", "ps-mat-card"); b.type = "button"; b.style.background = css; b.setAttribute("aria-pressed", "false");
          b.innerHTML = '<span class="ps-mat-name">' + escapeHtml(card.name) + '</span>';
          b.onclick = function () { selectCell(b, css); };
          gridEl.appendChild(b);
        });
      }).catch(function () { gridEl.innerHTML = '<p class="ps-mat-loading">Couldn\'t load art.</p>'; });
    }
    Array.prototype.forEach.call(s.querySelectorAll("#psMatTabs button"), function (b) {
      b.onclick = function () {
        Array.prototype.forEach.call(s.querySelectorAll("#psMatTabs button"), function (x) { x.classList.toggle("on", x === b); });
        if (b.dataset.t === "colors") showColors(); else if (b.dataset.t === "art") showArt(); else { gridEl.hidden = true; upload.hidden = false; }
      };
    });
    showColors();

    s.querySelector("#psMatUrlGo").onclick = function () {
      var u = (s.querySelector("#psMatUrl").value || "").trim();
      if (!/^https?:/i.test(u)) { s.querySelector("#psMatUrl").focus(); return; }
      choice.mat = 'url("' + u.replace(/"/g, "") + '") center/cover no-repeat, #111827';
      s.querySelector("#psMatGo").click();
    };
    s.querySelector("#psMatX").onclick = function () { show("lobby"); };
    s.querySelector("#psMatCancel").onclick = function () { show("lobby"); };
    s.querySelector("#psMatGo").onclick = function () {
      try { if (choice.mat && window.MTGTable && MTGTable.applyPlaymat) MTGTable.applyPlaymat(choice.mat); } catch (e) {}
      buildDraftSelect(); show("draft");
    };
  }

  // ---- MOBA-style draft-select: pick your Commander bracket (B1–B5) with an Upper/Lower half.
  // Colorized per bracket; when online, your pick is broadcast and opponents' picks surface here.
  function buildDraftSelect() {
    if (screens.draft) { shell.removeChild(screens.draft); delete screens.draft; }
    if (choice.deckMeta && choice.deckMeta.bracket) choice.bracket = Math.min(5, Math.max(1, Number(choice.deckMeta.bracket))); else if (choice.bracket == null) choice.bracket = 2;
    if (choice.bracketHalf == null) choice.bracketHalf = "L";
    var s = eln("div", "ps-screen ps-draft");
    s.innerHTML =
      '<div class="ps-draft-modal">' +
        '<div class="ps-draft-head"><h2>Declare your bracket</h2>' +
          '<p>Lock in your deck’s power bracket so the pod knows what it’s facing. ' +
          'Pick a half — <b>Lower</b> (safer) or <b>Upper</b> (pushed) — within each bracket.</p></div>' +
        '<div class="ps-bracket-circle" id="psBrCircle"></div>' +
        '<div class="ps-bracket-half" id="psBrHalf">' +
          '<button type="button" data-h="L" class="on">Lower half</button>' +
          '<button type="button" data-h="U">Upper half</button>' +
        '</div>' +
        '<div class="ps-draft-pick" id="psBrPick"></div>' +
        '<div class="ps-draft-oppo" id="psBrOppo" hidden><h3>Pod picks</h3><div class="ps-oppo-list" id="psOppoList"></div></div>' +
        '<div class="ps-draft-foot"><button class="ps-draft-back" id="psDraftBack" type="button">‹ Back</button>' +
          '<button class="ps-draft-go" id="psDraftGo" type="button">Lock In ›</button></div>' +
      '</div>';
    screens.draft = s; shell.appendChild(s);

    var circle = s.querySelector("#psBrCircle"), pick = s.querySelector("#psBrPick");
    function label() { return choice.bracketHalf + choice.bracket; }
    function renderPick() {
      var b = BRACKETS[choice.bracket - 1];
      pick.innerHTML = '<span class="ps-pick-badge" style="background:linear-gradient(135deg,' + b.c1 + ',' + b.c2 + ')">' + label() + '</span>' +
        '<div class="ps-pick-tx"><b>Bracket ' + b.n + ' · ' + b.name + '</b><i>' + (choice.bracketHalf === "U" ? "Upper half — " : "Lower half — ") + b.desc + '</i></div>';
    }
    function renderCircle() {
      circle.innerHTML = BRACKETS.map(function (b) {
        var on = b.n === choice.bracket;
        return '<button type="button" class="ps-br-node' + (on ? " on" : "") + '" data-b="' + b.n + '" ' +
          'style="--c1:' + b.c1 + ';--c2:' + b.c2 + '"><span class="ps-br-n">' + choice.bracketHalf + b.n + '</span>' +
          '<span class="ps-br-nm">' + b.name + '</span></button>';
      }).join("");
      Array.prototype.forEach.call(circle.querySelectorAll(".ps-br-node"), function (node) {
        node.onclick = function () { choice.bracket = parseInt(node.dataset.b, 10); renderCircle(); renderPick(); broadcastPick(); };
      });
    }
    Array.prototype.forEach.call(s.querySelectorAll("#psBrHalf button"), function (b) {
      b.onclick = function () {
        choice.bracketHalf = b.dataset.h;
        Array.prototype.forEach.call(s.querySelectorAll("#psBrHalf button"), function (x) { x.classList.toggle("on", x === b); });
        renderCircle(); renderPick(); broadcastPick();
      };
    });
    renderCircle(); renderPick();
    setupOppoSync(s);

    s.querySelector("#psDraftBack").onclick = function () { teardownOppoSync(); show("playmat"); };
    s.querySelector("#psDraftGo").onclick = function () {
      broadcastPick(); teardownOppoSync();
      try { if (window.MTGTable && MTGTable.setBracket) MTGTable.setBracket(label()); } catch (e) {}
      launchGame();
    };
  }

  // Best-effort pod bracket sync: broadcast my pick, surface others' — never clobbers in-game ephemerals.
  var oppoState = { picks: {}, prevHandler: null, active: false };
  function broadcastPick() {
    try {
      if (!choice.online || !window.MTGTableSync || !MTGTableSync.broadcastEphemeral) return;
      MTGTableSync.broadcastEphemeral({ type: "bracket", name: choice.name || "Player", color: choice.color, pick: (choice.bracketHalf || "L") + (choice.bracket || 2) });
    } catch (e) {}
  }
  function renderOppo(s) {
    var wrap = s.querySelector("#psBrOppo"), list = s.querySelector("#psOppoList");
    var keys = Object.keys(oppoState.picks);
    if (!keys.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    list.innerHTML = keys.map(function (k) {
      var p = oppoState.picks[k];
      return '<span class="ps-oppo-chip"><i style="background:' + escapeAttr(p.color || "#4f7bf0") + '"></i>' + escapeHtml(p.name) + ' <b>' + escapeHtml(p.pick) + '</b></span>';
    }).join("");
  }
  function setupOppoSync(s) {
    if (!choice.online || !window.MTGTableSync) return;
    teardownOppoSync(); // idempotent: never capture our own wrapper as prevHandler (avoids stacked handlers)
    oppoState.active = true; oppoState.picks = {};
    oppoState.prevHandler = MTGTableSync.onEphemeral || null;
    MTGTableSync.onEphemeral = function (pl) {
      try { if (pl && pl.type === "bracket") { oppoState.picks[pl.name || Math.random()] = pl; renderOppo(s); } } catch (e) {}
      if (oppoState.prevHandler) { try { oppoState.prevHandler(pl); } catch (e) {} }
    };
    broadcastPick();
  }
  function teardownOppoSync() {
    if (!oppoState.active) return;
    try { if (window.MTGTableSync) MTGTableSync.onEphemeral = oppoState.prevHandler; } catch (e) {}
    oppoState.active = false; oppoState.prevHandler = null;
  }

  function launchGame() {
    if (shell) shell.classList.remove("active");
    document.body.classList.add("play-fs");
    if (window.MTGHUD) MTGHUD.show(); else { showLeave(); showTracker(); }
    try {
      if (window.MTGTable && MTGTable.start) {
        var m = modeMeta(choice.mode || "commander");
        var ref = {}; var d = choice.deck || {};
        for (var k in d) ref[k] = d[k];
        ref.mode = m.key; ref.life = m.life || 40;
        var p = MTGTable.start(ref);
        if (p && p.then) p.then(afterStart, afterStart);
        else setTimeout(afterStart, 500);
      }
    } catch (e) {}
  }
  function afterStart() {
    try { if (window.MTGTable && MTGTable.setName && choice.name) MTGTable.setName(choice.name); } catch (e) {}
    if (choice.online && window.MTGTable) {
      if (choice.joinCode && MTGTable.join) { try { MTGTable.join(choice.joinCode); } catch (e) {} }
      else if (choice.hostedCode && MTGTable.persistMyDeck) { try { MTGTable.persistMyDeck().then(function () { showInvite(choice.hostedCode); }, function () { showInvite(choice.hostedCode); }); } catch (e) {} }
      else if (MTGTable.host) { try { MTGTable.host({ visibility: "private", name: choice.name }).then(function (code) { if (code) showInvite(code); }, function () {}); } catch (e) {} }
    }
    openingHand();
  }

  var inviteEl = null;
  function showInvite(code) {
    var page = document.getElementById("playPage"); if (!page) return;
    if (!inviteEl) { inviteEl = eln("div", "ps-invite"); inviteEl.id = "psInvite"; page.appendChild(inviteEl); }
    inviteEl.innerHTML = '<span>Online game live — share code <b>' + escapeHtml(code) + '</b></span><button id="psInviteCopy" type="button">Copy link</button>';
    inviteEl.style.display = "";
    inviteEl.querySelector("#psInviteCopy").onclick = function () {
      var link = location.origin + location.pathname + "?join=" + encodeURIComponent(code);
      try { if (navigator.clipboard) navigator.clipboard.writeText(link); } catch (e) {}
      this.textContent = "Copied!";
    };
  }
  function hideInvite() { if (inviteEl) inviteEl.style.display = "none"; }

  // ---- opening hand / mulligan (img 7) ----
  var ohEl = null, ohPolls = 0;
  function openingHand() {
    ohPolls = 0;
    if (!ohEl) {
      ohEl = eln("div", "ps-oh"); ohEl.id = "psOpeningHand";
      (document.getElementById("playPage") || document.body).appendChild(ohEl);
    }
    ohEl.style.display = "";
    try { document.body.classList.add("oh-open"); } catch (e) {}   // hide the life hub / bars beneath the modal (mobile stacking)
    renderOpeningHand();
  }
  function renderOpeningHand() {
    if (!ohEl || ohEl.style.display === "none") return;
    var hand = [];
    try { if (window.MTGTable && MTGTable.hand) hand = MTGTable.hand() || []; } catch (e) { hand = []; }
    var cards = hand.map(function (c) {
      return '<div class="ps-oh-card">' + (c.img ? '<img src="' + escapeAttr(c.img) + '" alt="' + escapeAttr(c.name) + '"/>' : '<div class="ps-oh-ph">' + escapeHtml(c.name) + '</div>') + '</div>';
    }).join("");
    ohEl.innerHTML =
      '<div class="ps-oh-modal">' +
        '<p class="ps-oh-kicker">Mulligan</p><h2 class="ps-oh-title">Opening Hand</h2>' +
        '<div class="ps-oh-cards">' + (cards || '<p class="ps-oh-wait">Shuffling your deck…</p>') + '</div>' +
        '<div class="ps-oh-actions"><button class="ps-oh-keep" id="psOhKeep" type="button">' + (window.MTGIcons ? MTGIcons.get("check", "1em") : "") + ' Keep hand</button>' +
          '<button class="ps-oh-mull" id="psOhMull" type="button">' + (window.MTGIcons ? MTGIcons.get("refresh", "1em") : "") + ' Mulligan</button></div>' +
        '<p class="ps-oh-note">Mulligan shuffles your hand back and draws 7 new cards. The first mulligan is free.</p>' +
      '</div>';
    ohEl.querySelector("#psOhKeep").onclick = closeOpeningHand;
    ohEl.querySelector("#psOhMull").onclick = function () {
      try { if (window.MTGTable && MTGTable.mulligan) MTGTable.mulligan(); } catch (e) {}
      ohPolls = 0; setTimeout(renderOpeningHand, 350);
    };
    if (ohPolls < 10) {
      var missing = hand.length === 0 || hand.some(function (c) { return !c.img; });
      if (missing) { ohPolls++; setTimeout(renderOpeningHand, 500); }
    }
  }
  function closeOpeningHand() { if (ohEl) ohEl.style.display = "none"; try { document.body.classList.remove("oh-open"); } catch (e) {} }

  // ---- floating Leave button (header is hidden in full-screen) ----
  function showLeave() {
    if (!leaveBtn) {
      var page = document.getElementById("playPage"); if (!page) return;
      leaveBtn = eln("button", "ps-leave"); leaveBtn.type = "button"; leaveBtn.innerHTML = "‹ Lobby";
      leaveBtn.title = "Back to lobby";
      leaveBtn.addEventListener("click", backToLobby);
      page.appendChild(leaveBtn);
    }
    leaveBtn.style.display = "";
  }
  function hideLeave() { if (leaveBtn) leaveBtn.style.display = "none"; }
  function backToLobby() {
    document.body.classList.add("play-fs");
    ensureShell(); if (shell) shell.classList.add("active");
    teardownOppoSync(); // leaving the draft back to the lobby must drop the bracket-sync handler
    hideLeave(); hideTracker(); hideInvite(); if (window.MTGHUD) MTGHUD.hide();
    if (screens.lobby) { setupLobbySync(screens.lobby); renderPlayers(screens.lobby); }
    show(screens.lobby ? "lobby" : "mode");
  }

  // ---- pull-up quick-add counter tracker (img 8) ----
  var trackBtn = null, trackPanel = null;
  var QUICK_COUNTERS = ["+1/+1", "-1/-1", "poison", "energy", "experience", "charge", "loyalty", "stun", "shield", "oil", "rad"];
  function showTracker() {
    if (!trackBtn) {
      var page = document.getElementById("playPage"); if (!page) return;
      trackBtn = eln("button", "ps-track-btn"); trackBtn.type = "button"; trackBtn.innerHTML = '<span class="msym" style="margin:0 5px 0 0;font-size:16px;vertical-align:-3px">add</span>Counters';
      trackBtn.title = "Quick-add counters";
      trackBtn.addEventListener("click", toggleTracker);
      page.appendChild(trackBtn);
    }
    trackBtn.style.display = "";
  }
  function hideTracker() { if (trackBtn) trackBtn.style.display = "none"; if (trackPanel) trackPanel.style.display = "none"; }
  function toggleTracker() {
    if (!trackPanel) buildTrackerPanel();
    trackPanel.style.display = trackPanel.style.display === "block" ? "none" : "block";
  }
  function buildTrackerPanel() {
    var page = document.getElementById("playPage") || document.body;
    trackPanel = eln("div", "ps-track"); trackPanel.id = "psTracker";
    var rows = QUICK_COUNTERS.map(function (k) {
      return '<div class="ps-track-row"><span class="ps-track-k">' + escapeHtml(k) + '</span>' +
        '<button class="ps-track-step" data-k="' + escapeAttr(k) + '" data-d="-1" aria-label="minus">−</button>' +
        '<button class="ps-track-step" data-k="' + escapeAttr(k) + '" data-d="1" aria-label="plus">+</button></div>';
    }).join("");
    trackPanel.innerHTML =
      '<div class="ps-track-head"><b>Quick counters</b><button class="ps-track-x" id="psTrackX" type="button" aria-label="Close">' + (window.MTGIcons ? MTGIcons.get("close", "1em") : "") + '</button></div>' +
      '<div class="ps-track-body">' + rows + '</div>' +
      '<div class="ps-track-add"><input id="psTrackNew" type="text" placeholder="Add a counter…" maxlength="18" /><button id="psTrackNewGo" type="button">Add +1</button></div>';
    page.appendChild(trackPanel);
    trackPanel.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]"); if (!b) return;
      try { if (window.MTGTable && MTGTable.addCounter) MTGTable.addCounter(b.dataset.k, Number(b.dataset.d)); } catch (err) {}
    });
    trackPanel.querySelector("#psTrackX").onclick = function () { trackPanel.style.display = "none"; };
    trackPanel.querySelector("#psTrackNewGo").onclick = function () {
      var inp = trackPanel.querySelector("#psTrackNew"), k = (inp.value || "").trim();
      if (!k) { inp.focus(); return; }
      try { if (window.MTGTable && MTGTable.addCounter) MTGTable.addCounter(k, 1); } catch (err) {}
      inp.value = "";
    };
  }

  // ---- wiring ----
  function wire() {
    var btn = document.getElementById("playTabButton");
    if (btn) btn.addEventListener("click", function () { open(); });
    document.querySelectorAll('[data-page-target]').forEach(function (b) { b.addEventListener("click", close); });

    var jcode = (location.search.match(/[?&]join=([^&]+)/) || [])[1];
    if (jcode) {
      var runJoin = function () { try { openForJoin(decodeURIComponent(jcode)); } catch (e) {} };
      // Run AFTER the app's initial hash-routing (which would otherwise leave us on Home).
      if (document.readyState === "complete") setTimeout(runJoin, 80);
      else window.addEventListener("load", function () { setTimeout(runJoin, 80); });
    }

    // Deck-builder's "Play this deck" jumps straight into a game — give it the same full-screen treatment.
    if (window.MTGTable && typeof window.MTGTable.playDeck === "function") {
      var orig = window.MTGTable.playDeck;
      window.MTGTable.playDeck = function () {
        ensureShell();
        if (shell) shell.classList.remove("active");
        document.body.classList.add("play-fs");
        if (window.MTGHUD) MTGHUD.show(); else { showLeave(); showTracker(); }
        var r = orig.apply(this, arguments);
        setTimeout(function () { openingHand(); }, 900);
        return r;
      };
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();

  window.MTGPlayShell = { open: open, close: close, backToLobby: backToLobby };
})();
