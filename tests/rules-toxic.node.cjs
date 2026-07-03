// Test for rules-toxic.js — toxic N: normal combat damage to a player PLUS N poison counters.
// No DOM, no network. Run: node tests/rules-toxic.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const T = loadInto(G, "rules-toxic.js", "MTGRulesToxic");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Skrelv", { types: ["creature"], colors: ["W"], power: 1, toughness: 1, abilities: ["toxic 1"] });
Cards.define("Bloated Crab", { types: ["creature"], colors: ["U"], power: 1, toughness: 4, abilities: ["toxic 3"] });
Cards.define("Plain Toxin", { types: ["creature"], colors: ["B"], power: 2, toughness: 2, abilities: ["toxic"] });
Cards.define("Vanilla", { types: ["creature"], colors: ["G"], power: 2, toughness: 2 });
Cards.define("Double Toxin", { types: ["creature"], colors: ["B"], power: 2, toughness: 2, abilities: ["toxic 2", "toxic 1"] });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) toxic N parsed from "toxic 3"
(function () {
  const g = game({ c: bf("c", "Bloated Crab", 0) });
  ok(T.toxicN(g, "c", {}) === 3, "toxic 3 -> N=3");
})();

// 2) bare "toxic" means N=1
(function () {
  const g = game({ p: bf("p", "Plain Toxin", 0) });
  ok(T.toxicN(g, "p", {}) === 1, "bare toxic -> N=1");
})();

// 3) poison events on damage to a player (life loss handled elsewhere, not here)
(function () {
  const g = game({ c: bf("c", "Bloated Crab", 0) });
  const ev = T.poisonOnDamageToPlayer(g, "c", 1, {});
  ok(ev.length === 1 && ev[0].t === "player_counter" && ev[0].kind === "poison" && ev[0].delta === 3, "toxic 3 -> 3 poison to defender");
  ok(ev[0].seat === 1, "poison goes to the defending seat");
  ok(!ev.some((e) => e.t === "adjust_life"), "toxic emits NO life change (damage is separate/normal)");
})();

// 4) a non-toxic creature yields no poison
(function () {
  const g = game({ v: bf("v", "Vanilla", 0) });
  ok(T.toxicN(g, "v", {}) === 0, "no toxic -> N=0");
  ok(J(T.poisonOnDamageToPlayer(g, "v", 1, {})) === J([]), "vanilla -> no poison events");
})();

// 5) multiple toxic abilities add (CR 702.180e)
(function () {
  const g = game({ d: bf("d", "Double Toxin", 0) });
  ok(T.toxicN(g, "d", {}) === 3, "toxic 2 + toxic 1 -> N=3");
})();

// 6) toxicValue parses string + object forms
(function () {
  ok(T.toxicValue("toxic 4") === 4, "string toxic 4 -> 4");
  ok(T.toxicValue({ kw: "toxic", n: 5 }) === 5, "object form -> 5");
  ok(T.toxicValue("flying") === 0, "non-toxic keyword -> 0");
})();

// 7) EDGE: no defender seat (null) -> no events even with toxic
(function () {
  const g = game({ c: bf("c", "Bloated Crab", 0) });
  ok(J(T.poisonOnDamageToPlayer(g, "c", null, {})) === J([]), "null defender -> no poison");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
