// Test for rules-support.js — support N (CR 701.42): a +1/+1 counter on each of up to N target creatures.
// Pure. Run: node tests/rules-support.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const SU = loadInto(G, "rules-support.js", "MTGRulesSupport");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Captain", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 }, support: 2 });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } });
Cards.define("Wolf", { types: ["creature"], power: 3, toughness: 1, mana: { generic: 3 } });
Cards.define("Rock", { types: ["artifact"], mana: { generic: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "cap", name: "Captain", zone: "battlefield" },
    { instanceId: "be", name: "Bear", zone: "battlefield" },
    { instanceId: "wo", name: "Wolf", zone: "battlefield" },
    { instanceId: "ro", name: "Rock", zone: "battlefield" }
  ], []] });
}

// 1) support N detection
ok(SU.supportN(Cards.get("Captain")) === 2, "supportN returns 2");
ok(SU.supportN(Cards.get("Bear")) === null, "no support -> null");

// 2) canSupport: up to N creature targets, no dupes, no noncreatures
ok(SU.canSupport(build(), "cap", ["be", "wo"], 0, {}).ok === true, "can support 2 creatures");
ok(/at most 2/.test(SU.canSupport(build(), "cap", ["be", "wo", "cap"], 0, {}).reason), "3 targets exceeds N=2");
ok(/must be creatures/.test(SU.canSupport(build(), "cap", ["ro"], 0, {}).reason), "can't support the artifact");
ok(/only once/.test(SU.canSupport(build(), "cap", ["be", "be"], 0, {}).reason), "can't target the same creature twice");

// 3) supportEvents: one +1/+1 counter on each target
(function () {
  let g = build();
  g = apply(g, SU.supportEvents(g, ["be", "wo"], {}));
  ok((g.cards["be"].counters && g.cards["be"].counters["+1/+1"]) === 1, "Bear got a +1/+1 counter");
  ok((g.cards["wo"].counters && g.cards["wo"].counters["+1/+1"]) === 1, "Wolf got a +1/+1 counter");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
