// Test for rules-bargain.js — optional additional cost: sacrifice an artifact/enchantment/token.
// Run: node tests/rules-bargain.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const B = loadInto(G, "rules-bargain.js", "MTGRulesBargain");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Mox Rock", { types: ["artifact"] });
Cards.define("Aura Web", { types: ["enchantment"] });
Cards.define("Grizzly", { types: ["creature"], power: 2, toughness: 2 });

const bf = (id, name, seat, extra) => Object.assign({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} }, extra || {});
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) isBargainable: artifact yes, enchantment yes, creature no, token yes
(function () {
  const g = game({ art: bf("art", "Mox Rock", 0), enc: bf("enc", "Aura Web", 0), cre: bf("cre", "Grizzly", 0), tok: bf("tok", "Grizzly", 0, { token: true }) });
  ok(B.isBargainable(g, "art", {}) === true, "artifact bargainable");
  ok(B.isBargainable(g, "enc", {}) === true, "enchantment bargainable");
  ok(B.isBargainable(g, "cre", {}) === false, "nontoken creature NOT bargainable");
  ok(B.isBargainable(g, "tok", {}) === true, "token bargainable regardless of type");
})();

// 2) canBargainSacrifice: your artifact ok; opponent's not
(function () {
  const g = game({ art: bf("art", "Mox Rock", 0), foe: bf("foe", "Mox Rock", 1) });
  ok(B.canBargainSacrifice(g, 0, "art", {}).ok === true, "own artifact ok");
  ok(B.canBargainSacrifice(g, 0, "foe", {}).ok === false, "opponent's artifact rejected");
})();

// 3) bargainTargets lists eligible controllers' permanents
(function () {
  const g = game({ art: bf("art", "Mox Rock", 0), cre: bf("cre", "Grizzly", 0), tok: bf("tok", "Grizzly", 0, { token: true }) });
  const t = B.bargainTargets(g, 0, {});
  ok(t.indexOf("art") >= 0 && t.indexOf("tok") >= 0 && t.indexOf("cre") < 0, "targets = artifact + token, not the vanilla creature");
})();

// 4) bargainEvents: sacrifice + mark the spell bargained
(function () {
  const g = game({ spell: bf("spell", "Grizzly", 0), art: bf("art", "Mox Rock", 0) });
  const ev = B.bargainEvents(g, "spell", 0, "art", {});
  ok(ev[0].t === "card_move" && ev[0].instanceId === "art" && ev[0].toZone === "graveyard", "sacrifices the chosen permanent");
  const mark = ev.find(e => e.t === "__set");
  ok(mark && mark.cards[0].id === "spell" && mark.cards[0].fields.bargained === true, "marks spell bargained");
})();

// 5) declining (sacId null) -> no events, no mark
ok(B.bargainEvents(game({ spell: bf("spell", "Grizzly", 0) }), "spell", 0, null, {}).length === 0, "declining bargain -> []");

// 6) invalid sacrifice -> no events
(function () {
  const g = game({ spell: bf("spell", "Grizzly", 0), cre: bf("cre", "Grizzly", 0) });
  ok(B.bargainEvents(g, "spell", 0, "cre", {}).length === 0, "non-bargainable sac -> []");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
