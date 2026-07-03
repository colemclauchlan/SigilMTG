// Test for rules-storm.js — copy a storm spell once per OTHER spell cast before it this turn.
// No DOM, no network. Run: node tests/rules-storm.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const S = loadInto(G, "rules-storm.js", "MTGRulesStorm");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

// 1) storm count from a number
(function () {
  ok(S.stormCount(3) === 3, "stormCount(3) === 3");
})();

// 2) storm count from an array of prior spells
(function () {
  ok(S.stormCount(["s1", "s2"]) === 2, "stormCount of 2-element array === 2");
})();

// 3) EDGE: first spell of the turn -> 0 copies
(function () {
  ok(S.stormCount(0) === 0 && S.stormCount([]) === 0, "no prior spells -> 0");
  const copies = S.makeCopies({ id: "grapeshot" }, 0);
  ok(copies.length === 0, "makeCopies(_, 0) -> empty array");
})();

// 4) makeCopies produces n objects with distinct ids
(function () {
  const copies = S.makeCopies({ id: "grapeshot", dmg: 1 }, 3);
  ok(copies.length === 3, "3 copies made");
  const ids = copies.map((c) => c.id);
  ok(new Set(ids).size === 3, "all copy ids are distinct");
})();

// 5) copies carry isCopy + copyOf and preserve original data
(function () {
  const copies = S.makeCopies({ id: "bolt", dmg: 3 }, 2);
  ok(copies[0].isCopy === true && copies[0].copyOf === "bolt", "copy flags set");
  ok(copies[1].dmg === 3, "copy preserves original fields");
})();

// 6) original object is not mutated by makeCopies
(function () {
  const orig = { id: "tendrils", dmg: 2 };
  const copies = S.makeCopies(orig, 1);
  ok(orig.isCopy === undefined && copies[0].id !== orig.id, "original untouched, copy has new id");
})();

// 7) negative / garbage count is treated as 0
(function () {
  ok(S.stormCount(-5) === 0, "negative count clamps to 0");
  ok(J(S.makeCopies({ id: "x" }, -2)) === J([]), "negative copies -> empty");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
