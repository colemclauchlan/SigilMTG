// Test for rules-dash.js — cast for dash cost (haste + dashed flag), bounce at the next end step. Pure.
// Run: node tests/rules-dash.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const D = loadInto(G, "rules-dash.js", "MTGRulesDash");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Raider", { types: ["creature"], colors: ["R"], mana: { generic: 2, R: 1 }, power: 3, toughness: 2, dash: { generic: 1, R: 1 } });
Cards.define("Plain Bear", { types: ["creature"], colors: ["G"], mana: { generic: 1, G: 1 }, power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(name, mana) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "atk", name: name, zone: "hand" }], []] });
  if (mana) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: mana });
  return g;
}

// 1) dashCost / canDash legality
(function () {
  ok(J(D.dashCost(Cards.get("Raider"))) === J({ generic: 1, R: 1 }), "reads the dash cost");
  ok(D.canDash(build("Raider", 2), "atk", 0, {}).ok === true, "can dash with {1}{R} available");
  ok(D.canDash(build("Raider", 0), "atk", 0, {}).ok === false, "can't dash with no mana");
  ok(/no dash/.test(D.canDash(build("Plain Bear", 2), "atk", 0, {}).reason), "a creature without dash can't be dashed");
})();

// 2) castDash pays, puts it on the battlefield, grants haste + dashed
(function () {
  let g = build("Raider", 2);
  g = apply(g, D.castDash(g, "atk", 0, {}));
  ok(g.cards["atk"].zone === "battlefield", "the dashed creature enters the battlefield");
  ok(g.cards["atk"].dashed === true && g.cards["atk"].dashHaste === true, "it is flagged dashed + has haste");
  ok((g.players[0].counters.mana_R || 0) === 0, "the {1}{R} dash cost was paid");
})();

// 3) at the next end step a dashed creature returns to its owner's hand (and is no longer dashed)
(function () {
  let g = build("Raider", 2);
  g = apply(g, D.castDash(g, "atk", 0, {}));
  g = apply(g, D.dashReturns(g, {}));
  ok(g.cards["atk"].zone === "hand", "the dashed creature bounces to hand at the next end step");
  ok(g.cards["atk"].dashed === false && g.cards["atk"].dashHaste === false, "dashed/haste cleared on bounce");
})();

// 4) edge case: a normal (non-dashed) creature on the battlefield is NOT returned by dashReturns
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "perm", name: "Plain Bear", zone: "battlefield" }], []] });
  ok(J(D.dashReturns(g, {})) === J([]), "non-dashed permanents are untouched at the end step");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
