// Test for rules-goad.js — goaded creatures must attack, and not their goader (when another player is
// attackable). Pure, through table-core (no engine-core). Run: node tests/rules-goad.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-sickness.js", "MTGRulesSickness");
const Goad = loadInto(G, "rules-goad.js", "MTGRulesGoad");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Beast", { types: ["creature"], power: 3, toughness: 3 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(seats, cards) { let g = Core.init({ seats: seats, startingLife: 40 }); return Core.reduce(g, { t: "__add", cards: cards }); }
const bf = (id, seat, extra) => Object.assign({ instanceId: id, name: "Beast", ownerSeat: seat, controllerSeat: seat, zone: "battlefield", counters: {}, tapped: false, attacking: false }, extra || {});

// 4-player: seat 0's Beast goaded by seat 1
(function () {
  let g = build(4, [bf("a", 0)]);
  g = apply(g, [Goad.setGoad("a", 1)]);
  ok(Goad.isGoaded(g, "a") === true, "the creature is goaded");
  ok(Goad.mustAttack(g, "a", {}) === true, "an untapped goaded creature must attack");

  ok(Goad.validateAttackPlan(g, 0, [], {}).ok === false, "not attacking with the goaded creature is illegal");
  const atGoader = Goad.validateAttackPlan(g, 0, [{ attacker: "a", defender: 1 }], {});
  ok(atGoader.ok === false && /goader/.test(atGoader.violations[0].reason), "attacking the goader (seat 1) is illegal while seats 2/3 exist");
  ok(Goad.validateAttackPlan(g, 0, [{ attacker: "a", defender: 2 }], {}).ok === true, "attacking another player (seat 2) is legal");

  g = apply(g, Goad.clearGoad(g, 1));
  ok(Goad.isGoaded(g, "a") === false, "clearGoad ends it at the goader's end of turn");
})();

// a TAPPED goaded creature is not REQUIRED to attack (it can't)
(function () {
  let g = build(4, [bf("a", 0, { tapped: true })]);
  g = apply(g, [Goad.setGoad("a", 1)]);
  ok(Goad.mustAttack(g, "a", {}) === false, "a tapped goaded creature isn't required to attack");
  ok(Goad.validateAttackPlan(g, 0, [], {}).ok === true, "...so an empty attack is legal");
})();

// 2-player: the goaded creature MAY attack the goader (no other player exists)
(function () {
  let g = build(2, [bf("a", 0)]);
  g = apply(g, [Goad.setGoad("a", 1)]);
  ok(Goad.validateAttackPlan(g, 0, [{ attacker: "a", defender: 1 }], {}).ok === true, "2-player: attacking the goader is the only option, so it's legal");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
