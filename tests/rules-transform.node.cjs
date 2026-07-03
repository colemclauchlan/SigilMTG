// Test for rules-transform.js — double-faced cards: select the active face + transform. Pure.
// Run: node tests/rules-transform.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const T = loadInto(G, "rules-transform.js", "MTGRulesTransform");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

// a werewolf: 2/2 front, 4/4 trample back
Cards.define("Village Wolf", { types: ["creature"], subtypes: ["human", "werewolf"], colors: ["G"], power: 2, toughness: 2,
  back: { name: "Howling Wolf", types: ["creature"], subtypes: ["werewolf"], colors: ["G"], power: 4, toughness: 4, abilities: ["trample"] } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  let g = Core.init({ seats: 2, startingLife: 20 });
  return Core.reduce(g, { t: "__add", cards: [{ instanceId: "w", name: "Village Wolf", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, flipped: false }] });
}

// 1) front face by default
(function () {
  const g = build();
  ok(T.isTransformed(g, "w") === false, "starts on the front face");
  const f = T.effectiveFace(g, "w", {});
  ok(f.power === 2 && f.toughness === 2 && f.abilities.indexOf("trample") < 0, "front face is a 2/2 with no trample");
})();

// 2) transform to the back face
(function () {
  let g = build();
  g = apply(g, T.transformEvents("w"));
  ok(T.isTransformed(g, "w") === true, "now transformed");
  const b = T.effectiveFace(g, "w", {});
  ok(b.name === "Howling Wolf" && b.power === 4 && b.toughness === 4 && b.abilities.indexOf("trample") >= 0, "back face is a 4/4 with trample");
})();

// 3) transform back to the front
(function () {
  let g = build();
  g = apply(g, T.transformEvents("w"));
  g = apply(g, T.transformEvents("w"));
  ok(T.isTransformed(g, "w") === false && T.effectiveFace(g, "w", {}).power === 2, "transformed back to the 2/2 front");
})();

// 4) currentFace returns the right def object
(function () {
  let g = build();
  ok(T.currentFace(g, "w", {}).power === 2, "currentFace: front");
  g = apply(g, T.transformEvents("w"));
  ok(T.currentFace(g, "w", {}).power === 4, "currentFace: back");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
