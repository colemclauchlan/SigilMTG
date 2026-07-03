// Test for rules-cascade.js — reveal until a cheaper nonland, with mana-value math. Pure (no engine-core).
// Run: node tests/rules-cascade.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Cas = loadInto(G, "rules-cascade.js", "MTGRulesCascade");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Forest", { types: ["land"], produces: "G" });
Cards.define("Ogre", { types: ["creature"], mana: { generic: 4, R: 1 }, power: 5, toughness: 5 });   // MV 5
Cards.define("Bear", { types: ["creature"], mana: { generic: 1, G: 1 }, power: 2, toughness: 2 });    // MV 2
Cards.define("Wall", { types: ["creature"], mana: { generic: 3 }, power: 0, toughness: 6 });           // MV 3

// 1) mana value
(function () {
  ok(Cas.manaValue(Cards.get("Ogre")) === 5 && Cas.manaValue(Cards.get("Bear")) === 2, "manaValue sums the cost");
  ok(Cas.manaValue(Cards.get("Forest")) === 0, "a land's mana value is 0");
})();

// 2) cascade skips lands and too-expensive cards, stops at the first cheaper nonland
(function () {
  // library top->bottom: Forest, Ogre(5), Bear(2). Cascading off an MV-4 spell -> hit Bear (2<4); Ogre(5) not < 4.
  const g = Core.init({ seats: 2, decks: [[
    { instanceId: "f", name: "Forest", zone: "library" },
    { instanceId: "o", name: "Ogre", zone: "library" },
    { instanceId: "b", name: "Bear", zone: "library" }
  ], []] });
  const r = Cas.cascade(g, 0, 4, {});
  ok(J(r.exiled) === J(["f", "o", "b"]), "exiled the Forest + Ogre, then hit (got " + J(r.exiled) + ")");
  ok(r.hit === "b", "the hit is the Bear (first nonland with MV < 4)");
})();

// 3) the non-hit cards go to the bottom; the hit is cast for free (onto the stack)
(function () {
  let g = Core.init({ seats: 2, decks: [[
    { instanceId: "o", name: "Ogre", zone: "library" },
    { instanceId: "b", name: "Bear", zone: "library" }
  ], []] });
  const r = Cas.cascade(g, 0, 4, {});
  ok(r.hit === "b", "hit the Bear");
  function apply(gg, ev) { ev.forEach(function (e) { gg = Core.reduce(gg, e); }); return gg; }
  g = apply(g, Cas.castFreeEvents(r.hit));
  ok(g.cards["b"].zone === "stack", "the hit Bear was put on the stack (cast free)");
  ok(J(Cas.bottomEvents(r.exiled, r.hit).map(function (e) { return e.instanceId; })) === J(["o"]), "the Ogre is bottomed, the hit isn't");
})();

// 4) no cheaper nonland -> no hit, everything is exiled
(function () {
  const g = Core.init({ seats: 2, decks: [[
    { instanceId: "o", name: "Ogre", zone: "library" }, // MV 5, not < 2
    { instanceId: "f", name: "Forest", zone: "library" }
  ], []] });
  const r = Cas.cascade(g, 0, 2, {});
  ok(r.hit === null && r.exiled.length === 2, "no nonland cheaper than 2 -> whiff, all exiled");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
