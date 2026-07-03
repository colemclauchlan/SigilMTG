/* precons.js — Commander precon browser + one-click import + paste-a-decklist import.
   v2: FULL WotC precon catalog via MTGJSON (https://mtgjson.com/api/v5) — every Commander
   precon WotC has released — with the small bundled precons-data.js set as an offline
   fallback. Classic script; loads after precons-data.js (window.MTGPrecons) and
   deck-builder.js (reuses hydrateMoxfieldCardsWithScryfall / applyMoxfieldDeckToBuilder /
   setDeckStatus / deckFetchJsonWithRelay). */
(function () {
  "use strict";

  var MTGJSON_BASE = "https://mtgjson.com/api/v5";
  var LS_CATALOG = "mtg-precons-catalog-v1";   // pruned DeckList + set names
  var CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000; // refresh weekly

  function bundled() { return Array.isArray(window.MTGPrecons) ? window.MTGPrecons : []; }

  function fetchJson(url) {
    if (typeof deckFetchJsonWithRelay === "function") return deckFetchJsonWithRelay(url);
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  // ---------- MTGJSON catalog ----------
  var catalogCache = null; // { at, decks:[{id,name,set,setName,year,fileName,source}] }

  function readCatalogLS() {
    try {
      var raw = localStorage.getItem(LS_CATALOG); if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.decks) || (Date.now() - (obj.at || 0)) > CATALOG_TTL_MS) return null;
      return obj;
    } catch (e) { return null; }
  }

  function writeCatalogLS(obj) { try { localStorage.setItem(LS_CATALOG, JSON.stringify(obj)); } catch (e) {} }

  function loadCatalog() {
    if (catalogCache) return Promise.resolve(catalogCache);
    var ls = readCatalogLS();
    if (ls) { catalogCache = ls; return Promise.resolve(ls); }
    // DeckList = every WotC preconstructed deck; SetList maps set codes → names.
    return Promise.all([
      fetchJson(MTGJSON_BASE + "/DeckList.json"),
      fetchJson(MTGJSON_BASE + "/SetList.json").catch(function () { return null; })
    ]).then(function (res) {
      var list = res[0], sets = res[1];
      var setNames = {};
      if (sets && Array.isArray(sets.data)) sets.data.forEach(function (s) { if (s && s.code) setNames[String(s.code).toUpperCase()] = s.name; });
      var decks = ((list && list.data) || [])
        .filter(function (d) { return d && /commander/i.test(d.type || "") && d.fileName; })
        .map(function (d) {
          var code = String(d.code || "").toUpperCase();
          return {
            id: "mtgjson-" + d.fileName,
            name: d.name,
            set: code,
            setName: setNames[code] || code,
            year: d.releaseDate ? Number(String(d.releaseDate).slice(0, 4)) : null,
            releaseDate: d.releaseDate || "",
            fileName: d.fileName,
            source: "mtgjson"
          };
        });
      decks.sort(function (a, b) { return (b.releaseDate || "").localeCompare(a.releaseDate || "") || a.name.localeCompare(b.name); });
      var obj = { at: Date.now(), decks: decks };
      if (decks.length) { catalogCache = obj; writeCatalogLS(obj); }
      return obj;
    });
  }

  // MTGJSON deck file → the card shape normalizeMoxfieldDeckCards produces.
  function mtgjsonDeckToCards(data) {
    var cards = [];
    function push(arr, board) {
      (arr || []).forEach(function (c) {
        if (!c || !c.name) return;
        var name = String(c.name).split(" // ")[0].trim(); // front face for DFCs
        cards.push({ quantity: Math.max(1, Number(c.count) || 1), board: board, name: name, type_line: c.type || "", oracle_text: "" });
      });
    }
    push(data.commander, "commanders");
    push(data.mainBoard, "mainboard");
    // precon sideboards (e.g. planar decks / attractions) are skipped by the builder anyway
    return cards;
  }

  function importMtgjsonPrecon(p, btn) {
    var orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Fetching…"; }
    fetchJson(MTGJSON_BASE + "/decks/" + p.fileName + ".json").then(function (res) {
      var data = res && res.data ? res.data : res;
      if (!data) throw new Error("empty");
      var cards = mtgjsonDeckToCards(data);
      if (btn) { btn.textContent = orig; btn.disabled = false; }
      doImport(p.name, cards, "precon-" + p.id, btn, function (ok) { if (ok) closeModal(); });
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
      if (typeof setDeckStatus === "function") setDeckStatus("Couldn't fetch that precon (network?). Try again.", "warning");
    });
  }

  // ---------- shared import (bundled + pasted lists) ----------
  function parseDeckText(text) {
    var cards = [];
    var board = "mainboard";
    (text || "").split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var hdr = line.replace(/^\/\/\s*/, "").replace(/\s*\(\d+\)\s*$/, "").replace(/:\s*$/, "").trim().toLowerCase();
      if (/^command(er)?s?$/.test(hdr)) { board = "commanders"; return; }
      if (/^(deck|mainboard|main|creatures?|lands?|spells?|artifacts?|enchantments?|planeswalkers?|instants?|sorceries|other)$/.test(hdr)) { board = "mainboard"; return; }
      if (/^(sideboard|sb|maybe(board)?|considering)$/.test(hdr)) { board = "maybeboard"; return; }
      if (line.indexOf("//") === 0) return;
      var m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
      var qty = m ? Number(m[1]) : 1;
      var name = (m ? m[2] : line).trim()
        .replace(/\s*\([^)]*\)\s*[0-9A-Za-z*-]*\s*$/, "")
        .replace(/\s*\*[^*]*\*\s*$/, "")
        .trim();
      if (!name) return;
      cards.push({ quantity: Math.max(1, qty), board: board, name: name, type_line: "", oracle_text: "" });
    });
    return cards;
  }

  function doImport(deckName, cards, deckKey, btn, onDone) {
    if (typeof hydrateMoxfieldCardsWithScryfall !== "function" || typeof applyMoxfieldDeckToBuilder !== "function") {
      alert("Deck builder not ready — open the Deck Builder tab first.");
      return;
    }
    if (!cards.length) { alert("No cards found in that list."); return; }
    var orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Importing…"; }
    if (typeof setDeckStatus === "function") setDeckStatus("Importing " + deckName + "…", "info");
    hydrateMoxfieldCardsWithScryfall(cards).then(function (hydrated) {
      applyMoxfieldDeckToBuilder({ name: deckName }, hydrated, deckKey);
      if (typeof setDeckStatus === "function") {
        var n = hydrated.reduce(function (s, c) { return s + (c.quantity || 1); }, 0);
        setDeckStatus("Imported " + n + " cards into " + deckName + ".", "success");
      }
      if (onDone) onDone(true);
    }).catch(function () {
      if (typeof setDeckStatus === "function") setDeckStatus("Could not import that list (network?). Try again.", "warning");
      if (btn) { btn.disabled = false; btn.textContent = orig; }
      if (onDone) onDone(false);
    });
  }

  function importPrecon(p, btn) {
    if (p.source === "mtgjson") return importMtgjsonPrecon(p, btn);
    doImport(p.name, parseDeckText(p.decklist), "precon-" + p.id, btn, function (ok) { if (ok) closeModal(); });
  }

  function importPastedList(btn) {
    var ta = document.querySelector("#deckListInput");
    var text = ta ? ta.value.trim() : "";
    if (!text) { if (typeof setDeckStatus === "function") setDeckStatus("Paste a decklist first (e.g. '1 Sol Ring').", "warning"); return; }
    var cards = parseDeckText(text);
    doImport("Imported deck", cards, "pasted-" + Date.now(), btn, function (ok) { if (ok && ta) ta.value = ""; });
  }

  // ---------- UI ----------
  var modalEl = null;
  function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; document.removeEventListener("keydown", onKey); } }
  function onKey(e) { if (e.key === "Escape") closeModal(); }

  var COLOR_HEX = { W: "#eef0ea", U: "#4aa3e6", B: "#9b86c4", R: "#e0655c", G: "#46b277" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function rowMeta(p) {
    var bits = [];
    bits.push(esc(p.setName || p.set));
    if (p.year) bits.push(p.year);
    if (p.theme) bits.push(esc(p.theme));
    return bits.join(" · ");
  }

  function render(mountList, decks, filters, countEl) {
    var q = (filters.search || "").toLowerCase();
    var data = decks.filter(function (p) {
      if (filters.set && p.set !== filters.set) return false;
      if (filters.color && (!p.colors || p.colors.indexOf(filters.color) === -1)) return false;
      if (q && p.name.toLowerCase().indexOf(q) === -1 && (p.commanderName || "").toLowerCase().indexOf(q) === -1 && String(p.setName || "").toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    if (countEl) countEl.textContent = data.length + " deck" + (data.length === 1 ? "" : "s");
    mountList.innerHTML = "";
    if (!data.length) { mountList.innerHTML = '<p style="color:#9aa6b8;grid-column:1/-1;text-align:center;padding:24px">No precons match.</p>'; return; }
    var frag = document.createDocumentFragment();
    data.forEach(function (p) {
      var card = document.createElement("div");
      card.style.cssText = "border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:14px;background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:6px";
      var pips = (p.colors || []).map(function (c) { return '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + (COLOR_HEX[c] || "#888") + '"></span>'; }).join(" ");
      card.innerHTML =
        '<strong style="color:#f3f6fb;font-size:15px">' + esc(p.name) + "</strong>" +
        (p.commanderName ? '<div style="color:#9aa6b8;font-size:12px">' + esc(p.commanderName) + "</div>" : "") +
        '<div style="color:#6f7d92;font-size:11px">' + rowMeta(p) + "</div>" +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px"><span>' + pips + "</span>" +
        '<button type="button" style="padding:6px 14px;border-radius:8px;border:none;background:#4aa3e6;color:#04101f;font-weight:700;cursor:pointer">Import ›</button></div>';
      card.querySelector("button").addEventListener("click", function () { importPrecon(p, this); });
      frag.appendChild(card);
    });
    mountList.appendChild(frag);
  }

  function openModal() {
    closeModal();
    modalEl = document.createElement("div");
    modalEl.style.cssText = "position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,6,14,0.78);backdrop-filter:blur(6px)";
    var panel = document.createElement("div");
    panel.style.cssText = "width:min(94vw,920px);max-height:88vh;display:flex;flex-direction:column;border-radius:16px;background:#0c1320;border:1px solid rgba(255,255,255,0.12);box-shadow:0 24px 60px rgba(0,0,0,0.5);overflow:hidden";
    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.1);flex-wrap:wrap">' +
        '<strong style="color:#4aa3e6;letter-spacing:0.12em;text-transform:uppercase;font-size:13px">Commander Precons</strong>' +
        '<span id="precCount" style="color:#6f7d92;font-size:12px"></span>' +
        '<input id="precSearch" type="text" placeholder="Search deck, commander, or set…" style="flex:1;min-width:140px;height:34px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#f3f6fb;outline:none" />' +
        '<select id="precSet" style="height:34px;max-width:220px;padding:0 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:#0c1320;color:#f3f6fb"></select>' +
        '<button id="precClose" type="button" style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#9aa6b8;cursor:pointer;font-size:16px">✕</button>' +
      "</div>" +
      '<div id="precColors" style="display:flex;gap:6px;padding:10px 18px;flex-wrap:wrap;align-items:center"></div>' +
      '<div id="precList" style="overflow-y:auto;padding:6px 18px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">' +
        '<p style="color:#9aa6b8;grid-column:1/-1;text-align:center;padding:24px">Loading the full WotC precon catalog…</p>' +
      "</div>";
    modalEl.appendChild(panel);
    document.body.appendChild(modalEl);

    var filters = { set: "", color: "", search: "" };
    var listEl = panel.querySelector("#precList");
    var setSel = panel.querySelector("#precSet");
    var countEl = panel.querySelector("#precCount");
    var colorsEl = panel.querySelector("#precColors");
    var decks = bundled().slice(); // instant paint with bundled while the catalog loads

    function rebuildSetOptions() {
      var seen = {}, sets = [];
      decks.forEach(function (p) { if (!seen[p.set]) { seen[p.set] = 1; sets.push({ set: p.set, name: p.setName || p.set, year: p.year || 0, rd: p.releaseDate || "" }); } });
      sets.sort(function (a, b) { return (b.rd || String(b.year)).localeCompare(a.rd || String(a.year)) || a.name.localeCompare(b.name); });
      setSel.innerHTML = '<option value="">All sets (' + sets.length + ")</option>" + sets.map(function (s) {
        return '<option value="' + esc(s.set) + '">' + esc(s.name) + (s.year ? " · " + s.year : "") + "</option>";
      }).join("");
    }

    function paint() { render(listEl, decks, filters, countEl); }

    // color pills — filter only decks with known colors (bundled/enriched)
    ["W", "U", "B", "R", "G"].forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.dataset.c = c;
      b.style.cssText = "width:24px;height:24px;border-radius:50%;border:2px solid transparent;background:" + COLOR_HEX[c] + ";cursor:pointer";
      b.title = "Filter by color (decks with known color identity)";
      b.addEventListener("click", function () {
        filters.color = filters.color === c ? "" : c;
        Array.prototype.forEach.call(colorsEl.querySelectorAll("button"), function (x) { x.style.borderColor = (x.dataset.c === filters.color) ? "#fff" : "transparent"; });
        paint();
      });
      colorsEl.appendChild(b);
    });
    var colorNote = document.createElement("span");
    colorNote.style.cssText = "color:#6f7d92;font-size:11px;margin-left:6px";
    colorsEl.appendChild(colorNote);

    panel.querySelector("#precSearch").addEventListener("input", function () { filters.search = this.value; paint(); });
    setSel.addEventListener("change", function () { filters.set = this.value; paint(); });
    panel.querySelector("#precClose").addEventListener("click", closeModal);
    modalEl.addEventListener("click", function (e) { if (e.target === modalEl) closeModal(); });
    document.addEventListener("keydown", onKey);

    rebuildSetOptions();
    paint();

    loadCatalog().then(function (cat) {
      if (!modalEl) return; // closed while loading
      if (cat.decks.length) {
        // merge: bundled featured decks first (colors + commander + offline lists), then the
        // full catalog minus name-duplicates of the bundled ones
        var names = {};
        bundled().forEach(function (p) { names[p.name.toLowerCase()] = 1; });
        decks = bundled().concat(cat.decks.filter(function (p) { return !names[p.name.toLowerCase()]; }));
        colorNote.textContent = "Color filter applies to featured decks only — the full catalog imports any deck.";
        rebuildSetOptions();
        paint();
      }
    }).catch(function () {
      if (!modalEl) return;
      colorNote.textContent = "Full catalog unavailable (offline?) — showing featured precons.";
    });
  }

  window.MTGPreconsUI = { open: openModal, importPasted: importPastedList, _loadCatalog: loadCatalog, _mtgjsonDeckToCards: mtgjsonDeckToCards, _parseDeckText: parseDeckText };
  document.addEventListener("click", function (e) {
    var target = e.target.closest && e.target.closest("#openPreconsButton, [data-open-precons], #importDeckListButton");
    if (!target) return;
    e.preventDefault();
    if (target.id === "importDeckListButton") importPastedList(target);
    else openModal();
  });
})();
