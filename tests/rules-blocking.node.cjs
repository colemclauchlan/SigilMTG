// Pure-module test for rules-blocking.js (defensive blocking AI).
// No DOM, no network. Run: node tests/rules-blocking.node.cjs

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
const CT = loadInto(G, "rules-combat-turn.js", "MTGCombatTurn");
const B = loadInto(G, "rules-blocking.js", "MTGRulesBlocking");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("C22", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("C33", { types: ["creature"], power: 3, toughness: 3 });
Cards.define("C55", { types: ["creature"], power: 5, toughness: 5 });
Cards.define("Death11", { types: ["creature"], power: 1, toughness: 1, abilities: ["deathtouch"] });

const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards });
// cardsOf filters by ownerSeat, so set both owner + controller
const bf = (id, name, seat) => ({ instanceId: id, name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {}, tapped: false });

// favorable block: 3/3 blocks a 2/2 (kills + survives)
(function () {
  const g = game({ a: bf("a", "C22", 0), b: bf("b", "C33", 1) });
  const plan = B.chooseBlocks(g, 1, [{ attacker: "a", blockers: [] }], {});
  ok(plan[0].blockers.length === 1 && plan[0].blockers[0] === "b", "3/3 blocks the 2/2 (favorable)");
})();

// no good block: a 2/2 won't block a 5/5 (can't kill it, can't survive) -> let it through
(function () {
  const g = game({ a: bf("a", "C55", 0), b: bf("b", "C22", 1) });
  const plan = B.chooseBlocks(g, 1, [{ attacker: "a", blockers: [] }], {});
  ok(plan[0].blockers.length === 0, "2/2 does not block the 5/5 (unfavorable -> through)");
})();

// trade: 2/2 blocks a 2/2 (kills it, dies too)
(function () {
  const g = game({ a: bf("a", "C22", 0), b: bf("b", "C22", 1) });
  const plan = B.chooseBlocks(g, 1, [{ attacker: "a", blockers: [] }], {});
  ok(plan[0].blockers.length === 1, "2/2 trades with the 2/2");
})();

// deathtouch chump-up: 1/1 deathtouch blocks a 5/5 (kills it via deathtouch)
(function () {
  const g = game({ a: bf("a", "C55", 0), b: bf("b", "Death11", 1) });
  const plan = B.chooseBlocks(g, 1, [{ attacker: "a", blockers: [] }], {});
  ok(plan[0].blockers.length === 1, "1/1 deathtouch blocks the 5/5 (deathtouch kills)");
})();

// end-to-end: chosen blocks fed into combat produce the right board result (3/3 blocks 2/2)
(function () {
  let s = E.create({ seats: 2, startingLife: 20, decks: [[{ instanceId: "a", name: "C22", zone: "battlefield" }], [{ instanceId: "b", name: "C33", zone: "battlefield" }]] });
  const plan = B.chooseBlocks(s.game, 1, [{ attacker: "a", blockers: [] }], {});
  s = CT.runCombat(E, s, 1, plan, {});
  ok(s.game.cards["a"].zone === "graveyard", "attacker 2/2 dies to the 3/3 blocker");
  ok(s.game.cards["b"].zone === "battlefield", "3/3 blocker survives");
  ok(s.game.players[1].life === 20, "defender took no damage (the attack was blocked)");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
