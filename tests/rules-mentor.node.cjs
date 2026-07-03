// Test for rules-mentor.js — mentor puts +1/+1 on a lesser-power attacker, incl. granted mentor.
// No DOM, no network, no engine-core needed. Run: node tests/rules-mentor.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-layers.js", "MTGRulesLayers");
loadInto(G, "rules-static.js", "MTGRulesStatic");
loadInto(G, "rules-keywords.js", "MTGRulesKeywords");
loadInto(G, "rules-counters.js", "MTGRulesCounters");
const Me = loadInto(G, "rules-mentor.js", "MTGRulesMentor");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Sergeant", { types: ["creature"], power: 3, toughness: 3, abilities: ["mentor"] });
Cards.define("Recruit", { types: ["creature"], power: 1, toughness: 1 });
Cards.define("Peer", { types: ["creature"], power: 3, toughness: 3 });
Cards.define("Bruiser", { types: ["creature"], power: 4, toughness: 4 });
Cards.define("Mentor Banner", { types: ["enchantment"], static: [{ kind: "grant", affects: "other-creatures-you-control", keywords: ["mentor"] }] });

const bf = (id, name, seat, counters) => ({ instanceId: id, name: name, zone: "battlefield", ownerSeat: seat, controllerSeat: seat, counters: counters || {} });
const game = (cards) => ({ seats: 2, players: [{ seat: 0 }, { seat: 1 }], cards: cards });

// 1) lesser-power attacker is a legal target
(function () {
  const g = game({ s: bf("s", "Sergeant", 0), r: bf("r", "Recruit", 0) });
  ok(J(Me.mentorTargets(g, "s", ["s", "r"], {})) === J(["r"]), "recruit (1) < sergeant (3) is a target");
})();

// 2) equal-power attacker is NOT a legal target (strict lesser)
(function () {
  const g = game({ s: bf("s", "Sergeant", 0), p: bf("p", "Peer", 0) });
  ok(J(Me.mentorTargets(g, "s", ["s", "p"], {})) === J([]), "equal power -> not a target");
})();

// 3) greater-power attacker is NOT a legal target
(function () {
  const g = game({ s: bf("s", "Sergeant", 0), b: bf("b", "Bruiser", 0) });
  ok(J(Me.mentorTargets(g, "s", ["s", "b"], {})) === J([]), "greater power -> not a target");
})();

// 4) the mentor never targets itself
(function () {
  const g = game({ s: bf("s", "Sergeant", 0), r: bf("r", "Recruit", 0) });
  ok(Me.mentorTargets(g, "s", ["s", "r"], {}).indexOf("s") < 0, "mentor never targets itself");
})();

// 5) applyMentor emits a +1/+1 counter event on a legal target, and [] on an illegal one
(function () {
  const g = game({ s: bf("s", "Sergeant", 0), r: bf("r", "Recruit", 0), p: bf("p", "Peer", 0) });
  ok(J(Me.applyMentor(g, "s", "r", {})) === J([{ t: "card_counter", instanceId: "r", kind: "+1/+1", delta: 1 }]), "applyMentor -> +1/+1 on recruit");
  ok(J(Me.applyMentor(g, "s", "p", {})) === J([]), "applyMentor on equal-power target -> no event");
})();

// 6) a non-mentor creature yields no targets
(function () {
  const g = game({ p: bf("p", "Peer", 0), r: bf("r", "Recruit", 0) });
  ok(J(Me.mentorTargets(g, "p", ["p", "r"], {})) === J([]), "no mentor -> no targets");
})();

// 7) power comparison is over EFFECTIVE power: a +1/+1 counter pushes the recruit to equal power -> excluded
(function () {
  const g = game({ s: bf("s", "Sergeant", 0), r: bf("r", "Recruit", 0, { "+1/+1": 2 }) }); // recruit becomes 3/3
  ok(J(Me.mentorTargets(g, "s", ["s", "r"], {})) === J([]), "counters raise recruit to 3 -> no longer lesser");
})();

// 8) GRANTED mentor: a banner grants mentor to a vanilla Peer, which can then mentor the smaller Recruit
(function () {
  const g = game({ ban: bf("ban", "Mentor Banner", 0), p: bf("p", "Peer", 0), r: bf("r", "Recruit", 0) });
  ok(Me.hasMentor(Me.abilitiesOf(g, "p", {})) === true, "granted mentor present on Peer");
  ok(J(Me.mentorTargets(g, "p", ["p", "r"], {})) === J(["r"]), "granted-mentor Peer (3) mentors Recruit (1)");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
