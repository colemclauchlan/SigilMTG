// Test for rules-resources.js — energy/experience resource counters: gain, pay, threshold. Pure.
// Run: node tests/rules-resources.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const R = loadInto(G, "rules-resources.js", "MTGRulesResources");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() { return Core.init({ seats: 2, startingLife: 20 }); }

// 1) gain and read energy
(function () {
  let g = build();
  g = apply(g, R.gain(0, "energy", 3));
  ok(R.get(g, 0, "energy") === 3, "gained 3 energy");
})();

// 2) pay energy with a legality check
(function () {
  let g = apply(build(), R.gain(0, "energy", 3));
  ok(R.canPay(g, 0, "energy", 2) === true, "can pay 2 of 3 energy");
  ok(R.canPay(g, 0, "energy", 5) === false, "can't pay 5 of 3 energy");
  g = apply(g, R.pay(0, "energy", 2));
  ok(R.get(g, 0, "energy") === 1, "after paying 2, 1 energy remains");
})();

// 3) experience counters accrue (and aren't spent)
(function () {
  let g = build();
  g = apply(g, R.gain(0, "experience", 1));
  g = apply(g, R.gain(0, "experience", 1));
  ok(R.get(g, 0, "experience") === 2, "two experience counters");
})();

// 4) pool snapshot of a player's resources
(function () {
  let g = build();
  g = apply(g, R.gain(0, "energy", 4).concat(R.gain(0, "experience", 1)).concat(R.gain(0, "poison", 2)));
  ok(J(R.pool(g, 0)) === J({ energy: 4, experience: 1, poison: 2 }), "pool = {energy:4, experience:1, poison:2}");
  ok(J(R.pool(g, 1)) === J({ energy: 0, experience: 0, poison: 0 }), "the opponent has no resources");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
