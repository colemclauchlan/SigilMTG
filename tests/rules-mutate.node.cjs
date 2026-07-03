// Test for rules-mutate.js — merge over/under; top card's stats + union of abilities. Pure.
// Run: node tests/rules-mutate.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const M = loadInto(G, "rules-mutate.js", "MTGRulesMutate");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Beast", { types: ["creature"], subtypes: ["beast"], power: 2, toughness: 2, abilities: ["trample"] });
Cards.define("Dire Mutant", { types: ["creature"], subtypes: ["mutant"], power: 4, toughness: 4, abilities: ["flying"], mutate: { generic: 2, G: 1 } });
Cards.define("Human Knight", { types: ["creature"], subtypes: ["human", "knight"], power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  let g = Core.init({ seats: 2, startingLife: 20 });
  return Core.reduce(g, { t: "__add", cards: [
    { instanceId: "beast", name: "Beast", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} },
    { instanceId: "mut", name: "Dire Mutant", ownerSeat: 0, controllerSeat: 0, zone: "hand", counters: {} },
    { instanceId: "knight", name: "Human Knight", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} }
  ] });
}

// 1) legality: a non-Human creature is a legal mutate target; a Human is not
(function () {
  const g = build();
  ok(M.canMutate(g, "beast", "mut", {}).ok === true, "can mutate onto the (non-Human) Beast");
  ok(/Human/.test(M.canMutate(g, "knight", "mut", {}).reason), "can't mutate onto a Human");
})();

// 2) mutate OVER: the top is the mutant -> 4/4 with flying + the Beast's trample
(function () {
  let g = build();
  g = apply(g, M.mutateEvents(g, "beast", "mut", true, {}));
  const p = M.mergedProfile(g, "beast", {});
  ok(p.name === "Dire Mutant" && p.power === 4 && p.toughness === 4, "mutate over: the merged creature is the 4/4 mutant");
  ok(p.abilities.indexOf("flying") >= 0 && p.abilities.indexOf("trample") >= 0, "it has BOTH flying (mutant) and trample (beast)");
  ok(g.cards["mut"].mergedInto === "beast", "the mutator is folded into the permanent");
})();

// 3) mutate UNDER: the Beast stays on top (2/2) but still gains the mutant's flying
(function () {
  let g = build();
  g = apply(g, M.mutateEvents(g, "beast", "mut", false, {}));
  const p = M.mergedProfile(g, "beast", {});
  ok(p.name === "Beast" && p.power === 2 && p.toughness === 2, "mutate under: the Beast (2/2) stays on top");
  ok(p.abilities.indexOf("flying") >= 0 && p.abilities.indexOf("trample") >= 0, "abilities still union to flying + trample");
  ok(J(p.pile) === J(["Beast", "Dire Mutant"]), "merge pile order: Beast on top");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
