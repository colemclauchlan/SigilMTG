// integration-new-mechanics.node.cjs — the 20 newly-added mechanic modules all load together
// (no global collisions), each exposes a functional API, and a few compose over one game state.
// Run: node tests/integration-new-mechanics.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-counters.js", "MTGRulesCounters");
loadInto(G, "rules-tokens.js", "MTGRulesTokens");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

const mods = {
  Prowess: "rules-prowess.js", Exalted: "rules-exalted.js", Mentor: "rules-mentor.js", Evolve: "rules-evolve.js", Bloodthirst: "rules-bloodthirst.js",
  Persist: "rules-persist.js", Modular: "rules-modular.js", Annihilator: "rules-annihilator.js", Soulbond: "rules-soulbond.js", Amass: "rules-amass.js",
  Dash: "rules-dash.js", Madness: "rules-madness.js", Embalm: "rules-embalm.js", Dredge: "rules-dredge.js", Ward: "rules-ward.js",
  Affinity: "rules-affinity.js", Delve: "rules-delve.js", Storm: "rules-storm.js", Landfall: "rules-landfall.js", Toxic: "rules-toxic.js"
};
const API = {};
// 1) every new module loads as its global and exposes at least one function — proves no collisions / all coexist
Object.keys(mods).forEach(function (k) {
  API[k] = loadInto(G, mods[k], "MTGRules" + k);
  ok(API[k] && typeof API[k] === "object", mods[k] + " loads as MTGRules" + k);
  var fns = API[k] ? Object.keys(API[k]).filter(function (n) { return typeof API[k][n] === "function"; }) : [];
  ok(fns.length >= 1, mods[k] + " exposes >=1 function (" + fns.length + ")");
});

// 2) cross-module composition over one shared game state (only fails if a call THROWS or returns a bad shape)
const bf = (id, name, seat) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: {} });
try {
  Cards.define("Apprentice", { types: ["creature"], power: 1, toughness: 1, abilities: ["prowess", "exalted", "toxic"] });
  const g = { seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: { a: bf("a", "Apprentice", 0) } };
  const p = API.Prowess.prowessBonus(g, "a", 2, {});                 // 1/1 + 2 noncreature spells -> 3/3
  ok(p && typeof p.power === "number" && p.power >= 3, "prowess: 1/1 + 2 spells -> power " + (p && p.power));
  API.Exalted.exaltedBonus(g, 0, ["a"], {});                        // lone attacker, no throw
  const tox = API.Toxic.toxicN(g, "a", {});                          // toxic value, no throw
  ok(typeof tox === "number" || tox == null || typeof tox === "object", "toxic N computed for the same creature");
  ok(true, "prowess + exalted + toxic compose over one game without colliding");
} catch (err) { ok(false, "cross-module composition threw: " + err.message); }

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
