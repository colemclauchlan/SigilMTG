// Integration test for rules-combat-keywords.js — lifelink in combat.
// No DOM, no network. Run: node tests/rules-combat-keywords.node.cjs

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
loadInto(G, "rules-combat-turn.js", "MTGCombatTurn");
const Lib = loadInto(G, "card-library.js", "MTGCardLibrary");
const KW = loadInto(G, "rules-combat-keywords.js", "MTGCombatKeywords");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Lib.register(Cards); // Vampire Nighthawk (2/3 flying deathtouch lifelink), Grizzly Bears, etc.

const game = (d0, d1) => E.create({ seats: 2, startingLife: 40, seed: "kw", decks: [d0, d1] });
const bf = (id, name) => ({ instanceId: id, name, zone: "battlefield" });

// unblocked lifelinker: defender loses life, attacker's controller gains it
(function () {
  let s = game([bf("vn", "Vampire Nighthawk")], [{ instanceId: "z", name: "Forest", zone: "library" }]);
  s = KW.runCombatKW(E, s, 1, [{ attacker: "vn", blockers: [] }]);
  ok(s.game.players[1].life === 38, "lifelink unblocked: defender 40 -> 38");
  ok(s.game.players[0].life === 42, "lifelink unblocked: attacker's controller 40 -> 42");
  ok(s.game.cards["vn"].tapped === true, "attacker tapped");
})();

// lifelink (+ deathtouch) blocker: kills the attacker and gains its controller life
(function () {
  let s = game([bf("a", "Grizzly Bears")], [bf("vn", "Vampire Nighthawk")]);
  s = KW.runCombatKW(E, s, 1, [{ attacker: "a", blockers: ["vn"] }]);
  ok(s.game.cards["a"].zone === "graveyard", "deathtouch blocker killed the attacker");
  ok(s.game.cards["vn"].zone === "battlefield", "the 2/3 blocker survived 2 damage");
  ok(s.game.players[1].life === 42, "lifelink blocker: its controller 40 -> 42");
  ok((s.game.cards["vn"].counters || {}).damage === 2, "blocker has 2 marked damage");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
