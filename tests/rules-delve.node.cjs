// Test for rules-delve.js — exile graveyard cards to pay {1} of generic each (generic only).
// No DOM, no network. Run: node tests/rules-delve.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const D = loadInto(G, "rules-delve.js", "MTGRulesDelve");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

const gy = (id, seat) => ({ instanceId: id, zone: "graveyard", ownerSeat: seat, controllerSeat: seat });
const bf = (id, seat) => ({ instanceId: id, zone: "battlefield", ownerSeat: seat, controllerSeat: seat });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) maxDelve = size of your graveyard
(function () {
  const g = game({ g1: gy("g1", 0), g2: gy("g2", 0), g3: gy("g3", 0) });
  ok(D.maxDelve(g, 0, {}) === 3, "maxDelve counts graveyard cards");
})();

// 2) opponent's graveyard isn't delveable
(function () {
  const g = game({ g1: gy("g1", 0), opp: gy("opp", 1) });
  ok(D.maxDelve(g, 0, {}) === 1, "opponent graveyard excluded from maxDelve");
})();

// 3) delvePay reduces generic by exiled count + emits exile events
(function () {
  const g = game({ g1: gy("g1", 0), g2: gy("g2", 0), g3: gy("g3", 0) });
  const r = D.delvePay(g, 0, { generic: 5, U: 1 }, ["g1", "g2"], {});
  ok(r.cost.generic === 3 && r.cost.U === 1, "generic 5-2=3, colored pip untouched");
  ok(r.events.length === 2 && r.events[0].toZone === "exile", "two exile events emitted");
})();

// 4) only your graveyard cards count; an opponent's id in the list is ignored
(function () {
  const g = game({ g1: gy("g1", 0), opp: gy("opp", 1) });
  const r = D.delvePay(g, 0, { generic: 4 }, ["g1", "opp"], {});
  ok(r.cost.generic === 3 && r.events.length === 1, "opponent's gy card ignored in delvePay");
})();

// 5) a battlefield card listed for delve is ignored (must be in graveyard)
(function () {
  const g = game({ b1: bf("b1", 0), g1: gy("g1", 0) });
  const r = D.delvePay(g, 0, { generic: 4 }, ["b1", "g1"], {});
  ok(r.cost.generic === 3 && r.events.length === 1, "battlefield card not delveable");
})();

// 6) EDGE: more delvers than generic — generic floors at 0 and extra cards aren't exiled
(function () {
  const g = game({ g1: gy("g1", 0), g2: gy("g2", 0), g3: gy("g3", 0) });
  const r = D.delvePay(g, 0, { generic: 2 }, ["g1", "g2", "g3"], {});
  ok(r.cost.generic === 0, "generic floors at 0");
  ok(r.events.length === 2, "only 2 cards exiled (3rd is useless, left in graveyard)");
})();

// 7) delve never touches colored pips even with zero generic
(function () {
  const g = game({ g1: gy("g1", 0) });
  const r = D.delvePay(g, 0, { generic: 0, B: 1 }, ["g1"], {});
  ok(J(r.cost) === J({ generic: 0, B: 1 }) && r.events.length === 0, "no generic -> nothing exiled, colored kept");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
