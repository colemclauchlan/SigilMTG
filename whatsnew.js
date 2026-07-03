/* whatsnew.js — "What's New" changelog + "Report a bug" modals (ported from the React
   WhatsNewModal + BugReportModal). Self-contained classic script: injects two buttons into
   the top-bar .nav-actions and opens client-only modals. No network.

   CHANGELOG DISCIPLINE (QA 2026-07-02, G6.44): every release is ONE entry in the
   CHANGELOG array below — { version, date, sections }. Sections are plain-English
   (layman wording) bullet lists under three fixed headings: "New features",
   "Big changes", "Major fixes". Omit a heading if a release has nothing for it.
   Mark anything still in progress with "(rolling out)". To ship a new version,
   prepend one small object — nothing else needs to change. */
(function () {
  "use strict";

  var CHANGELOG = [
    {
      version: "v0.1.1",
      date: "2026-07-03",
      sections: {
        "Big changes": [
          "The whole app is now live and fully up to date online — every feature from the last big update has been deployed to the site."
        ],
        "Major fixes": [
          "The bottom-left life tracker now appears reliably in every game (this fix is finally live on the site).",
          "The life tracker no longer shows up on the mode-select and lobby screens — it now appears only on the game board, where it belongs.",
          "Declaring an attacker now shows a readable note in the action log instead of a raw internal code.",
          "Moving cards around the board no longer clutters the action log — routine moves are silent; only meaningful plays and effects are logged."
        ]
      }
    },
    {
      version: "v0.1",
      date: "2026-07-02",
      sections: {
        "New features": [
          "Every Commander precon Wizards has ever made is now in the app — browse the full catalog, search by deck, commander, or set, and import one with a single click.",
          "Watch live games: open any Public game from the Watch tab and see a real-time mirror of every player's board — commander art, life, counters, commander damage, and battlefield — updating as they play (opponents' hidden cards stay hidden).",
          "Live tables feel alive: you can see your opponents' cursors move around the board, and their chat pops up as little bubbles right where they're pointing.",
          "Sideboard swapping between games: load a deck with a sideboard and swap cards in and out from a two-pane picker; your swaps stick per deck.",
          "Host a game as Public or Private, and schedule it up to 7 days ahead — the lobby shows a \"Starts in…\" countdown until game time.",
          "Cloud ranked stats are unlocked: online games now record to your ELO rating and match history.",
          "Text and voice chat buttons live in the game's top bar.",
          "15 more rules-engine mechanics are now understood — blitz, riot, exploit, unearth, encore, fabricate, connive, plot, disturb, prototype, and more."
        ],
        "Big changes": [
          "The \"Life Counter\" tab is now called \"Paper Tracker\", and the Play tab moved up next to Home. Old links and bookmarks still work.",
          "One look for everyone: the site keeps its dark Midnight Azure theme permanently — the light/dark toggle is gone.",
          "Cleaner top bar: the Sign-in button is now blue like the other buttons, and the \"local only\" badge is gone.",
          "New bottom-left life tracker: Scoop/Concede with an \"are you sure?\" confirm, hold the +/- to change life faster and faster (1 → 5 → 10), a red/green flash on every change, library/graveyard/exile counts at a glance, poison/energy/experience/rad/monarch counters, and a commander-damage screen that shows each commander's card art. Hit 0 life and it fills red with \"YOU ARE DEAD\".",
          "Stack upgrades: drag spells to reorder the stack, and it politely hides when empty — the action log slides up to take the space.",
          "Passing the turn now flashes the screen so you never miss it — white when you pass, yellow when it's your turn.",
          "Quality-of-life on the table: right-click menu on hand cards (discard, play, exile…), \"Mill X\" and \"Scry X\" on the library, a modernized single-card command-zone viewer, and cleaner graveyard/exile viewers.",
          "Lobby + mode-select redesign: a cosmic Sigil starfield, pick your deck League-style from big commander-art cards, grab any precon from the new picker, a hosts-only \"Precons only\" toggle, and \"View all lobbies\" / Spectate shortcuts.",
          "Full mobile optimization: the whole site — landing, tracker, deck builder, lobby, and the play table — now lays out and taps cleanly on phones, with notch-safe spacing and finger-sized controls."
        ],
        "Major fixes": [
          "Fixed the bottom-left life tracker not showing up in a game.",
          "The life tracker's Draw and commander-damage buttons now work in every game mode.",
          "Assorted smaller fixes across the table, lobby, and deck builder from this QA round."
        ]
      }
    },
    {
      version: "Pre-release",
      date: "June 2026",
      sections: {
        "New features": [
          "Full virtual tabletop: phases, zones, the stack, an action log, and opening-hand mulligans — solo or online in pods of up to four.",
          "Deck builder with bracket review, synergy suggestions, Moxfield/Archidekt import, and paste-a-decklist.",
          "Life counter, dice roller (coin / quick / custom), per-player trackers, and commander damage.",
          "What's New + Report a bug, right here in the top bar."
        ],
        "Big changes": [
          "Rules engine foundations: turn structure, state-based actions, layers, and the keyword set.",
          "Runs fully offline (file://) — classic scripts, vendored libraries."
        ]
      }
    }
  ];

  var SECTION_ORDER = ["New features", "Big changes", "Major fixes"];
  var SECTION_COLOR = { "New features": "#46b277", "Big changes": "#4aa3e6", "Major fixes": "#d7a13a" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var overlayEl = null;
  function close() { if (overlayEl) { overlayEl.remove(); overlayEl = null; document.removeEventListener("keydown", onKey); } }
  function onKey(e) { if (e.key === "Escape") close(); }
  function shell(title, innerHtml) {
    close();
    overlayEl = document.createElement("div");
    overlayEl.style.cssText = "position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,6,14,0.78);backdrop-filter:blur(6px)";
    var panel = document.createElement("div");
    panel.style.cssText = "width:min(94vw,540px);max-height:86vh;display:flex;flex-direction:column;border-radius:16px;background:#0c1320;border:1px solid rgba(255,255,255,0.12);box-shadow:0 24px 60px rgba(0,0,0,0.5);overflow:hidden";
    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.1)">' +
        '<strong style="color:#4aa3e6;letter-spacing:0.1em;text-transform:uppercase;font-size:13px">' + esc(title) + "</strong>" +
        '<button type="button" data-close style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#9aa6b8;cursor:pointer;font-size:16px">✕</button>' +
      "</div>" +
      '<div style="overflow-y:auto;padding:16px 18px">' + innerHtml + "</div>";
    overlayEl.appendChild(panel);
    document.body.appendChild(overlayEl);
    panel.querySelector("[data-close]").addEventListener("click", close);
    overlayEl.addEventListener("click", function (e) { if (e.target === overlayEl) close(); });
    document.addEventListener("keydown", onKey);
    return panel;
  }

  function renderRelease(rel) {
    var head =
      '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px">' +
        '<strong style="color:#f3f6fb;font-size:16px">' + esc(rel.version) + "</strong>" +
        '<span style="color:#6f7d92;font-size:12px">' + esc(rel.date) + "</span>" +
      "</div>";
    var body = SECTION_ORDER.map(function (name) {
      var items = rel.sections && rel.sections[name];
      if (!items || !items.length) return "";
      var color = SECTION_COLOR[name] || "#888";
      return '<div style="margin:0 0 12px">' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:' + color + ';margin-bottom:6px">' + esc(name) + "</div>" +
        items.map(function (text) {
          return '<div style="display:flex;gap:8px;align-items:flex-start;margin:5px 0">' +
            '<span style="flex:none;width:6px;height:6px;border-radius:50%;margin-top:6px;background:' + color + '"></span>' +
            '<span style="color:#c7d1de;font-size:13px;line-height:1.45">' + esc(text) + "</span></div>";
        }).join("") + "</div>";
    }).join("");
    return '<div style="margin-bottom:20px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06)">' + head + body + "</div>";
  }

  function openWhatsNew() {
    shell("What's New", CHANGELOG.map(renderRelease).join(""));
  }

  function openBugReport() {
    var form =
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<p style="color:#9aa6b8;font-size:12px;margin:0">Describe the issue. Submitting copies a formatted report to your clipboard so you can paste it into an email or issue.</p>' +
      '<input id="bugTitle" placeholder="Short title" style="height:34px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#f3f6fb;outline:none" />' +
      '<div style="display:flex;gap:8px">' +
        '<select id="bugCat" style="flex:1;height:34px;padding:0 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:#0c1320;color:#f3f6fb"><option>gameplay</option><option>ui</option><option>network</option><option>performance</option><option>other</option></select>' +
        '<select id="bugSev" style="flex:1;height:34px;padding:0 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:#0c1320;color:#f3f6fb"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select>' +
      "</div>" +
      '<textarea id="bugSteps" rows="5" placeholder="Steps to reproduce / what happened" style="resize:vertical;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#f3f6fb;outline:none"></textarea>' +
      '<button id="bugSubmit" type="button" style="height:38px;border-radius:9px;border:none;background:#4aa3e6;color:#04101f;font-weight:700;cursor:pointer">Copy report to clipboard</button>' +
      '<p id="bugDone" style="color:#46b277;font-size:12px;margin:0;display:none">Copied — paste it wherever you report bugs. Thanks!</p>' +
      "</div>";
    var panel = shell("Report a bug", form);
    panel.querySelector("#bugSubmit").addEventListener("click", function () {
      var title = panel.querySelector("#bugTitle").value.trim() || "(no title)";
      var cat = panel.querySelector("#bugCat").value;
      var sev = panel.querySelector("#bugSev").value;
      var steps = panel.querySelector("#bugSteps").value.trim();
      var report = "Sigil bug report\nTitle: " + title + "\nCategory: " + cat + "\nSeverity: " + sev +
        "\nURL: " + location.href + "\nUA: " + navigator.userAgent + "\n\nDetails:\n" + steps;
      var done = panel.querySelector("#bugDone");
      function showOk() { done.style.display = "block"; }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(report).then(showOk, function () { console.log(report); showOk(); });
        else { console.log(report); showOk(); }
      } catch (e) { console.log(report); showOk(); }
    });
  }

  function mountButtons() {
    var actions = document.querySelector(".nav-actions");
    if (!actions || document.querySelector("#whatsNewButton")) return;
    function btn(id, icon, title) {
      var b = document.createElement("button");
      b.id = id; b.type = "button"; b.className = "nav-icon"; b.title = title; b.setAttribute("aria-label", title);
      b.innerHTML = '<span class="msym" style="margin:0;font-size:20px;vertical-align:-5px">' + icon + '</span>';
      return b;
    }
    var wn = btn("whatsNewButton", "auto_awesome", "What's New");
    var bug = btn("bugReportButton", "bug_report", "Report a bug");
    wn.addEventListener("click", openWhatsNew);
    bug.addEventListener("click", openBugReport);
    actions.insertBefore(bug, actions.firstChild);
    actions.insertBefore(wn, actions.firstChild);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountButtons);
  else mountButtons();
  window.MTGWhatsNew = { open: openWhatsNew, openBug: openBugReport };
})();
