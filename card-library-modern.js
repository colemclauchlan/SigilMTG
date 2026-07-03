/*
 * card-library-modern.js — a curated set exercising the engine's MODERN mechanics, each modeled with the
 * matching rules module: DFC transform, level up, vehicles/crew, mutate, foretell, flashback, cycling,
 * kicker, and an {X} enters-with-counters creature. PURE data. Browser global + Node module.
 *
 *   MTGCardLibraryModern.register(Cards?)   // returns registry size
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCardLibraryModern = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function register(Cards) {
    Cards = Cards || root.MTGCards; var d = Cards.define;

    // --- DFC werewolf (rules-transform / rules-daynight) ---
    d("Reckless Waif", { types: ["creature"], subtypes: ["human", "werewolf"], colors: ["R"], power: 1, toughness: 1, werewolf: true,
      back: { name: "Merciless Predator", types: ["creature"], subtypes: ["werewolf"], colors: ["R"], power: 3, toughness: 2 } });

    // --- leveler (rules-level) ---
    d("Student of Warfare", { types: ["creature"], subtypes: ["human", "soldier"], colors: ["W"], power: 1, toughness: 1, levelUp: { W: 1 }, levels: [
      { min: 0, max: 1, power: 1, toughness: 1, abilities: [] },
      { min: 2, max: 6, power: 3, toughness: 3, abilities: ["first strike"] },
      { min: 7, power: 4, toughness: 4, abilities: ["first strike", "double strike"] }
    ] });

    // --- vehicle (rules-crew) ---
    d("Heart of Kiran", { types: ["artifact", "vehicle"], colors: [], mana: { generic: 2 }, crew: 3, power: 4, toughness: 4, abilities: ["flying", "vigilance"] });

    // --- mutate (rules-mutate) ---
    d("Auspicious Starrix", { types: ["creature"], subtypes: ["dinosaur", "beast"], colors: ["G"], mana: { generic: 4, G: 2 }, power: 5, toughness: 5, mutate: { generic: 2, G: 1 } });

    // --- {X} enters-with-counters (rules-xspells + replacement) ---
    d("Endless One", { types: ["creature"], subtypes: ["eldrazi"], colors: [], mana: {}, power: 0, toughness: 0, xCounters: true });

    // --- foretell (rules-foretell) ---
    d("Behold the Multiverse", { types: ["instant"], colors: ["U"], mana: { generic: 3, U: 1 }, foretell: { generic: 1, U: 1 }, spell: { effects: [{ t: "draw", seat: "controller", count: 2 }] } });

    // --- flashback (rules-flashback) ---
    d("Think Twice", { types: ["instant"], colors: ["U"], mana: { generic: 1, U: 1 }, flashback: { generic: 2, U: 1 }, spell: { effects: [{ t: "draw", seat: "controller", count: 1 }] } });

    // --- cycling (rules-cycling) ---
    d("Drannith Stinger", { types: ["creature"], subtypes: ["human", "archer"], colors: ["R"], mana: { generic: 2, R: 1 }, power: 2, toughness: 3, cycling: { generic: 2 } });

    // --- kicker (rules-kicker) ---
    d("Burn Bright", { types: ["instant"], colors: ["R"], mana: { R: 1 }, kicker: { generic: 2 }, spell: { target: "any", effects: [{ t: "adjust_life", seat: "target", delta: -2 }], kickedEffects: [{ t: "draw", seat: "controller", count: 1 }] } });

    // --- escape (rules-escape) ---
    d("Underworld Breach Beast", { types: ["creature"], subtypes: ["zombie"], colors: ["B"], mana: { generic: 4, B: 1 }, power: 5, toughness: 4, escape: { mana: { generic: 3, B: 1 }, exile: 3 } });

    return Cards.all().length;
  }

  return { register: register };
});
