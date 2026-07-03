// Test for rules-indestructible.js — survives lethal damage / destroy / deathtouch; granted counts.
// No DOM, no network, no engine-core needed. Run: node tests/rules-indestructible.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const I = loadInto(G, "rules-indestructible.js", "MTGRulesIndestructible");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Darksteel Myr", { types: ["artifact", "creature"], power: 0, toughness: 3, abilities: ["indestructible"] });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Steel Lord", { types: ["creature"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["indestructible"] }] });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) survivesLethal predicate over an effective-creature object
(function () {
  ok(I.survivesLethal({ abilities: ["indestructible"] }) === true, "indestructible survives lethal");
  ok(I.survivesLethal({ abilities: [] }) === false, "vanilla does not");
})();

// 2) isIndestructible reads the board
(function () {
  const g = game({ d: bf("d", "Darksteel Myr", 0), b: bf("b", "Bear", 0) });
  ok(I.isIndestructible(g, "d", {}) === true && I.isIndestructible(g, "b", {}) === false, "board read: only the Myr is indestructible");
})();

// 3) a "destroy all" spares the indestructible creatures
(function () {
  const g = game({ d: bf("d", "Darksteel Myr", 0), b: bf("b", "Bear", 0), b2: bf("b2", "Bear", 1) });
  ok(J(I.filterDestroy(g, ["d", "b", "b2"], {}).sort()) === J(["b", "b2"]), "Wrath kills the Bears, not the Myr");
})();

// 4) survivesCombat — indestructible shrugs off lethal + deathtouch; vanilla doesn't
(function () {
  const g = game({ d: bf("d", "Darksteel Myr", 0), b: bf("b", "Bear", 0) });
  ok(I.survivesCombat(g, "d", 99, true, {}) === true, "indestructible survives 99 deathtouch damage");
  ok(I.survivesCombat(g, "b", 2, false, {}) === false, "the 2/2 Bear dies to 2 damage");
  ok(I.survivesCombat(g, "b", 1, true, {}) === false, "the Bear dies to 1 deathtouch damage");
  ok(I.survivesCombat(g, "b", 1, false, {}) === true, "the Bear survives 1 normal damage");
})();

// 5) GRANTED indestructible counts (a lord grants it to teammates)
(function () {
  const g = game({ lord: bf("lord", "Steel Lord", 0), mate: bf("mate", "Bear", 0), foe: bf("foe", "Bear", 1) });
  ok(I.isIndestructible(g, "mate", {}) === true, "teammate has granted indestructible");
  ok(J(I.filterDestroy(g, ["mate", "foe"], {})) === J(["foe"]), "destroy spares the granted-indestructible teammate, kills the foe");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
