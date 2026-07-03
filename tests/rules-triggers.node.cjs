// Integration test for Phase R4 triggered abilities: an ETB trigger fired through the engine.
// No DOM, no network. Run: node tests/rules-triggers.node.cjs

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
const Trig = loadInto(G, "rules-triggers.js", "MTGRulesTriggers");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
const clone = (x) => JSON.parse(JSON.stringify(x));

// a creature with an ETB "draw a card" trigger
Cards.define("Elvish Visionary", { types: ["creature"], subtypes: ["elf"], colors: ["G"], power: 1, toughness: 1, triggers: [{ on: "etb", effects: [{ t: "draw", seat: "controller", count: 1 }] }] });

const OPTS = {
  seats: 2, startingLife: 40, seed: "trg",
  decks: [
    [
      { instanceId: "viz", cardId: "viz", name: "Elvish Visionary", zone: "hand" },
      { instanceId: "l1", cardId: "l1", name: "Forest", zone: "library" },
      { instanceId: "l2", cardId: "l2", name: "Forest", zone: "library" },
      { instanceId: "l3", cardId: "l3", name: "Forest", zone: "library" }
    ],
    [{ instanceId: "o1", cardId: "o1", name: "Plains", zone: "library" }]
  ]
};

let s = E.create(OPTS);
ok(Core.cardsOf(s.game, 0, "hand").length === 1, "start: Visionary in hand");
ok(Core.cardsOf(s.game, 0, "library").length === 3, "start: 3 cards in library");

// cast Visionary onto the stack
s = E.dispatch(s, { t: "card_move", instanceId: "viz", toZone: "stack" });
s = E.dispatch(s, { t: "stack_push", id: "cast-viz", controllerSeat: 0, kind: "spell", effects: Cards.castEffects(Cards.get("Elvish Visionary"), { instanceId: "viz", x: 40, y: 50 }) });
const before = clone(s.game);                 // snapshot before resolution
s = E.passPriority(s); s = E.passPriority(s);  // all pass -> resolves onto the battlefield
ok(s.game.cards["viz"].zone === "battlefield", "Visionary resolved onto the battlefield");

// recognize the ETB and fire the trigger
const events = Trig.diffEvents(before, s.game);
ok(events.length === 1 && events[0].kind === "etb" && events[0].instanceId === "viz", "diffEvents detects the ETB");
const triggers = Trig.collectTriggers(events, { getCard: (id) => s.game.cards[id], getDef: Cards.get });
ok(triggers.length === 1 && triggers[0].effects[0].t === "draw" && triggers[0].effects[0].seat === 0, "ETB trigger bound to controller (draw, seat 0)");
triggers.forEach(function (t) { s = E.dispatch(s, { t: "trigger_push", id: t.id, controllerSeat: t.controllerSeat, source: t.source, effects: t.effects }); });
ok(s.stack.length === 1 && E.top(s).kind === "triggered", "ETB trigger placed on the stack");

// resolve the trigger
s = E.passPriority(s); s = E.passPriority(s);
ok(Core.cardsOf(s.game, 0, "hand").length === 1, "after the ETB draw: 1 card in hand");
ok(Core.cardsOf(s.game, 0, "library").length === 2, "library down to 2 (drew 1)");
ok(s.game.cards["viz"].zone === "battlefield", "Visionary stays on the battlefield");

// determinism
ok(J(E.replay(s.log, OPTS).game) === J(s.game), "replay reproduces the triggered-ability sequence");

// negative + a second event kind
ok(Trig.collectTriggers([{ kind: "etb", instanceId: "x" }], { getCard: () => ({ name: "Grizzly Bears", controllerSeat: 0 }), getDef: Cards.get }).length === 0, "vanilla card -> no trigger");
ok(Trig.diffEvents({ cards: { c: { instanceId: "c", zone: "battlefield" } } }, { cards: { c: { instanceId: "c", zone: "graveyard" } } })[0].kind === "dies", "diffEvents detects a dies (battlefield -> graveyard)");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
