// Test for card-library-modern.js — modern-mechanic cards register with faithful DSL, and two drive
// end-to-end (level a leveler; transform a werewolf). Pure. Run: node tests/card-library-modern.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Lvl = loadInto(G, "rules-level.js", "MTGRulesLevel");
const Tr = loadInto(G, "rules-transform.js", "MTGRulesTransform");
const Lib = loadInto(G, "card-library-modern.js", "MTGCardLibraryModern");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const n = Lib.register(Cards);

// 1) registered
ok(n >= 10, "modern set registered (" + n + " cards)");

// 2) DSL faithfulness
ok(Cards.get("Reckless Waif").werewolf === true && Cards.get("Reckless Waif").back.power === 3, "Reckless Waif is a DFC werewolf (back is 3/2)");
ok(Cards.get("Student of Warfare").levels.length === 3, "Student of Warfare has 3 level bands");
ok(Cards.get("Heart of Kiran").crew === 3, "Heart of Kiran is a crew-3 Vehicle");
ok(Cards.get("Auspicious Starrix").mutate != null, "Auspicious Starrix has mutate");
ok(Cards.get("Behold the Multiverse").foretell != null, "Behold the Multiverse can be foretold");
ok(Cards.get("Think Twice").flashback != null, "Think Twice has flashback");
ok(Cards.get("Drannith Stinger").cycling != null, "Drannith Stinger has cycling");
ok(Cards.get("Burn Bright").kicker != null, "Burn Bright has kicker");
ok(Cards.get("Underworld Breach Beast").escape.exile === 3, "the escape creature exiles 3");

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }

// 3) drive the leveler: level it up to the top band
(function () {
  let g = Core.init({ seats: 2, startingLife: 20 });
  g = Core.reduce(g, { t: "__add", cards: [{ instanceId: "s", name: "Student of Warfare", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} }] });
  for (let i = 0; i < 7; i++) g = apply(g, Lvl.levelUpEvents("s"));
  const e = Lvl.effectiveLevel(g, "s", {});
  ok(e.power === 4 && e.abilities.indexOf("double strike") >= 0, "leveled Student of Warfare is a 4/4 with double strike");
})();

// 4) transform the werewolf
(function () {
  let g = Core.init({ seats: 2, startingLife: 20 });
  g = Core.reduce(g, { t: "__add", cards: [{ instanceId: "w", name: "Reckless Waif", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, flipped: false }] });
  g = apply(g, Tr.transformEvents("w"));
  ok(Tr.effectiveFace(g, "w", {}).name === "Merciless Predator", "Reckless Waif transforms into Merciless Predator");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
