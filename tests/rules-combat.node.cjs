// Pure-module tests for rules-combat.js (Phase R4 combat damage system).
// No DOM, no network. Run: node tests/rules-combat.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const Cmb = loadInto({}, "rules-combat.js", "MTGRulesCombat");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function K(over) { return Object.assign({ id: "c", power: 2, toughness: 2, abilities: [], markedDamage: 0 }, over); }

// ---- isDead (state-based) ----
ok(Cmb.isDead(K({ toughness: 0 })) === true, "0 toughness -> dead");
ok(Cmb.isDead(K({ toughness: 2, markedDamage: 2 })) === true, "lethal marked damage -> dead");
ok(Cmb.isDead(K({ toughness: 2, markedDamage: 1 })) === false, "non-lethal marked damage -> alive");
ok(Cmb.isDead(K({ toughness: 5, markedDamage: 1, deathtouched: true })) === true, "deathtouched (any damage) -> dead");
ok(Cmb.isDead(K({ toughness: 5, markedDamage: 0 })) === false, "no damage -> alive");

// ---- unblocked ----
(function () {
  const r = Cmb.resolveAttack(K({ power: 2, toughness: 2 }), []);
  ok(r.trample === 2, "unblocked 2/2 -> 2 to the player");
  ok((r.attacker.markedDamage || 0) === 0, "unblocked attacker takes no damage");
})();

// ---- trade: 2/2 vs 2/2 ----
(function () {
  const r = Cmb.resolveAttack(K({ power: 2, toughness: 2 }), [K({ power: 2, toughness: 2 })]);
  ok(Cmb.isDead(r.attacker) && Cmb.isDead(r.blockers[0]), "2/2 vs 2/2 -> both die");
  ok(r.trample === 0, "no trample without the keyword");
})();

// ---- trample over a blocker ----
(function () {
  const r = Cmb.resolveAttack(K({ power: 3, toughness: 3, abilities: ["trample"] }), [K({ power: 2, toughness: 2 })]);
  ok(r.trample === 1, "3/3 trample vs 2/2 -> 1 tramples through");
  ok(Cmb.isDead(r.blockers[0]) && !Cmb.isDead(r.attacker), "blocker dies, attacker survives");
})();

// ---- deathtouch: 1 damage is lethal; attacker dies to the big blocker ----
(function () {
  const r = Cmb.resolveAttack(K({ power: 1, toughness: 1, abilities: ["deathtouch"] }), [K({ power: 5, toughness: 5 })]);
  ok(Cmb.isDead(r.blockers[0]), "deathtouch: 1/1 kills the 5/5 blocker");
  ok(Cmb.isDead(r.attacker), "attacker dies to the 5/5");
})();

// ---- deathtouch + trample: only 1 needed per blocker, rest tramples ----
(function () {
  const r = Cmb.resolveAttack(K({ power: 5, toughness: 5, abilities: ["deathtouch", "trample"] }), [K({ power: 5, toughness: 5 })]);
  ok(r.trample === 4, "deathtouch+trample 5/5 vs 5/5 -> 1 lethal, 4 trample");
  ok(Cmb.isDead(r.blockers[0]) && Cmb.isDead(r.attacker), "both die (blocker deathtouched, attacker took 5)");
})();

// ---- multi-block, no trample: leftover piles onto the last blocker ----
(function () {
  const r = Cmb.resolveAttack(K({ power: 4, toughness: 4 }), [K({ id: "b0", power: 1, toughness: 1 }), K({ id: "b1", power: 1, toughness: 1 })]);
  ok(Cmb.isDead(r.blockers[0]) && Cmb.isDead(r.blockers[1]), "4/4 vs two 1/1 -> both blockers die");
  ok(r.trample === 0, "no trample keyword -> 0 through even with leftover");
  ok((r.attacker.markedDamage || 0) === 2, "attacker takes 1+1 from the two blockers");
})();

// ---- multi-block with trample ----
(function () {
  const r = Cmb.resolveAttack(K({ power: 5, toughness: 5, abilities: ["trample"] }), [K({ power: 2, toughness: 2 }), K({ power: 2, toughness: 2 })]);
  ok(r.trample === 1, "5/5 trample vs two 2/2 -> 2+2 lethal, 1 tramples");
  ok(!Cmb.isDead(r.attacker), "attacker (5 toughness) survives 4 damage");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
