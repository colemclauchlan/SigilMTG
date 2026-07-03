// Test for rules-encore.js — exile from graveyard, a token copy per living opponent (attacking, haste), sac at EOT. Pure.
// Run: node tests/rules-encore.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const En = loadInto(G, "rules-encore.js", "MTGRulesEncore");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Encore Beast", { types: ["creature"], colors: ["R"], subtypes: ["Beast"], mana: { generic: 3, R: 1 }, power: 3, toughness: 3, encore: { generic: 2, R: 1 } });
Cards.define("Plain Bear", { types: ["creature"], colors: ["G"], mana: { G: 1 }, power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(seats, zone, mana) {
  let decks = []; for (let i = 0; i < seats; i++) decks.push([]);
  decks[0] = [{ instanceId: "e", name: "Encore Beast", zone: zone || "graveyard" }];
  let g = Core.init({ seats: seats, startingLife: 20, decks: decks });
  if (mana) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: mana });
  return g;
}

// 1) encoreCost / canEncore legality
(function () {
  ok(J(En.encoreCost(Cards.get("Encore Beast"))) === J({ generic: 2, R: 1 }), "reads the encore cost");
  ok(En.canEncore(build(2, "graveyard", 3), "e", {}).ok === true, "can encore from graveyard with {2}{R}");
  ok(En.canEncore(build(2, "graveyard", 0), "e", {}).ok === false, "can't encore with no mana");
  ok(/graveyard/.test(En.canEncore(build(2, "hand", 3), "e", {}).reason), "encore only works from the graveyard");
})();

// 2) tokenSpec copies printed characteristics
(function () {
  let spec = En.tokenSpec(build(2, "graveyard"), "e", {});
  ok(spec.power === 3 && spec.toughness === 3, "token copies printed P/T");
  ok(J(spec.subtypes) === J(["Beast"]), "token copies subtypes");
})();

// 3) opponentsOf lists only living opponents in seat order
(function () {
  let g = build(4, "graveyard", 3);
  ok(J(En.opponentsOf(g, 0)) === J([1, 2, 3]), "three opponents in a 4-player game");
  g = Core.reduce(g, { t: "set_life", seat: 2, value: 0 });
  ok(J(En.opponentsOf(g, 0)) === J([1, 3]), "a dead opponent (0 life) is excluded");
})();

// 4) encore exiles the card and makes one attacking, marked token per opponent (2p -> 1)
(function () {
  let g = build(2, "graveyard", 3);
  let ev = En.encore(g, "e", {});
  ok(ev.some(function (e) { return e.t === "card_move" && e.instanceId === "e" && e.toZone === "exile"; }), "the graveyard card is exiled as a cost");
  let creates = ev.filter(function (e) { return e.t === "token_create"; });
  ok(creates.length === 1, "one token in a 2-player game (one opponent)");
  let combats = ev.filter(function (e) { return e.t === "card_combat" && e.attacking === true; });
  ok(combats.length === 1, "the token is declared attacking");
  g = apply(g, ev);
  ok(g.cards["e"].zone === "exile", "after applying, the card is exiled");
  let tid = creates[0].instanceId;
  ok(g.cards[tid] && g.cards[tid].zone === "battlefield" && g.cards[tid].encoreToken === true, "the token exists on the battlefield, marked encoreToken");
  ok(g.cards[tid].attacking === true && g.cards[tid].encoreTarget === 1, "the token is attacking its assigned opponent (seat 1)");
  ok((g.players[0].counters.mana_R || 0) === 0, "the {2}{R} encore cost was paid");
})();

// 5) a 3-player game yields two token copies
(function () {
  let g = build(3, "graveyard", 3);
  let creates = En.encore(g, "e", {}).filter(function (e) { return e.t === "token_create"; });
  ok(creates.length === 2, "two tokens in a 3-player game (two opponents)");
})();

// 6) endOfTurnEvents sacrifices every encore token
(function () {
  let g = build(2, "graveyard", 3);
  g = apply(g, En.encore(g, "e", {}));
  let eot = En.endOfTurnEvents(g, {});
  ok(eot.length === 1 && eot[0].toZone === "graveyard", "encore token is sacrificed at the end step");
  g = apply(g, eot);
  let tokId = Object.keys(g.cards).filter(function (id) { return g.cards[id].encoreToken; })[0];
  ok(g.cards[tokId].zone === "graveyard", "after applying, the token is in the graveyard");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);