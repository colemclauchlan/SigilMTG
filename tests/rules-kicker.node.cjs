// Test for rules-kicker.js — optional additional cost + bonus effect; multikicker scales. Pure.
// Run: node tests/rules-kicker.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const K = loadInto(G, "rules-kicker.js", "MTGRulesKicker");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

// a spell: deal 2; kicked also draws a card. multikicker draws once per kick.
Cards.define("Kicker Bolt", { types: ["instant"], colors: ["R"], mana: { R: 1 }, kicker: { generic: 2 },
  spell: { target: "any", effects: [{ t: "adjust_life", seat: "target", delta: -2 }], kickedEffects: [{ t: "draw", seat: "controller", count: 1 }] } });
const def = Cards.get("Kicker Bolt");
const card = { controllerSeat: 0, ownerSeat: 0 };

// 1) cost with the kicker paid 0/1/2 times
(function () {
  ok(J(K.costWithKicker(def.mana, def.kicker, 0)) === J({ R: 1 }), "unkicked = {R}");
  ok(J(K.costWithKicker(def.mana, def.kicker, 1)) === J({ R: 1, generic: 2 }), "kicked once = {2}{R}");
  ok(J(K.costWithKicker(def.mana, def.kicker, 2)) === J({ R: 1, generic: 4 }), "multikicked twice = {4}{R}");
})();

// 2) affordability from a pool
(function () {
  ok(K.canKick(def.mana, def.kicker, 1, { R: 1, C: 2 }, {}) === true, "can kick once with {R}+2 colorless");
  ok(K.canKick(def.mana, def.kicker, 2, { R: 1, C: 2 }, {}) === false, "can't kick twice (needs 4 generic)");
  ok(K.canKick(def.mana, def.kicker, 0, { R: 1 }, {}) === true, "can cast unkicked with just {R}");
})();

// 3) effects: unkicked = base only; kicked = base + bonus; multikicked = bonus repeated
(function () {
  ok(J(K.effects(def, 0, card, { kind: "player", seat: 1 })) === J([{ t: "adjust_life", seat: 1, delta: -2 }]), "unkicked: 2 damage only");
  ok(J(K.effects(def, 1, card, { kind: "player", seat: 1 })) === J([{ t: "adjust_life", seat: 1, delta: -2 }, { t: "draw", seat: 0, count: 1 }]), "kicked: 2 damage + draw");
  const twice = K.effects(def, 2, card, { kind: "player", seat: 1 });
  ok(twice.filter(function (e) { return e.t === "draw"; }).length === 2, "multikicked x2: draws twice");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
