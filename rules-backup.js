/*
 * rules-backup.js — backup N (CR 702.164). PURE.
 * Browser global (window.MTGRulesBackup) + Node module. "When this creature enters the battlefield, put N
 * +1/+1 counters on target creature. If that's another creature, it gains this creature's other listed
 * abilities until end of turn." On ETB the controller picks a target creature: it gets N +1/+1 counters,
 * and — if the target is a DIFFERENT creature — it temporarily gains the backup source's keyword abilities
 * (its `def.backupGrants`, e.g. ["flying","lifelink"]). This module is a pure decision layer producing the
 * counter + granted-keyword events; the grant is a `grantedUntilEOT` marker the layers/keywords system reads.
 *
 *   def.backup = 1;  def.backupGrants = ["flying"];  def.abilities = [..., "backup"]
 *
 *   backupN(game, id, ctx)                        -> N, or 0
 *   backupEvents(game, sourceId, targetId, ctx)   -> [card_counter N] (+ __set grantedUntilEOT when target != source)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesBackup = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function defOf(game, id, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), c = game.cards[id];
    return (c && Cards && Cards.get(c.name)) || null;
  }

  function backupN(game, id, ctx) {
    var def = defOf(game, id, ctx);
    if (!def) return 0;
    if (def.backup != null) { var n = def.backup | 0; return n > 0 ? n : 0; }
    return (def.abilities || []).indexOf("backup") >= 0 ? 1 : 0;
  }

  function hasBackup(game, id, ctx) { return backupN(game, id, ctx) > 0; }

  // the keyword abilities backup grants to a DIFFERENT creature (the source's "other abilities")
  function grantsOf(game, id, ctx) {
    var def = defOf(game, id, ctx);
    return (def && def.backupGrants) || [];
  }

  function isCreature(game, id, ctx) {
    var def = defOf(game, id, ctx);
    return !!(def && (def.types || []).indexOf("creature") >= 0);
  }

  // ETB backup onto a target creature: N counters, and (if it's not the source itself) grant the
  // source's abilities until end of turn via a grantedUntilEOT marker on the target.
  function backupEvents(game, sourceId, targetId, ctx) {
    var src = game.cards[sourceId]; if (!src) return [];
    var n = backupN(game, sourceId, ctx); if (n <= 0) return [];
    if (!game.cards[targetId] || !isCreature(game, targetId, ctx)) return [];
    var events = [{ t: "card_counter", instanceId: targetId, kind: "+1/+1", delta: n }];
    if (targetId !== sourceId) {
      var grants = grantsOf(game, sourceId, ctx);
      if (grants && grants.length) {
        events.push({ t: "__set", cards: [{ id: targetId, fields: { grantedUntilEOT: grants.slice() } }] });
      }
    }
    return events;
  }

  return { backupN: backupN, hasBackup: hasBackup, grantsOf: grantsOf, backupEvents: backupEvents };
});
