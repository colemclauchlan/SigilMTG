// Test for rules-affinity.js — "affinity for artifacts": generic cost reduction per artifact controlled.
// No DOM, no network. Run: node tests/rules-affinity.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const A = loadInto(G, "rules-affinity.js", "MTGRulesAffinity");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Ornithopter", { types: ["artifact", "creature"], colors: [], power: 0, toughness: 2 });
Cards.define("Mox", { types: ["artifact"], colors: [], produces: "C" });
Cards.define("Frogmite", { types: ["artifact", "creature"], colors: [], power: 2, toughness: 2, mana: { generic: 4 } });
Cards.define("Bearish", { types: ["creature"], colors: ["G"], power: 2, toughness: 2 });

const bf = (id, name, seat, zone) => ({ instanceId: id, name: name, zone: zone || "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) count artifacts you control
(function () {
  const g = game({ a1: bf("a1", "Ornithopter", 0), a2: bf("a2", "Mox", 0), nope: bf("nope", "Bearish", 0) });
  ok(A.affinityCount(g, 0, "artifact", {}) === 2, "counts 2 artifacts (non-artifact ignored)");
})();

// 2) artifacts an OPPONENT controls don't count
(function () {
  const g = game({ a1: bf("a1", "Mox", 0), opp: bf("opp", "Mox", 1) });
  ok(A.affinityCount(g, 0, "artifact", {}) === 1, "opponent's artifact excluded");
})();

// 3) only battlefield artifacts count (graveyard ignored)
(function () {
  const g = game({ a1: bf("a1", "Mox", 0), dead: bf("dead", "Mox", 0, "graveyard") });
  ok(A.affinityCount(g, 0, "artifact", {}) === 1, "graveyard artifact excluded");
})();

// 4) reducedCost subtracts from generic only, colored pip untouched
(function () {
  const out = A.reducedCost({ generic: 4, U: 1 }, 3);
  ok(out.generic === 1 && out.U === 1, "generic reduced by 3, U pip kept");
})();

// 5) EDGE: reduction can't push generic below 0
(function () {
  const out = A.reducedCost({ generic: 4 }, 5);
  ok(out.generic === 0, "generic clamps at 0, never negative");
})();

// 6) default kind is "artifact" when omitted
(function () {
  const g = game({ a1: bf("a1", "Mox", 0), a2: bf("a2", "Ornithopter", 0) });
  ok(A.affinityCount(g, 0, undefined, {}) === 2, "kind defaults to artifact");
})();

// 7) full flow: Frogmite costs 4 generic; cast it while controlling 2 artifacts (the spell isn't on the
//    battlefield yet, so it doesn't count itself) -> reduced to 2 generic
(function () {
  const g = game({ f: bf("f", "Frogmite", 0, "stack"), a1: bf("a1", "Mox", 0), a2: bf("a2", "Ornithopter", 0) });
  const n = A.affinityCount(g, 0, "artifact", {});
  const cost = A.reducedCost({ generic: 4 }, n);
  ok(n === 2 && J(cost) === J({ generic: 2 }), "Frogmite 4 generic minus 2 controlled artifacts = 2");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
