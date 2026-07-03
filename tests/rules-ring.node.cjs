// Test for rules-ring.js — the Ring tempts you: escalating levels + Ring-bearer. Pure.
// Run: node tests/rules-ring.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const R = loadInto(G, "rules-ring.js", "MTGRulesRing");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() { return Core.init({ seats: 2, startingLife: 20 }); }

// 1) first temptation -> level 1, a Ring-bearer, one ability
(function () {
  let g = build();
  ok(R.ringLevel(g, 0) === 0 && R.ringBearer(g, 0) === null, "no Ring temptation initially");
  g = apply(g, R.tempt(g, 0, "hero"));
  ok(R.ringLevel(g, 0) === 1, "tempted once -> level 1");
  ok(R.ringBearer(g, 0) === "hero", "the Ring-bearer is set");
  ok(R.abilitiesAt(1).length === 1, "level 1 grants one Ring ability");
})();

// 2) abilities accumulate as the Ring tempts further
(function () {
  let g = build();
  g = apply(g, R.tempt(g, 0, "hero"));
  g = apply(g, R.tempt(g, 0, "hero"));
  ok(R.ringLevel(g, 0) === 2 && R.abilitiesAt(R.ringLevel(g, 0)).length === 2, "level 2 grants two abilities");
})();

// 3) the level caps at 4
(function () {
  let g = build();
  for (let i = 0; i < 6; i++) g = apply(g, R.tempt(g, 0, "hero"));
  ok(R.ringLevel(g, 0) === 4, "the Ring's temptation caps at level 4");
  ok(R.abilitiesAt(99).length === 4, "there are exactly four Ring abilities");
})();

// 4) the Ring-bearer can change on a later temptation
(function () {
  let g = build();
  g = apply(g, R.tempt(g, 0, "hero"));
  g = apply(g, R.tempt(g, 0, "champion"));
  ok(R.ringBearer(g, 0) === "champion" && R.ringLevel(g, 0) === 2, "a new Ring-bearer chosen at level 2");
  ok(R.ringBearer(g, 1) === null, "the opponent has no Ring temptation");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
