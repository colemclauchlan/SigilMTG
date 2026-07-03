/*
 * card-library.js — a curated starter card set defined via the DSL. PURE (data registration).
 * Browser global (window.MTGCardLibrary) + Node module. Calls card-defs `define()` to register a set
 * of recognizable real cards using ONLY mechanics the engine already executes: types/subtypes/colors,
 * power/toughness, mana cost, basic-land mana production, keyword abilities (flying, vigilance,
 * deathtouch, first strike, trample, lifelink — the last two advisory until wired), and simple ETB
 * triggers (draw / gain life). This is the §10 "hand-scripted DSL + curated set" approach made real;
 * cards needing oracle-text behavior parsing are out of scope here.
 *
 *   MTGCardLibrary.register(Cards?)   // Cards defaults to window.MTGCards; returns the registry size
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCardLibrary = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function register(Cards) {
    Cards = Cards || root.MTGCards;
    var d = Cards.define;

    // basic lands
    d("Plains", { types: ["land"], subtypes: ["plains"], supertypes: ["basic"], produces: "W" });
    d("Island", { types: ["land"], subtypes: ["island"], supertypes: ["basic"], produces: "U" });
    d("Swamp", { types: ["land"], subtypes: ["swamp"], supertypes: ["basic"], produces: "B" });
    d("Mountain", { types: ["land"], subtypes: ["mountain"], supertypes: ["basic"], produces: "R" });
    d("Forest", { types: ["land"], subtypes: ["forest"], supertypes: ["basic"], produces: "G" });

    // vanilla / keyword creatures
    d("Goblin Piker", { types: ["creature"], subtypes: ["goblin", "warrior"], colors: ["R"], power: 2, toughness: 1, mana: { generic: 1, R: 1 } });
    d("Grizzly Bears", { types: ["creature"], subtypes: ["bear"], colors: ["G"], power: 2, toughness: 2, mana: { generic: 1, G: 1 } });
    d("Craw Wurm", { types: ["creature"], subtypes: ["wurm"], colors: ["G"], power: 6, toughness: 4, mana: { generic: 4, G: 2 } });
    d("Air Elemental", { types: ["creature"], subtypes: ["elemental"], colors: ["U"], power: 4, toughness: 4, abilities: ["flying"], mana: { generic: 3, U: 1 } });
    d("Serra Angel", { types: ["creature"], subtypes: ["angel"], colors: ["W"], power: 4, toughness: 4, abilities: ["flying", "vigilance"], mana: { generic: 3, W: 1 } });
    d("White Knight", { types: ["creature"], subtypes: ["knight"], colors: ["W"], power: 2, toughness: 2, abilities: ["first strike"], mana: { W: 2 } });
    d("Vampire Nighthawk", { types: ["creature"], subtypes: ["vampire"], colors: ["B"], power: 2, toughness: 3, abilities: ["flying", "deathtouch", "lifelink"], mana: { generic: 1, B: 2 } });
    d("Llanowar Elves", { types: ["creature"], subtypes: ["elf", "druid"], colors: ["G"], power: 1, toughness: 1, mana: { G: 1 }, produces: "G" });

    // ETB-trigger creatures
    d("Elvish Visionary", { types: ["creature"], subtypes: ["elf"], colors: ["G"], power: 1, toughness: 1, mana: { generic: 1, G: 1 }, triggers: [{ on: "etb", effects: [{ t: "draw", seat: "controller", count: 1 }] }] });
    d("Kitchen Finks", { types: ["creature"], subtypes: ["ouphe"], colors: ["G", "W"], power: 3, toughness: 2, mana: { generic: 1, G: 1, W: 1 }, triggers: [{ on: "etb", effects: [{ t: "adjust_life", seat: "controller", delta: 2 }] }] });

    // burn
    d("Lightning Bolt", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 3, target: "any" } });
    d("Shock", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 2, target: "any" } });
    d("Lava Spike", { types: ["sorcery"], subtypes: ["arcane"], colors: ["R"], mana: { R: 1 }, spell: { damage: 3, target: "player" } });

    return Cards.all().length;
  }

  return { register: register };
});
