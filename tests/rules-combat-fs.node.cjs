// Pure-module test for rules-combat-fs.js (first/double-strike two-step combat).
// No DOM, no network. Run: node tests/rules-combat-fs.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
const Comb = loadInto(G, "rules-combat.js", "MTGRulesCombat");
const FS = loadInto(G, "rules-combat-fs.js", "MTGCombatFS");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function K(over) { return Object.assign({ id: "c", power: 2, toughness: 2, abilities: [], markedDamage: 0 }, over); }

// no first strike anywhere -> same as a single simultaneous step (both 2/2 trade)
(function () {
  const r = FS.resolveCombatFS(K({ id: "a", power: 2, toughness: 2 }), [K({ id: "b", power: 2, toughness: 2 })]);
  ok(Comb.isDead(r.attacker) && Comb.isDead(r.blockers[0]), "no FS: 2/2 vs 2/2 -> both die");
})();

// first strike: attacker kills the blocker before it can deal back
(function () {
  const r = FS.resolveCombatFS(K({ id: "a", power: 2, toughness: 2, abilities: ["first strike"] }), [K({ id: "b", power: 2, toughness: 2 })]);
  ok(Comb.isDead(r.blockers[0]), "first strike: blocker dies in the first step");
  ok(!Comb.isDead(r.attacker) && (r.attacker.markedDamage || 0) === 0, "first strike: attacker takes no damage back");
})();

// first strike does NOT save the attacker from a bigger blocker (1/1 FS vs 5/5: blocker survives, kills attacker in regular step)
(function () {
  const r = FS.resolveCombatFS(K({ id: "a", power: 1, toughness: 1, abilities: ["first strike"] }), [K({ id: "b", power: 5, toughness: 5 })]);
  ok(!Comb.isDead(r.blockers[0]), "FS 1/1 vs 5/5: blocker survives the 1 first-strike damage");
  ok(Comb.isDead(r.attacker), "FS 1/1 vs 5/5: blocker kills the attacker in the regular step");
})();

// first strike + deathtouch: 1 first-strike damage is lethal, attacker survives
(function () {
  const r = FS.resolveCombatFS(K({ id: "a", power: 1, toughness: 1, abilities: ["first strike", "deathtouch"] }), [K({ id: "b", power: 5, toughness: 5 })]);
  ok(Comb.isDead(r.blockers[0]), "FS+deathtouch: blocker dies to 1 damage in the first step");
  ok(!Comb.isDead(r.attacker), "FS+deathtouch: attacker survives (blocker dealt nothing)");
})();

// double strike: deals in both steps. 3/3 DS vs 3/3 -> kills in first step, takes nothing back
(function () {
  const r = FS.resolveCombatFS(K({ id: "a", power: 3, toughness: 3, abilities: ["double strike"] }), [K({ id: "b", power: 3, toughness: 3 })]);
  ok(Comb.isDead(r.blockers[0]), "double strike: blocker dies in the first step");
  ok(!Comb.isDead(r.attacker), "double strike: attacker survives unscathed");
})();

// double strike vs a big blocker: deals 2+2=4, blocker (5 tough) survives, attacker dies to the 5
(function () {
  const r = FS.resolveCombatFS(K({ id: "a", power: 2, toughness: 2, abilities: ["double strike"] }), [K({ id: "b", power: 5, toughness: 5 })]);
  ok((r.blockers[0].markedDamage || 0) === 4, "double strike: blocker took 4 (2 per step)");
  ok(!Comb.isDead(r.blockers[0]) && Comb.isDead(r.attacker), "double strike: blocker survives, attacker dies");
})();

// double strike + trample over a small blocker: 1 lethal in step1 + trample; step2 blocker dead -> full power tramples
(function () {
  const r = FS.resolveCombatFS(K({ id: "a", power: 2, toughness: 2, abilities: ["double strike", "trample"] }), [K({ id: "b", power: 1, toughness: 1 })]);
  ok(Comb.isDead(r.blockers[0]), "DS+trample: blocker dies");
  ok(r.trample === 3, "DS+trample 2/2 vs 1/1: 1 (lethal+0 trample step1) ... total 3 tramples over two steps");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
