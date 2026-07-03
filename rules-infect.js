/*
 * rules-infect.js — infect (CR 702.90) & wither (CR 702.80). PURE.
 * Browser global (window.MTGRulesInfect) + Node module. Changes how a source's damage is DEALT, as
 * replayable events (so it composes with combat application and table-core):
 *   - infect: damage to a creature = that many −1/−1 counters; damage to a player = that many poison
 *   - wither: damage to a creature = that many −1/−1 counters; to a player it's normal life loss
 *   - normal: marked damage on a creature; life loss to a player
 * Works over EFFECTIVE abilities (rules-keywords, so GRANTED infect/wither counts). The −1/−1 counters
 * flow straight into effective P/T through the layer system (rules-layers 7c); poison feeds rules-sba.
 *
 *   damageEvents(game, dealerId, target, amount, ctx) -> [events]   target = {kind:"player",seat} | {kind:"creature",instanceId}
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesInfect = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function abilitiesOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), KW = pick(ctx, "Keywords", "MTGRulesKeywords"), At = pick(ctx, "Attach", "MTGRulesAttach");
    var c = game.cards[id]; if (!c) return [];
    if (At && At.effectiveAttached) { var ea = At.effectiveAttached(game, id, ctx); if (ea) return ea.abilities || []; }  // equipment/aura-granted keywords count
    if (KW && KW.effectiveFull) { var e = KW.effectiveFull(game, id, ctx); return (e && e.abilities) || []; }
    var def = Cards && Cards.get(c.name); return (def && def.abilities) || [];
  }
  function damageKind(ab) { return ab.indexOf("infect") >= 0 ? "infect" : (ab.indexOf("wither") >= 0 ? "wither" : "normal"); }

  function damageEvents(game, dealerId, target, amount, ctx) {
    if (!target || !(amount > 0)) return [];
    var kind = damageKind(abilitiesOf(game, dealerId, ctx));
    if (target.kind === "player") {
      if (kind === "infect") return [{ t: "player_counter", seat: target.seat, kind: "poison", delta: amount }];
      return [{ t: "adjust_life", seat: target.seat, delta: -amount }];
    }
    // creature
    if (kind === "infect" || kind === "wither") return [{ t: "card_counter", instanceId: target.instanceId, kind: "-1/-1", delta: amount }];
    return [{ t: "card_counter", instanceId: target.instanceId, kind: "damage", delta: amount }];
  }

  return { damageKind: function (game, id, ctx) { return damageKind(abilitiesOf(game, id, ctx)); }, damageEvents: damageEvents };
});
