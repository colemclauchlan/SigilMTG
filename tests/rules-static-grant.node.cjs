// Test for rules-static grantedKeywords — static "grant" abilities (e.g. Goblin King gives other
// Goblins you control mountainwalk). Pure.
// Run: node tests/rules-static-grant.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const St = loadInto(G, "rules-static.js", "MTGRulesStatic");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("GoblinKing", { types: ["creature"], subtypes: ["goblin"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", subtype: "goblin", keywords: ["mountainwalk"] }] });
Cards.define("GoblinPeon", { types: ["creature"], subtypes: ["goblin"], power: 1, toughness: 1 });
Cards.define("ElfPeon", { types: ["creature"], subtypes: ["elf"], power: 1, toughness: 1 });

const g = Core.init({ seats: 2, decks: [[
  { instanceId: "king", name: "GoblinKing", zone: "battlefield" },
  { instanceId: "gob", name: "GoblinPeon", zone: "battlefield" },
  { instanceId: "elf", name: "ElfPeon", zone: "battlefield" }
], [
  { instanceId: "ogob", name: "GoblinPeon", zone: "battlefield" }
]] });

// 1) your other Goblin gets mountainwalk
ok(J(St.grantedKeywords(g, "gob", {})) === J(["mountainwalk"]), "your other Goblin is granted mountainwalk (got " + J(St.grantedKeywords(g, "gob", {})) + ")");
// 2) a non-Goblin you control gets nothing
ok(J(St.grantedKeywords(g, "elf", {})) === J([]), "your Elf gets nothing");
// 3) the King does NOT grant to itself (other-creatures)
ok(J(St.grantedKeywords(g, "king", {})) === J([]), "Goblin King does not grant itself mountainwalk");
// 4) the opponent's Goblin is not affected by your King
ok(J(St.grantedKeywords(g, "ogob", {})) === J([]), "opponent's Goblin gets nothing from your King");
// 5) collectGrants sees exactly one grant source on the board
ok(St.collectGrants(g, Cards).length === 1, "one grant source collected");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
