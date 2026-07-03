// Test for rules-scry.js — look-at-top, bottom-to-library, and the autoScry policy. Through the engine.
// No DOM, no network. Run: node tests/rules-scry.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const E = loadInto(G, "engine-core.js", "MTGEngine");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const Scry = loadInto(G, "rules-scry.js", "MTGRulesScry");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);
E.resetRules();
Cards.define("Useless Aura", { types: ["enchantment"] });

// explicit deck => create uses it verbatim (no 99-card auto-seed). top->bottom is c0..c4; c1 is a blank.
const LIB = [
  { instanceId: "c0", name: "Forest", zone: "library" },
  { instanceId: "c1", name: "Useless Aura", zone: "library" },
  { instanceId: "c2", name: "Forest", zone: "library" },
  { instanceId: "c3", name: "Forest", zone: "library" },
  { instanceId: "c4", name: "Forest", zone: "library" }
];
const OPTS = { seats: 2, startingLife: 20, seed: "scry", decks: [LIB, []] };
function addBf(s, id, name, seat) { return E.dispatch(s, { t: "__add", cards: [{ instanceId: id, cardId: id, name: name, ownerSeat: seat, controllerSeat: seat, zone: "battlefield", x: 10, y: 10, counters: {} }] }); }

let s = E.create(OPTS);

// 1) topCards returns the first N in library order
(function () {
  const top = Scry.topCards(s.game, 0, 3, { Core: Core }).map(function (c) { return c.instanceId; });
  ok(J(top) === J(["c0", "c1", "c2"]), "topCards(3) = c0,c1,c2 (got " + J(top) + ")");
})();

// 2) scry bottoming c1 sends it to the very bottom, keeps the rest on top in order
(function () {
  const r = Scry.scry(E, s, 0, ["c1"], { Core: Core });
  const order = Core.cardsOf(r.game, 0, "library").map(function (c) { return c.instanceId; });
  ok(order[order.length - 1] === "c1", "scry: c1 is now at the bottom (got " + J(order) + ")");
  ok(J(order.slice(0, 4)) === J(["c0", "c2", "c3", "c4"]), "scry: kept cards keep their order on top");
})();

// 3) scry with nothing bottomed is an order-preserving no-op
(function () {
  const r = Scry.scry(E, s, 0, [], { Core: Core });
  const order = Core.cardsOf(r.game, 0, "library").map(function (c) { return c.instanceId; });
  ok(J(order) === J(["c0", "c1", "c2", "c3", "c4"]), "scry []: order unchanged");
})();

// 4) autoScry bottoms an excess land when flooded (4+ lands in play)
(function () {
  let f = s;
  ["p1", "p2", "p3", "p4"].forEach(function (id) { f = addBf(f, id, "Forest", 0); }); // 4 lands in play => flooded
  const ids = Scry.autoScry(f, 0, 1, { Core: Core, Cards: Cards }); // top card c0 is a Forest
  ok(J(ids) === J(["c0"]), "autoScry (flooded): bottoms the top land c0 (got " + J(ids) + ")");
})();

// 5) autoScry bottoms a do-nothing card when we need action (not flooded)
(function () {
  const ids = Scry.autoScry(s, 0, 5, { Core: Core, Cards: Cards }); // top c1 = Useless Aura, no lands in play
  ok(ids.indexOf("c1") >= 0, "autoScry (need action): bottoms the do-nothing Useless Aura");
  ok(ids.indexOf("c0") < 0, "autoScry (need action): keeps the land");
})();

// 6) a scry replays deterministically
(function () {
  const r = Scry.scry(E, s, 0, ["c2", "c4"], { Core: Core });
  ok(J(E.replay(r.log, OPTS).game) === J(r.game), "scry replays deterministically");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
