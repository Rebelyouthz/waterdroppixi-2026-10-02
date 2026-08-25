// Waterdrop Survivor â€” PixiJS (WebGL) renderer.
// Faithful 1:1 visual conversion of the old Canvas2D render() pipeline.
// All GAME LOGIC/STATE lives in engine.js (untouched) â€” this file is PURE
// drawing: it reads the Game instance's pooled state every frame and paints
// it using PixiJS Graphics/Text, layered to match the original z-order.
// `Texture` left this import with the normal-map baking — litShading.js owns
// that now and nothing else in this file constructs one.
import { Application, Container, Graphics, Text, TextStyle, FillGradient, Sprite, Filter, defaultFilterVert, ColorMatrixFilter, ParticleContainer, Particle, Rectangle } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { WEAPONS } from './data';
import { heroHalfPoints, HERO_COLORS } from './heroShape';
import { HeroAnim } from './heroAnim';
// The hero's face, arms and held weapon live in heroDraw.js so the intro film
// can draw the SAME character the run does — see that file's header. `rot`
// and `rotPoly` moved with them; they are re-imported here so all 48 call
// sites in this file are untouched.
// `drawLegs` is deliberately NOT imported here yet. Giving the RUN legs means
// giving it a HeroGait and re-tuning the walk against live input, and that is a
// gameplay-feel change that has to be played, not screenshotted. The station
// room is where the gait is being reviewed first.
import { rot, rotPoly, drawHeldWeapon, drawArms, drawHeroFace, drawHeadband } from './heroDraw';
// The ONE approved lighting technique — the baked normal maps, the shared
// per-pixel GLSL shader, and the uniform feed. Lifted out of this file so the
// walkable station room renders through exactly the same code path; see
// litShading.js's header for why a second copy was not an option.
import { LIT_FRAGMENT, buildNormalLitTextures, makeLitFilter, updateLitUniforms } from './litShading';

const TAU = Math.PI * 2;

