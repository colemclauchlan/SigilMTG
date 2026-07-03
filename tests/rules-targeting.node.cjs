// Pure-module test for rules-targeting.js (target legality).
// No DOM, no network. Run: node tests/rules-targeting.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
loadInto(G, "table-core.js", "MTGCore");
loadInto(G, "card-defs.js", "MTGCards");
const T = loadInto(G, "rules-targeting.js", "MTGRulesTargeting");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

const game = {
  seats: 2,
  players: [{ seat: 0 }, { seat: 1 }],
  cards: {
    bear: { instanceId: "bear", name: "Grizzly Bears", zone: "battlefield", controllerSeat: 0 },
    elf: { instanceId: "elf", name: "Llanowar Elves", zone: "battlefield", controllerSeat: 1 },
    mtn: { instanceId: "mtn", name: "Mountain", zone: "battlefield", controllerSeat: 0 },
    handcard: { instanceId: "h", name: "Grizzly Bears", zone: "hand", controllerSeat: 0 }
  }
};

ok(T.legalTargets(game, "player").length === 2, "player -> 2 players");
ok(T.legalTargets(game, "creature").length === 2, "creature -> 2 (bear + elf; not the land or the hand card)");
ok(T.legalTargets(game, "permanent").length === 3, "permanent -> bear + elf + mountain");
ok(T.legalTargets(game, "any").length === 4, "any -> 2 creatures + 2 players");

ok(T.isLegalTarget(game, "creature", { kind: "card", instanceId: "bear" }) === true, "bear is a legal creature target");
ok(T.isLegalTarget(game, "creature", { kind: "card", instanceId: "mtn" }) === false, "a land is not a legal creature target");
ok(T.isLegalTarget(game, "creature", { kind: "player", seat: 0 }) === false, "a player is not a legal creature target");
ok(T.isLegalTarget(game, "any", { kind: "player", seat: 1 }) === true, "a player is a legal 'any' target");

// controller restrictions (caster = seat 0)
ok(T.legalTargets(game, { type: "creature", controller: "you" }, { you: 0 }).length === 1, "your creatures -> 1 (bear)");
ok(T.legalTargets(game, { type: "creature", controller: "opponent" }, { you: 0 }).length === 1, "opponent creatures -> 1 (elf)");
ok(T.legalTargets(game, { type: "player", controller: "opponent" }, { you: 0 })[0].seat === 1, "opponent player -> seat 1");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
