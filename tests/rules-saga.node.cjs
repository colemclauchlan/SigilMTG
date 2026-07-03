// Test for rules-saga.js — lore counters drive chapter abilities; sacrifice after the last. Pure.
// Run: node tests/rules-saga.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const S = loadInto(G, "rules-saga.js", "MTGRulesSaga");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

// a 3-chapter saga: I gain 1, II draw 1, III deal 3 to a target
Cards.define("Three Lessons", { types: ["enchantment", "saga"], colors: ["W"], chapters: [
  { effects: [{ t: "adjust_life", seat: "controller", delta: 1 }] },
  { effects: [{ t: "draw", seat: "controller", count: 1 }] },
  { effects: [{ t: "adjust_life", seat: "target", delta: -3 }] }
] });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  let g = Core.init({ seats: 2, startingLife: 20 });
  return Core.reduce(g, { t: "__add", cards: [{ instanceId: "saga", name: "Three Lessons", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {} }] });
}

// 1) chapter I
(function () {
  let g = build();
  const r = S.advance(g, "saga", {});
  ok(r.chapter === 1 && J(r.effects) === J([{ t: "adjust_life", seat: 0, delta: 1 }]), "chapter I = gain 1 (controller bound)");
  ok(r.isFinal === false, "not the final chapter yet");
  g = apply(g, r.events);
  ok(S.lore(g, "saga") === 1, "one lore counter on the Saga");
})();

// 2) chapters II then III (III is final and targets)
(function () {
  let g = build();
  g = apply(g, S.advance(g, "saga", {}).events);   // -> lore 1
  let r = S.advance(g, "saga", {});                  // -> chapter II
  ok(r.chapter === 2 && r.effects[0].t === "draw", "chapter II = draw a card");
  g = apply(g, r.events);                            // -> lore 2
  r = S.advance(g, "saga", {}, { kind: "player", seat: 1 });   // -> chapter III, targeting seat 1
  ok(r.chapter === 3 && J(r.effects) === J([{ t: "adjust_life", seat: 1, delta: -3 }]), "chapter III = 3 damage to the target");
  ok(r.isFinal === true, "chapter III is the final chapter");
  g = apply(g, r.events);                            // -> lore 3
  ok(J(S.sacrificeIfDone(g, "saga", {})) === J([{ t: "card_move", instanceId: "saga", toZone: "graveyard" }]), "after the last chapter the Saga is sacrificed");
})();

// 3) before the final chapter it is NOT sacrificed
(function () {
  let g = build();
  g = apply(g, S.advance(g, "saga", {}).events);   // lore 1 of 3
  ok(S.sacrificeIfDone(g, "saga", {}).length === 0, "a Saga with chapters remaining is not sacrificed");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
