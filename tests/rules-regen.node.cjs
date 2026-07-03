// Test for rules-regen.js — a regeneration shield replaces destruction (tap + remove damage + out of
// combat); no shield = death. Applied through table-core (no engine-core). Run: node tests/rules-regen.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const R = loadInto(G, "rules-regen.js", "MTGRulesRegen");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Troll", { types: ["creature"], power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(cards) { let g = Core.init({ seats: 2, startingLife: 20 }); return Core.reduce(g, { t: "__add", cards: cards }); }
const bf = (id, name, seat, extra) => Object.assign({ instanceId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: "battlefield", counters: {}, tapped: false, attacking: false }, extra || {});

// 1) a shielded creature that would be destroyed regenerates instead
(function () {
  let g = build([bf("t", "Troll", 0, { counters: { regen: 1, damage: 2 }, attacking: true })]);
  const r = R.applyDestroy(g, "t", {});
  ok(r.regenerated === true, "shielded creature regenerates");
  g = apply(g, r.events);
  ok(g.cards["t"].zone === "battlefield", "it stays on the battlefield");
  ok(g.cards["t"].tapped === true, "it becomes tapped");
  ok(g.cards["t"].attacking === false, "it's removed from combat");
  ok((g.cards["t"].counters.damage || 0) === 0, "all damage is removed");
  ok((g.cards["t"].counters.regen || 0) === 0, "the shield was consumed");
})();

// 2) no shield -> it dies
(function () {
  let g = build([bf("t", "Troll", 0)]);
  const r = R.applyDestroy(g, "t", {});
  ok(r.regenerated === false, "unshielded creature is not regenerated");
  g = apply(g, r.events);
  ok(g.cards["t"].zone === "graveyard", "it goes to the graveyard");
})();

// 3) multiple shields -> consumes exactly one
(function () {
  let g = build([bf("t", "Troll", 0, { counters: { regen: 2 } })]);
  g = apply(g, R.applyDestroy(g, "t", {}).events);
  ok((g.cards["t"].counters.regen || 0) === 1, "one shield consumed, one remains");
})();

// 4) addShield grants a shield; clearShields wipes them (end of turn)
(function () {
  let g = build([bf("t", "Troll", 0)]);
  g = apply(g, [R.addShield("t")]);
  ok(R.hasShield(g, "t") === true, "addShield grants a regeneration shield");
  g = apply(g, R.clearShields(g));
  ok(R.hasShield(g, "t") === false, "clearShields removes shields at end of turn");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
