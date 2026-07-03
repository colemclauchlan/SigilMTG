// Test for rules-infect.js — infect/wither damage as -1/-1 counters & poison. Applied through table-core
// (no engine-core). -1/-1 counters flow into effective P/T via the layers. Run: node tests/rules-infect.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
const KW = loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const Inf = loadInto(G, "rules-infect.js", "MTGRulesInfect");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Plague Bear", { types: ["creature"], power: 2, toughness: 2, abilities: ["infect"] });
Cards.define("Wither Bear", { types: ["creature"], power: 2, toughness: 2, abilities: ["wither"] });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Big", { types: ["creature"], power: 4, toughness: 4 });
Cards.define("Infect Lord", { types: ["creature"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["infect"] }] });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(cards) { let g = Core.init({ seats: 2, startingLife: 20 }); return Core.reduce(g, { t: "__add", cards: cards }); }
const bf = (id, name, seat) => ({ instanceId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: "battlefield", counters: {} });

// 1) infect to a player -> poison counters, not life loss
(function () {
  let g = build([bf("inf", "Plague Bear", 0)]);
  g = apply(g, Inf.damageEvents(g, "inf", { kind: "player", seat: 1 }, 3, {}));
  ok((g.players[1].counters.poison || 0) === 3, "infect -> 3 poison");
  ok(g.players[1].life === 20, "infect dealt no life loss");
})();

// 2) infect to a creature -> -1/-1 counters that shrink effective P/T
(function () {
  let g = build([bf("inf", "Plague Bear", 0), bf("big", "Big", 1)]);
  g = apply(g, Inf.damageEvents(g, "inf", { kind: "creature", instanceId: "big" }, 2, {}));
  ok((g.cards["big"].counters["-1/-1"] || 0) === 2, "infect put two -1/-1 counters on the 4/4");
  const e = KW.effectiveFull(g, "big", {});
  ok(e.power === 2 && e.toughness === 2, "the 4/4 is now an effective 2/2");
})();

// 3) wither to a creature -> -1/-1 counters; to a player -> normal life loss
(function () {
  let g = build([bf("wit", "Wither Bear", 0), bf("big", "Big", 1)]);
  g = apply(g, Inf.damageEvents(g, "wit", { kind: "creature", instanceId: "big" }, 1, {}));
  ok((g.cards["big"].counters["-1/-1"] || 0) === 1, "wither -> -1/-1 on a creature");
  g = apply(g, Inf.damageEvents(g, "wit", { kind: "player", seat: 1 }, 3, {}));
  ok(g.players[1].life === 17 && !(g.players[1].counters && g.players[1].counters.poison), "wither to a player is normal damage (no poison)");
})();

// 4) normal damage -> marked damage counter / life loss
(function () {
  let g = build([bf("b", "Bear", 0), bf("big", "Big", 1)]);
  g = apply(g, Inf.damageEvents(g, "b", { kind: "creature", instanceId: "big" }, 2, {}));
  ok((g.cards["big"].counters.damage || 0) === 2 && !(g.cards["big"].counters["-1/-1"]), "normal damage = marked damage, not -1/-1");
  g = apply(g, Inf.damageEvents(g, "b", { kind: "player", seat: 1 }, 2, {}));
  ok(g.players[1].life === 18, "normal damage to a player = life loss");
})();

// 5) GRANTED infect counts (a lord grants it to a teammate)
(function () {
  let g = build([bf("lord", "Infect Lord", 0), bf("mate", "Bear", 0)]);
  ok(Inf.damageKind(g, "mate", {}) === "infect", "teammate deals infect damage (granted)");
  g = apply(g, Inf.damageEvents(g, "mate", { kind: "player", seat: 1 }, 2, {}));
  ok((g.players[1].counters.poison || 0) === 2, "granted infect -> poison on the player");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
