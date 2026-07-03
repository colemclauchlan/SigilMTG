// Headless render smoke-test for the Play tab (table.js + table-core.js).
// Catches integration errors (undefined refs, render throws) that node --check can't.
// Requires jsdom:  npm i jsdom   (or: npm i -g jsdom && export NODE_PATH=...)
// Run:  node tests/table-smoke.cjs
//
// It injects a tiny test-only hook before the IIFE's boot() call to reach the
// module-internal functions, scaffolds the minimal Play DOM, stubs the network,
// then drives a solo load, a pod load, and every modal, asserting no errors.

const fs = require("fs");
const path = require("path");
let JSDOM;
try { ({ JSDOM } = require("jsdom")); }
catch (e) { console.log("SKIP: jsdom not installed (run `npm i jsdom`)."); process.exit(0); }

const BASE = path.join(__dirname, "..");
const coreCode = fs.readFileSync(path.join(BASE, "table-core.js"), "utf8");
let tableCode = fs.readFileSync(path.join(BASE, "table.js"), "utf8");

const anchor = 'if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();';
if (tableCode.indexOf(anchor) < 0) { console.log("FAIL: boot anchor not found in table.js"); process.exit(1); }
tableCode = tableCode.replace(anchor,
  'window.__test={loadSample:loadSample,openCmdMatrix:openCmdMatrix,openScry:openScry,' +
  'showHotkeyHelp:showHotkeyHelp,openPasteDeck:openPasteDeck,parseDeckText:parseDeckText,' +
  'saveBoard:saveBoard,openCombat:openCombat,openLobby:openLobby,doEndGame:doEndGame,openPlanechase:openPlanechase,openInsights:openInsights,openDraft:openDraft,openPlaymat:openPlaymat,openInspect:openInspect,dispatch:function(a){dispatch(a);},undo:function(){undo();},getState:function(){return state;},setOpp:function(n){numOpponents=n;}};\n  ' + anchor);

const html = '<!DOCTYPE html><html><body>' +
  '<div class="tbl-controls"></div><button id="playTabButton">Play</button>' +
  '<div id="playPage" class="page-panel active"><select id="tblDeckSelect"></select>' +
  '<div class="tbl-main"><div id="tblViewport"><div id="tblSurface"></div><div id="tblHand"></div></div>' +
  '<div class="tbl-rail"><div id="tblPreview"></div><div id="tblLog"></div></div></div>' +
  '<div id="tblStatus"></div></div></body></html>';

const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const errs = [];
w.addEventListener("error", (e) => errs.push("win:" + ((e.error && e.error.stack) || e.message)));
w.console.error = function () { errs.push("console.error:" + Array.prototype.join.call(arguments, " ")); };
w.fetch = function () { return Promise.reject(new Error("no-net (smoke)")); };
process.on("unhandledRejection", (r) => errs.push("reject:" + ((r && r.stack) || r)));

w.MTGTableSync = { listOpenGames: function () { return Promise.resolve([]); }, info: function () { return { mySeat: 0 }; }, onRemote: null, onEphemeral: null };
w.eval(coreCode);
w.eval(tableCode);

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log("FAIL: " + msg); } }

