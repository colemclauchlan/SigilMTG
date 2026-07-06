// Test for rules-miracle.js — miracle (CR 702.94): cast for the miracle cost when it's the first card you
// draw this turn. Pure.
// Run: node tests/rules-miracle.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const MI = loadInto(G, "rules-miracle.js", "MTGRulesMiracle");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Wrath1", { types: ["sorcery"], colors: ["W"], mana: { generic: 5, W: 1 }, miracle: { W: 1 }, spell: { wrath: true } });
Cards.define("Plain", { types: ["sorcery"], mana: { generic: 1 } }); // no miracle

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaW) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "wr", name: "Wrath1", zone: "hand" }], []] });
  if (manaW) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_W", delta: manaW });
  return g;
}

// 1) miracle cost detection
ok(MI.miracleCost(Cards.get("Wrath1")).W === 1, "miracleCost returns the cost");
ok(MI.miracleCost(Cards.get("Plain")) === null, "no miracle -> null");

// 2) canMiracle: first draw this turn + payable ({W})
ok(MI.canMiracle(build(1), "wr", 0, true, {}).ok === true, "first draw + {W} -> can miracle");
ok(/not the first card/.test(MI.canMiracle(build(1), "wr", 0, false, {}).reason), "not the first draw -> ineligible");
ok(/cannot pay/.test(MI.canMiracle(build(0), "wr", 0, true, {}).reason), "first draw but no mana -> can't pay");
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "pl", name: "Plain", zone: "hand" }], []] });
  ok(/no miracle/.test(MI.canMiracle(g, "pl", 0, true, {}).reason), "card without miracle -> rejected");
})();

// 3) castMiracleEvents: pays {W}, hand -> stack, flags castViaMiracle
(function () {
  let g = build(1);
  g = apply(g, MI.castMiracleEvents(g, "wr", {}));
  ok(g.cards["wr"].zone === "stack", "miracle spell on the stack");
  ok(g.cards["wr"].castViaMiracle === true, "flagged castViaMiracle");
  ok((g.players[0].counters.mana_W || 0) === 0, "miracle cost {W} paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
