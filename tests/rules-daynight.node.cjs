// Test for rules-daynight.js — day/night transitions + werewolf transformation. Pure.
// Run: node tests/rules-daynight.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const DN = loadInto(G, "rules-daynight.js", "MTGRulesDayNight");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Moonrager", { types: ["creature"], colors: ["R"], power: 2, toughness: 2, werewolf: true, back: { name: "Full Moon Moonrager", power: 4, toughness: 4, abilities: ["trample"] } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }

// 1) it first becomes day
(function () {
  ok(DN.firstBecomes() === "day", "day/night first becomes day");
})();

// 2) the transition rules
(function () {
  ok(DN.nextState("day", 0) === "night", "day + 0 spells -> night");
  ok(DN.nextState("day", 1) === "day", "day + 1 spell -> stays day");
  ok(DN.nextState("night", 2) === "day", "night + 2 spells -> day");
  ok(DN.nextState("night", 1) === "night", "night + 1 spell -> stays night");
})();

// 3) becoming night transforms a werewolf to its back face
(function () {
  let g = Core.init({ seats: 2, startingLife: 20 });
  g = Core.reduce(g, { t: "__add", cards: [{ instanceId: "w", name: "Moonrager", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, flipped: false }] });
  const ev = DN.transformEventsFor(g, "night", {});
  ok(ev.length === 1 && ev[0].instanceId === "w", "becoming night flips the day-side werewolf");
  g = apply(g, ev);
  ok(!!g.cards["w"].flipped, "the werewolf is now on its back (wolf) face");
  // staying night -> no further flips
  ok(DN.transformEventsFor(g, "night", {}).length === 0, "no flip needed if it already matches night");
})();

// 4) becoming day transforms it back
(function () {
  let g = Core.init({ seats: 2, startingLife: 20 });
  g = Core.reduce(g, { t: "__add", cards: [{ instanceId: "w", name: "Moonrager", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, flipped: true }] });
  g = apply(g, DN.transformEventsFor(g, "day", {}));
  ok(!g.cards["w"].flipped, "becoming day flips the werewolf back to its front face");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
