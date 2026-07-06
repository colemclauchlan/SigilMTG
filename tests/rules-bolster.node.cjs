// Test for rules-bolster.js — bolster N (CR 701.30): +N +1/+1 counters on your least-toughness creature.
// Pure. Run: node tests/rules-bolster.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const BO = loadInto(G, "rules-bolster.js", "MTGRulesBolster");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x.slice().sort());

Cards.define("Big", { types: ["creature"], power: 5, toughness: 5, mana: { generic: 5 } });
Cards.define("Small", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });
Cards.define("Tiny", { types: ["creature"], power: 1, toughness: 2, mana: { generic: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "big", name: "Big", zone: "battlefield" },
    { instanceId: "sm", name: "Small", zone: "battlefield" },
    { instanceId: "ti", name: "Tiny", zone: "battlefield" }
  ], []] });
}

// 1) effective toughness (base + counters)
(function () {
  let g = build();
  ok(BO.effToughness(g, "big", {}) === 5, "Big toughness 5");
  g = Core.reduce(g, { t: "card_counter", instanceId: "ti", kind: "-1/-1", delta: 1 });
  ok(BO.effToughness(g, "ti", {}) === 1, "Tiny with a -1/-1 counter -> toughness 1");
})();

// 2) leastToughness: Small + Tiny tie at 2; a -1/-1 makes Tiny the sole least
ok(J(BO.leastToughness(build(), 0, {})) === J(["sm", "ti"]), "Small + Tiny tie for least toughness");
(function () {
  let g = build(); g = Core.reduce(g, { t: "card_counter", instanceId: "ti", kind: "-1/-1", delta: 1 });
  ok(J(BO.leastToughness(g, 0, {})) === J(["ti"]), "Tiny alone is least after -1/-1");
})();

// 3) canBolster: only a least-toughness creature is a legal choice
ok(BO.canBolster(build(), "sm", 0, {}).ok === true, "Small is a legal bolster target");
ok(/least toughness/.test(BO.canBolster(build(), "big", 0, {}).reason), "Big (toughness 5) isn't a legal target");

// 4) bolsterEvents: N +1/+1 counters on the chosen creature
(function () {
  let g = build();
  g = apply(g, BO.bolsterEvents(g, "sm", 2, {}));
  ok((g.cards["sm"].counters && g.cards["sm"].counters["+1/+1"]) === 2, "Small got 2 +1/+1 counters");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
