// Test for rules-awaken.js — awaken (CR 702.113): cast for the awaken cost, animate a target land. Pure.
// Run: node tests/rules-awaken.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const AW = loadInto(G, "rules-awaken.js", "MTGRulesAwaken");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Rift", { types: ["instant"], colors: ["U"], mana: { generic: 2, U: 1 }, awaken: { cost: { generic: 5, U: 1 }, n: 3 }, spell: { bounce: true } });
Cards.define("Island", { types: ["land"], produces: "U" });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC, manaU) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "rf", name: "Rift", zone: "hand" },
    { instanceId: "is", name: "Island", zone: "battlefield" },
    { instanceId: "be", name: "Bear", zone: "battlefield" }
  ], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaU) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_U", delta: manaU });
  return g;
}

// 1) awaken info detection
ok(AW.awakenInfo(Cards.get("Rift")).n === 3, "awakenInfo returns { n:3, ... }");
ok(AW.awakenInfo(Cards.get("Bear")) === null, "no awaken -> null");

// 2) canAwaken: target a land you control, cost payable ({5}{U})
ok(AW.canAwaken(build(5, 1), "rf", 0, "is", {}).ok === true, "can awaken targeting the Island with {5}{U}");
ok(/target a land/.test(AW.canAwaken(build(5, 1), "rf", 0, "be", {}).reason), "can't awaken a nonland");
ok(/cannot pay/.test(AW.canAwaken(build(1, 0), "rf", 0, "is", {}).reason), "not enough mana -> can't pay");

// 3) castAwakenEvents: pay {5}{U}, spell to stack, land gets 3 counters + is animated
(function () {
  let g = build(5, 1);
  g = apply(g, AW.castAwakenEvents(g, "rf", "is", {}));
  ok(g.cards["rf"].zone === "stack" && g.cards["rf"].awakened === true, "spell on the stack, flagged awakened");
  ok((g.cards["is"].counters && g.cards["is"].counters["+1/+1"]) === 3, "the land got 3 +1/+1 counters");
  ok(g.cards["is"].animatedLand === true, "the land became a creature");
  ok((g.players[0].counters.mana_C || 0) === 0 && (g.players[0].counters.mana_U || 0) === 0, "awaken cost {5}{U} paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
