// Test for rules-evolve.js — +1/+1 when a bigger creature enters under your control, incl. granted evolve.
// No DOM, no network, no engine-core needed. Run: node tests/rules-evolve.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-counters.js", "MTGRulesCounters");
const Ev = loadInto(G, "rules-evolve.js", "MTGRulesEvolve");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Evolver", { types: ["creature"], power: 2, toughness: 2, abilities: ["evolve"] });
Cards.define("Smaller", { types: ["creature"], power: 1, toughness: 1 });
Cards.define("Wider", { types: ["creature"], power: 3, toughness: 1 });   // greater power only
Cards.define("Taller", { types: ["creature"], power: 1, toughness: 3 });  // greater toughness only
Cards.define("Equal", { types: ["creature"], power: 2, toughness: 2 });   // neither greater
Cards.define("Evolve Banner", { types: ["enchantment"], static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["evolve"] }] });
Cards.define("Trinket", { types: ["artifact"] });

const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: counters || {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) a bigger creature entering triggers evolve (one counter)
(function () {
  const g = game({ e: bf("e", "Evolver", 0), n: bf("n", "Wider", 0) });
  const t = Ev.evolveTriggers(g, "n", {});
  ok(t.length === 1 && t[0].id === "e", "greater power -> evolve triggers");
  ok(J(t[0].event) === J({ t: "card_counter", instanceId: "e", kind: "+1/+1", delta: 1 }), "evolve -> +1/+1 on evolver");
})();

// 2) greater toughness ALONE also triggers
(function () {
  const g = game({ e: bf("e", "Evolver", 0), n: bf("n", "Taller", 0) });
  ok(Ev.evolveTriggers(g, "n", {}).length === 1, "greater toughness only -> evolve triggers");
})();

// 3) neither greater (equal) does NOT trigger
(function () {
  const g = game({ e: bf("e", "Evolver", 0), n: bf("n", "Equal", 0) });
  ok(J(Ev.evolveTriggers(g, "n", {})) === J([]), "equal P/T -> no trigger");
})();

// 4) a strictly smaller creature does not trigger
(function () {
  const g = game({ e: bf("e", "Evolver", 0), n: bf("n", "Smaller", 0) });
  ok(J(Ev.evolveTriggers(g, "n", {})) === J([]), "smaller -> no trigger");
})();

// 5) an opponent's bigger creature does NOT trigger your evolve (only same controller)
(function () {
  const g = game({ e: bf("e", "Evolver", 0), n: bf("n", "Wider", 1) });
  ok(J(Ev.evolveTriggers(g, "n", {})) === J([]), "opponent's creature -> your evolve doesn't fire");
})();

// 6) a non-creature entering never triggers evolve
(function () {
  const g = game({ e: bf("e", "Evolver", 0), n: bf("n", "Trinket", 0) });
  ok(J(Ev.evolveTriggers(g, "n", {})) === J([]), "artifact entering -> no evolve");
})();

// 7) comparison is over EFFECTIVE P/T: an evolver already grown to 3/3 isn't out-sized by a 3/1
(function () {
  const g = game({ e: bf("e", "Evolver", 0, { "+1/+1": 1 }), n: bf("n", "Wider", 0) }); // evolver 3/3 vs Wider 3/1
  ok(J(Ev.evolveTriggers(g, "n", {})) === J([]), "grown evolver (3/3) not out-sized by 3/1");
})();

// 8) GRANTED evolve: a banner grants evolve to a vanilla Equal (2/2), which then evolves off a bigger newcomer
(function () {
  const g = game({ ban: bf("ban", "Evolve Banner", 0), host: bf("host", "Equal", 0), n: bf("n", "Wider", 0) });
  ok(Ev.hasEvolve(Ev.abilitiesOf(g, "host", {})) === true, "granted evolve present on host");
  const t = Ev.evolveTriggers(g, "n", {});
  ok(t.length === 1 && t[0].id === "host", "granted-evolve host gets a +1/+1 from bigger newcomer");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
