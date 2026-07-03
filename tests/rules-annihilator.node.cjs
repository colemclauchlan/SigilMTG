// Test for rules-annihilator.js — attacker forces defender to sacrifice N permanents (lowest-value first).
// No DOM, no network, no engine-core needed. Run: node tests/rules-annihilator.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const A = loadInto(G, "rules-annihilator.js", "MTGRulesAnnihilator");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Eldrazi6", { types: ["creature"], power: 11, toughness: 11, abilities: ["annihilator 6"] });
Cards.define("Eldrazi2", { types: ["creature"], power: 7, toughness: 7, abilities: ["annihilator 2"] });
Cards.define("Plain Beater", { types: ["creature"], power: 5, toughness: 5 });
Cards.define("Defender Land", { types: ["land"] });
Cards.define("Weenie", { types: ["creature"], power: 1, toughness: 1 });
Cards.define("Wall", { types: ["creature"], power: 0, toughness: 5 });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) annihilatorN parses "annihilator 2" and bare "annihilator"
(function () {
  ok(A.annNFromAbilities(["annihilator 2"]) === 2, "parse 'annihilator 2'");
  ok(A.annNFromAbilities(["annihilator"]) === 1, "bare 'annihilator' = 1");
  ok(A.annNFromAbilities(["flying"]) === 0, "no annihilator -> 0");
})();

// 2) defending seat is the other player in a 2-player game
(function () {
  const g = game({ e: bf("e", "Eldrazi2", 0) });
  ok(A.defendingSeat(g, "e") === 1, "defender is the non-controller in 2p");
})();

// 3) chooseSacrifices picks the lowest-value permanents first (land 0, weenie 2, wall 5)
(function () {
  const g = game({ e: bf("e", "Eldrazi2", 0), L: bf("L", "Defender Land", 1), w: bf("w", "Weenie", 1), wa: bf("wa", "Wall", 1) });
  const chosen = A.chooseSacrifices(g, 1, 2, {});
  ok(J(chosen) === J(["L", "w"]), "sacrifices land + weenie (lowest value first)");
})();

// 4) full event flow: annihilator 2 -> two card_move-to-graveyard for the defender's cheapest
(function () {
  const g = game({ e: bf("e", "Eldrazi2", 0), L: bf("L", "Defender Land", 1), w: bf("w", "Weenie", 1), pb: bf("pb", "Plain Beater", 1) });
  const out = A.annihilatorEvents(g, "e", {});
  ok(out.length === 2 && out.every((ev) => ev.t === "card_move" && ev.toZone === "graveyard"), "two sacrifices to graveyard");
  ok(J(out.map((e) => e.instanceId)) === J(["L", "w"]), "the two cheapest get sacrificed");
})();

// 5) does not touch the attacker's own permanents
(function () {
  const g = game({ e: bf("e", "Eldrazi2", 0), mine: bf("mine", "Weenie", 0), L: bf("L", "Defender Land", 1) });
  const chosen = A.chooseSacrifices(g, 1, 2, {});
  ok(chosen.indexOf("mine") < 0, "attacker's own permanents are safe");
})();

// 6) N greater than the number of permanents -> sacrifice them all (no crash) [EDGE]
(function () {
  const g = game({ e: bf("e", "Eldrazi6", 0), L: bf("L", "Defender Land", 1) });
  const out = A.annihilatorEvents(g, "e", {});
  ok(out.length === 1, "annihilator 6 vs 1 permanent -> sacrifice the 1 available");
})();

// 7) a creature WITHOUT annihilator forces no sacrifices [EDGE]
(function () {
  const g = game({ b: bf("b", "Plain Beater", 0), L: bf("L", "Defender Land", 1) });
  ok(A.annihilatorN(g, "b", {}) === 0 && J(A.annihilatorEvents(g, "b", {})) === J([]), "no annihilator -> no sacrifice");
})();

// 8) explicit attackTargetSeat overrides the default 2p defender
(function () {
  const g = { seats: 3, players: [{ seat: 0 }, { seat: 1 }, { seat: 2 }], cards: { e: Object.assign(bf("e", "Eldrazi2", 0), { attackTargetSeat: 2 }), v: bf("v", "Weenie", 2) } };
  ok(A.defendingSeat(g, "e") === 2, "explicit attack target seat is honored");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
