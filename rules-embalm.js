/*
 * rules-embalm.js — embalm (CR 702.88) & eternalize (CR 702.89). PURE (drives engine-core).
 * Browser global (window.MTGRulesEmbalm) + Node module. Both are activated abilities you use from your
 * graveyard: "[cost], Exile this card from your graveyard: Create a token that's a copy of it…".
 *   - embalm:      the token is WHITE, otherwise the printed stats/abilities (and it's not legendary).
 *   - eternalize:  the token is a BLACK 4/4, keeping the name + abilities (and it's not legendary).
 * Composes the mana + zone + token systems: pay the cost, exile the graveyard card, and create the token
 * copy. The copy's stats/colors are baked into a registered token card-def (the same Cards.define registry
 * rules-tokens.ensureDef uses — the reducer reads a token's characteristics from its card-def), and the
 * token id reuses the tok-<name>-<seat>-<loglen>-0 convention from rules-tokens.js so it stays replay-safe.
 *
 *   def.embalm = { generic:3, W:2 }  /  def.eternalize = { generic:5, B:2 }
 *
 *   embalmCost(def) / eternalizeCost(def)  -> the cost, or null
 *   tokenSpec(game, cardId, kind, ctx)     -> { name, power, toughness, colors, abilities, subtypes } for the copy
 *   embalm(game, cardId, ctx)              -> [pay, exile card, token_create (white copy)]
 *   eternalize(game, cardId, ctx)          -> [pay, exile card, token_create (black 4/4 copy)]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesEmbalm = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function embalmCost(def) { return (def && def.embalm) || null; }
  function eternalizeCost(def) { return (def && def.eternalize) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  // the token copy: embalm keeps the printed P/T but is white; eternalize is a black 4/4. Both keep name+abilities.
  function tokenSpec(game, cardId, kind, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId], base = (Cards && Cards.get(c && c.name)) || {};
    var eternal = kind === "eternalize";
    return {
      name: (c && c.name) || "Token",
      tokenName: ((c && c.name) || "Token") + (eternal ? " (Eternal)" : " (Embalmed)"),
      power: eternal ? 4 : (base.power != null ? base.power : 1),
      toughness: eternal ? 4 : (base.toughness != null ? base.toughness : 1),
      subtypes: (base.subtypes || []).slice(),
      colors: eternal ? ["B"] : ["W"],
      abilities: (base.abilities || []).slice()
    };
  }

  function make(game, cardId, kind, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId];
    if (!c || c.zone !== "graveyard") return [];
    var base = Cards && Cards.get(c.name);
    var cost = kind === "eternalize" ? eternalizeCost(base) : embalmCost(base);
    if (!cost) return [];
    var seat = c.ownerSeat, spec = tokenSpec(game, cardId, kind, ctx);
    // bake the copy's characteristics into a registered token def (same registry rules-tokens.ensureDef uses)
    if (Cards && !Cards.get(spec.tokenName)) {
      Cards.define(spec.tokenName, {
        types: ["creature"], subtypes: spec.subtypes, colors: spec.colors, abilities: spec.abilities,
        power: spec.power, toughness: spec.toughness, isToken: true
      });
    }
    var events = payEvents(game, seat, cost, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "exile" });   // exile the graveyard card (the cost)
    var id = "tok-" + spec.tokenName.replace(/[^A-Za-z0-9]+/g, "") + "-" + seat + "-" + ((game.log && game.log.length) || 0) + "-0";
    events.push({ t: "token_create", instanceId: id, name: spec.tokenName, ownerSeat: seat, zone: "battlefield", embalmKind: kind, x: 50, y: 60 });
    return events;
  }

  function embalm(game, cardId, ctx) { return make(game, cardId, "embalm", ctx); }
  function eternalize(game, cardId, ctx) { return make(game, cardId, "eternalize", ctx); }

  return { embalmCost: embalmCost, eternalizeCost: eternalizeCost, tokenSpec: tokenSpec, embalm: embalm, eternalize: eternalize };
});
