// Test for rules-myriad.js — myriad: attack -> tapped attacking token copies for each OTHER opponent,
// exiled at end of combat. No DOM, no network. Run: node tests/rules-myriad.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const M = loadInto(G, "rules-myriad.js", "MTGRulesMyriad");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const ev = (out, t) => (out || []).filter((e) => e.t === t);

Cards.define("Herald of the Host", { types: ["creature"], subtypes: ["Angel"], colors: ["W"], abilities: ["flying", "vigilance"], power: 4, toughness: 4, myriad: true });
Cards.define("Lone Wolf", { types: ["creature"], power: 2, toughness: 2 });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game4 = (cards) => ({ seats: 4, players: [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }], cards: cards, log: [] });
const game2 = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards, log: [] });

// 1) 4-player game, seat 0 attacks seat 1 -> copies attack seats 2 and 3 (tapped + attacking)
(function () {
  const g = game4({ h: bf("h", "Herald of the Host", 0) });
  const r = M.onAttack(g, "h", 1, {});
  const toks = ev(r.events, "token_create");
  ok(toks.length === 2, "two copies for the two other opponents");
  ok(toks.map((t) => t.myriadDefends).sort().join(",") === "2,3", "copies attack seats 2 and 3");
  ok(ev(r.events, "card_tap").every((e) => e.tapped === true) && ev(r.events, "card_tap").length === 2, "copies enter tapped");
  ok(ev(r.events, "card_combat").every((e) => e.attacking === true) && ev(r.events, "card_combat").length === 2, "copies enter attacking");
  ok(r.tokenIds.length === 2 && new Set(r.tokenIds).size === 2, "unique token ids returned for cleanup");
})();

// 2) the copy def preserves name+stats+abilities and is a token
(function () {
  const def = Cards.get("Herald of the Host (Myriad)");
  ok(!!def, "copy def registered");
  ok(def.power === 4 && def.toughness === 4 && def.isToken === true, "copy is a 4/4 token");
  ok((def.abilities || []).indexOf("flying") >= 0, "copy keeps its abilities");
})();

// 3) heads-up (2 players): no OTHER opponents -> no events [EDGE]
(function () {
  const g = game2({ h: bf("h", "Herald of the Host", 0) });
  const r = M.onAttack(g, "h", 1, {});
  ok(r.events.length === 0 && r.tokenIds.length === 0, "no copies in a duel");
})();

// 4) non-myriad creature / missing card / off-battlefield -> nothing [EDGE]
(function () {
  const g = game4({ w: bf("w", "Lone Wolf", 0), h: Object.assign(bf("h", "Herald of the Host", 0), { zone: "hand" }) });
  ok(M.onAttack(g, "w", 1, {}).events.length === 0, "no myriad -> no copies");
  ok(M.onAttack(g, "ghost", 1, {}).events.length === 0, "missing card -> no copies");
  ok(M.onAttack(g, "h", 1, {}).events.length === 0, "not on the battlefield -> no copies");
})();

// 5) endOfCombat exiles every copy
(function () {
  const out = M.endOfCombat(["t1", "t2"]);
  ok(out.length === 2 && out.every((e) => e.t === "card_move" && e.toZone === "exile"), "copies are exiled at end of combat");
  ok(M.endOfCombat(null).length === 0, "null ids -> no events");
})();

// 6) full reducer replay: create -> tapped+attacking on battlefield -> end of combat exiles
(function () {
  const Core = G.MTGCore;
  let s = Core.init({ seats: 4, decks: [null, null, null, null], startingLife: 40, deckSize: 0 });
  s = Core.reduce(s, { t: "token_create", instanceId: "h", name: "Herald of the Host", ownerSeat: 0, zone: "battlefield" });
  const g = { seats: 4, players: s.players, cards: s.cards, log: [] };
  const r = M.onAttack(g, "h", 1, {});
  r.events.forEach((e) => { s = Core.reduce(s, e); });
  const copies = r.tokenIds.map((id) => s.cards[id]);
  ok(copies.every((c) => c && c.zone === "battlefield" && c.tapped && c.attacking), "replayed copies are tapped attackers");
  M.endOfCombat(r.tokenIds).forEach((e) => { s = Core.reduce(s, e); });
  ok(r.tokenIds.every((id) => s.cards[id].zone === "exile"), "replayed cleanup exiles the copies");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
