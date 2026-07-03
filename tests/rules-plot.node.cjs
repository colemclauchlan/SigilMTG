// Test for rules-plot.js — plot: exile from hand for the plot cost, cast free on a LATER turn. Pure.
// Run: node tests/rules-plot.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const PL = loadInto(G, "rules-plot.js", "MTGRulesPlot");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Plotter", { types: ["sorcery"], colors: ["R"], mana: { generic: 2, R: 1 }, plot: { generic: 1, R: 1 }, spell: { damage: 2, target: "any" } });
Cards.define("Unplottable", { types: ["sorcery"], mana: { generic: 1 }, spell: { damage: 1, target: "any" } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC, manaR) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sp", name: "Plotter", zone: "hand" }], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaR) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: manaR });
  return g;
}

// 1) canPlot with the plot cost available ({1}{R})
ok(PL.canPlot(build(1, 1), "sp", 0, {}).ok === true, "can plot with {1}{R} available");
// 2) can't plot without mana / without a plot cost
ok(PL.canPlot(build(0, 0), "sp", 0, {}).ok === false, "no mana -> can't plot");
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sp2", name: "Unplottable", zone: "hand" }], []] });
  ok(/no plot/.test(PL.canPlot(g, "sp2", 0, {}).reason), "no plot cost -> rejected");
})();

// 3) plotEvents: pays the cost, exiles the card, records the turn
(function () {
  let g = build(1, 1);
  g = apply(g, PL.plotEvents(g, "sp", 3, {}));
  ok(g.cards["sp"].zone === "exile", "plotted card is exiled");
  ok(g.cards["sp"].plotted === true && g.cards["sp"].plottedTurn === 3, "marked plotted on turn 3");
  ok((g.players[0].counters.mana_C || 0) === 0 && (g.players[0].counters.mana_R || 0) === 0, "plot cost paid");
})();

// 4) can't cast a plotted card the SAME turn it was plotted
(function () {
  let g = build(1, 1);
  g = apply(g, PL.plotEvents(g, "sp", 3, {}));
  ok(PL.canCastPlotted(g, "sp", 0, 3).ok === false, "same turn -> can't cast plotted");
})();

// 5) CAN cast it on a later turn
(function () {
  let g = build(1, 1);
  g = apply(g, PL.plotEvents(g, "sp", 3, {}));
  ok(PL.canCastPlotted(g, "sp", 0, 4).ok === true, "later turn -> can cast plotted");
})();

// 6) castPlottedEvents moves it exile -> stack (free)
(function () {
  let g = build(1, 1);
  g = apply(g, PL.plotEvents(g, "sp", 3, {}));
  g = apply(g, PL.castPlottedEvents(g, "sp"));
  ok(g.cards["sp"].zone === "stack", "plotted card cast for free onto the stack");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
