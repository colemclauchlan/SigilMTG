// Test for rules-proliferate.js — add one of each existing counter; skip damage/regen/sick/mana.
// Pure (no engine-core). Run: node tests/rules-proliferate.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
const KW = loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const Pro = loadInto(G, "rules-proliferate.js", "MTGRulesProliferate");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Hydra", { types: ["creature"], power: 0, toughness: 0 });
Cards.define("Walker", { types: ["planeswalker"], loyalty: 4 });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(cards, setup) { let g = Core.init({ seats: 2, startingLife: 20 }); g = Core.reduce(g, { t: "__add", cards: cards }); return setup ? setup(g) : g; }
const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: "battlefield", counters: counters || {} });

// 1) proliferate adds one of each existing counter kind to chosen permanents/players
(function () {
  let g = build([bf("h", "Hydra", 0, { "+1/+1": 2 }), bf("w", "Walker", 0, { loyalty: 4 })]);
  g = Core.reduce(g, { t: "player_counter", seat: 1, kind: "poison", delta: 3 });
  g = apply(g, Pro.proliferateEvents(g, { cards: ["h", "w"], players: [1] }));
  ok(g.cards["h"].counters["+1/+1"] === 3, "Hydra: +1/+1 2 -> 3");
  ok(g.cards["w"].counters.loyalty === 5, "Walker: loyalty 4 -> 5");
  ok(g.players[1].counters.poison === 4, "opponent: poison 3 -> 4");
})();

// 2) -1/-1 counters proliferate too, and the effective P/T reflects it
(function () {
  let g = build([bf("b", "Bear", 0, { "-1/-1": 1 })]);
  g = apply(g, Pro.proliferateAll(g));
  ok(g.cards["b"].counters["-1/-1"] === 2, "-1/-1 1 -> 2");
  ok(KW.effectiveFull(g, "b", {}).power === 0, "the 2/2 Bear is now an effective 0/0 (two -1/-1)");
})();

// 3) NON-counter bookkeeping is skipped (marked damage, regen shield, mana pool)
(function () {
  let g = build([bf("b", "Bear", 0, { damage: 1, regen: 1, sick: 1 })]);
  g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_G", delta: 2 });
  const t = Pro.proliferateTargets(g);
  ok(t.cards.indexOf("b") < 0, "a creature with only damage/regen/sick is NOT a proliferate target");
  ok(t.players.indexOf(0) < 0, "a player with only mana in the pool is NOT a target");
  g = apply(g, Pro.proliferateAll(g));
  ok(g.cards["b"].counters.damage === 1 && (g.players[0].counters.mana_G === 2), "damage & mana are untouched by proliferate");
})();

// 4) choosing a subset only affects the chosen permanents
(function () {
  let g = build([bf("a", "Hydra", 0, { "+1/+1": 1 }), bf("b", "Hydra", 0, { "+1/+1": 1 })]);
  g = apply(g, Pro.proliferateEvents(g, { cards: ["a"] }));
  ok(g.cards["a"].counters["+1/+1"] === 2 && g.cards["b"].counters["+1/+1"] === 1, "only the chosen Hydra grew");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
