// Test for card-library-ext.js — advanced curated set actually works through the engine.
// No DOM, no network. Run: node tests/card-library-ext.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-mana.js", "MTGRulesMana");
loadInto(G, "rules-targeting.js", "MTGRulesTargeting");
const Sp = loadInto(G, "rules-spells.js", "MTGRulesSpells");
const Loy = loadInto(G, "rules-loyalty.js", "MTGRulesLoyalty");
const Repl = loadInto(G, "rules-replacement.js", "MTGRulesReplacement");
const Lib = loadInto(G, "card-library-ext.js", "MTGCardLibraryExt");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
const n = Lib.register(Cards);

ok(n >= 10, "advanced set registered (" + n + " cards total)");
ok(Cards.get("Chandra, Pyromaster").loyalty === 4, "Chandra is a 4-loyalty planeswalker");
ok(Cards.get("Doom Blade").spell.effects[0].toZone === "graveyard", "Doom Blade destroys (moves target to graveyard)");
ok(Cards.get("Gateway Plaza").entersTapped === true, "Gateway Plaza enters tapped");
ok(Cards.get("Hangarback Walker").entersWith.count === 2, "Hangarback enters with 2 counters");

// Doom Blade actually destroys a creature through the engine
(function () {
  let s = E.create({ seats: 2, startingLife: 20, decks: [[{ instanceId: "db", name: "Doom Blade", zone: "hand" }], [{ instanceId: "bear", name: "Bear", zone: "battlefield" }, { instanceId: "z", name: "Forest", zone: "library" }]] });
  s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_B", delta: 1 });
  s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_C", delta: 1 });
  const r = Sp.castSpell(E, s, "db", { target: { kind: "card", instanceId: "bear" } }, {});
  ok(r.ok, "Doom Blade casts");
  s = r.estate; s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.cards["bear"].zone === "graveyard", "Doom Blade destroyed the Bear");
})();

// Jace's +2: draw a card
(function () {
  let s = E.create({ seats: 2, decks: [[{ instanceId: "jace", name: "Jace Beleren", zone: "battlefield" }, { instanceId: "l1", name: "Forest", zone: "library" }], [{ instanceId: "l2", name: "Forest", zone: "library" }]] });
  s = Loy.enterLoyalty(E, s, "jace", {});
  const r = Loy.activateLoyalty(E, s, "jace", 0, {}, {});
  ok(r.ok && Loy.getLoyalty(r.estate.game.cards["jace"]) === 5, "Jace +2: loyalty 3 -> 5");
  s = r.estate; s = E.passPriority(s); s = E.passPriority(s);
  ok(Core.cardsOf(s.game, 0, "hand").length === 1, "Jace +2 resolved: controller drew a card");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
