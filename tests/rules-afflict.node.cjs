// Test for rules-afflict.js — afflict N: becomes blocked -> defending player loses N life.
// No DOM, no network. Run: node tests/rules-afflict.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const F = loadInto(G, "rules-afflict.js", "MTGRulesAfflict");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Khenra Marauder", { types: ["creature"], power: 3, toughness: 2, afflict: 2 });
Cards.define("Meek Squire", { types: ["creature"], power: 1, toughness: 1 });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0, life: 40 }, { seat: 1, life: 40 }], cards: cards, log: [] });

// 1) afflict 2 blocked -> defender loses exactly 2 life (single event, right seat)
(function () {
  const g = game({ k: bf("k", "Khenra Marauder", 0) });
  const out = F.onBlocked(g, "k", 1, {});
  ok(out.length === 1 && out[0].t === "adjust_life" && out[0].seat === 1 && out[0].delta === -2, "afflict 2 -> defender loses 2");
})();

// 2) life LOSS applies through the reducer (not damage — no prevention hooks involved)
(function () {
  const Core = G.MTGCore;
  let s = Core.init({ seats: 2, decks: [null, null], startingLife: 40, deckSize: 0 });
  s = Core.reduce(s, { t: "token_create", instanceId: "k", name: "Khenra Marauder", ownerSeat: 0, zone: "battlefield" });
  const g = { seats: 2, players: s.players, cards: s.cards, log: [] };
  F.onBlocked(g, "k", 1, {}).forEach((e) => { s = Core.reduce(s, e); });
  ok(s.players[1].life === 38, "reducer replay: 40 -> 38");
})();

// 3) no afflict -> no events; off-battlefield attacker -> no events [EDGE]
(function () {
  const g = game({ m: bf("m", "Meek Squire", 0), h: Object.assign(bf("h", "Khenra Marauder", 0), { zone: "hand" }) });
  ok(F.onBlocked(g, "m", 1, {}).length === 0, "no afflict -> nothing");
  ok(F.onBlocked(g, "h", 1, {}).length === 0, "hand card -> nothing");
})();

// 4) bad seats / missing card safety [EDGE]
(function () {
  const g = game({ k: bf("k", "Khenra Marauder", 0) });
  ok(F.onBlocked(g, "ghost", 1, {}).length === 0, "missing card -> nothing");
  ok(F.onBlocked(g, "k", null, {}).length === 0, "null defender -> nothing");
  ok(F.onBlocked(g, "k", 9, {}).length === 0, "out-of-range defender -> nothing");
})();

// 5) afflictN parsing edges
(function () {
  ok(F.afflictN({ afflict: 3 }) === 3, "reads N");
  ok(F.afflictN({ afflict: 0 }) === 0 && F.afflictN({}) === 0 && F.afflictN(null) === 0, "0/absent/null -> 0");
  ok(F.afflictN({ afflict: 1.7 }) === 1, "fractional floors");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
