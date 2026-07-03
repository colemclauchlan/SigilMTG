// Integration test for rules-combat-turn-fs.js — first/double-strike combat applied to the board.
// No DOM, no network. Run: node tests/rules-combat-turn-fs.node.cjs

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
loadInto(G, "rules-combat-fs.js", "MTGCombatFS");
loadInto(G, "rules-combat-turn.js", "MTGCombatTurn");
const CTF = loadInto(G, "rules-combat-turn-fs.js", "MTGCombatTurnFS");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("Knight", { types: ["creature"], subtypes: ["knight"], colors: ["W"], power: 2, toughness: 2, abilities: ["first strike"] });

function game(d0, d1) { return E.create({ seats: 2, startingLife: 40, seed: "ctf", decks: [d0, d1] }); }

// first striker vs a vanilla 2/2: the blocker dies, the attacker survives unscathed
(function () {
  let s = game([{ instanceId: "k", name: "Knight", zone: "battlefield" }], [{ instanceId: "b", name: "Grizzly Bears", zone: "battlefield" }]);
  s = CTF.runCombatFS(E, s, 1, [{ attacker: "k", blockers: ["b"] }]);
  ok(s.game.cards["b"].zone === "graveyard", "first strike: blocker dies");
  ok(s.game.cards["k"].zone === "battlefield", "first strike: attacker survives");
  ok(!(s.game.cards["k"].counters || {}).damage, "first strike: attacker has no marked damage");
  ok(s.game.cards["k"].tapped === true, "attacker is tapped from attacking");
})();

// contrast: a vanilla 2/2 vs 2/2 still trades (both die) under the same path
(function () {
  let s = game([{ instanceId: "a", name: "Grizzly Bears", zone: "battlefield" }], [{ instanceId: "b", name: "Grizzly Bears", zone: "battlefield" }]);
  s = CTF.runCombatFS(E, s, 1, [{ attacker: "a", blockers: ["b"] }]);
  ok(s.game.cards["a"].zone === "graveyard" && s.game.cards["b"].zone === "graveyard", "no first strike: both trade");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
