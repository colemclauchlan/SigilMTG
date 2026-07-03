// Test for rules-embalm.js — embalm (white copy) & eternalize (black 4/4) from the graveyard. Pure.
// Run: node tests/rules-embalm.node.cjs
const fs = require("fs"), path = require("path");
function loadInto(self, file, g) { const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); new Function("self", "module", code)(self, { exports: null }); return self[g]; }
const G = {};
const Core = loadInto(G, "table-core.js", "MTGCore");
const Cards = loadInto(G, "card-defs.js", "MTGCards");
loadInto(G, "rules-mana.js", "MTGRulesMana");
const Emb = loadInto(G, "rules-embalm.js", "MTGRulesEmbalm");

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
const J = (x) => JSON.stringify(x);

Cards.define("Sacred Cat", { types: ["creature"], subtypes: ["cat"], colors: ["W"], power: 1, toughness: 1, abilities: ["lifelink"], embalm: { generic: 1, W: 1 } });
Cards.define("Honored Hydra", { types: ["creature"], subtypes: ["snake", "hydra"], colors: ["G"], power: 5, toughness: 5, abilities: ["trample"], eternalize: { generic: 5, B: 2 } });
Cards.define("Plain Corpse", { types: ["creature"], colors: ["B"], power: 2, toughness: 2 });

function apply(g, events) { events.forEach(function (e) { g = Core.reduce(g, e); }); return g; }
function build(name, mana, kind) {
  let g = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "dead", name: name, zone: "graveyard" }], []] });
  const key = kind === "B" ? "mana_B" : "mana_W";
  if (mana) g = Core.reduce(g, { t: "player_counter", seat: 0, kind: key, delta: mana });
  // embalm also needs {1} generic / eternalize needs {5} generic — add colorless
  g = Core.reduce(g, { t: "player_counter", seat: 0, kind: "mana_C", delta: 9 });
  return g;
}

// 1) cost readers + tokenSpec characteristics
(function () {
  ok(J(Emb.embalmCost(Cards.get("Sacred Cat"))) === J({ generic: 1, W: 1 }), "reads the embalm cost");
  ok(J(Emb.eternalizeCost(Cards.get("Honored Hydra"))) === J({ generic: 5, B: 2 }), "reads the eternalize cost");
  const g = build("Sacred Cat", 1, "W");
  const spec = Emb.tokenSpec(g, "dead", "embalm", {});
  ok(spec.colors[0] === "W" && spec.power === 1 && spec.toughness === 1, "embalm token: white, keeps 1/1");
  const g2 = build("Honored Hydra", 2, "B");
  const spec2 = Emb.tokenSpec(g2, "dead", "eternalize", {});
  ok(spec2.colors[0] === "B" && spec2.power === 4 && spec2.toughness === 4, "eternalize token: black 4/4");
  ok(J(spec2.abilities) === J(["trample"]) && spec2.subtypes.indexOf("hydra") >= 0, "eternalize keeps abilities + subtypes");
})();

// 2) embalm: exile the graveyard card, create a WHITE token copy on the battlefield
(function () {
  let g = build("Sacred Cat", 1, "W");
  g = apply(g, Emb.embalm(g, "dead", {}));
  ok(g.cards["dead"].zone === "exile", "the original card is exiled by embalm");
  const toks = Core.cardsOf(g, 0, "battlefield").filter(function (c) { return c.isToken; });
  ok(toks.length === 1, "embalm creates exactly one token");
  const tdef = Cards.get(toks[0].name);
  ok(tdef && tdef.colors[0] === "W" && tdef.power === 1, "the token copy is a white 1/1 (def registered)");
  ok((g.players[0].counters.mana_W || 0) === 0, "the {W} part of the embalm cost was paid");
})();

// 3) eternalize: exile + create a BLACK 4/4 token copy
(function () {
  let g = build("Honored Hydra", 2, "B");
  g = apply(g, Emb.eternalize(g, "dead", {}));
  ok(g.cards["dead"].zone === "exile", "eternalize exiles the original");
  const toks = Core.cardsOf(g, 0, "battlefield").filter(function (c) { return c.isToken; });
  const tdef = Cards.get(toks[0].name);
  ok(tdef && tdef.colors[0] === "B" && tdef.power === 4 && tdef.toughness === 4, "the token copy is a black 4/4");
})();

// 4) edge case: a card with neither ability (and a card not in the graveyard) produces no events
(function () {
  let g = build("Plain Corpse", 0, "W");
  ok(J(Emb.embalm(g, "dead", {})) === J([]), "a creature without embalm yields no events");
  let g2 = Core.init({ seats: 2, startingLife: 20, decks: [[{ instanceId: "hand1", name: "Sacred Cat", zone: "hand" }], []] });
  ok(J(Emb.embalm(g2, "hand1", {})) === J([]), "embalm only works from the graveyard (a hand card yields nothing)");
})();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
