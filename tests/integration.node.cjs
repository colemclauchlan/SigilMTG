// Cross-module integration test — many engine subsystems composing in one scenario.
// No DOM, no network. Run: node tests/integration.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
const KW = loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-combat.js", "MTGRulesCombat");
const SBA = loadInto(G, "rules-sba.js", "MTGRulesSBA");
const Tok = loadInto(G, "rules-tokens.js", "MTGRulesTokens");
loadInto(G, "rules-mana.js", "MTGRulesMana");
loadInto(G, "rules-targeting.js", "MTGRulesTargeting");
const Sp = loadInto(G, "rules-spells.js", "MTGRulesSpells");
const F = loadInto(G, "rules-fight.js", "MTGRulesFight");
const Loy = loadInto(G, "rules-loyalty.js", "MTGRulesLoyalty");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
E.resetRules();

Cards.define("Glorious Anthem", { types: ["enchantment"], colors: ["W"], static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });
Cards.define("Goblin Warchief", { types: ["creature"], subtypes: ["goblin"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", subtype: "goblin", keywords: ["haste"] }] });
Cards.define("Goblin Piker", { types: ["creature"], subtypes: ["goblin"], power: 2, toughness: 1 });
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Ogre", { types: ["creature"], power: 3, toughness: 3 });
Cards.define("Murder", { types: ["instant"], colors: ["B"], mana: { generic: 1, B: 2 }, spell: { target: "creature", effects: [{ t: "card_move", instanceId: "target", toZone: "graveyard" }] } });
Cards.define("Chandra", { types: ["planeswalker"], subtypes: ["chandra"], loyalty: 4, loyaltyAbilities: [{ cost: 1, effects: [{ t: "adjust_life", seat: "controller", delta: 2 }] }] });

const OPTS = { seats: 2, startingLife: 20, seed: "integ", decks: [[{ instanceId: "lib0", name: "Forest", zone: "library" }], [{ instanceId: "lib1", name: "Forest", zone: "library" }]] };
function add(s, id, name, seat) { return E.dispatch(s, { t: "__add", cards: [{ instanceId: id, cardId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: "battlefield", x: 50, y: 60, counters: {} }] }); }

let s = E.create(OPTS);
s = add(s, "anthem", "Glorious Anthem", 0);
s = add(s, "chief", "Goblin Warchief", 0);
s = add(s, "pike", "Goblin Piker", 0);
s = add(s, "obear", "Bear", 1);
s = add(s, "ogre", "Ogre", 1);

// 1) statics + keyword grants compose: Piker = 2/1 +anthem -> 3/2, with granted haste
(function () {
  const e = KW.effectiveFull(s.game, "pike", {});
  ok(e.power === 3 && e.toughness === 2 && e.abilities.indexOf("haste") >= 0, "anthem + lord: Goblin Piker is 3/2 with haste");
})();

// 2) tokens
s = Tok.createTokens(E, s, 0, { name: "Soldier", power: 1, toughness: 1, count: 2 });
ok(Core.cardsOf(s.game, 0, "battlefield").filter(function (c) { return c.name === "Soldier"; }).length === 2, "created two Soldier tokens");

// 3) a destroy spell removes the opponent's Bear
(function () {
  s = add(s, "murder", "Murder", 0);
  s = E.dispatch(s, { t: "card_move", instanceId: "murder", toZone: "hand" });
  s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_B", delta: 2 });
  s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_C", delta: 1 });
  const r = Sp.castSpell(E, s, "murder", { target: { kind: "card", instanceId: "obear" } }, {});
  ok(r.ok, "Murder cast at the opponent's Bear");
  s = r.estate; s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.cards["obear"].zone === "graveyard", "the Bear was destroyed");
})();

// 4) fight: the buffed Warchief (3/3) trades with the Ogre (3/3)
(function () {
  const r = F.fight(E, s, "chief", "ogre", {});
  s = r.estate;
  ok(s.game.cards["chief"].zone === "graveyard" && s.game.cards["ogre"].zone === "graveyard", "Warchief and Ogre fight and both die");
})();

// 5) planeswalker loyalty ability
(function () {
  s = add(s, "chandra", "Chandra", 0);
  s = Loy.enterLoyalty(E, s, "chandra", {});
  const r = Loy.activateLoyalty(E, s, "chandra", 0, {}, {});
  ok(r.ok && Loy.getLoyalty(r.estate.game.cards["chandra"]) === 5, "Chandra +1: loyalty 4 -> 5");
  s = r.estate; s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.players[0].life === 22, "Chandra +1 resolved: controller 20 -> 22");
})();

// 6) SBA detection
(function () {
  let s2 = E.dispatch(s, { t: "set_life", seat: 1, value: 0 });
  ok(SBA.detectAll(s2.game).some(function (f) { return f.kind === "player_loss" && f.seat === 1; }), "SBA flags the opponent at 0 life");
})();

// 7) the whole multi-system sequence replays deterministically
ok(J(E.replay(s.log, OPTS).game) === J(s.game), "the full integrated sequence replays deterministically");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
