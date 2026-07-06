/*
 * play-life.js — self-contained bottom-LEFT "life & actions" hub for the MTG Commander
 * virtual tabletop (playgroup.gg-style life bar). QA round 2026-07-02, group G1.
 *
 * Cluster (vertical action stack + life row):
 *   • Counters        — opens the Trackers popup (MTGHUD.openTrackers; moved out of the top bar)
 *   • Commander damage — per-opponent commander CARD-ART tiles with −/+ and running X/21
 *   • Player Counters — poison / energy / experience / rad / monarch on MY seat (icons)
 *   • Draw            — draw 1 from my library
 *   • Roll Dice       — opens the dice UI (MTGHUD.openDice)
 *   • Scoop/Concede   — centered confirm modal, then life → 0
 *   Life row: Pass turn / Untap · life pill (hold-to-repeat, accelerating ±1/±5/±10,
 *   red/green flash, floor at 0 with a "YOU ARE DEAD" fill) · live Lib/GY/Exile counts.
 *
 * Reads/writes the game ONLY through the window.MTGTable life API:
 *   seatsInfo() · getState() · playerInfo() · applyLife(seat,delta) · addCounter(kind,delta)
 *   myCounters() · applyCmdr(target,source,amount,{cmdr,poison,lifelink}) · passTurn() · untapAll()
 *   cmdDamageDetail(seat) — per-source-commander breakdown for the read-only opponent panel
 *   (+ feature-detected MTGTable.dispatch for the commander-damage −/+ batch and Draw)
 *
 * Commander-damage −/+ (openModal/cmdrDelta) is ALWAYS scoped to MY OWN seat (the defending
 * player's own menu) — "+" takes damage from an opponent's commander, "−" fixes a miscount.
 * Both ends are coupled to life symmetrically (+1 cmd dmg → −1 life; −1 cmd dmg → +1 life), so a
 * removal always refunds exactly the life the matching addition cost. No client ever writes
 * another player's life/counters/commander-damage — the top vitals bar's opponent chips
 * (table.js renderVitals) are READ-ONLY and open MTGLife.openOpponent(seat), a live-synced,
 * no-edit-controls sheet showing that player's commander damage taken, grouped by source
 * commander, sourced from MTGTable.cmdDamageDetail(seat) and re-rendered on every refresh() tick.
 *
 * Surface: window.MTGLife = { show, hide, refresh, openOpponent }.
 */
