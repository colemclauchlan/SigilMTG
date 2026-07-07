// Test for rules-afterlife.js — afterlife N: dies -> N 1/1 WB flying Spirit tokens for the owner.
// No DOM, no network. Run: node tests/rules-afterlife.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const A = loadInto(G, "rules-afterlife.js", "MTGRulesAfterlife");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const ev = (out, t) => (out || []).filter((e) => e.t === t);

Cards.define("Obligator", { types: ["creature"], power: 2, toughness: 1, afterlife: 2 });
Cards.define("Plain Bear", { types: ["creature"], power: 2, toughness: 2 });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards, log: [] });

// 1) afterlife 2 -> exactly two Spirit token_create events on the battlefield, owned by the owner
(function () {
  const g = game({ o: bf("o", "Obligator", 0) });
  const out = A.onDeath(g, "o", {});
  const toks = ev(out, "token_create");
  ok(toks.length === 2, "afterlife 2 creates two tokens");
  ok(toks.every((t) => t.name === A.TOKEN_NAME && t.zone === "battlefield" && t.ownerSeat === 0), "tokens are afterlife Spirits under the owner");
  ok(new Set(toks.map((t) => t.instanceId)).size === 2, "token ids are unique");
})();

// 2) the Spirit card-def is registered: 1/1 W/B flyer marked as a token
(function () {
  const def = Cards.get(A.TOKEN_NAME);
  ok(!!def, "Spirit def registered");
  ok(def.power === 1 && def.toughness === 1 && def.isToken === true, "Spirit is a 1/1 token");
  ok((def.abilities || []).indexOf("flying") >= 0, "Spirit flies");
  ok((def.colors || []).join("") === "WB", "Spirit is white and black");
})();

// 3) no afterlife on the def -> no events [EDGE]
(function () {
  const g = game({ b: bf("b", "Plain Bear", 1) });
  ok(A.onDeath(g, "b", {}).length === 0, "no afterlife -> no tokens");
})();

// 4) missing card / bad N safety [EDGE]
(function () {
  const g = game({});
  ok(A.onDeath(g, "ghost", {}).length === 0, "missing card -> no events");
  ok(A.afterlifeN({ afterlife: 0 }) === 0 && A.afterlifeN({ afterlife: -3 }) === 0, "zero/negative N -> 0");
  ok(A.afterlifeN({ afterlife: 2.9 }) === 2, "fractional N floors");
  ok(A.afterlifeN(null) === 0, "null def -> 0");
})();

// 5) stolen creature still makes the tokens for its OWNER (stable seat on the dies-trigger)
(function () {
  const g = game({ o: { instanceId: "o", name: "Obligator", zone: "battlefield", ownerSeat: 0, controllerSeat: 1, counters: {} } });
  const toks = ev(A.onDeath(g, "o", {}), "token_create");
  ok(toks.length === 2 && toks.every((t) => t.ownerSeat === 0), "tokens go to the owner seat");
})();

// 6) events replay through the reducer: tokens actually land on the battlefield
(function () {
  const Core = G.MTGCore;
  let s = Core.init({ seats: 2, decks: [null, null], startingLife: 40, deckSize: 0 });
  s = Core.reduce(s, { t: "token_create", instanceId: "seed", name: "Obligator", ownerSeat: 0, zone: "battlefield" });
  const g2 = { seats: 2, players: s.players, cards: s.cards, log: [] };
  A.onDeath(g2, "seed", {}).forEach((e) => { s = Core.reduce(s, e); });
  const spirits = Object.values(s.cards).filter((c) => c.name === A.TOKEN_NAME && c.zone === "battlefield");
  ok(spirits.length === 2, "reducer replay lands two Spirits on the battlefield");
  ok(spirits.every((c) => c.isToken), "replayed Spirits are tokens");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
