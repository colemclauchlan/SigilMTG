const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const ADV = loadInto(G, "rules-adventure.js", "MTGRulesAdventure");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Bonecrusher", {
  types: ["creature"], colors: ["R"], mana: { generic: 1, R: 1 }, pt: [3, 3],
  adventure: { name: "Stomp", types: ["instant"], mana: { R: 1 }, spell: { damage: 2, target: "any" } }
});
Cards.define("Plainbeast", { types: ["creature"], mana: { generic: 2 }, pt: [2, 2] });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC, manaR) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "bc", name: "Bonecrusher", zone: "hand" }], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaR) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: manaR });
  return g;
}

ok(ADV.adventureDef(Cards.get("Bonecrusher")).name === "Stomp", "adventureDef returns the adventure half");
ok(ADV.adventureDef(Cards.get("Plainbeast")) === null, "no adventure half -> null");
ok(ADV.canCastAdventure(build(0, 1), "bc", 0, {}).ok === true, "can cast adventure with {R} available");
ok(ADV.canCastAdventure(build(0, 0), "bc", 0, {}).ok === false, "no mana -> can't cast adventure");
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "pb", name: "Plainbeast", zone: "hand" }], []] });
  ok(/no adventure/.test(ADV.canCastAdventure(g, "pb", 0, {}).reason), "card without adventure -> rejected");
})();
(function () {
  let g = build(0, 1); g = Core.reduce(g, { t: "card_move", instanceId: "bc", toZone: "exile" });
  ok(/from your hand/.test(ADV.canCastAdventure(g, "bc", 0, {}).reason), "not in hand -> rejected");
})();
(function () {
  let g = build(0, 1);
  g = apply(g, ADV.castAdventureEvents(g, "bc", {}));
  ok(g.cards["bc"].zone === "stack", "adventure half is on the stack");
  ok(g.cards["bc"].castingAdventure === true, "flagged castingAdventure");
  ok((g.players[0].counters.mana_R || 0) === 0, "adventure cost {R} paid");
})();
(function () {
  let g = build(0, 1);
  g = apply(g, ADV.castAdventureEvents(g, "bc", {}));
  g = apply(g, ADV.resolveAdventureEvents(g, "bc"));
  ok(g.cards["bc"].zone === "exile", "resolved adventure goes to exile (not graveyard)");
  ok(g.cards["bc"].onAdventure === true, "marked on an adventure");
  ok(g.cards["bc"].castingAdventure === false, "castingAdventure flag cleared");
  ok(ADV.isOnAdventure(g, "bc") === true, "isOnAdventure true");
})();
ok(ADV.resolveAdventureEvents(build(0, 1), "bc").length === 0, "no exile events when not casting the adventure");
(function () {
  let g = build(0, 1);
  g = apply(g, ADV.castAdventureEvents(g, "bc", {}));
  g = apply(g, ADV.resolveAdventureEvents(g, "bc"));
  ok(ADV.canCastFromAdventure(g, "bc", 0, {}).ok === false, "on adventure but no mana -> can't cast creature");
  g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: 1 });
  g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: 1 });
  ok(ADV.canCastFromAdventure(g, "bc", 0, {}).ok === true, "on adventure + {1}{R} -> can cast creature");
  g = apply(g, ADV.castFromAdventureEvents(g, "bc", {}));
  ok(g.cards["bc"].zone === "stack", "creature half cast from exile onto the stack");
  ok(g.cards["bc"].onAdventure === false, "adventure flag cleared after casting the creature");
  ok((g.players[0].counters.mana_R || 0) === 0 && (g.players[0].counters.mana_C || 0) === 0, "creature cost {1}{R} paid");
})();
ok(ADV.canCastFromAdventure(build(9, 9), "bc", 0, {}).ok === false, "in hand (not on adventure) -> can't cast from adventure");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
