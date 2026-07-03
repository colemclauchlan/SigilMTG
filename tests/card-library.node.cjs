// Pure-module test for card-library.js (curated DSL card set).
// No DOM, no network. Run: node tests/card-library.node.cjs

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
loadInto(G, "rules-mana.js", "MTGRulesMana");
const Lib = loadInto(G, "card-library.js", "MTGCardLibrary");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

const n = Lib.register(Cards);
ok(n >= 18, "register() defined a sizable library (" + n + " cards total)");

// the five basics produce the five colors
["Plains:W", "Island:U", "Swamp:B", "Mountain:R", "Forest:G"].forEach(function (pair) {
  const [name, color] = pair.split(":");
  ok(Cards.get(name).produces === color, name + " produces " + color);
});

// keyword creatures parsed correctly
const angel = Cards.get("Serra Angel");
ok(angel.power === 4 && angel.abilities.indexOf("flying") >= 0 && angel.abilities.indexOf("vigilance") >= 0, "Serra Angel: 4/4 flying vigilance");
ok(Cards.get("White Knight").abilities.indexOf("first strike") >= 0, "White Knight has first strike");
ok(Cards.get("Vampire Nighthawk").abilities.indexOf("deathtouch") >= 0, "Vampire Nighthawk has deathtouch");
ok(Cards.get("Craw Wurm").power === 6 && Cards.get("Craw Wurm").mana.generic === 4, "Craw Wurm: 6/4 for {4}{G}{G}");

// burn + ETB
ok(Cards.get("Lightning Bolt").spell.damage === 3, "Lightning Bolt deals 3");
ok(Cards.get("Kitchen Finks").triggers[0].effects[0].t === "adjust_life", "Kitchen Finks ETB gains life");

// a library creature is a permanent and casts to the battlefield via the engine
ok(Cards.isPermanent(Cards.get("Goblin Piker")) === true, "Goblin Piker is a permanent");
(function () {
  let s = E.create({ seats: 2, startingLife: 20, decks: [[{ instanceId: "gp", name: "Goblin Piker", zone: "hand" }], [{ instanceId: "x", name: "Forest", zone: "library" }]] });
  s = E.dispatch(s, { t: "card_move", instanceId: "gp", toZone: "stack" });
  s = E.dispatch(s, { t: "stack_push", id: "c", controllerSeat: 0, kind: "spell", effects: Cards.castEffects(Cards.get("Goblin Piker"), { instanceId: "gp" }) });
  s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.cards["gp"].zone === "battlefield", "library creature (Goblin Piker) cast onto the battlefield");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
