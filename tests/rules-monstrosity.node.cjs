// Test for rules-monstrosity.js — monstrosity N (CR 701.31): once, add N +1/+1 counters + become monstrous.
// Pure. Run: node tests/rules-monstrosity.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const MO = loadInto(G, "rules-monstrosity.js", "MTGRulesMonstrosity");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Hydra", { types: ["creature"], colors: ["G"], mana: { generic: 3, G: 1 }, power: 4, toughness: 4, monstrosity: { n: 3, cost: { generic: 5 } } });
Cards.define("Vanilla", { types: ["creature"], mana: { generic: 2 }, power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "hy", name: "Hydra", zone: "battlefield" }], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}

// 1) info detection
ok(MO.monstrosityInfo(Cards.get("Hydra")).n === 3, "monstrosityInfo returns { n:3, ... }");
ok(MO.monstrosityInfo(Cards.get("Vanilla")) === null, "no monstrosity -> null");

// 2) canMonstrosity: on battlefield, not monstrous, cost payable ({5})
ok(MO.canMonstrosity(build(5), "hy", 0, {}).ok === true, "can become monstrous with {5}");
ok(/cannot pay/.test(MO.canMonstrosity(build(2), "hy", 0, {}).reason), "only {2} -> can't pay");
(function () {
  let g = build(5); g = Core.reduce(g, { t: "__set", cards: [{ id: "hy", fields: { monstrous: true } }] });
  ok(/already monstrous/.test(MO.canMonstrosity(g, "hy", 0, {}).reason), "can't become monstrous twice");
})();

// 3) monstrosityEvents: pay {5}, add 3 +1/+1 counters, mark monstrous
(function () {
  let g = build(5);
  g = apply(g, MO.monstrosityEvents(g, "hy", {}));
  ok((g.cards["hy"].counters && g.cards["hy"].counters["+1/+1"]) === 3, "3 +1/+1 counters added");
  ok(g.cards["hy"].monstrous === true, "flagged monstrous");
  ok((g.players[0].counters.mana_C || 0) === 0, "monstrosity cost {5} paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
