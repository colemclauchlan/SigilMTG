// Test for rules-search.js — filter the library (tutors/ramp), move the pick, shuffle.
// Pure (no engine-core). Run: node tests/rules-search.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const S = loadInto(G, "rules-search.js", "MTGRulesSearch");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Wood", { types: ["land"], subtypes: ["forest"], produces: "G" });
Cards.define("Elf Mystic", { types: ["creature"], subtypes: ["elf"], power: 1, toughness: 1 });
Cards.define("Big Beast", { types: ["creature"], subtypes: ["beast"], power: 5, toughness: 5 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
// explicit deck so the library is EXACTLY these three (an empty deck makes init auto-seed a 99-card library)
function build() {
  return Core.init({ seats: 2, startingLife: 20, seed: "search", decks: [[
    { instanceId: "wood", name: "Wood", zone: "library" },
    { instanceId: "elf", name: "Elf Mystic", zone: "library" },
    { instanceId: "beast", name: "Big Beast", zone: "library" }
  ], []] });
}

// 1) filter by type
(function () {
  const g = build();
  ok(J(S.searchLibrary(g, 0, { type: "land" }, {})) === J(["wood"]), "search for a land finds Wood");
  ok(J(S.searchLibrary(g, 0, { type: "creature" }, {}).sort()) === J(["beast", "elf"]), "search for creatures finds both");
})();

// 2) filter by subtype and by name
(function () {
  const g = build();
  ok(J(S.searchLibrary(g, 0, { subtype: "elf" }, {})) === J(["elf"]), "search by subtype 'elf'");
  ok(J(S.searchLibrary(g, 0, { name: "Big Beast" }, {})) === J(["beast"]), "search by exact name");
  ok(S.searchLibrary(g, 0, { type: "artifact" }, {}).length === 0, "no artifacts in the library");
})();

// 3) tutor to hand then shuffle
(function () {
  let g = build();
  g = apply(g, S.tutorEvents(g, 0, "elf", "hand", {}));
  ok(g.cards["elf"].zone === "hand", "the tutored Elf is in hand");
  ok(Core.cardsOf(g, 0, "library").length === 2, "two cards remain in the library");
})();

// 4) ramp: fetch a land onto the battlefield, tapped
(function () {
  let g = build();
  g = apply(g, S.tutorEvents(g, 0, "wood", "battlefield", { tapped: true }));
  ok(g.cards["wood"].zone === "battlefield" && g.cards["wood"].tapped === true, "ramped a tapped land into play");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
