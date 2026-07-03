// Test for rules-amass.js — make/grow an Army: create a 0/0 black Army token if none, then add N +1/+1.
// No DOM, no network, no engine-core needed. Run: node tests/rules-amass.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const Am = loadInto(G, "rules-amass.js", "MTGRulesAmass");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
const ev = (out, t) => (out || []).filter((e) => e.t === t);

Cards.define("Existing Army", { types: ["creature"], subtypes: ["Zombie", "Army"], colors: ["B"], power: 0, toughness: 0 });
Cards.define("Some Bear", { types: ["creature"], subtypes: ["Bear"], power: 2, toughness: 2 });

const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: counters || {} });
// include a log array (token id derives from log length, like rules-tokens.js)
const game = (cards, log) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards, log: log || [] });

// 1) no Army yet -> create a 0/0 black Army token, then add N +1/+1 counters
(function () {
  const g = game({}, [1, 2, 3]);
  const r = Am.amass(g, 0, 2, "Zombie", {});
  ok(r.created === true, "creates a token when you control no Army");
  const tc = ev(r.events, "token_create")[0];
  ok(tc && tc.name === "Zombie Army" && tc.ownerSeat === 0 && tc.zone === "battlefield", "token is a Zombie Army on the battlefield");
  const cc = ev(r.events, "card_counter")[0];
  ok(cc && cc.kind === "+1/+1" && cc.delta === 2 && cc.instanceId === r.armyId, "two +1/+1 counters land on the new Army");
})();

// 2) the created Army def is registered as a 0/0 black creature with [type, "Army"] subtypes
(function () {
  const g = game({}, []);
  Am.amass(g, 0, 1, "Orc", {});
  const def = Cards.get("Orc Army");
  ok(def && def.power === 0 && def.toughness === 0 && J(def.colors) === J(["B"]), "Orc Army def is a 0/0 black creature");
  ok(def.subtypes.indexOf("Orc") >= 0 && def.subtypes.indexOf("Army") >= 0, "Orc Army has both Orc and Army subtypes");
})();

// 3) already control an Army -> NO token; counters go on the existing Army
(function () {
  const g = game({ ea: bf("ea", "Existing Army", 0) });
  const r = Am.amass(g, 0, 3, "Zombie", {});
  ok(r.created === false && ev(r.events, "token_create").length === 0, "no new token when an Army already exists");
  ok(r.armyId === "ea" && ev(r.events, "card_counter")[0].delta === 3, "counters grow the existing Army");
})();

// 4) the Army keeps growing across repeated amass on the same existing Army
(function () {
  const g = game({ ea: bf("ea", "Existing Army", 0, { "+1/+1": 2 }) });
  const r = Am.amass(g, 0, 1, "Zombie", {});
  ok(r.armyId === "ea" && ev(r.events, "card_counter")[0].delta === 1, "amass 1 adds one more counter to the same Army");
})();

// 5) only counts the SEAT's own Armies (an opponent's Army doesn't satisfy "control an Army") [EDGE]
(function () {
  const g = game({ opp: bf("opp", "Existing Army", 1) });
  ok(J(Am.armiesControlled(g, 0, {})) === J([]), "opponent's Army is not yours");
  const r = Am.amass(g, 0, 1, "Zombie", {});
  ok(r.created === true, "you still mint your own Army even if an opponent has one");
})();

// 6) a non-Army creature you control is not treated as an Army [EDGE]
(function () {
  const g = game({ bear: bf("bear", "Some Bear", 0) });
  ok(Am.isArmy(g, "bear", {}) === false && J(Am.armiesControlled(g, 0, {})) === J([]), "a Bear is not an Army");
})();

// 7) amass N=0 on an existing Army -> no counter event (token logic still unchanged)
(function () {
  const g = game({ ea: bf("ea", "Existing Army", 0) });
  const r = Am.amass(g, 0, 0, "Zombie", {});
  ok(ev(r.events, "card_counter").length === 0 && r.created === false, "amass 0 adds no counters");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
