// Test for rules-bestow.js — bestow (CR 702.103): cast as an Aura (bestow cost) or as a creature. Pure.
// Run: node tests/rules-bestow.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const BS = loadInto(G, "rules-bestow.js", "MTGRulesBestow");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Nimbus", { types: ["enchantment", "creature"], colors: ["W"], mana: { generic: 2, W: 1 }, bestow: { generic: 4, W: 1 }, power: 2, toughness: 2 });
Cards.define("Bear", { types: ["creature"], mana: { generic: 1 }, power: 2, toughness: 2 });
Cards.define("Rock", { types: ["artifact"], mana: { generic: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(manaC, manaW) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "nb", name: "Nimbus", zone: "hand" },
    { instanceId: "be", name: "Bear", zone: "battlefield" },
    { instanceId: "ro", name: "Rock", zone: "battlefield" }
  ], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaW) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_W", delta: manaW });
  return g;
}

// 1) bestow cost detection
ok(BS.bestowCost(Cards.get("Nimbus")).generic === 4, "bestowCost returns the bestow cost");
ok(BS.bestowCost(Cards.get("Bear")) === null, "no bestow -> null");

// 2) can cast as a normal creature for {2}{W}
ok(BS.canCastAsCreature(build(2, 1), "nb", 0, {}).ok === true, "can cast Nimbus as a creature ({2}{W})");

// 3) canBestow onto a creature for {4}{W}; not onto a non-creature; not without mana
ok(BS.canBestow(build(4, 1), "nb", 0, "be", {}).ok === true, "can bestow onto the Bear ({4}{W})");
ok(/target must be a creature/.test(BS.canBestow(build(4, 1), "nb", 0, "ro", {}).reason), "can't bestow onto the artifact");
ok(/cannot pay the bestow/.test(BS.canBestow(build(2, 1), "nb", 0, "be", {}).reason), "only {2}{W} -> can't pay bestow");

// 4) castBestowEvents: pays {4}{W}, hand -> stack, flags bestowed + target
(function () {
  let g = build(4, 1);
  g = apply(g, BS.castBestowEvents(g, "nb", "be", {}));
  ok(g.cards["nb"].zone === "stack", "bestow spell on the stack");
  ok(g.cards["nb"].bestowed === true && g.cards["nb"].bestowTarget === "be", "flagged bestowed onto the Bear");
  ok((g.players[0].counters.mana_C || 0) === 0 && (g.players[0].counters.mana_W || 0) === 0, "bestow cost {4}{W} paid");
})();

// 5) fallOffEvents: when the enchanted creature leaves, the Aura becomes a creature
(function () {
  let g = build(4, 1);
  g = apply(g, BS.castBestowEvents(g, "nb", "be", {}));
  g = apply(g, [{ t: "__set", cards: [{ id: "nb", fields: { attachedTo: "be" } }] }]);
  g = apply(g, BS.fallOffEvents(g, "nb"));
  ok(g.cards["nb"].bestowed === false && g.cards["nb"].attachedTo === null, "bestowed Aura becomes a creature when it falls off");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
