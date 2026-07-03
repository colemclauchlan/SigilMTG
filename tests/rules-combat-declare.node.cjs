// Integration test for rules-combat-declare.js — rules-correct attack/block declaration.
// No DOM, no network. Run: node tests/rules-combat-declare.node.cjs

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
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-combat.js", "MTGRulesCombat");
loadInto(G, "rules-blocking.js", "MTGRulesBlocking");
loadInto(G, "rules-evasion.js", "MTGRulesEvasion");
const Sick = loadInto(G, "rules-sickness.js", "MTGRulesSickness");
const D = loadInto(G, "rules-combat-declare.js", "MTGCombatDeclare");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Hasty", { types: ["creature"], power: 2, toughness: 2, abilities: ["haste"] });
Cards.define("Flyer", { types: ["creature"], power: 2, toughness: 2, abilities: ["flying"] });
Cards.define("Ground", { types: ["creature"], power: 3, toughness: 3 });

// sickness gates attackers: a just-entered Bear can't attack, a Hasty can
(function () {
  let s = E.create({ seats: 2, decks: [[{ instanceId: "bear", name: "Bear", zone: "battlefield" }, { instanceId: "hasty", name: "Hasty", zone: "battlefield" }], [{ instanceId: "z", name: "Forest", zone: "library" }]] });
  s = Sick.markSick(E, s, "bear"); s = Sick.markSick(E, s, "hasty");
  const atk = D.declareAttackers(s.game, 0, {}).map(function (p) { return p.attacker; });
  ok(atk.indexOf("hasty") >= 0 && atk.indexOf("bear") < 0, "declareAttackers: haste attacks, summoning-sick does not");
  // after untap, the Bear can attack
  s = Sick.clearSickness(E, s, 0);
  ok(D.declareAttackers(s.game, 0, {}).length === 2, "after untap, both can attack");
})();

// evasion strips an illegal block: a Flyer can't be blocked by a Ground creature
(function () {
  let s = E.create({ seats: 2, decks: [[{ instanceId: "f", name: "Flyer", zone: "battlefield" }], [{ instanceId: "g", name: "Ground", zone: "battlefield" }, { instanceId: "z2", name: "Forest", zone: "library" }]] });
  const plan = D.declareBlocks(s.game, 1, [{ attacker: "f", blockers: [] }], {});
  ok(plan[0].blockers.length === 0, "declareBlocks: a ground creature cannot block the flyer (left unblocked)");
})();

// a ground attacker IS blocked by the ground creature
(function () {
  let s = E.create({ seats: 2, decks: [[{ instanceId: "a", name: "Bear", zone: "battlefield" }], [{ instanceId: "g", name: "Ground", zone: "battlefield" }, { instanceId: "z3", name: "Forest", zone: "library" }]] });
  const plan = D.declareBlocks(s.game, 1, [{ attacker: "a", blockers: [] }], {});
  ok(plan[0].blockers.length === 1 && plan[0].blockers[0] === "g", "declareBlocks: the 3/3 legally blocks the ground 2/2");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
