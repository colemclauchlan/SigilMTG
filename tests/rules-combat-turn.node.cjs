// Integration test for rules-combat-turn.js — applying combat to the engine board.
// No DOM, no network. Run: node tests/rules-combat-turn.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-combat.js", "MTGRulesCombat");
const CT = loadInto(G, "rules-combat-turn.js", "MTGCombatTurn");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("Trampler", { types: ["creature"], subtypes: ["beast"], colors: ["G"], power: 3, toughness: 3, abilities: ["trample"] });

function game(d0, d1) { return E.create({ seats: 2, startingLife: 40, seed: "ct", decks: [d0, d1 || [{ instanceId: "z", name: "Plains", zone: "library" }]] }); }
const bears = (id) => ({ instanceId: id, name: "Grizzly Bears", zone: "battlefield" });

// --- unblocked attacker ---
(function () {
  let s = game([bears("a")]);
  ok(CT.declareAllAttackers(s, 0).length === 1, "declareAllAttackers: 1 untapped creature");
  s = CT.runCombat(E, s, 1, [{ attacker: "a", blockers: [] }]);
  ok(s.game.cards["a"].tapped === true, "unblocked: attacker is tapped");
  ok(s.game.players[1].life === 38, "unblocked: defender took 2 (40 -> 38)");
})();

// --- trade: 2/2 vs 2/2 ---
(function () {
  let s = game([bears("a")], [bears("b")]);
  s = CT.runCombat(E, s, 1, [{ attacker: "a", blockers: ["b"] }]);
  ok(s.game.cards["a"].zone === "graveyard" && s.game.cards["b"].zone === "graveyard", "trade: both creatures die");
  ok(s.game.players[1].life === 40, "trade: no damage to the defender");
})();

// --- trample over a blocker ---
(function () {
  let s = game([{ instanceId: "t", name: "Trampler", zone: "battlefield" }], [bears("b")]);
  s = CT.runCombat(E, s, 1, [{ attacker: "t", blockers: ["b"] }]);
  ok(s.game.cards["b"].zone === "graveyard", "trample: blocker dies");
  ok(s.game.players[1].life === 39, "trample: 1 damage tramples through (40 -> 39)");
  ok(s.game.cards["t"].zone === "battlefield", "trample: attacker survives");
  ok((s.game.cards["t"].counters || {}).damage === 2, "trample: surviving attacker has 2 marked damage");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
