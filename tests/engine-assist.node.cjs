// Pure-module test for engine-assist.js (read-only advisory bridge).
// No DOM, no network. Run: node tests/engine-assist.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-sba.js", "MTGRulesSBA");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
const A = loadInto(G, "engine-assist.js", "MTGEngineAssist");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

ok(A.ready() === true, "ready(): SBA + layers + cards present");

const game = {
  seats: 2,
  players: [{ seat: 0, life: 0, counters: {}, cmdDamage: {} }, { seat: 1, life: 40, counters: {}, cmdDamage: {} }],
  cards: {
    bears: { instanceId: "bears", name: "Grizzly Bears", zone: "battlefield", ownerSeat: 0, controllerSeat: 0, counters: { "+1/+1": 2 } },
    mtn: { instanceId: "mtn", name: "Mountain", zone: "battlefield", ownerSeat: 0, controllerSeat: 0, counters: {} },
    handcard: { instanceId: "h", name: "Grizzly Bears", zone: "hand", ownerSeat: 0, controllerSeat: 0, counters: {} }
  }
};

const a = A.analyze(game);
ok(a.sba.some(function (f) { return f.kind === "player_loss" && f.seat === 0; }), "analyze: SBA flags seat 0 at 0 life");
ok(a.effective.bears && a.effective.bears.power === 4 && a.effective.bears.toughness === 4, "analyze: effective P/T of Bears + two +1/+1 = 4/4");
ok(!a.effective.mtn, "analyze: lands (no P/T) are excluded from the effective map");
ok(!a.effective.h, "analyze: only battlefield creatures are analyzed (hand card excluded)");

// graceful with an empty/partial state
ok(A.analyze(null).sba.length === 0, "analyze(null) is safe");
ok(Object.keys(A.analyze({ cards: {} }).effective).length === 0, "analyze(empty board) yields no effective entries");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
