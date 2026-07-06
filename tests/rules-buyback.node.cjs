// Test for rules-buyback.js — buyback (CR 702.27): pay the extra buyback cost, and the spell returns
// to hand on resolution instead of the graveyard. Pure.
// Run: node tests/rules-buyback.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const BB = loadInto(G, "rules-buyback.js", "MTGRulesBuyback");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Recur", { types: ["instant"], colors: ["U"], mana: { generic: 1, U: 1 }, buyback: { generic: 3 }, spell: { draw: 1 } });
Cards.define("Plain", { types: ["instant"], mana: { U: 1 }, spell: { draw: 1 } }); // no buyback

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "rc", name: "Recur", zone: "hand" }], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}

// 1) buyback cost detection
ok(BB.buybackCost(Cards.get("Recur")).generic === 3, "buybackCost returns the cost");
ok(BB.buybackCost(Cards.get("Plain")) === null, "no buyback -> null");

// 2) canBuyback needs the buyback cost payable ({3})
ok(BB.canBuyback(build(3), "rc", 0, {}).ok === true, "can buyback with {3} available");
ok(/cannot pay/.test(BB.canBuyback(build(1), "rc", 0, {}).reason), "only {1} -> can't pay buyback");
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "pl", name: "Plain", zone: "hand" }], []] });
  ok(/no buyback/.test(BB.canBuyback(g, "pl", 0, {}).reason), "card without buyback -> rejected");
})();
(function () {
  let g = build(3); g = Core.reduce(g, { t: "card_move", instanceId: "rc", toZone: "graveyard" });
  ok(/from your hand/.test(BB.canBuyback(g, "rc", 0, {}).reason), "not in hand -> rejected");
})();

// 3) castWithBuybackEvents: pays {3}, hand -> stack, flags boughtBack
(function () {
  let g = build(3);
  g = apply(g, BB.castWithBuybackEvents(g, "rc", {}));
  ok(g.cards["rc"].zone === "stack", "spell on the stack");
  ok(g.cards["rc"].boughtBack === true, "flagged boughtBack");
  ok((g.players[0].counters.mana_C || 0) === 0, "buyback cost {3} paid");
})();

// 4) resolveBuybackEvents: a bought-back spell returns to hand (not graveyard)
(function () {
  let g = build(3);
  g = apply(g, BB.castWithBuybackEvents(g, "rc", {}));
  g = apply(g, BB.resolveBuybackEvents(g, "rc"));
  ok(g.cards["rc"].zone === "hand", "bought-back spell returns to hand");
  ok(g.cards["rc"].boughtBack === false, "boughtBack flag cleared");
})();

// 5) a spell cast WITHOUT buyback isn't returned by this module
(function () {
  let g = build(0); g = Core.reduce(g, { t: "card_move", instanceId: "rc", toZone: "stack" });
  ok(BB.resolveBuybackEvents(g, "rc").length === 0, "not bought back -> no return-to-hand events");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
