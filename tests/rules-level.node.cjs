// Test for rules-level.js — level counters move a creature through P/T/ability bands. Pure.
// Run: node tests/rules-level.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const L = loadInto(G, "rules-level.js", "MTGRulesLevel");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Student", { types: ["creature"], colors: ["W"], power: 2, toughness: 2, levelUp: { generic: 1 }, levels: [
  { min: 0, max: 1, power: 2, toughness: 2, abilities: [] },
  { min: 2, max: 4, power: 4, toughness: 4, abilities: ["flying"] },
  { min: 5, power: 6, toughness: 6, abilities: ["flying", "double strike"] }
] });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  let g = Core.init({ seats: 2, startingLife: 20 });
  return Core.reduce(g, { t: "__add", cards: [{ instanceId: "s", name: "Student", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} }] });
}

// 1) level 0 -> the base band
(function () {
  const g = build();
  const e = L.effectiveLevel(g, "s", {});
  ok(e.power === 2 && e.toughness === 2 && e.abilities.length === 0, "level 0: a 2/2 with no abilities");
})();

// 2) level 2 -> the middle band (flying)
(function () {
  let g = build();
  g = apply(g, L.levelUpEvents("s")); g = apply(g, L.levelUpEvents("s"));
  ok(L.level(g, "s") === 2, "two level-ups -> level 2");
  const e = L.effectiveLevel(g, "s", {});
  ok(e.power === 4 && e.toughness === 4 && e.abilities.indexOf("flying") >= 0, "level 2: a 4/4 flyer");
})();

// 3) level 5 -> the top band (flying + double strike)
(function () {
  let g = build();
  for (let i = 0; i < 5; i++) g = apply(g, L.levelUpEvents("s"));
  const e = L.effectiveLevel(g, "s", {});
  ok(e.power === 6 && e.toughness === 6 && e.abilities.indexOf("double strike") >= 0, "level 5: a 6/6 with double strike");
})();

// 4) currentBand picks the right band at boundaries
(function () {
  const def = Cards.get("Student");
  ok(L.currentBand(def, 1).power === 2, "level 1 is still the base band");
  ok(L.currentBand(def, 4).power === 4, "level 4 is still the middle band");
  ok(L.currentBand(def, 7).power === 6, "level 7 is the top band (no max)");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
