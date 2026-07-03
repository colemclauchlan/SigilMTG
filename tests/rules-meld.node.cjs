// Test for rules-meld.js — a specific pair melds into one oversized permanent. Pure.
// Run: node tests/rules-meld.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const M = loadInto(G, "rules-meld.js", "MTGRulesMeld");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

// Gisela + Bruna -> Brisela (9/10 flying, first strike)
Cards.define("Gisela", { types: ["creature"], subtypes: ["angel"], colors: ["W"], power: 4, toughness: 3, abilities: ["flying", "first strike"], meldsWith: "Bruna", meldResult: "Brisela" });
Cards.define("Bruna", { types: ["creature"], subtypes: ["angel"], colors: ["W"], power: 5, toughness: 4, abilities: ["flying"], meldsWith: "Gisela", meldResult: "Brisela" });
Cards.define("Brisela", { types: ["creature"], subtypes: ["angel", "horror"], colors: ["W"], power: 9, toughness: 10, abilities: ["flying", "first strike"] });
Cards.define("Random Angel", { types: ["creature"], subtypes: ["angel"], colors: ["W"], power: 3, toughness: 3 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(names) {
  let cards = names.map(function (nm, i) { return { instanceId: "x" + i, name: nm, ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} }; });
  let g = Core.init({ seats: 2, startingLife: 20 });
  return Core.reduce(g, { t: "__add", cards: cards });
}

// 1) the right pair can meld
(function () {
  const g = build(["Gisela", "Bruna"]);
  const r = M.canMeld(g, "x0", "x1", {});
  ok(r.ok === true && r.result === "Brisela", "Gisela + Bruna can meld into Brisela");
})();

// 2) a wrong pair can't
(function () {
  const g = build(["Gisela", "Random Angel"]);
  ok(/not a meld pair/.test(M.canMeld(g, "x0", "x1", {}).reason), "Gisela + a random Angel is not a meld pair");
})();

// 3) melding produces the oversized permanent
(function () {
  let g = build(["Gisela", "Bruna"]);
  g = apply(g, M.meldEvents(g, "x0", "x1", {}));
  const p = M.meldedProfile(g, "x0", {});
  ok(p.name === "Brisela" && p.power === 9 && p.toughness === 10, "the meld result is Brisela, a 9/10");
  ok(p.abilities.indexOf("flying") >= 0 && p.abilities.indexOf("first strike") >= 0, "Brisela has flying + first strike");
  ok(g.cards["x1"].mergedInto === "x0", "the other half is folded into the meld");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
