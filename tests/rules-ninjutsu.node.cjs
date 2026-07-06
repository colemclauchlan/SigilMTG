// Test for rules-ninjutsu.js — ninjutsu (CR 702.49): return an unblocked attacker to hand, put the ninja
// in tapped + attacking. Pure.
// Run: node tests/rules-ninjutsu.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const NJ = loadInto(G, "rules-ninjutsu.js", "MTGRulesNinjutsu");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Ninja", { types: ["creature"], subtypes: ["ninja"], colors: ["U"], mana: { generic: 2, U: 1 }, ninjutsu: { generic: 1, U: 1 }, power: 2, toughness: 2 });
Cards.define("Sneak", { types: ["creature"], mana: { generic: 1 }, power: 1, toughness: 1 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
// Ninja in hand; Sneak on the battlefield, attacking + unblocked.
function build(manaC, manaU) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "nj", name: "Ninja", zone: "hand" },
    { instanceId: "sn", name: "Sneak", zone: "battlefield" }
  ], []] });
  g = Core.reduce(g, { t: "card_combat", instanceId: "sn", attacking: true });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaU) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_U", delta: manaU });
  return g;
}

// 1) ninjutsu cost detection
ok(NJ.ninjutsuCost(Cards.get("Ninja")).U === 1, "ninjutsuCost returns the cost");
ok(NJ.ninjutsuCost(Cards.get("Sneak")) === null, "no ninjutsu -> null");

// 2) canNinjutsu: ninja in hand, an unblocked attacker you control, payable ({1}{U})
ok(NJ.canNinjutsu(build(1, 1), "nj", "sn", 0, {}).ok === true, "can ninjutsu with an unblocked attacker + {1}{U}");
(function () {
  let g = build(1, 1); g = Core.reduce(g, { t: "__set", cards: [{ id: "sn", fields: { blocked: true } }] });
  ok(/blocked/.test(NJ.canNinjutsu(g, "nj", "sn", 0, {}).reason), "a blocked attacker can't be returned");
})();
(function () {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "nj", name: "Ninja", zone: "hand" }, { instanceId: "sn", name: "Sneak", zone: "battlefield" }], []] });
  g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_U", delta: 1 }); g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: 1 });
  ok(/isn't attacking/.test(NJ.canNinjutsu(g, "nj", "sn", 0, {}).reason), "a non-attacking creature can't be returned");
})();
ok(/cannot pay/.test(NJ.canNinjutsu(build(0, 0), "nj", "sn", 0, {}).reason), "no mana -> can't pay ninjutsu");

// 3) ninjutsuEvents: pay {1}{U}, bounce the attacker, ninja enters tapped + attacking
(function () {
  let g = build(1, 1);
  g = apply(g, NJ.ninjutsuEvents(g, "nj", "sn", {}));
  ok(g.cards["sn"].zone === "hand", "the unblocked attacker returned to hand");
  ok(g.cards["nj"].zone === "battlefield", "the ninja is on the battlefield");
  ok(g.cards["nj"].tapped === true && g.cards["nj"].attacking === true, "ninja entered tapped + attacking");
  ok((g.players[0].counters.mana_C || 0) === 0 && (g.players[0].counters.mana_U || 0) === 0, "ninjutsu cost {1}{U} paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
