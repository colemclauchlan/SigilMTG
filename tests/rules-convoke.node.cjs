// Test for rules-convoke.js — tapping creatures to help pay (colored pip first, then {1}).
// Pure (no engine-core). Run: node tests/rules-convoke.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const Cv = loadInto(G, "rules-convoke.js", "MTGRulesConvoke");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Green Bear", { types: ["creature"], colors: ["G"], power: 2, toughness: 2 });
Cards.define("White Knight", { types: ["creature"], colors: ["W"], power: 2, toughness: 2 });
Cards.define("Eldrazi", { types: ["creature"], colors: [], power: 3, toughness: 3 });

// 1) colored creatures pay their pip first; others pay {1}
(function () {
  // cost {2}{G}{G}, convoke 2 green + 1 white -> greens pay GG, white pays one {1} -> {1} left
  const reduced = Cv.convokeReduce({ generic: 2, G: 2 }, [["G"], ["G"], ["W"]]);
  ok(J(reduced) === J({ generic: 1, G: 0 }), "2 green + 1 white vs {2}{G}{G} -> {1} (got " + J(reduced) + ")");
})();

// 2) a colorless creature can only pay {1}
(function () {
  const reduced = Cv.convokeReduce({ generic: 1, G: 1 }, [[]]);
  ok(J(reduced) === J({ generic: 0, G: 1 }), "a colorless creature pays {1}, leaving the {G}");
})();

// 3) a creature whose color isn't owed falls back to paying {1}
(function () {
  const reduced = Cv.convokeReduce({ generic: 2, G: 1 }, [["W"]]);
  ok(J(reduced) === J({ generic: 1, G: 1 }), "white creature can't pay {G}, pays {1} instead");
})();

// 4) excess convoke is simply wasted (cost can't go negative)
(function () {
  const reduced = Cv.convokeReduce({ G: 1 }, [["G"], ["G"], ["G"]]);
  ok((reduced.G || 0) === 0 && (reduced.generic || 0) === 0, "extra convokers are wasted, not negative");
})();

// 5) end-to-end on a board: tap untapped creatures, check the leftover is pool-payable
(function () {
  let g = Core.init({ seats: 2, startingLife: 20 });
  g = Core.reduce(g, { t: "__add", cards: [
    { instanceId: "g1", name: "Green Bear", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, tapped: false },
    { instanceId: "g2", name: "Green Bear", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, tapped: false },
    { instanceId: "w1", name: "White Knight", ownerSeat: 0, controllerSeat: 0, zone: "battlefield", counters: {}, tapped: true } // tapped: not available
  ] });
  ok(Cv.convokeCreatures(g, 0, {}).length === 2, "only the two untapped creatures can convoke");
  const r = Cv.castWithConvoke({ generic: 2, G: 2 }, g, 0, ["g1", "g2"], {});
  ok(J(r.remaining) === J({ generic: 2, G: 0 }), "two green convokers pay the {G}{G}, leaving {2}");
  ok(r.tapEvents.length === 2, "two tap events produced");
  ok(r.payableFromPool === false, "with no mana in the pool the {2} can't yet be paid");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
