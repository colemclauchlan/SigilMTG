// Test for rules-menace.js — menace (needs 2+ blockers) & "can't be blocked", incl. granted menace.
// No DOM, no network, no engine-core needed. Run: node tests/rules-menace.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const M = loadInto(G, "rules-menace.js", "MTGRulesMenace");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Menacer", { types: ["creature"], power: 3, toughness: 3, abilities: ["menace"] });
Cards.define("Sneak", { types: ["creature"], power: 2, toughness: 2, abilities: ["unblockable"] });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Menace Lord", { types: ["creature"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["menace"] }] });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) menace with a single blocker -> the block is illegal, attacker goes through
(function () {
  const g = game({ men: bf("men", "Menacer", 0), b1: bf("b1", "Bear", 1) });
  const out = M.filterEvasion(g, [{ attacker: "men", blockers: ["b1"] }], {});
  ok(J(out[0].blockers) === J([]), "menace + 1 blocker -> unblocked");
})();

// 2) menace with two blockers -> legal
(function () {
  const g = game({ men: bf("men", "Menacer", 0), b1: bf("b1", "Bear", 1), b2: bf("b2", "Bear", 1) });
  const out = M.filterEvasion(g, [{ attacker: "men", blockers: ["b1", "b2"] }], {});
  ok(J(out[0].blockers) === J(["b1", "b2"]), "menace + 2 blockers -> legal");
})();

// 3) a normal creature is fine with a single blocker
(function () {
  const g = game({ atk: bf("atk", "Bear", 0), b1: bf("b1", "Bear", 1) });
  const out = M.filterEvasion(g, [{ attacker: "atk", blockers: ["b1"] }], {});
  ok(J(out[0].blockers) === J(["b1"]), "no menace + 1 blocker -> legal");
})();

// 4) "can't be blocked" drops all blockers
(function () {
  const g = game({ sn: bf("sn", "Sneak", 0), b1: bf("b1", "Bear", 1), b2: bf("b2", "Bear", 1) });
  const out = M.filterEvasion(g, [{ attacker: "sn", blockers: ["b1", "b2"] }], {});
  ok(J(out[0].blockers) === J([]), "unblockable -> no blockers stick");
})();

// 5) blockCountLegal predicate
(function () {
  ok(M.blockCountLegal(["menace"], 1) === false, "menace: 1 blocker illegal");
  ok(M.blockCountLegal(["menace"], 2) === true, "menace: 2 blockers legal");
  ok(M.blockCountLegal(["menace"], 0) === true, "menace: 0 (unblocked) ok");
  ok(M.blockCountLegal([], 1) === true, "vanilla: 1 blocker ok");
})();

// 6) GRANTED menace counts (a lord grants menace to a teammate)
(function () {
  const g = game({ lord: bf("lord", "Menace Lord", 0), mate: bf("mate", "Bear", 0), b1: bf("b1", "Bear", 1) });
  const out = M.filterEvasion(g, [{ attacker: "mate", blockers: ["b1"] }], {});
  ok(J(out[0].blockers) === J([]), "granted menace: teammate also needs 2 blockers");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
