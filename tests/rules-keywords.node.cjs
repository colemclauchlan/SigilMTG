// Pure-module test for rules-keywords.js (keyword-granting statics + combined effective state).
// No DOM, no network. Run: node tests/rules-keywords.node.cjs

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
loadInto(G, "rules-static.js", "MTGRulesStatic");
const K = loadInto(G, "rules-keywords.js", "MTGRulesKeywords");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const pt = (e) => e.power + "/" + e.toughness;

Cards.define("Goblin Warchief", { types: ["creature"], subtypes: ["goblin"], colors: ["R"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", subtype: "goblin", keywords: ["haste"] }] });
Cards.define("Goblin Piker", { types: ["creature"], subtypes: ["goblin"], colors: ["R"], power: 2, toughness: 1 });
Cards.define("Grizzly Bears", { types: ["creature"], subtypes: ["bear"], colors: ["G"], power: 2, toughness: 2 });
Cards.define("Glorious Anthem", { types: ["enchantment"], colors: ["W"], static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });

const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards });
const bf = (id, name, seat) => ({ instanceId: id, name, zone: "battlefield", controllerSeat: seat, counters: {} });

// warchief grants haste to OTHER goblins, not itself, not non-goblins
const g1 = game({ chief: bf("chief", "Goblin Warchief", 0), pike: bf("pike", "Goblin Piker", 0), bear: bf("bear", "Grizzly Bears", 0) });
ok(K.effectiveFull(g1, "pike").abilities.indexOf("haste") >= 0, "warchief grants haste to other goblins");
ok(K.effectiveFull(g1, "chief").abilities.indexOf("haste") < 0, "warchief does not grant haste to itself");
ok(K.effectiveFull(g1, "bear").abilities.indexOf("haste") < 0, "non-goblin gets no haste");

// combined: anthem P/T (rules-static) AND keyword grant (here) on the same creature
const g2 = game({ chief: bf("chief", "Goblin Warchief", 0), pike: bf("pike", "Goblin Piker", 0), anthem: bf("anthem", "Glorious Anthem", 0) });
const eff = K.effectiveFull(g2, "pike");
ok(pt(eff) === "3/2" && eff.abilities.indexOf("haste") >= 0, "piker gets +1/+1 (anthem) AND haste (grant) together -> 3/2 haste");

// opponent's goblins unaffected
const g3 = game({ chief: bf("chief", "Goblin Warchief", 0), enemy: bf("enemy", "Goblin Piker", 1) });
ok(K.effectiveFull(g3, "enemy").abilities.indexOf("haste") < 0, "opponent's goblin gets no haste");

ok(K.collectGrants(g1, Cards).length === 1, "collectGrants finds the one grant on board");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
