// Test for rules-connive.js — connive N: draw N, discard N, +1/+1 per NONLAND discarded.
// Run: node tests/rules-connive.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const C = loadInto(G, "rules-connive.js", "MTGRulesConnive");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Conniver", { types: ["creature"], power: 1, toughness: 1, abilities: ["connive"], connive: 2 });
Cards.define("Simple Snitch", { types: ["creature"], power: 1, toughness: 1, abilities: ["connive"] });
Cards.define("Plain Knight", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Island", { types: ["land"], subtypes: ["island"] });
Cards.define("Bolt", { types: ["instant"] });

const inHand = (id, name, seat) => ({ instanceId: id, name: name, zone: "hand", ownerSeat: seat, controllerSeat: seat, counters: {} });
const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) conniveN
ok(C.conniveN(game({ a: bf("a", "Conniver", 0) }), "a", {}) === 2, "conniveN = 2");
ok(C.conniveN(game({ a: bf("a", "Simple Snitch", 0) }), "a", {}) === 1, "bare connive = 1");
ok(C.conniveN(game({ a: bf("a", "Plain Knight", 0) }), "a", {}) === 0, "no connive = 0");

// 2) nonlandCount
ok(C.nonlandCount(["Island", "Bolt", "Plain Knight"], {}) === 2, "2 nonland of 3");
ok(C.nonlandCount(["Island", "Island"], {}) === 0, "all lands -> 0");

// 3) resolveEvents: draw, discards, counter = #nonland discarded
(function () {
  const g = game({ a: bf("a", "Conniver", 0), c1: inHand("c1", "Bolt", 0), c2: inHand("c2", "Island", 0) });
  const ev = C.resolveEvents(g, "a", ["c1", "c2"], {});
  ok(ev[0].t === "draw" && ev[0].count === 2 && ev[0].seat === 0, "connive draws N");
  const discards = ev.filter(e => e.t === "card_move" && e.toZone === "graveyard");
  ok(discards.length === 2, "two discards");
  const counter = ev.find(e => e.t === "card_counter");
  ok(counter && counter.delta === 1 && counter.instanceId === "a", "one +1/+1 (Bolt nonland; Island land)");
})();

// 4) discarding only lands -> no counter event
(function () {
  const g = game({ a: bf("a", "Conniver", 0), c1: inHand("c1", "Island", 0), c2: inHand("c2", "Island", 0) });
  const ev = C.resolveEvents(g, "a", ["c1", "c2"], {});
  ok(!ev.some(e => e.t === "card_counter"), "all-land discard -> no counter");
})();

// 5) discarding two nonland -> +2
(function () {
  const g = game({ a: bf("a", "Conniver", 0), c1: inHand("c1", "Bolt", 0), c2: inHand("c2", "Plain Knight", 0) });
  const ev = C.resolveEvents(g, "a", ["c1", "c2"], {});
  const counter = ev.find(e => e.t === "card_counter");
  ok(counter && counter.delta === 2, "two nonland -> +2 counters");
})();

// 6) no connive -> []
ok(C.resolveEvents(game({ a: bf("a", "Plain Knight", 0) }), "a", ["x"], {}).length === 0, "no connive -> []");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
