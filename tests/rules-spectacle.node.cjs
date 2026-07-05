// Test for rules-spectacle.js — spectacle (CR 702.108): cast for the spectacle cost if an opponent lost
// life this turn. Pure.
// Run: node tests/rules-spectacle.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const SP = loadInto(G, "rules-spectacle.js", "MTGRulesSpectacle");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

// Skewer the Critics: normal {2}{R}, spectacle {R}.
Cards.define("Skewer", { types: ["sorcery"], colors: ["R"], mana: { generic: 2, R: 1 }, spectacle: { R: 1 }, spell: { damage: 3, target: "player" } });
Cards.define("Plainzap", { types: ["instant"], mana: { R: 1 }, spell: { damage: 1, target: "any" } }); // no spectacle

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaR) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sk", name: "Skewer", zone: "hand" }], []] });
  if (manaR) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: manaR });
  return g;
}

// 1) spectacleCost detection
ok(SP.spectacleCost(Cards.get("Skewer")).R === 1, "spectacleCost returns the cost");
ok(SP.spectacleCost(Cards.get("Plainzap")) === null, "no spectacle -> null");

// 2) eligible only when an opponent lost life AND you can pay {R}
ok(SP.canCastSpectacle(build(1), "sk", 0, true, {}).ok === true, "opp lost life + {R} -> can cast spectacle");
ok(/no opponent lost life/.test(SP.canCastSpectacle(build(1), "sk", 0, false, {}).reason), "no opp life loss -> ineligible");
ok(/cannot pay/.test(SP.canCastSpectacle(build(0), "sk", 0, true, {}).reason), "opp lost life but no mana -> can't pay");
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "pz", name: "Plainzap", zone: "hand" }], []] });
  ok(/no spectacle/.test(SP.canCastSpectacle(g, "pz", 0, true, {}).reason), "card without spectacle -> rejected");
})();
(function () {
  let g = build(1); g = Core.reduce(g, { t: "card_move", instanceId: "sk", toZone: "graveyard" });
  ok(/from your hand/.test(SP.canCastSpectacle(g, "sk", 0, true, {}).reason), "not in hand -> rejected");
})();

// 3) castSpectacleEvents: pays {R}, moves hand -> stack, flags castViaSpectacle
(function () {
  let g = build(1);
  g = apply(g, SP.castSpectacleEvents(g, "sk", {}));
  ok(g.cards["sk"].zone === "stack", "spectacle spell is on the stack");
  ok(g.cards["sk"].castViaSpectacle === true, "flagged castViaSpectacle");
  ok((g.players[0].counters.mana_R || 0) === 0, "spectacle cost {R} paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
