/*
 * card-defs.js — Phase R3 minimal card-definition DSL + curated first slice. PURE / data-driven.
 * Browser global (window.MTGCards) + Node module. A card definition is plain serializable data;
 * helpers turn a definition into the table-core primitive events the engine applies on resolution
 * (so the rules engine stays deterministic/replayable). No engine or table-core import — these are
 * pure functions over the definition; the caller (engine driver / tests) wires them to engine-core.
 *
 * §10 defaults in force (Cole can override): hand-scripted DSL + curated set; first slice = lands /
 * vanilla creatures / simple burn / mana. Triggers, targeting of permanents, and a damage model are
 * intentionally out of this slice (they belong to R4 with the event-watcher + damage subsystems).
 *
 * spec = { types:[], subtypes:[], colors:[], power, toughness, mana:{generic,W,U,B,R,G},
 *          produces:"R"|..., spell:{ damage, target } }
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGCards = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PERMANENT = ["land", "creature", "artifact", "enchantment", "planeswalker", "battle"];
  var REG = {};

  function define(name, spec) {
    spec = spec || {}; spec.name = name;
    spec.types = spec.types || []; spec.subtypes = spec.subtypes || []; spec.colors = spec.colors || [];
    REG[name] = spec; return spec;
  }
  function get(name) { return REG[name] || null; }
  function all() { return Object.keys(REG).map(function (n) { return REG[n]; }); }
  function isPermanent(def) { return !!def && def.types.some(function (t) { return PERMANENT.indexOf(t) >= 0; }); }

  // Resolution effects (table-core primitives) for casting `def`.
  // Permanent -> enters the battlefield. Instant/sorcery with damage at a player -> life loss.
  function castEffects(def, opts) {
    opts = opts || {};
    if (isPermanent(def)) {
      return [{ t: "card_move", instanceId: opts.instanceId, toZone: "battlefield", x: opts.x != null ? opts.x : 50, y: opts.y != null ? opts.y : 50 }];
    }
    var out = [];
    if (def && def.spell && def.spell.damage != null && opts.target && opts.target.seat != null) {
      out.push({ t: "adjust_life", seat: opts.target.seat, delta: -def.spell.damage });
    }
    return out;
  }

  // Activating a mana ability, expressed with existing primitives: tap the source + add to the pool.
  // The "mana pool" is modeled as player counters keyed mana_<COLOR> (no engine/state changes needed).
  function manaEvents(def, opts) {
    opts = opts || {};
    if (!def || !def.produces) return [];
    return [
      { t: "card_tap", instanceId: opts.instanceId, tapped: true },
      { t: "player_counter", seat: opts.controllerSeat || 0, kind: "mana_" + def.produces, delta: 1 }
    ];
  }

  // Effective characteristics seed for rules-layers (R2): the printed base of a card definition.
  function printedBase(def, over) {
    over = over || {};
    return {
      name: def.name, controller: over.controller != null ? over.controller : 0,
      types: def.types.slice(), subtypes: def.subtypes.slice(), colors: def.colors.slice(),
      abilities: (def.abilities || []).slice(),
      power: def.power != null ? def.power : null, toughness: def.toughness != null ? def.toughness : null,
      counters: over.counters || {}
    };
  }

  // ---- curated first slice ----
  define("Mountain", { types: ["land"], subtypes: ["mountain"], produces: "R" });
  define("Forest", { types: ["land"], subtypes: ["forest"], produces: "G" });
  define("Grizzly Bears", { types: ["creature"], subtypes: ["bear"], colors: ["G"], power: 2, toughness: 2, mana: { generic: 1, G: 1 } });
  define("Llanowar Elves", { types: ["creature"], subtypes: ["elf"], colors: ["G"], power: 1, toughness: 1, mana: { G: 1 }, produces: "G" });
  define("Shock", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 2, target: "any" } });
  define("Lightning Bolt", { types: ["instant"], colors: ["R"], mana: { R: 1 }, spell: { damage: 3, target: "any" } });

  return {
    define: define, get: get, all: all, isPermanent: isPermanent,
    castEffects: castEffects, manaEvents: manaEvents, printedBase: printedBase,
    PERMANENT: PERMANENT, registry: REG
  };
});
