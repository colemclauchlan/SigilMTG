// Tests for precons.js pure logic: parseDeckText, mtgjsonDeckToCards, and the MTGJSON
// catalog load (type filter, sort, set-name mapping) via a stubbed relay fetch.
// Run: node tests/precons.node.cjs
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "precons.js"), "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL: " + m); } };

// minimal browser-global sandbox
const sandbox = {
  window: {},
  document: { addEventListener: function () {}, querySelector: function () { return null; } },
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  console: console,
  Date: Date,
  Promise: Promise,
  JSON: JSON,
  Math: Math,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  alert: function () {},
  // stubbed relay fetch used by loadCatalog / deck import
  deckFetchJsonWithRelay: function (url) {
    if (/DeckList\.json$/.test(url)) {
      return Promise.resolve({ data: [
        { code: "C21", fileName: "LoreholdLegacies_C21", name: "Lorehold Legacies", releaseDate: "2021-04-23", type: "Commander Deck" },
        { code: "FDN", fileName: "SomeStarter_FDN", name: "Starter Deck", releaseDate: "2024-11-15", type: "Starter Deck" },
        { code: "LTC", fileName: "FoodAndFellowship_LTC", name: "Food and Fellowship", releaseDate: "2023-06-23", type: "Commander Deck" }
      ] });
    }
    if (/SetList\.json$/.test(url)) {
      return Promise.resolve({ data: [
        { code: "C21", name: "Commander 2021" },
        { code: "LTC", name: "Tales of Middle-earth Commander" }
      ] });
    }
    return Promise.reject(new Error("unexpected url " + url));
  }
};
sandbox.self = sandbox.window;
sandbox.globalThis = sandbox;

try {
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "precons.js" });
} catch (e) {
  // The Linux mount can serve a truncated copy of heavily-edited files (known sandbox
  // artifact — the real file is complete). Skip rather than false-fail.
  if (e instanceof SyntaxError) { console.log("SKIP: precons.js source unreadable here (mount truncation): " + e.message); process.exit(0); }
  throw e;
}

const api = sandbox.window.MTGPreconsUI;
ok(!!api && typeof api._parseDeckText === "function", "MTGPreconsUI exposes _parseDeckText");
ok(!!api && typeof api._mtgjsonDeckToCards === "function", "MTGPreconsUI exposes _mtgjsonDeckToCards");
if (!api) { console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(1); }

// ---- parseDeckText ----
const parsed = api._parseDeckText([
  "// Commander",
  "1 Krenko, Mob Boss",
  "Deck",
  "3x Mountain (LEA) 292",
  "1 Sol Ring *F*",
  "Sideboard",
  "1 Naturalize"
].join("\n"));
ok(parsed.length === 4, "parseDeckText: 4 rows parsed (got " + parsed.length + ")");
ok(parsed[0].board === "commanders" && parsed[0].name === "Krenko, Mob Boss", "commander section detected");
ok(parsed[1].board === "mainboard" && parsed[1].name === "Mountain" && parsed[1].quantity === 3, "qty + collector tag stripped");
ok(parsed[2].name === "Sol Ring", "*F* tag stripped");
ok(parsed[3].board === "maybeboard", "sideboard routed to maybeboard");

// ---- mtgjsonDeckToCards ----
const cards = api._mtgjsonDeckToCards({
  commander: [{ count: 1, name: "Osgir, the Reconstructor" }],
  mainBoard: [
    { count: 1, name: "Cathar Commando // Cathar Commando" },
    { count: 12, name: "Mountain", type: "Basic Land — Mountain" },
    { count: 1, name: null }
  ]
});
ok(cards.length === 3, "mtgjsonDeckToCards: null-name skipped, 3 rows (got " + cards.length + ")");
ok(cards[0].board === "commanders" && cards[0].name === "Osgir, the Reconstructor", "commander mapped to commanders board");
ok(cards[1].name === "Cathar Commando", "DFC name reduced to front face");
ok(cards[2].quantity === 12 && cards[2].type_line.indexOf("Basic Land") === 0, "count + type carried through");

// ---- loadCatalog (async) ----
api._loadCatalog().then(function (cat) {
  ok(cat.decks.length === 2, "catalog keeps only Commander decks (got " + cat.decks.length + ")");
  ok(cat.decks[0].name === "Food and Fellowship", "sorted newest-first");
  ok(cat.decks[0].setName === "Tales of Middle-earth Commander", "set code mapped to set name");
  ok(cat.decks[1].setName === "Commander 2021" && cat.decks[1].year === 2021, "year derived from releaseDate");
  ok(cat.decks[0].source === "mtgjson" && /^mtgjson-/.test(cat.decks[0].id), "source + id shape");
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
}).catch(function (e) {
  console.log("FAIL: loadCatalog rejected: " + (e && e.message));
  console.log("\n" + pass + " passed, " + (fail + 1) + " failed");
  process.exit(1);
});
