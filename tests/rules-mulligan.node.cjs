// Test for rules-mulligan.js — London mulligan: shuffle hand back, draw 7; keep bottoms M cards. Pure.
// Run: node tests/rules-mulligan.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Mull = loadInto(G, "rules-mulligan.js", "MTGRulesMulligan");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
Cards.define("Filler", { types: ["sorcery"], colors: ["R"], mana: { R: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  let cards = [];
  for (let i = 0; i < 7; i++) cards.push({ instanceId: "h" + i, name: "Filler", zone: "hand" });
  for (let i = 0; i < 20; i++) cards.push({ instanceId: "l" + i, name: "Filler", zone: "library", pos: i });
  return Core.init({ seats: 2, startingLife: 20, seed: "mull", decks: [cards, []] });
}

// 1) a mulligan shuffles the hand back and draws a fresh seven
(function () {
  let g = build();
  ok(Mull.handSize(g, 0, {}) === 7, "opening hand of 7");
  g = apply(g, Mull.mulliganEvents(g, 0, {}));
  ok(Mull.handSize(g, 0, {}) === 7, "after the mulligan the hand is 7 again");
  ok(Core.cardsOf(g, 0, "library").length === 20, "the library is back to 20 (27 shuffled, 7 drawn)");
})();

// 2) keeping after one mulligan bottoms one card (hand -> 6)
(function () {
  let g = build();
  g = apply(g, Mull.mulliganEvents(g, 0, {}));
  const handIds = Core.cardsOf(g, 0, "hand").map(function (c) { return c.instanceId; });
  g = apply(g, Mull.keepEvents(g, 0, [handIds[0]], {}));
  ok(Mull.handSize(g, 0, {}) === 6, "after bottoming 1, the kept hand is 6");
  ok(g.cards[handIds[0]].zone === "library", "the bottomed card went to the library");
})();

// 3) keeping after two mulligans bottoms two
(function () {
  let g = build();
  g = apply(g, Mull.mulliganEvents(g, 0, {}));
  g = apply(g, Mull.mulliganEvents(g, 0, {}));
  const handIds = Core.cardsOf(g, 0, "hand").map(function (c) { return c.instanceId; });
  g = apply(g, Mull.keepEvents(g, 0, [handIds[0], handIds[1]], {}));
  ok(Mull.handSize(g, 0, {}) === 5, "two mulligans then keep -> a 5-card hand");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
