// Test for rules-riot.js — ETB choice of a +1/+1 counter OR haste; autoChoice policy. Pure.
// Run: node tests/rules-riot.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const R = loadInto(G, "rules-riot.js", "MTGRulesRiot");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Riot Rhino", { types: ["creature"], colors: ["G"], mana: { generic: 2, G: 1 }, abilities: ["riot"], power: 4, toughness: 4 });
Cards.define("Riot Haste Dino", { types: ["creature"], colors: ["R"], mana: { generic: 3, R: 1 }, abilities: ["riot", "haste"], power: 5, toughness: 5 });
Cards.define("Plain Wall", { types: ["creature"], colors: ["W"], mana: { W: 1 }, power: 0, toughness: 4 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(name, active) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "c", name: name, zone: "battlefield" }], []] });
  if (active != null) g = Core.reduce(g, { t: "__set", activeSeat: active });
  return g;
}

// 1) hasRiot detection
(function () {
  ok(R.hasRiot(build("Riot Rhino"), "c", {}) === true, "detects riot");
  ok(R.hasRiot(build("Plain Wall"), "c", {}) === false, "a creature without riot has none");
})();

// 2) enterEvents(counter) adds a +1/+1 counter
(function () {
  let g = build("Riot Rhino");
  let ev = R.enterEvents(g, "c", "counter", {});
  ok(J(ev) === J([{ t: "card_counter", instanceId: "c", kind: "+1/+1", delta: 1 }]), "counter choice emits a +1/+1 counter");
  g = apply(g, ev);
  ok((g.cards["c"].counters["+1/+1"] || 0) === 1, "the +1/+1 counter landed");
})();

// 3) enterEvents(haste) sets the riotHaste marker and hasHaste honors it
(function () {
  let g = build("Riot Rhino");
  let ev = R.enterEvents(g, "c", "haste", {});
  ok(ev.length === 1 && ev[0].t === "__set" && ev[0].cards[0].fields.riotHaste === true, "haste choice sets the riotHaste marker");
  ok(R.hasHaste(g, "c", {}) === false, "no haste before the marker is applied");
  g = apply(g, ev);
  ok(R.hasHaste(g, "c", {}) === true, "hasHaste true after the riotHaste marker");
})();

// 4) enterEvents on a non-riot creature is a no-op
(function () {
  ok(J(R.enterEvents(build("Plain Wall"), "c", "haste", {})) === J([]), "no riot -> no enter events");
})();

// 5) autoChoice policy
(function () {
  ok(R.autoChoice(build("Riot Rhino", 0), "c", {}) === "haste", "on its controller's turn a riot creature takes haste");
  ok(R.autoChoice(build("Riot Rhino", 1), "c", {}) === "counter", "off-turn it banks the counter");
  ok(R.autoChoice(build("Riot Haste Dino", 0), "c", {}) === "counter", "printed haste makes the counter strictly better");
})();

// 6) printed haste is hasty regardless of riot choice
(function () {
  ok(R.hasHaste(build("Riot Haste Dino"), "c", {}) === true, "printed-haste riot creature is already hasty");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
