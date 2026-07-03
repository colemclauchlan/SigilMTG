// Test for rules-phasing.js — phased-out permanents "don't exist"; phase back in at untap. Pure.
// Run: node tests/rules-phasing.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const P = loadInto(G, "rules-phasing.js", "MTGRulesPhasing");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(n) {
  let cards = [];
  for (let i = 0; i < n; i++) cards.push({ instanceId: "c" + i, name: "Bear", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, phased: false });
  let g = Core.init({ seats: 2, startingLife: 20 });
  return Core.reduce(g, { t: "__add", cards: cards });
}

// 1) phasing out -> the permanent "doesn't exist" for the rules
(function () {
  let g = build(1);
  ok(P.existsForRules(g, "c0") === true, "the Bear exists before phasing");
  g = apply(g, P.phaseEvents("c0"));
  ok(P.isPhasedOut(g, "c0") === true, "the Bear is phased out");
  ok(P.existsForRules(g, "c0") === false, "...so it doesn't exist for the rules");
})();

// 2) phasing back in
(function () {
  let g = build(1);
  g = apply(g, P.phaseEvents("c0"));
  g = apply(g, P.phaseEvents("c0"));
  ok(P.isPhasedOut(g, "c0") === false && P.existsForRules(g, "c0") === true, "phasing back in restores it");
})();

// 3) phaseInAll brings back all of a seat's phased-out permanents at untap
(function () {
  let g = build(3);
  g = apply(g, P.phaseEvents("c0"));
  g = apply(g, P.phaseEvents("c2"));   // c0 and c2 phased out, c1 in
  const ev = P.phaseInAll(g, 0);
  ok(ev.length === 2, "two phased-out permanents to phase in");
  g = apply(g, ev);
  ok(!P.isPhasedOut(g, "c0") && !P.isPhasedOut(g, "c2"), "both phased back in");
  ok(P.phaseInAll(g, 0).length === 0, "nothing left phased out");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
