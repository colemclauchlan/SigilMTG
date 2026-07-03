// Pure-module test for rules-turn.js (Phase R5 turn-structure engine).
// No DOM, no network. Run: node tests/rules-turn.node.cjs

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
const T = loadInto(G, "rules-turn.js", "MTGRulesTurn");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
E.resetRules();

const OPTS = {
  seats: 2, startingLife: 40, seed: "turn",
  decks: [
    [{ instanceId: "perm", name: "Bear", zone: "battlefield" }, { instanceId: "l1", name: "Forest", zone: "library" }, { instanceId: "l2", name: "Forest", zone: "library" }],
    [{ instanceId: "o1", name: "Plains", zone: "library" }]
  ]
};

ok(T.STEPS.length === 12 && T.STEPS[0].name === "untap" && T.STEPS[11].name === "cleanup", "12 steps, untap..cleanup");

let s = E.create(OPTS);
s = E.dispatch(s, { t: "card_tap", instanceId: "perm", tapped: true });
ok(s.game.cards.perm.tapped === true, "setup: permanent is tapped");
const hand0 = Core.cardsOf(s.game, 0, "hand").length;

// run the active player's full turn
s = T.playTurn(E, s);
ok(s.game.cards.perm.tapped === false, "untap step untapped the permanent");
ok(Core.cardsOf(s.game, 0, "hand").length === hand0 + 1, "draw step drew a card");
ok(Core.cardsOf(s.game, 0, "library").length === 1, "library decreased by the draw");
ok(s.step === "cleanup", "turn ran through to the cleanup step");
ok(s.game.phase === "cleanup", "game phase advanced to cleanup");

// passing the turn
s = T.nextStep(E, s);
ok(s.game.activeSeat === 1 && s.step === "untap", "after cleanup, nextStep passes to seat 1's untap");

// mana empties between steps
let s2 = E.create(OPTS);
s2 = E.dispatch(s2, { t: "player_counter", seat: 0, kind: "mana_R", delta: 2 });
ok(s2.game.players[0].counters.mana_R === 2, "setup: 2 R in pool");
s2 = T.performStep(E, s2, T.STEPS[3], {}); // main1
ok(!s2.game.players[0].counters.mana_R, "mana pool emptied as the step ran");

// determinism
ok(J(E.replay(s.log, OPTS).game) === J(s.game), "the whole turn sequence replays deterministically");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
