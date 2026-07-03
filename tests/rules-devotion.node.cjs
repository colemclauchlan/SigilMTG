// Test for rules-devotion.js — count colored mana symbols among your battlefield permanents.
// Pure (no engine-core). Run: node tests/rules-devotion.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const D = loadInto(G, "rules-devotion.js", "MTGRulesDevotion");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Gravedigger", { types: ["creature"], colors: ["B"], mana: { generic: 1, B: 2 }, power: 2, toughness: 2 });
Cards.define("Dark Ritual Ench", { types: ["enchantment"], colors: ["B"], mana: { generic: 1, B: 1 } });
Cards.define("Goblin", { types: ["creature"], colors: ["R"], mana: { R: 1 }, power: 1, toughness: 1 });
Cards.define("Swamp", { types: ["land"], produces: "B" });

const bf = (id, name, seat, zone) => ({ instanceId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: zone || "battlefield", counters: {} });
function build(cards) { let g = Core.init({ seats: 2, startingLife: 20 }); return Core.reduce(g, { t: "__add", cards: cards }); }

// devotion sums the colored pips of your permanents' mana costs
(function () {
  const g = build([
    bf("gd", "Gravedigger", 0),       // {1}{B}{B}  -> 2 black pips
    bf("de", "Dark Ritual Ench", 0),  // {1}{B}     -> 1 black pip
    bf("gob", "Goblin", 0),           // {R}        -> 1 red pip
    bf("sw", "Swamp", 0),             // land, no cost
    bf("hand", "Gravedigger", 0, "hand") // not on the battlefield
  ]);
  ok(D.devotion(g, 0, "B", {}) === 3, "devotion to black = 3 (got " + D.devotion(g, 0, "B", {}) + ")");
  ok(D.devotion(g, 0, "R", {}) === 1, "devotion to red = 1");
  ok(D.devotion(g, 0, ["B", "R"], {}) === 4, "two-color devotion B/R = 4");
  ok(D.devotion(g, 0, "G", {}) === 0, "devotion to green = 0");
})();

// lands and a card in hand don't contribute; the opponent's permanents don't either
(function () {
  const g = build([bf("sw", "Swamp", 0), bf("oppGob", "Goblin", 1)]);
  ok(D.devotion(g, 0, "B", {}) === 0, "lands add no devotion");
  ok(D.devotion(g, 0, "R", {}) === 0, "the opponent's red creature isn't your devotion");
})();

// devotionByColor snapshot
(function () {
  const g = build([bf("gd", "Gravedigger", 0), bf("gob", "Goblin", 0)]);
  ok(J(D.devotionByColor(g, 0, {})) === J({ W: 0, U: 0, B: 2, R: 1, G: 0 }), "devotionByColor = {B:2,R:1}");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
