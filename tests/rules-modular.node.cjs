// Test for rules-modular.js — enters with N +1/+1; on death moves its +1/+1 counters to an artifact creature.
// No DOM, no network, no engine-core needed. Run: node tests/rules-modular.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const Mod = loadInto(G, "rules-modular.js", "MTGRulesModular");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
const find = (out, instanceId) => (out || []).find((e) => e.instanceId === instanceId);

Cards.define("Arcbound", { types: ["artifact", "creature"], power: 0, toughness: 0, abilities: ["modular"] });
Cards.define("Steel Wall", { types: ["artifact", "creature"], power: 0, toughness: 4 });
Cards.define("Plain Bear", { types: ["creature"], power: 2, toughness: 2 });

const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: counters || {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) modularEnter(N) -> a single +1/+1 counter event of delta N
(function () {
  const out = Mod.modularEnter(3);
  ok(out.length === 1 && out[0].kind === "+1/+1" && out[0].delta === 3, "modularEnter(3) places three +1/+1");
})();

// 2) modularEnter(0) -> no event [EDGE]
(function () {
  ok(J(Mod.modularEnter(0)) === J([]), "modularEnter(0) -> no counters");
})();

// 3) plusCounters reads the map
(function () {
  const g = game({ a: bf("a", "Arcbound", 0, { "+1/+1": 3 }) });
  ok(Mod.plusCounters(g, "a") === 3, "plusCounters reads +1/+1 count");
})();

// 4) on death -> move ALL of its +1/+1 counters onto a target artifact creature
(function () {
  const g = game({ a: bf("a", "Arcbound", 0, { "+1/+1": 3 }), w: bf("w", "Steel Wall", 0) });
  const out = Mod.modularOnDeath(g, "a", "w", {});
  ok(find(out, "a") && find(out, "a").delta === -3, "source loses its 3 counters");
  ok(find(out, "w") && find(out, "w").delta === 3, "target gains 3 counters");
})();

// 5) moves the EXACT current count, even above printed N (gained extra counters)
(function () {
  const g = game({ a: bf("a", "Arcbound", 0, { "+1/+1": 5 }), w: bf("w", "Steel Wall", 0) });
  const out = Mod.modularOnDeath(g, "a", "w", {});
  ok(find(out, "w").delta === 5, "moves all 5 (more than printed) counters");
})();

// 6) target must be an ARTIFACT creature — a plain creature is illegal -> no events [EDGE]
(function () {
  const g = game({ a: bf("a", "Arcbound", 0, { "+1/+1": 3 }), pb: bf("pb", "Plain Bear", 0) });
  ok(J(Mod.modularOnDeath(g, "a", "pb", {})) === J([]), "non-artifact target rejected");
  ok(Mod.isArtifactCreature(g, "pb", {}) === false && Mod.isArtifactCreature(g, "a", {}) === true, "isArtifactCreature predicate");
})();

// 7) zero counters or missing target -> no events
(function () {
  const g = game({ a: bf("a", "Arcbound", 0, {}), w: bf("w", "Steel Wall", 0) });
  ok(J(Mod.modularOnDeath(g, "a", "w", {})) === J([]), "no counters -> nothing to move");
  const g2 = game({ a: bf("a", "Arcbound", 0, { "+1/+1": 2 }) });
  ok(J(Mod.modularOnDeath(g2, "a", "ghost", {})) === J([]), "missing target -> no events");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
