// Pure-module test for rules-evasion.js (flying/reach block legality).
// No DOM, no network. Run: node tests/rules-evasion.node.cjs

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
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const Ev = loadInto(G, "rules-evasion.js", "MTGRulesEvasion");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
Cards.define("Flyer", { types: ["creature"], power: 2, toughness: 2, abilities: ["flying"] });
Cards.define("Ground", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Reacher", { types: ["creature"], power: 1, toughness: 3, abilities: ["reach"] });

const A = (abil) => ({ id: "a", abilities: abil || [] });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards });
const bf = (id, name, seat) => ({ instanceId: id, name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {}, tapped: false });

// canBlock pairwise
ok(Ev.canBlock(A(["flying"]), A([])) === false, "a flyer can't be blocked by a ground creature");
ok(Ev.canBlock(A(["flying"]), A(["flying"])) === true, "a flyer can be blocked by a flyer");
ok(Ev.canBlock(A(["flying"]), A(["reach"])) === true, "a flyer can be blocked by reach");
ok(Ev.canBlock(A([]), A([])) === true, "a ground creature can be blocked by anything");

// legalBlockerIds against a flyer: only the reach/flying creatures
(function () {
  const g = game({ atk: bf("atk", "Flyer", 0), g1: bf("g1", "Ground", 1), r1: bf("r1", "Reacher", 1), f1: bf("f1", "Flyer", 1) });
  const legal = Ev.legalBlockerIds(g, "atk", 1, {}).sort();
  ok(legal.length === 2 && legal.indexOf("r1") >= 0 && legal.indexOf("f1") >= 0, "legal blockers for a flyer = reach + flyer (not ground)");
})();

// filterLegalBlocks strips an illegal ground block of a flyer
(function () {
  const g = game({ atk: bf("atk", "Flyer", 0), g1: bf("g1", "Ground", 1), r1: bf("r1", "Reacher", 1) });
  const filtered = Ev.filterLegalBlocks(g, [{ attacker: "atk", blockers: ["g1", "r1"] }], {});
  ok(filtered[0].blockers.length === 1 && filtered[0].blockers[0] === "r1", "filterLegalBlocks drops the ground blocker, keeps reach");
})();

// a ground attacker keeps all its blockers
(function () {
  const g = game({ atk: bf("atk", "Ground", 0), g1: bf("g1", "Ground", 1) });
  const filtered = Ev.filterLegalBlocks(g, [{ attacker: "atk", blockers: ["g1"] }], {});
  ok(filtered[0].blockers.length === 1, "ground attacker can be blocked by a ground creature");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
