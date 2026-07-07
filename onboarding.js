/* onboarding.js — first-run 3-step account onboarding (add deck → who you play with → first game).
   Classic script (no ES modules), works offline. Shows once per account (or guest) via localStorage. */
(function () {
  "use strict";
  var FLAG = "mtg-onboarded-v1";
  var PREF = "mtg-playgroup-v1";
  var shown = false;

  function uid() {
    try { var s = window.mtgSync && window.mtgSync.session; return (s && s.user && s.user.id) || "guest"; } catch (e) { return "guest"; }
  }
  function alreadyOnboarded() {
    // Any completed onboarding on this device counts — don't replay the tour when a
    // guest who already finished it signs up / signs in mid-session.
    try { var m = JSON.parse(localStorage.getItem(FLAG) || "{}"); return !!m[uid()] || Object.keys(m).length > 0; } catch (e) { return false; }
  }
  function markOnboarded() {
    try { var m = JSON.parse(localStorage.getItem(FLAG) || "{}"); m[uid()] = Date.now(); localStorage.setItem(FLAG, JSON.stringify(m)); } catch (e) {}
  }
  function savePref(pref) {
    try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {}
    // Best-effort persist to profile metadata when signed in (non-blocking, degrades silently).
    try {
      var c = window.mtgGetClient && window.mtgGetClient();
      var s = window.mtgSync && window.mtgSync.session;
      if (c && s && s.user && !s.user.is_anonymous) {
        c.from("profiles").upsert({ id: s.user.id, playgroup_size: pref.size, playstyle: pref.style }, { onConflict: "id" }).then(function () {}, function () {});
      }
    } catch (e) {}
  }

  function ensureStyles() {
    if (document.getElementById("onboardStyles")) return;
    var st = document.createElement("style"); st.id = "onboardStyles";
    st.textContent = [
      ".onb-ov{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(3,8,16,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:onbFade .2s ease}",
      "@keyframes onbFade{from{opacity:0}to{opacity:1}}",
      ".onb-card{width:min(480px,92vw);background:linear-gradient(180deg,#141d2b,#0d131d);border:1px solid rgba(143,213,255,.2);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.55);padding:22px 22px 18px;color:#e7eef8}",
      ".onb-steps{display:flex;gap:6px;margin-bottom:16px}",
      ".onb-dot{flex:1;height:4px;border-radius:3px;background:rgba(255,255,255,.12)}",
      ".onb-dot.on{background:linear-gradient(90deg,#5aa0ff,#8fd5ff)}",
      ".onb-card h2{margin:0 0 6px;font-size:1.25rem}",
      ".onb-card p{margin:0 0 14px;color:#9db2cc;font-size:.9rem;line-height:1.5}",
      ".onb-opts{display:grid;gap:8px;margin:0 0 16px}",
      ".onb-grp{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}",
      ".onb-chip{flex:1;min-width:80px;padding:10px 8px;border:1px solid rgba(143,213,255,.22);border-radius:10px;background:rgba(3,12,21,.5);color:#cfe0f5;font-weight:700;font-size:.82rem;cursor:pointer;text-align:center}",
      ".onb-chip.sel{border-color:#8fd5ff;background:rgba(90,160,255,.18);color:#fff}",
      ".onb-lab{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:#7f95b0;margin:0 0 6px}",
      ".onb-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:6px}",
      ".onb-btn{padding:10px 16px;border-radius:10px;border:1px solid rgba(143,213,255,.25);background:rgba(255,255,255,.04);color:#dCE7f5;font-weight:700;cursor:pointer;font-size:.88rem}",
      ".onb-btn.primary{background:linear-gradient(90deg,#4d8dff,#7cc4ff);border-color:transparent;color:#06121f}",
      ".onb-btn.ghost{background:none;border-color:transparent;color:#8298b4}"
    ].join("");
    document.head.appendChild(st);
  }

  function go(page) {
    var b = document.querySelector('[data-page-target="' + page + '"]');
    if (b) b.click();
  }
  function startGame() {
    try { if (window.MTGTable && MTGTable.start) { MTGTable.start({}); return true; } } catch (e) {}
    var pb = document.getElementById("playTabButton"); if (pb) { pb.click(); return true; }
    return false;
  }

  function open() {
    if (shown) return; shown = true;
    ensureStyles();
    var pref = { size: 4, style: "casual" };
    var step = 0;
    var ov = document.createElement("div"); ov.className = "onb-ov";
    var card = document.createElement("div"); card.className = "onb-card"; ov.appendChild(card);

    function close(done) { if (done) markOnboarded(); ov.remove(); }

    function render() {
      var dots = "<div class='onb-steps'>" + [0, 1, 2].map(function (i) { return "<div class='onb-dot" + (i <= step ? " on" : "") + "'></div>"; }).join("") + "</div>";
      var body = "";
      if (step === 0) {
        body = "<h2>Welcome to Sigil</h2>"
          + "<p>Let’s get you playing in three quick steps. First, build or import a deck — the deck builder can import from Archidekt, a pasted list, or a WotC precon.</p>"
          + "<div class='onb-foot'><button class='onb-btn ghost' data-act='skip'>Skip setup</button>"
          + "<div style='display:flex;gap:8px'><button class='onb-btn' data-act='deck'>Open deck builder</button><button class='onb-btn primary' data-act='next'>Next</button></div></div>";
      } else if (step === 1) {
        body = "<h2>Who do you play with?</h2>"
          + "<p>This tailors defaults like pod size and suggested bracket. You can change it anytime.</p>"
          + "<p class='onb-lab'>Typical pod size</p><div class='onb-grp' data-grp='size'>"
          + [2, 3, 4].map(function (n) { return "<button class='onb-chip" + (pref.size === n ? " sel" : "") + "' data-size='" + n + "'>" + n + " players</button>"; }).join("") + "</div>"
          + "<p class='onb-lab'>Playstyle</p><div class='onb-grp' data-grp='style'>"
          + [["casual", "Casual"], ["focused", "Focused"], ["cedh", "cEDH"]].map(function (s) { return "<button class='onb-chip" + (pref.style === s[0] ? " sel" : "") + "' data-style='" + s[0] + "'>" + s[1] + "</button>"; }).join("") + "</div>"
          + "<div class='onb-foot'><button class='onb-btn ghost' data-act='back'>Back</button><button class='onb-btn primary' data-act='next'>Next</button></div>";
      } else {
        body = "<h2>You’re all set</h2>"
          + "<p>Build or import a deck, then open <b>Play</b> to start a Commander game — or host a table and invite friends.</p>"
          + "<div class='onb-foot'><button class='onb-btn ghost' data-act='deck'>Open deck builder</button><button class='onb-btn primary' data-act='finish'>Finish</button></div>";
      }
      card.innerHTML = dots + body;
    }

    card.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act],[data-size],[data-style]"); if (!t) return;
      if (t.hasAttribute("data-size")) { pref.size = parseInt(t.getAttribute("data-size"), 10); render(); return; }
      if (t.hasAttribute("data-style")) { pref.style = t.getAttribute("data-style"); render(); return; }
      var act = t.getAttribute("data-act");
      if (act === "skip" || act === "finish") { savePref(pref); close(true); }
      else if (act === "deck") { savePref(pref); close(true); go("deck"); }
      else if (act === "back") { step = Math.max(0, step - 1); render(); }
      else if (act === "next") { step = Math.min(2, step + 1); render(); }
    });

    render();
    document.body.appendChild(ov);
  }

  function maybeOpen() {
    if (alreadyOnboarded()) return;
    // Slight delay so the app UI has mounted.
    setTimeout(open, 600);
  }

  // Trigger on sign-in (new account) and on first visit as a guest.
  window.addEventListener("mtg-auth-changed", function (e) {
    var s = e && e.detail && e.detail.session;
    if (s && s.user && !s.user.is_anonymous) maybeOpen();
  });
  function initGuest() { maybeOpen(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(initGuest, 1200); });
  else setTimeout(initGuest, 1200);

  // Expose a manual re-run (e.g. from a "Replay tutorial" link).
  window.MTGOnboarding = { open: function () { shown = false; open(); }, reset: function () { try { localStorage.removeItem(FLAG); } catch (e) {} } };
})();
