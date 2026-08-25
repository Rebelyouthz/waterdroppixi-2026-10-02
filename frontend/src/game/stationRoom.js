// Waterdrop Survivor — THE WALKABLE STATION, room 1: THE MAIN HALL.
//
// Timmy, 2026-08-23: "ja vill vi gor space stationen campet a ja vill de ar
// walkable varje sak man bygger vi bygger de op riktigt a gar runt i de a gor
// de riktigt mycket roligare" — and then, explicitly, "gor detta valdigt
// genomtankt analysera allt tank ut ordning ... nar du ar redo kor du bara".
//
// The order was written down first (waterdrop-walkable-station memory). This
// file is steps 1-3 of it: a room you can walk around, doors that open the
// systems that already exist, and a way out that can never trap you.
//
// ── THE THREE ARCHITECTURE QUESTIONS, ANSWERED ───────────────────────
// The plan listed three things to settle before writing a line. Settled:
//
//   1. TOP-DOWN, not side-on. The game is top-down and the hero rig
//      (heroShape/heroDraw) is drawn for it. A side-on station would need a
//      whole second art vocabulary AND a second character drawing, and
//      wiring.test.mjs exists specifically to stop a sixth hero copy.
//   2. PIXI room + REACT panels over it. Same split GameScreen already uses.
//      The room is its own Application on a FIXED authored stage, the way
//      introCinema.js is — see the note below on why that matters here.
//   3. WALKING IS NEVER THE TAX. Every door also exists in the module list,
//      the exit is always two steps away, and leaving drops you straight back
//      on the console. You walk because it is nicer, never because you must.
//
// ── WHY A FIXED 960x540 STAGE ────────────────────────────────────────
// Copied deliberately from introCinema.js. The GAME shows more world on a
// bigger screen; a ROOM must not, or the far wall walks away from you on a
// monitor and the whole composition changes per device. Everything below is in
// stage units, the resize handler does the fitting, and no draw site ever has
// to know the real viewport. That is the entire class of bug recorded in
// waterdrop-desktop-mobile-parity, avoided by construction.
//
// ── LIGHT ────────────────────────────────────────────────────────────
// Every light in here is a pooled additive sprite off ONE baked radial
// texture, per the project's lighting mandate. No GlowFilter, no per-sprite
// blur standing in for a lamp. The bloom + colour grade at the end are
// whole-picture grading, which is the approved lever for mood — the same
// distinction introCinema.js documents.
import { Application, Container, Graphics, Sprite, FillGradient, ColorMatrixFilter, Rectangle } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { Audio } from './audio';
// THE approved lighting technique, shared with the run's renderer rather than
// re-implemented: baked sphere/flat normal maps, the one per-pixel Lambertian +
// Blinn-Phong GLSL filter, and the baked soft-radial texture every point light
// is a sprite of. See litShading.js and the waterdrop-lighting skill.
import {
  buildNormalLitTextures, makeLitFilter, updateLitUniforms,
  bakeLightTexture, makeLightPool, hexToRgb01,
} from './litShading';
// The SAME character the run draws, not a lookalike.
import { heroHalfPoints } from './heroShape';
import { drawHeroFace, drawLegs, drawHeadband } from './heroDraw';
import { HeroGait } from './heroGait';
import { EXPRESSIONS } from './heroAnim';
import { BUILDINGS, buildingLevel, isStationRepaired } from './base';
// The floor plan lives in its own pixi-free module so the headless suite can
// reach it — see stationLayout.js's header. A room whose geometry is only
// checkable by eye is a room whose geometry never gets checked.
import {
  STAGE_W, STAGE_H, FLOOR, FLOOR_W, FLOOR_H, BACK_FACE, WALL_T,
  HERO_R, WALK_SPEED, REACH, WINDOW, EMBLEM, STATIONS, anchorOf, plateOf,
} from './stationLayout';

const TAU = Math.PI * 2;

// ── Helpers ──────────────────────────────────────────────────────────
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Nudge every channel of a packed colour by a deterministic amount. Used for
 *  per-plate floor grain — computed, not random, so it never crawls. */
const shiftTone = (base, k) => {
  const d = Math.round((k - 0.5) * 14);
  const c = (v) => clamp(v + d, 0, 255);
  return (c((base >> 16) & 255) << 16) | (c((base >> 8) & 255) << 8) | c(base & 255);
};
const lerp = (a, b, t) => a + (b - a) * t;
/** Deterministic pseudo-random — the same generator introCinema and cardScenes
 *  use. Stable across rebuilds, so the floor plating never shimmers. */
const noise = (i) => ((i * 2654435761) >>> 0) / 4294967295;
/** Frame-rate independent damping. */
const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));

const ACCENT = (st) => (st.module && BUILDINGS[st.module] && BUILDINGS[st.module].accent) || '#7cd6ff';
const hex = (s) => parseInt(String(s).replace('#', ''), 16);

/**
 * THE MAIN HALL.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {object} opts.save                     the live save
 * @param {(st:object)=>void} [opts.onEnter]     a station was activated
 * @param {(st:object|null)=>void} [opts.onNear] the armed station changed
 * @param {()=>void} [opts.onRepair]             the player repaired the station
 */
export class StationRoom {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.save = opts.save || {};
    this.onEnter = opts.onEnter || (() => {});
    this.onNear = opts.onNear || (() => {});
    this.onRepair = opts.onRepair || (() => {});

    this.app = null;
    this.destroyed = false;
    this.t = 0;

    // Hero state. A small local model rather than HeroAnim: HeroAnim.update()
    // wants a live `game` with a player, a run and a weapon, and faking all of
    // that to get a walk cycle would be a lie that drifts. These are the seven
    // fields drawHeroFace actually reads plus a two-spring water body — the
    // same approach introCinema.js takes, for the same reason.
    this.px = (FLOOR.x0 + FLOOR.x1) / 2;
    // Spawns in front of the emblem, not on it — at y1-70 he stood exactly on
    // its lower rim and the two silhouettes fought each other.
    this.py = FLOOR.y1 - 42;
    this.vx = 0; this.vy = 0;
    this.wobX = 0; this.wobY = 0; this.wobVX = 0; this.wobVY = 0;
    this.faceX = 0; this.faceY = 1;
    this.blink = 0; this._blinkT = 2.2;
    // The weighted walk. Distance-driven, feet that plant and stay planted —
    // see heroGait.js for why that one property is the whole thing.
    this.gait = new HeroGait().setRadius(HERO_R);
    this._lastStep = 0;

    this.keys = new Set();
    this.moveTarget = null;        // click/tap-to-walk destination
    this.nearest = null;
    this._nearestId = null;

