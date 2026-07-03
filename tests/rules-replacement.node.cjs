// Pure-module test for rules-replacement.js (enters-the-battlefield replacements).
// No DOM, no network. Run: node tests/rules-replacement.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Layers = loadInto(G, "rules-layers.js", "MTGRulesLayers");
const Repl = loadInto(G, "rules-replacement.js", "MTGRulesReplacement");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const pt = (e) => e.power + "/" + e.toughness;

Cards.define("Hangarback", { types: ["artifact", "creature"], subtypes: ["construct"], power: 0, toughness: 0, entersWith: { counter: "+1/+1", count: 2 } });
Cards.define("Hardened Scales", { types: ["enchantment"], colors: ["G"], static: [{ kind: "etb-bonus", affects: "creatures-you-control", counter: "+1/+1", amount: 1 }] });
Cards.define("Tap Land", { types: ["land"], subtypes: ["gate"], entersTapped: true, produces: "R" });

const lib = [{ instanceId: "z", name: "Forest", zone: "library" }];

// enters with 2 +1/+1 counters -> a 0/0 becomes 2/2
(function () {
  let s = E.create({ seats: 2, decks: [[{ instanceId: "hb", name: "Hangarback", zone: "battlefield" }], lib] });
  s = Repl.applyEnter(E, s, "hb", {});
  ok(s.game.cards["hb"].counters["+1/+1"] === 2, "Hangarback enters with 2 +1/+1 counters");
  const eff = Layers.computeEffectiveState(Cards.printedBase(Cards.get("Hangarback"), { counters: s.game.cards["hb"].counters }), []);
  ok(pt(eff) === "2/2", "0/0 with two +1/+1 counters is effectively 2/2");
})();

// Hardened Scales adds one: enters with 3
(function () {
  let s = E.create({ seats: 2, decks: [[{ instanceId: "hs", name: "Hardened Scales", zone: "battlefield" }, { instanceId: "hb2", name: "Hangarback", zone: "battlefield" }], lib] });
  s = Repl.applyEnter(E, s, "hb2", {});
  ok(s.game.cards["hb2"].counters["+1/+1"] === 3, "Hardened Scales: Hangarback enters with 2+1 = 3 counters");
})();

// Hardened Scales only helps its controller's creatures
(function () {
  let s = E.create({ seats: 2, decks: [[{ instanceId: "hs", name: "Hardened Scales", zone: "battlefield" }], [{ instanceId: "hb3", name: "Hangarback", zone: "battlefield" }, { instanceId: "z2", name: "Forest", zone: "library" }]] });
  s = Repl.applyEnter(E, s, "hb3", {});
  ok(s.game.cards["hb3"].counters["+1/+1"] === 2, "opponent's Hangarback gets no bonus from my Hardened Scales (2)");
})();

// enters tapped
(function () {
  let s = E.create({ seats: 2, decks: [[{ instanceId: "tl", name: "Tap Land", zone: "battlefield" }], lib] });
  s = Repl.applyEnter(E, s, "tl", {});
  ok(s.game.cards["tl"].tapped === true, "a tap-land enters tapped");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
