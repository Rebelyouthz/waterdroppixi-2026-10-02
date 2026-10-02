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
import { Application, Container, Graphics, Sprite, FillGradient, ColorMatrixFilter, Rectangle, Assets } from 'pixi.js';
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
import { drawHeroFace, drawArms, drawHeadband, drawHeldWeapon } from './heroDraw';
import { HeroGait } from './heroGait';
import { EXPRESSIONS } from './heroAnim';
import { BUILDINGS, buildingLevel, isStationRepaired } from './base';
// The generated 16-frame sheets, and the flag that switches them on. Both the
// sprite room and the drawn room are kept — this is a test, and a test that
// deletes the thing it is being compared against cannot be judged.
import { loadCampSheets, SheetSprite } from './stationSprites';
// The floor plan lives in its own pixi-free module so the headless suite can
// reach it — see stationLayout.js's header. A room whose geometry is only
// checkable by eye is a room whose geometry never gets checked.
import {
  STAGE_W, STAGE_H, FLOOR, FLOOR_W, FLOOR_H, BACK_FACE, WALL_T,
  HERO_R, WALK_SPEED, REACH, WINDOW, EMBLEM, STATIONS, anchorOf, plateOf,
  windowRect, furniturePose, hallCozy01, sheetKeyForStation, RESTORE_ZONES,
} from './stationLayout';

/** Which room the player sees: the generated 16-frame sheets, or the version
 *  drawn in code. Both are kept — this is a comparison, and a comparison that
 *  deletes one side cannot be judged. One word to switch. */
const ROOM_ART = 'sprites';   // 'sprites' | 'drawn'

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

