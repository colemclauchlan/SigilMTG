// Test for rules-aura.js — enchant legality (hexproof/protection) + resolve-attach. Applied through
// table-core directly (no engine-core needed). Run: node tests/rules-aura.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-targeting.js", "MTGRulesTargeting");
loadInto(G, "rules-hexproof.js", "MTGRulesHexproof");
loadInto(G, "rules-protection.js", "MTGRulesProtection");
const At = loadInto(G, "rules-attach.js", "MTGRulesAttach");
const Au = loadInto(G, "rules-aura.js", "MTGRulesAura");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Rancor", { types: ["enchantment", "aura"], colors: ["G"], mana: { G: 1 }, enchants: { power: 2, toughness: 0, keywords: ["trample"] } });
Cards.define("Stalker", { types: ["creature"], colors: ["U"], power: 1, toughness: 1, abilities: ["hexproof"] });
Cards.define("Saint", { types: ["creature"], colors: ["W"], power: 2, toughness: 3, abilities: ["protection from green"] });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(cards) { let g = Core.init({ seats: 2, startingLife: 20 }); return Core.reduce(g, { t: "__add", cards: cards }); }
const card = (id, name, seat, zone) => ({ instanceId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: zone || "battlefield", counters: {} });

// 1) cast an aura on your own creature -> it enters attached and buffs it
(function () {
  let g = build([card("rancor", "Rancor", 0, "hand"), card("bear", "Bear", 0)]);
  ok(Au.canEnchant(g, "rancor", "bear", {}).ok, "Rancor can enchant my Bear");
  g = apply(g, Au.auraResolveEvents("rancor", "bear"));
  ok(g.cards["rancor"].zone === "battlefield" && g.cards["rancor"].attachedTo === "bear", "Rancor entered the battlefield attached to the Bear");
  const e = At.effectiveAttached(g, "bear", {});
  ok(e.power === 4 && e.toughness === 2 && e.abilities.indexOf("trample") >= 0, "enchanted Bear is 4/2 with trample");
})();

// 2) an opponent's aura can't enchant a hexproof creature
(function () {
  let g = build([card("rancor", "Rancor", 1, "hand"), card("stalk", "Stalker", 0)]); // aura controlled by seat 1, target seat 0
  const r = Au.canEnchant(g, "rancor", "stalk", {});
  ok(!r.ok && /hexproof/.test(r.reason), "opponent can't enchant a hexproof creature");
})();

// 3) a green aura can't enchant a creature with protection from green
(function () {
  let g = build([card("rancor", "Rancor", 0, "hand"), card("saint", "Saint", 0)]);
  const r = Au.canEnchant(g, "rancor", "saint", {});
  ok(!r.ok && /protection/.test(r.reason), "can't enchant a pro-green creature with a green aura");
})();

// 4) target must be a creature
(function () {
  let g = build([card("rancor", "Rancor", 0, "hand"), card("rancor2", "Rancor", 0, "battlefield")]);
  const r = Au.canEnchant(g, "rancor", "rancor2", {});
  ok(!r.ok && /creature/.test(r.reason), "can't enchant a non-creature");
})();

// 5) you CAN enchant your OWN hexproof creature
(function () {
  let g = build([card("rancor", "Rancor", 0, "hand"), card("stalk", "Stalker", 0)]); // both seat 0
  ok(Au.canEnchant(g, "rancor", "stalk", {}).ok, "you can enchant your own hexproof creature");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
