/*
 * icons.js — shared minimalist line-icon set for Sigil (window.MTGIcons).
 *
 * One consistent visual language across the whole app: 24x24 viewBox, no fill,
 * stroke = currentColor, 2px round strokes (matches the existing play-hud.js /
 * play-life.js svg() helpers). NO EMOJI anywhere — every UI glyph comes from here.
 *
 *   MTGIcons.get("close")            -> <svg ...>...</svg>  (1em, inherits color)
 *   MTGIcons.get("mic", 20)          -> 20x20
 *   MTGIcons.get("sword", "1em", "pow-ic-svg")  -> adds a class
 *
 * A few icons need a solid fill accent (coin face, record dot); those sub-shapes
 * carry their own fill="currentColor" stroke="none" so the outer stroke style is
 * preserved everywhere else.
 */
window.MTGIcons = (function () {
  "use strict";

  // path/'' body for each named icon (drawn inside the shared stroke <svg> wrapper)
  var P = {
    // --- generic chrome ---
    close:        '<path d="M18 6L6 18M6 6l12 12"/>',
    check:        '<path d="M20 6L9 17l-5-5"/>',
    chevronDown:  '<path d="M6 9l6 6 6-6"/>',
    chevronUp:    '<path d="M18 15l-6-6-6 6"/>',
    chevronLeft:  '<path d="M15 18l-6-6 6-6"/>',
    chevronRight: '<path d="M9 18l6-6-6-6"/>',
    refresh:      '<path d="M21 5v5h-5"/><path d="M3 19v-5h5"/><path d="M19.4 9A8 8 0 0 0 6 6.3L3 9"/><path d="M4.6 15A8 8 0 0 0 18 17.7l3-2.7"/>',
    plus:         '<path d="M12 5v14M5 12h14"/>',
    minus:        '<path d="M5 12h14"/>',
    gear:         '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    sliders:      '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
    x:            '<path d="M18 6L6 18M6 6l12 12"/>',

    // --- game glyphs ---
    sword:        '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4-2 2-4-4"/>',
    shield:       '<path d="M12 3l7 3v5c0 4.2-2.8 7.6-7 9-4.2-1.4-7-4.8-7-9V6l7-3Z"/>',
    skull:        '<path d="M8 20v1.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V20"/><path d="M9.2 20a6 6 0 0 1-3.2-5.3V13a6 6 0 0 1 12 0v1.7A6 6 0 0 1 14.8 20"/><circle cx="9.3" cy="13" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13" r="1.3" fill="currentColor" stroke="none"/>',
    coinH:        '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/>',
    coinT:        '<circle cx="12" cy="12" r="9"/><path d="M8.4 12h7.2"/>',

    // --- audio / voice ---
    mic:          '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3M8.5 21h7"/>',
    micOff:       '<path d="M9 9V6a3 3 0 0 1 5.1-2.1"/><path d="M15 9.3V6"/><path d="M17 11a5 5 0 0 1-.4 2M5 11a7 7 0 0 0 10.9 5.8"/><path d="M12 18v3M8.5 21h7"/><path d="M3 3l18 18"/>',
    volume:       '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8.5a5 5 0 0 1 0 7"/><path d="M19 5.5a9 9 0 0 1 0 13"/>',
    volumeLow:    '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8.5a5 5 0 0 1 0 7"/>',
    volumeMute:   '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M22 9l-6 6M16 9l6 6"/>',
    headset:      '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="13" width="4.5" height="6.5" rx="2"/><rect x="17" y="13" width="4.5" height="6.5" rx="2"/><path d="M21.5 16v1.5a3 3 0 0 1-3 3H14"/>',
    phoneOff:     '<path d="M10.7 13.3a11 11 0 0 1-2-2.9l1.6-1.6a1 1 0 0 0 .2-1.1L9 4.5a1 1 0 0 0-1.2-.6C6 4.3 4 5.5 4 7.5a13 13 0 0 0 3.8 8.8"/><path d="M13 16.2a13 13 0 0 0 4 1.6 1 1 0 0 0 .9-.3l1.1-1.4"/><path d="M2 2l20 20"/>',

    // --- people ---
    user:         '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
    users:        '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 21v-1a6.5 6.5 0 0 1 13 0v1"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M17.5 14.2A6.5 6.5 0 0 1 21.5 20v1"/>'
  };

  function get(name, size, cls) {
    var body = P[name];
    if (body == null) return "";
    var s = (size == null) ? "1em" : (typeof size === "number" ? size + "" : size);
    return '<svg class="mi' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body + '</svg>';
  }
  function has(name) { return Object.prototype.hasOwnProperty.call(P, name); }
  function add(name, body) { P[name] = body; }
  function raw(name) { return P[name] || ""; }

  // base alignment so inline icons sit nicely beside text (flex buttons ignore vertical-align)
  try {
    if (typeof document !== "undefined" && !document.getElementById("mtg-icons-css")) {
      var st = document.createElement("style"); st.id = "mtg-icons-css";
      st.textContent = ".mi{display:inline-block;vertical-align:-.14em;flex:none}";
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}

  return { get: get, has: has, add: add, raw: raw };
})();
