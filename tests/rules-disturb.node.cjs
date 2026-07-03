// Test for rules-disturb.js — cast the back face from the graveyard for the disturb cost, then exile. Pure.
// Run: node tests/rules-disturb.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const DB = loadInto(G, "rules-disturb.js", "MTGRulesDisturb");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Ghostly Spirit", { types: ["creature"], colors: ["W"], mana: { generic: 1, W: 1 }, disturb: { generic: 1, W: 1 } });
Cards.define("Plain Ghost", { types: ["creature"], colors: ["W"], mana: { generic: 1, W: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(name, manaC, manaW) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "sp", name: name, zone: "graveyard" }], []] });
  if (manaC) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: manaC });
  if (manaW) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_W", delta: manaW });
  return g;
}

// 1) can disturb with the cost available
ok(DB.canDisturb(build("Ghostly Spirit", 1, 1), "sp", 0, {}).ok === true, "can disturb with {1}{W} available");
// 2) can't disturb without cost, without disturb, or from the wrong zone
ok(DB.canDisturb(build("Ghostly Spirit", 0, 0), "sp", 0, {}).ok === false, "no mana -> can't disturb");
ok(/no disturb/.test(DB.canDisturb(build("Plain Ghost", 1, 1), "sp", 0, {}).reason), "no disturb -> rejected");

// 3) disturbEvents pays cost, moves to stack, marks disturbed+transformed
(function () {
  let g = build("Ghostly Spirit", 1, 1);
  g = apply(g, DB.disturbEvents(g, "sp", {}));
  ok(g.cards["sp"].zone === "stack", "the card went graveyard -> stack");
  ok((g.players[0].counters.mana_C || 0) === 0 && (g.players[0].counters.mana_W || 0) === 0, "the disturb cost was paid");
  ok(g.cards["sp"].disturbedCast === true && g.cards["sp"].transformed === true, "marked disturbed-cast and transformed");
})();

// 4) on leaving play a disturb-cast permanent is exiled
(function () {
  let g = build("Ghostly Spirit", 1, 1);
  g = apply(g, DB.disturbEvents(g, "sp", {}));
  g = apply(g, DB.resolveExile(g, "sp"));
  ok(g.cards["sp"].zone === "exile", "disturb-cast permanent is exiled");
})();

// 5) a normally-cast card isn't exiled by resolveExile
ok(DB.resolveExile(build("Plain Ghost", 1, 1), "sp").length === 0, "non-disturb card isn't exiled");

// 6) disturbCost getter
ok(JSON.stringify(DB.disturbCost(Cards.get("Ghostly Spirit"))) === JSON.stringify({ generic: 1, W: 1 }), "disturbCost getter");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
