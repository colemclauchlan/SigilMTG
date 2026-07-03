/*
 * rules-search.js — searching your library (CR 701.20 "search" + shuffle). PURE.
 * Browser global (window.MTGRulesSearch) + Node module. The backbone of tutors and ramp ("search your
 * library for a [land/creature/card], put it into your hand/onto the battlefield, then shuffle"). Reads
 * the library against a simple filter and returns replayable events; the human/AI picks which match.
 *
 *   searchLibrary(game, seat, filter, ctx) -> [instanceId…]   filter = { name?, type?, subtype?, supertype? }
 *   tutorEvents(game, seat, cardId, toZone?, opts?) -> [card_move → toZone (default hand), library_shuffle]
 *
 * (Reveal is optional via opts.reveal; "shuffle" follows because searching always shuffles unless told not
 * to. Fetching tapped — for ramp — is opts.tapped → a follow-up card_tap. Hidden-zone reveal rules are the
 * sync layer's job.)
 */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  root.MTGRulesSearch = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function pick(ctx, key, global) { return (ctx && ctx[key]) || root[global]; }

  function matches(def, name, f) {
    if (!f) return true;
    if (f.name && name !== f.name) return false;
    if (!def) return !(f.type || f.subtype || f.supertype);
    if (f.type && def.types.indexOf(f.type) < 0) return false;
    if (f.subtype && (def.subtypes || []).indexOf(f.subtype) < 0) return false;
    if (f.supertype && (def.supertypes || []).indexOf(f.supertype) < 0) return false;
    return true;
  }

  function searchLibrary(game, seat, filter, ctx) {
    var Cards = pick(ctx, "Cards", "MTGCards"), Core = pick(ctx, "Core", "MTGCore"), out = [];
    var lib = Core ? Core.cardsOf(game, seat, "library") : [];
    lib.forEach(function (c) { if (matches(Cards && Cards.get(c.name), c.name, filter)) out.push(c.instanceId); });
    return out;
  }

  function tutorEvents(game, seat, cardId, toZone, opts) {
    opts = opts || {}; var events = [];
    if (opts.reveal) events.push({ t: "reveal", instanceIds: [cardId], to: "all" });
    events.push({ t: "card_move", instanceId: cardId, toZone: toZone || "hand" });
    if (opts.tapped) events.push({ t: "card_tap", instanceId: cardId, tapped: true });
    if (opts.shuffle !== false) events.push({ t: "library_shuffle", seat: seat });
    return events;
  }

  return { searchLibrary: searchLibrary, tutorEvents: tutorEvents };
});
