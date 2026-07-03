// Pure-module tests for rules-sba.js (Phase R1 state-based-action detectors).
// No DOM, no network. Run: node tests/rules-sba.node.cjs
// Proves each detector reads the table-core state correctly and is purely advisory (read-only).

const fs = require("fs");
const path = require("path");
// Browser-global script loaded via the eval shim (repo is type:module; see engine-core test note).
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const SBA = loadInto({}, "rules-sba.js", "MTGRulesSBA");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function P(over) { return Object.assign({ seat: 0, life: 40, counters: {}, cmdDamage: {} }, over); }
function C(over) { return Object.assign({ instanceId: "x", name: "", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", isToken: false, attachedTo: null, counters: {} }, over); }
function game(players, cards) { return { players: players || [P({ seat: 0 }), P({ seat: 1 })], cards: cards || {} }; }

// clean state
ok(SBA.detectAll(game()).length === 0, "clean state: no findings");

// 704.5a life loss
ok(SBA.detectors.lifeLoss(game([P({ seat: 0, life: 0 }), P({ seat: 1, life: 40 })])).length === 1, "life 0 -> loss finding");
ok(SBA.detectors.lifeLoss(game([P({ seat: 0, life: 1 })])).length === 0, "life 1 -> none");
ok(SBA.detectors.lifeLoss(game([P({ seat: 0, life: -3 })]))[0].kind === "player_loss", "negative life -> player_loss");

// 704.5c poison
ok(SBA.detectors.poison(game([P({ seat: 0, counters: { poison: 10 } })])).length === 1, "poison 10 -> loss");
ok(SBA.detectors.poison(game([P({ seat: 0, counters: { poison: 9 } })])).length === 0, "poison 9 -> none");

// 903.10a commander damage
ok(SBA.detectors.commanderDamage(game([P({ seat: 0, cmdDamage: { "1:primary": 21 } })])).length === 1, "commander damage 21 -> loss");
ok(SBA.detectors.commanderDamage(game([P({ seat: 0, cmdDamage: { "1:primary": 20 } })])).length === 0, "commander damage 20 -> none");

// 704.5f stray token
ok(SBA.detectors.strayToken(game(null, { t1: C({ instanceId: "t1", isToken: true, zone: "graveyard", name: "Soldier" }) })).length === 1, "token off battlefield -> cease to exist");
ok(SBA.detectors.strayToken(game(null, { t1: C({ instanceId: "t1", isToken: true, zone: "battlefield" }) })).length === 0, "token on battlefield -> none");

// 704.5 orphaned attachment
ok(SBA.detectors.orphanAttachment(game(null, { a1: C({ instanceId: "a1", name: "Aura", attachedTo: "gone", zone: "battlefield" }) })).length === 1, "attached to missing host -> orphan");
ok(SBA.detectors.orphanAttachment(game(null, { a1: C({ instanceId: "a1", attachedTo: "h1", zone: "battlefield" }), h1: C({ instanceId: "h1", zone: "battlefield" }) })).length === 0, "attached to valid host -> none");
ok(SBA.detectors.orphanAttachment(game(null, { a1: C({ instanceId: "a1", attachedTo: "h1", zone: "hand" }), h1: C({ instanceId: "h1", zone: "battlefield" }) })).length === 0, "attachment not on battlefield -> ignored");

// 704.5j legend-rule candidate (advisory)
const legend = SBA.detectors.legendRuleCandidate(game(null, {
  c1: C({ instanceId: "c1", name: "Krenko", controllerSeat: 0, zone: "battlefield" }),
  c2: C({ instanceId: "c2", name: "Krenko", controllerSeat: 0, zone: "battlefield" })
}));
ok(legend.length === 1 && legend[0].instanceIds.length === 2, "two same-name nontoken under one controller -> legend candidate");
ok(SBA.detectors.legendRuleCandidate(game(null, {
  c1: C({ instanceId: "c1", name: "Krenko", controllerSeat: 0, zone: "battlefield" }),
  c2: C({ instanceId: "c2", name: "Krenko", controllerSeat: 1, zone: "battlefield" })
})).length === 0, "same name, different controllers -> none");
ok(SBA.detectors.legendRuleCandidate(game(null, {
  c1: C({ instanceId: "c1", name: "Goblin", isToken: true, controllerSeat: 0, zone: "battlefield" }),
  c2: C({ instanceId: "c2", name: "Goblin", isToken: true, controllerSeat: 0, zone: "battlefield" })
})).length === 0, "token duplicates -> not legend candidates");

// detectAll aggregates across detectors
const multi = SBA.detectAll(game([P({ seat: 0, life: 0 }), P({ seat: 1, counters: { poison: 12 } })], {
  t1: C({ instanceId: "t1", isToken: true, zone: "exile", name: "Treasure" })
}));
ok(multi.length === 3, "detectAll aggregates (life loss + poison + stray token)");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
