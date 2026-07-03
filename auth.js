/*
 * auth.js — PROMPT 0.5a: account UI + session handling. Activates the dormant web-sync.js (MTGSyncAdapter).
 * Self-contained: injects its own styles + header control + modal. Degrades gracefully (no-op) if Supabase
 * isn't configured (supabase-config.js missing), so the app still runs fully local/offline.
 */
(function () {
  "use strict";
  var sync = window.mtgSync || null;
  var configured = !!(sync && sync.enabled);

  // ---------- styles ----------
  var css = "" +
    ".auth-btn{background:#1f2937;color:#fff;border:1px solid #4b5563;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}" +
    ".auth-btn:hover{border-color:#14b8a6}" +
    ".auth-ind{font-size:11px;color:#9ca3af;margin-left:6px}" +
    ".auth-ind .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#6b7280;margin-right:4px;vertical-align:middle}" +
    ".auth-ind.synced .dot{background:#22c55e}" +
    ".auth-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:5000}" +
    ".auth-modal{width:360px;max-width:92vw;background:#1f2937;color:#fff;border:1px solid #4b5563;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
    ".auth-modal h2{margin:0 0 10px;font-size:18px}" +
    ".auth-tabs{display:flex;gap:6px;margin-bottom:12px}" +
    ".auth-tabs button{flex:1;background:#111827;border:1px solid #374151;color:#d1d5db;border-radius:8px;padding:7px;cursor:pointer;font-size:13px}" +
    ".auth-tabs button.active{background:#14b8a6;color:#06302b;border-color:transparent;font-weight:700}" +
    ".auth-modal label{display:block;font-size:12px;color:#9ca3af;margin:8px 0 3px}" +
    ".auth-modal input{width:100%;box-sizing:border-box;background:#111827;border:1px solid #374151;color:#fff;border-radius:8px;padding:9px;font-size:14px}" +
    ".auth-modal .primary{width:100%;margin-top:12px;background:#14b8a6;color:#06302b;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer}" +
    ".auth-modal .ghost{width:100%;margin-top:8px;background:#111827;color:#fff;border:1px solid #374151;border-radius:8px;padding:9px;cursor:pointer}" +
    ".auth-oauth{display:flex;gap:8px;margin-top:10px}.auth-oauth button{flex:1;background:#111827;color:#fff;border:1px solid #374151;border-radius:8px;padding:9px;cursor:pointer;font-size:13px}" +
    ".auth-msg{margin-top:10px;font-size:12px;min-height:16px}.auth-msg.err{color:#f87171}.auth-msg.ok{color:#34d399}" +
    ".auth-x{float:right;background:none;border:0;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1}" +
    ".auth-menu{position:absolute;right:0;top:110%;background:#1f2937;border:1px solid #4b5563;border-radius:10px;padding:6px;min-width:180px;z-index:5001;box-shadow:0 12px 40px rgba(0,0,0,.6)}" +
    ".auth-menu button{display:block;width:100%;text-align:left;background:none;border:0;color:#fff;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:13px}.auth-menu button:hover{background:#374151}" +
    ".auth-wrap{position:relative;display:inline-flex;align-items:center}";
  var style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  // ---------- header control ----------
  var wrap = document.createElement("div"); wrap.className = "auth-wrap";
  var btn = document.createElement("button"); btn.className = "auth-btn"; btn.type = "button"; btn.textContent = "Sign in";
  var ind = document.createElement("span"); ind.className = "auth-ind"; ind.innerHTML = '<span class="dot"></span>Local only';
  wrap.appendChild(btn); wrap.appendChild(ind);
  function mountHeader() {
    var actions = document.querySelector(".nav-actions") || document.querySelector(".top-actions");
    if (actions) actions.insertBefore(wrap, actions.firstChild);
    else document.body.appendChild(wrap);
  }

  // ---------- modal ----------
  var backdrop = null, mode = "signin";
  function closeModal() { if (backdrop) { backdrop.remove(); backdrop = null; } }
  function openModal() {
    if (!configured) { alert("Cloud sync isn't configured. Add supabase-config.js (URL + anon key)."); return; }
    closeModal();
    backdrop = document.createElement("div"); backdrop.className = "auth-backdrop";
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeModal(); });
    var m = document.createElement("div"); m.className = "auth-modal";
    m.innerHTML =
      '<button class="auth-x" aria-label="Close">&times;</button>' +
      '<h2>Account</h2>' +
      '<div class="auth-tabs"><button data-m="signin">Sign in</button><button data-m="signup">Sign up</button><button data-m="reset">Reset</button></div>' +
      '<div class="auth-fields"></div>' +
      '<div class="auth-msg"></div>' +
      '<button class="ghost" data-act="resend" style="display:none">Resend confirmation email</button>' +
      '<button class="ghost" data-act="guest">Continue as guest</button>' +
      '<div class="auth-oauth"><button data-oauth="google">Google</button><button data-oauth="apple">Apple</button></div>';
    backdrop.appendChild(m); document.body.appendChild(backdrop);
    m.querySelector(".auth-x").onclick = closeModal;
    m.querySelectorAll(".auth-tabs button").forEach(function (b) { b.onclick = function () { mode = b.dataset.m; renderFields(m); }; });
    m.querySelector('[data-act="resend"]').onclick = function () { run(m, resendConfirm); };
    m.querySelector('[data-act="guest"]').onclick = function () { run(m, guest); };
    m.querySelectorAll("[data-oauth]").forEach(function (b) { b.onclick = function () { oauth(b.dataset.oauth, m); }; });
    renderFields(m);
  }
  function renderFields(m) {
    m.querySelectorAll(".auth-tabs button").forEach(function (b) { b.classList.toggle("active", b.dataset.m === mode); });
    var f = m.querySelector(".auth-fields");
    if (mode === "reset") {
      f.innerHTML = '<label>Email</label><input type="email" id="aEmail" autocomplete="email"><button class="primary" data-act="reset">Send reset link</button>';
      f.querySelector('[data-act="reset"]').onclick = function () { run(m, reset); };
    } else {
      f.innerHTML =
        (mode === "signup" ? '<label>Display name</label><input type="text" id="aName" autocomplete="nickname">' : "") +
        '<label>Email</label><input type="email" id="aEmail" autocomplete="email">' +
        '<label>Password</label><input type="password" id="aPass" autocomplete="' + (mode === "signup" ? "new-password" : "current-password") + '">' +
        '<button class="primary" data-act="' + mode + '">' + (mode === "signup" ? "Create account" : "Sign in") + "</button>";
      f.querySelector('[data-act="' + mode + '"]').onclick = function () { run(m, mode === "signup" ? signup : signin); };
    }
    setMsg(m, "", "");
    var rb = m.querySelector('[data-act="resend"]'); if (rb) rb.style.display = "none"; // fresh state per tab
  }
  function setMsg(m, text, cls) { var el = m.querySelector(".auth-msg"); if (el) { el.textContent = text; el.className = "auth-msg " + (cls || ""); } }
  function val(m, id) { var el = m.querySelector("#" + id); return el ? el.value.trim() : ""; }
  function showResend(m) { var b = m.querySelector('[data-act="resend"]'); if (b) b.style.display = ""; }
  async function run(m, fn) {
    try { setMsg(m, "Working…", ""); await fn(m); }
    catch (e) {
      var msg = (e && e.message) || "Something went wrong.";
      setMsg(m, msg, "err");
      // Supabase: "Email not confirmed" — give the user a way to get a fresh link.
      if (/confirm/i.test(msg)) showResend(m);
    }
  }

  // ---------- auth actions ----------
  async function ensureClient() { if (sync && sync.enabled && !sync.client) await sync.init(); return sync && sync.client; }
  async function signin(m) { await sync.signInWithEmail(val(m, "aEmail"), val(m, "aPass")); closeModal(); }
  async function signup(m) {
    var r = await sync.signUpWithEmail(val(m, "aEmail"), val(m, "aPass"), val(m, "aName") || "Planeswalker");
    if (r && r.session) { closeModal(); return; } // email confirmation disabled — signed in immediately
    setMsg(m, "Account created — check your email (and spam) for the confirm link. Open it on this device; it signs you in here.", "ok");
    showResend(m);
  }
  async function resendConfirm(m) {
    var email = val(m, "aEmail"); if (!email) throw new Error("Enter your email above first.");
    await sync.resendConfirmation(email);
    setMsg(m, "New confirmation email sent to " + email + " — older links stop working, so use the newest one.", "ok");
  }
  async function reset(m) {
    var c = await ensureClient(); if (!c) throw new Error("Not configured.");
    var r = await c.auth.resetPasswordForEmail(val(m, "aEmail"), { redirectTo: window.mtgAuthRedirectUrl() });
    if (r.error) throw r.error; setMsg(m, "Reset link sent if that email exists.", "ok");
  }
  async function guest(m) {
    var c = await ensureClient(); if (!c) throw new Error("Not configured.");
    var r = await c.auth.signInAnonymously(); if (r.error) throw r.error; closeModal();
  }
  async function oauth(provider, m) {
    var c = await ensureClient(); if (!c) return;
    var r = await c.auth.signInWithOAuth({ provider: provider, options: { redirectTo: window.mtgAuthRedirectUrl() } });
    if (r.error) setMsg(m, r.error.message + " (provider must be enabled in Supabase Auth).", "err");
  }

  // ---------- auth-email landings ----------
  // Supabase verify links land back on the app with either tokens (handled by supabase-js)
  // or an error hash: #error=access_denied&error_code=otp_expired&error_description=…
  var authHashError = null;
  function captureAuthHash() {
    var h = location.hash || "";
    if (h.indexOf("error_code=") === -1 && h.indexOf("error_description=") === -1) return;
    var p = new URLSearchParams(h.replace(/^#/, ""));
    authHashError = { code: p.get("error_code") || p.get("error") || "auth_error", desc: p.get("error_description") || "The sign-in link didn't work." };
    // Clear it so the app's hash router and future reloads don't re-trigger the error.
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; }
  }
  function surfaceAuthHashError() {
    if (!authHashError) return;
    var expired = authHashError.code === "otp_expired";
    openModal();
    var m = backdrop && backdrop.querySelector(".auth-modal"); if (!m) return;
    setMsg(m, expired
      ? "That email link expired or was already used (email apps often pre-open links). Enter your email and resend to get a fresh one."
      : decodeURIComponent(String(authHashError.desc).replace(/\+/g, " ")), "err");
    if (expired) showResend(m);
    authHashError = null;
  }
  function openRecovery() {
    // Arrived from a password-reset link: the recovery session is live; ask for the new password.
    closeModal();
    backdrop = document.createElement("div"); backdrop.className = "auth-backdrop";
    var m = document.createElement("div"); m.className = "auth-modal";
    m.innerHTML = '<h2>Set a new password</h2>' +
      '<label>New password</label><input type="password" id="aNewPass" autocomplete="new-password">' +
      '<div class="auth-msg"></div>' +
      '<button class="primary" data-act="setpass">Save password</button>';
    backdrop.appendChild(m); document.body.appendChild(backdrop);
    m.querySelector('[data-act="setpass"]').onclick = function () {
      run(m, async function () {
        var pass = val(m, "aNewPass"); if (!pass || pass.length < 6) throw new Error("Password must be at least 6 characters.");
        var r = await sync.client.auth.updateUser({ password: pass });
        if (r.error) throw r.error;
        setMsg(m, "Password updated — you're signed in.", "ok");
        setTimeout(closeModal, 1200);
      });
    };
  }

  // ---------- session state ----------
  var menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function showMenu(session) {
    closeMenu();
    menu = document.createElement("div"); menu.className = "auth-menu";
    var who = session.user && (session.user.email || (session.user.is_anonymous ? "Guest" : "Account"));
    menu.innerHTML = '<div style="padding:6px 10px;color:#9ca3af;font-size:12px">' + who + "</div>";
    var out = document.createElement("button"); out.textContent = "Sign out";
    out.onclick = async function () { closeMenu(); try { await sync.signOut(); } catch (e) {} };
    menu.appendChild(out); wrap.appendChild(menu);
  }
  function updateUI(session) {
    if (session) {
      var label = (session.user && session.user.email) || (session.user && session.user.is_anonymous ? "Guest" : "Account");
      btn.textContent = label;
      ind.className = "auth-ind synced"; ind.innerHTML = '<span class="dot"></span>Synced';
    } else {
      btn.textContent = "Sign in";
      ind.className = "auth-ind"; ind.innerHTML = '<span class="dot"></span>Local only';
    }
  }
  btn.addEventListener("click", function () {
    if (sync && sync.session) { if (menu) closeMenu(); else showMenu(sync.session); }
    else openModal();
  });
  document.addEventListener("click", function (e) { if (menu && !wrap.contains(e.target)) closeMenu(); });

  // ---------- boot ----------
  captureAuthHash(); // grab #error=… from auth-email landings before anything else parses the URL
  async function boot() {
    mountHeader();
    if (!configured) { btn.title = "Add supabase-config.js to enable cloud sync"; return; }
    try {
      await sync.init();
      var c = sync.client;
      var s = await c.auth.getSession(); sync.session = s.data.session; updateUI(sync.session);
      c.auth.onAuthStateChange(function (_evt, session) {
        sync.session = session; updateUI(session);
        if (_evt === "PASSWORD_RECOVERY") { try { openRecovery(); } catch (e) {} }
        window.dispatchEvent(new CustomEvent("mtg-auth-changed", { detail: { session: session } }));
      });
      surfaceAuthHashError();
    } catch (e) { console.warn("auth.js: init failed", e); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
