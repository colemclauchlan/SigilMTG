// Test for rules-prowess.js — prowess +1/+1 per noncreature spell cast, incl. granted prowess.
// No DOM, no network, no engine-core needed. Run: node tests/rules-prowess.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const P = loadInto(G, "rules-prowess.js", "MTGRulesProwess");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Adept", { types: ["creature"], power: 1, toughness: 2, abilities: ["prowess"] });
Cards.define("Vanilla Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Prowess Lord", { types: ["creature"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["prowess"] }] });
Cards.define("Anthem Totem", { types: ["enchantment"], static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });

const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: counters || {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) hasProwess predicate
ok(P.hasProwess(["prowess"]) === true, "hasProwess true");
ok(P.hasProwess(["flying"]) === false, "hasProwess false");

// 2) no spells cast -> base P/T
(function () {
  const g = game({ a: bf("a", "Adept", 0) });
  ok(J(P.prowessBonus(g, "a", 0, {})) === J({ power: 1, toughness: 2 }), "prowess + 0 spells -> base 1/2");
})();

// 3) three noncreature spells -> +3/+3
(function () {
  const g = game({ a: bf("a", "Adept", 0) });
  ok(J(P.prowessBonus(g, "a", 3, {})) === J({ power: 4, toughness: 5 }), "prowess + 3 spells -> 4/5");
})();

// 4) a creature WITHOUT prowess gets no bonus regardless of spell count
(function () {
  const g = game({ v: bf("v", "Vanilla Bear", 0) });
  ok(J(P.prowessBonus(g, "v", 5, {})) === J({ power: 2, toughness: 2 }), "no prowess -> no bonus");
})();

// 5) prowess stacks ON TOP of counters and anthems (effective base is 1/2 +1/+1 counter +1/+1 anthem = 3/4, then +2/+2)
(function () {
  const g = game({ a: bf("a", "Adept", 0, { "+1/+1": 1 }), tot: bf("tot", "Anthem Totem", 0) });
  ok(J(P.prowessBonus(g, "a", 2, {})) === J({ power: 5, toughness: 6 }), "prowess stacks over counter+anthem -> 5/6");
})();

// 6) GRANTED prowess: a lord grants prowess to a vanilla teammate, which then benefits from spells
(function () {
  const g = game({ lord: bf("lord", "Prowess Lord", 0), mate: bf("mate", "Vanilla Bear", 0) });
  ok(P.hasProwess(P.abilitiesOf(g, "mate", {})) === true, "granted prowess present on teammate");
  ok(J(P.prowessBonus(g, "mate", 2, {})) === J({ power: 4, toughness: 4 }), "granted prowess + 2 spells -> 4/4");
})();

// 7) negative spell count is clamped to 0
(function () {
  const g = game({ a: bf("a", "Adept", 0) });
  ok(J(P.prowessBonus(g, "a", -3, {})) === J({ power: 1, toughness: 2 }), "negative spell count clamps to base");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
