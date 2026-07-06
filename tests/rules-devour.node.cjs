// Test for rules-devour.js — devour N (CR 702.83): sacrifice creatures, enter with N counters each. Pure.
// Run: node tests/rules-devour.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const DV = loadInto(G, "rules-devour.js", "MTGRulesDevour");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Ravager", { types: ["creature"], power: 1, toughness: 1, mana: { generic: 2, R: 1 }, devour: 1 });
Cards.define("Bird", { types: ["creature"], power: 1, toughness: 1, mana: { generic: 1 } });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });
Cards.define("Rock", { types: ["artifact"], mana: { generic: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "rv", name: "Ravager", zone: "battlefield" },
    { instanceId: "bi", name: "Bird", zone: "battlefield" },
    { instanceId: "be", name: "Bear", zone: "battlefield" },
    { instanceId: "ro", name: "Rock", zone: "battlefield" }
  ], []] });
}

// 1) devour N detection
ok(DV.devourN(Cards.get("Ravager")) === 1, "devourN returns 1");
ok(DV.devourN(Cards.get("Bear")) === null, "no devour -> null");

// 2) canDevour: only your creatures; not itself; not a noncreature
ok(DV.canDevour(build(), "rv", 0, ["bi", "be"], {}).ok === true, "can devour two creatures you control");
ok(/only sacrifice creatures/.test(DV.canDevour(build(), "rv", 0, ["ro"], {}).reason), "can't devour the artifact");
ok(/can't devour itself/.test(DV.canDevour(build(), "rv", 0, ["rv"], {}).reason), "can't devour itself");

// 3) devourEvents: sacrifice the chosen creatures, enter with N × count counters
(function () {
  let g = build();
  g = apply(g, DV.devourEvents(g, "rv", ["bi", "be"], {}));
  ok(g.cards["bi"].zone === "graveyard" && g.cards["be"].zone === "graveyard", "the two creatures were sacrificed");
  ok((g.cards["rv"].counters && g.cards["rv"].counters["+1/+1"]) === 2, "Ravager entered with 2 +1/+1 counters (1 × 2)");
})();

// 4) devouring nothing -> no counters
ok(DV.devourEvents(build(), "rv", [], {}).length === 0, "devouring no creatures -> no events");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
