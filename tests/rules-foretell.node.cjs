// Test for rules-foretell.js — exile face-down for {2}, cast later for the foretell cost. Pure.
// Run: node tests/rules-foretell.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const F = loadInto(G, "rules-foretell.js", "MTGRulesForetell");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Saw It Coming", { types: ["instant"], colors: ["U"], mana: { generic: 2, U: 1 }, foretell: { generic: 1, U: 1 }, spell: { effects: [] } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaU, manaC) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sp", name: "Saw It Coming", zone: "hand" }], []] });
  if (manaU) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_U", delta: manaU });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}

// 1) foretelling exiles the card face-down for {2}
(function () {
  let g = build(1, 3);   // 1 U + 3 colorless
  g = apply(g, F.foretellEvents(g, "sp", {}));
  ok(g.cards["sp"].zone === "exile" && g.cards["sp"].faceDown === true && g.cards["sp"].foretold === true, "foretold: exiled face-down + marked");
  ok((g.players[0].counters.mana_C || 0) === 1, "the {2} foretell cost was paid (3 - 2 colorless)");
})();

// 2) cast it later for its foretell cost {1}{U}
(function () {
  let g = build(1, 3);
  g = apply(g, F.foretellEvents(g, "sp", {}));   // spends 2 colorless, leaves U:1 + C:1
  ok(F.canCastForetold(g, "sp", 0, {}).ok === true, "can cast the foretold card for {1}{U}");
  g = apply(g, F.castForetoldEvents(g, "sp", {}));
  ok(g.cards["sp"].zone === "stack", "the foretold card is cast (on the stack)");
  ok(g.cards["sp"].faceDown === false, "it's turned face up to cast");
  ok((g.players[0].counters.mana_U || 0) === 0 && (g.players[0].counters.mana_C || 0) === 0, "the {1}{U} foretell cost was paid");
})();

// 3) can't cast a foretold card without the foretell mana, and a non-foretold card isn't castable this way
(function () {
  let g = build(0, 2);
  g = apply(g, F.foretellEvents(g, "sp", {}));   // spends the 2 colorless
  ok(/cannot pay/.test(F.canCastForetold(g, "sp", 0, {}).reason), "no foretell mana -> can't cast it");
  let g2 = build(5, 5);
  ok(/not a foretold/.test(F.canCastForetold(g2, "sp", 0, {}).reason), "a card still in hand isn't a foretold-in-exile card");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