(async () => {
  const T = w.__test;
  ok(!!T, "test hook present");
  ok(!!w.MTGCore, "MTGCore global present");

  await T.loadSample();
  const surf = w.document.getElementById("tblSurface");
  const vit = () => w.document.getElementById("tblVitals");
  ok(surf.querySelectorAll(".tbl-pile").length === 4, "solo: 4 piles render");
  ok(w.document.getElementById("tblHand").querySelectorAll(".tbl-card").length === 7, "solo: opening hand of 7");
  ok(vit().querySelectorAll(".vit-phases button").length === 7, "solo: 7-step phase bar");
  ok(vit().querySelectorAll(".vit-mana .vit-m").length === 6, "solo: WUBRGC mana pool");
  ok(/in library/.test(w.document.getElementById("tblStatus").textContent), "solo: status set");

  // gameplay sequence: play, tap, to-graveyard, undo, commander->command
  (function () {
    var M = w.MTGCore, sc = T.getState().cards, hid = null, cmdr = null;
    M.cardsOf(T.getState(), 0, "hand").forEach(function (c) { if (!hid && !c.isCommander) hid = c.instanceId; });
    T.dispatch({ t: "card_move", instanceId: hid, toZone: "battlefield", x: 40, y: 45 });
    ok(T.getState().cards[hid].zone === "battlefield", "gameplay: play card to battlefield");
    T.dispatch({ t: "card_tap", instanceId: hid });
    ok(T.getState().cards[hid].tapped === true, "gameplay: tap card");
    T.dispatch({ t: "card_move", instanceId: hid, toZone: "graveyard" });
    ok(T.getState().cards[hid].zone === "graveyard", "gameplay: send to graveyard");
    T.undo();
    ok(T.getState().cards[hid].zone === "battlefield", "gameplay: undo restores zone");
    sc = T.getState().cards; for (var k in sc) { if (sc[k].isCommander) { cmdr = k; break; } }
    T.dispatch({ t: "card_move", instanceId: cmdr, toZone: "battlefield", x: 60, y: 60 });
    T.dispatch({ t: "card_move", instanceId: cmdr, toZone: "graveyard" });
    ok(T.getState().cards[cmdr].zone === "command", "gameplay: commander returns to command zone");
  })();

  T.setOpp(3); await T.loadSample();
  ok(T.getState().players.length === 4, "pod: 4 players");
  ok(vit().querySelectorAll(".vit-opp").length === 3, "pod: 3 opponent seats with life controls");
  ok(w.document.querySelectorAll(".tbl-region").length === 4, "pod: 4 seat region boards");
  ok(Array.prototype.filter.call(w.document.querySelectorAll(".tbl-region"), function (r) { return /rotate\(180/.test(r.style.transform || ""); }).length === 2, "pod 2x2: top-row boards rotated 180");
  ok(Array.prototype.every.call(w.document.querySelectorAll(".tbl-region"), function (r) { return r.querySelectorAll(".tbl-pile").length === 4; }), "pod: each board has its own 4 piles");
  ok([0, 1, 2, 3].every(function (s) { return w.MTGCore.cardsOf(T.getState(), s, "hand").length === 7; }), "pod hotseat: every seat drew an opening hand");

  T.openCmdMatrix();
  ok(w.document.querySelectorAll(".cmx-cell").length === 12, "commander matrix: 4x3 = 12 cells");
  T.openScry(3, "scry");
  ok(w.document.querySelectorAll(".scry-cell").length === 3, "scry modal: 3 cells");
  T.showHotkeyHelp();
  ok(w.document.querySelectorAll(".hk-row").length >= 12, "hotkeys panel: rows render");
  T.openPasteDeck();
  ok(w.document.querySelectorAll(".pd-text").length === 1, "paste-deck modal: textarea");
  T.openCombat();
  ok(w.document.querySelectorAll(".cmb-panel").length === 1, "combat modal opens");
  T.openLobby();
  ok(w.document.querySelectorAll(".lob-panel").length === 1, "lobby modal opens");
  T.doEndGame();
  ok(w.document.querySelectorAll(".end-panel").length === 1, "end-game results modal opens");
  T.openPlanechase();
  ok(w.document.querySelectorAll(".pc-panel").length === 1, "planechase modal opens");
  T.openInsights();
  ok(w.document.querySelectorAll(".ins-panel").length === 1, "insights modal opens");
  T.openDraft();
  ok(w.document.querySelectorAll(".drf-panel").length === 1, "draft modal opens");
  T.openPlaymat();
  ok(w.document.querySelectorAll(".mat-swatch").length === 6, "playmat picker: 6 presets");
  T.openInspect({ name: "Sol Ring", cardId: "x" });
  ok(w.document.querySelectorAll(".insp-panel").length === 1, "card inspector opens");
  ok(T.parseDeckText("Commander\n1 Sol Ring\n2 Forest").length === 2, "decklist parser: 2 entries");
  T.saveBoard();
  ok(!!w.localStorage.getItem("mtg_table_save"), "save: localStorage written");

  ok(errs.length === 0, "no runtime errors (" + (errs.join(" || ") || "none") + ")");

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
