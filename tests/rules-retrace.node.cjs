// Test for rules-retrace.js — retrace (CR 702.82): cast from the graveyard by discarding a land. Pure.
// Run: node tests/rules-retrace.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const RT = loadInto(G, "rules-retrace.js", "MTGRulesRetrace");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Roar", { types: ["sorcery"], colors: ["G"], mana: { generic: 1, G: 1 }, retrace: true, spell: { token: "Beast" } });
Cards.define("Forest", { types: ["land"], produces: "G" });
Cards.define("Bear", { types: ["creature"], mana: { generic: 1, G: 1 }, power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
// Roar in the graveyard; a Forest + a Bear in hand.
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "rr", name: "Roar", zone: "graveyard" },
    { instanceId: "f", name: "Forest", zone: "hand" },
    { instanceId: "be", name: "Bear", zone: "hand" }
  ], []] });
}

// 1) hasRetrace detection
ok(RT.hasRetrace(Cards.get("Roar")) === true, "Roar has retrace");
ok(RT.hasRetrace(Cards.get("Bear")) === false, "Bear has no retrace");

// 2) landsInHand finds only the land
ok(JSON.stringify(RT.landsInHand(build(), 0, {})) === JSON.stringify(["f"]), "landsInHand -> [Forest]");

// 3) canRetrace: in graveyard, yours, has retrace, land available
ok(RT.canRetrace(build(), "rr", 0, {}).ok === true, "can retrace with a land in hand");
(function () {
  let g = build(); g = Core.reduce(g, { t: "card_move", instanceId: "f", toZone: "graveyard" }); // no land left in hand
  ok(/no land in hand/.test(RT.canRetrace(g, "rr", 0, {}).reason), "no land to discard -> rejected");
})();
(function () {
  let g = build(); g = Core.reduce(g, { t: "card_move", instanceId: "rr", toZone: "hand" });
  ok(/from your graveyard/.test(RT.canRetrace(g, "rr", 0, {}).reason), "not in graveyard -> rejected");
})();
(function () {
  let g = build(); g = Core.reduce(g, { t: "card_move", instanceId: "be", toZone: "graveyard" });
  ok(/no retrace/.test(RT.canRetrace(g, "be", 0, {}).reason), "card without retrace (in graveyard) -> rejected");
})();

// 4) retraceEvents: discard the land, move the card graveyard -> stack
(function () {
  let g = build();
  g = apply(g, RT.retraceEvents(g, "rr", "f", {}));
  ok(g.cards["f"].zone === "graveyard", "the land was discarded");
  ok(g.cards["rr"].zone === "stack", "the retraced card is on the stack");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
