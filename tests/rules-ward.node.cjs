// Test for rules-ward.js — ward triggers only on opponent targeting; counters unless the cost is paid. Pure.
// No DOM, no engine-core. Run: node tests/rules-ward.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const W = loadInto(G, "rules-ward.js", "MTGRulesWard");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Warded One", { types: ["creature"], colors: ["U"], power: 2, toughness: 2, ward: { generic: 2 } });
Cards.define("Hexward", { types: ["creature"], colors: ["G"], power: 3, toughness: 3, ward: "hexproof" });   // a non-mana ward (opaque cost)
Cards.define("Naked Bear", { types: ["creature"], colors: ["G"], power: 2, toughness: 2 });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) wardCost reads the cost (and is null for a creature without ward)
(function () {
  const g = game({ w: bf("w", "Warded One", 0), b: bf("b", "Naked Bear", 0), h: bf("h", "Hexward", 0) });
  ok(J(W.wardCost(g, "w", {})) === J({ generic: 2 }), "reads a mana ward cost");
  ok(W.wardCost(g, "b", {}) === null, "a creature without ward has no ward cost");
  ok(W.wardCost(g, "h", {}) === "hexproof", "a non-mana ward keeps its opaque cost");
})();

// 2) ward triggers when an OPPONENT targets it
(function () {
  const g = game({ w: bf("w", "Warded One", 0) });
  ok(W.triggersWard(g, "w", 0, 1, {}) === true, "opponent (seat 1) targeting seat 0's warded creature triggers ward");
})();

// 3) ward does NOT trigger when the controller targets their own permanent
(function () {
  const g = game({ w: bf("w", "Warded One", 0) });
  ok(W.triggersWard(g, "w", 0, 0, {}) === false, "you targeting your own warded creature does not trigger ward");
})();

// 4) a creature without ward never triggers, even from an opponent
(function () {
  const g = game({ b: bf("b", "Naked Bear", 0) });
  ok(W.triggersWard(g, "b", 0, 1, {}) === false, "no ward -> no trigger even when an opponent targets it");
})();

// 5) resolveWard: countered unless paid
(function () {
  ok(W.resolveWard(false).countered === true, "ward not paid -> the spell/ability is countered");
  ok(W.resolveWard(true).countered === false, "ward paid -> it resolves (not countered)");
})();

// 6) edge case: an unknown card id has no ward and never triggers (no throw)
(function () {
  const g = game({ w: bf("w", "Warded One", 0) });
  ok(W.wardCost(g, "ghost", {}) === null, "an unknown card id has no ward cost");
  ok(W.triggersWard(g, "ghost", 0, 1, {}) === false, "an unknown card id never triggers ward");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
