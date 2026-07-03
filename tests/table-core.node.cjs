// Node test runner for table-core.js. Run: node tests/table-core.node.cjs
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "table-core.js"), "utf8");
const loader = new Function("self", "module", code + "\n;return module.exports || self.MTGCore;");
const MTGCore = loader({}, { exports: null });
let pass = 0, fail = 0;
const J = (x) => JSON.stringify(x);
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log("FAIL: " + msg); } }
function identity(s, a, msg) {
  const r = MTGCore.reduce(s, a), inv = MTGCore.invert(a, s), r2 = MTGCore.reduce(r, inv);
  ok(J(r2) === J(s), msg + " (undo)");
  ok(J(r) !== J(s), msg + " (changed)");
}
let s = MTGCore.init({ seats: 2, deckSize: 20 });
ok(MTGCore.zoneCount(s, 0, "library") === 20, "init library 20");
s = MTGCore.reduce(s, { t: "draw", seat: 0, count: 7 });
ok(MTGCore.zoneCount(s, 0, "hand") === 7, "draw 7");
ok(MTGCore.zoneCount(s, 0, "library") === 13, "library 13");
s = MTGCore.reduce(s, { t: "card_move", instanceId: "s0c0", toZone: "battlefield", x: 10, y: 20 });
s = MTGCore.reduce(s, { t: "card_move", instanceId: "s0c1", toZone: "battlefield", x: 30, y: 40 });
s = MTGCore.reduce(s, { t: "card_tap", instanceId: "s0c0", tapped: true });
const S = s;
const libIds = MTGCore.cardsOf(S, 0, "library").map((c) => c.instanceId);
identity(S, { t: "draw", seat: 0, count: 3 }, "draw");
identity(S, { t: "mill", seat: 0, count: 2 }, "mill");
identity(S, { t: "card_move", instanceId: "s0c2", toZone: "battlefield", x: 50, y: 60 }, "move->bf");
identity(S, { t: "card_move", instanceId: "s0c0", toZone: "graveyard" }, "move->gy");
identity(S, { t: "card_tap", instanceId: "s0c1" }, "tap");
identity(S, { t: "card_tap_many", instanceIds: ["s0c0", "s0c1"], tapped: false }, "tap_many");
identity(S, { t: "untap_all", seat: 0 }, "untap_all");
identity(S, { t: "card_counter", instanceId: "s0c0", kind: "+1/+1", delta: 2 }, "card_counter");
identity(S, { t: "player_counter", seat: 0, kind: "poison", delta: 3 }, "player_counter");
identity(S, { t: "commander_damage", seat: 0, fromSeat: 1, fromCmd: "primary", delta: 7 }, "commander_damage");
identity(S, { t: "card_flip", instanceId: "s0c0" }, "flip");
identity(S, { t: "card_transform", instanceId: "s0c0" }, "transform");
identity(S, { t: "card_phase", instanceId: "s0c0" }, "phase");
identity(S, { t: "card_combat", instanceId: "s0c0" }, "card_combat");
identity(S, { t: "card_attach", instanceId: "s0c1", attachedTo: "s0c0", attachOrder: 0 }, "attach");
identity(S, { t: "token_create", instanceId: "tok1", ownerSeat: 0, name: "Treasure", x: 5, y: 5 }, "token");
identity(S, { t: "card_clone", fromId: "s0c0", instanceId: "clone1", x: 70, y: 70 }, "clone");
identity(S, { t: "library_shuffle", seat: 0, seed: "abc" }, "shuffle");
identity(S, { t: "library_scry", seat: 0, order: [libIds[2], libIds[0], libIds[1]] }, "scry");
identity(S, { t: "reveal", instanceIds: ["s0c0"], toSeats: [1] }, "reveal");
identity(S, { t: "card_setart", instanceId: "s0c0", setCode: "lea", collectorNumber: "1", isFoil: true }, "setart");
identity(S, { t: "set_life", seat: 0, value: 33 }, "set_life");
identity(S, { t: "adjust_life", seat: 0, delta: -5 }, "adjust_life");
identity(S, { t: "pass_turn" }, "pass_turn");
identity(S, { t: "set_phase", phase: "combat" }, "set_phase");
identity(S, { t: "annotation_create", id: "an1", kind: "label", x: 1, y: 2, text: "note" }, "annotation");
var S2 = MTGCore.reduce(S, { t: "annotation_create", id: "an2", kind: "counter", x: 5, y: 5, value: 0 });
identity(S2, { t: "annotation_move", id: "an2", x: 30, y: 40 }, "annotation_move");
identity(S2, { t: "annotation_update", id: "an2", value: 3 }, "annotation_update");
identity(S2, { t: "annotation_delete", id: "an2" }, "annotation_delete");
ok(J(MTGCore.reduce(S, { t: "unknown_x" })) === J(S), "unknown no-op");
ok(J(MTGCore.shuffle([1, 2, 3, 4, 5], "seed")) === J(MTGCore.shuffle([1, 2, 3, 4, 5], "seed")), "shuffle deterministic");

