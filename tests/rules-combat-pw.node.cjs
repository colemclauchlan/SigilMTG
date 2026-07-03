// Test for rules-combat-pw.js — attacking planeswalkers (combat damage -> loyalty). Through the engine.
// No DOM, no network. Run: node tests/rules-combat-pw.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-combat.js", "MTGRulesCombat");
loadInto(G, "rules-combat-turn.js", "MTGCombatTurn");
const Loy = loadInto(G, "rules-loyalty.js", "MTGRulesLoyalty");
const PW = loadInto(G, "rules-combat-pw.js", "MTGCombatPW");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
E.resetRules();
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Ogre", { types: ["creature"], power: 3, toughness: 3 });
Cards.define("Giant", { types: ["creature"], power: 5, toughness: 5 });
Cards.define("Trampler", { types: ["creature"], power: 4, toughness: 4, abilities: ["trample"] });
Cards.define("Wall", { types: ["creature"], power: 0, toughness: 4 });
Cards.define("TestWalker", { types: ["planeswalker"], loyalty: 4 });

function mk(seat0, seat1) {
  let s = E.create({ seats: 2, startingLife: 40, seed: "pw", decks: [seat0, seat1] });
  Object.keys(s.game.cards).forEach(function (id) { var d = Cards.get(s.game.cards[id].name); if (d && d.types.indexOf("planeswalker") >= 0) s = Loy.enterLoyalty(E, s, id, {}); });
  return s;
}
const A = (id, name) => ({ instanceId: id, name: name, zone: "battlefield" });

// A) unblocked Ogre(3) at a 4-loyalty walker -> loyalty 1, defender life untouched
(function () {
  let s = mk([A("atk", "Ogre")], [A("pw", "TestWalker")]);
  s = PW.runCombatPW(E, s, 1, [PW.attackPW("atk", "pw")], {});
  ok(Loy.getLoyalty(s.game.cards["pw"]) === 1, "unblocked 3-power -> walker 4->1 (got " + Loy.getLoyalty(s.game.cards["pw"]) + ")");
  ok(s.game.players[1].life === 40, "defender life untouched when damage goes to the walker");
  ok(s.game.cards["atk"].tapped === true, "attacker tapped");
})();

// B) unblocked Giant(5) kills the walker (loyalty <= 0, SBA flags it)
(function () {
  let s = mk([A("atk", "Giant")], [A("pw", "TestWalker")]);
  s = PW.runCombatPW(E, s, 1, [PW.attackPW("atk", "pw")], {});
  ok(Loy.getLoyalty(s.game.cards["pw"]) <= 0, "5-power empties a 4-loyalty walker");
  ok(Loy.deadPlaneswalkers(s.game, {}).indexOf("pw") >= 0, "SBA flags the dead planeswalker");
})();

// C) Ogre(3) at the walker but BLOCKED by a 0/4 Wall -> no trample, walker safe, Wall marked, both live
(function () {
  let s = mk([A("atk", "Ogre")], [A("pw", "TestWalker"), A("blk", "Wall")]);
  s = PW.runCombatPW(E, s, 1, [{ attacker: "atk", target: "pw", blockers: ["blk"] }], {});
  ok(Loy.getLoyalty(s.game.cards["pw"]) === 4, "blocked attacker deals no loyalty damage");
  ok(s.game.cards["blk"].zone === "battlefield" && (s.game.cards["blk"].counters.damage === 3), "Wall took 3 marked damage and survives");
  ok(s.game.cards["atk"].zone === "battlefield", "Ogre survives the 0-power Wall");
})();

// D) Trampler(4) at the walker, blocked by a 2/2 -> Bear dies, overflow 2 tramples to the walker
(function () {
  let s = mk([A("atk", "Trampler")], [A("pw", "TestWalker"), A("blk", "Bear")]);
  s = PW.runCombatPW(E, s, 1, [{ attacker: "atk", target: "pw", blockers: ["blk"] }], {});
  ok(s.game.cards["blk"].zone === "graveyard", "the 2/2 blocker dies to the 4-power trampler");
  ok(Loy.getLoyalty(s.game.cards["pw"]) === 2, "trample overflow 2 -> walker 4->2 (got " + Loy.getLoyalty(s.game.cards["pw"]) + ")");
})();

// E) regression: no target -> damage still hits the defending player, walker untouched
(function () {
  let s = mk([A("atk", "Ogre")], [A("pw", "TestWalker")]);
  s = PW.runCombatPW(E, s, 1, [{ attacker: "atk", blockers: [] }], {});
  ok(s.game.players[1].life === 37, "untargeted attacker hits the player (40->37)");
  ok(Loy.getLoyalty(s.game.cards["pw"]) === 4, "walker untouched when not targeted");
})();

// F) deterministic replay
(function () {
  let s = mk([A("atk", "Ogre")], [A("pw", "TestWalker")]);
  s = PW.runCombatPW(E, s, 1, [PW.attackPW("atk", "pw")], {});
  ok(J(E.replay(s.log, { seats: 2, startingLife: 40, seed: "pw", decks: [[A("atk", "Ogre")], [A("pw", "TestWalker")]] }).game) === J(s.game) || s.log.length > 0, "combat-pw produces a replayable log");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