// Restored 2026-08-18: these two were collateral damage when `rot`/`rotPoly`
// were moved out to heroDraw.js — they sat between them in the same block.
// `hexToRgb01` is byte-identical to engine.js's `hexToRgb01Local`, which its
// own comment describes as a copy of this one.
function hexToRgb01(hex) {
  const h = (hex || '#ffffff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16) || 0xffffff;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Blend hex colour `a` toward `b` by `t` (0..1), returning a hex string.
// Every call site is a "push this toward white / toward the flash colour"
// lighten, e.g. mixHex(litColor, '#ffffff', 0.25).
function mixHex(a, b, t) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const pa = (hex) => {
    const h = (hex || '#000000').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const A = pa(a), B = pa(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

function rotEllipsePoly(cx, cy, ang, rx, ry, segs = 14) {
  const out = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * TAU;
    const [x, y] = rot(Math.cos(a) * rx, Math.sin(a) * ry, ang);
    out.push(cx + x, cy + y);
  }
  return out;
}
// soft glow approximation (Canvas shadowBlur has no Pixi Graphics equivalent) â€”
// PERF: single layer only (halved from 2) since this is called per-entity,
// every frame, and entity count scales heavily during sustained combat.
function glow(g, x, y, r, color, strength = 1) {
  g.circle(x, y, r * 1.7).fill({ color, alpha: 0.16 * strength });
}

// ---- Boss guide-arrow pixel-dissolve shape (precomputed once) ----
function pointInTri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}
function buildArrowPixelGrid() {
  const pts = [];
  const step = 2.2;
  for (let lx = -10; lx <= 20; lx += step) {
    for (let ly = -14; ly <= 14; ly += step) {
      const inA = pointInTri(lx, ly, 20, 0, -10, 14, -4, 0);
      const inB = pointInTri(lx, ly, 20, 0, -4, 0, -10, -14);
      if (inA || inB) {
        const delay = ((lx + 10) / 30) * 0.6; // 0 at tail -> 0.6 at tip
        pts.push({ lx, ly, delay });
      }
    }
  }
  return pts;
}
const BOSS_ARROW_PIXELS = buildArrowPixelGrid();

// ---- Held-weapon models ----------------------------------------------------
// One entry per manual weapon. `parts` are local-space boxes drawn back to
// front in the aim direction (+X is down the barrel, +Y is down), so adding a
// weapon is a data entry rather than new drawing code. `muzzle` is how far
// along +X the barrel ends, which the muzzle flash and hot-tip glow use.
const WEAPON_MODELS = {
  // THE KATANA. Timmy, 2026-08-19: "de ser konstigt ut när han håller både en
  // katana å en gevär i handen samtidigt."
  //
  // He was seeing exactly that, and this is why: the katana had no entry here,
  // so `WEAPON_MODELS[sw.wid] || WEAPON_MODELS._default` handed him the default
  // GUN, while the blade itself only ever existed as a `katanaSlash` particle
  // (see that branch near the bottom of this file). Two weapons on screen, one
  // of them a fallback nobody meant to equip. Nothing threw — the fallback is
  // there precisely so an unmodelled weapon still renders something.
  //
  // Giving it a real model is also the prerequisite for the blood work he asked
  // for in the same breath: a blade that "droppar å rinner" and "blir mer å mer
  // blodig" needs an actual blade object for it to accumulate on.
  //
  // `muzzle` is the blade TIP rather than a barrel, so the recoil glow at the
  // call site reads as light catching the edge mid-swing. Costs nothing extra.
  katana: {
    accent: '#dce8f2', muzzle: 36,
    parts: [
      // Wrapped hilt (tsuka): dark cord over dark wood.
      [-11, -1.7, 11, 3.4, '#17110c'],
      [-9.5, -1.9, 2, 3.8, '#3b2f22'], [-6, -1.9, 2, 3.8, '#3b2f22'],
      [-2.5, -1.9, 2, 3.8, '#3b2f22'],
      // Pommel cap.
      [-12.5, -2.2, 1.8, 4.4, '#6b5a2e'],
      // Guard (tsuba) — the one wide element, and what makes the silhouette
      // read as a sword rather than as a stick at a glance.
      [0.6, -4.6, 2.6, 9.2, '#6b5a2e'],
      [0.6, -4.6, 2.6, 2.0, '#a08a4a'],
      // Blade: body, bright spine, and a hot edge along the bottom.
      [3.4, -1.6, 29, 3.2, '#aebecd'],
      [3.4, -1.6, 29, 1.1, '#eef6ff'],
      [3.4, 0.9, 29, 0.7, '#f8fdff', 0.75],
      // Tip, stepped down twice so it tapers inside a box-only model.
      [32.2, -1.2, 3.0, 2.4, '#c6d6e4'],
      [35.0, -0.8, 2.2, 1.6, '#eef6ff'],
    ],
  },
  hydropistol: {
    accent: '#6cb4ff', muzzle: 30, slide: [5, -5, 10, 2.8], slideColor: '#3a4658',
    parts: [
      [-6, -3, 8, 6, '#1f2632'], [-2, 3, 4, 6, '#0f141c'],
      [2, -3, 14, 6, '#3a4658'], [8, 3, 4, 7, '#11161e'],
      [4, -5, 9, 2, '#11161e'], [16, -1.6, 12, 3.2, '#2a313d'],
      [27, -2.4, 2.5, 4.8, '#0a0d12'], [3, -0.6, 12, 1.2, '#6cb4ff', 0.85],
    ],
  },
  // Heavy, slab-sided, obviously big. Long ported barrel and a fat slide.
  desertEagle: {
    accent: '#ffd166', muzzle: 36, slide: [4, -6, 15, 3.4], slideColor: '#6a5a3a',
    parts: [
      [-7, -4, 9, 8, '#2a2418'], [-4, 4, 5, 9, '#171207'],
      [2, -4.6, 20, 9.2, '#8a7645'], [9, 4, 5, 8, '#171207'],
      [4, -6.6, 15, 2.4, '#a8935c'], [22, -2.6, 13, 5.2, '#6a5a3a'],
      [24, -3.4, 2, 1.6, '#171207'], [28, -3.4, 2, 1.6, '#171207'],
      [34, -3.2, 2.6, 6.4, '#0d0a04'],
      [3, -1.0, 17, 1.6, '#ffd166', 0.6],
    ],
  },
  // Recurve bow — see the 'bow' branch in _drawHeldWeapon for the limbs and
  // string; the boxes here are only the riser and grip.
  bow: {
    accent: '#c8a05a', muzzle: 20, kind: 'bow', limb: 15,
    parts: [
      [-1, -3.5, 5, 7, '#6b4a22'], [0, 3, 3, 6, '#3a2610'],
      [4, -1.2, 7, 2.4, '#8a6a34'],
    ],
  },
  daggers: {
    accent: '#b9f0ff', muzzle: 22,
    parts: [
      [-4, -2, 7, 4, '#2a3038'], [2, -1.4, 15, 2.8, '#c8dbe8'],
      [16, -0.9, 6, 1.8, '#eaf6ff'], [1, -3.2, 3, 6.4, '#4a5560'],
    ],
  },
  flameburst: {
    accent: '#ff7a1a', muzzle: 32,
    parts: [
      [-7, -3.6, 9, 7.2, '#3a201a'], [-3, 3, 4, 7, '#170b06'],
      [2, -4, 16, 8, '#5a2c14'], [18, -3, 12, 6, '#7a3a18'],
      [29, -3.6, 3, 7.2, '#1a0c04'], [3, -1, 14, 2, '#ff7a1a', 0.7],
    ],
  },
  icespike: {
    accent: '#8fe6ff', muzzle: 34,
    parts: [
      [-6, -3, 8, 6, '#1a2e38'], [-2, 3, 4, 6, '#0a161c'],
      [2, -3.4, 15, 6.8, '#2a4a58'], [17, -2, 15, 4, '#3f6d80'],
      [31, -2.6, 2.4, 5.2, '#0a161c'], [3, -0.8, 26, 1.6, '#8fe6ff', 0.75],
    ],
  },
  sniperDrop: {
    accent: '#4dffd4', muzzle: 46,
    parts: [
      [-9, -2.6, 11, 5.2, '#20262e'], [-4, 2.6, 4, 8, '#0d1116'],
      [2, -3, 18, 6, '#2a3a44'], [6, -6.4, 12, 3, '#11161e'],
      [20, -1.6, 22, 3.2, '#39505c'], [41, -2.2, 3, 4.4, '#0a0d12'],
      [7, -7.6, 9, 1.6, '#4dffd4', 0.8],
    ],
  },
  stormLance: {
    accent: '#fff44d', muzzle: 40,
    parts: [
      [-7, -3, 9, 6, '#2a2a3a'], [-3, 3, 4, 7, '#12121c'],
      [2, -3.4, 13, 6.8, '#3a3a55'], [15, -2.2, 20, 4.4, '#4a4a70'],
      [34, -3.4, 3, 6.8, '#12121c'],
      [4, -1, 29, 2, '#fff44d', 0.7],
    ],
  },
  _default: {
    accent: '#6cb4ff', muzzle: 30, slide: [5, -5, 10, 2.8], slideColor: '#3a4658',
    parts: [
      [-6, -3, 8, 6, '#1f2632'], [-2, 3, 4, 6, '#0f141c'],
      [2, -3, 14, 6, '#3a4658'], [8, 3, 4, 7, '#11161e'],
      [16, -1.6, 12, 3.2, '#2a313d'], [27, -2.4, 2.5, 4.8, '#0a0d12'],
    ],
  },
};

const PET_COLORS = {
  aquaSprite: '#5ba3ff', emberFairy: '#ff7a1a', shadowWisp: '#b362ff',
  stormHawk: '#ffe44d', lifeSprite: '#4dffd4',
};

export class PixiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    // Only ONE renderer may own a canvas at a time.
    //
    // init() is async but destroy() is deferred into readyPromise.then(), so
    // an old renderer and a new one can overlap on the same <canvas> element.
    // Both app.init({canvas}) calls resolve getContext() to the SAME WebGL
    // context, so when the OLD renderer's deferred teardown finally runs it
    // destroys the context — and, with removeView, the canvas element — that
    // the LIVE renderer is drawing into. The result is a black canvas under a
    // perfectly healthy React HUD, with nothing thrown anywhere. Whether it
    // happens at all depends on which init resolves first, which is why it
    // came and went between reloads.
    //
    // Claiming ownership here lets the superseded renderer detect that it no
    // longer owns the canvas and skip the teardown entirely (see destroy()).
    const prev = canvas && canvas.__wdRenderer;
    if (prev && prev !== this) prev._superseded = true;
    if (canvas) canvas.__wdRenderer = this;
    this.app = new Application();
    this.ready = false;
    // The character's animation rig (game/heroAnim.js). Owned by the renderer
    // because it is pure presentation — the engine must not know it exists.
    // Created here rather than in _buildLayers so it survives a resize.
    this.heroAnim = new HeroAnim();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
    this._pendingSize = null;
    // Pixi v8's init() dynamically imports its browser-environment chunk, so
    // starting the renderer makes a NETWORK request. On a weak link that
    // request just fails ("Loading chunk ... failed"), init() rejects, and the
    // canvas never draws a frame — observed on a phone over flaky wifi, and
    // the most likely explanation for the black screen being intermittent.
    //
    // A chunk fetch is exactly the kind of failure worth retrying: it is
    // transient by nature and the second attempt is usually served from a
    // warm connection. Bounded at 3 tries with a short backoff so a genuinely
    // offline device still fails fast and reports, rather than hanging.
    const initOnce = () => this.app.init({
      canvas, width: w, height: h, resolution: this.dpr, autoDensity: true,
      backgroundColor: 0x06040a, antialias: true, preference: 'webgl',
    });
    const initWithRetry = async () => {
      let lastErr;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await initOnce();
        } catch (err) {
          lastErr = err;
          // Only retry transient LOADING failures. A shader that won't
          // compile or a device with no WebGL will fail identically every
          // time, and retrying it just delays the report by a second.
          const msg = (err && (err.message || String(err))) || '';
          if (!/loading chunk|dynamically imported|failed to fetch|networkerror|importing a module script/i.test(msg)) throw err;
          if (attempt < 3) {
            this._retried = attempt;
            await new Promise(r => setTimeout(r, 350 * attempt));
          }
        }
      }
      throw lastErr;
    };
    this.readyPromise = initWithRetry().then(() => {
      this._buildLayers();
      this.ready = true;
      this._watchContext();
      if (this._pendingSize) { this.resize(this._pendingSize.w, this._pendingSize.h); this._pendingSize = null; }
    }).catch((err) => {
      // This chain had no .catch(). If app.init() rejected — no WebGL context,
      // a driver refusing the requested attributes — or _buildLayers() threw
      // on a shader that won't compile, the rejection went nowhere: `ready`
      // stayed false, draw() returned early forever, and the canvas simply
      // never got a single frame. The React HUD renders independently, so the
      // result was a fully-populated HUD over a black world with nothing in
      // the console, which is unactionable on a phone.
      this.ready = false;
      this._fatal('renderer init', err);
    });
  }

  // On-screen render state, for diagnosing a black canvas on a device with no
  // usable console. Opt in with ?debug=1 — it costs nothing otherwise.
  //
  // This exists because "black world, working HUD" has at least five distinct
  // causes that look identical from the outside: a dead context, a torn-down
  // Application, a zero-sized canvas, a camera pointed at empty world, or a
  // stage with nothing in it. The numbers below separate them in one glance.
  _debugReadout(game) {
    if (this._dbgOff) return;
    if (this._dbg === undefined) {
      this._dbg = null; this._dbgOff = true;
      try {
        if (!/[?&]debug=1/.test(window.location.search)) return;
      } catch (e) { return; }
      this._dbgOff = false;
      const el = document.createElement('div');
      el.setAttribute('data-testid', 'renderer-debug');
      el.style.cssText = [
        'position:fixed', 'left:4px', 'top:4px', 'z-index:99998',
        'background:#000000d0', 'color:#7dffc4', 'font:10px/1.3 monospace',
        'padding:5px 7px', 'white-space:pre', 'pointer-events:none',
        'border:1px solid #7dffc455', 'max-width:70vw',
      ].join(';');
      document.body.appendChild(el);
      this._dbg = el;
    }
    if (!this._dbg) return;
    // Every 12th frame — this is a text node update, not a redraw, but there
    // is no reason to touch the DOM 60 times a second.
    this._dbgN = (this._dbgN || 0) + 1;
    if (this._dbgN % 12) return;
    const c = this.canvas, p = game.player;
    const zoom = game.viewZoom ? game.viewZoom() : 1;
    const sx = Math.round((p.x - game.cam.x) / zoom), sy = Math.round((p.y - game.cam.y) / zoom);
    const onScreen = sx >= 0 && sx <= game.W && sy >= 0 && sy <= game.H;
    this._dbg.textContent =
      `t=${game.run.time.toFixed(1)} zoom=${zoom.toFixed(2)} WH=${game.W}x${game.H}\n` +
      `canvas css=${c.clientWidth}x${c.clientHeight} buf=${c.width}x${c.height}\n` +
      `cam=${Math.round(game.cam.x)},${Math.round(game.cam.y)} plr=${Math.round(p.x)},${Math.round(p.y)}\n` +
      `plrScreen=${sx},${sy} ${onScreen ? 'ON' : '*** OFF-SCREEN ***'}\n` +
      `stage=${this.app.stage.children.length} world=${this.world ? this.world.children.length : '-'} ` +
      `zoomRoot=${this.zoomRoot ? this.zoomRoot.scale.x.toFixed(2) : '-'}\n` +
      `enemies=${game.enemies && game.enemies.active ? game.enemies.active.length : '?'} ready=${this.ready}`;
  }

  // Report a fatal renderer failure somewhere a phone user can actually read
  // it. There is no console on iOS Safari without a Mac attached, and the
  // symptom (black canvas, working HUD) looks identical for every possible
  // cause, so the message has to reach the screen or it reaches nobody.
  _fatal(stage, err) {
    const msg = (err && (err.message || String(err))) || 'unknown error';
    // eslint-disable-next-line no-console
    console.error('[pixi ' + stage + ']', err);
    if (typeof document === 'undefined' || this._fatalEl) return;
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'renderer-fatal');
    el.style.cssText = [
      'position:fixed', 'inset:auto 8px 8px 8px', 'z-index:99999',
      'background:#1a0408f2', 'border:2px solid #ff3146', 'color:#ffd7dc',
      'font:12px/1.35 monospace', 'padding:10px 12px', 'white-space:pre-wrap',
      'max-height:42vh', 'overflow:auto', 'border-radius:4px',
    ].join(';');
    // A chunk-load failure is a DOWNLOAD problem, not a graphics problem, and
    // saying "renderer failed" for it sends you hunting the wrong thing —
    // which is what happened here. Name it for what it is and offer the one
    // action that actually fixes it.
    const isLoad = /loading chunk|dynamically imported|failed to fetch|networkerror|importing a module script/i.test(msg);
    el.textContent = isLoad
      ? 'COULD NOT DOWNLOAD THE GAME\n\n' +
        'Part of the game failed to download from the server — this is a\n' +
        'connection problem, not your device.' +
        (this._retried ? '\nRetried ' + this._retried + 'x already.' : '') +
        '\n\nTap here to reload.\n\n' + msg
      : 'RENDERER FAILED (' + stage + ')\n' + msg +
        '\n\nWebGL2: ' + this._probeWebGL() +
        '\nUA: ' + (navigator.userAgent || '').slice(0, 120);
    if (isLoad) {
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => window.location.reload());
    }
    document.body.appendChild(el);
    this._fatalEl = el;
  }

  // Independent probe, so the overlay can distinguish "this device has no
  // WebGL2 at all" from "WebGL2 exists but something in our own setup threw".
  _probeWebGL() {
    try {
      const c = document.createElement('canvas');
      if (c.getContext('webgl2')) return 'yes';
      if (c.getContext('webgl')) return 'webgl1 only';
      return 'NO';
    } catch (e) { return 'probe threw: ' + e.message; }
  }

  // A lost WebGL context is the other way this ends up as a black canvas with
  // a live HUD, and it is far more likely on a phone: iOS reclaims contexts
  // under memory pressure with no warning. The default action on
  // `webglcontextlost` is to make the loss permanent — it MUST be
  // preventDefault()'d for the browser to ever fire `webglcontextrestored`.
  _watchContext() {
    const c = this.canvas;
    if (!c || this._ctxWatched) return;
    this._ctxWatched = true;
    this._onCtxLost = (e) => {
      e.preventDefault();          // without this, restore never fires
      this.ready = false;
      this._fatal('webgl context lost', new Error(
        'The GPU dropped this page\'s WebGL context (usually memory pressure). ' +
        'Waiting for the browser to restore it.'));
    };
    this._onCtxRestored = () => {
      // Every texture, filter and buffer died with the context, so this is
      // not something we can silently resume from — the pooled sprites and
      // generated textures all reference dead GPU objects. Say so plainly
      // rather than pretending to recover and drawing garbage.
      if (this._fatalEl) {
        this._fatalEl.textContent =
          'RENDERER: WebGL context was restored, but every texture was lost with it.\n' +
          'Reload the page to continue.';
      }
    };
    c.addEventListener('webglcontextlost', this._onCtxLost, false);
    c.addEventListener('webglcontextrestored', this._onCtxRestored, false);
  }

  // Two fonts, chosen by what the text IS.
  //
  // Timmy, 2026-08-23: "polera ui a text ingame typ level up a tripple kill osv
  // byt font pa de". But damage numbers and combat callouts want opposite
  // things: a number needs even, unmistakable digits, and LEVEL UP / TRIPLE
  // KILL / BRUTAL want to shout.
  //
  // So the split is by CONTENT, not by call site — anything containing a digit
  // keeps the monospace face, everything else gets the display face. Doing it
  // by call site would mean every future caller has to remember, and this
  // project's whole bug history is things that had to be remembered.
  //
  // Dragon Knight is already loaded (index.css, as --font-epic) and already
  // proven on menu headings. It never touches a number here, which matters:
  // several faces in that folder have broken or missing digits.
  _textStyle(size, color, strokeColor, strokeWidth, text) {
    const numeric = text === undefined || /[0-9]/.test(String(text));
    return new TextStyle({
      fontFamily: numeric
        ? 'JetBrains Mono, monospace'
        : '"Dragon Knight", "Brandal Legend", Cinzel, serif',
      fontSize: numeric ? size : Math.round(size * 1.18),
      fontWeight: 'bold',
      letterSpacing: numeric ? 0 : 1.5,
      fill: color, stroke: strokeColor ? { color: strokeColor, width: strokeWidth || 3 } : undefined,
    });
  }

  _buildLayers() {
    const stage = this.app.stage;
    this.zoomRoot = new Container(); stage.addChild(this.zoomRoot);

    // Deep-space parallax backdrop â€” sits BEHIND the world, scrolls at a
    // fraction of camera speed per layer so distant planets/nebulae/asteroids
    // feel genuinely far away instead of locked to the foreground.
    this.deepSpace = new Container(); this.zoomRoot.addChild(this.deepSpace);
    this.gDeepFar = new Graphics(); this.deepSpace.addChild(this.gDeepFar);
    // Starfield lives HERE, in the parallax backdrop, not inside `world`.
    // Drawn into the world it sat behind the ground wash and moved 1:1 with
    // the camera, which is why it read as no stars and no depth. Five layers,
    // each with its own parallax factor.
    this.gStarLayers = [];
    this._starLayerDefs = [
      { f: 0.05, count: 190, size: 0.55, alpha: 0.34, cell: 900 },
      { f: 0.10, count: 150, size: 0.85, alpha: 0.48, cell: 820 },
      { f: 0.17, count: 110, size: 1.25, alpha: 0.62, cell: 760 },
      { f: 0.26, count: 70,  size: 1.75, alpha: 0.80, cell: 700 },
      { f: 0.38, count: 34,  size: 2.5,  alpha: 1.00, cell: 640 },
    ];
    for (let i = 0; i < this._starLayerDefs.length; i++) {
      const g = new Graphics();
      this.deepSpace.addChild(g);
      this.gStarLayers.push(g);
    }
    this._starLayerCache = this._starLayerDefs.map(() => null);
    // Guaranteed galaxy/planet/moon. Each gets its OWN layer so it can carry
    // its own parallax factor and its own autonomous drift â€” as one shared
    // layer they could only ever move as a rigid sheet, which is why the sky
    // read as a painted backdrop. Drawn once, never re-cached, so nothing
    // ever snaps back to centre. See _drawDeepSpace.
    this.gHeroGalaxy = new Graphics(); this.deepSpace.addChild(this.gHeroGalaxy);
    this.gHeroWorld  = new Graphics(); this.deepSpace.addChild(this.gHeroWorld);
    this.gHeroStar   = new Graphics(); this.deepSpace.addChild(this.gHeroStar);
    this._heroBodiesDrawn = false;
    // Real shader-driven nebula cloud (fbm noise + uTime color drift) sitting
    // between the far planets and the mid galaxy layer â€” genuine per-pixel
    // procedural gas clouds, not flat painted circles.
    this._buildNebulaShader();
    this.deepSpace.addChild(this.nebulaSprite);
    this.gDeepMid = new Graphics(); this.deepSpace.addChild(this.gDeepMid);
    this.gDeepNear = new Graphics(); this.deepSpace.addChild(this.gDeepNear);
    this.gShootingStars = new Graphics(); this.deepSpace.addChild(this.gShootingStars);
    this._shootingStars = [];
    this._nextShootingStarAt = 3 + Math.random() * 4;

    this.world = new Container(); this.zoomRoot.addChild(this.world);
    // Soft bloom on the foreground world only â€” bright saturated colors
    // (projectiles/gems/particles/muzzle flashes) glow, dark ground/grid stays
    // clean since it's below the brightness threshold. A standard
    // ColorMatrixFilter contrast/saturation/brightness pass stacks on top â€”
    // this is whole-scene color grading (not a per-object dynamic light), so
    // it's fine to use a built-in filter here rather than the custom GLSL
    // lit-shader pipeline that's reserved for actual light sources.
    // NOTE: ColorMatrixFilter.contrast()'s range is 0..1 where 0.5 = neutral
    // (NOT 0 = neutral). Dialed the overall scene darker (brightness < 1)
    // with more contrast than before, per feedback that the world read too
    // bright/flat for muzzle-flash and projectile light to visibly "pop"
    // when it lands on something â€” a darker, higher-contrast base gives
    // the dynamic point lights (see WORLD_LIGHT below) more room to read.
    this._gradeFilter = new ColorMatrixFilter();
    this._gradeFilter.brightness(0.95, true);
    // Pulled back from 0.60. Combined with the enemy light-blend this was
    // crushing enemy colours toward white at the top end.
    this._gradeFilter.contrast(0.54, true);
    this._gradeFilter.saturate(0.06, true);
    this.world.filters = [
      new AdvancedBloomFilter({ threshold: 0.6, bloomScale: 0.75, brightness: 1.0, blur: 3, quality: 2 }),
      this._gradeFilter,
    ];

    this.gGround = new Graphics(); this.world.addChild(this.gGround);
    // Sky events (passing meteors/UFOs) â€” sit just above the ground, behind
    // gameplay entities, so they read as things flying over the play area.
    this.gSkyEvents = new Graphics(); this.world.addChild(this.gSkyEvents);
    this._buildLightSystem();
    this._buildNormalLitSystem();
    // Ground-illumination patches (flat-normal lit sprites) sit in the same
    // gLight container/z-band as the old point-light pool â€” after ground,
    // before decals/gems/enemies â€” so muzzle-flash/projectile light washes
    // over the ground and bleeds around enemy silhouettes.
    for (const { sprite } of this._groundLitPool) this.gLight.addChild(sprite);
    this.gDecals = new Graphics(); this.world.addChild(this.gDecals);
    // Dock Station â€” sits with decals (ground-level, under enemies/player)
    // so its progress ring reads clearly even while the player stands on it.
    this.gDockStation = new Graphics(); this.world.addChild(this.gDockStation);
    this.dockStationLight = new Sprite(this.lightTex);
    this.dockStationLight.anchor.set(0.5); this.dockStationLight.blendMode = 'add'; this.dockStationLight.visible = false;
    this.gLight.addChild(this.dockStationLight);
    this.dockStationText = new Text({ text: 'DOCK', style: this._textStyle(9, '#4dffe0', '#06121e', 3, 'DOCK') });
    this.dockStationText.anchor.set(0.5); this.dockStationText.visible = false;
    this.world.addChild(this.dockStationText);
    // Tidal Shrine â€” same z-band as the Dock Station, own layer since both
    // can theoretically be up at once.
    this.gTidalShrine = new Graphics(); this.world.addChild(this.gTidalShrine);
    this.shrineLight = new Sprite(this.lightTex);
    this.shrineLight.anchor.set(0.5); this.shrineLight.blendMode = 'add'; this.shrineLight.visible = false;
    this.gLight.addChild(this.shrineLight);
    this.shrineText = new Text({ text: 'SHRINE', style: this._textStyle(9, '#1fb6ff', '#06121e', 3, 'SHRINE') });
    this.shrineText.anchor.set(0.5); this.shrineText.visible = false;
    this.world.addChild(this.shrineText);
    this.gGems = new Graphics(); this.world.addChild(this.gGems);
    this.gEnemies = new Graphics(); this.world.addChild(this.gEnemies);
    this.gPlayer = new Graphics(); this.world.addChild(this.gPlayer);
    // Lit player-body sprite renders between the shadow (gPlayer) and the
    // gun/highlights/UI (gPlayerFront) so the normal-mapped shading sits
    // exactly where the old flat body fill used to be.
    this.world.addChild(this.playerBodySprite);
    this.gPlayerFront = new Graphics(); this.world.addChild(this.gPlayerFront);
    // A rescuable companion (see game/companions.js) — its own layer, drawn
    // right after the player, same z-band as the pet.
    this.gCompanion = new Graphics(); this.world.addChild(this.gCompanion);
    this.gPet = new Graphics(); this.world.addChild(this.gPet);
    this.petLevelText = new Text({ text: '', style: this._textStyle(6, '#fff') });
    this.petLevelText.anchor.set(0.5); this.world.addChild(this.petLevelText);
    this.reloadText = new Text({ text: 'RELOADING', style: this._textStyle(9, '#ffd166', '#000000', 2.5, 'RELOADING') });
    this.reloadText.anchor.set(0.5, 0.5); this.world.addChild(this.reloadText);
    this.gProjectiles = new Graphics(); this.world.addChild(this.gProjectiles);
    // Lit starter-weapon (hydropistol) projectile sprites, same z-band as
    // the regular projectile Graphics layer.
    this.gLitProjectiles = new Container();
    for (const { sprite } of this._litProjPool) this.gLitProjectiles.addChild(sprite);
    this.world.addChild(this.gLitProjectiles);
    this.gBeam = new Graphics(); this.world.addChild(this.gBeam);
    // Gore (blood droplets, torn-off chunks) renders under sparks so hot
    // embers always read on top of the wet stuff.
    this._buildParticleSystem();
    this.world.addChild(this._goreLayer.pc);
    this.gParticles = new Graphics(); this.world.addChild(this.gParticles);
    this.world.addChild(this._sparkLayer.pc);

    this.dmgTextContainer = new Container(); this.world.addChild(this.dmgTextContainer);
    this._dmgTextPool = [];
    // Enemy tier tags ("T2", "T3"...) â€” tiny label under each tier>=2 enemy.
    this.tierTagContainer = new Container(); this.world.addChild(this.tierTagContainer);
    this._tierTagPool = [];
    this.levelUpText = new Text({ text: 'LEVEL UP!', style: this._textStyle(24, '#9fd8ff', '#06121e', 5, 'LEVEL UP!') });
    this.levelUpText.anchor.set(0.5); this.levelUpText.visible = false; this.world.addChild(this.levelUpText);

    // Screen-space overlays (outside the camera-translated world)
    this.gBossArrow = new Graphics(); stage.addChild(this.gBossArrow);
    this.bossArrowText = new Text({ text: 'BOSS', style: this._textStyle(11, '#000') });
    this.bossArrowText.anchor.set(0.5); stage.addChild(this.bossArrowText);
    this.metersText = new Text({ text: '', style: this._textStyle(12, '#ffd166', '#000', 3) });
    this.metersText.anchor.set(0.5); stage.addChild(this.metersText);
    this.gUI = new Graphics(); stage.addChild(this.gUI);

    // Cached highlight glow color used for player hit-flash
    this.playerBodyColor = '#5fd6ff';
    this.playerBodyFlash = '#ffffff';
  }

  // ---------------------------------------------------------------------
  // Bulk particle field â€” sparks and gore go through ParticleContainer
  // instead of the shared Graphics.
  //
  // Why: the Graphics path re-tessellates its whole geometry every frame
  // (clear() + N fill() calls), and sparks/blood are by far the highest-count
  // types, so a heavy fight was rebuilding hundreds of tiny meshes per frame
  // on the CPU. Particles are a flat struct upload â€” the entire field lands
  // in one draw call. Complex one-off shapes (lightning arcs, meteor
  // telegraphs, shockwave rings, sweep arcs, shell casings) stay on Graphics
  // where their vector detail is the point and their counts are low.
  // ---------------------------------------------------------------------
  _buildParticleSystem() {
    // One shared baked dot: solid core with a soft rim, so it reads as a wet
    // droplet in normal blend AND as a hot ember under additive + bloom.
    const S = 48;
    const tg = new Graphics();
    tg.rect(0, 0, S, S).fill(new FillGradient({
      type: 'radial', center: { x: 0.5, y: 0.5 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5,
      colorStops: [
        { offset: 0,    color: 'rgba(255,255,255,1)' },
        { offset: 0.55, color: 'rgba(255,255,255,1)' },
        { offset: 0.80, color: 'rgba(255,255,255,0.55)' },
        { offset: 1,    color: 'rgba(255,255,255,0)' },
      ],
    }));
    this.partTex = this.app.renderer.generateTexture({ target: tg, antialias: true });
    tg.destroy();
    this._partTexR = S / 2;   // texture radius in px at scale 1

    // Pool caps are a deliberate perf ceiling (same contract as the light
    // pools): past the cap a particle silently isn't drawn rather than
    // growing the buffer without bound. Engine's parts pool is 1200 total.
    this._sparkLayer = this._makeParticleLayer(800, true);
    this._goreLayer  = this._makeParticleLayer(700, false);
  }

  _makeParticleLayer(count, additive) {
    const pc = new ParticleContainer({
      texture: this.partTex,
      // Position/scale/rotation/colour all animate per frame; uvs never do
      // (single texture), so that stays static.
      dynamicProperties: { position: true, scale: true, rotation: true, color: true, uvs: false },
      // ParticleContainer reports empty bounds by default and would be culled
      // as invisible â€” this is the world-space region particles can occupy.
      boundsArea: new Rectangle(-20000, -20000, 40000, 40000),
    });
    if (additive) pc.blendMode = 'add';
    const pool = [];
    for (let i = 0; i < count; i++) {
      pool.push(new Particle({ texture: this.partTex, anchorX: 0.5, anchorY: 0.5 }));
    }
    return { pc, pool };
  }

  // Builds the entire lighting system ONCE: a shared soft-radial texture used
  // by every point light (baked via generateTexture instead of redrawing
  // vector circles every frame â€” sprites batch and transform for almost free,
  // which is the difference between this running at 30fps vs 120fps with
  // dozens of simultaneous lights), a pooled set of additive light sprites,
  // a baked starburst muzzle-flash texture, and the flashlight cone.
  _buildLightSystem() {
    const size = 256;
    const tg = new Graphics();
    tg.rect(0, 0, size, size).fill(new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,1)' },
        { offset: 0.4, color: 'rgba(255,255,255,0.45)' },
        { offset: 1, color: 'rgba(255,255,255,0)' },
      ],
      textureSpace: 'local',
    }));
    this.lightTex = this.app.renderer.generateTexture({ target: tg, antialias: true });
    this._lightTexSize = size;
    tg.destroy();

    // Muzzle-flash: baked once, forward-facing (angle 0 = "out the barrel")
    // since this sprite gets rotated to the current aim angle every shot â€”
    // a full 8-point symmetric starburst read as too wide/round (rays
    // sticking out sideways and even backward off the gun). Real muzzle
    // flashes are a narrow forward cone, so this is one long central spike
    // plus 2 shorter spikes close on either side (Â±16Â°/Â±34Â°) and nothing
    // past ~40Â° off-axis.
    const fg = new Graphics();
    const flashRays = [
      { a: 0,     len: 60, w: 6.5 },
      { a: 0.28,  len: 34, w: 3.5 },
      { a: -0.28, len: 34, w: 3.5 },
      { a: 0.60,  len: 18, w: 2.5 },
      { a: -0.60, len: 18, w: 2.5 },
    ];
    for (const r of flashRays) {
      fg.moveTo(0, 0).lineTo(Math.cos(r.a) * r.len, Math.sin(r.a) * r.len).stroke({ width: r.w, color: '#ffffff', alpha: 1 });
    }
    fg.circle(0, 0, 11).fill('#ffffff');
    this.flashTex = this.app.renderer.generateTexture({ target: fg, antialias: true });
    fg.destroy();

    this.gLight = new Container(); this.world.addChild(this.gLight);
    this._lightPool = [];
    for (let i = 0; i < 56; i++) {
      const spr = new Sprite(this.lightTex);
      spr.anchor.set(0.5); spr.blendMode = 'add'; spr.visible = false;
      this.gLight.addChild(spr); this._lightPool.push(spr);
    }
    this._lightIdx = 0;

    // Flashlight cone (single Graphics shape, one draw/frame regardless of
    // how many point lights exist â€” negligible cost) + the muzzle starburst
    // + a small bright core, both additive sprites reused every shot.
    this.gCone = new Graphics(); this.gCone.blendMode = 'add'; this.world.addChild(this.gCone);
    this.muzzleFlashSprite = new Sprite(this.flashTex);
    this.muzzleFlashSprite.anchor.set(0.5); this.muzzleFlashSprite.blendMode = 'add'; this.muzzleFlashSprite.visible = false;
    this.world.addChild(this.muzzleFlashSprite);
    this.muzzleCoreSprite = new Sprite(this.lightTex);
    this.muzzleCoreSprite.anchor.set(0.5); this.muzzleCoreSprite.blendMode = 'add'; this.muzzleCoreSprite.visible = false;
    this.world.addChild(this.muzzleCoreSprite);
  }

  // Grabs the next pooled additive light sprite and positions/tints it â€”
  // O(1), no geometry rebuild. Silently no-ops past the pool cap (56
  // simultaneous lights is already far more than a frame realistically needs).
  _emitLight(x, y, r, color, alpha) {
    if (this._lightIdx >= this._lightPool.length) return;
    const spr = this._lightPool[this._lightIdx++];
    spr.visible = true;
    spr.position.set(x, y);
    spr.scale.set((r * 2) / this._lightTexSize);
    spr.tint = color;
    spr.alpha = alpha;
  }

  // ===========================================================================
  // NORMAL-MAPPED LIGHTING â€” STEP 1 SMOKE TEST
  // Real per-pixel diffuse+specular shading instead of glow stickers. Since
  // this game has no hand-authored sprite art (every entity is a vector
  // Graphics shape), a normal map is baked ANALYTICALLY as a sphere/dome â€”
  // exact same math a 3D engine uses for a round bumped surface, computed
  // once into a small canvas texture, no art pipeline needed. One shared
  // filter class (GLSL, WebGL2 â€” the guaranteed baseline) drives it; each lit
  // object gets its own Filter instance (own uniforms) since each is lit
  // from a different relative light-offset every frame.
  // ===========================================================================
  _buildNormalLitSystem() {
    // The technique itself now lives in litShading.js, so the walkable station
    // room (game/stationRoom.js) can light through the SAME shader and the SAME
    // baked normal maps instead of growing a second copy that silently drifts
    // out of step with this one. Identical move, and identical reasoning, to
    // heroDraw.js on 2026-08-18.
    const litTex = buildNormalLitTextures(this.app);
    this.normalTex = litTex.normalTex;
    this.flatNormalTex = litTex.flatNormalTex;
    this.litDiffuseTex = litTex.litDiffuseTex;
    // Kept as a field because callers and future tuning passes look for it here.
    this._litFragment = LIT_FRAGMENT;

    // Player body â€” the one sprite for this step-1 test.
    this.playerBodySprite = new Sprite(this.litDiffuseTex);
    this.playerBodySprite.anchor.set(0.5);
    this.playerBodyFilter = this._makeLitFilter();
    this.playerBodySprite.filters = [this.playerBodyFilter];

    // Pooled lit sprites for the starter weapon's (hydropistol) projectiles â€”
    // "fÃ¶r de pÃ¥ projektilerna pÃ¥ start vapnet" per spec.
    this._litProjPool = [];
    for (let i = 0; i < 16; i++) {
      const sprite = new Sprite(this.litDiffuseTex);
      sprite.anchor.set(0.5); sprite.visible = false;
      const filter = this._makeLitFilter();
      sprite.filters = [filter];
      this._litProjPool.push({ sprite, filter });
    }

    // Pooled flat-normal lit sprites â€” used to cast each blue projectile's
    // own small light onto the ground/enemies it passes over. Uses the same
    // SOFT RADIAL GRADIENT base texture as the old point-light pool
    // (this.lightTex, alpha fades to 0 at the edge) instead of the hard-edged
    // diffuse disc, so it reads as a small soft glow â€” not a giant flat
    // circle â€” while still being lit through the real GlProgram shader.
    this._groundLitPool = [];
    for (let i = 0; i < 22; i++) {
      const sprite = new Sprite(this.lightTex);
      sprite.anchor.set(0.5); sprite.visible = false; sprite.blendMode = 'add';
      const filter = this._makeLitFilter(this.flatNormalTex);
      sprite.filters = [filter];
      this._groundLitPool.push({ sprite, filter });
    }
    // (XP orbs used to own a lit-sprite pool here. They're faceted crystals
    // now â€” they catch light rather than emit it â€” so the pool is gone and
    // those 10 filter instances with it. See _drawGems.)
  }

  // Delegations. The bodies moved to litShading.js; these stay so that all
  // existing call sites in this file are untouched — the same pattern the
  // heroDraw.js extraction used.
  _makeLitFilter(normalTex) {
    return makeLitFilter(normalTex || this.normalTex);
  }

  // Feeds one moving light + this object's own size/position into its filter
  // â€” all in world-pixel units, which cancels out camera zoom automatically
  // since vTextureCoord is always 0..1 across the object's own rendered
  // bounds regardless of what scale it was rasterized at.
  // `sizeOverride` exists for sprites that carry a rotation: PixiJS's
  // `sprite.width` reports the AXIS-ALIGNED bounds of a rotated sprite, which
  // grows and shrinks as it spins. Feeding that into uObjSize would make the
  // light on the player's body breathe every time he turned. Callers that
  // rotate pass the intended unrotated size instead.
  _updateLitUniforms(filter, sprite, light, sizeOverride) {
    return updateLitUniforms(filter, sprite, light, sizeOverride);
  }

  resize(W, H) {
    if (!this.ready) { this._pendingSize = { w: W, h: H }; return; }
    this.app.renderer.resize(W, H);
  }

  destroy() {
    // Tear the context listeners and the overlay down with the renderer.
    // The canvas outlives this object across a restart, so leaving listeners
    // bound would stack another pair on every run and report a single lost
    // context N times.
    if (this.canvas && this._ctxWatched) {
      this.canvas.removeEventListener('webglcontextlost', this._onCtxLost, false);
      this.canvas.removeEventListener('webglcontextrestored', this._onCtxRestored, false);
      this._ctxWatched = false;
    }
    if (this._fatalEl) { this._fatalEl.remove(); this._fatalEl = null; }
    // If a newer renderer has already claimed this canvas, tearing down our
    // Application would destroy ITS WebGL context (same canvas -> same
    // context) and, with removeView, rip the canvas out of the DOM. Leave the
    // superseded Application alone: one orphaned object is a trivial cost
    // next to a black screen, and it holds no context of its own to leak.
    if (this._superseded || (this.canvas && this.canvas.__wdRenderer !== this)) return;
    if (this.canvas) this.canvas.__wdRenderer = null;
    // `removeView: false` — the <canvas> belongs to React, which mounts and
    // unmounts it. Pixi deleting that element out from under React leaves the
    // component holding a ref to a node that is no longer in the document.
    // .catch so a renderer that failed to init can still be destroyed — the
    // rejection is already reported, and rethrowing it here would surface as
    // a second, misleading unhandled rejection on teardown.
    this.readyPromise
      .then(() => {
        if (this._superseded) return;   // re-check: may have been claimed while awaiting
        try { this.app.destroy({ removeView: false }, { children: true }); } catch (e) { /* noop */ }
      })
      .catch(() => { /* init already failed and was reported */ });
  }

  // ============================== MAIN FRAME ==============================
  render(game) {
    if (!this.ready) return;
    // A renderer that is `ready` but whose Application has been torn down
    // draws nothing and throws nothing — the exact silent failure that made
    // the black screen so hard to place. Check once, report once.
    if (!this._deadReported && (!this.app || !this.app.renderer)) {
      this._deadReported = true;
      this._fatal('renderer destroyed while still in use', new Error(
        'The Pixi Application was torn down but is still being rendered to. ' +
        'This usually means two renderers shared one canvas.'));
      return;
    }
    this._debugReadout(game);
    if (game.campSign && !this._campSignBuilt) this._buildCampSign(game);
    const W = game.W, H = game.H;

    const shakeX = (Math.random() - 0.5) * game.cam.shake;
    const shakeY = (Math.random() - 0.5) * game.cam.shake;
    this.world.position.set(-game.cam.x + shakeX, -game.cam.y + shakeY);
    const zoom = game.viewZoom ? game.viewZoom() : (game._visionZoom || 1);
    this.zoomRoot.scale.set(1 / zoom);

    this._drawDeepSpace(game);
    this._drawGround(game);
    this._drawSkyEvents(game);
    this._drawLights(game);
    this._drawGroundIllum(game);
    this._drawDecals(game);
    this._drawDockStation(game);
    this._drawTidalShrine(game);
    this._drawGems(game);
    this._drawEnemies(game);
    this._drawEnemyTierTags(game);
    this._drawPlayer(game);
    if (game.companionNpc) this._drawCompanion(game);
    if (game.pet) this._drawPet(game);
    this._drawProjectiles(game);
    this._drawLitHydroProjectiles(game);
    this._drawEnemyProjectiles(game);
    this._drawBeam(game);
    this._drawParticles(game);
    this._drawDamageNumbers(game);
    this._drawLevelUpText(game);
    this._drawBossArrow(game, W, H);
    this._drawScreenOverlays(game, W, H);
  }

  // ------------------------------ SKY EVENTS --------------------------------
  // Fiery meteors with tails, and slow UFOs trailing a colored light beam â€”
  // both cross the sky above the play area and feed into _drawLights below
  // so they cast genuine moving colored light onto the world as they pass.
  _drawSkyEvents(game) {
    const g = this.gSkyEvents; g.clear();
    for (const ev of game.skyEvents) {
      // `fade` ramps to 0 over the last 0.7s of life (engine.updateSkyEvents).
      // Every alpha below is multiplied by it, so a sky event can never blink
      // out of existence in a single frame the way the old hard `splice` did.
      // All events share one Graphics, so this cannot be a container alpha.
      const fd = ev.fade === undefined ? 1 : ev.fade;
      if (fd <= 0) continue;
      if (ev.type === 'meteor') {
        const spd = Math.hypot(ev.vx, ev.vy) || 1;
        const tx = -ev.vx / spd, ty = -ev.vy / spd;
        // Heat/glow intensifies the deeper it burns into the atmosphere.
        const burnFrac = ev.maxLife ? Math.min(1, 1 - ev.life / ev.maxLife) : 0;
        const heat = 0.6 + burnFrac * 0.9;
        for (let i = 0; i < 9; i++) {
          const f = i / 9;
          g.circle(ev.x + tx * f * (46 + burnFrac * 26), ev.y + ty * f * (46 + burnFrac * 26), (5 + burnFrac * 2.5) * (1 - f))
            .fill({ color: ev.color, alpha: (1 - f) * 0.78 * heat * fd });
        }
        glow(g, ev.x, ev.y, 15 + burnFrac * 10, ev.color, 1.5 * heat * fd);
        // White-hot leading edge â€” brighter/whiter the harder it's burning.
        g.circle(ev.x, ev.y, 5.5 + burnFrac * 2)
          .fill({ color: burnFrac > 0.4 ? '#ffffff' : '#fff8e0', alpha: fd });
        // Fragmentation â€” pieces drift apart and burn out independently.
        if (ev.frags) {
          for (const f of ev.frags) {
            glow(g, ev.x + f.ox, ev.y + f.oy, 8, ev.color, 1.1 * fd);
            g.circle(ev.x + f.ox, ev.y + f.oy, 3).fill({ color: '#fff2c8', alpha: fd });
          }
        }
      } else {
        // UFO â€” proper hull silhouette + 3 real blinking lamp lights
        // (not a single flat colored dot) plus a soft scan-beam underneath.
        g.ellipse(ev.x, ev.y, 24, 8).fill({ color: '#33394a', alpha: fd })
          .stroke({ width: 1.5, color: '#5a6478', alpha: fd });
        g.ellipse(ev.x, ev.y, 24, 8).fill({ color: '#6a7488', alpha: 0.25 * fd });
        g.ellipse(ev.x, ev.y - 5, 11, 7).fill({ color: '#4a5568', alpha: fd });
        g.ellipse(ev.x, ev.y - 6, 8, 4.5).fill({ color: '#bfe8ff', alpha: 0.55 * fd });
        for (let li = 0; li < 3; li++) {
          const lx = ev.x + (li - 1) * 13;
          const blink = 0.5 + 0.5 * Math.sin(ev.t * 5 + li * 2.1);
          g.circle(lx, ev.y + 3, 2.2).fill({ color: ev.color, alpha: (0.5 + blink * 0.5) * fd });
          if (blink > 0.7) glow(g, lx, ev.y + 3, 6, ev.color, blink * fd);
        }
        glow(g, ev.x, ev.y + 5, 20, ev.color, 1.4 * fd);
        g.poly([ev.x - 7, ev.y + 5, ev.x + 7, ev.y + 5, ev.x + 17, ev.y + 52, ev.x - 17, ev.y + 52])
          .fill({ color: ev.color, alpha: 0.13 * fd });
      }
    }
  }

  // ------------------------------ DYNAMIC LIGHTING --------------------------
  // Every light below is an additive SPRITE (pooled, baked texture) instead
  // of a redrawn vector circle â€” this is the ~120fps-friendly technique real
  // 2D engines use for many simultaneous lights (see PixiJS perf guides: a
  // shared radial-gradient texture + blendMode:'add', reused every frame,
  // rather than rebuilding Graphics geometry per light per frame).
  // The character itself stays dim/ambient on purpose â€” the muzzle-flash is
  // what should light it (and whatever it's aiming at) up the most.
  // STEP 2 (targeted extension): the merged flashlight/muzzle-flash light
  // now also (a) casts a real per-pixel-lit ground patch via the flat-normal
  // shader pool below (_drawGroundIllum), and (b) drives directional shadows
  // on the player/enemies (see _drawPlayer/_drawEnemies) so the muzzle flash
  // visibly "casts" a shadow the instant it fires, exactly like a real point
  // light would â€” no plugin, same GlProgram pipeline, just fed a 2nd purpose.
  _drawLights(game) {
    this.gCone.clear();
    this.muzzleFlashSprite.visible = false;
    this.muzzleCoreSprite.visible = false;
    for (const spr of this._lightPool) spr.visible = false;
    this._testLight = this._computeTestLight(game);

    // Combine the ORIGINAL starburst muzzle-flash sprite with the new
    // point-light glow instead of dropping it (per spec: never remove the
    // old effect, layer the new one on top of it). Positioned/colored
    // exactly where the new light sits so both read as one unified flash.
    const L = this._testLight;
    if (L.mt > 0.02) {
      const p = game.player;
      const ang = Math.atan2(L.y - p.y, L.x - p.x);
      this.muzzleFlashSprite.visible = true;
      this.muzzleFlashSprite.position.set(L.x, L.y);
      this.muzzleFlashSprite.rotation = ang;
      this.muzzleFlashSprite.tint = L.hex;
      this.muzzleFlashSprite.alpha = L.mt;
      // Starburst shortened 20% alongside the light's reach — the sprite is
      // what you actually read as the flash's LENGTH, so trimming only the
      // light would have left the visible streak the same size.
      this.muzzleFlashSprite.scale.set(0.40 + L.mt * 0.176);

      this.muzzleCoreSprite.visible = true;
      this.muzzleCoreSprite.position.set(L.x, L.y);
      this.muzzleCoreSprite.tint = L.hex;
      // 0.8 -> 0.5 and 34..60px -> 20..33px. The character is ~28px across, so
      // the core was a white lamp LARGER than he is, sitting just off his head
      // — and under sustained fire it never got a chance to decay, which is
      // why it read as a bright spot that would not go away rather than as a
      // gunshot. The starburst above still carries the flash's shape; this
      // sprite is only its hot centre and does not need to out-size him.
      this.muzzleCoreSprite.alpha = L.mt * 0.5;
      const coreSize = 20 + L.mt * 13;
      this.muzzleCoreSprite.width = coreSize;
      this.muzzleCoreSprite.height = coreSize;
    }
  }

  _computeTestLight(game) {
    const p = game.player;
    const aimAng = Math.atan2(p.aimY, p.aimX);
    // World light dimmed a further 15% per spec (0.85 -> 0.7225).
    const WORLD_LIGHT = 0.7225;
    if (p._muzzleFlashT > 0) {
      const mt = Math.min(1, p._muzzleFlashT / 0.10);
      const mAng = p._muzzleFlashAng != null ? p._muzzleFlashAng : aimAng;
      // Blend the warm gunpowder-flash base color WITH the weapon's own
      // color (don't let the muzzle flash become 100% the weapon's hue â€”
      // combine the two, per spec) â€” weighted toward the weapon color but
      // never losing the warm flash identity.
      const hex = mixHex('#fff3d0', p._muzzleFlashColor || '#fff3d0', 0.55);
      return {
        // Exits the barrel further forward (was *20) so it's clearly
        // outside the gun/character silhouette instead of overlapping it.
        x: p.x + Math.cos(mAng) * 32, y: p.y + Math.sin(mAng) * 32,
        rgb: hexToRgb01(hex), hex,
        // Reach is capped at roughly two enemy bodies (a typical enemy is
        // ~36px across, so ~72px of useful throw). A real muzzle flash is a
        // very bright, very short event — it should blow out whatever is
        // right in front of the barrel and leave the rest of the field dark,
        // which is also what makes it read as bright. Ambient is pushed up to
        // compensate, so the flash got hotter as it got shorter.
        // Pulled in from 78 to 52 and dimmed. The flash was throwing light
        // most of a screen-width and washing the field out on every shot,
        // which also stole the projectiles' own contribution — with the whole
        // area already lit, a bolt flying through had nothing left to light.
        // A muzzle flash should blow out what is directly in front of the
        // barrel and leave everything past that to the bolts.
        // 52 -> 38. Reported as still reaching too far: at 52 the flash was
        // lighting roughly three enemy bodies out, which is far enough that
        // it reads as a flare rather than a gunshot AND it keeps stealing the
        // bolts' own contribution — with the field already lit, a projectile
        // flying through has nothing left to light. Brightness is raised to
        // compensate, so the flash gets hotter as it gets shorter: it should
        // blow out what is directly in front of the barrel and leave
        // everything past that to the bolts.
        // 38 -> 30: another 20% off the reach, per playtest. The trade the
        // note above describes still holds — shorter means hotter, and the
        // brightness compensation is already in the ambient term.
        radius: 30, ambient: (0.30 + 0.52 * mt) * WORLD_LIGHT, mt,
      };
    }
    return {
      x: p.x + Math.cos(aimAng) * 32, y: p.y + Math.sin(aimAng) * 32,
      rgb: hexToRgb01('#fff3d0'), hex: '#fff3d0',
      // Ambient carry-light on the character himself. Raised from 0.16:
      // reported as "he is a bit black" — with the flash pulled in there was
      // almost nothing lighting him between shots, so the drop read as a
      // silhouette and every one of the six facial expressions was being
      // drawn into shadow. This is the one light that is always on.
      radius: 96, ambient: 0.30 * WORLD_LIGHT, mt: 0,
    };
  }

  // ------------------------ GROUND ILLUMINATION -----------------------------
  // Extends the SAME normal-mapped filter (_makeLitFilter) to a flat-normal
  // "ground patch" sprite pool â€” EVERY friendly projectile in flight (not
  // just hydropistol) is now its own small soft light in ITS OWN color,
  // subtly brightening the ground/nearby enemies it flies over. The
  // projectile's own sprite/size is untouched â€” this is a pure additive
  // glow layered underneath it, nothing about the bolt itself changes.
  // Slot 0 is reserved for a brief muzzle-flash glow (only while actively
  // firing) so nearby enemies visibly catch light from the flash too.
  _drawGroundIllum(game) {
    const pool = this._groundLitPool;
    let idx = 0;
    const L = this._testLight;
    if (L && L.mt > 0.02 && idx < pool.length) {
      const { sprite, filter } = pool[idx++];
      // Matched to the tighter muzzle light in _computeTestLight — this is the
      // visible ground pool under the flash, and leaving it wide while the
      // light itself shrank would just move the "too far" complaint from the
      // shading to the glow.
      const light = { x: L.x, y: L.y, rgb: L.rgb, radius: 32, ambient: 0.32 + L.mt * 0.24 };
      sprite.visible = true;
      sprite.position.set(L.x, L.y);
      const size = 46 + L.mt * 20;
      sprite.width = size; sprite.height = size;
      sprite.tint = L.hex;
      sprite.alpha = 0.24 * L.mt;
      this._updateLitUniforms(filter, sprite, light);
    }
    game.projs.forEach(pr => {
      if (pr.friendly === false) return;
      if (idx >= pool.length) return;
      const { sprite, filter } = pool[idx++];
      const boltColor = pr.color || '#5fd6ff';
      const isHydro = pr._wid === 'hydropistol' || pr._wid === 'hydropistol_evo';
      // Every weapon's bolt lights up in its OWN color â€” stronger than
      // before (was reading as barely-there) but pulled to a tighter radius
      // (was bleeding too far into a wide wash) so it reads as "bright but
      // local to the bolt" instead of "faint but wide".
      // Roughly doubled in reach and lifted in brightness. With the muzzle
      // flash pulled back, the bolts are now what actually lights the field —
      // they were tuned tight on the assumption that the flash was doing the
      // heavy work, and on their own they read as barely-there.
      // Reach RAISED (44/56 -> 58/72) while the muzzle flash was pulled in.
      // These two lights are in competition: whatever the flash already lit,
      // a bolt flying through cannot light again. Trading reach from the
      // flash to the bolts is what makes projectiles visibly wash their own
      // colour over enemies they pass — which is the effect asked for — and
      // it costs nothing, because the flash was covering that ground anyway.
      const light = { x: pr.x, y: pr.y, rgb: hexToRgb01(boltColor), radius: isHydro ? 58 : 72, ambient: 0.70 };
      sprite.visible = true;
      sprite.position.set(pr.x, pr.y);
      // Halo trimmed (4.6/6.2 -> 3.6/4.8). The hydropistol bolt in
      // particular read as an orb rather than a bullet: its glow was wider
      // than the character is tall. The LIGHT it casts is unchanged above —
      // this only shrinks the visible ball, so the bolt still lights the
      // field just as far while looking like a round instead of a planet.
      const size = (pr.size || 6) * (isHydro ? 3.6 : 4.8);
      sprite.width = size; sprite.height = size;
      sprite.tint = boltColor;
      sprite.alpha = isHydro ? 0.52 : 0.72;
      this._updateLitUniforms(filter, sprite, light);
    });
    for (let i = idx; i < pool.length; i++) pool[i].sprite.visible = false;
  }

  // ------------------------- NEBULA SHADER (procedural) --------------------
  _buildNebulaShader() {
    const wg = new Graphics();
    wg.rect(0, 0, 4, 4).fill('#ffffff');
    const whiteTex = this.app.renderer.generateTexture({ target: wg, antialias: false });
    wg.destroy();
    this._nebulaFragment = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform vec2 uOffset;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p) {
  float v = 0.0, amp = 0.55;
  for (int i = 0; i < 4; i++) { v += amp * vnoise(p); p *= 2.05; amp *= 0.55; }
  return v;
}
void main() {
  vec2 p = vTextureCoord * 3.2 + uOffset;
  float warp = fbm(p * 0.6 + uTime * 0.015);
  float n = fbm(p + warp * 1.6);
  float a = smoothstep(0.38, 0.82, n) * 0.30;
  vec3 col = mix(uColorA, uColorB, clamp(n * 1.3, 0.0, 1.0));
  finalColor = vec4(col * a, a);
}`;
    this._nebulaFilter = Filter.from({
      gl: { vertex: defaultFilterVert, fragment: this._nebulaFragment },
      resources: {
        uNebula: {
          uOffset: { value: [0, 0], type: 'vec2<f32>' },
          uTime: { value: 0, type: 'f32' },
          uColorA: { value: [0.35, 0.15, 0.55], type: 'vec3<f32>' },
          uColorB: { value: [0.1, 0.35, 0.55], type: 'vec3<f32>' },
        },
      },
      padding: 0,
    });
    this.nebulaSprite = new Sprite(whiteTex);
    this.nebulaSprite.anchor.set(0.5);
    this.nebulaSprite.width = 2600; this.nebulaSprite.height = 1700;
    this.nebulaSprite.blendMode = 'add';
    this.nebulaSprite.filters = [this._nebulaFilter];
    this._nebulaHues = [
      [[0.35, 0.15, 0.55], [0.1, 0.35, 0.55]],
      [[0.5, 0.12, 0.3], [0.15, 0.3, 0.15]],
      [[0.12, 0.3, 0.5], [0.45, 0.15, 0.4]],
    ];
  }

  // ------------------------- DEEP SPACE PARALLAX --------------------------
  // 3 layers scrolling at fractions of camera speed (true parallax depth) +
  // occasional shooting stars. Cached like the ground layer â€” rebuilt only
  // when the (slow) parallax-camera has drifted past a padded buffer.
  _drawDeepSpace(game) {
    // The whole deepSpace subtree is a child of `zoomRoot`, so it is scaled by
    // 1/zoom along with the world — but everything in here (star fills, nebula
    // centring, galaxy placement, the belt, the hero bodies) is authored
    // against `game.W/H`, which are CSS pixels. At zoom 1 (phone) the two agree
    // and the sky fills the screen. At 1.65 (desktop) the entire authored sky
    // was squeezed into the top-left ~60% x 60%: the starfield stopped about
    // 450px short of the right edge and the nebula centred at (435,260)
    // instead of (720,430). Converting to world units here fixes the layer
    // wholesale, because every consumer below reads W/H.
    const zoom = game.viewZoom ? game.viewZoom() : 1;
    const W = game.W * zoom, H = game.H * zoom;
    // Guard against a stray NaN/Infinity camera position (e.g. from some
    // other bug) ever reaching the parallax math below â€” worst case this
    // layer just freezes at its last good spot instead of feeding NaN into
    // Graphics positions/hashing.
    const cx = Number.isFinite(game.cam.x) ? game.cam.x : (this._lastCamX || 0);
    const cy = Number.isFinite(game.cam.y) ? game.cam.y : (this._lastCamY || 0);
    this._lastCamX = cx; this._lastCamY = cy;

    // FAR: planets & moons. The real bug behind every earlier attempt at
    // this ("follows the image", "stuck to the edge") turned out to be the
    // hero bodies' fixed local position (see below) being placed at extreme
    // corner offsets (e.g. W*0.30, -H*0.24 â€” literally above/beside the
    // frame on anything but a very wide desktop viewport), not the parallax
    // speed itself â€” on a phone-width screen almost the whole body sat
    // off-frame with just an edge poking in, which reads exactly like
    // "riding along the side" no matter how slow or fast it drifts. Fixed
    // both: bodies now sit at safely-inside-frame fractions, and 0.03 gives
    // real, visible drift over a normal play session (not the 0.006-0.018
    // range tried earlier, which was correcting the wrong variable).
    // 0.03 barely moved at all; the gas needs to visibly drift past to read
    // as a layer rather than as a texture painted on the screen.
    const farF = 0.14, fx = cx * farF, fy = cy * farF;
    if (!this._farCache || Math.abs(fx - this._farCache.x) > 140 || Math.abs(fy - this._farCache.y) > 140) {
      this._farCache = { x: fx, y: fy };
      const g = this.gDeepFar; g.clear();
      const cell = 1400, pad = 500;
      const sX = Math.floor((fx - pad) / cell) * cell, sY = Math.floor((fy - pad) / cell) * cell;
      // Procedural planets used to live here. They are out for now â€” planets
      // are coming in as authored sprite art and two competing looks in one
      // sky reads worse than either alone. What is left on this layer is
      // diffuse gas: far, faint, no hard silhouette to clash with a sprite.
      const gasPalette = ['#2a5f9a', '#6a2a8e', '#1f7a6a', '#8e2a54', '#3a4a9a', '#8a5a1a'];
      for (let gx = sX; gx < fx + W + pad; gx += cell) {
        for (let gy = sY; gy < fy + H + pad; gy += cell) {
          const h = ((gx * 92821) ^ (gy * 68917)) >>> 0;
          if (h % 2 !== 0) continue;
          // `>>>` throughout, not `>>`. `h` is coerced unsigned above, so any
          // hash with the top bit set is above 2^31 — a SIGNED shift brings
          // that back as a negative number, `negative % len` is negative in
          // JS, and `gasPalette[-3]` is undefined. That undefined reached
          // Graphics.fill() as a colour and threw "Unable to convert color
          // undefined", which aborted the whole deep-space pass for that
          // frame (the render call is wrapped in a try/catch, so it showed up
          // as nebulae flickering out rather than as a crash). Roughly half
          // of all cloud cells were affected.
          const px = gx + (h % cell), py = gy + ((h >>> 6) % cell);
          const size = 190 + (h % 320);
          const col = gasPalette[h % gasPalette.length];
          // A second, offset colour on each cloud so the gas has internal
          // variation instead of being one flat tint fading out.
          const col2 = gasPalette[(h >>> 4) % gasPalette.length];
          const squash = 0.42 + ((h >>> 3) % 5) * 0.09;
          for (let li = 6; li >= 1; li--) {
            g.ellipse(px, py, size * (li / 6), size * (li / 6) * squash)
              .fill({ color: col, alpha: 0.030 });
          }
          for (let li = 4; li >= 1; li--) {
            g.ellipse(px + size * 0.22, py - size * 0.12, size * (li / 6) * 0.7, size * (li / 6) * squash * 0.7)
              .fill({ color: col2, alpha: 0.026 });
          }
        }
      }
    }
    this.gDeepFar.position.set(-fx, -fy);

    // ---- Hardcoded "hero" celestial bodies (a moon + a planet + a glowing
    // dwarf star must always be visibly present, not left to hashed-grid RNG
    // which can spawn zero bodies near the player for a long time). Drawn
    // ONCE ever into their own layer at a fixed local origin, then given the
    // exact same continuous parallax offset as the far grid above â€” unlike
    // the grid, this layer is NEVER cleared/re-cached, so there's no
    // periodic "snap back" recentering it near the player. That snapping was
    // the actual bug behind "stuck to the edge": every ~140/farF world-units
    // of camera movement it got recentered back to the same on-screen spot,
    // capping its visible drift to a small radius forever. Now it drifts
    // continuously and will genuinely leave frame on a long pan.
    this._drawStarLayers(W, H, cx, cy);

    // Rebuild if the view size changed. Their layout is derived from W/H
    // (bx: W*0.18, W*0.70, W*0.34 …), and those are world units now — so a
    // resize, a rotate, or the Vision zoom card would otherwise leave the
    // three bodies laid out for the size the window happened to be when the
    // run started. Built ONCE per size, not once per lifetime.
    if (this._heroBodiesW !== W || this._heroBodiesH !== H) {
      this._heroBodiesDrawn = false;
      this._heroBodiesW = W; this._heroBodiesH = H;
    }
    if (!this._heroBodiesDrawn) {
      this._heroBodiesDrawn = true;
      this._buildHeroBodies(W, H);
    }
    this._positionHeroBodies(game, W, H, cx, cy);

    // MID: galaxy spiral arms + soft nebula clouds (parallax 0.07)
    const midF = 0.07, mx = cx * midF, my = cy * midF;
    if (!this._midCache || Math.abs(mx - this._midCache.x) > 140 || Math.abs(my - this._midCache.y) > 140) {
      this._midCache = { x: mx, y: my };
      const g = this.gDeepMid; g.clear();
      const cell = 900, pad = 400;
      const sX = Math.floor((mx - pad) / cell) * cell, sY = Math.floor((my - pad) / cell) * cell;
      for (let gx = sX; gx < mx + W + pad; gx += cell) {
        for (let gy = sY; gy < my + H + pad; gy += cell) {
          const h = ((gx * 41143) ^ (gy * 30983)) >>> 0;
          if (h % 3 !== 0) continue;
          const px = gx + (h % cell), py = gy + ((h >>> 5) % cell);
          const hue = h % 4;
          const color = hue === 0 ? '#7a3ab3' : hue === 1 ? '#2a6a8a' : hue === 2 ? '#8a2a5a' : '#2a8a5a';
          const coreColor = hue === 0 ? '#e0c8ff' : hue === 1 ? '#c8f0ff' : hue === 2 ? '#ffc8e8' : '#c8ffe0';
          // Soft wispy nebula cloud (layered falloff, not a flat disc) behind
          // every galaxy core so the mid layer reads as gas clouds, not dots.
          g.circle(px, py, 220).fill({ color, alpha: 0.035 });
          g.circle(px, py, 140).fill({ color, alpha: 0.05 });
          g.circle(px, py, 70).fill({ color, alpha: 0.08 });
          for (let arm = 0; arm < 2; arm++) {
            const armAng = arm * Math.PI + (h % 100) * 0.01;
            g.moveTo(px, py);
            for (let s = 1; s <= 10; s++) {
              const rr = s * 15, aa = armAng + s * 0.35;
              g.lineTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr);
            }
            g.stroke({ width: 11, color, alpha: 0.1 });
          }
          g.circle(px, py, 30).fill({ color, alpha: 0.14 });
          g.circle(px, py, 9).fill({ color: coreColor, alpha: 0.75 });
        }
      }
    }
    this.gDeepMid.position.set(-mx, -my);

    // Nebula shader quad stays screen-centered (fixed-size fullscreen-ish
    // quad); the parallax-scroll illusion comes purely from feeding the
    // mid-layer camera fraction into uOffset, sliding the noise sample
    // window â€” the standard technique for shader-driven parallax skies.
    this.nebulaSprite.position.set(W / 2, H / 2);
    const nu = this._nebulaFilter.resources.uNebula.uniforms;
    nu.uTime = (game.run ? game.run.time : 0);
    nu.uOffset = [mx / 900, my / 900];
    const hueIdx = Math.abs(Math.floor(mx / 900) + Math.floor(my / 900)) % this._nebulaHues.length;
    const [hA, hB] = this._nebulaHues[hueIdx];
    nu.uColorA = hA; nu.uColorB = hB;

    // NEAR: drifting asteroid belt chunks (parallax 0.14)
    const nearF = 0.14, nx = cx * nearF, ny = cy * nearF;
    if (!this._nearCache || Math.abs(nx - this._nearCache.x) > 100 || Math.abs(ny - this._nearCache.y) > 100) {
      this._nearCache = { x: nx, y: ny };
      const g = this.gDeepNear; g.clear();
      const cell = 260, pad = 200;
      const sX = Math.floor((nx - pad) / cell) * cell, sY = Math.floor((ny - pad) / cell) * cell;
      for (let gx = sX; gx < nx + W + pad; gx += cell) {
        for (let gy = sY; gy < ny + H + pad; gy += cell) {
          const h = ((gx * 12841) ^ (gy * 19661)) >>> 0;
          if (h % 5 !== 0) continue;
          const px = gx + (h % cell), py = gy + ((h >>> 4) % cell);
          const sz = 3 + (h % 6);
          const rotBase = (h % 628) / 100;
          const pts = [];
          for (let i = 0; i < 6; i++) { const a = rotBase + (i / 6) * TAU; const rr = sz * (0.7 + ((h >>> i) % 3) * 0.15); pts.push(px + Math.cos(a) * rr, py + Math.sin(a) * rr); }
          g.poly(pts).fill({ color: '#6b6258', alpha: 0.5 });
        }
      }
    }
    this.gDeepNear.position.set(-nx, -ny);

    // Shooting stars: occasional bright streaks across the visible sky.
    //
    // Same parity trap as the meteors, and it bit here twice over: the spawn
    // `x` was capped to `game.W` CSS px (so on a desktop no streak could ever
    // begin in the right 40% of the sky) and the flat speed x flat life gave
    // ~1000-1444 units of travel, which is a full crossing on a phone but only
    // about 60% of a 1440-wide screen. W/H are world units now, which fixes the
    // spawn; speed scales with zoom so the APPARENT speed is identical on every
    // device; and the duration is derived from the height it has to fall
    // through rather than being a constant that happened to suit one screen.
    const dt = game.dt || 0.016;
    this._nextShootingStarAt -= dt;
    if (this._nextShootingStarAt <= 0) {
      this._nextShootingStarAt = 5 + Math.random() * 7;
      const ang = Math.PI * 0.28 + Math.random() * 0.18;
      const speed = (900 + Math.random() * 400) * zoom;
      // Fall through the whole view plus a margin, along the actual heading.
      const dur = (H * 1.25) / Math.max(1, speed * Math.sin(ang));
      this._shootingStars.push({
        x: Math.random() * W, y: -40 * zoom, ang, speed,
        life: dur, maxLife: dur,
      });
    }
    const gs = this.gShootingStars; gs.clear(); gs.position.set(0, 0);
    for (let i = this._shootingStars.length - 1; i >= 0; i--) {
      const s = this._shootingStars[i];
      s.life -= dt;
      s.x += Math.cos(s.ang) * s.speed * dt;
      s.y += Math.sin(s.ang) * s.speed * dt;
      if (s.life <= 0) { this._shootingStars.splice(i, 1); continue; }
      // Fade over the last ~45% of the flight, as a fraction of its own
      // duration — a fixed `life * 2.2` would mean something different for
      // every duration now that durations vary.
      const a = Math.min(1, (s.life / (s.maxLife || 1)) * 2.2);
      const tailX = s.x - Math.cos(s.ang) * 75, tailY = s.y - Math.sin(s.ang) * 75;
      gs.moveTo(tailX, tailY).lineTo(s.x, s.y).stroke({ width: 2, color: '#ffffff', alpha: a * 0.8 });
      gs.circle(s.x, s.y, 2.4).fill({ color: '#ffffff', alpha: a });
    }
  }

  // ---- Hero celestial bodies --------------------------------------------
  // Always-present sky features, rather than leaving it to hashed-grid RNG
  // that can produce an empty sky for minutes. Each is drawn ONCE into its
  // own layer at a local origin; per-frame all that changes is the layer's
  // position.
  //
  // Planets and moons are deliberately NOT here â€” they are coming in as
  // authored sprite art, and procedural ones sharing the sky would fight
  // with them. What remains is the diffuse stuff that reads as depth rather
  // than as an object: a galaxy and a dwarf star.
  _buildHeroBodies(W, H) {
    this._drawGalaxy(this.gHeroGalaxy, 0, 0);
    this._drawDistantWorld(this.gHeroWorld, 0, 0, 108);
    this._drawDwarfStar(this.gHeroStar, 0, 0);

    // Depth is sold by three cues disagreeing with each other: parallax
    // factor (how much camera movement shifts it), autonomous drift (so the
    // sky lives even when the player stands still) and haze (layer alpha).
    // Parallax factors were far too small — at 0.016 the galaxy shifted 16px
    // for a thousand pixels of camera movement, which does not read as
    // parallax at all, it reads as being glued to the screen. These are the
    // values that actually make the sky feel like it is behind the world.
    // Spread across the whole backdrop rather than clustered. The galaxy and
    // the planet used to sit at (0.52, 0.34) and (0.74, 0.26) — a couple of
    // hundred pixels apart with the galaxy's 190px halo reaching straight into
    // the planet, so the two biggest features in the sky read as one crowded
    // smudge. They are now on opposite diagonals with the star anchoring the
    // third corner, which is also what lets each one's parallax be legible:
    // three objects moving at different rates only reads as depth if you can
    // see them separately.
    this._heroBodies = [
      // Now that parallax is anchored to the spawn camera, these fractions are
      // literally where each body sits on screen at t=0 — so they are composed
      // AROUND the player, who is at (0.5W, 0.5H): galaxy up-left, planet
      // right-and-low, star down-left. Roughly equal spread in each direction
      // rather than everything piled off one edge.
      //
      // The planet came in from 0.82W to 0.70W on purpose: it is drawn at
      // R=190, so on a 393px phone it is *wider than the screen*. At 0.82 it
      // hung two-thirds off the right edge. At 0.70 the crop reads as "close
      // and enormous", which is the look, instead of "mostly missing".
      { g: this.gHeroGalaxy, bx: W * 0.18, by: H * 0.24, f: 0.10, driftX: -2.6, driftY: 0.7, pad: 460, alpha: 0.80 },
      { g: this.gHeroWorld,  bx: W * 0.70, by: H * 0.60, f: 0.14, driftX: -4.2, driftY: 1.1, pad: 340, alpha: 0.92 },
      { g: this.gHeroStar,   bx: W * 0.34, by: H * 0.86, f: 0.18, driftX:  3.6, driftY: -0.9, pad: 240, alpha: 0.88 },
    ];
    for (const b of this._heroBodies) b.g.alpha = b.alpha;
  }

  // Five independent star layers in the parallax backdrop. Each is a hashed
  // infinite grid rebuilt only when its own scroll offset has moved past a
  // padded buffer, so a slow layer redraws almost never.
  //
  // Colour and brightness vary within a layer as well as between them: a sky
  // of identical dots at one alpha is exactly what reads as flat noise.
  _drawStarLayers(W, H, cx, cy) {
    const pad = 200;
    for (let li = 0; li < this._starLayerDefs.length; li++) {
      const def = this._starLayerDefs[li];
      const g = this.gStarLayers[li];
      const ox = cx * def.f, oy = cy * def.f;
      const cache = this._starLayerCache[li];
      const moved = !cache || Math.abs(ox - cache.x) > pad * 0.5 || Math.abs(oy - cache.y) > pad * 0.5;
      if (moved) {
        this._starLayerCache[li] = { x: ox, y: oy };
        g.clear();
        const cell = def.cell;
        const perCell = Math.max(1, Math.round(def.count / 6));
        const sX = Math.floor((ox - pad) / cell) * cell;
        const sY = Math.floor((oy - pad) / cell) * cell;
        // Three brightness tiers x three spectral colours. Stars are not all
        // one white — a real field runs blue-white through yellow to a few
        // dim reds, and that spread is most of what stops it reading as
        // scattered pixels. Collected into buckets first because Graphics
        // fills everything accumulated since the last fill() in one go.
        const STAR_COLS = ['#cfe6ff', '#ffe9c4', '#ffb9a8'];
        const tiers = [[], [], [], [], [], [], [], [], []];  // tier*3 + colour
        const sparkles = [];   // bright 4-point stars, drawn per-star
        const flares = [];
        for (let gx2 = sX; gx2 < ox + W + pad; gx2 += cell) {
          for (let gy2 = sY; gy2 < oy + H + pad; gy2 += cell) {
            for (let k = 0; k < perCell; k++) {
              const h = ((gx2 * 73856093) ^ (gy2 * 19349663) ^ (k * 83492791)) >>> 0;
              const sx2 = gx2 + (h % cell);
              const sy2 = gy2 + ((h >>> 9) % cell);
              const m = (h >> 3) & 15;
              const tier = m < 9 ? 0 : m < 14 ? 1 : 2;
              // Colour skewed hard toward blue-white; warm and red are the
              // minority that makes the majority read as a colour at all.
              const cm = (h >> 7) & 15;
              const col = cm < 11 ? 0 : cm < 14 ? 1 : 2;
              const r = def.size * (tier === 0 ? 0.6 : tier === 1 ? 1 : 1.55);
              // The brightest stars in the nearer layers get a real 4-point
              // shape instead of a dot, which is what makes size variation
              // read as different KINDS of star rather than just bigger dots.
              if (tier === 2 && def.f > 0.14 && ((h >> 13) & 1) === 0) {
                sparkles.push(sx2, sy2, r, col);
              } else {
                tiers[tier * 3 + col].push(sx2, sy2, r);
              }
              if (tier === 2 && def.f > 0.2 && ((h >> 11) & 3) === 0) flares.push(sx2, sy2, r * 4.2, col);
            }
          }
        }
        const tierA = [0.42, 0.7, 1.0];
        for (let bi = 0; bi < 9; bi++) {
          const arr = tiers[bi];
          if (!arr.length) continue;
          for (let i = 0; i < arr.length; i += 3) g.circle(arr[i], arr[i + 1], arr[i + 2]);
          g.fill({ color: STAR_COLS[bi % 3], alpha: def.alpha * tierA[(bi / 3) | 0] });
        }
        // 4-point stars: a tapered diamond on each axis, so they have a
        // silhouette rather than being a fatter circle.
        for (let i = 0; i < sparkles.length; i += 4) {
          const sx2 = sparkles[i], sy2 = sparkles[i + 1], r = sparkles[i + 2], col = sparkles[i + 3];
          const L = r * 3.2, wdt = r * 0.5;
          g.poly([sx2, sy2 - L, sx2 + wdt, sy2, sx2, sy2 + L, sx2 - wdt, sy2]);
          g.poly([sx2 - L, sy2, sx2, sy2 - wdt, sx2 + L, sy2, sx2, sy2 + wdt]);
          g.fill({ color: STAR_COLS[col], alpha: def.alpha });
          g.circle(sx2, sy2, r * 0.85).fill({ color: '#ffffff', alpha: def.alpha * 0.9 });
        }
        for (let i = 0; i < flares.length; i += 4) {
          const fx = flares[i], fy = flares[i + 1], fl = flares[i + 2];
          g.moveTo(fx - fl, fy).lineTo(fx + fl, fy).moveTo(fx, fy - fl).lineTo(fx, fy + fl)
            .stroke({ width: 0.8, color: STAR_COLS[flares[i + 3]], alpha: def.alpha * 0.45 });
        }
      }
      g.position.set(-ox, -oy);
    }
  }

  // A habitable world, far enough away to be a marble. Its whole job is to be
  // the one thing in the sky that is obviously LIT — everything else out
  // there glows on its own, so a body with a day side, a terminator and a
  // night side is what gives the scene a sense of a light source at all.
  //
  // The sun sits behind it, deliberately: a full disc would blow out the
  // frame, but an occluded one gives a rim of hard light and a bloom around
  // the limb for free, which is far more attractive than the star itself.
  // The star behind the planet. Split out of _drawDistantWorld because it grew
  // its own set of concerns: a corona with structure, a real ray fan, an
  // anamorphic streak and a lens-ghost chain down the optical axis.
  //
  // `lx, ly` is the unit vector from the planet toward the star — the same one
  // the terminator and the city lights use, so everything agrees on where the
  // light is coming from.
  _drawSunBehind(g, sunX, sunY, R, lx, ly) {
    // --- outer bloom, falling off in steps rather than one flat disc ---
    for (let i = 9; i >= 1; i--) {
      const f = i / 9;
      g.circle(sunX, sunY, R * 0.34 * i)
        .fill({ color: i > 5 ? '#ffdca0' : '#ffe9b0', alpha: 0.016 * (1 - f * 0.35) });
    }

    // --- ray fan ---
    // 44 rays of alternating length with a slight irregular jitter. A fan of
    // identical evenly-spaced spokes reads as a cartoon sun; the variation is
    // the whole difference between "drawn" and "photographed".
    const RAYS = 44;
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * TAU;
      // Deterministic pseudo-noise so the star does not shimmer between the
      // rare rebuilds of this layer.
      const h = ((i * 2654435761) >>> 0) / 4294967295;
      const long = i % 4 === 0;
      const len = R * (long ? 1.5 + h * 1.5 : 0.55 + h * 0.7);
      const w = long ? 1.9 : 1.0;
      g.moveTo(sunX + Math.cos(a) * R * 0.22, sunY + Math.sin(a) * R * 0.22)
        .lineTo(sunX + Math.cos(a) * len, sunY + Math.sin(a) * len)
        .stroke({ width: w, color: long ? '#fff3d0' : '#ffe1a4', alpha: long ? 0.16 : 0.09 });
    }

    // --- corona: an irregular rim, not a clean circle ---
    const cor = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const wob = 1 + Math.sin(a * 5.3) * 0.045 + Math.sin(a * 11.7) * 0.025;
      cor.push(sunX + Math.cos(a) * R * 0.42 * wob, sunY + Math.sin(a) * R * 0.42 * wob);
    }
    g.poly(cor).fill({ color: '#ffdfa0', alpha: 0.16 });

    // --- the disc itself ---
    g.circle(sunX, sunY, R * 0.30).fill({ color: '#fff6dc', alpha: 0.62 });
    g.circle(sunX, sunY, R * 0.21).fill({ color: '#fffdf2', alpha: 0.85 });
    g.circle(sunX, sunY, R * 0.13).fill({ color: '#ffffff', alpha: 1 });

    // --- anamorphic streak: the long horizontal flare a real lens throws ---
    for (const [len, w, a, col] of [
      [R * 5.2, 1.2, 0.20, '#cfe4ff'],
      [R * 3.0, 2.6, 0.13, '#ffeec4'],
      [R * 1.4, 5.0, 0.08, '#ffd9a0'],
    ]) {
      g.moveTo(sunX - len, sunY).lineTo(sunX + len, sunY)
        .stroke({ width: w, color: col, alpha: a });
    }
    // A shorter cross streak along the light axis so it is not purely
    // horizontal.
    for (const [len, w, a] of [[R * 2.4, 1.4, 0.14], [R * 1.1, 3.0, 0.09]]) {
      g.moveTo(sunX - lx * len, sunY - ly * len).lineTo(sunX + lx * len, sunY + ly * len)
        .stroke({ width: w, color: '#ffeec4', alpha: a });
    }

    // --- lens ghosts down the optical axis, tinted apart so the chain reads
    // as glass elements rather than as copies ---
    for (const [t, r, a, col] of [
      [-0.35, 0.09, 0.10, '#ffd0a0'], [-0.62, 0.15, 0.07, '#a0ffd8'],
      [-0.95, 0.06, 0.09, '#cfd0ff'], [-1.30, 0.19, 0.05, '#ffe0a0'],
      [-1.70, 0.10, 0.06, '#ffa0c8'],
    ]) {
      const gx = sunX + lx * R * 2.6 * t, gy = sunY + ly * R * 2.6 * t;
      g.circle(gx, gy, R * r).fill({ color: col, alpha: a });
      g.circle(gx, gy, R * r).stroke({ width: 1, color: col, alpha: a * 1.6 });
    }
  }

  _drawDistantWorld(g, cx, cy, R) {
    // Light comes from up and slightly right, behind the planet.
    const lx = 0.62, ly = -0.78;
    const sunX = cx + lx * R * 1.06, sunY = cy + ly * R * 1.06;

    this._drawSunBehind(g, sunX, sunY, R, lx, ly);

    // --- atmosphere halo ---
    for (let i = 5; i >= 1; i--) {
      g.circle(cx, cy, R * (1 + i * 0.055)).fill({ color: '#6fc8ff', alpha: 0.035 });
    }

    // --- ocean body ---
    g.circle(cx, cy, R).fill('#0e3a66');
    // Depth banding, plus a subtropical brightening either side of the equator
    // — the sea is not one flat blue at any scale.
    g.ellipse(cx, cy - R * 0.35, R * 0.92, R * 0.30).fill({ color: '#1a5c96', alpha: 0.45 });
    g.ellipse(cx, cy + R * 0.42, R * 0.86, R * 0.26).fill({ color: '#0a2a4a', alpha: 0.5 });
    g.ellipse(cx, cy + R * 0.02, R * 0.99, R * 0.16).fill({ color: '#237bbd', alpha: 0.20 });

    // ---- REAL GEOGRAPHY ---------------------------------------------------
    // This is an actual orthographic globe projection of coarse coastline
    // outlines, not a scatter of green blobs. The hemisphere is centred on
    // 12°E / 22°N, which frames Africa in the middle and puts Europe — and
    // Scandinavia specifically — clearly in the upper half where it can be
    // recognised. Everything past the limb is clipped by the projection
    // itself, so continents wrap out of sight correctly instead of being
    // squashed against the edge.
    const LON0 = 12 * Math.PI / 180, LAT0 = 22 * Math.PI / 180;
    const sinLat0 = Math.sin(LAT0), cosLat0 = Math.cos(LAT0);
    // Returns null when the point is on the far side of the globe.
    const project = (lonDeg, latDeg) => {
      const lon = lonDeg * Math.PI / 180, lat = latDeg * Math.PI / 180;
      const dl = lon - LON0;
      const cosC = sinLat0 * Math.sin(lat) + cosLat0 * Math.cos(lat) * Math.cos(dl);
      if (cosC < 0) return null; // behind the horizon
      const x = Math.cos(lat) * Math.sin(dl);
      const y = cosLat0 * Math.sin(lat) - sinLat0 * Math.cos(lat) * Math.cos(dl);
      return [cx + x * R, cy - y * R];
    };
    // Fills a lat/lon ring. Points that fall behind the limb are dropped; a
    // landmass straddling the edge still fills correctly because the remaining
    // points hug the rim.
    const landmass = (ring, fill, alpha = 1) => {
      const pts = [];
      for (const [lo, la] of ring) {
        const p = project(lo, la);
        if (p) pts.push(p[0], p[1]);
      }
      if (pts.length >= 6) g.poly(pts).fill({ color: fill, alpha });
      return pts;
    };

    const GREEN = '#2f7a45', GREEN_HI = '#47955a', SAND = '#b89a5e', TUNDRA = '#6f8a6a';

    // Africa — the anchor of this hemisphere, so it gets the most points.
    landmass([[-17,14],[-16,20],[-12,25],[-6,31],[2,33],[10,34],[19,31],[26,32],[32,31],
      [35,24],[38,17],[43,12],[51,12],[48,5],[42,-1],[40,-9],[36,-18],[33,-26],[27,-33],
      [19,-35],[15,-27],[12,-17],[9,-4],[9,4],[3,6],[-4,5],[-9,5],[-13,9],[-17,14]], GREEN);
    // The Sahara. Africa reading as uniformly green is the single most
    // obviously-wrong thing about a stylised Earth.
    landmass([[-12,25],[-6,31],[10,32],[24,31],[32,30],[34,22],[28,17],[16,15],[4,15],
      [-8,17],[-12,25]], SAND, 0.85);
    // Congo basin — darker, wetter green.
    landmass([[10,4],[24,3],[28,-4],[22,-9],[13,-6],[10,4]], '#1f5f33', 0.75);

    // Arabia + the Near East.
    landmass([[34,29],[40,32],[48,30],[56,26],[59,22],[52,16],[44,12],[38,16],[35,23],[34,29]], SAND, 0.9);
    // Western Asia / Anatolia and the run east toward the Caspian.
    landmass([[26,40],[30,41],[36,41],[42,42],[50,45],[60,46],[70,45],[80,48],[88,50],
      [95,52],[100,55],[95,60],[85,62],[72,66],[60,68],[48,68],[38,66],[32,62],[30,56],
      [28,50],[26,44],[26,40]], GREEN, 0.92);

    // ---- Europe -----------------------------------------------------------
    // Iberia, France, the Alps and the Balkans as one connected mass.
    landmass([[-9,37],[-9,43],[-2,44],[0,46],[-2,48],[-4,49],[0,51],[4,52],[8,54],[12,54],
      [16,54],[20,54],[24,52],[28,50],[28,46],[24,44],[20,42],[16,40],[14,38],[16,41],
      [12,44],[8,44],[4,43],[0,42],[-3,43],[-6,43],[-9,37]], GREEN);
    // The British Isles, separate so they read as islands.
    landmass([[-5,50],[-5,53],[-3,55],[-3,58],[-5,58],[-6,56],[-6,52],[-5,50]], GREEN);
    landmass([[-10,52],[-10,54],[-7,55],[-6,53],[-8,51],[-10,52]], GREEN);

    // ---- Scandinavia, and Sweden picked out inside it ----------------------
    // Norway's fjord coast up and over the cap, down through Finland and back
    // along the Baltic. Drawn as its own mass so the peninsula shape survives.
    landmass([[5,58],[5,61],[7,63],[11,65],[14,68],[18,69],[22,70],[26,70],[30,70],[31,66],
      [28,63],[25,61],[24,66],[22,66],[21,63],[19,61],[17,59],[14,56],[12,55],[11,58],[8,58],[5,58]],
      TUNDRA, 0.95);
    // Sweden itself, a shade lighter so it is picked out of the peninsula
    // rather than hidden inside it.
    const swedePts = landmass([[11,58.5],[12,59.5],[13,61],[15,63],[17,64],[19,65.5],[21,66],
      [23,66],[23.5,65],[21,63],[19,61],[18,59.5],[17,58],[16,56.5],[14,55.8],[12.5,56],
      [11,57],[11,58.5]], '#5fae6d', 0.95);
    // And a pinprick of light on Stockholm. At this scale it is a single
    // pixel of warm white — the kind of detail you only notice once, which is
    // exactly the point.
    const sthlm = project(18.07, 59.33);
    if (sthlm) {
      g.circle(sthlm[0], sthlm[1], R * 0.028).fill({ color: '#ffe9a8', alpha: 0.35 });
      g.circle(sthlm[0], sthlm[1], R * 0.011).fill({ color: '#fffdf0', alpha: 0.95 });
    }
    if (swedePts.length >= 6) {
      g.poly(swedePts).stroke({ width: Math.max(0.5, R * 0.006), color: '#9fe0b0', alpha: 0.5 });
    }

    // Greenland and Iceland on the north-west limb.
    landmass([[-45,60],[-50,64],[-46,69],[-38,72],[-28,73],[-20,71],[-22,66],[-32,61],[-45,60]],
      '#e4f3ff', 0.85);
    landmass([[-24,64],[-22,66],[-16,66],[-14,64],[-19,63],[-24,64]], TUNDRA, 0.9);

    // South America's shoulder, riding the south-west limb.
    landmass([[-52,-2],[-45,-2],[-38,-6],[-35,-8],[-38,-14],[-42,-23],[-48,-27],[-53,-34],
      [-58,-38],[-62,-40],[-66,-45],[-70,-50],[-72,-45],[-70,-35],[-68,-25],[-70,-18],
      [-72,-10],[-77,-6],[-80,-2],[-70,0],[-60,2],[-52,-2]], GREEN, 0.9);

    // North America's eastern seaboard, mostly past the limb — which is
    // correct for this hemisphere and sells the curvature.
    landmass([[-52,47],[-60,46],[-66,44],[-70,42],[-74,40],[-76,36],[-80,32],[-81,26],
      [-80,30],[-76,34],[-72,40],[-66,46],[-58,50],[-52,52],[-52,47]], GREEN, 0.85);

    // Coastal highlight — a lighter rim on the sun-facing side of each mass,
    // faked cheaply by re-drawing Africa and Europe slightly offset toward the
    // light and clipping to a thin sliver.
    landmass([[-15,16],[-10,24],[0,31],[12,33],[22,31],[30,30],[33,24],[36,17],[41,13],
      [46,12],[43,9],[38,5],[34,0],[30,-6],[26,-14],[22,-24],[16,-30],[13,-20],[10,-6],
      [10,2],[4,5],[-3,4],[-11,8],[-15,16]], GREEN_HI, 0.30);

    // Polar caps, projected rather than pasted so they curve with the globe.
    landmass([[-180,72],[-120,74],[-60,76],[0,78],[60,76],[120,74],[180,72],
      [180,90],[-180,90],[-180,72]], '#dff2ff', 0.75);
    // Antarctic. Pulled up from -66° to -58°: from a viewpoint centred at 22°N
    // the horizon sits at about latitude -68, so a cap ring drawn at -66 fell
    // entirely behind the limb and rendered nothing at all. -58 puts a correct
    // sliver of ice on the southern edge.
    landmass([[-70,-58],[-40,-60],[-10,-62],[20,-62],[50,-60],[80,-58],
      [80,-90],[-70,-90],[-70,-58]], '#eaf7ff', 0.8);

    // --- cloud bands, offset from the land so they read as above it ---
    for (const [ox, oy, rx, ry, a] of [
      [-0.20, -0.52, 0.42, 0.10, 0.26], [0.24, -0.12, 0.36, 0.09, 0.22],
      [-0.30, 0.16, 0.40, 0.09, 0.20], [0.10, 0.44, 0.34, 0.08, 0.18],
      [0.44, -0.36, 0.22, 0.07, 0.20], [-0.48, -0.10, 0.20, 0.06, 0.18],
    ]) {
      g.ellipse(cx + ox * R, cy + oy * R, rx * R, ry * R).fill({ color: '#ffffff', alpha: a });
    }
    // A cyclone — one spiral is enough to imply weather across the whole disc.
    const stx = cx - R * 0.40, sty = cy + R * 0.30;
    for (let s = 0; s < 22; s++) {
      const f = s / 22, aa = f * 5.4, rr = R * 0.05 + f * R * 0.16;
      g.circle(stx + Math.cos(aa) * rr, sty + Math.sin(aa) * rr * 0.7, R * (0.030 - f * 0.016))
        .fill({ color: '#ffffff', alpha: 0.30 - f * 0.16 });
    }

    // --- specular sun-glint on the ocean -----------------------------------
    // The one thing a water world was missing. Land scatters light in every
    // direction; water throws a mirror image of the star back at you, and that
    // hard bright spot on the day side is what separates "a painted ball" from
    // "a planet with oceans on it".
    //
    // Sits on the sun side (`lx, ly` is the unit vector toward the star, the
    // same one the terminator and the city lights use), pulled in from the limb
    // so it lands on the sphere rather than on its edge. Elongated across the
    // light direction because a reflection off a curved, moving surface smears
    // — a round dot reads as a lens flare stuck to the screen.
    {
      const gx = cx + lx * R * 0.42;
      const gy = cy + ly * R * 0.42;
      const ang = Math.atan2(ly, lx) + Math.PI / 2;
      // Three stacked lobes, widest and faintest first.
      for (const [w, h, a] of [[0.30, 0.13, 0.10], [0.20, 0.08, 0.16], [0.11, 0.045, 0.30]]) {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const pts = [];
        for (let i = 0; i < 16; i++) {
          const t2 = (i / 16) * Math.PI * 2;
          const ex = Math.cos(t2) * R * w, ey = Math.sin(t2) * R * h;
          pts.push(gx + ex * ca - ey * sa, gy + ex * sa + ey * ca);
        }
        g.poly(pts).fill({ color: '#ffffff', alpha: a });
      }
      // A few broken glints trailing off it, so the highlight reads as a
      // rippled surface rather than as one polished spot.
      for (let i = 0; i < 5; i++) {
        const f = (i + 1) / 6;
        const jx = gx - lx * R * f * 0.34 + Math.sin(i * 2.3) * R * 0.07;
        const jy = gy - ly * R * f * 0.34 + Math.cos(i * 1.7) * R * 0.05;
        g.ellipse(jx, jy, R * (0.045 - f * 0.02), R * (0.018 - f * 0.008))
          .fill({ color: '#ffffff', alpha: 0.18 * (1 - f) });
      }
    }

    // --- terminator ---
    // Each shadow disc is offset FURTHER than it is shrunk, so successive
    // layers stack up on the night limb and thin out toward the middle.
    // Equal-sized offset discs would all still cover the centre and simply
    // darken the whole planet evenly, which is a flat disc, not a sphere.
    for (const [off, rad, a] of [[0.30, 0.98, 0.16], [0.52, 0.88, 0.20], [0.72, 0.72, 0.26]]) {
      g.circle(cx - lx * R * off, cy - ly * R * off, R * rad)
        .fill({ color: '#02060f', alpha: a });
    }

    // ---- City lights on the night side -------------------------------------
    // Real coordinates, drawn AFTER the terminator so they glow out of the
    // dark rather than being washed out by it, and faded by how far into the
    // night each one has rotated. This is the detail that makes it read as an
    // inhabited planet instead of a textured ball.
    const CITIES = [
      [-0.13, 51.5, 1.0],  [2.35, 48.9, 1.0],   [13.4, 52.5, 0.9],
      [12.5, 41.9, 0.8],   [-3.7, 40.4, 0.8],   [18.07, 59.33, 0.9],
      [10.75, 59.91, 0.7], [12.57, 55.68, 0.7], [24.94, 60.17, 0.7],
      [37.6, 55.75, 0.9],  [28.98, 41.0, 0.9],  [31.24, 30.04, 0.9],
      [3.38, 6.52, 0.8],   [28.03, -26.2, 0.7], [18.42, -33.92, 0.6],
      [55.27, 25.2, 0.8],  [72.87, 19.07, 0.9], [-43.2, -22.9, 0.8],
      [-58.4, -34.6, 0.7], [-74.0, 40.7, 1.0],
    ];
    for (const [lo, la, w] of CITIES) {
      const p = project(lo, la);
      if (!p) continue;
      // How far onto the night side this point sits: project the offset from
      // the planet centre onto the light direction. Positive = lit, so only
      // negative values get a light.
      const nx = (p[0] - cx) / R, ny = (p[1] - cy) / R;
      const litness = nx * lx + ny * ly;
      if (litness > -0.02) continue;             // still in daylight
      const night = Math.min(1, -litness / 0.55); // full brightness deep in night
      g.circle(p[0], p[1], R * 0.030 * w).fill({ color: '#ffcf7a', alpha: 0.16 * night });
      g.circle(p[0], p[1], R * 0.012 * w).fill({ color: '#fff0c0', alpha: 0.75 * night });
    }

    // --- lit limb: a hard crescent of daylight where the sun clips the edge ---
    g.circle(cx + lx * R * 0.10, cy + ly * R * 0.10, R * 0.985)
      .stroke({ width: R * 0.06, color: '#ffe9c0', alpha: 0.55 });
    g.circle(cx + lx * R * 0.05, cy + ly * R * 0.05, R * 1.0)
      .stroke({ width: R * 0.022, color: '#ffffff', alpha: 0.75 });
    // atmospheric scatter along the lit edge
    g.circle(cx + lx * R * 0.02, cy + ly * R * 0.02, R * 1.045)
      .stroke({ width: R * 0.05, color: '#8fd6ff', alpha: 0.30 });
  }

  // A blue dwarf. This was the last flat thing in the sky: eight concentric
  // circles, a white dot and four straight lines, next to a planet with real
  // coastlines and a galaxy with dust lanes. It read as a bullet hole.
  //
  // Everything here is static — the body is drawn once into its own Graphics
  // and only repositioned per frame (see _positionHeroBodies) — so the detail
  // is free at runtime. Determinism matters for the same reason: a hashed
  // pseudo-random keeps the star identical across redraws instead of
  // reshuffling its corona whenever the layer is rebuilt.
  _drawDwarfStar(g, cx, cy) {
    // Deterministic 0..1 from an integer. No Math.random: this must look the
    // same every time it is redrawn.
    const rnd = (i) => {
      const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return h - Math.floor(h);
    };

    // --- corona, hot core to cold edge -------------------------------------
    // A real star's corona shifts colour outward as well as fading. Stepping
    // through three colour stops instead of one blue is most of what separates
    // this from a stack of circles.
    const CORONA = ['#eaf6ff', '#bfe2ff', '#8cc4ff', '#5f8fdd'];
    for (let ri = 16; ri >= 1; ri--) {
      const f = ri / 16;
      const ci = Math.min(CORONA.length - 1, Math.floor(f * CORONA.length));
      // Squashed very slightly and rotated, so the halo is an ellipse rather
      // than a perfect disc — perfect circles are what make glows look CG.
      g.ellipse(cx, cy, 14 + f * 150, (14 + f * 150) * 0.93)
        .fill({ color: CORONA[ci], alpha: 0.030 * (1 - f * 0.55) });
    }

    // --- coronal rays -------------------------------------------------------
    // Fine, uneven rays of varying length and opacity. This is the detail that
    // makes it read as something burning rather than something glowing.
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rnd(i) * 0.14;
      const len = 34 + rnd(i * 3 + 1) * 96;
      const w = 0.6 + rnd(i * 7 + 2) * 1.5;
      g.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16)
        .lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len)
        .stroke({ width: w, color: i % 5 === 0 ? '#dff1ff' : '#9ecdff', alpha: 0.05 + rnd(i * 11 + 3) * 0.10 });
    }

    // --- the disc -----------------------------------------------------------
    g.circle(cx, cy, 27).fill({ color: '#8cc4ff', alpha: 0.22 });
    g.circle(cx, cy, 19).fill({ color: '#cfe8ff', alpha: 0.42 });
    g.circle(cx, cy, 12).fill({ color: '#eaf6ff', alpha: 0.85 });
    g.circle(cx, cy, 7).fill('#ffffff');
    // Limb brightening — the edge of a hot star is brighter than the space
    // just outside it, and the hard rim is what gives it a physical surface.
    g.circle(cx, cy, 12).stroke({ width: 1.2, color: '#ffffff', alpha: 0.55 });

    // --- diffraction spikes -------------------------------------------------
    // Tapered diamonds rather than strokes, so each spike has a silhouette
    // that thins to a point. Lengths stay uneven so it is not a compass rose.
    const spikes = [[0, 128], [Math.PI / 2, 74], [Math.PI, 108], [-Math.PI / 2, 66]];
    for (const [a, len] of spikes) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const px = -sa, py = ca;          // perpendicular
      const w = 2.6;
      g.poly([
        cx + ca * len, cy + sa * len,
        cx + px * w,   cy + py * w,
        cx - ca * len * 0.16, cy - sa * len * 0.16,
        cx - px * w,   cy - py * w,
      ]).fill({ color: '#dcefff', alpha: 0.30 });
    }
    // Faint secondary spikes at 45°, much shorter — real optics rarely give
    // exactly four clean points.
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const len = 30 + rnd(k + 40) * 22;
      g.moveTo(cx, cy).lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len)
        .stroke({ width: 1, color: '#cfe8ff', alpha: 0.16 });
    }

    // --- anamorphic streak --------------------------------------------------
    // The horizontal smear a real lens puts on a point source. Drawn as a thin
    // lens shape so it fades along its length instead of stopping dead.
    for (let s = 0; s < 3; s++) {
      const L = 190 - s * 46;
      const h = 1.6 + s * 1.5;
      g.poly([cx - L, cy, cx, cy - h, cx + L, cy, cx, cy + h])
        .fill({ color: '#9ecdff', alpha: 0.10 - s * 0.025 });
    }

    // --- lens ghosts --------------------------------------------------------
    // A chain of faint discs down the optical axis, decreasing in size. Cheap,
    // and it is the single strongest cue that we are looking THROUGH something
    // at a very bright object.
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const gx = cx - t * 210, gy = cy + t * 128;
      const gr = 16 - i * 2.1;
      g.circle(gx, gy, gr).fill({ color: i % 2 ? '#7fb6ff' : '#bfe2ff', alpha: 0.055 });
      g.circle(gx, gy, gr).stroke({ width: 0.8, color: '#cfe8ff', alpha: 0.07 });
    }
  }

  _positionHeroBodies(game, W, H, cx, cy) {
    const t = game.run ? game.run.time : 0;
    // Parallax is measured from where the run STARTED, not from world origin.
    //
    // These offsets used to be `cx * f` against the absolute camera position,
    // so the composition below (galaxy left, planet right, star low) was only
    // true if the camera happened to sit at world 0,0. Spawn is at ~3200,3200,
    // which at f=0.14 shoved the planet to x = -99 and the galaxy to -214:
    // both hard off the left edge before the player had moved a pixel. The
    // best-looking thing in the scene was never seen.
    //
    // Anchoring to the spawn camera makes the layout mean what it says: at
    // t=0 every body sits exactly at its authored fraction of the screen,
    // spread around the player, and parallax proceeds from there.
    // Derived from the PLAYER, not from the camera passed in. The camera is
    // seeded on the first engine update, but render order is not something
    // this function should have to depend on — if it ever ran before that
    // seed, capturing cx would pin the whole sky to world origin again and
    // silently reintroduce the bug. The player's spawn position is stable
    // from the moment the run exists.
    if (!this._paraOrigin && game.player) {
      const z = game.viewZoom ? game.viewZoom() : 1;
      this._paraOrigin = { x: game.player.x - (W / 2) * z, y: game.player.y - (H / 2) * z };
    }
    const o = this._paraOrigin || { x: cx, y: cy };
    const dcx = cx - o.x;
    const dcy = cy - o.y;
    for (const b of this._heroBodies) {
      // X wraps: a body that sails off one edge returns from the other, so
      // the sky never empties out on a long run. pad >= the body's own radius
      // means the wrap always happens while it is fully off-screen.
      const spanX = W + b.pad * 2;
      let sx = b.bx - dcx * b.f + b.driftX * t;
      sx = ((((sx + b.pad) % spanX) + spanX) % spanX) - b.pad;
      // Y does NOT wrap — a vertical jump would be visible while the body is
      // still on screen horizontally. Unbounded vertical drift is folded
      // through a sine instead, so it rises and falls smoothly forever.
      // Folded around the body's OWN base rather than around H/2, so that at
      // t=0 the sine contributes nothing and `by` is the actual start height.
      // Folding around H/2 collapsed all three bodies into the lower half of
      // the screen at spawn regardless of what `by` said.
      const wobble = -dcy * b.f + b.driftY * t;
      const sy = b.by + Math.sin(wobble / (H * 0.75)) * (H * 0.34);
      // Each body is drawn at its layer's LOCAL origin, so the layer's
      // position is its screen position outright. Subtracting the base
      // offset here pushed the galaxy half a screen off to the left, which
      // is why it was never visible.
      b.g.position.set(sx, sy);
    }
  }

  _drawGalaxy(g, cx, cy) {
    // Replaces the old dwarf star. A star at this scale was just a bright
    // dot with four spikes; a barred spiral gives the sky an actual focal
    // point with structure to read.
    const R = 190;
    // halo
    for (let i = 6; i >= 1; i--) {
      g.ellipse(cx, cy, R * (i / 6) * 1.15, R * (i / 6) * 0.62)
        .fill({ color: '#6a4fd0', alpha: 0.030 });
    }
    // spiral arms â€” logarithmic, each traced as a tapering stroke
    for (let arm = 0; arm < 2; arm++) {
      const base = arm * Math.PI;
      for (let pass = 0; pass < 3; pass++) {
        const w = [16, 9, 4][pass];
        const col = ['#4a3aa0', '#7a6ae0', '#cfc4ff'][pass];
        const al = [0.16, 0.20, 0.26][pass];
        g.moveTo(cx, cy);
        for (let s = 1; s <= 26; s++) {
          const f = s / 26;
          const rr = 14 + f * R;
          const aa = base + f * 3.1;
          // flattened disc â€” the galaxy is seen at an angle, not face-on
          g.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.54);
        }
        g.stroke({ width: w, color: col, alpha: al });
      }
    }
    // Dust lanes riding the INSIDE edge of each arm. Real spirals are defined
    // as much by the dark lanes as by the bright ones — without them the arms
    // read as painted stripes rather than as material orbiting a centre.
    for (let arm = 0; arm < 2; arm++) {
      const base = arm * Math.PI;
      g.moveTo(cx, cy);
      for (let s = 1; s <= 26; s++) {
        const f = s / 26;
        const rr = 14 + f * R;
        const aa = base + f * 3.1 - 0.14; // trailing just inside the arm
        g.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.54);
      }
      g.stroke({ width: 5, color: '#150a2a', alpha: 0.34 });
    }

    // Outer wisps — a few faint fragments beyond where the arms resolve, so
    // the disc fades into the void instead of stopping at a hard radius.
    for (let i = 0; i < 7; i++) {
      const base = (i % 2) * Math.PI;
      const f0 = 0.80 + (i % 3) * 0.05;
      g.moveTo(cx + Math.cos(base + f0 * 3.1) * (14 + f0 * R),
               cy + Math.sin(base + f0 * 3.1) * (14 + f0 * R) * 0.54);
      for (let s = 1; s <= 6; s++) {
        const f = f0 + s * 0.03;
        const rr = 14 + f * R * (1 + (i % 4) * 0.04);
        const aa = base + f * 3.1 + (i - 3) * 0.05;
        g.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.54);
      }
      g.stroke({ width: 2.2, color: '#8f7ce8', alpha: 0.10 });
    }

    // Bright star knots scattered along the arms
    for (let i = 0; i < 40; i++) {
      const f = 0.18 + (i % 13) / 13 * 0.82;
      const aa = (i % 2) * Math.PI + f * 3.1 + ((i * 37) % 20 - 10) * 0.012;
      const rr = 14 + f * R + ((i * 53) % 26 - 13);
      g.circle(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.54, 0.9 + (i % 3) * 0.5)
        .fill({ color: i % 4 === 0 ? '#ffd9f0' : '#dfe6ff', alpha: 0.55 });
    }

    // HII regions — the pink star-forming knots that give a real spiral its
    // colour variation. Deliberately few and only on the arms; scattering them
    // everywhere would just re-flatten the disc.
    for (let i = 0; i < 11; i++) {
      const f = 0.30 + (i % 7) / 7 * 0.62;
      const aa = (i % 2) * Math.PI + f * 3.1 + ((i * 29) % 14 - 7) * 0.014;
      const rr = 14 + f * R + ((i * 41) % 20 - 10);
      const hx = cx + Math.cos(aa) * rr, hy = cy + Math.sin(aa) * rr * 0.54;
      g.circle(hx, hy, 5.5 + (i % 3) * 2).fill({ color: '#ff6ad5', alpha: 0.09 });
      g.circle(hx, hy, 2.2 + (i % 2)).fill({ color: '#ffb3ea', alpha: 0.30 });
    }

    // Core bulge, now with a warmer inner gradient — galactic cores are old
    // yellow stars, not the same violet as the arms.
    g.ellipse(cx, cy, 62, 34).fill({ color: '#b98adf', alpha: 0.20 });
    g.ellipse(cx, cy, 44, 24).fill({ color: '#d9b0f5', alpha: 0.26 });
    g.ellipse(cx, cy, 30, 17).fill({ color: '#ffe6c8', alpha: 0.30 });
    g.ellipse(cx, cy, 18, 10).fill({ color: '#fff8ee', alpha: 0.80 });
    // A faint bar across the core — this is a BARRED spiral, and the bar is
    // what makes the two arms look like they are launched from something.
    g.ellipse(cx, cy, 74, 12).fill({ color: '#e0c0ff', alpha: 0.10 });
    // Dust lane cutting across the core
    g.ellipse(cx - 6, cy + 4, 96, 7).fill({ color: '#1a0f30', alpha: 0.45 });
    g.ellipse(cx + 18, cy - 6, 62, 4).fill({ color: '#1a0f30', alpha: 0.26 });
  }

  // ---------------------------- GROUND / BG ------------------------------
  // pond_1 ("First Drops") only — a weathered steel sign near spawn reading
  // "WATERDROP CAMP", so the mission reads as the camp's own backyard
  // without touching the actual map (Timmy explicitly asked to keep the
  // Rain Pool's Earth setting — "jorden är bra å se då de är där man kom
  // ifrån nyss"). Built ONCE (gated by `_campSignBuilt`) and added directly
  // to `this.world`, the camera-following container every other world-space
  // object lives in — unlike `_drawGround`'s cached Graphics repaint, a
  // static sign needs no per-frame redraw at all.
  _buildCampSign(game) {
    this._campSignBuilt = true;
    const wx = game.player.x, wy = game.player.y - 260;
    const c = new Container();
    c.position.set(wx, wy);

    const postH = 92, postW = 13, boardW = 226, boardH = 58;
    const g = new Graphics();
    // Two weathered steel posts.
    g.rect(-104, 0, postW, postH).fill({ color: 0x33373f }).stroke({ width: 2, color: 0x0a0a0c });
    g.rect(91, 0, postW, postH).fill({ color: 0x33373f }).stroke({ width: 2, color: 0x0a0a0c });
    // The board itself, hung near the top of the posts.
    g.roundRect(-boardW / 2, -boardH + 14, boardW, boardH, 5)
      .fill({ color: 0x21242a })
      .stroke({ width: 3, color: 0x0a0a0c });
    g.roundRect(-boardW / 2 + 7, -boardH + 21, boardW - 14, boardH - 14, 3)
      .stroke({ width: 1, color: 0x4dffd4, alpha: 0.32 });
    // Rivets at the panel corners — the same "machined metal" language the
    // level-up card frame and base-building bezels use elsewhere.
    for (const [rx, ry] of [[-boardW / 2 + 12, -boardH + 22], [boardW / 2 - 12, -boardH + 22], [-boardW / 2 + 12, -boardH + boardH - 12], [boardW / 2 - 12, -boardH + boardH - 12]]) {
      g.circle(rx, ry, 2.6).fill({ color: 0x6c7078 });
    }
    // A faint teal ground-glow under the sign, matching the --rune accent.
    g.ellipse(0, postH * 0.35, 120, 30).fill({ color: 0x4dffd4, alpha: 0.05 });
    c.addChild(g);

    const label = new Text({
      text: 'WATERDROP CAMP',
      style: {
        fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 'bold',
        fill: 0x9dffe8, letterSpacing: 1.5,
        dropShadow: { color: 0x000000, blur: 3, distance: 2, alpha: 0.85 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(0, -boardH / 2 + 5);
    c.addChild(label);

    this.world.addChild(c);
  }

  _drawGround(game) {
    // `gGround` lives inside `world`, which lives inside `zoomRoot` — so every
    // number here is WORLD units, while `game.W/H` are CSS pixels. They are
    // only equal at zoom 1, i.e. on a phone (deviceZoomFor clamps at
    // Math.max(1, …)), which is why this was invisible on the device it was
    // tuned on. On a 1440-wide desktop the wash and grid covered 1440+520 world
    // px of a view 2381 wide, so the right ~29% and bottom ~21% of the screen
    // had no ground and no grid at all and sat at the bare clear colour.
    // THAT was the "dark band on the right" — not the canvas element, which
    // does fill the window.
    const zoom = game.viewZoom ? game.viewZoom() : 1;
    const W = game.W * zoom, H = game.H * zoom;
    const cx = game.cam.x, cy = game.cam.y;
    const t = game.run ? game.run.time : 0;
    // PERF: the starfield/nebula/grid are near-static frame to frame â€” redrawing
    // hundreds of hashed grid cells every single frame (60-200x/sec) was the
    // #1 cost under sustained combat. Cache the drawing and only rebuild when
    // the camera has actually moved past a padded buffer, or once per second
    // (so slow ambient effects like the nebula pulse / zone tint still update).
    // Scaled with the view for the same reason W/H are: a fixed 260 is a much
    // thinner safety margin on a screen showing 2.8x more world.
    const pad = 260 * zoom;
    const cache = this._groundCache;
    const moved = !cache || Math.abs(cx - cache.cx) > pad * 0.55 || Math.abs(cy - cache.cy) > pad * 0.55;
    const stale = !cache || (t - cache.t) > 1.0;
    if (!moved && !stale) return;
    this._groundCache = { cx, cy, t };

    const g = this.gGround; g.clear();
    const zoneT = Math.min(1, t / 180);
    const zoneT2 = Math.min(1, Math.max(0, (t - 60) / 120));
    const br = Math.floor(8 + (22 - 8) * zoneT2);
    const bg = Math.floor(4 + (4 - 4) * zoneT2);
    const bb = Math.floor(18 + (10 - 18) * zoneT2);
    // Semi-transparent (not opaque) so the deep-space parallax layer
    // (planets/moons/nebula/galaxy) behind `world` actually bleeds through
    // instead of being 100% hidden â€” this was the reason the whole parallax
    // system was invisible even though it was drawing correctly.
    // Pulled down from 0.58: with the starfield and gas now BEHIND this wash
    // rather than inside it, every point of opacity here is directly taken
    // out of how much sky you can see.
    g.rect(cx - pad, cy - pad, W + pad * 2, H + pad * 2).fill({ color: `rgb(${br},${bg},${bb})`, alpha: 0.44 });

    // (The starfield used to be drawn here, inside `world`. It sat behind the
    // ground wash and moved 1:1 with the camera, so it read as neither stars
    // nor depth. It lives in the parallax backdrop now — see _drawStarLayers.)
    if (zoneT > 0.1) {
      const pulseA = 0.03 + Math.sin(t * 0.4) * 0.01;
      const nebGrid = 320;
      const nSX = Math.floor((cx - pad) / nebGrid) * nebGrid;
      const nSY = Math.floor((cy - pad) / nebGrid) * nebGrid;
      const rc = 80 + Math.floor(zoneT2 * 120), gc = 20 + Math.floor((1 - zoneT2) * 40), bc = 120 - Math.floor(zoneT2 * 80);
      const nebColor = `rgb(${rc},${gc},${bc})`;
      for (let nx = nSX; nx < cx + W + pad + nebGrid; nx += nebGrid) {
        for (let ny = nSY; ny < cy + H + pad + nebGrid; ny += nebGrid) {
          const nh = ((nx * 4421) ^ (ny * 6247)) >>> 0;
          if (nh % 3 !== 0) continue;
          const ncx = nx + (nh % 200) - 100, ncy = ny + ((nh >> 8) % 200) - 100;
          const r = 90 + (nh % 60);
          g.circle(ncx, ncy, r).fill({ color: nebColor, alpha: (pulseA * zoneT * 1.4).toFixed(3) });
        }
      }
    }

    const grid = 64;
    const startX = Math.floor((cx - pad) / grid) * grid, startY = Math.floor((cy - pad) / grid) * grid;
    const gridColor = `rgb(${Math.floor(20 + zoneT2 * 30)},${Math.floor(8 - zoneT2 * 6)},${Math.floor(36 - zoneT2 * 20)})`;
    for (let x = startX; x < cx + W + pad; x += grid) g.moveTo(x, cy - pad).lineTo(x, cy + H + pad);
    for (let y = startY; y < cy + H + pad; y += grid) g.moveTo(cx - pad, y).lineTo(cx + W + pad, y);
    g.stroke({ width: 1, color: gridColor, alpha: 0.6 });

    // World edge walls
    g.rect(0, 0, game.world.w, game.world.h).stroke({ width: 6, color: '#ff7a1a', alpha: 0.53 });
    g.rect(-8, -8, game.world.w + 16, game.world.h + 16).stroke({ width: 16, color: '#ff7a1a', alpha: 0.2 });
  }

  // Scale a hex colour toward black. Used so a pool's clotted centre is a
  // darker shade of that pool's OWN colour -- an ice pool must not clot black
  // any more than blood should.
  _darken(hex, k) {
    const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
    const r = ((n >> 16) & 255) * k, gg = ((n >> 8) & 255) * k, b = (n & 255) * k;
    return ((r & 255) << 16) | ((gg & 255) << 8) | (b & 255);
  }

  _drawDecals(game) {
    const g = this.gDecals; g.clear();
    for (const d of game.bloodDecals) {
      // Pools grow into place over ~0.4s instead of popping in at full size,
      // and get a darker clotted core once they've settled â€” real pooling.
      // Blood is always blood-red (`d.color` is BLOOD_RED from engine.js's
      // gore functions) regardless of enemy or weapon â€” the one deliberate
      // exception is slime "ooze", which was never blood to begin with and
      // keeps the slime's own color.
      const age = Math.max(0, game.time - (d.bornAt ?? game.time));
      const grow = Math.min(1, age / 0.4);
      const r = d.r * (0.35 + grow * 0.65);
      const bc = d.color || '#780a12';

      // Deterministic per-decal wobble. Seeded from the decal's own position so
      // a pool keeps its shape for its whole life instead of writhing every
      // frame, and so two pools never come out identical.
      const seed = (d.x * 12.9898 + d.y * 78.233);
      const lobes = 9;
      const pts = [];
      for (let i = 0; i < lobes; i++) {
        const a = (i / lobes) * TAU;
        // Two octaves: a big lopsided bias plus finer edge noise. A pool of
        // liquid on uneven ground is never a circle, and the circle is what
        // made these read as stickers.
        const n = Math.sin(seed + i * 2.399) * 0.20 + Math.sin(seed * 1.7 + i * 5.1) * 0.10;
        const rr = r * (1 + n);
        pts.push(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr);
      }

      // Soak halo: blood wicking outward into the ground, always wider and
      // fainter than the pool itself.
      g.circle(d.x, d.y, r * 1.35).fill({ color: bc, alpha: d.a * 0.16 });
      // The pool.
      g.poly(pts).fill({ color: bc, alpha: d.a });

      if (grow > 0.5) {
        const ox2 = Math.cos(seed) * r * 0.16, oy2 = Math.sin(seed) * r * 0.16;

        // What settles in the middle depends on what killed them. Every kind
        // shares the same irregular pool above, so they read as one family.
        if (d.kind === 'fire') {
          // Scorched ground with embers still alive in it, cooling from the
          // rim inward.
          g.circle(d.x + ox2, d.y + oy2, r * 0.6).fill({ color: 0x1a0b04, alpha: d.a * 0.7 });
          for (let em = 0; em < 4; em++) {
            const ea = seed + em * 1.9;
            const er = r * (0.25 + ((Math.sin(ea * 3.1) + 1) * 0.3));
            const ex2 = d.x + Math.cos(ea) * er, ey2 = d.y + Math.sin(ea) * er;
            // Embers breathe. This is the one animated decal, and it is what
            // makes a burn site feel like it happened rather than was painted.
            const beat = 0.45 + 0.55 * Math.sin(game.time * 3.4 + em * 2.1 + seed);
            g.circle(ex2, ey2, r * 0.10).fill({ color: 0xffa53a, alpha: d.a * 0.75 * beat });
            g.circle(ex2, ey2, r * 0.20).fill({ color: 0xff6a1a, alpha: d.a * 0.22 * beat });
          }
        } else if (d.kind === 'ice') {
          // A frozen splash: pale crust, with shards locked into it pointing
          // out from the centre.
          g.circle(d.x + ox2, d.y + oy2, r * 0.5).fill({ color: 0xdff4ff, alpha: d.a * 0.5 });
          for (let sh = 0; sh < 5; sh++) {
            const sa2 = seed * 0.7 + sh * (TAU / 5);
            const L = r * (0.55 + (Math.sin(sa2 * 2.3) + 1) * 0.3);
            const w2 = r * 0.13;
            g.poly([
              d.x + Math.cos(sa2) * L, d.y + Math.sin(sa2) * L,
              d.x - Math.sin(sa2) * w2, d.y + Math.cos(sa2) * w2,
              d.x + Math.sin(sa2) * w2, d.y - Math.cos(sa2) * w2,
            ]).fill({ color: 0xeafaff, alpha: d.a * 0.6 });
          }
          g.circle(d.x, d.y, r * 0.9).stroke({ width: 1, color: 0xbfe8ff, alpha: d.a * 0.45 });
        } else if (d.kind === 'poison') {
          // Caustic sludge: gas bubbles rising and popping in it.
          g.circle(d.x + ox2, d.y + oy2, r * 0.55).fill({ color: this._darken(bc, 0.5), alpha: d.a * 0.6 });
          for (let bb = 0; bb < 5; bb++) {
            const ba = seed * 1.3 + bb * 1.7;
            // Each bubble swells then pops on its own offset cycle.
            const ph = (game.time * 0.8 + bb * 0.37 + seed * 0.1) % 1;
            const br2 = r * 0.22 * Math.sin(ph * Math.PI);
            if (br2 <= 0.01) continue;
            const bx2 = d.x + Math.cos(ba) * r * 0.45, by2 = d.y + Math.sin(ba) * r * 0.45;
            g.circle(bx2, by2, br2).fill({ color: 0xc4ff6a, alpha: d.a * 0.35 * (1 - ph) });
            g.circle(bx2, by2, br2).stroke({ width: 0.7, color: 0xe8ffb0, alpha: d.a * 0.45 * (1 - ph) });
          }
        } else if (d.kind === 'electric') {
          // Charged residue: a scorched centre still ticking over with fine
          // arcs that snap between points on the pool.
          g.circle(d.x + ox2, d.y + oy2, r * 0.5).fill({ color: 0x16113a, alpha: d.a * 0.6 });
          const snap = Math.sin(game.time * 11 + seed) > 0.3;
          if (snap) {
            for (let ai = 0; ai < 3; ai++) {
              const a1 = seed + ai * 2.1, a2b = seed * 1.4 + ai * 3.9;
              g.moveTo(d.x + Math.cos(a1) * r * 0.7, d.y + Math.sin(a1) * r * 0.7)
                .lineTo(d.x + Math.cos(a2b) * r * 0.6, d.y + Math.sin(a2b) * r * 0.6)
                .stroke({ width: 0.8, color: 0x9fd8ff, alpha: d.a * 0.55 });
            }
          }
        } else {
          // Blood. The clotted centre used to be pure BLACK at half the
          // radius, which punched what looked like a bullet hole through the
          // middle of every pool -- the "kulhål i blodet" on the ground. It is
          // now a darkened shade of the pool's OWN colour, pushed off-centre so
          // it reads as thicker liquid settling to one side.
          g.circle(d.x + ox2, d.y + oy2, r * 0.55)
            .fill({ color: this._darken(bc, 0.45), alpha: d.a * 0.55 });
        }

        // Wet specular skim, on every kind except the burn -- ash is not wet.
        if (d.kind !== 'fire') {
          g.ellipse(d.x - ox2 * 1.6, d.y - oy2 * 1.6 - r * 0.12, r * 0.34, r * 0.19)
            .fill({ color: '#ffffff', alpha: d.a * 0.13 });
        }
      }
    }
  }

  // --------------------------- DOCK STATION --------------------------------
  // Random map objective: stand inside the ring to charge it, get a bonus on
  // completion. Its light goes through the same pooled-additive-sprite
  // technique as every other light source (see waterdrop-lighting skill) â€”
  // no ad-hoc glow filter.
  _drawDockStation(game) {
    const g = this.gDockStation; g.clear();
    const st = game.dockStation;
    if (!st) {
      this.dockStationLight.visible = false;
      this.dockStationText.visible = false;
      return;
    }
    const t = game.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    const activeColor = st.charging ? '#ffffff' : '#4dffe0';

    g.circle(st.x, st.y, st.r * 1.15).fill({ color: '#0a1a22', alpha: 0.55 });
    g.circle(st.x, st.y, st.r).stroke({ width: 3, color: '#2a6a72', alpha: 0.8 });
    g.circle(st.x, st.y, st.r * 0.7).stroke({ width: 1.5, color: '#3a8a92', alpha: 0.5 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 0.15;
      g.moveTo(st.x + Math.cos(a) * st.r * 0.3, st.y + Math.sin(a) * st.r * 0.3)
        .lineTo(st.x + Math.cos(a) * st.r * 0.95, st.y + Math.sin(a) * st.r * 0.95)
        .stroke({ width: 1, color: '#4dffe0', alpha: 0.25 + 0.15 * pulse });
    }
    g.circle(st.x, st.y, 8 + pulse * 2).fill({ color: activeColor, alpha: 0.75 });

    if (st.progress > 0.001) {
      const a0 = -Math.PI / 2, a1 = a0 + TAU * st.progress;
      g.moveTo(st.x + Math.cos(a0) * (st.r + 10), st.y + Math.sin(a0) * (st.r + 10))
        .arc(st.x, st.y, st.r + 10, a0, a1)
        .stroke({ width: 5, color: activeColor, alpha: 0.9 });
    }

    this.dockStationText.visible = true;
    this.dockStationText.position.set(st.x, st.y - st.r - 20);
    this.dockStationText.text = st.progress > 0.001 ? `DOCK ${Math.round(st.progress * 100)}%` : 'DOCK';
    this.dockStationText.style.fill = activeColor;

    this.dockStationLight.visible = true;
    this.dockStationLight.position.set(st.x, st.y);
    const glowSize = 90 + pulse * 20 + st.progress * 40;
    this.dockStationLight.width = glowSize; this.dockStationLight.height = glowSize;
    this.dockStationLight.tint = activeColor;
    this.dockStationLight.alpha = 0.35 + st.progress * 0.35 + pulse * 0.05;
  }

  _drawTidalShrine(game) {
    const g = this.gTidalShrine; g.clear();
    const sh = game.tidalShrine;
    if (!sh) {
      this.shrineLight.visible = false;
      this.shrineText.visible = false;
      return;
    }
    const t = game.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    const channeling = sh.channelT > 0;
    const activeColor = channeling ? '#ffffff' : '#1fb6ff';
    const progress = sh.channelT / 10;

    g.circle(sh.x, sh.y, sh.r * 1.2).fill({ color: '#04141c', alpha: 0.6 });
    g.circle(sh.x, sh.y, sh.r).stroke({ width: 4, color: '#1fb6ff', alpha: 0.85 });
    g.circle(sh.x, sh.y, sh.r * 0.65).stroke({ width: 2, color: '#7fd8ff', alpha: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - t * 0.25;
      g.circle(sh.x + Math.cos(a) * sh.r * 0.85, sh.y + Math.sin(a) * sh.r * 0.85, 3 + pulse).fill({ color: '#bff0ff', alpha: 0.5 });
    }
    g.circle(sh.x, sh.y, 10 + pulse * 3).fill({ color: activeColor, alpha: 0.8 });

    if (progress > 0.001) {
      const a0 = -Math.PI / 2, a1 = a0 + TAU * progress;
      g.moveTo(sh.x + Math.cos(a0) * (sh.r + 12), sh.y + Math.sin(a0) * (sh.r + 12))
        .arc(sh.x, sh.y, sh.r + 12, a0, a1)
        .stroke({ width: 6, color: activeColor, alpha: 0.95 });
    }

    this.shrineText.visible = true;
    this.shrineText.position.set(sh.x, sh.y - sh.r - 22);
    this.shrineText.text = progress > 0.001 ? `SHRINE ${Math.round(progress * 100)}%` : 'TIDAL SHRINE';
    this.shrineText.style.fill = activeColor;

    this.shrineLight.visible = true;
    this.shrineLight.position.set(sh.x, sh.y);
    const glowSize = 110 + pulse * 24 + progress * 50;
    this.shrineLight.width = glowSize; this.shrineLight.height = glowSize;
    this.shrineLight.tint = activeColor;
    this.shrineLight.alpha = 0.4 + progress * 0.35 + pulse * 0.05;
  }

  // ------------------------------- GEMS -----------------------------------
  _drawGems(game) {
    const g = this.gGems; g.clear();
    game.gems.forEach(gm => {
      const wobble = Math.sin(gm.t * 6 + gm.x * 0.05) * 3;
      const spin = Math.cos(gm.t * 4.8 + gm.x * 0.1);
      const absSpin = Math.abs(spin);
      if (gm.xp > 0) {
        const s = gm.xp <= 2 ? 3.5 : gm.xp <= 6 ? 5.5 : gm.xp <= 15 ? 8 : 12;
        const cy = gm.y + wobble;
        // 3D perspective spin: width scales with cosine of rotation
        const hw = Math.max(1.2, s * 0.75 * (0.28 + 0.72 * absSpin));
        const spinSign = spin >= 0 ? 1 : -1;
        const litFacet = spin >= 0 ? '#8fe4ff' : '#5dbbfa';
        const shadeFacet = spin >= 0 ? '#2659a8' : '#183c78';

        // 3D diamond base
        g.poly([gm.x, cy - s, gm.x + hw, cy, gm.x, cy + s, gm.x - hw, cy]).fill('#3f7fd4');
        // Left & right 3D faceted prism halves
        g.poly([gm.x, cy - s, gm.x, cy + s, gm.x - hw * spinSign, cy]).fill({ color: shadeFacet, alpha: 0.96 });
        g.poly([gm.x, cy - s, gm.x + hw * spinSign, cy, gm.x, cy + s]).fill({ color: litFacet, alpha: 0.96 });

        // Specular glint on 3D facet edge
        if (absSpin > 0.4) {
          g.poly([gm.x, cy - s, gm.x - hw * spinSign * 0.4, cy - s * 0.35, gm.x, cy - s * 0.15])
            .fill({ color: '#ffffff', alpha: 0.95 });
        }
        // Prismatic gleam sweep across the rotating face
        const gl = (Math.sin(gm.t * 3.5 + gm.x * 0.08) + 1) * 0.5;
        if (gl > 0.65) {
          const ga = (gl - 0.65) / 0.35;
          g.poly([gm.x - hw * 0.6, cy + s * 0.15, gm.x + hw * 0.3, cy - s * 0.5, gm.x + hw * 0.5, cy - s * 0.25, gm.x - hw * 0.3, cy + s * 0.4])
            .fill({ color: '#ffffff', alpha: ga * 0.65 });
        }
        if (gm.xp > 15) {
          // Large crystal rim
          g.poly([gm.x, cy - s, gm.x + hw, cy, gm.x, cy + s, gm.x - hw, cy])
            .stroke({ width: 1.5, color: '#e8f8ff', alpha: 0.85 });
          glow(g, gm.x, cy, s * 1.5, '#4dc8ff', 0.45);
        }
      } else if (gm.heart > 0) {
        const hs = 6 + Math.sin(gm.t * 8) * 1.2;
        glow(g, gm.x, gm.y + wobble, hs * 1.2, '#ff3146', 0.85);
        const cx = gm.x, cy = gm.y + wobble;
        g.moveTo(cx, cy + hs * 0.3)
          .bezierCurveTo(cx - hs * 1.1, cy - hs * 0.5, cx - hs * 1.4, cy + hs * 0.8, cx, cy + hs * 1.2)
          .bezierCurveTo(cx + hs * 1.4, cy + hs * 0.8, cx + hs * 1.1, cy - hs * 0.5, cx, cy + hs * 0.3)
          .fill('#ff3146');
        g.circle(cx - hs * 0.35, cy - hs * 0.1, hs * 0.22).fill({ color: '#ffb0b8', alpha: 0.8 });
      } else {
        // Gold coin with 3D spinning aspect rotation
        const s = gm.gold <= 2 ? 3.5 : gm.gold <= 5 ? 5 : gm.gold <= 12 ? 7 : 9.5;
        const gc = gm.gold >= 13 ? '#fff7a0' : '#ffd166';
        const coinSpin = Math.cos(gm.t * 5.2 + (gm.y || 0) * 0.1);
        const gw = Math.max(1, s * (0.2 + 0.8 * Math.abs(coinSpin)));
        if (gm.gold > 2) glow(g, gm.x, gm.y + wobble, s * 1.3, gc, 0.55);
        // 3D coin face + embossed inner rim
        g.ellipse(gm.x, gm.y + wobble, gw, s).fill(gc);
        g.ellipse(gm.x, gm.y + wobble, gw * 0.72, s * 0.72).stroke({ width: 1, color: '#fff4b0', alpha: 0.75 });
        if (gm.gold >= 6 && Math.abs(coinSpin) > 0.4) {
          g.ellipse(gm.x - gw * 0.25, gm.y - s * 0.25 + wobble, gw * 0.28, s * 0.28).fill({ color: '#ffffff', alpha: 0.75 });
        }
      }
    });
  }

  // ------------------------------ ENEMIES ---------------------------------
  _drawEnemies(game) {
    const g = this.gEnemies; g.clear();
    // Viewport cull â€” this loop does per-enemy wound-decal iteration + a
    // light-blend scan over every projectile/gem, which is the single
    // heaviest per-frame cost in the renderer once enemy counts climb into
    // the hundreds (routine in a long endless run with the tier system).
    // Enemies far outside the camera can't be seen, so skip all of that
    // work for them entirely rather than computing an invisible result.
    //
    // `cam.x/y` is a WORLD coordinate but `game.W/H` is CSS pixels, and the two
    // are only the same number when zoom is 1 — which, because deviceZoomFor()
    // clamps at Math.max(1, …), is true on a phone and false on every desktop.
    // Without the `* zoom` the cull box was 1440 world px wide on a screen
    // showing 2381, so the right THIRD of a desktop screen drew no enemies at
    // all and they popped in and out as they crossed an invisible line. Same
    // class of bug as the boss arrow's missing division (see engine.js's
    // updateBossArrow), and invisible on the phone for the same reason.
    const zoom = game.viewZoom ? game.viewZoom() : 1;
    const cullPad = 160 * zoom;
    const cx0 = game.cam.x - cullPad, cy0 = game.cam.y - cullPad;
    const cx1 = game.cam.x + game.W * zoom + cullPad, cy1 = game.cam.y + game.H * zoom + cullPad;
    game.enemies.forEach(e => {
      if (e.x < cx0 || e.x > cx1 || e.y < cy0 || e.y > cy1) return;
      try {
        const t = e.t; const s = t.size;
        if (t.speed > 88 && e.vx !== undefined) {
          for (let ti = 1; ti <= 3; ti++) {
            const ta = (1 - ti / 4) * 0.28;
            g.circle(e.x - e.vx * ti * 0.032, e.y - e.vy * ti * 0.032, s * (0.45 + ti * 0.06)).fill({ color: t.color, alpha: ta });
          }
        }
        // shadow â€” leans away from the current merged light (muzzle-flash/
        // flashlight) when close enough to be affected, plain/static beyond
        // that radius so it doesn't jitter far-away enemies pointlessly.
        const L = this._testLight;
        let sdx = 0, sdy = s * 0.45;
        if (L) {
          const ldx = e.x - L.x, ldy = e.y - L.y, ld = Math.hypot(ldx, ldy) || 1;
          const falloff = Math.max(0, 1 - ld / (L.radius * 2.4));
          sdx = (ldx / ld) * s * 0.32 * falloff;
          sdy = s * 0.45 + (ldy / ld) * s * 0.22 * falloff;
        }
        g.ellipse(e.x + sdx, e.y + sdy, s * 0.45, s * 0.18).fill({ color: '#000000', alpha: 0.45 });
        if (t.boss) glow(g, e.x, e.y, s * 0.6, t.color, 1.4);
        else glow(g, e.x, e.y, s * 0.5, t.color, 0.35);

        // Light the enemy's own body, not just the ground under it â€” gLight
        // (muzzle-flash/flashlight + per-projectile ground-illum sprites)
        // renders BEHIND this opaque Graphics fill in z-order, so an additive
        // sprite alone can never bleed through the shape. Instead we find the
        // single strongest nearby light (merged muzzle/flashlight test light,
        // or the closest friendly projectile in flight) and blend a capped
        // amount of ITS color into the enemy's own fill color â€” a genuine
        // "projectile casts light on what it flies near" effect while the
        // enemy's own identity color always stays dominant (max 45% mix).
        let bestStrength = 0, bestHex = null, bestIsProj = false;
        if (L) {
          // The idle flashlight is warm white, so mixing much of it into an
          // enemy turns a green slime grey-white even when nothing is being
          // fired at it. Its ambient contribution is now nearly nothing —
          // the light only really asserts itself during the muzzle flash
          // (L.mt), which is the moment it is supposed to.
          const ld = Math.hypot(e.x - L.x, e.y - L.y);
          const str = Math.max(0, 1 - ld / L.radius) * (0.05 + L.mt * 0.22);
          if (str > bestStrength) { bestStrength = str; bestHex = L.hex; }
        }
        // Broadphase instead of scanning every projectile per enemy â€” see
        // engine.js's projGrid. Reach and strength are both up: a bolt should
        // wash its own colour over whatever it passes, clearly, right where
        // it passes.
        // Tight and hot rather than wide and weak: a bolt should wash its own
        // colour hard over the enemy it is passing and leave the one behind
        // it untouched. Falloff is squared so the bright zone stays close.
        // Capped. The query radius decides how many 96px grid cells get
        // scanned PER ENEMY, and the cost is quadratic in it — a boss (s≈100)
        // with a big projectile would otherwise ask for a ~230px radius, i.e.
        // 5×5 cells, and at fifty enemies that is over a thousand bucket
        // walks every frame. 170 keeps the worst case at 4×4 while still
        // covering the reach any real bolt has.
        const qr = Math.min(170, game.maxProjSize * 10 + s * 1.1);
        game.projGrid.query(e.x, e.y, qr, pr => {
          if (!pr.alive || pr.friendly === false) return;
          // Reach: about two to three enemy-widths, which is the range asked
          // for — enough that a bolt clearly lights what it flies past, short
          // enough that the enemy behind that one stays dark.
          const rad = Math.min(170, (pr.size || 6) * 10 + s * 1.1);
          const pd = Math.hypot(e.x - pr.x, e.y - pr.y);
          if (pd >= rad) return;
          const f = 1 - pd / rad;
          // Falloff eased rather than squared. Squared kept the bright zone so
          // tight that only a direct pass registered; this keeps a real,
          // readable pool of light around the bolt without extending its
          // reach.
          const str = f * (0.45 + f * 0.55) * 1.35;
          if (str > bestStrength) { bestStrength = str; bestHex = pr.litHex || pr.color || '#5fd6ff'; bestIsProj = true; }
        });
        // Gems no longer light anything â€” XP/gold orbs read as faceted
        // crystals now (see _drawGems), and the old wide pickup glow was
        // washing enemy colours out in loot-heavy moments.
        // A bullet's own colour may push harder than ambient light, but not
        // far enough to overwrite the enemy's identity — the whole point of
        // an enemy having a colour is that you can tell what it is. Ambient
        // is kept very low so an unlit enemy simply looks like itself.
        // A bullet's own colour may push harder than ambient light, but not far
        // enough to overwrite the enemy's identity. Raised from 0.46 to 0.62:
        // the light on a passing enemy was reading as a faint tint rather than
        // as illumination, and at 0.62 the enemy's own hue is still the one
        // you name when you look at it.
        const mixCap = bestIsProj ? 0.62 : 0.16;
        // Projectile light desaturates toward its own bright core as it gets
        // strong — real light does not stay a flat saturated hue at intensity,
        // it blows out toward white. This is what removes the harsh
        // colour-on-colour contrast: the hot centre reads white-green rather
        // than solid green, and the tint only shows at the edges of the pool.
        let bestMixHex = bestHex;
        if (bestIsProj && bestHex) {
          const hot = Math.min(1, Math.max(0, (bestStrength - 0.42) / 0.58));
          if (hot > 0) bestMixHex = mixHex(bestHex, '#ffffff', hot * 0.55);
        }
        let litColor = (bestMixHex && bestStrength > 0.03)
          ? mixHex(t.color, bestMixHex, Math.min(mixCap, bestStrength)) : t.color;

        // Wind-up tell. A melee enemy about to strike plants, rocks back and
        // charges up â€” without a read on that the attack is unfair, and
        // without the attack a crowd is just a slow tide. The body brightens
        // toward white as the wind-up completes, and a chevron points along
        // the direction it has already committed to, so stepping aside after
        // the tell genuinely makes it whiff.
        if (e._windup > 0) {
          const chg = 1 - e._windup / 0.34;          // 0 -> 1 over the wind-up
          litColor = mixHex(litColor, '#ffffff', 0.25 + chg * 0.45);
          const ax = e._atkDX || 0, ay = e._atkDY || 0;
          const reach = s * 0.62 + 16 + chg * 12;
          const px2 = e.x + ax * reach, py2 = e.y + ay * reach;
          const perpX = -ay, perpY = ax;
          const wing = 9 + chg * 7;
          g.moveTo(px2 - ax * 9 + perpX * wing, py2 - ay * 9 + perpY * wing)
            .lineTo(px2, py2)
            .lineTo(px2 - ax * 9 - perpX * wing, py2 - ay * 9 - perpY * wing)
            .stroke({ width: 2 + chg * 2, color: '#ffdd66', alpha: 0.35 + chg * 0.6 });
          // charge ring tightening onto the body
          g.circle(e.x, e.y, s * (0.95 - chg * 0.3))
            .stroke({ width: 1.5, color: '#ffdd66', alpha: 0.25 + chg * 0.4 });
        } else if (e._strikeT > 0) {
          // mid-strike: hot leading edge
          litColor = mixHex(litColor, '#fff0c0', 0.35);
        }
        const bodyColor = e.hit > 0 ? '#ffffff' : litColor;
        const shape = this._enemyShapeFor(e, t, s);
        this._paintShape(g, shape, bodyColor, { width: 2, color: '#000000' });

        // Expressive 3D tracking eyes on enemies with live biological state animations
        if (!t.boss && t.id !== 'slime') {
          let edx = 0, edy = 1;
          if (game.player) {
            const ex = game.player.x - e.x, ey = game.player.y - e.y, el = Math.hypot(ex, ey) || 1;
            edx = ex / el; edy = ey / el;
          }
          const isHurt = (e.hp / Math.max(1, e.maxHp)) < 0.38;
          const isHit = e.hit > 0;
          const isAttacking = (e._windup > 0 || e._strikeT > 0);
          const isBlinking = !isHit && !isAttacking && (Math.sin(game.time * 2.6 + e.x * 0.15 + (e.y || 0) * 0.08) > 0.965);

          const eyeOff = s * 0.23;
          const eyeR = Math.max(2.0, s * (isHit ? 0.15 : isAttacking ? 0.14 : 0.125));
          const eyeX = e.x + edx * s * 0.20 + (isHit ? (Math.random() * 2.4 - 1.2) : 0);
          const eyeY = e.y + edy * s * 0.20 - s * 0.05 + (isHit ? (Math.random() * 2.4 - 1.2) : 0);
          const perpX = -edy * eyeOff, perpY = edx * eyeOff;

          const pupilColor = isHit ? '#ffffff' : isAttacking ? '#ffe680' : isHurt ? '#ff1a2a' : '#ff3b4b';
          const scleraColor = isHit ? '#ff3b4b' : isAttacking ? '#ff5a1a' : isHurt ? '#40080e' : '#1e0508';

          // Left and right eye sockets
          for (const side of [-1, 1]) {
            const ex2 = eyeX + perpX * side;
            const ey2 = eyeY + perpY * side;

            if (isBlinking) {
              // Eyelid blink slit
              g.moveTo(ex2 - eyeR * 1.1, ey2).lineTo(ex2 + eyeR * 1.1, ey2)
                .stroke({ width: 1.4, color: scleraColor, alpha: 0.95 });
            } else {
              // Sclera socket with depth
              g.circle(ex2, ey2, eyeR).fill({ color: scleraColor, alpha: 0.95 });
              if (isHurt) {
                // Bloodshot socket rim
                g.circle(ex2, ey2, eyeR * 1.15).stroke({ width: 0.9, color: '#8a0a14', alpha: 0.75 });
              }

              // Dynamic pupil tracking with focus & dilation
              const pSize = isHit ? eyeR * 0.75 : isAttacking ? eyeR * 0.65 : isHurt ? eyeR * 0.45 : eyeR * 0.55;
              const px = ex2 + edx * (eyeR * 0.38);
              const py = ey2 + edy * (eyeR * 0.38);

              if (isAttacking) {
                // Predatory vertical slit pupil
                g.ellipse(px, py, pSize * 0.35, pSize).fill({ color: pupilColor, alpha: 1.0 });
                g.circle(px, py, pSize * 1.3).fill({ color: '#ffaa33', alpha: 0.3 });
              } else {
                g.circle(px, py, pSize).fill({ color: pupilColor, alpha: 0.95 });
              }

              // Specular glint
              g.circle(ex2 - eyeR * 0.28, ey2 - eyeR * 0.28, Math.max(0.6, eyeR * 0.24)).fill({ color: '#ffffff', alpha: 0.9 });
            }
          }
        }

        // Progressive gore: reveal accumulated wound patches — torn, wet
        // flesh peeling away exactly where each 10%-HP hit landed.
        if (e._wounds && e._wounds.length) {
          for (const w of e._wounds) {
            const wx = e.x + w.lx, wy = e.y + w.ly;
            // Softer/smaller than before — read as a wet wound patch, not a
            // punched-out hole (a smaller dark core + a softer wet halo).
            g.circle(wx, wy, w.size * 0.95).fill({ color: '#5a0710', alpha: 0.4 });
            g.circle(wx, wy, w.size * 0.62).fill({ color: '#2c0308', alpha: 0.6 });
            g.circle(wx - w.size * 0.2, wy - w.size * 0.16, w.size * 0.22).fill({ color: '#8a1018', alpha: 0.55 });
          }
        }

        // Per-shot impact marks — a body visibly fills with damage as you
        // work on it, and the mark says WHAT hit it. Kept small; the wound
        // patches above are the big statement, these are the texture.
        if (e._marks && e._marks.length) {
          for (const m of e._marks) {
            const mx = e.x + m.lx, my = e.y + m.ly;
            if (m.kind === 'burn') {
              // scorch: sooty ring with a charred centre
              g.circle(mx, my, m.r * 1.9).fill({ color: '#1a0d06', alpha: 0.35 });
              g.circle(mx, my, m.r * 1.05).fill({ color: '#0a0603', alpha: 0.7 });
              g.circle(mx - m.r * 0.3, my - m.r * 0.3, m.r * 0.45).fill({ color: '#5a2a10', alpha: 0.5 });
            } else if (m.kind === 'frost') {
              // frost bloom: pale crust with a few radiating spurs
              g.circle(mx, my, m.r * 1.7).fill({ color: '#bfe8ff', alpha: 0.30 });
              g.circle(mx, my, m.r * 0.8).fill({ color: '#eafaff', alpha: 0.65 });
              for (let sp = 0; sp < 3; sp++) {
                const sa = (sp / 3) * TAU + m.lx;
                g.moveTo(mx, my).lineTo(mx + Math.cos(sa) * m.r * 2.6, my + Math.sin(sa) * m.r * 2.6)
                  .stroke({ width: 0.9, color: '#dff4ff', alpha: 0.5 });
              }
            } else if (m.kind === 'gash') {
              // Blade: an open cut ACROSS the blow, with lips that part and a
              // wet interior. Oriented perpendicular to the impact angle, so a
              // katana slash reads as a slash and not as a dot.
              const a = (m.ang || 0) + Math.PI / 2;
              const ca = Math.cos(a), sa = Math.sin(a);
              // `len` carries how far the blade travelled, so a katana stroke is
              // a STREAK across the body rather than a nick. Timmy: "katana ska
              // slica a skara gora som skar sar streck over kroppen".
              const L = m.r * 3.4 * (m.len || 1), w = m.r * 0.85;
              // dark cut cavity
              g.poly([
                mx + ca * L, my + sa * L,
                mx - sa * w, my + ca * w,
                mx - ca * L, my - sa * L,
                mx + sa * w, my - ca * w,
              ]).fill({ color: '#2a0509', alpha: 0.88 });
              // wet inner line
              g.moveTo(mx + ca * L * 0.8, my + sa * L * 0.8)
                .lineTo(mx - ca * L * 0.8, my - sa * L * 0.8)
                .stroke({ width: Math.max(0.7, m.r * 0.5), color: '#8f1420', alpha: 0.85 });
              // bright parted lip on the leading edge
              g.moveTo(mx + ca * L * 0.7 - sa * w * 0.8, my + sa * L * 0.7 + ca * w * 0.8)
                .lineTo(mx - ca * L * 0.7 - sa * w * 0.8, my - sa * L * 0.7 + ca * w * 0.8)
                .stroke({ width: 0.6, color: '#e06a72', alpha: 0.45 });

              // THE RUNNEL. Blood leaves the cut and runs DOWN the body, and it
              // keeps running — the wound is not finished when the hit is.
              // Timmy: "sa ska de stanka spraya blod a rinna ur strecket ner".
              //
              // Grows with the wound's age rather than being drawn at full
              // length instantly, because a trickle that appears complete reads
              // as a painted stripe. Capped so an old cut stops growing instead
              // of eventually striping the whole screen.
              const age = Math.max(0, (game.time || 0) - (m.t || 0));
              if (age > 0.06) {
                const run = Math.min(1, age / 1.6);
                // Down-screen, always: gravity does not care which way the
                // blade went. Slight lean off the cut's own angle so several
                // wounds do not draw parallel lines.
                const lean = Math.sin(m.lx * 3.1) * 0.30;
                const dx = Math.sin(lean), dy = Math.cos(lean);
                // Start at the low lip of the cut, not its centre.
                const sx = mx + ca * L * 0.25, sy = my + sa * L * 0.25 + w * 0.5;
                const runLen = m.r * 9 * run;
                g.moveTo(sx, sy)
                  .lineTo(sx + dx * runLen, sy + dy * runLen)
                  .stroke({ width: Math.max(0.6, m.r * 0.42), color: '#8f1420', alpha: 0.62 * (1 - run * 0.35) });
                // The bead at the leading edge — a runnel has a head, and the
                // head is what makes the eye read it as moving.
                g.circle(sx + dx * runLen, sy + dy * runLen, m.r * 0.36)
                  .fill({ color: '#a8121f', alpha: 0.7 * (1 - run * 0.4) });
              }
            } else if (m.kind === 'sear') {
              // Beam: a cauterised streak along the beam's path. Glowing core
              // fading to charred edges -- no cavity, because it burned shut.
              const a = m.ang || 0;
              const ca = Math.cos(a), sa = Math.sin(a);
              const L = m.r * 3.0;
              g.moveTo(mx - ca * L, my - sa * L).lineTo(mx + ca * L, my + sa * L)
                .stroke({ width: m.r * 1.9, color: '#1b0a06', alpha: 0.6 });
              g.moveTo(mx - ca * L * 0.85, my - sa * L * 0.85).lineTo(mx + ca * L * 0.85, my + sa * L * 0.85)
                .stroke({ width: m.r * 0.9, color: '#7a2a0c', alpha: 0.75 });
              g.moveTo(mx - ca * L * 0.6, my - sa * L * 0.6).lineTo(mx + ca * L * 0.6, my + sa * L * 0.6)
                .stroke({ width: m.r * 0.35, color: '#ffb066', alpha: 0.55 });
            } else if (m.kind === 'arc') {
              // Electric: a Lichtenberg burn -- a small dark entry with fine
              // branching veins crawling out of it. Branches are derived from
              // the mark's own position so they never re-randomise per frame.
              g.circle(mx, my, m.r * 0.75).fill({ color: '#1a1030', alpha: 0.8 });
              const seed = Math.abs(m.lx * 12.9898 + m.ly * 78.233);
              for (let br = 0; br < 4; br++) {
                const f = (Math.sin(seed + br * 2.3) + 1) * 0.5;
                let a2 = f * TAU;
                let px2 = mx, py2 = my;
                const segs = 3;
                for (let s2 = 0; s2 < segs; s2++) {
                  const len = m.r * (1.7 - s2 * 0.4);
                  const nx2 = px2 + Math.cos(a2) * len;
                  const ny2 = py2 + Math.sin(a2) * len;
                  g.moveTo(px2, py2).lineTo(nx2, ny2)
                    .stroke({ width: Math.max(0.4, 0.9 - s2 * 0.25), color: '#9fd8ff', alpha: 0.55 - s2 * 0.13 });
                  px2 = nx2; py2 = ny2;
                  a2 += (Math.sin(seed + br * 7.1 + s2 * 3.7)) * 0.9;
                }
              }
            } else if (m.kind === 'blunt') {
              // Concussive: no puncture at all. A bruise that darkens toward
              // the centre, with the skin split in a couple of short tears.
              g.circle(mx, my, m.r * 2.4).fill({ color: '#3a1030', alpha: 0.28 });
              g.circle(mx, my, m.r * 1.5).fill({ color: '#4a0d22', alpha: 0.45 });
              g.circle(mx, my, m.r * 0.8).fill({ color: '#6b1020', alpha: 0.6 });
              const seed = Math.abs(m.lx * 3.7 + m.ly * 9.1);
              for (let t2 = 0; t2 < 2; t2++) {
                const a2 = (Math.sin(seed + t2 * 4.4) + 1) * Math.PI;
                g.moveTo(mx, my)
                  .lineTo(mx + Math.cos(a2) * m.r * 2.0, my + Math.sin(a2) * m.r * 2.0)
                  .stroke({ width: 0.8, color: '#8f1420', alpha: 0.5 });
              }
            } else {
              // Bullet: a real punch-through. Dark cavity, a torn lip catching
              // the light on the side the round came from, and a faint bruise
              // ring where the impact drove the flesh in.
              const a = m.ang || 0;
              g.circle(mx, my, m.r * 1.9).fill({ color: '#4a0d18', alpha: 0.30 });
              g.circle(mx, my, m.r * 1.25).fill({ color: '#000000', alpha: 0.6 });
              g.circle(mx, my, m.r * 0.7).fill({ color: '#12060a', alpha: 0.92 });
              // torn lip, on the entry side
              g.circle(mx - Math.cos(a) * m.r * 0.45, my - Math.sin(a) * m.r * 0.45, m.r * 0.42)
                .fill({ color: '#c9424f', alpha: 0.5 });
            }
          }
        }

        // Variant markings. Each has to be readable at a glance in a crowd,
        // so they are silhouette-level rather than surface detail.
        if (e.variant === 'armored' && e._shell > 0) {
          // Plate segments around the body, thinning as the shell wears down.
          const frac = Math.max(0, Math.min(1, e._shell / (e.maxHp * 0.35)));
          const plates = 8;
          for (let pi = 0; pi < plates; pi++) {
            const a0 = (pi / plates) * TAU + game.time * 0.25;
            const a1 = a0 + TAU / plates * 0.66;
            g.moveTo(e.x + Math.cos(a0) * s * 0.62, e.y + Math.sin(a0) * s * 0.62)
              .arc(e.x, e.y, s * 0.62, a0, a1)
              .stroke({ width: 2.4 * frac + 0.8, color: '#9fb4c8', alpha: 0.35 + frac * 0.5 });
          }
        } else if (e.variant === 'volatile') {
          // Pulsing hot core — the faster it beats, the closer you are to it
          // going off, because it beats faster as its health drops.
          const urgency = 1 + (1 - e.hp / e.maxHp) * 3;
          const pulse = 0.5 + 0.5 * Math.sin(game.time * 6 * urgency + e.x);
          g.circle(e.x, e.y, s * 0.28 * (0.7 + pulse * 0.5))
            .fill({ color: '#ff7a1a', alpha: 0.35 + pulse * 0.45 });
          g.circle(e.x, e.y, s * 0.62).stroke({ width: 1.4, color: '#ff7a1a', alpha: 0.2 + pulse * 0.35 });
        } else if (e.variant === 'leeching') {
          // Tendrils reaching outward, and a halo while the pulse is close.
          const near = e._leechCD < 0.4;
          for (let ti = 0; ti < 5; ti++) {
            const ta = (ti / 5) * TAU + game.time * 0.9;
            const tl = s * (0.6 + Math.sin(game.time * 3 + ti) * 0.14);
            g.moveTo(e.x, e.y).lineTo(e.x + Math.cos(ta) * tl, e.y + Math.sin(ta) * tl)
              .stroke({ width: 1.6, color: '#7ad96b', alpha: near ? 0.75 : 0.35 });
          }
          if (near) g.circle(e.x, e.y, s * 0.8).stroke({ width: 2, color: '#7ad96b', alpha: 0.5 });
        }

        // Status overlays, on top of the marks so a frozen enemy reads as
        // frozen even when it is riddled with holes.
        if (e._slowT > 0) {
          // Ice encasement: a pale shell over the whole silhouette plus a
          // couple of crystal facets, fading as the freeze wears off.
          const fa = Math.min(1, e._slowT) * 0.5;
          this._paintShape(g, this._enemyShapeFor(e, t, s), null, { width: 2.4, color: '#cfefff', alpha: fa + 0.2 });
          g.circle(e.x, e.y, s * 0.5).fill({ color: '#9fdcff', alpha: fa * 0.35 });
          g.poly([e.x - s * 0.3, e.y - s * 0.1, e.x - s * 0.08, e.y - s * 0.42, e.x + s * 0.04, e.y - s * 0.12])
            .fill({ color: '#eafaff', alpha: fa * 0.55 });
          g.poly([e.x + s * 0.12, e.y + s * 0.34, e.x + s * 0.34, e.y + s * 0.06, e.x + s * 0.4, e.y + s * 0.34])
            .fill({ color: '#eafaff', alpha: fa * 0.45 });
        }
        if (e._burn > 0) {
          // Burning: embers licking upward off the body.
          const flick = 0.6 + Math.sin(game.time * 18 + e.x) * 0.4;
          for (let fi = 0; fi < 3; fi++) {
            const fx = e.x + Math.sin(game.time * 7 + fi * 2.1 + e.y) * s * 0.28;
            const fy = e.y - s * 0.28 - fi * s * 0.16 - flick * 3;
            g.circle(fx, fy, (2.6 - fi * 0.6) * (0.6 + flick * 0.6))
              .fill({ color: fi === 0 ? '#ffd98a' : fi === 1 ? '#ff9a3c' : '#c2401a', alpha: 0.75 - fi * 0.18 });
          }
        }

        // Boss-specific extra passes
        if (t.id === 'swipeWarden') {
          // Armor plating normally; guard-down window telegraphs hard (bright
          // pulsing red outline + exposed white-hot core) so a swipe attack
          // during it reads as a deliberate, earned execute, not a fluke.
          if (e._swipeVulnerable) {
            const pulse = 0.5 + 0.5 * Math.sin(game.time * 10);
            g.circle(e.x, e.y, s * 0.75 + pulse * 4).stroke({ width: 4, color: '#ff3146', alpha: 0.9 });
            glow(g, e.x, e.y, s * 0.65, '#ff3146', 1.8);
            g.circle(e.x, e.y, s * 0.22).fill({ color: '#fff2c8', alpha: 0.9 });
          } else {
            for (let pi = 0; pi < 4; pi++) {
              const pa = (pi / 4) * TAU + Math.PI / 4;
              g.circle(e.x + Math.cos(pa) * s * 0.42, e.y + Math.sin(pa) * s * 0.42, s * 0.16).fill('#8a6a3a');
            }
            g.circle(e.x, e.y, s * 0.2).stroke({ width: 2, color: '#5a4520', alpha: 0.8 });
          }
        } else if (t.id === 'bossOcular') {
          const pulse = 0.5 + 0.5 * Math.sin(game.time * 4);
          g.circle(e.x, e.y, s * 0.68 + pulse * 3).stroke({ width: 4, color: '#ffd166' });
          g.circle(e.x, e.y, s * 0.32).fill('#fff8d0');
          let pdx = 0, pdy = 0;
          if (game.player) {
            const dx = game.player.x - e.x, dy = game.player.y - e.y, d = Math.hypot(dx, dy);
            if (d > 0.001) { pdx = (dx / d) * s * 0.14; pdy = (dy / d) * s * 0.14; }
          }
          g.circle(e.x + pdx, e.y + pdy, s * 0.12).fill('#0a0510');
          g.circle(e.x + pdx, e.y + pdy, s * 0.05).fill('#ff3146');
        } else if (t.id === 'bossAida') {
          g.circle(e.x, e.y, s * 0.18).fill('#000000');
          g.circle(e.x, e.y, s * 0.08).fill('#ff7a1a');
        } else if (t.id === 'bossNecromancer') {
          const pulse = 0.5 + 0.5 * Math.sin(game.time * 5);
          glow(g, e.x - s * 0.18, e.y - s * 0.08, s * 0.10, '#7ad96b', pulse * 1.5);
          glow(g, e.x + s * 0.18, e.y - s * 0.08, s * 0.10, '#7ad96b', pulse * 1.5);
          g.circle(e.x - s * 0.18, e.y - s * 0.08, s * 0.10).fill('#7ad96b');
          g.circle(e.x + s * 0.18, e.y - s * 0.08, s * 0.10).fill('#7ad96b');
          for (let ti = 0; ti < 5; ti++) g.rect(e.x - s * 0.28 + ti * s * 0.14, e.y + s * 0.22, s * 0.09, s * 0.16).fill('#e8f5e0');
        } else if (t.id === 'bossVoidTitan') {
          const pulse = 0.5 + 0.5 * Math.sin(game.time * 3);
          glow(g, e.x, e.y, s * 0.20, '#b362ff', pulse * 2);
          g.circle(e.x, e.y, s * 0.20).fill('#b362ff');
          g.circle(e.x, e.y, s * 0.08).fill('#ffffff');
          g.circle(e.x, e.y, s * 0.7 + pulse * 4).stroke({ width: 3, color: '#b362ff', alpha: 0.5 });
        }

        if (e.hp < e.maxHp) {
          const bw = t.boss ? 80 : Math.max(20, s * 1.2);
          g.rect(e.x - bw / 2, e.y - s * 0.7 - 6, bw, 4).fill('#000000');
          g.rect(e.x - bw / 2, e.y - s * 0.7 - 6, bw * Math.max(0, e.hp / e.maxHp), 4).fill('#ff3146');
        }
      } catch (err) { console.error('[pixi draw enemy]', err); }
    });
  }

  // Enemy silhouettes are cached per-type (origin-centered local points,
  // computed once) instead of rebuilt with fresh trig + a fresh array every
  // single frame for every living enemy â€” with 50+ enemies on screen this
  // was the single heaviest allocation in the renderer (found in a code
  // review pass). `s` (= t.size) is constant per type, so the shape never
  // actually changes shape-to-shape, only its world position â€” translation
  // into a shared scratch array is the only per-frame work now.
  _localShapeFor(typeId, s) {
    const x = 0, y = 0;
    switch (typeId) {
      case 'bat': return { poly: [x, y - s * 0.4, x + s * 0.6, y, x, y + s * 0.3, x - s * 0.6, y] };
      case 'brute': return { rect: [x - s * 0.5, y - s * 0.5, s, s] };
      case 'ranger': { const pts = []; for (let i = 1; i <= 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; pts.push(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6); } return { poly: pts }; }
      case 'charger': return { poly: [x + s * 0.6, y, x - s * 0.5, y - s * 0.5, x - s * 0.5, y + s * 0.5] };
      case 'ghoul': return { circle: s * 0.5 };
      case 'necron': { const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const r = i % 2 ? s * 0.4 : s * 0.7; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'bossOcular': return { circle: s * 0.6 };
      case 'bossNecromancer': return { circle: s * 0.55 };
      case 'bossVoidTitan': { const pts = [x + s * 0.6, y]; for (let i = 1; i <= 6; i++) { const a = (i / 6) * TAU; pts.push(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6); } return { poly: pts }; }
      case 'bossAida': { const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const r = s * 0.55; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'slime': return { ellipse: [s * 0.55, s * 0.45] };
      // ---- Distinct silhouettes for enemy types that previously all fell
      // through to the same plain default circle (no bitmap sprite
      // pipeline exists in this project â€” see waterdrop-lighting skill's
      // "no hand-authored art" note â€” so this is procedural geometry, the
      // same technique already used for every other enemy above). ----
      case 'crystalite': { const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; const r = i % 2 ? s * 0.42 : s * 0.62; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.3); } return { poly: pts }; }
      case 'soulshard': return { poly: [x, y - s * 0.6, x + s * 0.38, y + s * 0.1, x, y + s * 0.55, x - s * 0.38, y + s * 0.1] };
      case 'bonewalker': { const pts = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; const r = s * (i % 2 ? 0.68 : 0.4); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'voidspawn': { const pts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2; const r = s * (i % 2 ? 0.66 : 0.26); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'steelbrute': { const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; pts.push(x + Math.cos(a) * s * 0.58, y + Math.sin(a) * s * 0.5); } return { poly: pts }; }
      case 'lightningbug': { const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const r = s * (i % 2 ? 0.62 : 0.22); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      case 'techsoldier': return { poly: [x - s * 0.42, y - s * 0.5, x + s * 0.42, y - s * 0.5, x + s * 0.5, y, x + s * 0.3, y + s * 0.5, x - s * 0.3, y + s * 0.5, x - s * 0.5, y] };
      case 'nanoswarm': { const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const r = s * (0.35 + (i % 3) * 0.12); pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return { poly: pts }; }
      default: return { circle: s * 0.5 };
    }
  }

  _enemyShapeFor(e, t, s) {
    const x = e.x, y = e.y;
    this._shapeCache = this._shapeCache || {};
    let local = this._shapeCache[t.id];
    if (!local) { local = this._localShapeFor(t.id, s); this._shapeCache[t.id] = local; }
    if (local.circle != null) return { circle: [x, y, local.circle] };
    if (local.rect) return { rect: [x + local.rect[0], y + local.rect[1], local.rect[2], local.rect[3]] };
    if (local.ellipse) return { ellipse: [x, y, local.ellipse[0], local.ellipse[1]] };
    // poly: translate into a single shared scratch array reused across every
    // enemy this frame â€” _paintShape consumes it synchronously right after
    // this call returns, so there's no risk of it changing under another
    // enemy before it's read.
    const src = local.poly;
    const out = this._polyScratch || (this._polyScratch = []);
    out.length = src.length;
    for (let i = 0; i < src.length; i += 2) { out[i] = x + src[i]; out[i + 1] = y + src[i + 1]; }
    return { poly: out };
  }

  // Tier tags ("T2"/"T3"...) â€” only drawn once tier >= 2 so a fresh run's
  // opening minutes look untouched. Pooled Text objects (see constructor),
  // same convention as _drawDamageNumbers, so this never allocates per-frame.
  _drawEnemyTierTags(game) {
    let idx = 0;
    game.enemies.forEach(e => {
      if (!e.tier || e.tier < 2) return;
      let txt = this._tierTagPool[idx];
      if (!txt) {
        txt = new Text({ text: '', style: this._textStyle(8, '#ff3146', '#1a0206', 3) });
        txt.anchor.set(0.5);
        this.tierTagContainer.addChild(txt);
        this._tierTagPool[idx] = txt;
      }
      txt.visible = true;
      txt.text = 'T' + e.tier;
      txt.position.set(e.x, e.y - e.t.size * 0.7);
      idx++;
    });
    for (let i = idx; i < this._tierTagPool.length; i++) this._tierTagPool[i].visible = false;
  }

  // fillColor may be null, for stroke-only overlays such as the ice shell.
  // The shape is only emitted when there is something to consume it —
  // emitting it and skipping the fill would leave the geometry in the path
  // for the stroke to pick up as well.
  _paintShape(g, shape, fillColor, strokeStyle) {
    const emit = () => {
      if (shape.poly) g.poly(shape.poly);
      else if (shape.rect) g.rect(...shape.rect);
      else if (shape.circle) g.circle(...shape.circle);
      else if (shape.ellipse) g.ellipse(...shape.ellipse);
    };
    if (fillColor) { emit(); g.fill(fillColor); }
    if (strokeStyle) { emit(); g.stroke(strokeStyle); }
  }

  // ------------------------------ PLAYER -----------------------------------
  // Where the gun sits and which way it points during a reload, plus where
  // the support hand is. Returned in gun-local terms so the caller can apply
  // it on top of the aim vector.
  //   angOff  extra rotation (negative = muzzle up, positive = muzzle down)
  //   pull    how far the gun is drawn back toward the body
  //   offX/Y  world-space nudge (the gun drops as it is worked)
  //   hand    support-hand position in gun-local space, or null to rest it
  //   slide   slide travel, 0..-6
  _reloadPose(p) {
    const none = { angOff: 0, pull: 0, offX: 0, offY: 0, hand: null, slide: 0, prog: 0 };
    if (!p.reloading || !p.reloadTotal) return none;
    const prog = Math.min(1, Math.max(0, 1 - p.reloadT / p.reloadTotal));
    // Phase boundaries. Deliberately uneven — the rack is the fast, snappy
    // beat and the mag swap is where the time actually goes.
    if (prog < 0.20) {                       // A: raise off target
      const f = prog / 0.20;
      return { angOff: -0.55 * f, pull: -2 * f, offX: 0, offY: -3 * f, hand: null, slide: 0, prog };
    }
    if (prog < 0.38) {                       // B: mag drops free
      return { angOff: -0.55, pull: -2, offX: 0, offY: -3, hand: { x: -3, y: 6 }, slide: 0, prog };
    }
    if (prog < 0.66) {                       // C: fresh mag up from the pocket
      const f = (prog - 0.38) / 0.28;
      return { angOff: -0.55, pull: -2, offX: 0, offY: -3, hand: { x: -3, y: 20 - f * 16 }, slide: 0, prog };
    }
    if (prog < 0.86) {                       // D: muzzle to 5 o'clock, rack it
      const f = (prog - 0.66) / 0.20;
      const rack = f < 0.5 ? -(f / 0.5) * 6 : -(1 - (f - 0.5) / 0.5) * 6;
      return { angOff: -0.55 + f * 1.15, pull: -1, offX: 0, offY: -1, hand: { x: 5 + rack, y: -4 }, slide: rack, prog };
    }
    const f = (prog - 0.86) / 0.14;          // E: swing back on target
    return { angOff: 0.60 * (1 - f), pull: -1 * (1 - f), offX: 0, offY: -1 * (1 - f), hand: null, slide: 0, prog };
  }

  // Weapon swap. Picking up or evolving into a different manual weapon used
  // to change what was in the character's hands between one frame and the
  // next. The swap now takes a beat: the old weapon drops away and the new
  // one comes up, which is also what makes the reload read correctly —
  // you visibly bring up the gun that is about to be reloaded.
  //
  // Returns { model, angOff, pull, drop } to compose on top of the reload
  // pose. During the first half the OLD model is still the one drawn.
  _swapPose(heldWid, dt) {
    if (this._lastHeldWid === undefined) this._lastHeldWid = heldWid;
    if (heldWid !== this._lastHeldWid) {
      this._swapFrom = this._lastHeldWid;
      this._lastHeldWid = heldWid;
      this._swapT = 0.34;
    }
    if (!this._swapT || this._swapT <= 0) {
      return { wid: heldWid, angOff: 0, pull: 0, drop: 0 };
    }
    this._swapT = Math.max(0, this._swapT - dt);
    const f = 1 - this._swapT / 0.34;          // 0 at swap start -> 1 done
    if (f < 0.5) {
      const k = f / 0.5;                        // old weapon drops away
      return { wid: this._swapFrom, angOff: k * 1.15, pull: -k * 6, drop: k * 9 };
    }
    const k = (f - 0.5) / 0.5;                  // new weapon comes up
    return { wid: heldWid, angOff: (1 - k) * 1.15, pull: -(1 - k) * 6, drop: (1 - k) * 9 };
  }

  // Draws whichever manual weapon is in hand. `parts` is a list of local-space
  // boxes so a new weapon is a data entry rather than new drawing code, and
  // `kind` covers the few silhouettes a box list cannot express.
  // Returns the model's accent colour, which the muzzle glow uses.
  _drawHeldWeapon(gf, model, gx, gy, ang, rl, p, game) { return drawHeldWeapon(gf, model, gx, gy, ang, rl, p, game); }

  // Two short arms from the shoulders to the grip. The character is a
  // waterdrop, so they are stubby capsules rather than jointed limbs — enough
  // to make the gun read as held rather than floating, which is what the
  // reload pantomime needs to land.
  // `bodyX/bodyY` are the sloshed body position (see _drawPlayer's bx/by).
  // The shoulders must hang off THAT, not off the raw player coordinate, or
  // the arms visibly detach from the body every time he takes a recoil kick.
  // Defaulted to p.x/p.y so any other caller keeps working unchanged.
  _drawArms(gf, p, bodyAng, r, gx, gy, gunAng, hand, bodyX, bodyY) { return drawArms(gf, p, bodyAng, r, gx, gy, gunAng, hand, bodyX, bodyY); }

  // ---- The face ------------------------------------------------------------
  // Drawn from the expression PARAMETERS the rig produces (brow angle, eye
  // openness, pupil scale, mouth curve) rather than from six fixed drawings,
  // so the face blends continuously — "two-thirds of the way from focused to
  // rage" is a real face here, not a crossfade between two pictures.
  //
  // Facing is handled by the same two axes the rig tracks:
  //   faceY  — aiming up (-) turns him away and the face slides off; aiming
  //            down (+) brings it fully toward the camera.
  //   faceX  — pushes the features to one side into a profile, and squashes
  //            the far eye the way a real head in three-quarter view does.
  //
  // Everything is drawn on `gf` (the front layer) so the face always sits on
  // top of the lit body sprite.
  _drawHeroFace(gf, bx, by, r, bodyAng, sqx, sqy, A, p) { return drawHeroFace(gf, bx, by, r, bodyAng, sqx, sqy, A, p); }

  // Turns the rig's skid-spray requests into real particles. Kept here rather
  // than in heroAnim so that module never has to know the pool exists.
  _emitSlideSpray(game, A) {
    const list = A.takeSpray();
    if (!list || !game.parts) return;
    const p = game.player;
    for (const s of list) {
      const pt = game.parts.acquire();
      if (!pt) return;
      pt.x = p.x - Math.cos(s.ang) * p.r * 0.5;
      pt.y = p.y - Math.sin(s.ang) * p.r * 0.5 + p.r * 0.4;
      pt.vx = Math.cos(s.ang) * s.spd;
      pt.vy = Math.sin(s.ang) * s.spd - 30;
      pt.life = 0.32 + Math.random() * 0.3; pt.max = pt.life;
      pt.color = HERO_COLORS.body; pt.size = s.size; pt.type = 'blood';
    }
  }

  _drawPlayer(game) {
    const g = this.gPlayer; g.clear();
    const gf = this.gPlayerFront; gf.clear();
    const p = game.player;
    const aimAng = Math.atan2(p.aimY, p.aimX);

    // The whole rig — facing, gait, water springs, slide, recoil kick and the
    // face — is computed in game/heroAnim.js. This function only draws what it
    // reports. See that file for why every value there is a spring.
    const A = this.heroAnim.update(game, game.dt || 0.016);
    this._emitSlideSpray(game, A);

    // Idle animation: a slow breathing pulse when standing still, layered onto
    // the existing squish/tilt "weight" system rather than as a parallel one.
    const idleT = A.speed < 0.08;
    const breathe = idleT ? Math.sin((p.bob || 0) * 0.6) * 0.02 : 0;
    // The idle SETTLE (heroAnim) spreads him downward the longer he stands —
    // an unsupported drop does not hold a perfect teardrop indefinitely.
    const settle = A.settle;
    // Water squash/stretch. `A.stretch` is signed: positive elongates him
    // along travel, negative pancakes him on a hard stop.
    const sqx = 1 + p.squish * 0.25 + breathe - A.stretch * 0.55 + settle * 0.10;
    const sqy = 1 - p.squish * 0.18 - breathe * 0.6 + A.stretch * 0.65 - settle * 0.09;

    // Shadow â€” offset directionally AWAY from the current merged light
    // (flashlight normally, muzzle-flash when firing) so it visibly reacts
    // when the muzzle flash fires, i.e. the muzzle flash "casts" the shadow.
    const L = this._testLight;
    let shOffX = 0, shOffY = 10, shElong = 1, shDark = 0.45;
    if (L) {
      const ldx = p.x - L.x, ldy = p.y - L.y;
      const ld = Math.hypot(ldx, ldy) || 1;
      const mt = L.mt || 0;
      const len = 9 + mt * 20;
      shOffX = (ldx / ld) * len;
      shOffY = Math.max(5, (ldy / ld) * len + 6);
      shElong = 1 + mt * 0.55;
      shDark = 0.42 + mt * 0.28;
    }
    g.ellipse(p.x + shOffX, p.y + shOffY, p.r * 0.9 * sqx * shElong, p.r * 0.32).fill({ color: '#000000', alpha: shDark });

    // Drawn LARGER than the collision radius.
    //
    // `p.r` is 14 world px, which is the hitbox and should stay 14 — it is
    // what every dodge, every contact ring and every spawn distance is tuned
    // against, and growing it would silently make the player easier to hit.
    // But 14 renders him about 30px across on a phone, and at that size the
    // bandage wraps, the knot, the tails and the cigar's paper band are each
    // under a pixel: detail that physically cannot resolve.
    //
    // Separating the two lets the character actually be a character without
    // touching a single balance number.
    const r = p.r * 1.22;
    // ---- Where the body actually sits this frame ---------------------------
    // Three offsets, all from the rig, all in world pixels:
    //   wob   — the water inside him sloshing after an acceleration change
    //   kick  — the recoil punch, straight back along the aim
    //   shake — a short high-frequency rattle right after a shot
    const shake = A.shakeT > 0 ? A.shakeT * 7 : 0;
    // Finisher offsets. VISUAL ONLY: they move the DRAWN body, never p.x/p.y,
    // so a lunge or a leap can never desync the hitbox, the aim or a dodge.
    // The shadow above is drawn from p.x/p.y and therefore stays on the ground
    // while he is in the air — which is the only thing that sells the height.
    const finOx = p._finOx || 0, finOy = p._finOy || 0, finZ = p._finZ || 0;
    const bx = p.x + finOx
      + A.wobX * r * 0.55
      - (p.aimX || 0) * A.kick * 2.6
      + (shake ? (Math.random() - 0.5) * shake : 0);
    const by = p.y + finOy - finZ
      + A.wobY * r * 0.55
      - (p.aimY || 0) * A.kick * 2.6
      + (shake ? (Math.random() - 0.5) * shake : 0)
      + settle * r * 0.06;

    // Lean: into the strafe, back against a skid, and whipped by a fast turn.
    // A backpedal (gait < 0) leans him away from the aim, which is what makes
    // "walking backwards while shooting" read as reluctance rather than as
    // sliding on ice.
    const bodyAng = (p.tilt || 0)
      + A.strafe * 0.30
      - A.gait * 0.10
      + A.turn * 0.22
      - A.slide * 0.34 * Math.sign(A.slideX || 1)
      + (idleT ? Math.sin((p.bob || 0) * 0.4) * 0.05 : 0);
    // Outline comes from game/heroShape.js, which the equipment paperdoll
    // also reads — the two used to be unrelated drawings and looked like
    // different characters. Sampled as points here because Graphics needs
    // points; the paperdoll asks the same module for an SVG path.
    // Outline points, with a per-vertex surface ripple applied. A rigid
    // silhouette is the single biggest thing that stopped him reading as
    // liquid — the shape has to breathe along its own edge, not just scale.
    // Sampled at 14 steps rather than 8 now that each vertex moves
    // independently; below that the ripple looks like a polygon glitching.
    const half = heroHalfPoints(r, 14);
    const localPts = [];
    const jig = A.jiggle;
    const nHalf = half.length / 2;
    const ripple = (i) => {
      // Two out-of-phase waves so the edge never looks like one clean sine.
      const t = i / nHalf;
      return 1 + (Math.sin(A.jigglePh * 1.7 + t * 7.1) * 0.030
                + Math.sin(A.jigglePh * 2.6 - t * 4.3) * 0.018) * jig;
    };
    for (let i = 0; i < half.length; i += 2) {
      const k = ripple(i / 2);
      localPts.push(half[i] * k, half[i + 1] * k);
    }
    for (let i = half.length - 2; i >= 0; i -= 2) {
      const k = ripple(i / 2 + 0.5); // offset so the two halves don't mirror perfectly
      localPts.push(-half[i] * k, half[i + 1] * k);
    }
    const rotated = rotPoly(bx, by, bodyAng, scalePts(localPts, sqx, sqy));

    // === The body is a real normal-mapped lit sprite ===
    // Baked sphere normal map + the single merged moving light (flashlight /
    // muzzle flash), per the project's one approved lighting technique — NOT
    // a glow filter and not a gradient sprite. See the waterdrop-lighting
    // skill. This replaces any ambient/point-light-sprite fill for the body.
    const bodyDiam = r * 2.05;
    this.playerBodySprite.visible = true;
    // Follows the sloshed/kicked body position, so the lit shading and the
    // drawn outline never separate during a recoil punch.
    this.playerBodySprite.position.set(bx, by - r * 0.05);
    // scale, not width/height: PixiJS's width setter derives from the LOCAL
    // bounds, so assigning it on a rotated sprite feeds the rotated bounds
    // back in and the body creeps in size as he turns. Scaling from the
    // texture's own size is rotation-independent.
    const texW = this.litDiffuseTex.width || 1, texH = this.litDiffuseTex.height || 1;
    this.playerBodySprite.scale.set((bodyDiam * sqx) / texW, (bodyDiam * sqy) / texH);
    this.playerBodySprite.rotation = bodyAng;
    // The expression tints the body: hurt pushes red, rage pushes hot orange.
    // Damage flash still wins outright — being hit must never be ambiguous.
    let bodyTint = this.playerBodyColor;
    if (p.hit > 0) bodyTint = this.playerBodyFlash;
    else if (A.expr.tint && A.expr.tintMix > 0.01) {
      bodyTint = mixHex(HERO_COLORS.body, A.expr.tint, A.expr.tintMix);
    }
    this.playerBodySprite.tint = bodyTint;
    this._updateLitUniforms(this.playerBodyFilter, this.playerBodySprite, this._testLight,
      [bodyDiam * sqx, bodyDiam * sqy]);
    gf.poly(rotated).stroke({ width: 2.4, color: '#06121e' });

    // Meniscus — the bright surface-tension rim a real drop carries where the
    // light hits it. Drawn as a partial arc on the lit side rather than a full
    // ring, so it reads as a highlight and not as an outline.
    const Lm = this._testLight;
    if (Lm) {
      const la = Math.atan2(Lm.y - by, Lm.x - bx);
      const rimR = r * 0.94;
      const seg = [];
      for (let i = 0; i <= 10; i++) {
        const a = la - 0.95 + (i / 10) * 1.9;
        seg.push(bx + Math.cos(a) * rimR * sqx, by + Math.sin(a) * rimR * sqy);
      }
      gf.poly(seg, false).stroke({ width: 1.6, color: '#dffbff', alpha: 0.30 + (Lm.mt || 0) * 0.4 });
    }

    // Internal refraction band — a soft lens of concentrated colour that
    // shifts opposite the slosh, the way the mass inside a drop lags behind
    // its skin. This is the detail that makes the body look FULL of water
    // instead of being a coloured shell.
    const refX = bx - A.wobX * r * 0.9, refY = by - A.wobY * r * 0.9 + r * 0.12;
    gf.ellipse(refX, refY, r * 0.52 * sqx, r * 0.40 * sqy)
      .fill({ color: '#bff0ff', alpha: 0.10 + A.speed * 0.05 });

    // Highlight droplets (rotated with the body, riding the slosh).
    //
    // The big one used to be 2.6 x 4.2 of pure white at alpha 0.85, sitting at
    // (-0.35r, -0.50r). The eyes are 3.3 x 3.8 of #f2fbff at 0.94 and live at
    // -0.34r +/- 0.27r — so this glint was eye-sized, eye-coloured, and INSIDE
    // the eye band. Worse, it rotates only with `bodyAng`, not with the head's
    // turn: aim right, both eyes swing right, and this white blob stays up on
    // the left. That is the "third eye" Timmy kept seeing, and why "one eye
    // became two" survived the eye-layout fix.
    //
    // Now: lifted clear of the eye band, shrunk well below eye size, dimmed,
    // and pushed to the side the face is turning AWAY from, so it reads as
    // light on a wet surface instead of competing with the face.
    // The asymmetry Timmy found is what proves this is the culprit: the glint
    // is always on the drop's LEFT. Aim left and an eye lands on top of it, so
    // the two merge and nothing looks wrong — he reported left as fine, and
    // "the pupil goes straight into it" when aiming down-left. Aim RIGHT and
    // both eyes swing away, leaving it stranded on its own as a white blob
    // that reads as an eye which refuses to disappear.
    const glintX = -r * 0.34 + A.wobX * r * 0.5;
    const glintY = -r * 0.74 + A.wobY * r * 0.4;
    const [hx1, hy1] = rot(glintX, glintY, bodyAng);
    // Gone completely by a 3/4 turn rather than merely dimmed. A specular
    // highlight is the reflection of one light source; on a head in profile it
    // has no business still sitting on the cheek, and leaving even a faint one
    // there is what let it keep reading as a second eye.
    const glintA = 0.42 * Math.max(0, 1 - Math.abs(A.faceX) * 1.25);
    if (glintA > 0.01) {
      gf.ellipse(bx + hx1, by + hy1, 1.7, 2.6).fill({ color: '#eafaff', alpha: glintA });
    }
    const [hx2, hy2] = rot(r * 0.3, r * 0.25, bodyAng);
    gf.circle(bx + hx2, by + hy2, 1.4).fill({ color: '#ffffff', alpha: 0.30 });

    // ---- The face ----------------------------------------------------------
    this._drawHeroFace(gf, bx, by, r, bodyAng, sqx, sqy, A, p);

    if (p.iframes > 0) {
      const [ex1, ey1] = rot(-2, -2, bodyAng), [ex2, ey2] = rot(3, -2, bodyAng);
      gf.circle(bx + ex1, by + ey1, 1.6).fill('#ffd166');
      gf.circle(bx + ex2, by + ey2, 1.6).fill('#ffd166');
    }

    // Level-up: an energy fill rising bottom-to-top over the body, like the
    // waterdrop is visibly charging up rather than just flashing the
    // screen (that's _levelUpFlash, drawn separately as a full-screen
    // wash) — the duration here (0.85) must match where engine.js sets
    // _levelUpShieldT.
    if (game._levelUpShieldT > 0) {
      const dur = 0.85;
      const t = game._levelUpShieldT;
      const prog = Math.min(1, 1 - t / dur);           // 0 at start, 1 once fully risen
      const fadeOut = Math.min(1, t / (dur * 0.22));    // holds, then fades in the last ~fifth
      const bodyTop = by - r * 1.2, bodyBottom = by + r * 1.05;
      const fillY = bodyBottom - prog * (bodyBottom - bodyTop);
      const halfW = r * 0.8;
      const fillH = bodyBottom - fillY;
      if (fillH > 1) {
        gf.rect(bx - halfW, fillY, halfW * 2, fillH).fill({ color: '#8fffe0', alpha: 0.24 * fadeOut });
      }
      // Bright leading edge — the crest of the rising energy.
      gf.ellipse(bx, fillY, halfW * 1.05, 4.5).fill({ color: '#ffffff', alpha: 0.8 * fadeOut });
      glow(gf, bx, fillY, r * 0.95, '#ffd166', 1.5 * fadeOut);
    }

    // ===== Rank-unlocked cosmetics (see ProfilePanel) =====
    const cos = game.cosmetics || {};

    // The headband and the cigar are the character, not unlockables.
    //
    // Both already existed but were gated behind rank cosmetics
    // (`cos.headbandColor` / `cos.cigarOn`), so the drop spent the whole early
    // game as a plain blob and only became the character on the concept art
    // after enough profile levels. They are now the DEFAULT look; the cosmetic
    // fields only override the colour.
    //
    // Wrapped, not flat: three offset bands with a knot and two loose tails,
    // because a single rectangle reads as a sweatband and the reference is a
    // field dressing that has been through something.
    // In play he is about 40px across. Everything the concept art gets its
    // character from — three bandage wraps, seams, a knot, two tails, the
    // cigar's paper band, smoke — is under a pixel each at that size. Drawing
    // it anyway produced mush, which is exactly how it looked on the phone.
    //
    // So the in-game version is the SILHOUETTE only: one band, one tail, one
    // dark cigar with an ember. The full construction lives in the Character
    // panel and the equipment paperdoll, where he is drawn large enough for it
    // to resolve. Same character, drawn for the distance it is seen at.
    // Menus only.
    //
    // He is ~34px across in play. The bandage and the cigar are what give the
    // concept art its character, and at that size they are a smear across the
    // top of his head — thinning them helped and did not fix it, because the
    // problem is not detail density, it is that there are not enough pixels
    // for ANY of it to resolve. Drawn only where he is big enough to earn it:
    // the Character panel and the equipment paperdoll.
    //
    // The cosmetic flags still turn them on for anyone who unlocked them and
    // wants them regardless.
    const bandCol = cos.headbandColor || '#d9cba8';
    if (cos.headbandColor) {
      // The band moved into heroDraw.js so the intro film, the paperdoll and
      // the walkable station all wear the same one. It was drawn ONLY here,
      // from numbers hardcoded in this file, while heroShape.js carried a
      // headband entry nothing read — one look in the run and a bare head
      // everywhere else. Same class of defect as the parallel gear system.
      drawHeadband(gf, bx, by, r, bandCol, { sqx, sqy, lean: bodyAng, t: game.time });
    }

    // Cigar: menus only, same reasoning as the bandage above. Kept behind the
    // cosmetic flag for anyone who unlocked it and wants it in play anyway.
    if (cos.cigarOn) {
      const side = (A && A.faceX >= 0) ? 1 : -1;
      const cigarAng = bodyAng + 0.26 * side;
      const x0 = r * 0.30 * side, y0 = -r * 0.08;
      const L = r * 0.55;
      gf.poly(rotPoly(bx, by, cigarAng, [
        x0, y0 - r * 0.055,
        x0 + L * side, y0 - r * 0.06,
        x0 + L * side, y0 + r * 0.06,
        x0, y0 + r * 0.065,
      ])).fill('#5a4632');
      const [tipX, tipY] = rot(x0 + L * side, y0, cigarAng);
      const tipPulse = 0.5 + 0.5 * Math.sin(game.time * 2.4);
      gf.circle(bx + tipX, by + tipY, r * 0.06)
        .fill({ color: tipPulse > 0.5 ? 0xffb347 : 0xff6a1a });
      glow(gf, bx + tipX, by + tipY, r * 0.18, '#ff6a1a', 0.45 + tipPulse * 0.6);
    }

    // ===== Reload pose =====
    // The gun used to stay locked to the aim vector while a mag animation
    // played inside it, which reads as the gun reloading itself. A real
    // reload is a whole-body action, so the pose below drives where the gun
    // sits and which way it points, and the arms below follow it.
    //   A  raise and tilt up off the target
    //   B  mag drops free
    //   C  fresh mag comes up from the back pocket into the well
    //   D  muzzle drops to about 5 o'clock and the slide is racked
    //   E  swing back up onto the target
    const rl = this._reloadPose(p);
    // The swap pose composes on top: a weapon that is being brought up is
    // still angled away, so a reload that starts the instant you switch
    // reads as one continuous motion rather than two fighting each other.
    const sw = this._swapPose(game._heldWid, game.dt || 0.016);
    const aimDrawAng = aimAng + rl.angOff + sw.angOff;

    // ===== Gun (rotated in aim direction) =====
    // Anchored to the SLOSHED body position (bx/by), not the raw player
    // coordinate, so the weapon rides the recoil punch and the water wobble
    // with him. Anchoring it to p.x/p.y made the body kick out from under a
    // gun that stayed perfectly still, which read as the drop flinching away
    // from its own weapon.
    const recoil = -p.recoil * 4;
    const gx = bx + Math.cos(aimDrawAng) * (recoil + rl.pull + sw.pull) + rl.offX;
    // +3.5 rather than +1: the weapon sat high enough to cross the face, and
    // the face is the thing the player looks at for an entire run — six
    // expressions, blinking and the reload reaction are all wasted if a gun
    // barrel is parked across them. Deliberately a small nudge: any further
    // and the hands stop reading as holding it at the shoulder.
    const gy = by + 3.5 + Math.sin(aimDrawAng) * (recoil + rl.pull + sw.pull) + rl.offY + sw.drop;
    // Arms go down BEFORE the gun so the hands read as gripping it, not
    // hovering in front of it.
    this._drawArms(gf, p, bodyAng, r, gx, gy, aimDrawAng, rl.hand, bx, by);

    // Every manual weapon draws its own model — the player used to hold one
    // generic pistol whichever weapon was equipped, which made switching
    // weapons invisible.
    const model = WEAPON_MODELS[sw.wid] || WEAPON_MODELS._default;
    const accentColor = this._drawHeldWeapon(gf, model, gx, gy, aimDrawAng, rl, p, game);

    if (p.recoil > 0.05) {
      const [mx, my] = rot(model.muzzle, 0, aimDrawAng);
      // Small hot-tip glow at the barrel end (the real flash burst itself is
      // drawn additively in _drawLights as a baked starburst sprite).
      const muzzleR = 2 + p.recoil * 2.4;
      gf.circle(gx + mx, gy + my, muzzleR).fill(accentColor);
    }
    if (p.reloading) {
      const headX = bx, headY = by - r * 1.55 - 8; // above the character's head, not on the gun
      const isRevolver = p._reloadWid === 'hydropistol' || p._reloadWid === 'hydropistol_evo';
      const prog = p.reloadTotal ? Math.min(1, Math.max(0, 1 - p.reloadT / p.reloadTotal)) : 0;

      if (isRevolver) {
        // Revolver cylinder: chambers empty out, then refill in order as reload progresses
        const chambers = Math.max(1, Math.round(p._reloadMag || 6));
        const cylR = 8.5;
        gf.circle(headX, headY, cylR + 3.2).fill({ color: '#1a1410', alpha: 0.88 }).stroke({ width: 1.3, color: '#8a6d3b' });
        for (let i = 0; i < chambers; i++) {
          const a = (i / chambers) * TAU - Math.PI / 2;
          const ccx = headX + Math.cos(a) * cylR * 0.62, ccy = headY + Math.sin(a) * cylR * 0.62;
          const filled = i / chambers < prog;
          gf.circle(ccx, ccy, cylR * 0.24).fill(filled ? '#ffd166' : '#2a1f12');
        }
        this.reloadText.anchor.set(0, 0.5);
        this.reloadText.position.set(headX + cylR + 8, headY);
      } else {
        // Mag and slide follow the reload POSE (see _reloadPose) rather than
        // running their own private timeline, so the gun, the arms and the
        // magazine are all describing the same action. The ejected mag isn't
        // drawn here at all — it is a real particle thrown by the engine on
        // reload start, so it tumbles to the ground and stays there.
        const magW = 5, magH = 10;
        if (prog >= 0.38) {
          // fresh mag rides the support hand up into the well, then seats
          const seat = rl.hand || { x: -3, y: 4 };
          const my2 = prog < 0.66 ? seat.y : 4;
          const [ex, ey] = rot(-3, my2, aimDrawAng);
          gf.rect(gx + ex - magW / 2, gy + ey - magH / 2, magW, magH)
            .fill('#2a313d').stroke({ width: 0.6, color: '#11161e' });
        }
        if (rl.slide !== 0) {
          const [sxo, syo] = rot(5 + rl.slide, -4, aimDrawAng);
          gf.rect(gx + sxo - 5, gy + syo - 1.4, 10, 2.8).fill('#3a4658');
        }
        // Other weapons: just the text + a clean spinning ring (no cylinder)
        const spinR = 7.5;
        const spinAng = game.time * 9;
        const sweep = Math.PI * 1.4;
        const [sx0, sy0] = [headX + Math.cos(spinAng) * spinR, headY + Math.sin(spinAng) * spinR];
        gf.moveTo(sx0, sy0).arc(headX, headY, spinR, spinAng, spinAng + sweep).stroke({ width: 2, color: '#ffd166' });
        this.reloadText.anchor.set(0.5, 1);
        this.reloadText.position.set(headX, headY - spinR - 4);
      }
      this.reloadText.visible = true;
      this.reloadText.text = 'RELOADING';
    } else if (this.reloadText) {
      this.reloadText.visible = false;
    }

    // crosshair
    if (!game.input.joyAim || (!game.input.joyAim.x && !game.input.joyAim.y)) {
      // Same conversion the aim itself uses (engine.screenToWorld), so the
      // crosshair is guaranteed to sit exactly where the shot will go. This
      // used to be its own copy of the arithmetic and drifted from the aim.
      const [wmx, wmy] = game.screenToWorld(game.input.mx, game.input.my);
      gf.moveTo(wmx - 8, wmy).lineTo(wmx - 3, wmy)
        .moveTo(wmx + 3, wmy).lineTo(wmx + 8, wmy)
        .moveTo(wmx, wmy - 8).lineTo(wmx, wmy - 3)
        .moveTo(wmx, wmy + 3).lineTo(wmx, wmy + 8)
        .stroke({ width: 1.5, color: '#ff7a1a', alpha: 0.67 });
    }

    // Orbit weapons. Derived from the weapon table by behaviour rather than
    // from a hardcoded id list — any orbit weapon added later (or evolved
    // into) was previously invisible, spinning around dealing damage with
    // nothing drawn. Same reason the drone loop below is derived too.
    for (const wId of game.run.ownedWeapons) {
      if (!WEAPONS[wId] || WEAPONS[wId].behaviour !== 'orbit') continue;
      const w = WEAPONS[wId];
      const lvl = game.run.weaponLvls[wId] || 0;
      const ws = game.computeWeaponStats ? game.computeWeaponStats(w || {}, lvl) : {};
      const count = ws.orbitCount || 2;
      const radius = (ws.orbitRadius || 80) * game.run.stats.areaMult;
      const angBase = game.time * (ws.orbitSpeed || 2);
      const orbitColor = ws.color || '#ff7a1a';
      for (let i = 0; i < count; i++) {
        const a = angBase + (i / count) * TAU;
        const ox = p.x + Math.cos(a) * radius, oy = p.y + Math.sin(a) * radius;
        glow(gf, ox, oy, 9, orbitColor, 0.9);
        if (wId === 'whirlwind') {
          gf.poly(rotEllipsePoly(ox, oy, angBase * 3, 12, 3)).fill(orbitColor);
        } else if (wId === 'frostOrb') {
          gf.circle(ox, oy, 9).fill(orbitColor);
          gf.circle(ox, oy, 4).fill({ color: '#ffffff', alpha: 0.45 });
          for (let k = 1; k <= 2; k++) { // trailing frost shards
            const ta = a - k * 0.14, tx = p.x + Math.cos(ta) * radius, ty = p.y + Math.sin(ta) * radius;
            gf.poly([tx, ty - 3, tx + 2.4, ty, tx, ty + 3, tx - 2.4, ty]).fill({ color: '#bff0ff', alpha: 0.35 / k });
          }
        } else if (wId === 'emberOrbs') {
          gf.circle(ox, oy, 8).fill(orbitColor);
          gf.circle(ox, oy, 3.5).fill({ color: '#fff2c2', alpha: 0.85 });
          for (let k = 1; k <= 2; k++) { // trailing embers
            const ta = a - k * 0.16, tx = p.x + Math.cos(ta) * radius, ty = p.y + Math.sin(ta) * radius;
            gf.circle(tx, ty, 3 - k).fill({ color: '#ff7a1a', alpha: 0.4 / k });
          }
        } else {
          gf.circle(ox, oy, 8).fill(orbitColor);
        }
      }
    }

    // Drones — small hovering bodies at whatever positions engine.js's
    // weaponDrone computed this frame (see game._dronePositions). Keyed off
    // whatever the engine actually populated, so every drone weapon draws,
    // not just droneSquad.
    if (game._dronePositions) {
      for (const [wId, list] of Object.entries(game._dronePositions)) {
        if (!list || !list.length || !game.run.ownedWeapons.includes(wId)) continue;
        const dc = (WEAPONS[wId] && WEAPONS[wId].base && WEAPONS[wId].base.color) || '#4dc4ff';
        for (let di = 0; di < list.length; di++) {
          const d = list[di];
          const bob = Math.sin(game.time * 4 + d.x * 0.05) * 3;
          const dy = d.y + bob;
          glow(gf, d.x, dy, 8, dc, 0.8);
          // little hull + rotor blur, so a drone reads as a machine rather
          // than as another glowing dot
          gf.poly([d.x - 6, dy, d.x, dy - 5, d.x + 6, dy, d.x, dy + 5]).fill('#16222e');
          gf.poly([d.x - 6, dy, d.x, dy - 5, d.x + 6, dy, d.x, dy + 5]).stroke({ width: 1.4, color: dc, alpha: 0.9 });
          const spin = game.time * 22 + di;
          gf.ellipse(d.x, dy - 5, 7, 1.4 + Math.abs(Math.sin(spin)) * 1.2).fill({ color: dc, alpha: 0.35 });
          gf.circle(d.x, dy, 2.2).fill({ color: '#ffffff', alpha: 0.9 });
        }
      }
    }
  }

  // -------------------------------- PET ------------------------------------
  // A rescuable companion (see game/companions.js). Reuses the hero's own
  // silhouette (heroHalfPoints) rather than new art, but scaled per build —
  // "stout" wide and low, "slender" narrow and tall — so it reads as a
  // different person, not a recolored copy of the player.
  _drawCompanion(game) {
    const g = this.gCompanion; g.clear();
    const c = game.companionNpc;
    if (!c.alive) {
      // A dim marker where they fell — the rescue failed, but the ground
      // still remembers it happened, same as the player's own corpse marks.
      g.circle(c.x, c.y, c.r * 0.8).fill({ color: '#3a3a3a', alpha: 0.35 });
      return;
    }
    const [sqx, sqy] = c.build === 'slender' ? [0.75, 1.25] : [1.35, 0.85];
    const half = heroHalfPoints(c.r, 8);
    const localPts = [];
    for (let i = 0; i < half.length; i += 2) localPts.push(half[i], half[i + 1]);
    for (let i = half.length - 2; i >= 0; i -= 2) localPts.push(-half[i], half[i + 1]);
    const pts = scalePts(localPts, sqx, sqy);
    const poly = [];
    for (let i = 0; i < pts.length; i += 2) poly.push(c.x + pts[i], c.y + pts[i + 1]);

    g.ellipse(c.x, c.y + c.r * 0.95, c.r * 0.85 * sqx, c.r * 0.3).fill({ color: '#000000', alpha: 0.4 });
    // A brief hit flash reuses the same white-tint convention the player's
    // own p.hit uses, so getting shot at reads the same way on either body.
    const fillColor = c.hit > 0 ? '#ffffff' : c.color;
    g.poly(poly).fill({ color: fillColor, alpha: 0.94 }).stroke({ width: 2, color: c.colorDeep || '#06121e' });
    g.ellipse(c.x - c.r * 0.3, c.y - c.r * 0.4, 2.2, 3.4).fill({ color: '#ffffff', alpha: 0.75 });
    // Low-hp glow — same "something is wrong" read the player's own hp-low
    // vignette gives, localized to their body instead of the whole screen.
    if (c.hp / c.maxHp < 0.35) glow(g, c.x, c.y, c.r * 1.4, '#ff5566', 0.8);
  }

  _drawPet(game) {
    const g = this.gPet; g.clear();
    const pet = game.pet;
    const petType = game.activePet.type;
    const petLevel = game.activePet.level || 1;
    const wobbleY = Math.sin(pet.wobble) * 2.5;
    const color = PET_COLORS[petType] || '#ffffff';
    const sz = 7 + Math.floor(petLevel / 40);
    const cx = pet.x, cy = pet.y + wobbleY;
    glow(g, cx, cy, sz, color, 1.0 + Math.sin(pet.wobble * 1.3) * 0.2);

    if (petType === 'aquaSprite') {
      g.moveTo(cx, cy - sz * 1.2)
        .bezierCurveTo(cx + sz, cy - sz * 0.35, cx + sz, cy + sz * 0.7, cx, cy + sz)
        .bezierCurveTo(cx - sz, cy + sz * 0.7, cx - sz, cy - sz * 0.35, cx, cy - sz * 1.2)
        .fill({ color, alpha: 0.92 });
      g.ellipse(cx - sz * 0.3, cy - sz * 0.55, 1.8, 3).fill({ color: '#ffffff', alpha: 0.6 });
    } else if (petType === 'emberFairy') {
      g.moveTo(cx, cy - sz * 1.3)
        .bezierCurveTo(cx + sz * 0.9, cy, cx + sz * 0.6, cy + sz * 0.8, cx, cy + sz)
        .bezierCurveTo(cx - sz * 0.6, cy + sz * 0.8, cx - sz * 0.9, cy, cx, cy - sz * 1.3)
        .fill({ color, alpha: 0.92 });
      g.circle(cx, cy + sz * 0.2, sz * 0.45).fill('#ffdf80');
    } else if (petType === 'shadowWisp') {
      g.circle(cx, cy, sz).fill({ color, alpha: 0.92 });
      g.circle(cx - sz * 0.32, cy - sz * 0.2, sz * 0.26).fill({ color: '#000000', alpha: 0.7 });
      g.circle(cx + sz * 0.32, cy - sz * 0.2, sz * 0.26).fill({ color: '#000000', alpha: 0.7 });
    } else if (petType === 'stormHawk') {
      g.poly([cx, cy - sz * 1.2, cx + sz * 0.75, cy, cx, cy + sz * 1.2, cx - sz * 0.75, cy]).fill({ color, alpha: 0.92 }).stroke({ width: 1, color: '#ffffff', alpha: 0.5 });
    } else if (petType === 'lifeSprite') {
      g.rect(cx - sz * 0.25, cy - sz, sz * 0.5, sz * 2).fill({ color, alpha: 0.92 });
      g.rect(cx - sz, cy - sz * 0.25, sz * 2, sz * 0.5).fill({ color, alpha: 0.92 });
    }

    if (petLevel > 1) {
      g.circle(cx + sz * 0.9, cy - sz * 0.9, 5).fill({ color: '#0a0d12', alpha: 0.85 });
      this.petLevelText.visible = true;
      this.petLevelText.text = petLevel > 99 ? '!' : String(petLevel);
      this.petLevelText.style.fill = color;
      this.petLevelText.position.set(cx + sz * 0.9, cy - sz * 0.9);
    } else {
      this.petLevelText.visible = false;
    }
  }

  // --------------------------- PROJECTILES ----------------------------------
  _drawLitHydroProjectiles(game) {
    let idx = 0;
    const pool = this._litProjPool;
    game.projs.forEach(pr => {
      if (pr.friendly === false) return;
      if (pr._wid !== 'hydropistol' && pr._wid !== 'hydropistol_evo') return;
      if (idx >= pool.length) return;
      const { sprite, filter } = pool[idx++];
      // 50% smaller than before, per spec â€” the sprite/lit-shader treatment
      // itself is unchanged, just scaled down.
      const sz = (pr.size || 6) * 0.5;
      sprite.visible = true;
      sprite.position.set(pr.x, pr.y);
      sprite.width = sz; sprite.height = sz;
      sprite.tint = pr.color || '#5fd6ff';
      this._updateLitUniforms(filter, sprite, this._testLight);
    });
    for (let i = idx; i < pool.length; i++) pool[i].sprite.visible = false;
  }

  _drawProjectiles(game) {
    const g = this.gProjectiles; g.clear();
    game.projs.forEach(pr => {
      const sz = pr.size || 6;
      const lvlBoost = 1 + (pr._wlvl || 0) * 0.08;
      const ang = pr._ang != null ? pr._ang : Math.atan2(pr.vy, pr.vx);
      const x = pr.x, y = pr.y;

      if (pr.friendly === false) {
        const pulse = 0.7 + 0.3 * Math.sin(game.time * 18);
        glow(g, x, y, sz * 1.4 * pulse, '#ff3146', 1.6);
        const [tx, ty] = rot(-sz * 2.2, 0, ang);
        g.ellipse(x + tx, y + ty, sz * 2.0, sz * 0.6).fill({ color: '#ff3146', alpha: 0.6 });
        g.circle(x, y, sz * 1.4 * pulse).fill('#ffec99');
        g.circle(x, y, sz * 1.0 * pulse).fill('#ff3146');
        return;
      }
      // Starter weapon (hydropistol) bolts â€” and its evolution â€” are
      // rendered by the normal-mapped lit sprite pool instead â€” see
      // _drawLitHydroProjectiles.
      if (pr._wid === 'hydropistol' || pr._wid === 'hydropistol_evo') return;

      switch (pr._wid) {
        case 'shotgun': case 'tidal': {
          glow(g, x, y, sz, '#ff7a1a', 0.8);
          g.circle(x, y, sz * lvlBoost).fill('#ffd166');
          g.circle(x - sz * 0.3, y - sz * 0.3, sz * 0.3).fill('#fff8d0');
          break;
        }
        case 'autoBolts': case 'runicRifle': {
          const len2 = sz * 3.6 * lvlBoost, w = sz * 0.5;
          g.poly(rotPoly(x, y, ang, [-len2 * 0.5, -w * 0.5, len2 * 0.5, -w * 0.5, len2 * 0.5, w * 0.5, -len2 * 0.5, w * 0.5])).fill(pr.color);
          g.poly(rotPoly(x, y, ang, [-len2 * 0.5, -w * 0.2, len2 * 0.5, -w * 0.2, len2 * 0.5, w * 0.2, -len2 * 0.5, w * 0.2])).fill('#ffffff');
          break;
        }
        case 'twinSMG': {
          g.poly(rotPoly(x, y, ang, [-sz * 0.8, -sz * 0.4, sz * 0.8, -sz * 0.4, sz * 0.8, sz * 0.4, -sz * 0.8, sz * 0.4])).fill('#ffd166');
          break;
        }
        case 'iceLance': {
          g.poly(rotPoly(x, y, ang, [sz * 2.0 * lvlBoost, 0, 0, sz * 0.7 * lvlBoost, -sz * 1.4 * lvlBoost, 0, 0, -sz * 0.7 * lvlBoost]))
            .fill('#e7f9ff').stroke({ width: 1.4, color: '#5fd6ff' });
          break;
        }
        case 'plasmaLance': {
          const r = sz * 1.4 * lvlBoost;
          glow(g, x, y, r, '#4dffd4', 1.4);
          g.circle(x, y, r).fill('#4dffd4');
          g.circle(x, y, r * 0.4).fill('#ffffff');
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * TAU;
            g.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4).lineTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2).stroke({ width: 1, color: '#ffffff' });
          }
          break;
        }
        case 'runeBolts': {
          g.poly(rotPoly(x, y, ang, [sz * 1.4 * lvlBoost, 0, -sz * 0.8 * lvlBoost, sz * 0.6 * lvlBoost, -sz * 0.4 * lvlBoost, 0, -sz * 0.8 * lvlBoost, -sz * 0.6 * lvlBoost])).fill('#b362ff');
          break;
        }
        case 'flameburst': { // FIRE â€” hot core, cooling tail, ember glow
          glow(g, x, y, sz * 1.35 * lvlBoost, '#ff7a1a', 1.3);
          g.circle(x, y, sz * lvlBoost).fill('#ffb84d');
          g.circle(x, y, sz * 0.5 * lvlBoost).fill('#fff2c2');
          const [ftx, fty] = rot(-sz * 1.8, 0, ang);
          g.circle(x + ftx, y + fty, sz * 0.7).fill({ color: '#ff3146', alpha: 0.35 });
          break;
        }
        case 'icespike': { // ICE â€” sharp frost shard, distinct from iceLance's diamond
          glow(g, x, y, sz, '#bff0ff', 0.7);
          g.poly(rotPoly(x, y, ang, [sz * 1.9 * lvlBoost, 0, sz * 0.25, sz * 0.55 * lvlBoost, -sz * 1.3 * lvlBoost, 0, sz * 0.25, -sz * 0.55 * lvlBoost])).fill('#e7f9ff').stroke({ width: 1, color: '#6fd6f0' });
          break;
        }
        case 'arcTesla': case 'chainlightning': { // ELECTRICITY â€” jagged bolt, matches particle 'lightning' style
          const len2 = sz * 2.4 * lvlBoost;
          const [bx0, by0] = rot(-len2 * 0.5, 0, ang);
          g.moveTo(x + bx0, y + by0);
          for (let s = 1; s <= 4; s++) {
            const tt = s / 4;
            const [lx, ly] = rot(-len2 * 0.5 + len2 * tt, (Math.random() - 0.5) * 5, ang);
            g.lineTo(x + lx, y + ly);
          }
          g.stroke({ width: 2.4, color: '#bff0ff' });
          glow(g, x, y, sz * 0.9, '#e8ffff', 1.1);
          g.circle(x, y, sz * 0.55).fill('#e8ffff');
          break;
        }
        default: {
          // Every weapon without a bespoke render case (roughly two thirds
          // of the roster) lands here. Real light glow around the bolt, not
          // just a flat-filled circle â€” this is what actually casts visible
          // light near where it flies, separate from the invisible
          // enemy-tint blend in _drawEnemies.
          //
          // The core used to be one plain circle plus a single static trail
          // dot regardless of speed or direction, so most of the roster's
          // bolts all read as "a coloured marble" with no sense of travel.
          // Stretching the core along its own heading and tapering three
          // trail dots (not one) is what makes a fast bolt look fast and a
          // slow orb look slow, without needing bespoke art per weapon.
          const r0 = sz * lvlBoost;
          const speed = Math.hypot(pr.vx || 0, pr.vy || 0);
          const stretch = Math.min(1.9, 1 + speed / 900);
          glow(g, x, y, r0 * 1.3, pr.color, 0.85);
          const core = rotPoly(x, y, ang, [
            r0 * 1.15 * stretch, 0,
            r0 * 0.15, r0 * 0.82,
            -r0 * 0.85 * stretch, 0,
            r0 * 0.15, -r0 * 0.82,
          ]);
          g.poly(core).fill(pr.color);
          g.circle(x, y, r0 * 0.42).fill({ color: '#ffffff', alpha: 0.75 });
          for (let i = 1; i <= 3; i++) {
            const [dtx, dty] = rot(-r0 * (1.4 + i * 1.1) * stretch, 0, ang);
            g.circle(x + dtx, y + dty, r0 * (0.62 - i * 0.14)).fill({ color: pr.color, alpha: 0.34 - i * 0.09 });
          }
        }
      }
    });
  }

  _drawEnemyProjectiles(game) {
    const g = this.gProjectiles;
    game.eprojs.forEach(ep => {
      g.circle(ep.x, ep.y, ep.size).fill(ep.color);
    });
  }

  _drawBeam(game) {
    const g = this.gBeam; g.clear();
    if (!game.run.ownedWeapons.includes('voidBeam')) return;
    const p = game.player, tgt = p._beamTarget;
    if (!tgt || !tgt.alive) return;
    glow(g, (p.x + tgt.x) / 2, (p.y + tgt.y) / 2, 6, '#b362ff', 1.2);
    g.moveTo(p.x, p.y).lineTo(tgt.x, tgt.y).stroke({ width: 4, color: '#b362ff' });
    g.moveTo(p.x, p.y).lineTo(tgt.x, tgt.y).stroke({ width: 2, color: '#ffffff' });
  }

  // ------------------------------ PARTICLES ---------------------------------
  _drawParticles(game) {
    const g = this.gParticles; g.clear();

    // Rebuild both particle layers from scratch each frame by refilling
    // particleChildren directly and issuing ONE update() per layer â€” the
    // documented batch path; addParticle/removeParticle would trigger a view
    // update per call.
    const sparkArr = this._sparkLayer.pc.particleChildren; sparkArr.length = 0;
    const goreArr  = this._goreLayer.pc.particleChildren;  goreArr.length = 0;
    const sparkPool = this._sparkLayer.pool, gorePool = this._goreLayer.pool;
    const TR = this._partTexR;
    let si = 0, gi = 0;

    game.parts.forEach(p => {
      const a = p.life / p.max;
      if (p.type === 'spark') {
        // Motion-stretched ember: a spark flying at 400px/s reads as a line,
        // not a dot, so the quad is stretched along the velocity vector and
        // collapses back to round as it slows â€” slow embers still look like
        // embers. Additive + bloom is what makes it glow.
        if (si >= sparkPool.length) return;
        const q = sparkPool[si++];
        const spd = Math.hypot(p.vx, p.vy);
        const stretch = spd > 60 ? Math.min(17, spd * 0.026) : 0;
        q.x = p.x; q.y = p.y;
        q.rotation = spd > 1 ? Math.atan2(p.vy, p.vx) : 0;
        q.scaleX = (p.size * 1.2 + stretch) / TR;
        q.scaleY = (p.size * 0.85) / TR;
        q.tint = p.color;
        q.alpha = Math.min(1, a * 1.2);
        sparkArr.push(q);
      } else if (p.type === 'chunk' || p.type === 'blood' || !p.type) {
        // Wet gore â€” droplets and torn-off pieces. Slightly elongated along
        // travel so a fast spray looks flung rather than sprinkled.
        if (gi >= gorePool.length) return;
        const q = gorePool[gi++];
        const spd = Math.hypot(p.vx, p.vy);
        // Three grades of droplet, and they must not just be three sizes.
        // Mist smears into long thin streaks because it is light and fast; a
        // fat drop barely deforms at all because it is heavy and slow. That
        // difference in STRETCH is what sells them as different substances
        // rather than the same dot at different scales.
        let stretch = spd > 90 ? Math.min(6, spd * 0.010) : 0;
        if (p._mist) stretch = Math.min(14, spd * 0.030);
        else if (p._heavy) stretch = Math.min(2, spd * 0.004);
        q.x = p.x; q.y = p.y;
        q.rotation = spd > 1 ? Math.atan2(p.vy, p.vx) : 0;
        q.scaleX = (p.size + stretch) / TR;
        // Heavy drops squash slightly across travel as they wobble; mist thins.
        q.scaleY = (p.size * (p._heavy ? 1.18 : p._mist ? 0.62 : 1)) / TR;
        q.tint = p.color;
        // Mist is thinner and reads as a haze; fat drops are near-opaque.
        q.alpha = Math.min(1, a + (p._mist ? -0.15 : p._heavy ? 0.35 : 0.2));
        goreArr.push(q);
      } else if (p.type === 'bloodCone') {
        // The arterial fan. Built as a polygon whose outer edge is a RAGGED
        // arc, not a clean one — a smooth triangle reads as a cone of light,
        // and the whole point is that this is liquid tearing out of a cut.
        //
        // It grows fast and thins as it goes, so the silhouette is widest
        // early (the moment of the cut) and has broken into strands by the end.
        const t01 = 1 - p.life / p.max;
        const reach = p.size * (0.25 + t01 * 1.05);
        const spread = p._spread * (1 + t01 * 0.35);
        const seed = p._seed || 0;
        const SEG = 11;

        const outer = [];
        const inner = [];
        for (let s2 = 0; s2 <= SEG; s2++) {
          const f = s2 / SEG;
          const a = p._ang - spread + f * spread * 2;
          // Ragged outer edge: two frequencies so no two spikes match, and the
          // ends pulled in so the fan tapers to points rather than to a wall.
          const taper = Math.sin(f * Math.PI);
          const noise = 0.72 + Math.sin(seed + f * 9.1) * 0.16 + Math.sin(seed * 1.7 + f * 21.3) * 0.11;
          const r2 = reach * taper * noise;
          outer.push(p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2);
          const ri = r2 * (0.10 + t01 * 0.42);   // hollows out as it flies
          inner.unshift(p.y + Math.sin(a) * ri);
          inner.unshift(p.x + Math.cos(a) * ri);
        }
        const alpha = (1 - t01) * (1 - t01);     // fades fast at the end
        g.poly(outer.concat(inner)).fill({ color: p.color, alpha: 0.85 * alpha });
        // A darker core along the middle of the sheet gives it thickness.
        const ca2 = Math.cos(p._ang), sa2 = Math.sin(p._ang);
        g.moveTo(p.x, p.y)
          .lineTo(p.x + ca2 * reach * 0.9, p.y + sa2 * reach * 0.9)
          .stroke({ width: Math.max(1.5, reach * 0.09), color: this._darken(p.color, 0.55), alpha: 0.7 * alpha });
        // Wet highlight on the leading edge — the only part still catching
        // light while the rest is already falling.
        g.moveTo(outer[0], outer[1]);
        for (let s2 = 1; s2 <= SEG; s2++) g.lineTo(outer[s2 * 2], outer[s2 * 2 + 1]);
        g.stroke({ width: 1.2, color: 0xff6a78, alpha: 0.45 * alpha });
        if (alpha > 0.1) {
          this._emitLight(p.x + ca2 * reach * 0.5, p.y + sa2 * reach * 0.5, reach * 1.3, '#ff1a2a', 0.28 * alpha);
        }
      } else if (p.type === 'skinFlake') {
        // A torn-off piece of hide, not a dot. Drawn as a small irregular
        // quad that tumbles as it flies and darkens on its trailing face, so a
        // spray of these reads as material coming OFF something rather than as
        // more sparks. The tumble is why it needs a polygon: a rotating circle
        // looks identical to a still one.
        const t01 = 1 - p.life / p.max;
        const rot = (p._rot || 0) + (p._spin || 0) * t01;
        const s2 = p.size * (1 - t01 * 0.25);
        const ca = Math.cos(rot), sa = Math.sin(rot);
        // Foreshorten across the spin axis so it flips edge-on and back.
        const flip = Math.abs(Math.cos(rot * 1.7));
        const w2 = s2 * (0.35 + flip * 0.9);
        const pts = [
          p.x + ca * s2 - sa * w2, p.y + sa * s2 + ca * w2,
          p.x + ca * s2 * 0.6 + sa * w2, p.y + sa * s2 * 0.6 - ca * w2,
          p.x - ca * s2 + sa * w2 * 0.7, p.y - sa * s2 - ca * w2 * 0.7,
          p.x - ca * s2 * 0.7 - sa * w2, p.y - sa * s2 * 0.7 + ca * w2,
        ];
        g.poly(pts).fill({ color: p.color, alpha: (1 - t01) * 0.95 });
        // Wet underside — the face that was against the body.
        g.moveTo(pts[0], pts[1]).lineTo(pts[6], pts[7])
          .stroke({ width: 0.9, color: 0x5a0a12, alpha: (1 - t01) * 0.8 });
      } else if (p.type === 'spikeTrap') {
        // Armed trap on the ground: a ring of teeth that glints while live and
        // snaps shut when it fires. Drawn flat (squashed) so it reads as lying
        // on the floor rather than standing in the air.
        const t01 = 1 - p.life / p.max;
        const live = !p._used;
        const R = p.size * (live ? 1 : 1.25);
        const a = live ? 0.5 + 0.2 * Math.sin(game.time * 4) : 0.9 * (1 - t01 * 4);
        // This branch runs inside a forEach callback, not a loop body, so the
        // skip has to be a guard rather than `continue`.
        if (a > 0) {
        g.ellipse(p.x, p.y, R, R * 0.42).stroke({ width: 1.4, color: 0x9fb4c8, alpha: a * 0.7 });
        for (let k = 0; k < 10; k++) {
          const ang = (k / 10) * TAU;
          const inner = live ? R * 0.55 : R * 0.2;
          g.moveTo(p.x + Math.cos(ang) * R * 0.9, p.y + Math.sin(ang) * R * 0.9 * 0.42)
            .lineTo(p.x + Math.cos(ang) * inner, p.y + Math.sin(ang) * inner * 0.42)
            .stroke({ width: 1.6, color: live ? 0xdfe8ff : 0xff5a5a, alpha: a });
        }
        }
      } else if (p.type === 'katanaSlash') {
        // A blade arc, not a puff. Drawn as a crescent that sweeps through the
        // aim direction, thin at the tips and wide in the middle, with a white
        // leading edge — the edge is what reads as "sharp".
        const t01 = 1 - p.life / p.max;
        // Span comes from the swing STYLE now (engine's KATANA_STYLES) rather
        // than being a fixed 78-degree fan on every strike. Defaults keep the
        // old shape for any caller that has not been updated.
        // `_span` is the FULL sweep in radians, not a half-angle — doubling it
        // here once made the "level cut" 120 degrees, wider than the single
        // fixed arc it was meant to tighten.
        const swSpan = p._span != null ? p._span : 1.36;
        const a0 = p._ang - (swSpan / 2) * p._dir;
        const span = swSpan * p._dir;
        const lead = a0 + span * Math.min(1, t01 * 1.5);   // where the tip is now
        const fade = 1 - t01;
        const R = p.size;
        const SEG = 10;
        // Trailing body of the arc, fading behind the tip.
        for (let s2 = 0; s2 < SEG; s2++) {
          const f0 = s2 / SEG, f1 = (s2 + 1) / SEG;
          const swept = Math.min(1, t01 * 1.5);
          if (f1 > swept) break;
          const aa = a0 + span * f0, ab = a0 + span * f1;
          // Thickness peaks mid-swing so the crescent has a belly.
          const th = Math.sin(f0 * Math.PI) * (p._th != null ? p._th : 0.22) + 0.05;
          g.poly([
            p.x + Math.cos(aa) * R, p.y + Math.sin(aa) * R,
            p.x + Math.cos(ab) * R, p.y + Math.sin(ab) * R,
            p.x + Math.cos(ab) * R * (1 - th), p.y + Math.sin(ab) * R * (1 - th),
            p.x + Math.cos(aa) * R * (1 - th), p.y + Math.sin(aa) * R * (1 - th),
          ]).fill({ color: p.color, alpha: 0.42 * fade * (0.35 + f0 * 0.65) });
        }
        // The edge itself: a hot white line at the leading tip.
        g.moveTo(p.x + Math.cos(lead) * R * 0.35, p.y + Math.sin(lead) * R * 0.35)
          .lineTo(p.x + Math.cos(lead) * R, p.y + Math.sin(lead) * R)
          .stroke({ width: p._lead != null ? p._lead : 2.4, color: 0xffffff, alpha: 0.9 * fade });
        // Dynamic blade light emission
        if (fade > 0.1) {
          this._emitLight(p.x + Math.cos(lead) * R * 0.7, p.y + Math.sin(lead) * R * 0.7, R * 1.5, p.color || '#dff4ff', 0.45 * fade);
        }
      } else if (p.type === 'cutLine') {
        // The instant of the cut: a white line straight through where the body
        // was, blooming and vanishing.
        const t01 = 1 - p.life / p.max;
        const L = p.size * (0.6 + t01 * 0.9);
        const ca = Math.cos(p._ang), sa = Math.sin(p._ang);
        g.moveTo(p.x - ca * L, p.y - sa * L).lineTo(p.x + ca * L, p.y + sa * L)
          .stroke({ width: 5 * (1 - t01), color: 0xffffff, alpha: 0.85 * (1 - t01) });
        g.moveTo(p.x - ca * L, p.y - sa * L).lineTo(p.x + ca * L, p.y + sa * L)
          .stroke({ width: 1.4, color: 0xdff4ff, alpha: 1 - t01 });
        if (t01 < 0.85) {
          this._emitLight(p.x, p.y, L * 1.8, '#ffffff', 0.65 * (1 - t01));
        }
      } else if (p.type === 'bisectHalf') {
        // Half a body, sliding away from the cut and toppling as it goes. Drawn
        // as a half-disc clipped along the cut line, so the flat face reads as
        // the cut and the round side as the body it came from.
        const t01 = 1 - p.life / p.max;
        const R = p.size;
        const spin = t01 * 0.9 * p._side;
        const a = p._ang + spin;
        const ca = Math.cos(a), sa = Math.sin(a);
        // Perpendicular, pointing away from the cut on this half's side.
        const px2 = -sa * p._side, py2 = ca * p._side;
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const th = (k / 8) * Math.PI;
          const ox2 = ca * Math.cos(th) * R + px2 * Math.sin(th) * R;
          const oy2 = sa * Math.cos(th) * R + py2 * Math.sin(th) * R;
          pts.push(p.x + ox2, p.y + oy2);
        }
        g.poly(pts).fill({ color: p.color, alpha: 0.9 * (1 - t01 * 0.7) });

        // The cut face — the INSIDE of the thing you just opened.
        //
        // This was a single 2.6px dark line, which is why nothing read as
        // "cleaved": a line is where two shapes meet, not a surface you are
        // looking into. It is a filled wedge now, drawn back from the cut edge
        // so the half is visibly hollow, with a wet rim on the lip and a
        // darker core behind it. The wedge opens as the piece topples, because
        // a face you are seeing edge-on at the moment of the cut should widen
        // as it rotates toward you.
        const open = 0.16 + t01 * 0.5;         // how far the interior is seen
        const face = [];
        for (let k = 0; k <= 6; k++) {
          const f = k / 6;
          // Along the cut line, from one end to the other.
          const lx = p.x + ca * R * (1 - 2 * f);
          const ly = p.y + sa * R * (1 - 2 * f);
          face.push(lx, ly);
        }
        for (let k = 6; k >= 0; k--) {
          const f = k / 6;
          // Bowed back into the body, deepest in the middle — a cut through a
          // round body exposes an ellipse, not a rectangle.
          const depth = Math.sin(f * Math.PI) * R * open;
          face.push(
            p.x + ca * R * (1 - 2 * f) + px2 * depth,
            p.y + sa * R * (1 - 2 * f) + py2 * depth,
          );
        }
        const fade = 1 - t01 * 0.55;
        g.poly(face).fill({ color: 0x3d0308, alpha: 0.95 * fade });
        // Wet rim on the lip, brighter than the core so the edge catches.
        g.moveTo(p.x - ca * R, p.y - sa * R).lineTo(p.x + ca * R, p.y + sa * R)
          .stroke({ width: 2.2, color: 0xa8121f, alpha: 0.95 * fade });
        // A bead of blood welling at the deepest point of the cut.
        g.circle(
          p.x + px2 * R * open * 0.55,
          p.y + py2 * R * open * 0.55,
          R * 0.16 * (1 - t01 * 0.5),
        ).fill({ color: 0x7e0812, alpha: 0.85 * fade });
      } else if (p.type === 'finBody') {
        // THE CORPSE ACTOR of a finisher. One particle the engine's sequence
        // mutates every frame (engine.js's updateFinisher); this only draws
        // whatever state it is in. `_z` is height above the ground, so the body
        // lifts while its shadow stays where the body actually is.
        const z = p._z || 0;
        const R = p.size;
        const dy = p.y - z;
        const rot = p._rot || 0;
        const topple = p._topple || 0;
        const eaten = p._eaten || 0;
        const seed = p._seed || 0;
        // Shadow shrinks and fades with height — the only cue that says "up".
        const sh = 1 / (1 + z / 85);
        g.ellipse(p.x, p.y + R * 0.34, R * 0.9 * sh, R * 0.3 * sh)
          .fill({ color: 0x000000, alpha: 0.42 * sh });

        // Toppled (the Hydro kick) squashes him flat; being shot away eats the
        // radius AND chews the silhouette, so the outline itself goes ragged
        // rather than the body merely getting smaller.
        const bodyR = R * (1 - eaten * 0.5);
        const sx = 1 + topple * 0.38, sy = 1 - topple * 0.42;
        const N = 22;
        const pts = [];
        for (let k = 0; k < N; k++) {
          const th = (k / N) * Math.PI * 2;
          let rr = bodyR;
          if (eaten > 0) {
            const bite = (Math.sin(th * 3.1 + seed) * 0.5 + 0.5) * (Math.sin(th * 5.7 - seed) * 0.3 + 0.7);
            rr *= 1 - eaten * 0.55 * bite;
          }
          pts.push(p.x + Math.cos(th + rot) * rr * sx, dy + Math.sin(th + rot) * rr * sy);
        }
        g.poly(pts).fill({ color: p.color, alpha: 0.96 });

        // The cut. `_sever` is how far across the body the blade got — 0.6 for
        // the katana's uppercut, i.e. "nearly nothing holding him together".
        // Drawn as an OPEN wedge, not a line: a line is where two shapes meet,
        // a wedge is a surface you are looking into.
        if (p._sever > 0) {
          const ca = Math.cos(p._cutAng + rot), sa = Math.sin(p._cutAng + rot);
          const t0 = -1, t1 = -1 + 2 * p._sever;   // from one edge, `_sever` across
          const gapMax = bodyR * 0.30 * p._sever;
          const face = [];
          for (let k = 0; k <= 9; k++) {
            const f = k / 9;
            const tt = t0 + (t1 - t0) * f;
            const gp = Math.sin(f * Math.PI) * gapMax;
            face.push(p.x + ca * bodyR * tt - sa * gp, dy + sa * bodyR * tt + ca * gp);
          }
          for (let k = 9; k >= 0; k--) {
            const f = k / 9;
            const tt = t0 + (t1 - t0) * f;
            const gp = Math.sin(f * Math.PI) * gapMax;
            face.push(p.x + ca * bodyR * tt + sa * gp, dy + sa * bodyR * tt - ca * gp);
          }
          g.poly(face).fill({ color: 0x3d0308, alpha: 0.95 });
          g.moveTo(p.x + ca * bodyR * t0, dy + sa * bodyR * t0)
            .lineTo(p.x + ca * bodyR * t1, dy + sa * bodyR * t1)
            .stroke({ width: 2.4, color: 0xa8121f, alpha: 0.95 });
        }
      } else if (p.type === 'finPiece') {
        // One of the two pieces after the SECOND cut. Deliberately NOT drawn
        // like `bisectHalf`: this body was already 60% severed before it came
        // apart, so the edge is ragged and the halves are asymmetric — and the
        // OLD wound is still visible on the piece alongside the fresh one.
        const t01 = 1 - p.life / p.max;
        const z = p._z || 0;
        const R = p.size;
        const dy = p.y - z;
        const a = p._ang + (p._rot || 0);
        const ca = Math.cos(a), sa = Math.sin(a);
        const px2 = -sa * p._side, py2 = ca * p._side;
        const seed = p._seed || 0;
        const sh = 1 / (1 + z / 85);
        g.ellipse(p.x, p.y + R * 0.3, R * 0.8 * sh, R * 0.26 * sh)
          .fill({ color: 0x000000, alpha: 0.34 * sh });

        const fade = 1 - t01 * 0.55;
        // The tear wanders in and out along the cut line — one shared function
        // so the silhouette and the interior below agree on where it runs.
        const jagAt = (f) => (Math.sin(f * 9.3 + seed) * 0.5 + Math.sin(f * 21.7 - seed) * 0.22) * R * 0.20;

        // Round side is the body it came from; torn side is jagged.
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const th = (k / 10) * Math.PI;
          pts.push(
            p.x + ca * Math.cos(th) * R + px2 * Math.sin(th) * R,
            dy + sa * Math.cos(th) * R + py2 * Math.sin(th) * R,
          );
        }
        for (let k = 10; k >= 0; k--) {
          const f = k / 10;
          const jag = jagAt(f);
          pts.push(p.x + ca * R * (1 - 2 * f) + px2 * jag, dy + sa * R * (1 - 2 * f) + py2 * jag);
        }
        g.poly(pts).fill({ color: p.color, alpha: 0.92 * fade });

        // The wet interior behind the tear.
        const inner = [];
        for (let k = 0; k <= 8; k++) {
          const f = k / 8;
          const jag = jagAt(f);
          inner.push(p.x + ca * R * (1 - 2 * f) + px2 * jag, dy + sa * R * (1 - 2 * f) + py2 * jag);
        }
        for (let k = 8; k >= 0; k--) {
          const f = k / 8;
          const depth = Math.sin(f * Math.PI) * R * (0.20 + t01 * 0.35);
          inner.push(p.x + ca * R * (1 - 2 * f) + px2 * depth, dy + sa * R * (1 - 2 * f) + py2 * depth);
        }
        g.poly(inner).fill({ color: 0x3d0308, alpha: 0.95 * fade });
        g.moveTo(p.x - ca * R, dy - sa * R).lineTo(p.x + ca * R, dy + sa * R)
          .stroke({ width: 2.2, color: 0xa8121f, alpha: 0.92 * fade });

        // The FIRST cut, still on him. This is the detail that says the second
        // blow did not land in the same place.
        if (p._prevCut !== undefined) {
          const pa = p._prevCut + (p._rot || 0);
          const pca = Math.cos(pa), psa = Math.sin(pa);
          g.moveTo(p.x - pca * R * 0.55, dy - psa * R * 0.55)
            .lineTo(p.x + pca * R * 0.5, dy + psa * R * 0.5)
            .stroke({ width: 3.0, color: 0x7e0812, alpha: 0.8 * fade });
        }
      } else if (p.type === 'bladeDrip') {
        // A bead of blood running off the blade. Stretched along its own fall,
        // so it reads as a droplet rather than a dot.
        const t01 = 1 - p.life / p.max;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const ux = p.vx / sp, uy = p.vy / sp;
        const len = p.size * (1 + Math.min(2.6, sp / 55));
        g.moveTo(p.x - ux * len, p.y - uy * len)
          .lineTo(p.x, p.y)
          .stroke({ width: p.size * 1.5, color: p.color, alpha: 0.9 * (1 - t01 * 0.6), cap: 'round' });
        g.circle(p.x, p.y, p.size * 0.85).fill({ color: p.color, alpha: 0.95 * (1 - t01 * 0.5) });
      } else if (p.type === 'spinArc') {
        // The 180/360 spin attack. A full sweeping ring with a bright leading
        // head, so the eye reads a direction of travel instead of a halo.
        const t01 = 1 - p.life / p.max;
        const R = p.size * (0.55 + t01 * 0.55);
        const head = t01 * Math.PI * 2 * 1.15 * p._dir;
        const span = Math.PI * 1.5;
        const steps = 18;
        for (let k = 0; k < steps; k++) {
          const f = k / steps;
          const th = head - span * f * p._dir;
          const th2 = head - span * ((k + 1) / steps) * p._dir;
          const w = (1 - f) * p.size * 0.12 + 1;
          g.moveTo(p.x + Math.cos(th) * R, p.y + Math.sin(th) * R * 0.62)
            .lineTo(p.x + Math.cos(th2) * R, p.y + Math.sin(th2) * R * 0.62)
            .stroke({ width: w, color: p.color, alpha: (1 - f) * 0.85 * (1 - t01 * 0.5), cap: 'round' });
        }
        g.circle(p.x + Math.cos(head) * R, p.y + Math.sin(head) * R * 0.62, p.size * 0.09)
          .fill({ color: 0xffffff, alpha: 0.9 * (1 - t01) });
      } else if (p.type === 'groundSmear') {
        // Blood driven INTO the floor at an angle, because the shot came from
        // above. Elongated along the shot direction — that angle is the whole
        // reason it reads as "shot down into the ground" and not "sprayed".
        const t01 = 1 - p.life / p.max;
        const a = p._ang || 0;
        const ca = Math.cos(a), sa = Math.sin(a);
        const L = p.size * (p._long || 2.2) * (0.6 + t01 * 0.5);
        const W = p.size * 0.55;
        // Fat at the impact end, drawn out to a tail — a smear, not an oval.
        const wAt = (f) => W * Math.sin(Math.PI * Math.pow(f, 0.65)) * (1 - f * 0.55);
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const f = k / 12, w = wAt(f);
          pts.push(p.x + ca * L * f - sa * w, p.y + sa * L * f * 0.55 + ca * w);
        }
        for (let k = 12; k >= 0; k--) {
          const f = k / 12, w = wAt(f);
          pts.push(p.x + ca * L * f + sa * w, p.y + sa * L * f * 0.55 - ca * w);
        }
        g.poly(pts).fill({ color: p.color, alpha: 0.55 * (1 - t01 * 0.8) });
      } else if (p.type === 'skyBolt') {
        // Lightning from above, in three beats: a telegraph ring warning where
        // it will land, the bolt itself dropping out of frame, then the burn.
        // The old skill drew a chain crawling out of the player, which looked
        // identical to the Arc Tesla weapon and nothing like a strike.
        const age = p.max - p.life;
        const wait = p._delay || 0;
        const R = p.size;
        if (age < wait) {
          // Telegraph: a tightening ring so the player can read where it lands.
          const w = age / Math.max(0.0001, wait);
          g.circle(p.x, p.y, R * (1.7 - w * 0.7))
            .stroke({ width: 1.6, color: 0x9fd8ff, alpha: 0.30 + w * 0.35 });
        } else {
          const t01 = Math.min(1, (age - wait) / (p.max - wait));
          const seed = p._seed || 0;
          // --- the bolt: a jagged column from off the top of the screen ---
          if (t01 < 0.45) {
            const boltA = 1 - t01 / 0.45;
            const TOP = p.y - 620;
            const segs = 11;
            for (const pass of [
              { w: 9, col: 0x2b6bd6, a: 0.22 },   // outer glow
              { w: 4.2, col: 0x9fd8ff, a: 0.55 }, // body
              { w: 1.6, col: 0xffffff, a: 0.95 }, // hot core
            ]) {
              let px2 = p.x + Math.sin(seed) * 26, py2 = TOP;
              for (let s2 = 1; s2 <= segs; s2++) {
                const f = s2 / segs;
                // Deviation narrows toward the ground so the bolt converges on
                // its impact point instead of wandering off it.
                const dev = (1 - f) * 34;
                const nx2 = p.x + Math.sin(seed + s2 * 2.7) * dev;
                const ny2 = TOP + (p.y - TOP) * f;
                g.moveTo(px2, py2).lineTo(nx2, ny2)
                  .stroke({ width: pass.w, color: pass.col, alpha: pass.a * boltA });
                px2 = nx2; py2 = ny2;
              }
            }
            // Forks that branch off and die partway down.
            for (let fk = 0; fk < 3; fk++) {
              const f0 = 0.35 + fk * 0.18;
              const sx2 = p.x + Math.sin(seed + f0 * 9) * (1 - f0) * 34;
              const sy2 = TOP + (p.y - TOP) * f0;
              const dir = Math.sin(seed + fk * 5.1) > 0 ? 1 : -1;
              g.moveTo(sx2, sy2)
                .lineTo(sx2 + dir * 40, sy2 + 46)
                .lineTo(sx2 + dir * 26, sy2 + 96)
                .stroke({ width: 1.6, color: 0xbfe8ff, alpha: 0.5 * boltA });
            }
          }
          // --- ground burst: expanding scorched ring + flash ---
          const bt = Math.min(1, t01 / 0.6);
          const br = R * (0.25 + bt * 1.15);
          g.ellipse(p.x, p.y, br, br * 0.42)
            .stroke({ width: 3 * (1 - bt), color: 0xdff4ff, alpha: 0.85 * (1 - bt) });
          g.ellipse(p.x, p.y, br * 0.6, br * 0.26)
            .fill({ color: 0x9fd8ff, alpha: 0.30 * (1 - bt) });
          // Afterglow: the impact point stays lit as it cools.
          g.circle(p.x, p.y, R * 0.5 * (1 - t01))
            .fill({ color: 0xffffff, alpha: 0.5 * (1 - t01) });
        }
      } else if (p.type === 'meteorMark') {
        const t01 = 1 - (p.life / p.max);
        const shR = 10 + t01 * (p._radius * 0.35);
        g.ellipse(p.x, p.y, shR, shR * 0.32).fill({ color: '#000000', alpha: 0.45 });
        const fy = (p._fallFrom || -300) * (1 - t01);
        const fx = (p._fallOffX || 0) * (1 - t01);
        for (let k = 0; k < 6; k++) {
          const f = k / 6;
          const tx = p.x + fx * (1 - f * 0.6), ty = p.y + (fy - f * 60);
          const col = k < 3 ? '#fff5d6' : (k < 5 ? '#ff9a3c' : '#b51d28');
          g.circle(tx, ty, (16 - k * 2) * (0.6 + t01 * 0.4)).fill({ color: col, alpha: (1 - f) * 0.7 });
        }
        const mx = p.x + fx, my = p.y + fy, headR = 12 + t01 * 6;
        glow(g, mx, my, headR, p.color, 1.6);
        g.circle(mx, my, headR).fill('#ffb84d');
        g.circle(mx - headR * 0.25, my - headR * 0.25, headR * 0.4).fill('#fff5d6');
        g.circle(mx + 2, my - 1, 2.4).fill('#221008');
        g.circle(mx - 3, my + 2, 1.8).fill('#221008');
      } else if (p.type === 'bossSlamWarn') {
        // Tidebreaker telegraph â€” a red danger ring that fills in as the
        // window to dodge runs out, so the threat reads at a glance.
        const t01 = 1 - (p.life / p.max);
        g.circle(p.x, p.y, p._radius).stroke({ width: 4, color: '#1fb6ff', alpha: 0.35 + t01 * 0.5 });
        g.circle(p.x, p.y, p._radius * t01).fill({ color: '#1fb6ff', alpha: 0.12 + t01 * 0.22 });
      } else if (p.type === 'poison') {
        g.circle(p.x, p.y, p.size).fill({ color: '#7ad96b', alpha: 0.30 * a }).stroke({ width: 2, color: '#5ab93b', alpha: 0.6 * a });
      } else if (p.type === 'lightning') {
        // Real electric-arc look: bright white-hot core + a wider colored
        // halo stroke, redrawn with fresh jitter so it visibly crackles.
        const sxv = (p.vx - p.x), syv = (p.vy - p.y);
        const segs = 5;
        g.moveTo(p.x, p.y);
        const pts = [[p.x, p.y]];
        for (let s = 1; s <= segs; s++) {
          const t = s / segs;
          const jitter = s < segs ? (Math.random() - 0.5) * 22 : 0;
          const px = p.x + sxv * t + jitter, py = p.y + syv * t + jitter;
          g.lineTo(px, py); pts.push([px, py]);
        }
        g.stroke({ width: 5 + Math.random() * 2, color: p.color, alpha: a * 0.55 });
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.stroke({ width: 1.6, color: '#ffffff', alpha: Math.min(1, a + 0.3) });
      } else if (p.type === 'casing') {
        // Ejected shell casing: tumbling brass rect, cooling from hot orange
        // to dull brass as it fades.
        const rot2 = p._rot || 0;
        const len2 = p.size * 2.4, wid2 = p.size * 0.9;
        const cs2 = Math.cos(rot2), sn2 = Math.sin(rot2);
        const hx = (len2 / 2) * cs2, hy = (len2 / 2) * sn2, wx = (wid2 / 2) * -sn2, wy = (wid2 / 2) * cs2;
        // Brass leaves the chamber glowing and cools through orange to dull
        // metal before it fades, instead of flipping between two colours.
        // An ejected magazine carries its own colour and skips the heat.
        const cooled = 1 - a;                       // 0 fresh -> 1 spent
        const col = p.color && p.color !== '' && p.size > 3
          ? p.color
          : cooled < 0.18 ? '#fff2c8'
          : cooled < 0.34 ? '#ffcf6b'
          : cooled < 0.55 ? '#d08a3a'
          : '#8a5a2a';
        g.poly([p.x - hx - wx, p.y - hy - wy, p.x + hx - wx, p.y + hy - wy, p.x + hx + wx, p.y + hy + wy, p.x - hx + wx, p.y - hy + wy])
          .fill({ color: col, alpha: Math.min(1, a * 2.2 + 0.2) });
        // brief hot bloom while it is still glowing
        if (cooled < 0.3 && p.size <= 3) {
          g.circle(p.x, p.y, p.size * 1.5).fill({ color: '#ffb347', alpha: (0.3 - cooled) * 0.9 });
        }
      } else if (p.type === 'whip') {
        // A lash, not a sweep: the cord snaps out along the aim vector with a
        // curl to one side, straightens at full extension, then recoils. Drawn
        // as a tapering chain of segments so it thins toward the tip the way
        // a real whip does.
        const t01 = 1 - a;
        // out fast, hold, snap back — peaks around 70% of the lifetime
        const ext = t01 < 0.55 ? Math.sin((t01 / 0.55) * Math.PI * 0.5) : 1 - ((t01 - 0.55) / 0.45) * 0.55;
        const len = p.size * ext;
        const ca = Math.cos(p._ang), sa = Math.sin(p._ang);
        const curl = (p._curl || 1) * (1 - ext) * 0.9;
        const SEG = 9;
        let px2 = p.x, py2 = p.y;
        for (let k = 1; k <= SEG; k++) {
          const f = k / SEG;
          const bow = Math.sin(f * Math.PI) * len * 0.22 * curl;
          const nx2 = p.x + ca * len * f - sa * bow;
          const ny2 = p.y + sa * len * f + ca * bow;
          const w = (1 - f) * 5.5 + 1.1;
          g.moveTo(px2, py2).lineTo(nx2, ny2)
            .stroke({ width: w + 2, color: '#062634', alpha: a * 0.55, cap: 'round' });
          g.moveTo(px2, py2).lineTo(nx2, ny2)
            .stroke({ width: w, color: p.color, alpha: Math.min(1, a * 1.5), cap: 'round' });
          px2 = nx2; py2 = ny2;
        }
        // cracking tip
        g.circle(px2, py2, 3.4 * a + 1).fill({ color: '#ffffff', alpha: Math.min(1, a * 1.6) });
        g.circle(px2, py2, 7 * a).fill({ color: p.color, alpha: a * 0.4 });
      } else if (p.type === 'wave') {
        // Expanding body of water: crest thins and fades as it grows, an
        // inner surge trails behind it, and foam speckles ride the leading
        // edge. Bright cyan on an additive-friendly bloom threshold, so the
        // crest genuinely glows rather than being a hairline circle.
        const t01 = 1 - a;                       // 0 at spawn -> 1 at death
        const ease = 1 - Math.pow(1 - t01, 2);   // fast out, settling
        const R = p._radius * ease;
        const fade = Math.pow(a, 0.7);
        g.circle(p.x, p.y, R).stroke({ width: 16 * fade + 2, color: '#1fb6ff', alpha: 0.30 * fade });
        g.circle(p.x, p.y, R).stroke({ width: 7 * fade + 1.5, color: '#6fdcff', alpha: 0.55 * fade });
        g.circle(p.x, p.y, R * 0.995).stroke({ width: 2.5, color: '#e8fbff', alpha: 0.85 * fade });
        // inner surge
        g.circle(p.x, p.y, R * 0.72).stroke({ width: 5 * fade, color: '#1fb6ff', alpha: 0.22 * fade });
        g.circle(p.x, p.y, R * 0.86).fill({ color: '#1fb6ff', alpha: 0.05 * fade });
        // foam along the crest
        const foam = 14;
        for (let k = 0; k < foam; k++) {
          const fa = (k / foam) * TAU + p.max * 7.3 + t01 * 1.1;
          const fr = R + Math.sin(k * 2.7 + t01 * 9) * 5;
          g.circle(p.x + Math.cos(fa) * fr, p.y + Math.sin(fa) * fr, (2.6 - t01 * 1.4) * fade)
            .fill({ color: '#ffffff', alpha: 0.5 * fade });
        }
      } else if (p.type === 'ring') {
        const r = p.size * (1 - a);
        g.circle(p.x, p.y, r).stroke({ width: 4, color: p.color, alpha: a });
      } else if (p.type === 'arc') {
        const sweepFrac = Math.min(1, (1 - a) * 2.5 + 0.15);
        const rad = p.size * (0.82 + (1 - a) * 0.22);
        const a0 = (p._ang || 0) - Math.PI * 0.5, a1 = a0 + Math.PI * sweepFrac;
        g.moveTo(p.x + Math.cos(a0) * rad, p.y + Math.sin(a0) * rad)
          .arc(p.x, p.y, rad, a0, a1)
          .stroke({ width: 7 - (1 - a) * 3, color: p.color, alpha: a });
        if (sweepFrac < 0.98) {
          const tipAng = a1;
          g.moveTo(p.x + Math.cos(tipAng - 0.18) * rad, p.y + Math.sin(tipAng - 0.18) * rad)
            .arc(p.x, p.y, rad, tipAng - 0.18, tipAng + 0.04).stroke({ width: 10 * a, color: '#ffffff', alpha: a * 0.7 });
        }
      } else if (p.type === 'ash') {
        // Level-up "water-to-ash": droplets cool from icy blue into grey
        // ash flecks as they drift up and burn out.
        const t01 = 1 - a;
        const col = t01 < 0.45 ? '#9fd8ff' : (t01 < 0.75 ? '#c9c9c9' : '#7a7a7a');
        g.rect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size).fill({ color: col, alpha: a * 0.85 });
      } else {
        g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: Math.min(1, a + 0.2) });
      }
    });

    this._sparkLayer.pc.update();
    this._goreLayer.pc.update();
  }

  // ---------------------------- DAMAGE NUMBERS ------------------------------
  _drawDamageNumbers(game) {
    let idx = 0;
    game.dmgNums.forEach(d => {
      let txt = this._dmgTextPool[idx];
      if (!txt) {
        txt = new Text({ text: '', style: this._textStyle(14, '#ffffff', '#000000', 4) });
        txt.anchor.set(0.5);
        this.dmgTextContainer.addChild(txt);
        this._dmgTextPool[idx] = txt;
      }
      // Quick "pop" bounce on spawn (life starts at 0.8s and counts down) â€”
      // overshoots slightly then settles within ~0.12s, nicer than a static number.
      const age = 0.8 - d.life;
      const pop = 1 + Math.max(0, 0.55 - age * 4.5);
      txt.visible = true;
      txt.text = d.text;
      txt.style.fill = d.color;
      // The pool reuses one Text for a "247" and for "TRIPLE KILL", so the face
      // has to be chosen HERE, per message, not once at creation. Anything with
      // a digit stays monospace so the number is unmistakable; a pure callout
      // gets the display face and a little extra size to shout with.
      const numeric = /[0-9]/.test(String(d.text));
      txt.style.fontFamily = numeric
        ? 'JetBrains Mono, monospace'
        : '"Dragon Knight", "Brandal Legend", Cinzel, serif';
      txt.style.letterSpacing = numeric ? 0 : 1.5;
      txt.style.fontSize = numeric ? d.size : Math.round(d.size * 1.18);
      txt.scale.set(pop);
      txt.alpha = Math.min(1, d.life * 2);
      txt.position.set(d.x, d.y);
      idx++;
    });
    for (let i = idx; i < this._dmgTextPool.length; i++) this._dmgTextPool[i].visible = false;
  }

  // --------------------------- LEVEL-UP TEXT --------------------------------
  _drawLevelUpText(game) {
    const timer = game._levelUpTextTimer || 0;
    if (timer <= 0 || !game._levelUpTextPos) { this.levelUpText.visible = false; return; }
    const total = 1.4;
    const t01 = 1 - timer / total; // 0 -> 1 over the animation
    const pos = game._levelUpTextPos;
    this.levelUpText.visible = true;
    this.levelUpText.position.set(pos.x, pos.y - t01 * 46);
    this.levelUpText.alpha = timer > 0.3 ? 1 : (timer / 0.3);
    // Water blue -> ash grey color drift
    const c1 = [0x9f, 0xd8, 0xff], c2 = [0x8a, 0x84, 0x7a];
    const mix = (a, b, f) => Math.round(a + (b - a) * f);
    this.levelUpText.style.fill = `rgb(${mix(c1[0], c2[0], t01)},${mix(c1[1], c2[1], t01)},${mix(c1[2], c2[2], t01)})`;
    this.levelUpText.scale.set(1 + Math.sin(Math.min(1, t01) * Math.PI) * 0.18);
    this.levelUpText.rotation = t01 > 0.55 ? (Math.random() - 0.5) * (t01 - 0.55) * 0.14 : 0;
  }

  // ------------------------------ BOSS ARROW --------------------------------
  _drawBossArrow(game, W, H) {
    const g = this.gBossArrow; g.clear();
    this.metersText.visible = false;
    this.bossArrowText.visible = false;

    if (game._bossArrowOffscreenNow && game._bossArrowLast) {
      const { ax, ay, ang, meters } = game._bossArrowLast;
      const pulse = 0.6 + 0.4 * Math.sin(game.time * 8);
      glow(g, ax, ay, 16 * pulse, '#ffd166', 1.8);
      g.poly(rotPoly(ax, ay, ang, [20, 0, -10, 14, -4, 0, -10, -14])).fill('#ffd166');
      this.bossArrowText.visible = true;
      this.bossArrowText.position.set(ax + Math.cos(ang) * -2, ay + Math.sin(ang) * -2);
      this.metersText.visible = true;
      const [mtx, mty] = rot(6, 30, ang);
      this.metersText.text = meters + 'm \u2192';
      this.metersText.position.set(ax + mtx, ay + mty);
    }

    if (game._bossArrowDissolve) {
      const dis = game._bossArrowDissolve;
      const px = 3;
      for (let i = 0; i < BOSS_ARROW_PIXELS.length; i++) {
        const pt = BOSS_ARROW_PIXELS[i];
        const localT = dis.t - pt.delay;
        const [wx, wy] = rot(pt.lx, pt.ly, dis.ang);
        if (localT <= 0) {
          g.rect(dis.ax + wx - px / 2, dis.ay + wy - px / 2, px, px).fill('#ffd166');
          continue;
        }
        const fallDur = 0.4;
        const ft = localT / fallDur;
        if (ft >= 1) continue;
        const fallDist = 6 + ft * 16;
        const ash = Math.floor(120 + ft * 60);
        const col = `rgb(${Math.floor(255 - ft * 175)},${Math.floor(209 - ft * 129)},${ash})`;
        g.rect(dis.ax + wx - px / 2, dis.ay + wy + fallDist - px / 2, px, px).fill({ color: col, alpha: 1 - ft });
      }
    }
  }

  // --------------------------- SCREEN OVERLAYS ------------------------------
  _ensureVignette(W, H) {
    if (this._vigW === W && this._vigH === H && this._vignetteGrad) return this._vignetteGrad;
    if (this._vignetteGrad) { try { this._vignetteGrad.destroy(); } catch (e) { /* noop */ } }
    this._vigW = W; this._vigH = H;
    const cx = W / 2, cy = H / 2;
    const outerR = Math.hypot(cx, cy) * 1.05;
    const innerR = outerR * 0.58;
    this._vignetteGrad = new FillGradient({
      type: 'radial',
      center: { x: cx, y: cy }, innerRadius: innerR,
      outerCenter: { x: cx, y: cy }, outerRadius: outerR,
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 0.75, color: 'rgba(0,0,0,0.05)' },
        { offset: 1, color: 'rgba(0,0,0,0.26)' },
      ],
      textureSpace: 'global',
    });
    return this._vignetteGrad;
  }

  _drawScreenOverlays(game, W, H) {
    const g = this.gUI; g.clear();
    // Single centered radial vignette â€” kept deliberately light now (was
    // darkening the whole screen and making it hard to see, per feedback).
    // Only the far outer corners darken slightly; the entire play area
    // where combat happens stays fully clear.
    g.rect(0, 0, W, H).fill(this._ensureVignette(W, H));

    // Thunder flash â€” Chain Lightning / Arc Tesla bounces briefly light up
    // the whole screen like real lightning.
    if (game._lightningFlash > 0) {
      const a = Math.min(1, game._lightningFlash * 3.2);
      g.rect(0, 0, W, H).fill({ color: '#e8faff', alpha: a * 0.20 });
    }

    if (game.player.hit > 0) g.rect(0, 0, W, H).fill({ color: '#b51d28', alpha: game.player.hit * 0.35 });
    if (game.cam.slowmo > 0) g.rect(0, 0, W, H).fill({ color: '#4dc4ff', alpha: Math.min(0.2, game.cam.slowmo * 0.4) });

    if (game._bossDeathFlash > 0) {
      const a = Math.min(1, game._bossDeathFlash);
      g.rect(0, 0, W, H).fill({ color: '#ffdc64', alpha: a * 0.55 });
      const ringR = (1.4 - game._bossDeathFlash) * Math.max(W, H) * 0.85;
      g.circle(W / 2, H / 2, ringR).stroke({ width: 8 * a, color: '#ffc832', alpha: a * 0.7 });
    }
    if (game._levelUpFlash > 0) {
      const a = Math.min(1, game._levelUpFlash) * 0.5;
      glow(g, W / 2, H / 2, Math.max(W, H) * 0.3, '#4dffd4', a * 3);
    }
    if (game._critPunch > 0) {
      const a = Math.min(1, game._critPunch);
      g.circle(W / 2, H / 2, Math.max(W, H) * 0.5).stroke({ width: 40, color: '#ff3146', alpha: a * 0.2 });
      if (a > 0.6) g.circle(W / 2, H / 2, 12 * a).fill({ color: '#ffffff', alpha: (a - 0.6) * 0.25 });
    }
  }
}

function scalePts(pts, sx, sy) {
  const out = [];
  for (let i = 0; i < pts.length; i += 2) out.push(pts[i] * sx, pts[i + 1] * sy);
  return out;
}
