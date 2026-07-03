// Test for rules-modal.js — choose-one/two mode selection + effect assembly. Pure (no engine-core).
// Run: node tests/rules-modal.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const M = loadInto(G, "rules-modal.js", "MTGRulesModal");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

// a 3-mode charm (choose one)
Cards.define("Charm", { types: ["instant"], colors: ["W"], spell: { modal: true, chooseCount: 1, modes: [
  { label: "Gain 3 life", effects: [{ t: "adjust_life", seat: "controller", delta: 3 }] },
  { label: "Draw a card", effects: [{ t: "draw", seat: "controller", count: 1 }] },
  { label: "Deal 3 to target", effects: [{ t: "adjust_life", seat: "target", delta: -3 }] }
] } });
// a 2-mode command (choose two)
Cards.define("Command", { types: ["instant"], colors: ["B"], spell: { modal: true, chooseCount: 2, modes: [
  { effects: [{ t: "draw", seat: "controller", count: 2 }] },
  { effects: [{ t: "adjust_life", seat: "controller", delta: -2 }] },
  { effects: [{ t: "adjust_life", seat: "target", delta: -3 }] }
] } });

const card = { controllerSeat: 0, ownerSeat: 0 };

// 1) choosing one mode yields that mode's (bound) effects
(function () {
  const def = Cards.get("Charm");
  ok(J(M.chooseEffects(def, [0], card)) === J([{ t: "adjust_life", seat: 0, delta: 3 }]), "mode 0 = gain 3 life (controller bound)");
  ok(J(M.chooseEffects(def, [2], card, { kind: "player", seat: 1 })) === J([{ t: "adjust_life", seat: 1, delta: -3 }]), "mode 2 = 3 damage to the target player");
})();

// 2) choice validation (count + range + distinct)
(function () {
  const def = Cards.get("Charm");
  ok(M.validChoice(def, [1]) === true, "choose-one: one mode is valid");
  ok(M.validChoice(def, [0, 1]) === false, "choose-one: two modes is invalid");
  ok(M.validChoice(def, [5]) === false, "out-of-range mode is invalid");
  ok(M.validChoice(def, []) === false, "choosing nothing is invalid");
})();

// 3) choose-two assembles BOTH modes' effects
(function () {
  const def = Cards.get("Command");
  ok(M.validChoice(def, [0, 2]) === true, "choose-two: two distinct modes valid");
  ok(M.validChoice(def, [0, 0]) === false, "choose-two: the same mode twice is invalid");
  const eff = M.chooseEffects(def, [0, 1], card);
  ok(J(eff) === J([{ t: "draw", seat: 0, count: 2 }, { t: "adjust_life", seat: 0, delta: -2 }]), "both chosen modes' effects are combined");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
