// Test for rules-exalted.js — +1/+1 per exalted instance when attacking ALONE, incl. granted exalted.
// Run: node tests/rules-exalted.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const X = loadInto(G, "rules-exalted.js", "MTGRulesExalted");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Exalter", { types: ["creature"], power: 1, toughness: 1, abilities: ["exalted"] });
Cards.define("Knight", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Exalt Banner", { types: ["enchantment"], static: [{ kind: "grant", affects: "creatures-you-control", keywords: ["exalted"] }] });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

const g2 = game({ e1: bf("e1", "Exalter", 0), e2: bf("e2", "Exalter", 0), k: bf("k", "Knight", 0) });
ok(X.exaltedCount(g2, 0, {}) === 2, "two exalted instances -> count 2");
ok(J(X.exaltedBonus(g2, 0, ["k"], {})) === J({ power: 2, toughness: 2 }), "lone attacker -> +2/+2");
ok(J(X.exaltedBonus(g2, 0, ["e1", "k"], {})) === J({ power: 0, toughness: 0 }), "two attackers -> no bonus");
ok(J(X.exaltedBonus(g2, 0, [], {})) === J({ power: 0, toughness: 0 }), "zero attackers -> no bonus");

const gOpp = game({ mine: bf("mine", "Exalter", 0), theirs: bf("theirs", "Exalter", 1), k: bf("k", "Knight", 0) });
ok(X.exaltedCount(gOpp, 0, {}) === 1, "opponent exalted not counted");
ok(J(X.exaltedBonus(gOpp, 0, ["k"], {})) === J({ power: 1, toughness: 1 }), "lone attacker -> +1/+1");

// granted exalted edge case: banner grants exalted to the vanilla Knight (unioned -> 1 each, total 2)
const gGrant = game({ e: bf("e", "Exalter", 0), k: bf("k", "Knight", 0), ban: bf("ban", "Exalt Banner", 0) });
ok(X.abilitiesOf(gGrant, "k", {}).indexOf("exalted") >= 0, "granted exalted present on Knight");
ok(X.exaltedCount(gGrant, 0, {}) === 2, "granted exalted -> count 2");
ok(J(X.exaltedBonus(gGrant, 0, ["k"], {})) === J({ power: 2, toughness: 2 }), "lone attacker -> +2/+2 incl granted");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
