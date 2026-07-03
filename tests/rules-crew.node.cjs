// Test for rules-crew.js — crew a Vehicle (total power >= crew N) -> it becomes a creature. Pure.
// Run: node tests/rules-crew.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const Crew = loadInto(G, "rules-crew.js", "MTGRulesCrew");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Truck", { types: ["artifact", "vehicle"], crew: 3, power: 5, toughness: 5 });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  let g = Core.init({ seats: 2, startingLife: 20 });
  return Core.reduce(g, { t: "__add", cards: [
    { instanceId: "truck", name: "Truck", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, crewed: false },
    { instanceId: "b1", name: "Bear", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, tapped: false },
    { instanceId: "b2", name: "Bear", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, tapped: false },
    { instanceId: "opp", name: "Bear", ownerSeat: 1, controllerSeat: 1, zone: "battlefield", counters: {}, tapped: false }
  ] });
}

// 1) a Vehicle isn't a creature until crewed
(function () {
  const g = build();
  ok(Crew.isCreature(g, "truck", {}) === false, "an un-crewed Vehicle is not a creature");
  ok(Crew.isCreature(g, "b1", {}) === true, "a Bear is a creature");
})();

// 2) two 2-power Bears (total 4 >= crew 3) can crew it
(function () {
  let g = build();
  ok(Crew.crewPower(g, ["b1", "b2"], {}) === 4, "two Bears = 4 power");
  ok(Crew.canCrew(g, "truck", ["b1", "b2"], {}).ok === true, "4 power crews a crew-3 Vehicle");
  g = apply(g, Crew.crewEvents(g, "truck", ["b1", "b2"], {}));
  ok(g.cards["b1"].tapped && g.cards["b2"].tapped, "the crew creatures are tapped");
  ok(g.cards["truck"].crewed === true && Crew.isCreature(g, "truck", {}) === true, "the Vehicle is now a creature");
})();

// 3) one Bear (2 power) is not enough for crew 3
(function () {
  const g = build();
  ok(Crew.canCrew(g, "truck", ["b1"], {}).ok === false, "2 power can't crew a crew-3 Vehicle");
})();

// 4) you can't crew with an opponent's creature, or a tapped one
(function () {
  let g = build();
  ok(Crew.canCrew(g, "truck", ["opp", "b1"], {}).ok === false, "can't crew with an opponent's creature");
  g = Core.reduce(g, { t: "card_tap", instanceId: "b1", tapped: true });
  ok(Crew.canCrew(g, "truck", ["b1", "b2"], {}).ok === false, "a tapped creature can't crew");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
