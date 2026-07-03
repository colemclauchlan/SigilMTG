// Integration test for engine-autopilot.js — the engine auto-plays a main phase.
// No DOM, no network. Run: node tests/engine-autopilot.node.cjs
// Proves the full stack composes: play a land -> tap for mana -> afford check -> cast through the stack.

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
const Auto = loadInto(G, "engine-autopilot.js", "MTGAutopilot");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
E.resetRules();

// seat 0: a Mountain already in play, a Forest + Grizzly Bears (1G + 1 generic) in hand
const OPTS = {
  seats: 2, startingLife: 40, seed: "auto",
  decks: [
    [
      { instanceId: "mtn", name: "Mountain", zone: "battlefield" },
      { instanceId: "forest", name: "Forest", zone: "hand" },
      { instanceId: "bears", name: "Grizzly Bears", zone: "hand" }
    ],
    [{ instanceId: "o1", name: "Plains", zone: "library" }]
  ]
};

ok(Auto.manaValue({ generic: 1, G: 1 }) === 2, "manaValue: {1}{G} = 2");

let s = E.create(OPTS);
ok(Core.cardsOf(s.game, 0, "hand").length === 2, "start: Forest + Bears in hand");

s = Auto.playMainPhase(E, s, 0);

const bf = Core.cardsOf(s.game, 0, "battlefield").map(function (c) { return c.name; });
ok(bf.indexOf("Forest") >= 0, "autopilot played the Forest (land)");
ok(s.game.cards["mtn"].tapped === true && s.game.cards["forest"].tapped === true, "autopilot tapped both lands for mana");
ok(s.game.cards["bears"].zone === "battlefield", "autopilot cast Grizzly Bears (resolved onto the battlefield)");
ok(Core.cardsOf(s.game, 0, "hand").length === 0, "hand emptied (land played + creature cast)");
ok(s.stack.length === 0, "stack is empty after the main phase");

// determinism: the whole auto-played main phase replays exactly
ok(J(E.replay(s.log, OPTS).game) === J(s.game), "auto-played main phase replays deterministically");

// affordability gate: with no mana available, nothing is cast
let s2 = E.create(OPTS);
s2 = E.dispatch(s2, { t: "card_move", instanceId: "forest", toZone: "battlefield" }); // a land, but we won't tap
const r = Auto.castAffordable(E, s2, 0, null);
ok(r.cast === null, "castAffordable: nothing cast when no mana is in the pool");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
