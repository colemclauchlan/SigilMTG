// Test for rules-escape.js — cast from graveyard paying mana + exiling N other graveyard cards. Pure.
// Run: node tests/rules-escape.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const Es = loadInto(G, "rules-escape.js", "MTGRulesEscape");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Underworld Beast", { types: ["creature"], colors: ["B"], mana: { generic: 3, B: 1 }, power: 5, toughness: 5, escape: { mana: { generic: 2, B: 1 }, exile: 2 } });
Cards.define("Junk", { types: ["sorcery"], colors: ["B"], mana: { B: 1 }, spell: { effects: [] } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(otherJunk, manaB, manaC) {
  let cards = [{ instanceId: "beast", name: "Underworld Beast", zone: "graveyard" }];
  for (let i = 0; i < otherJunk; i++) cards.push({ instanceId: "j" + i, name: "Junk", zone: "graveyard" });
  let g = Core.init({ seats: 2, startingLife: 20, decks: [cards, []] });
  if (manaB) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_B", delta: manaB });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}

// 1) can escape with mana + enough other cards
(function () {
  ok(Es.canEscape(build(3, 1, 2), "beast", 0, {}).ok === true, "can escape with {2}{B} + 3 other graveyard cards");
})();

// 2) not enough cards to exile, or not enough mana
(function () {
  ok(/not enough other/.test(Es.canEscape(build(1, 1, 2), "beast", 0, {}).reason), "only 1 other card -> can't pay the exile-2 cost");
  ok(/escape mana/.test(Es.canEscape(build(3, 0, 0), "beast", 0, {}).reason), "no mana -> can't pay the escape mana");
})();

// 3) escaping pays the mana, exiles 2 others, and puts the card on the stack
(function () {
  let g = build(3, 1, 2);
  g = apply(g, Es.escapeEvents(g, "beast", ["j0", "j1"], {}));
  ok(g.cards["beast"].zone === "stack", "the escaped creature is on the stack");
  ok(g.cards["j0"].zone === "exile" && g.cards["j1"].zone === "exile", "two other cards were exiled as the cost");
  ok(g.cards["j2"].zone === "graveyard", "the third junk card stays in the graveyard");
  ok((g.players[0].counters.mana_B || 0) === 0 && (g.players[0].counters.mana_C || 0) === 0, "the {2}{B} escape mana was paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
