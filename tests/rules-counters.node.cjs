// Test for rules-counters.js — +1/+1 / -1/-1 annihilation (SBA) + bolster. Pure (no engine-core).
// Run: node tests/rules-counters.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
const KW = loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const Ct = loadInto(G, "rules-counters.js", "MTGRulesCounters");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Hydra", { types: ["creature"], power: 0, toughness: 0 });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Wall", { types: ["creature"], power: 0, toughness: 4 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(cards) { let g = Core.init({ seats: 2, startingLife: 20 }); return Core.reduce(g, { t: "__add", cards: cards }); }
const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: "battlefield", counters: counters || {} });

// 1) annihilation removes equal +1/+1 and -1/-1 counters
(function () {
  let g = build([bf("h", "Hydra", 0, { "+1/+1": 3, "-1/-1": 1 })]);
  g = apply(g, Ct.annihilateEvents(g));
  ok((g.cards["h"].counters["+1/+1"] || 0) === 2 && (g.cards["h"].counters["-1/-1"] || 0) === 0, "3 +1/+1 & 1 -1/-1 -> 2 +1/+1, 0 -1/-1");
  ok(KW.effectiveFull(g, "h", {}).power === 2, "the 0/0 Hydra is now an effective 2/2");
})();

// 2) a 0/0 with one of each annihilates to ZERO counters (then dies by toughness SBA elsewhere)
(function () {
  let g = build([bf("h", "Hydra", 0, { "+1/+1": 1, "-1/-1": 1 })]);
  g = apply(g, Ct.annihilateEvents(g));
  ok((g.cards["h"].counters["+1/+1"] || 0) === 0 && (g.cards["h"].counters["-1/-1"] || 0) === 0, "1 & 1 -> 0 counters");
  ok(KW.effectiveFull(g, "h", {}).toughness === 0, "back to a 0/0 (would die to the toughness SBA)");
})();

// 3) only +1/+1 (no -1/-1) -> nothing annihilates
(function () {
  let g = build([bf("b", "Bear", 0, { "+1/+1": 2 })]);
  ok(Ct.annihilateEvents(g).length === 0, "no -1/-1 present -> no annihilation events");
})();

// 4) bolster N puts the counters on the lowest-toughness creature you control
(function () {
  let g = build([bf("bear", "Bear", 0), bf("wall", "Wall", 0)]); // Bear t2 < Wall t4
  g = apply(g, Ct.bolster(g, 0, 2, {}));
  ok((g.cards["bear"].counters["+1/+1"] || 0) === 2 && !(g.cards["wall"].counters["+1/+1"]), "bolster 2 went on the 2-toughness Bear, not the Wall");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