// Same snapped-rib silhouette combat uses (WEAPON_MODELS.katana). Copied here
// so the walkable room does not import pixiRenderer.
const STATION_RIB = {
  accent: '#c8d4de', muzzle: 36,
  parts: [
    [-10.2, -2.0, 9.8, 4.0, '#1a1612'],
    [-8.8, -2.2, 1.5, 4.4, '#3a2c22'],
    [-3.4, -2.2, 1.4, 4.4, '#3a2c22'],
    [-0.5, -3.2, 3.0, 2.0, '#6a7480'],
    [-0.3, 1.1, 3.4, 2.4, '#4a545c'],
    [3.0, -1.8, 16, 3.6, '#8a96a4'],
    [3.0, -2.0, 16, 1.0, '#d4dee8'],
    [19.0, -2.4, 9, 4.0, '#7a8692'],
    [28.0, -3.0, 4.6, 2.8, '#6a7682'],
    [32.4, -2.0, 3.0, 2.0, '#b8c4ce'],
  ],
};

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

    this._floorRipples = [];
    this._dashGhosts = [];

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
      backgroundColor: 0x1a242c,
      antialias: true,
      preference: 'webgl',
    });
    if (this.destroyed) { app.destroy(true); return; }

    // Letterbox used to be the app clear colour (near-black). Four hard
    // edges on every contain-fit. Bleed paints hull metal behind the room
    // so the bars read as the wreck, not as a black frame.
    this.bleed = new Graphics();
    app.stage.addChild(this.bleed);
    this.root = new Container();
    app.stage.addChild(this.root);

    this._bakeLightTexture();

    // Layer order is the whole readability of the room. Static first so it can
    // be painted once; lights above the floor but under the hero so he stands
    // IN the light rather than being washed by it; dust on top of everything
    // because it is between you and the room.
    this.gStatic = new Graphics();          this.root.addChild(this.gStatic);
    // Earth / vista live IN the bay window, under the shutters. A full-stage
    // jpg behind the hull painted the planet across a wreck.
    this.windowClip = new Container();      this.root.addChild(this.windowClip);
    this.gWindowLive = new Graphics();      this.root.addChild(this.gWindowLive);
    this.gCable = new Graphics();           this.root.addChild(this.gCable);
    this.lightLayer = new Container();      this.root.addChild(this.lightLayer);
    this.gLive = new Graphics();            this.root.addChild(this.gLive);
    this.gRipples = new Graphics();         this.root.addChild(this.gRipples);
    this.gDashGhosts = new Graphics();      this.root.addChild(this.gDashGhosts);
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
    // The bay window stays a sealed shutter until the Main Hall exists.
    // Loading the panorama earlier painted Earth across the whole stage
    // behind the hull and made a wreck look like a finished home.
    if (buildingLevel(this.save, 'rampart') >= 1) {
      this._loadVista((this.save && this.save.profile && this.save.profile.stationVista) || 'earth');
    }
    // Lounge paintings sit under the cables so the floor conduits still
    // run across the room. Furniture sits above the cables, under the
    // pooled lights. Both layers stay empty until the sheets resolve —
    // the room is fully playable before a single texture has arrived.
    this.hallBgLayer = new Container();
    this.root.addChildAt(this.hallBgLayer, this.root.getChildIndex(this.gCable));
    this.spriteLayer = new Container();
    this.root.addChildAt(this.spriteLayer, this.root.getChildIndex(this.lightLayer));
    if (ROOM_ART === 'sprites') this._loadSprites();
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

  /** Pull in the camp sheets and place one sprite per station.
   *
   *  Async and non-blocking on purpose: if the sheets never arrive the room
   *  still works, still walks and still opens every menu — it just looks like
   *  the drawn version. Art should never be able to break navigation. */
  async _loadSprites() {
    if (this._spritesLoading || this.sprites) return;
    this._spritesLoading = true;
    const sheets = await loadCampSheets();
    if (this.destroyed || !this.spriteLayer) { this._spritesLoading = false; return; }
    this.sheets = sheets;
    this.sprites = [];
    this._furnLive = {};
    this._furnPop = {};

    // People-free lounge + wreck. Never the NPC shell. gStatic stays
    // visible underneath as the fallback if a painting is missing.
    const bg = this.hallBgLayer || this.spriteLayer;
    const repaired = isStationRepaired(this.save);
    if (sheets.wreck) {
      this.wreckSprite = this._mountHallSheet(sheets.wreck, bg);
      this.wreckSprite.alpha = 1;
    }
    if (sheets.restored) {
      this.restoredSprite = this._mountHallSheet(sheets.restored, bg);
      this.restoredSprite.alpha = repaired ? 1 : 0;
      this.restoredSprite.visible = repaired;
      // Sibling of the painting so it shares the contain-fit transform.
      // An unparented mask sat in canvas pixels and the lounge appeared as
      // a postage stamp in the top-left (looked at 2026-09-16).
      // Do NOT set renderable=false: Pixi's stencil pipe has to draw this
      // into the stencil buffer, and a non-renderable Graphics punches
      // nothing — restored vanishes and the wreck looks like a black void.
      this.restoreMask = new Graphics();
      this.restoreMask.eventMode = 'none';
      this.restoreMask.visible = false;
      bg.addChild(this.restoreMask);
      this.restoreVeil = new Graphics();
      this.restoreVeil.eventMode = 'none';
      bg.addChild(this.restoreVeil);
    }
    this._syncHallMask();

    // The paintings already have a floor. The tileset is only a fallback
    // for the drawn box hall.
    if (sheets.floor && !sheets.restored && !sheets.wreck) {
      const f = new SheetSprite(sheets.floor, { fps: 0, ax: 0, ay: 0, animated: false });
      f.x = FLOOR.x0; f.y = FLOOR.y0;
      f.width = FLOOR_W; f.height = FLOOR_H;
      f.alpha = 0;
      this.spriteLayer.addChild(f);
      this.floorSprite = f;
    }

    if (sheets.emblem && !sheets.restored) {
      const e = new SheetSprite(sheets.emblem, { fps: 6, ax: 0.5, ay: 0.5 });
      e.x = EMBLEM.cx; e.y = EMBLEM.cy;
      const native = sheets.emblem.fh || 128;
      e.scale.set((EMBLEM.r * 2) / native);
      this.spriteLayer.addChild(e);
      this.emblemSprite = e;
    }

    for (const st of STATIONS) {
      const key = sheetKeyForStation(st);
      const sh = key && sheets[key];
      const pose = furniturePose(st);
      if (!sh || !pose) continue;
      const sp = new SheetSprite(sh, { fps: 8, ax: pose.ax, ay: pose.ay });
      sp.x = pose.x;
      sp.y = pose.y;
      const native = sh.fh || 128;
      sp.scale.set(pose.h / native);
      sp.visible = false;
      this.spriteLayer.addChild(sp);
      this.sprites.push({ sp, st, pose, native });
    }

    // Lamp sheets double the painted ceiling when the lounge is up.
    // Keep them for the drawn hall only.
    if (sheets.lights && !sheets.restored) {
      this.lampSprites = [];
      for (const lx of [FLOOR.x0 + FLOOR_W * 0.24, FLOOR.x0 + FLOOR_W * 0.76]) {
        const sp = new SheetSprite(sheets.lights, { fps: 10, ax: 0.5, ay: 0 });
        sp.x = lx;
        sp.y = FLOOR.y0 - 6;
        sp.blendMode = 'add';
        const native = sheets.lights.fh || 128;
        sp.scale.set(90 / native);
        sp.alpha = 0;
        this.spriteLayer.addChild(sp);
        this.lampSprites.push(sp);
      }
    }

    if (sheets.earthWindow && this.windowClip && !sheets.restored) {
      const r = windowRect();
      const sp = new SheetSprite(sheets.earthWindow, { fps: 8, ax: 0, ay: 0 });
      sp.x = r.x; sp.y = r.y;
      sp.width = r.w; sp.height = r.h;
      sp.visible = false;
      this.windowClip.addChild(sp);
      this.earthWindowSprite = sp;
      if (this.vistaSprite) this.vistaSprite.visible = false;
    }

    // Character stays the hardcoded drop. Never hide gBodyFill / gFace / heroLit.
    this._paintVignette();
    this._applyCozyGrade();
    this._paintStatic();
    this._spritesLoading = false;
  }

  _mountHallSheet(sheet, layer) {
    const sp = new SheetSprite(sheet, { fps: 0, ax: 0, ay: 0, animated: false });
    sp.x = 0;
    sp.y = 0;
    sp.width = STAGE_W;
    sp.height = STAGE_H;
    layer.addChild(sp);
    return sp;
  }

  /** A lounge corner is lit once its module exists (AIDA's own order). */
  _zoneLit(id) {
    const st = STATIONS.find(s => s.id === id);
    if (!st || !this._repaired) return false;
    if (st.id === 'core' || st.id === 'exit') return true;
    if (!st.module) return true;
    return buildingLevel(this.save, st.module) > 0;
  }

  /** VFX sit on the painted furniture, not on the walk-plate. */
  _fxPos(st) {
    const pose = furniturePose(st);
    if (pose && this.restoredSprite && this.restoredSprite.alpha > 0.2) {
      return { x: pose.x, y: pose.y - pose.h * 0.28 };
    }
    return anchorOf(st);
  }

  _updateHallArt(dt) {
    const repaired = this._repaired;
    const allLit = repaired && this._allZonesLit();
    if (this.wreckSprite) {
      const target = allLit ? 0 : 1;
      this.wreckSprite.alpha = damp(this.wreckSprite.alpha, target, 2.4, dt);
      this.wreckSprite.visible = this.wreckSprite.alpha > 0.02;
    }
    if (this.restoredSprite) {
      const target = repaired ? 1 : 0;
      this.restoredSprite.alpha = damp(this.restoredSprite.alpha, target, 2.4, dt);
      this.restoredSprite.visible = this.restoredSprite.alpha > 0.02;
    }
    this._syncHallMask();
  }

  /** Load and display the choosable panoramic orbital vista behind the station bay window. */
  async _loadVista(vistaId = 'earth') {
    if (buildingLevel(this.save, 'rampart') < 1) return;
    const vistaMap = {
      earth: '/backgrounds/vista_earth.jpg',
      void: '/backgrounds/vista_void.jpg',
      solstice: '/backgrounds/vista_solstice.jpg',
      bloodmoon: '/backgrounds/vista_bloodmoon.jpg',
      cyber: '/backgrounds/vista_cyber.jpg',
    };
    const url = vistaMap[vistaId] || vistaMap.earth;
    try {
      const tex = await Assets.load(url);
      if (this.destroyed || !this.windowClip) return;
      const r = windowRect();
      if (!this.vistaSprite) {
        this.vistaSprite = new Sprite(tex);
        this.windowClip.addChildAt(this.vistaSprite, 0);
      } else {
        this.vistaSprite.texture = tex;
      }
      this.vistaSprite.x = r.x;
      this.vistaSprite.y = r.y;
      this.vistaSprite.width = r.w;
      this.vistaSprite.height = r.h;
      // The Earth loop is the window. The jpg is only a fallback.
      this.vistaSprite.visible = !this.earthWindowSprite;
    } catch (e) {
      console.warn('Could not load vista texture:', url, e);
    }
  }

  setVista(vistaId) {
    if (this.save && this.save.profile) {
      this.save.profile.stationVista = vistaId;
    }
    this._loadVista(vistaId);
  }

  setSave(save) {
    const prevVista = this.save && this.save.profile && this.save.profile.stationVista;
    const prevHall = this.save ? buildingLevel(this.save, 'rampart') : 0;
    this.save = save || {};
    const newVista = (this.save && this.save.profile && this.save.profile.stationVista) || 'earth';
    const hall = buildingLevel(this.save, 'rampart');
    if (hall >= 1 && (newVista !== prevVista || prevHall < 1)) {
      this._loadVista(newVista);
    }
    if (ROOM_ART === 'sprites' && !this.sprites) this._loadSprites();
    const key = this._stateKey ? this._stateKey() : null;
    if (key && key !== this._builtKey && this._paintStatic) this._paintStatic();
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
    // The lounge paintings are already moody. The 0.50 rim on top of them
    // crushed the wreck to a black diamond (looked at 2026-09-16).
    const painted = !!(this.wreckSprite || this.restoredSprite);
    const rim = painted ? 0.22 : 0.50;
    const mid = painted ? 0.05 : 0.10;
    const g = this.gVignette;
    g.clear();
    g.rect(0, 0, STAGE_W, STAGE_H).fill(new FillGradient({
      type: 'radial',
      textureSpace: 'global',
      center: { x: STAGE_W / 2, y: STAGE_H * 0.52 }, innerRadius: STAGE_H * 0.34,
      outerCenter: { x: STAGE_W / 2, y: STAGE_H * 0.52 }, outerRadius: STAGE_H * 0.98,
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 0.70, color: `rgba(2,6,10,${mid})` },
        { offset: 1, color: `rgba(1,3,6,${rim})` },
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

    this._bloom = bloom;
    this._grade = grade;
    this.root.filters = [bloom, grade];
    // The root is filtered EVERY frame and its bounds are known exactly — they
    // are the authored stage. Setting filterArea skips a per-frame
    // getGlobalBounds() over the whole display list.
    this.root.filterArea = new Rectangle(0, 0, STAGE_W, STAGE_H);
    this._applyCozyGrade();
  }

  /** 0 = dusty wreck, 1 = every module built and the hall is a home. */
  _cozy01() {
    if (!isStationRepaired(this.save)) return 0;
    const mods = STATIONS.filter(s => s.module);
    let n = 0;
    for (const st of mods) if (buildingLevel(this.save, st.module) > 0) n++;
    return hallCozy01(true, n, mods.length);
  }

  _stationHasSprite(st) {
    const key = sheetKeyForStation(st);
    return !!(this.sheets && key && this.sheets[key]);
  }

  /** The people-free lounge painting is on. Stickers, cables and extra
   *  bloom sit ON TOP of that picture and read as bugs, not as mix. */
  _loungeUp() {
    return !!(this.restoredSprite && this.restoredSprite.visible
      && this.restoredSprite.alpha > 0.22 && !this.restoredSprite.mask);
  }

  /** Either hall painting is covering the room — wreck or lounge. */
  _paintedHall() {
    const wreck = this.wreckSprite && this.wreckSprite.visible && this.wreckSprite.alpha > 0.35;
    const lounge = this.restoredSprite && this.restoredSprite.visible && this.restoredSprite.alpha > 0.22;
    return !!(wreck || lounge);
  }

  _allZonesLit() {
    return Object.keys(RESTORE_ZONES).every(id => this._zoneLit(id));
  }

  /** Lounge stays fully painted after AIDA wakes the hall. Unbuilt modules
   *  get a dark veil — never a punch-out mask that left four lit rectangles
   *  on a black void when the wreck sheet was missing or too dark. */
  _syncHallMask() {
    const restored = this.restoredSprite;
    if (restored) restored.mask = null;
    if (this.restoreMask) {
      this.restoreMask.clear();
      this.restoreMask.visible = false;
    }
    const veil = this.restoreVeil;
    if (!veil) return;
    veil.clear();
    // AIDA wakes the whole lounge. The old patches were stage-sized rects;
    // stacked on the grade they read as one lit rectangle and a black room.
    // Unbuilt modules stay marked on their own doors, not as black slabs.
    veil.visible = false;
  }

  _applyCozyGrade() {
    if (!this._bloom) return;
    const c = this._cozy01();
    const painted = !!(this.wreckSprite || this.restoredSprite);
    const lounge = this._loungeUp();
    const key = `${c.toFixed(2)}|${painted ? 1 : 0}|${lounge ? 1 : 0}`;
    if (key === this._cozyGradeKey) return;
    this._cozyGradeKey = key;
    const grade = new ColorMatrixFilter();
    // Paintings already carry the wreck/lounge mood. The drawn-hall grade
    // (brightness 0.90, saturate -0.16) on top of them reads as a black void.
    if (painted) {
      grade.brightness(lerp(1.22, 1.14, c), false);
      grade.contrast(lerp(0.52, 0.53, c), true);
      grade.saturate(lerp(0.08, 0.10, c), true);
      this._bloom.threshold = lounge ? 0.84 : 0.72;
      this._bloom.bloomScale = lounge ? 0.32 : 0.55;
      this._bloom.brightness = lounge ? 0.90 : 0.96;
    } else {
      grade.brightness(lerp(0.90, 1.14, c), false);
      grade.contrast(lerp(0.50, 0.56, c), true);
      grade.saturate(lerp(-0.16, 0.18, c), true);
      this._bloom.threshold = 0.66;
      this._bloom.bloomScale = 1.10;
      this._bloom.brightness = 1.0;
    }
    grade.resolution = 'inherit';
    this._grade = grade;
    this.root.filters = [this._bloom, grade];
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
    if (this.bleed) {
      this.bleed.clear();
      this.bleed.rect(-8, -8, w + 16, h + 16).fill(0x1a242c);
    }
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

    // The paintings ARE the room. Drawing the box-hall under them was how
    // dark door plates and floor slabs showed through as black blocks.
    if (this.wreckSprite || this.restoredSprite) {
      const wreckUp = this.wreckSprite && this.wreckSprite.alpha > 0.2;
      const loungeUp = this.restoredSprite && this.restoredSprite.alpha > 0.2;
      if (wreckUp || loungeUp) {
        this._applyCozyGrade();
        this._builtKey = this._stateKey();
        return;
      }
    }

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

    // ── Grime, cracks and debris — fades as the hall becomes a home ─
    const cozy = this._cozy01();
    const mess = 1 - cozy;
    if (mess > 0.04) {
      const stains = Math.round(14 * mess);
      for (let i = 0; i < stains; i++) {
        const x = FLOOR.x0 + noise(i * 41 + 3) * FLOOR_W;
        const y = FLOOR.y0 + noise(i * 23 + 11) * FLOOR_H;
        const r = 5 + noise(i * 19) * 16;
        g.ellipse(x, y, r, r * 0.55).fill({ color: 0x1c2830, alpha: (0.10 + noise(i * 7) * 0.10) * mess });
      }
      const cracks = Math.round(5 * mess);
      for (let c = 0; c < cracks; c++) {
        let x = FLOOR.x0 + noise(c * 97 + 13) * FLOOR_W;
        let y = FLOOR.y0 + noise(c * 53 + 29) * FLOOR_H;
        g.moveTo(x, y);
        for (let k = 0; k < 7; k++) {
          x += (noise(c * 100 + k * 9) - 0.5) * 46;
          y += (noise(c * 100 + k * 9 + 5) - 0.5) * 34;
          g.lineTo(x, y);
        }
        g.stroke({ width: 1.2, color: 0x243038, alpha: 0.28 * mess });
      }
      if (!rep) {
        // Knocked-over crates only while it is still a wreck. After the
        // repair they would read as "you never cleaned", which is the
        // opposite of the dusty → cosy arc.
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
      }
    }
    if (cozy > 0.38) {
      this._paintPlant(g, FLOOR.x0 + 44, FLOOR.y0 + 40);
    }
    this._applyCozyGrade();

    // ── Doors and consoles ──────────────────────────────────────────
    for (const st of STATIONS) this._paintStation(g, st, rep);

    this._builtKey = this._stateKey();
  }

  _paintWindow(g, cx, cy, hw, hh, rep) {
    // Aperture & Frame outline
    g.rect(cx - hw, cy - hh / 2, hw * 2, hh).stroke({ width: 3, color: rep ? 0x54808f : 0x2a3d46 });
    g.rect(cx - hw - 4, cy - hh / 2 - 4, hw * 2 + 8, hh + 8).stroke({ width: 2, color: rep ? 0x2e4d59 : 0x1b2830, alpha: 0.8 });
  }

  /** Dynamic Panoramic Space Observation Bay (Rotating Earth, Parallax Starfield, Spacecraft, Animated Blast Shutters) */
  _updateLiveWindow(dt) {
    if (!this.gWindowLive) return;
    const g = this.gWindowLive;
    g.clear();
    // Paintings already have the bay. Drawn shutters on top of them (or
    // bleeding through a half-alpha wreck) read as black plates in the sky.
    if (this._paintedHall()) return;
    const rep = this._repaired;
    const BW_Y = FLOOR.y0 - BACK_FACE;
    const cx = WINDOW.cx, cy = BW_Y + BACK_FACE / 2;
    const hw = WINDOW.hw, hh = BACK_FACE - 10;
    const x0 = cx - hw, y0 = cy - hh / 2;

    // Target shutter opening: the window stays sealed until the Main Hall
    // exists. There is no `interior` building — Gemini left that field dead
    // and the blast doors never moved. Rampart IS the hall.
    const hall = this.save ? buildingLevel(this.save, 'rampart') : 0;
    const targetShutter = (rep && hall >= 1) ? 1.0 : 0.0;
    
    // Smooth damp towards target
    if (this._shutterProgress == null) this._shutterProgress = targetShutter;
    this._shutterProgress = damp(this._shutterProgress, targetShutter, 2.2, dt);
    const shutter = this._shutterProgress;

    // Earth-in-the-window sheet covers the glass. Hardcoded globe is the
    // fallback when the sheet is missing or the shutters are still sealed.
    const spriteEarth = !!(this.earthWindowSprite && this.earthWindowSprite.visible
      && shutter > 0.18);

    if (!spriteEarth) {
    // 1. Deep Space Void Fill
    g.rect(x0, y0, hw * 2, hh).fill({ color: 0x010308 });

    // 2. Parallax Twinkling Stars & Deep Nebula
    for (let i = 0; i < 42; i++) {
      const sx = x0 + 4 + (((noise(i * 43 + 1) * (hw * 2 - 8) - this.t * (1.2 + (i % 3) * 0.8)) % (hw * 2 - 8) + (hw * 2 - 8)) % (hw * 2 - 8));
      const sy = y0 + 4 + noise(i * 67 + 9) * (hh - 8);
      const twinkle = 0.35 + Math.sin(this.t * 2.5 + i * 1.7) * 0.40;
      const starCol = i % 5 === 0 ? 0x9be8ff : i % 7 === 0 ? 0xffdfa4 : 0xdff4ff;
      g.circle(sx, sy, 0.4 + (i % 4 === 0 ? 0.9 : 0.4)).fill({ color: starCol, alpha: twinkle });
    }

    // 3. Dynamic Rotating Earth
    const er = hh * 0.44;
    const ex = cx + hw * 0.36;
    const ey = cy + 2;

    // Atmospheric outer glow
    g.circle(ex, ey, er * 1.08).fill({ color: 0x4fc8ff, alpha: 0.18 });
    g.circle(ex, ey, er * 1.03).fill({ color: 0x7fd8ff, alpha: 0.32 });
    // Ocean base
    g.circle(ex, ey, er).fill({ color: 0x164c6e });

    // Continents rotating across surface
    const rot = (this.t * 0.04) % 1.0;
    for (let c = 0; c < 3; c++) {
      const cOffset = (c / 3.0 + rot) % 1.0;
      const cLon = (cOffset - 0.5) * 2.0; // -1 to 1 across globe
      if (Math.abs(cLon) < 0.88) {
        const cX = ex + cLon * er * 0.85;
        const cW = er * 0.45 * (1.0 - Math.abs(cLon) * 0.5);
        const cH = er * 0.38;
        const cY = ey + (c === 0 ? -er * 0.15 : c === 1 ? er * 0.18 : 0);
        g.ellipse(cX, cY, cW, cH).fill({ color: 0x2d8a70, alpha: 0.72 });
      }
    }

    // Cloud swirls
    const cloudRot = (this.t * 0.055) % 1.0;
    for (let k = 0; k < 4; k++) {
      const kLon = ((k / 4.0 + cloudRot) % 1.0 - 0.5) * 2.0;
      if (Math.abs(kLon) < 0.9) {
        const kX = ex + kLon * er * 0.88;
        const kY = ey + Math.sin(k * 2.1) * er * 0.3;
        g.ellipse(kX, kY, er * 0.35, er * 0.12).fill({ color: 0xffffff, alpha: 0.42 });
      }
    }

    // Planetary Terminator Shadow (Left side shadowed)
    g.ellipse(ex - er * 0.35, ey, er * 0.85, er * 1.02).fill({ color: 0x040c14, alpha: 0.55 });
    // Specular Rim Light
    g.circle(ex, ey, er).stroke({ width: 1.4, color: 0xa6e8ff, alpha: 0.65 });

    // 4. Distant Cargo Freighter Gliding
    const shipProgress = (this.t * 0.035) % 1.4;
    if (shipProgress < 1.0) {
      const sx = x0 + 10 + shipProgress * (hw * 2 - 20);
      const sy = y0 + 14 + Math.sin(shipProgress * Math.PI) * 4;
      g.rect(sx - 4, sy - 1.5, 8, 3).fill({ color: 0x8fa6b2, alpha: 0.85 });
      // Nav beacon flash
      const beacon = Math.sin(this.t * 8.0) > 0.3 ? 0.9 : 0.1;
      g.circle(sx - 3, sy, 1.2).fill({ color: 0x4dff91, alpha: beacon });
      g.circle(sx + 3, sy, 1.2).fill({ color: 0xff4d6d, alpha: beacon });
    }
    }

    // 5. Blast Shutters (Armored plates that slide open/close)
    if (shutter < 0.99) {
      const closeAmt = (1.0 - shutter);
      const shutH = (hh / 2) * closeAmt + 2;

      // Top Shutter Leaf
      g.rect(x0, y0, hw * 2, shutH).fill({ color: 0x0c1a24 });
      g.rect(x0, y0, hw * 2, shutH).stroke({ width: 1.5, color: 0x2d4855 });
      // Bottom Shutter Leaf
      g.rect(x0, y0 + hh - shutH, hw * 2, shutH).fill({ color: 0x0c1a24 });
      g.rect(x0, y0 + hh - shutH, hw * 2, shutH).stroke({ width: 1.5, color: 0x2d4855 });

      // Hazard Stripes along leading edges
      const stripeW = 12;
      const count = Math.ceil((hw * 2) / stripeW);
      for (let s = 0; s < count; s++) {
        if (s % 2 === 0) {
          const sx = x0 + s * stripeW;
          g.rect(sx, y0 + shutH - 4, stripeW, 4).fill({ color: 0xffb703, alpha: 0.85 });
          g.rect(sx, y0 + hh - shutH, stripeW, 4).fill({ color: 0xffb703, alpha: 0.85 });
        }
      }

      // Hydraulic Lock Seal Light in center
      const lockCol = shutter > 0.05 ? 0xffbe0b : 0xff4d6d;
      g.circle(cx, cy, 5).fill({ color: lockCol, alpha: 0.85 });
    }

    // 6. Specular Glass Sheen & Hexagonal Micro-Reinforcement Grid
    g.poly([x0 + 10, y0 + hh - 4, x0 + 35, y0 + 4, x0 + 55, y0 + 4, x0 + 30, y0 + hh - 4])
      .fill({ color: 0xffffff, alpha: 0.08 });
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

    // Built + a furniture sheet: keep the hole, skip the drawn console so the
    // sprite is not sitting on a second copy of itself.
    if (this._stationHasSprite(st) && live) {
      g.rect(x0 + 4, y0 - 4, p.w - 8, 4).fill({ color: col, alpha: 0.95 });
      return;
    }

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
    if (this._stationHasSprite(st) && rep) return;
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
    // The lounge painting already has floor conduits. Drawn L-cables on
    // top of it look like debug lines.
    if (this._paintedHall()) return;
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
    if (Audio.stationInteract) Audio.stationInteract(st.id);
    else if (Audio.menuOpen) Audio.menuOpen();
    this.onEnter(st);
    return st;
  }

  /** CLEAN & REPAIR, done standing in the middle of the room.
   *  It calls the SAME save transform the module list calls — game/base.js's
   *  repairStation — via the onRepair callback. There is no second repair. */
  startRepair() {
    if (this._repaired || this._sweepT != null) return;
    this._sweepT = 0;
    if (Audio.campSparks) Audio.campSparks();
    if (Audio.campSteam) Audio.campSteam();
  }

  /** High-speed hydro-dash evasion / speed burst */
  dash() {
    if (this._dashCooldown > 0 || this._dashT > 0) return;
    this._dashT = 0.28;
    this._dashCooldown = 0.65;

    let dirX = this.vx, dirY = this.vy;
    if (Math.hypot(dirX, dirY) < 10) {
      dirX = Math.cos(this.gait.facingAngle != null ? this.gait.facingAngle : (Math.PI / 2));
      dirY = Math.sin(this.gait.facingAngle != null ? this.gait.facingAngle : (Math.PI / 2));
    }
    const mag = Math.hypot(dirX, dirY) || 1;
    this._dashDirX = dirX / mag;
    this._dashDirY = dirY / mag;

    if (Audio.heroDash) Audio.heroDash();
    else if (Audio.dodgeRoll) Audio.dodgeRoll();
  }

  /** Trigger victory cheer animation */
  cheer(dur = 1.2) {
    this._cheerT = dur;
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
    this._updateLiveWindow(dt);
    this._updateHallArt(dt);
    this._paintLive(dt);
    this._paintRipplesAndGhosts(dt);
    this._updateSprites(dt);
    this._drawHero();
    this._updateDust(dt);
  }

  _paintRipplesAndGhosts(dt) {
    // 1. Floor Water Ripples
    const gr = this.gRipples;
    gr.clear();
    for (let i = this._floorRipples.length - 1; i >= 0; i--) {
      const rp = this._floorRipples[i];
      rp.life += dt;
      if (rp.life >= rp.maxLife) {
        this._floorRipples.splice(i, 1);
        continue;
      }
      const u = rp.life / rp.maxLife;
      const curR = lerp(rp.r, rp.maxR, u);
      const alpha = (1 - u) * rp.alpha;
      gr.ellipse(rp.x, rp.y, curR, curR * 0.45)
        .stroke({ width: 1.4 * (1 - u * 0.5), color: rp.col, alpha });
      if (u < 0.4) {
        gr.ellipse(rp.x, rp.y, curR * 0.5, curR * 0.22)
          .stroke({ width: 1, color: 0xffffff, alpha: (1 - u / 0.4) * 0.6 });
      }
    }

    // 2. Dash Motion Ghost Trail
    const gg = this.gDashGhosts;
    gg.clear();
    for (let i = this._dashGhosts.length - 1; i >= 0; i--) {
      const gh = this._dashGhosts[i];
      gh.life += dt;
      if (gh.life >= gh.maxLife) {
        this._dashGhosts.splice(i, 1);
        continue;
      }
      const u = gh.life / gh.maxLife;
      const alpha = (1 - u) * gh.alpha;
      const r = HERO_R;
      gg.ellipse(gh.x, gh.y - r * 0.7, r * 0.95, r * 1.1)
        .fill({ color: 0x5fd6ff, alpha: alpha * 0.35 });
      gg.ellipse(gh.x, gh.y - r * 0.7, r * 0.95, r * 1.1)
        .stroke({ width: 1.2, color: 0x9fe8ff, alpha: alpha * 0.65 });
    }
  }

  _updateSweep(dt) {
    if (this._sweepT == null) return;
    const prevT = this._sweepT;
    this._sweepT += dt;

    // Relay 1 (0.4s): BONG 1 & Sparks
    if (prevT < 0.4 && this._sweepT >= 0.4) {
      if (Audio.powerRelay) Audio.powerRelay(0);
      if (Audio.campSparks) Audio.campSparks();
    }
    // Relay 2 (0.8s): BONG 2 & Dust Burst
    if (prevT < 0.8 && this._sweepT >= 0.8) {
      if (Audio.powerRelay) Audio.powerRelay(1);
    }
    // Relay 3 (1.2s): BONG 3 & Full Room Light Surge
    if (prevT < 1.2 && this._sweepT >= 1.2) {
      if (Audio.powerRelay) Audio.powerRelay(2);
      if (Audio.campSteam) Audio.campSteam();
      if (Audio.aidaVoice) Audio.aidaVoice('proud');
      if (Audio.stationBuild) Audio.stationBuild();
      this.onRepair();
      this._repaired = true;
      this._paintStatic();
      if (ROOM_ART === 'sprites' && !this.sprites) this._loadSprites();
    }
    if (this._sweepT > 1.8) this._sweepT = null;
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

    // Handle Active Dash
    if (this._dashT > 0) {
      this._dashT -= dt;
      const dashSpeed = WALK_SPEED * 2.8;
      this.vx = this._dashDirX * dashSpeed;
      this.vy = this._dashDirY * dashSpeed;

      if (Math.random() < 0.5) {
        this._floorRipples.push({
          x: this.px,
          y: this.py + HERO_R * 1.2,
          r: 6,
          maxR: 32,
          life: 0,
          maxLife: 0.75,
          col: 0x9fe8ff,
          alpha: 0.75,
        });
      }
      this._dashGhosts.push({
        x: this.px + this.wobX,
        y: this.py + HERO_R * 1.5,
        life: 0,
        maxLife: 0.28,
        alpha: 0.55,
      });
      if (this._dashGhosts.length > 8) this._dashGhosts.shift();
    } else {
      // Accelerate hard, decelerate softer
      this.vx = damp(this.vx, targetVX, mag > 0 ? 13 : 8, dt);
      this.vy = damp(this.vy, targetVY, mag > 0 ? 13 : 8, dt);
    }
    if (this._dashCooldown > 0) this._dashCooldown -= dt;
    if (this._cheerT > 0) this._cheerT -= dt;

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
      if (this.speed01 > 0.25) {
        this._floorRipples.push({
          x: this.px,
          y: this.py + HERO_R * 1.2,
          r: 3,
          maxR: 16,
          life: 0,
          maxLife: 0.65,
          col: 0x5fd6ff,
          alpha: 0.50,
        });
        if (Audio.campFootstep) Audio.campFootstep();
        else if (Audio.casingLand) Audio.casingLand();
      }
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
    const cozy = this._cozy01();
    const lampSheets = this.lampSprites && this.lampSprites.length > 0;

    const lounge = this._loungeUp();
    const painted = this._paintedHall();

    // Ceiling lamps. Two, warm, and only once the power is on. While derelict
    // one of them stutters on a lazy irregular cycle — a steady pulse reads as
    // working, an irregular one reads as giving up. The pooled lights always
    // fire; the drawn bars hide when a lamp sheet is sitting there.
    // The lounge painting already has its own lamps — extra pools bloom the
    // Earth window into a white slab. Same for the wreck painting.
    if (!painted) {
      for (const lx of [FLOOR.x0 + FLOOR_W * 0.24, FLOOR.x0 + FLOOR_W * 0.76]) {
        const ly = FLOOR.y0 + 8;
        if (rep) {
          const flick = 0.94 + Math.sin(this.t * 3.1 + lx) * 0.06;
          if (!lampSheets) g.rect(lx - 62, ly - 6, 124, 6).fill({ color: 0xd8f2ff, alpha: 0.75 * flick });
          this._light(lx, ly + 96, 330, 0xa8dcf0, (0.20 + cozy * 0.18) * flick);
        } else {
          const stutter = Math.sin(this.t * 11.7 + lx) > 0.78 ? 0.9 : 0.08;
          g.rect(lx - 62, ly - 6, 124, 6).fill({ color: 0x7a93a0, alpha: 0.26 * stutter });
          this._light(lx, ly + 70, 210, 0x6d8fa0, 0.14 * stutter);
        }
      }

      if (rep) this._light(WINDOW.cx, FLOOR.y0 + FLOOR_H * 0.55, 430, 0x7fb8d0, 0.08 + cozy * 0.08);

      const hall = this.save ? buildingLevel(this.save, 'rampart') >= 1 : false;
      this._light(WINDOW.cx, FLOOR.y0 + 46, rep ? 280 : 190, 0x5fa8d8, hall && rep ? 0.28 : (rep ? 0.16 : 0.12));

      for (const st of STATIONS) {
        if (st.side === 'centre') continue;
        const built = st.module ? buildingLevel(this.save, st.module) > 0 : true;
        const live = rep && built;
        const fx = this._fxPos(st);
        if (st.id === 'exit') {
          this._light(fx.x, fx.y + 14, 120, 0x4dff91, 0.22 + Math.sin(this.t * 1.7) * 0.03);
          continue;
        }
        if (!live) continue;
        const col = hex(ACCENT(st));
        const breathe = 0.30 + Math.sin(this.t * 1.35 + fx.x * 0.01) * 0.05;
        this._light(fx.x, fx.y - (st.side === 'top' ? 22 : st.side === 'bottom' ? -18 : 0), 165, col, breathe);

        if (st.module === 'forge') {
          for (let e = 0; e < 4; e++) {
            const ep = ((this.t * 1.2 + e * 0.25) % 1.0);
            const ex = fx.x + Math.sin(this.t * 3.0 + e * 1.5) * 12;
            const ey = fx.y - 10 - ep * 24;
            g.circle(ex, ey, 1.5 * (1 - ep)).fill({ color: 0xff9a3c, alpha: (1 - ep) * 0.85 });
          }
        } else if (st.module === 'well') {
          for (let b = 0; b < 3; b++) {
            const bp = ((this.t * 0.9 + b * 0.33) % 1.0);
            const bx = fx.x + Math.sin(this.t * 2.2 + b * 2.0) * 10;
            const by = fx.y - 8 - bp * 20;
            g.circle(bx, by, 1.2 * (1 - bp)).fill({ color: 0x38bdf8, alpha: (1 - bp) * 0.75 });
          }
        } else if (st.module === 'incubator') {
          for (let s = 0; s < 3; s++) {
            const sang = this.t * 1.8 + (s / 3.0) * TAU;
            const sx = fx.x + Math.cos(sang) * 14;
            const sy = fx.y - 18 + Math.sin(sang) * 6;
            g.circle(sx, sy, 1.3).fill({ color: 0x4ade80, alpha: 0.85 });
          }
        } else if (st.module === 'rampart') {
          const radarAng = this.t * 2.2;
          g.moveTo(fx.x, fx.y - 16).lineTo(fx.x + Math.cos(radarAng) * 18, fx.y - 16 + Math.sin(radarAng) * 18)
            .stroke({ width: 1.2, color: 0xf43f5e, alpha: 0.65 });
        }
      }
    } else if (rep) {
      this._light(WINDOW.cx, FLOOR.y0 + 90, 220, 0x8ec8e0, 0.06);
    }

    // The core & A.I.D.A. Holographic Companion
    const core = anchorOf(STATIONS.find(s => s.id === 'core'));
    if (rep && !lounge) {
      // A slow internal light with a second, faster component under it
      const pulse = 0.34 + Math.sin(this.t * 1.1) * 0.10 + Math.sin(this.t * 2.9) * 0.04;
      this._light(core.x, core.y - 20, 130, 0x7fd8ff, pulse);
      g.circle(core.x, core.y - 20, 5 + Math.sin(this.t * 2.4) * 1.2).fill({ color: 0xdff4ff, alpha: 0.9 });
      
      // Floating Holographic Torus Ring & Orbiting Data Nodes
      const holoY = core.y - 36 + Math.sin(this.t * 1.8) * 3.5;
      g.ellipse(core.x, holoY, 18, 5.5).stroke({ width: 1.5, color: 0x5fd6ff, alpha: 0.75 });
      g.ellipse(core.x, holoY, 12, 3.5).stroke({ width: 1, color: 0xa6e8ff, alpha: 0.45 });
      
      for (let n = 0; n < 4; n++) {
        const nang = this.t * 2.0 + (n / 4.0) * TAU;
        const nx = core.x + Math.cos(nang) * 18;
        const ny = holoY + Math.sin(nang) * 5.5;
        g.circle(nx, ny, 1.6).fill({ color: 0xdff4ff, alpha: 0.9 });
      }

      // Her eye, when she is looking at you. It tracks the player
      const ex = clamp((this.px - core.x) / 260, -1, 1) * 4;
      const ey = clamp((this.py - core.y) / 200, -1, 1) * 2.5;
      g.ellipse(core.x + ex, core.y - 20 + ey, 2.2, 3.4).fill({ color: 0x04202c, alpha: 0.85 });
    } else if (!rep) {
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

    // No legs — same drop as combat. Gait still drives bob/lean/weight.
    this.gLegBack.clear();
    this.gLegFront.clear();

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

    const gf = this.gFace;
    gf.clear();
    drawHeroFace(gf, bx, by - bob, r, lean, sqx, sqy, A, null);
    const band = (this.save && this.save.cosmetics && this.save.cosmetics.headbandColor) || '#d1394a';
    drawHeadband(gf, bx, by - bob, r, band, { sqx, sqy, lean });

    const aim = this.nearest
      ? Math.atan2(anchorOf(this.nearest).y - (by - bob), anchorOf(this.nearest).x - bx)
      : (Math.hypot(this.vx, this.vy) > 8 ? Math.atan2(this.vy, this.vx) : (this.faceX >= 0 ? 0 : Math.PI));
    const gx = bx + Math.cos(aim) * r * 0.95;
    const gy = (by - bob) + Math.sin(aim) * r * 0.35;
    drawArms(gf, { x: bx, y: by - bob }, lean, r, gx, gy, aim, null, bx, by - bob);
    drawHeldWeapon(gf, STATION_RIB, gx, gy, aim, {}, { recoil: 0 }, {});
  }

  /** Advance furniture sheets. The hero is drawn in code, not from a sheet. */
  _updateSprites(dt) {
    if (!this.sprites) return;
    const cozy = this._cozy01();
    const hall = this.save ? buildingLevel(this.save, 'rampart') >= 1 : false;
    const shutter = this._shutterProgress == null ? (hall ? 1 : 0) : this._shutterProgress;
    this._furnLive = this._furnLive || {};
    this._furnPop = this._furnPop || {};

    for (const { sp, st, pose, native } of this.sprites) {
      const built = st.module ? buildingLevel(this.save, st.module) > 0 : this._repaired;
      const live = built && this._repaired;
      const id = st.id;
      if (live && !this._furnLive[id]) this._furnPop[id] = 0;
      this._furnLive[id] = live;
      const show = live && !this._paintedHall();
      sp.visible = show;
      sp.animated = live;
      sp.tint = live ? 0xffffff : 0x4a5a68;
      sp.alpha = live ? 1 : 0;
      if (live) {
        this._furnPop[id] = Math.min(1, (this._furnPop[id] || 0) + dt / 0.28);
        const u = this._furnPop[id];
        const bounce = 1 + Math.sin(u * Math.PI) * 0.16 * (1 - u);
        const s = ((pose && pose.h) || 56) / (native || 128);
        sp.scale.set(s * (0.72 + 0.28 * u) * bounce);
        sp.advance(dt);
      }
    }

    if (this.emblemSprite) {
      this.emblemSprite.visible = this._repaired;
      this.emblemSprite.alpha = this._repaired ? 0.55 + cozy * 0.45 : 0;
      if (this._repaired) this.emblemSprite.advance(dt);
    }

    if (this.floorSprite) {
      this.floorSprite.visible = this._repaired;
      this.floorSprite.alpha = cozy * 0.40;
    }

    if (this.lampSprites) {
      for (const sp of this.lampSprites) {
        sp.visible = this._repaired;
        sp.alpha = this._repaired ? 0.22 + cozy * 0.55 : 0;
        if (this._repaired) sp.advance(dt);
      }
    }

    if (this.earthWindowSprite) {
      const show = this._repaired && hall && shutter > 0.18;
      this.earthWindowSprite.visible = show;
      this.earthWindowSprite.alpha = show ? shutter : 0;
      if (show) this.earthWindowSprite.advance(dt);
    }
    if (this.vistaSprite) {
      this.vistaSprite.visible = hall && this._repaired && !this.earthWindowSprite && !this.restoredSprite;
    }
  }

  _updateDust(dt) {
    const cozy = this._cozy01();
    const shown = Math.round(lerp(this.dust.length, 5, cozy));
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      d.x += (d.vx + Math.sin(this.t * 0.7 + d.ph) * 5) * dt;
      d.y += d.vy * dt;
      if (d.y < FLOOR.y0 - 40) { d.y = FLOOR.y1 + 20; d.x = FLOOR.x0 + Math.random() * FLOOR_W; }
      if (d.x < FLOOR.x0 - 20) d.x = FLOOR.x1 + 10;
      if (d.x > FLOOR.x1 + 20) d.x = FLOOR.x0 - 10;
      d.s.x = d.x; d.s.y = d.y;
      d.s.scale.set(d.r / this._lightTexR);
      // Filthy air while derelict; motes thin out as the hall becomes a home.
      d.s.alpha = lerp(0.22, 0.045, cozy) * (0.55 + Math.sin(this.t * 1.6 + d.ph) * 0.45);
      d.s.visible = i < shown;
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



  destroy() {
    this.destroyed = true;
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (typeof window !== 'undefined' && window.__station === this) delete window.__station;
    if (this.app) { this.app.destroy(true, { children: true }); this.app = null; }
  }
}

// The floor plan re-exported so callers need only one import. Its home is
// stationLayout.js; this is a convenience, not a second definition.
export { STATIONS, FLOOR, anchorOf, plateOf, furniturePose, windowRect, HERO_R, STAGE_W, STAGE_H } from './stationLayout';
