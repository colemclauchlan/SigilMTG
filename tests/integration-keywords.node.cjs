// Cross-module composition test — the PURE rules layer working TOGETHER on one board:
// attachments + anthem + granted keyword (rules-attach/static/keywords/layers) AND the targeting/
// evasion restrictions (hexproof, protection, menace) all on the same creatures. No engine-core needed.
// Run: node tests/integration-keywords.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-targeting.js", "MTGRulesTargeting");
const At = loadInto(G, "rules-attach.js", "MTGRulesAttach");
const M = loadInto(G, "rules-menace.js", "MTGRulesMenace");
const H = loadInto(G, "rules-hexproof.js", "MTGRulesHexproof");
const P = loadInto(G, "rules-protection.js", "MTGRulesProtection");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Champion", { types: ["creature"], colors: ["W"], power: 2, toughness: 2, abilities: ["hexproof"] });
Cards.define("Bonesplitter", { types: ["artifact", "equipment"], equips: { power: 2, toughness: 0 } });
Cards.define("Glorious Anthem", { types: ["enchantment"], colors: ["W"], static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });
Cards.define("Menace Lord", { types: ["creature"], colors: ["R"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["menace"] }] });
Cards.define("Saint", { types: ["creature"], colors: ["W"], power: 2, toughness: 3, abilities: ["protection from black"] });
Cards.define("Bear", { types: ["creature"], colors: ["G"], power: 2, toughness: 2 });

const bf = (id, name, seat, att) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {}, attachedTo: att || null });
// seat 0: a hexproof Champion, equipped, under an anthem, with a menace-granting lord, plus a pro-black Saint.
// seat 1: a green Bear (a would-be blocker / a non-black source).
const g = {
  seats: 2, players: [{ seat: 0 }, { seat: 1 }],
  cards: {
    champ: bf("champ", "Champion", 0), eq: bf("eq", "Bonesplitter", 0, "champ"),
    anthem: bf("anthem", "Glorious Anthem", 0), lord: bf("lord", "Menace Lord", 0),
    saint: bf("saint", "Saint", 0), bear: bf("bear", "Bear", 1)
  }
};

// 1) the Champion's effective P/T composes base + anthem + equipment through the layer system
(function () {
  const e = At.effectiveAttached(g, "champ", {});
  ok(e.power === 5 && e.toughness === 3, "Champion = 2/2 +anthem(1/1) +Bonesplitter(2/0) = 5/3 (got " + e.power + "/" + e.toughness + ")");
  ok(e.abilities.indexOf("hexproof") >= 0 && e.abilities.indexOf("menace") >= 0, "Champion has printed hexproof AND granted menace");
})();

// 2) hexproof: the opponent can't target the Champion, but its controller can
(function () {
  ok(H.isLegalTarget(g, "creature", { kind: "card", instanceId: "champ" }, { you: 1 }) === false, "opponent can't target the hexproof Champion");
  ok(H.isLegalTarget(g, "creature", { kind: "card", instanceId: "champ" }, { you: 0 }) === true, "the controller still can");
})();

// 3) menace (granted by the lord): a lone blocker can't block the Champion
(function () {
  const out = M.filterEvasion(g, [{ attacker: "champ", blockers: ["bear"] }], {});
  ok(J(out[0].blockers) === J([]), "granted menace: the single Bear can't block the Champion");
})();

// 4) protection from black: a black source can't target the Saint; a green one can
(function () {
  const saintEff = P.analyze(g, "saint", {});
  ok(P.canBeTargetedBy(saintEff, ["B"]) === false, "the pro-black Saint can't be targeted by a black source");
  ok(P.canBeTargetedBy(saintEff, ["G"]) === true, "...but a green source can target it");
})();

// 5) everything still holds for the opponent's vanilla Bear (no restrictions)
(function () {
  ok(H.isLegalTarget(g, "creature", { kind: "card", instanceId: "bear" }, { you: 0 }) === true, "the vanilla Bear is freely targetable");
  const out = M.filterEvasion(g, [{ attacker: "bear", blockers: ["champ"] }], {});
  ok(J(out[0].blockers) === J(["champ"]), "the vanilla Bear can be blocked by a single creature");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
