/*
 * rules-afterlife.js — afterlife N (CR 702.135). PURE.
 * Browser global (window.MTGRulesAfterlife) + Node module. "Afterlife N — When this creature dies,
 * create N 1/1 white and black Spirit creature tokens with flying." A dies-trigger that composes the
 * token system: the returned events create the Spirits on the battlefield under the dead creature's
 * OWNER (the token maker is the ability's controller; owner is our stable stand-in, matching how the
 * board hands seats around). Token defs are registered in the same Cards registry rules-tokens uses,
 * and ids reuse the tok-<name>-<seat>-<n>-<i> convention so they stay unique and replay-safe.
 *
 *   def.afterlife = N  (e.g. Cards.define("Ministrant of Obligation", { ..., afterlife: 2 }))
 *
 *   afterlifeN(def)              -> N (0 when absent/invalid)
 *   onDeath(game, id, ctx)       -> [token_create × N] or [] (id: the creature that just died)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAfterlife = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var TOKEN_NAME = "Spirit (Afterlife)";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function afterlifeN(def) {
    var n = def && def.afterlife;
    return (typeof n === "number" && n > 0) ? Math.floor(n) : 0;
  }

  // ensure the 1/1 WB flying Spirit token def exists in the shared registry
  function ensureSpiritDef(Cards) {
    if (!Cards || Cards.get(TOKEN_NAME)) return;
    Cards.define(TOKEN_NAME, {
      types: ["creature"], subtypes: ["Spirit"], colors: ["W", "B"],
      abilities: ["flying"], power: 1, toughness: 1, isToken: true
    });
  }

  // The creature died: create its afterlife Spirits. Empty array when the ability doesn't apply.
  function onDeath(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game && game.cards ? game.cards[id] : null;
    if (!c) return [];
    var def = Cards && Cards.get(c.name);
    var n = afterlifeN(def);
    if (!n) return [];
    ensureSpiritDef(Cards);
    var seat = c.ownerSeat != null ? c.ownerSeat : c.controllerSeat;
    var salt = (game.log && game.log.length) || 0, events = [];
    for (var i = 0; i < n; i++) {
      events.push({
        t: "token_create",
        instanceId: "tok-SpiritAfterlife-" + seat + "-" + salt + "-" + i,
        name: TOKEN_NAME, ownerSeat: seat, zone: "battlefield",
        x: 46 + 4 * i, y: 58
      });
    }
    return events;
  }

  return { TOKEN_NAME: TOKEN_NAME, afterlifeN: afterlifeN, ensureSpiritDef: ensureSpiritDef, onDeath: onDeath };
});
