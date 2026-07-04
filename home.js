/* =============================================================================
   SIGIL — landing hero  ·  "Midnight Azure"
   Classic (non-module) script so it works when index.html is opened directly
   over file:// AND offline — Three.js / React / htm are vendored locally as
   plain globals (see vendor/ + index.html). No ES modules, no importmap, no CDN.
   Three.js scene (mana-pentad + grabbable foil cards + tumbling D20/D6 dice +
   dust) pinned behind a scroll-driven page, with a React-rendered overlay.
   Fails closed to the static hero fallback if anything is missing.
   ========================================================================== */
(function () {
  "use strict";

  var REDUCE_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COARSE = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var LOW_POWER = COARSE || (navigator.hardwareConcurrency || 8) <= 4 || window.innerWidth < 760;

  var MANA = { W: 0xeef0ea, U: 0x4aa3e6, B: 0x9b86c4, R: 0xe0655c, G: 0x46b277 };
  var MANA_KEYS = ["W", "U", "B", "R", "G"];

  function go(target) {
    if (target === "play") { var p = document.getElementById("playTabButton"); if (p) p.click(); return; }
    var b = document.querySelector('[data-page-target="' + target + '"]');
    if (b) b.click();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ---------------------------------------------------------------- React overlay */
  function mountOverlay() {
    var React = window.React, ReactDOM = window.ReactDOM, htmLib = window.htm;
    var mount = document.getElementById("homeRoot");
    if (!React || !ReactDOM || !htmLib || !mount) return;
    var html = htmLib.bind(React.createElement);
    var useEffect = React.useEffect, useRef = React.useRef;

    var FEATURES = [
      { key: "life", glyph: "spark", title: "Life & counters", dot: "var(--mana-r)",
        body: "Tap-and-hold life totals, commander damage, poison, energy, and smart counters pulled from your decklist.", cta: "Open life counter" },
      { key: "deck", glyph: "layers", title: "Deck builder", dot: "var(--mana-u)",
        body: "Search every card on Scryfall, build and save decks, see your mana curve, and send a deck straight to the table.", cta: "Build a deck" },
      { key: "play", glyph: "hex", title: "Virtual tabletop", dot: "var(--mana-g)",
        body: "A full battlefield — draw, tap, drag, scry, mulligan, tokens, stack, and pods of up to four, solo or online.", cta: "Enter the table" }
    ];
    var FORMATS = ["Commander", "Draft", "Planechase", "20 Life"];

    function Reveal(props) {
      var ref = useRef(null);
      useEffect(function () {
        var el = ref.current; if (!el) return;
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) el.classList.add("in"); });
        }, { threshold: 0.25 });
        io.observe(el);
        return function () { io.disconnect(); };
      }, []);
      return html`<div ref=${ref} class=${"reveal " + (props.cls || "")}>${props.children}</div>`;
    }

    function App() {
      return html`
        <${React.Fragment}>
          <section class="home-section home-hero-sec">
            <div class="home-hero">
              <p class="home-eyebrow">Multiplayer tabletop · Magic: The Gathering</p>
              <h1 class="home-title foil-text">Sigil</h1>
              <p class="home-tagline">Your arcane table for every game — life totals, decks, and a full virtual battlefield, right in the browser.</p>
              <div class="home-cta">
                <button type="button" class="home-btn home-btn-ghost" onClick=${function () { go("life"); }}>Paper tracking</button>
                <button type="button" class="home-btn home-btn-primary" onClick=${function () { go("play"); }}>Enter the table</button>
                <button type="button" class="home-btn home-btn-ghost" onClick=${function () { go("deck"); }}>Build a deck</button>
              </div>
              <div class="home-formats">
                ${FORMATS.map(function (f) { return html`<button type="button" class="home-chip" key=${f} onClick=${function () { go("play"); }}>${f}</button>`; })}
              </div>
              <p class="home-scrollhint">scroll to explore ↓</p>
            </div>
          </section>

          <section class="home-section">
            <${Reveal} cls="home-band-head">
              <p class="home-kicker">Everything at the table</p>
              <h2 class="home-h2">One tab for the whole game</h2>
            <//>
            <div class="home-feature-grid">
              ${FEATURES.map(function (f, i) {
                return html`
                  <${Reveal} key=${f.key} cls=${"home-feature delay-" + i}>
                    <span class="home-feature-glyph" style=${{ "--dot": f.dot }} dangerouslySetInnerHTML=${{ __html: (window.MTGIcons ? MTGIcons.get(f.glyph, "1em") : "") }}></span>
                    <h3 class="home-feature-title">${f.title}</h3>
                    <p class="home-feature-body">${f.body}</p>
                    <button type="button" class="home-feature-link" onClick=${function () { go(f.key); }}>${f.cta + " →"}</button>
                  <//>
                `;
              })}
            </div>
          </section>

          <section class="home-section home-final">
            <${Reveal}>
              <p class="home-kicker">Nothing to install</p>
              <h2 class="home-h2">Gather your playgroup</h2>
              <p class="home-final-sub">Solo goldfish, hotseat pods, or online with friends. Sigil runs entirely in your browser.</p>
              <button type="button" class="home-btn home-btn-primary home-btn-lg" onClick=${function () { go("play"); }}>Enter the table</button>
            <//>
          </section>
        <//>
      `;
    }

    try {
      ReactDOM.createRoot(mount).render(html`<${App} />`);
      mount.classList.add("is-hydrated");
    } catch (err) { console.warn("[home] overlay render skipped:", err); }
  }

  /* ---------------------------------------------------------------- Three.js scene */
  function mountScene() {
    var THREE = window.THREE;
    var canvas = document.getElementById("homeCanvas");
    var sky = document.getElementById("homeSky");
    var stage = document.getElementById("homeStage");
    if (!THREE || !canvas || !sky || !stage) return;

    function sizeOf() { return { w: sky.clientWidth || window.innerWidth, h: sky.clientHeight || window.innerHeight }; }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !LOW_POWER, alpha: true, powerPreference: "high-performance" });
    } catch (err) { console.warn("[home] WebGL unavailable:", err); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070d1a, 0.05);

    var sz = sizeOf();
    var camera = new THREE.PerspectiveCamera(50, sz.w / sz.h, 0.1, 100);
    camera.position.set(0, 0, 6.6);

    // cheap image-based lighting from a navy gradient (no addons needed)
    (function () {
      var c = document.createElement("canvas"); c.width = 16; c.height = 128;
      var ctx = c.getContext("2d");
      var g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, "#34507e"); g.addColorStop(0.5, "#13223e"); g.addColorStop(1, "#0a1322");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 128);
      var tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping;
      try {
        var pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromEquirectangular(tex).texture;
        pmrem.dispose();
      } catch (e) { /* env optional */ }
      tex.dispose();
    })();

    var key = new THREE.DirectionalLight(0xdce8ff, 1.6); key.position.set(4, 6, 6); scene.add(key);
    var fill = new THREE.PointLight(0x6fb0ff, 0.9, 40); fill.position.set(-6, -2, 4); scene.add(fill);
    scene.add(new THREE.AmbientLight(0x2a3550, 0.8));
    var shimmer = new THREE.PointLight(0xbcd8ff, 1.2, 30); scene.add(shimmer);

    var world = new THREE.Group(); scene.add(world);

    /* ---------- canvas texture helpers ---------- */
    function roundRect(ctx, x, y, ww, hh, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath();
    }
    function hex(n) { return "#" + n.toString(16).padStart(6, "0"); }
    function mkTex(c) {
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    }
    function lighten(intC, amt) {
      var r = (intC >> 16) & 255, g = (intC >> 8) & 255, b = intC & 255;
      r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
      return "rgb(" + r + "," + g + "," + b + ")";
    }
    // stylised WUBRG mana symbols, drawn at the current ctx origin within radius ~s
    function drawManaSymbol(ctx, key, s, fill) {
      ctx.save();
      ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (key === "W") {
        for (var i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i / 8 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.6); ctx.lineTo(s * 0.1, -s * 0.6); ctx.lineTo(0, -s * 0.95); ctx.closePath(); ctx.fill(); ctx.restore(); }
        ctx.beginPath(); ctx.arc(0, 0, s * 0.46, 0, Math.PI * 2); ctx.fill();
      } else if (key === "U") {
        ctx.beginPath(); ctx.moveTo(0, -s * 0.88); ctx.bezierCurveTo(s * 0.72, -s * 0.2, s * 0.6, s * 0.72, 0, s * 0.8); ctx.bezierCurveTo(-s * 0.6, s * 0.72, -s * 0.72, -s * 0.2, 0, -s * 0.88); ctx.closePath(); ctx.fill();
      } else if (key === "B") {
        ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.56, Math.PI, 0); ctx.lineTo(s * 0.4, s * 0.34); ctx.lineTo(s * 0.2, s * 0.34); ctx.lineTo(s * 0.2, s * 0.56); ctx.lineTo(-s * 0.2, s * 0.56); ctx.lineTo(-s * 0.2, s * 0.34); ctx.lineTo(-s * 0.4, s * 0.34); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(8,14,26,0.92)";
        ctx.beginPath(); ctx.arc(-s * 0.23, -s * 0.06, s * 0.17, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.23, -s * 0.06, s * 0.17, 0, Math.PI * 2); ctx.fill();
      } else if (key === "R") {
        ctx.beginPath(); ctx.moveTo(0, -s * 0.92); ctx.bezierCurveTo(s * 0.55, -s * 0.3, s * 0.22, -s * 0.08, s * 0.32, s * 0.2); ctx.bezierCurveTo(s * 0.55, s * 0.62, s * 0.1, s * 0.86, 0, s * 0.86); ctx.bezierCurveTo(-s * 0.5, s * 0.86, -s * 0.56, s * 0.3, -s * 0.26, 0); ctx.bezierCurveTo(-s * 0.1, -s * 0.16, -s * 0.2, -s * 0.5, 0, -s * 0.92); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillRect(-s * 0.12, s * 0.1, s * 0.24, s * 0.62);
        ctx.beginPath(); ctx.arc(0, -s * 0.22, s * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-s * 0.36, s * 0.04, s * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.36, s * 0.04, s * 0.32, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // the Sigil mana-seal, drawn at the current ctx origin within radius ~s (used on card backs + dice)
    // matches the nav brand mark: glow + outer ring + pentagon + five WUBRG nodes
    function drawSigilSeal(ctx, s, ringColor, withGlow) {
      ctx.save();
      if (withGlow) {
        var gl = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.18);
        gl.addColorStop(0, "rgba(77,163,255,0.34)"); gl.addColorStop(1, "rgba(77,163,255,0)");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, s * 1.18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = ringColor; ctx.lineWidth = s * 0.05; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
      var rr = s * 0.92, pts = [];
      for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * 2 * Math.PI / 5; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      ctx.globalAlpha = 0.7; ctx.lineWidth = s * 0.04; ctx.beginPath();
      for (var j = 0; j < 5; j++) { var p = pts[j]; j === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); }
      ctx.closePath(); ctx.stroke();
      MANA_KEYS.forEach(function (mk, idx) {
        ctx.globalAlpha = 1; ctx.fillStyle = hex(MANA[mk]);
        ctx.beginPath(); ctx.arc(pts[idx][0], pts[idx][1], s * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = s * 0.025; ctx.strokeStyle = "#070d18"; ctx.stroke();
      });
      ctx.restore();
    }
    // transparent medallion (dark disc + seal) for the D20 face decal
    function logoTexture() {
      var c = document.createElement("canvas"); c.width = c.height = 256;
      var ctx = c.getContext("2d"); ctx.translate(128, 128);
      ctx.fillStyle = "rgba(7,13,26,0.5)"; ctx.beginPath(); ctx.arc(0, 0, 116, 0, Math.PI * 2); ctx.fill();
      drawSigilSeal(ctx, 100, "#a9d6ff", true);
      return mkTex(c);
    }
    function cardFaceTexture(key) {
      var colInt = MANA[key], colorHex = hex(colInt), symCol = lighten(colInt, 0.42);
      var c = document.createElement("canvas"); c.width = 512; c.height = 716;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#0b1322"; roundRect(ctx, 8, 8, 496, 700, 40); ctx.fill();
      ctx.lineWidth = 12; ctx.strokeStyle = "#7fb4e6"; roundRect(ctx, 22, 22, 468, 672, 32); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(159,208,255,0.6)"; roundRect(ctx, 34, 34, 444, 648, 26); ctx.stroke();
      ctx.fillStyle = "rgba(14,26,46,0.92)"; roundRect(ctx, 46, 48, 420, 64, 18); ctx.fill();
      ctx.strokeStyle = "rgba(120,170,230,0.5)"; ctx.lineWidth = 2; ctx.stroke();
      var ax = 46, ay = 128, aw = 420, ah = 360;
      var g = ctx.createRadialGradient(ax + aw / 2, ay + ah / 2, 20, ax + aw / 2, ay + ah / 2, 300);
      g.addColorStop(0, colorHex); g.addColorStop(0.5, "#101d33"); g.addColorStop(1, "#070d18");
      ctx.fillStyle = g; roundRect(ctx, ax, ay, aw, ah, 16); ctx.fill();
      ctx.strokeStyle = "rgba(120,170,230,0.5)"; ctx.lineWidth = 3; ctx.stroke();
      // mana symbol in the art window — hue matched to the card's shade
      ctx.save(); ctx.translate(ax + aw / 2, ay + ah / 2);
      ctx.shadowColor = colorHex; ctx.shadowBlur = 28; ctx.globalAlpha = 0.96;
      drawManaSymbol(ctx, key, 112, symCol);
      ctx.restore();
      ctx.fillStyle = "rgba(14,26,46,0.92)"; roundRect(ctx, 46, 506, 420, 44, 12); ctx.fill();
      ctx.strokeStyle = "rgba(120,170,230,0.45)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "rgba(238,244,255,0.2)";
      for (var j = 0; j < 5; j++) { roundRect(ctx, 60, 576 + j * 22, 392 - (j === 4 ? 120 : 0), 9, 5); ctx.fill(); }
      // mana pip in the title corner = small matching symbol
      ctx.save(); ctx.translate(440, 80);
      ctx.fillStyle = "rgba(8,16,30,0.92)"; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = symCol; ctx.stroke();
      drawManaSymbol(ctx, key, 13, symCol);
      ctx.restore();
      return mkTex(c);
    }
    function cardBackTexture() {
      var c = document.createElement("canvas"); c.width = 512; c.height = 716;
      var ctx = c.getContext("2d");
      var bg = ctx.createLinearGradient(0, 0, 512, 716); bg.addColorStop(0, "#142e4c"); bg.addColorStop(1, "#070d16");
      ctx.fillStyle = bg; roundRect(ctx, 8, 8, 496, 700, 40); ctx.fill();
      ctx.lineWidth = 10; ctx.strokeStyle = "#7fb4e6"; roundRect(ctx, 24, 24, 464, 668, 30); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(159,208,255,0.45)"; roundRect(ctx, 38, 38, 436, 640, 24); ctx.stroke();
      ctx.save(); ctx.translate(256, 322); drawSigilSeal(ctx, 150, "#9fc4ec", true); ctx.restore();
      ctx.fillStyle = "rgba(159,208,255,0.9)"; ctx.textAlign = "center";
      ctx.font = "700 50px Cinzel, Georgia, 'Times New Roman', serif";
      ctx.fillText("SIGIL", 256, 612);
      return mkTex(c);
    }
    function dieFaceTexture(n) {
      var c = document.createElement("canvas"); c.width = c.height = 256;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#eef2f8"; roundRect(ctx, 6, 6, 244, 244, 44); ctx.fill();
      ctx.strokeStyle = "#7fb4e6"; ctx.lineWidth = 6; ctx.stroke();
      ctx.fillStyle = "#0e1a2e";
      var A = 70, B = 128, Cc = 186, r = 20;
      function pip(x, y) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      var L = { 1: [[B, B]], 2: [[A, A], [Cc, Cc]], 3: [[A, A], [B, B], [Cc, Cc]], 4: [[A, A], [Cc, A], [A, Cc], [Cc, Cc]], 5: [[A, A], [Cc, A], [B, B], [A, Cc], [Cc, Cc]], 6: [[A, A], [Cc, A], [A, B], [Cc, B], [A, Cc], [Cc, Cc]] };
      (L[n] || []).forEach(function (p) { pip(p[0], p[1]); });
      return mkTex(c);
    }
    // the Sigil logo face used in place of the "1" on every D6
    function dieSigilTexture() {
      var c = document.createElement("canvas"); c.width = c.height = 256;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#eef2f8"; roundRect(ctx, 6, 6, 244, 244, 44); ctx.fill();
      ctx.strokeStyle = "#7fb4e6"; ctx.lineWidth = 6; ctx.stroke();
      ctx.save(); ctx.translate(128, 128); drawSigilSeal(ctx, 88, "#2f6aa8", false); ctx.restore();
      return mkTex(c);
    }
    function glowSprite(colorInt, scale) {
      var sg = document.createElement("canvas"); sg.width = sg.height = 128; var sx = sg.getContext("2d");
      var rgb = [(colorInt >> 16) & 255, (colorInt >> 8) & 255, colorInt & 255].join(",");
      var rg = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, "rgba(255,255,255,0.95)");
      rg.addColorStop(0.25, "rgba(" + rgb + ",0.95)");
      rg.addColorStop(0.6, "rgba(" + rgb + ",0.35)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      sx.fillStyle = rg; sx.fillRect(0, 0, 128, 128);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sg), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.setScalar(scale || 0.7);
      return sp;
    }

    var faceTextures = MANA_KEYS.map(function (k) { return cardFaceTexture(k); });
    var backTexture = cardBackTexture();
    var logoTex = logoTexture();
    var edgeMat = new THREE.MeshStandardMaterial({ color: 0x4a6c92, metalness: 0.7, roughness: 0.4 });

    /* ---------- floating cards ---------- */
    var cardGeo = new THREE.BoxGeometry(1.0, 1.4, 0.03);
    var COUNT = LOW_POWER ? 12 : 22;
    var cards = [];
    for (var ci = 0; ci < COUNT; ci++) {
      var faceTex = faceTextures[ci % faceTextures.length];
      var faceMat = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.35, roughness: 0.4, emissive: 0x0a1626, emissiveIntensity: 0.3 });
      var backMat = new THREE.MeshStandardMaterial({ map: backTexture, metalness: 0.4, roughness: 0.4 });
      var mesh = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, backMat]);
      var radius = 3.3 + Math.random() * 3.2, ang = Math.random() * Math.PI * 2;
      mesh.position.set(Math.cos(ang) * radius * 1.25, Math.sin(ang) * radius * 0.82, -2.6 + Math.random() * 3.8);
      mesh.rotation.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.5);
      var s = 0.66 + Math.random() * 0.5; mesh.scale.setScalar(s);
      mesh.userData = { type: "card", home: mesh.position.clone(), baseScale: s, targetScale: s,
        av: { x: 0, y: 0, z: 0 },
        baseSpin: { x: (Math.random() - 0.5) * 0.06, y: (0.22 + Math.random() * 0.3) * (Math.random() > 0.5 ? 1 : -1), z: (Math.random() - 0.5) * 0.05 },
        halfLife: 3.4, scrollGain: 1.6,
        bob: Math.random() * Math.PI * 2, bobAmp: 0.12 + Math.random() * 0.24, drift: 0.1 + Math.random() * 0.2, returning: false, flip: null };
      world.add(mesh); cards.push(mesh);
    }

    /* ---------- tumbling dice ---------- */
    var grabbable = cards.slice();
    function addD6(pos, scl) {
      var mats = [1, 6, 2, 5, 3, 4].map(function (n) { return new THREE.MeshStandardMaterial({ map: n === 1 ? dieSigilTexture() : dieFaceTexture(n), metalness: 0.1, roughness: 0.55 }); });
      var m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
      m.position.copy(pos); m.scale.setScalar(scl);
      m.userData = { type: "die", home: pos.clone(), baseScale: scl, targetScale: scl, returning: false, rollHop: 0,
        av: { x: (Math.random() - 0.5) * 2.5, y: (Math.random() - 0.5) * 2.5, z: (Math.random() - 0.5) * 2.5 },
        baseSpin: { x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 0.6 },
        halfLife: 3.0, scrollGain: 2.6,
        bob: Math.random() * 6, bobAmp: 0.2 + Math.random() * 0.2, drift: 0.3 + Math.random() * 0.3 };
      world.add(m); grabbable.push(m); return m;
    }
    function addD20(pos, scl) {
      var geo = new THREE.IcosahedronGeometry(0.62, 0).toNonIndexed();
      geo.computeVertexNormals();
      var mat = new THREE.MeshStandardMaterial({ color: 0x3a86d6, metalness: 0.45, roughness: 0.22, emissive: 0x12345e, emissiveIntensity: 0.7, flatShading: true });
      var m = new THREE.Mesh(geo, mat);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0xdbeaff, transparent: true, opacity: 0.85 })));
      m.add(glowSprite(0x3a86d6, 1.7));
      // engrave the Sigil mark on one face (decal plane aligned to that face's normal)
      var pa = geo.attributes.position;
      var va = new THREE.Vector3().fromBufferAttribute(pa, 0), vb = new THREE.Vector3().fromBufferAttribute(pa, 1), vc = new THREE.Vector3().fromBufferAttribute(pa, 2);
      var ctr = new THREE.Vector3().addVectors(va, vb).add(vc).multiplyScalar(1 / 3);
      var nrm = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va)).normalize();
      if (nrm.dot(ctr) < 0) nrm.negate();
      var decal = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false }));
      decal.position.copy(ctr).addScaledVector(nrm, 0.016);
      decal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
      m.add(decal);
      m.position.copy(pos); m.scale.setScalar(scl);
      m.userData = { type: "die", home: pos.clone(), baseScale: scl, targetScale: scl, returning: false, rollHop: 0,
        av: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 },
        baseSpin: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5, z: (Math.random() - 0.5) * 0.5 },
        halfLife: 3.0, scrollGain: 2.6,
        bob: Math.random() * 6, bobAmp: 0.25, drift: 0.25 };
      world.add(m); grabbable.push(m); return m;
    }
    addD20(new THREE.Vector3(3.0, 1.4, 0.9), 1.28);
    addD6(new THREE.Vector3(-3.1, -1.5, 0.9), 0.7);
    addD6(new THREE.Vector3(3.5, -2.0, -0.3), 0.56);
    if (!LOW_POWER) { addD20(new THREE.Vector3(-3.6, 2.1, -0.5), 0.74); addD6(new THREE.Vector3(1.6, 2.6, 0.2), 0.52); }

    /* ---------- mana-pentad sigil ---------- */
    var sigil = new THREE.Group(); world.add(sigil);
    var R = 1.35;
    sigil.add(new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.035, 16, 96), new THREE.MeshStandardMaterial({ color: 0x9fc4ec, metalness: 0.9, roughness: 0.25, emissive: 0x1b4a78, emissiveIntensity: 0.55 })));
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(R - 0.22, 0.02, 12, 80), new THREE.MeshStandardMaterial({ color: 0x9fc4ec, metalness: 0.9, roughness: 0.3, emissive: 0x163a64, emissiveIntensity: 0.45 }));
    sigil.add(ring2);
    var vert = [];
    for (var vi = 0; vi < 5; vi++) { var va = Math.PI / 2 - (vi * 2 * Math.PI) / 5; vert.push(new THREE.Vector3(Math.cos(va) * R, Math.sin(va) * R, 0)); }
    var linePts = [];
    for (var li = 0; li < 5; li++) { linePts.push(vert[(li * 2) % 5]); linePts.push(vert[((li * 2) + 2) % 5]); }
    sigil.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x6fa8e0, transparent: true, opacity: 0.55 })));
    var orbs = [];
    MANA_KEYS.forEach(function (mk, idx) {
      var col = MANA[mk];
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), new THREE.MeshBasicMaterial({ color: col }));
      orb.position.copy(vert[idx]); sigil.add(orb);
      orb.add(glowSprite(col, 1.6)); orbs.push(orb);
    });
    sigil.position.set(0, -0.45, -1.15); sigil.scale.setScalar(1.0);

    /* ---------- dust motes ---------- */
    var motes;
    (function () {
      var N = LOW_POWER ? 260 : 640; var pos = new Float32Array(N * 3);
      for (var i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 20; pos[i * 3 + 1] = (Math.random() - 0.5) * 14; pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2; }
      var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      var dot = document.createElement("canvas"); dot.width = dot.height = 64; var dx = dot.getContext("2d");
      var dg = dx.createRadialGradient(32, 32, 0, 32, 32, 32); dg.addColorStop(0, "rgba(180,214,255,0.95)"); dg.addColorStop(1, "rgba(180,214,255,0)");
      dx.fillStyle = dg; dx.fillRect(0, 0, 64, 64);
      motes = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
      scene.add(motes);
    })();

    /* ---------- interaction ---------- */
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var dragging = null, hovered = null, dragMoved = false;
    var downClient = { x: 0, y: 0 }, downT = 0;
    var dragPlane = new THREE.Plane(), dragPoint = new THREE.Vector3(), grabOffset = new THREE.Vector3();
    var lastPx = 0, lastPy = 0;
    var Y_AXIS = new THREE.Vector3(0, 1, 0);
    function setNDC(e) { var r = canvas.getBoundingClientRect(); ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1; pointer.tx = ndc.x; pointer.ty = ndc.y; }
    // a tap (no drag): cards flip front<->back, dice roll
    function triggerClick(obj) {
      var u = obj.userData;
      if (u.type === "die") {
        // roll more: a big random tumble impulse + a hop
        u.av.x += (Math.random() - 0.5) * 26; u.av.y += (Math.random() - 0.5) * 26; u.av.z += (Math.random() - 0.5) * 26;
        u.rollHop = 0.6;
      } else {
        // flip front<->back, and keep it spinning a bit faster
        if (!u.flip) { var q180 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI); u.flip = { from: obj.quaternion.clone(), to: obj.quaternion.clone().multiply(q180), t: 0 }; }
        u.av.y += (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 3);
      }
    }
    // The canvas is a fixed body-level backdrop BEHIND .app-shell, so it never receives pointer
    // events directly. Listen on window and raycast from client coords; ignore events that land on
    // real controls (nav / buttons / chips) so those keep working.
    var INTERACTIVE = "button, a, input, select, textarea, label, summary, .home-chip, .home-feature, .app-nav";
    function onDown(e) {
      if (!isHome() || document.visibilityState === "hidden") return;
      if (e.target && e.target.closest && e.target.closest(INTERACTIVE)) return;
      setNDC(e); raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(grabbable, false)[0]; hit = hit && hit.object;
      if (!hit) return;
      dragging = hit; dragMoved = false; downClient.x = e.clientX; downClient.y = e.clientY; downT = e.timeStamp || 0;
      hit.userData.returning = false;
      camera.getWorldDirection(dragPlane.normal); dragPlane.normal.negate(); dragPlane.setFromNormalAndCoplanarPoint(dragPlane.normal, hit.position);
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) grabOffset.copy(hit.position).sub(dragPoint);
      lastPx = ndc.x; lastPy = ndc.y;
    }
    function onMove(e) {
      setNDC(e);
      if (!dragging) return;
      if (!dragMoved && Math.abs(e.clientX - downClient.x) + Math.abs(e.clientY - downClient.y) > 10) {
        dragMoved = true; document.body.style.cursor = "grabbing"; dragging.userData.flip = null;
      }
      if (dragMoved) {
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) dragging.position.copy(dragPoint).add(grabOffset);
        var dxr = (ndc.x - lastPx) * 2.6, dyr = -(ndc.y - lastPy) * 2.6;
        dragging.rotation.y += dxr; dragging.rotation.x += dyr;
        dragging.userData.av.y = dxr * 60; dragging.userData.av.x = dyr * 60; // flick → spin momentum
      }
      lastPx = ndc.x; lastPy = ndc.y;
    }
    function onUp(e) {
      if (dragging) {
        var moved = Math.abs(e.clientX - downClient.x) + Math.abs(e.clientY - downClient.y);
        var quick = ((e.timeStamp || 0) - downT) < 220;
        if (moved < 14 || quick) triggerClick(dragging); else dragging.userData.returning = true;
        dragging = null;
      }
      document.body.style.cursor = isHome() ? "grab" : "";
    }
    if (!REDUCE_MOTION) { window.addEventListener("pointerdown", onDown); window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); }

    /* ---------- scroll progress ---------- */
    var scrollT = 0, lastScrollT = 0;
    function readScroll() {
      var rect = stage.getBoundingClientRect();
      var denom = rect.height - window.innerHeight;
      scrollT = denom > 0 ? Math.min(1, Math.max(0, -rect.top / denom)) : 0;
    }
    window.addEventListener("scroll", readScroll, { passive: true });

    /* ---------- resize ---------- */
    function resize() { var s = sizeOf(); if (!s.w || !s.h) return; renderer.setSize(s.w, s.h, false); camera.aspect = s.w / s.h; camera.updateProjectionMatrix(); }
    resize();
    var ro = ("ResizeObserver" in window) ? new ResizeObserver(resize) : null; if (ro) ro.observe(sky);
    window.addEventListener("resize", resize);

    /* ---------- loop ---------- */
    var clock = new THREE.Clock();
    var raf = 0, running = false, ctxLost = false;
    var tmpQ = new THREE.Quaternion();

    function frame() {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05);
      // loop stays alive across tab switches; just skip the work when Home isn't visible
      if (ctxLost || !isHome() || document.visibilityState === "hidden") return;
      var t = clock.getElapsedTime();
      readScroll();
      var sv = scrollT - lastScrollT; lastScrollT = scrollT; // scroll velocity drives rolling/spinning
      if (sv > 0.08) sv = 0.08; else if (sv < -0.08) sv = -0.08;

      pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
      var sBoost = scrollT;
      world.rotation.y += ((pointer.x * 0.32 + sBoost * 0.5) - world.rotation.y) * 0.04;
      world.rotation.x += ((-pointer.y * 0.2 + sBoost * 0.12) - world.rotation.x) * 0.04;
      camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.04;
      camera.position.y += (pointer.y * 0.4 - camera.position.y) * 0.04;
      var targZ = 6.6 + sBoost * 3.4; camera.position.z += (targZ - camera.position.z) * 0.05;
      camera.lookAt(0, -sBoost * 0.6, -0.5);

      shimmer.position.set(Math.cos(t * 0.6) * 5, Math.sin(t * 0.5) * 4, 4 + Math.sin(t * 0.4) * 2);
      sigil.rotation.z = t * 0.12; ring2.rotation.z = -t * 0.3;
      orbs.forEach(function (o, i) { o.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.12); });

      if (!dragging && !COARSE) {
        raycaster.setFromCamera(ndc, camera);
        var h = raycaster.intersectObjects(grabbable, false)[0]; h = h ? h.object : null;
        if (h !== hovered) {
          if (hovered) hovered.userData.targetScale = hovered.userData.baseScale;
          hovered = h;
          if (hovered) hovered.userData.targetScale = hovered.userData.baseScale * 1.16;
          document.body.style.cursor = hovered ? "pointer" : "grab";
        }
      }

      grabbable.forEach(function (c) {
        var u = c.userData;
        if (c === dragging && dragMoved) {
          // following the pointer (onMove sets position/rotation + flick momentum)
        } else if (u.flip) {
          u.flip.t = Math.min(1, u.flip.t + dt / 0.55);
          var ft = u.flip.t, e2 = ft < 0.5 ? 2 * ft * ft : 1 - Math.pow(-2 * ft + 2, 2) / 2;
          tmpQ.copy(u.flip.from).slerp(u.flip.to, e2); c.quaternion.copy(tmpQ);
          c.position.y = u.home.y + Math.sin(ft * Math.PI) * 0.28;
          if (ft >= 1) { c.quaternion.copy(u.flip.to); c.position.y = u.home.y; u.flip = null; }
        } else {
          // scroll velocity feeds the angular velocity, so it keeps spinning after you stop (low gravity)
          if (sv) {
            var sg = sv * u.scrollGain;
            u.av.y += sg;
            if (u.type === "die") { u.av.x += sg * 0.7; u.av.z += sg * 0.5; }
          }
          // clamp so sustained scrolling can't wind it up indefinitely
          var cap = u.type === "die" ? 11 : 9;
          if (u.av.x > cap) u.av.x = cap; else if (u.av.x < -cap) u.av.x = -cap;
          if (u.av.y > cap) u.av.y = cap; else if (u.av.y < -cap) u.av.y = -cap;
          if (u.av.z > cap) u.av.z = cap; else if (u.av.z < -cap) u.av.z = -cap;
          // constant slow base spin + the slowly-decaying momentum
          c.rotation.x += (u.baseSpin.x + u.av.x) * dt;
          c.rotation.y += (u.baseSpin.y + u.av.y) * dt;
          c.rotation.z += (u.baseSpin.z + u.av.z) * dt;
          var decay = Math.pow(0.5, dt / u.halfLife);
          u.av.x *= decay; u.av.y *= decay; u.av.z *= decay;
          if (u.returning) {
            c.position.lerp(u.home, 0.05);
            if (c.position.distanceTo(u.home) < 0.04) u.returning = false;
          } else {
            u.bob += dt * u.drift;
            if (u.rollHop && u.rollHop > 0.01) u.rollHop *= 0.9; else u.rollHop = 0;
            c.position.y = u.home.y + Math.sin(u.bob) * u.bobAmp + (u.rollHop || 0);
          }
        }
        var cur = c.scale.x + (u.targetScale - c.scale.x) * 0.12; c.scale.setScalar(cur);
      });

      if (motes) motes.rotation.y = t * 0.02;
      renderer.render(scene, camera);
    }
    // Persistent loop — started once and never cancelled (frame() self-gates on isHome()).
    function startLoop() { if (running) return; running = true; clock.start(); clock.getDelta(); raf = requestAnimationFrame(frame); }

    function isHome() { var hp = document.getElementById("homePage"); return document.body.classList.contains("on-home") || (hp && hp.classList.contains("active")); }
    // After the canvas sat in a display:none tab, its compositor layer can go stale: the WebGL
    // buffer still renders but never paints to screen, so the canvas looks invisible. A genuine
    // size change (1px -> full) forces the browser to allocate a fresh layer; then render now.
    function forceRefresh() {
      var s = sizeOf();
      if (!s.w || !s.h || ctxLost || !isHome() || document.visibilityState === "hidden") return;
      renderer.setSize(1, 1, false);
      renderer.setSize(s.w, s.h, false);
      camera.aspect = s.w / s.h; camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }
    function sync() {
      readScroll();
      if (!isHome()) document.body.style.cursor = "";
      if (!REDUCE_MOTION) startLoop();
      forceRefresh();
    }
    // A tab switch back to Home can land before layout/compositor settle — refresh a few times.
    function resync() { sync(); requestAnimationFrame(forceRefresh); setTimeout(forceRefresh, 90); setTimeout(forceRefresh, 320); setTimeout(forceRefresh, 650); }
    window.addEventListener("mtg-page-changed", resync);
    document.addEventListener("visibilitychange", resync);
    // Recover from GPU context loss (real browsers can drop the WebGL context while the canvas is hidden).
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); ctxLost = true; }, false);
    canvas.addEventListener("webglcontextrestored", function () { ctxLost = false; forceRefresh(); }, false);
    resync();
    setTimeout(resize, 520);
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-home-go]");
      if (b) go(b.getAttribute("data-home-go"));
    });
    mountOverlay();
    mountScene();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
