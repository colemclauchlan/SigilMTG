// Test for rules-persist.js — persist (returns with -1/-1) & undying (returns with +1/+1), incl. loop-stop.
// No DOM, no network, no engine-core needed. Run: node tests/rules-persist.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const P = loadInto(G, "rules-persist.js", "MTGRulesPersist");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
const ev = (out, t) => (out || []).filter((e) => e.t === t);
const counterDelta = (out, kind) => { const c = ev(out, "card_counter").find((e) => e.kind === kind); return c ? c.delta : 0; };

Cards.define("Persister", { types: ["creature"], power: 2, toughness: 2, abilities: ["persist"] });
Cards.define("Undyer", { types: ["creature"], power: 1, toughness: 1, abilities: ["undying"] });

const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, x: 50, y: 50, counters: counters || {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) persist on a clean creature -> returns with a -1/-1 counter, under owner, to battlefield
(function () {
  const g = game({ p: bf("p", "Persister", 0) });
  const out = P.onDeath(g, "p", "persist", {});
  ok(out !== null, "persist fires on a clean creature");
  ok(ev(out, "card_move").length === 1 && ev(out, "card_move")[0].toZone === "battlefield", "persist returns to battlefield");
  ok(counterDelta(out, "-1/-1") === 1, "persist returns with a -1/-1 counter");
})();

// 2) undying on a clean creature -> returns with a +1/+1 counter
(function () {
  const g = game({ u: bf("u", "Undyer", 0) });
  const out = P.onDeath(g, "u", "undying", {});
  ok(out !== null && counterDelta(out, "+1/+1") === 1, "undying returns with a +1/+1 counter");
})();

// 3) persist on a creature that ALREADY has a -1/-1 counter -> does NOT return (the loop stops) [EDGE]
(function () {
  const g = game({ p: bf("p", "Persister", 0, { "-1/-1": 1 }) });
  ok(P.willReturn(g, "p", "persist") === false, "persist blocked by existing -1/-1");
  ok(P.onDeath(g, "p", "persist", {}) === null, "persist does not fire twice (loop-stop edge)");
})();

// 4) undying on a creature that already has a +1/+1 -> does NOT return
(function () {
  const g = game({ u: bf("u", "Undyer", 0, { "+1/+1": 1 }) });
  ok(P.onDeath(g, "u", "undying", {}) === null, "undying blocked by existing +1/+1");
})();

// 5) persist is NOT blocked by a +1/+1 (only -1/-1 matters); undying NOT blocked by a -1/-1
(function () {
  const g = game({ p: bf("p", "Persister", 0, { "+1/+1": 2 }), u: bf("u", "Undyer", 1, { "-1/-1": 2 }) });
  ok(P.willReturn(g, "p", "persist") === true, "persist ignores +1/+1 counters");
  ok(P.willReturn(g, "u", "undying") === true, "undying ignores -1/-1 counters");
})();

// 6) returns under the OWNER's control even if controller was stolen
(function () {
  const g = game({ p: { instanceId: "p", name: "Persister", zone: "battlefield", ownerSeat: 0, controllerSeat: 1, counters: {} } });
  const out = P.onDeath(g, "p", "persist", {});
  const set = (out || []).find((e) => e.t === "__set");
  ok(set && set.cards[0].fields.controllerSeat === 0, "persist returns under the owner's control");
})();

// 7) predicates + missing-card safety [EDGE]
(function () {
  const g = game({ p: bf("p", "Persister", 0, { "+1/+1": 1 }) });
  ok(P.hasPlusCounter(g, "p") === true && P.hasMinusCounter(g, "p") === false, "counter predicates read the map");
  ok(P.onDeath(g, "ghost", "persist", {}) === null, "onDeath on a missing card -> null");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
