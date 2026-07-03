// Multiplayer state-rebuild + hidden-info test for table-sync.js (buildLocalState).
// Proves the CLIENT layer of hidden-info: when the server (RLS) only sends a player
// their own hidden rows + everyone's public rows + opponent zone COUNTS, the client
// rebuilds opponents' hand/library as face-down placeholders carrying NO card identity,
// while the local player's own cards keep full identity. (Server layer is covered by
// tests/rls_assertions.sql under two JWTs.)
//
// Requires jsdom:  npm i jsdom   (or set NODE_PATH to a global install)
// Run:  node tests/table-sync.node.cjs

const fs = require("fs");
const path = require("path");
let JSDOM;
try { ({ JSDOM } = require("jsdom")); }
catch (e) { console.log("SKIP: jsdom not installed (run `npm i jsdom`)."); process.exit(0); }

const BASE = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(BASE, "table-core.js"), "utf8");
let ts = fs.readFileSync(path.join(BASE, "table-sync.js"), "utf8");
// expose internals for the test only (not persisted to the shipped file)
ts = ts.replace("  return api;\n})();", "  api.__test = { buildLocalState: buildLocalState, S: S, toRow: toRow, hiddenRow: hiddenRow, isHidden: isHidden };\n  return api;\n})();");
if (ts.indexOf("api.__test") < 0) { console.log("FAIL: could not inject test hook into table-sync.js"); process.exit(1); }

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost/", runScripts: "outside-only" });
const w = dom.window;
w.eval(core);                  // -> window.MTGCore
w.mtgSync = { enabled: false }; // table-sync reads window.mtgSync at load
w.eval(ts);                     // -> window.MTGTableSync (+ __test hook)
const SY = w.MTGTableSync, M = w.MTGCore;

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

SY.__test.S.mySeat = 0;
const participants = [
  { id: "p0", seat_index: 0, display_name: "You", life_total: 40 },
  { id: "p1", seat_index: 1, display_name: "Bob", life_total: 37 },
  { id: "p2", seat_index: 2, display_name: "Cara", life_total: 40 },
  { id: "p3", seat_index: 3, display_name: "Dan", life_total: 40 },
];
function rowOf(o) {
  return Object.assign({
    scryfall_id: null, card_name: "", zone: "battlefield", pos: 0, x: 50, y: 50, z: 0,
    tapped: false, face_down: false, flipped_face: 0, phased: false, counters: {},
    attached_to: null, attach_order: null, is_token: false, is_commander: false,
    is_foil: false, is_etched: false, set_code: null, collector_number: null, revealed_to: [],
  }, o);
}
const instances = [
  rowOf({ id: "m1", owner_participant_id: "p0", controller_participant_id: "p0", card_name: "Sol Ring", zone: "hand", pos: 0 }),
  rowOf({ id: "m2", owner_participant_id: "p0", controller_participant_id: "p0", card_name: "Forest", zone: "battlefield", x: 40, y: 50 }),
  rowOf({ id: "o1", owner_participant_id: "p1", controller_participant_id: "p1", card_name: "Llanowar Elves", zone: "battlefield", x: 55, y: 55 }),
];
const counts = [
  { owner_participant_id: "p1", zone: "hand", n: 7 },
  { owner_participant_id: "p1", zone: "library", n: 90 },
];

const st = SY.__test.buildLocalState({ participants: participants, game: { active_seat_index: 1, total_turns: 3 }, instances: instances }, counts);

