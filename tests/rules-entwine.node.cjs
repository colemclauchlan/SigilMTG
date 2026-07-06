// Test for rules-entwine.js — entwine (CR 702.42): pay the entwine cost to choose all modes of a modal
// spell. Pure.
// Run: node tests/rules-entwine.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const EN = loadInto(G, "rules-entwine.js", "MTGRulesEntwine");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Choice", { types: ["sorcery"], colors: ["G"], mana: { generic: 1, G: 1 }, entwine: { generic: 2 }, modes: [{ text: "Search for a land" }, { text: "Draw a card" }] });
Cards.define("Solo", { types: ["sorcery"], mana: { generic: 1 }, modes: [{ text: "a" }, { text: "b" }] }); // modal, no entwine
Cards.define("Plain", { types: ["sorcery"], mana: { G: 1 }, entwine: { generic: 2 } }); // entwine but not modal

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "ch", name: "Choice", zone: "hand" }], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}

// 1) entwine cost detection
ok(EN.entwineCost(Cards.get("Choice")).generic === 2, "entwineCost returns the cost");
ok(EN.entwineCost(Cards.get("Solo")) === null, "no entwine -> null");

// 2) canEntwine: modal + has entwine + can pay ({2})
ok(EN.canEntwine(build(2), "ch", 0, {}).ok === true, "can entwine with {2} available");
ok(/cannot pay/.test(EN.canEntwine(build(0), "ch", 0, {}).reason), "no mana -> can't pay entwine");
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "so", name: "Solo", zone: "hand" }], []] });
  ok(/no entwine/.test(EN.canEntwine(g, "so", 0, {}).reason), "modal without entwine -> rejected");
})();
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "pl", name: "Plain", zone: "hand" }], []] });
  g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: 2 });
  ok(/not a modal/.test(EN.canEntwine(g, "pl", 0, {}).reason), "entwine but non-modal -> rejected");
})();

// 3) castEntwinedEvents: pays {2}, hand -> stack, flags entwined
(function () {
  let g = build(2);
  g = apply(g, EN.castEntwinedEvents(g, "ch", {}));
  ok(g.cards["ch"].zone === "stack", "entwined spell on the stack");
  ok(g.cards["ch"].entwined === true, "flagged entwined");
  ok((g.players[0].counters.mana_C || 0) === 0, "entwine cost {2} paid");
})();

// 4) chosenModes: all modes when entwined, null (choose one) otherwise
ok(J(EN.chosenModes(Cards.get("Choice"), true)) === J([0, 1]), "entwined -> all modes chosen");
ok(EN.chosenModes(Cards.get("Choice"), false) === null, "not entwined -> caller still chooses one");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
