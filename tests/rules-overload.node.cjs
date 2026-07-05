// Test for rules-overload.js — overload (CR 702.96): cast for the overload cost, set the `overloaded`
// flag so the resolver switches "target" to "each". Pure.
// Run: node tests/rules-overload.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const OV = loadInto(G, "rules-overload.js", "MTGRulesOverload");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

// Cyclonic Rift: normal {1}{U}, overload {6}{U}.
Cards.define("CyclonicRift", { types: ["instant"], colors: ["U"], mana: { generic: 1, U: 1 }, overload: { generic: 6, U: 1 }, spell: { bounce: true, target: "permanent" } });
Cards.define("Shock", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 2, target: "any" } }); // no overload

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC, manaU) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "cr", name: "CyclonicRift", zone: "hand" }], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaU) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_U", delta: manaU });
  return g;
}

// 1) overloadCost detection
ok(OV.overloadCost(Cards.get("CyclonicRift")).generic === 6, "overloadCost returns the overload cost");
ok(OV.overloadCost(Cards.get("Shock")) === null, "no overload -> null");

// 2) canOverload needs the full {6}{U} available
ok(OV.canOverload(build(6, 1), "cr", 0, {}).ok === true, "can overload with {6}{U} available");
ok(OV.canOverload(build(1, 1), "cr", 0, {}).ok === false, "only {1}{U} -> can't pay overload");
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sh", name: "Shock", zone: "hand" }], []] });
  ok(/no overload/.test(OV.canOverload(g, "sh", 0, {}).reason), "card without overload -> rejected");
})();
(function () {
  let g = build(6, 1); g = Core.reduce(g, { t: "card_move", instanceId: "cr", toZone: "exile" });
  ok(/from your hand/.test(OV.canOverload(g, "cr", 0, {}).reason), "not in hand -> rejected");
})();

// 3) overloadEvents: pays {6}{U}, moves hand -> stack, sets the overloaded flag
(function () {
  let g = build(6, 1);
  g = apply(g, OV.overloadEvents(g, "cr", {}));
  ok(g.cards["cr"].zone === "stack", "overloaded spell is on the stack");
  ok(g.cards["cr"].overloaded === true, "flagged overloaded");
  ok(OV.isOverloaded(g, "cr") === true, "isOverloaded true");
  ok((g.players[0].counters.mana_C || 0) === 0 && (g.players[0].counters.mana_U || 0) === 0, "overload cost {6}{U} paid");
})();

// 4) a spell not cast overloaded is not flagged
ok(OV.isOverloaded(build(6, 1), "cr") === false, "unresolved/normal cast -> not overloaded");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
