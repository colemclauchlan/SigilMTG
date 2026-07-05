// Integration test: static anthems fold into effective P/T (the wiring behind table.js effPT/effToughness
// and engine-assist.analyze). rules-static.effectsForCard -> rules-layers.computeEffectiveState. Pure.
// Run: node tests/integration-anthem.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Layers = loadInto(G, "rules-layers.js", "MTGRulesLayers");
const Static = loadInto(G, "rules-static.js", "MTGRulesStatic");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("TestAnthem", { types: ["enchantment"], static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });
Cards.define("ElfLord", { types: ["creature"], subtypes: ["elf"], power: 2, toughness: 2, static: [{ kind: "anthem", affects: "other-creatures-you-control", subtype: "elf", power: 1, toughness: 1 }] });
Cards.define("TestBear", { types: ["creature"], subtypes: [], power: 2, toughness: 2 });
Cards.define("TestElf", { types: ["creature"], subtypes: ["elf"], power: 1, toughness: 1 });

// seat 0: anthem + a bear + an elf-lord + an elf ; seat 1: a bear (opponent)
const g = Core.init({ seats: 2, decks: [[
  { instanceId: "an", name: "TestAnthem", zone: "battlefield" },
  { instanceId: "be", name: "TestBear", zone: "battlefield" },
  { instanceId: "lord", name: "ElfLord", zone: "battlefield" },
  { instanceId: "elf", name: "TestElf", zone: "battlefield" }
], [
  { instanceId: "obe", name: "TestBear", zone: "battlefield" }
]] });

function effPT(id) {
  const c = g.cards[id], def = Cards.get(c.name);
  const base = Cards.printedBase(def, { counters: c.counters, controller: c.controllerSeat });
  return Layers.computeEffectiveState(base, Static.effectsForCard(g, id, {}));
}

// 1) your creature gets the +1/+1 anthem
(function () { const e = effPT("be"); ok(e.power === 3 && e.toughness === 3, "your Bear is 3/3 under Glorious-Anthem-style buff (got " + e.power + "/" + e.toughness + ")"); })();

// 2) the opponent's creature is NOT buffed by your anthem
(function () { const e = effPT("obe"); ok(e.power === 2 && e.toughness === 2, "opponent Bear stays 2/2 (got " + e.power + "/" + e.toughness + ")"); })();

// 3) an Elf gets BOTH the global anthem (+1/+1) AND the elf-lord's "other elves" (+1/+1) -> 3/3 from base 1/1
(function () { const e = effPT("elf"); ok(e.power === 3 && e.toughness === 3, "Elf gets anthem + elf-lord = 3/3 (got " + e.power + "/" + e.toughness + ")"); })();

// 4) the elf-lord does NOT buff itself with its own "other elves" anthem, but the global anthem still applies -> 3/3 from 2/2
(function () { const e = effPT("lord"); ok(e.power === 3 && e.toughness === 3, "Elf-lord buffed by global anthem only, not its own -> 3/3 (got " + e.power + "/" + e.toughness + ")"); })();

// 5) effectsForCard returns the raw layer effects for the bear (one anthem)
(function () { const fx = Static.effectsForCard(g, "be", {}); ok(fx.length === 1 && fx[0].op === "pt_mod" && fx[0].power === 1, "bear has exactly one +1/+1 anthem effect"); })();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
