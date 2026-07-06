// Test for rules-unleash.js — unleash (CR 702.86): may enter with a +1/+1 counter; can't block while it has
// one. Pure. Run: node tests/rules-unleash.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const UN = loadInto(G, "rules-unleash.js", "MTGRulesUnleash");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Beast", { types: ["creature"], power: 3, toughness: 3, mana: { generic: 2, R: 1 }, unleash: true });
Cards.define("Vanilla", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "bs", name: "Beast", zone: "battlefield" },
    { instanceId: "va", name: "Vanilla", zone: "battlefield" }
  ], []] });
}

// 1) unleash detection
ok(UN.hasUnleash(Cards.get("Beast")) === true, "Beast has unleash");
ok(UN.hasUnleash(Cards.get("Vanilla")) === false, "Vanilla has no unleash");

// 2) enter with (or without) a +1/+1 counter
ok(UN.unleashEnterEvents(build(), "bs", true, {}).length === 1, "choosing the counter -> one +1/+1 event");
ok(UN.unleashEnterEvents(build(), "bs", false, {}).length === 0, "declining -> no counter event");

// 3) can't block while it has a +1/+1 counter; can block once the counter is gone
(function () {
  let g = build();
  g = apply(g, UN.unleashEnterEvents(g, "bs", true, {}));
  ok(UN.canBlock(g, "bs", {}) === false, "unleashed (has +1/+1) -> can't block");
  g = Core.reduce(g, { t: "card_counter", instanceId: "bs", kind: "+1/+1", delta: -1 });
  ok(UN.canBlock(g, "bs", {}) === true, "counter removed -> can block again");
})();

// 4) a non-unleash creature always blocks
ok(UN.canBlock(build(), "va", {}) === true, "a normal creature can block");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
