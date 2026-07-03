// Integration test for rules-fight.js — the fight action.
// No DOM, no network. Run: node tests/rules-fight.node.cjs

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
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-combat.js", "MTGRulesCombat");
const F = loadInto(G, "rules-fight.js", "MTGRulesFight");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Ogre", { types: ["creature"], power: 3, toughness: 3 });
Cards.define("Wurm", { types: ["creature"], power: 6, toughness: 4 });
Cards.define("Snake", { types: ["creature"], power: 1, toughness: 1, abilities: ["deathtouch"] });

function game(a, b) {
  return E.create({ seats: 2, decks: [[{ instanceId: "a", name: a, zone: "battlefield" }], [{ instanceId: "b", name: b, zone: "battlefield" }, { instanceId: "z", name: "Forest", zone: "library" }]] });
}

// 2/2 vs 2/2 -> both die
(function () {
  const r = F.fight(E, game("Bear", "Bear"), "a", "b", {});
  ok(r.aDied && r.bDied, "Bear fights Bear -> both die");
  ok(r.estate.game.cards["a"].zone === "graveyard" && r.estate.game.cards["b"].zone === "graveyard", "both in graveyards");
})();

// 2/2 vs 3/3 -> the Bear dies, the Ogre survives with 2 marked damage
(function () {
  const r = F.fight(E, game("Bear", "Ogre"), "a", "b", {});
  ok(r.aDied && !r.bDied, "Bear (2/2) dies, Ogre (3/3) survives");
  ok((r.estate.game.cards["b"].counters || {}).damage === 2, "Ogre has 2 marked damage");
})();

// 6/4 vs 2/2 -> Bear dies, Wurm survives
(function () {
  const r = F.fight(E, game("Wurm", "Bear"), "a", "b", {});
  ok(!r.aDied && r.bDied, "Wurm survives, Bear dies");
})();

// deathtouch 1/1 vs 5/5-ish (Wurm 6/4) -> both die
(function () {
  const r = F.fight(E, game("Snake", "Wurm"), "a", "b", {});
  ok(r.aDied && r.bDied, "deathtouch Snake and the Wurm both die");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
