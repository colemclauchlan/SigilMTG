// Test for rules-bloodthirst.js — enters with N +1/+1 counters if an opponent was damaged, incl. granted.
// No DOM, no network, no engine-core needed. Run: node tests/rules-bloodthirst.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-counters.js", "MTGRulesCounters");
const B = loadInto(G, "rules-bloodthirst.js", "MTGRulesBloodthirst");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Berserker", { types: ["creature"], power: 2, toughness: 2, abilities: ["bloodthirst"], bloodthirst: 1 });
Cards.define("Big Berserker", { types: ["creature"], power: 3, toughness: 3, abilities: ["bloodthirst"], bloodthirst: 3 });
Cards.define("Plain Ogre", { types: ["creature"], power: 3, toughness: 3 });
Cards.define("Bloodthirst Banner", { types: ["enchantment"], static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["bloodthirst"] }] });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) hasBloodthirst predicate
ok(B.hasBloodthirst(["bloodthirst"]) === true, "hasBloodthirst true");
ok(B.hasBloodthirst([]) === false, "hasBloodthirst false");

// 2) opponent damaged -> enters with N counters (N from card def = 1)
(function () {
  const g = game({ b: bf("b", "Berserker", 0) });
  ok(J(B.bloodthirstCounters(g, "b", true, null, {})) === J([{ t: "card_counter", instanceId: "b", kind: "+1/+1", delta: 1 }]), "damaged + N=1 -> one +1/+1");
})();

// 3) opponent NOT damaged -> no counters
(function () {
  const g = game({ b: bf("b", "Berserker", 0) });
  ok(J(B.bloodthirstCounters(g, "b", false, null, {})) === J([]), "no opponent damage -> no counters");
})();

// 4) bloodthirst 3 -> three counters when damaged
(function () {
  const g = game({ b: bf("b", "Big Berserker", 0) });
  ok(J(B.bloodthirstCounters(g, "b", true, null, {})) === J([{ t: "card_counter", instanceId: "b", kind: "+1/+1", delta: 3 }]), "bloodthirst 3 -> three +1/+1");
})();

// 5) explicit N overrides the card-def value
(function () {
  const g = game({ b: bf("b", "Berserker", 0) });
  ok(J(B.bloodthirstCounters(g, "b", true, 2, {}))[0] !== undefined && B.bloodthirstCounters(g, "b", true, 2, {})[0].delta === 2, "explicit N=2 overrides def N=1");
})();

// 6) a creature WITHOUT bloodthirst never gets counters, even when an opponent was damaged
(function () {
  const g = game({ o: bf("o", "Plain Ogre", 0) });
  ok(J(B.bloodthirstCounters(g, "o", true, 1, {})) === J([]), "no bloodthirst -> no counters");
})();

// 7) N<=0 yields no counters (edge case)
(function () {
  const g = game({ b: bf("b", "Berserker", 0) });
  ok(J(B.bloodthirstCounters(g, "b", true, 0, {})) === J([]), "N=0 -> no counters");
})();

// 8) GRANTED bloodthirst: a banner grants bloodthirst to a Plain Ogre, which then enters with N (explicit) counters
(function () {
  const g = game({ ban: bf("ban", "Bloodthirst Banner", 0), o: bf("o", "Plain Ogre", 0) });
  ok(B.hasBloodthirst(B.abilitiesOf(g, "o", {})) === true, "granted bloodthirst present on ogre");
  ok(J(B.bloodthirstCounters(g, "o", true, 2, {})) === J([{ t: "card_counter", instanceId: "o", kind: "+1/+1", delta: 2 }]), "granted bloodthirst + damage -> 2 counters");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
