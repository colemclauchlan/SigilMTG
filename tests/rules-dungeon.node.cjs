// Test for rules-dungeon.js — venture into a room-graph, advance, complete. Pure.
// Run: node tests/rules-dungeon.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const D = loadInto(G, "rules-dungeon.js", "MTGRulesDungeon");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

// a mini dungeon: A -> {B,C}; B -> {D}; C -> {D}; D terminal
D.defineDungeon("Mini", { start: "A", rooms: {
  A: { effects: [{ t: "draw", seat: "controller", count: 1 }], next: ["B", "C"] },
  B: { effects: [{ t: "adjust_life", seat: "controller", delta: 2 }], next: ["D"] },
  C: { effects: [], next: ["D"] },
  D: { effects: [{ t: "adjust_life", seat: "controller", delta: 5 }], next: [] }
} });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() { return Core.init({ seats: 2, startingLife: 20 }); }

// 1) venturing the first time enters the start room
(function () {
  let g = build();
  const r = D.venture(g, 0, "Mini", null, {});
  ok(r.room === "A" && J(r.effects) === J([{ t: "draw", seat: "controller", count: 1 }]), "first venture enters room A with its effect");
  g = apply(g, r.events);
  ok(J(D.position(g, 0)) === J({ name: "Mini", room: "A" }), "position is Mini/A");
  ok(D.completed(g, 0) === false, "A is not the final room");
})();

// 2) advance to a connected room
(function () {
  let g = build();
  g = apply(g, D.venture(g, 0, "Mini", null, {}).events);        // at A
  const r = D.venture(g, 0, "Mini", "B", {});                     // A -> B
  ok(r.room === "B" && J(r.effects) === J([{ t: "adjust_life", seat: "controller", delta: 2 }]), "advanced to B with its effect");
  g = apply(g, r.events);
  ok(J(D.position(g, 0)) === J({ name: "Mini", room: "B" }), "now at Mini/B");
})();

// 3) reaching D completes the dungeon
(function () {
  let g = build();
  g = apply(g, D.venture(g, 0, "Mini", null, {}).events);        // A
  g = apply(g, D.venture(g, 0, "Mini", "B", {}).events);         // B
  const r = D.venture(g, 0, "Mini", "D", {});                     // B -> D
  g = apply(g, r.events);
  ok(D.position(g, 0).room === "D" && r.completed === true, "reached D and completed the dungeon");
})();

// 4) can't jump to a non-connected room
(function () {
  let g = build();
  g = apply(g, D.venture(g, 0, "Mini", null, {}).events);        // at A
  const r = D.venture(g, 0, "Mini", "D", {});                     // A is not connected to D
  ok(/not a connected room/.test(r.reason) && r.room === "A", "can't skip straight to D from A");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
