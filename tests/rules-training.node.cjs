// Test for rules-training.js — training: attacks alongside a stronger creature -> +1/+1 counter.
// Run: node tests/rules-training.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const T = loadInto(G, "rules-training.js", "MTGRulesTraining");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Trainee", { types: ["creature"], power: 1, toughness: 1, abilities: ["training"] });
Cards.define("Big Bruiser", { types: ["creature"], power: 4, toughness: 4 });
Cards.define("Little Squire", { types: ["creature"], power: 1, toughness: 1 });
Cards.define("Even Peer", { types: ["creature"], power: 1, toughness: 1, abilities: ["training"] });

const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: counters || {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) hasTraining
ok(T.hasTraining(game({ a: bf("a", "Trainee", 0) }), "a", {}) === true, "hasTraining true");
ok(T.hasTraining(game({ b: bf("b", "Big Bruiser", 0) }), "b", {}) === false, "hasTraining false");

// 2) powerOf reads counters
ok(T.powerOf(game({ a: bf("a", "Trainee", 0, { "+1/+1": 2 }) }), "a", {}) === 3, "powerOf 1 + 2 counters = 3");

// 3) trains when a stronger co-attacker is present
(function () {
  const g = game({ t: bf("t", "Trainee", 0), big: bf("big", "Big Bruiser", 0) });
  ok(T.trainsWith(g, "t", ["t", "big"], {}) === true, "trains with a bigger co-attacker");
})();

// 4) does NOT train when the only co-attacker is not stronger
(function () {
  const g = game({ t: bf("t", "Trainee", 0), sq: bf("sq", "Little Squire", 0) });
  ok(T.trainsWith(g, "t", ["t", "sq"], {}) === false, "no bigger co-attacker -> no training");
})();

// 5) does NOT train attacking alone
(function () {
  const g = game({ t: bf("t", "Trainee", 0), big: bf("big", "Big Bruiser", 0) });
  ok(T.trainsWith(g, "t", ["t"], {}) === false, "attacking alone -> no training");
})();

// 6) equal power is NOT greater -> no training between two 1/1 trainees
(function () {
  const g = game({ a: bf("a", "Trainee", 0), b: bf("b", "Even Peer", 0) });
  ok(T.trainsWith(g, "a", ["a", "b"], {}) === false, "equal power -> no training");
})();

// 7) trainingEvents: only the trainee with a stronger friend gets a counter
(function () {
  const g = game({ t: bf("t", "Trainee", 0), big: bf("big", "Big Bruiser", 0) });
  const ev = T.trainingEvents(g, ["t", "big"], {});
  ok(ev.length === 1 && ev[0].instanceId === "t" && ev[0].kind === "+1/+1" && ev[0].delta === 1, "one +1/+1 on the trainee");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
