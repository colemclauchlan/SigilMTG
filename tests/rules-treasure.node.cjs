// Test for rules-treasure.js — Treasure/Food/Clue creation + sacrifice effects. Pure (no engine-core).
// Run: node tests/rules-treasure.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const T = loadInto(G, "rules-treasure.js", "MTGRulesTreasure");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
T.register(Cards);

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() { return Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "lib0", name: "Forest", zone: "library" }], []] }); }

// 1) create a Treasure, then sac it for green mana
(function () {
  let g = build();
  g = apply(g, [T.create(0, "Treasure", "t1")]);
  ok(g.cards["t1"].zone === "battlefield" && g.cards["t1"].isToken === true, "Treasure token created on the battlefield");
  g = apply(g, T.sacrifice(g, "t1", { color: "G" }));
  ok(g.cards["t1"].zone === "graveyard", "the Treasure was sacrificed");
  ok((g.players[0].counters.mana_G || 0) === 1, "sacrificing it added one green mana");
})();

// 2) Food: sac to gain 3 life
(function () {
  let g = build();
  g = apply(g, [T.create(0, "Food", "f1")]);
  g = apply(g, T.sacrifice(g, "f1", {}));
  ok(g.players[0].life === 23, "sacrificing Food gained 3 life (20 -> 23)");
})();

// 3) Clue: sac to draw a card
(function () {
  let g = build();
  g = apply(g, [T.create(0, "Clue", "c1")]);
  const before = Core.cardsOf(g, 0, "hand").length;
  g = apply(g, T.sacrifice(g, "c1", {}));
  ok(Core.cardsOf(g, 0, "hand").length === before + 1, "sacrificing a Clue drew a card");
  ok(g.cards["c1"].zone === "graveyard", "the Clue is gone");
})();

// 4) Treasure defaults to colorless mana if no color is chosen
(function () {
  let g = build();
  g = apply(g, [T.create(0, "Treasure", "t2")]);
  g = apply(g, T.sacrifice(g, "t2", {}));
  ok((g.players[0].counters.mana_C || 0) === 1, "Treasure without a chosen color adds {C}");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
