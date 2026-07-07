/*
 * rules-exert.js — exert (CR 701.39). PURE (drives engine-core/table-core events).
 * "You may exert this creature as it attacks: it won't untap during your next untap step."
 * Card def: Cards.define("Name", { exert: true, ... }).
 * exertEvents() flags the attacker; untapAllRespectingExert() replaces a bare untap_all with a
 * sequence that keeps exerted cards tapped and clears their exert flags, so exactly one untap
 * step is skipped. Everything rides the synced untap_all / card_tap / __set primitives.
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesExert = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }
  function defOf(game, id, ctx) { var Cards = pick(ctx, "Cards", "MTGCards"); var c = game.cards[id]; return (c && Cards) ? Cards.get(c.name != null ? c.name : c.cardId) : null; }
  function ctrlOf(c) { return c.controllerSeat != null ? c.controllerSeat : c.ownerSeat; }

  function isExerted(game, id) { var c = game.cards[id]; return !!(c && c.exerted); }

  // May `seat` exert this creature? (battlefield + yours + def has exert + not already exerted)
  function canExert(game, id, seat, ctx) {
    var c = game.cards[id];
    if (!c) return { ok: false, reason: "no such card" };
    if (c.zone !== "battlefield") return { ok: false, reason: "not on the battlefield" };
    if (seat != null && ctrlOf(c) !== seat) return { ok: false, reason: "not your creature" };
    var d = defOf(game, id, ctx);
    if (!d || !d.exert) return { ok: false, reason: "no exert" };
    if (c.exerted) return { ok: false, reason: "already exerted" };
    return { ok: true };
  }

  // Exert as it attacks: just the flag — the card's own exert bonus is its own ability/trigger.
  function exertEvents(game, id, seat, ctx) {
    var chk = canExert(game, id, seat, ctx);
    if (!chk.ok) return [];
    return [{ t: "__set", cards: [{ id: id, fields: { exerted: true } }] }];
  }

  // Untap-step replacement: untap everything, re-tap what stayed exerted, clear the flags.
  function untapAllRespectingExert(game, seat, ctx) {
    var out = [{ t: "untap_all", seat: seat }], clear = [];
    for (var id in game.cards) {
      var c = game.cards[id];
      if (!c || c.zone !== "battlefield" || !c.exerted || ctrlOf(c) !== seat) continue;
      if (c.tapped) out.push({ t: "card_tap", instanceId: id, tapped: true });
      clear.push({ id: id, fields: { exerted: false } });
    }
    if (clear.length) out.push({ t: "__set", cards: clear });
    return out;
  }

  return { isExerted: isExerted, canExert: canExert, exertEvents: exertEvents, untapAllRespectingExert: untapAllRespectingExert };
});
