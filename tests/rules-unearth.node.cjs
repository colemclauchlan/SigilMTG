// Test for rules-unearth.js — return from graveyard with haste; exile on leave / at next end step. Pure.
// Run: node tests/rules-unearth.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const U = loadInto(G, "rules-unearth.js", "MTGRulesUnearth");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Unearth Fiend", { types: ["creature"], colors: ["B"], mana: { generic: 2, B: 1 }, power: 3, toughness: 1, unearth: { B: 1 } });
Cards.define("Stuck Bear", { types: ["creature"], colors: ["G"], mana: { G: 1 }, power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(name, zone, mana) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "u", name: name, zone: zone || "graveyard" }], []] });
  if (mana) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_B", delta: mana });
  return g;
}

// 1) unearthCost / canUnearth legality
(function () {
  ok(J(U.unearthCost(Cards.get("Unearth Fiend"))) === J({ B: 1 }), "reads the unearth cost");
  ok(U.canUnearth(build("Unearth Fiend", "graveyard", 1), "u", {}).ok === true, "can unearth from graveyard with {B}");
  ok(U.canUnearth(build("Unearth Fiend", "graveyard", 0), "u", {}).ok === false, "can't unearth with no mana");
  ok(/graveyard/.test(U.canUnearth(build("Unearth Fiend", "hand", 1), "u", {}).reason), "unearth only works from the graveyard");
  ok(/no unearth cost/.test(U.canUnearth(build("Stuck Bear", "graveyard", 1), "u", {}).reason), "a creature without unearth can't be unearthed");
})();

// 2) unearth pays, returns to battlefield, flags unearthed, hasty
(function () {
  let g = build("Unearth Fiend", "graveyard", 1);
  g = apply(g, U.unearth(g, "u", {}));
  ok(g.cards["u"].zone === "battlefield", "the unearthed creature returns to the battlefield");
  ok(g.cards["u"].unearthed === true, "it is flagged unearthed");
  ok(U.isUnearthed(g, "u") === true && U.hasHaste(g, "u") === true, "isUnearthed + hasHaste true");
  ok((g.players[0].counters.mana_B || 0) === 0, "the {B} unearth cost was paid");
})();

// 3) replaceLeave redirects a non-exile departure to exile
(function () {
  let g = build("Unearth Fiend", "graveyard", 1);
  g = apply(g, U.unearth(g, "u", {}));
  ok(J(U.replaceLeave(g, "u", "graveyard")) === J({ t: "card_move", instanceId: "u", toZone: "exile" }), "dying redirects to exile");
  ok(J(U.replaceLeave(g, "u", "hand")) === J({ t: "card_move", instanceId: "u", toZone: "exile" }), "bouncing redirects to exile");
  ok(U.replaceLeave(g, "u", "exile") === null, "leaving to exile isn't redirected (no loop)");
  ok(U.replaceLeave(g, "u", "battlefield") === null, "staying on the battlefield isn't a departure");
})();

// 4) a non-unearthed permanent is never redirected
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "b", name: "Stuck Bear", zone: "battlefield" }], []] });
  ok(U.replaceLeave(g, "b", "graveyard") === null, "a normal creature dies to the graveyard as usual");
})();

// 5) endOfTurnEvents exiles every unearthed permanent
(function () {
  let g = build("Unearth Fiend", "graveyard", 1);
  g = apply(g, U.unearth(g, "u", {}));
  let eot = U.endOfTurnEvents(g, {});
  ok(eot.length === 1 && eot[0].toZone === "exile" && eot[0].instanceId === "u", "unearthed permanent is exiled at the end step");
  g = apply(g, eot);
  ok(g.cards["u"].zone === "exile", "after applying, the creature is exiled");
  ok(U.isUnearthed(g, "u") === false, "an exiled creature is no longer 'unearthed on the battlefield'");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
