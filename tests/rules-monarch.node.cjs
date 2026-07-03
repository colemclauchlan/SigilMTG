// Test for rules-monarch.js — one monarch at a time, end-step draw, steal via combat damage.
// Pure, through table-core (no engine-core). Run: node tests/rules-monarch.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Mon = loadInto(G, "rules-monarch.js", "MTGRulesMonarch");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
// give each seat a couple of library cards so a "draw" has something to draw
function build(seats) {
  let g = Core.init({ seats: seats, startingLife: 40 });
  let cards = [];
  for (let s = 0; s < seats; s++) for (let i = 0; i < 3; i++) cards.push({ instanceId: "l" + s + "_" + i, name: "Forest", ownerSeat: s, controllerSeat: s, zone: "library", pos: i, counters: {} });
  return Core.reduce(g, { t: "__add", cards: cards });
}

// 1) becoming the monarch (and only one at a time)
(function () {
  let g = build(4);
  ok(Mon.monarch(g) === null, "no monarch initially");
  g = apply(g, Mon.setMonarch(g, 1));
  ok(Mon.monarch(g) === 1, "seat 1 is the monarch");
  g = apply(g, Mon.setMonarch(g, 3));
  ok(Mon.monarch(g) === 3 && g.players[1].isMonarch === false, "crown moves to seat 3; seat 1 no longer monarch");
})();

// 2) the monarch draws at their end step; others don't
(function () {
  let g = build(4);
  g = apply(g, Mon.setMonarch(g, 2));
  ok(Mon.endStepDraw(g, 2).length === 1, "the monarch draws at their end step");
  ok(Mon.endStepDraw(g, 0).length === 0, "a non-monarch draws nothing");
  const before = Core.cardsOf(g, 2, "hand").length;
  g = apply(g, Mon.endStepDraw(g, 2));
  ok(Core.cardsOf(g, 2, "hand").length === before + 1, "the end-step draw actually drew a card");
})();

// 3) dealing combat damage to the monarch steals the crown
(function () {
  let g = build(4);
  g = apply(g, Mon.setMonarch(g, 0));
  g = apply(g, Mon.onCombatDamageToMonarch(g, 2)); // seat 2 connected with the monarch (seat 0)
  ok(Mon.monarch(g) === 2, "seat 2 stole the crown by dealing combat damage");
  // the monarch hitting nobody / the monarch themselves changes nothing
  ok(Mon.onCombatDamageToMonarch(g, 2).length === 0, "the current monarch dealing damage doesn't change the crown");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
