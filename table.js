/*
 * table.js — Play tab: solo virtual tabletop (DOM renderer + input) over the pure table-core.js reducer.
 * No build, no framework. Owns its own tab activation (app.js's setActivePage coerces non-"deck" to "life").
 */
(function () {
  "use strict";
  if (typeof MTGCore === "undefined") { console.warn("table.js: MTGCore missing"); return; }

  var BOARD_W = 1600, BOARD_H = 1180;
  var CARD_BACK = "https://backs.scryfall.io/normal/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg";
  var PILES = {
    exile: { x: 1460, y: 300, label: "Exile" },
    graveyard: { x: 1460, y: 480, label: "Graveyard" },
    library: { x: 1460, y: 660, label: "Library" },
    command: { x: 1460, y: 840, label: "Command" }
  };
  var P_COUNTERS = ["poison", "energy", "experience"];
  var ALL_COUNTERS = ["poison", "infect", "energy", "experience", "storm", "treasure", "clue", "food", "blood", "map", "rad", "shield", "oil", "charge", "loyalty", "monarch", "initiative", "tax"];
  var visibleCounters = ["poison", "energy", "experience"];
  var COMMON_COUNTERS = ["+1/+1", "-1/-1", "loyalty", "charge", "stun", "+1/+0", "+0/+1", "shield", "oil", "lore", "time", "fade", "quest", "page", "ice", "gold"];
  var SAMPLE = {
    name: "Krenko Goblins (sample)",
    // ~40-card demo tuned to a realistic land ratio (~42%) so opening hands show variety, not all Mountains.
    list: [
      { name: "Krenko, Mob Boss", qty: 1, isCommander: true },
      { name: "Sol Ring", qty: 1 }, { name: "Arcane Signet", qty: 1 }, { name: "Fellwar Stone", qty: 1 },
      { name: "Goblin Chieftain", qty: 1 }, { name: "Goblin Warchief", qty: 1 }, { name: "Goblin King", qty: 1 },
      { name: "Skirk Prospector", qty: 1 }, { name: "Goblin Rabblemaster", qty: 1 }, { name: "Goblin Piledriver", qty: 1 },
      { name: "Legion Loyalist", qty: 1 }, { name: "Mogg War Marshal", qty: 1 }, { name: "Siege-Gang Commander", qty: 1 },
      { name: "Reckless Bushwhacker", qty: 1 }, { name: "Goblin Matron", qty: 1 }, { name: "Goblin Instigator", qty: 1 },
      { name: "Impact Tremors", qty: 1 }, { name: "Purphoros, God of the Forge", qty: 1 }, { name: "Goblin Bombardment", qty: 1 },
      { name: "Lightning Bolt", qty: 1 }, { name: "Shatterskull Smashing", qty: 1 }, { name: "Krenko's Command", qty: 1 },
      { name: "Krenko's Way", qty: 1 }, { name: "Shared Animosity", qty: 1 },
      { name: "Mountain", qty: 17 }
    ]
  };

  var camera = { x: 60, y: 40, z: 0.7 };
  var state = null, undoStack = [], imagesById = {}, hoveredId = null, tokenSeq = 0, gameSeed = "g" + Date.now();
  var attachPending = null, booted = false, el = {};
  var mySeat = 0, online = false, selected = [], targetPending = null, annSeq = 0;
  var previewCard = null;
  var onStackIds = {};  // "on the stack" — keeps the card on the board (greyed) instead of moving it to a stack zone
  var stackOrder = []; // LIFO order of instanceIds on the stack (last = top); drives the stack panel + reorder
  var blockingIds = {}; // local "declared blocker" shield flags (cleared on untap_all / new game)
  var handPan = 0;      // hand overflow pan offset in px (G3.20), applied via the --hand-pan CSS var
  var _stackWasEmpty = null; // tracks empty→filled transitions so the stack can animate in/out (G2.17)
  var _turnKey = null;  // "turn:activeSeat" fingerprint for turn-change flashes + online turn-start engine
  var gameOverShown = false; // guards the auto game-over overlay so it fires once per game
  var matchRecorded = false; // guards local match-history recording to once per game
  var manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  var openMana = null;
  var ctrPickOpen = false;
  var seatDecks = {};
  var startingLife = 40;
  var voiceSelfId = "v-" + ((globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(16).slice(2)));
  var mulliganCount = 0, bottomNeeded = 0;
  var numOpponents = 0, lastList = null, lastImages = null, lastLabel = "", pendingFit = false;
  var sideboardCards = [];       // [{cardId, name}] collected at load; survives New game, persisted per-deck (Kiku sideboard parity)
  var sideboardDeckKey = null;   // localStorage key ("mtg-sideboard-v1:<label>") of the deck the current sideboard belongs to
  var startDeckSize = 0;         // library+hand+battlefield count at load, for the soft "≠ starting size" swap warning
  var planar = { deck: [], pos: 0, loaded: false };
  var draft = { cards: [], pool: [], pack: [], picks: 0, target: 45, set: "" };

  function $(id) { return document.getElementById(id); }
  function boot() {
    if (booted) return; booted = true;
    el = {
      page: $("playPage"), btn: $("playTabButton"), surface: $("tblSurface"), viewport: $("tblViewport"),
      hand: $("tblHand"), preview: $("tblPreview"), log: $("tblLog"), status: $("tblStatus"),
      deckSelect: $("tblDeckSelect"), main: document.querySelector(".tbl-main"), rail: document.querySelector(".tbl-rail")
    };
    if (!el.page || !el.btn) { console.warn("table.js: Play markup missing"); return; }
    el.btn.addEventListener("click", activatePlay);
    document.querySelectorAll("[data-page-target]").forEach(function (b) { b.addEventListener("click", deactivatePlay); });
    buildExtras();
    if (el.preview) { el.preview.style.cursor = "zoom-in"; el.preview.addEventListener("click", function () { if (previewCard) openInspect(previewCard); }); }
    try { if (document.fonts && document.fonts.load) { document.fonts.load('20px "Material Symbols Rounded"').catch(function () {}); setTimeout(function () { try { if (document.fonts.check && !document.fonts.check('20px "Material Symbols Rounded"')) document.body.classList.add("no-msym"); } catch (e) {} }, 2500); } } catch (e) {}
    if (window.MTGTableSync) MTGTableSync.onConn = showConnStatus;
    populateDeckSelect(); bindControls(); bindBoard(); bindHandWheel(); bindHotkeys(); bindLogCardLinks(); applyCamera(); loadPlaymat(); maybeAutoPlay();
  }
  function activatePlay() {
    document.querySelectorAll(".page-panel").forEach(function (p) { p.classList.remove("active"); });
    el.page.classList.add("active");
    document.querySelectorAll("[data-page-target]").forEach(function (b) { b.classList.remove("active"); b.removeAttribute("aria-current"); });
    el.btn.classList.add("active"); el.btn.setAttribute("aria-current", "page");
    if (window.history && window.history.replaceState) window.history.replaceState(null, "", "#table");
    if (!state) loadGame();
    requestAnimationFrame(render);
  }
  function deactivatePlay() { el.page.classList.remove("active"); el.btn.classList.remove("active"); el.btn.removeAttribute("aria-current"); }

  // vitals strip + stack panel, created in JS so index.html stays minimal
  function buildExtras() {
    var v = document.createElement("div"); v.className = "tbl-vitals"; v.id = "tblVitals";
    if (el.main && el.main.parentNode) el.main.parentNode.insertBefore(v, el.main);
    el.vitals = v;
    v.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || !state) return;
      if (b.dataset.v != null) { floatDelta(b, Number(b.dataset.v)); dispatch({ t: "adjust_life", seat: mySeat, delta: Number(b.dataset.v) }); }
      else if (b.dataset.pc) dispatch({ t: "player_counter", seat: mySeat, kind: b.dataset.pc, delta: Number(b.dataset.d) });
      else if (b.dataset.ph) {
        // Clicking Untap while at End (or past Main 2) wraps to a NEW turn — roll the turn like Pass turn.
        var order = ["untap", "upkeep", "draw", "main1", "combat", "main2", "end"];
        var cur = order.indexOf(state.phase);
        if (b.dataset.ph === "end") { dispatch({ t: "set_phase", phase: "end" }); var pEnd = document.getElementById("tblPass"); if (pEnd) pEnd.click(); } // moving to End auto-passes the turn
        else if (b.dataset.ph === "untap" && cur >= order.indexOf("end")) { var pass = document.getElementById("tblPass"); if (pass) pass.click(); }
        else dispatch({ t: "set_phase", phase: b.dataset.ph });
      }
      else if (b.dataset.ol != null) { floatDelta(b, Number(b.dataset.d)); dispatch({ t: "adjust_life", seat: Number(b.dataset.ol), delta: Number(b.dataset.d) }); }
      else if (b.dataset.manaopen) { openMana = (openMana === b.dataset.manaopen ? null : b.dataset.manaopen); renderVitals(); }
      else if (b.dataset.ctrpick != null) { ctrPickOpen = !ctrPickOpen; renderVitals(); }
      else if (b.dataset.mana) { if (b.dataset.mana === "_clear") { manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }; openMana = null; } else { var md = b.dataset.d ? Number(b.dataset.d) : (e.shiftKey ? -1 : 1); manaPool[b.dataset.mana] = Math.max(0, (manaPool[b.dataset.mana] || 0) + md); } renderVitals(); }
    });
    v.addEventListener("change", function (e) {
      var cb = e.target.closest("input[data-ctrtoggle]"); if (!cb) return;
      var k = cb.dataset.ctrtoggle, i = visibleCounters.indexOf(k);
      if (cb.checked && i < 0) visibleCounters.push(k); else if (!cb.checked && i >= 0) visibleCounters.splice(i, 1);
      renderVitals();
    });
    // Click anywhere outside the vitals strip closes the mana / counter popups (capture phase so it
    // runs before the click re-renders the strip, keeping the inside/outside test reliable).
    document.addEventListener("click", function (e) {
      if (!openMana && !ctrPickOpen) return;
      if (e.target.closest && e.target.closest("#tblVitals")) return;
      openMana = null; ctrPickOpen = false; renderVitals();
    }, true);
    var st = document.createElement("div"); st.className = "tbl-stack"; st.id = "tblStack";
    if (el.rail) el.rail.insertBefore(st, el.rail.firstChild);
    el.stack = st;
    st.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || !state) return;
      if (b.dataset.id && b.dataset.to) dispatch({ t: "card_move", instanceId: b.dataset.id, toZone: b.dataset.to, x: 40, y: 55 });
    });
    var ctrls = document.querySelector(".tbl-controls");
    if (ctrls) {
      var pt = document.createElement("button"); pt.type = "button"; pt.id = "tblPass"; pt.innerHTML = '<span class="msym">skip_next</span>Pass turn'; pt.onclick = doPassTurn; ctrls.appendChild(pt);
      var mu = document.createElement("button"); mu.type = "button"; mu.innerHTML = '<span class="msym">cached</span>Mulligan'; mu.title = "London mulligan"; mu.onclick = doMulligan; ctrls.appendChild(mu);
      // (standalone End-game button removed \u2014 End game now lives in the HUD Settings menu, G4.31)
      var pod = document.createElement("select"); pod.title = "Solo pod size (reshuffles & restarts)"; [[0, "Solo"], [1, "+1 opp"], [2, "+2 opp"], [3, "+3 opp"]].forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; pod.appendChild(op); }); pod.value = String(numOpponents); pod.onchange = function () { numOpponents = +pod.value; if (lastList) buildAndStart(lastList, lastImages, lastLabel); else setStatus("Load a deck first, then pick a pod size."); }; ctrls.appendChild(pod);
      function ctlBtn(label, fn, title, icon) { var b = document.createElement("button"); b.type = "button"; b.innerHTML = (icon ? '<span class="msym">' + icon + '</span>' : "") + label; if (title) b.title = title; b.onclick = fn; return b; }
      function barMenu(label, items) {
        var ICON = ({ Table: "casino", Deck: "style", Online: "groups" })[label] || ""; var b = document.createElement("button"); b.type = "button"; b.className = "bar-menu-btn"; b.innerHTML = (ICON ? '<span class="msym">' + ICON + '</span>' : "") + label + " \u25BE";
        b.onclick = function (e) { e.stopPropagation(); closeMenu(); var m = document.createElement("div"); m.className = "tbl-menu"; items.forEach(function (it) { if (it === "-") { var s = document.createElement("div"); s.className = "sep"; m.appendChild(s); return; } var ib = document.createElement("button"); ib.textContent = it[0]; ib.onclick = function () { closeMenu(); it[1](); }; m.appendChild(ib); }); document.body.appendChild(m); var r = b.getBoundingClientRect(), vw = document.documentElement.clientWidth; m.style.left = Math.min(r.left, vw - m.offsetWidth - 8) + "px"; m.style.top = (r.bottom + 4) + "px"; menuEl = m; };
        return b;
      }
      ctrls.appendChild(ctlBtn("Combat", openCombat, "Resolve declared attackers", "swords"));
      ctrls.appendChild(ctlBtn("Cmd dmg", openCmdMatrix, "Commander damage matrix", "skull"));
      ctrls.appendChild(barMenu("Table", [["Recenter view", recenter], ["Restart game", function () { if (lastList) buildAndStart(lastList, lastImages, lastLabel); else { state = null; loadGame(); } }], ["Starting life\u2026", function () { var v = parseInt(window.prompt("Starting life total", String(startingLife)), 10); if (v > 0) { startingLife = v; if (lastList) buildAndStart(lastList, lastImages, lastLabel); else setStatus("Starting life set to " + v + " \u2014 load a deck to apply."); } }], ["Playmat\u2026", openPlaymat], "-", ["Roll d20", function () { rollDice("d20"); }], ["Roll d6", function () { rollDice("d6"); }], ["Flip coin", function () { rollDice("Coin"); }], "-", ["Planechase\u2026", openPlanechase], ["Draft a pool\u2026", openDraft], ["Deck insights\u2026", openInsights]]));
      ctrls.appendChild(barMenu("Deck", [["Paste decklist\u2026", openPasteDeck], ["Sideboard\u2026", openSideboard], "-", ["Save board", saveBoard], ["Load board", loadBoard], "-", ["Share playtest link", shareLink], ["Hotkeys (?)", showHotkeyHelp]]));
      if (window.MTGTableSync) {
        ctrls.appendChild(barMenu("Online", [["Find games\u2026", openLobby], "-", ["Host public game", function () { doHost({ visibility: "public" }); }], ["Host private game", function () { doHost(); }], ["Join by ID\u2026", function () { doJoin(); }], "-", ["Text chat (toggle)", toggleChat], ["Voice chat (toggle)", toggleVoice]]));
      }
    }
  }

  function readSavedDecks() {
    try { var raw = JSON.parse(localStorage.getItem("magic-table-tracker-decks-v1") || "{}"); return Array.isArray(raw.decks) ? raw.decks : []; }
    catch (e) { return []; }
  }
  function populateDeckSelect() {
    if (!el.deckSelect) return;
    el.deckSelect.innerHTML = '<option value="__sample">Sample deck (Krenko)</option>';
    readSavedDecks().forEach(function (d, i) { var o = document.createElement("option"); o.value = String(i); o.textContent = d.name || ("Deck " + (i + 1)); el.deckSelect.appendChild(o); });
  }
  function getPlayParam() { try { var u = new URL(location.href); var p = u.searchParams.get("play"); if (p) return p; var m = (location.hash || "").match(/play=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; } }
  function maybeAutoPlay() {
    var p = getPlayParam(); if (!p) return;
    if (el.deckSelect) {
      if (p === "sample") el.deckSelect.value = "__sample";
      else if (/^[0-9]+$/.test(p)) el.deckSelect.value = p;
      else if (p.indexOf("deck:") === 0) { var did = p.slice(5), decks = readSavedDecks(); for (var i = 0; i < decks.length; i++) { if (String(decks[i].source_deck_id || decks[i].id) === did) { el.deckSelect.value = String(i); break; } } }
    }
    activatePlay();
  }
  function shareLink() {
    var v = el.deckSelect ? el.deckSelect.value : "__sample", pv = "sample";
    if (v !== "__sample") { var d = readSavedDecks()[Number(v)]; pv = d ? ("deck:" + (d.source_deck_id || d.id)) : "sample"; }
    var url = location.origin + location.pathname + "?play=" + encodeURIComponent(pv);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { setStatus("Playtest link copied"); log("<b>Share</b> " + esc(url)); }, function () { setStatus(url); });
    else { setStatus(url); log("<b>Share</b> " + esc(url)); }
  }
  function entryImage(card) {
    if (!card) return "";
    return (card.image_uris && (card.image_uris.large || card.image_uris.png || card.image_uris.normal)) ||
      (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris && (card.card_faces[0].image_uris.large || card.card_faces[0].image_uris.png || card.card_faces[0].image_uris.normal)) || "";
  }
  function faceImg(f) { return (f && f.image_uris && (f.image_uris.large || f.image_uris.png || f.image_uris.normal)) || ""; }
  function entryImages(card) {
    if (!card) return { img: "", back: "" };
    if (card.card_faces && card.card_faces[0] && card.card_faces[1] && card.card_faces[0].image_uris) {
      return { img: faceImg(card.card_faces[0]), back: faceImg(card.card_faces[1]) };
    }
    return { img: entryImage(card), back: "" };
  }
  function cardPT(card) {
    if (!card) return { pt: null, isCreature: false };
    var f = card;
    if ((card.power == null || card.toughness == null) && card.card_faces && card.card_faces[0]) f = card.card_faces[0];
    var tl = f.type_line || card.type_line || "";
    var isCreature = /creature|vehicle/i.test(tl);
    if (f.power != null && f.toughness != null) return { pt: [String(f.power), String(f.toughness)], isCreature: isCreature };
    return { pt: null, isCreature: isCreature };
  }
  function sectionIsCommander(s) { return s === "commander" || s === "commanders"; }

  async function loadGame() {
    seatDecks = {};
    var choice = el.deckSelect ? el.deckSelect.value : "__sample";
    setStatus("Loading deck…");
    if (choice && choice !== "__sample") {
      var deck = readSavedDecks()[Number(choice)]; var images = {}, list = [], sbCollected = [];
      (deck.cards || []).forEach(function (entry) {
        var nm = (entry.card && entry.card.name) || entry.name; if (!nm) return;
        var id = (entry.card && entry.card.id) || nm;
        var _pt = cardPT(entry.card || {}); images[id] = { img: entryImage(entry.card), name: nm, pt: _pt.pt, isCreature: _pt.isCreature };
        // maybeboard never touches the table; the sideboard is EXCLUDED from the library but COLLECTED for swapping.
        if (entry.section === "maybeboard") return;
        if (entry.section === "sideboard") { for (var sk = 0; sk < (entry.quantity || 1); sk++) sbCollected.push({ cardId: id, name: nm }); return; }
        for (var k = 0; k < (entry.quantity || 1); k++) list.push({ cardId: id, name: nm, isCommander: sectionIsCommander(entry.section) });
      });
      if (!list.length) return loadSample();
      // Load (or reset) the persistent sideboard for THIS deck. A different deck resets it; the same deck restores swaps.
      loadSideboardForDeck(deck.name || ("Deck " + choice), sbCollected, images);
      buildAndStart(list, images, deck.name);
    } else { sideboardCards = []; sideboardDeckKey = null; await loadSample(); }
  }
  async function loadSample() {
    seatDecks = {};
    var images = {}, list = [];
    try {
      var names = SAMPLE.list.map(function (e) { return e.name; });
      var uniq = names.filter(function (n, i) { return names.indexOf(n) === i; });
      var res = await fetch("https://api.scryfall.com/cards/collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifiers: uniq.map(function (n) { return { name: n }; }) }) }).then(function (r) { return r.json(); });
      var byName = {}; (res.data || []).forEach(function (c) { byName[c.name.toLowerCase()] = c; });
      SAMPLE.list.forEach(function (e) {
        var c = byName[e.name.toLowerCase()]; var id = (c && c.id) || e.name;
        images[id] = { img: c ? entryImage(c) : "", name: e.name };
        for (var k = 0; k < e.qty; k++) list.push({ cardId: id, name: e.name, isCommander: !!e.isCommander });
      });
    } catch (err) {
      SAMPLE.list.forEach(function (e) { images[e.name] = { img: "", name: e.name }; for (var k = 0; k < e.qty; k++) list.push({ cardId: e.name, name: e.name, isCommander: !!e.isCommander }); });
      setStatus("Offline — cards shown as text.");
    }
    buildAndStart(list, images, SAMPLE.name);
  }
  function buildAndStart(list, images, label) {
    imagesById = {}; for (var ik in images) imagesById[ik] = images[ik];
    for (var sdk in seatDecks) { var sim = seatDecks[sdk].images || {}; for (var sk in sim) imagesById[sk] = sim[sk]; }
    lastList = list; lastImages = images; lastLabel = label || "deck";
    mySeat = 0;
    var seats = 1 + numOpponents, hotseat = !online && numOpponents > 0;
    var decks = [];
    for (var s = 0; s < seats; s++) { if (seatDecks[s]) decks.push(seatDecks[s].list); else decks.push((hotseat || s === 0) ? list : null); }
    state = MTGCore.init({ seats: seats, decks: decks, startingLife: startingLife, deckSize: 0 });
    undoStack = []; mulliganCount = 0; bottomNeeded = 0; pendingFit = true; onStackIds = {}; stackOrder = []; gameOverShown = false; matchRecorded = false; _lossFlagged = {};
    blockingIds = {}; handPan = 0; _stackWasEmpty = null; _turnKey = null;
    if (el.hand) el.hand.style.setProperty("--hand-pan", "0px");
    for (var s2 = 0; s2 < seats; s2++) {
      if (!decks[s2]) continue;
      state = MTGCore.reduce(state, { t: "library_shuffle", seat: s2, seed: gameSeed + "-" + s2 });
      state = MTGCore.reduce(state, { t: "draw", seat: s2, count: 7 });
    }
    // Auto-populate the local player's name from the signed-in account (guest → "You").
    try { if (state.players && state.players[mySeat] && !state.players[mySeat]._namedByUser) state.players[mySeat].name = accountPlayerName(); } catch (e) {}
    // Baseline deck size (library + hand + battlefield) for the soft sideboard-swap warning. Snapshot once per deck load.
    startDeckSize = mySeatDeckCount();
    log("<b>Loaded</b> " + esc(label || "deck") + (hotseat ? (" — hotseat " + seats + "-player (Pass turn hands control to the next seat).") : " — drew 7."));
    setStatus(MTGCore.zoneCount(state, mySeat, "library") + " in library · " + MTGCore.zoneCount(state, mySeat, "hand") + " in hand");
    render();
  }
  function mySeatDeckCount() {
    try { return MTGCore.zoneCount(state, mySeat, "library") + MTGCore.zoneCount(state, mySeat, "hand") + MTGCore.zoneCount(state, mySeat, "battlefield"); } catch (e) { return 0; }
  }
  function assignSeatDeck(seat, list, images) {
    if (seat == null) { buildAndStart(list, images, "Pasted deck"); return; }
    seatDecks[seat] = { list: list, images: images || {} };
    buildAndStart(lastList || list, lastImages || images, lastLabel || "deck");
    setStatus("Loaded a deck for " + (seat === mySeat ? "your seat" : "seat " + seat) + ".");
  }

  function changedIdsOf(a) {
    if (a.t === "batch") { var u = {}; (a.actions || []).forEach(function (sub) { changedIdsOf(sub).forEach(function (id) { u[id] = 1; }); }); return Object.keys(u); }
    if (a.t === "__add") return (a.cards || []).map(function (c) { return c.instanceId; }).filter(Boolean);
    if (a.t === "__remove") return (a.ids || []).slice();
    if (a.instanceIds) return a.instanceIds;
    if (a.fromId) return [a.fromId, a.instanceId].filter(Boolean);
    if (a.instanceId) return [a.instanceId];
    if (a.t === "draw" || a.t === "mill" || a.t === "library_shuffle" || a.t === "library_scry" || a.t === "untap_all") { var out = []; for (var id in state.cards) { if (state.cards[id].ownerSeat === mySeat) out.push(id); } return out; }
    return [];
  }
  function deckListFromState() { var out = []; for (var id in state.cards) { var c = state.cards[id]; out.push({ cardId: c.cardId, name: c.name, isCommander: c.isCommander }); } return out; }
  function toggleVoice() {
    if (!window.MTGVoice) { setStatus("Voice module not loaded."); return; }
    if (!MTGVoice.isEnabled()) { setStatus("Voice is off \u2014 set window.MTG_VOICE_CONFIG = { enabled: true, iceServers: [ \u2026TURN\u2026 ] } before table.js to enable it."); return; }
    if (!online || !window.MTGTableSync) { setStatus("Host or join an online game first to use voice."); return; }
    if (MTGVoice.status().active) { MTGVoice.leave(); if (window.MTGVoiceUI) MTGVoiceUI.hide(); setStatus("Left voice chat."); return; }
    var vmeta = null;
    try { var vsl = window.MTGTable ? MTGTable.seatsInfo() : []; for (var vi = 0; vi < vsl.length; vi++) { if (vsl[vi] && vsl[vi].isMe) { vmeta = { seat: vsl[vi].seat, name: vsl[vi].name, art: vsl[vi].commanderArt, color: vsl[vi].color, commander: vsl[vi].commanderName }; break; } } } catch (e) {}
    if (window.MTGVoiceUI) MTGVoiceUI.show();
    MTGVoice.join({ gameId: (MTGTableSync.info && MTGTableSync.info().gameId) || null, selfId: voiceSelfId, meta: vmeta, send: function (m) { if (MTGTableSync.broadcastEphemeral) MTGTableSync.broadcastEphemeral(m); } }).then(function () { setStatus("Joined voice chat."); }, function (e) { if (window.MTGVoiceUI) MTGVoiceUI.hide(); setStatus("Voice: " + ((e && e.message) || e)); });
  }
  async function doHost(opts) {
    opts = opts || {};
    if (!state) { setStatus("Load a deck first."); return; }
    if (!window.MTGTableSync) { setStatus("Sync not loaded."); return; }
    try {
      MTGTableSync.onRemote = function (rs) { state = rs; render(); };
      MTGTableSync.onEphemeral = handleEphemeral;
      var pub = opts.visibility === "public";
      var gname = opts.name || "Commander table";
      if (opts.bracket && /^[1-5]$/.test(String(opts.bracket))) gname = "B" + opts.bracket + " · " + (opts.name || "Commander table"); // expected bracket shown in the lobby list
      var gid = await MTGTableSync.host(deckListFromState(), { displayName: "Host", visibility: pub ? "public" : "private", name: gname, scheduledAt: opts.scheduledAt || null });
      online = true; mySeat = MTGTableSync.info().mySeat;
      setStatus((pub ? "Hosting PUBLIC game " : "Hosting private game ") + gid); log("<b>Hosting</b> " + (pub ? "public " : "") + "game " + gid + (pub ? " — others can Find it." : " (share the id)")); render();
    } catch (e) { setStatus("Host failed: " + (e && e.message ? e.message : e)); }
  }
  // Create an EMPTY online room instantly (no deck yet) so the lobby can hand out an invite link before the host picks a deck.
  async function doHostRoom(opts) {
    opts = opts || {};
    if (!window.MTGTableSync) { setStatus("Sync not loaded."); return null; }
    try {
      MTGTableSync.onRemote = function (rs) { state = rs; render(); };
      MTGTableSync.onEphemeral = handleEphemeral;
      var pub = opts.visibility === "public";
      var gid = await MTGTableSync.host([], { displayName: "Host", visibility: pub ? "public" : "private", name: opts.name });
      online = true; mySeat = MTGTableSync.info().mySeat;
      setStatus("Online room created — share your invite link."); log("<b>Room created</b> " + gid + " — pick your deck to take your seat.");
      return gid;
    } catch (e) { setStatus("Couldn't create room: " + (e && e.message ? e.message : e)); throw e; }
  }
  // Push my freshly-loaded deck into the room I already created (pairs with doHostRoom).
  async function persistMyDeck() {
    if (!state) { setStatus("Load a deck first."); return null; }
    if (!online || !window.MTGTableSync || !MTGTableSync.persistDeck) return null;
    try { return await MTGTableSync.persistDeck(deckListFromState()); } catch (e) { setStatus("Sync deck failed: " + (e && e.message ? e.message : e)); return null; }
  }
  async function doJoin(gameId) {
    if (!state) { setStatus("Load your deck first."); showToast("Load a deck first."); return false; }
    if (!window.MTGTableSync) { setStatus("Sync not loaded."); showToast("Online sync isn't available."); return false; }
    var gid = gameId || window.prompt("Game id to join:"); if (!gid) return false; gid = String(gid).trim();
    setStatus("Joining " + gid + "…"); showToast("Joining game…");
    try {
      MTGTableSync.onRemote = function (rs) { state = rs; render(); };
      MTGTableSync.onEphemeral = handleEphemeral;
      await MTGTableSync.join(gid, deckListFromState(), { displayName: "Player" });
      online = true; mySeat = MTGTableSync.info().mySeat;
      setStatus("Joined " + gid + " as seat " + mySeat); log("<b>Joined</b> " + gid); showToast("Joined the game."); render();
      return true;
    } catch (e) {
      var msg = (e && e.message ? e.message : String(e || ""));
      setStatus("Join failed: " + msg);
      showToast(/not found|no rows|does not exist|invalid|permission|policy/i.test(msg) ? "Couldn't join — invalid or expired game code." : ("Join failed: " + msg));
      return false;
    }
  }

  // Pass turn — the turn engine (auto-untap + draw for turn) fires for the seat RECEIVING the
  // turn (G4.32). Solo/hotseat runs it here; online, the receiving client runs it in checkTurnChange.
  function doPassTurn() {
    if (!state) return;
    manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    dispatch({ t: "pass_turn" });
    if (!online) {
      var as = state.activeSeat;
      if (state.seats > 1) { mySeat = as; showToast((as === 0 ? "You" : "Seat " + as) + " to play"); }
      dispatch({ t: "untap_all", seat: as });
      var drew = false;
      if (state.turn > 1 && MTGCore.zoneCount(state, as, "library") > 0) { dispatch({ t: "draw", seat: as, count: 1 }); drew = true; }
      dispatch({ t: "set_phase", phase: "main1" });
      log("<b>Turn " + state.turn + "</b> — untapped" + (drew ? " &amp; drew for turn." : "."));
      setStatus("Turn " + state.turn + " · " + MTGCore.zoneCount(state, mySeat, "hand") + " in hand");
    }
  }
  // Declare the game a draw/tie from the Settings menu (G4.31) — ends the game, records no winner.
  function declareDraw() {
    if (!state) { setStatus("No game in progress."); return; }
    gameOverShown = true; matchRecorded = true; // a draw records no winner
    log("<b>Game over</b> — declared a draw (tie) on turn " + (state.turn || 1) + ".");
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel gameover-panel"; ov.appendChild(panel);
    panel.innerHTML = '<div class="gameover-hero"><span class="msym gameover-trophy" style="color:#9aa6b8">handshake</span><div class="gameover-win">Draw (tie)</div><div class="gameover-sub">Turn ' + (state.turn || 1) + '</div></div>' +
      '<div class="end-foot"><button class="primary gameover-new">New game</button><button class="gameover-dismiss">Dismiss</button></div>';
    panel.querySelector(".gameover-new").onclick = function () { ov.remove(); setStatus("New game."); state = null; loadGame(); };
    panel.querySelector(".gameover-dismiss").onclick = function () { ov.remove(); };
    document.body.appendChild(ov);
    setStatus("Game ended in a draw.");
  }
  function doEndGame() {
    if (!state) { setStatus("No game in progress."); return; }
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel end-panel"; ov.appendChild(panel);
    function close() { ov.remove(); }
    var ps = state.players;
    function cmdTaken(p) { var cd = p.cmdDamage || {}, t = 0; for (var k in cd) t += cd[k]; return t; }
    function outp(p) { if (p.life <= 0) return true; var cd = p.cmdDamage || {}; for (var k in cd) if (cd[k] >= 21) return true; return false; }
    var defWin = 0, best = -Infinity; ps.forEach(function (p, i) { if (!outp(p) && p.life > best) { best = p.life; defWin = i; } });
    if (best === -Infinity) ps.forEach(function (p, i) { if (p.life > best) { best = p.life; defWin = i; } });
    var h = '<div class="pv-head"><span>Game results \u2014 turn ' + (state.turn || 1) + '</span><button class="pv-x">Close</button></div>';
    h += '<div class="end-rows">' + ps.map(function (p, i) { return '<label class="end-row"><input type="radio" name="winner" value="' + i + '"' + (i === defWin ? " checked" : "") + '><span class="end-name">' + (p.name ? esc(p.name) : (i === mySeat ? "You" : "Seat " + i)) + '</span><span class="end-stat">' + p.life + " life \u00b7 " + cmdTaken(p) + " cmdr dmg \u00b7 " + (outp(p) ? "out" : "alive") + "</span></label>"; }).join("") + "</div>";
    h += '<div class="end-foot"><button class="primary end-record">' + (online ? "Record result" : "Declare winner") + '</button><button class="end-new">New game</button></div>';
    panel.innerHTML = h;
    panel.querySelector(".pv-x").onclick = close;
    panel.querySelector(".end-new").onclick = function () { close(); setStatus("New game."); state = null; loadGame(); };
    panel.querySelector(".end-record").onclick = function () {
      var sel = panel.querySelector('input[name="winner"]:checked'); var win = sel ? +sel.value : defWin;
      var summary = { turns: state.turn, winnerSeat: win, finals: ps.map(function (p, i) { return { seat: i, life: p.life, cmdrTaken: cmdTaken(p) }; }) };
      var who = (win === mySeat ? "you" : "seat " + win);
      recordLocalMatch(win);
      if (online && window.MTGTableSync && MTGTableSync.recordWinner) { MTGTableSync.recordWinner(win, summary).then(function () { setStatus("Recorded \u2014 winner " + who); }).catch(function (e) { setStatus("Record failed: " + ((e && e.message) || e)); }); }
      else { setStatus("Winner: " + who); }
      log("<b>Game over</b> \u2014 winner " + who + " on turn " + state.turn + ".");
      close();
    };
    document.body.appendChild(ov);
  }
  // Record a local match-history entry (once per game) so the Profile page shows real W/L even offline.
  // The cloud match_history/ELO sync is a separate, migration-gated path; this always works.
  function recordLocalMatch(winSeat) {
    try {
      if (matchRecorded || !state || !state.players || !state.players[mySeat]) return;
      matchRecorded = true;
      var mp = state.players[mySeat], myCmd = "";
      try { var cmd = MTGCore.cardsOf(state, mySeat, "command"); for (var i = 0; i < cmd.length; i++) { var im = imagesById[cmd[i].cardId]; if (im && im.name) { myCmd = im.name; break; } } } catch (e) {}
      var brk = mp.bracket ? (parseInt(String(mp.bracket).replace(/[^0-9]/g, ""), 10) || null) : null;
      var entry = { won: winSeat === mySeat, commander_name: myCmd || (mp.name || ""), bracket: brk, seats: state.seats || state.players.length, turns: state.turn || 1, created_at: new Date().toISOString() };
      var key = "mtg-match-history-v1", arr = [];
      try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
      if (!Array.isArray(arr)) arr = [];
      arr.unshift(entry); if (arr.length > 100) arr = arr.slice(0, 100);
      try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
    } catch (e) {}
  }
  // Auto game-over: once ≤1 player remains alive in a multiplayer game, celebrate the winner + placement.
  function isOut(p) { if (!p) return true; if (p.life <= 0) return true; var cd = p.cmdDamage || {}; for (var k in cd) if (cd[k] >= 21) return true; if (p.counters && p.counters.poison >= 10) return true; return false; }
  function checkGameOver() {
    if (gameOverShown || !state || !state.players) return;
    if ((state.seats || state.players.length) < 2) return; // solo/sample game: no auto-overlay
    var alive = []; state.players.forEach(function (p, i) { if (!isOut(p)) alive.push(i); });
    if (alive.length <= 1) { gameOverShown = true; showGameOver(alive.length === 1 ? alive[0] : null); }
  }
  function showGameOver(winnerSeat) {
    var ps = state.players;
    function score(p) { return (p.life || 0); }
    // Placement: alive first, then by life. Winner (if any) forced to top.
    var order = ps.map(function (p, i) { return { seat: i, p: p, out: isOut(p) }; })
      .sort(function (a, b) { if (a.out !== b.out) return a.out ? 1 : -1; return score(b.p) - score(a.p); });
    if (winnerSeat != null) { order.sort(function (a, b) { return (a.seat === winnerSeat ? -1 : b.seat === winnerSeat ? 1 : 0); }); }
    var win = winnerSeat != null ? winnerSeat : (order[0] && order[0].seat);
    var whoName = function (i) { var p = ps[i]; return p && p.name ? esc(p.name) : (i === mySeat ? "You" : "Seat " + i); };
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel gameover-panel"; ov.appendChild(panel);
    var medals = ["#f6c453", "#cbd5e1", "#d08a54"];
    var h = '<div class="gameover-hero"><span class="msym gameover-trophy">emoji_events</span>' +
      '<div class="gameover-win">' + (win != null ? whoName(win) + " wins!" : "Game over") + "</div>" +
      '<div class="gameover-sub">Turn ' + (state.turn || 1) + "</div></div>";
    h += '<div class="gameover-rows">' + order.map(function (o, idx) {
      return '<div class="gameover-row"><span class="gameover-place" style="color:' + (medals[idx] || "#9aa6b8") + '">' + (idx + 1) + "</span>" +
        '<span class="gameover-name">' + whoName(o.seat) + "</span>" +
        '<span class="gameover-stat">' + (o.p ? o.p.life : 0) + " life · " + (o.out ? "out" : "alive") + "</span></div>";
    }).join("") + "</div>";
    h += '<div class="end-foot"><button class="primary gameover-new">New game</button>' +
      (online ? '<button class="gameover-record">Record result</button>' : "") +
      '<button class="gameover-dismiss">Dismiss</button></div>';
    panel.innerHTML = h;
    panel.querySelector(".gameover-new").onclick = function () { ov.remove(); setStatus("New game."); state = null; loadGame(); };
    panel.querySelector(".gameover-dismiss").onclick = function () { ov.remove(); };
    var rec = panel.querySelector(".gameover-record");
    if (rec) rec.onclick = function () {
      var summary = { turns: state.turn, winnerSeat: win, finals: ps.map(function (p, i) { return { seat: i, life: p.life }; }) };
      if (window.MTGTableSync && MTGTableSync.recordWinner) MTGTableSync.recordWinner(win, summary).then(function () { setStatus("Recorded — winner " + whoName(win)); rec.textContent = "Recorded"; rec.disabled = true; }).catch(function (e) { setStatus("Record failed: " + ((e && e.message) || e)); });
    };
    recordLocalMatch(win);
    log("<b>Game over</b> — winner " + (win != null ? whoName(win) : "?") + " on turn " + (state.turn || 1) + ".");
    document.body.appendChild(ov);
  }
  function dispatch(action) {
    if (!state) return;
    if (action && action.t === "card_move" && action.instanceId && (action.toZone === "graveyard" || action.toZone === "exile")) {
      var _cmdr = state.cards[action.instanceId];
      if (_cmdr && _cmdr.isCommander) { action = { t: "card_move", instanceId: action.instanceId, toZone: "command" }; setStatus("Commander returned to the command zone."); }
    }
    // G3.23 — only commanders may enter the command zone; reject anything else with a status message.
    if (action && action.t === "card_move" && action.instanceId && action.toZone === "command") {
      var _cz = state.cards[action.instanceId];
      if (_cz && !_cz.isCommander) { setStatus("Only a commander can enter the command zone."); try { showToast("Only commanders go to the command zone."); } catch (e) {} return; }
    }
    // Untapping a seat clears its local blocker flags (blocks end when the combat step wraps up).
    if (action && action.t === "untap_all") {
      for (var _bk in blockingIds) { var _bc = state.cards[_bk]; if (!_bc || (_bc.controllerSeat != null ? _bc.controllerSeat : _bc.ownerSeat) === action.seat) delete blockingIds[_bk]; }
    }
    var anim = preAnim(action);
    var inv = MTGCore.invert(action, state);
    var next = MTGCore.reduce(state, action);
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    undoStack.push(inv); state = next; logAction(action); render();
    if (anim) postAnim(anim);
    if (action.t === "library_shuffle") animateShuffle();
    if (action.t === "draw" && el.hand) { var _lib = findPileNode("library"); if (_lib) animateFlyTo(_lib.getBoundingClientRect(), el.hand.getBoundingClientRect(), CARD_BACK); }
    if (online && window.MTGTableSync) { try { MTGTableSync.pushAction(action, state, changedIdsOf(action)); } catch (e) {} }
    enforceSBAs();
    checkGameOver();
  }
  // ---- engine: opt-in state-based-action enforcement on the live board (CR 704) ----
  var engineEnforce = false, _enforcing = false, _lossFlagged = {}, showPT = true, showKW = true;
  try { showPT = localStorage.getItem("mtg_show_pt") !== "0"; showKW = localStorage.getItem("mtg_show_kw") !== "0"; engineEnforce = localStorage.getItem("mtg_engine_enforce") === "1"; } catch (e) {}
  // advisory ability-keyword chips on creatures (Scryfall keywords; gated by showKW)
  var KW_ABBR = { Flying: "FL", "First strike": "FS", "Double strike": "DS", Deathtouch: "DT", Trample: "TR", Lifelink: "LL", Vigilance: "VG", Menace: "MN", Reach: "RE", Defender: "DF", Haste: "HA", Hexproof: "HX", Indestructible: "ID", Ward: "WD", Flash: "FH", Prowess: "PW", Shadow: "SD", Fear: "FE", Intimidate: "IT", Skulk: "SK", Toxic: "TX", Infect: "IF", Wither: "WI", Protection: "PT" };
  function kwChips(kws) {
    if (!showKW || !kws || !kws.length) return "";
    var seen = {}, out = [];
    for (var _ki = 0; _ki < kws.length && out.length < 6; _ki++) {
      var _k = String(kws[_ki] || ""); if (!_k || seen[_k]) continue; seen[_k] = 1;
      var _ab = KW_ABBR[_k] || _k.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
      out.push('<span class="kw-chip" title="' + esc(_k) + '">' + esc(_ab) + '</span>');
    }
    return out.length ? '<span class="kw-strip">' + out.join("") + '</span>' : "";
  }
  // effective toughness via the real CR-613 layer engine (counters etc.); falls back to a manual counter calc
  function effToughness(c) {
    var im = imagesById[c.cardId]; if (!im || !im.isCreature || !im.pt) return null;
    var bp = parseInt(im.pt[0], 10), bt = parseInt(im.pt[1], 10); if (isNaN(bt)) return null;
    try {
      if (window.MTGRulesLayers && MTGRulesLayers.computeEffectiveState) {
        var eff = MTGRulesLayers.computeEffectiveState({ power: isNaN(bp) ? 0 : bp, toughness: bt, counters: c.counters || {}, types: ["Creature"], subtypes: [], colors: [], abilities: [] }, c._effects || []);
        return eff.toughness;
      }
    } catch (e) {}
    var pl = (c.counters && c.counters["+1/+1"]) || 0, mn = (c.counters && c.counters["-1/-1"]) || 0; return bt + pl - mn;
  }
  // Effective power/toughness for the board badge (G3.22): rules-layer engine when available,
  // else base P/T + counters (+1/+1, -1/-1, +1/+0, +0/+1). Returns { p, t, buff } (buff = total delta).
  function effPT(c, im) {
    im = im || imagesById[c.cardId] || {};
    var bp = parseInt(im.pt && im.pt[0], 10), bt = parseInt(im.pt && im.pt[1], 10);
    var hasNum = !isNaN(bp) && !isNaN(bt);
    try {
      if (hasNum && window.MTGRulesLayers && MTGRulesLayers.computeEffectiveState) {
        var eff = MTGRulesLayers.computeEffectiveState({ power: bp, toughness: bt, counters: c.counters || {}, types: ["Creature"], subtypes: [], colors: [], abilities: [] }, c._effects || []);
        if (eff && eff.power != null && eff.toughness != null) return { p: eff.power, t: eff.toughness, buff: (eff.power - bp) + (eff.toughness - bt) };
      }
    } catch (e) {}
    var ctr = c.counters || {};
    var dp = ((ctr["+1/+1"] || 0) - (ctr["-1/-1"] || 0)) + (ctr["+1/+0"] || 0);
    var dt = ((ctr["+1/+1"] || 0) - (ctr["-1/-1"] || 0)) + (ctr["+0/+1"] || 0);
    if (!hasNum) return { p: im.pt ? im.pt[0] : "?", t: im.pt ? im.pt[1] : "?", buff: dp + dt };
    return { p: bp + dp, t: bt + dt, buff: dp + dt };
  }
  function enforceSBAs() {
    if (!engineEnforce || _enforcing || !state) return;
    _enforcing = true;
    try {
      // CR 704.5q — a permanent with both +1/+1 and -1/-1 counters removes N of each (N = the smaller count).
      var anni = [];
      for (var aid in state.cards) { var ac = state.cards[aid]; if (!ac || ac.zone !== "battlefield" || !ac.counters) continue; var k = Math.min(ac.counters["+1/+1"] || 0, ac.counters["-1/-1"] || 0); if (k > 0) anni.push({ id: aid, k: k, name: ac.name }); }
      anni.forEach(function (x) { log("<b>SBA</b> " + esc(x.name || "creature") + " — " + x.k + " +1/+1 and " + x.k + " -1/-1 counters annihilate"); dispatch({ t: "card_counter", instanceId: x.id, kind: "+1/+1", delta: -x.k }); dispatch({ t: "card_counter", instanceId: x.id, kind: "-1/-1", delta: -x.k }); });
      // CR 704.5d — a token in a zone other than the battlefield ceases to exist.
      var gone = [];
      for (var tid in state.cards) { var tc = state.cards[tid]; if (tc && tc.isToken && tc.zone !== "battlefield") { gone.push(tid); log("<b>SBA</b> token " + esc(tc.name || "") + " left play → ceases to exist"); } }
      if (gone.length) dispatch({ t: "__remove", ids: gone });
      // CR 704.5f — a creature with toughness 0 or less is put into its owner's graveyard (indestructible does NOT save it).
      var dead = [];
      for (var id in state.cards) { var c = state.cards[id]; if (!c || c.zone !== "battlefield" || c.faceDown) continue; var t = effToughness(c); if (t != null && t <= 0) dead.push(id); }
      dead.forEach(function (id) { var c = state.cards[id]; if (!c) return; log("<b>SBA</b> " + esc(c.name || "creature") + " has 0 toughness → graveyard"); dispatch({ t: "card_move", instanceId: id, toZone: "graveyard" }); });
      // player-loss findings via the rules engine (advisory surface — never auto-removes a player)
      if (window.MTGEngineAssist && MTGEngineAssist.analyze) {
        var a = MTGEngineAssist.analyze(state) || {};
        (a.sba || []).forEach(function (f) {
          if (f && f.kind === "player_loss" && f.seat != null) {
            var key = f.seat + ":" + (f.rule || "");
            if (!_lossFlagged[key]) { _lossFlagged[key] = 1; setStatus(f.message); log("<b>SBA</b> " + esc(f.message)); try { showToast(f.message); } catch (e) {} }
          }
        });
      }
    } catch (e) {} finally { _enforcing = false; }
  }
  function setEngineEnforce(on) {
    engineEnforce = !!on; _lossFlagged = {}; try { localStorage.setItem("mtg_engine_enforce", engineEnforce ? "1" : "0"); } catch (e) {}
    setStatus("Rules auto-enforce " + (engineEnforce ? "ON — 0-toughness creatures die, player losses flagged." : "OFF."));
    if (engineEnforce) enforceSBAs();
  }
  function findCardNode(id) { var n = el.surface.querySelectorAll(".tbl-card"); for (var i = 0; i < n.length; i++) if (n[i].dataset.id === id) return n[i]; var h = el.hand.querySelectorAll(".tbl-card"); for (var j = 0; j < h.length; j++) if (h[j].dataset.id === id) return h[j]; return null; }
  function findPileNode(zone) { var p = el.surface.querySelectorAll(".tbl-pile"); var fb = null; for (var i = 0; i < p.length; i++) { if (p[i].dataset.zone === zone) { if (p[i].dataset.seat === String(mySeat)) return p[i]; if (!fb) fb = p[i]; } } return fb; }
  function animateShuffle() {
    var pile = findPileNode("library"); if (!pile) return;
    var r = pile.getBoundingClientRect();
    pile.classList.add("shuffling"); setTimeout(function () { pile.classList.remove("shuffling"); }, 560);
    for (var i = 0; i < 5; i++) {
      (function (i) {
        var g = document.createElement("div"); g.className = "tbl-shuffly";
        g.style.left = r.left + "px"; g.style.top = r.top + "px"; g.style.width = r.width + "px"; g.style.height = r.height + "px";
        g.innerHTML = '<img src="' + CARD_BACK + '">';
        document.body.appendChild(g);
        var dir = (i % 2 === 0) ? 1 : -1, dist = 38 + Math.random() * 46, lift = 18 + Math.random() * 34;
        requestAnimationFrame(function () { requestAnimationFrame(function () { g.style.transform = "translate(" + (dir * dist) + "px," + (-lift) + "px) rotate(" + (dir * 13) + "deg)"; }); });
        setTimeout(function () { g.style.transform = "translate(0,0) rotate(0deg)"; g.style.opacity = "0.15"; }, 170 + i * 45);
        setTimeout(function () { g.remove(); }, 540 + i * 45);
      })(i);
    }
  }
  function preAnim(a) {
    if (!a || a.t !== "card_move" || a.toZone === "battlefield") return null;
    var node = findCardNode(a.instanceId); if (!node) return null;
    var c = state.cards[a.instanceId];
    return { toZone: a.toZone, srcRect: node.getBoundingClientRect(), img: c ? imgFor(c) : "" };
  }
  function postAnim(ctx) {
    if (!ctx) return;
    var destEl = ctx.toZone === "hand" ? el.hand : findPileNode(ctx.toZone);
    if (!destEl) return;
    animateFlyTo(ctx.srcRect, destEl.getBoundingClientRect(), ctx.img);
  }
  function animateFlyTo(src, dest, img) {
    if (!src || !dest || !src.width) return;
    var fly = document.createElement("div"); fly.className = "tbl-fly";
    fly.style.left = src.left + "px"; fly.style.top = src.top + "px"; fly.style.width = src.width + "px"; fly.style.height = src.height + "px";
    if (img) fly.innerHTML = '<img src="' + img + '">';
    document.body.appendChild(fly);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      fly.style.left = (dest.left + dest.width / 2 - src.width / 4) + "px"; fly.style.top = (dest.top + dest.height / 2 - src.height / 4) + "px";
      fly.style.width = (src.width / 2) + "px"; fly.style.height = (src.height / 2) + "px"; fly.style.opacity = "0.2";
    }); });
    setTimeout(function () { fly.remove(); }, 440);
  }
  function undo() { var inv = undoStack.pop(); if (!inv) return; state = MTGCore.reduce(state, inv); log("<b>Undo</b>"); render(); if (online && window.MTGTableSync) { try { MTGTableSync.pushAction(inv, state, changedIdsOf(inv)); } catch (e) {} } }

  function applyCamera() { if (el.surface) el.surface.style.transform = "translate(" + camera.x + "px," + camera.y + "px) scale(" + camera.z + ")"; }
  function screenToBoard(cx, cy) { var r = el.viewport.getBoundingClientRect(); return { bx: (cx - r.left - camera.x) / camera.z, by: (cy - r.top - camera.y) / camera.z }; }
  function setStatus(t) { if (el.status) el.status.textContent = t; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function imgFor(c) { var i = imagesById[c.cardId]; if (!i) return ""; return (c.flipped && i.back) ? i.back : (i.img || ""); }
  function cardsIn(zone) { return MTGCore.cardsOf(state, mySeat, zone); }
  function allCardsInZone(zone) { var out = []; for (var id in state.cards) { var c = state.cards[id]; if (c.zone === zone) out.push(c); } out.sort(function (a, b) { return (a.pos || 0) - (b.pos || 0); }); return out; }
  function topCard(zone) { var a = cardsIn(zone); return a.length ? a[a.length - 1] : null; }
  function minPos(zone) { var a = cardsIn(zone); return a.length ? a[0].pos : 0; }

  function render() {
    if (!state || !el.surface) return;
    applyCamera();
    el.surface.innerHTML = "";
    var seats = state.seats || 1;
    for (var s = 0; s < seats; s++) renderRegion(s);
    el.hand.innerHTML = "";
    var _hand = cardsIn("hand"), _hn = _hand.length, _hmid = (_hn - 1) / 2;
    _hand.forEach(function (c, i) {
      var node = cardNode(c, true);
      var off = i - _hmid, per = Math.min(4, 30 / Math.max(1, _hn));
      node.style.setProperty("--fan-rot", (off * per).toFixed(2) + "deg");
      node.style.setProperty("--fan-lift", (Math.abs(off) * Math.min(7, 50 / Math.max(1, _hn))).toFixed(1) + "px");
      el.hand.appendChild(node);
    });
    if (handPan) el.hand.style.setProperty("--hand-pan", handPan.toFixed(1) + "px");
    renderAnnotations(); renderVitals(); renderStack(); checkTurnChange(); scheduleImageFetch();
    if (pendingFit) { pendingFit = false; if ((state.seats || 1) > 1) fitBoard(); }
  }
  function placeRegion(vx, vy, vw, vh, rot) {
    if (rot === 90 || rot === 270) { var w = vh, h = vw, cx = vx + vw / 2, cy = vy + vh / 2; return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: w, h: h, rot: rot }; }
    return { x: vx, y: vy, w: vw, h: vh, rot: rot || 0 };
  }
  function seatRects(n) {
    var W = BOARD_W, H = BOARD_H, OM = 36, gx = 120, gy = 110;
    var mw = Math.round((W - 2 * OM - gx) / 2), mh = Math.round((H - 2 * OM - gy) / 2);
    var fw = W - 2 * OM, lx = OM, rx = OM + mw + gx, ty = OM, by = OM + mh + gy;
    if (n <= 1) return [placeRegion(0, 0, W, H, 0)];
    // separate playmats inset from the table edge and spaced apart; you bottom, top row faces down
    if (n === 2) return [placeRegion(lx, by, fw, mh, 0), placeRegion(lx, ty, fw, mh, 180)];
    if (n === 3) return [placeRegion(lx, by, fw, mh, 0), placeRegion(lx, ty, mw, mh, 180), placeRegion(rx, ty, mw, mh, 180)];
    return [placeRegion(lx, by, mw, mh, 0), placeRegion(rx, by, mw, mh, 0), placeRegion(lx, ty, mw, mh, 180), placeRegion(rx, ty, mw, mh, 180)];
  }
  function regionOf(seat) {
    var seats = (state && state.seats) || 1;
    var order = [mySeat]; for (var i = 0; i < seats; i++) if (i !== mySeat) order.push(i);
    var rects = seatRects(Math.min(seats, 4));
    var idx = order.indexOf(seat); if (idx < 0) idx = 0;
    return rects[idx] || rects[0];
  }
  // inner play area of a mat: solo uses the full region (piles on the right); pods inset cards and reserve a bottom strip for piles
  function bfBox(r, seats) {
    if ((seats || 1) <= 1) return { px: 0, py: 0, w: r.w, h: r.h };
    // inset a half-card on each side; reserve a RIGHT strip (~132) for the vertical pile column
    return { px: 60, py: 80, w: Math.max(140, r.w - 244), h: Math.max(120, r.h - 160) };
  }
  function bfForSeat(seat) { var out = []; for (var id in state.cards) { var c = state.cards[id]; if (c.zone === "battlefield" && (c.controllerSeat != null ? c.controllerSeat : c.ownerSeat) === seat) out.push(c); } out.sort(function (a, b) { return (a.z || 0) - (b.z || 0); }); return out; }
  function topCardOf(seat, zone) { var a = MTGCore.cardsOf(state, seat, zone); return a.length ? a[a.length - 1] : null; }
  function dropPct(bx, by) { var r = regionOf(mySeat), bb = bfBox(r, state.seats); return { x: clamp((bx - r.x - bb.px) / bb.w * 100), y: clamp((by - r.y - bb.py) / bb.h * 100) }; }
  function regPt(c) { var r = regionOf(c.controllerSeat != null ? c.controllerSeat : c.ownerSeat), bb = bfBox(r, state.seats); var lx = bb.px + c.x / 100 * bb.w, ly = bb.py + c.y / 100 * bb.h; var rx = lx - r.w / 2, ry = ly - r.h / 2; var t = (r.rot || 0) * Math.PI / 180, co = Math.cos(t), si = Math.sin(t); return { x: (r.x + r.w / 2) + (rx * co - ry * si), y: (r.y + r.h / 2) + (rx * si + ry * co) }; }
  function fitBoard() { if (!el.viewport) return; var vr = el.viewport.getBoundingClientRect(); if (!vr.width) return; var z = Math.min(vr.width / BOARD_W, vr.height / BOARD_H) * 0.98; camera.z = z; camera.x = (vr.width - BOARD_W * z) / 2; camera.y = (vr.height - BOARD_H * z) / 2; applyCamera(); }
  function recenter() { if (state && (state.seats || 1) > 1) fitBoard(); else { camera.x = 60; camera.y = 40; camera.z = 0.7; applyCamera(); } setStatus("View recentered."); }
  function renderRegion(seat) {
    var r = regionOf(seat), seats = state.seats || 1;
    var cont = document.createElement("div"); cont.className = "tbl-region" + (seat === mySeat ? " mine" : "") + (seats > 1 && seat === state.activeSeat ? " active-seat" : "");
    cont.style.left = r.x + "px"; cont.style.top = r.y + "px"; cont.style.width = r.w + "px"; cont.style.height = r.h + "px";
    if (r.rot) cont.style.transform = "rotate(" + r.rot + "deg)";
    cont.dataset.seat = seat;
    if (seats > 1) { var TINTS = ["rgba(20,184,166,.13)", "rgba(245,158,11,.13)", "rgba(168,85,247,.13)", "rgba(244,63,94,.13)"]; cont.style.background = "radial-gradient(130% 130% at 50% 100%, " + TINTS[seat % 4] + ", rgba(0,0,0,.26))"; }
    if (seats > 1) {
      var pl0 = state.players[seat]; var lab = document.createElement("div"); lab.className = "region-label";
      var outHtml = "";
      if (pl0 && isOut(pl0)) {
        var why = pl0.life <= 0 ? "0 life" : (pl0.counters && pl0.counters.poison >= 10 ? "10 poison" : "21 commander damage");
        outHtml = '<span class="rl-out" title="Eliminated — ' + why + '">OUT</span>';
        lab.classList.add("out");
      }
      lab.innerHTML = '<span class="rl-name">' + (seat === mySeat ? "You" : (pl0 && pl0.name ? esc(pl0.name) : "Seat " + seat)) + '</span><span class="rl-life">' + (pl0 ? pl0.life : 40) + '</span>' + outHtml;
      cont.appendChild(lab);
    }
    var zones = ["exile", "graveyard", "library", "command"], labels = { exile: "Exile", graveyard: "Graveyard", library: "Library", command: "Command" };
    var solo = seats <= 1, soloY = { exile: 300, graveyard: 480, library: 660, command: 840 };
    var pileCX = r.w - 70, pcgap = (r.h - 130) / 4;
    zones.forEach(function (z, i) {
      var n = MTGCore.zoneCount(state, seat, z);
      var d = document.createElement("div"); d.className = "tbl-pile" + (solo ? "" : " mini"); d.dataset.zone = z; d.dataset.seat = seat;
      if (solo) { d.style.left = "1460px"; d.style.top = soloY[z] + "px"; }
      else { d.style.left = pileCX + "px"; d.style.top = (74 + i * pcgap) + "px"; }
      var top = topCardOf(seat, z), topImg = top ? imgFor(top) : "", pileImg = (z === "library" && n > 0) ? CARD_BACK : (topImg || "");
      var inner = '<div class="pile-name">' + labels[z] + "</div>";
      if (pileImg) inner = '<img style="width:100%;height:100%;object-fit:cover;border-radius:7px" src="' + pileImg + '"><div class="pile-name">' + labels[z] + "</div>";
      d.innerHTML = inner + '<div class="pile-count">' + n + "</div>";
      if (z === "command") {
        // Commander tax badge — the tax counter rides on the commander card wherever it is.
        var taxTot = 0;
        try { for (var cid in state.cards) { var cc = state.cards[cid]; if (cc && cc.ownerSeat === seat && cc.isCommander) taxTot += (cc.counters && cc.counters.tax) || 0; } } catch (e) {}
        if (taxTot > 0) d.innerHTML += '<div class="pile-tax" title="Commander tax — casting from here costs +' + taxTot + '">tax +' + taxTot + '</div>';
      }
      cont.appendChild(d);
    });
    var bf = bfForSeat(seat), bb = bfBox(r, seats);
    function bx(px) { return bb.px + px / 100 * bb.w; }
    function byf(py) { return bb.py + py / 100 * bb.h; }
    function place(c) {
      var node = cardNode(c, false);
      var host = c.attachedTo ? state.cards[c.attachedTo] : null;
      if (host && host.zone === "battlefield") { var idx = c.attachOrder || 0; node.style.left = bx(host.x) + "px"; node.style.top = (byf(host.y) + 34 * (idx + 1)) + "px"; node.classList.add("attached"); }
      else { node.style.left = bx(c.x) + "px"; node.style.top = byf(c.y) + "px"; }
      cont.appendChild(node);
    }
    bf.forEach(function (c) { if (c.attachedTo && state.cards[c.attachedTo]) place(c); });
    bf.forEach(function (c) { if (!(c.attachedTo && state.cards[c.attachedTo])) place(c); });
    el.surface.appendChild(cont);
  }
  function renderVitals() {
    if (!el.vitals || !state) return;
    var p = state.players[mySeat]; if (!p) { el.vitals.innerHTML = ""; return; }
    var PHASES = [["untap", "Untap"], ["upkeep", "Upkeep"], ["draw", "Draw"], ["main1", "Main 1"], ["combat", "Combat"], ["main2", "Main 2"], ["end", "End"]];
    var _myTurn = (state.activeSeat === mySeat);
    var phaseHtml = '<div class="vit-phases' + (_myTurn ? "" : " off-turn") + '">' + PHASES.map(function (ph) { return '<button data-ph="' + ph[0] + '"' + (state.phase === ph[0] && _myTurn ? ' class="on"' : "") + ">" + ph[1] + "</button>"; }).join("") + "</div>";
    var html = '<div class="vit-turn">Turn ' + (state.turn || 1) + (online ? " · seat " + mySeat : "") + '</div>' + phaseHtml + '<div class="vit-life"><span class="vit-label">Life</span>' +
      '<button data-v="-5">-5</button><button data-v="-1">-1</button>' +
      '<span class="vit-num">' + p.life + '</span>' +
      '<button data-v="1">+1</button><button data-v="5">+5</button></div>';
    html += '<div class="vit-mana">' + ["W", "U", "B", "R", "G", "C"].map(function (m) {
      var ct = manaPool[m] || 0;
      var pop = (openMana === m) ? '<span class="mana-pop"><button class="mana-step" data-mana="' + m + '" data-d="-1" aria-label="minus ' + m + '">-</button><b>' + ct + '</b><button class="mana-step" data-mana="' + m + '" data-d="1" aria-label="plus ' + m + '">+</button></span>' : "";
      return '<span class="vit-m m-' + m + (openMana === m ? " open" : "") + '"><button class="mana-icon" data-manaopen="' + m + '" title="' + m + ' mana"><img src="https://svgs.scryfall.io/card-symbols/' + m + '.svg" alt="' + m + '" /><b class="mana-ct">' + ct + '</b></button>' + pop + '</span>';
    }).join("") + '<button class="mana-clear" data-mana="_clear" title="Empty mana pool">\u2715</button></div>';
    html += '<div class="vit-counters">';
    visibleCounters.forEach(function (k) {
      var v = (p.counters && p.counters[k]) || 0;
      html += '<span class="vit-c"><button data-pc="' + k + '" data-d="-1">-</button>' + k + ' ' + v + '<button data-pc="' + k + '" data-d="1">+</button></span>';
    });
    html += '<span class="vit-ctr-pick' + (ctrPickOpen ? " open" : "") + '"><button class="ctr-pick-btn" data-ctrpick="1" title="Choose counters">Counters ' + (window.MTGIcons ? MTGIcons.get("chevronDown", "0.8em") : "") + '</button>' + (ctrPickOpen ? ('<div class="vit-ctr-menu">' + ALL_COUNTERS.map(function (k) { return '<label><input type="checkbox" data-ctrtoggle="' + k + '"' + (visibleCounters.indexOf(k) >= 0 ? " checked" : "") + ">" + k + "</label>"; }).join("") + '</div>') : "") + '</span>';
    html += "</div>";
    var cd = p.cmdDamage || {}, keys = Object.keys(cd).filter(function (k) { return cd[k] > 0; });
    if (keys.length) html += '<div class="vit-cmd">Cmdr dmg: ' + keys.map(function (k) { return cd[k] + " (" + k + ")"; }).join(" · ") + "</div>";
    if (state.players.length > 1) { html += '<div class="vit-opps">'; state.players.forEach(function (pl, i) { if (i === mySeat || !pl) return; var hc = MTGCore.zoneCount(state, i, "hand"); html += '<span class="vit-opp">' + (pl.name ? esc(pl.name) : ("Seat " + i)) + ' <button data-ol="' + i + '" data-d="-1">-</button><b class="vit-onum">' + pl.life + '</b><button data-ol="' + i + '" data-d="1">+</button> &hearts;</span>'; }); html += "</div>"; }
    el.vitals.innerHTML = html;
  }
  function stackRemove(id) { delete onStackIds[id]; var i = stackOrder.indexOf(id); if (i >= 0) stackOrder.splice(i, 1); }
  function renderStack() {
    if (!el.stack || !state) return;
    // Reconcile the LIFO order array with what's actually on the stack (add strays, drop stale).
    Object.keys(onStackIds).forEach(function (id) { var c = state.cards[id]; if (c && c.zone === "battlefield") { if (stackOrder.indexOf(id) < 0) stackOrder.push(id); } else stackRemove(id); });
    stackOrder = stackOrder.filter(function (id) { return onStackIds[id]; });
    if (!stackOrder.length) {
      // G2.17 — the empty stack fades/collapses and the action log slides up to take its place (CSS transition).
      el.stack.innerHTML = '<div class="stk-empty">Stack empty</div>';
      el.stack.classList.add("empty");
      _stackWasEmpty = true;
      return;
    }
    var appeared = _stackWasEmpty !== false; // first card after empty → animate in, pushing the log back down
    _stackWasEmpty = false;
    el.stack.classList.remove("empty");
    el.stack.classList.toggle("stk-enter", appeared);
    var html = '<div class="stk-title">Stack (Last In First Out)</div>';
    // Top of stack = last pushed → render reversed. idx is the position in stackOrder.
    for (var k = stackOrder.length - 1; k >= 0; k--) {
      var id = stackOrder[k], c = state.cards[id]; if (!c) continue;
      var src = imgFor(c);
      var thumb = (src && !c.faceDown) ? '<img class="stk-thumb" src="' + src + '" alt="">' : '<span class="stk-thumb stk-thumb-x">' + esc((c.name || "?").slice(0, 1)) + '</span>';
      var isTop = k === stackOrder.length - 1;
      html += '<div class="stk-item" data-id="' + id + '">' +
        thumb +
        '<span class="stk-name">' + esc(c.name || "card") + (isTop ? ' <em class="stk-top">top</em>' : '') + '</span>' +
        '<span class="stk-ord"><button data-stk="up" data-id="' + id + '" title="Move up (toward top)"><span class="msym">keyboard_arrow_up</span></button>' +
        '<button data-stk="down" data-id="' + id + '" title="Move down"><span class="msym">keyboard_arrow_down</span></button></span>' +
        '<span class="stk-acts">' +
        '<button class="stk-inspect" data-stk="inspect" data-id="' + id + '" title="Inspect"><span class="msym">search</span></button>' +
        '<button class="stk-resolve" data-stk="resolve" data-id="' + id + '">Resolve</button>' +
        '<button class="stk-destroy" data-stk="destroy" data-id="' + id + '">Remove</button></span></div>';
    }
    el.stack.innerHTML = html;
    Array.prototype.forEach.call(el.stack.querySelectorAll("button[data-stk]"), function (b) {
      b.onclick = function () {
        var id = b.dataset.id, act = b.dataset.stk, i = stackOrder.indexOf(id);
        if (act === "up") { if (i >= 0 && i < stackOrder.length - 1) { var t = stackOrder[i + 1]; stackOrder[i + 1] = id; stackOrder[i] = t; } render(); }
        else if (act === "down") { if (i > 0) { var t2 = stackOrder[i - 1]; stackOrder[i - 1] = id; stackOrder[i] = t2; } render(); }
        else if (act === "inspect") { openInspect(state.cards[id]); }
        else if (act === "destroy") { stackRemove(id); dispatch({ t: "card_move", instanceId: id, toZone: "graveyard" }); }
        else { stackRemove(id); render(); } // resolve: leave the permanent on the battlefield
      };
    });
    // Hover a stack row → preview; click the thumbnail → inspect/explode (G2.16); drag a row to reorder (G2.15).
    Array.prototype.forEach.call(el.stack.querySelectorAll(".stk-item"), function (row) {
      row.addEventListener("mouseenter", function () { var c = state.cards[row.dataset.id]; if (c) showPreview(c); });
      var th = row.querySelector(".stk-thumb");
      if (th) th.addEventListener("click", function (e) { e.stopPropagation(); var c = state.cards[row.dataset.id]; if (c) openInspect(c); });
      stackRowDrag(row);
    });
  }
  // Pointer drag-to-reorder for stack rows: the row follows the pointer through its siblings in the
  // DOM (displayed top-first), and on drop the LIFO stackOrder is rebuilt from the new DOM order.
  function stackRowDrag(row) {
    var st = null;
    row.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.target.closest("button") || e.target.closest(".stk-thumb")) return;
      st = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, moving: false };
      try { row.setPointerCapture(e.pointerId); } catch (x) {}
    });
    row.addEventListener("pointermove", function (e) {
      if (!st || e.pointerId !== st.pid) return;
      if (!st.moving && Math.abs(e.clientY - st.sy) + Math.abs(e.clientX - st.sx) < 5) return;
      if (!st.moving) { st.moving = true; row.classList.add("stk-dragging"); }
      var prev = row.style.pointerEvents; row.style.pointerEvents = "none";
      var over = document.elementFromPoint(e.clientX, e.clientY);
      row.style.pointerEvents = prev;
      var tr = over && over.closest && over.closest(".stk-item");
      if (tr && tr !== row && tr.parentNode === row.parentNode) {
        var r = tr.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) tr.parentNode.insertBefore(row, tr);
        else tr.parentNode.insertBefore(row, tr.nextSibling);
      }
    });
    function up(e) {
      if (!st || e.pointerId !== st.pid) return;
      try { row.releasePointerCapture(st.pid); } catch (x) {}
      var moved = st.moving; st = null; row.classList.remove("stk-dragging");
      if (!moved) return;
      var ids = Array.prototype.map.call(el.stack.querySelectorAll(".stk-item"), function (n) { return n.dataset.id; });
      ids.reverse(); // displayed top-first → stackOrder is bottom-first (last = top)
      stackOrder = ids.filter(function (x) { return onStackIds[x]; });
      render();
    }
    row.addEventListener("pointerup", up); row.addEventListener("pointercancel", up);
  }
  // === G2.18 — turn-change flash + popup, and the online turn-start engine (G4.32) ===
  function turnFlash(mine) {
    var f = document.createElement("div"); f.className = "tbl-flash" + (mine ? " mine" : "");
    var pop = document.createElement("div"); pop.className = "tbl-turnpop" + (mine ? " mine" : "");
    pop.textContent = mine ? "Your turn!" : "Turn Passed!";
    document.body.appendChild(f); document.body.appendChild(pop);
    setTimeout(function () { f.remove(); }, 720);
    setTimeout(function () { pop.remove(); }, 1650);
  }
  function checkTurnChange() {
    if (!state) { _turnKey = null; return; }
    var key = (state.turn || 1) + ":" + (state.activeSeat || 0);
    if (_turnKey === key) return;
    var first = _turnKey === null;
    _turnKey = key;
    if (first) return; // game just loaded — no flash
    // Decide after the pass handler finishes (hotseat reassigns mySeat right after dispatch).
    setTimeout(function () {
      if (!state) return;
      var mine = (state.seats || 1) > 1 && state.activeSeat === mySeat;
      turnFlash(mine);
      // Online: the seat RECEIVING the turn runs its own turn-start engine (auto-untap + draw).
      if (mine && online) {
        dispatch({ t: "untap_all", seat: mySeat });
        var drew = false;
        if (state.turn > 1 && MTGCore.zoneCount(state, mySeat, "library") > 0) { dispatch({ t: "draw", seat: mySeat, count: 1 }); drew = true; }
        dispatch({ t: "set_phase", phase: "main1" });
        log("<b>Turn " + state.turn + "</b> — your turn: untapped" + (drew ? " &amp; drew for turn." : "."));
      }
    }, 0);
  }

  function cardNode(c, inHand) {
    var node = document.createElement("div");
    node.className = "tbl-card" + (c.tapped ? " tapped" : "") + (c.faceDown ? " facedown" : "") + (c.phased ? " phased" : "") + (onStackIds[c.instanceId] ? " on-stack" : "") + (selected.indexOf(c.instanceId) >= 0 ? " selected" : "") + (c.isFoil ? " is-foil" : "") + (c.isEtched ? " is-etched" : "") + (c.attacking && c.zone === "battlefield" ? " attacking" : "");
    node.dataset.id = c.instanceId; node.dataset.zone = c.zone;
    if (!inHand) { node.style.left = (c.x / 100 * BOARD_W) + "px"; node.style.top = (c.y / 100 * BOARD_H) + "px"; }
    var src = imgFor(c);
    node.innerHTML = (src && !c.faceDown) ? '<img src="' + src + '" alt="' + esc(c.name) + '">' : (c.faceDown ? '<img class="cardback" src="' + CARD_BACK + '" alt="card back">' : '<div class="nm">' + esc(c.name) + "</div>");
    var ctr = Object.keys(c.counters || {});
    if (ctr.length) node.innerHTML += '<span class="badge">' + ctr.map(function (k) { var v = c.counters[k]; return (k === "+1/+1") ? ("+" + v + "/+" + v) : (k === "-1/-1") ? ("-" + v + "/-" + v) : (v + " " + k); }).join(" · ") + "</span>";
    if (c.isToken) node.innerHTML += '<span class="tok-mark" title="Token">T</span>';
    if (!inHand && c.attacking && c.zone === "battlefield") node.innerHTML += '<span class="atk-mark" title="Attacking">' + (window.MTGIcons ? MTGIcons.get("sword", "1em") : "") + '</span>';
    if (!inHand && blockingIds[c.instanceId] && c.zone === "battlefield") node.innerHTML += '<span class="blk-mark" title="Blocking"><span class="msym">shield</span></span>';
    var _pti = imagesById[c.cardId];
    if (showPT && !inHand && c.zone === "battlefield" && _pti && _pti.isCreature && _pti.pt) {
      // G3.22 \u2014 bottom-left effective P/T badge: base P/T + all counters/modifiers (rules-layer engine when present).
      var _e = effPT(c, _pti);
      node.innerHTML += '<span class="pow-badge' + (_e.buff > 0 ? " buffed" : (_e.buff < 0 ? " debuffed" : "")) + '" title="Total power (base power + counters)"><span class="pow-ic">' + (window.MTGIcons ? MTGIcons.get("sword", "1em") : "") + '</span>' + _e.p + "</span>";
      node.innerHTML += '<span class="pt-badge' + (_e.buff > 0 ? " buffed" : (_e.buff < 0 ? " debuffed" : "")) + '" title="Effective power/toughness \u2014 base ' + esc(_pti.pt[0] + "/" + _pti.pt[1]) + ' + counters">' + _e.p + "/" + _e.t + "</span>";
    }
    if (showKW && !inHand && c.zone === "battlefield" && _pti && _pti.isCreature && _pti.keywords && _pti.keywords.length) node.innerHTML += kwChips(_pti.keywords);
    node.addEventListener("mouseenter", function () { hoveredId = c.instanceId; showPreview(c); if (inHand) Array.prototype.forEach.call(handCards(), function (n) { if (n !== node) n.classList.remove("walked"); }); });
    node.addEventListener("mouseleave", function () { if (hoveredId === c.instanceId) { hoveredId = null; clearPreview(); } });
    node.addEventListener("contextmenu", function (e) { e.preventDefault(); if (c.zone === "hand" && c.ownerSeat === mySeat) openHandMenu(e.clientX, e.clientY, c); else openMenu(e.clientX, e.clientY, c); });
    if (inHand) handDrag(node, c);
    else attachDrag(node, c);
    return node;
  }
  function onCardClick(c) {
    if (bottomNeeded > 0 && c.zone === "hand" && c.ownerSeat === mySeat) { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "library" }); bottomNeeded--; setStatus(bottomNeeded > 0 ? ("Put " + bottomNeeded + " more on the bottom.") : "Hand kept \u2014 good luck!"); if (bottomNeeded === 0) log("<b>Kept</b> at " + MTGCore.zoneCount(state, mySeat, "hand") + " cards."); return; }
    if (linkSource && linkSource !== c.instanceId) { chooseLink(c.instanceId); return; }
    if (c.zone === "hand") playFromHand(c);
    else if (c.zone === "battlefield") dispatch({ t: "card_tap", instanceId: c.instanceId });
  }
  function openInspect(c) {
    if (!c) return;
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "insp-panel"; ov.appendChild(panel);
    var src = imgFor(c);
    var sf = "https://scryfall.com/search?q=" + encodeURIComponent('!"' + (c.name || "") + '"');
    panel.innerHTML = (src && !c.faceDown ? '<img class="insp-img" src="' + src + '">' : '<div class="insp-nm">' + esc(c.faceDown ? "Face-down card" : (c.name || "Card")) + "</div>")
      + '<div class="insp-foot"><a class="insp-link" href="' + sf + '" target="_blank" rel="noopener noreferrer">View on Scryfall</a><button class="insp-x">Close</button></div>';
    panel.querySelector(".insp-x").onclick = function () { ov.remove(); };
    document.body.appendChild(ov);
  }
  function showPreview(c) { previewCard = c; var src = imgFor(c); var inner = (src && !c.faceDown) ? '<img src="' + src + '">' : '<span class="hint">' + esc(c.faceDown ? "Face-down" : c.name) + "</span>"; if (c.isToken && !c.faceDown) inner += '<span class="prev-token">Token</span>'; el.preview.innerHTML = inner; }
  function clearPreview() { previewCard = null; if (el.preview) el.preview.innerHTML = ""; }
  function playFromHand(c) { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "battlefield", x: 32 + Math.random() * 20, y: 55 + Math.random() * 10 }); }
  function doMulligan() {
    if (!state) return;
    var hand = MTGCore.cardsOf(state, mySeat, "hand");
    hand.forEach(function (c) { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "library" }); });
    dispatch({ t: "library_shuffle", seat: mySeat, seed: "mull-" + Date.now() + "-" + Math.floor(Math.random() * 1e9) });
    dispatch({ t: "draw", seat: mySeat, count: 7 });
    mulliganCount++; bottomNeeded = mulliganCount;
    log("<b>Mulligan</b> #" + mulliganCount + " \u2014 bottom " + bottomNeeded + ".");
    setStatus(bottomNeeded > 0 ? ("Mulligan " + mulliganCount + ": click " + bottomNeeded + " card(s) in hand to put on the bottom.") : "Opening hand.");
  }

  function attachDrag(node, c) {
    var DRAG = 6, st = null;
    node.addEventListener("pointerdown", function (e) { if (e.button !== 0) return; node.setPointerCapture(e.pointerId); st = { sx: e.clientX, sy: e.clientY, moving: false, pid: e.pointerId }; });
    node.addEventListener("pointermove", function (e) {
      if (!st || e.pointerId !== st.pid) return;
      if (!st.moving && Math.abs(e.clientX - st.sx) + Math.abs(e.clientY - st.sy) < DRAG) return;
      st.moving = true; var b = screenToBoard(e.clientX, e.clientY); var _dr = regionOf((c.controllerSeat != null ? c.controllerSeat : c.ownerSeat)); node.style.left = (b.bx - _dr.x) + "px"; node.style.top = (b.by - _dr.y) + "px"; highlightDrop(e.clientX, e.clientY);
    });
    function up(e) {
      if (!st || e.pointerId !== st.pid) return;
      try { node.releasePointerCapture(st.pid); } catch (x) {}
      if (st.moving) {
        var zone = zoneAtPoint(node, e.clientX, e.clientY);
        if (zone === "battlefield") { var cur = state.cards[c.instanceId]; if (cur && cur.attachedTo) dispatch({ t: "card_attach", instanceId: c.instanceId, attachedTo: null }); var b = screenToBoard(e.clientX, e.clientY); var _d = dropPct(b.bx, b.by); dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "battlefield", x: _d.x, y: _d.y }); }
        else dispatch({ t: "card_move", instanceId: c.instanceId, toZone: zone });
      } else onCardClick(c);
      st = null;
    }
    node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
  }
  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function highlightDrop(x, y) { var el2 = document.elementFromPoint(x, y); var pile = el2 && el2.closest ? el2.closest(".tbl-pile") : null; var cur = document.querySelector(".tbl-pile.drop-target"); if (cur && cur !== pile) cur.classList.remove("drop-target"); if (pile) pile.classList.add("drop-target"); }
  function zoneAtPoint(node, x, y) {
    var prev = node.style.pointerEvents; node.style.pointerEvents = "none";
    var el2 = document.elementFromPoint(x, y); node.style.pointerEvents = prev;
    var pile = el2 && el2.closest && el2.closest(".tbl-pile");
    return pile ? pile.dataset.zone : "battlefield";
  }
  function zoneAtPointXY(x, y) { var el2 = document.elementFromPoint(x, y); var pile = el2 && el2.closest && el2.closest(".tbl-pile"); return pile ? pile.dataset.zone : "battlefield"; }
  function makeGhost(c) { var g = document.createElement("div"); g.className = "tbl-ghost"; var src = imgFor(c); g.innerHTML = (src && !c.faceDown) ? '<img src="' + src + '">' : '<div class="nm">' + esc(c.name) + "</div>"; document.body.appendChild(g); return g; }
  function handDrag(node, c) {
    var DRAG = 6, st = null, ghost = null;
    node.addEventListener("pointerdown", function (e) { if (e.button !== 0) return; node.setPointerCapture(e.pointerId); st = { sx: e.clientX, sy: e.clientY, moving: false, pid: e.pointerId }; });
    node.addEventListener("pointermove", function (e) {
      if (!st || e.pointerId !== st.pid) return;
      if (!st.moving && Math.abs(e.clientX - st.sx) + Math.abs(e.clientY - st.sy) < DRAG) return;
      if (!st.moving) { st.moving = true; ghost = makeGhost(c); node.classList.add("hand-dragging"); }
      if (ghost) { ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px"; } highlightDrop(e.clientX, e.clientY);
    });
    function up(e) {
      if (!st || e.pointerId !== st.pid) return;
      try { node.releasePointerCapture(st.pid); } catch (x) {}
      node.classList.remove("hand-dragging");
      if (st.moving) {
        if (ghost) { ghost.remove(); ghost = null; }
        var zone = zoneAtPointXY(e.clientX, e.clientY);
        if (zone === "battlefield") { var cur = state.cards[c.instanceId]; if (cur && cur.attachedTo) dispatch({ t: "card_attach", instanceId: c.instanceId, attachedTo: null }); var b = screenToBoard(e.clientX, e.clientY); var _d = dropPct(b.bx, b.by); dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "battlefield", x: _d.x, y: _d.y }); }
        else dispatch({ t: "card_move", instanceId: c.instanceId, toZone: zone });
      } else { onCardClick(c); }
      st = null;
    }
    node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
  }

  // === G3.20 — hand overflow: scroll-wheel pans the fan; wheeling over a card walks the hover ===
  function handCards() { return el.hand ? el.hand.querySelectorAll(".tbl-card") : []; }
  function handOverflowPx() {
    var cards = handCards(); if (!cards.length) return 0;
    var hr = el.hand.getBoundingClientRect();
    var f = cards[0].getBoundingClientRect(), l = cards[cards.length - 1].getBoundingClientRect();
    return Math.max(0, (l.right - f.left) - hr.width + 40);
  }
  function clampHandPan() { var half = handOverflowPx() / 2; handPan = Math.max(-half, Math.min(half, handPan)); }
  function applyHandPan() { if (el.hand) el.hand.style.setProperty("--hand-pan", handPan.toFixed(1) + "px"); }
  function setHandWalk(i) {
    var cards = handCards(); if (!cards.length) return;
    i = Math.max(0, Math.min(cards.length - 1, i));
    Array.prototype.forEach.call(cards, function (n, k) { n.classList.toggle("walked", k === i); });
    var node = cards[i];
    hoveredId = node.dataset.id;
    var c = state && state.cards[hoveredId]; if (c) showPreview(c);
    // keep the walked card in view when the hand overflows
    var hr = el.hand.getBoundingClientRect(), nr = node.getBoundingClientRect();
    if (nr.left < hr.left + 30) handPan += (hr.left + 30 - nr.left);
    else if (nr.right > hr.right - 30) handPan -= (nr.right - (hr.right - 30));
    clampHandPan(); applyHandPan();
  }
  function bindHandWheel() {
    if (!el.hand) return;
    el.hand.addEventListener("wheel", function (e) {
      var cards = handCards(); if (!cards.length || !state) return;
      var delta = e.deltaY || e.deltaX; if (!delta) return;
      var dir = delta > 0 ? 1 : -1;
      var overCard = e.target.closest && e.target.closest(".tbl-card");
      var cur = -1;
      for (var k = 0; k < cards.length; k++) if (cards[k].classList.contains("walked")) { cur = k; break; }
      if (cur < 0 && overCard) { for (var k2 = 0; k2 < cards.length; k2++) if (cards[k2] === overCard) { cur = k2; break; } }
      if (cur >= 0) { e.preventDefault(); setHandWalk(cur + dir); }               // hover-walk left/right
      else if (handOverflowPx() > 0) { e.preventDefault(); handPan -= dir * 60; clampHandPan(); applyHandPan(); } // pan
    }, { passive: false });
  }

  function bindBoard() {
    var pan = null, marq = null;
    el.viewport.addEventListener("contextmenu", function (e) { if (e.target.closest(".tbl-card")) return; e.preventDefault(); var pile = e.target.closest(".tbl-pile"); if (pile) openPileMenu(pile.dataset.zone, e.clientX, e.clientY); else { var _rg = e.target.closest(".tbl-region"); openTokenMenu(e.clientX, e.clientY, _rg ? +_rg.dataset.seat : mySeat); } });
    el.viewport.addEventListener("dblclick", function (e) { if (e.target.closest(".tbl-card") || e.target.closest(".tbl-pile")) return; recenter(); });
    el.viewport.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".tbl-card")) return;
      // G3.19 — only a LEFT click acts on a pile (right-click opens the menu via contextmenu; it must not draw).
      var pile = e.target.closest(".tbl-pile"); if (pile) { if (e.button !== 0) return; onPileClick(pile.dataset.zone, e, pile.dataset.seat); return; }
      if (linkSource) { clearLink(); setStatus("Targeting cancelled."); return; } // clicking empty space exits targeting
      if (e.shiftKey) { marq = { sx: e.clientX, sy: e.clientY }; ensureMarqueeBox(); selected = []; render(); return; }
      clearSelection();
      pan = { sx: e.clientX, sy: e.clientY, cx: camera.x, cy: camera.y }; el.viewport.classList.add("panning");
    });
    el.viewport.addEventListener("pointermove", function (e) { if (marq) drawMarquee(marq.sx, marq.sy, e.clientX, e.clientY); else linkMove(e.clientX, e.clientY); cursorPing(e.clientX, e.clientY); });
    el.viewport.addEventListener("pointerup", function (e) { if (marq) { finishMarquee(marq.sx, marq.sy, e.clientX, e.clientY); marq = null; } });
    window.addEventListener("pointermove", function (e) { if (!pan) return; camera.x = pan.cx + (e.clientX - pan.sx); camera.y = pan.cy + (e.clientY - pan.sy); applyCamera(); });
    window.addEventListener("pointerup", function () { pan = null; el.viewport.classList.remove("panning"); });
    el.viewport.addEventListener("wheel", function (e) {
      e.preventDefault(); var before = screenToBoard(e.clientX, e.clientY), r = el.viewport.getBoundingClientRect();
      camera.z = Math.max(0.3, Math.min(2.2, camera.z * Math.exp(-e.deltaY * 0.0015)));
      camera.x = (e.clientX - r.left) - before.bx * camera.z; camera.y = (e.clientY - r.top) - before.by * camera.z; applyCamera();
    }, { passive: false });
  }
  function onPileClick(zone, e, seat) {
    if (zone === "library") {
      if (seat != null && Number(seat) !== mySeat) { setStatus("You can only draw from your own library."); return; }
      dispatch({ t: "draw", seat: mySeat, count: 1 }); setStatus(MTGCore.zoneCount(state, mySeat, "library") + " in library"); return;
    }
    if (zone === "command") { openCommandView(seat == null ? mySeat : Number(seat)); return; } // G3.23 — single-card viewer
    openPile(zone);
  }
  // G3.23 — modernized command-zone viewer: big card art + one primary "Send to field" button.
  function openCommandView(seat) {
    if (!state) return;
    if (seat == null || isNaN(seat)) seat = mySeat;
    var first = MTGCore.cardsOf(state, seat, "command");
    if (!first.length) { setStatus("The command zone is empty."); return; }
    var idx = first.length - 1; // top card shown first
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel cmdv-panel"; ov.appendChild(panel);
    function draw() {
      var cards = MTGCore.cardsOf(state, seat, "command");
      if (!cards.length) { ov.remove(); return; }
      if (idx >= cards.length) idx = cards.length - 1; if (idx < 0) idx = 0;
      var c = cards[idx], src = imgFor(c), tax = (c.counters && c.counters.tax) || 0;
      var pl = state.players[seat];
      var who = seat === mySeat ? "Your" : ((pl && pl.name ? esc(pl.name) : "Seat " + seat) + "’s");
      var h = '<div class="pv-head"><span class="pv-title">' + who + ' command zone</span><button class="pv-x pv-x-ic" title="Close" aria-label="Close"><span class="msym">close</span></button></div>';
      h += '<div class="cmdv-body">';
      if (cards.length > 1) h += '<button class="cmdv-nav cmdv-prev" title="Previous commander" aria-label="Previous"><span class="msym">chevron_left</span></button>';
      h += '<div class="cmdv-card">' + (src ? '<img class="cmdv-img" src="' + src + '" alt="">' : '<div class="cmdv-nm">' + esc(c.name || "Commander") + '</div>') + '</div>';
      if (cards.length > 1) h += '<button class="cmdv-nav cmdv-next" title="Next commander" aria-label="Next"><span class="msym">chevron_right</span></button>';
      h += '</div>';
      h += '<div class="cmdv-meta"><span class="cmdv-name">' + esc(c.name || "Commander") + '</span>' +
        (tax ? '<span class="cmdv-tax" title="Commander tax — next cast costs +' + tax + '">tax +' + tax + '</span>' : '') +
        (cards.length > 1 ? '<span class="cmdv-count">' + (idx + 1) + ' / ' + cards.length + '</span>' : '') + '</div>';
      if (seat === mySeat) h += '<div class="cmdv-foot"><button class="cmdv-cast" type="button"><span class="msym">arrow_outward</span>Send to field</button></div>';
      panel.innerHTML = h;
      panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
      var pv = panel.querySelector(".cmdv-prev"); if (pv) pv.onclick = function () { idx = (idx - 1 + cards.length) % cards.length; draw(); };
      var nx = panel.querySelector(".cmdv-next"); if (nx) nx.onclick = function () { idx = (idx + 1) % cards.length; draw(); };
      var go = panel.querySelector(".cmdv-cast");
      if (go) go.onclick = function () {
        // Casting from the command zone raises the tax by 2 for the NEXT cast (CR 903.8); one atomic batch.
        dispatch({ t: "batch", actions: [{ t: "card_move", instanceId: c.instanceId, toZone: "battlefield", x: 42, y: 55 }, { t: "card_counter", instanceId: c.instanceId, kind: "tax", delta: 2 }] });
        setStatus("Commander sent to the battlefield" + (tax ? " — paid tax +" + tax : "") + " · next cast costs +" + (tax + 2) + ".");
        draw();
      };
    }
    draw(); document.body.appendChild(ov);
  }

  var menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function openMenu(x, y, c) {
    closeMenu();
    var m = document.createElement("div"); m.className = "tbl-menu";
    function item(label, fn, key) { var b = document.createElement("button"); b.innerHTML = "<span>" + label + "</span>" + (key ? '<span class="mk">' + key + "</span>" : ""); b.onclick = function () { closeMenu(); fn(); }; m.appendChild(b); }
    function sep() { var s = document.createElement("div"); s.className = "sep"; m.appendChild(s); }
    function submenu(label, items) {
      var b = document.createElement("button"); b.textContent = label + " \u25B8";
      b.onclick = function (e) { e.stopPropagation(); var ex = m.querySelector(".tbl-submenu"); if (ex) { ex.remove(); return; } var sub = document.createElement("div"); sub.className = "tbl-submenu"; items.forEach(function (it) { var ib = document.createElement("button"); ib.textContent = it.label; ib.onclick = function (ev) { ev.stopPropagation(); closeMenu(); it.fn(); }; sub.appendChild(ib); }); b.insertAdjacentElement("afterend", sub); };
      m.appendChild(b);
    }
    item(c.tapped ? "Untap" : "Tap", function () { dispatch({ t: "card_tap", instanceId: c.instanceId }); }, "T");
    item("Flip over", function () { dispatch({ t: "card_flip", instanceId: c.instanceId }); }, "F");
    item("Transform", function () { dispatch({ t: "card_transform", instanceId: c.instanceId }); }, "A");
    item(c.phased ? "Phase in" : "Phase out", function () { dispatch({ t: "card_phase", instanceId: c.instanceId }); });
    sep();
    item("Add +1/+1 counter", function () { dispatch({ t: "card_counter", instanceId: c.instanceId, kind: "+1/+1", delta: 1 }); }, "+");
    item("Counters & labels…", function () { openCounters(c); });
    item("Proliferate…", function () { openProliferate(); });
    submenu("Attach to", [{ label: "Select a card", fn: function () { startLink(c.instanceId, "select", "attach"); } }, { label: "Draw a line", fn: function () { startLink(c.instanceId, "draw", "attach"); } }, { label: "Clear attachment", fn: function () { dispatch({ t: "card_attach", instanceId: c.instanceId, attachedTo: null }); } }]);
    submenu("Target", [{ label: "Select a card", fn: function () { startLink(c.instanceId, "select", "target"); } }, { label: "Draw a line", fn: function () { startLink(c.instanceId, "draw", "target"); } }]);
    if (c.zone === "battlefield") item(c.attacking ? "Remove from combat" : "Declare attacker", function () { var willAttack = !c.attacking; dispatch({ t: "card_combat", instanceId: c.instanceId, attacking: willAttack }); if (willAttack && !c.tapped) dispatch({ t: "card_tap", instanceId: c.instanceId, tapped: true }); });
    // G3.24 — Declare blocker: shield indicator + a BLUE arrow from this card to the attacker it blocks.
    if (c.zone === "battlefield") item(blockingIds[c.instanceId] ? "Remove blocker" : "Declare blocker", function () {
      if (blockingIds[c.instanceId]) { delete blockingIds[c.instanceId]; render(); return; }
      blockingIds[c.instanceId] = 1; render();
      startLink(c.instanceId, "draw", "block");
    });
    item("Put on stack", function () { if (c.zone === "hand") playFromHand(c); if (!onStackIds[c.instanceId]) { onStackIds[c.instanceId] = true; stackOrder.push(c.instanceId); } render(); });
    sep();
    var mvHand = function () { item("Move to hand", function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "hand" }); }, "H"); };
    var mvField = function () { item("Move to battlefield", function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "battlefield", x: 40, y: 55 }); }, "B"); };
    var mvGrave = function () { item("Move to graveyard", function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "graveyard" }); }, "G"); };
    var mvCmd = function () { item("Move to command zone", function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "command" }); }, "C"); };
    if (c.isCommander) { mvCmd(); mvHand(); mvField(); mvGrave(); }   // commanders default to the command zone
    else { mvHand(); mvField(); mvGrave(); }                          // G3.23 — command zone is commanders-only
    submenu("More zones…", [
      { label: "Exile", fn: function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "exile" }); } },
      { label: "Library (top)", fn: function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "library", pos: minPos("library") - 1 }); } },
      { label: "Library (bottom)", fn: function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "library" }); } }
    ]);
    sep();
    item("Create token…", function () { openCreateToken(mySeat); });
    item("Create token copy", function () { dispatch({ t: "card_clone", fromId: c.instanceId, instanceId: "tok" + (tokenSeq++), x: 45, y: 60 }); }, "X");
    item("Change print…", function () { openPrintPicker(c); });
    sep();
    item("Inspect card", function () { openInspect(c); }, "I");
    document.body.appendChild(m);
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    m.style.left = Math.min(x, vw - m.offsetWidth - 6) + "px"; m.style.top = Math.min(y, vh - m.offsetHeight - 6) + "px";
    menuEl = m;
  }
  window.addEventListener("pointerdown", function (e) { if (menuEl && !e.target.closest(".tbl-menu")) closeMenu(); });
  // G3.21 — dedicated right-click menu for cards in YOUR hand.
  function openHandMenu(x, y, c) {
    closeMenu();
    var m = document.createElement("div"); m.className = "tbl-menu";
    function item(label, fn, key) { var b = document.createElement("button"); b.innerHTML = "<span>" + label + "</span>" + (key ? '<span class="mk">' + key + "</span>" : ""); b.onclick = function () { closeMenu(); fn(); }; m.appendChild(b); }
    function sep() { var s = document.createElement("div"); s.className = "sep"; m.appendChild(s); }
    function randomFromHand(n) {
      var pool = cardsIn("hand").slice(), out = [];
      n = Math.max(1, Math.min(n, pool.length));
      for (var i = 0; i < n; i++) { var j = Math.floor(Math.random() * pool.length); out.push(pool.splice(j, 1)[0]); }
      return out;
    }
    item("Discard", function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "graveyard" }); }, "G");
    item("Discard at random", function () {
      var picks = randomFromHand(1); if (!picks.length) return;
      dispatch({ t: "card_move", instanceId: picks[0].instanceId, toZone: "graveyard" });
      log("<b>Discard at random</b> — " + esc(picks[0].name || "card"));
    });
    item("Discard X at random…", function () {
      var n = parseInt(window.prompt("Discard how many at random?", "2"), 10); if (!(n > 0)) return;
      var picks = randomFromHand(n); if (!picks.length) return;
      dispatch({ t: "batch", actions: picks.map(function (p) { return { t: "card_move", instanceId: p.instanceId, toZone: "graveyard" }; }) });
      log("<b>Discard " + picks.length + " at random</b> — " + picks.map(function (p) { return esc(p.name || "card"); }).join(", "));
    });
    sep();
    item("Move to battlefield", function () { playFromHand(c); }, "P");
    item("Move to battlefield tapped", function () {
      dispatch({ t: "batch", actions: [{ t: "card_move", instanceId: c.instanceId, toZone: "battlefield", x: 32 + Math.random() * 20, y: 55 + Math.random() * 10 }, { t: "card_tap", instanceId: c.instanceId, tapped: true }] });
    });
    item("Exile", function () { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "exile" }); }, "E");
    sep();
    item("Inspect card", function () { openInspect(c); }, "I");
    document.body.appendChild(m);
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    m.style.left = Math.min(x, vw - m.offsetWidth - 6) + "px"; m.style.top = Math.min(y, vh - m.offsetHeight - 6) + "px";
    menuEl = m;
  }
  var QUICK_TOKENS =["Treasure", "Food", "Clue", "Blood", "Goblin", "Soldier", "Zombie", "Spirit", "Beast", "Angel", "Elf Warrior", "Insect"];
  function openTokenMenu(x, y, seat) {
    closeMenu();
    var m = document.createElement("div"); m.className = "tbl-menu";
    function item(label, fn) { var b = document.createElement("button"); b.textContent = label; b.onclick = function () { closeMenu(); fn(); }; m.appendChild(b); }
    if (state && state.seats > 1) { var _seat = (seat == null ? mySeat : seat); item("Load deck for " + (_seat === mySeat ? "your seat" : "seat " + _seat) + "…", function () { openPasteDeck(_seat); }); var sepd = document.createElement("div"); sepd.className = "sep"; m.appendChild(sepd); }
    item("Create label…", function () { var t = window.prompt("Label text:"); if (t) createAnnotation("label", 45, 45, t); });
    item("Create counter", function () { createAnnotation("counter", 48, 48, ""); });
    var sep0 = document.createElement("div"); sep0.className = "sep"; m.appendChild(sep0);
    item("Create token…", function () { openCreateToken(seat == null ? mySeat : seat); });
    var sep = document.createElement("div"); sep.className = "sep"; m.appendChild(sep);
    QUICK_TOKENS.forEach(function (n) { item(n, function () { createToken(n); }); });
    document.body.appendChild(m);
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    m.style.left = Math.min(x, vw - m.offsetWidth - 6) + "px"; m.style.top = Math.min(y, vh - m.offsetHeight - 6) + "px";
    menuEl = m;
  }
  function openPileMenu(zone, x, y) {
    closeMenu();
    var m = document.createElement("div"); m.className = "tbl-menu";
    function item(l, fn) { var b = document.createElement("button"); b.textContent = l; b.onclick = function () { closeMenu(); fn(); }; m.appendChild(b); }
    if (zone === "library") {
      item("Draw 1", function () { dispatch({ t: "draw", seat: mySeat, count: 1 }); });
      item("Draw 7", function () { dispatch({ t: "draw", seat: mySeat, count: 7 }); });
      item("Mill 1", function () { dispatch({ t: "mill", seat: mySeat, count: 1 }); });
      item("Mill X…", function () { var mn = parseInt(window.prompt("Mill how many?", "3"), 10); if (mn > 0) dispatch({ t: "mill", seat: mySeat, count: mn }); });
      item("Search library…", function () { openPile("library"); });
      item("Scry 1", function () { openScry(1, "scry"); });
      item("Scry X\u2026", function () { var sn = parseInt(window.prompt("Scry how many?", "3"), 10); if (sn > 0) openScry(sn, "scry"); });
      item("Surveil 1", function () { openScry(1, "surveil"); });
      item("Shuffle", function () { gameSeed = "g" + Date.now(); dispatch({ t: "library_shuffle", seat: mySeat, seed: gameSeed }); });
    } else if (zone === "command") {
      item("Cast commander", function () {
        var t = topCard("command"); if (!t) return;
        var tax = (t.counters && t.counters.tax) || 0;
        // Casting from the command zone raises the tax by 2 for the NEXT cast (CR 903.8). The tax counter rides on the card.
        dispatch({ t: "batch", actions: [{ t: "card_move", instanceId: t.instanceId, toZone: "battlefield", x: 42, y: 55 }, { t: "card_counter", instanceId: t.instanceId, kind: "tax", delta: 2 }] });
        setStatus("Commander cast" + (tax ? " — paid tax +" + tax : "") + " · next cast costs +" + (tax + 2) + ".");
      });
      item("Commander tax +2", function () { var t = topCard("command"); if (t) dispatch({ t: "card_counter", instanceId: t.instanceId, kind: "tax", delta: 2 }); });
      item("Commander tax −2", function () { var t = topCard("command"); if (t && t.counters && t.counters.tax) dispatch({ t: "card_counter", instanceId: t.instanceId, kind: "tax", delta: -2 }); });
      item("Browse command", function () { openPile("command"); });
    } else {
      item("Browse " + zone, function () { openPile(zone); });
    }
    document.body.appendChild(m);
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    m.style.left = Math.min(x, vw - m.offsetWidth - 6) + "px"; m.style.top = Math.min(y, vh - m.offsetHeight - 6) + "px";
    menuEl = m;
  }
  function createToken(name) {
    var id = "tok" + (tokenSeq++);
    dispatch({ t: "token_create", instanceId: id, cardId: id, ownerSeat: mySeat, name: name, x: 34 + Math.random() * 16, y: 52 });
    fetchTokenImage(name, id);
  }
  function spawnPicked(card, qty, seat) {
    for (var i = 0; i < qty; i++) {
      var id = "tok" + (tokenSeq++); var im = entryImages(card), pti = cardPT(card);
      imagesById[id] = { img: im.img, back: im.back, name: card.name, pt: pti.pt, isCreature: pti.isCreature };
      dispatch({ t: "token_create", instanceId: id, cardId: id, ownerSeat: seat, name: card.name, x: 32 + Math.random() * 18 + (i % 5) * 2, y: 50 + Math.random() * 10 });
    }
    render();
  }
  // Proliferate (CR 701.27): choose permanents/players that have a counter → give each another of every kind it already has.
  function openProliferate() {
    if (!state) return;
    var perms = [];
    for (var id in state.cards) {
      var c = state.cards[id];
      if (!c || c.zone !== "battlefield" || !c.counters) continue;
      var kinds = Object.keys(c.counters).filter(function (k) { return c.counters[k]; });
      if (kinds.length) perms.push({ id: id, name: c.name || "Permanent", kinds: kinds });
    }
    var plys = [];
    (state.players || []).forEach(function (p, i) {
      if (!p || !p.counters) return;
      var kinds = Object.keys(p.counters).filter(function (k) { return p.counters[k]; });
      if (kinds.length) plys.push({ seat: i, name: p.name || (i === mySeat ? "You" : "Seat " + i), kinds: kinds });
    });
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel prolif-panel"; ov.appendChild(panel);
    function ktxt(kinds) { return kinds.map(function (k) { return k; }).join(", "); }
    var body;
    if (!perms.length && !plys.length) {
      body = '<div class="prolif-empty">Nothing on the board has a counter to proliferate.</div>';
    } else {
      body = '<div class="prolif-list">' +
        perms.map(function (p) { return '<label class="prolif-row"><input type="checkbox" data-kind="card" data-id="' + esc(p.id) + '" checked><span class="prolif-nm">' + esc(p.name) + '</span><span class="prolif-k">' + esc(ktxt(p.kinds)) + "</span></label>"; }).join("") +
        plys.map(function (p) { return '<label class="prolif-row"><input type="checkbox" data-kind="player" data-seat="' + p.seat + '" checked><span class="prolif-nm">' + esc(p.name) + " <em>(player)</em></span><span class=\"prolif-k\">" + esc(ktxt(p.kinds)) + "</span></label>"; }).join("") +
        "</div>";
    }
    panel.innerHTML = '<div class="pv-head"><span>Proliferate</span><button class="pv-x">Close</button></div>' + body +
      (perms.length || plys.length ? '<div class="end-foot"><button class="primary prolif-go">Proliferate selected</button></div>' : "");
    panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
    var go = panel.querySelector(".prolif-go");
    if (go) go.onclick = function () {
      Array.prototype.forEach.call(panel.querySelectorAll(".prolif-row input:checked"), function (inp) {
        if (inp.dataset.kind === "card") {
          var c = state.cards[inp.dataset.id]; if (!c || !c.counters) return;
          Object.keys(c.counters).forEach(function (k) { if (c.counters[k]) dispatch({ t: "card_counter", instanceId: inp.dataset.id, kind: k, delta: 1 }); });
        } else {
          var seat = +inp.dataset.seat, pl = state.players[seat]; if (!pl || !pl.counters) return;
          Object.keys(pl.counters).forEach(function (k) { if (pl.counters[k]) dispatch({ t: "player_counter", seat: seat, kind: k, delta: 1 }); });
        }
      });
      log("<b>Proliferate</b>");
      ov.remove();
    };
    document.body.appendChild(ov);
  }
  function openCreateToken(seat) {
    if (seat == null) seat = mySeat;
    var t0 = null, lastTerm = "";
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) closeTok(); });
    var panel = document.createElement("div"); panel.className = "tok-panel"; ov.appendChild(panel);
    panel.innerHTML =
      '<div class="tok-head"><div><div class="tok-kicker">Battlefield</div><h2 class="tok-title">Create token</h2></div><button class="tok-x" aria-label="Close">' + (window.MTGIcons ? MTGIcons.get("close", "1em") : "") + '</button></div>' +
      '<div class="tok-search"><input class="tok-q" type="text" placeholder="Search for a token…" />' +
        '<button class="tok-filter" type="button" aria-pressed="true" title="Tokens only"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg></button></div>' +
      '<label class="tok-only"><input type="checkbox" class="tok-only-cb" checked> Tokens only</label>' +
      '<div class="tok-list"><p class="tok-empty">Loading tokens…</p></div>';
    var q = panel.querySelector(".tok-q"), listEl = panel.querySelector(".tok-list"), cb = panel.querySelector(".tok-only-cb"), filterBtn = panel.querySelector(".tok-filter");
    var tokZoom = null;
    function showTokZoom(src) { if (!src) return; if (!tokZoom) { tokZoom = document.createElement("div"); tokZoom.className = "tok-zoom"; document.body.appendChild(tokZoom); } tokZoom.innerHTML = '<img src="' + src + '" alt="">'; tokZoom.style.display = "flex"; }
    function hideTokZoom() { if (tokZoom) tokZoom.style.display = "none"; }
    function closeTok() { if (tokZoom) { tokZoom.remove(); tokZoom = null; } ov.remove(); }
    panel.querySelector(".tok-x").onclick = closeTok;
    function sync() { filterBtn.setAttribute("aria-pressed", cb.checked ? "true" : "false"); }
    filterBtn.onclick = function () { cb.checked = !cb.checked; sync(); doSearch(); };
    cb.addEventListener("change", function () { sync(); doSearch(); });
    q.addEventListener("input", function () { clearTimeout(t0); t0 = setTimeout(doSearch, 280); });
    function addRow(card) {
      var im = entryImages(card); if (!im.img) return;
      var n = 1;
      var row = document.createElement("div"); row.className = "tok-row";
      row.innerHTML =
        '<div class="tok-thumb"><img src="' + im.img + '" alt=""></div>' +
        '<div class="tok-meta"><div class="tok-nm">' + esc(card.name) + '</div><div class="tok-type">' + esc(card.type_line || "Token") + '</div></div>' +
        '<div class="tok-qty"><button class="tok-minus" type="button" aria-label="minus">−</button><b class="tok-n">1</b><button class="tok-plus" type="button" aria-label="plus">+</button></div>' +
        '<button class="tok-go" type="button">Create</button>';
      var nEl = row.querySelector(".tok-n"), go = row.querySelector(".tok-go");
      row.querySelector(".tok-minus").onclick = function () { n = Math.max(1, n - 1); nEl.textContent = n; };
      row.querySelector(".tok-plus").onclick = function () { n = Math.min(50, n + 1); nEl.textContent = n; };
      go.onclick = function () { spawnPicked(card, n, seat); go.innerHTML = (window.MTGIcons ? MTGIcons.get("check", "1em") : "") + " Added"; go.classList.add("done"); setTimeout(function () { go.textContent = "Create"; go.classList.remove("done"); }, 900); };
      var thumb = row.querySelector(".tok-thumb");
      if (thumb) { thumb.classList.add("zoomable"); thumb.addEventListener("mouseenter", function () { showTokZoom(im.img); }); thumb.addEventListener("mouseleave", hideTokZoom); thumb.addEventListener("click", function (e) { e.stopPropagation(); showTokZoom(im.img); }); }
      listEl.appendChild(row);
    }
    function doSearch() {
      var term = q.value.trim(); lastTerm = term;
      var qq = term ? (cb.checked ? (term + " is:token") : term) : "is:token";
      listEl.innerHTML = '<p class="tok-empty">Searching…</p>';
      fetch("https://api.scryfall.com/cards/search?unique=cards&order=edhrec&dir=desc&q=" + encodeURIComponent(qq)).then(function (r) { return r.json(); }).then(function (j) {
        if (term !== lastTerm) return;
        var data = (j && j.data) || [];
        if (!data.length) { listEl.innerHTML = '<p class="tok-empty">No tokens found.</p>'; return; }
        listEl.innerHTML = ""; var seen = {};
        data.forEach(function (card) { if (!card || seen[card.name]) return; seen[card.name] = 1; addRow(card); });
        if (!listEl.children.length) listEl.innerHTML = '<p class="tok-empty">No tokens found.</p>';
      }).catch(function () { listEl.innerHTML = '<p class="tok-empty">Search failed — check your connection.</p>'; });
    }
    document.body.appendChild(ov);
    doSearch();
    setTimeout(function () { q.focus(); }, 30);
  }
  function openScry(n, mode) {
    if (!state) return;
    var lib = MTGCore.cardsOf(state, mySeat, "library");
    n = Math.min(n, lib.length); if (!n) { setStatus("Library is empty."); return; }
    var items = lib.slice(0, n).map(function (c) { return { id: c.instanceId, c: c, dest: "top" }; });
    var downLabel = mode === "surveil" ? "Grave" : "Bottom";
    var ov = document.createElement("div"); ov.className = "tbl-pileview";
    var panel = document.createElement("div"); panel.className = "pv-panel"; ov.appendChild(panel);
    function close() { ov.remove(); }
    ov.addEventListener("pointerdown", function (e) { if (e.target === ov) close(); });
    function redraw() {
      panel.innerHTML = "";
      var head = document.createElement("div"); head.className = "pv-head";
      var h = document.createElement("span"); h.textContent = (mode === "surveil" ? "Surveil " : "Scry ") + n + " \u2014 leftmost is top";
      head.appendChild(h);
      var x = document.createElement("button"); x.className = "pv-x"; x.textContent = "Cancel"; x.onclick = close; head.appendChild(x); panel.appendChild(head);
      var grid = document.createElement("div"); grid.className = "scry-grid";
      items.forEach(function (it, i) {
        var cell = document.createElement("div"); cell.className = "scry-cell " + (it.dest === "top" ? "keep" : "down");
        var src = imgFor(it.c);
        cell.innerHTML = src ? ('<img src="' + src + '">') : ('<div class="scry-nm">' + esc(it.c.name) + "</div>");
        var ctrl = document.createElement("div"); ctrl.className = "scry-ctrl";
        var tg = document.createElement("button"); tg.textContent = it.dest === "top" ? "Top" : downLabel; tg.onclick = function () { it.dest = it.dest === "top" ? "down" : "top"; redraw(); };
        var up = document.createElement("button"); up.textContent = "\u25C0"; up.title = "toward top"; up.onclick = function () { if (i > 0) { var t = items[i - 1]; items[i - 1] = items[i]; items[i] = t; redraw(); } };
        var dn = document.createElement("button"); dn.textContent = "\u25B6"; dn.title = "toward bottom"; dn.onclick = function () { if (i < items.length - 1) { var t = items[i + 1]; items[i + 1] = items[i]; items[i] = t; redraw(); } };
        ctrl.appendChild(up); ctrl.appendChild(tg); ctrl.appendChild(dn); cell.appendChild(ctrl); grid.appendChild(cell);
      });
      panel.appendChild(grid);
      var foot = document.createElement("div"); foot.className = "scry-foot";
      var ap = document.createElement("button"); ap.className = "primary"; ap.textContent = "Apply"; ap.onclick = function () { applyScry(); close(); };
      foot.appendChild(ap); panel.appendChild(foot);
    }
    function applyScry() {
      var downIds = items.filter(function (it) { return it.dest === "down"; }).map(function (it) { return it.id; });
      var keepIds = items.filter(function (it) { return it.dest === "top"; }).map(function (it) { return it.id; });
      downIds.forEach(function (id) { dispatch({ t: "card_move", instanceId: id, toZone: mode === "surveil" ? "graveyard" : "library" }); });
      if (keepIds.length) dispatch({ t: "library_scry", seat: mySeat, order: keepIds });
      log("<b>" + (mode === "surveil" ? "Surveil" : "Scry") + " " + n + "</b> \u2014 kept " + keepIds.length + ", " + (mode === "surveil" ? "to grave " : "to bottom ") + downIds.length + ".");
      setStatus((mode === "surveil" ? "Surveiled " : "Scryed ") + n + ".");
    }
    redraw();
    document.body.appendChild(ov);
  }

  async function fetchTokenImage(name, id) {
    try {
      var r = await fetch("https://api.scryfall.com/cards/search?q=" + encodeURIComponent("t:token " + name) + "&unique=cards").then(function (x) { return x.json(); });
      var c = r.data && r.data[0]; var img = c && ((c.image_uris && c.image_uris.normal) || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal));
      if (img) { var ti = cardPT(c); imagesById[id] = { img: img, name: name, pt: ti.pt, isCreature: ti.isCreature }; render(); }
    } catch (e) {}
  }
  var imgFetchTimer = null, imgFetching = {};
  function scheduleImageFetch() { clearTimeout(imgFetchTimer); imgFetchTimer = setTimeout(fetchMissingImages, 250); }
  async function fetchMissingImages() {
    if (!state) return;
    var byKey = {};
    for (var id in state.cards) {
      var c = state.cards[id]; if (c._placeholder) continue; var k = c.cardId;
      if (!k || (imagesById[k] && imagesById[k].img) || imgFetching[k]) continue;
      imgFetching[k] = 1;
      byKey[k] = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(k) ? { id: k } : { name: k };
    }
    var keys = Object.keys(byKey); if (!keys.length) return;
    for (var i = 0; i < keys.length; i += 70) {
      var batch = keys.slice(i, i + 70).map(function (k) { return byKey[k]; });
      try {
        var res = await fetch("https://api.scryfall.com/cards/collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifiers: batch }) }).then(function (x) { return x.json(); });
        (res.data || []).forEach(function (card) { var im = entryImages(card), pti = cardPT(card), f0 = (card.card_faces && card.card_faces[0]) || {}; var meta = { img: im.img, back: im.back, name: card.name, pt: pti.pt, isCreature: pti.isCreature, cmc: (card.cmc != null ? card.cmc : (f0.cmc || 0)), colors: card.colors || f0.colors || [], type: card.type_line || f0.type_line || "", keywords: card.keywords || [] }; if (card.id) imagesById[card.id] = meta; if (card.name) imagesById[card.name] = meta; });
      } catch (e) {}
    }
    render();
  }
  var arrowTimer = null;
  // Draw a transient arrow card-center → card-center. color is optional (blue = blocking, red = targeting).
  function fireArrow(fromId, toId, fromRemote, color) {
    var a = state.cards[fromId], b = state.cards[toId]; if (!a || !b) return;
    var col = /^#[0-9a-fA-F]{3,8}$/.test(String(color || "")) ? color : "#ff5470"; // sanitized — goes into innerHTML
    var p1 = ptOfCard(fromId), p2 = ptOfCard(toId); if (!p1 || !p2) return;
    drawArrowPts(p1, p2, false, col);
    clearTimeout(arrowTimer); arrowTimer = setTimeout(clearArrow, 2200);
    if (!fromRemote && online && window.MTGTableSync && MTGTableSync.broadcastEphemeral) MTGTableSync.broadcastEphemeral({ type: "arrow", from: fromId, to: toId, color: col });
  }
  // ---- combat auto-duel: in the combat phase, a Target arrow between two creatures resolves a fight ----
  function isCreatureCard(id) {
    var c = state && state.cards[id]; if (!c || c.zone !== "battlefield") return false;
    var m = imagesById[c.cardId] || imagesById[c.name] || {};
    if (m.isCreature != null) return !!m.isCreature;
    return /creature/i.test(m.type || "");
  }
  async function tryDuel(fromId, toId) {
    try {
      if (!window.MTGDuel || !state || state.phase !== "combat") return false;
      if (fromId === toId || !isCreatureCard(fromId) || !isCreatureCard(toId)) return false;
      function base(id) { var c = state.cards[id], m = imagesById[c.cardId] || imagesById[c.name] || {}; return { c: c, m: m, name: c.name || m.name }; }
      var bf = base(fromId), bt = base(toId);
      async function fetchCard(name) { try { return await fetch("https://api.scryfall.com/cards/named?fuzzy=" + encodeURIComponent(name || "")).then(function (x) { return x.json(); }); } catch (e) { return null; } }
      var pair = await Promise.all([fetchCard(bf.name), fetchCard(bt.name)]);
      function build(b, sc) {
        var c = b.c, m = b.m, p = 0, t = 0;
        if (sc && sc.power != null && /\d/.test(String(sc.power))) { p = parseInt(sc.power, 10) || 0; t = parseInt(sc.toughness, 10) || 0; }
        else if (m && Array.isArray(m.pt)) { p = parseInt(m.pt[0], 10) || 0; t = parseInt(m.pt[1], 10) || 0; } // local P/T is a [power, toughness] array
        else if (m && m.pt) { var mm = /(-?\d+)\s*\/\s*(-?\d+)/.exec(String(m.pt)); if (mm) { p = parseInt(mm[1], 10); t = parseInt(mm[2], 10); } }
        return { name: c.name || b.name || "creature", power: p, toughness: t, counters: c.counters || {},
          keywords: (sc && sc.keywords) || m.keywords || [], oracle: (sc && sc.oracle_text) || m.oracle || "",
          colors: (sc && sc.colors) || m.colors || [], seat: (c.controllerSeat != null ? c.controllerSeat : c.ownerSeat) };
      }
      var A = build(bf, pair[0]), B = build(bt, pair[1]);
      var r = window.MTGDuel.resolveDuel(A, B);
      if (r.lifegain && r.lifegain.a) dispatch({ t: "adjust_life", seat: A.seat, delta: r.lifegain.a });
      if (r.lifegain && r.lifegain.b) dispatch({ t: "adjust_life", seat: B.seat, delta: r.lifegain.b });
      // Trample carries to the defending controller — commander creatures accrue commander damage too (CR 903.10a).
      function playerDamage(srcCard, seat, dmg) {
        var acts = [{ t: "adjust_life", seat: seat, delta: -dmg }];
        if (srcCard && srcCard.isCommander && srcCard.ownerSeat !== seat) acts.unshift({ t: "commander_damage", seat: seat, fromSeat: srcCard.ownerSeat, fromCmd: cmdrKeyOf(srcCard) || "primary", delta: dmg });
        dispatch(acts.length > 1 ? { t: "batch", actions: acts } : acts[0]);
      }
      if (r.trample && r.trample.toB) playerDamage(bf.c, B.seat, r.trample.toB);
      if (r.trample && r.trample.toA) playerDamage(bt.c, A.seat, r.trample.toA);
      if (r.aDies) dispatch({ t: "card_move", instanceId: fromId, toZone: "graveyard" });
      if (r.bDies) dispatch({ t: "card_move", instanceId: toId, toZone: "graveyard" });
      var tramp = (r.trample && (r.trample.toA + r.trample.toB)) || 0;
      var outcome = (r.aDies && r.bDies) ? "both die" : r.aDies ? (esc(A.name) + " dies") : r.bDies ? (esc(B.name) + " dies") : "both survive";
      if (tramp) outcome += " &middot; " + tramp + " trample";
      log("<b>Duel</b> " + esc(A.name) + " (" + A.power + "/" + A.toughness + ") vs " + esc(B.name) + " (" + B.power + "/" + B.toughness + ") &mdash; " + outcome);
      return true;
    } catch (e) { return false; }
  }
  function ensureArrowSvg() { var svg = document.getElementById("tblArrowLayer"); if (!svg) { svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.id = "tblArrowLayer"; svg.setAttribute("class", "tbl-arrows"); svg.setAttribute("viewBox", "0 0 " + BOARD_W + " " + BOARD_H); el.surface.appendChild(svg); } return svg; }
  function clearArrow() { var svg = document.getElementById("tblArrowLayer"); if (svg) svg.innerHTML = ""; }
  function drawArrowPts(p1, p2, dashed, color) {
    var col = /^#[0-9a-fA-F]{3,8}$/.test(String(color || "")) ? color : "#ff5470";
    var mid = "ah" + col.replace(/[^0-9a-zA-Z]/g, "");
    var svg = ensureArrowSvg();
    svg.innerHTML = '<defs><marker id="' + mid + '" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="' + col + '"/></marker></defs><line x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '" stroke="' + col + '" stroke-width="5" marker-end="url(#' + mid + ')"' + (dashed ? ' stroke-dasharray="16 10"' : '') + '/>';
  }
  function ptOfCard(id) {
    var c = state.cards[id]; if (!c || c.zone !== "battlefield") return null;
    var node = el.surface && el.surface.querySelector('.tbl-card[data-id="' + id + '"]');
    if (node) { var r = node.getBoundingClientRect(); var b = screenToBoard(r.left + r.width / 2, r.top + r.height / 2); return { x: b.bx, y: b.by }; }
    return regPt(c);
  }
  var linkSource = null, linkMode = null, linkChosen = null, linkKind = null, linkTb = null;
  function linkColor() { return linkKind === "block" ? "#4f9bff" : "#ff5470"; }
  function startLink(sourceId, mode, kind) { clearLink(); linkSource = sourceId; linkMode = mode; linkKind = kind; setStatus((kind === "attach" ? "Attach: " : kind === "block" ? "Blocking: " : "Target: ") + (mode === "draw" ? "move to draw the line, then click a card." : "click a card.")); }
  function linkMove(x, y) { if (!linkSource || linkMode !== "draw" || linkChosen) return; var p1 = ptOfCard(linkSource); if (!p1) return; var b = screenToBoard(x, y); drawArrowPts(p1, { x: b.bx, y: b.by }, true, linkColor()); }
  function chooseLink(toId) {
    linkChosen = toId;
    // G3.25 — target/block arrows fire immediately and EXIT targeting mode (no sticky confirm step).
    if (linkKind === "target" || linkKind === "block") { confirmLink(); return; }
    var p1 = ptOfCard(linkSource), p2 = ptOfCard(toId); if (p1 && p2) drawArrowPts(p1, p2, true, linkColor());
    showLinkToolbar();
  }
  function confirmLink() {
    var f = linkSource, t = linkChosen, k = linkKind; clearLink();
    if (f && t) {
      if (k === "attach") { dispatch({ t: "card_attach", instanceId: f, attachedTo: t, attachOrder: 0 }); setStatus("Attached."); }
      else if (k === "block") { fireArrow(f, t, false, "#4f9bff"); log("<b>Blocker</b> " + cardLink(f) + " blocks " + cardLink(t)); setStatus("Blocker declared."); }
      else { fireArrow(f, t); tryDuel(f, t); setStatus("Target drawn."); }
    }
  }
  function clearLink() { linkSource = null; linkMode = null; linkChosen = null; linkKind = null; hideLinkToolbar(); clearArrow(); }
  function centerOverBoard(elm) { if (!el.viewport) return; var r = el.viewport.getBoundingClientRect(); elm.style.left = (r.left + r.width / 2) + "px"; elm.style.top = (r.top + r.height / 2) + "px"; }
  function hideLinkToolbar() { if (linkTb) { linkTb.remove(); linkTb = null; } }
  function showLinkToolbar() { hideLinkToolbar(); linkTb = document.createElement("div"); linkTb.className = "tbl-seltoolbar"; var lab = document.createElement("span"); lab.textContent = "Confirm " + (linkKind === "attach" ? "attach" : "target") + "?"; linkTb.appendChild(lab); var okb = document.createElement("button"); okb.textContent = "Confirm"; okb.onclick = confirmLink; linkTb.appendChild(okb); var nob = document.createElement("button"); nob.textContent = "Cancel"; nob.onclick = function () { clearLink(); setStatus("Cancelled."); }; linkTb.appendChild(nob); document.body.appendChild(linkTb); centerOverBoard(linkTb); }
  function rollDice(kind) {
    var res;
    if (kind === "Coin") res = Math.random() < 0.5 ? "Heads" : "Tails";
    else { var sides = parseInt(kind.slice(1), 10) || 20; res = 1 + Math.floor(Math.random() * sides); }
    var _rnm = (state && state.players && state.players[mySeat] && state.players[mySeat].name) || "You";
    log(kind === "Coin" ? ("<b>" + esc(_rnm) + "</b> flipped <b>" + res + "</b>") : ("<b>" + esc(_rnm) + "</b> rolled a <b>" + res + "</b> on a " + kind.toUpperCase())); setStatus("Rolled " + kind + ": " + res);
    if (online && window.MTGTableSync && MTGTableSync.broadcastEphemeral) MTGTableSync.broadcastEphemeral({ type: "dice", kind: kind, result: res, seat: mySeat, name: _rnm });
    return res;
  }
  function createAnnotation(kind, x, y, text) { var id = "an" + (annSeq++); dispatch({ t: "annotation_create", id: id, kind: kind, x: x, y: y, text: text || "", value: 0, seat: mySeat }); }
  function renderSeatBands() {
    var seats = state.seats || 1; if (seats < 2 && !online) { /* solo: single subtle band */ }
    for (var i = 0; i < seats; i++) {
      var band = document.createElement("div"); band.className = "tbl-seatband" + (i === mySeat ? " mine" : "");
      band.style.top = (i / seats * BOARD_H) + "px"; band.style.height = (BOARD_H / seats) + "px";
      var pl = state.players[i];
      band.innerHTML = '<span class="sb-label">' + (i === mySeat ? "You" : ("Seat " + i)) + (pl && pl.name ? " · " + esc(pl.name) : "") + "</span>";
      el.surface.appendChild(band);
    }
  }
  function renderAnnotations() { for (var id in state.annotations) el.surface.appendChild(annNode(state.annotations[id], id)); }
  function annNode(an, id) {
    var node = document.createElement("div"); node.className = "tbl-anno tbl-anno-" + an.kind;
    node.style.left = (an.x / 100 * BOARD_W) + "px"; node.style.top = (an.y / 100 * BOARD_H) + "px";
    if (an.kind === "counter") node.innerHTML = '<button data-d="-1">&minus;</button><span class="av">' + (an.value || 0) + '</span><button data-d="1">+</button><button class="ax">&times;</button>';
    else node.innerHTML = '<span class="at">' + esc(an.text || "label") + '</span><button class="ax">&times;</button>';
    node.querySelector(".ax").onclick = function (e) { e.stopPropagation(); dispatch({ t: "annotation_delete", id: id }); };
    if (an.kind === "counter") node.querySelectorAll("button[data-d]").forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); dispatch({ t: "annotation_update", id: id, value: ((state.annotations[id] || {}).value || 0) + Number(b.dataset.d) }); }; });
    else { var atEl = node.querySelector(".at"); if (atEl) atEl.addEventListener("dblclick", function () { var t = window.prompt("Label:", an.text || ""); if (t != null) dispatch({ t: "annotation_update", id: id, text: t }); }); }
    annoDrag(node, id);
    return node;
  }
  function annoDrag(node, id) {
    var DRAG = 6, st = null;
    node.addEventListener("pointerdown", function (e) { if (e.target.closest("button")) return; node.setPointerCapture(e.pointerId); st = { sx: e.clientX, sy: e.clientY, moving: false, pid: e.pointerId }; });
    node.addEventListener("pointermove", function (e) { if (!st || e.pointerId !== st.pid) return; if (!st.moving && Math.abs(e.clientX - st.sx) + Math.abs(e.clientY - st.sy) < DRAG) return; st.moving = true; var b = screenToBoard(e.clientX, e.clientY); node.style.left = b.bx + "px"; node.style.top = b.by + "px"; });
    function up(e) { if (!st || e.pointerId !== st.pid) return; try { node.releasePointerCapture(st.pid); } catch (x) {} if (st.moving) { var b = screenToBoard(e.clientX, e.clientY); dispatch({ t: "annotation_move", id: id, x: clamp(b.bx / BOARD_W * 100), y: clamp(b.by / BOARD_H * 100) }); } st = null; }
    node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
  }

  // pile browse modal (graveyard/exile/command)
  var pileEl = null;
  var _pileZone = null;
  function closePile() { if (pileEl) { pileEl.remove(); pileEl = null; } _pileZone = null; }
  // Searching your library is a shuffle-triggering action (CR 701.19): reshuffle when the viewer closes.
  function exitPile() { var wasLib = (_pileZone === "library"); closePile(); if (wasLib) { try { dispatch({ t: "library_shuffle", seat: mySeat, seed: "search-" + Date.now() }); setStatus("Library shuffled."); } catch (e) {} } }
  function openPile(zone) {
    closePile();
    var allCards = cardsIn(zone);
    var isLib = (zone === "library");
    var back = document.createElement("div"); back.className = "tbl-pileview";
    back.addEventListener("click", function (e) { if (e.target === back) exitPile(); });
    var panel = document.createElement("div"); panel.className = "pv-panel pv-modern";
    // Library search: quick card-type filter chips (multi-select OR). Types read from Scryfall type_line.
    var FILTERS = [
      { k: "all", label: "All", all: 1 }, { k: "creature", label: "Creatures" }, { k: "legendary", label: "Legendary" },
      { k: "planeswalker", label: "Planeswalkers" }, { k: "instant", label: "Instants" }, { k: "sorcery", label: "Sorceries" },
      { k: "artifact", label: "Artifacts" }, { k: "enchantment", label: "Enchantments" }, { k: "land", label: "Lands" }
    ];
    var filterBar = isLib ? ('<div class="pv-filters" id="pvFilters">' + FILTERS.map(function (f) { return '<button class="pv-chip' + (f.all ? " on" : "") + '" data-f="' + f.k + '">' + esc(f.label) + '</button>'; }).join("") + '</div>') : "";
    panel.innerHTML = '<div class="pv-head"><span class="pv-title">' + (PILES[zone] ? PILES[zone].label : zone) + ' <span class="pv-count" id="pvCount">' + allCards.length + '</span></span>' + (isLib ? '<span class="pv-hint">Closing shuffles your library</span>' : "") + '<button class="pv-x pv-x-ic" title="Close" aria-label="Close"><span class="msym">close</span></button></div>' + filterBar;
    var grid = document.createElement("div"); grid.className = "pv-grid";
    var active = {};
    // G3.26 — icon buttons with tooltips instead of raw text-button rows.
    var ACTS = [
      { to: "hand", ic: "back_hand", tip: "To hand" },
      { to: "battlefield", ic: "play_arrow", tip: "To battlefield" },
      { to: "library", ic: "style", tip: "Top of library" },
      { to: "exile", ic: "block", tip: "Exile" }
    ];
    function typeOf(c) { var m = imagesById[c.cardId] || imagesById[c.name] || {}; return { t: String(m.type || "").toLowerCase(), cre: !!m.isCreature }; }
    function passes(c) {
      var keys = Object.keys(active); if (!keys.length) return true;
      var ti = typeOf(c);
      return keys.some(function (k) {
        if (k === "creature") return /creature/.test(ti.t) || ti.cre;
        if (k === "legendary") return /legendary/.test(ti.t);
        if (k === "land") return /\bland\b/.test(ti.t);
        return ti.t.indexOf(k) >= 0;
      });
    }
    function buildCard(c) {
      var card = document.createElement("div"); card.className = "pv-card";
      var src = imgFor(c);
      card.innerHTML = (src ? '<img src="' + src + '">' : '<div class="nm">' + esc(c.name) + "</div>") +
        '<div class="pv-acts">' +
        ACTS.filter(function (a) { return a.to !== zone; }).map(function (a) { return '<button class="pv-act" data-to="' + a.to + '" title="' + a.tip + '" aria-label="' + a.tip + '"><span class="msym">' + a.ic + '</span></button>'; }).join("") +
        '<button class="pv-act" data-insp="1" title="Inspect" aria-label="Inspect"><span class="msym">search</span></button></div>';
      card.querySelectorAll("button").forEach(function (b) {
        b.onclick = function () {
          if (b.dataset.insp) { openInspect(c); return; }
          var act = { t: "card_move", instanceId: c.instanceId, toZone: b.dataset.to, x: 40, y: 55 };
          if (b.dataset.to === "library") act.pos = minPos("library") - 1; // "Top of library"
          dispatch(act);
          closePile(); openPile(zone);
        };
      });
      return card;
    }
    function paint() {
      var cards = allCards.filter(passes);
      grid.innerHTML = "";
      var cnt = document.getElementById("pvCount"); if (cnt) cnt.textContent = (cards.length !== allCards.length ? cards.length + " / " + allCards.length : allCards.length);
      cards.forEach(function (c) { grid.appendChild(buildCard(c)); });
      if (!cards.length) grid.innerHTML = '<div class="pv-emptymsg">' + (allCards.length ? "No matching cards." : "Nothing here yet.") + '</div>';
    }
    paint();
    panel.appendChild(grid); back.appendChild(panel); document.body.appendChild(back);
    panel.querySelector(".pv-x").onclick = exitPile;
    if (isLib) {
      var fb = panel.querySelector("#pvFilters");
      fb.addEventListener("click", function (e) {
        var b = e.target.closest(".pv-chip"); if (!b) return;
        var k = b.dataset.f;
        if (k === "all") { active = {}; fb.querySelectorAll(".pv-chip").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); }
        else {
          if (active[k]) { delete active[k]; b.classList.remove("on"); } else { active[k] = 1; b.classList.add("on"); }
          var allc = fb.querySelector('[data-f="all"]'); if (allc) allc.classList.toggle("on", Object.keys(active).length === 0);
        }
        paint();
      });
    }
    _pileZone = zone; pileEl = back;
  }

  var ctrEl = null;
  function closeCounters() { if (ctrEl) { ctrEl.remove(); ctrEl = null; } }
  function openCounters(c) {
    closeCounters(); closeMenu();
    var back = document.createElement("div"); back.className = "tbl-pileview";
    back.addEventListener("click", function (e) { if (e.target === back) closeCounters(); });
    var panel = document.createElement("div"); panel.className = "pv-panel ctr-panel";
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("pv-x")) { closeCounters(); return; }
      if (b.dataset.k) { dispatch({ t: "card_counter", instanceId: c.instanceId, kind: b.dataset.k, delta: Number(b.dataset.d) }); renderCounters(c, panel); }
    });
    back.appendChild(panel); document.body.appendChild(back); ctrEl = back;
    renderCounters(c, panel);
  }
  function renderCounters(c, panel) {
    var card = state && state.cards[c.instanceId]; if (!card) { closeCounters(); return; }
    var kinds = [], seen = {};
    Object.keys(card.counters || {}).forEach(function (k) { if (!seen[k]) { seen[k] = 1; kinds.push(k); } });
    COMMON_COUNTERS.forEach(function (k) { if (!seen[k]) { seen[k] = 1; kinds.push(k); } });
    var html = '<div class="pv-head">Counters — ' + esc(card.name || "card") + ' <button class="pv-x">close</button></div><div class="ctr-list">';
    kinds.forEach(function (k) { var v = (card.counters && card.counters[k]) || 0;
      html += '<div class="ctr-row"><button data-k="' + esc(k) + '" data-d="-1">&minus;</button><span class="ctr-name">' + esc(k) + '</span><span class="ctr-val">' + v + '</span><button data-k="' + esc(k) + '" data-d="1">+</button></div>'; });
    html += "</div>"; panel.innerHTML = html;
  }

  var marqEl = null, selToolbar = null;
  function ensureMarqueeBox() { if (!marqEl) { marqEl = document.createElement("div"); marqEl.className = "tbl-marquee"; el.viewport.appendChild(marqEl); } marqEl.style.display = "block"; }
  function drawMarquee(x0, y0, x1, y1) {
    var r = el.viewport.getBoundingClientRect();
    if (marqEl) { marqEl.style.left = (Math.min(x0, x1) - r.left) + "px"; marqEl.style.top = (Math.min(y0, y1) - r.top) + "px"; marqEl.style.width = Math.abs(x1 - x0) + "px"; marqEl.style.height = Math.abs(y1 - y0) + "px"; }
  }
  function finishMarquee(x0, y0, x1, y1) {
    if (marqEl) marqEl.style.display = "none";
    var r = el.viewport.getBoundingClientRect();
    var minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    selected = [];
    allCardsInZone("battlefield").forEach(function (c) {
      var sx = r.left + camera.x + (c.x / 100 * BOARD_W) * camera.z, sy = r.top + camera.y + (c.y / 100 * BOARD_H) * camera.z;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) selected.push(c.instanceId);
    });
    render(); showSelToolbar(selected.length);
  }
  function clearSelection() { var had = selected.length; selected = []; hideSelToolbar(); if (had) render(); }
  function hideSelToolbar() { if (selToolbar) { selToolbar.remove(); selToolbar = null; } }
  function showSelToolbar(n) {
    hideSelToolbar(); if (!n) return;
    selToolbar = document.createElement("div"); selToolbar.className = "tbl-seltoolbar";
    var lab = document.createElement("span"); lab.textContent = n + " selected"; selToolbar.appendChild(lab);
    function add(label, fn) { var b = document.createElement("button"); b.textContent = label; b.onclick = fn; selToolbar.appendChild(b); }
    add("Tap", function () { dispatch({ t: "card_tap_many", instanceIds: selected.slice(), tapped: true }); });
    add("Untap", function () { dispatch({ t: "card_tap_many", instanceIds: selected.slice(), tapped: false }); });
    add("Clear", clearSelection);
    document.body.appendChild(selToolbar); centerOverBoard(selToolbar);
  }
  function showHotkeyHelp() {
    var rows = [
      ["Hovered card", ""],
      ["T", "Tap / untap"], ["F", "Flip (face down / up)"], ["A", "Transform (double-faced)"],
      ["G", "Send to graveyard"], ["E", "Send to exile"], ["H", "Return to hand"],
      ["L", "Put on top of library"], ["B", "Put on bottom of library"],
      ["X", "Make a token copy"], ["P", "Play (from hand)"],
      ["Global", ""],
      ["D", "Draw a card"], ["U", "Untap all"], ["Z", "Undo"], ["0", "Recenter the view"], ["Esc", "Close menus / cancel"]
    ];
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel hk-panel";
    var html = '<div class="pv-head"><span>Hotkeys</span><button class="pv-x">Close</button></div><div class="hk-grid">';
    rows.forEach(function (r) {
      if (!r[1]) html += '<div class="hk-sec">' + esc(r[0]) + "</div>";
      else html += '<div class="hk-row"><kbd>' + esc(r[0]) + "</kbd><span>" + esc(r[1]) + "</span></div>";
    });
    html += '</div><div class="hk-note">Hover a card, then tap a key. Right-click any card or pile for the full menu.</div>';
    panel.innerHTML = html;
    panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
    ov.appendChild(panel); document.body.appendChild(ov);
  }
  function parseDeckText(text) {
    var lines = String(text || "").split(/\r?\n/);
    var out = [], section = "deck";
    lines.forEach(function (raw) {
      var line = raw.trim(); if (!line) return;
      var low = line.toLowerCase();
      if (/^(commander|commanders)[:]?$/.test(low)) { section = "commander"; return; }
      if (/^(deck|mainboard|main|companion)[:]?$/.test(low)) { section = "deck"; return; }
      if (/^sideboard[:]?$/.test(low)) { section = "sideboard"; return; }   // collected for swapping (not "skip")
      if (/^(maybeboard|maybe|considering|tokens?)[:]?$/.test(low)) { section = "skip"; return; }
      if (line.indexOf("//") === 0 || line.indexOf("#") === 0) return;
      if (section === "skip") return;
      var isCmd = section === "commander";
      if (/\*cmdr\*/i.test(line) || /\(commander\)/i.test(line)) isCmd = true;
      line = line.replace(/\*[a-z]+\*/ig, "").replace(/\(commander\)/ig, "").trim();
      var m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
      var qty = 1, name = line;
      if (m) { qty = parseInt(m[1], 10) || 1; name = m[2]; }
      name = name.replace(/\s+\([A-Za-z0-9]{2,6}\)\s+[A-Za-z0-9-]+$/, "").replace(/\s+\([A-Za-z0-9]{2,6}\)$/, "").replace(/\s+#\d+$/, "").trim();
      if (!name) return;
      out.push({ name: name, qty: Math.max(1, Math.min(qty, 99)), isCommander: isCmd, section: (section === "sideboard" ? "sideboard" : undefined) });
    });
    return out;
  }
  async function loadPastedDeck(text, seat) {
    var raw = String(text || "").trim();
    var parsed, deckLabel = "Pasted deck";
    // A Moxfield / Archidekt deck link → fetch the list (reuses the deck-builder's relay import) instead of parsing text.
    if (/(?:moxfield\.com|archidekt\.com)\/decks\//i.test(raw) && window.MTGDeckUrlImport) {
      var site = /moxfield/i.test(raw) ? "Moxfield" : "Archidekt";
      setStatus("Fetching deck from " + site + "…");
      var res = null; try { res = await window.MTGDeckUrlImport(raw); } catch (e) {}
      if (!res || !res.cards || !res.cards.length) { setStatus("Couldn't fetch that " + site + " deck (it may be private). Paste the exported list instead."); return; }
      parsed = res.cards; deckLabel = res.name || (site + " deck");
    } else {
      parsed = parseDeckText(text);
    }
    if (!parsed.length) { setStatus("No cards found in the pasted text."); return; }
    setStatus("Looking up " + parsed.length + " entries on Scryfall...");
    var names = parsed.map(function (e) { return e.name; });
    var uniq = names.filter(function (n, i) { return names.indexOf(n) === i; });
    var byName = {}, images = {};
    for (var i = 0; i < uniq.length; i += 70) {
      var batch = uniq.slice(i, i + 70).map(function (n) { return { name: n }; });
      try {
        var res = await fetch("https://api.scryfall.com/cards/collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifiers: batch }) }).then(function (x) { return x.json(); });
        (res.data || []).forEach(function (card) { byName[card.name.toLowerCase()] = card; });
      } catch (e) {}
    }
    var list = [], missing = 0, sbCollected = [];
    parsed.forEach(function (e) {
      var card = byName[e.name.toLowerCase()];
      var id = (card && card.id) || e.name;
      if (card) { var im = entryImages(card); images[id] = { img: im.img, back: im.back, name: card.name }; }
      else { images[id] = { img: "", name: e.name }; missing++; }
      var realName = (card && card.name) || e.name;
      if (e.section === "sideboard") { for (var sb = 0; sb < e.qty; sb++) sbCollected.push({ cardId: id, name: realName }); return; }
      for (var k = 0; k < e.qty; k++) list.push({ cardId: id, name: realName, isCommander: e.isCommander });
    });
    if (seat != null) assignSeatDeck(seat, list, images);
    else { loadSideboardForDeck(deckLabel, sbCollected, images); buildAndStart(list, images, deckLabel); }
    if (missing) log("<b>Note:</b> " + missing + " name(s) were not found on Scryfall.");
  }
  function openPasteDeck(seat) {
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel pd-panel";
    panel.innerHTML = '<div class="pv-head"><span>Paste a decklist' + (seat != null ? " for seat " + seat : "") + '</span><button class="pv-x">Close</button></div>' +
      '<div class="pd-hint">Paste a <b>Moxfield / Archidekt link</b>, or a decklist (one card per line, e.g. <code>1 Sol Ring</code>). Add a <b>Commander</b> header line or <code>*CMDR*</code> to mark commanders.</div>' +
      '<textarea class="pd-text" spellcheck="false" placeholder="Commander&#10;1 Atraxa, Praetors&#39; Voice&#10;&#10;1 Sol Ring&#10;1 Arcane Signet"></textarea>' +
      '<div class="pd-foot"><button class="primary pd-go">Load deck</button></div>';
    panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
    panel.querySelector(".pd-go").onclick = function () { var t = panel.querySelector(".pd-text").value; ov.remove(); loadPastedDeck(t, seat); };
    ov.appendChild(panel); document.body.appendChild(ov);
    setTimeout(function () { var ta = panel.querySelector(".pd-text"); if (ta) ta.focus(); }, 30);
  }
  function combatPower(c) {
    var info = imagesById[c.cardId];
    if (info && info.pt) { var bp = parseInt(info.pt[0], 10); if (isNaN(bp)) return 0; var pl = (c.counters && c.counters["+1/+1"]) || 0, mn = (c.counters && c.counters["-1/-1"]) || 0; return Math.max(0, bp + pl - mn); }
    return 0;
  }
  // Expected-bracket encoded into the game name ("B3 · <name>") so it persists + shows in the lobby list (no schema change).
  var BRACKET_NAMES = { 1: "Exhibition", 2: "Core", 3: "Upgraded", 4: "Optimized", 5: "cEDH" };
  function parseLobbyName(name) { var m = String(name || "").match(/^B([1-5])\s*·\s*(.*)$/); return m ? { bracket: +m[1], title: m[2] || "Commander table" } : { bracket: null, title: name || "Commander table" }; }
  function openLobby() {
    if (!window.MTGTableSync) { setStatus("Online sync is not loaded."); return; }
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel lob-panel"; ov.appendChild(panel);
    function schedBadge(g) {
      if (!g.scheduledAt) return "";
      var t = new Date(g.scheduledAt).getTime(); if (isNaN(t)) return "";
      var d = t - Date.now();
      if (d <= 0) return '<span class="lob-sched live">Starting now</span>';
      var mins = Math.round(d / 60000);
      var txt = mins < 60 ? ("in " + mins + "m") : mins < 48 * 60 ? ("in " + Math.round(mins / 60) + "h") : ("in " + Math.round(mins / 1440) + "d");
      return '<span class="lob-sched" title="' + esc(new Date(t).toLocaleString()) + '">Starts ' + txt + "</span>";
    }
    function wire() {
      panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
      var hb = panel.querySelector(".lob-host");
      if (hb) hb.onclick = function () {
        var sel = panel.querySelector(".lob-bracket"); var br = sel ? sel.value : "";
        var vis = panel.querySelector(".lob-vis"); var pub = !vis || vis.value === "public";
        var when = panel.querySelector(".lob-when"); var schedIso = null;
        if (when && when.value) {
          var ts = new Date(when.value).getTime();
          if (isNaN(ts)) { setStatus("That schedule time didn't parse \u2014 hosting now instead."); }
          else if (ts - Date.now() > 7.5 * 24 * 3600 * 1000) { setStatus("Pick a start time within the next 7 days."); return; }
          else schedIso = new Date(ts).toISOString();
        }
        ov.remove();
        doHost({ visibility: pub ? "public" : "private", bracket: br, scheduledAt: schedIso });
      };
      var vis2 = panel.querySelector(".lob-vis"), hb2 = panel.querySelector(".lob-host");
      if (vis2 && hb2) vis2.onchange = function () { hb2.textContent = vis2.value === "public" ? "Host a public game" : "Host private (invite code)"; };
      var rf = panel.querySelector(".lob-refresh"); if (rf) rf.onclick = load;
      Array.prototype.forEach.call(panel.querySelectorAll(".lob-join"), function (b) { b.onclick = function () { var id = b.dataset.id; ov.remove(); doJoin(id); }; });
    }
    function draw(list, msg) {
      var h = '<div class="pv-head"><span>Find a game</span><button class="pv-x">Close</button></div>';
      h += '<div class="lob-actions"><select class="lob-bracket" title="Expected deck bracket for the game you host">' +
        '<option value="">Any bracket</option><option value="1">Bracket 1 \u00b7 Exhibition</option><option value="2">Bracket 2 \u00b7 Core</option>' +
        '<option value="3" selected>Bracket 3 \u00b7 Upgraded</option><option value="4">Bracket 4 \u00b7 Optimized</option><option value="5">Bracket 5 \u00b7 cEDH</option></select>' +
        '<select class="lob-vis" title="Public games show in this list; private games are join-by-code only">' +
        '<option value="public" selected>Public</option><option value="private">Private</option></select>' +
        '<input type="datetime-local" class="lob-when" title="Optional \u2014 schedule the game up to 7 days out; it lists with a Starts-in badge">' +
        '<button class="primary lob-host">Host a public game</button><button class="lob-refresh">Refresh</button></div>';
      if (msg) h += '<div class="lob-msg">' + esc(msg) + "</div>";
      else if (!list || !list.length) h += '<div class="lob-msg">No public games right now \u2014 host one and your pod can Find it.</div>';
      else h += '<div class="lob-list">' + list.map(function (g) {
        var pn = parseLobbyName(g.name);
        var badge = pn.bracket ? '<span class="lob-brk lob-brk-' + pn.bracket + '">B' + pn.bracket + '</span>' : "";
        return '<div class="lob-row"><div class="lob-info"><b>' + badge + esc(pn.title) + schedBadge(g) + '</b><span>' + (g.players || 1) + ' in \u00b7 host ' + esc(g.host || "?") + ' \u00b7 ' + (g.startingLife || 40) + ' life' + (pn.bracket ? ' \u00b7 ' + BRACKET_NAMES[pn.bracket] : "") + '</span></div><button class="lob-join" data-id="' + g.id + '">Join</button></div>';
      }).join("") + "</div>";
      panel.innerHTML = h; wire();
    }
    async function load() {
      draw(null, "Loading\u2026");
      try {
        if (!(window.mtgSync && window.mtgSync.enabled && window.mtgSync.session)) { draw(null, "Sign in (account button, top-right) to host or join online games."); return; }
        if (!state) { draw(null, "Load a deck first so you can join with it."); return; }
        var list = await MTGTableSync.listOpenGames();
        draw(list);
      } catch (e) { draw(null, "Could not load games: " + ((e && e.message) || e)); }
    }
    document.body.appendChild(ov); load();
  }
  function draftNewPack() {
    var pool = draft.cards; if (!pool.length) { draft.pack = []; return; }
    function pick1(filter) { var f = pool.filter(filter); var src = f.length ? f : pool; return src[Math.floor(Math.random() * src.length)]; }
    var pack = [];
    pack.push(pick1(function (c) { return c.rarity === "mythic" || c.rarity === "rare"; }));
    for (var u = 0; u < 3; u++) pack.push(pick1(function (c) { return c.rarity === "uncommon"; }));
    for (var co = 0; co < 11; co++) pack.push(pick1(function (c) { return c.rarity === "common"; }));
    draft.pack = pack;
  }
  async function draftLoadSet(set) {
    draft.cards = []; draft.set = set;
    try {
      var all = [], url = "https://api.scryfall.com/cards/search?q=" + encodeURIComponent("set:" + set + " is:booster -type:basic") + "&unique=cards";
      while (url) {
        var res = await fetch(url).then(function (x) { return x.json(); });
        (res.data || []).forEach(function (c) { all.push({ id: c.id, name: c.name, img: (c.image_uris && c.image_uris.normal) || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal) || "", rarity: c.rarity }); });
        url = res.has_more ? res.next_page : null;
        if (all.length > 700) break;
      }
      draft.cards = all;
    } catch (e) { draft.cards = []; }
  }
  function openDraft() {
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel drf-panel"; ov.appendChild(panel);
    panel.innerHTML = '<div class="pv-head"><span>Draft a pool</span><button class="pv-x">Close</button></div>'
      + '<div class="drf-set"><input class="drf-input" placeholder="Set code \u2014 e.g. mh3, fdn, blb, dsk"><button class="primary drf-start">Start</button></div>'
      + '<div class="drf-body"><div class="drf-msg">Enter a set code, then pick one card from each pack. Build up to ' + draft.target + ', then Play the pool.</div></div>';
    function body() { return panel.querySelector(".drf-body"); }
    function start() { var set = (panel.querySelector(".drf-input").value || "").trim().toLowerCase(); if (!set) { setStatus("Enter a set code."); return; } draft.pool = []; draft.picks = 0; body().innerHTML = '<div class="drf-msg">Loading ' + esc(set) + "\u2026</div>"; draftLoadSet(set).then(function () { if (!draft.cards.length) { body().innerHTML = '<div class="drf-msg">No draftable cards for "' + esc(set) + '". Try mh3, fdn, blb, dsk, otj\u2026</div>'; return; } draftNewPack(); draw(); }); }
    function pick(c) { if (!c) return; draft.pool.push(c); draft.picks++; if (draft.picks >= draft.target) return finish(); draftNewPack(); draw(); }
    function finish() { var images = {}, list = []; draft.pool.forEach(function (c) { images[c.id] = { img: c.img, name: c.name }; list.push({ cardId: c.id, name: c.name }); }); ov.remove(); if (!list.length) { setStatus("Draft pool is empty."); return; } numOpponents = 0; buildAndStart(list, images, "Drafted pool (" + draft.set + ")"); }
    function draw() {
      var b = '<div class="drf-bar">Pick ' + (draft.picks + 1) + ' \u00b7 pool ' + draft.pool.length + '/' + draft.target + '<button class="drf-finish">Play pool (' + draft.pool.length + ')</button></div>';
      b += '<div class="drf-pack">' + draft.pack.map(function (c, i) { return '<div class="drf-card" data-i="' + i + '" title="' + esc(c.name) + '">' + (c.img ? ('<img src="' + c.img + '">') : ('<div class="nm">' + esc(c.name) + "</div>")) + "</div>"; }).join("") + "</div>";
      body().innerHTML = b;
      Array.prototype.forEach.call(panel.querySelectorAll(".drf-card"), function (el2) { el2.onclick = function () { pick(draft.pack[+el2.dataset.i]); }; });
      var fin = panel.querySelector(".drf-finish"); if (fin) fin.onclick = finish;
    }
    panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
    panel.querySelector(".drf-start").onclick = start;
    document.body.appendChild(ov);
  }
  function openInsights() {
    if (!state) { setStatus("Load a deck first."); return; }
    var cards = []; for (var id in state.cards) { var c = state.cards[id]; if (c.ownerSeat === mySeat && !c._placeholder && !c.isToken) cards.push(c); }
    var curve = [0, 0, 0, 0, 0, 0, 0], colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, types = { Creature: 0, Planeswalker: 0, Instant: 0, Sorcery: 0, Artifact: 0, Enchantment: 0, Land: 0, Other: 0 };
    var lands = 0, nonland = 0, known = 0, total = cards.length;
    cards.forEach(function (c) {
      var m = imagesById[c.cardId] || imagesById[c.name]; if (!m || m.type == null) return; known++;
      var t = m.type || "", isLand = /Land/.test(t);
      if (isLand) { lands++; types.Land++; }
      else {
        nonland++;
        curve[Math.max(0, Math.min(6, Math.round(m.cmc || 0)))]++;
        var cols = m.colors || []; if (!cols.length) colors.C++; else cols.forEach(function (k) { if (colors[k] != null) colors[k]++; });
        var primary = ["Planeswalker", "Creature", "Instant", "Sorcery", "Artifact", "Enchantment"].filter(function (ty) { return new RegExp(ty).test(t); })[0];
        types[primary || "Other"]++;
      }
    });
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel ins-panel"; ov.appendChild(panel);
    function bar(label, val, max, cls) { var pct = max ? Math.round(val / max * 100) : 0; return '<div class="ins-bar"><span class="ins-bl">' + label + '</span><span class="ins-track"><span class="ins-fill ' + (cls || "") + '" style="width:' + pct + '%"></span></span><span class="ins-bv">' + val + "</span></div>"; }
    var h = '<div class="pv-head"><span>Deck insights</span><button class="pv-x">Close</button></div>';
    if (!known) { h += '<div class="ins-msg">Card data is still loading from Scryfall \u2014 reopen this in a moment.</div>'; }
    else {
      var maxCurve = Math.max.apply(null, curve.concat([1]));
      h += '<div class="ins-sec">Mana value (nonland)</div>';
      curve.forEach(function (v, i) { h += bar(i === 6 ? "6+" : ("" + i), v, maxCurve, "c"); });
      h += '<div class="ins-sec">Colors (nonland)</div>';
      var maxCol = Math.max.apply(null, [colors.W, colors.U, colors.B, colors.R, colors.G, colors.C, 1]);
      [["W", "White"], ["U", "Blue"], ["B", "Black"], ["R", "Red"], ["G", "Green"], ["C", "Colorless"]].forEach(function (k) { h += bar(k[1], colors[k[0]], maxCol, "col-" + k[0]); });
      h += '<div class="ins-sec">Card types</div>';
      var maxT = Math.max.apply(null, Object.keys(types).map(function (k) { return types[k]; }).concat([1]));
      Object.keys(types).forEach(function (k) { if (types[k]) h += bar(k, types[k], maxT, "t"); });
      h += '<div class="ins-foot">Lands ' + lands + ' \u00b7 Nonland ' + nonland + ' \u00b7 ' + known + "/" + total + " cards identified</div>";
    }
    panel.innerHTML = h; panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
    document.body.appendChild(ov);
  }
  function rollPlanarFace() { var r = Math.floor(Math.random() * 6); return r === 0 ? "planeswalk" : (r === 1 ? "chaos" : "blank"); }
  function planeswalk() { if (planar.deck.length) planar.pos = (planar.pos + 1) % planar.deck.length; }
  async function loadPlanarDeck() {
    try {
      var url = "https://api.scryfall.com/cards/search?q=" + encodeURIComponent("(type:plane or type:phenomenon) -is:digital") + "&unique=cards";
      var res = await fetch(url).then(function (x) { return x.json(); });
      var all = [];
      (res.data || []).forEach(function (c) { all.push({ name: c.name, img: (c.image_uris && (c.image_uris.normal || c.image_uris.large)) || "", text: c.oracle_text || "" }); });
      planar.deck = MTGCore.shuffle(all, "planar-" + Date.now()); planar.pos = 0; planar.loaded = true;
    } catch (e) { planar.loaded = true; planar.deck = []; }
  }
  function openPlanechase() {
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel pc-panel"; ov.appendChild(panel);
    function wire() {
      panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
      var l = panel.querySelector(".pc-load"); if (l) l.onclick = function () { l.textContent = "Loading\u2026"; l.disabled = true; loadPlanarDeck().then(draw); };
      var rl = panel.querySelector(".pc-roll"); if (rl) rl.onclick = function () { var f = rollPlanarFace(); var res = panel.querySelector(".pc-result"); if (f === "planeswalk") { planeswalk(); log("<b>Planar die:</b> Planeswalk"); draw(); } else if (f === "chaos") { if (res) res.textContent = "CHAOS \u2014 trigger the active plane's chaos ability."; log("<b>Planar die:</b> Chaos"); } else { if (res) res.textContent = "Blank \u2014 nothing happens."; } };
      var wk = panel.querySelector(".pc-walk"); if (wk) wk.onclick = function () { planeswalk(); log("<b>Planeswalk</b> to " + esc(planar.deck[planar.pos].name)); draw(); };
    }
    function draw() {
      var h = '<div class="pv-head"><span>Planechase</span><button class="pv-x">Close</button></div>';
      if (!planar.loaded) { h += '<div class="pc-msg">Load a planar deck (every plane + phenomenon from Scryfall, shuffled) to begin.</div><div class="pc-foot"><button class="primary pc-load">Load planar deck</button></div>'; }
      else if (!planar.deck.length) { h += '<div class="pc-msg">Could not load planes \u2014 check your connection and retry.</div><div class="pc-foot"><button class="primary pc-load">Retry</button></div>'; }
      else {
        var plane = planar.deck[planar.pos];
        h += '<div class="pc-active">' + (plane.img ? ('<img src="' + plane.img + '">') : ('<div class="pc-nm">' + esc(plane.name) + "</div>")) + "</div>";
        h += '<div class="pc-name">' + esc(plane.name) + ' <span class="pc-count">plane ' + (planar.pos + 1) + " / " + planar.deck.length + "</span></div>";
        if (plane.text) h += '<div class="pc-text">' + esc(plane.text) + "</div>";
        h += '<div class="pc-foot"><button class="primary pc-roll">Roll planar die</button><button class="pc-walk">Planeswalk \u2192</button></div><div class="pc-result"></div>';
      }
      panel.innerHTML = h; wire();
    }
    document.body.appendChild(ov); draw();
  }
  var PLAYMATS = [
    { name: "Arcane Seal", css: 'url("assets/playmats/arcane.svg") center/cover no-repeat, #0b0714' },
    { name: "Astral", css: 'url("assets/playmats/astral.svg") center/cover no-repeat, #060f1c' },
    { name: "Verdant", css: 'url("assets/playmats/verdant.svg") center/cover no-repeat, #08160f' },
    { name: "Midnight", css: "radial-gradient(1200px 700px at 50% 0%, #1a2030, #111827)" },
    { name: "Forest felt", css: "radial-gradient(1000px 600px at 50% 10%, #1f3d2b, #0d1f16)" },
    { name: "Deep ocean", css: "radial-gradient(1000px 600px at 50% 0%, #14304d, #0a1626)" },
    { name: "Ember", css: "radial-gradient(1000px 600px at 50% 0%, #3a1c1c, #1a0e0e)" },
    { name: "Arcane", css: "radial-gradient(1000px 600px at 50% 0%, #2a1b46, #140d24)" },
    { name: "Slate", css: "linear-gradient(160deg, #2b3240, #11151c)" }
  ];
  var DEFAULT_MAT = PLAYMATS[0].css;
  function matSurround(css) { var m = String(css || "").match(/#[0-9a-fA-F]{3,8}/g); return (m && m.length) ? m[m.length - 1] : "#0b0f17"; }
  function applyPlaymat(css, save) {
    if (el.surface) el.surface.style.background = css;            // the mat (image/gradient) lives ON the playmat surface
    if (el.viewport) el.viewport.style.background = matSurround(css); // the table around it = a matching solid color
    if (save !== false) { try { localStorage.setItem("mtg_playmat", css); } catch (e) {} }
  }
  function loadPlaymat() { try { var v = localStorage.getItem("mtg_playmat"); if (v) applyPlaymat(v, false); } catch (e) {} }
  function openPlaymat() {
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel mat-panel"; ov.appendChild(panel);
    var h = '<div class="pv-head"><span>Playmat</span><button class="pv-x">Close</button></div>';
    h += '<div class="mat-grid">' + PLAYMATS.map(function (m) { return '<button class="mat-swatch" data-css="' + esc(m.css) + '" style="background:' + m.css + '"><span>' + esc(m.name) + "</span></button>"; }).join("") + "</div>";
    h += '<div class="mat-custom"><input class="mat-url" placeholder="Custom image URL (https://\u2026)"><button class="mat-apply">Apply image</button></div>';
    h += '<div class="mat-footr"><button class="mat-reset">Reset to default</button></div>';
    panel.innerHTML = h;
    panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
    Array.prototype.forEach.call(panel.querySelectorAll(".mat-swatch"), function (b) { b.onclick = function () { applyPlaymat(b.dataset.css); }; });
    panel.querySelector(".mat-apply").onclick = function () { var u = (panel.querySelector(".mat-url").value || "").trim(); if (!/^https?:/i.test(u)) { setStatus("Enter an https image URL."); return; } applyPlaymat('url("' + u.replace(/"/g, "") + '") center/cover no-repeat, #111827'); };
    panel.querySelector(".mat-reset").onclick = function () { applyPlaymat(DEFAULT_MAT); try { localStorage.removeItem("mtg_playmat"); } catch (e) {} };
    document.body.appendChild(ov);
  }
  // Build a rules-engine card (MTGDuel shape) from a live board card: base P/T from Scryfall + counters/keywords.
  function engCard(c) {
    var m = imagesById[c.cardId] || imagesById[c.name] || {};
    var pt = m.pt || [0, 0];
    return { name: c.name || m.name || "creature", power: parseInt(pt[0], 10) || 0, toughness: parseInt(pt[1], 10) || 0, counters: c.counters || {}, keywords: m.keywords || [], colors: m.colors || [], oracle: m.oracle || "", type: m.type || "" };
  }
  function openCombat() {
    if (!state) { setStatus("Start a game first."); return; }
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel cmb-panel"; ov.appendChild(panel);
    function attackers() { var out = []; for (var id in state.cards) { var c = state.cards[id]; var ctrl = c.controllerSeat != null ? c.controllerSeat : c.ownerSeat; if (c.attacking && c.zone === "battlefield" && ctrl === mySeat) out.push(c); } return out; }
    function declaredBlockers() { var out = []; for (var id in blockingIds) { var c = state.cards[id]; if (c && c.zone === "battlefield") out.push(c); } return out; }
    function clearAll(list) { list.forEach(function (c) { dispatch({ t: "card_combat", instanceId: c.instanceId, attacking: false }); }); }
    var assign = {};   // blockerInstanceId -> attackerInstanceId (block assignment)
    function draw() {
      var atk = attackers(), blk = declaredBlockers(), ps = state.players;
      var total = atk.reduce(function (a, c) { return a + combatPower(c); }, 0);
      var firstOpp = mySeat; for (var i = 0; i < ps.length; i++) { if (i !== mySeat) { firstOpp = i; break; } }
      var h = '<div class="pv-head"><span>Combat</span><button class="pv-x">Close</button></div>';
      if (!atk.length) { h += '<div class="cmb-empty">No attackers declared. Right-click a creature \u2192 <b>Declare attacker</b>. To resolve blocks, right-click the defending creatures \u2192 <b>Declare blocker</b> first.</div>'; }
      else {
        h += '<div class="cmb-list">' + atk.map(function (c) { return '<div class="cmb-row"><span>' + esc(c.name) + '</span><b>' + combatPower(c) + '</b></div>'; }).join("") + '</div>';
        if (blk.length) {
          h += '<div class="cmb-block"><div class="cmb-bh">Assign blockers</div>' + blk.map(function (b) {
            return '<div class="cmb-brow"><span>' + esc(b.name) + ' <i>' + combatPower(b) + '</i></span><select data-blk="' + b.instanceId + '"><option value="">\u2014 not blocking \u2014</option>' +
              atk.map(function (a) { return '<option value="' + a.instanceId + '"' + (assign[b.instanceId] === a.instanceId ? " selected" : "") + '>blocks ' + esc(a.name) + '</option>'; }).join("") + '</select></div>';
          }).join("") + '</div>';
        }
        h += '<div class="cmb-tot">' + (blk.length ? "Unblocked reach player " : "Total power ") + '<b>' + total + '</b></div>';
        h += '<div class="cmb-target">Defender: <select class="cmb-sel">' + ps.map(function (pl, i) { return '<option value="' + i + '"' + (i === firstOpp ? " selected" : "") + '>' + (pl.name ? esc(pl.name) : (i === mySeat ? "You" : "Seat " + i)) + " (" + pl.life + ")</option>"; }).join("") + '</select></div>';
        h += '<div class="cmb-foot">' + (blk.length ? '<button class="primary cmb-resolve">Resolve combat</button>' : '<button class="primary cmb-go">Deal ' + total + ' damage</button>') + '<button class="cmb-clear">Clear combat</button></div>';
      }
      panel.innerHTML = h;
      panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
      Array.prototype.forEach.call(panel.querySelectorAll("select[data-blk]"), function (s) { s.onchange = function () { assign[s.dataset.blk] = s.value; }; });
      var go = panel.querySelector(".cmb-go"); if (go) go.onclick = function () { var sel = panel.querySelector(".cmb-sel"); var a2 = attackers(); var tot = a2.reduce(function (a, c) { return a + combatPower(c); }, 0); var tgt = sel ? +sel.value : firstOpp; dispatch({ t: "adjust_life", seat: tgt, delta: -tot }); clearAll(a2); log("<b>Combat</b> \u2014 " + tot + " to " + (tgt === mySeat ? "you" : "seat " + tgt) + "."); ov.remove(); };
      var rz = panel.querySelector(".cmb-resolve"); if (rz) rz.onclick = function () {
        if (!window.MTGDuel || !MTGDuel.resolveFullCombat) { setStatus("Combat engine not loaded."); return; }
        var sel = panel.querySelector(".cmb-sel"); var tgt = sel ? +sel.value : firstOpp;
        var a2 = attackers(), b2 = declaredBlockers();
        var pairs = a2.map(function (a) { var mine = b2.filter(function (b) { return assign[b.instanceId] === a.instanceId; }); return { atkCard: a, blkCards: mine, attacker: engCard(a), blockers: mine.map(engCard) }; });
        var res = MTGDuel.resolveFullCombat(pairs), deaths = 0;
        pairs.forEach(function (p, i) {
          var r = res.results[i];
          if (r.attackerDies) { dispatch({ t: "card_move", instanceId: p.atkCard.instanceId, toZone: "graveyard" }); deaths++; }
          r.blockers.forEach(function (br, bi) { if (br.dies) { dispatch({ t: "card_move", instanceId: p.blkCards[bi].instanceId, toZone: "graveyard" }); deaths++; } });
        });
        if (res.toPlayer > 0) dispatch({ t: "adjust_life", seat: tgt, delta: -res.toPlayer });
        if (res.lifegain && res.lifegain.attackers > 0) dispatch({ t: "adjust_life", seat: mySeat, delta: res.lifegain.attackers });
        a2.forEach(function (c) { dispatch({ t: "card_combat", instanceId: c.instanceId, attacking: false }); });
        b2.forEach(function (c) { delete blockingIds[c.instanceId]; });
        log("<b>Combat resolved</b> \u2014 " + res.toPlayer + " to " + (tgt === mySeat ? "you" : "seat " + tgt) + (deaths ? (", " + deaths + " creature" + (deaths > 1 ? "s" : "") + " died") : "") + (res.lifegain && res.lifegain.attackers ? (", +" + res.lifegain.attackers + " life") : "") + ".");
        try { render(); } catch (e) {}
        ov.remove();
      };
      var cl = panel.querySelector(".cmb-clear"); if (cl) cl.onclick = function () { clearAll(attackers()); blockingIds = {}; try { render(); } catch (e) {} ov.remove(); };
    }
    draw();
    document.body.appendChild(ov);
  }
  // Commanders a seat brings to the game (command zone or battlefield), mapped to the stable
  // cmdDamage key space: first commander = "primary", second (partner/background) = "partner".
  var CMDR_KEYS = ["primary", "partner", "cmdr3", "cmdr4"];
  function commandersOf(seat) {
    var out = [];
    try {
      for (var id in state.cards) { var c = state.cards[id]; if (c && c.ownerSeat === seat && c.isCommander) out.push(c); }
      out.sort(function (x, y) { return (x.pos || 0) - (y.pos || 0) || String(x.instanceId).localeCompare(String(y.instanceId)); });
    } catch (e) {}
    if (!out.length) return [{ key: "primary", name: "Commander", card: null }];
    return out.slice(0, CMDR_KEYS.length).map(function (c, i) {
      var im = imagesById[c.cardId] || {};
      return { key: CMDR_KEYS[i], name: im.name || c.name || (i ? "Partner" : "Commander"), card: c };
    });
  }
  function cmdrKeyOf(card) {
    if (!card || !card.isCommander) return null;
    var list = commandersOf(card.ownerSeat);
    for (var i = 0; i < list.length; i++) if (list[i].card && list[i].card.instanceId === card.instanceId) return list[i].key;
    return "primary";
  }
  function openCmdMatrix() {
    if (!state) { setStatus("Start a game first."); return; }
    var ov = document.createElement("div"); ov.className = "tbl-pileview"; ov.addEventListener("pointerdown", function (e) { if (e.target === ov) ov.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel cmx-panel";
    function draw() {
      var ps = state.players;
      var h = '<div class="pv-head"><span>Commander damage \u2014 21 from any single commander is lethal</span><button class="pv-x">Close</button></div>';
      if (ps.length < 2) { h += '<div class="cmx-empty">You are playing solo. Use the <b>Pod</b> selector to add opponents, then track each commander\u2019s damage here.</div>'; }
      else {
        h += '<div class="cmx-rows">';
        ps.forEach(function (rp, r) {
          h += '<div class="cmx-row"><div class="cmx-who">' + (rp.name ? esc(rp.name) : (r === mySeat ? "You" : "Seat " + r)) + ' <span class="cmx-life">' + rp.life + " life</span></div><div class=\"cmx-cells\">";
          ps.forEach(function (ap, a) {
            if (a === r) return;
            var cmdrs = commandersOf(a);
            cmdrs.forEach(function (cm) {
              var val = (rp.cmdDamage && rp.cmdDamage[a + ":" + cm.key]) || 0;
              var who = (a === mySeat ? "You" : (ap.name ? esc(ap.name) : "Seat " + a));
              var label = cmdrs.length > 1 ? esc(cm.name) : ("from " + who);
              h += '<div class="cmx-cell' + (val >= 21 ? " lethal" : "") + '" title="' + esc(cm.name) + ' (' + who + ')"><div class="cmx-from">' + label + '</div><div class="cmx-val">' + val + '</div><div class="cmx-btns"><button data-r="' + r + '" data-a="' + a + '" data-k="' + cm.key + '" data-d="-1">\u2212</button><button data-r="' + r + '" data-a="' + a + '" data-k="' + cm.key + '" data-d="1">+</button></div></div>';
            });
          });
          h += "</div></div>";
        });
        h += "</div>";
      }
      panel.innerHTML = h;
      panel.querySelector(".pv-x").onclick = function () { ov.remove(); };
      panel.querySelectorAll(".cmx-btns button").forEach(function (b) {
        b.onclick = function () {
          var r = +b.dataset.r, a = +b.dataset.a, d = +b.dataset.d, k = b.dataset.k || "primary";
          var cur = (state.players[r] && state.players[r].cmdDamage && state.players[r].cmdDamage[a + ":" + k]) || 0;
          if (d < 0 && cur <= 0) return;
          // One atomic action per click so a single Undo reverts both counter and life.
          // Damage realizes the life loss; corrections (\u2212) are counter-only (removing damage isn't lifegain).
          var acts = [{ t: "commander_damage", seat: r, fromSeat: a, fromCmd: k, delta: d }];
          if (d > 0) acts.push({ t: "adjust_life", seat: r, delta: -d });
          dispatch(acts.length > 1 ? { t: "batch", actions: acts } : acts[0]);
          draw();
        };
      });
    }
    draw();
    ov.appendChild(panel); document.body.appendChild(ov);
  }
  function saveBoard() {
    if (!state) { setStatus("Nothing to save yet."); return; }
    try {
      localStorage.setItem("mtg_table_save", JSON.stringify({ v: 1, ts: Date.now(), state: state, images: imagesById || {} }));
      setStatus("Game saved to this browser."); log("<b>Saved</b> board.");
    } catch (err) { setStatus("Save failed: " + ((err && err.message) || err)); }
  }
  function loadBoard() {
    var raw = null; try { raw = localStorage.getItem("mtg_table_save"); } catch (e) {}
    if (!raw) { setStatus("No saved game found."); return; }
    try {
      var data = JSON.parse(raw);
      if (!data || !data.state) { setStatus("Saved game is empty."); return; }
      state = data.state; imagesById = data.images || {}; online = false; undoStack = []; clearLink && clearLink();
      render();
      setStatus("Loaded saved game" + (data.ts ? " (" + new Date(data.ts).toLocaleString() + ")" : "") + ".");
      log("<b>Loaded</b> saved board.");
    } catch (err) { setStatus("Load failed: " + ((err && err.message) || err)); }
  }
  function bindHotkeys() {
    window.addEventListener("keydown", function (e) {
      if (!el.page.classList.contains("active")) return;
      var tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select") return;
      var c = hoveredId ? state && state.cards[hoveredId] : null;
      switch (e.key.toLowerCase()) {
        case "t": if (c) dispatch({ t: "card_tap", instanceId: c.instanceId }); break;
        case "f": if (c) dispatch({ t: "card_flip", instanceId: c.instanceId }); break;
        case "a": if (c) dispatch({ t: "card_transform", instanceId: c.instanceId }); break;
        case "g": if (c) dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "graveyard" }); break;
        case "e": if (c) dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "exile" }); break;
        case "h": if (c) dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "hand" }); break;
        case "l": if (c) dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "library", pos: minPos("library") - 1 }); break;
        case "b": if (c) dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "library" }); break;
        case "x": if (c) dispatch({ t: "card_clone", fromId: c.instanceId, instanceId: "tok" + (tokenSeq++), x: 45, y: 60 }); break;
        case "p": if (c && c.zone === "hand") playFromHand(c); break;
        case "d": dispatch({ t: "draw", seat: mySeat, count: 1 }); break;
        case "u": dispatch({ t: "untap_all", seat: mySeat }); break;
        case "z": undo(); break;
        case "i": if (c) openInspect(c); break;
        case "?": showHotkeyHelp(); break;
        case "0": recenter(); break;
        case "escape": var _ovs = document.querySelectorAll(".tbl-pileview"); if (_ovs.length) { _ovs[_ovs.length - 1].remove(); } closeMenu(); exitPile(); closeCounters(); clearLink(); clearSelection(); break;
      }
    });
  }

  async function openPrintPicker(c) {
    closeMenu();
    var back = document.createElement("div"); back.className = "tbl-pileview"; back.addEventListener("click", function (e) { if (e.target === back) back.remove(); });
    var panel = document.createElement("div"); panel.className = "pv-panel";
    panel.innerHTML = '<div class="pv-head">Printings — ' + esc(c.name) + ' <button class="pv-x">close</button></div><div class="pv-grid"><div style="color:#9ca3af;padding:8px">Loading…</div></div>';
    back.appendChild(panel); document.body.appendChild(back);
    panel.querySelector(".pv-x").onclick = function () { back.remove(); };
    try {
      var r = await fetch("https://api.scryfall.com/cards/search?order=released&dir=desc&unique=prints&q=" + encodeURIComponent('!"' + c.name + '"')).then(function (x) { return x.json(); });
      var prints = r.data || [], grid = panel.querySelector(".pv-grid"); grid.innerHTML = "";
      prints.forEach(function (pr) {
        var img = entryImage(pr); if (!img) return;
        var card = document.createElement("div"); card.className = "pv-card";
        card.innerHTML = '<img src="' + img + '"><div class="pv-acts"><button>' + esc((pr.set || "").toUpperCase() + " #" + (pr.collector_number || "")) + "</button></div>";
        card.querySelector("button").onclick = function () { var pti = cardPT(pr); imagesById[pr.id] = { img: img, back: (pr.card_faces && pr.card_faces[1] && pr.card_faces[1].image_uris && (pr.card_faces[1].image_uris.normal || pr.card_faces[1].image_uris.large)) || "", name: pr.name, pt: pti.pt, isCreature: pti.isCreature }; dispatch({ t: "card_setart", instanceId: c.instanceId, cardId: pr.id, name: pr.name, setCode: pr.set, collectorNumber: pr.collector_number }); back.remove(); };
        grid.appendChild(card);
      });
      if (!grid.children.length) grid.innerHTML = '<div style="color:#9ca3af;padding:8px">No printings found.</div>';
    } catch (e) { panel.querySelector(".pv-grid").innerHTML = '<div style="color:#f87171;padding:8px">Could not load printings.</div>'; }
  }
  function bindControls() {
    var on = function (id, fn) { var n = $(id); if (n) n.addEventListener("click", fn); };
    on("tblLoad", function () { state = null; loadGame(); });
    on("tblDraw", function () { dispatch({ t: "draw", seat: mySeat, count: 1 }); });
    on("tblUntap", function () { dispatch({ t: "untap_all", seat: mySeat }); });
    on("tblShuffle", function () { gameSeed = "g" + Date.now(); dispatch({ t: "library_shuffle", seat: mySeat, seed: gameSeed }); });
    on("tblMulligan", function () {
      if (!state) return;
      cardsIn("hand").slice().forEach(function (c) { dispatch({ t: "card_move", instanceId: c.instanceId, toZone: "library" }); });
      gameSeed = "g" + Date.now(); dispatch({ t: "library_shuffle", seat: mySeat, seed: gameSeed }); dispatch({ t: "draw", seat: mySeat, count: 7 });
    });
    on("tblUndo", undo);
    if (el.deckSelect) el.deckSelect.addEventListener("change", function () { state = null; loadGame(); });
  }
  function floatDelta(anchor, delta) {
    if (!anchor || !delta) return;
    var r = anchor.getBoundingClientRect(); if (!r.width) return;
    var f = document.createElement("div"); f.className = "life-float " + (delta >= 0 ? "up" : "down");
    f.textContent = (delta > 0 ? "+" : "") + delta;
    f.style.left = (r.left + r.width / 2) + "px"; f.style.top = r.top + "px";
    document.body.appendChild(f);
    requestAnimationFrame(function () { requestAnimationFrame(function () { f.classList.add("go"); }); });
    setTimeout(function () { f.remove(); }, 820);
  }
  function showToast(text) { if (!el.viewport) return; var t = document.createElement("div"); t.className = "tbl-toast"; t.textContent = text; el.viewport.appendChild(t); setTimeout(function () { t.classList.add("show"); }, 10); setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 320); }, 1600); }
  // === Live pod cursors + chat bubbles (Kiku-style presence) — ride the ephemeral channel. ===
  // Your pointer position is broadcast (throttled) in BOARD coordinates; each client renders
  // remote cursors through its own camera. Disable via localStorage "mtg-live-cursors" = "off".
  var CURSOR_COLORS = ["#4aa3e6", "#e0655c", "#46b277", "#9b86c4", "#e6c04a", "#eef0ea"];
  var cursorLast = 0, remoteCursors = {}, cursorTimer = null;
  function cursorsEnabled() { try { return localStorage.getItem("mtg-live-cursors") !== "off"; } catch (e) { return true; } }
  function cursorPing(cx, cy) {
    if (!online || !state || !cursorsEnabled()) return;
    if (!window.MTGTableSync || !MTGTableSync.broadcastEphemeral) return;
    var now = Date.now(); if (now - cursorLast < 90) return; cursorLast = now;
    var b = screenToBoard(cx, cy);
    var nm = (state.players && state.players[mySeat] && state.players[mySeat].name) || "Player";
    MTGTableSync.broadcastEphemeral({ type: "cursor", seat: mySeat, name: nm, bx: Math.round(b.bx), by: Math.round(b.by) });
  }
  function cursorLayer() {
    var l = document.getElementById("tblCursors");
    if (!l) { l = document.createElement("div"); l.id = "tblCursors"; l.className = "tbl-cursors"; el.viewport.appendChild(l); }
    return l;
  }
  function upsertRemoteCursor(pl) {
    if (!cursorsEnabled() || pl.seat == null || Number(pl.seat) === mySeat || !el.viewport) return;
    var seat = Number(pl.seat);
    var rec = remoteCursors[seat];
    if (!rec) {
      var n = document.createElement("div"); n.className = "rc-cursor";
      var col = CURSOR_COLORS[((seat % CURSOR_COLORS.length) + CURSOR_COLORS.length) % CURSOR_COLORS.length];
      n.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2l16 8-7 2-3 7z" fill="' + col + '" stroke="#04101f" stroke-width="1.4"/></svg><span class="rc-name"></span>';
      n.querySelector(".rc-name").style.background = col;
      cursorLayer().appendChild(n);
      rec = remoteCursors[seat] = { el: n, bx: 0, by: 0, at: 0, bubbleT: null };
    }
    rec.bx = +pl.bx || 0; rec.by = +pl.by || 0; rec.at = Date.now();
    rec.el.querySelector(".rc-name").textContent = String(pl.name || ("Seat " + seat)).slice(0, 24); // textContent — remote name is untrusted
    rec.el.classList.add("show");
    positionCursors();
    if (!cursorTimer) cursorTimer = setInterval(positionCursors, 120);
  }
  function positionCursors() {
    var any = false, now = Date.now();
    for (var seat in remoteCursors) {
      var rec = remoteCursors[seat];
      if (now - rec.at > 4000) {
        rec.el.classList.remove("show");
        if (now - rec.at > 12000) { rec.el.remove(); delete remoteCursors[seat]; } else any = true;
        continue;
      }
      any = true;
      rec.el.style.transform = "translate(" + (camera.x + rec.bx * camera.z) + "px," + (camera.y + rec.by * camera.z) + "px)";
    }
    if (!any && cursorTimer) { clearInterval(cursorTimer); cursorTimer = null; }
  }
  // Chat bubble pinned to the sender's live cursor (returns false when their cursor isn't visible).
  function cursorBubble(pl) {
    var rec = remoteCursors[Number(pl.seat)]; if (!rec || !rec.el.classList.contains("show")) return false;
    var b = rec.el.querySelector(".rc-bubble");
    if (!b) { b = document.createElement("div"); b.className = "rc-bubble"; rec.el.appendChild(b); }
    b.textContent = String(pl.text || "").slice(0, 140); // textContent — untrusted
    b.classList.add("show");
    clearTimeout(rec.bubbleT); rec.bubbleT = setTimeout(function () { b.classList.remove("show"); }, 4200);
    return true;
  }
  // Central ephemeral (broadcast) handler for online tables: arrows, dice, voice, cursors, and text chat.
  function handleEphemeral(pl) {
    if (!pl) return;
    if (pl.type === "arrow") fireArrow(pl.from, pl.to, true, pl.color); // color sanitized inside fireArrow
    else if (pl.type === "cursor") upsertRemoteCursor(pl);
    else if (pl.type === "dice") { var _dn = pl.name ? esc(String(pl.name)) : ("Seat " + esc(String(pl.seat))); log(String(pl.kind) === "Coin" ? ("<b>" + _dn + "</b> flipped <b>" + esc(String(pl.result)) + "</b>") : ("<b>" + _dn + "</b> rolled a <b>" + esc(String(pl.result)) + "</b> on a " + esc(String(pl.kind)).toUpperCase())); } // escape remote fields (untrusted broadcast payload)
    else if (pl.type === "voice" && window.MTGVoice) MTGVoice.onSignal(pl);
    else if (pl.type === "chat") { var bubbled = cursorBubble(pl); addChatMessage(pl.name || ("Seat " + pl.seat), pl.text, false, bubbled); }
  }
  // In-game text chat: a compact toggleable panel that rides the existing ephemeral broadcast channel.
  function ensureChat() {
    var box = document.getElementById("tblChat");
    if (box) return box;
    box = document.createElement("div"); box.id = "tblChat"; box.className = "tbl-chat";
    box.innerHTML = '<div class="chat-head"><span>Table chat</span><button class="chat-min" title="Hide">–</button></div>' +
      '<div class="chat-log" id="tblChatLog"></div>' +
      '<form class="chat-form" id="tblChatForm"><input id="tblChatInput" type="text" maxlength="240" placeholder="Message your pod…" autocomplete="off"><button type="submit" title="Send"><span class="msym">send</span></button></form>';
    (el.viewport || document.body).appendChild(box);
    box.querySelector(".chat-min").onclick = function () { box.classList.toggle("collapsed"); };
    box.querySelector("#tblChatForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = box.querySelector("#tblChatInput"), t = (inp.value || "").trim(); if (!t) return;
      inp.value = "";
      var nm = (state && state.players && state.players[mySeat] && state.players[mySeat].name) || "You";
      addChatMessage(nm, t, true);
      if (online && window.MTGTableSync && MTGTableSync.broadcastEphemeral) MTGTableSync.broadcastEphemeral({ type: "chat", name: nm, seat: mySeat, text: t });
    });
    return box;
  }
  function addChatMessage(name, text, mine, quiet) {
    var box = ensureChat(); box.classList.remove("collapsed"); box.classList.add("show");
    var logEl = box.querySelector("#tblChatLog");
    var row = document.createElement("div"); row.className = "chat-row" + (mine ? " mine" : "");
    row.innerHTML = '<b>' + esc(name) + "</b> " + esc(text);
    logEl.appendChild(row); logEl.scrollTop = logEl.scrollHeight;
    if (!mine && !quiet) showToast(String(name) + ": " + String(text)); // showToast uses textContent (safe); pre-escaping double-escaped &/
  }
  function toggleChat() { var box = ensureChat(); box.classList.toggle("show"); if (box.classList.contains("show")) { box.classList.remove("collapsed"); var i = box.querySelector("#tblChatInput"); if (i) i.focus(); } }
  // Reconnect/resume indicator for online tables (driven by the realtime channel status).
  function showConnStatus(kind) {
    if (!online || !el.viewport) return;
    var c = document.getElementById("tblConn");
    if (!c) { c = document.createElement("div"); c.id = "tblConn"; c.className = "tbl-conn"; el.viewport.appendChild(c); }
    if (kind === "reconnecting") { c.className = "tbl-conn warn show"; c.innerHTML = '<span class="dot"></span>Reconnecting…'; }
    else if (kind === "reconnected") {
      c.className = "tbl-conn ok show"; c.innerHTML = '<span class="dot"></span>Reconnected';
      log("<b>Reconnected</b> — resynced the table.");
      setTimeout(function () { c.classList.remove("show"); }, 2600);
    } else { c.className = "tbl-conn ok"; }
  }
  function nowStamp() { var d = new Date(), tn = (state && state.turn) || 1; return '<span class="log-ts">' + d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2) + " · T" + tn + "</span> "; }
  function log(html) { if (!el.log) return null; var row = document.createElement("div"); row.className = "row"; row.innerHTML = nowStamp() + html; el.log.insertBefore(row, el.log.firstChild); return row; }
  // Action-log: every entry gets the acting player's name + a [time · turn] stamp, and rapid repeats
  // of the same counter/life change coalesce into one summed entry (e.g. +5, not five +1 rows).
  var _lastLog = null;
  function actorName(action) { var seat = (action && action.seat != null) ? action.seat : mySeat; var pl = state && state.players && state.players[seat]; return (pl && pl.name) || ("Seat " + seat); }
  function coalesceSig(a) {
    if (a.t === "card_counter") return "cc:" + a.instanceId + ":" + a.kind + ":" + (a.seat == null ? mySeat : a.seat);
    if (a.t === "player_counter") return "pc:" + a.seat + ":" + a.kind;
    if (a.t === "adjust_life") return "al:" + a.seat;
    return null;
  }
  function logAction(action) {
    var base = describe(action); if (!base) return;
    var who = '<b class="log-who">' + esc(actorName(action)) + '</b> ';
    var sig = coalesceSig(action), now = Date.now();
    if (sig && _lastLog && _lastLog.sig === sig && (now - _lastLog.t) < 2500 && _lastLog.row && _lastLog.row.parentNode) {
      _lastLog.delta += (Number(action.delta) || 0); _lastLog.t = now;
      var merged = {}; for (var k in action) merged[k] = action[k]; merged.delta = _lastLog.delta;
      var md = describe(merged); _lastLog.row.innerHTML = nowStamp() + who + (md || base);
      return;
    }
    var row = log(who + base);
    _lastLog = sig ? { sig: sig, delta: (Number(action.delta) || 0), row: row, t: now } : null;
  }
  function nameOf(id) { var c = state && state.cards[id]; return c ? (c.name || "card") : "card"; }
  // Resolve the local player's display name from the signed-in account; guests get "You".
  function accountPlayerName() {
    try {
      var s = window.mtgSync && window.mtgSync.session;
      var u = s && s.user;
      if (u && !u.is_anonymous) {
        var md = u.user_metadata || {};
        var dn = md.display_name || md.full_name || md.name;
        if (dn) return String(dn).trim().slice(0, 24);
        if (u.email) return String(u.email).split("@")[0].slice(0, 24);
      }
    } catch (e) {}
    return "You";
  }
  // Log card hyperlink: clickable/hoverable card name in the action log → explode (inspect) the card.
  function cardLink(id) { var nm = nameOf(id); return '<span class="log-card" data-logcard="' + esc(String(id)) + '">' + esc(nm) + "</span>"; }
  function bindLogCardLinks() {
    if (!el.log || el.log._logLinksBound) return; el.log._logLinksBound = true;
    el.log.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest(".log-card") : null;
      if (!t) return; var id = t.getAttribute("data-logcard");
      var c = state && state.cards && state.cards[id];
      if (c) { e.preventDefault(); openInspect(c); }
    });
    el.log.addEventListener("mouseover", function (e) {
      var t = e.target.closest ? e.target.closest(".log-card") : null;
      if (!t) return; var id = t.getAttribute("data-logcard");
      var c = state && state.cards && state.cards[id];
      if (c && typeof showPreview === "function") showPreview(c);
    });
  }
  function describe(a) {
    switch (a.t) {
      case "batch": { var _parts = (a.actions || []).map(describe).filter(function (x) { return x; }); return _parts.length ? _parts.join(" · ") : null; }
      case "commander_damage": {
        var _tp = state && state.players ? state.players[a.seat] : null;
        var _who = _tp && _tp.name ? esc(_tp.name) : ("Seat " + a.seat);
        return "<b>Commander damage</b> " + (a.delta > 0 ? "+" + a.delta : a.delta) + " to " + _who + " (from seat " + a.fromSeat + (a.fromCmd && a.fromCmd !== "primary" ? " · " + esc(a.fromCmd) : "") + ")";
      }
      case "draw": return "drew " + (a.count || 1) + " card" + ((a.count || 1) !== 1 ? "s" : "");
      case "mill": return "milled " + (a.count || 1) + " card" + ((a.count || 1) !== 1 ? "s" : "");
      case "card_move": return null; // moving cards must NOT create a log entry (user request 2026-07-03)
      case "card_combat": return (a.attacking ? "<b>Attacks</b> " : "<b>Removed from combat</b> ") + cardLink(a.instanceId);
      case "card_tap": return "<b>Tap/Untap</b> " + cardLink(a.instanceId);
      case "untap_all": return "<b>Untap all</b>";
      case "card_flip": return "<b>Flip</b> " + cardLink(a.instanceId);
      case "card_transform": return "<b>Transform</b> " + cardLink(a.instanceId);
      case "card_phase": return "<b>Phase</b> " + cardLink(a.instanceId);
      case "card_attach": return "<b>Attach</b> " + cardLink(a.instanceId);
      case "card_counter": { var dcc = Number(a.delta) || 0; return (dcc >= 0 ? "added " : "removed ") + Math.abs(dcc) + " " + esc(a.kind) + " counter" + (Math.abs(dcc) !== 1 ? "s" : "") + (dcc >= 0 ? " to " : " from ") + cardLink(a.instanceId); }
      case "player_counter": { var dpc = Number(a.delta) || 0; return (dpc >= 0 ? "added " : "removed ") + Math.abs(dpc) + " " + esc(a.kind) + " counter" + (Math.abs(dpc) !== 1 ? "s" : ""); }
      case "adjust_life": { var dal = Number(a.delta) || 0; return dal >= 0 ? "gained " + dal + " life" : "lost " + (-dal) + " life"; }
      case "card_clone": return "<b>Token copy</b> of " + cardLink(a.fromId);
      case "library_shuffle": return "<b>Shuffle</b> library";
      case "set_phase": {
        var phL = { untap: "Untap", upkeep: "Upkeep", draw: "Draw", main1: "Main 1", combat: "Combat", main2: "Main 2", end: "End", cleanup: "Cleanup" };
        var seat = state ? state.activeSeat : 0, pl = state && state.players ? state.players[seat] : null;
        var who = pl && pl.name ? esc(pl.name) : ("Seat " + seat);
        return "<b>" + who + "</b> moved to <b>" + (phL[a.phase] || a.phase) + "</b>";
      }
      case "pass_turn": {
        var ns = state ? state.activeSeat : 0, np = state && state.players ? state.players[ns] : null;
        return "<b>" + (np && np.name ? esc(np.name) : ("Seat " + ns)) + "</b> took the turn";
      }
      default: return "<b>" + esc(a.t) + "</b>";
    }
  }

  // ===== Sideboard swapping between games (Kiku parity) =====================================
  var SB_LSKEY = "mtg-sideboard-v1";
  function sbStore() { try { return JSON.parse(localStorage.getItem(SB_LSKEY) || "{}") || {}; } catch (e) { return {}; } }
  function sbPersist() {
    if (!sideboardDeckKey) return;
    try { var all = sbStore(); all[sideboardDeckKey] = sideboardCards.map(function (c) { return { cardId: c.cardId, name: c.name }; }); localStorage.setItem(SB_LSKEY, JSON.stringify(all)); } catch (e) {}
  }
  // Called on every deck load. `base` = the sideboard entries parsed from the deck THIS time.
  // Same deck as last time → restore the persisted (possibly swapped) sideboard; different deck → reset to `base`.
  function loadSideboardForDeck(label, base, images) {
    var key = String(label || "deck");
    if (images) for (var ik in images) if (!imagesById[ik]) imagesById[ik] = images[ik]; // ensure sideboard art renders
    var persisted = null; try { persisted = sbStore()[key]; } catch (e) {}
    if (persisted && Array.isArray(persisted)) sideboardCards = persisted.map(function (c) { return { cardId: c.cardId, name: c.name }; });
    else { sideboardCards = (base || []).map(function (c) { return { cardId: c.cardId, name: c.name }; }); }
    sideboardDeckKey = key;
    sbPersist(); // seed the store for a brand-new deck so its sideboard survives a reload
  }

  var sbEl = null;
  function closeSideboard() { if (sbEl) { sbEl.remove(); sbEl = null; } }
  function openSideboard() {
    if (!state) { setStatus("Load a deck first."); return; }
    ensureSideboardStyle();
    closeSideboard();
    var back = document.createElement("div"); back.className = "tbl-pileview sb-back";
    back.addEventListener("click", function (e) { if (e.target === back) closeSideboard(); });
    var panel = document.createElement("div"); panel.className = "pv-panel sb-panel";
    back.appendChild(panel); document.body.appendChild(back); sbEl = back;

    function libCards() { try { return MTGCore.cardsOf(state, mySeat, "library").slice(); } catch (e) { return []; } }

    function draw() {
      var lib = libCards();
      var total = mySeatDeckCount();
      var warn = (startDeckSize && total !== startDeckSize)
        ? '<div class="sb-warn">Deck is ' + total + ' cards (started at ' + startDeckSize + '). Swaps needn’t be 1:1 — just a heads-up.</div>'
        : "";
      panel.innerHTML =
        '<div class="pv-head"><span class="pv-title">Sideboard <span class="pv-count">' + sideboardCards.length + '</span></span>' +
        '<button class="pv-x pv-x-ic" title="Close" aria-label="Close"><span class="msym">close</span></button></div>' +
        warn +
        '<div class="sb-cols">' +
        '<div class="sb-col"><div class="sb-colhead">Sideboard → into library</div><div class="sb-grid" id="sbLeft"></div></div>' +
        '<div class="sb-col"><div class="sb-colhead">My library → out to sideboard <span class="sb-sub">(' + lib.length + ')</span></div>' +
        '<input class="sb-search" id="sbSearch" type="text" placeholder="Search library…" /><div class="sb-list" id="sbRight"></div></div>' +
        '</div>';
      panel.querySelector(".pv-x").onclick = closeSideboard;

      // LEFT: sideboard cards as art tiles (click = move into library).
      var left = panel.querySelector("#sbLeft");
      if (!sideboardCards.length) left.innerHTML = '<div class="pv-emptymsg">No sideboard cards.</div>';
      sideboardCards.forEach(function (sc, i) {
        var im = imagesById[sc.cardId] || {};
        var tile = document.createElement("button"); tile.type = "button"; tile.className = "sb-tile"; tile.title = "Bring " + sc.name + " into your library";
        tile.innerHTML = (im.img ? '<img src="' + esc(im.img) + '" alt="">' : '<div class="sb-nm">' + esc(sc.name) + "</div>") + '<div class="sb-cap">' + esc(sc.name) + "</div>";
        tile.onclick = function () { sbBringIn(i); draw(); };
        left.appendChild(tile);
      });

      // RIGHT: library search/scroll list (click = move out to sideboard).
      var right = panel.querySelector("#sbRight");
      var search = panel.querySelector("#sbSearch");
      function renderRight() {
        var q = (search.value || "").toLowerCase().trim();
        right.innerHTML = "";
        var shown = lib.filter(function (c) { return !q || String(c.name || "").toLowerCase().indexOf(q) !== -1; });
        if (!shown.length) { right.innerHTML = '<div class="pv-emptymsg">No matching cards.</div>'; return; }
        shown.forEach(function (c) {
          var row = document.createElement("button"); row.type = "button"; row.className = "sb-row"; row.title = "Move " + c.name + " out to the sideboard";
          var im = imagesById[c.cardId] || {};
          row.innerHTML = (im.img ? '<img src="' + esc(im.img) + '" alt="">' : '<span class="sb-rowic msym">style</span>') + '<span class="sb-rowname">' + esc(c.name) + "</span><span class=\"msym sb-rowgo\">chevron_right</span>";
          row.onclick = function () { sbTakeOut(c.instanceId); draw(); };
          right.appendChild(row);
        });
      }
      search.oninput = renderRight;
      renderRight();
    }

    // Move a sideboard card INTO my library (engine-safe: __add a fresh instance, then reshuffle).
    function sbBringIn(idx) {
      var sc = sideboardCards[idx]; if (!sc) return;
      var lib = null; try { lib = MTGCore.cardsOf(state, mySeat, "library"); } catch (e) { lib = []; }
      var pos = lib.length ? (lib[lib.length - 1].pos + 1) : 0;
      var inst = "sb" + Date.now() + Math.floor(Math.random() * 1000);
      var card = { instanceId: inst, cardId: sc.cardId, name: sc.name, ownerSeat: mySeat, controllerSeat: mySeat, zone: "library", pos: pos, isCommander: false };
      dispatch({ t: "__add", cards: [card] });
      dispatch({ t: "library_shuffle", seat: mySeat, seed: "sb" + Date.now() });
      sideboardCards.splice(idx, 1); sbPersist();
      log("<b>Sideboard</b>: " + esc(sc.name) + " in");
    }
    // Move a library card OUT to the sideboard (engine-safe: __remove, then track it).
    function sbTakeOut(id) {
      var c = state.cards[id]; if (!c) return;
      var nm = c.name || (imagesById[c.cardId] && imagesById[c.cardId].name) || "Card";
      dispatch({ t: "__remove", ids: [id] });
      sideboardCards.push({ cardId: c.cardId, name: nm }); sbPersist();
      log("<b>Sideboard</b>: " + esc(nm) + " out");
    }

    draw();
  }

  var _sbStyled = false;
  function ensureSideboardStyle() {
    if (_sbStyled) return; _sbStyled = true;
    var css =
      ".sb-panel{max-width:920px;width:92vw}" +
      ".sb-warn{margin:2px 0 8px;padding:6px 10px;border-radius:8px;background:rgba(224,101,92,.14);color:#f0b6b0;font-size:12px;border:1px solid rgba(224,101,92,.3)}" +
      ".sb-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}" +
      ".sb-col{display:flex;flex-direction:column;min-height:0}" +
      ".sb-colhead{font-size:12px;letter-spacing:.02em;color:var(--ink-2,#9fb1c6);margin:0 0 6px;font-weight:600}" +
      ".sb-sub{opacity:.7;font-weight:400}" +
      ".sb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;overflow:auto;max-height:52vh;padding-right:4px}" +
      ".sb-tile{position:relative;padding:0;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:var(--ink-1,#12202f);cursor:pointer;overflow:hidden;aspect-ratio:63/88;transition:transform .1s,box-shadow .1s}" +
      ".sb-tile:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.45);border-color:#4f9bff}" +
      ".sb-tile img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".sb-nm{padding:8px;font-size:11px;color:var(--ink,#e8eef6);height:100%;display:flex;align-items:center;justify-content:center;text-align:center}" +
      ".sb-cap{position:absolute;left:0;right:0;bottom:0;padding:3px 5px;font-size:10px;line-height:1.15;background:linear-gradient(transparent,rgba(0,0,0,.82));color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".sb-search{width:100%;box-sizing:border-box;margin:0 0 6px;padding:6px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:var(--ink-1,#0f1b28);color:var(--ink,#e8eef6);font-size:13px}" +
      ".sb-list{overflow:auto;max-height:52vh;display:flex;flex-direction:column;gap:4px;padding-right:4px}" +
      ".sb-row{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:4px 8px;border:1px solid rgba(255,255,255,.06);border-radius:8px;background:var(--ink-1,#12202f);color:var(--ink,#e8eef6);cursor:pointer;font-size:13px}" +
      ".sb-row:hover{border-color:#4f9bff;background:rgba(79,155,255,.1)}" +
      ".sb-row img{width:26px;height:36px;object-fit:cover;border-radius:3px;flex:0 0 auto}" +
      ".sb-rowic{font-size:22px;opacity:.6;flex:0 0 auto}" +
      ".sb-rowname{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".sb-rowgo{opacity:.5;font-size:18px}" +
      "@media(max-width:640px){.sb-cols{grid-template-columns:1fr}}";
    try { var st = document.createElement("style"); st.id = "sbInjectedStyle"; st.textContent = css; document.head.appendChild(st); } catch (e) {}
  }

  window.MTGTable = {
    activate: function () { if (typeof boot === "function") boot(); if (typeof activatePlay === "function") activatePlay(); },
    playDeck: function (idOrIndex) {
      if (typeof boot === "function") boot();
      if (typeof activatePlay !== "function") return;
      activatePlay();
      if (typeof populateDeckSelect === "function") populateDeckSelect();
      if (el.deckSelect) {
        var decks = readSavedDecks(), found = -1;
        for (var i = 0; i < decks.length; i++) { if (String(decks[i].source_deck_id || decks[i].id) === String(idOrIndex) || String(i) === String(idOrIndex)) { found = i; break; } }
        if (found >= 0) el.deckSelect.value = String(found);
      }
      state = null; loadGame();
    },
    getState: function () { return state; },
    // Raw action pipeline — used by the bottom-left life cluster (play-life.js) for Draw and the
    // commander-damage "−" fix-up (counter-only). Guarded: no-ops before a game exists.
    dispatch: function (action) { try { if (state && action) dispatch(action); } catch (e) {} },
    savedDecks: function () { return readSavedDecks(); },
    // Launch a game from the Play shell. ref: {paste:text} | {index:i} | {} (sample), plus {mode, life}.
    // mode: "commander" (default) | "standard" (20 life) | "planechase" (opens the planar deck) | "draft" (draft a pool first).
    start: function (ref) {
      boot(); activatePlay();
      startingLife = (ref && Number(ref.life) > 0) ? Number(ref.life) : 40;
      var mode = (ref && ref.mode) || "commander";
      var followUp = function (r) {
        if (mode === "planechase") setTimeout(function () { try { loadPlanarDeck().then(function () { openPlanechase(); }); } catch (e) { try { openPlanechase(); } catch (e2) {} } }, 400);
        return r;
      };
      if (mode === "draft") { state = null; setTimeout(function () { try { openDraft(); } catch (e) {} }, 50); return Promise.resolve(); }
      if (ref && ref.paste != null) { return Promise.resolve(loadPastedDeck(ref.paste)).then(followUp, followUp); }
      populateDeckSelect();
      if (el.deckSelect) el.deckSelect.value = (ref && ref.index != null) ? String(ref.index) : "__sample";
      state = null; return Promise.resolve(loadGame()).then(followUp, followUp);
    },
    hand: function () { try { if (!state) return []; return MTGCore.cardsOf(state, mySeat, "hand").map(function (c) { return { id: c.instanceId, name: c.name, img: imgFor(c) }; }); } catch (e) { return []; } },
    mulligan: function () { try { doMulligan(); } catch (e) {} },
    addCounter: function (kind, delta) { try { if (!state) return; dispatch({ t: "player_counter", seat: mySeat, kind: String(kind), delta: Number(delta) || 0 }); } catch (e) {} },
    setName: function (name) { try { var n = String(name || "").trim().slice(0, 24); if (n && state && state.players && state.players[mySeat]) { state.players[mySeat].name = n; state.players[mySeat]._namedByUser = true; render(); } } catch (e) {} },
    setBracket: function (label) { try { var b = String(label || "").trim().slice(0, 4); if (!b) return; if (state && state.players && state.players[mySeat]) state.players[mySeat].bracket = b; log("<b>Bracket declared</b> — " + esc(b)); } catch (e) {} },
    host: function (opts) { return Promise.resolve(doHost(opts || { visibility: "private" })).then(function () { try { return (window.MTGTableSync && MTGTableSync.info && MTGTableSync.info().gameId) || null; } catch (e) { return null; } }); },
    hostRoom: function (opts) { return Promise.resolve(doHostRoom(opts || { visibility: "private" })); },
    persistMyDeck: function () { return Promise.resolve(persistMyDeck()); },
    join: function (gid) { return Promise.resolve(doJoin(gid)); },
    online: function () { return !!online; },
    roll: function (kind) { try { return rollDice(kind); } catch (e) { return null; } },
    myCounters: function () { try { return (state && state.players && state.players[mySeat] && state.players[mySeat].counters) || {}; } catch (e) { return {}; } },
    adjustLife: function (d) { try { if (state) dispatch({ t: "adjust_life", seat: mySeat, delta: Number(d) || 0 }); } catch (e) {} },
    // --- life / commander-damage API for the bottom-center life cluster (play-life.js) ---
    seatsInfo: function () {
      try {
        if (!state || !state.players) return [];
        var out = [];
        state.players.forEach(function (p, i) {
          if (!p) return;
          var cmd = []; try { cmd = MTGCore.cardsOf(state, i, "command"); } catch (e) {}
          var art = "", cname = "";
          for (var k = 0; k < cmd.length; k++) { var im = imagesById[cmd[k].cardId]; if (im) { if (!art && im.img) art = im.img; if (!cname && im.name) cname = im.name; } if (art && cname) break; }
          var cd = p.cmdDamage || {}, from = {};
          for (var key in cd) { var sseat = key.split(":")[0]; from[sseat] = (from[sseat] || 0) + (cd[key] || 0); }
          out.push({ seat: i, isMe: i === mySeat, name: p.name || (i === mySeat ? "You" : "Seat " + i), life: p.life, color: p.color || "", poison: (p.counters && p.counters.poison) || 0, commanderArt: art, commanderName: cname || "Commander", cmdFrom: from });
        });
        return out;
      } catch (e) { return []; }
    },
    applyLife: function (seat, delta) { try { if (state) dispatch({ t: "adjust_life", seat: Number(seat), delta: Number(delta) || 0 }); } catch (e) {} },
    applyPoison: function (seat, delta) { try { if (state) dispatch({ t: "player_counter", seat: Number(seat), kind: "poison", delta: Number(delta) || 0 }); } catch (e) {} },
    // Apply N damage to targetSeat from sourceSeat's commander. opts: {cmdr, poison, lifelink, cmdrKey}
    // Dispatched as ONE atomic batch (single Undo reverts the whole gesture).
    applyCmdr: function (targetSeat, sourceSeat, amount, opts) {
      try {
        if (!state) return; opts = opts || {}; amount = Number(amount) || 0; if (amount <= 0) return;
        targetSeat = Number(targetSeat); sourceSeat = (sourceSeat == null ? -1 : Number(sourceSeat));
        var acts = [];
        // CR 903.10a: commander combat damage counts toward the 21 even when it's infect (poison) damage.
        if (opts.cmdr && sourceSeat >= 0 && sourceSeat !== targetSeat) acts.push({ t: "commander_damage", seat: targetSeat, fromSeat: sourceSeat, fromCmd: opts.cmdrKey || "primary", delta: amount });
        if (opts.poison) acts.push({ t: "player_counter", seat: targetSeat, kind: "poison", delta: amount });
        else acts.push({ t: "adjust_life", seat: targetSeat, delta: -amount });
        if (opts.lifelink && sourceSeat >= 0) acts.push({ t: "adjust_life", seat: sourceSeat, delta: amount });
        dispatch(acts.length > 1 ? { t: "batch", actions: acts } : acts[0]);
      } catch (e) {}
    },
    passTurn: function () { try { doPassTurn(); } catch (e) {} },
    toggleChat: function () { try { toggleChat(); } catch (e) {} },
    toggleVoice: function () { try { toggleVoice(); } catch (e) {} },
    // G4.31 — settings-menu game endings: declare a winner (existing game-over flow) or a draw/tie.
    declareWinner: function (seat) { try { if (!state) return; gameOverShown = true; showGameOver(Number(seat)); } catch (e) {} },
    declareDraw: function () { try { declareDraw(); } catch (e) {} },
    untapAll: function () { try { if (state) dispatch({ t: "untap_all", seat: mySeat }); } catch (e) {} },
    setEngineEnforce: function (on) { try { setEngineEnforce(!!on); } catch (e) {} },
    engineEnforceOn: function () { return !!engineEnforce; },
    setShowPT: function (on) { showPT = !!on; try { localStorage.setItem("mtg_show_pt", showPT ? "1" : "0"); } catch (e) {} try { render(); } catch (e) {} },
    showPTOn: function () { return !!showPT; },
    setShowKW: function (on) { showKW = !!on; try { localStorage.setItem("mtg_show_kw", showKW ? "1" : "0"); } catch (e) {} try { render(); } catch (e) {} },
    showKWOn: function () { return !!showKW; },
    enforceSBAs: function () { try { enforceSBAs(); } catch (e) {} },
    createToken: function () { try { openCreateToken(mySeat); } catch (e) {} },
    openCommanderDamage: function () { try { openCmdMatrix(); } catch (e) {} },
    playerInfo: function () {
      try {
        if (!state || !state.players[mySeat]) return null;
        var p = state.players[mySeat], cmd = MTGCore.cardsOf(state, mySeat, "command"), art = "";
        for (var i = 0; i < cmd.length; i++) { var im = imagesById[cmd[i].cardId]; if (im && im.img) { art = im.img; break; } }
        return { seat: mySeat, name: p.name || "You", life: p.life, color: p.color || "",
          library: MTGCore.zoneCount(state, mySeat, "library"), graveyard: MTGCore.zoneCount(state, mySeat, "graveyard"),
          exile: MTGCore.zoneCount(state, mySeat, "exile"), hand: MTGCore.zoneCount(state, mySeat, "hand"),
          cmdDamage: p.cmdDamage || {}, commanderArt: art };
      } catch (e) { return null; }
    },
    playmats: function () { try { return PLAYMATS.slice(); } catch (e) { return []; } },
    applyPlaymat: function (css) { try { applyPlaymat(css); } catch (e) {} },
    openPlaymat: function () { try { openPlaymat(); } catch (e) {} },
    shuffle: function () { try { dispatch({ t: "library_shuffle", seat: mySeat, seed: "s" + Date.now() }); } catch (e) {} },
    openSideboard: function () { try { openSideboard(); } catch (e) {} },
    sideboard: function () { try { return sideboardCards.slice(); } catch (e) { return []; } },
    endGame: function () { try { doEndGame(); } catch (e) {} }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
