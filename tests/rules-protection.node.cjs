// Test for rules-protection.js — protection from [color]: block/target/damage checks + granted protection.
// No DOM, no network. Run: node tests/rules-protection.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const P = loadInto(G, "rules-protection.js", "MTGRulesProtection");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("White Knight", { types: ["creature"], colors: ["W"], power: 2, toughness: 2, abilities: ["first strike", "protection from black"] });
Cards.define("Black Bear", { types: ["creature"], colors: ["B"], power: 2, toughness: 2 });
Cards.define("White Bear", { types: ["creature"], colors: ["W"], power: 2, toughness: 2 });
Cards.define("Red Goblin", { types: ["creature"], colors: ["R"], power: 2, toughness: 2 });
// a lord that grants protection from red to your other creatures (granted-keyword path)
Cards.define("Ward Captain", { types: ["creature"], colors: ["W"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["protection from red"] }] });

// 1) parse protection colors from ability strings
(function () {
  ok(J(P.protectionColors({ abilities: ["protection from black"] })) === J(["B"]), "protectionColors parses 'protection from black' -> B");
  ok(P.protectionColors({ abilities: ["flying"] }).length === 0, "no protection -> empty");
  ok(J(P.protectionColors({ protections: ["R"] })) === J(["R"]), "explicit protections[] honored");
})();

// 2) can't be blocked by the protected-from color
(function () {
  const wk = { colors: ["W"], abilities: ["protection from black"] };
  ok(P.canBeBlockedBy(wk, { colors: ["B"] }) === false, "white knight can't be blocked by a black creature");
  ok(P.canBeBlockedBy(wk, { colors: ["W"] }) === true, "white knight CAN be blocked by a white creature");
})();

// 3) can't be targeted by a source of that color; damage from it is prevented
(function () {
  const wk = { abilities: ["protection from black"] };
  ok(P.canBeTargetedBy(wk, ["B"]) === false, "can't be targeted by a black source");
  ok(P.canBeTargetedBy(wk, ["R"]) === true, "can be targeted by a red source");
  ok(P.preventsDamageFrom(wk, ["B", "R"]) === true, "prevents damage from a black source");
  ok(P.preventsDamageFrom(wk, ["R"]) === false, "doesn't prevent red damage");
})();

// 4) analyze() reads color + abilities off the board
(function () {
  const game = { seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: { k: { instanceId: "k", name: "White Knight", zone: "battlefield", ownerSeat: 0, controllerSeat: 0, counters: {} } } };
  const a = P.analyze(game, "k", {});
  ok(J(a.colors) === J(["W"]) && a.abilities.indexOf("protection from black") >= 0, "analyze: White Knight is white with protection from black");
})();

// 5) GRANTED protection counts (lord grants protection from red to a teammate)
(function () {
  const game = { seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: {
    cap: { instanceId: "cap", name: "Ward Captain", zone: "battlefield", ownerSeat: 0, controllerSeat: 0, counters: {} },
    mate: { instanceId: "mate", name: "White Bear", zone: "battlefield", ownerSeat: 0, controllerSeat: 0, counters: {} }
  } };
  const eff = P.analyze(game, "mate", {});
  ok(P.protectionColors(eff).indexOf("R") >= 0, "teammate has GRANTED protection from red");
  ok(P.canBeBlockedBy(eff, { colors: ["R"] }) === false, "so a red creature can't block it");
})();

// 6) filterProtectedBlocks strips the illegal (black) blocker from a white-knight attack
(function () {
  const game = { seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: {
    k: { instanceId: "k", name: "White Knight", zone: "battlefield", ownerSeat: 0, controllerSeat: 0, counters: {} },
    bb: { instanceId: "bb", name: "Black Bear", zone: "battlefield", ownerSeat: 1, controllerSeat: 1, counters: {} },
    wb: { instanceId: "wb", name: "White Bear", zone: "battlefield", ownerSeat: 1, controllerSeat: 1, counters: {} }
  } };
  const filtered = P.filterProtectedBlocks(game, [{ attacker: "k", blockers: ["bb", "wb"] }], {});
  ok(J(filtered[0].blockers) === J(["wb"]), "black blocker stripped, white blocker kept");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
