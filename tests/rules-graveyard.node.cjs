// Test for rules-graveyard.js — recursion/reanimation from the graveyard. Pure (no engine-core).
// Run: node tests/rules-graveyard.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const GY = loadInto(G, "rules-graveyard.js", "MTGRulesGraveyard");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Big Beast", { types: ["creature"], subtypes: ["beast"], power: 5, toughness: 5 });
Cards.define("Bolt", { types: ["instant"], colors: ["R"], spell: { damage: 3, target: "any" } });

// explicit deck places cards directly into the graveyard (and avoids the 99-card auto-seed)
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "corpse", name: "Big Beast", zone: "graveyard" },
    { instanceId: "bolt", name: "Bolt", zone: "graveyard" }
  ], []] });
}
function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }

// 1) filter the graveyard
(function () {
  const g = build();
  ok(J(GY.graveyardCards(g, 0, { type: "creature" }, {})) === J(["corpse"]), "find a creature card in the graveyard");
  ok(J(GY.graveyardCards(g, 0, { type: "instant" }, {})) === J(["bolt"]), "find the instant");
  ok(J(GY.graveyardCards(g, 0, { subtype: "beast" }, {})) === J(["corpse"]), "filter by subtype");
})();

// 2) Raise Dead: return a creature card to hand
(function () {
  let g = build();
  g = apply(g, GY.recur(g, "corpse", "hand", {}));
  ok(g.cards["corpse"].zone === "hand", "the creature card returned to hand");
  ok(Core.cardsOf(g, 0, "graveyard").length === 1, "one card left in the graveyard");
})();

// 3) Reanimate: put it directly onto the battlefield
(function () {
  let g = build();
  g = apply(g, GY.reanimate(g, "corpse", {}));
  ok(g.cards["corpse"].zone === "battlefield", "the creature was reanimated onto the battlefield");
})();

// 4) reanimate tapped (e.g. an effect that says so)
(function () {
  let g = build();
  g = apply(g, GY.reanimate(g, "corpse", { tapped: true }));
  ok(g.cards["corpse"].zone === "battlefield" && g.cards["corpse"].tapped === true, "reanimated tapped");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
