/*
 * rules-storm.js — storm (CR 702.40). PURE.
 * Browser global (window.MTGRulesStorm) + Node module. "When you cast this spell, copy it for each
 * other spell cast before it this turn." The storm trigger puts N copies on the stack, where N is the
 * number of OTHER spells already cast this turn (the storm spell itself does not count). Each copy is a
 * distinct stack object (its own id) that is otherwise a copy of the original. Nothing is mutated.
 *
 *   stormCount(spellsCastThisTurnBeforeThis) -> N  (count of spells cast before the storm spell)
 *   makeCopies(spellObj, n)                  -> [ n copy stack-objects ] with distinct ids, isCopy:true
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesStorm = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

  // storm count = number of other spells cast before this one this turn.
  // accepts either a count (number) or an array of prior spells (its length is used).
  function stormCount(spellsCastThisTurnBeforeThis) {
    var v = spellsCastThisTurnBeforeThis;
    if (typeof v === "number") return Math.max(0, v | 0);
    if (v && typeof v.length === "number") return v.length;
    return 0;
  }

  // build n distinct copies of the spell stack-object; each gets a unique id + isCopy flag
  function makeCopies(spellObj, n) {
    var out = [], base = spellObj || {};
    var baseId = base.id != null ? base.id : "spell";
    var count = Math.max(0, n | 0);
    for (var i = 0; i < count; i++) {
      var c = clone(base);
      c.id = baseId + "#storm-copy-" + (i + 1);
      c.isCopy = true;
      c.copyOf = base.id != null ? base.id : null;
      out.push(c);
    }
    return out;
  }

  return { stormCount: stormCount, makeCopies: makeCopies };
});
