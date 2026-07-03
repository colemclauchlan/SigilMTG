// Test for rules-dredge.js — instead of drawing, mill N and return the dredge card to hand. Pure.
// Run: node tests/rules-dredge.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Dr = loadInto(G, "rules-dredge.js", "MTGRulesDredge");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Stinkweed", { types: ["creature"], subtypes: ["plant"], colors: ["G"], power: 1, toughness: 2, dredge: 5 });
Cards.define("Filler", { types: ["sorcery"], colors: ["U"], spell: { effects: [] } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
// dredge card in graveyard + `libN` filler cards in the library
function build(name, libN) {
  const deck = [{ instanceId: "dr", name: name, zone: "graveyard" }];
  for (let i = 0; i < libN; i++) deck.push({ instanceId: "L" + i, name: "Filler", zone: "library" });
  return Core.init({ seats: 2, startingLife: 20, decks: [deck, []] });
}

// 1) dredgeN reader
(function () {
  ok(Dr.dredgeN(Cards.get("Stinkweed")) === 5, "reads dredge N");
  ok(Dr.dredgeN(Cards.get("Filler")) === 0, "a non-dredge card has dredge 0");
})();

// 2) canDredge requires the card in YOUR graveyard + enough library
(function () {
  ok(Dr.canDredge(build("Stinkweed", 5), 0, "dr", {}) === true, "can dredge 5 with exactly 5 in library");
  ok(Dr.canDredge(build("Stinkweed", 4), 0, "dr", {}) === false, "can't dredge 5 with only 4 in library");
  ok(Dr.canDredge(build("Stinkweed", 5), 1, "dr", {}) === false, "an opponent can't dredge your graveyard card");
})();

// 3) dredge mills N and returns the card to hand (the draw replacement)
(function () {
  let g = build("Stinkweed", 5);
  const libBefore = Core.zoneCount(g, 0, "library");
  g = apply(g, Dr.dredge(g, 0, "dr", {}));
  ok(g.cards["dr"].zone === "hand", "the dredge card returns to hand");
  ok(Core.zoneCount(g, 0, "graveyard") === 5, "5 cards were milled into the graveyard");
  ok(Core.zoneCount(g, 0, "library") === libBefore - 5, "5 cards left the library");
})();

// 4) edge case: insufficient library -> dredge yields no events (you'd just draw normally)
(function () {
  let g = build("Stinkweed", 3);
  ok(J(Dr.dredge(g, 0, "dr", {})) === J([]), "dredge with too few library cards produces no events");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
