// Test for rules-hexproof.js — hexproof (opponents can't target) & shroud (nobody can), + granted, + filter.
// No DOM, no network, no engine-core needed. Run: node tests/rules-hexproof.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-targeting.js", "MTGRulesTargeting");
const H = loadInto(G, "rules-hexproof.js", "MTGRulesHexproof");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Invisible Stalker", { types: ["creature"], colors: ["U"], power: 1, toughness: 1, abilities: ["hexproof"] });
Cards.define("Shrouded Beast", { types: ["creature"], colors: ["G"], power: 3, toughness: 3, abilities: ["shroud"] });
Cards.define("Plain Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Cloak Captain", { types: ["creature"], colors: ["G"], power: 2, toughness: 2, static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["hexproof"] }] });

const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) shroud: nobody (not even the controller) can target it
(function () {
  const g = game({ sh: bf("sh", "Shrouded Beast", 0) });
  ok(H.canBeTargeted(g, "sh", 0, {}) === false, "shroud: controller can't target");
  ok(H.canBeTargeted(g, "sh", 1, {}) === false, "shroud: opponent can't target");
})();

// 2) hexproof: controller can target, opponent can't
(function () {
  const g = game({ hx: bf("hx", "Invisible Stalker", 0) });
  ok(H.canBeTargeted(g, "hx", 0, {}) === true, "hexproof: controller CAN target");
  ok(H.canBeTargeted(g, "hx", 1, {}) === false, "hexproof: opponent CANNOT target");
})();

// 3) vanilla creature: anyone can target
(function () {
  const g = game({ br: bf("br", "Plain Bear", 0) });
  ok(H.canBeTargeted(g, "br", 0, {}) === true && H.canBeTargeted(g, "br", 1, {}) === true, "vanilla: targetable by all");
})();

// 4) GRANTED hexproof (a lord grants it to teammates) counts
(function () {
  const g = game({ cap: bf("cap", "Cloak Captain", 0), mate: bf("mate", "Plain Bear", 0) });
  ok(H.canBeTargeted(g, "mate", 1, {}) === false, "granted hexproof: opponent can't target the teammate");
  ok(H.canBeTargeted(g, "mate", 0, {}) === true, "granted hexproof: controller still can");
})();

// 5) isLegalTarget composes rules-targeting + the restriction (players unaffected)
(function () {
  const g = game({ hx: bf("hx", "Invisible Stalker", 0), br: bf("br", "Plain Bear", 0) });
  ok(H.isLegalTarget(g, "creature", { kind: "card", instanceId: "hx" }, { you: 1 }) === false, "opponent can't legally target the hexproof creature");
  ok(H.isLegalTarget(g, "creature", { kind: "card", instanceId: "br" }, { you: 1 }) === true, "opponent can target the vanilla creature");
  ok(H.isLegalTarget(g, "any", { kind: "player", seat: 0 }, { you: 1 }) === true, "players aren't protected by hexproof here");
})();

// 6) filterTargets removes hexproof + shroud permanents for an opposing caster
(function () {
  const g = game({ hx: bf("hx", "Invisible Stalker", 0), sh: bf("sh", "Shrouded Beast", 0), br: bf("br", "Plain Bear", 0) });
  const ids = H.filterTargets(g, "creature", { you: 1 }).map(function (t) { return t.instanceId; }).sort();
  ok(J(ids) === J(["br"]), "opponent's legal creature targets = just the vanilla Bear (got " + J(ids) + ")");
  const own = H.filterTargets(g, "creature", { you: 0 }).map(function (t) { return t.instanceId; }).sort();
  ok(J(own) === J(["br", "hx"]), "the controller can target hexproof but not shroud (got " + J(own) + ")");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
