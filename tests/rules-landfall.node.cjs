// Test for rules-landfall.js — a land ETB triggers landfall abilities its controller controls.
// No DOM, no network. Run: node tests/rules-landfall.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const L = loadInto(G, "rules-landfall.js", "MTGRulesLandfall");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Plains", { types: ["land"], subtypes: ["plains"], produces: "W" });
Cards.define("Lotus Cobra", { types: ["creature"], colors: ["G"], power: 2, toughness: 1, abilities: ["landfall"] });
Cards.define("Grove Watcher", { types: ["creature"], colors: ["G"], power: 1, toughness: 1, triggers: [{ on: "landfall", effects: [{ t: "adjust_life", seat: "controller", delta: 1 }] }] });
Cards.define("Plain Bear", { types: ["creature"], colors: ["G"], power: 2, toughness: 2 });

const bf = (id, name, seat, zone) => ({ instanceId: id, name: name, zone: zone || "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) isLand recognizes lands and rejects creatures
(function () {
  const g = game({ land: bf("land", "Plains", 0), cob: bf("cob", "Lotus Cobra", 0) });
  ok(L.isLand(g, "land", {}) === true && L.isLand(g, "cob", {}) === false, "isLand: land yes, creature no");
})();

// 2) a landfall creature (abilities list) triggers when YOUR land enters
(function () {
  const g = game({ land: bf("land", "Plains", 0), cob: bf("cob", "Lotus Cobra", 0) });
  const t = L.landfallTriggers(g, "land", {});
  ok(t.length === 1 && t[0].source === "cob" && t[0].controllerSeat === 0, "Lotus Cobra triggers on your land");
})();

// 3) a landfall defined via def.triggers also fires
(function () {
  const g = game({ land: bf("land", "Plains", 0), gw: bf("gw", "Grove Watcher", 0) });
  const t = L.landfallTriggers(g, "land", {});
  ok(t.length === 1 && t[0].source === "gw", "trigger-defined landfall fires");
})();

// 4) opponent's landfall permanents do NOT trigger off your land
(function () {
  const g = game({ land: bf("land", "Plains", 0), mine: bf("mine", "Lotus Cobra", 0), theirs: bf("theirs", "Lotus Cobra", 1) });
  const t = L.landfallTriggers(g, "land", {});
  ok(t.length === 1 && t[0].source === "mine", "only the land controller's landfall fires");
})();

// 5) two landfall permanents you control -> two triggers
(function () {
  const g = game({ land: bf("land", "Plains", 0), cob: bf("cob", "Lotus Cobra", 0), gw: bf("gw", "Grove Watcher", 0) });
  const t = L.landfallTriggers(g, "land", {});
  ok(t.length === 2, "two landfall sources -> two triggers");
})();

// 6) a non-landfall creature contributes nothing
(function () {
  const g = game({ land: bf("land", "Plains", 0), pb: bf("pb", "Plain Bear", 0) });
  ok(L.landfallTriggers(g, "land", {}).length === 0, "vanilla creature -> no landfall trigger");
})();

// 7) EDGE: the entering permanent is a creature, not a land -> no triggers at all
(function () {
  const g = game({ notland: bf("notland", "Plain Bear", 0), cob: bf("cob", "Lotus Cobra", 0) });
  ok(J(L.landfallTriggers(g, "notland", {})) === J([]), "non-land ETB -> no landfall");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
