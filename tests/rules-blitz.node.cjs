// Test for rules-blitz.js — cast for blitz cost (haste + blitzed flag), draw on death, sac at next end step. Pure.
// Run: node tests/rules-blitz.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const B = loadInto(G, "rules-blitz.js", "MTGRulesBlitz");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Blitz Goblin", { types: ["creature"], colors: ["R"], mana: { generic: 3, R: 1 }, power: 4, toughness: 3, blitz: { generic: 1, R: 1 } });
Cards.define("No Blitz Bear", { types: ["creature"], colors: ["G"], mana: { generic: 1, G: 1 }, power: 2, toughness: 2 });
Cards.define("Hasty Ogre", { types: ["creature"], colors: ["R"], mana: { R: 1 }, abilities: ["haste"], power: 3, toughness: 3 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(name, mana) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "atk", name: name, zone: "hand" }], []] });
  if (mana) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: mana });
  return g;
}

// 1) blitzCost / canBlitz legality
(function () {
  ok(J(B.blitzCost(Cards.get("Blitz Goblin"))) === J({ generic: 1, R: 1 }), "reads the blitz cost");
  ok(B.blitzCost(Cards.get("No Blitz Bear")) === null, "no blitz cost on a plain creature");
  ok(B.canBlitz(build("Blitz Goblin", 2), "atk", {}).ok === true, "can blitz with {1}{R} available");
  ok(B.canBlitz(build("Blitz Goblin", 0), "atk", {}).ok === false, "can't blitz with no mana");
  ok(/no blitz cost/.test(B.canBlitz(build("No Blitz Bear", 2), "atk", {}).reason), "a creature without blitz can't be blitzed");
})();

// 2) canBlitz requires the card be in hand
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "atk", name: "Blitz Goblin", zone: "battlefield" }], []] });
  ok(B.canBlitz(g, "atk", {}).ok === false, "blitz is only castable from hand");
})();

// 3) castBlitz pays, enters battlefield, flags blitzed, grants haste
(function () {
  let g = build("Blitz Goblin", 2);
  g = apply(g, B.castBlitz(g, "atk", {}));
  ok(g.cards["atk"].zone === "battlefield", "the blitzed creature enters the battlefield");
  ok(g.cards["atk"].blitzed === true, "it is flagged blitzed");
  ok(B.isBlitzed(g, "atk") === true, "isBlitzed predicate true");
  ok(B.hasHaste(g, "atk", {}) === true, "a blitzed creature has haste");
  ok((g.players[0].counters.mana_R || 0) === 0, "the {1}{R} blitz cost was paid");
})();

// 4) hasHaste honors printed haste even when not blitzed
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "og", name: "Hasty Ogre", zone: "battlefield" }], []] });
  ok(B.hasHaste(g, "og", {}) === true, "printed haste is hasty without blitz");
  ok(B.isBlitzed(g, "og") === false, "a printed-haste creature isn't blitzed");
})();

// 5) onDeath draws a card only for a blitzed creature
(function () {
  let g = build("Blitz Goblin", 2);
  g = apply(g, B.castBlitz(g, "atk", {}));
  ok(J(B.onDeath(g, "atk", {})) === J([{ t: "draw", seat: 0, count: 1 }]), "blitzed death draws a card for the controller");
  let g2 = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "perm", name: "No Blitz Bear", zone: "battlefield" }], []] });
  ok(B.onDeath(g2, "perm", {}) === null, "a non-blitzed creature's death draws nothing");
})();

// 6) endOfTurnEvents sacrifices only blitzed creatures still on the battlefield
(function () {
  let g = build("Blitz Goblin", 2);
  g = apply(g, B.castBlitz(g, "atk", {}));
  let eot = B.endOfTurnEvents(g, {});
  ok(eot.length === 1 && eot[0].toZone === "graveyard" && eot[0].instanceId === "atk", "blitzed creature is sacrificed at the end step");
  g = apply(g, eot);
  ok(g.cards["atk"].zone === "graveyard", "the sacrifice moved it to the graveyard");
  let g2 = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "perm", name: "No Blitz Bear", zone: "battlefield" }], []] });
  ok(J(B.endOfTurnEvents(g2, {})) === J([]), "non-blitzed permanents are untouched at the end step");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
