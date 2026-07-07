/*
 * rules-trigger-scan.js — oracle-text triggered-ability scanner. PURE.
 * Browser global (window.MTGRulesTriggerScan) + Node module. Unlike rules-triggers.js (which fires
 * triggers DEFINED on engine card defs), this module finds triggered abilities in printed ORACLE
 * TEXT, so the live board can surface "this just triggered" reminders for real Scryfall-backed
 * cards without any per-card definitions. Advisory by design: it never mutates state and never
 * resolves effects — the caller decides what to do with the reminders (Sigil shows a dismissible
 * tray). Heuristics fail OPEN on missing data (better an extra reminder than a missed one).
 *
 * API:
 *   scan(oracleText, cardName) -> [ { on, scope, typeFilter, yourControl, text } ]
 *     on:    "etb" | "dies" | "attacks" | "blocks" | "upkeep" | "end_step" | "combat_begin" |
 *            "combat_damage" | "cast" | "lifegain" | "draw" | "other"
 *     scope: "self"  — the source card's own event (or its controller's turn step)
 *            "other" — another permanent's event (or an opponent's turn step)
 *            "any"   — any matching event ("~ or another creature", "each upkeep")
 *     typeFilter:  "creature"|"land"|"artifact"|"enchantment"|"planeswalker"|null — the event card
 *                  must be this type (null = no constraint / ambiguous "artifact or creature").
 *     yourControl: true — the event card must share the watcher's controller.
 *     text: the trimmed trigger sentence (reminder text stripped, capped at 140 chars).
 *
 *   remindersFor(ev, game, getMeta) -> [ { instanceId, name, text } ]
 *     ev:   { kind:"etb"|"dies"|"attacks"|"blocks", instanceId }  (card events)
 *           { kind:"upkeep"|"end_step", seat }                    (turn-step events)
 *     game: table-core-shaped state ({ cards: { id: { name, zone, controllerSeat, ownerSeat } } })
 *     getMeta(card) -> { oracle, type, name }  (Scryfall-ish printed info for a board card)
 *     Sources: the event card's own matching triggers + every other battlefield card watching for
 *     that event (aristocrats, Soul Warden, landfall...), honoring typeFilter / yourControl.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  if (root) root.MTGRulesTriggerScan = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TYPES = ["creature", "land", "artifact", "enchantment", "planeswalker"];

  function stripReminder(text) { return String(text || "").replace(/\([^)]*\)/g, ""); }

  // One trigger object; text capped for UI use.
  function mk(on, scope, typeFilter, yourControl, line) {
    var t = line.length > 140 ? line.slice(0, 137) + "…" : line;
    return { on: on, scope: scope, typeFilter: typeFilter || null, yourControl: !!yourControl, text: t };
  }

  // Scan printed oracle text for triggered-ability sentences ("When/Whenever/At ...").
  function scan(oracle, cardName) {
    var out = [];
    var lines = stripReminder(oracle).split(/\n+/);
    var full = cardName ? String(cardName).trim() : "";
    var short = full ? full.split(",")[0].trim() : "";
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line) continue;
      // strip ability-word prefixes ("Landfall — Whenever...", "Raid — At the beginning...")
      line = line.replace(/^[^.—\n]{2,30}—\s*(?=(when|whenever|at)\b)/i, "");
      if (!/^(when|whenever|at)\b/i.test(line)) continue;
      var low = line.toLowerCase();
      if (full) low = low.split(full.toLowerCase()).join("~");   // full name first ("Krenko, Mob Boss")
      if (short && short !== full) low = low.split(short.toLowerCase()).join("~"); // then short ("Krenko")
      // classification uses the trigger clause (up to the first comma)
      var ci = low.indexOf(",");
      var head = ci > 0 ? low.slice(0, ci) : low;
      var headT = head.replace(/non[a-z]+ /g, ""); // "noncreature spell" must not read as "creature"
      var isSelf = /^when(ever)?\s+(~|this\s+[a-z]+|it\s)/.test(head);
      var isOther = /\banother\b/.test(head);
      var scope = isSelf ? (isOther ? "any" : "self") : (isOther ? "other" : "any");
      var yourCtl = /under your control|you control/.test(head);
      var types = TYPES.filter(function (ty) { return headT.indexOf(ty) >= 0; });
      var typeFilter = types.length === 1 ? types[0] : null;

      // "At the beginning of ..." turn-step triggers
      if (/^at the beginning of/.test(head)) {
        var stepScope = /\byour\b/.test(head) ? "self" : (/opponent/.test(head) ? "other" : "any");
        var on = /upkeep/.test(head) ? "upkeep"
          : /end step/.test(head) ? "end_step"
          : /combat/.test(head) ? "combat_begin" : "other";
        out.push(mk(on, stepScope, null, false, line));
        continue;
      }
      // card-event triggers — a single sentence can watch several events ("enters or attacks")
      var kinds = [];
      if (/\benters\b/.test(head)) kinds.push("etb");
      if (/\bdies\b/.test(head) || /put into (a|their owners?'?) graveyards? from the battlefield/.test(head)) kinds.push("dies");
      if (/\battacks?\b/.test(head)) kinds.push("attacks");
      if (/\bblocks?\b/.test(head) || /becomes? blocked/.test(head)) kinds.push("blocks");
      if (kinds.length) {
        for (var ki = 0; ki < kinds.length; ki++) out.push(mk(kinds[ki], scope, typeFilter, yourCtl, line));
        continue;
      }
      if (/deals combat damage/.test(head)) { out.push(mk("combat_damage", isSelf ? "self" : "any", null, false, line)); continue; }
      if (/\bcasts?\b/.test(head)) { out.push(mk("cast", /you cast/.test(head) ? "self" : "any", null, false, line)); continue; }
      if (/you gain life|gains? life/.test(head)) { out.push(mk("lifegain", /you gain/.test(head) ? "self" : "any", null, false, line)); continue; }
      if (/you draw|draws? a card/.test(head)) { out.push(mk("draw", /you draw/.test(head) ? "self" : "any", null, false, line)); continue; }
      out.push(mk("other", scope, typeFilter, yourCtl, line));
    }
    return out;
  }

  function ctrlOf(c) { return c.controllerSeat != null ? c.controllerSeat : c.ownerSeat; }
  // Does the event card satisfy a watcher's type constraint? Unknown type -> fail open (advisory).
  function typeOk(filter, meta) {
    if (!filter) return true;
    var ty = String((meta && meta.type) || "");
    if (!ty) return true;
    return ty.toLowerCase().indexOf(filter) >= 0;
  }

  // All reminders a single event should surface. See header for the ev shapes.
  function remindersFor(ev, game, getMeta) {
    var out = [], seen = {};
    if (!ev || !game || !game.cards) return out;
    if (typeof getMeta !== "function") getMeta = function () { return {}; };
    function add(id, name, text) {
      var k = id + "|" + text;
      if (seen[k]) return; seen[k] = 1;
      out.push({ instanceId: id, name: name, text: text });
    }
    // turn-step reminders: every battlefield card with a matching upkeep / end-step trigger
    if (ev.kind === "upkeep" || ev.kind === "end_step") {
      for (var sid in game.cards) {
        var sc = game.cards[sid];
        if (!sc || sc.zone !== "battlefield") continue;
        var sMeta = getMeta(sc) || {};
        var sTrgs = scan(sMeta.oracle, sMeta.name || sc.name);
        for (var si = 0; si < sTrgs.length; si++) {
          var st = sTrgs[si];
          if (st.on !== ev.kind) continue;
          var ctl = ctrlOf(sc);
          if (st.scope === "self" && ctl !== ev.seat) continue;
          if (st.scope === "other" && ctl === ev.seat) continue;
          add(sid, sMeta.name || sc.name || "Card", st.text);
        }
      }
      return out;
    }
    // card-event reminders (etb / dies / attacks / blocks)
    var src = game.cards[ev.instanceId];
    if (!src) return out;
    var srcMeta = getMeta(src) || {};
    var srcCtl = ctrlOf(src);
    // 1) the event card's own triggers
    var own = scan(srcMeta.oracle, srcMeta.name || src.name);
    for (var oi = 0; oi < own.length; oi++) {
      var ot = own[oi];
      if (ot.on !== ev.kind || ot.scope === "other") continue;
      if (!typeOk(ot.typeFilter, srcMeta)) continue;
      add(ev.instanceId, srcMeta.name || src.name || "Card", ot.text);
    }
    // 2) watchers elsewhere on the battlefield (aristocrats, Soul Warden, landfall...)
    // For PLAYER-scoped event kinds ("you cast/gain/draw" — prowess, Soul Warden...), a watcher's
    // "self" scope means ITS CONTROLLER did the thing, not the event card itself: allow those
    // through when the watcher shares the event's controller.
    var CTRL_SCOPED = { cast: 1, lifegain: 1, draw: 1 };
    for (var wid in game.cards) {
      if (wid === ev.instanceId) continue;
      var w = game.cards[wid];
      if (!w || w.zone !== "battlefield") continue;
      var wMeta = getMeta(w) || {};
      var wTrgs = scan(wMeta.oracle, wMeta.name || w.name);
      for (var wi = 0; wi < wTrgs.length; wi++) {
        var wt = wTrgs[wi];
        if (wt.on !== ev.kind) continue;
        if (wt.scope === "self") {
          if (!CTRL_SCOPED[ev.kind]) continue;
          if (ctrlOf(w) !== srcCtl) continue;
        }
        if (!typeOk(wt.typeFilter, srcMeta)) continue;
        if (wt.yourControl && ctrlOf(w) !== srcCtl) continue;
        add(wid, wMeta.name || w.name || "Card", wt.text);
      }
    }
    return out;
  }

  return { scan: scan, remindersFor: remindersFor, stripReminder: stripReminder };
});
