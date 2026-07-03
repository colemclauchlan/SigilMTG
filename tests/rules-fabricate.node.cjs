// Test for rules-fabricate.js — fabricate N: N +1/+1 counters OR N 1/1 Servo tokens on ETB.
// Run: node tests/rules-fabricate.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const F = loadInto(G, "rules-fabricate.js", "MTGRulesFabricate");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Toolcraft Exemplar", { types: ["artifact", "creature"], power: 3, toughness: 1, abilities: ["fabricate"], fabricate: 1 });
Cards.define("Marionette Master", { types: ["artifact", "creature"], power: 0, toughness: 4, abilities: ["fabricate"], fabricate: 3 });
Cards.define("Plain Bear", { types: ["creature"], power: 2, toughness: 2 });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) fabricateN reads the number
ok(F.fabricateN(game({ a: bf("a", "Marionette Master", 0) }), "a", {}) === 3, "fabricateN = 3");
ok(F.fabricateN(game({ b: bf("b", "Plain Bear", 0) }), "b", {}) === 0, "no fabricate -> 0");

// 2) hasFabricate
ok(F.hasFabricate(game({ a: bf("a", "Toolcraft Exemplar", 0) }), "a", {}) === true, "hasFabricate true");
ok(F.hasFabricate(game({ b: bf("b", "Plain Bear", 0) }), "b", {}) === false, "hasFabricate false");

// 3) counters mode -> a single +1/+1 counter event with delta N
(function () {
  const g = game({ a: bf("a", "Marionette Master", 0) });
  const ev = F.enterEvents(g, "a", "counters", {});
  ok(ev.length === 1 && ev[0].t === "card_counter" && ev[0].kind === "+1/+1" && ev[0].delta === 3, "counters mode -> +3 +1/+1");
})();

// 4) servos mode -> N token_create events, 1/1 Servo artifact creatures
(function () {
  const g = game({ a: bf("a", "Marionette Master", 0) });
  const ev = F.enterEvents(g, "a", "servos", {});
  ok(ev.length === 3 && ev.every(e => e.t === "token_create"), "servos mode -> 3 tokens");
  ok(ev[0].token.power === 1 && ev[0].token.toughness === 1 && ev[0].token.types.indexOf("artifact") >= 0, "servo is a 1/1 artifact creature");
  ok(ev[0].controllerSeat === 0, "servos under the fabricator's controller");
})();

// 5) no fabricate -> no events
ok(J(F.enterEvents(game({ b: bf("b", "Plain Bear", 0) }), "b", "counters", {})) === J([]), "no fabricate -> []");

// 6) autoChoice: a bodied creature banks counters; a 0-power shell goes wide
ok(F.autoChoice(game({ a: bf("a", "Toolcraft Exemplar", 0) }), "a", {}) === "counters", "power>=1 -> counters");
ok(F.autoChoice(game({ a: bf("a", "Marionette Master", 0) }), "a", {}) === "servos", "power 0 -> servos");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
