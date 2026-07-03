// Test for card-library-commander.js — the staples register with engine-faithful DSL, and one drives
// end-to-end (equip Swiftfoot Boots -> hexproof) through table-core. Pure. Run: node tests/card-library-commander.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const At = loadInto(G, "rules-attach.js", "MTGRulesAttach");
const Eq = loadInto(G, "rules-equip.js", "MTGRulesEquip");
const Hex = loadInto(G, "rules-hexproof.js", "MTGRulesHexproof");
const Lib = loadInto(G, "card-library-commander.js", "MTGCardLibraryCommander");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
const n = Lib.register(Cards);

// 1) the set registered
ok(n >= 24, "registered the Commander staples (" + n + " cards total)");

// 2) DSL faithfulness spot-checks (only engine-executable mechanics)
ok(Cards.get("Swords to Plowshares").spell.effects[0].toZone === "exile", "Swords to Plowshares exiles its target");
ok(Cards.get("Fireball").spell.xDamage === true, "Fireball is an {X} burn spell");
ok(Cards.get("Smuggler's Copter").crew === 1 && Cards.get("Smuggler's Copter").types.indexOf("vehicle") >= 0, "Smuggler's Copter is a crew-1 Vehicle");
ok(Cards.get("Naya Charm").spell.modal === true && Cards.get("Naya Charm").spell.modes.length === 3, "Naya Charm is a 3-mode modal spell");
ok(Cards.get("Serra Angel").abilities.indexOf("flying") >= 0 && Cards.get("Serra Angel").abilities.indexOf("vigilance") >= 0, "Serra Angel is a 4/4 flyer with vigilance");
ok(Cards.get("Cultivate").searchRamp.count === 2, "Cultivate is a 2-card ramp/tutor");
ok(Cards.get("Counterspell").types.indexOf("instant") >= 0, "Counterspell is an instant (cast via rules-counter)");
ok(Cards.get("Elvish Archdruid").static[0].subtype === "elf", "Elvish Archdruid is an Elf lord");

// 3) end-to-end: equip Swiftfoot Boots onto a Bear -> it gains hexproof -> opponents can't target it
(function () {
  let g = Core.init({ seats: 2, startingLife: 20 });
  g = Core.reduce(g, { t: "__add", cards: [
    { instanceId: "boots", name: "Swiftfoot Boots", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} },
    { instanceId: "bear", name: "Bear", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} }
  ] });
  g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: 1 });
  ok(Eq.canEquip(g, "boots", "bear", {}).ok, "Swiftfoot Boots can be equipped to the Bear");
  Eq.equipEvents(g, "boots", "bear", {}).forEach(function (e) { g = Core.reduce(g, e); });
  ok(At.effectiveAttached(g, "bear", {}).abilities.indexOf("hexproof") >= 0, "the equipped Bear has hexproof");
  ok(Hex.canBeTargeted(g, "bear", 1, {}) === false, "...so an opponent can't target it");
  ok(Hex.canBeTargeted(g, "bear", 0, {}) === true, "...but its controller still can");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
