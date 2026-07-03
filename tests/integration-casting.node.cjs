// Cross-module integration — the alt-cost / alt-zone CASTING family threaded through one game:
// an X burn, a flashback from the graveyard (then exiled), cycling (discard+draw), and a suspend that
// ticks down and is cast. No engine-core, no torn modules. Run: node tests/integration-casting.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const X = loadInto(G, "rules-xspells.js", "MTGRulesXSpells");
const FB = loadInto(G, "rules-flashback.js", "MTGRulesFlashback");
const Cy = loadInto(G, "rules-cycling.js", "MTGRulesCycling");
const Su = loadInto(G, "rules-suspend.js", "MTGRulesSuspend");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Fireball", { types: ["sorcery"], colors: ["R"], mana: { R: 1 }, spell: { xDamage: true, target: "any" } });
Cards.define("Flashy Bolt", { types: ["instant"], colors: ["R"], mana: { R: 1 }, flashback: { generic: 2, R: 1 }, spell: { damage: 3, target: "any" } });
Cards.define("Cycler", { types: ["creature"], colors: ["W"], mana: { generic: 4, W: 1 }, power: 4, toughness: 4, cycling: { generic: 2 } });
Cards.define("Rift Bolt", { types: ["sorcery"], colors: ["R"], mana: { generic: 2, R: 1 }, suspend: { n: 1 }, spell: { damage: 3, target: "any" } });
Cards.define("Filler", { types: ["sorcery"], colors: ["R"], mana: { R: 1 }, spell: { effects: [] } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
let g = Core.init({ seats: 2, startingLife: 20, seed: "cast", decks: [[
  { instanceId: "cycler", name: "Cycler", zone: "hand" },
  { instanceId: "rift", name: "Rift Bolt", zone: "hand" },
  { instanceId: "flashy", name: "Flashy Bolt", zone: "graveyard" },
  { instanceId: "f1", name: "Filler", zone: "library" },
  { instanceId: "f2", name: "Filler", zone: "library" }
], []] });
g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: 3 });
g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: 6 });

// 1) an X burn: Fireball for X=2 at the opponent -> 20 -> 18
g = apply(g, X.xDamageEffects({ kind: "player", seat: 1 }, 2));
ok(g.game ? false : g.players[1].life === 18, "Fireball X=2 dropped the opponent to 18");

// 2) flashback Flashy Bolt from the graveyard: pay {2}{R}, resolve 3 damage, then exile it
ok(FB.canFlashback(g, "flashy", 0, {}).ok, "Flashy Bolt can be flashed back");
g = apply(g, FB.flashbackEvents(g, "flashy", {}));         // graveyard -> stack, paid
g = apply(g, [{ t: "adjust_life", seat: 1, delta: -3 }]);  // its resolution (damage 3)
g = apply(g, FB.resolveExile(g, "flashy"));                // exiled, not graveyard
ok(g.players[1].life === 15, "the flashed-back Bolt brought the opponent to 15");
ok(g.cards["flashy"].zone === "exile", "the flashback spell was exiled (not back to the graveyard)");

// 3) cycling the Cycler: discard + draw a Filler
(function () {
  const handBefore = Core.cardsOf(g, 0, "hand").length;
  g = apply(g, Cy.cycleEvents(g, "cycler", {}));
  ok(g.cards["cycler"].zone === "graveyard", "the Cycler was cycled to the graveyard");
  ok(Core.cardsOf(g, 0, "hand").length === handBefore, "cycling kept the hand size (discard 1, draw 1)");
})();

// 4) suspend Rift Bolt, tick it to 0, then cast it (to the stack, with haste)
g = apply(g, Su.suspend(g, "rift", 1));
ok(g.cards["rift"].zone === "exile" && Su.timeCounters(g, "rift") === 1, "Rift Bolt suspended with 1 time counter");
g = apply(g, Su.tick(g, "rift"));
ok(Su.readyToCast(g, "rift"), "after one upkeep tick it's ready");
g = apply(g, Su.castEvents(g, "rift"));
ok(g.cards["rift"].zone === "stack" && g.cards["rift"].suspendHaste === true, "Rift Bolt cast from suspend, with haste");

// final tally: four different casting paths all resolved correctly on one game state
ok(g.players[1].life === 15 && g.cards["flashy"].zone === "exile" && g.cards["cycler"].zone === "graveyard" && g.cards["rift"].zone === "stack",
  "the whole alt-cost/zone casting sequence composed correctly");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
