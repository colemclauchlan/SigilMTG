/*
 * engine-assist-ui.js — OPT-IN advisory overlay for the live tabletop. Read-only; it NEVER touches
 * the board DOM or game logic, so it cannot break manual play. It reads window.MTGTable.getState()
 * and shows the rules engine's advisory analysis (MTGEngineAssist.analyze): state-based-action
 * findings (lethal life, 21 commander damage, stray tokens, legend rule, …) + effective P/T for
 * cards the engine knows.
 *
 * Toggle at runtime from the Play HUD (the chip icon) or via window.MTGEngineAssistUI.toggle().
 * Still respects a pre-set window.MTG_ENGINE_ASSIST = true (auto-opens on load). Off by default.
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var wrap = null, body = null, timer = null, open = true;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function render() {
    if (!wrap || !open) return;
    var s = null;
    try { s = window.MTGTable && window.MTGTable.getState ? window.MTGTable.getState() : null; } catch (e) { s = null; }
    if (!s) { body.innerHTML = "<div style='color:#8b949e'>Start or load a game to see analysis.</div>"; return; }
    var a;
    try { a = window.MTGEngineAssist.analyze(s); } catch (e) { body.innerHTML = "<div style='color:#f0726a'>analysis error</div>"; return; }

    var html = "";
    html += "<div style='text-transform:uppercase;letter-spacing:.7px;color:#8b949e;font-size:10.5px;margin:0 0 5px'>State-based actions</div>";
    if (a.sba && a.sba.length) {
      a.sba.forEach(function (f) {
        html += "<div style='border-left:3px solid #f0726a;padding:4px 9px;margin-bottom:5px;background:#1a1416;border-radius:0 6px 6px 0'>" +
          "<span style='color:#8b949e'>[" + esc(f.rule) + "]</span> " + esc(f.message) + "</div>";
      });
    } else {
      html += "<div style='color:#8b949e;font-style:italic;margin-bottom:8px'>none — board is stable</div>";
    }

    var ids = Object.keys(a.effective || {});
    html += "<div style='text-transform:uppercase;letter-spacing:.7px;color:#8b949e;font-size:10.5px;margin:8px 0 5px'>Effective P/T</div>";
    if (ids.length) {
      ids.forEach(function (id) {
        var c = s.cards[id] || {}, e = a.effective[id];
        html += "<div style='padding:2px 0'>" + esc(c.name || id) + " <span style='color:#19c39c;font-weight:650'>" + e.power + "/" + e.toughness + "</span></div>";
      });
    } else {
      html += "<div style='color:#8b949e;font-style:italic'>no engine-known creatures on the battlefield</div>";
    }
    body.innerHTML = html;
  }

  function build() {
    if (wrap) return;
    wrap = document.createElement("div"); wrap.id = "mtg-engine-assist";
    wrap.style.cssText = "position:fixed;right:14px;bottom:14px;width:280px;max-height:50vh;z-index:99999;" +
      "background:rgba(20,26,33,.96);color:#e6edf3;border:1px solid #2b333d;border-radius:12px;" +
      "font:12.5px/1.5 -apple-system,Segoe UI,Inter,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden;backdrop-filter:blur(6px);";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 11px;border-bottom:1px solid #2b333d;";
    head.innerHTML = "<span style='font-weight:650'>" + (window.MTGIcons ? MTGIcons.get("cpu", "1em") : "") + " Rules Engine</span><span style='color:#8b949e;font-size:11px'>advisory · beta</span>";
    var mb = document.createElement("button"); mb.innerHTML = (window.MTGIcons ? MTGIcons.get("minus", "1em") : "–"); mb.title = "minimize";
    mb.style.cssText = "margin-left:auto;background:#1c232d;color:#e6edf3;border:1px solid #2b333d;border-radius:6px;width:22px;height:22px;cursor:pointer;line-height:1;";
    var xb = document.createElement("button"); xb.innerHTML = (window.MTGIcons ? MTGIcons.get("close", "1em") : "✕"); xb.title = "close";
    xb.style.cssText = "background:#1c232d;color:#e6edf3;border:1px solid #2b333d;border-radius:6px;width:22px;height:22px;cursor:pointer;line-height:1;";
    head.appendChild(mb); head.appendChild(xb);
    body = document.createElement("div");
    body.style.cssText = "padding:9px 11px;overflow:auto;max-height:calc(50vh - 40px);";
    var ctl = document.createElement("div");
    ctl.style.cssText = "display:flex;align-items:center;gap:7px;padding:7px 11px;border-bottom:1px solid #2b333d;font-size:11.5px;color:#c9d4e0;";
    ctl.innerHTML = "<label style='display:flex;align-items:center;gap:6px;cursor:pointer;margin:0'><input type='checkbox' id='mtgEnfChk' style='cursor:pointer'> Auto-enforce SBAs</label><span style='color:#8b949e'>beta — 0-toughness dies, losses flagged</span>";
    wrap.appendChild(head); wrap.appendChild(ctl); wrap.appendChild(body);
    (document.body || document.documentElement).appendChild(wrap);
    var chk = ctl.querySelector("#mtgEnfChk");
    try { if (chk && window.MTGTable && window.MTGTable.engineEnforceOn) chk.checked = !!window.MTGTable.engineEnforceOn(); } catch (e) {}
    if (chk) chk.addEventListener("change", function () { try { if (window.MTGTable && window.MTGTable.setEngineEnforce) window.MTGTable.setEngineEnforce(chk.checked); } catch (e) {} render(); });
    mb.addEventListener("click", function () { open = !open; body.style.display = open ? "block" : "none"; mb.textContent = open ? "–" : "+"; });
    xb.addEventListener("click", disable);
  }

  function enable() {
    if (!window.MTGEngineAssist || !window.MTGTable || typeof window.MTGTable.getState !== "function") return false;
    window.MTG_ENGINE_ASSIST = true;
    build(); open = true; if (body) body.style.display = "block";
    render();
    if (timer) clearInterval(timer);
    timer = setInterval(render, 800);
    return true;
  }
  function disable() {
    window.MTG_ENGINE_ASSIST = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    wrap = null; body = null;
  }
  function toggle() { if (wrap) { disable(); return false; } return enable(); }
  function isOn() { return !!wrap; }

  window.MTGEngineAssistUI = { enable: enable, disable: disable, toggle: toggle, isOn: isOn, refresh: render };

  function autostart() { if (window.MTG_ENGINE_ASSIST) enable(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autostart); else autostart();
  window.addEventListener("beforeunload", function () { if (timer) clearInterval(timer); });
})();
