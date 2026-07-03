// Test for rules-attach.js — Equipment & Aura buffs fold into the layer system (P/T + keywords), stack
// with anthems. No DOM, no network, no engine-core needed. Run: node tests/rules-attach.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
const At = loadInto(G, "rules-attach.js", "MTGRulesAttach");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Bear", { types: ["creature"], power: 2, toughness: 2 });
Cards.define("Bonesplitter", { types: ["artifact", "equipment"], equips: { power: 2, toughness: 0 } });
Cards.define("Lifeblade", { types: ["artifact", "equipment"], equips: { power: 1, toughness: 1, keywords: ["lifelink"] } });
Cards.define("Rancor", { types: ["enchantment", "aura"], colors: ["G"], enchants: { power: 2, toughness: 0, keywords: ["trample"] } });
Cards.define("Glorious Anthem", { types: ["enchantment"], colors: ["W"], static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });

const bf = (id, name, seat, attachedTo) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {}, attachedTo: attachedTo || null });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });
const E = (g, id) => At.effectiveAttached(g, id, {});

// 1) Equipment grants P/T
(function () {
  const g = game({ bear: bf("bear", "Bear", 0), eq: bf("eq", "Bonesplitter", 0, "bear") });
  const e = E(g, "bear");
  ok(e.power === 4 && e.toughness === 2, "Bear + Bonesplitter = 4/2 (got " + e.power + "/" + e.toughness + ")");
})();

// 2) no attachments -> printed P/T
(function () {
  const g = game({ bear: bf("bear", "Bear", 0) });
  const e = E(g, "bear");
  ok(e.power === 2 && e.toughness === 2, "unequipped Bear = 2/2");
})();

// 3) two pieces of equipment stack, and grant a keyword
(function () {
  const g = game({ bear: bf("bear", "Bear", 0), e1: bf("e1", "Bonesplitter", 0, "bear"), e2: bf("e2", "Lifeblade", 0, "bear") });
  const e = E(g, "bear");
  ok(e.power === 5 && e.toughness === 3, "Bear + Bonesplitter + Lifeblade = 5/3");
  ok(e.abilities.indexOf("lifelink") >= 0, "Lifeblade granted lifelink");
})();

// 4) an Aura buffs + grants a keyword too
(function () {
  const g = game({ bear: bf("bear", "Bear", 0), aura: bf("aura", "Rancor", 0, "bear") });
  const e = E(g, "bear");
  ok(e.power === 4 && e.toughness === 2 && e.abilities.indexOf("trample") >= 0, "Rancor on Bear = 4/2 with trample");
})();

// 5) attachmentsOf lists only what's attached to this creature
(function () {
  const g = game({ bear: bf("bear", "Bear", 0), on: bf("on", "Bonesplitter", 0, "bear"), off: bf("off", "Lifeblade", 0, null) });
  const ids = At.attachmentsOf(g, "bear").map(function (c) { return c.instanceId; });
  ok(J(ids) === J(["on"]), "only the attached equipment is listed (got " + J(ids) + ")");
})();

// 6) attachments STACK with an anthem through the layer system
(function () {
  const g = game({ bear: bf("bear", "Bear", 0), anthem: bf("anthem", "Glorious Anthem", 0), eq: bf("eq", "Bonesplitter", 0, "bear") });
  const e = E(g, "bear");
  ok(e.power === 5 && e.toughness === 3, "Bear + anthem(+1/+1) + Bonesplitter(+2/0) = 5/3 (got " + e.power + "/" + e.toughness + ")");
})();

// 7) an unattached Equipment contributes nothing
(function () {
  const g = game({ bear: bf("bear", "Bear", 0), eq: bf("eq", "Bonesplitter", 0, null) });
  const e = E(g, "bear");
  ok(e.power === 2 && e.toughness === 2, "unattached Bonesplitter doesn't buff anyone");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
