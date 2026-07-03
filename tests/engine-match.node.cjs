// Integration test for engine-match.js — full auto-game with the defender blocking.
// No DOM, no network. Run: node tests/engine-match.node.cjs

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
const Lib = loadInto(G, "card-library.js", "MTGCardLibrary");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-combat.js", "MTGRulesCombat");
loadInto(G, "rules-combat-turn.js", "MTGCombatTurn");
loadInto(G, "rules-sba.js", "MTGRulesSBA");
loadInto(G, "rules-mana.js", "MTGRulesMana");
loadInto(G, "rules-turn.js", "MTGRulesTurn");
loadInto(G, "rules-blocking.js", "MTGRulesBlocking");
loadInto(G, "engine-autopilot.js", "MTGAutopilot");
loadInto(G, "engine-game.js", "MTGGame");
const AI = loadInto(G, "engine-match.js", "MTGGameAI");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Lib.register(Cards);
Cards.define("C22", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("C33", { types: ["creature"], power: 3, toughness: 3 });
Cards.define("Wall", { types: ["creature"], subtypes: ["wall"], power: 0, toughness: 4 });

// one turn: a 2/2 attacker is blocked by a 3/3 and dies; defender takes no damage
(function () {
  let s = E.create({ seats: 2, startingLife: 20, decks: [[{ instanceId: "a", name: "C22", zone: "battlefield" }], [{ instanceId: "b", name: "C33", zone: "battlefield" }, { instanceId: "l", name: "Forest", zone: "library" }]] });
  s = AI.autoTurnWithBlocks(E, s, {});
  ok(s.game.cards["a"].zone === "graveyard", "attacker 2/2 was blocked by the 3/3 and died");
  ok(s.game.cards["b"].zone === "battlefield", "the 3/3 blocker survived");
  ok(s.game.players[1].life === 20, "defender took no combat damage (attack was blocked)");
})();

// a full match: aggressor wins, but a 0/4 Wall blocking delays the kill past turn 1
(function () {
  const d0 = [];
  for (let i = 0; i < 6; i++) d0.push({ instanceId: "f" + i, name: "Forest", zone: "battlefield" });
  for (let i = 0; i < 4; i++) d0.push({ instanceId: "gb" + i, name: "Grizzly Bears", zone: "hand" });
  for (let i = 0; i < 4; i++) d0.push({ instanceId: "lib" + i, name: "Grizzly Bears", zone: "library" });
  const d1 = [{ instanceId: "wall", name: "Wall", zone: "battlefield" }, { instanceId: "ol", name: "Forest", zone: "library" }];
  let s = E.create({ seats: 2, startingLife: 6, seed: "match", decks: [d0, d1] });
  const r = AI.playMatch(E, s, {}, 16);
  ok(r.winner === 0, "the aggressor wins the match");
  ok(r.estate.game.players[1].life <= 0, "the defender is reduced to 0 or less life");
  ok(r.turns >= 2, "the Wall's blocking delayed the kill beyond a single turn (turns=" + r.turns + ")");
  ok(s.game.cards["wall"] !== undefined, "(setup) the Wall existed");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
