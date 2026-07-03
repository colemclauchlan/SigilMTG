/*
 * rules-encore.js — encore (CR 702.141). PURE (drives engine-core).
 * Browser global (window.MTGRulesEncore) + Node module. "[cost], Exile this card from your graveyard:
 * For each opponent, create a token copy that attacks that opponent this turn if able. They gain haste.
 * Sacrifice them at the beginning of the next end step." Composes the mana + zone + token systems like
 * rules-embalm: pay, exile the graveyard card, then one token copy PER LIVING OPPONENT — each created
 * attacking (card_combat) and marked `encoreToken` so endOfTurnEvents can sacrifice them. The copy's
 * printed characteristics are baked into a registered token card-def (rules-tokens.ensureDef registry),
 * and ids reuse the tok-<name>-<seat>-<loglen>-<i> convention so replay stays deterministic.
 *
 *   def.encore = { generic: 5, B: 1 }  (a mana cost, same shape as def.mana)
 *
 *   encoreCost(def)              -> the cost, or null
 *   canEncore(game, id, ctx)     -> { ok, reason }   (graveyard + cost + owner's mana pool)
 *   tokenSpec(game, id, ctx)     -> the copy's characteristics (printed P/T, colors, abilities)
 *   encore(game, id, ctx)        -> [pay…, exile, (token_create+card_combat+mark)×opponents]
 *   endOfTurnEvents(game, ctx)   -> [card_move→graveyard…] for every encore token
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesEncore = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function encoreCost(def) { return (def && def.encore) || null; }

  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  function canEncore(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[id]; if (!c) return { ok: false, reason: "no such card" };
    if (c.zone !== "graveyard") return { ok: false, reason: "encore only works from the graveyard" };
    var cost = encoreCost(Cards && Cards.get(c.name));
    if (!cost) return { ok: false, reason: "no encore cost" };
    var seat = c.ownerSeat != null ? c.ownerSeat : c.controllerSeat;
    if (Mana && !Mana.canPay(cost, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the encore cost" };
    return { ok: true, seat: seat, cost: cost };
  }

  // the token copy keeps the printed characteristics (encore copies exactly; it just adds haste + the sac)
  function tokenSpec(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[id], base = (Cards && Cards.get(c && c.name)) || {};
    return {
      name: (c && c.name) || "Token",
      tokenName: ((c && c.name) || "Token") + " (Encore)",
      power: base.power != null ? base.power : 1,
      toughness: base.toughness != null ? base.toughness : 1,
      subtypes: (base.subtypes || []).slice(),
      colors: (base.colors || []).slice(),
      abilities: (base.abilities || []).slice()
    };
  }

  // living opponents of `seat`, in seat order (dead seats get no token — their "attack" is impossible)
  function opponentsOf(game, seat) {
    return (game.players || []).filter(function (p) { return p.seat !== seat && (p.life == null || p.life > 0); }).map(function (p) { return p.seat; });
  }

  function encore(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var chk = canEncore(game, id, ctx); if (!chk.ok) return [];
    var seat = chk.seat, spec = tokenSpec(game, id, ctx);
    if (Cards && !Cards.get(spec.tokenName)) {
      Cards.define(spec.tokenName, {
        types: ["creature"], subtypes: spec.subtypes, colors: spec.colors, abilities: spec.abilities,
        power: spec.power, toughness: spec.toughness, isToken: true
      });
    }
    var events = payEvents(game, seat, chk.cost, ctx);
    events.push({ t: "card_move", instanceId: id, toZone: "exile" }); // exiling the card is the cost
    var stem = "tok-" + spec.tokenName.replace(/[^A-Za-z0-9]+/g, "") + "-" + seat + "-" + ((game.log && game.log.length) || 0) + "-";
    opponentsOf(game, seat).forEach(function (oppSeat, i) {
      var tid = stem + i;
      events.push({ t: "token_create", instanceId: tid, name: spec.tokenName, ownerSeat: seat, zone: "battlefield", x: 40 + i * 8, y: 55 });
      events.push({ t: "card_combat", instanceId: tid, attacking: true }); // attacks that opponent this turn if able
      events.push({ t: "__set", cards: [{ id: tid, fields: { encoreToken: true, encoreTarget: oppSeat } }] });
    });
    return events;
  }

  // beginning of the end step: sacrifice every encore token still on the battlefield
  function endOfTurnEvents(game, ctx) {
    var events = [];
    Object.keys(game.cards).sort().forEach(function (id) {
      var c = game.cards[id];
      if (c && c.encoreToken && c.zone === "battlefield") events.push({ t: "card_move", instanceId: id, toZone: "graveyard" });
    });
    return events;
  }

  return { encoreCost: encoreCost, canEncore: canEncore, tokenSpec: tokenSpec, opponentsOf: opponentsOf, encore: encore, endOfTurnEvents: endOfTurnEvents };
});
