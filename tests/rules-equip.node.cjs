// Test for rules-equip.js — the equip action: legality, mana payment, attach, re-equip. Applied through
// table-core directly (no engine-core needed). Run: node tests/rules-equip.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const At = loadInto(G, "rules-attach.js", "MTGRulesAttach");
const Eq = loadInto(G, "rules-equip.js", "MTGRulesEquip");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Bonesplitter", { types: ["artifact", "equipment"], equips: { power: 2, toughness: 0 }, equipCost: { generic: 1 } });
Cards.define("Lightning Greaves", { types: ["artifact", "equipment"], equips: { keywords: ["haste", "shroud"] } }); // free equip

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(extraCards, manaC) {
  let g = Core.init({ seats: 2, startingLife: 20 });
  g = Core.reduce(g, { t: "__add", cards: extraCards });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}
const bf = (id, name, seat) => ({ instanceId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: "battlefield", counters: {} });

// 1) equip pays the cost, attaches, and the creature gains the buff
(function () {
  let g = build([bf("bs", "Bonesplitter", 0), bf("bear", "Bear", 0)], 1);
  ok(Eq.canEquip(g, "bs", "bear", {}).ok, "canEquip with mana");
  g = apply(g, Eq.equipEvents(g, "bs", "bear", {}));
  ok(g.cards["bs"].attachedTo === "bear", "Bonesplitter is now attached to the Bear");
  ok((g.players[0].counters.mana_C || 0) === 0, "the {1} equip cost was paid");
  const e = At.effectiveAttached(g, "bear", {});
  ok(e.power === 4 && e.toughness === 2, "the equipped Bear is 4/2");
})();

// 2) can't equip without paying the cost
(function () {
  let g = build([bf("bs", "Bonesplitter", 0), bf("bear", "Bear", 0)], 0);
  const r = Eq.canEquip(g, "bs", "bear", {});
  ok(!r.ok && /pay/.test(r.reason), "no mana -> can't equip");
})();

// 3) can only equip a creature you control
(function () {
  let g = build([bf("bs", "Bonesplitter", 0), bf("opp", "Bear", 1)], 1);
  const r = Eq.canEquip(g, "bs", "opp", {});
  ok(!r.ok && /control/.test(r.reason), "can't equip an opponent's creature");
})();

// 4) target must be a creature
(function () {
  let g = build([bf("bs", "Bonesplitter", 0), bf("bs2", "Bonesplitter", 0)], 1);
  const r = Eq.canEquip(g, "bs", "bs2", {});
  ok(!r.ok && /creature/.test(r.reason), "can't equip onto another Equipment");
})();

// 5) re-equipping MOVES the Equipment to the new creature
(function () {
  let g = build([bf("bs", "Bonesplitter", 0), bf("a", "Bear", 0), bf("b", "Bear", 0)], 2);
  g = apply(g, Eq.equipEvents(g, "bs", "a", {}));
  ok(At.effectiveAttached(g, "a", {}).power === 4, "first equip: creature A is 4/2");
  g = apply(g, Eq.equipEvents(g, "bs", "b", {}));
  ok(g.cards["bs"].attachedTo === "b", "re-equip moved it to creature B");
  ok(At.effectiveAttached(g, "a", {}).power === 2 && At.effectiveAttached(g, "b", {}).power === 4, "A back to 2/2, B now 4/2");
})();

// 6) a free-equip Equipment grants its keywords
(function () {
  let g = build([bf("lg", "Lightning Greaves", 0), bf("bear", "Bear", 0)], 0);
  ok(Eq.canEquip(g, "lg", "bear", {}).ok, "free equip needs no mana");
  g = apply(g, Eq.equipEvents(g, "lg", "bear", {}));
  const e = At.effectiveAttached(g, "bear", {});
  ok(e.abilities.indexOf("haste") >= 0 && e.abilities.indexOf("shroud") >= 0, "Lightning Greaves grants haste + shroud");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
