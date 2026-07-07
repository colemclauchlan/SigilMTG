// Test for rules-renown.js — renown (CR 702.111): first combat damage to a player puts N +1/+1
// counters on the creature and it becomes renowned (once ever). Pure.
// Run: node tests/rules-renown.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const RN = loadInto(G, "rules-renown.js", "MTGRulesRenown");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function apply(g, evs) { evs.forEach(function (e) { g = Core.reduce(g, e); }); return g; }

Cards.define("Relic Seeker", { types: ["creature"], power: 2, toughness: 2, renown: 1 });
Cards.define("Rhox Maulers", { types: ["creature"], power: 4, toughness: 4, renown: 2 });
Cards.define("Grizzly Bears", { types: ["creature"], power: 2, toughness: 2 });

function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "rs", name: "Relic Seeker", zone: "battlefield" },
    { instanceId: "rm", name: "Rhox Maulers", zone: "battlefield" },
    { instanceId: "gb", name: "Grizzly Bears", zone: "battlefield" },
    { instanceId: "hd", name: "Relic Seeker", zone: "hand" }
  ], []] });
}

// 1) gates
let g = build();
ok(RN.renownValue(Cards.get("Rhox Maulers")) === 2, "renownValue reads the def");
ok(RN.renownValue(Cards.get("Grizzly Bears")) === null, "no renown -> null");
ok(RN.canRenown(g, "rs").ok === true, "battlefield renown creature can become renowned");
ok(/no renown/.test(RN.canRenown(g, "gb").reason), "vanilla creature rejected");
ok(/battlefield/.test(RN.canRenown(g, "hd").reason), "hand card rejected");
ok(/no such/.test(RN.canRenown(g, "nope").reason), "unknown id rejected");

// 2) becoming renowned: counters + flag
g = apply(g, RN.renownEvents(g, "rm"));
ok((g.cards["rm"].counters["+1/+1"] || 0) === 2, "renown 2 -> two +1/+1 counters");
ok(RN.isRenowned(g, "rm") === true, "flagged renowned");

// 3) renown fires once ever
ok(RN.canRenown(g, "rm").ok === false && /already/.test(RN.canRenown(g, "rm").reason), "already renowned rejected");
ok(RN.renownEvents(g, "rm").length === 0, "second hit -> no events");
g = apply(g, RN.renownEvents(g, "rm"));
ok((g.cards["rm"].counters["+1/+1"] || 0) === 2, "counters unchanged on repeat");

// 4) renown 1 path + independence between cards
g = apply(g, RN.renownEvents(g, "rs"));
ok((g.cards["rs"].counters["+1/+1"] || 0) === 1 && RN.isRenowned(g, "rs"), "renown 1 -> one counter + flag");
ok(!RN.isRenowned(g, "gb"), "other cards untouched");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
