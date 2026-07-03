// Integration test for rules-activated.js — activated abilities through the engine.
// No DOM, no network. Run: node tests/rules-activated.node.cjs

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
const Act = loadInto(G, "rules-activated.js", "MTGRulesActivated");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
E.resetRules();

// "Tim": {T}: deal 1 damage to any target
Cards.define("Prodigal Sorcerer", { types: ["creature"], subtypes: ["human", "wizard"], colors: ["U"], power: 1, toughness: 1, mana: { generic: 2, U: 1 }, activated: [{ cost: { tap: true }, target: "any", effects: [{ t: "adjust_life", seat: "target", delta: -1 }] }] });
// a mana-cost pump-ish ability that gains its controller life: {1}: you gain 1 life
Cards.define("Lifewell", { types: ["artifact"], activated: [{ cost: { mana: { generic: 1 } }, effects: [{ t: "adjust_life", seat: "controller", delta: 1 }] }] });

function mk() { return E.create({ seats: 2, startingLife: 20, decks: [[{ instanceId: "tim", name: "Prodigal Sorcerer", zone: "battlefield" }, { instanceId: "well", name: "Lifewell", zone: "battlefield" }], [{ instanceId: "z", name: "Forest", zone: "library" }]] }); }

// activate Tim at the opponent
(function () {
  let s = mk();
  const r = Act.activate(E, s, "tim", 0, { target: { kind: "player", seat: 1 } }, {});
  ok(r.ok === true, "Tim activates");
  s = r.estate;
  ok(s.game.cards["tim"].tapped === true, "Tim is tapped to pay the cost");
  ok(s.stack.length === 1 && s.stack[0].kind === "ability", "the ability is on the stack");
  s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.players[1].life === 19, "ability resolved -> opponent took 1 (20 -> 19)");
})();

// can't activate a tap ability while already tapped
(function () {
  let s = mk();
  s = E.dispatch(s, { t: "card_tap", instanceId: "tim", tapped: true });
  const r = Act.activate(E, s, "tim", 0, { target: { kind: "player", seat: 1 } }, {});
  ok(r.ok === false && r.reason === "already tapped", "cannot use a {T} ability when already tapped");
})();

// illegal target is rejected
(function () {
  let s = mk();
  const r = Act.activate(E, s, "tim", 0, { target: { kind: "card", instanceId: "ghost" } }, {});
  ok(r.ok === false && r.reason === "illegal target", "illegal target rejected");
})();

// mana ability: needs mana, then pays it
(function () {
  let s = mk();
  let r = Act.activate(E, s, "well", 0, {}, {});
  ok(r.ok === false && r.reason === "cannot pay mana", "Lifewell can't activate with an empty pool");
  s = E.dispatch(s, { t: "player_counter", seat: 0, kind: "mana_C", delta: 1 });
  r = Act.activate(E, s, "well", 0, {}, {});
  ok(r.ok === true, "Lifewell activates once mana is available");
  s = r.estate;
  ok(!(s.game.players[0].counters.mana_C), "the {1} cost was paid from the pool");
  s = E.passPriority(s); s = E.passPriority(s);
  ok(s.game.players[0].life === 21, "Lifewell resolved -> controller gained 1 (20 -> 21)");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
