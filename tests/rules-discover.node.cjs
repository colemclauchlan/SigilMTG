// Test for rules-discover.js — discover N: reveal until a nonland with mana value <= N (inclusive),
// then cast it free or put it in hand; bottom the rest. Pure (no engine-core).
// Run: node tests/rules-discover.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Dis = loadInto(G, "rules-discover.js", "MTGRulesDiscover");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Forest", { types: ["land"], produces: "G" });
Cards.define("Ogre", { types: ["creature"], mana: { generic: 4, R: 1 }, power: 5, toughness: 5 });  // MV 5
Cards.define("Bear", { types: ["creature"], mana: { generic: 1, G: 1 }, power: 2, toughness: 2 });   // MV 2

function apply(gg, ev) { ev.forEach(function (e) { gg = Core.reduce(gg, e); }); return gg; }

// 1) mana value math
ok(Dis.manaValue(Cards.get("Ogre")) === 5 && Dis.manaValue(Cards.get("Bear")) === 2, "manaValue sums the cost");

// 2) discover 4: skip land + too-expensive, stop at first nonland with MV <= 4
(function () {
  const g = Core.init({ seats: 2, decks: [[
    { instanceId: "f", name: "Forest", zone: "library" },
    { instanceId: "o", name: "Ogre", zone: "library" },
    { instanceId: "b", name: "Bear", zone: "library" }
  ], []] });
  const r = Dis.discover(g, 0, 4, {});
  ok(J(r.exiled) === J(["f", "o", "b"]), "exiled Forest + Ogre, then hit (got " + J(r.exiled) + ")");
  ok(r.hit === "b", "hit the Bear (first nonland with MV <= 4)");
})();

// 3) threshold is INCLUSIVE (MV == N hits) — unlike cascade's strict <
(function () {
  const g = Core.init({ seats: 2, decks: [[
    { instanceId: "o", name: "Ogre", zone: "library" },  // MV 5
    { instanceId: "b", name: "Bear", zone: "library" }
  ], []] });
  const r = Dis.discover(g, 0, 5, {});
  ok(r.hit === "o", "discover 5 hits an MV-5 card (inclusive)");
})();

// 4) lands are skipped even though their MV (0) is <= N
(function () {
  const g = Core.init({ seats: 2, decks: [[
    { instanceId: "f", name: "Forest", zone: "library" },
    { instanceId: "b", name: "Bear", zone: "library" }
  ], []] });
  const r = Dis.discover(g, 0, 3, {});
  ok(r.hit === "b", "land is skipped; hit is the nonland Bear");
})();

// 5) cast free -> stack, or to hand; the rest are bottomed
(function () {
  let g = Core.init({ seats: 2, decks: [[
    { instanceId: "o", name: "Ogre", zone: "library" },
    { instanceId: "b", name: "Bear", zone: "library" }
  ], []] });
  const r = Dis.discover(g, 0, 3, {});
  ok(r.hit === "b", "hit Bear at N=3");
  ok(J(Dis.bottomEvents(r.exiled, r.hit).map(function (e) { return e.instanceId; })) === J(["o"]), "the Ogre is bottomed, the hit isn't");
  let gs = apply(g, Dis.castFreeEvents(r.hit));
  ok(gs.cards["b"].zone === "stack", "castFree puts the hit on the stack");
  let gh = apply(g, Dis.toHandEvents(r.hit));
  ok(gh.cards["b"].zone === "hand", "toHand puts the hit into hand instead");
})();

// 6) whiff: no nonland at or below N -> no hit, everything exiled
(function () {
  const g = Core.init({ seats: 2, decks: [[
    { instanceId: "o", name: "Ogre", zone: "library" },  // MV 5, not <= 1
    { instanceId: "f", name: "Forest", zone: "library" }
  ], []] });
  const r = Dis.discover(g, 0, 1, {});
  ok(r.hit === null && r.exiled.length === 2, "no nonland <= 1 -> whiff, all exiled");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
