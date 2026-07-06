// Test for rules-outlast.js — outlast (CR 702.85): cost + {T} at sorcery speed for a +1/+1 counter. Pure.
// Run: node tests/rules-outlast.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const OL = loadInto(G, "rules-outlast.js", "MTGRulesOutlast");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Guard", { types: ["creature"], colors: ["W"], mana: { generic: 1, W: 1 }, power: 1, toughness: 4, outlast: { W: 1 } });
Cards.define("Vanilla", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaW) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "gd", name: "Guard", zone: "battlefield" }], []] });
  if (manaW) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_W", delta: manaW });
  return g;
}

// 1) outlast cost detection
ok(OL.outlastCost(Cards.get("Guard")).W === 1, "outlastCost returns the cost");
ok(OL.outlastCost(Cards.get("Vanilla")) === null, "no outlast -> null");

// 2) canOutlast: untapped creature you control, cost payable
ok(OL.canOutlast(build(1), "gd", 0, {}).ok === true, "can outlast with {W}");
ok(/cannot pay/.test(OL.canOutlast(build(0), "gd", 0, {}).reason), "no mana -> can't pay");
(function () {
  let g = build(1); g = Core.reduce(g, { t: "card_tap", instanceId: "gd", tapped: true });
  ok(/already tapped/.test(OL.canOutlast(g, "gd", 0, {}).reason), "an already-tapped creature can't outlast");
})();

// 3) outlastEvents: pay {W}, tap, add a +1/+1 counter
(function () {
  let g = build(1);
  g = apply(g, OL.outlastEvents(g, "gd", {}));
  ok(g.cards["gd"].tapped === true, "the creature is tapped");
  ok((g.cards["gd"].counters && g.cards["gd"].counters["+1/+1"]) === 1, "it got a +1/+1 counter");
  ok((g.players[0].counters.mana_W || 0) === 0, "outlast cost {W} paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
