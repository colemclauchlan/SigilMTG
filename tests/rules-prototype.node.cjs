// Test for rules-prototype.js — cast as a smaller colored creature (alt cost + set P/T + colors). Pure.
// Run: node tests/rules-prototype.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const PR = loadInto(G, "rules-prototype.js", "MTGRulesPrototype");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Phyrexian Fleshgorger", { types: ["artifact", "creature"], colors: [], mana: { generic: 7 }, power: 7, toughness: 5,
  abilities: ["lifelink", "menace"], prototype: { cost: { generic: 1, B: 1 }, colors: ["B"], power: 3, toughness: 3 } });
Cards.define("Plain Golem", { types: ["artifact", "creature"], colors: [], mana: { generic: 4 }, power: 4, toughness: 4 });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "hand", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) hasPrototype
ok(PR.hasPrototype(Cards.get("Phyrexian Fleshgorger")) === true, "hasPrototype true");
ok(PR.hasPrototype(Cards.get("Plain Golem")) === false, "hasPrototype false");

// 2) modeCost: full vs prototype
ok(J(PR.modeCost(Cards.get("Phyrexian Fleshgorger"), "full")) === J({ generic: 7 }), "full cost {7}");
ok(J(PR.modeCost(Cards.get("Phyrexian Fleshgorger"), "prototype")) === J({ generic: 1, B: 1 }), "prototype cost {1}{B}");

// 3) modeStats: full = 7/5 colorless, prototype = 3/3 black
(function () {
  const full = PR.modeStats(Cards.get("Phyrexian Fleshgorger"), "full");
  ok(full.power === 7 && full.toughness === 5 && full.colors.length === 0, "full = 7/5 colorless");
  const proto = PR.modeStats(Cards.get("Phyrexian Fleshgorger"), "prototype");
  ok(proto.power === 3 && proto.toughness === 3 && J(proto.colors) === J(["B"]), "prototype = 3/3 black");
})();

// 4) castEvents in prototype mode marks prototypeMode true
(function () {
  const g = game({ c: bf("c", "Phyrexian Fleshgorger", 0) });
  const ev = PR.castEvents(g, "c", "prototype", {});
  ok(ev[0].t === "card_move" && ev[0].toZone === "stack", "moved to stack");
  const mark = ev.find(e => e.t === "__set");
  ok(mark && mark.cards[0].fields.prototypeMode === true, "prototypeMode marked true");
})();

// 5) castEvents in full mode marks prototypeMode false
(function () {
  const g = game({ c: bf("c", "Phyrexian Fleshgorger", 0) });
  const ev = PR.castEvents(g, "c", "full", {});
  const mark = ev.find(e => e.t === "__set");
  ok(mark && mark.cards[0].fields.prototypeMode === false, "full cast -> prototypeMode false");
})();

// 6) prototype cast on a card without prototype -> no events
(function () {
  const g = game({ c: bf("c", "Plain Golem", 0) });
  ok(PR.castEvents(g, "c", "prototype", {}).length === 0, "no prototype ability -> [] for prototype cast");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
