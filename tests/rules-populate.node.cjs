// Test for rules-populate.js — populate (CR 701.29): copy a creature token you control. Pure.
// Run: node tests/rules-populate.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const PO = loadInto(G, "rules-populate.js", "MTGRulesPopulate");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Beast", { types: ["creature"], power: 3, toughness: 3 });    // token characteristics
Cards.define("Clue", { types: ["artifact"] });                            // noncreature token
Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2, mana: { generic: 2 } }); // real (non-token) creature

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "be", name: "Bear", zone: "battlefield" }], []] });
  g = Core.reduce(g, { t: "token_create", instanceId: "tok", name: "Beast", ownerSeat: 0 });
  g = Core.reduce(g, { t: "token_create", instanceId: "clue", name: "Clue", ownerSeat: 0 });
  return g;
}

// 1) creatureTokens lists only the creature token
ok(JSON.stringify(PO.creatureTokens(build(), 0, {})) === JSON.stringify(["tok"]), "creatureTokens -> [Beast token]");

// 2) canPopulate: a creature token you control is legal; the Clue token + the real Bear are not
ok(PO.canPopulate(build(), "tok", 0, {}).ok === true, "can populate the Beast token");
ok(/must be a creature/.test(PO.canPopulate(build(), "clue", 0, {}).reason), "can't populate a noncreature token");
ok(/token on the battlefield/.test(PO.canPopulate(build(), "be", 0, {}).reason), "can't populate a real (non-token) creature");

// 3) populateEvents: creates a copy token with the same characteristics
(function () {
  let g = build();
  g = apply(g, PO.populateEvents(g, "tok", "tok2", {}));
  ok(g.cards["tok2"] && g.cards["tok2"].isToken === true, "a new token was created");
  ok(g.cards["tok2"].name === "Beast" && g.cards["tok2"].zone === "battlefield", "the copy is a Beast on the battlefield");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
