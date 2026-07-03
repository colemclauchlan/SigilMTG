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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
