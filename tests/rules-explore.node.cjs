// Test for rules-explore.js — explore (CR 701.40): reveal top of library; land -> hand, else +1/+1 counter.
// Pure.
// Run: node tests/rules-explore.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const EX = loadInto(G, "rules-explore.js", "MTGRulesExplore");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Scout", { types: ["creature"], power: 1, toughness: 1, mana: { generic: 1 } });
Cards.define("Forest", { types: ["land"], produces: "G" });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
// Scout on the battlefield; library top is the second deck entry.
function build(topName, nextName) {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "sc", name: "Scout", zone: "battlefield" },
    { instanceId: "top", name: topName, zone: "library" },
    { instanceId: "nxt", name: nextName, zone: "library" }
  ], []] });
}

// 1) topOfLibrary points at the top card
ok(EX.topOfLibrary(build("Forest", "Bear"), 0, {}) === "top", "topOfLibrary -> the top card");

// 2) explore reveals a LAND -> put it into hand, no counter
(function () {
  let g = build("Forest", "Bear");
  var r = EX.explore(g, "sc", 0, {});
  ok(r.isLand === true && r.revealed === "top", "revealed a land");
  g = apply(g, r.events);
  ok(g.cards["top"].zone === "hand", "the land went to hand");
  ok(!(g.cards["sc"].counters && g.cards["sc"].counters["+1/+1"]), "no counter for a land reveal");
})();

// 3) explore reveals a NONLAND -> +1/+1 counter on the creature, card stays on top
(function () {
  let g = build("Bear", "Forest");
  var r = EX.explore(g, "sc", 0, {});
  ok(r.isLand === false && r.revealed === "top", "revealed a nonland");
  g = apply(g, r.events);
  ok((g.cards["sc"].counters && g.cards["sc"].counters["+1/+1"]) === 1, "Scout got a +1/+1 counter");
  ok(g.cards["top"].zone === "library", "the nonland stays on top by default");
})();

// 4) sendRevealedToGraveyard: the optional nonland-to-graveyard choice
(function () {
  let g = build("Bear", "Forest");
  var r = EX.explore(g, "sc", 0, {});
  g = apply(g, r.events.concat(EX.sendRevealedToGraveyard(r.revealed)));
  ok(g.cards["top"].zone === "graveyard", "nonland can be put into the graveyard");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
