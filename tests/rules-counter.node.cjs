// Test for rules-counter.js + the engine-core counter_target effect — counterspells through the engine.
// Also a BACKWARD-COMPAT check that normal spell resolution is unchanged by the engine-core edit.
// No DOM, no network. Run: node tests/rules-counter.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
loadInto(G, "rules-targeting.js", "MTGRulesTargeting");
const Sp = loadInto(G, "rules-spells.js", "MTGRulesSpells");
const Ctr = loadInto(G, "rules-counter.js", "MTGRulesCounter");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
E.resetRules();
Cards.define("Bolt", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 3, target: "any" } });
Cards.define("Cancel", { types: ["instant"], colors: ["U"], mana: { generic: 1, U: 2 } });

function fresh() {
  let s = E.create({ seats: 2, startingLife: 20, seed: "ctr", decks: [[{ instanceId: "bolt", name: "Bolt", zone: "hand" }], [{ instanceId: "cancel", name: "Cancel", zone: "hand" }]] });
  s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_R", delta: 1 });
  s = E.dispatch(s, { t: "player_counter", seat: 1, kind: "mana_U", delta: 2 });
  s = E.dispatch(s, { t: "player_counter", seat: 1, kind: "mana_C", delta: 1 });
  return s;
}

// 1) a counterspell removes the targeted spell -> it never resolves; both go to the graveyard
(function () {
  let s = fresh();
  let r = Sp.castSpell(E, s, "bolt", { target: { kind: "player", seat: 1 } }, {}); ok(r.ok, "Bolt cast");
  s = r.estate;
  r = Ctr.castCounter(E, s, "cancel", "sp-bolt", {}); ok(r.ok, "Cancel cast at the Bolt on the stack");
  s = r.estate;
  ok(s.stack.length === 2, "both spells on the stack");
  s = E.passPriority(s); s = E.passPriority(s);          // top (Cancel) resolves, countering the Bolt
  ok(s.stack.length === 0, "stack empties (Cancel resolved, Bolt removed)");
  ok(s.game.players[1].life === 20, "the countered Bolt never dealt its 3 damage (life still 20)");
  ok(s.game.cards["bolt"].zone === "graveyard", "the countered Bolt is in the graveyard");
  ok(s.game.cards["cancel"].zone === "graveyard", "the Cancel (instant) is in the graveyard");
})();

// 2) BACKWARD-COMPAT: with no counter, a normal spell still resolves exactly as before
(function () {
  let s = fresh();
  let r = Sp.castSpell(E, s, "bolt", { target: { kind: "player", seat: 1 } }, {}); s = r.estate;
  s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.players[1].life === 17, "uncountered Bolt resolves for 3 (20->17) — engine-core edit is backward-compatible");
  ok(s.game.cards["bolt"].zone === "graveyard", "resolved Bolt went to the graveyard");
})();

// 3) "can't be countered" is honored (uncounterable flag survives on the stack object)
(function () {
  let s = fresh();
  s = E.dispatch(s, { t: "stack_push", id: "sp-x", controllerSeat: 0, kind: "spell", source: null, effects: [], uncounterable: true });
  ok(s.stack[s.stack.length - 1].uncounterable === true, "uncounterable flag is preserved on the stack object");
  let r = Ctr.castCounter(E, s, "cancel", "sp-x", {});
  ok(!r.ok && /can't be countered/.test(r.reason), "Cancel is rejected against an uncounterable spell");
  ok(s.game.cards["cancel"].zone === "hand", "Cancel was not spent on the illegal counter");
})();

// 4) can't pay -> rejected
(function () {
  let s = E.create({ seats: 2, startingLife: 20, seed: "ctr", decks: [[{ instanceId: "bolt", name: "Bolt", zone: "hand" }], [{ instanceId: "cancel", name: "Cancel", zone: "hand" }]] });
  s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_R", delta: 1 });
  let r = Sp.castSpell(E, s, "bolt", { target: { kind: "player", seat: 1 } }, {}); s = r.estate;
  r = Ctr.castCounter(E, s, "cancel", "sp-bolt", {});       // seat 1 has no mana
  ok(!r.ok && /pay/.test(r.reason), "no mana -> Cancel rejected");
})();

// 5) target not on the stack -> rejected
(function () {
  let s = fresh();
  let r = Ctr.castCounter(E, s, "cancel", "sp-nope", {});
  ok(!r.ok && /not on the stack/.test(r.reason), "countering a non-existent stack object is rejected");
})();

// 6) the counter scenario replays deterministically
(function () {
  const OPTS = { seats: 2, startingLife: 20, seed: "ctr", decks: [[{ instanceId: "bolt", name: "Bolt", zone: "hand" }], [{ instanceId: "cancel", name: "Cancel", zone: "hand" }]] };
  let s = E.create(OPTS);
  s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_R", delta: 1 });
  s = E.dispatch(s, { t: "player_counter", seat: 1, kind: "mana_U", delta: 2 });
  s = E.dispatch(s, { t: "player_counter", seat: 1, kind: "mana_C", delta: 1 });
  s = Sp.castSpell(E, s, "bolt", { target: { kind: "player", seat: 1 } }, {}).estate;
  s = Ctr.castCounter(E, s, "cancel", "sp-bolt", {}).estate;
  s = E.passPriority(s); s = E.passPriority(s);
  ok(J(E.replay(s.log, OPTS).game) === J(s.game), "the counter sequence replays deterministically");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
