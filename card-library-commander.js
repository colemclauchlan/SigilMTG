/*
 * card-library-commander.js — a curated set of recognizable Commander/EDH staples, each modeled with
 * ONLY mechanics the engine actually executes (equipment/auras, removal, burn, counters, draw, ramp/tutor,
 * anthems/lords, keyword creatures, a vehicle, an X spell, a modal charm). PURE data.
 * Browser global (window.MTGCardLibraryCommander) + Node module.
 *
 *   MTGCardLibraryCommander.register(Cards?)   // Cards defaults to window.MTGCards; returns registry size
 *
 * Behavior lives in the rules modules: counters via rules-counter.castCounter, ramp/tutor via rules-search,
 * X via rules-xspells, equip via rules-equip, crew via rules-crew, modal via rules-modal. Cards that also
 * make tokens (Beast Within's 3/3, Smuggler's Copter's loot) are modeled to their engine-expressible part
 * and the extra is noted — no card claims behavior the engine can't do.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCardLibraryCommander = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function register(Cards) {
    Cards = Cards || root.MTGCards; var d = Cards.define;

    // --- Equipment (rules-equip + rules-attach) ---
    d("Swiftfoot Boots", { types: ["artifact", "equipment"], mana: { generic: 1 }, equips: { keywords: ["hexproof", "haste"] }, equipCost: { generic: 1 } });
    d("Lightning Greaves", { types: ["artifact", "equipment"], mana: { generic: 2 }, equips: { keywords: ["shroud", "haste"] }, equipCost: { generic: 0 } });
    d("Bonesplitter", { types: ["artifact", "equipment"], mana: { generic: 1 }, equips: { power: 2, toughness: 0 }, equipCost: { generic: 1 } });
    d("Whispersilk Cloak", { types: ["artifact", "equipment"], mana: { generic: 3 }, equips: { keywords: ["unblockable", "shroud"] }, equipCost: { generic: 2 } });

    // --- Aura (rules-aura) ---
    d("Rancor", { types: ["enchantment", "aura"], colors: ["G"], mana: { G: 1 }, enchants: { power: 2, toughness: 0, keywords: ["trample"] } });

    // --- Removal (rules-spells) ---
    d("Swords to Plowshares", { types: ["instant"], colors: ["W"], mana: { W: 1 }, spell: { target: "creature", effects: [{ t: "card_move", instanceId: "target", toZone: "exile" }] } });
    d("Doom Blade", { types: ["instant"], colors: ["B"], mana: { generic: 1, B: 1 }, spell: { target: "creature", effects: [{ t: "card_move", instanceId: "target", toZone: "graveyard" }] } });
    d("Beast Within", { types: ["instant"], colors: ["G"], mana: { generic: 2, G: 1 }, spell: { target: "permanent", effects: [{ t: "card_move", instanceId: "target", toZone: "graveyard" }] } }); // +makes a 3/3 (token: caller)

    // --- Burn / X (rules-spells, rules-xspells) ---
    d("Lightning Bolt", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 3, target: "any" } });
    d("Fireball", { types: ["sorcery"], colors: ["R"], mana: { R: 1 }, spell: { xDamage: true, target: "any" } });

    // --- Counters (rules-counter) ---
    d("Counterspell", { types: ["instant"], colors: ["U"], mana: { U: 2 } });
    d("Negate", { types: ["instant"], colors: ["U"], mana: { generic: 1, U: 1 } });           // counters noncreature (caller-restricted)

    // --- Card draw (rules-spells) ---
    d("Divination", { types: ["sorcery"], colors: ["U"], mana: { generic: 2, U: 1 }, spell: { effects: [{ t: "draw", seat: "controller", count: 2 }] } });
    d("Sign in Blood", { types: ["sorcery"], colors: ["B"], mana: { B: 2 }, spell: { effects: [{ t: "draw", seat: "controller", count: 2 }, { t: "adjust_life", seat: "controller", delta: -2 }] } });

    // --- Ramp / tutor (rules-search) ---
    d("Cultivate", { types: ["sorcery"], colors: ["G"], mana: { generic: 2, G: 1 }, searchRamp: { count: 2, toBattlefield: 1, basic: true } });
    d("Rampant Growth", { types: ["sorcery"], colors: ["G"], mana: { generic: 1, G: 1 }, searchRamp: { count: 1, toBattlefield: 1, basic: true } });
    d("Llanowar Elves", { types: ["creature"], subtypes: ["elf"], colors: ["G"], mana: { G: 1 }, power: 1, toughness: 1, produces: "G" });

    // --- Anthems / lords (rules-static, rules-keywords) ---
    d("Glorious Anthem", { types: ["enchantment"], colors: ["W"], mana: { generic: 1, W: 1 }, static: [{ kind: "anthem", affects: "creatures-you-control", power: 1, toughness: 1 }] });
    d("Elvish Archdruid", { types: ["creature"], subtypes: ["elf"], colors: ["G"], mana: { generic: 1, G: 1 }, power: 2, toughness: 2, static: [{ kind: "anthem", affects: "other-creatures-you-control", subtype: "elf", power: 1, toughness: 1 }] });

    // --- Keyword creatures ---
    d("Serra Angel", { types: ["creature"], subtypes: ["angel"], colors: ["W"], mana: { generic: 3, W: 2 }, power: 4, toughness: 4, abilities: ["flying", "vigilance"] });
    d("Vampire Nighthawk", { types: ["creature"], subtypes: ["vampire"], colors: ["B"], mana: { generic: 1, B: 2 }, power: 2, toughness: 3, abilities: ["flying", "deathtouch", "lifelink"] });

    // --- Vehicle (rules-crew) ---
    d("Smuggler's Copter", { types: ["artifact", "vehicle"], mana: { generic: 2 }, crew: 1, power: 3, toughness: 3, abilities: ["flying"] }); // +loots on attack (caller)

    // --- Modal charm (rules-modal) ---
    d("Naya Charm", { types: ["instant"], colors: ["R"], mana: { R: 1, G: 1, W: 1 }, spell: { modal: true, chooseCount: 1, modes: [
      { label: "3 damage to target", effects: [{ t: "adjust_life", seat: "target", delta: -3 }] },
      { label: "Gain 4 life", effects: [{ t: "adjust_life", seat: "controller", delta: 4 }] },
      { label: "Draw a card", effects: [{ t: "draw", seat: "controller", count: 1 }] }
    ] } });

    return Cards.all().length;
  }

  return { register: register };
});
