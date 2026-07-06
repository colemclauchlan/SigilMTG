// Test for rules-scavenge.js — scavenge (CR 702.81): exile from graveyard, N +1/+1 counters on a creature.
// Pure. Run: node tests/rules-scavenge.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const SC = loadInto(G, "rules-scavenge.js", "MTGRulesScavenge");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Corpse", { types: ["creature"], power: 5, toughness: 5, mana: { generic: 4, G: 1 }, scavenge: { cost: { generic: 3, G: 1 }, n: 2 } });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });
Cards.define("Rock", { types: ["artifact"], mana: { generic: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC, manaG) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "co", name: "Corpse", zone: "graveyard" },
    { instanceId: "be", name: "Bear", zone: "battlefield" },
    { instanceId: "ro", name: "Rock", zone: "battlefield" }
  ], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaG) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_G", delta: manaG });
  return g;
}

// 1) scavenge info detection
ok(SC.scavengeInfo(Cards.get("Corpse")).n === 2, "scavengeInfo returns { n:2, ... }");
ok(SC.scavengeInfo(Cards.get("Bear")) === null, "no scavenge -> null");

// 2) canScavenge: in graveyard, creature target, cost payable ({3}{G})
ok(SC.canScavenge(build(3, 1), "co", 0, "be", {}).ok === true, "can scavenge onto the Bear with {3}{G}");
ok(/cannot pay/.test(SC.canScavenge(build(1, 0), "co", 0, "be", {}).reason), "not enough mana -> can't pay");
ok(/must be a creature/.test(SC.canScavenge(build(3, 1), "co", 0, "ro", {}).reason), "can't target the artifact");
(function () {
  let g = build(3, 1); g = Core.reduce(g, { t: "card_move", instanceId: "co", toZone: "hand" });
  ok(/from your graveyard/.test(SC.canScavenge(g, "co", 0, "be", {}).reason), "not in graveyard -> rejected");
})();

// 3) scavengeEvents: pay {3}{G}, exile the card, add 2 counters to the target
(function () {
  let g = build(3, 1);
  g = apply(g, SC.scavengeEvents(g, "co", "be", {}));
  ok(g.cards["co"].zone === "exile", "the scavenged card is exiled");
  ok((g.cards["be"].counters && g.cards["be"].counters["+1/+1"]) === 2, "Bear got 2 +1/+1 counters");
  ok((g.players[0].counters.mana_C || 0) === 0 && (g.players[0].counters.mana_G || 0) === 0, "scavenge cost {3}{G} paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
