// Node test runner for combat-duel.js. Run: node tests/combat-duel.node.cjs
const required = require("../combat-duel.js");
// combat-duel.js prefers root.MTGDuel (browser global) and only falls through to module.exports
// when module.exports is falsy; grab whichever carries the API.
const D = (required && required.resolveDuel) ? required : globalThis.MTGDuel;
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log("FAIL: " + msg); } }

// has(): structured keywords are authoritative
ok(D._has({ keywords: ["Trample"] }, "trample") === true, "keyword array grants trample");
ok(D._has({ keywords: ["Flying"] }, "trample") === false, "keyword array without trample -> false");
// when a keywords array is present, oracle text must NOT be consulted
ok(D._has({ keywords: ["Flying"], oracle: "This creature has trample." }, "trample") === false, "keywords array is authoritative over oracle");

// oracle fallback (no keyword data): self-keyword matches, granting phrasing does not
ok(D._has({ oracle: "Trample" }, "trample") === true, "oracle self-keyword -> true");
ok(D._has({ oracle: "Flying, trample" }, "trample") === true, "oracle keyword line -> true");
ok(D._has({ oracle: "Creatures you control have deathtouch." }, "deathtouch") === false, "granted 'have deathtouch' not self-applied");
ok(D._has({ oracle: "Target creature gains trample until end of turn." }, "trample") === false, "granted 'gains trample' not self-applied");

// resolveDuel: a genuine deathtouch creature kills a bigger one
var r1 = D.resolveDuel(
  { name: "DT", power: 2, toughness: 2, keywords: ["Deathtouch"] },
  { name: "Big", power: 5, toughness: 5, keywords: [] }
);
ok(r1.bDies === true, "deathtouch 2/2 kills 5/5");

// Ohran-Frostfang-style: 3/3 that GRANTS deathtouch (oracle text, no keyword) does NOT kill a 5/5 via 3 damage
var r2 = D.resolveDuel(
  { name: "Frost", power: 3, toughness: 3, keywords: [], oracle: "Creatures you control have deathtouch. Whenever a creature you control deals combat damage to a player, draw a card." },
  { name: "Wall", power: 0, toughness: 5, keywords: [] }
);
ok(r2.bDies === false, "granted-deathtouch creature does not falsely kill a 5-toughness blocker");

// ---- multi-blocker combat (resolveCombat): one attacker vs N blockers ----
function C(p, t, x) { return Object.assign({ power: p, toughness: t }, x || {}); }
function combat(a, b) { return D.resolveCombat(a, b); }
var rc;
rc = combat(C(4, 4), [C(2, 2), C(2, 2)]); ok(rc.attackerDies && rc.blockers[0].dies && rc.blockers[1].dies, "4/4 vs two 2/2: all die");
rc = combat(C(5, 5, { keywords: ["Trample"] }), [C(2, 2), C(2, 2)]); ok(!rc.attackerDies && rc.playerDamage === 1, "5/5 trample vs two 2/2: 1 tramples, attacker lives");
rc = combat(C(3, 3), [C(2, 2), C(2, 2)]); ok(rc.blockers[0].dies && !rc.blockers[1].dies, "3/3 vs two 2/2: ordered lethal — first dies, second lives");
rc = combat(C(3, 3, { keywords: ["Deathtouch"] }), [C(1, 1), C(1, 1), C(1, 1)]); ok(rc.blockers.every(function (b) { return b.dies; }), "deathtouch 3/3 vs three 1/1: all die");
rc = combat(C(3, 3, { keywords: ["Deathtouch", "Trample"] }), [C(2, 2), C(2, 2)]); ok(rc.blockers[0].dies && rc.blockers[1].dies && rc.playerDamage === 1, "deathtouch+trample: 1 lethal each, rest tramples");
rc = combat(C(4, 4, { keywords: ["First strike"] }), [C(2, 2), C(2, 2)]); ok(!rc.attackerDies && rc.blockers[0].dies && rc.blockers[1].dies, "first strike 4/4 kills both blockers unscathed");
rc = combat(C(1, 1, { keywords: ["Indestructible"] }), [C(5, 5), C(5, 5)]); ok(!rc.attackerDies, "indestructible attacker survives multiple blockers");
rc = combat(C(8, 8, { keywords: ["Trample"] }), [C(2, 2), C(2, 2)]); ok(rc.playerDamage === 4, "8/8 trample assigns 4 lethal, tramples 4");

// unblocked attackers + full multi-attacker combat
rc = combat(C(5, 5), []); ok(rc.playerDamage === 5, "unblocked 5/5 deals 5 to the player");
rc = combat(C(5, 5, { keywords: ["Trample"] }), []); ok(rc.playerDamage === 5, "unblocked trampler deals its full power");
var fc = D.resolveFullCombat([{ attacker: C(3, 3), blockers: [C(2, 2)] }, { attacker: C(4, 4), blockers: [] }]);
ok(fc.toPlayer === 4, "full combat: blocked 3/3 + unblocked 4/4 -> 4 to player");
var fc2 = D.resolveFullCombat([{ attacker: C(6, 6, { keywords: ["Trample"] }), blockers: [C(2, 2)] }, { attacker: C(2, 2), blockers: [] }]);
ok(fc2.toPlayer === 6, "full combat: 6/6 trample-over (4) + unblocked 2/2 (2) -> 6 to player");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
