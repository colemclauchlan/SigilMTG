/*
 * rules-adventure.js — Adventure (CR 715). PURE.
 * Browser global (window.MTGRulesAdventure) + Node module. An Adventure card is a creature card with a
 * second, alternative "adventure" characteristic (an instant or sorcery). You may cast EITHER half from
 * your hand. If you cast the adventure half, then as it resolves it goes to EXILE "on an adventure"
 * instead of the graveyard; while it's exiled that way, you may cast the creature half from exile.
 *
 *   def.adventure = { name:"Petty Theft", types:["instant"], mana:{generic:1,U:1}, spell:{...} }
 *   // the creature half uses the card's own def.mana / def.types / def.pt
 *
 *   adventureDef(def)                                 -> the adventure half object, or null
 *   canCastAdventure(game, cardId, seat, ctx)         -> { ok, reason }   (in hand, yours, can pay adv cost)
 *   castAdventureEvents(game, cardId, ctx)            -> [pay…, hand→stack, __set castingAdventure]
 *   resolveAdventureEvents(game, cardId)             -> [stack→exile, __set onAdventure]  (NOT graveyard)
 *   isOnAdventure(game, cardId)                        -> bool
 *   canCastFromAdventure(game, cardId, seat, ctx)     -> { ok, reason }   (exiled on adventure, can pay creature cost)
 *   castFromAdventureEvents(game, cardId, ctx)        -> [pay…, exile→stack, __set onAdventure:false]
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesAdventure = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function owner(c) { return c.ownerSeat != null ? c.ownerSeat : c.controllerSeat; }

  function adventureDef(def) { return (def && def.adventure) || null; }

  // pay a mana cost out of a seat's floating pool (same shape plot/foretell use)
  function payEvents(game, seat, cost, ctx) {
    var Mana = pick(ctx, "Mana", "MTGRulesMana"), events = [];
    if (!cost || !Mana) return events;
    var pool = Mana.poolFromCounters(game.players[seat].counters), rem = Mana.pay(cost, pool) || pool, colors = {};
    Object.keys(pool).forEach(function (k) { colors[k] = true; }); Object.keys(rem).forEach(function (k) { colors[k] = true; });
    Object.keys(colors).forEach(function (k) { var d = (rem[k] || 0) - (pool[k] || 0); if (d) events.push({ t: "player_counter", seat: seat, kind: "mana_" + k, delta: d }); });
    return events;
  }

  // may this seat cast the ADVENTURE (instant/sorcery) half from hand?
  function canCastAdventure(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!c || c.zone !== "hand") return { ok: false, reason: "you cast the adventure from your hand" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var adv = adventureDef(Cards && Cards.get(c.name));
    if (!adv) return { ok: false, reason: "no adventure" };
    if (Mana && adv.mana && !Mana.canPay(adv.mana, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the adventure cost" };
    return { ok: true };
  }

  // cast the adventure half: pay its cost, move hand → stack, flag it so resolution exiles it
  function castAdventureEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c) return [];
    var adv = adventureDef(Cards && Cards.get(c.name)); if (!adv) return [];
    var events = payEvents(game, owner(c), adv.mana, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { castingAdventure: true } }] });
    return events;
  }

  // resolve the adventure spell: it goes on an adventure in EXILE instead of to the graveyard
  function resolveAdventureEvents(game, cardId) {
    var c = game.cards[cardId];
    if (!c || !c.castingAdventure) return [];
    return [
      { t: "card_move", instanceId: cardId, toZone: "exile" },
      { t: "__set", cards: [{ id: cardId, fields: { onAdventure: true, castingAdventure: false } }] }
    ];
  }

  function isOnAdventure(game, cardId) {
    var c = game.cards[cardId];
    return !!(c && c.onAdventure && c.zone === "exile");
  }

  // may this seat cast the CREATURE half from exile while it's on an adventure?
  function canCastFromAdventure(game, cardId, seat, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Mana = pick(ctx, "Mana", "MTGRulesMana");
    var c = game.cards[cardId];
    if (!isOnAdventure(game, cardId)) return { ok: false, reason: "card is not on an adventure in exile" };
    if (owner(c) !== seat) return { ok: false, reason: "not your card" };
    var def = Cards && Cards.get(c.name);
    if (Mana && def && def.mana && !Mana.canPay(def.mana, Mana.poolFromCounters(game.players[seat].counters))) return { ok: false, reason: "cannot pay the creature cost" };
    return { ok: true };
  }

  // cast the creature half from exile: pay its own mana cost, move exile → stack, clear the adventure flag
  function castFromAdventureEvents(game, cardId, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards");
    var c = game.cards[cardId]; if (!c || !c.onAdventure) return [];
    var def = Cards && Cards.get(c.name);
    var events = payEvents(game, owner(c), def && def.mana, ctx);
    events.push({ t: "card_move", instanceId: cardId, toZone: "stack" });
    events.push({ t: "__set", cards: [{ id: cardId, fields: { onAdventure: false } }] });
    return events;
  }

  return {
    adventureDef: adventureDef,
    canCastAdventure: canCastAdventure,
    castAdventureEvents: castAdventureEvents,
    resolveAdventureEvents: resolveAdventureEvents,
    isOnAdventure: isOnAdventure,
    canCastFromAdventure: canCastFromAdventure,
    castFromAdventureEvents: castFromAdventureEvents
  };
});
