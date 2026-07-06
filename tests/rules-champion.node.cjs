// Test for rules-champion.js — champion (CR 702.71): exile another creature on enter, return it on leave.
// Pure. Run: node tests/rules-champion.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
const CH = loadInto(G, "rules-champion.js", "MTGRulesChampion");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }

Cards.define("Avenger", { types: ["creature"], power: 5, toughness: 5, mana: { generic: 3, W: 1 }, champion: "creature" });
Cards.define("Elf", { types: ["creature"], power: 1, toughness: 1, mana: { generic: 1 } });
Cards.define("Rock", { types: ["artifact"], mana: { generic: 1 } });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build() {
  return Core.init({ seats: 2, startingLife: 20, decks: [[
    { instanceId: "av", name: "Avenger", zone: "battlefield" },
    { instanceId: "e1", name: "Elf", zone: "battlefield" },
    { instanceId: "ro", name: "Rock", zone: "battlefield" }
  ], []] });
}

// 1) champion type detection
ok(CH.championType(Cards.get("Avenger")) === "creature", "championType -> 'creature'");
ok(CH.championType(Cards.get("Elf")) === null, "no champion -> null");

// 2) canChampion: another creature you control; not itself; not a noncreature
ok(CH.canChampion(build(), "av", "e1", 0, {}).ok === true, "can champion the Elf");
ok(/ANOTHER/.test(CH.canChampion(build(), "av", "av", 0, {}).reason), "can't champion itself");
ok(/must be a creature/.test(CH.canChampion(build(), "av", "ro", 0, {}).reason), "can't champion the artifact");

// 3) championEnterEvents: exile the chosen creature, remember it
(function () {
  let g = build();
  g = apply(g, CH.championEnterEvents(g, "av", "e1", {}));
  ok(g.cards["e1"].zone === "exile", "the championed Elf is exiled");
  ok(g.cards["av"].championed === "e1", "Avenger remembers the exiled Elf");
})();

// 4) championLeaveEvents: return the exiled creature when the champion leaves
(function () {
  let g = build();
  g = apply(g, CH.championEnterEvents(g, "av", "e1", {}));
  g = apply(g, CH.championLeaveEvents(g, "av"));
  ok(g.cards["e1"].zone === "battlefield", "the Elf returns to the battlefield");
  ok(g.cards["av"].championed === null, "champion link cleared");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
