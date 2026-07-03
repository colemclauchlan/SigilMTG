// Test for rules-backup.js — backup N: N +1/+1 counters on a target creature + grant abilities if it's another.
// Run: node tests/rules-backup.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const BK = loadInto(G, "rules-backup.js", "MTGRulesBackup");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Cabaretti Ascendant", { types: ["creature"], power: 1, toughness: 1, abilities: ["backup"], backup: 1, backupGrants: ["haste"] });
Cards.define("Trelasarra", { types: ["creature"], power: 2, toughness: 2, abilities: ["backup"], backup: 2, backupGrants: ["lifelink", "vigilance"] });
Cards.define("Ally", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Wall", { types: ["artifact"] });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) backupN
ok(BK.backupN(game({ a: bf("a", "Trelasarra", 0) }), "a", {}) === 2, "backupN = 2");
ok(BK.backupN(game({ b: bf("b", "Ally", 0) }), "b", {}) === 0, "no backup = 0");

// 2) grantsOf
ok(J(BK.grantsOf(game({ a: bf("a", "Trelasarra", 0) }), "a", {})) === J(["lifelink", "vigilance"]), "grantsOf lists abilities");

// 3) backup onto ANOTHER creature: N counters + granted abilities marker
(function () {
  const g = game({ src: bf("src", "Trelasarra", 0), tgt: bf("tgt", "Ally", 0) });
  const ev = BK.backupEvents(g, "src", "tgt", {});
  const counter = ev.find(e => e.t === "card_counter");
  ok(counter && counter.instanceId === "tgt" && counter.delta === 2, "target gets +2 +1/+1");
  const grant = ev.find(e => e.t === "__set");
  ok(grant && J(grant.cards[0].fields.grantedUntilEOT) === J(["lifelink", "vigilance"]), "target granted abilities until EOT");
})();

// 4) backup onto ITSELF: counters only, no grant marker
(function () {
  const g = game({ src: bf("src", "Trelasarra", 0) });
  const ev = BK.backupEvents(g, "src", "src", {});
  ok(ev.length === 1 && ev[0].t === "card_counter" && ev[0].delta === 2, "self-backup -> counters only");
  ok(!ev.some(e => e.t === "__set"), "no grant when backing up itself");
})();

// 5) target must be a creature
(function () {
  const g = game({ src: bf("src", "Cabaretti Ascendant", 0), wall: bf("wall", "Wall", 0) });
  ok(BK.backupEvents(g, "src", "wall", {}).length === 0, "non-creature target -> no events");
})();

// 6) a source without backupGrants still gives counters, no grant marker
(function () {
  Cards.define("Bare Backup", { types: ["creature"], power: 1, toughness: 1, abilities: ["backup"], backup: 1 });
  const g = game({ src: bf("src", "Bare Backup", 0), tgt: bf("tgt", "Ally", 0) });
  const ev = BK.backupEvents(g, "src", "tgt", {});
  ok(ev.length === 1 && ev[0].t === "card_counter", "no grants -> counters only");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
