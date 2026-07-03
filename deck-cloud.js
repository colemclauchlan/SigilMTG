/*
 * deck-cloud.js — PROMPT 0.5b: cloud deck persistence. Self-contained; hooks the deck builder's
 * "mtg-deck-library-updated" event and auth changes instead of editing deck-builder.js. When signed in,
 * pushes localStorage decks to Supabase (saved_decks + deck_cards) and pulls cloud decks back into
 * localStorage (so the builder + the table's deck picker see them). localStorage stays the offline fallback.
 */
(function () {
  "use strict";
  var KEY = "magic-table-tracker-decks-v1";
  function sync() { return window.mtgSync; }
  function signedIn() { var s = sync(); return !!(s && s.enabled && s.session); }
  function readLocal() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function writeLocal(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function isUuid(v) { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v); }
  function secOk(x) { return ["commander", "mainboard", "sideboard", "maybeboard"].indexOf(x) >= 0 ? x : "mainboard"; }

  async function pushLocalDecks() {
    if (!signedIn()) return;
    var s = sync(), uid = s.session.user.id, data = readLocal(), decks = Array.isArray(data.decks) ? data.decks : [];
    for (var i = 0; i < decks.length; i++) {
      var d = decks[i]; if (!d || !d.id) continue;
      try {
        var up = await s.client.from("saved_decks").upsert({
          owner_id: uid, name: d.name || "Untitled", format: d.format || "commander",
          commander_name: d.commanderName || null, commander_scryfall_id: isUuid(d.commanderScryfallId) ? d.commanderScryfallId : null,
          source_deck_id: String(d.id), notes: d.notes || "", version: d.version || 1
        }, { onConflict: "owner_id,source_deck_id" }).select().single();
        if (up.error || !up.data) continue;
        var deckId = up.data.id;
        await s.client.from("deck_cards").delete().eq("deck_id", deckId);
        var seen = {}, rows = [];
        (d.cards || []).forEach(function (e) {
          var card = e.card || {}; var nm = card.name || e.name; if (!nm) return;
          var sec = secOk(e.section); var k = sec + "|" + nm; if (seen[k]) return; seen[k] = 1;
          rows.push({ deck_id: deckId, scryfall_id: null, section: sec, quantity: e.quantity || 1, card_name: nm, card_snapshot: card || {} });
        });
        if (rows.length) await s.client.from("deck_cards").insert(rows);
      } catch (e) {}
    }
  }

  async function pullCloudDecks() {
    if (!signedIn()) return;
    var s = sync();
    try {
      var dres = await s.client.from("saved_decks").select("*").order("updated_at", { ascending: false });
      if (dres.error || !dres.data) return;
      var local = readLocal(); var byKey = {};
      (Array.isArray(local.decks) ? local.decks : []).forEach(function (d) { var key = d.source_deck_id || d.id; if (key) byKey[key] = d; });
      for (var i = 0; i < dres.data.length; i++) {
        var sd = dres.data[i];
        var cres = await s.client.from("deck_cards").select("*").eq("deck_id", sd.id);
        var cards = (cres.data || []).map(function (r) { return { section: r.section, quantity: r.quantity, card: (r.card_snapshot && r.card_snapshot.name) ? r.card_snapshot : { name: r.card_name } }; });
        var key = sd.source_deck_id || sd.id;
        byKey[key] = { id: key, name: sd.name, format: sd.format, commanderName: sd.commander_name, commanderScryfallId: sd.commander_scryfall_id, notes: sd.notes, version: sd.version, source_deck_id: key, cards: cards, updatedAt: sd.updated_at };
      }
      local.decks = Object.keys(byKey).map(function (k) { return byKey[k]; });
      writeLocal(local);
      window.dispatchEvent(new CustomEvent("mtg-cloud-decks-synced"));
    } catch (e) {}
  }

  var pushTimer = null;
  window.addEventListener("mtg-deck-library-updated", function () { if (!signedIn()) return; clearTimeout(pushTimer); pushTimer = setTimeout(pushLocalDecks, 800); });
  window.addEventListener("mtg-auth-changed", function (e) { var sess = e.detail && e.detail.session; if (sess) { pushLocalDecks().then(pullCloudDecks); } });
  setTimeout(function () { if (signedIn()) pullCloudDecks(); }, 1500);
  window.MTGDeckCloud = { push: pushLocalDecks, pull: pullCloudDecks };
})();
