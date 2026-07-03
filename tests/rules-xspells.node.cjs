// Test for rules-xspells.js — {X} cost resolution, max affordable X, and X-scaled effects.
// Pure (no engine-core). Run: node tests/rules-xspells.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Mana = loadInto(G, "rules-mana.js", "MTGRulesMana");
const X = loadInto(G, "rules-xspells.js", "MTGRulesXSpells");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

// 1) xCost adds X to the generic part
(function () {
  ok(J(X.xCost({ R: 1 }, 3)) === J({ R: 1, generic: 3 }), "Fireball {X}{R} at X=3 -> {3}{R}");
  ok(J(X.xCost({ generic: 1, G: 1 }, 0)) === J({ generic: 1, G: 1 }), "X=0 leaves the base cost");
})();

// 2) maxAffordableX from a pool
(function () {
  // base {R}; pool R:1 + 5 colorless -> R pays the {R}, 5 colorless can pay X=5
  ok(X.maxAffordableX({ R: 1 }, { R: 1, C: 5 }, {}) === 5, "max X with {R} + 5 colorless = 5 (got " + X.maxAffordableX({ R: 1 }, { R: 1, C: 5 }, {}) + ")");
  ok(X.maxAffordableX({ R: 1 }, { C: 5 }, {}) === 0, "can't even pay the {R}, so X=0");
  ok(X.maxAffordableX({ generic: 0 }, { C: 3 }, {}) === 3, "pure {X} with 3 mana -> X=3");
})();

// 3) X damage scales (player vs creature)
(function () {
  ok(J(X.xDamageEffects({ kind: "player", seat: 1 }, 4)) === J([{ t: "adjust_life", seat: 1, delta: -4 }]), "X=4 burn to a player = -4 life");
  ok(J(X.xDamageEffects({ kind: "card", instanceId: "bear" }, 2)) === J([{ t: "card_counter", instanceId: "bear", kind: "damage", delta: 2 }]), "X=2 burn to a creature = 2 marked damage");
  ok(X.xDamageEffects({ kind: "player", seat: 0 }, 0).length === 0, "X=0 does nothing");
})();

// 4) an X hydra enters with X +1/+1 counters (applied through table-core)
(function () {
  let g = Core.init({ seats: 2, startingLife: 20 });
  g = Core.reduce(g, { t: "__add", cards: [{ instanceId: "hydra", name: "Hydra", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} }] });
  X.xCounterEvents("hydra", 5).forEach(function (e) { g = Core.reduce(g, e); });
  ok((g.cards["hydra"].counters["+1/+1"] || 0) === 5, "the X=5 hydra entered with 5 +1/+1 counters");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
