// Pure-module tests for rules-layers.js (Phase R2 continuous-effects layer system, CR 613).
// No DOM, no network. Run: node tests/rules-layers.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const L = loadInto({}, "rules-layers.js", "MTGRulesLayers");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function base(over) { return Object.assign({ name: "X", controller: 0, types: ["creature"], subtypes: [], colors: [], abilities: [], power: 2, toughness: 2, counters: {} }, over); }
function pt(c) { return c.power + "/" + c.toughness; }
const CE = L.computeEffectiveState;

// identity
ok(pt(CE(base(), [])) === "2/2", "no effects -> printed P/T unchanged");

// layer 7d modification
ok(pt(CE(base(), [{ id: "a", layer: 7, sublayer: "d", timestamp: 1, op: "pt_mod", power: 1, toughness: 1 }])) === "3/3", "7d +1/+1 -> 3/3");

// layer 7c counters
ok(pt(CE(base({ counters: { "+1/+1": 2 } }), [])) === "4/4", "two +1/+1 counters -> 4/4");
ok(pt(CE(base({ power: 3, toughness: 3, counters: { "-1/-1": 2 } }), [])) === "1/1", "two -1/-1 counters -> 1/1");

// set (7b) then modify (7d)
ok(pt(CE(base(), [
  { id: "s", layer: 7, sublayer: "b", timestamp: 1, op: "pt_set", power: 0, toughness: 1 },
  { id: "m", layer: 7, sublayer: "d", timestamp: 2, op: "pt_mod", power: 2, toughness: 2 }
])) === "2/3", "set 0/1 then +2/+2 -> 2/3");

// LAYER beats TIMESTAMP: a later-timestamp set still applies before an earlier-timestamp +N/+N
ok(pt(CE(base(), [
  { id: "m", layer: 7, sublayer: "d", timestamp: 1, op: "pt_mod", power: 2, toughness: 2 },
  { id: "s", layer: 7, sublayer: "b", timestamp: 100, op: "pt_set", power: 0, toughness: 0 }
])) === "2/2", "layer beats timestamp: set (7b, ts100) before mod (7d, ts1) -> 2/2");

// within a layer, later timestamp wins for a set
ok(pt(CE(base(), [
  { id: "s1", layer: 7, sublayer: "b", timestamp: 1, op: "pt_set", power: 1, toughness: 1 },
  { id: "s2", layer: 7, sublayer: "b", timestamp: 2, op: "pt_set", power: 4, toughness: 4 }
])) === "4/4", "two 7b sets -> later timestamp wins (4/4)");

// counters (7c) apply AFTER a set (7b)
ok(pt(CE(base({ counters: { "+1/+1": 2 } }), [
  { id: "s", layer: 7, sublayer: "b", timestamp: 1, op: "pt_set", power: 0, toughness: 1 }
])) === "2/3", "set 0/1 then +2 from counters (7c after 7b) -> 2/3");

// Humility-style: remove all abilities (L6) and set to 1/1 (7b)
(function () {
  const r = CE(base({ abilities: ["flying", "vigilance"] }), [
    { id: "h6", layer: 6, timestamp: 1, op: "ability_remove_all" },
    { id: "h7", layer: 7, sublayer: "b", timestamp: 1, op: "pt_set", power: 1, toughness: 1 }
  ]);
  ok(pt(r) === "1/1" && r.abilities.length === 0, "Humility-style: 1/1 with no abilities");
})();

// colors
ok(J(CE(base({ colors: ["R"] }), [{ id: "c", layer: 5, timestamp: 1, op: "color_add", colors: ["U"] }]).colors) === J(["R", "U"]), "color_add -> [R,U]");
ok(J(CE(base({ colors: ["R"] }), [{ id: "c", layer: 5, timestamp: 1, op: "color_set", colors: ["W"] }]).colors) === J(["W"]), "color_set -> [W]");
ok(CE(base({ colors: ["R", "G"] }), [{ id: "c", layer: 5, timestamp: 1, op: "colorless" }]).colors.length === 0, "colorless -> []");

// abilities
ok(CE(base(), [
  { id: "a1", layer: 6, timestamp: 1, op: "ability_add", abilities: ["flying"] },
  { id: "a2", layer: 6, timestamp: 2, op: "ability_remove", abilities: ["flying"] }
]).abilities.length === 0, "add then remove flying -> none");
ok(J(CE(base(), [
  { id: "a1", layer: 6, timestamp: 1, op: "ability_add", abilities: ["flying", "trample"] },
  { id: "a2", layer: 6, timestamp: 2, op: "ability_remove", abilities: ["flying"] }
]).abilities) === J(["trample"]), "remove one keeps the other");

// types
ok(J(CE(base(), [{ id: "t", layer: 4, timestamp: 1, op: "type_add", subtypes: ["goblin"] }]).subtypes) === J(["goblin"]), "type_add subtype");
ok(J(CE(base(), [{ id: "t", layer: 4, timestamp: 1, op: "type_set", types: ["artifact"] }]).types) === J(["artifact"]), "type_set types");

// control
ok(CE(base(), [{ id: "ct", layer: 2, timestamp: 1, op: "control_set", controller: 1 }]).controller === 1, "control_set -> seat 1");

// copy (L1): copies printed characteristics, keeps this card's counters + controller
(function () {
  const r = CE(base({ counters: { "+1/+1": 1 } }), [
    { id: "cp", layer: 1, timestamp: 1, op: "copy", base: { name: "Bear", controller: 9, types: ["creature"], subtypes: ["bear"], colors: ["G"], abilities: [], power: 3, toughness: 3 } }
  ]);
  ok(r.name === "Bear" && pt(r) === "4/4" && r.controller === 0, "copy -> Bear base 3/3 +1 counter = 4/4, controller kept");
})();

// purity
(function () {
  const b = base();
  CE(b, [{ id: "m", layer: 7, sublayer: "d", timestamp: 1, op: "pt_mod", power: 5, toughness: 5 }]);
  ok(b.power === 2 && b.toughness === 2, "purity: base object not mutated");
})();

function J(x) { return JSON.stringify(x); }

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
