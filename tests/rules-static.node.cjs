// Pure-module test for rules-static.js (static abilities -> layer-system effects, effective P/T).
// No DOM, no network. Run: node tests/rules-static.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
const S = loadInto(G, "rules-static.js", "MTGRulesStatic");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const pt = (e) => e.power + "/" + e.toughness;

Cards.define("Glorious Anthem", { types: ["enchantment"], colors: ["W"], static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });
Cards.define("Goblin King", { types: ["creature"], subtypes: ["goblin"], colors: ["R"], power: 2, toughness: 2, static: [{ kind: "anthem", affects: "other-creatures-you-control", subtype: "goblin", power: 1, toughness: 1 }] });
Cards.define("Goblin Piker", { types: ["creature"], subtypes: ["goblin"], colors: ["R"], power: 2, toughness: 1 });
Cards.define("Grizzly Bears", { types: ["creature"], subtypes: ["bear"], colors: ["G"], power: 2, toughness: 2 });

const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards });
const bf = (id, name, seat, counters) => ({ instanceId: id, name, zone: "battlefield", controllerSeat: seat, counters: counters || {} });

// anthem buffs your creatures only
const g1 = game({ an: bf("an", "Glorious Anthem", 0), bear: bf("bear", "Grizzly Bears", 0), opp: bf("opp", "Grizzly Bears", 1) });
ok(pt(S.effectiveOnBoard(g1, "bear")) === "3/3", "anthem: your Bears -> 3/3");
ok(pt(S.effectiveOnBoard(g1, "opp")) === "2/2", "anthem: opponent's Bears unaffected -> 2/2");
ok(S.collectAnthems(g1, Cards).length === 1, "collectAnthems finds the one anthem on board");

// goblin lord buffs OTHER goblins, not itself, not non-goblins
const g2 = game({ king: bf("king", "Goblin King", 0), pike: bf("pike", "Goblin Piker", 0), bear: bf("bear", "Grizzly Bears", 0) });
ok(pt(S.effectiveOnBoard(g2, "pike")) === "3/2", "goblin lord: other goblin -> 3/2");
ok(pt(S.effectiveOnBoard(g2, "king")) === "2/2", "goblin lord: does not buff itself -> 2/2");
ok(pt(S.effectiveOnBoard(g2, "bear")) === "2/2", "goblin lord: non-goblin unaffected -> 2/2");

// two anthems stack
const g3 = game({ a1: bf("a1", "Glorious Anthem", 0), a2: bf("a2", "Glorious Anthem", 0), bear: bf("bear", "Grizzly Bears", 0) });
ok(pt(S.effectiveOnBoard(g3, "bear")) === "4/4", "two anthems stack -> 4/4");

// counters + anthem combine through the layer order (7c counters, 7d anthem)
const g4 = game({ an: bf("an", "Glorious Anthem", 0), bear: bf("bear", "Grizzly Bears", 0, { "+1/+1": 1 }) });
ok(pt(S.effectiveOnBoard(g4, "bear")) === "4/4", "anthem + a +1/+1 counter -> 4/4");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
