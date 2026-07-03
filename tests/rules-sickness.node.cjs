// Integration test for rules-sickness.js — summoning sickness & canAttack.
// No DOM, no network. Run: node tests/rules-sickness.node.cjs

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
const Sick = loadInto(G, "rules-sickness.js", "MTGRulesSickness");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Hasty", { types: ["creature"], power: 2, toughness: 2, abilities: ["haste"] });
// a lord that grants haste to other creatures you control
Cards.define("Warchief", { types: ["creature"], subtypes: ["goblin"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["haste"] }] });

let s = E.create({ seats: 2, startingLife: 20, decks: [[{ instanceId: "bear", name: "Bear", zone: "battlefield" }, { instanceId: "hasty", name: "Hasty", zone: "battlefield" }], [{ instanceId: "z", name: "Forest", zone: "library" }]] });

// both just "entered" -> mark sick
s = Sick.markSick(E, s, "bear"); s = Sick.markSick(E, s, "hasty");
ok(Sick.isSick(s.game.cards["bear"]) === true, "Bear is summoning sick after entering");
ok(Sick.canAttack(s.game, "bear", {}) === false, "a summoning-sick creature can't attack");
ok(Sick.canAttack(s.game, "hasty", {}) === true, "a haste creature can attack despite sickness");

// controller's untap clears sickness
s = Sick.clearSickness(E, s, 0);
ok(Sick.isSick(s.game.cards["bear"]) === false, "untap clears summoning sickness");
ok(Sick.canAttack(s.game, "bear", {}) === true, "after its controller's untap, Bear can attack");

// a tapped creature can't attack
(function () {
  let s2 = E.dispatch(s, { t: "card_tap", instanceId: "bear", tapped: true });
  ok(Sick.canAttack(s2.game, "bear", {}) === false, "a tapped creature can't attack");
})();

// granted haste lets a sick creature attack
(function () {
  let s3 = E.create({ seats: 2, decks: [[{ instanceId: "wc", name: "Warchief", zone: "battlefield" }, { instanceId: "b2", name: "Bear", zone: "battlefield" }], [{ instanceId: "z2", name: "Forest", zone: "library" }]] });
  s3 = Sick.markSick(E, s3, "b2");
  ok(Sick.canAttack(s3.game, "b2", {}) === true, "a creature granted haste by a lord can attack while sick");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
