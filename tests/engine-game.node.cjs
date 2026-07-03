// Capstone test for engine-game.js — the engine auto-plays a full game to a win.
// No DOM, no network. Run: node tests/engine-game.node.cjs

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
loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-sba.js", "MTGRulesSBA");
loadInto(G, "rules-combat.js", "MTGRulesCombat");
loadInto(G, "rules-mana.js", "MTGRulesMana");
loadInto(G, "rules-turn.js", "MTGRulesTurn");
loadInto(G, "rules-combat-turn.js", "MTGCombatTurn");
loadInto(G, "engine-autopilot.js", "MTGAutopilot");
const Game = loadInto(G, "engine-game.js", "MTGGame");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
E.resetRules();

// seat 0: six Forests in play + a hand of Grizzly Bears (it will cast and swing); seat 1: no blockers, low life.
const d0 = [];
for (let i = 0; i < 6; i++) d0.push({ instanceId: "f" + i, name: "Forest", zone: "battlefield" });
for (let i = 0; i < 3; i++) d0.push({ instanceId: "b" + i, name: "Grizzly Bears", zone: "hand" });
d0.push({ instanceId: "lib0", name: "Forest", zone: "library" });
const d1 = [{ instanceId: "o1", name: "Plains", zone: "library" }];
const OPTS = { seats: 2, startingLife: 6, seed: "game", decks: [d0, d1] };

let s = E.create(OPTS);
ok(s.game.players[1].life === 6, "setup: seat 1 starts at 6 life");

const r = Game.playGame(E, s, {}, 12);

ok(r.winner === 0, "the engine auto-played a game and seat 0 won");
ok(r.estate.game.players[1].life <= 0, "seat 1 was reduced to 0 or less life");
ok(r.turns >= 1 && r.turns <= 6, "game resolved in a small number of turns (" + r.turns + ")");
ok(Core.cardsOf(r.estate.game, 0, "battlefield").some(function (c) { return c.name === "Grizzly Bears"; }), "seat 0 cast creatures onto the battlefield");

// the whole game is a deterministic event log
ok(J(E.replay(r.estate.log, OPTS).game) === J(r.estate.game), "the full game replays deterministically from its event log");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
