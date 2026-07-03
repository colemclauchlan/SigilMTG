// Test for rules-extort.js — on cast, pay {W/B} to drain each opponent 1 and gain that much.
// Run: node tests/rules-extort.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const E = loadInto(G, "rules-extort.js", "MTGRulesExtort");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Crypt Ghast", { types: ["creature"], power: 2, toughness: 2, abilities: ["extort"] });
Cards.define("Vanilla", { types: ["creature"], power: 1, toughness: 1 });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 4, players: [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }], cards: cards });

// 1) hasExtort
ok(E.hasExtort(game({ a: bf("a", "Crypt Ghast", 0) }), "a", {}) === true, "hasExtort true");
ok(E.hasExtort(game({ b: bf("b", "Vanilla", 0) }), "b", {}) === false, "hasExtort false");

// 2) extortSources: only your extort permanents on the battlefield
(function () {
  const g = game({ a: bf("a", "Crypt Ghast", 0), b: bf("b", "Vanilla", 0), c: bf("c", "Crypt Ghast", 1) });
  ok(JSON.stringify(E.extortSources(g, 0, {})) === JSON.stringify(["a"]), "one source for seat 0");
})();

// 3) two extort sources -> two triggers available
(function () {
  const g = game({ a: bf("a", "Crypt Ghast", 0), a2: bf("a2", "Crypt Ghast", 0) });
  ok(E.extortSources(g, 0, {}).length === 2, "two extort sources");
})();

// 4) extortEvents: paying once against 3 opponents -> each -1, caster +3
(function () {
  const g = game({ a: bf("a", "Crypt Ghast", 0) });
  const ev = E.extortEvents(g, 0, [1, 2, 3], 1, {});
  const drains = ev.filter(e => e.delta === -1);
  const gain = ev.find(e => e.seat === 0);
  ok(drains.length === 3 && gain && gain.delta === 3, "1 extort vs 3 opps -> -1 each, +3 caster");
})();

// 5) paying twice against 1 opponent -> opp -2, caster +2
(function () {
  const g = game({ a: bf("a", "Crypt Ghast", 0) });
  const ev = E.extortEvents(g, 0, [1], 2, {});
  const opp = ev.find(e => e.seat === 1), gain = ev.find(e => e.seat === 0);
  ok(opp.delta === -2 && gain.delta === 2, "2 extort vs 1 opp -> -2 opp, +2 caster");
})();

// 6) paying zero times -> no events
ok(E.extortEvents(game({ a: bf("a", "Crypt Ghast", 0) }), 0, [1, 2], 0, {}).length === 0, "0 paid -> []");

// 7) caster seat is excluded from opponent list
(function () {
  const g = game({ a: bf("a", "Crypt Ghast", 0) });
  const ev = E.extortEvents(g, 0, [0, 1], 1, {});
  const gain = ev.find(e => e.seat === 0 && e.delta > 0);
  ok(gain.delta === 1, "self filtered out of opponents (only seat 1 drained)");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