// regression: __remove invert re-adds the removed card (undoing a token cease-to-exist SBA)
var Stok = MTGCore.reduce(S, { t: "token_create", instanceId: "tokRm", ownerSeat: 0, name: "Goblin", x: 5, y: 5 });
identity(Stok, { t: "__remove", ids: ["tokRm"] }, "__remove restores card");
ok(!MTGCore.reduce(Stok, { t: "__remove", ids: ["tokRm"] }).cards["tokRm"], "__remove deletes card");

// regression: untap_all clears the 'attacking' flag (and its invert restores it)
var Satk = MTGCore.reduce(S, { t: "card_combat", instanceId: "s0c1", attacking: true });
ok(Satk.cards["s0c1"].attacking === true, "attacking flag set");
var Suntap = MTGCore.reduce(Satk, { t: "untap_all", seat: 0 });
ok(!Suntap.cards["s0c1"].attacking, "untap_all clears attacking");
identity(Satk, { t: "untap_all", seat: 0 }, "untap_all restores attacking on undo");

// batch: applies sub-actions in order as ONE action, and one invert restores everything
var batchA = { t: "batch", actions: [
  { t: "commander_damage", seat: 0, fromSeat: 1, fromCmd: "primary", delta: 3 },
  { t: "adjust_life", seat: 0, delta: -3 },
] };
var Sb = MTGCore.reduce(S, batchA);
ok(Sb.players[0].cmdDamage["1:primary"] === 3, "batch applies commander damage");
ok(Sb.players[0].life === S.players[0].life - 3, "batch applies life loss");
identity(S, batchA, "batch atomic undo (cmd dmg + life)");
// batch with partner key
identity(S, { t: "batch", actions: [
  { t: "commander_damage", seat: 0, fromSeat: 1, fromCmd: "partner", delta: 2 },
  { t: "adjust_life", seat: 0, delta: -2 },
] }, "batch atomic undo (partner key)");

// commander damage clamps at 0 (no negative totals), and undo still restores exactly
var Scd = MTGCore.reduce(S, { t: "commander_damage", seat: 0, fromSeat: 1, fromCmd: "primary", delta: 5 });
var Sneg = MTGCore.reduce(Scd, { t: "commander_damage", seat: 0, fromSeat: 1, fromCmd: "primary", delta: -9 });
ok(!Sneg.players[0].cmdDamage["1:primary"], "cmd damage clamped at 0 (key removed)");
identity(Scd, { t: "commander_damage", seat: 0, fromSeat: 1, fromCmd: "primary", delta: -9 }, "clamped cmd damage undo is exact");
// partner keys accumulate independently
var Sp = MTGCore.reduce(Scd, { t: "commander_damage", seat: 0, fromSeat: 1, fromCmd: "partner", delta: 4 });
ok(Sp.players[0].cmdDamage["1:primary"] === 5 && Sp.players[0].cmdDamage["1:partner"] === 4, "partner damage tracked separately");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