    this._repaired = isStationRepaired(this.save);
    this._builtKey = '';           // invalidates the static layer when it moves
  }

  // ── Boot ───────────────────────────────────────────────────────────
  async init() {
    const app = new Application();
    this.app = app;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    await app.init({
      canvas: this.canvas,
      width: this.canvas.clientWidth || STAGE_W,
      height: this.canvas.clientHeight || STAGE_H,
      resolution: this.dpr,
      autoDensity: true,
      backgroundColor: 0x04080b,
      antialias: true,
      preference: 'webgl',
    });
    if (this.destroyed) { app.destroy(true); return; }

    this.root = new Container();
    app.stage.addChild(this.root);

    this._bakeLightTexture();

    // Layer order is the whole readability of the room. Static first so it can
    // be painted once; lights above the floor but under the hero so he stands
    // IN the light rather than being washed by it; dust on top of everything
    // because it is between you and the room.
    this.gStatic = new Graphics();          this.root.addChild(this.gStatic);
    this.gCable = new Graphics();           this.root.addChild(this.gCable);
    this.lightLayer = new Container();      this.root.addChild(this.lightLayer);
    this.gLive = new Graphics();            this.root.addChild(this.gLive);
    this.gShadow = new Graphics();          this.root.addChild(this.gShadow);
    // The body is THREE layers, and the middle one is the point: a silhouette
    // fill, the per-pixel normal-mapped lit volume on top of it, then the rim
    // and the face over that. The old hand-rolled "inner lighter polygon" is
    // exactly the flat stand-in for light the lighting rule forbids.
    this.gLegBack = new Graphics();         this.root.addChild(this.gLegBack);
    this.gBodyFill = new Graphics();        this.root.addChild(this.gBodyFill);
    this.heroLit = null;                    // built in _buildLitSystem
    this.gBodyRim = new Graphics();
    this.gLegFront = new Graphics();
    this.gFace = new Graphics();
    this.dustLayer = new Container();
    this.gVignette = new Graphics();

    this._buildLitSystem();
    this.root.addChild(this.gBodyRim);
    this.root.addChild(this.gLegFront);
    this.root.addChild(this.gFace);
    this.root.addChild(this.dustLayer);
    this.root.addChild(this.gVignette);

    this._buildDust();
    this._paintVignette();
    this._paintStatic();
    this._buildGrade();

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();

    app.ticker.add((tk) => this._tick(tk));

    // The scrub handle, built BEFORE the art rather than after — the one
    // lesson waterdrop-pixi-pitfalls says has already cost most of a session.
    // __station.warp('hangar') puts the hero in front of a door instantly;
    // __station.freeze() holds the frame so it can be screenshotted.
    if (typeof window !== 'undefined') window.__station = this;
    return this;
  }

  /** The baked soft-radial texture every point light is a sprite of. Shared
   *  implementation with the run's renderer — see litShading.js. */
  _bakeLightTexture() {
    const baked = bakeLightTexture(this.app, 64);
    this.lightTex = baked.tex;
    this._lightTexR = baked.radius;
  }

  /** The normal-mapped side of the technique: the baked normal maps, and the
   *  one lit sprite that carries the hero's body volume. */
  _buildLitSystem() {
    // Pooled additive point lights. The cap is a deliberate ceiling — past it
    // an emitter silently no-ops rather than growing the pool, the same
    // `_emitLight` contract the run's renderer follows.
    this.lights = makeLightPool(this.lightLayer, this.lightTex, 22);
    this._lightN = 0;
    this._frameLights = [];

    const tex = buildNormalLitTextures(this.app);
    this.normalTex = tex.normalTex;
    this.flatNormalTex = tex.flatNormalTex;
    this.litDiffuseTex = tex.litDiffuseTex;

    // The hero's body volume. A white circle tinted to the body colour, shaded
    // per pixel against the strongest light in the room by the same GLSL
    // filter the run uses — real Lambertian diffuse plus a Blinn-Phong
    // specular, not a lighter polygon drawn inside a darker one.
    this.heroLit = new Sprite(this.litDiffuseTex);
    this.heroLit.anchor.set(0.5);
    this.heroLitFilter = makeLitFilter(this.normalTex);
    this.heroLit.filters = [this.heroLitFilter];
    this.heroLit.tint = 0x5fd6ff;
    this.root.addChild(this.heroLit);
  }

  /** Place one pooled light. Radius in stage units.
   *  `lit` = false for a light that must not shine on the hero (his own). */
  _light(x, y, r, color, alpha, lit = true) {
    if (this._lightN >= this.lights.length) return;
    const s = this.lights[this._lightN++];
    s.visible = true;
    s.x = x; s.y = y;
    s.tint = color;
    s.alpha = alpha;
    s.scale.set(r / this._lightTexR);
    if (lit) this._frameLights.push({ x, y, r, tint: color, a: alpha });
  }

  /** ONE merged light for the hero to be shaded against — the strongest thing
   *  near him this frame, exactly the `_computeTestLight` contract the run
   *  uses. An object samples one merged light, never N lights in a shader
   *  loop; that is the deferred pipeline this project deliberately did not
   *  build. */
  _computeRoomLight() {
    // The room is lit, not a cave. Ambient sits low enough that walking into a
    // door's pool of colour visibly changes him, and high enough that he is
    // never a silhouette.
    const ambient = this._repaired ? 0.46 : 0.30;
    let best = null, bestStr = 0;
    for (const L of this._frameLights) {
      const d = Math.hypot(L.x - this.px, L.y - this.py);
      const str = Math.max(0, 1 - d / L.r) * L.a;
      if (str > bestStr) { bestStr = str; best = L; }
    }
    // THE KEY LIGHT, and it is not a fallback for "no lights at all".
    //
    // The first version only used it when `_frameLights` was empty — which is
    // never, because the ceiling lamps are always in the list. So a weak lamp
    // three hundred units away would win, its attenuation would come out at
    // almost zero, and the shader would render him at bare ambient: a
    // near-black drop standing in a lit room. Looked like the shader was
    // broken. It was the light SELECTION that was broken.
    //
    // A room light now has to be genuinely strong where he is standing before
    // it takes over. Below that, he is lit from up and to the left — the
    // direction the window, the lamps and the plating's seam highlights all
    // already agree on.
    const KEY = { x: this.px - 90, y: this.py - 130, rgb: [0.66, 0.80, 0.92], radius: 300, ambient, mt: 0 };
    if (!best || bestStr < 0.16) return KEY;
    return {
      x: best.x, y: best.y,
      rgb: hexToRgb01(best.tint),
      // Never smaller than the distance he can be from it, or a light he is
      // standing right next to still attenuates to nothing.
      radius: Math.max(170, best.r),
      ambient,
      mt: clamp(bestStr * 2.4, 0, 1),
    };
  }

  _buildDust() {
    this.dust = [];
    for (let i = 0; i < 26; i++) {
      const s = new Sprite(this.lightTex);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = 0xbfe6ff;
      this.dustLayer.addChild(s);
      this.dust.push({
        s,
        x: FLOOR.x0 + noise(i * 7 + 1) * FLOOR_W,
        y: FLOOR.y0 - 30 + noise(i * 13 + 5) * (FLOOR_H + 60),
        r: 1.6 + noise(i * 3 + 2) * 3.4,
        vx: (noise(i * 11 + 9) - 0.5) * 7,
        vy: -3 - noise(i * 5 + 4) * 7,
        ph: noise(i * 17) * TAU,
      });
    }
  }

  _paintVignette() {
    // Whole-picture, not a light — it darkens the edges of the SHOT so the
    // middle of the room reads as the place you are.
    const g = this.gVignette;
    g.clear();
    g.rect(0, 0, STAGE_W, STAGE_H).fill(new FillGradient({
      type: 'radial',
      textureSpace: 'global',
      center: { x: STAGE_W / 2, y: STAGE_H * 0.52 }, innerRadius: STAGE_H * 0.34,
      outerCenter: { x: STAGE_W / 2, y: STAGE_H * 0.52 }, outerRadius: STAGE_H * 0.98,
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 0.70, color: 'rgba(2,6,10,0.10)' },
        { offset: 1, color: 'rgba(1,3,6,0.50)' },
      ],
    }));
  }

  _buildGrade() {
    // Bloom is what makes the lamps and the door strips read as light rather
    // than as bright pixels. `resolution: 'inherit'` is not optional: a
    // Filter's resolution defaults to 1, so on a 2x display it would be
    // computed at half the screen's density and scaled back up — muddy, which
    // reads as "the effects aren't really there".
    const bloom = new AdvancedBloomFilter({
      threshold: 0.66, bloomScale: 1.10, brightness: 1.0, blur: 4.5, quality: 4,
    });
    bloom.resolution = 'inherit';

    // ColorMatrixFilter's ranges are not what they look like: contrast() is
    // 0..1 and NEUTRAL AT 0.5, saturate() is -1..1 neutral at 0. With
    // multiply:true each call composes onto the last, so three "small"
    // adjustments stack into a large one. This is deliberately shallow.
    const grade = new ColorMatrixFilter();
    grade.brightness(1.10, false);
    grade.contrast(0.54, true);
    grade.saturate(0.10, true);
    grade.resolution = 'inherit';

    this.root.filters = [bloom, grade];
    // The root is filtered EVERY frame and its bounds are known exactly — they
    // are the authored stage. Setting filterArea skips a per-frame
    // getGlobalBounds() over the whole display list.
    this.root.filterArea = new Rectangle(0, 0, STAGE_W, STAGE_H);
  }

  // ── Layout / fitting ───────────────────────────────────────────────
  resize() {
    if (!this.app || this.destroyed) return;
    const w = this.canvas.clientWidth || STAGE_W;
    const h = this.canvas.clientHeight || STAGE_H;
    this.app.renderer.resize(w, h);
    // CONTAIN, not cover: a room that gets cropped loses its doors, and a door
    // you cannot see is a system you cannot reach.
    const s = Math.min(w / STAGE_W, h / STAGE_H);
    this.root.scale.set(s);
    this.root.x = (w - STAGE_W * s) / 2;
    this.root.y = (h - STAGE_H * s) / 2;
    this._fit = { s, ox: this.root.x, oy: this.root.y };
  }

  /** Convert a pointer position in CSS pixels (relative to the canvas) into
   *  stage units. Without this, tap-to-walk lands somewhere else on every
   *  device — the screen-px vs stage-px trap, in its simplest form. */
  toStage(cssX, cssY) {
    const f = this._fit || { s: 1, ox: 0, oy: 0 };
    return { x: (cssX - f.ox) / f.s, y: (cssY - f.oy) / f.s };
  }

  // ── The static room ────────────────────────────────────────────────
  /** A key that changes whenever the painted room would look different, so the
   *  expensive layer is repainted on a real change and never per frame. */
  _stateKey() {
    const b = STATIONS.map(st => (st.module ? buildingLevel(this.save, st.module) : 0)).join(',');
    return `${isStationRepaired(this.save) ? 1 : 0}|${b}`;
  }

  _paintStatic() {
    const g = this.gStatic;
    g.clear();
    const rep = isStationRepaired(this.save);
    this._repaired = rep;

    // ── The hull around the room ────────────────────────────────────
    const OX0 = FLOOR.x0 - WALL_T, OX1 = FLOOR.x1 + WALL_T;
    const OY0 = FLOOR.y0 - BACK_FACE - 30, OY1 = FLOOR.y1 + 44;
    g.rect(OX0, OY0, OX1 - OX0, OY1 - OY0).fill({ color: rep ? 0x0e1b22 : 0x090f14 });
    g.rect(OX0, OY0, OX1 - OX0, OY1 - OY0).stroke({ width: 2, color: rep ? 0x2c4956 : 0x1a2830, alpha: 0.9 });

    // Ribs: the structural frame you can see through the plating. Four down
    // each long side, spaced off the floor width so they stay put if the room
    // is ever resized.
    for (let i = 0; i <= 6; i++) {
      const x = FLOOR.x0 + (FLOOR_W * i) / 6;
      g.rect(x - 3, OY0 + 6, 6, BACK_FACE + 22).fill({ color: rep ? 0x16262e : 0x101a20 });
    }

    // ── The back wall's inner face ──────────────────────────────────
    const BW_Y = FLOOR.y0 - BACK_FACE;
    g.rect(FLOOR.x0, BW_Y, FLOOR_W, BACK_FACE).fill(new FillGradient({
      type: 'linear', textureSpace: 'global',
      start: { x: 0, y: BW_Y }, end: { x: 0, y: FLOOR.y0 },
      colorStops: rep
        ? [{ offset: 0, color: 'rgba(46,80,94,1)' }, { offset: 1, color: 'rgba(22,44,55,1)' }]
        : [{ offset: 0, color: 'rgba(27,43,52,1)' }, { offset: 1, color: 'rgba(14,24,31,1)' }],
    }));

    // ── The viewport, with Earth in it ──────────────────────────────
    this._paintWindow(g, WINDOW.cx, BW_Y + BACK_FACE / 2, WINDOW.hw, BACK_FACE - 10, rep);

    // ── The floor ───────────────────────────────────────────────────
    g.rect(FLOOR.x0, FLOOR.y0, FLOOR_W, FLOOR_H).fill(new FillGradient({
      type: 'linear', textureSpace: 'global',
      start: { x: 0, y: FLOOR.y0 }, end: { x: 0, y: FLOOR.y1 },
      colorStops: rep
        ? [{ offset: 0, color: 'rgba(38,66,78,1)' }, { offset: 1, color: 'rgba(20,38,48,1)' }]
        : [{ offset: 0, color: 'rgba(22,34,41,1)' }, { offset: 1, color: 'rgba(12,20,26,1)' }],
    }));

    // Plating. Deterministic per-plate tone so the floor has grain without
    // ever shimmering between frames.
    const P = 62;
    const cols = Math.ceil(FLOOR_W / P), rows = Math.ceil(FLOOR_H / P);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        const x = FLOOR.x0 + cx * P, y = FLOOR.y0 + cy * P;
        const w = Math.min(P, FLOOR.x1 - x), h = Math.min(P, FLOOR.y1 - y);
        const n = noise(i * 31 + 7);
        // Deterministic per-plate tone: a few plates sit a shade off the rest,
        // so the floor has grain without any of it crawling between frames.
        const tone = shiftTone(rep ? 0x2b4a58 : 0x18272f, n);
        g.rect(x + 2, y + 2, w - 4, h - 4).fill({ color: tone, alpha: rep ? 0.55 : 0.42 });
        // Seam highlight along the top and left edge only — that is what makes
        // a plate read as raised rather than as a drawn square.
        g.moveTo(x + 2, y + h - 2).lineTo(x + 2, y + 2).lineTo(x + w - 2, y + 2)
          .stroke({ width: 1, color: rep ? 0x5b8ea3 : 0x2b414c, alpha: rep ? 0.55 : 0.35 });
        // Four bolts, but only on every third plate — on all of them it turns
        // into wallpaper.
        if (n > 0.66) {
          const bd = 9;
          for (const [bx, by] of [[x + bd, y + bd], [x + w - bd, y + bd], [x + bd, y + h - bd], [x + w - bd, y + h - bd]]) {
            g.circle(bx, by, 1.7).fill({ color: rep ? 0x4a7688 : 0x22333b, alpha: 0.8 });
          }
        }
      }
    }

    // ── The inlaid emblem in the middle of the floor ────────────────
    this._paintEmblem(g, EMBLEM.cx, EMBLEM.cy, EMBLEM.r, rep);

    // ── Grime, cracks and debris — only while derelict ──────────────
    if (!rep) {
      for (let i = 0; i < 26; i++) {
        const x = FLOOR.x0 + noise(i * 41 + 3) * FLOOR_W;
        const y = FLOOR.y0 + noise(i * 23 + 11) * FLOOR_H;
        const r = 12 + noise(i * 19) * 46;
        g.ellipse(x, y, r, r * 0.55).fill({ color: 0x000000, alpha: 0.16 + noise(i * 7) * 0.14 });
      }
      // Cracks: a few short polylines, jittered deterministically.
      for (let c = 0; c < 5; c++) {
        let x = FLOOR.x0 + noise(c * 97 + 13) * FLOOR_W;
        let y = FLOOR.y0 + noise(c * 53 + 29) * FLOOR_H;
        g.moveTo(x, y);
        for (let k = 0; k < 7; k++) {
          x += (noise(c * 100 + k * 9) - 0.5) * 46;
          y += (noise(c * 100 + k * 9 + 5) - 0.5) * 34;
          g.lineTo(x, y);
        }
        g.stroke({ width: 1.4, color: 0x000000, alpha: 0.4 });
      }
      // Debris: knocked-over crates and loose panels near the walls.
      for (let d = 0; d < 7; d++) {
        const x = FLOOR.x0 + 26 + noise(d * 61 + 7) * (FLOOR_W - 52);
        const y = FLOOR.y0 + 26 + noise(d * 71 + 17) * (FLOOR_H - 52);
        const w = 16 + noise(d * 13) * 22, h = 10 + noise(d * 29) * 14;
        const a = (noise(d * 37) - 0.5) * 0.9;
        const pts = [];
        for (const [ox, oy] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
          pts.push(x + ox * Math.cos(a) - oy * Math.sin(a), y + oy * Math.cos(a) + ox * Math.sin(a));
        }
        g.poly(pts).fill({ color: 0x121c22 });
        g.poly(pts).stroke({ width: 1, color: 0x263942, alpha: 0.7 });
      }
    } else {
      // One living thing does more for "cosy" than any amount of extra light.
      this._paintPlant(g, FLOOR.x0 + 44, FLOOR.y0 + 40);
    }

    // ── Doors and consoles ──────────────────────────────────────────
    for (const st of STATIONS) this._paintStation(g, st, rep);

    this._builtKey = this._stateKey();
  }

  _paintWindow(g, cx, cy, hw, hh, rep) {
    g.rect(cx - hw, cy - hh / 2, hw * 2, hh).fill({ color: 0x02040a });
    // Stars behind the glass — deterministic, so they do not crawl.
    for (let i = 0; i < 34; i++) {
      const x = cx - hw + 4 + noise(i * 43 + 1) * (hw * 2 - 8);
      const y = cy - hh / 2 + 3 + noise(i * 67 + 9) * (hh - 6);
      g.circle(x, y, 0.5 + noise(i * 5) * 1.0).fill({ color: 0xdff4ff, alpha: 0.35 + noise(i * 3) * 0.5 });
    }
    // Earth: the planet he flew up from. Terminator on the left, so the room's
    // key light and the planet's agree.
    const er = hh * 0.44;
    g.circle(cx + hw * 0.34, cy + 2, er).fill({ color: 0x1c5f86 });
    g.circle(cx + hw * 0.34 + er * 0.22, cy + 2 - er * 0.18, er * 0.78).fill({ color: 0x2f8f7a, alpha: 0.5 });
    g.circle(cx + hw * 0.34, cy + 2, er).stroke({ width: 1.2, color: 0x7fd8ff, alpha: 0.45 });
    // Glass: one specular streak, not a wash.
    g.poly([cx - hw + 8, cy + hh / 2 - 3, cx - hw + 26, cy - hh / 2 + 3, cx - hw + 38, cy - hh / 2 + 3, cx - hw + 20, cy + hh / 2 - 3])
      .fill({ color: 0xffffff, alpha: 0.07 });
    // Frame.
    g.rect(cx - hw, cy - hh / 2, hw * 2, hh).stroke({ width: 3, color: rep ? 0x54808f : 0x2a3d46 });
    g.rect(cx - hw - 4, cy - hh / 2 - 4, hw * 2 + 8, hh + 8).stroke({ width: 2, color: rep ? 0x2e4d59 : 0x1b2830, alpha: 0.8 });
    if (!rep) {
      // The crack. It stays after the repair in the fiction, but the room is
      // about the change of state, so it goes.
      g.moveTo(cx - hw * 0.5, cy - hh / 2)
        .lineTo(cx - hw * 0.28, cy - 2).lineTo(cx - hw * 0.42, cy + 6).lineTo(cx - hw * 0.16, cy + hh / 2)
        .stroke({ width: 1.3, color: 0xbfe6ff, alpha: 0.5 });
    }
  }

  _paintEmblem(g, cx, cy, R, rep) {
    const brass = rep ? 0xc9a463 : 0x4a4536;
    const dark = rep ? 0x0d1c23 : 0x0a1116;
    g.circle(cx, cy, R).fill({ color: dark, alpha: 0.75 });
    g.circle(cx, cy, R).stroke({ width: 2.5, color: brass, alpha: rep ? 0.85 : 0.45 });
    g.circle(cx, cy, R * 0.78).stroke({ width: 1.2, color: brass, alpha: rep ? 0.5 : 0.25 });
    // Ticks around the ring — machined, not drawn.
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      const r0 = R * (i % 4 === 0 ? 0.84 : 0.89);
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
        .lineTo(cx + Math.cos(a) * R * 0.96, cy + Math.sin(a) * R * 0.96)
        .stroke({ width: i % 4 === 0 ? 1.6 : 0.9, color: brass, alpha: rep ? 0.55 : 0.22 });
    }
    // The drop itself, inlaid — the same silhouette as the character.
    const half = heroHalfPoints(R * 0.32, 12);
    const pts = [];
    for (let i = 0; i < half.length; i += 2) pts.push(cx + half[i], cy + half[i + 1] + 4);
    for (let i = half.length - 2; i >= 0; i -= 2) pts.push(cx - half[i], cy + half[i + 1] + 4);
    g.poly(pts).fill({ color: rep ? 0x1b5f80 : 0x141f26, alpha: rep ? 0.9 : 0.6 });
    g.poly(pts).stroke({ width: 1.6, color: rep ? 0x7fd8ff : 0x2a3a43, alpha: rep ? 0.7 : 0.35 });
  }

  _paintPlant(g, x, y) {
    g.ellipse(x, y + 16, 14, 6).fill({ color: 0x000000, alpha: 0.35 });
    g.rect(x - 11, y + 2, 22, 16).fill({ color: 0x6b4a33 });
    g.rect(x - 11, y + 2, 22, 4).fill({ color: 0x8a6244 });
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.42;
      const len = 20 + noise(i * 13) * 12;
      g.moveTo(x, y + 2)
        .quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + 2 + Math.sin(a) * len * 0.8,
          x + Math.cos(a) * len, y + 2 + Math.sin(a) * len)
        .stroke({ width: 2.2, color: 0x3f8f5a, alpha: 0.9 });
    }
  }

  /** One door or console, in the wall. */
  _paintStation(g, st, rep) {
    if (st.side === 'centre') { this._paintCore(g, st, rep); return; }
    const p = plateOf(st);
    const built = st.module ? buildingLevel(this.save, st.module) > 0 : true;
    const live = rep && built;
    const col = hex(ACCENT(st));
    const x0 = p.x - p.w / 2, y0 = p.y - p.h / 2;

    // The recess. A door is a hole in a wall; give it depth before anything.
    g.rect(x0, y0, p.w, p.h).fill({ color: live ? 0x081820 : 0x05090c });
    g.rect(x0, y0, p.w, p.h).stroke({ width: 2, color: live ? 0x3c6b7c : 0x1c2a31 });

    if (st.id === 'exit') {
      // An exit is not a module — it is always open and it is always the same
      // green, because the one thing that must never look conditional is the
      // way out.
      g.rect(x0 + 5, y0 + 5, p.w - 10, p.h - 10).fill({ color: 0x0c2416 });
      const ax = p.x, ay = p.y;
      g.poly([ax - 9, ay - 4, ax + 3, ay - 4, ax + 3, ay - 9, ax + 12, ay, ax + 3, ay + 9, ax + 3, ay + 4, ax - 9, ay + 4])
        .fill({ color: 0x4dff91, alpha: 0.95 });
      return;
    }

    if (st.fixture) {
      // A console, not a doorway: a slanted panel with a screen in it.
      g.rect(x0 + 4, y0 + 3, p.w - 8, p.h - 6).fill({ color: live ? 0x0d2029 : 0x0a1014 });
      for (let i = 0; i < 4; i++) {
        const bw = (p.w - 22) / 4;
        g.rect(x0 + 9 + i * bw, y0 + 8, bw - 3, p.h - 16)
          .fill({ color: live ? col : 0x1b262c, alpha: live ? 0.28 + i * 0.14 : 0.5 });
      }
      g.rect(x0 + 4, y0 + 3, p.w - 8, p.h - 6).stroke({ width: 1.4, color: live ? col : 0x24343c, alpha: live ? 0.8 : 0.6 });
      if (!live) this._paintPadlock(g, p.x, p.y);
      return;
    }

    // A doorway: two leaves parted in the middle, a lit strip above, and the
    // corridor visible beyond.
    const inset = 6;
    if (p.dir === 'v') {
      const gap = live ? 22 : 6;
      const leafW = (p.w - inset * 2 - gap) / 2;
      // The corridor beyond — darker than the room, with a hint of light at
      // its far end when the module is running.
      g.rect(p.x - gap / 2, y0 + inset, gap, p.h - inset * 2)
        .fill({ color: live ? 0x0a2c3a : 0x03070a });
      if (live) {
        g.rect(p.x - gap / 2, y0 + inset, gap, 4).fill({ color: col, alpha: 0.5 });
      }
      for (const s of [-1, 1]) {
        const lx = s < 0 ? x0 + inset : p.x + gap / 2;
        g.rect(lx, y0 + inset, leafW, p.h - inset * 2).fill({ color: live ? 0x14303c : 0x0b141a });
        g.rect(lx, y0 + inset, leafW, p.h - inset * 2).stroke({ width: 1, color: live ? 0x3f7387 : 0x1d2c33, alpha: 0.85 });
        // A chamfer on the leading edge, so the leaves read as thick.
        g.rect(s < 0 ? lx + leafW - 3 : lx, y0 + inset, 3, p.h - inset * 2)
          .fill({ color: live ? 0x50899d : 0x24343c, alpha: 0.75 });
      }
      // Lit strip along the top of the frame — this is the thing that says
      // "powered" from across the room.
      g.rect(x0 + 4, y0 - 4, p.w - 8, 4).fill({ color: live ? col : 0x18242a, alpha: live ? 0.95 : 0.9 });
    } else {
      const gap = live ? 22 : 6;
      const leafH = (p.h - inset * 2 - gap) / 2;
      g.rect(x0 + inset, p.y - gap / 2, p.w - inset * 2, gap)
        .fill({ color: live ? 0x0a2c3a : 0x03070a });
      for (const s of [-1, 1]) {
        const ly = s < 0 ? y0 + inset : p.y + gap / 2;
        g.rect(x0 + inset, ly, p.w - inset * 2, leafH).fill({ color: live ? 0x14303c : 0x0b141a });
        g.rect(x0 + inset, ly, p.w - inset * 2, leafH).stroke({ width: 1, color: live ? 0x3f7387 : 0x1d2c33, alpha: 0.85 });
      }
      const sx = st.side === 'left' ? x0 + p.w : x0 - 4;
      g.rect(sx, y0 + 4, 4, p.h - 8).fill({ color: live ? col : 0x18242a, alpha: live ? 0.95 : 0.9 });
    }

    if (!live) this._paintPadlock(g, p.x, p.y);
  }

  _paintPadlock(g, x, y) {
    g.rect(x - 6, y - 1, 12, 10).fill({ color: 0x51636d });
    g.rect(x - 6, y - 1, 12, 10).stroke({ width: 1, color: 0x8fa6b2, alpha: 0.7 });
    g.moveTo(x - 3.5, y - 1).lineTo(x - 3.5, y - 5)
      .quadraticCurveTo(x, y - 9.5, x + 3.5, y - 5).lineTo(x + 3.5, y - 1)
      .stroke({ width: 1.8, color: 0x8fa6b2, alpha: 0.85 });
  }

  /** The data core in the middle of the room. Before the repair it is a dead
   *  pillar with a work light on it; after, it is where A.I.D.A. lives. */
  _paintCore(g, st, rep) {
    const a = anchorOf(st);
    const cx = a.x, cy = a.y - 6;
    g.ellipse(cx, cy + 26, 34, 12).fill({ color: 0x000000, alpha: 0.45 });
    // Plinth.
    g.poly([cx - 30, cy + 26, cx + 30, cy + 26, cx + 22, cy + 6, cx - 22, cy + 6])
      .fill({ color: rep ? 0x1a333d : 0x101a20 });
    g.poly([cx - 30, cy + 26, cx + 30, cy + 26, cx + 22, cy + 6, cx - 22, cy + 6])
      .stroke({ width: 1.4, color: rep ? 0x4d7d8f : 0x22323a, alpha: 0.9 });
    // Column.
    g.rect(cx - 15, cy - 30, 30, 38).fill({ color: rep ? 0x14282f : 0x0c151a });
    g.rect(cx - 15, cy - 30, 30, 38).stroke({ width: 1.2, color: rep ? 0x3f6d80 : 0x1e2c33 });
    if (rep) {
      // The chip's housing, holding something with a slow internal light. The
      // story bible is explicit that it must not read as hardware.
      g.rect(cx - 9, cy - 24, 18, 22).fill({ color: 0x061a24 });
      g.rect(cx - 9, cy - 24, 18, 22).stroke({ width: 1, color: 0x7fd8ff, alpha: 0.55 });
    } else {
      // Dead panel, and a work light somebody left clipped to it.
      g.rect(cx - 9, cy - 24, 18, 22).fill({ color: 0x0a0f13 });
      g.rect(cx - 9, cy - 24, 18, 22).stroke({ width: 1, color: 0x22323a });
    }
  }

  // ── THE CABLE NOBODY ASKED ABOUT ───────────────────────────────────
  // Story bible, section 4: every module the player powers on is A.I.D.A.
  // routing current, and by act 5 the station is a transmitter aimed at
  // Nibiru. "Plant this visually from the first module: a cable the player
  // never asked about, running somewhere they cannot follow."
  //
  // So: one conduit per LIT door, running across the floor to the core, with a
  // pulse travelling toward it. Never away from it. Nobody is told.
  _paintCable(dt) {
    const g = this.gCable;
    g.clear();
    if (!this._repaired) return;
    const core = anchorOf(STATIONS.find(s => s.id === 'core'));
    for (const st of STATIONS) {
      if (!st.module || buildingLevel(this.save, st.module) <= 0) continue;
      const a = anchorOf(st);
      // An L-bend rather than a straight line: cable runs follow the plating.
      const midY = st.side === 'left' || st.side === 'right' ? a.y : core.y;
      const midX = st.side === 'left' || st.side === 'right' ? core.x : a.x;
      const path = [a.x, a.y, midX, midY, core.x, core.y];
      g.moveTo(path[0], path[1]).lineTo(path[2], path[3]).lineTo(path[4], path[5])
        .stroke({ width: 3.4, color: 0x0a1418, alpha: 0.85 });
      g.moveTo(path[0], path[1]).lineTo(path[2], path[3]).lineTo(path[4], path[5])
        .stroke({ width: 1.2, color: 0x24505f, alpha: 0.75 });

      // The pulse. Length along the two segments, then a point at `u`.
      const l1 = Math.hypot(midX - a.x, midY - a.y);
      const l2 = Math.hypot(core.x - midX, core.y - midY);
      const total = l1 + l2 || 1;
      // Phase offset per door so they do not all arrive together — that would
      // read as an effect. Staggered reads as traffic.
      const ph = (this.t * 0.22 + noise(st.id.charCodeAt(0) * 17)) % 1;
      const d = ph * total;
      let px, py;
      if (d < l1) { const u = d / (l1 || 1); px = lerp(a.x, midX, u); py = lerp(a.y, midY, u); }
      else { const u = (d - l1) / (l2 || 1); px = lerp(midX, core.x, u); py = lerp(midY, core.y, u); }
      g.circle(px, py, 2.6).fill({ color: 0x9fe8ff, alpha: 0.85 * (1 - ph * 0.35) });
      this._light(px, py, 26, 0x6fd0ff, 0.20);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────
  keyDown(code) { this.keys.add(code); this.moveTarget = null; }
  keyUp(code) { this.keys.delete(code); }
  clearKeys() { this.keys.clear(); }

  /** Tap/click to walk. `x`,`y` are CSS pixels relative to the canvas. */
  pointTo(cssX, cssY) {
    const p = this.toStage(cssX, cssY);
    this.moveTarget = {
      x: clamp(p.x, FLOOR.x0 + HERO_R, FLOOR.x1 - HERO_R),
      y: clamp(p.y, FLOOR.y0 + HERO_R, FLOOR.y1 - HERO_R),
    };
  }

  /** Activate whatever is armed. Returns the station, or null. */
  interact() {
    const st = this.nearest;
    if (!st) return null;
    if (st.id === 'core' && !this._repaired) {
      this.startRepair();
      return st;
    }
    if (Audio.menuOpen) Audio.menuOpen();
    this.onEnter(st);
    return st;
  }

  /** CLEAN & REPAIR, done standing in the middle of the room.
   *  It calls the SAME save transform the module list calls — game/base.js's
   *  repairStation — via the onRepair callback. There is no second repair. */
  startRepair() {
    if (this._repaired || this._sweepT != null) return;
    this._sweepT = 0;
    if (Audio.unlockReveal) Audio.unlockReveal(); else if (Audio.claimPing) Audio.claimPing();
  }

  // ── Frame ──────────────────────────────────────────────────────────
  _tick(tk) {
    if (this.destroyed || !this.app) return;
    // Clamped both ways. A tab that has been in the background hands back a
    // huge deltaMS, and the springs below divide by dt.
    const dt = clamp((tk.deltaMS || 16.7) / 1000, 1 / 240, 0.05);
    this.t += dt;

    // The static layer repaints only when the room would actually look
    // different — a repair, or a module coming online.
    const key = this._stateKey();
    if (key !== this._builtKey) this._paintStatic();

    this._updateSweep(dt);
    this._updateHero(dt);

    // Reset the light pool for this frame, then everything that emits claims
    // a sprite. Nothing allocates per frame — the array is emptied in place.
    for (let i = 0; i < this._lightN; i++) this.lights[i].visible = false;
    this._lightN = 0;
    this._frameLights.length = 0;

    this._paintCable(dt);
    this._paintLive(dt);
    this._drawHero();
    this._updateDust(dt);
  }

  _updateSweep(dt) {
    if (this._sweepT == null) return;
    this._sweepT += dt;
    // The save flips UNDER the sweep, so the room is already clean when the
    // light passes over it. The wipe REVEALS the change rather than announcing
    // one that happens afterwards — the same timing BasePanel's sweep uses.
    if (!this._repaired && this._sweepT > 0.52) {
      this.onRepair();
      this._repaired = true;
      this._paintStatic();
    }
    if (this._sweepT > 1.6) this._sweepT = null;
  }

  _updateHero(dt) {
    // Direction: keys first, then the walk-to target.
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;

    if (!dx && !dy && this.moveTarget) {
      const tx = this.moveTarget.x - this.px, ty = this.moveTarget.y - this.py;
      const d = Math.hypot(tx, ty);
      if (d < 5) this.moveTarget = null;
      else { dx = tx / d; dy = ty / d; }
    }

    const mag = Math.hypot(dx, dy);
    if (mag > 0) { dx /= mag; dy /= mag; }

    const targetVX = dx * WALK_SPEED, targetVY = dy * WALK_SPEED;
    const prevVX = this.vx, prevVY = this.vy;
    // Accelerate hard, decelerate softer — that difference is what makes him
    // feel heavy with water rather than like a cursor.
    this.vx = damp(this.vx, targetVX, mag > 0 ? 13 : 8, dt);
    this.vy = damp(this.vy, targetVY, mag > 0 ? 13 : 8, dt);

    this.px = clamp(this.px + this.vx * dt, FLOOR.x0 + HERO_R, FLOOR.x1 - HERO_R);
    this.py = clamp(this.py + this.vy * dt, FLOOR.y0 + HERO_R, FLOOR.y1 - HERO_R);

    const speed = Math.hypot(this.vx, this.vy);
    this.speed01 = clamp(speed / WALK_SPEED, 0, 1);
    this.gait.update(this.vx, this.vy, WALK_SPEED, dt);

    // ── The water body ──────────────────────────────────────────────
    // Two damped springs driven by ACCELERATION, so the mass inside him keeps
    // going after he stops. That lag is the whole "made of water" read; a
    // spring driven by velocity just follows him and reads as jelly.
    const ax = (this.vx - prevVX) / dt, ay = (this.vy - prevVY) / dt;
    this.wobVX += (-this.wobX * 190 - this.wobVX * 15 - ax * 0.055) * dt;
    this.wobVY += (-this.wobY * 190 - this.wobVY * 15 - ay * 0.055) * dt;
    this.wobX += this.wobVX * dt;
    this.wobY += this.wobVY * dt;
    this.wobX = clamp(this.wobX, -5, 5);
    this.wobY = clamp(this.wobY, -5, 5);

    // The footstep fires on the REAL footfall — the frame a foot re-plants —
    // rather than on a timer that happens to run at about the right rate. It is
    // the same distance-driven cycle the legs are drawn from, so the sound can
    // never drift out of step with the picture.
    const step = Math.floor(this.gait.travel / 0.62);
    if (step !== this._lastStep) {
      this._lastStep = step;
      if (this.speed01 > 0.25 && Audio.casingLand) Audio.casingLand();
    }

    // ── Facing ──────────────────────────────────────────────────────
    // Two axes rather than one angle, matching HeroAnim's own reasoning:
    // faceY picks front-vs-back, faceX picks which way the profile turns.
    // Blending one angle would swing the face through the back of his head.
    if (this.speed01 > 0.15) {
      this.faceX = damp(this.faceX, clamp(this.vx / WALK_SPEED * 1.6, -1, 1), 9, dt);
      this.faceY = damp(this.faceY, this.vy < -WALK_SPEED * 0.45 ? -0.55 : 1, 7, dt);
    } else {
      this.faceX = damp(this.faceX, 0, 5, dt);
      this.faceY = damp(this.faceY, 1, 5, dt);
    }

    // Blink.
    this._blinkT -= dt;
    if (this._blinkT <= 0) { this._blinkT = 2.0 + Math.random() * 3.4; this._blinkStart = this.t; }
    const bs = this.t - (this._blinkStart || -9);
    this.blink = bs >= 0 && bs < 0.13 ? Math.sin((bs / 0.13) * Math.PI) : 0;

    // ── What is armed ───────────────────────────────────────────────
    let best = null, bestD = REACH;
    for (const st of STATIONS) {
      // A locked door still arms — it has to, or the player walks up to a
      // padlock and nothing tells them what it is or how to open it.
      if (st.id === 'core' && !this._repaired && this._sweepT != null) continue;
      const a = anchorOf(st);
      const d = Math.hypot(a.x - this.px, a.y - this.py);
      if (d < bestD) { bestD = d; best = st; }
    }
    this.nearest = best;
    const id = best ? best.id : null;
    if (id !== this._nearestId) {
      this._nearestId = id;
      if (best && Audio.skillHover) Audio.skillHover('minor');
      this.onNear(best);
    }
  }

  /** Everything that emits light or moves, repainted per frame. */
  _paintLive(dt) {
    const g = this.gLive;
    g.clear();
    const rep = this._repaired;

    // Ceiling lamps. Two, warm, and only once the power is on. While derelict
    // one of them stutters on a lazy irregular cycle — a steady pulse reads as
    // working, an irregular one reads as giving up.
    for (const lx of [FLOOR.x0 + FLOOR_W * 0.24, FLOOR.x0 + FLOOR_W * 0.76]) {
      const ly = FLOOR.y0 + 8;
      if (rep) {
        const flick = 0.94 + Math.sin(this.t * 3.1 + lx) * 0.06;
        g.rect(lx - 62, ly - 6, 124, 6).fill({ color: 0xd8f2ff, alpha: 0.75 * flick });
        this._light(lx, ly + 96, 330, 0xa8dcf0, 0.34 * flick);
      } else {
        const stutter = Math.sin(this.t * 11.7 + lx) > 0.78 ? 0.9 : 0.08;
        g.rect(lx - 62, ly - 6, 124, 6).fill({ color: 0x7a93a0, alpha: 0.26 * stutter });
        this._light(lx, ly + 70, 210, 0x6d8fa0, 0.14 * stutter);
      }
    }

    // A wide, weak fill over the middle of a REPAIRED hall. Without it the
    // centre of the room falls between the two ceiling lamps and the player
    // walks through a dark band on the way to the core.
    if (rep) this._light(WINDOW.cx, FLOOR.y0 + FLOOR_H * 0.55, 430, 0x7fb8d0, 0.13);

    // The viewport spills cold light onto the floor in front of it.
    this._light(WINDOW.cx, FLOOR.y0 + 46, rep ? 280 : 190, 0x5fa8d8, rep ? 0.22 : 0.12);

    // Door strips. One light each, and only when the module is actually
    // running — the room IS the progress bar.
    for (const st of STATIONS) {
      if (st.side === 'centre') continue;
      const built = st.module ? buildingLevel(this.save, st.module) > 0 : true;
      const live = rep && built;
      const a = anchorOf(st);
      if (st.id === 'exit') {
        this._light(a.x, a.y + 14, 120, 0x4dff91, 0.22 + Math.sin(this.t * 1.7) * 0.03);
        continue;
      }
      if (!live) continue;
      const col = hex(ACCENT(st));
      const breathe = 0.30 + Math.sin(this.t * 1.35 + a.x * 0.01) * 0.05;
      this._light(a.x, a.y - (st.side === 'top' ? 22 : st.side === 'bottom' ? -18 : 0), 165, col, breathe);
    }

    // The core.
    const core = anchorOf(STATIONS.find(s => s.id === 'core'));
    if (rep) {
      // A slow internal light with a second, faster component under it — one
      // sine reads as a blinking LED, two read as something thinking.
      const pulse = 0.34 + Math.sin(this.t * 1.1) * 0.10 + Math.sin(this.t * 2.9) * 0.04;
      this._light(core.x, core.y - 20, 130, 0x7fd8ff, pulse);
      g.circle(core.x, core.y - 20, 5 + Math.sin(this.t * 2.4) * 1.2).fill({ color: 0xdff4ff, alpha: 0.9 });
      // Her eye, when she is looking at you. It tracks the player — she is
      // never not watching, and it is never mentioned.
      const ex = clamp((this.px - core.x) / 260, -1, 1) * 4;
      const ey = clamp((this.py - core.y) / 200, -1, 1) * 2.5;
      g.ellipse(core.x + ex, core.y - 20 + ey, 2.2, 3.4).fill({ color: 0x04202c, alpha: 0.85 });
    } else {
      const w = Math.sin(this.t * 7.3) > 0.6 ? 1 : 0.12;
      this._light(core.x, core.y - 18, 74, 0xffcf80, 0.16 * w);
    }

    // The armed station gets a ring on the floor. It is drawn UNDER the hero
    // (gLive sits below gBody) so he stands inside it.
    if (this.nearest) {
      const a = anchorOf(this.nearest);
      const col = this.nearest.id === 'exit' ? 0x4dff91
        : this.nearest.module ? hex(ACCENT(this.nearest)) : 0x7fd8ff;
      const r = 30 + Math.sin(this.t * 4.2) * 2.5;
      g.circle(a.x, a.y, r).stroke({ width: 2, color: col, alpha: 0.75 });
      g.circle(a.x, a.y, r - 6).stroke({ width: 1, color: col, alpha: 0.3 });
      // Four ticks at the compass points, so the ring reads as a marker rather
      // than a halo.
      for (let i = 0; i < 4; i++) {
        const ang = this.t * 0.9 + (i / 4) * TAU;
        g.moveTo(a.x + Math.cos(ang) * (r + 3), a.y + Math.sin(ang) * (r + 3))
          .lineTo(a.x + Math.cos(ang) * (r + 9), a.y + Math.sin(ang) * (r + 9))
          .stroke({ width: 2, color: col, alpha: 0.8 });
      }
      this._light(a.x, a.y, 90, col, 0.10);
    }

    // The cleaning sweep — a bright band travelling down the room while the
    // repair happens.
    if (this._sweepT != null) {
      const u = clamp(this._sweepT / 1.2, 0, 1);
      const y = FLOOR.y0 - 80 + u * (FLOOR_H + 200);
      const fade = Math.sin(u * Math.PI);
      g.rect(FLOOR.x0, y - 26, FLOOR_W, 52).fill({ color: 0xdff4ff, alpha: 0.20 * fade });
      g.rect(FLOOR.x0, y - 2, FLOOR_W, 4).fill({ color: 0xffffff, alpha: 0.55 * fade });
      this._light(WINDOW.cx, y, 340, 0xbfe6ff, 0.30 * fade);
    }
  }

  _drawHero() {
    const r = HERO_R;
    // The weight shift is part of the body position, not a drawing offset —
    // the face, the headband and every future helmet ride on it too.
    const bx = this.px + this.wobX + this.gait.bodyOffset().x * HERO_R;
    const by = this.py + this.wobY;

    // Bob and squash from the walk cycle. Stretch along travel while moving,
    // settle (a slight sag) while standing.
    // The body's pose comes from the gait now, not from a sine wave invented
    // here. That matters for one reason: the bob and the feet are then read
    // off the SAME distance-driven cycle, so the body can never rise while the
    // foot it is rising over is still in the air.
    const G = this.gait;
    const off = G.bodyOffset();
    const bob = -off.y * r;                       // gait's negative is up
    const squash = -off.y * 0.55 + off.roll * 0.4;
    const settle = (1 - this.speed01) * 0.02;
    const sqx = 1 + squash + settle;
    const sqy = 1 - squash - settle;
    const lean = G.lean + off.roll * 0.5;

    // Contact shadow. Tied to the bob so it shrinks as he rises — without
    // that, a bobbing character looks like it is sliding on glass.
    // The body's own soft shadow. The FEET carry their own contact shadows
    // (drawLegs), which is what actually reads as weight; this one is just the
    // mass above them and it stays put on the floor while he bobs.
    const sh = this.gShadow;
    sh.clear();
    sh.ellipse(this.px, this.py + r * 1.32, r * 0.92, r * 0.30)
      .fill({ color: 0x000000, alpha: 0.30 - this.speed01 * 0.05 });

    // ── Body ────────────────────────────────────────────────────────
    // The merged light is computed BEFORE he emits his own, or he would shade
    // himself and the room would stop mattering.
    const L = this._computeRoomLight();

    // The far leg goes UNDER the body, the near leg OVER it. Drawing both on
    // one side is what makes a two-legged character look like a cardboard
    // cut-out with sticks taped to the back.
    this.gLegBack.clear();
    drawLegs(this.gLegBack, G, r, bx, by - bob, { sqx, lean, back: true });

    const gb = this.gBodyFill;
    gb.clear();
    const half = heroHalfPoints(r, 14);
    const pts = [];
    for (let i = 0; i < half.length; i += 2) pts.push(half[i] * sqx, half[i + 1] * sqy);
    for (let i = half.length - 2; i >= 0; i -= 2) pts.push(-half[i] * sqx, half[i + 1] * sqy);
    const ca = Math.cos(lean), sa = Math.sin(lean);
    const spun = [];
    for (let i = 0; i < pts.length; i += 2) {
      spun.push(bx + pts[i] * ca - pts[i + 1] * sa, by - bob + pts[i + 1] * ca + pts[i] * sa);
    }
    // The silhouette — the deep water under the surface.
    gb.poly(spun).fill({ color: 0x1a6f96 });

    // The lit volume. `scale`, not `width`: PixiJS's width setter derives from
    // LOCAL bounds, so assigning it on a ROTATED sprite feeds the rotated
    // bounds back in and the body creeps in size every time he leans.
    const diam = r * 1.94;
    const texW = this.litDiffuseTex.width || 1, texH = this.litDiffuseTex.height || 1;
    this.heroLit.position.set(bx, by - bob + r * 0.10);
    this.heroLit.scale.set((diam * sqx) / texW, (diam * sqy) / texH);
    this.heroLit.rotation = lean;
    // Rotated sprite, so the unrotated size is passed explicitly — otherwise
    // uObjSize breathes with the lean and the light on him pulses for no
    // reason the player can see.
    updateLitUniforms(this.heroLitFilter, this.heroLit, L, [diam * sqx, diam * sqy]);

    // Meniscus — the bright surface-tension rim a real drop carries where the
    // light hits it. Drawn as an ARC on the lit side, not a full ring: a ring
    // reads as an outline, an arc reads as a highlight.
    const gr = this.gBodyRim;
    gr.clear();
    gr.poly(spun).stroke({ width: 1.5, color: 0x06121e, alpha: 0.85 });
    const la = Math.atan2(L.y - (by - bob), L.x - bx);
    const seg = [];
    for (let i = 0; i <= 10; i++) {
      const a = la - 0.95 + (i / 10) * 1.9;
      seg.push(bx + Math.cos(a) * r * 0.92 * sqx, (by - bob) + Math.sin(a) * r * 0.92 * sqy);
    }
    gr.poly(seg, false).stroke({ width: 1.6, color: 0xdffbff, alpha: 0.34 + L.mt * 0.34 });

    // He is made of water and he is lit from inside; the room should know it.
    // `lit: false` — this one must never feed back into his own shading.
    this._light(bx, by - bob, 92, 0x5fd6ff, 0.13, false);

    // ── Face ────────────────────────────────────────────────────────
    // A plain object, not a HeroAnim: these are the only seven fields
    // drawHeroFace actually reads, and building a fake `game` to drive the
    // real class would be a lie that drifts.
    const exprId = this.nearest
      ? (this.nearest.id === 'core' ? 'focused' : 'happy')
      : (this.speed01 > 0.5 ? 'focused' : 'calm');
    const A = {
      faceX: this.faceX,
      faceY: this.faceY,
      blink: this.blink,
      // He looks at whatever is armed, and at the core when nothing is.
      lookX: this.nearest ? clamp((anchorOf(this.nearest).x - bx) / 140, -1, 1) : this.faceX * 0.4,
      lookY: this.nearest ? clamp((anchorOf(this.nearest).y - by) / 120, -1, 1) : 0,
      exprId,
      expr: EXPRESSIONS[exprId] || EXPRESSIONS.calm,
    };
    this.gLegFront.clear();
    drawLegs(this.gLegFront, G, r, bx, by - bob, { sqx, lean, back: false });

    const gf = this.gFace;
    gf.clear();
    drawHeroFace(gf, bx, by - bob, r, lean, sqx, sqy, A, null);
    // The headband, from the shared rig. Colour comes from the save so the
    // rarity ladder in backlog #46 has somewhere to land; the default is the
    // red one every reference sheet shows him wearing.
    const band = (this.save && this.save.cosmetics && this.save.cosmetics.headbandColor) || '#d1394a';
    drawHeadband(gf, bx, by - bob, r, band, { sqx, sqy, lean });
  }

  _updateDust(dt) {
    for (const d of this.dust) {
      d.x += (d.vx + Math.sin(this.t * 0.7 + d.ph) * 5) * dt;
      d.y += d.vy * dt;
      if (d.y < FLOOR.y0 - 40) { d.y = FLOOR.y1 + 20; d.x = FLOOR.x0 + Math.random() * FLOOR_W; }
      if (d.x < FLOOR.x0 - 20) d.x = FLOOR.x1 + 10;
      if (d.x > FLOOR.x1 + 20) d.x = FLOOR.x0 - 10;
      d.s.x = d.x; d.s.y = d.y;
      d.s.scale.set(d.r / this._lightTexR);
      // Filthy air while derelict; a few motes catching the light after.
      d.s.alpha = (this._repaired ? 0.10 : 0.20) * (0.55 + Math.sin(this.t * 1.6 + d.ph) * 0.45);
    }
  }

  // ── Scrub handles — for reviewing, not for the game ────────────────
  /** Put the hero in front of a station instantly. `__station.warp('hangar')` */
  warp(id) {
    const st = STATIONS.find(s => s.id === id);
    if (!st) return this;
    const a = anchorOf(st);
    this.px = a.x; this.py = a.y;
    this.vx = this.vy = 0; this.moveTarget = null;
    return this;
  }
  freeze() { this.app && this.app.ticker.stop(); return this; }
  play() { this.app && this.app.ticker.start(); return this; }

  // ── Teardown ───────────────────────────────────────────────────────
  setSave(save) {
    this.save = save || {};
    const key = this._stateKey();
    if (key !== this._builtKey) this._paintStatic();
  }

  destroy() {
    this.destroyed = true;
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (typeof window !== 'undefined' && window.__station === this) delete window.__station;
    if (this.app) { this.app.destroy(true, { children: true }); this.app = null; }
  }
}

// The floor plan re-exported so callers need only one import. Its home is
// stationLayout.js; this is a convenience, not a second definition.
export { STATIONS, FLOOR, anchorOf, plateOf, HERO_R, STAGE_W, STAGE_H } from './stationLayout';
