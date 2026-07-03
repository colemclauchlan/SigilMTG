/*
 * card-library-ext.js — an "advanced" curated card set showcasing the full DSL. PURE (data).
 * Browser global (window.MTGCardLibraryExt) + Node module. Registers spells (bounce/destroy/burn),
 * planeswalkers with loyalty abilities, anthems/lords, a tap-land, a mana rock, and an
 * enters-with-counters creature — all using mechanics the engine already executes. Companion to
 * card-library.js (basics + keyword creatures).
 *
 *   MTGCardLibraryExt.register(Cards?)   // Cards defaults to window.MTGCards; returns registry size
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCardLibraryExt = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function register(Cards) {
    Cards = Cards || root.MTGCards;
    var d = Cards.define;

    // anthems & lords (static abilities)
    d("Glorious Anthem", { types: ["enchantment"], colors: ["W"], static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });
    d("Goblin King", { types: ["creature"], subtypes: ["goblin"], colors: ["R"], power: 2, toughness: 2, mana: { generic: 1, R: 1 }, static: [{ kind: "anthem", affects: "other-creatures-you-control", subtype: "goblin", power: 1, toughness: 1 }, { kind: "grant", affects: "other-creatures-you-control", subtype: "goblin", keywords: ["mountainwalk"] }] });

    // targeted spells (general spell caster)
    d("Unsummon", { types: ["instant"], colors: ["U"], mana: { U: 1 }, spell: { target: "creature", effects: [{ t: "card_move", instanceId: "target", toZone: "hand" }] } });
    d("Doom Blade", { types: ["instant"], colors: ["B"], mana: { generic: 1, B: 1 }, spell: { target: "creature", effects: [{ t: "card_move", instanceId: "target", toZone: "graveyard" }] } });
    d("Lightning Bolt", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 3, target: "any" } });

    // planeswalkers (loyalty abilities)
    d("Chandra, Pyromaster", { types: ["planeswalker"], subtypes: ["chandra"], colors: ["R"], mana: { generic: 3, R: 1 }, loyalty: 4,
      loyaltyAbilities: [{ cost: 1, target: "any", effects: [{ t: "adjust_life", seat: "target", delta: -1 }] }, { cost: 0, effects: [] }] });
    d("Jace Beleren", { types: ["planeswalker"], subtypes: ["jace"], colors: ["U"], mana: { generic: 2, U: 1 }, loyalty: 3,
      loyaltyAbilities: [{ cost: 2, effects: [{ t: "draw", seat: "controller", count: 1 }] }, { cost: -1, effects: [] }] });

    // lands & mana rocks
    d("Gateway Plaza", { types: ["land"], subtypes: ["gate"], entersTapped: true, produces: "W" });
    d("Mind Stone", { types: ["artifact"], mana: { generic: 2 }, produces: "C" });

    // enters-with-counters (replacement)
    d("Hangarback Walker", { types: ["artifact", "creature"], subtypes: ["construct"], power: 0, toughness: 0, mana: { generic: 2 }, entersWith: { counter: "+1/+1", count: 2 } });

    // ── Agent C-E: additive real cards for the newly-added keyword modules (rules-fabricate/connive/
    //    training/extort/bargain/emerge/plot/disturb/backup/prototype). Each uses that module's def shape. ──

    // fabricate N (rules-fabricate.js) — N +1/+1 counters OR N 1/1 Servo tokens on ETB
    d("Toolcraft Exemplar", { types: ["artifact", "creature"], subtypes: ["dwarf", "artificer"], colors: ["W"], power: 3, toughness: 1, mana: { W: 1 }, abilities: ["fabricate"], fabricate: 1 });
    d("Marionette Master", { types: ["artifact", "creature"], subtypes: ["construct"], colors: ["B"], power: 0, toughness: 4, mana: { generic: 5, B: 1 }, abilities: ["fabricate"], fabricate: 3 });
    d("Cultivator of Blades", { types: ["artifact", "creature"], subtypes: ["elf", "warrior"], colors: ["G"], power: 1, toughness: 1, mana: { generic: 4, G: 1 }, abilities: ["fabricate"], fabricate: 4 });

    // connive N (rules-connive.js) — draw N, discard N, +1/+1 per nonland discarded
    d("Midnight Clock", { types: ["artifact"], colors: ["U"], mana: { generic: 2, U: 1 } });
    d("Discerning Financier", { types: ["creature"], subtypes: ["human", "advisor"], colors: ["B"], power: 2, toughness: 4, mana: { generic: 3, B: 1 } });
    d("Shipwreck Sifters", { types: ["creature"], subtypes: ["merfolk", "pirate"], colors: ["U"], power: 2, toughness: 2, mana: { generic: 2, U: 1 }, abilities: ["connive"], connive: 1 });

    // training (rules-training.js) — attacks with a stronger creature -> +1/+1 counter
    d("Ambitious Dragonborn", { types: ["creature"], subtypes: ["dragon", "soldier"], colors: ["W"], power: 2, toughness: 2, mana: { generic: 1, W: 1 }, abilities: ["training"] });
    d("Keen-Eyed Curator", { types: ["creature"], subtypes: ["human", "cleric"], colors: ["W"], power: 1, toughness: 3, mana: { generic: 1, W: 1 }, abilities: ["training"] });

    // extort (rules-extort.js) — on each spell you cast, may pay {W/B} to drain each opponent 1
    d("Crypt Ghast", { types: ["creature"], subtypes: ["spirit"], colors: ["B"], power: 2, toughness: 2, mana: { generic: 3, B: 1 }, abilities: ["extort"] });
    d("Vizkopa Guildmage", { types: ["creature"], subtypes: ["human", "wizard"], colors: ["W", "B"], power: 2, toughness: 2, mana: { W: 1, B: 1 }, abilities: ["extort"] });

    // bargain (rules-bargain.js) — optional additional cost: sacrifice an artifact/enchantment/token
    d("Torch the Tower", { types: ["instant"], colors: ["R"], mana: { R: 1 }, bargain: true, spell: { damage: 2, target: "any" } });
    d("Gruff Triplets", { types: ["creature"], subtypes: ["satyr", "warrior"], colors: ["G"], power: 3, toughness: 3, mana: { generic: 4, G: 2 } });

    // emerge (rules-emerge.js) — cast by sacrificing a creature; cost reduced by its mana value
    d("Elder Deep-Fiend", { types: ["creature"], subtypes: ["octopus", "horror"], colors: ["U"], power: 5, toughness: 6, mana: { generic: 5, U: 3 }, emerge: { generic: 6, U: 1 } });
    d("Wretched Gryff", { types: ["creature"], subtypes: ["eldrazi", "hippogriff"], colors: [], power: 3, toughness: 3, mana: { generic: 5 }, emerge: { generic: 4 } });

    // plot (rules-plot.js) — pay the plot cost to exile from hand, cast free on a later turn
    d("Slick Sequence", { types: ["instant"], colors: ["R"], mana: { generic: 1, R: 1 }, plot: { generic: 1, R: 1 }, spell: { damage: 2, target: "any" } });
    d("Trained Arynx", { types: ["creature"], subtypes: ["cat"], colors: ["G"], power: 5, toughness: 4, mana: { generic: 3, G: 1 }, plot: { generic: 2, G: 1 } });

    // disturb (rules-disturb.js) — cast the back face from the graveyard for the disturb cost, then exile
    d("Baithook Angler", { types: ["creature"], subtypes: ["zombie"], colors: ["U"], power: 2, toughness: 1, mana: { U: 1 }, disturb: { generic: 2, U: 1 } });
    d("Lunar Frenzy", { types: ["sorcery"], colors: ["R"], mana: { generic: 1, R: 1 }, disturb: { generic: 3, R: 1 }, spell: { damage: 3, target: "any" } });

    // backup N (rules-backup.js) — ETB: N +1/+1 counters on a target creature + grant abilities if it's another
    d("Cabaretti Ascendancy Herald", { types: ["creature"], subtypes: ["cat", "warrior"], colors: ["R"], power: 1, toughness: 1, mana: { R: 1 }, abilities: ["backup"], backup: 1, backupGrants: ["haste"] });
    d("Trelasarra, Moon Dancer", { types: ["creature"], subtypes: ["elf", "cleric"], colors: ["G", "W"], power: 2, toughness: 3, mana: { G: 1, W: 1 }, abilities: ["backup"], backup: 1, backupGrants: ["lifelink"] });
    d("Herd Migration", { types: ["creature"], subtypes: ["elephant"], colors: ["G"], power: 4, toughness: 4, mana: { generic: 3, G: 2 }, abilities: ["backup"], backup: 3, backupGrants: ["trample", "vigilance"] });

    // prototype (rules-prototype.js) — cast as a smaller colored creature (alt cost + set P/T + colors)
    d("Phyrexian Fleshgorger", { types: ["artifact", "creature"], subtypes: ["phyrexian", "wurm"], colors: [], power: 7, toughness: 5, mana: { generic: 7 }, abilities: ["lifelink", "menace", "ward"], ward: { generic: 2 }, prototype: { cost: { generic: 1, B: 1 }, colors: ["B"], power: 3, toughness: 3 } });
    d("Ovika, Enigma Goliath", { types: ["artifact", "creature"], subtypes: ["phyrexian", "praetor"], colors: [], power: 6, toughness: 6, mana: { generic: 6, R: 1 }, abilities: ["flying"], prototype: { cost: { generic: 2, R: 1 }, colors: ["R"], power: 3, toughness: 3 } });

    return Cards.all().length;
  }

  return { register: register };
});
