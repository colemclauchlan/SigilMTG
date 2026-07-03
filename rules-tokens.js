/*
 * rules-tokens.js — token creation. PURE (drives engine-core).
 * Browser global (window.MTGRulesTokens) + Node module. Creates token creatures on the battlefield
 * and registers a card-def for the token's name so the rest of the engine (combat, layers, SBA) treats
 * it like any creature. Token instance ids are derived from the event log position, so they're unique
 * and — because they're written into the log — replay-safe.
 *
 *   spec = { name, power, toughness, subtypes?, colors?, abilities?, count?, x?, y? }
 *   createTokens(E, estate, ownerSeat, spec, ctx) -> estate'
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesTokens = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function ensureDef(Cards, spec) {
    if (!Cards || Cards.get(spec.name)) return;
    Cards.define(spec.name, {
      types: ["creature"], subtypes: spec.subtypes || [], colors: spec.colors || [],
      abilities: spec.abilities || [], power: spec.power != null ? spec.power : 1, toughness: spec.toughness != null ? spec.toughness : 1, isToken: true
    });
  }

  function createTokens(E, estate, ownerSeat, spec, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), s = estate;
    spec = spec || {}; spec.name = spec.name || "Token";
    ensureDef(Cards, spec);
    var count = spec.count || 1;
    for (var i = 0; i < count; i++) {
      var id = "tok-" + spec.name.replace(/[^A-Za-z0-9]+/g, "") + "-" + ownerSeat + "-" + s.log.length + "-" + i;
      s = E.dispatch(s, {
        t: "token_create", instanceId: id, name: spec.name, ownerSeat: ownerSeat,
        zone: "battlefield", x: spec.x != null ? spec.x : 50, y: spec.y != null ? spec.y : 60
      });
    }
    return s;
  }

  return { createTokens: createTokens, ensureDef: ensureDef };
});
