// Test for rules-flashback.js — cast from the graveyard for the flashback cost, then exile. Pure.
// Run: node tests/rules-flashback.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const FB = loadInto(G, "rules-flashback.js", "MTGRulesFlashback");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Flashy Bolt", { types: ["instant"], colors: ["R"], mana: { R: 1 }, flashback: { generic: 2, R: 1 }, spell: { damage: 3, target: "any" } });
Cards.define("No Flashback", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 3, target: "any" } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(name, manaR, manaC) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sp", name: name, zone: "graveyard" }], []] });
  if (manaR) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_R", delta: manaR });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  return g;
}

// 1) can flashback with the cost available
(function () {
  let g = build("Flashy Bolt", 1, 2);  // flashback {2}{R} = R:1 + 2 generic
  ok(FB.canFlashback(g, "sp", 0, {}).ok === true, "can flashback with {2}{R} available");
})();

// 2) can't without the cost / without flashback / from the wrong zone
(function () {
  ok(FB.canFlashback(build("Flashy Bolt", 0, 0), "sp", 0, {}).ok === false, "no mana -> can't flashback");
  ok(/no flashback/.test(FB.canFlashback(build("No Flashback", 1, 2), "sp", 0, {}).reason), "a spell without flashback can't be flashed back");
})();

// 3) flashback pays the cost, puts the spell on the stack, and marks it for exile
(function () {
  let g = build("Flashy Bolt", 1, 2);
  g = apply(g, FB.flashbackEvents(g, "sp", {}));
  ok(g.cards["sp"].zone === "stack", "the spell went from graveyard to the stack");
  ok((g.players[0].counters.mana_R || 0) === 0 && (g.players[0].counters.mana_C || 0) === 0, "the {2}{R} flashback cost was paid");
  ok(g.cards["sp"].flashbackCast === true, "it's marked as flashback-cast");
})();

// 4) on resolution a flashback-cast spell is EXILED (not put back in the graveyard)
(function () {
  let g = build("Flashy Bolt", 1, 2);
  g = apply(g, FB.flashbackEvents(g, "sp", {}));
  g = apply(g, FB.resolveExile(g, "sp"));
  ok(g.cards["sp"].zone === "exile", "the flashback spell was exiled");
  // a normally-cast spell would NOT be exiled by this
  let g2 = build("No Flashback", 1, 2);
  ok(FB.resolveExile(g2, "sp").length === 0, "a non-flashback spell isn't exiled by resolveExile");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
