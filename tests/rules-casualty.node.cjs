// Test for rules-casualty.js — casualty N (CR 702.152): sacrifice a creature with power >= N to copy the
// spell. Pure.
// Run: node tests/rules-casualty.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const CA = loadInto(G, "rules-casualty.js", "MTGRulesCasualty");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Bolt2", { types: ["sorcery"], colors: ["R"], mana: { generic: 1, R: 1 }, casualty: 2, spell: { damage: 3, target: "any" } });
Cards.define("Plainbolt", { types: ["sorcery"], mana: { R: 1 }, spell: { damage: 1 } }); // no casualty
Cards.define("Ogre", { types: ["creature"], power: 4, toughness: 4, mana: { generic: 3, R: 1 } });
Cards.define("Weakling", { types: ["creature"], power: 1, toughness: 1, mana: { generic: 1 } });
Cards.define("Rock", { types: ["artifact"], mana: { generic: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "sp", name: "Bolt2", zone: "hand" },
    { instanceId: "og", name: "Ogre", zone: "battlefield" },
    { instanceId: "wk", name: "Weakling", zone: "battlefield" },
    { instanceId: "ro", name: "Rock", zone: "battlefield" }
  ], []] });
}

// 1) casualty N detection
ok(CA.casualtyN(Cards.get("Bolt2")) === 2, "casualtyN returns 2");
ok(CA.casualtyN(Cards.get("Plainbolt")) === null, "no casualty -> null");

// 2) effective power (base + counters)
(function () {
  let g = build();
  ok(CA.effectivePower(g, "og", {}) === 4, "Ogre effective power 4");
  g = Core.reduce(g, { t: "card_counter", instanceId: "wk", kind: "+1/+1", delta: 2 });
  ok(CA.effectivePower(g, "wk", {}) === 3, "Weakling with two +1/+1 counters -> power 3");
})();

// 3) canCasualty: sac a creature with power >= 2
ok(CA.canCasualty(build(), "sp", 0, "og", {}).ok === true, "can sac the Ogre (power 4 >= 2)");
ok(/power is less than 2/.test(CA.canCasualty(build(), "sp", 0, "wk", {}).reason), "Weakling (power 1) too small");
ok(/sacrifice a creature/.test(CA.canCasualty(build(), "sp", 0, "ro", {}).reason), "can't sac the artifact");
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "pb", name: "Plainbolt", zone: "hand" }, { instanceId: "og", name: "Ogre", zone: "battlefield" }], []] });
  ok(/no casualty/.test(CA.canCasualty(g, "pb", 0, "og", {}).reason), "spell without casualty -> rejected");
})();

// 4) casualtyEvents: sacrifice the creature + flag the spell for copying
(function () {
  let g = build();
  g = apply(g, CA.casualtyEvents(g, "sp", "og", {}));
  ok(g.cards["og"].zone === "graveyard", "the Ogre was sacrificed");
  ok(g.cards["sp"].casualtyPaid === true, "spell flagged to be copied");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
