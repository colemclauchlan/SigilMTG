// Integration test for Phase R3: curated card definitions driven through the engine spine.
// No DOM, no network. Run: node tests/card-defs.node.cjs
// Proves the DSL + engine compose: tap mana, cast a creature (stack -> resolve -> battlefield),
// cast burn at a player, read effective P/T via the R2 layer system, and replay deterministically.

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
const Layers = loadInto(G, "rules-layers.js", "MTGRulesLayers");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

// curated deck: a Mountain already in play to tap, plus a creature + a burn spell in hand
const OPTS = {
  seats: 2, startingLife: 40, seed: "r3",
  decks: [
    [
      { instanceId: "mtn", cardId: "mtn", name: "Mountain", zone: "battlefield" },
      { instanceId: "bears", cardId: "bears", name: "Grizzly Bears", zone: "hand" },
      { instanceId: "shock", cardId: "shock", name: "Shock", zone: "hand" }
    ],
    [{ instanceId: "o1", cardId: "o1", name: "Forest", zone: "library" }]
  ]
};

// ---- DSL sanity ----
ok(Cards.get("Grizzly Bears").power === 2, "DSL: Grizzly Bears is 2/2");
ok(Cards.isPermanent(Cards.get("Grizzly Bears")) === true, "DSL: creature is a permanent");
ok(Cards.isPermanent(Cards.get("Shock")) === false, "DSL: instant is not a permanent");

let s = E.create(OPTS);

// ---- mana ability: tap the Mountain, add R to the pool (pool = player counters) ----
Cards.manaEvents(Cards.get("Mountain"), { instanceId: "mtn", controllerSeat: 0 }).forEach(function (ev) { s = E.dispatch(s, ev); });
ok(s.game.cards["mtn"].tapped === true, "tapping Mountain taps it");
ok(s.game.players[0].counters["mana_R"] === 1, "mana pool gains R");

// ---- cast Grizzly Bears: onto the stack, then resolve it onto the battlefield ----
s = E.dispatch(s, { t: "card_move", instanceId: "bears", toZone: "stack" });
s = E.dispatch(s, { t: "stack_push", id: "cast-bears", controllerSeat: 0, kind: "spell", effects: Cards.castEffects(Cards.get("Grizzly Bears"), { instanceId: "bears", x: 40, y: 50 }) });
ok(E.top(s).id === "cast-bears", "Grizzly Bears is on the stack");
s = E.passPriority(s); s = E.passPriority(s); // both players pass -> top resolves
ok(s.game.cards["bears"].zone === "battlefield", "Grizzly Bears resolved onto the battlefield");
ok(s.stack.length === 0, "stack empty after the creature resolves");

// ---- cast Shock at seat 1 ----
s = E.dispatch(s, { t: "card_move", instanceId: "shock", toZone: "stack" });
s = E.dispatch(s, { t: "stack_push", id: "cast-shock", controllerSeat: 0, kind: "spell", effects: Cards.castEffects(Cards.get("Shock"), { target: { seat: 1 } }) });
s = E.passPriority(s); s = E.passPriority(s);
ok(s.game.players[1].life === 38, "Shock dealt 2 to seat 1 (40 -> 38)");

// ---- R2 integration: effective P/T of the Bears with a +1/+1 counter ----
const eff = Layers.computeEffectiveState(Cards.printedBase(Cards.get("Grizzly Bears"), { counters: { "+1/+1": 1 } }), []);
ok(eff.power === 3 && eff.toughness === 3, "effective P/T via R2: Grizzly Bears + counter = 3/3");

// ---- determinism: the whole R3 session replays exactly ----
const r = E.replay(s.log, OPTS);
ok(J(r.game) === J(s.game), "replay reproduces the full game state after casting through the engine");
ok(J(r.stack) === J(s.stack) && r.priority === s.priority, "replay reproduces stack + priority");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
