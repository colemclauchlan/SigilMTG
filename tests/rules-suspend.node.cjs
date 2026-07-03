// Test for rules-suspend.js — exile with time counters, tick down, cast free at zero. Pure.
// Run: node tests/rules-suspend.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Su = loadInto(G, "rules-suspend.js", "MTGRulesSuspend");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Rift Bolt", { types: ["sorcery"], colors: ["R"], mana: { generic: 2, R: 1 }, suspend: { n: 1, cost: { R: 1 } }, spell: { damage: 3, target: "any" } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sp", name: "Rift Bolt", zone: "hand" }], []] });
}

// 1) suspend exiles the card with N time counters
(function () {
  let g = build();
  g = apply(g, Su.suspend(g, "sp", 3));
  ok(g.cards["sp"].zone === "exile", "the suspended card is exiled");
  ok(Su.timeCounters(g, "sp") === 3, "it has 3 time counters");
  ok(g.cards["sp"].suspended === true, "it's marked suspended");
  ok(Su.readyToCast(g, "sp") === false, "not ready to cast with counters remaining");
})();

// 2) ticking removes one counter per upkeep; at 0 it's castable
(function () {
  let g = build();
  g = apply(g, Su.suspend(g, "sp", 3));
  g = apply(g, Su.tick(g, "sp")); g = apply(g, Su.tick(g, "sp"));
  ok(Su.timeCounters(g, "sp") === 1, "two ticks -> 1 counter left");
  ok(Su.readyToCast(g, "sp") === false, "still not ready");
  g = apply(g, Su.tick(g, "sp"));
  ok(Su.timeCounters(g, "sp") === 0 && Su.readyToCast(g, "sp") === true, "last counter removed -> ready to cast");
})();

// 3) ticking does nothing past zero
(function () {
  let g = build();
  g = apply(g, Su.suspend(g, "sp", 0));
  ok(Su.tick(g, "sp").length === 0, "no tick events at 0 counters");
})();

// 4) casting from suspend moves it to the stack with haste
(function () {
  let g = build();
  g = apply(g, Su.suspend(g, "sp", 1));
  g = apply(g, Su.tick(g, "sp"));
  g = apply(g, Su.castEvents(g, "sp"));
  ok(g.cards["sp"].zone === "stack", "the suspended spell is cast (on the stack)");
  ok(g.cards["sp"].suspendHaste === true, "it has haste until it leaves play");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
