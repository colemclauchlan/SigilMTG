// Test for rules-emerge.js — cast by sacrificing a creature, emerge cost reduced by its CMC. Pure.
// Run: node tests/rules-emerge.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const EM = loadInto(G, "rules-emerge.js", "MTGRulesEmerge");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Elder Deep-Fiend", { types: ["creature"], colors: ["U"], mana: { generic: 8 }, emerge: { generic: 6, U: 1 } });
Cards.define("Pilgrim", { types: ["creature"], colors: ["W"], mana: { generic: 2, W: 1 } }); // CMC 3
Cards.define("No Emerge Guy", { types: ["creature"], mana: { generic: 3 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC, manaU) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "sp", name: "Elder Deep-Fiend", zone: "hand" },
    { instanceId: "sac", name: "Pilgrim", zone: "battlefield" }
  ], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaU) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_U", delta: manaU });
  return g;
}

// 1) reducedCost math: {6}{U} minus a CMC-3 creature -> {3}{U}
ok(J(EM.reducedCost({ generic: 6, U: 1 }, 3)) === J({ generic: 3, U: 1 }), "reducedCost {6}{U} - 3 = {3}{U}");
// 2) reduction floors generic at 0 and drops it
ok(J(EM.reducedCost({ generic: 2, U: 1 }, 5)) === J({ U: 1 }), "reduction floors generic at 0");
// 3) cmcOf sums the mana cost
ok(EM.cmcOf(Cards.get("Pilgrim")) === 3, "cmcOf Pilgrim = 3");

// 4) canEmerge true when the reduced cost is affordable ({3}{U} = 3 generic + U)
(function () {
  let g = build(3, 1);
  const chk = EM.canEmerge(g, "sp", "sac", {});
  ok(chk.ok === true, "can emerge with {3}{U} available after CMC-3 reduction");
  ok(J(chk.cost) === J({ generic: 3, U: 1 }), "canEmerge reports the reduced cost");
})();

// 5) canEmerge false without enough mana
ok(EM.canEmerge(build(1, 0), "sp", "sac", {}).ok === false, "not enough mana -> can't emerge");

// 6) no emerge cost on the spell -> rejected
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "sp2", name: "No Emerge Guy", zone: "hand" },
    { instanceId: "sac", name: "Pilgrim", zone: "battlefield" }
  ], []] });
  ok(EM.canEmerge(g, "sp2", "sac", {}).ok === false, "no emerge -> rejected");
})();

// 7) castEmerge sacrifices the creature, pays the reduced cost, and puts the spell on the battlefield
(function () {
  let g = build(3, 1);
  g = apply(g, EM.castEmerge(g, "sp", "sac", {}));
  ok(g.cards["sac"].zone === "graveyard", "the sacrificed creature is in the graveyard");
  ok(g.cards["sp"].zone === "battlefield", "the emerged creature entered the battlefield");
  ok((g.players[0].counters.mana_C || 0) === 0 && (g.players[0].counters.mana_U || 0) === 0, "the reduced emerge cost was paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
