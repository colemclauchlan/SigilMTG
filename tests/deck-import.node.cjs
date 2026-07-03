// Pure-module test for deck-import.js (decklist parsing + Scryfall mapping).
// No DOM, no network. Run: node tests/deck-import.node.cjs

const fs = require("fs");
const path = require("path");
function loadInto(self, file, globalName) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  new Function("self", "module", code)(self, { exports: null });
  return self[globalName];
}
const D = loadInto({}, "deck-import.js", "MTGDeckImport");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

// parseDecklist — mixed Moxfield / Arena / plain
const text = [
  "Deck",
  "1 Sol Ring",
  "4x Forest",
  "2 Llanowar Elves (M19) 314",
  "// a comment",
  "",
  "Sideboard",
  "1 Shock",
  "Lightning Bolt"
].join("\n");
const list = D.parseDecklist(text);
ok(list.length === 5, "parsed 5 entries (skipped Deck/Sideboard headers + comment + blank), got " + list.length);
ok(list[1].count === 4 && list[1].name === "Forest", "'4x Forest' -> count 4");
ok(list[2].name === "Llanowar Elves", "stripped '(M19) 314' set/collector info");
ok(list[4].count === 1 && list[4].name === "Lightning Bolt", "bare card name -> count 1");

// parseManaCost
ok(D.parseManaCost("{1}{G}{G}").generic === 1 && D.parseManaCost("{1}{G}{G}").G === 2, "{1}{G}{G} -> 1 generic + 2 G");
ok(D.parseManaCost("{2}{W}{U}").generic === 2 && D.parseManaCost("{2}{W}{U}").W === 1, "{2}{W}{U} -> 2 generic + W + U");
ok(J(D.parseManaCost("")) === "{}", "empty mana cost -> {}");

// parseTypeLine
const t = D.parseTypeLine("Legendary Creature — God");
ok(t.supertypes.indexOf("legendary") >= 0 && t.types.indexOf("creature") >= 0 && t.subtypes.indexOf("god") >= 0, "type line: supertype/type/subtype split");

// cardDefFromScryfall — a creature
const bears = D.cardDefFromScryfall({ name: "Grizzly Bears", type_line: "Creature — Bear", mana_cost: "{1}{G}", colors: ["G"], power: "2", toughness: "2" });
ok(bears.power === 2 && bears.toughness === 2 && bears.mana.G === 1 && bears.mana.generic === 1 && bears.types[0] === "creature" && bears.subtypes[0] === "bear", "Scryfall creature -> engine def");

// cardDefFromScryfall — a basic land
const forest = D.cardDefFromScryfall({ name: "Forest", type_line: "Basic Land — Forest" });
ok(forest.types.indexOf("land") >= 0 && forest.produces === "G" && forest.supertypes.indexOf("basic") >= 0, "Scryfall basic land -> land producing G");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
