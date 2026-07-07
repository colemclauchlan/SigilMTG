// Test for rules-exert.js — exert (CR 701.39): exert as it attacks; the creature skips exactly one
// of its controller's untap steps, then behaves normally. Pure.
// Run: node tests/rules-exert.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const EX = loadInto(G, "rules-exert.js", "MTGRulesExert");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function apply(g, evs) { evs.forEach(function (e) { g = Core.reduce(g, e); }); return g; }

Cards.define("Glory-Bound Initiate", { types: ["creature"], power: 3, toughness: 1, exert: true });
Cards.define("Grizzly Bears", { types: ["creature"], power: 2, toughness: 2 });

function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "gbi", name: "Glory-Bound Initiate", zone: "battlefield" },
    { instanceId: "gb", name: "Grizzly Bears", zone: "battlefield" }
  ], [
    { instanceId: "opp", name: "Grizzly Bears", zone: "battlefield" }
  ]] });
}

// 1) gates
let g = build();
ok(EX.canExert(g, "gbi", 0).ok === true, "own exert creature can exert");
ok(/no exert/.test(EX.canExert(g, "gb", 0).reason), "non-exert creature rejected");
ok(/not your/.test(EX.canExert(g, "gbi", 1).reason), "opponent can't exert it");
ok(/no such/.test(EX.canExert(g, "zz", 0).reason), "unknown id rejected");

// 2) exert + attack-tap: flag set, card tapped (attack tap is the board's job)
g = apply(g, [{ t: "card_tap", instanceId: "gbi", tapped: true }].concat(EX.exertEvents(g, "gbi", 0)));
ok(EX.isExerted(g, "gbi") === true, "exerted flag set");
ok(g.cards["gbi"].tapped === true, "attacker tapped");
ok(EX.exertEvents(g, "gbi", 0).length === 0, "already exerted -> no double-exert events");

// 3) tap a normal creature too, then run the controller's untap step
g = Core.reduce(g, { t: "card_tap", instanceId: "gb", tapped: true });
g = apply(g, EX.untapAllRespectingExert(g, 0));
ok(g.cards["gb"].tapped === false, "normal creature untaps");
ok(g.cards["gbi"].tapped === true, "exerted creature stays tapped");
ok(EX.isExerted(g, "gbi") === false, "exert flag cleared after the skipped untap step");

// 4) the following untap step is normal again
g = apply(g, EX.untapAllRespectingExert(g, 0));
ok(g.cards["gbi"].tapped === false, "next untap step untaps it normally");

// 5) an opponent's untap step never touches my exerted creature's flag
g = build();
g = apply(g, [{ t: "card_tap", instanceId: "gbi", tapped: true }].concat(EX.exertEvents(g, "gbi", 0)));
g = apply(g, EX.untapAllRespectingExert(g, 1));
ok(EX.isExerted(g, "gbi") === true && g.cards["gbi"].tapped === true, "opponent untap step leaves my exerted creature alone");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
