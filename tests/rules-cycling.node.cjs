// Test for rules-cycling.js — pay the cycling cost, discard, draw. Pure.
// Run: node tests/rules-cycling.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const Cy = loadInto(G, "rules-cycling.js", "MTGRulesCycling");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Cycler", { types: ["creature"], colors: ["W"], mana: { generic: 4, W: 1 }, power: 4, toughness: 4, cycling: { generic: 2 } });
Cards.define("Plain Card", { types: ["sorcery"], colors: ["W"], mana: { W: 1 }, spell: { effects: [] } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
// hand = the card to cycle; library has a couple cards so a draw works
function build(name, manaC) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "sp", name: name, zone: "hand" },
    { instanceId: "l1", name: "Plain Card", zone: "library" },
    { instanceId: "l2", name: "Plain Card", zone: "library" }
  ], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}

// 1) can cycle with the cost available
(function () {
  ok(Cy.canCycle(build("Cycler", 2), "sp", 0, {}).ok === true, "can cycle with {2} available");
  ok(Cy.canCycle(build("Cycler", 0), "sp", 0, {}).ok === false, "can't cycle with no mana");
  ok(/no cycling/.test(Cy.canCycle(build("Plain Card", 2), "sp", 0, {}).reason), "a card without cycling can't be cycled");
})();

// 2) cycling pays, discards, and draws
(function () {
  let g = build("Cycler", 2);
  const handBefore = Core.cardsOf(g, 0, "hand").length;     // includes the cycler
  g = apply(g, Cy.cycleEvents(g, "sp", {}));
  ok(g.cards["sp"].zone === "graveyard", "the cycled card is discarded to the graveyard");
  ok((g.players[0].counters.mana_C || 0) === 0, "the {2} cycling cost was paid");
  // discarded one (the cycler), drew one -> hand size unchanged, but it's a different card
  ok(Core.cardsOf(g, 0, "hand").length === handBefore, "discarded one, drew one (hand size unchanged)");
  ok(Core.cardsOf(g, 0, "hand").some(function (c) { return c.name === "Plain Card"; }), "drew a card from the library");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
