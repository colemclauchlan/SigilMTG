// Test for rules-soulbond.js — pair two unpaired creatures; both gain a shared keyword while paired.
// No DOM, no network, no engine-core needed. Run: node tests/rules-soulbond.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const S = loadInto(G, "rules-soulbond.js", "MTGRulesSoulbond");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Bonder", { types: ["creature"], power: 2, toughness: 2, abilities: ["soulbond"] });
Cards.define("Pal", { types: ["creature"], power: 3, toughness: 3 });
Cards.define("Flyer", { types: ["creature"], power: 1, toughness: 1, abilities: ["flying"] });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) pair two unpaired creatures and grant "lifelink" -> both report paired
(function () {
  const g = game({ a: bf("a", "Bonder", 0), b: bf("b", "Pal", 0) });
  ok(S.pair(g, "a", "b", "lifelink") === true, "pairing two unpaired creatures succeeds");
  ok(S.isPaired(g, "a") && S.isPaired(g, "b"), "both members are paired");
  ok(S.partnerOf(g, "a") === "b" && S.partnerOf(g, "b") === "a", "partners point at each other");
})();

// 2) both members gain the shared keyword while paired
(function () {
  const g = game({ a: bf("a", "Bonder", 0), b: bf("b", "Pal", 0) });
  S.pair(g, "a", "b", "lifelink");
  ok(S.effectiveKeywords(g, "a", {}).indexOf("lifelink") >= 0, "source has the shared keyword");
  ok(S.effectiveKeywords(g, "b", {}).indexOf("lifelink") >= 0, "partner has the shared keyword");
})();

// 3) cannot pair if EITHER is already paired [EDGE]
(function () {
  const g = game({ a: bf("a", "Bonder", 0), b: bf("b", "Pal", 0), c: bf("c", "Pal", 0) });
  S.pair(g, "a", "b", "lifelink");
  ok(S.pair(g, "a", "c", "lifelink") === false, "already-paired creature can't re-pair");
  ok(S.partnerOf(g, "a") === "b", "original pairing is preserved");
})();

// 4) unpairOnLeave breaks the bond on BOTH sides
(function () {
  const g = game({ a: bf("a", "Bonder", 0), b: bf("b", "Pal", 0) });
  S.pair(g, "a", "b", "lifelink");
  ok(S.unpairOnLeave(g, "a") === true, "leaving creature unpairs");
  ok(!S.isPaired(g, "a") && !S.isPaired(g, "b"), "both sides cleared");
  ok(S.effectiveKeywords(g, "b", {}).indexOf("lifelink") < 0, "partner loses the shared keyword after break");
})();

// 5) shared keyword stacks on top of a creature's OWN printed abilities (no clobber)
(function () {
  const g = game({ a: bf("a", "Bonder", 0), f: bf("f", "Flyer", 0) });
  S.pair(g, "a", "f", "trample");
  const kw = S.effectiveKeywords(g, "f", {});
  ok(kw.indexOf("flying") >= 0 && kw.indexOf("trample") >= 0, "printed flying + shared trample both present");
})();

// 6) unpaired creature reports just its printed abilities; no shared keyword leaks [EDGE]
(function () {
  const g = game({ f: bf("f", "Flyer", 0) });
  ok(J(S.effectiveKeywords(g, "f", {})) === J(["flying"]), "unpaired -> only printed abilities");
  ok(S.isPaired(g, "f") === false && S.unpairOnLeave(g, "f") === false, "unpairing an unpaired creature is a no-op");
})();

// 7) self-pair and missing-card are rejected [EDGE]
(function () {
  const g = game({ a: bf("a", "Bonder", 0) });
  ok(S.pair(g, "a", "a", "lifelink") === false, "cannot pair a creature with itself");
  ok(S.pair(g, "a", "ghost", "lifelink") === false, "cannot pair with a missing card");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
