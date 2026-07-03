// Test for rules-madness.js — discard exiles a madness card, then cast it for the madness cost or let it die. Pure.
// Run: node tests/rules-madness.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const Mad = loadInto(G, "rules-madness.js", "MTGRulesMadness");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Wild Beast", { types: ["creature"], colors: ["R"], mana: { generic: 3, R: 1 }, power: 3, toughness: 3, madness: { generic: 1, R: 1 } });
Cards.define("Dull Card", { types: ["sorcery"], colors: ["U"], mana: { U: 1 }, spell: { effects: [] } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(name, mana) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "mc", name: name, zone: "hand" }], []] });
  if (mana) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: mana });
  return g;
}

// 1) madnessCost + onDiscard exiles a madness card (instead of graveyard)
(function () {
  ok(J(Mad.madnessCost(Cards.get("Wild Beast"))) === J({ generic: 1, R: 1 }), "reads the madness cost");
  let g = build("Wild Beast", 2);
  const r = Mad.onDiscard(g, "mc", {});
  ok(r.canMadness === true && J(r.cost) === J({ generic: 1, R: 1 }), "onDiscard reports madness is available with its cost");
  g = apply(g, r.events);
  ok(g.cards["mc"].zone === "exile" && g.cards["mc"].madness === true, "the discarded madness card is exiled & flagged");
})();

// 2) cast it from exile for the madness cost -> goes to the stack, cost paid
(function () {
  let g = build("Wild Beast", 2);
  g = apply(g, Mad.onDiscard(g, "mc", {}).events);
  g = apply(g, Mad.castMadness(g, "mc", {}));
  ok(g.cards["mc"].zone === "stack", "casting via madness puts it on the stack");
  ok(g.cards["mc"].madness === false, "the madness flag is cleared once cast");
  ok((g.players[0].counters.mana_R || 0) === 0, "the {1}{R} madness cost was paid");
})();

// 3) decline -> the exiled madness card falls to the graveyard
(function () {
  let g = build("Wild Beast", 2);
  g = apply(g, Mad.onDiscard(g, "mc", {}).events);
  g = apply(g, Mad.declineMadness(g, "mc", {}));
  ok(g.cards["mc"].zone === "graveyard" && g.cards["mc"].madness === false, "declining sends it to the graveyard");
})();

// 4) edge case: a card WITHOUT madness is discarded straight to the graveyard (no exile/choice)
(function () {
  let g = build("Dull Card", 0);
  const r = Mad.onDiscard(g, "mc", {});
  ok(r.canMadness === false, "a non-madness card offers no madness");
  g = apply(g, r.events);
  ok(g.cards["mc"].zone === "graveyard", "an ordinary discard goes to the graveyard");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
