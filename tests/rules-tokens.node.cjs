// Integration test for rules-tokens.js — token creation, then they behave like creatures.
// No DOM, no network. Run: node tests/rules-tokens.node.cjs

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
loadInto(G, "rules-combat.js", "MTGRulesCombat");
loadInto(G, "rules-combat-turn.js", "MTGCombatTurn");
loadInto(G, "rules-sba.js", "MTGRulesSBA");
const Tok = loadInto(G, "rules-tokens.js", "MTGRulesTokens");
const CT = G.MTGCombatTurn, SBA = G.MTGRulesSBA;

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
E.resetRules();

const OPTS = { seats: 2, startingLife: 20, seed: "tok", decks: [[{ instanceId: "x", name: "Forest", zone: "library" }], [{ instanceId: "y", name: "Forest", zone: "library" }]] };

let s = E.create(OPTS);
s = Tok.createTokens(E, s, 0, { name: "Soldier", power: 1, toughness: 1, count: 3 });

const tokens = Core.cardsOf(s.game, 0, "battlefield");
ok(tokens.length === 3, "created 3 Soldier tokens on the battlefield");
ok(tokens.every(function (c) { return c.name === "Soldier" && c.isToken; }), "tokens are named Soldier and flagged isToken");
ok(Cards.get("Soldier").power === 1 && Cards.get("Soldier").toughness === 1, "a 1/1 def was registered for the token");

// tokens behave like creatures: they can be declared as attackers and deal damage
const plan = CT.declareAllAttackers(s, 0, {});
ok(plan.length === 3, "all 3 tokens declared as attackers");
let s2 = CT.runCombat(E, s, 1, plan);
ok(s2.game.players[1].life === 17, "3 tokens swing for 3 (20 -> 17)");

// a token that leaves the battlefield is flagged by the stray-token SBA (704.5f)
let s3 = E.dispatch(s, { t: "card_move", instanceId: tokens[0].instanceId, toZone: "graveyard" });
ok(SBA.detectAll(s3.game).some(function (f) { return f.kind === "cease_to_exist"; }), "SBA flags a token that left the battlefield");

// deterministic ids -> replay reproduces the tokens
ok(J(E.replay(s.log, OPTS).game) === J(s.game), "token creation replays deterministically");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
