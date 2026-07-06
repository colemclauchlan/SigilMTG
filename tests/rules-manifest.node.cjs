// Test for rules-manifest.js — manifest (CR 701.34): top card onto the battlefield face-down as a 2/2;
// turn a creature face up for its cost. Pure. Run: node tests/rules-manifest.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const MF = loadInto(G, "rules-manifest.js", "MTGRulesManifest");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Scout", { types: ["creature"], mana: { generic: 1 }, power: 3, toughness: 3 });
Cards.define("Bolt", { types: ["instant"], mana: { R: 1 }, spell: { damage: 3 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
// library top = the first library entry
function build(topName, manaC) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "top", name: topName, zone: "library" },
    { instanceId: "nxt", name: "Scout", zone: "library" }
  ], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}

// 1) manifestTopEvents: top card -> battlefield face-down + manifested
(function () {
  let g = build("Scout", 0);
  g = apply(g, MF.manifestTopEvents(g, 0, {}));
  ok(g.cards["top"].zone === "battlefield", "manifested card is on the battlefield");
  ok(g.cards["top"].faceDown === true && g.cards["top"].manifested === true, "it's face down + manifested (a 2/2)");
})();

// 2) a manifested CREATURE can be turned up for its mana cost ({1})
(function () {
  let g = build("Scout", 1);
  g = apply(g, MF.manifestTopEvents(g, 0, {}));
  ok(MF.canTurnUp(g, "top", 0, {}).ok === true, "manifested creature can turn up with {1}");
  g = apply(g, MF.turnUpEvents(g, "top", {}));
  ok(g.cards["top"].faceDown === false && g.cards["top"].manifested === false, "turned face up");
  ok((g.players[0].counters.mana_C || 0) === 0, "mana cost {1} paid to turn up");
})();

// 3) a manifested NONCREATURE cannot be turned face up
(function () {
  let g = build("Bolt", 5);
  g = apply(g, MF.manifestTopEvents(g, 0, {}));
  ok(/only a creature card/.test(MF.canTurnUp(g, "top", 0, {}).reason), "a noncreature manifest can't be turned up");
})();

// 4) manifestTopEvents produces exactly a move-to-battlefield + a face-down set
(function () {
  let g = build("Scout", 0);
  var evs = MF.manifestTopEvents(g, 0, {});
  ok(evs.length === 2 && evs[0].t === "card_move" && evs[0].toZone === "battlefield", "manifest = move to battlefield + face-down set");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