ok(st.seats === 4, "4 seats rebuilt from participants");
ok(st.players[1] && st.players[1].name === "Bob" && st.players[1].life === 37, "opponent name/life from participant rows");
const myHand = M.cardsOf(st, 0, "hand");
ok(myHand.length === 1 && myHand[0].name === "Sol Ring", "my own hand keeps full identity");
ok(M.cardsOf(st, 0, "battlefield").some(function (c) { return c.name === "Forest"; }), "my own battlefield card present");
ok(M.cardsOf(st, 1, "battlefield").some(function (c) { return c.name === "Llanowar Elves"; }), "opponent PUBLIC battlefield card visible");
const oppHand = M.cardsOf(st, 1, "hand"), oppLib = M.cardsOf(st, 1, "library");
ok(oppHand.length === 7, "opponent hand = 7 face-down placeholders (from zone count)");
ok(oppLib.length === 90, "opponent library = 90 placeholders (from zone count)");
ok(oppHand.every(function (c) { return c.faceDown === true && c.name === "" && c._placeholder; }), "opponent hand placeholders are face-down with NO identity");
ok(oppLib.every(function (c) { return c.name === ""; }), "opponent library placeholders carry no card identity");

// ---- Option B: a card's identity must NOT be written to the SHARED game_card_instances row while it is in a hidden zone ----
// (the UPDATE policy is game-wide, so a member who moved the row to a public zone could otherwise read it)
SY.__test.S.gameId = "game-1";
var rHand = SY.__test.toRow({ instanceId: "x1", cardId: "11111111-1111-1111-1111-111111111111", name: "Black Lotus", ownerSeat: 0, controllerSeat: 0, zone: "hand", pos: 0 });
ok(rHand.card_name === "" && rHand.scryfall_id === null, "hidden zone (hand): identity masked on shared instance row");
var rLib = SY.__test.toRow({ instanceId: "x2", cardId: "22222222-2222-2222-2222-222222222222", name: "Sol Ring", ownerSeat: 0, controllerSeat: 0, zone: "library", pos: 5 });
ok(rLib.card_name === "" && rLib.scryfall_id === null, "hidden zone (library): identity masked on shared instance row");
var rFd = SY.__test.toRow({ instanceId: "x3", cardId: "33333333-3333-3333-3333-333333333333", name: "Morph", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", pos: 0, faceDown: true });
ok(rFd.card_name === "" && rFd.scryfall_id === null, "face-down battlefield: identity masked on shared instance row");
var rBf = SY.__test.toRow({ instanceId: "x4", cardId: "44444444-4444-4444-4444-444444444444", name: "Llanowar Elves", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", pos: 0 });
ok(rBf.card_name === "Llanowar Elves" && rBf.scryfall_id === "44444444-4444-4444-4444-444444444444", "public zone (battlefield): identity present on shared instance row");

// the true identity rides the owner-only game_card_hidden table instead
var hr = SY.__test.hiddenRow({ instanceId: "x1", cardId: "11111111-1111-1111-1111-111111111111", name: "Black Lotus", ownerSeat: 0 });
ok(hr.instance_id === "x1" && hr.card_name === "Black Lotus" && hr.owner_participant_id === "p0", "hiddenRow carries true identity keyed to the owner");

// buildLocalState restores MY OWN hidden identity from the owner-only rows even though the shared row is blank
var blankRow = rowOf({ id: "x1", owner_participant_id: "p0", controller_participant_id: "p0", card_name: "", scryfall_id: null, zone: "hand", pos: 0 });
var st2 = SY.__test.buildLocalState(
  { participants: participants, game: { active_seat_index: 0, total_turns: 1 }, instances: [blankRow] },
  [],
  [{ instance_id: "x1", game_id: "game-1", owner_participant_id: "p0", scryfall_id: "11111111-1111-1111-1111-111111111111", card_name: "Black Lotus" }]
);
ok(M.cardsOf(st2, 0, "hand").length === 1 && M.cardsOf(st2, 0, "hand")[0].name === "Black Lotus", "my own hand identity restored from owner-only hidden rows");

// and with NO overlay, the blank shared row reveals nothing — proving identity was never on the row
var st3 = SY.__test.buildLocalState({ participants: participants, game: { active_seat_index: 0, total_turns: 1 }, instances: [blankRow] }, [], []);
ok(M.cardsOf(st3, 0, "hand")[0].name === "", "blank shared row carries no identity without the owner-only overlay");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
