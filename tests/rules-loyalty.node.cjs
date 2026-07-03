// Integration test for rules-loyalty.js — planeswalkers & loyalty abilities.
// No DOM, no network. Run: node tests/rules-loyalty.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-targeting.js", "MTGRulesTargeting");
const L = loadInto(G, "rules-loyalty.js", "MTGRulesLoyalty");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("Chandra", {
  types: ["planeswalker"], subtypes: ["chandra"], colors: ["R"], mana: { generic: 3, R: 1 }, loyalty: 4,
  loyaltyAbilities: [
    { cost: 1, effects: [{ t: "adjust_life", seat: "controller", delta: 2 }] },
    { cost: -3, target: "any", effects: [{ t: "adjust_life", seat: "target", delta: -3 }] },
    { cost: -8, effects: [{ t: "adjust_life", seat: "controller", delta: 10 }] }
  ]
});

function mk() {
  let s = E.create({ seats: 2, startingLife: 20, decks: [[{ instanceId: "ch", name: "Chandra", zone: "battlefield" }], [{ instanceId: "z", name: "Forest", zone: "library" }]] });
  return L.enterLoyalty(E, s, "ch", {});
}

let s = mk();
ok(L.getLoyalty(s.game.cards["ch"]) === 4, "Chandra enters with 4 loyalty");

// +1 ability: loyalty 4 -> 5, controller gains 2
(function () {
  const r = L.activateLoyalty(E, s, "ch", 0, {}, {});
  ok(r.ok && L.getLoyalty(r.estate.game.cards["ch"]) === 5, "+1 ability: loyalty 4 -> 5");
  let s2 = r.estate; s2 = E.passPriority(s2); s2 = E.passPriority(s2);
  ok(s2.game.players[0].life === 22, "+1 ability resolved: controller 20 -> 22");
})();

// -3 ability at opponent: loyalty 4 -> 1, opponent takes 3
(function () {
  const r = L.activateLoyalty(E, mk(), "ch", 1, { target: { kind: "player", seat: 1 } }, {});
  ok(r.ok && L.getLoyalty(r.estate.game.cards["ch"]) === 1, "-3 ability: loyalty 4 -> 1");
  let s2 = r.estate; s2 = E.passPriority(s2); s2 = E.passPriority(s2);
  ok(s2.game.players[1].life === 17, "-3 ability resolved: opponent 20 -> 17");
})();

// ultimate too expensive: loyalty 4, -8 not allowed
(function () {
  const r = L.activateLoyalty(E, mk(), "ch", 2, {}, {});
  ok(r.ok === false && r.reason === "not enough loyalty", "-8 ultimate rejected at 4 loyalty");
})();

// at 0 loyalty -> dead planeswalker (SBA)
(function () {
  let s2 = mk();
  s2 = E.dispatch(s2, { t: "card_counter", instanceId: "ch", kind: "loyalty", delta: -4 }); // to 0
  ok(L.deadPlaneswalkers(s2.game, {}).indexOf("ch") >= 0, "planeswalker at 0 loyalty is flagged dead");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
