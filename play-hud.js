/*
 * play-hud.js — the in-game "windows taskbar" HUD for the Play tab (Kiku-style).
 * A single sleek pill taskbar (turn + timer + icon buttons) plus pop-up windows:
 *   • Roll Dice (coin / quick / custom)            • Trackers (toggles + counters) with a filter/add grid
 * Self-contained (like play-shell.js / keywords.js). Drives the existing game via window.MTGTable
 * (roll / addCounter / myCounters) and by clicking the existing hidden toolbar controls.
 */
(function () {
  "use strict";

  var bar = null, started = 0, timerEl = null, timerInt = null, dlg = {};

  function eln(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function svg(p) { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  var ICON = {
    lobby: svg('<path d="M15 18l-6-6 6-6"/>'),
    undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>'),
    untap: svg('<path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
    draw: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 8v6"/><path d="M9 11l3 3 3-3"/>'),
    mull: svg('<path d="M3 2v6h6"/><path d="M3.5 9a9 9 0 1 0 2-3.4"/>'),
    dice: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.1"/><circle cx="15.5" cy="15.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/><circle cx="8.5" cy="15.5" r="1.1"/>'),
    track: svg('<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="14" cy="18" r="2"/>'),
    log: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/><path d="M6 9h5M6 13h5"/><path d="M17 9h1M17 13h1"/>'),
    chat: svg('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3c-1.3 0-2.6-.3-3.7-.8L3 20l1.1-4.3A8.1 8.1 0 0 1 3.5 11.5 8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3z"/><path d="M8 10.5h8M8 13.5h5"/>'),
    voice: svg('<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="13" width="4.5" height="6.5" rx="2"/><rect x="17" y="13" width="4.5" height="6.5" rx="2"/><path d="M21.5 16v1.5a3 3 0 0 1-3 3H14"/>'),
    help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
    full: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
    close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    pass: svg('<path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/>'),
    pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    engine: svg('<rect x="4" y="4" width="16" height="16" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>'),
    coinH: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>'),
    coinT: svg('<circle cx="12" cy="12" r="9"/><path d="M8.4 12h7.2"/>')
  };

  // ---- clicking the existing (hidden) toolbar controls so we reuse their handlers ----
  function clickCtrl(id) { var b = document.getElementById(id); if (b) b.click(); }
  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) (document.documentElement.requestFullscreen || function () {}).call(document.documentElement);
      else (document.exitFullscreen || function () {}).call(document);
    } catch (e) {}
  }

  // ============================ TASKBAR ============================
  // G4.28 — Untap-all, Draw, Dice-roll and Mulligan removed from the bar (the turn engine auto-untaps
  // + draws at turn start; dice + mulligan live in the life cluster / opening-hand UI).
  var BTNS = [
    { ic: "lobby", cls: "hud-ic-leave", t: "Leave game (concedes the match)", fn: confirmLeave },
    { sep: 1 },
    { pill: 1, ic: "pass", tx: "End turn", t: "Pass turn — the next player auto-untaps and draws as their turn starts", fn: function () { clickCtrl("tblPass"); } },
    { ic: "undo", t: "Undo (z)", fn: function () { clickCtrl("tblUndo"); } },
    { sep: 1 },
    // G1.13 — the Trackers button moved into the bottom-left hub (play-life.js "Counters",
    // which calls MTGHUD.openTrackers); openTrackers stays exported below.
    { ic: "log", t: "Show / hide stack & action log", fn: function () { document.body.classList.toggle("hud-log-off"); } },
    { ic: "chat", t: "Text chat", fn: function () { if (window.MTGTable && MTGTable.toggleChat) MTGTable.toggleChat(); } },
    { ic: "voice", t: "Voice chat (join / leave)", fn: function () { if (window.MTGTable && MTGTable.toggleVoice) MTGTable.toggleVoice(); } },
    { sep: 1 },
    { ic: "full", t: "Fullscreen", fn: toggleFullscreen },
    { ic: "help", t: "Keywords & help", fn: function () { clickCtrl("keywordsButton"); } },
    { ic: "engine", tx: "E", t: "Rules engine (advisory)", fn: function () { if (window.MTGEngineAssistUI) MTGEngineAssistUI.toggle(); } },
    { ic: "settings", t: "Settings", fn: openSettings }
  ];

  function build() {
    if (bar) return;
    var page = document.getElementById("playPage") || document.body;
    bar = eln("div", "hud-bar"); bar.id = "hudBar";
    var turn = eln("div", "hud-turn"); turn.innerHTML = '<b id="hudTurnN">Turn 1</b><span id="hudTimer" class="hud-timer">0:00</span>';
    bar.appendChild(turn);
    timerEl = turn.querySelector("#hudTimer");
    BTNS.forEach(function (b) {
      if (b.sep) { bar.appendChild(eln("span", "hud-sep")); return; }
      var btn = eln("button", b.pill ? "hud-ic hud-pill" : "hud-ic"); btn.type = "button"; btn.title = b.t; btn.setAttribute("aria-label", b.t); if (b.cls) btn.classList.add(b.cls);
      btn.innerHTML = b.pill ? ((ICON[b.ic] || "") + '<span class="hud-pill-tx">' + b.tx + "</span>")
        : (b.tx ? ('<b class="hud-ic-tx">' + b.tx + '</b>') : (ICON[b.ic] || ""));
      btn.addEventListener("click", b.fn);
      bar.appendChild(btn);
    });
    page.appendChild(bar);
  }

  function startTimer() {
    started = Date.now();
    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(function () {
      if (!timerEl) return;
      var s = Math.floor((Date.now() - started) / 1000);
      timerEl.textContent = Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
      var tn = document.getElementById("hudTurnN");
      try { if (tn && window.MTGTable && MTGTable.getState) { var st = MTGTable.getState(); if (st && st.turn) tn.textContent = "Turn " + st.turn; } } catch (e) {}
    }, 1000);
  }

  function show() {
    build(); buildPins(); if (bar) bar.style.display = ""; renderPins(); startTimer();
    // G1 — the bottom-left life cluster (play-life.js) is self-triggering off body.play-fs, but
    // its MutationObserver races the async deck load. Drive it from the HUD's proven show/hide
    // (play-shell calls MTGHUD.show() the instant it enters full-screen play) so the cluster
    // always builds; play-life re-checks seats internally and retries until they exist.
    try { if (window.MTGLife && MTGLife.show) MTGLife.show(); } catch (e) {}
  }
  function hide() {
    if (bar) bar.style.display = "none"; if (pinEl) pinEl.style.display = "none"; if (timerInt) { clearInterval(timerInt); timerInt = null; } closeAll();
    try { if (window.MTGLife && MTGLife.hide) MTGLife.hide(); } catch (e) {}
  }
  function closeAll() { Object.keys(dlg).forEach(function (k) { if (dlg[k]) dlg[k].remove(); dlg[k] = null; }); }

  // ---- generic popup shell ----
  function popup(key, kicker, title, bodyHtml, withEdit) {
    if (dlg[key]) { dlg[key].remove(); dlg[key] = null; return null; }
    closeAll();
    var ov = eln("div", "hud-pop"); ov.id = "hudPop_" + key;
    ov.innerHTML =
      '<div class="hud-pop-card">' +
        '<div class="hud-pop-head"><div><p class="hud-pop-kick">' + esc(kicker) + '</p><h2 class="hud-pop-title">' + esc(title) + '</h2></div>' +
        '<div class="hud-pop-actions">' + (withEdit ? '<button class="hud-pop-edit" data-act="edit" type="button" aria-label="Edit">' + ICON.pencil + '</button>' : '') +
          '<button class="hud-pop-x" data-act="close" type="button" aria-label="Close">' + ICON.close + '</button></div></div>' +
        '<div class="hud-pop-body">' + bodyHtml + '</div>' +
      '</div>';
    ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest('[data-act="close"]')) { ov.remove(); dlg[key] = null; } });
    (document.getElementById("playPage") || document.body).appendChild(ov);
    dlg[key] = ov;
    return ov;
  }

  // ---- leave game = concede (warn, set my life to 0, then back to lobby) ----
  function confirmLeave() {
    var body =
      '<p class="hud-leave-warn">Leaving the game will <b>concede the match</b> — your life is set to <b>0</b> and you return to the lobby. This can\'t be undone.</p>' +
      '<div class="hud-leave-row">' +
        '<button class="hud-leave-yes" data-act="leaveyes" type="button">Concede &amp; leave</button>' +
        '<button class="hud-leave-no" data-act="leaveno" type="button">Stay in game</button>' +
      '</div>';
    var ov = popup("leave", "Leave game", "Are you sure?", body, false);
    if (!ov) return;
    function shut() { if (dlg.leave) { dlg.leave.remove(); dlg.leave = null; } }
    ov.querySelector('[data-act="leaveno"]').onclick = shut;
    ov.querySelector('[data-act="leaveyes"]').onclick = function () {
      try {
        var T = window.MTGTable;
        if (T && typeof T.seatsInfo === "function") {
          var meS = (T.seatsInfo() || []).filter(function (s) { return s && s.isMe; })[0];
          if (meS && (Number(meS.life) || 0) > 0 && typeof T.applyLife === "function") T.applyLife(meS.seat, -(Number(meS.life) || 0));
        }
      } catch (e) {}
      shut();
      if (window.MTGPlayShell && MTGPlayShell.backToLobby) MTGPlayShell.backToLobby();
    };
  }

  // ============================ ROLL DICE (img 1) ============================
  function openDice() {
    var body =
      '<div class="hud-sec"><p class="hud-sec-h">Coin flip</p><div class="hud-row2">' +
        '<button class="hud-big" data-roll="Coin" type="button">' + ICON.coinH + ' Heads</button>' +
        '<button class="hud-big" data-roll="Coin" type="button">' + ICON.coinT + ' Tails</button></div></div>' +
      '<div class="hud-sec"><p class="hud-sec-h">Quick roll</p><div class="hud-dice">' +
        ["d4", "d6", "d8", "d10", "d12", "d20"].map(function (d) { return '<button class="hud-die" data-roll="' + d + '" type="button">' + d.toUpperCase() + '</button>'; }).join("") +
      '</div></div>' +
      '<div class="hud-sec hud-custom"><select id="hudDiceN">' + [1, 2, 3, 4, 5, 6, 8, 10].map(function (n) { return '<option>' + n + '</option>'; }).join("") + '</select>' +
        '<select id="hudDiceD">' + ["d2", "d4", "d6", "d8", "d10", "d12", "d20", "d100"].map(function (d) { return '<option' + (d === "d20" ? " selected" : "") + '>' + d + '</option>'; }).join("") + '</select>' +
        '<button class="hud-roll-go" id="hudRollGo" type="button">Roll</button></div>' +
      '<div class="hud-result" id="hudDiceResult" aria-live="polite"></div>';
    var ov = popup("dice", "Randomizer", "Roll dice", body, false);
    if (!ov) return;
    var out = ov.querySelector("#hudDiceResult");
    function rollOne(kind) { try { return (window.MTGTable && MTGTable.roll) ? MTGTable.roll(kind) : null; } catch (e) { return null; } }
    function dieSides(d) { return ({ d2: 2, d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 })[String(d).toLowerCase()] || 6; }
    // spin the result through random values (decelerating), then lock the real result with a white flash
    function spin(kicker, intermediate, finalHtml) {
      if (out.classList.contains("rolling")) return;
      out.classList.remove("flash"); out.classList.add("rolling");
      var ticks = 0, max = 12;
      (function frame() {
        out.innerHTML = '<span class="hud-res-k">' + esc(kicker) + '</span><span class="hud-res-v">' + esc(intermediate()) + '</span>';
        if (++ticks < max) { setTimeout(frame, 30 + ticks * ticks * 1.7); }
        else {
          out.classList.remove("rolling");
          out.innerHTML = finalHtml;
          void out.offsetWidth; // restart the flash animation
          out.classList.add("flash");
          setTimeout(function () { out.classList.remove("flash"); }, 640);
        }
      })();
    }
    Array.prototype.forEach.call(ov.querySelectorAll("[data-roll]"), function (b) {
      b.onclick = function () {
        var kind = b.dataset.roll, r = rollOne(kind), kk = (kind === "Coin" ? "Coin" : kind.toUpperCase());
        var finalHtml = '<span class="hud-res-k">' + esc(kk) + '</span><span class="hud-res-v">' + esc(r == null ? "?" : r) + '</span>';
        if (kind === "Coin") spin("Coin", function () { return Math.random() < 0.5 ? "Heads" : "Tails"; }, finalHtml);
        else { var s = dieSides(kind); spin(kk, function () { return 1 + Math.floor(Math.random() * s); }, finalHtml); }
      };
    });
    ov.querySelector("#hudRollGo").onclick = function () {
      var n = Number(ov.querySelector("#hudDiceN").value) || 1, d = ov.querySelector("#hudDiceD").value, rolls = [], sum = 0;
      for (var i = 0; i < n; i++) { var r = rollOne(d); if (typeof r === "number") { rolls.push(r); sum += r; } }
      var finalHtml = '<span class="hud-res-k">' + n + d + '</span><span class="hud-res-v">' + sum + '</span>' + (n > 1 ? '<span class="hud-res-sub">' + rolls.join(" + ") + '</span>' : "");
      var s = dieSides(d);
      spin(n + d, function () { var x = 0; for (var i = 0; i < n; i++) x += 1 + Math.floor(Math.random() * s); return x; }, finalHtml);
    };
  }

  // ============================ TRACKERS (img 2 / 3) ============================
  var TRACKERS = [
    { k: "monarch", l: "Monarch", toggle: 1 }, { k: "citys_blessing", l: "City's blessing", toggle: 1 }, { k: "sol_ring_t1", l: "Turn 1 Sol Ring", toggle: 1 },
    { k: "treasure", l: "Treasures" }, { k: "experience", l: "Experience" }, { k: "energy", l: "Energy" }, { k: "tax", l: "Commander Tax" }, { k: "storm", l: "Storm" },
    { k: "mana_u", l: "Blue Mana" }, { k: "mana_r", l: "Red Mana" }, { k: "mana_w", l: "White Mana" }, { k: "mana_b", l: "Black Mana" }, { k: "mana_g", l: "Green Mana" }, { k: "mana_c", l: "Colorless Mana" },
    { k: "extra_turns", l: "Extra Turns" }, { k: "mills", l: "Mills" }, { k: "go_infinite", l: "Go Infinite", toggle: 1 },
    { k: "tutors", l: "Play More Than 2 Non-Land Tutors", toggle: 1 }, { k: "save_someone", l: "Save Someone From Losing", toggle: 1 },
    { k: "mass_denial", l: "Mass Resource Denial", toggle: 1 }, { k: "rad", l: "Rad" }, { k: "speed", l: "Speed" }
  ];
  var DEFAULT_ON = ["monarch", "citys_blessing", "treasure", "experience", "energy", "tax", "storm", "mana_u", "mana_r", "mana_w", "mana_b"];
  function loadEnabled() { try { var v = JSON.parse(localStorage.getItem("mtg_hud_trackers") || "null"); return Array.isArray(v) ? v : DEFAULT_ON.slice(); } catch (e) { return DEFAULT_ON.slice(); } }
  function saveEnabled(a) { try { localStorage.setItem("mtg_hud_trackers", JSON.stringify(a)); } catch (e) {} }
  var enabled = loadEnabled();
  var customTrackers = [];
  function allTrackers() { return TRACKERS.concat(customTrackers); }
  function trk(k) { var a = allTrackers(); for (var i = 0; i < a.length; i++) if (a[i].k === k) return a[i]; return { k: k, l: k }; }
  function counters() { try { return (window.MTGTable && MTGTable.myCounters) ? MTGTable.myCounters() : {}; } catch (e) { return {}; } }
  function bump(k, d) { try { if (window.MTGTable && MTGTable.addCounter) MTGTable.addCounter(k, d); } catch (e) {} }

  // ---- pinned trackers: a board overlay (chips on the right, under the life panel) ----
  function loadPins() { try { var v = JSON.parse(localStorage.getItem("mtg_hud_pins") || "null"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function savePins(a) { try { localStorage.setItem("mtg_hud_pins", JSON.stringify(a)); } catch (e) {} }
  var pinned = loadPins();
  function isPinned(k) { return pinned.indexOf(k) >= 0; }
  function togglePin(k) { var i = pinned.indexOf(k); if (i >= 0) pinned.splice(i, 1); else pinned.push(k); savePins(pinned); renderPins(); }
  var PIN_ICON = svg('<path d="M12 17v5"/><path d="M9 10.76V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6.76a2 2 0 0 0 .59 1.42l1.7 1.7A1 1 0 0 1 17.59 16H6.41a1 1 0 0 1-.7-1.71l1.7-1.71A2 2 0 0 0 8 11.18"/>');

  function openTrackers() {
    var ov = popup("trackers", "Per-deck counters", "Trackers", '<div id="hudTrkList"></div>', true);
    if (!ov) return;
    var editing = false;
    ov.querySelector('[data-act="edit"]').onclick = function () { editing = !editing; render(); };
    function render() {
      var cv = counters(), list = ov.querySelector("#hudTrkList");
      if (editing) {
        list.innerHTML = '<p class="hud-trk-hint">Tap a tracker to enable or disable it</p><div class="hud-trk-grid">' +
          allTrackers().map(function (t) { return '<button class="hud-trk-pill' + (enabled.indexOf(t.k) >= 0 ? " on" : "") + '" data-en="' + esc(t.k) + '" type="button">' + esc(t.l) + '</button>'; }).join("") +
          '</div><div class="hud-trk-add"><input id="hudTrkNew" type="text" placeholder="Add your own tracker…" maxlength="28" /><button id="hudTrkAdd" type="button">Add</button></div>';
        Array.prototype.forEach.call(list.querySelectorAll("[data-en]"), function (b) {
          b.onclick = function () { var k = b.dataset.en, i = enabled.indexOf(k); if (i >= 0) enabled.splice(i, 1); else enabled.push(k); saveEnabled(enabled); render(); };
        });
        list.querySelector("#hudTrkAdd").onclick = function () {
          var inp = list.querySelector("#hudTrkNew"), name = (inp.value || "").trim(); if (!name) { inp.focus(); return; }
          var key = "c_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          if (!trk(key).custom) customTrackers.push({ k: key, l: name, custom: 1 });
          if (enabled.indexOf(key) < 0) enabled.push(key); saveEnabled(enabled); inp.value = ""; render();
        };
      } else {
        if (!enabled.length) { list.innerHTML = '<p class="hud-trk-hint">No trackers yet — tap the pencil to add some.</p>'; return; }
        list.innerHTML = enabled.map(function (k) {
          var t = trk(k), v = cv[k] || 0;
          var pinBtn = '<button class="hud-trk-pin' + (isPinned(k) ? " on" : "") + '" data-pin="' + esc(k) + '" type="button" aria-pressed="' + (isPinned(k) ? "true" : "false") + '" title="' + (isPinned(k) ? "Unpin from board" : "Pin to board") + '" aria-label="Pin to board">' + PIN_ICON + '</button>';
          if (t.toggle) return '<div class="hud-trk-row"><span class="hud-trk-l">' + esc(t.l) + '</span><div class="hud-trk-ctl">' + pinBtn + '<button class="hud-trk-tog' + (v ? " on" : "") + '" data-tog="' + esc(k) + '" type="button" aria-pressed="' + (v ? "true" : "false") + '"><span></span></button></div></div>';
          return '<div class="hud-trk-row"><span class="hud-trk-l">' + esc(t.l) + '</span><div class="hud-trk-ctl">' + pinBtn + '<div class="hud-trk-step"><button data-c="' + esc(k) + '" data-d="-1" type="button">−</button><b>' + v + '</b><button data-c="' + esc(k) + '" data-d="1" type="button">+</button></div></div></div>';
        }).join("");
        Array.prototype.forEach.call(list.querySelectorAll("[data-c]"), function (b) { b.onclick = function () { bump(b.dataset.c, Number(b.dataset.d)); setTimeout(render, 30); }; });
        Array.prototype.forEach.call(list.querySelectorAll("[data-tog]"), function (b) { b.onclick = function () { var k = b.dataset.tog; bump(k, (cv[k] || 0) ? -1 : 1); setTimeout(render, 30); }; });
        Array.prototype.forEach.call(list.querySelectorAll("[data-pin]"), function (b) { b.onclick = function () { togglePin(b.dataset.pin); render(); }; });
      }
    }
    render();
  }

  // ============================ SETTINGS ============================
  function openEngineSettings() {
    var T = window.MTGTable || {};
    function tog(id, label, sub, on) {
      return '<div class="hud-eng-row"><div class="hud-eng-tx"><b>' + esc(label) + '</b><i>' + esc(sub) + '</i></div>' +
        '<button type="button" class="hud-eng-tog' + (on ? " on" : "") + '" data-eng="' + id + '" role="switch" aria-checked="' + (on ? "true" : "false") + '" aria-label="' + esc(label) + '"><span></span></button></div>';
    }
    var advOn = !!(window.MTGEngineAssistUI && MTGEngineAssistUI.isOn && MTGEngineAssistUI.isOn());
    var enfOn = !!(T.engineEnforceOn && T.engineEnforceOn());
    var ptOn = T.showPTOn ? !!T.showPTOn() : true;
    var body =
      tog("enforce", "Auto-enforce rules", "State-based actions: 0-toughness creatures die; 0-life, 10-poison and 21-commander losses flagged; +1/+1 and -1/-1 counters cancel; leftover tokens cleared.", enfOn) +
      tog("pt", "Power & toughness on cards", "Show each creature's total power and effective P/T (base + counters) on the board.", ptOn) +
      tog("adv", "Advisory analysis", "The engine watches the game and flags rules issues without changing anything (the E button on the bar).", advOn) +
      '<p class="hud-eng-note">The full rules engine is still rolling out - these are the parts live today. Leave all three off to disable the engine entirely.</p>';
    var ov = popup("engine", "Rules engine", "Engine settings", body, false);
    if (!ov) return;
    ov.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-eng]") : null; if (!b) return;
      var which = b.dataset.eng, on = !b.classList.contains("on");
      try {
        if (which === "enforce" && T.setEngineEnforce) T.setEngineEnforce(on);
        else if (which === "pt" && T.setShowPT) T.setShowPT(on);
        else if (which === "adv" && window.MTGEngineAssistUI) { if (on) MTGEngineAssistUI.enable(); else MTGEngineAssistUI.disable(); }
      } catch (err) {}
      b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function openSettings() {
    var T = window.MTGTable || {};
    var seats = [];
    try { seats = (T.seatsInfo && T.seatsInfo()) || []; } catch (e) {}
    // G4.31 — Declare winner (player dropdown), Declare draw (tie) and End game live here now.
    var winRow = seats.length
      ? '<div class="hud-set-win"><select id="hudWinSel" aria-label="Winner">' +
          seats.map(function (s) { return '<option value="' + s.seat + '">' + esc(s.name || ("Seat " + s.seat)) + '</option>'; }).join("") +
        '</select><button id="hudWinGo" type="button">Declare winner</button></div>'
      : '';
    var body = '<div class="hud-set"><button class="hud-set-row hud-set-eng" id="hudSetEng" type="button">Rules engine settings</button>' +
      '<button class="hud-set-row hud-set-audio" id="hudSetAudio" type="button">Audio &amp; voice</button>' +
      '<button class="hud-set-row" id="hudSetMat" type="button">Change playmat</button>' +
      '<button class="hud-set-row" id="hudSetShuf" type="button">Shuffle library</button>' +
      winRow +
      '<button class="hud-set-row" id="hudSetDraw" type="button">Declare draw (tie)</button>' +
      '<button class="hud-set-row" id="hudSetEnd" type="button">End game</button></div>';
    var ov = popup("settings", "Game", "Settings", body, false);
    if (!ov) return;
    function done() { if (dlg.settings) { dlg.settings.remove(); dlg.settings = null; } }
    ov.querySelector("#hudSetMat").onclick = function () { if (T.openPlaymat) T.openPlaymat(); done(); };
    ov.querySelector("#hudSetEng").onclick = function () { done(); openEngineSettings(); };
    var hudAu = ov.querySelector("#hudSetAudio"); if (hudAu) hudAu.onclick = function () { done(); if (window.MTGVoiceUI) MTGVoiceUI.openAudioSettings(); };
    ov.querySelector("#hudSetShuf").onclick = function () { if (T.shuffle) T.shuffle(); done(); };
    var wg = ov.querySelector("#hudWinGo");
    if (wg) wg.onclick = function () { var sel = ov.querySelector("#hudWinSel"); if (T.declareWinner) T.declareWinner(Number(sel ? sel.value : 0)); done(); };
    ov.querySelector("#hudSetDraw").onclick = function () { if (window.confirm("End the game as a draw (tie)?")) { if (T.declareDraw) T.declareDraw(); done(); } };
    ov.querySelector("#hudSetEnd").onclick = function () { if (T.endGame) T.endGame(); done(); };
  }

  // ============================ (removed) top-right LIFE / ZONES panel ============================
  // G1.1 / G2.17b — the top-right vitals panel is gone; the live Stack takes that space and the
  // bottom-left life cluster (play-life.js) owns life/zone readouts. updateLife stays as a no-op
  // because other modules may still call MTGHUD.updateLife().
  function updateLife() {}

  // ============================ PINNED TRACKER CHIPS (board overlay) ============================
  var pinEl = null;
  function buildPins() {
    if (pinEl) return;
    var page = document.getElementById("playPage") || document.body;
    pinEl = eln("div", "hud-pins"); pinEl.id = "hudPins";
    page.appendChild(pinEl);
    pinEl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-pc]"); if (!b) return;
      var k = b.dataset.pc, a = b.dataset.pa;
      if (a === "x") { togglePin(k); return; }
      bump(k, a === "-" ? -1 : 1); renderPins();
    });
  }
  function renderPins() {
    if (!pinEl) return;
    // only while the HUD is up (taskbar visible) and there is at least one pin
    if (!bar || bar.style.display === "none" || !pinned.length) { pinEl.style.display = "none"; pinEl.innerHTML = ""; return; }
    pinEl.style.display = "";
    var cv = counters();
    pinEl.innerHTML = pinned.map(function (k) {
      var t = trk(k), v = cv[k] || 0, val = t.toggle ? (v ? "On" : "Off") : v;
      return '<div class="hud-pin"><span class="hud-pin-l">' + esc(t.l) + '</span>' +
        '<div class="hud-pin-ctl"><button data-pc="' + esc(k) + '" data-pa="-" type="button" aria-label="Decrease">−</button>' +
        '<b class="hud-pin-v">' + esc(val) + '</b>' +
        '<button data-pc="' + esc(k) + '" data-pa="+" type="button" aria-label="Increase">+</button>' +
        '<button class="hud-pin-x" data-pc="' + esc(k) + '" data-pa="x" type="button" aria-label="Unpin">' + ICON.close + '</button></div></div>';
    }).join("");
  }

  window.MTGHUD = { show: show, hide: hide, openDice: openDice, openTrackers: openTrackers, updateLife: updateLife, renderPins: renderPins };
})();
