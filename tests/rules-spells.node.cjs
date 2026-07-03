// Integration test for rules-spells.js — general targeted spells (bounce, destroy, burn).
// No DOM, no network. Run: node tests/rules-spells.node.cjs

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
loadInto(G, "rules-mana.js", "MTGRulesMana");
loadInto(G, "rules-targeting.js", "MTGRulesTargeting");
const Sp = loadInto(G, "rules-spells.js", "MTGRulesSpells");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Unsummon", { types: ["instant"], colors: ["U"], mana: { U: 1 }, spell: { target: "creature", effects: [{ t: "card_move", instanceId: "target", toZone: "hand" }] } });
Cards.define("Murder", { types: ["instant"], colors: ["B"], mana: { generic: 1, B: 2 }, spell: { target: "creature", effects: [{ t: "card_move", instanceId: "target", toZone: "graveyard" }] } });

function mk(spellName, mana) {
  let s = E.create({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sp", name: spellName, zone: "hand" }], [{ instanceId: "bear", name: "Bear", zone: "battlefield" }, { instanceId: "z", name: "Forest", zone: "library" }]] });
  Object.keys(mana || {}).forEach(function (c) { s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_" + c, delta: mana[c] }); });
  return s;
}

// Unsummon: return the opponent's Bear to its owner's hand
(function () {
  let s = mk("Unsummon", { U: 1 });
  const r = Sp.castSpell(E, s, "sp", { target: { kind: "card", instanceId: "bear" } }, {});
  ok(r.ok, "Unsummon casts");
  s = r.estate; s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.cards["bear"].zone === "hand", "the Bear was returned to hand");
  ok(s.game.cards["sp"].zone === "graveyard", "Unsummon went to the graveyard");
})();

// Murder: destroy the Bear
(function () {
  let s = mk("Murder", { B: 2, C: 1 });
  const r = Sp.castSpell(E, s, "sp", { target: { kind: "card", instanceId: "bear" } }, {});
  ok(r.ok, "Murder casts (paid {1}{B}{B})");
  s = r.estate; s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.cards["bear"].zone === "graveyard", "the Bear was destroyed");
})();

// rejections
(function () {
  let s = mk("Unsummon", {}); // no mana
  ok(Sp.castSpell(E, s, "sp", { target: { kind: "card", instanceId: "bear" } }, {}).reason === "cannot pay mana", "no mana -> rejected");
  let s2 = mk("Unsummon", { U: 1 });
  ok(Sp.castSpell(E, s2, "sp", { target: { kind: "player", seat: 1 } }, {}).reason === "illegal target", "targeting a player with a 'creature' spell -> rejected");
  let s3 = mk("Unsummon", { U: 1 });
  ok(Sp.castSpell(E, s3, "sp", {}, {}).reason === "target required", "no target -> rejected");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
