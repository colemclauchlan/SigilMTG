// Pure-module tests for engine-core.js (rules-engine SPINE, Phase R0).
// No DOM, no network. Run: node tests/engine-core.node.cjs
// Proves the orchestration spine is structurally correct and deterministic BEFORE any card
// rules exist: stack LIFO, APNAP priority, all-pass -> resolve/step cascade, the SBA
// repeat-until-stable loop, trigger ordering, applyEvent purity, and event-log replay.

const fs = require("fs");
const path = require("path");
// This repo's package.json sets "type":"module", and table-core.js / engine-core.js are classic
// browser-global scripts. Load them the way the other Node tests do: eval the source with a fake
// `self`, capturing the global each script assigns. (A direct require() treats them as ESM, where
// `self`/`this` aren't the global object.) engine-core reads MTGCore off the shared `self`.
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
const OPTS = { seats: 4, deckSize: 10, seed: "r0" };

// ---- construction ----
(function () {
  E.resetRules();
  const s = E.create(OPTS);
  ok(s.game.seats === 4, "create: 4 seats via table-core");
  ok(s.stack.length === 0 && s.priority === 0 && s.passes === 0, "create: empty stack, priority=active, 0 passes");
  ok(Array.isArray(s.log) && s.log.length === 0, "create: empty event log");
})();

// ---- applyEvent purity + board-primitive composition ----
(function () {
  E.resetRules();
  const s0 = E.create(OPTS);
  const s1 = E.applyEvent(s0, { t: "draw", seat: 0, count: 3 });
  ok(Core.cardsOf(s1.game, 0, "hand").length === 3, "primitive: draw routes through table-core");
  ok(Core.cardsOf(s0.game, 0, "hand").length === 0, "purity: original estate is untouched by applyEvent");
  ok(s1.log.length === 0, "applyEvent does not log (literal transition); dispatch does");
  const s2 = E.dispatch(s0, { t: "draw", seat: 0, count: 1 });
  ok(s2.log.length === 1 && s2.log[0].t === "draw", "dispatch records the event to the log");
})();

// ---- stack is LIFO; resolution applies the object's effects ----
(function () {
  E.resetRules();
  let s = E.create(OPTS);
  s = E.dispatch(s, { t: "stack_push", id: "A", controllerSeat: 0, kind: "spell", effects: [{ t: "adjust_life", seat: 1, delta: -1 }] });
  s = E.dispatch(s, { t: "stack_push", id: "B", controllerSeat: 0, kind: "spell", effects: [{ t: "adjust_life", seat: 1, delta: -10 }] });
  ok(E.top(s).id === "B", "stack: last pushed is on top (LIFO)");
  s = E.dispatch(s, { t: "stack_resolve" });
  ok(s.game.players[1].life === 30, "resolve: top (B, -10) resolves first -> 40-10=30");
  ok(E.top(s).id === "A", "stack: A now on top");
  s = E.dispatch(s, { t: "stack_resolve" });
  ok(s.game.players[1].life === 29, "resolve: A (-1) resolves -> 29");
  ok(s.stack.length === 0, "stack empty after both resolve");
})();

// ---- priority passes in APNAP; all-pass on empty stack advances the step ----
(function () {
  E.resetRules();
  let s = E.create(OPTS);
  ok(J(E.apnapOrder(s)) === J([0, 1, 2, 3]), "APNAP order from active seat 0");
  s = E.applyEvent(s, { t: "priority_pass" });
  ok(s.priority === 1 && s.passes === 1, "pass 1 -> priority to seat 1");
  s = E.applyEvent(s, { t: "priority_pass" });
  s = E.applyEvent(s, { t: "priority_pass" });
  ok(s.priority === 3 && s.passes === 3, "passes accumulate around the table");
  // via the convenience helper, the 4th pass (all passed, empty stack) advances the step
  let s2 = E.passPriority(s);
  ok(s2.passes === 0 && s2.priority === 0, "all-pass on empty stack -> step advance, priority back to active");
})();

// ---- all-pass on a NON-empty stack resolves the top instead of advancing ----
(function () {
  E.resetRules();
  let s = E.create(OPTS);
  s = E.dispatch(s, { t: "stack_push", id: "X", controllerSeat: 0, kind: "spell", effects: [{ t: "adjust_life", seat: 2, delta: -4 }] });
  for (let i = 0; i < 4; i++) s = E.passPriority(s);
  ok(s.game.players[2].life === 36, "all-pass with non-empty stack resolved the top object (40-4=36)");
  ok(s.stack.length === 0, "stack emptied by the all-pass resolution");
})();

// ---- SBA hook: checked during advance, performed simultaneously, REPEATED until stable ----
(function () {
  E.resetRules();
  let calls = 0;
  E.registerSBA(function (game) {
    calls++;
    if (game.players[0].life > 20) return [{ t: "set_life", seat: 0, value: 20 }]; // fires, then self-clears
    return [];
  });
  let s = E.create(OPTS); // life 40
  s = E.advance(s);
  ok(s.game.players[0].life === 20, "SBA fired during advance and brought life to the threshold");
  ok(calls >= 2, "SBA loop re-checked after firing (repeat-until-stable)");
  E.resetRules();
})();

// ---- trigger hook: collected during advance, placed on the stack in APNAP order ----
(function () {
  E.resetRules();
  let fired = false;
  E.registerTrigger({
    collect: function () {
      if (fired) return [];
      fired = true;
      return [
        { id: "trgC", controllerSeat: 2, source: null, effects: [{ t: "adjust_life", seat: 2, delta: 1 }] },
        { id: "trgB", controllerSeat: 1, source: null, effects: [{ t: "adjust_life", seat: 1, delta: 1 }] }
      ];
    }
  });
  let s = E.create(OPTS); // active seat 0 -> APNAP [0,1,2,3]
  s = E.advance(s);
  ok(s.stack.length === 2, "advance pushed both triggered abilities onto the stack");
  ok(s.stack[0].controllerSeat === 1 && E.top(s).controllerSeat === 2, "triggers placed in APNAP order (seat 1 before seat 2)");
  ok(E.top(s).kind === "triggered", "pushed objects are marked as triggered abilities");
  E.resetRules();
})();

// ---- determinism: replaying the literal event log reproduces the exact state ----
(function () {
  E.resetRules();
  let s = E.create(OPTS);
  s = E.dispatch(s, { t: "draw", seat: 0, count: 3 });
  s = E.dispatch(s, { t: "stack_push", id: "sp1", controllerSeat: 0, kind: "spell", effects: [{ t: "adjust_life", seat: 1, delta: -3 }] });
  for (let i = 0; i < 4; i++) s = E.passPriority(s);   // resolves sp1 + advances
  s = E.dispatch(s, { t: "card_move", instanceId: "s0c0", toZone: "battlefield", x: 30, y: 40 });
  const r = E.replay(s.log, OPTS);
  ok(J(r.game) === J(s.game), "replay reproduces identical board state from the log");
  ok(J(r.stack) === J(s.stack) && r.priority === s.priority && r.passes === s.passes, "replay reproduces stack + priority + passes");
  ok(s.log.length > 8, "log captured the full flattened event sequence (" + s.log.length + " events)");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