(function () {
  "use strict";

  // ---------- tiny DOM helpers ----------
  function eln(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function svg(p) { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  function msym(name) { return '<span class="msym" aria-hidden="true">' + name + '</span>'; }
  // background-image url sanitizer (art URLs can come from remote peers — strip breakers)
  function cssUrl(u) { u = String(u || "").replace(/["'()\\\s]/g, ""); return u ? "url('" + u + "')" : ""; }

  // ---------- MTGTable access (guarded everywhere) ----------
  function T() { return (typeof window !== "undefined" && window.MTGTable) ? window.MTGTable : null; }
  function H() { return (typeof window !== "undefined" && window.MTGHUD) ? window.MTGHUD : null; }
  function seats() {
    var t = T(); if (!t || typeof t.seatsInfo !== "function") return [];
    try { var a = t.seatsInfo(); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function me(list) { list = list || seats(); for (var i = 0; i < list.length; i++) if (list[i] && list[i].isMe) return list[i]; return null; }
  function callT(fn, a, b, c, d) { var t = T(); if (t && typeof t[fn] === "function") { try { return t[fn](a, b, c, d); } catch (e) {} } return undefined; }
  function canDispatch() { var t = T(); return !!(t && typeof t.dispatch === "function"); }

  // ---------- state ----------
  var root = null, refInt = null, mo = null;
  var pending = 0, pendStart = null;   // pending ± delta for MY life (readout shows "+N" / "−N" only)
  var commitTO = null, flashTO = null, lifeFxTO = null;
  var modal = null;                    // commander-damage sheet (MY damage taken, editable)
  var ctrPopup = null;                 // player-counters popup
  var confirmEl = null;                // scoop/concede confirm modal
  var lastLife = null, lastSeat = null;
  var poisonKO = null;                 // life stashed when 10-poison zeroes it; restored if corrected below 10
  var lastCdSig = "";                  // cmd-damage sheet repaint signature (avoid churn on the 500ms tick)
  var oppModal = null, oppModalSeat = null, lastOppSig = ""; // read-only opponent commander-damage-received panel
  var holds = {};                      // per-pointer hold-to-repeat map (multi-touch-safe), pointerId → {dir,t0,int}

  // inline SVG radiation trefoil (no good Material Symbol for it)
  var RAD_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="2"/>' +
    '<path d="M10.25 8.97 7.25 3.77a9.5 9.5 0 0 1 9.5 0l-3 5.2a3.5 3.5 0 0 0-3.5 0Z"/>' +
    '<path d="M15.5 12h6a9.5 9.5 0 0 1-4.75 8.23l-3-5.2A3.5 3.5 0 0 0 15.5 12Z"/>' +
    '<path d="M10.25 15.03l-3 5.2A9.5 9.5 0 0 1 2.5 12h6a3.5 3.5 0 0 0 1.75 3.03Z"/></svg>';

  // in-theme poison/infect glyph (a skull — the MTG poison-counter symbol), matches the inline RAD style
  var POISON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2C7.9 2 4.5 5.3 4.5 9.4c0 2.2 1 4 2.5 5.2.3.24.5.5.5.95V17c0 .8.7 1.5 1.5 1.5l.3 1.4c.08.4.44.7.85.7h3.8c.41 0 .77-.3.85-.7l.3-1.4c.8 0 1.5-.7 1.5-1.5v-1.45c0-.45.2-.7.5-.95 1.5-1.2 2.5-3 2.5-5.2C19.5 5.3 16.1 2 12 2Z"/>' +
    '<circle cx="8.9" cy="9.5" r="1.6" fill="#0b1120"/><circle cx="15.1" cy="9.5" r="1.6" fill="#0b1120"/>' +
    '<path d="M12 12.4l1 2.1h-2l1-2.1Z" fill="#0b1120"/></svg>';

  // Player counters that can be applied to MY seat (poison covers infect/toxic).
  // Every health-relevant counter gets an icon (G1.7): poison ☣ · energy bolt · experience star ·
  // rad trefoil (inline SVG) · monarch crown.
  var COUNTERS = [
    { k: "poison", label: "Poison", ic: '<span class="pl-ctr-ic">' + POISON_SVG + "</span>" },
    { k: "energy", label: "Energy", ic: '<span class="pl-ctr-ic">' + msym("bolt") + "</span>" },
    { k: "experience", label: "Experience", ic: '<span class="pl-ctr-ic">' + msym("star") + "</span>" },
    { k: "rad", label: "Rad", ic: '<span class="pl-ctr-ic">' + RAD_SVG + "</span>" },
    { k: "monarch", label: "Monarch", ic: '<span class="pl-ctr-ic">' + msym("crown") + "</span>", max: 1, toggle: 1 }
  ];
  function ctrDef(k) { for (var i = 0; i < COUNTERS.length; i++) if (COUNTERS[i].k === k) return COUNTERS[i]; return null; }

  var IC = {
    minus: "−",
    plus: "+",
    poison: POISON_SVG,
    pass: svg('<path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>'),
    untap: svg('<path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
    close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    // crossed swords (commander damage)
    cmd: svg('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M19.5 15.5 21 17l-4 4-1.5-1.5"/><path d="M9.5 6.5 21 6V3h-3L6.5 14.5"/>'),
    // stacked layers (Counters — the relocated Trackers popup)
    ctr: svg('<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>'),
    // single person (Player Counters — my per-seat counters)
    person: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>'),
    // card + down arrow (Draw)
    draw: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 8v6"/><path d="m9.5 11.5 2.5 2.5 2.5-2.5"/>'),
    // die (Roll Dice)
    dice: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.3" cy="8.3" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.7" cy="15.7" r="1.15" fill="currentColor" stroke="none"/>'),
    // white flag (Scoop / Concede)
    flag: svg('<path d="M5 21V4"/><path d="M5 4c4-2 7 2 12 0v9c-5 2-8-2-12 0"/>'),
    chevUp: svg('<path d="M6 15l6-6 6 6"/>')
  };

  // ============================================================
  // BUILD — the bottom-left cluster (actions stacked VERTICALLY, G1.13)
  // ============================================================
  function actBtn(act, label, icon, extraCls, title) {
    return '<button type="button" class="pl-act' + (extraCls ? " " + extraCls : "") + '" data-act="' + act + '" title="' + esc(title || label) + '">' + icon + "<span>" + esc(label) + "</span></button>";
  }

  function build() {
    if (root) return;
    // Append to document.body (NOT #playPage): under body.play-fs the play page becomes
    // `position:fixed; z-index:40`, which opens a stacking context that would trap this
    // fixed cluster beneath board overlays. Living on <body> lets z-index:93 win outright.
    var page = document.body || document.getElementById("playPage");
    root = eln("div", "pl-cluster"); root.id = "plCluster";
    root.innerHTML =
      '<div class="pl-actwrap" id="plActWrap">' +
        '<div class="pl-actions" id="plActions">' +
          // G1.13: "Counters" (the relocated Trackers popup) sits ABOVE the rest. Draw now lives next to Untap.
          actBtn("trackers", "Counters", IC.ctr, "", "Game counters & trackers") +
          actBtn("pcounters", "Player Counters", IC.person, "", "Poison / energy / experience / rad / monarch") +
          actBtn("cmddmg", "Commander damage", IC.cmd) +
          actBtn("dice", "Roll Dice", IC.dice) +
          actBtn("death", "Scoop/Concede", IC.flag, "pl-act-death", "Concede the game (confirmation required)") +
        '</div>' +
        '<button type="button" class="pl-acts-toggle" data-act="actstoggle" aria-label="Show more actions" title="More actions">' + IC.chevUp + '</button>' +
      '</div>' +
      '<div class="pl-mana" id="plMana" hidden></div>' +
      '<div class="pl-bottom">' +
        '<div class="pl-turncol">' +
          '<button type="button" class="pl-pass" data-act="pass">' + IC.pass + '<span>Pass Turn</span></button>' +
          '<div class="pl-uprow">' +
            '<button type="button" class="pl-untap" data-act="untap" title="Untap all">' + IC.untap + '<span>Untap</span></button>' +
            '<button type="button" class="pl-untap pl-draw2" data-act="draw" title="Draw 1 card">' + IC.draw + '<span>Draw</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="pl-pill" id="plPill">' +
          '<div class="pl-cchips" id="plCounters" hidden></div>' +
          '<button type="button" class="pl-step pl-minus" data-act="minus" aria-label="Lose life">' + IC.minus + '</button>' +
          '<div class="pl-core">' +
            '<button type="button" class="pl-life" id="plLife" data-act="cmddmg" aria-label="Open commander damage">40</button>' +
            '<div class="pl-math" id="plMath" aria-live="polite"></div>' +
          '</div>' +
          '<button type="button" class="pl-step pl-plus" data-act="plus" aria-label="Gain life">' + IC.plus + '</button>' +
          '<div class="pl-flash" id="plFlash" aria-hidden="true"></div>' +
          '<div class="pl-dead" id="plDead" hidden>YOU ARE DEAD</div>' +
        '</div>' +
        '<div class="pl-zones" id="plZones" hidden>' +
          '<div class="pl-zone" title="Cards in your library"><span>Lib</span><b id="plZLib">0</b></div>' +
          '<div class="pl-zone" title="Cards in your graveyard"><span>GY</span><b id="plZGy">0</b></div>' +
          '<div class="pl-zone" title="Cards in your exile"><span>Ex</span><b id="plZEx">0</b></div>' +
        '</div>' +
      '</div>';
    page.appendChild(root);
    root.addEventListener("click", onClusterClick);
    wireHold(root.querySelector(".pl-minus"), -1);
    wireHold(root.querySelector(".pl-plus"), 1);
    root.addEventListener("contextmenu", function (e) { // long-press on touch must not open a menu mid-hold
      if (e.target.closest && e.target.closest(".pl-step")) e.preventDefault();
      var mpip = e.target.closest && e.target.closest(".pl-mp[data-mana]");
      if (mpip) { e.preventDefault(); callT("adjustMana", mpip.dataset.mana, -1); refresh(); }
    });
  }

  function onClusterClick(e) {
    var mb = e.target.closest ? e.target.closest("[data-mana],[data-manaclear],[data-manakeep]") : null;
    if (mb && root.contains(mb)) {
      if (mb.dataset.manaclear != null) callT("clearMana");
      else if (mb.dataset.manakeep != null) callT("toggleKeepMana");
      else if (mb.dataset.mana) callT("adjustMana", mb.dataset.mana, e.shiftKey ? -1 : 1);
      refresh(); return;
    }
    var b = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!b || !root.contains(b)) return;
    var a = b.dataset.act;
    // −/+ are pointer-driven (hold-to-repeat); keep them keyboard-accessible (e.detail === 0).
    if (a === "minus") { if (e.detail === 0) tapLife(-1); }
    else if (a === "plus") { if (e.detail === 0) tapLife(1); }
    else if (a === "cmddmg") { if (pending !== 0) commitNow(); openModal(); }
    else if (a === "pcounters") { if (pending !== 0) commitNow(); openCounters(); }
    else if (a === "trackers") { var h = H(); if (h && typeof h.openTrackers === "function") h.openTrackers(); }
    else if (a === "dice") { var h2 = H(); if (h2 && typeof h2.openDice === "function") h2.openDice(); }
    else if (a === "draw") { if (pending !== 0) commitNow(); doDraw(); }
    else if (a === "death") { if (pending !== 0) commitNow(); openConcede(); }
    else if (a === "pass") { commitNow(); callT("passTurn"); refresh(); }
    else if (a === "untap") { callT("untapAll"); refresh(); }
    else if (a === "actstoggle") { var w = root.querySelector("#plActWrap"); if (w) w.classList.toggle("acts-open"); }
  }

  // ============================================================
  // LIFE PILL — pending "+N/−N" readout, hold-to-repeat, floor at 0
  // ============================================================
  function tapLife(amt) {
    var m = me(); if (!m || !amt) return;
    if (pending === 0) pendStart = Math.max(0, Number(m.life) || 0);
    var base = (pendStart == null ? Math.max(0, Number(m.life) || 0) : pendStart);
    // G1.9 — life can never go below 0, pending included: clamp the step at the floor.
    if (base + pending + amt < 0) amt = -(base + pending);
    if (!amt) return;
    pending += amt;
    showMath();
    paintPendingLife(base + pending);
    lifeFx(amt > 0 ? 1 : -1); // G1.6 / G1.10 — green on gain, red on loss, every tick
    if (commitTO) clearTimeout(commitTO);
    commitTO = setTimeout(commitNow, 1100);
  }

  function commitNow() {
    if (commitTO) { clearTimeout(commitTO); commitTO = null; }
    if (pending === 0) { clearMath(); return; }
    var delta = pending; pending = 0; pendStart = null;
    var m = me();
    if (m) {
      var lifeNow = Math.max(0, Number(m.life) || 0);
      if (lifeNow + delta < 0) delta = -lifeNow; // clamp the commit too (G1.9)
      if (delta) callT("applyLife", m.seat, delta);
    }
    clearMath(); refresh();
  }

  function showMath() {
    var el = root && root.querySelector("#plMath"); if (!el) return;
    if (pending === 0) { clearMath(); return; }
    // G1.5 — pending readout is ONLY "+N" / "−N" (no running equation).
    el.textContent = (pending > 0 ? "+" : IC.minus) + Math.abs(pending);
    el.classList.toggle("neg", pending < 0);
    el.classList.toggle("pos", pending > 0);
    el.classList.add("show");
  }
  function clearMath() { var el = root && root.querySelector("#plMath"); if (el) { el.textContent = ""; el.classList.remove("show", "neg", "pos"); } }
  function paintPendingLife(val) {
    var n = root && root.querySelector("#plLife");
    if (n) n.textContent = Math.max(0, val);
  }

  // red/green pulse on the life total + pill ring (reduced-motion handled in CSS)
  function lifeFx(dir) {
    if (!root) return;
    var n = root.querySelector("#plLife"), p = root.querySelector("#plPill");
    var add = dir > 0 ? "heal" : "hit", rm = dir > 0 ? "hit" : "heal";
    [n, p].forEach(function (el) { if (!el) return; el.classList.remove(add, rm); void el.offsetWidth; el.classList.add(add); });
    if (lifeFxTO) clearTimeout(lifeFxTO);
    lifeFxTO = setTimeout(function () {
      [n, p].forEach(function (el) { if (el) el.classList.remove("hit", "heal"); });
    }, 500);
  }

  // ---------- hold-to-repeat (G1.10): per-pointer map, multi-touch-safe; accelerates 1 → 5 → 10 ----------
  function wireHold(btn, dir) {
    if (!btn) return;
    btn.addEventListener("pointerdown", function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      try { ev.preventDefault(); } catch (e) {}
      try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
      endHold(ev.pointerId);
      var h = { dir: dir, t0: Date.now(), int: null };
      holds[ev.pointerId] = h;
      holdTick(h); // immediate first tick (±1)
      h.int = setInterval(function () { holdTick(h); }, 420);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (evName) {
      btn.addEventListener(evName, function (ev) { endHold(ev.pointerId); });
    });
  }
  function holdTick(h) {
    var elapsed = Date.now() - h.t0;
    var step = elapsed >= 3000 ? 10 : (elapsed >= 1500 ? 5 : 1);
    tapLife(h.dir * step);
  }
  function endHold(pointerId) {
    var h = holds[pointerId];
    if (h) { if (h.int) clearInterval(h.int); delete holds[pointerId]; }
  }
  function endAllHolds() { for (var k in holds) endHold(k); }

  // ---------- Draw (G1.11) ----------
  function doDraw() {
    var t = T(), m = me(); if (!t || !m) return;
    if (typeof t.dispatch === "function") { try { t.dispatch({ t: "draw", seat: m.seat, count: 1 }); } catch (e) {} }
    else { var b = document.getElementById("tblDraw"); if (b) { try { b.click(); } catch (e) {} } else return; }
    pulse("Draw 1"); refresh();
  }

  // ---------- Scoop / Concede (G1.3) ----------
  function pulse(label) {
    if (!root) return;
    var f = root.querySelector("#plFlash"); if (!f) return;
    f.textContent = label; f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
    if (flashTO) clearTimeout(flashTO);
    flashTO = setTimeout(function () { f.classList.remove("go"); f.textContent = ""; }, 700);
  }

  function openConcede() {
    closeConcede();
    var m = me(); if (!m) return;
    confirmEl = eln("div", "pl-modal"); confirmEl.id = "plConfirm";
    confirmEl.innerHTML =
      '<div class="pl-sheet pl-confirm" role="alertdialog" aria-label="Scoop or concede" aria-describedby="plConfirmP">' +
        '<h3 class="pl-confirm-t">Scoop / Concede</h3>' +
        '<p class="pl-confirm-p" id="plConfirmP">Are you sure? This action is irreversible.</p>' +
        '<div class="pl-confirm-row">' +
          '<button type="button" class="pl-cbtn pl-cbtn-confirm" data-kact="confirm">Confirm</button>' +
          '<button type="button" class="pl-cbtn pl-cbtn-cancel" data-kact="cancel">Cancel</button>' +
        '</div>' +
      '</div>';
    (document.getElementById("playPage") || document.body).appendChild(confirmEl);
    confirmEl.addEventListener("click", function (e) {
      if (e.target === confirmEl) { closeConcede(); return; }
      var b = e.target.closest ? e.target.closest("[data-kact]") : null;
      if (!b || !confirmEl.contains(b)) return;
      if (b.dataset.kact === "confirm") doScoop();
      else closeConcede();
    });
    var cancel = confirmEl.querySelector(".pl-cbtn-cancel");
    if (cancel) { try { cancel.focus(); } catch (e) {} }
  }
  function doScoop() {
    closeConcede();
    var m = me(); if (!m) return;
    if (m.life > 0) callT("applyLife", m.seat, -m.life); // existing death flow: life → 0 (engine flags the loss)
    pulse("Conceded"); refresh();
  }
  function closeConcede() { if (confirmEl) { try { confirmEl.remove(); } catch (e) {} } confirmEl = null; }

  // ============================================================
  // PLAYER COUNTERS POPUP — poison / energy / experience / rad / monarch (MY seat)
  // ============================================================
  function openCounters() {
    closeCounters();
    var m = me(); if (!m) return;
    ctrPopup = eln("div", "pl-modal"); ctrPopup.id = "plCtrModal";
    ctrPopup.innerHTML =
      '<div class="pl-sheet pl-ctr-sheet" role="dialog" aria-label="Player counters">' +
        '<button type="button" class="pl-sheet-x" data-cact="close" aria-label="Close">' + IC.close + '</button>' +
        '<div class="pl-sheet-hd"><div class="pl-sheet-tt"><p class="pl-kick">Apply to you</p><h3>Player Counters</h3></div></div>' +
        '<div class="pl-ctr-list" id="plCtrList"></div>' +
      '</div>';
    (document.getElementById("playPage") || document.body).appendChild(ctrPopup);
    ctrPopup.addEventListener("click", function (e) {
      if (e.target === ctrPopup) { closeCounters(); return; }
      var b = e.target.closest ? e.target.closest("[data-cact]") : null;
      if (!b || !ctrPopup.contains(b)) return;
      var act = b.dataset.cact;
      if (act === "close") { closeCounters(); return; }
      if (act === "tog") {
        var tk = b.dataset.k, tv = Number((callT("myCounters") || {})[tk] || 0);
        callT("addCounter", tk, tv > 0 ? -tv : 1); // off -> on (set 1), on -> off (set 0)
        paintCounters(); refresh();
      } else if (act === "inc" || act === "dec") {
        var k = b.dataset.k, def = ctrDef(k), vals = callT("myCounters") || {};
        var v = Number(vals[k] || 0);
        if (act === "dec" && v <= 0) return;
        if (act === "inc" && def && def.max != null && v >= def.max) return;
        callT("addCounter", k, act === "inc" ? 1 : -1);
        paintCounters(); refresh();
      }
    });
    paintCounters();
  }
  function paintCounters() {
    if (!ctrPopup) return;
    var list = ctrPopup.querySelector("#plCtrList"); if (!list) return;
    var vals = callT("myCounters") || {};
    list.innerHTML = COUNTERS.map(function (c) {
      var v = Number(vals[c.k] || 0);
      var ctl = c.toggle
        ? '<button type="button" class="pl-ctr-tog' + (v > 0 ? " on" : "") + '" data-cact="tog" data-k="' + esc(c.k) + '" role="switch" aria-checked="' + (v > 0 ? "true" : "false") + '" aria-label="' + esc(c.label) + '"><span></span></button>'
        : '<div class="pl-ctr-steps">' +
            '<button type="button" class="pl-ctr-b" data-cact="dec" data-k="' + esc(c.k) + '" aria-label="Less ' + esc(c.label) + '">' + IC.minus + '</button>' +
            '<b class="pl-ctr-v">' + v + '</b>' +
            '<button type="button" class="pl-ctr-b pl-ctr-inc" data-cact="inc" data-k="' + esc(c.k) + '" aria-label="More ' + esc(c.label) + '">' + IC.plus + '</button>' +
          '</div>';
      return '<div class="pl-ctr-row"><span class="pl-ctr-nm">' + (c.ic || "") + esc(c.label) + '</span>' + ctl + '</div>';
    }).join("");
  }
  function closeCounters() { if (ctrPopup) { try { ctrPopup.remove(); } catch (e) {} } ctrPopup = null; }

  // ============================================================
  // REFRESH — re-read seatsInfo so life/poison/zones stay live
  // ============================================================
  function zoneCounts(m) {
    var t = T();
    try {
      if (t && typeof t.playerInfo === "function") {
        var pi = t.playerInfo();
        if (pi && pi.seat === m.seat) return { lib: pi.library || 0, gy: pi.graveyard || 0, ex: pi.exile || 0 };
      }
    } catch (e) {}
    try {
      var st = (t && typeof t.getState === "function") ? t.getState() : null;
      if (st && window.MTGCore && typeof MTGCore.zoneCount === "function") {
        return {
          lib: MTGCore.zoneCount(st, m.seat, "library"),
          gy: MTGCore.zoneCount(st, m.seat, "graveyard"),
          ex: MTGCore.zoneCount(st, m.seat, "exile")
        };
      }
    } catch (e) {}
    return null;
  }

  function refresh() {
    if (!isFs()) { hide(); return; } // never render the cluster off the board (e.g. after Back to lobby)
    var list = seats();
    if (!list.length) { hide(); return; }
    if (!root) build();
    // If my seat is momentarily unresolved (reseat/hotseat swap mid-load) DON'T slam the cluster
    // to display:none — that fought the 800ms re-show and could leave it stuck hidden. Seats exist,
    // so keep whatever is shown and wait for the next tick to resolve "me".
    var m = me(list); if (!m) { return; }
    if (root) root.style.display = "";

    var lifeShown = Math.max(0, Number(m.life) || 0); // G1.9 — never render below 0

    // flash red/green when MY life changes from any source (commit, cmd dmg, remote…)
    if (lastSeat === m.seat && lastLife != null && lifeShown !== lastLife) lifeFx(lifeShown > lastLife ? 1 : -1);
    lastSeat = m.seat; lastLife = lifeShown;

    var lifeEl = root.querySelector("#plLife");
    if (lifeEl && pending === 0) lifeEl.textContent = lifeShown;

    // 10 poison = death (CR 704.5c): zero the life once so the DEAD state shows. If poison is later
    // corrected back below 10 (a misclick), restore the exact life the player had before the poison-out.
    var poisonN = Math.max(Number(m.poison || 0), Number((callT("myCounters") || {}).poison || 0));
    var _lifeNow = Number(m.life) || 0;
    if (poisonN >= 10) {
      if (_lifeNow > 0) { poisonKO = _lifeNow; callT("applyLife", m.seat, -_lifeNow); }
    } else if (poisonKO != null && _lifeNow <= 0) {
      callT("applyLife", m.seat, poisonKO); poisonKO = null;
    } else if (_lifeNow > 0) {
      poisonKO = null;
    }

    // G1.9 — dead state: red fill + "YOU ARE DEAD" (0 life OR 10 poison)
    var deadEl = root.querySelector("#plDead");
    var cmdDead = false; if (m.cmdFrom) { for (var _ck in m.cmdFrom) { if ((Number(m.cmdFrom[_ck]) || 0) >= 21) { cmdDead = true; break; } } }
    var isDead = (Number(m.life) || 0) <= 0 || poisonN >= 10 || cmdDead;
    if (deadEl) deadEl.hidden = !isDead;
    root.classList.toggle("pl-is-dead", isDead);

    // health-bar counter chips: poison + energy / experience / rad / monarch each get an icon when > 0
    // mana pool + commander tax — mirrors the top vitals bar (same MTGTable state)
    var manaEl = root.querySelector("#plMana");
    if (manaEl) {
      var mp = callT("manaPool") || {}, mtax = callT("commanderTax"), MCOLS = ["W", "U", "B", "R", "G", "C"];
      var mhtml = MCOLS.map(function (col) { var v = mp[col] || 0; return '<button type="button" class="pl-mp pl-mp-' + col + (v > 0 ? " has" : "") + '" data-mana="' + col + '" title="' + col + ' mana — tap +1, shift or right-click -1"><img src="https://svgs.scryfall.io/card-symbols/' + col + '.svg" alt="' + col + '"><b>' + v + '</b></button>'; }).join("");
      mhtml += '<button type="button" class="pl-mp-clear" data-manaclear="1" title="Empty mana pool">' + (window.MTGIcons ? MTGIcons.get("close", "0.85em") : "×") + '</button>';
      mhtml += '<button type="button" class="pl-mp-keep' + (callT("keepManaOn") ? " on" : "") + '" data-manakeep="1" title="Keep mana between turns (Omnath/Kruphix)">keep</button>';
      if (mtax != null) mhtml += '<span class="pl-mp-tax" title="Commander tax — casting your commander from the command zone costs this much extra">TAX +' + mtax + '</span>';
      manaEl.innerHTML = mhtml; manaEl.hidden = false;
    }
    var chipsEl = root.querySelector("#plCounters");
    if (chipsEl) {
      var cvals = callT("myCounters") || {};
      var chips = COUNTERS.map(function (c) {
        var v = c.k === "poison" ? poisonN : Number(cvals[c.k] || 0);
        return v > 0 ? '<span class="pl-cchip pl-cchip-' + c.k + '" title="' + esc(c.label) + '">' + (c.ic || "") + '<b>' + v + '</b></span>' : "";
      }).join("");
      chipsEl.innerHTML = chips;
      chipsEl.hidden = !chips;
    }

    // G1.4 — live Library / Graveyard / Exile counts
    var zc = zoneCounts(m), zbox = root.querySelector("#plZones");
    if (zbox) {
      zbox.hidden = !zc;
      if (zc) {
        var zl = root.querySelector("#plZLib"), zg = root.querySelector("#plZGy"), zx = root.querySelector("#plZEx");
        if (zl) zl.textContent = zc.lib; if (zg) zg.textContent = zc.gy; if (zx) zx.textContent = zc.ex;
      }
    }

    if (ctrPopup && ctrPopup.isConnected) paintCounters();
    if (modal && modal.isConnected) renderModalLive(list);
    if (oppModal && oppModal.isConnected) renderOppLive(list);
  }

  // ============================================================
  // COMMANDER-DAMAGE SHEET (G1.8) — every player's commander as a card-art tile,
  // −/+ per opponent, running X/21. "+" = atomic batch (commander_damage + adjust_life)
  // via MTGTable.applyCmdr; "−" = counter-only fix-up (needs MTGTable.dispatch).
  // ============================================================
  function openModal() {
    closeModal();
    var list = seats(); var m = me(list); if (!m) return;
    modal = eln("div", "pl-modal"); modal.id = "plModal";
    modal.innerHTML =
      '<div class="pl-sheet pl-cd-sheet" role="dialog" aria-label="Commander damage">' +
        '<button type="button" class="pl-sheet-x" data-mact="close" aria-label="Close">' + IC.close + '</button>' +
        '<div class="pl-sheet-hd"><div class="pl-sheet-tt"><p class="pl-kick">Damage taken by you · 21 is lethal</p><h3>Commander Damage</h3></div></div>' +
        '<div class="pl-cd-grid" id="plCdGrid"></div>' +
        '<p class="pl-cd-hint">+ takes 1 damage from that commander (drops your life too, as one undoable action). − fixes a miscount (removes the counter only).</p>' +
      '</div>';
    (document.getElementById("playPage") || document.body).appendChild(modal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) { closeModal(); return; }
      var x = e.target.closest ? e.target.closest('[data-mact="close"]') : null;
      if (x && modal.contains(x)) { closeModal(); return; }
      var b = e.target.closest ? e.target.closest("[data-cd]") : null;
      if (!b || !modal.contains(b) || b.disabled) return;
      cmdrDelta(Number(b.dataset.seat), b.dataset.cd === "+" ? 1 : -1);
    });
    lastCdSig = "";
    renderModalLive(list);
  }

  function cmdrDelta(srcSeat, dir) {
    var t = T(), m = me(); if (!t || !m || srcSeat === m.seat) return;
    if (dir > 0) {
      // existing atomic batch: commander_damage + adjust_life in ONE dispatch (single Undo)
      if (typeof t.applyCmdr === "function") { try { t.applyCmdr(m.seat, srcSeat, 1, { cmdr: true }); } catch (e) {} }
    } else {
      // Symmetric life coupling: combat damage from a commander both raises commander damage AND
      // drops life, so REMOVING it (fixing a misclick) must restore the same life it cost. The
      // reducer clamps cmdDamage at a floor of 0, so credit back exactly what actually comes off
      // (never more) — avoids double-crediting life on a no-op remove. Only I ever touch my OWN
      // seat's life/cmdDamage here (defending player's own menu — matches applyCmdr's ownership rule
      // and RLS, which only lets a client write its own participant row).
      var taken = (m.cmdFrom && m.cmdFrom[srcSeat]) || 0;
      if (taken <= 0 || !canDispatch()) return;
      var removed = Math.min(1, taken);
      try {
        t.dispatch({ t: "batch", actions: [
          { t: "commander_damage", seat: m.seat, fromSeat: srcSeat, fromCmd: "primary", delta: -removed },
          { t: "adjust_life", seat: m.seat, delta: removed }
        ] });
      } catch (e) {}
    }
    lastCdSig = ""; // force repaint
    refresh();
  }

  function renderModalLive(list) {
    if (!modal) return; list = list || seats();
    var m = me(list); if (!m) return;
    var grid = modal.querySelector("#plCdGrid"); if (!grid) return;
    var minusOk = canDispatch();

    // repaint only when the underlying data changed (the 500ms tick otherwise eats taps)
    var sig = list.map(function (s) {
      return s.seat + "|" + (s.commanderArt || "") + "|" + (s.commanderName || s.name || "") + "|" + ((m.cmdFrom && m.cmdFrom[s.seat]) || 0);
    }).join("~") + "~" + minusOk;
    if (sig === lastCdSig) return;
    lastCdSig = sig;

    if (!list.length) { grid.innerHTML = '<p class="pl-cd-empty">No players.</p>'; return; }
    grid.innerHTML = list.map(function (s) {
      var mine = s.seat === m.seat;
      var art = cssUrl(s.commanderArt);
      var taken = (m.cmdFrom && m.cmdFrom[s.seat]) || 0;
      var cls = taken >= 21 ? " lethal" : (taken >= 15 ? " warn" : "");
      var body =
        '<span class="pl-cd-art' + (art ? "" : " blank") + '"' + (art ? ' style="background-image:' + art + '"' : "") + '></span>' +
        '<span class="pl-cd-nm">' + esc(s.commanderName || s.name || ("Seat " + s.seat)) + '</span>' +
        '<span class="pl-cd-owner">' + esc(mine ? "You" : (s.name || ("Seat " + s.seat))) + '</span>';
      if (mine) return '<div class="pl-cd-tile me">' + body + '<span class="pl-cd-tot me">—</span></div>';
      return '<div class="pl-cd-tile">' + body +
        '<span class="pl-cd-tot' + cls + '">' + taken + '/21</span>' +
        '<div class="pl-cd-steps">' +
          '<button type="button" class="pl-cd-b pl-cd-minus" data-cd="-" data-seat="' + s.seat + '" aria-label="Remove 1 commander damage"' +
            ((minusOk && taken > 0) ? "" : " disabled" + (minusOk ? "" : ' title="Needs MTGTable.dispatch"')) + '>' + IC.minus + '</button>' +
          '<button type="button" class="pl-cd-b pl-cd-plus" data-cd="+" data-seat="' + s.seat + '" aria-label="Take 1 commander damage">' + IC.plus + '</button>' +
        '</div></div>';
    }).join("");
  }

  function closeModal() { if (modal) { try { modal.remove(); } catch (e) {} } modal = null; lastCdSig = ""; }

  // ============================================================
  // OPPONENT PANEL (read-only) — click an opponent's chip (top vitals bar) to see the commander
  // damage THEY have taken, broken down per source commander ("From Zinnia: 7 · From Krenko: 3").
  // No edit controls: only the target player may change their own life/counters/commander damage.
  // Stays live-synced — renderOppLive() repaints from state every refresh() tick (same 500ms loop
  // that already keeps the rest of this hub current across the realtime channel + pull()/rebuild).
  // ============================================================
  function openOpponent(seat) {
    seat = Number(seat);
    var list = seats(); var m = me(list); if (!m || seat === m.seat) return; // never opens for MY OWN chip
    closeOppModal();
    oppModalSeat = seat;
    oppModal = eln("div", "pl-modal"); oppModal.id = "plOppModal";
    oppModal.innerHTML =
      '<div class="pl-sheet pl-cd-sheet pl-opp-sheet" role="dialog" aria-label="Commander damage taken">' +
        '<button type="button" class="pl-sheet-x" data-oact="close" aria-label="Close">' + IC.close + '</button>' +
        '<div class="pl-sheet-hd"><div class="pl-sheet-tt"><p class="pl-kick" id="plOppKick">Read-only · 21 is lethal</p><h3 id="plOppTitle">Commander Damage</h3></div></div>' +
        '<div class="pl-opp-life" id="plOppLife"></div>' +
        '<div class="pl-cd-grid pl-opp-grid" id="plOppGrid"></div>' +
        '<p class="pl-cd-hint">' + esc("Read-only — only they can change their own life, counters, or commander damage.") + '</p>' +
      '</div>';
    (document.getElementById("playPage") || document.body).appendChild(oppModal);
    oppModal.addEventListener("click", function (e) {
      if (e.target === oppModal) { closeOppModal(); return; }
      var x = e.target.closest ? e.target.closest('[data-oact="close"]') : null;
      if (x && oppModal.contains(x)) { closeOppModal(); }
    });
    lastOppSig = "";
    renderOppLive(list);
  }

  function renderOppLive(list) {
    if (!oppModal || oppModalSeat == null) return;
    list = list || seats();
    var m = me(list); if (!m) return;
    var opp = null; for (var i = 0; i < list.length; i++) if (list[i] && list[i].seat === oppModalSeat) { opp = list[i]; break; }
    if (!opp) { closeOppModal(); return; } // seat vanished (left the game) — don't show stale data
    var t = T();
    var detail = callT("cmdDamageDetail", oppModalSeat) || [];

    // repaint only when the underlying data changed (life, poison, or any commander-damage value) —
    // matches the existing pl-cd sheet's anti-churn pattern so the 500ms tick doesn't eat clicks.
    var sig = opp.life + "|" + opp.poison + "|" + detail.map(function (d) { return d.sourceSeat + ":" + d.fromCmd + "=" + d.amount; }).join(",");
    if (sig === lastOppSig) return;
    lastOppSig = sig;

    var titleEl = oppModal.querySelector("#plOppTitle"); if (titleEl) titleEl.textContent = "Commander Damage — " + (opp.name || ("Seat " + opp.seat));
    var kickEl = oppModal.querySelector("#plOppKick"); if (kickEl) kickEl.textContent = "Damage taken by " + (opp.name || ("Seat " + opp.seat)) + " · read-only · 21 is lethal";

    var lifeEl = oppModal.querySelector("#plOppLife");
    if (lifeEl) {
      var lifeShown = Math.max(0, Number(opp.life) || 0);
      var chips = COUNTERS.map(function (c) {
        var v = c.k === "poison" ? Math.max(0, Number(opp.poison) || 0) : 0; // opponent counters beyond poison aren't exposed by seatsInfo(); poison is
        return v > 0 ? '<span class="pl-cchip pl-cchip-' + c.k + '" title="' + esc(c.label) + '">' + (c.ic || "") + '<b>' + v + '</b></span>' : "";
      }).join("");
      lifeEl.innerHTML = '<span class="pl-opp-lifenum">' + lifeShown + '</span><span class="pl-opp-lifelbl">Life</span>' + (chips ? '<span class="pl-opp-chips">' + chips + '</span>' : "");
    }

    var grid = oppModal.querySelector("#plOppGrid"); if (!grid) return;
    if (!detail.length) { grid.innerHTML = '<p class="pl-cd-empty">No commander damage taken yet.</p>'; return; }
    grid.innerHTML = detail.map(function (d) {
      var art = cssUrl(d.commanderArt);
      var cls = d.amount >= 21 ? " lethal" : (d.amount >= 15 ? " warn" : "");
      return '<div class="pl-cd-tile pl-opp-tile">' +
        '<span class="pl-cd-art' + (art ? "" : " blank") + '"' + (art ? ' style="background-image:' + art + '"' : "") + '></span>' +
        '<span class="pl-cd-nm">' + esc(d.commanderName) + '</span>' +
        '<span class="pl-cd-owner">From ' + esc(d.sourcePlayerName) + '</span>' +
        '<span class="pl-cd-tot' + cls + '">' + d.amount + '/21</span>' +
      '</div>';
    }).join("");
  }

  function closeOppModal() { if (oppModal) { try { oppModal.remove(); } catch (e) {} } oppModal = null; oppModalSeat = null; lastOppSig = ""; }

  // ============================================================
  // LIFECYCLE
  // ============================================================
  function hideLegacy() { try { var hl = document.getElementById("hudLife"); if (hl) hl.style.display = "none"; } catch (e) {} }

  function show() {
    if (!seats().length) { hide(); return; }
    build();
    if (root) root.style.display = "";
    hideLegacy();
    refresh();
    if (refInt) clearInterval(refInt);
    refInt = setInterval(refresh, 500);
  }

  function hide() {
    if (refInt) { clearInterval(refInt); refInt = null; }
    if (commitTO) { clearTimeout(commitTO); commitTO = null; }
    pending = 0; pendStart = null; lastLife = null; lastSeat = null; poisonKO = null;
    endAllHolds();
    closeModal(); closeCounters(); closeConcede(); closeOppModal();
    if (root) root.style.display = "none";
  }

  function isFs() {
    try {
      if (!document.body || !document.body.classList.contains("play-fs")) return false;
      // "At the board" only: the play-shell overlay (mode-select / lobby / playmat / bracket) keeps
      // #playShell.active on every pre-game screen and drops it when the board launches. Without this
      // guard the life cluster leaked onto the lobby/mode-select. (user QA 2026-07-03)
      var sh = document.getElementById("playShell");
      if (sh && sh.classList.contains("active")) return false;
      return true;
    } catch (e) { return false; }
  }

  function watch() {
    if (mo) return;
    mo = new MutationObserver(function () { if (isFs()) show(); else hide(); });
    try { mo.observe(document.body, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    // The game usually finishes loading AFTER body gets play-fs (async deck fetch), and the class
    // never changes again — so show() saw zero seats once and gave up. Retry while in fullscreen play.
    setInterval(function () { try { if (isFs() && (!root || root.style.display === "none")) show(); } catch (e) {} }, 800);
  }

  function boot() { watch(); if (isFs()) show(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.MTGLife = { show: show, hide: hide, refresh: refresh, openOpponent: openOpponent };
})();
