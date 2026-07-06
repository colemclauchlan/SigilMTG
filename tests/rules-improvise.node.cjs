// Test for rules-improvise.js — improvise (CR 702.126): tap artifacts to pay {1} each. Pure.
// Run: node tests/rules-improvise.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const IM = loadInto(G, "rules-improvise.js", "MTGRulesImprovise");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Golem", { types: ["artifact", "creature"], mana: { generic: 5 }, power: 4, toughness: 4, improvise: true });
Cards.define("Plate", { types: ["artifact"], mana: { generic: 1 } });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });
Cards.define("Plain", { types: ["sorcery"], mana: { generic: 3 } }); // no improvise

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "go", name: "Golem", zone: "hand" },
    { instanceId: "p1", name: "Plate", zone: "battlefield" },
    { instanceId: "p2", name: "Plate", zone: "battlefield" },
    { instanceId: "be", name: "Bear", zone: "battlefield" }
  ], []] });
}

// 1) improvise detection
ok(IM.hasImprovise(Cards.get("Golem")) === true, "Golem has improvise");
ok(IM.hasImprovise(Cards.get("Plain")) === false, "Plain has no improvise");

// 2) untappedArtifacts lists both plates (not the creature)
ok(JSON.stringify(IM.untappedArtifacts(build(), 0, {})) === JSON.stringify(["p1", "p2"]), "untappedArtifacts -> [Plate, Plate]");

// 3) canImprovise: your untapped artifacts only; no creatures; no tapped; no dupes
ok(IM.canImprovise(build(), "go", 0, ["p1", "p2"], {}).ok === true, "can tap both plates for the Golem");
ok(/untapped artifacts/.test(IM.canImprovise(build(), "go", 0, ["be"], {}).reason), "can't improvise with a creature");
(function () {
  let g = build(); g = Core.reduce(g, { t: "card_tap", instanceId: "p1", tapped: true });
  ok(/untapped artifacts/.test(IM.canImprovise(g, "go", 0, ["p1"], {}).reason), "a tapped artifact can't be used");
})();
ok(/only once/.test(IM.canImprovise(build(), "go", 0, ["p1", "p1"], {}).reason), "can't tap the same artifact twice");

// 4) reduction + tap events
ok(IM.improviseReduction(["p1", "p2"]) === 2, "two artifacts cover {2} of the cost");
(function () {
  let g = build();
  g = apply(g, IM.improviseEvents(g, ["p1", "p2"], {}));
  ok(g.cards["p1"].tapped === true && g.cards["p2"].tapped === true, "both artifacts were tapped");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
