// Waterdrop Survivor — THE INTRO FILM.
//
// A hardcoded, fully procedural PixiJS cinematic. No image assets, no video —
// every tree, ripple, bird and ember below is drawn in code, same as the rest
// of this project.
//
// ── WHY A FIXED 960x540 STAGE ────────────────────────────────────────
// The whole film is authored against ONE virtual resolution and then scaled to
// fit whatever screen it lands on. That is a deliberate departure from the
// game, which shows MORE WORLD on a bigger screen — and which cost a long
// debugging session on 2026-08-17 when five separate draw sites turned out to
// be treating CSS pixels as world units, all invisible on the phone because the
// phone is the one device where the game's zoom clamps to exactly 1.
// See waterdrop-desktop-mobile-parity in memory.
//
// A film has no reason to inherit that problem. Composition is the point: the
// lake sits where it was framed, the UFO enters where it was aimed, and the shot
// reads identically on a 393px phone and a 1440px monitor. Everything below is
// in stage units and nothing needs to know the real viewport.
//
// ── STRUCTURE ────────────────────────────────────────────────────────
// `BEATS` is the script. The runner advances a clock, hands each beat a
// normalised 0..1 `bt`, and every scene function paints against that. There was
// no timeline/cutscene/tween system anywhere in this codebase to reuse
// (checked), so this file brings its own small one — deliberately small.
//
// Static geometry (sky, forest bands, shoreline) is drawn ONCE into its own
// Graphics and then only ever transformed. Only genuinely moving things — water
// glitter, the fish, the bird, motes — are cleared and repainted per frame.
// That is what keeps the framerate where Timmy asked for it.
import { Application, Container, Graphics, Sprite, Texture, FillGradient, ColorMatrixFilter, Text, TextStyle } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { Audio } from './audio';
// THE SAME CHARACTER THE RUN DRAWS — not a lookalike. Timmy: 'tänk på göra han
// som han är ingame de måste se lika ut.' heroShape.js is the one silhouette
// and heroDraw.js is the face rig the renderer itself uses; both are imported
// rather than re-drawn. A second hand-drawn hero would drift from the real one
// within a session — exactly what happened to the OLD intro.
import { heroHalfPoints } from './heroShape';
import { drawHeroFace } from './heroDraw';
import { EXPRESSIONS } from './heroAnim';

const TAU = Math.PI * 2;

// The authored stage. Everything in this file is in these units.
export const STAGE_W = 960;
export const STAGE_H = 540;

// Waterline: where the lake meets the far shore. Load-bearing — the forest sits
// on it, the reflection mirrors about it, and the fish breaches through it.
const HORIZON = 250;

// ── Easing ───────────────────────────────────────────────────────────
// No tween/easing module exists in this project; the cubic ease-out is
// copy-pasted inline in two components (Camp.jsx's CountUp, GameOverScreen's
// CountTo). Collected here rather than pasting a third and fourth copy.
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
/** 0 at the edges, 1 in the middle — for things that rise and fall in a beat. */
const arch = (t) => Math.sin(clamp01(t) * Math.PI);
/** Deterministic pseudo-random, the same generator cardScenes.js uses. Stable
 *  across rebuilds, so the forest never shimmers between frames. */
const noise = (i) => ((i * 2654435761) >>> 0) / 4294967295;

// ── The script ───────────────────────────────────────────────────────
// Durations in seconds. Timmy's beat 1; the UFO, the sludge and the mutation
// land in the next passes and slot in here.
const BEATS = [
  // The comic-book origin, told in panels that slam onto a black page. It
  // runs FIRST and hands off to the lake it has just described.
  { id: 'comic', dur: 14.6 },
  { id: 'lake', dur: 7.0 },
  { id: 'conspiracy', dur: 8.0 },
  { id: 'space', dur: 11.0 },
  { id: 'fight', dur: 16.0 },
];

/**
 * The intro film.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ onDone?: () => void }} [opts]
 */
export class IntroCinema {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.onDone = opts.onDone || (() => {});
    this.app = null;
    this.destroyed = false;
    this.t = 0;            // seconds since the film started
    this.beatIdx = 0;
    this.beatT = 0;        // seconds into the current beat
    this._fired = {};      // one-shot latches, keyed by name
  }

  async init() {
    const app = new Application();
    this.app = app;
    // devicePixelRatio capped at 2, matching pixiRenderer — past 2 the cost is
    // real and the gain is not visible.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    await app.init({
      canvas: this.canvas,
      width: this.canvas.clientWidth || STAGE_W,
      height: this.canvas.clientHeight || STAGE_H,
      resolution: this.dpr,
      autoDensity: true,
      backgroundColor: 0x05070c,
      antialias: true,
      preference: 'webgl',
    });
    if (this.destroyed) { app.destroy(true); return; }

    // `root` is the scaled stage; everything authored in STAGE units goes
    // inside it and the resize handler does the fitting.
    this.root = new Container();
    app.stage.addChild(this.root);

    this._bakeLightTexture();
    this._buildSky();
    this._buildForest();
    this._buildLake();
    this._buildShore();
    this._buildFauna();
    // Everything above is beat 1. Group it so a beat can be switched off
    // wholesale rather than every builder learning about visibility.
    this.sceneLake = new Container();
    while (this.root.children.length) this.sceneLake.addChild(this.root.children[0]);
    this.root.addChild(this.sceneLake);
    // Built after sceneLake so the comic page sits ON TOP of it in the
    // display list; the runner then shows exactly one of them per beat.
    this._buildComic();
    this._buildConspiracy();
    this._buildSpace();
    this._buildFight();
    this._buildGrade();

    // ── THE PICTURE, not the light ─────────────────────────────────
    // The scene above paints flat on its own. The game's world carries an
    // AdvancedBloomFilter plus a ColorMatrix grade, and without them this film
    // read as washed-out and lifeless next to it — Timmy: "är inte färger inte
    // ljus inte shadaers filter". Bloom is what makes the sun, its glitter path
    // and (later) the neon sludge and the fire actually GLOW rather than just
    // being bright pixels; the grade is what gives the evening its warmth.
    //
    // This is whole-picture grading, which the lighting rules call the correct
    // lever for "the shot needs mood" — it is NOT the forbidden per-sprite glow
    // filter standing in for a light source. Every actual light in this film is
    // still a pooled additive sprite off the baked texture.
    //
    // `threshold` sits above the sky and water so only genuinely hot things
    // bloom; at the game's 0.6 the whole lake fogged over.
    // `resolution: 'inherit'` is NOT optional here. A Filter's resolution
    // defaults to 1, so on a 2x display the bloom and the grade are computed at
    // HALF the screen's pixel density and scaled back up — the glow comes out
    // muddy and soft instead of sharp, which reads as "the effects aren't
    // really there". Costs memory and fill rate; worth it for a film.
    const bloom = new AdvancedBloomFilter({
      threshold: 0.78, bloomScale: 1.15, brightness: 1.0, blur: 5, quality: 4,
      resolution: 'inherit',
    });
    const grade = new ColorMatrixFilter();
    // ColorMatrixFilter ranges are unintuitive and have bitten this project
    // before: contrast() is 0..1 with 0.5 NEUTRAL, saturate() is -1..1 with 0
    // neutral, brightness() is a plain multiplier.
    // TUNED DOWN, hard. The first values (brightness 1.10, contrast 0.58,
    // saturate 0.26) stacked with the vignette below and crushed everything
    // except a thin band at the horizon to pure black — the sky, the whole
    // lake and the reeds all disappeared. contrast() is 0..1 with 0.5 NEUTRAL,
    // so 0.58 is a much bigger push than it looks, and it multiplies onto the
    // brightness matrix applied just before it.
    grade.brightness(1.04, true);
    grade.contrast(0.52, true);
    grade.saturate(0.30, true);
    grade.resolution = 'inherit';
    // ONE dial for how much grade to apply. `ColorMatrixFilter.alpha` blends
    // between the original and the transformed picture, which is a far safer
    // control than guessing at contrast values whose neutral point is 0.5 and
    // which multiply onto each other. Turn this down first if the shot ever
    // goes heavy again; reach for the matrix values second.
    grade.alpha = 0.85;
    this.root.filters = [bloom, grade];

    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);

    app.ticker.add(this._tick, this);

    // Dev handle, same pattern as the engine's `window.__game`. A film is built
    // by looking at single frames, and at 60fps a nine-second beat is gone
    // before a screenshot round-trip finishes — so it needs to be scrubbable:
    //   __cine.seek(6.2)   jump to a moment and freeze there
    //   __cine.play()      run again
    // Costs nothing in production and makes every remaining beat reviewable.
    if (typeof window !== 'undefined') window.__cine = this;
  }

  /** Jump to `sec` within the current beat and hold there. */
  seek(sec) {
    this.beatT = sec;
    this.t = sec;
    this._fired = {};              // let one-shots fire again from here
    if (this.app) { this._tick({ deltaMS: 16.7 }); this.app.ticker.stop(); }
    return this;
  }

  /** Resume after a seek. */
  play() { if (this.app) this.app.ticker.start(); return this; }

  // ── Light texture ──────────────────────────────────────────────────
  // One baked soft-radial, reused by every additive light in the film (sun
  // glow, fireflies, and later the UFO lamps, the neon sludge and the cigar
  // ember). This is the project's approved lighting technique — pooled additive
  // sprites off a baked texture, never a per-frame vector circle and never a
  // community GlowFilter. See the waterdrop-lighting skill.
  _bakeLightTexture() {
    const R = 64;
    const g = new Graphics();
    g.circle(R, R, R).fill(new FillGradient({
      type: 'radial',
      // Coordinates below are absolute STAGE units, so the gradient must be
      // resolved in global space. Pixi v8 defaults FillGradient to
      // textureSpace 'local', which normalises stops into the shape's own
      // 0..1 bounds — absolute values then fall outside the range and the
      // whole fill collapses to one flat colour. That is exactly what went
      // wrong first time: the lake rendered as a single grey slab and the sun
      // glow as a hard disc. Timmy, seeing it: "Ja a farg a ljus".
      textureSpace: 'global',
      center: { x: R, y: R }, innerRadius: 0,
      outerCenter: { x: R, y: R }, outerRadius: R,
      // ALPHA GOES IN THE COLOUR, not in a sibling `alpha` key.
      // A gradient colour stop in Pixi v8 is `{ offset, color }` and nothing
      // else — an `alpha` property next to it is silently dropped. The first
      // version of this file wrote `{ offset, color: 0xffffff, alpha: 0 }` and
      // got a fully OPAQUE stop, which turned the vignette below into a solid
      // black sheet over the whole film and the light into a hard white disc.
      // `ColorSource` accepts CSS strings, so rgba() is how a stop carries
      // transparency.
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,1)' },
        { offset: 0.35, color: 'rgba(255,255,255,0.42)' },
        { offset: 1, color: 'rgba(255,255,255,0)' },
      ],
    }));
    this.lightTex = this.app.renderer.generateTexture(g);
    g.destroy();
  }

  /** An additive light sprite at stage coords. */
  _light(parent, x, y, radius, colorHex, alpha = 1) {
    const s = new Sprite(this.lightTex || Texture.WHITE);
    s.anchor.set(0.5);
    s.x = x; s.y = y;
    s.width = s.height = radius * 2;
    s.tint = colorHex;
    s.alpha = alpha;
    s.blendMode = 'add';
    parent.addChild(s);
    return s;
  }

  // ── Sky ────────────────────────────────────────────────────────────
  // A late Swedish summer evening: the sun is low and warm, the zenith still
  // holds blue. Painted once — the sky does not move, the clouds do.
  _buildSky() {
    const sky = new Container();
    this.root.addChild(sky);

    const g = new Graphics();
    g.rect(0, 0, STAGE_W, HORIZON + 6).fill(new FillGradient({
      type: 'linear',
      textureSpace: 'global',   // absolute stage units — see the note above
      start: { x: 0, y: 0 }, end: { x: 0, y: HORIZON + 6 },
      colorStops: [
        { offset: 0,    color: 0x2a4570 },  // zenith, still blue
        { offset: 0.42, color: 0x5a72a0 },
        { offset: 0.72, color: 0xa8778a },  // the haze band
        { offset: 0.88, color: 0xe0a074 },  // warm, just above the treeline
        { offset: 1,    color: 0xf3c58f },
      ],
    }));
    sky.addChild(g);

    // The sun, low and hazy. Its glow is an additive light, not a filter.
    this.sunX = STAGE_W * 0.74;
    this.sunY = HORIZON - 38;
    const disc = new Graphics();
    disc.circle(this.sunX, this.sunY, 15).fill({ color: 0xfff0cf });
    sky.addChild(disc);
    this._light(sky, this.sunX, this.sunY, 120, 0xffc98a, 0.55);
    this._light(sky, this.sunX, this.sunY, 46, 0xfff2d2, 0.75);

    // Clouds: long thin evening streaks lit from beneath by the low sun. Their
    // shapes are baked once; only their x drifts.
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const n = noise(i * 977 + 13);
      const n2 = noise(i * 313 + 71);
      const cg = new Graphics();
      const w = 90 + n * 190;
      const h = 5 + n2 * 7;
      // Each streak is a run of overlapping ellipses so the silhouette is
      // ragged rather than a lozenge.
      const lobes = 4 + Math.floor(n2 * 4);
      for (let k = 0; k < lobes; k++) {
        const f = lobes > 1 ? k / (lobes - 1) : 0;
        const lx = f * w;
        const ly = Math.sin(f * Math.PI) * -h * 0.35 + noise(i * 31 + k) * h * 0.4;
        const lr = (0.35 + Math.sin(f * Math.PI) * 0.65) * h;
        cg.ellipse(lx, ly, lr * 2.6, lr).fill({ color: 0xffd9b4, alpha: 0.20 + n * 0.10 });
      }
      cg.x = n * STAGE_W;
      cg.y = 34 + n2 * 120;
      cg.alpha = 0.55 + n2 * 0.35;
      sky.addChild(cg);
      this.clouds.push({ g: cg, sp: 1.4 + n * 3.2 });
    }
    this.skyLayer = sky;
  }

  // ── Forest ─────────────────────────────────────────────────────────
  // Three bands of Swedish spruce at different depths, drawn once each and
  // never redrawn — depth comes from value and a slow parallax drift, not from
  // repainting.
  _buildForest() {
    this.forest = new Container();
    this.root.addChild(this.forest);

    // Far ridge: almost a flat wash, cool and hazy — this is what sells depth.
    this.forest.addChild(this._treeBand({
      seed: 101, baseY: HORIZON - 2, count: 64,
      minH: 16, maxH: 34, color: 0x5c6e83, alpha: 0.55, jag: 0.5,
    }));
    this.forest.addChild(this._treeBand({
      seed: 557, baseY: HORIZON + 2, count: 46,
      minH: 26, maxH: 58, color: 0x2f4453, alpha: 0.9, jag: 0.8,
    }));
    // Near band: nearly black, the frame's anchor at the shoreline.
    this.forest.addChild(this._treeBand({
      seed: 911, baseY: HORIZON + 7, count: 30,
      minH: 42, maxH: 96, color: 0x101d26, alpha: 1, jag: 1,
    }));
  }

  /**
   * One horizon-spanning band of conifers.
   * A spruce is drawn as a stack of drooping tiers rather than a triangle — a
   * triangle reads as a party hat, and the tier edges are what make a
   * silhouette read as "spruce" at this size.
   */
  _treeBand({ seed, baseY, count, minH, maxH, color, alpha, jag }) {
    const g = new Graphics();
    // A little extra width each side so parallax drift never exposes an edge.
    const span = STAGE_W + 160;
    for (let i = 0; i < count; i++) {
      const n = noise(seed + i * 7919);
      const n2 = noise(seed + i * 104729 + 3);
      const n3 = noise(seed + i * 15485863 + 11);
      const x = -80 + (i / count) * span + (n - 0.5) * (span / count) * 1.4;
      const h = lerp(minH, maxH, n2 * n2);          // squared: mostly short, a few tall
      const halfW = h * (0.20 + n3 * 0.10);
      const tiers = 4 + Math.floor(n * 3);
      const top = baseY - h;
      if (h > 34) {
        g.rect(x - h * 0.018, baseY - h * 0.16, h * 0.036, h * 0.16).fill({ color, alpha });
      }
      for (let k = 0; k < tiers; k++) {
        const f = k / tiers;
        const ty = lerp(top, baseY - h * 0.10, f);
        // Tiers widen toward the ground and each droops slightly past the last.
        const tw = halfW * (0.24 + f * 1.05);
        const drop = h * (0.16 + 0.05 * jag) * (0.55 + f * 0.6);
        const sag = h * 0.03 * jag;
        g.moveTo(x, ty)
          .lineTo(x + tw, ty + drop - sag)
          .lineTo(x + tw * 0.55, ty + drop)
          .lineTo(x, ty + drop + h * 0.03)
          .lineTo(x - tw * 0.55, ty + drop)
          .lineTo(x - tw, ty + drop - sag)
          .closePath()
          .fill({ color, alpha });
      }
    }
    // Ground the band so no gap can show under the shortest tree.
    g.rect(-80, baseY - 1, span, 26).fill({ color, alpha });
    return g;
  }

  // ── Lake ───────────────────────────────────────────────────────────
  _buildLake() {
    this.lake = new Container();
    this.root.addChild(this.lake);

    const base = new Graphics();
    base.rect(0, HORIZON, STAGE_W, STAGE_H - HORIZON).fill(new FillGradient({
      type: 'linear',
      textureSpace: 'global',   // absolute stage units — see the note above
      start: { x: 0, y: HORIZON }, end: { x: 0, y: STAGE_H },
      colorStops: [
        { offset: 0,    color: 0xc9a488 },   // the mirrored warm sky at the far shore
        { offset: 0.10, color: 0x6f7f92 },
        { offset: 0.42, color: 0x3a5470 },
        { offset: 1,    color: 0x1b2f44 },   // deep water at the near edge
      ],
    }));
    this.lake.addChild(base);

    // The forest's reflection: the near band again, mirrored, squashed and
    // dimmed. Cheap, and the single biggest cue that this is water and not a
    // painted floor.
    const refl = this._treeBand({
      seed: 911, baseY: HORIZON + 7, count: 30,
      minH: 42, maxH: 96, color: 0x0d1a24, alpha: 0.55, jag: 1,
    });
    refl.scale.y = -0.42;
    refl.y = HORIZON * 2 + 7;
    this.lake.addChild(refl);
    this.reflection = refl;

    // Everything that moves on the water is repainted per frame into this one
    // Graphics: ripple bands, the sun's glitter path, and splash rings.
    this.water = new Graphics();
    this.lake.addChild(this.water);
    this.rings = [];
  }

  // ── Shore ──────────────────────────────────────────────────────────
  // The near bank, bottom-left, framing the shot. Almost black — this is the
  // proscenium the whole film is watched through.
  _buildShore() {
    this.shore = new Container();
    this.root.addChild(this.shore);

    const bankAt = (x) => 96 * Math.pow(1 - x / STAGE_W, 1.7);

    const g = new Graphics();
    g.moveTo(0, STAGE_H);
    g.lineTo(0, STAGE_H - 96);
    for (let x = 0; x <= STAGE_W; x += 24) {
      g.lineTo(x, STAGE_H - (bankAt(x) + noise(x * 131 + 7) * 7));
    }
    g.lineTo(STAGE_W, STAGE_H).closePath().fill({ color: 0x080f16 });
    this.shore.addChild(g);

    // Reeds. Drawn once; they sway individually via a per-reed shear.
    this.reeds = new Container();
    this.shore.addChild(this.reeds);
    for (let i = 0; i < 26; i++) {
      const n = noise(i * 6151 + 29);
      const n2 = noise(i * 24593 + 5);
      const x = n * STAGE_W * 0.46;
      const h = 34 + n2 * 62;
      const rg = new Graphics();
      const bend = (n - 0.5) * h * 0.34;
      rg.moveTo(0, 0)
        .quadraticCurveTo(bend * 0.4, -h * 0.55, bend, -h)
        .stroke({ width: 1.6 + n2 * 1.4, color: 0x0a1219, alpha: 0.96 });
      if (h > 70) rg.ellipse(bend, -h - 3, 1.8, 6).fill({ color: 0x0a1219 });
      rg.x = x;
      rg.y = STAGE_H - bankAt(x) + 6;
      rg._ph = n2 * TAU;
      rg._amp = 0.02 + n * 0.05;
      this.reeds.addChild(rg);
    }
  }

  // ── Fauna and air ──────────────────────────────────────────────────
  _buildFauna() {
    this.fauna = new Container();
    this.root.addChild(this.fauna);

    this.bird = new Graphics();
    this.fauna.addChild(this.bird);
    this.fish = new Graphics();
    this.fauna.addChild(this.fish);

    // Midges over the water and a few fireflies. The cheapest possible "this
    // air is alive" cue.
    this.motes = [];
    for (let i = 0; i < 54; i++) {
      const n = noise(i * 3571 + 17), n2 = noise(i * 8191 + 3), n3 = noise(i * 92821 + 41);
      this.motes.push({
        x: n * STAGE_W,
        y: HORIZON + 10 + n2 * (STAGE_H - HORIZON - 40),
        ph: n3 * TAU,
        sp: 0.25 + n2 * 0.7,
        r: 0.7 + n3 * 1.1,
        fire: n3 > 0.86,
      });
    }
    this.moteG = new Graphics();
    this.fauna.addChild(this.moteG);
    // Fixed-size pool, matching the renderer's "never grow a light pool"
    // discipline — only this many fireflies can ever be lit at once.
    this.fireflyLights = [];
    for (let i = 0; i < 6; i++) {
      this.fireflyLights.push(this._light(this.fauna, -50, -50, 9, 0xbdff8a, 0));
    }
  }

  // ── Grade ──────────────────────────────────────────────────────────
  // A vignette plus a fade-from-black. Whole-picture grading is the right lever
  // for mood; per-light uniforms are for light sources.
  _buildGrade() {
    const v = new Graphics();
    v.rect(0, 0, STAGE_W, STAGE_H).fill(new FillGradient({
      type: 'radial',
      // Coordinates below are absolute STAGE units, so the gradient must be
      // resolved in global space. Pixi v8 defaults FillGradient to
      // textureSpace 'local', which normalises stops into the shape's own
      // 0..1 bounds — absolute values then fall outside the range and the
      // whole fill collapses to one flat colour. That is exactly what went
      // wrong first time: the lake rendered as a single grey slab and the sun
      // glow as a hard disc. Timmy, seeing it: "Ja a farg a ljus".
      textureSpace: 'global',
      center: { x: STAGE_W * 0.5, y: STAGE_H * 0.46 }, innerRadius: STAGE_H * 0.34,
      outerCenter: { x: STAGE_W * 0.5, y: STAGE_H * 0.46 }, outerRadius: STAGE_H * 1.02,
      // rgba strings, for the reason spelled out in _bakeLightTexture.
      colorStops: [
        // Was 0.62 at the rim and it ate the corners outright once the grade
        // was stacked on top. A vignette should shape the eye, not black out a
        // third of the frame.
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 0.62, color: 'rgba(0,1,6,0.05)' },
        { offset: 1, color: 'rgba(0,2,8,0.30)' },
      ],
    }));
    this.root.addChild(v);

    this.fade = new Graphics();
    this.fade.rect(0, 0, STAGE_W, STAGE_H).fill({ color: 0x000000 });
    this.root.addChild(this.fade);
  }

  // ── Layout ─────────────────────────────────────────────────────────
  _resize() {
    if (!this.app || this.destroyed) return;
    const w = this.canvas.clientWidth || STAGE_W;
    const h = this.canvas.clientHeight || STAGE_H;
    this.app.renderer.resize(w, h);
    // COVER, not contain: fill the screen and let the overscan fall outside.
    // Letterboxing a film on a 393px phone would waste most of the screen, and
    // the composition carries margin for exactly this.
    const s = Math.max(w / STAGE_W, h / STAGE_H);
    this.root.scale.set(s);
    this.root.x = (w - STAGE_W * s) / 2;
    this.root.y = (h - STAGE_H * s) / 2;
    // Base position, so the fight's camera shake can offset from it and land
    // back exactly here instead of drifting the whole picture off-centre.
    this._rootX0 = this.root.x;
    this._rootY0 = this.root.y;
  }

  // ── BEAT 9: SPACE — the wrong address ───────────────────────────────
  // Timmy's script: "Cut to the IN-GAME camera angle looking at Earth. He comes
  // flying in small from Earth, up and up the screen, and arrives at the camp
  // space station — lost. The coordinates were wrong. 'va e de här..'"
  //
  // The station IS the camp: a space station in bad shape, which is the thing
  // the player then spends the game repairing ("basen måste göras campet ett
  // camp/spacestation i dåligt skick vi ska ju fixa de å de blir campet"). So
  // it is drawn broken on purpose — a bent solar wing with cells punched out, a
  // split hull seam venting gas, a cracked dome, one lamp still stubbornly
  // blinking. The damage IS the design, not a placeholder.
  _buildSpace() {
    const sp = new Container();
    sp.visible = false;
    this.root.addChild(sp);
    this.sceneSpace = sp;
    this.sp = {};

    // Deep space. Deliberately not black — pure black reads as "failed to
    // render", and the game's own backdrop is a very dark blue for that reason.
    const bg = new Graphics();
    bg.rect(0, 0, STAGE_W, STAGE_H).fill(new FillGradient({
      type: 'linear', textureSpace: 'global',
      start: { x: 0, y: 0 }, end: { x: 0, y: STAGE_H },
      colorStops: [
        { offset: 0, color: '#04050c' },
        { offset: 0.62, color: '#070c1a' },
        { offset: 1, color: '#0a1426' },
      ],
    }));
    sp.addChild(bg);

    // Two nebula washes, additive and very low alpha, so the upper half is not
    // an empty rectangle behind the station.
    this._light(sp, 210, 130, 300, 0x3a2f6e, 0.16);
    this._light(sp, 760, 250, 340, 0x1f4a6b, 0.13);

    // Three star layers. Deterministic so they never shimmer between frames,
    // and sized by depth so the field has thickness.
    const layers = [[150, 11, 0.5, 0.30], [90, 977, 0.9, 0.55], [40, 4409, 1.4, 0.85]];
    for (const [n, seed, r0, a0] of layers) {
      const g = new Graphics();
      for (let i = 0; i < n; i++) {
        const x = noise(i * seed + 1) * STAGE_W;
        const y = noise(i * seed + 7717) * STAGE_H;
        const rr = r0 + noise(i * seed + 31) * r0;
        g.circle(x, y, rr).fill({ color: 0xffffff, alpha: a0 * (0.55 + noise(i * seed + 53) * 0.45) });
      }
      sp.addChild(g);
    }

    // ── EARTH, below and behind. He is leaving it. ────────────────────
    const EX = 430, EY = 880, ER = 470;   // mostly off the bottom of frame
    const earth = new Graphics();
    earth.circle(EX, EY, ER).fill(new FillGradient({
      type: 'radial', textureSpace: 'global',
      center: { x: EX - ER * 0.32, y: EY - ER * 0.44 }, innerRadius: 0,
      outerCenter: { x: EX, y: EY }, outerRadius: ER,
      colorStops: [
        { offset: 0, color: '#4aa8e0' },
        { offset: 0.42, color: '#1d6ba6' },
        { offset: 0.74, color: '#0d3a63' },
        { offset: 1, color: '#04101f' },
      ],
    }));
    // Continents as blunt masses. A recognisable coastline would be a lie at
    // this size; what has to read is "land, water, cloud".
    const land = [
      [-250, -300, 120, 62], [-90, -360, 78, 44], [40, -300, 150, 70],
      [230, -250, 90, 52], [-190, -180, 100, 48], [120, -160, 70, 38],
    ];
    for (const [dx, dy, rx, ry] of land) {
      earth.ellipse(EX + dx, EY + dy, rx, ry).fill({ color: 0x2f6b3a, alpha: 0.55 });
      earth.ellipse(EX + dx + rx * 0.2, EY + dy - ry * 0.2, rx * 0.55, ry * 0.5)
        .fill({ color: 0x3f7d45, alpha: 0.40 });
    }
    // Cloud bands, brighter and softer than the land.
    for (let i = 0; i < 16; i++) {
      const a = noise(i * 613 + 3) * Math.PI - Math.PI;
      const rr = ER * (0.55 + noise(i * 613 + 91) * 0.4);
      const cx = EX + Math.cos(a) * rr * 0.75;
      const cy = EY + Math.sin(a) * rr * 0.75;
      earth.ellipse(cx, cy, 40 + noise(i * 613 + 7) * 70, 12 + noise(i * 613 + 17) * 16)
        .fill({ color: 0xffffff, alpha: 0.13 + noise(i * 613 + 29) * 0.12 });
    }
    // Night side: the sun is up-left, so the lower-right limb falls away.
    earth.circle(EX, EY, ER).fill(new FillGradient({
      type: 'radial', textureSpace: 'global',
      center: { x: EX - ER * 0.30, y: EY - ER * 0.42 }, innerRadius: ER * 0.35,
      outerCenter: { x: EX, y: EY }, outerRadius: ER * 1.02,
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 0.62, color: 'rgba(0,0,0,0.18)' },
        { offset: 1, color: 'rgba(0,0,0,0.86)' },
      ],
    }));
    sp.addChild(earth);
    // Atmosphere: additive rim hugging the lit limb — the pooled-sprite
    // technique, not a filter glow.
    this._light(sp, EX - ER * 0.18, EY - ER * 0.92, 330, 0x7fd2ff, 0.30);
    this._light(sp, EX, EY - ER * 0.98, 190, 0xbfe9ff, 0.20);

    // ── THE CAMP STATION — upper right, and in a bad way ──────────────
    const st = new Container();
    st.x = 640; st.y = 168;
    sp.addChild(st);
    this.sp.station = st;

    const hull = new Graphics();
    // Main drum. The gradient is in GLOBAL space, so its start/end are the
    // hull's on-stage y range (168-34 .. 168+34), not local -34..34.
    hull.roundRect(-96, -34, 192, 68, 12).fill(new FillGradient({
      type: 'linear', textureSpace: 'global',
      start: { x: 0, y: 134 }, end: { x: 0, y: 202 },
      colorStops: [
        { offset: 0, color: '#8fa3b4' },
        { offset: 0.22, color: '#5e7183' },
        { offset: 0.68, color: '#2d3b47' },
        { offset: 1, color: '#1a242e' },
      ],
    }));
    // Panel seams and rivets — an unbroken plate reads as plastic.
    for (let i = -3; i <= 3; i++) {
      hull.moveTo(i * 26, -33).lineTo(i * 26, 33).stroke({ width: 1, color: 0x14202a, alpha: 0.75 });
      hull.circle(i * 26, -27, 1.6).fill({ color: 0xb9cbd8, alpha: 0.50 });
      hull.circle(i * 26, 27, 1.6).fill({ color: 0x0e161d, alpha: 0.70 });
    }
    // End caps.
    hull.ellipse(-96, 0, 13, 34).fill({ color: 0x4b5c6c });
    hull.ellipse(96, 0, 13, 34).fill({ color: 0x37464f });
    // A cracked observation dome.
    hull.ellipse(-24, -46, 34, 26).fill({ color: 0x6fd0e8, alpha: 0.30 });
    hull.ellipse(-24, -46, 34, 26).stroke({ width: 2, color: 0x9fb6c6, alpha: 0.80 });
    hull.moveTo(-44, -56).lineTo(-30, -44).lineTo(-36, -34).stroke({ width: 1.4, color: 0x0b1218, alpha: 0.90 });
    hull.moveTo(-30, -44).lineTo(-12, -50).stroke({ width: 1, color: 0x0b1218, alpha: 0.70 });
    // The breach: a torn seam on the underside. This is what vents.
    hull.moveTo(18, 34).lineTo(30, 20).lineTo(44, 31).lineTo(58, 18).lineTo(66, 34).closePath()
      .fill({ color: 0x0a1017 });
    hull.moveTo(18, 34).lineTo(30, 20).lineTo(44, 31).lineTo(58, 18).lineTo(66, 34)
      .stroke({ width: 1.6, color: 0xb06a3a, alpha: 0.85 });
    // Docking ring — still intact, which is why he can arrive at all.
    hull.circle(96, 0, 17).stroke({ width: 4, color: 0x6e808f, alpha: 1 });
    hull.circle(96, 0, 17).stroke({ width: 1, color: 0xc2d4e0, alpha: 0.45 });
    st.addChild(hull);

    // Solar wings: one square to the sun, one bent with cells punched out.
    const wing = (x, tilt, broken) => {
      const w = new Graphics();
      const keep = broken ? [0, 1, 3, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
      for (let i = 0; i < 8; i++) {
        if (!keep.includes(i)) continue;
        const cx = x + (i % 2) * 26 - 13, cy = -30 + Math.floor(i / 2) * 21;
        w.rect(cx - 12, cy - 9, 24, 18).fill({ color: broken ? 0x1c2c4a : 0x24406e, alpha: 0.95 });
        w.rect(cx - 12, cy - 9, 24, 18).stroke({ width: 1, color: 0x4a6ea8, alpha: 0.60 });
      }
      w.moveTo(x, -34).lineTo(x, 42).stroke({ width: 2.5, color: 0x5d6f7d });
      w.rotation = tilt;
      return w;
    };
    st.addChild(wing(-152, -0.06, false));
    st.addChild(wing(152, 0.42, true));
    // A snapped strut hanging off the broken wing.
    const strut = new Graphics();
    strut.moveTo(120, 10).lineTo(146, 30).lineTo(139, 44).stroke({ width: 2.4, color: 0x54636f });
    st.addChild(strut);

    // Bent antenna.
    const ant = new Graphics();
    ant.moveTo(-70, -34).lineTo(-78, -74).lineTo(-58, -92).stroke({ width: 2.2, color: 0x7d8f9c });
    ant.circle(-58, -92, 3.4).fill({ color: 0xc8d8e2 });
    st.addChild(ant);

    // The sign, mostly given up.
    const sign = new Text({
      text: 'WATERDROP CAMP',
      style: new TextStyle({ fontFamily: 'VT323, monospace', fontSize: 15, fill: 0x9fd8e8, letterSpacing: 2 }),
    });
    sign.anchor.set(0.5);
    sign.y = 12;
    sign.alpha = 0.45;
    st.addChild(sign);

    // One lamp still working, and the vent. Both animate in _beatSpace.
    this.sp.lamp = this._light(st, 78, -30, 26, 0xff5a4a, 0.9);
    this.sp.lampGlass = new Graphics();
    this.sp.lampGlass.circle(78, -30, 3.4).fill({ color: 0xffb0a0 });
    st.addChild(this.sp.lampGlass);
    this.sp.vent = new Graphics();
    st.addChild(this.sp.vent);
    this.sp.ventLight = this._light(st, 42, 40, 40, 0x9fe8ff, 0);

    // ── THE HERO ─────────────────────────────────────────────────────
    // Body from heroShape's silhouette, face from the renderer's own rig.
    const hero = new Container();
    sp.addChild(hero);
    this.sp.hero = hero;
    this.sp.gBody = new Graphics();
    this.sp.gFace = new Graphics();
    hero.addChild(this.sp.gBody);
    hero.addChild(this.sp.gFace);
    this.sp.trail = this._light(sp, 0, 0, 70, 0x8fe0ff, 0);

    // Thought bubble. Text, because a glyph alone cannot carry "va e de här..".
    const bub = new Container();
    bub.alpha = 0;
    sp.addChild(bub);
    this.sp.bubble = bub;
    this.sp.bubbleBg = new Graphics();
    bub.addChild(this.sp.bubbleBg);
    this.sp.bubbleText = new Text({
      text: '?',
      style: new TextStyle({ fontFamily: 'VT323, monospace', fontSize: 30, fill: 0x0a1018 }),
    });
    this.sp.bubbleText.anchor.set(0.5);
    bub.addChild(this.sp.bubbleText);
  }

  // Per-frame for beat 9. Phases are fractions of the beat, so retiming the
  // beat retimes the whole shot instead of desyncing it.
  _beatSpace() {
    const dur = BEATS[this.beatIdx].dur;
    const bt = clamp01(this.beatT / dur);
    const t = this.t;
    const S = this.sp;
    if (!S || !S.hero) return;

    // ── flight path ──────────────────────────────────────────────────
    // He launches from Earth (below, off-frame) and rises to the station's
    // docking side. easeOut so he arrives decelerating rather than slamming.
    const FLY = 0.40;
    const k = easeOut(clamp01(bt / FLY));
    // A lateral bow makes it a trajectory rather than a slide up the screen.
    const hx = lerp(400, 700, k) + Math.sin(k * Math.PI) * 46;
    const hy = lerp(640, 172, k);
    S.hero.x = hx;
    S.hero.y = hy;

    // Tiny at first — he is coming from a planet.
    const scale = lerp(0.16, 1.0, easeOut(clamp01(bt / (FLY * 0.92))));
    const r = 26 * scale;

    // Spin off the slingshot, bleeding away as he arrives, then a settling
    // wobble — the "shake it off" the script asks for.
    const spd = 1 - k;
    const settle = bt > FLY ? Math.exp(-(bt - FLY) * 14) * Math.sin((bt - FLY) * 90) * 0.5 : 0;
    const bodyAng = spd * 9.0 * 1.4 + settle;
    const sqx = 1 - spd * 0.16 + settle * 0.10;
    const sqy = 1 + spd * 0.22 - settle * 0.10;

    // Engine trail: additive, dying as he slows.
    S.trail.x = hx - 30 * spd;
    S.trail.y = hy + 30 * spd;
    S.trail.alpha = spd * 0.75;
    S.trail.width = S.trail.height = (50 + 90 * spd) * Math.max(0.3, scale);

    // ── body ─────────────────────────────────────────────────────────
    const gb = S.gBody;
    gb.clear();
    const half = heroHalfPoints(r, 14);
    const pts = [];
    for (let i = 0; i < half.length; i += 2) pts.push(half[i] * sqx, half[i + 1] * sqy);
    for (let i = half.length - 2; i >= 0; i -= 2) pts.push(-half[i] * sqx, half[i + 1] * sqy);
    const ca = Math.cos(bodyAng), sa = Math.sin(bodyAng);
    const spun = [];
    for (let i = 0; i < pts.length; i += 2) {
      spun.push(pts[i] * ca - pts[i + 1] * sa, pts[i + 1] * ca + pts[i] * sa);
    }
    gb.poly(spun).fill({ color: 0x1a6f96 });
    // Inner lit volume, pulled toward the light (upper left).
    const inner = [];
    for (let i = 0; i < spun.length; i += 2) {
      inner.push(spun[i] * 0.82 - r * 0.05, spun[i + 1] * 0.82 - r * 0.06);
    }
    gb.poly(inner).fill({ color: 0x5fd6ff, alpha: 0.92 });
    // Meniscus rim — the strongest "this is water" cue there is.
    gb.poly(spun).stroke({ width: Math.max(1, 1.6 * scale), color: 0xdff4ff, alpha: 0.55 });

    // ── face ─────────────────────────────────────────────────────────
    // A plain object rather than a HeroAnim instance: HeroAnim derives its
    // state from live player input, which does not exist in a film. These are
    // the only seven fields drawHeroFace actually reads.
    let exprId;
    if (bt < FLY * 0.85) exprId = 'rage';          // eyes still rattling
    else if (bt < 0.58) exprId = 'hurt';           // that was awful
    else if (bt < 0.80) exprId = 'focused';        // where am I
    else exprId = 'angry';                         // this is the wrong address
    const A = {
      faceX: bt < FLY ? 0.15 : Math.sin((bt - FLY) * 6.5) * 0.75,
      faceY: bt < FLY ? 0.85 : 1,
      blink: bt > 0.5 && Math.sin(t * 3.1) > 0.94 ? 1 : 0,
      lookX: bt < FLY ? 0 : Math.sin((bt - FLY) * 5.2) * 0.9,
      lookY: bt < FLY ? -0.4 : 0.1,
      exprId,
      expr: EXPRESSIONS[exprId] || EXPRESSIONS.calm,
    };
    const gf = S.gFace;
    gf.clear();
    drawHeroFace(gf, 0, 0, r, bodyAng, sqx, sqy, A, null);

    // ── the station, failing ─────────────────────────────────────────
    // A lamp on a lazy irregular cycle reads as broken; a steady pulse reads
    // as working. It is meant to look like it is giving up.
    const blink = Math.sin(t * 2.2) * 0.5 + 0.5;
    const stutter = Math.sin(t * 11.7) > 0.75 ? 0.25 : 1;
    S.lamp.alpha = (0.25 + blink * 0.75) * stutter;
    S.lampGlass.alpha = S.lamp.alpha;

    // The breach vents in irregular puffs.
    const vg = S.vent;
    vg.clear();
    const puff = (Math.sin(t * 0.9) * 0.5 + 0.5) * (Math.sin(t * 2.7) * 0.5 + 0.5);
    for (let i = 0; i < 9; i++) {
      const n = noise(i * 2551 + 5);
      const age = (t * 0.45 + n) % 1;
      vg.circle(42 + age * 30 + n * 10, 36 + age * 46, 2 + age * 11 + n * 3)
        .fill({ color: 0xbfe8ff, alpha: (1 - age) * 0.16 * (0.4 + puff) });
    }
    S.ventLight.alpha = 0.10 + puff * 0.20;

    // ── the thought ──────────────────────────────────────────────────
    // Two beats: a bare "?" while he is still turning, then the line. English —
    // Timmy: "på engelska". The game's own copy is English throughout.
    const bub = S.bubble;
    if (bt > 0.60) {
      const line = bt > 0.76;
      const txt = line ? 'the hell is this..' : '?';
      if (S.bubbleText.text !== txt) {
        S.bubbleText.text = txt;
        S.bubbleText.style.fontSize = line ? 22 : 30;
        const w = S.bubbleText.width + 26, h = S.bubbleText.height + 14;
        S.bubbleBg.clear();
        S.bubbleBg.roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0xe8f4ff, alpha: 0.94 });
        // Tail: three shrinking dots back toward his head, the comic convention.
        for (let i = 0; i < 3; i++) {
          S.bubbleBg.circle(-w * 0.30 - i * 11, h * 0.55 + i * 10, 5 - i * 1.3)
            .fill({ color: 0xe8f4ff, alpha: 0.9 - i * 0.2 });
        }
      }
      const inT = clamp01((bt - 0.60) / 0.06);
      bub.alpha = easeOut(inT);
      bub.x = S.hero.x + 78;
      bub.y = S.hero.y - 62 + Math.sin(t * 2) * 3;
      bub.scale.set(0.7 + easeOut(inT) * 0.3);
    } else {
      bub.alpha = 0;
    }

    this._once('spaceArrive', () => { Audio.waterDrop && Audio.waterDrop(); });
  }

  // ── BEAT 10: THE FIGHT ──────────────────────────────────────────────
  // Same scene as the arrival, no cut between them — `sceneSpace` stays up.
  // Timmy allows exactly one cut: the moment he SEES the enemy.
  //
  // Built to the doctrine in waterdrop-gore-and-violence-doctrine (memory): the
  // genre's "one explosion and the body is gone" is the thing he is attacking.
  // A body must come APART, in stages, and the pieces must persist and behave —
  // eyes, brain, intestines that drag, blood that pumps and pools and smears,
  // and one gib that hits the CAMERA, sticks, then slides off fast so it never
  // blocks the view. Exaggerated, played dead straight.
  _buildFight() {
    const sp = this.sceneSpace;
    const F = {};
    this.fx = F;

    // Blood accumulates. This layer is NEVER cleared during the beat — that is
    // the point: by the end the floor of the shot is a mess.
    F.blood = new Graphics();
    sp.addChild(F.blood);

    // The slime. Green, with a real face — he asked for eyes, expression and
    // eyebrows on this one specifically. (He cancelled eyes on the IN-GAME green
    // enemies once, "skit i ögonen"; this is the film and he asked for them.)
    F.slime = new Container();
    F.gSlime = new Graphics();
    F.slime.addChild(F.gSlime);
    sp.addChild(F.slime);
    F.slimeHp = 1;          // 1 -> 0.1, stepped down blow by blow
    F.slimeHit = 0;         // flash/squash on impact

    // The torn-off hull plate he fights with. It reads as a METAL PIECE, the
    // same way the katana is drawn on the level-up cards — not a sword.
    F.gShard = new Graphics();
    sp.addChild(F.gShard);

    // Gibs: pooled, capped. 50+ enemies on screen in the real game is what makes
    // persistent debris expensive, so the pattern is set correctly here.
    F.gibs = [];
    F.gGibs = new Graphics();
    sp.addChild(F.gGibs);

    // Things that hit the lens. Drawn last, above everything.
    F.gLens = new Graphics();
    sp.addChild(F.gLens);
    F.lens = [];

    // Impact light, pooled additive — never a filter glow.
    F.hitLight = this._light(sp, 0, 0, 90, 0xff4030, 0);

    // The next wave, arriving at the end.
    F.gMore = new Graphics();
    sp.addChild(F.gMore);
  }

  /** One gib. `kind` drives how it looks and how it behaves on the ground. */
  _gib(x, y, kind, power = 1) {
    const F = this.fx;
    if (F.gibs.length > 90) F.gibs.shift();     // hard cap, oldest goes
    const a = Math.random() * TAU;
    const sp = (80 + Math.random() * 260) * power;
    F.gibs.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60 * power,
      r: kind === 'eye' ? 5.5 : kind === 'brain' ? 7 + Math.random() * 5 : 3 + Math.random() * 6,
      kind,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 9,
      age: 0,
      life: 2.4 + Math.random() * 2.2,
      settled: false,
      tail: kind === 'gut' ? [] : null,   // intestines trail behind
    });
  }

  /** A gib thrown at the lens: sticks, then slides off fast. */
  _lensGib(kind) {
    this.fx.lens.push({
      x: 240 + Math.random() * 480,
      y: 120 + Math.random() * 200,
      kind,
      scale: 0.2,
      age: 0,
      rot: Math.random() * TAU,
    });
  }

  _beatFight() {
    const dur = BEATS[this.beatIdx].dur;
    const bt = clamp01(this.beatT / dur);
    const t = this.t;
    const dt = 1 / 60;
    const F = this.fx;
    const S = this.sp;
    if (!F || !S) return;

    // He holds the position he arrived at.
    const HX = 700, HY = 172;
    S.hero.x = HX; S.hero.y = HY;
    S.trail.alpha = 0;

    // ── phase clock ──────────────────────────────────────────────────
    const P_SEE  = 0.10;   // it slides in, he has not noticed
    const P_QM   = 0.16;   // "?" — the one permitted cut
    const P_BUMP = 0.24;   // it shoves him. now he knows.
    const P_ARM  = 0.34;   // he rips the plate off the hull
    const P_BEAT = 0.86;   // the beating
    const P_MORE = 0.94;   // more of them arrive

    // ── the slime ────────────────────────────────────────────────────
    const inK = easeOut(clamp01(bt / P_SEE));
    let sx = lerp(1010, 820, inK);
    const sy = 196 + Math.sin(t * 3.4) * 9;
    if (bt > P_SEE) {
      const closeK = easeOut(clamp01((bt - P_SEE) / (P_BUMP - P_SEE)));
      sx = lerp(820, 762, closeK);
    }
    if (bt > P_BUMP) {
      // Knocked further back as it loses mass, then dragged back in.
      sx = 762 + Math.sin(t * 2.1) * 6 + (1 - F.slimeHp) * 26;
    }
    F.slime.x = sx; F.slime.y = sy;

    const hp = F.slimeHp;
    const rr = 34 * (0.35 + hp * 0.65);          // it visibly SHRINKS
    F.slimeHit = Math.max(0, F.slimeHit - dt * 5);
    const hit = F.slimeHit;

    const gs = F.gSlime;
    gs.clear();
    if (hp > 0.09) {
      // Body: a wobbling blob, torn open further the lower it goes. The bites
      // are deterministic per angle so damage stays where it was put rather
      // than crawling around the outline.
      const pts = [];
      const N = 22;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        const bite = hp < 0.95 ? (noise(i * 977 + 3) > hp ? 0.55 + noise(i * 31) * 0.3 : 1) : 1;
        const wob = 1 + Math.sin(t * 6 + i * 0.9) * 0.06 + hit * 0.18 * Math.sin(i * 2.1);
        const rad = rr * bite * wob * (1 + hit * 0.12);
        pts.push(Math.cos(a) * rad, Math.sin(a) * rad * 0.86);
      }
      gs.poly(pts).fill({ color: hit > 0.4 ? 0xd8ffcf : 0x4fbf46 });
      gs.poly(pts).stroke({ width: 2, color: 0x14340f, alpha: 0.9 });
      gs.ellipse(-rr * 0.26, -rr * 0.30, rr * 0.42, rr * 0.30).fill({ color: 0x9ff08e, alpha: 0.45 });
      // Exposed interior once it is opened up.
      if (hp < 0.7) {
        gs.ellipse(rr * 0.15, rr * 0.1, rr * 0.5 * (1 - hp), rr * 0.4 * (1 - hp))
          .fill({ color: 0x6b1414, alpha: 0.85 });
      }

      // Its face: eyes, brows, and an expression that turns to terror.
      const scared = bt > P_ARM ? 1 : 0;
      const ey = -rr * 0.18, exo = rr * 0.34;
      for (const side of [-1, 1]) {
        const ex = side * exo;
        const eo = 1 - hp * 0.2;
        gs.ellipse(ex, ey, rr * 0.20 * eo, rr * 0.24 * eo).fill({ color: 0xffffff });
        // Pupils shrink to pinpricks when it understands what is happening.
        const pr = rr * (scared ? 0.055 : 0.10);
        gs.circle(ex + side * rr * 0.03 * (scared ? -1 : 1), ey + rr * 0.02 * scared, pr)
          .fill({ color: 0x100c08 });
        gs.circle(ex - rr * 0.05, ey - rr * 0.07, rr * 0.035).fill({ color: 0xffffff, alpha: 0.9 });
        const b1x = ex - side * rr * 0.20, b2x = ex + side * rr * 0.18;
        const lift = scared ? rr * 0.16 : 0;
        gs.moveTo(b1x, ey - rr * 0.36 - lift)
          .lineTo(b2x, ey - rr * 0.32 + (scared ? rr * 0.06 : 0))
          .stroke({ width: Math.max(1.5, rr * 0.075), color: 0x14340f, alpha: 0.95 });
      }
      if (scared) {
        gs.ellipse(0, rr * 0.34, rr * 0.20, rr * 0.26).fill({ color: 0x1c0a0a });
      } else {
        gs.moveTo(-rr * 0.16, rr * 0.34).quadraticCurveTo(0, rr * 0.42, rr * 0.16, rr * 0.34)
          .stroke({ width: 2, color: 0x14340f, alpha: 0.9 });
      }
    }

    // ── he notices ───────────────────────────────────────────────────
    // The "?" is the one place a cut is allowed, so it POPS rather than fades.
    const bub = S.bubble;
    if (bt > P_QM && bt < P_BUMP) {
      if (S.bubbleText.text !== '?') {
        S.bubbleText.text = '?';
        S.bubbleText.style.fontSize = 34;
        const w = S.bubbleText.width + 26, h = S.bubbleText.height + 14;
        S.bubbleBg.clear();
        S.bubbleBg.roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0xe8f4ff, alpha: 0.95 });
        for (let i = 0; i < 3; i++) {
          S.bubbleBg.circle(-w * 0.30 - i * 11, h * 0.55 + i * 10, 5 - i * 1.3)
            .fill({ color: 0xe8f4ff, alpha: 0.9 - i * 0.2 });
        }
        Audio.click && Audio.click();
      }
      bub.alpha = 1;
      bub.x = HX - 70; bub.y = HY - 66 + Math.sin(t * 8) * 2;
      bub.scale.set(1);
    } else {
      bub.alpha = 0;
    }

    // ── he arms himself: a plate torn off the hull ───────────────────
    const armed = bt > P_ARM;
    const gsh = F.gShard;
    gsh.clear();
    if (armed) {
      const swings = 9;
      const sw = clamp01((bt - P_ARM) / (P_BEAT - P_ARM));
      const phase = sw * swings;
      const idx = Math.floor(phase);
      const k = phase - idx;                    // 0..1 within this swing
      // Wind up slowly, come down fast — the strike lands at k ~ 0.55.
      const ang = k < 0.55
        ? lerp(-2.4, 0.9, easeOut(k / 0.55))
        : lerp(0.9, -2.4, (k - 0.55) / 0.45);

      const sxr = HX + 30, syr = HY + 6;
      const L = 46, W = 9;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const p = (dx, dy) => [sxr + dx * ca - dy * sa, syr + dy * ca + dx * sa];
      // A torn METAL PLATE, not a blade: ragged edge, a panel seam across it.
      const a1 = p(6, -W), a2 = p(L, -W * 0.55), a3 = p(L + 8, 2), a4 = p(L - 6, W), a5 = p(6, W);
      const outline = [...a1, ...a2, ...a3, ...a4, ...a5];
      gsh.poly(outline).fill({ color: 0x9aa9b6 });
      gsh.poly(outline).stroke({ width: 1.6, color: 0x1b2731 });
      const b1 = p(10, -W * 0.4), b2 = p(L - 4, -W * 0.15);
      gsh.moveTo(b1[0], b1[1]).lineTo(b2[0], b2[1]).stroke({ width: 1.4, color: 0xdfeaf2, alpha: 0.55 });
      // Blood collects on it as the beating goes on.
      if (F.slimeHp < 0.9) {
        const c1 = p(L * 0.55, -W * 0.2), c2 = p(L, W * 0.3);
        gsh.moveTo(c1[0], c1[1]).lineTo(c2[0], c2[1])
          .stroke({ width: 3, color: 0x7a1010, alpha: 0.75 });
      }

      // ── the strike ───────────────────────────────────────────────
      this._once('swing' + idx, () => {
        if (F.slimeHp <= 0.1) return;
        // Down to ~10% over nine blows, never to zero: he wants a wrecked
        // REMAINDER on the floor, not a vanished enemy.
        F.slimeHp = Math.max(0.1, F.slimeHp - 0.108);
        F.slimeHit = 1;
        F.hitLight.x = sx; F.hitLight.y = sy;

        const power = 0.7 + idx * 0.14;
        // Flesh always; then the named parts, escalating. An eye leaves early,
        // the brain comes out late, guts drag.
        for (let i = 0; i < 6 + idx * 2; i++) this._gib(sx, sy, 'flesh', power);
        for (let i = 0; i < 5 + idx; i++) this._gib(sx, sy, 'blood', power);
        if (idx === 2 || idx === 6) this._gib(sx, sy, 'eye', power * 1.3);
        if (idx >= 4) this._gib(sx, sy, 'gut', power * 0.7);
        if (idx >= 6) this._gib(sx, sy, 'brain', power);
        // Two at the lens, so it reads as deliberate rather than random.
        if (idx === 3) this._lensGib('eye');
        if (idx === 7) this._lensGib('brain');
        if (idx === 8) {
          this._lensGib('flesh');
          for (let i = 0; i < 22; i++) this._gib(sx, sy, 'flesh', 1.4);
        }
        Audio.hit && Audio.hit();
      });
    }

    // Impact light and camera shake decay together.
    F.hitLight.alpha = hit * 0.85;
    F.hitLight.width = F.hitLight.height = 120 + hit * 90;
    const shake = hit * 7;
    this.root.x = this._rootX0 + (Math.random() - 0.5) * shake;
    this.root.y = this._rootY0 + (Math.random() - 0.5) * shake;

    // ── gibs ─────────────────────────────────────────────────────────
    const GROUND = 300;                 // where debris settles in frame
    const gg = F.gGibs;
    gg.clear();
    for (const g of F.gibs) {
      g.age += dt;
      if (!g.settled) {
        g.vy += 240 * dt;               // a light, spacey fall
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.rot += g.vr * dt;
        g.vx *= 0.995;
        if (g.y > GROUND + noise(Math.round(g.x)) * 40) {
          g.settled = true;
          g.vy = 0; g.vx *= 0.2;
          // A settling piece smears what it lands on. This layer never clears,
          // so the floor builds up across the beat.
          F.blood.ellipse(g.x, g.y, g.r * (1.6 + Math.random()), g.r * 0.5)
            .fill({ color: 0x5e0d0d, alpha: 0.5 });
          F.blood.ellipse(g.x + g.r, g.y + 1, g.r * 0.7, g.r * 0.28)
            .fill({ color: 0x8a1414, alpha: 0.35 });
        }
      } else if (Math.abs(g.vx) > 2) {
        // Still sliding — leave a skid smear behind it.
        g.x += g.vx * dt; g.vx *= 0.88;
        F.blood.ellipse(g.x, g.y, g.r * 0.9, g.r * 0.3).fill({ color: 0x6b0f0f, alpha: 0.22 });
      }
      if (g.tail) {
        g.tail.push(g.x, g.y);
        if (g.tail.length > 26) g.tail.splice(0, 2);
      }

      const fade = clamp01((g.life - g.age) / 0.8);
      if (fade <= 0) continue;

      if (g.kind === 'blood') {
        // Stretched along travel while airborne — the droplet grade that reads
        // as fast mist rather than a ball.
        const spd2 = Math.hypot(g.vx, g.vy);
        const st = 1 + Math.min(2.4, spd2 / 240);
        gg.ellipse(g.x, g.y, g.r * st * 0.8, g.r * 0.55)
          .fill({ color: 0xa81616, alpha: 0.85 * fade });
      } else if (g.kind === 'eye') {
        gg.circle(g.x, g.y, g.r).fill({ color: 0xf2f0e6, alpha: fade });
        gg.circle(g.x + Math.cos(g.rot) * g.r * 0.35, g.y + Math.sin(g.rot) * g.r * 0.35, g.r * 0.42)
          .fill({ color: 0x1a1410, alpha: fade });
        // The optic nerve, still attached and trailing.
        gg.moveTo(g.x, g.y)
          .lineTo(g.x - Math.cos(g.rot) * g.r * 2.4, g.y - Math.sin(g.rot) * g.r * 2.4)
          .stroke({ width: 1.6, color: 0xc85c5c, alpha: 0.7 * fade });
      } else if (g.kind === 'brain') {
        gg.ellipse(g.x, g.y, g.r, g.r * 0.8).fill({ color: 0xd89aa4, alpha: fade });
        for (let i = 0; i < 4; i++) {
          const a = g.rot + i * 1.3;
          gg.moveTo(g.x - Math.cos(a) * g.r * 0.7, g.y - Math.sin(a) * g.r * 0.5)
            .quadraticCurveTo(g.x, g.y + g.r * 0.2, g.x + Math.cos(a) * g.r * 0.7, g.y + Math.sin(a) * g.r * 0.5)
            .stroke({ width: 1.3, color: 0xa8626c, alpha: 0.8 * fade });
        }
      } else if (g.kind === 'gut') {
        // Intestines: a rope that DRAGS behind whatever is carrying it.
        if (g.tail && g.tail.length >= 4) {
          gg.moveTo(g.tail[0], g.tail[1]);
          for (let i = 2; i < g.tail.length; i += 2) gg.lineTo(g.tail[i], g.tail[i + 1]);
          gg.stroke({ width: g.r * 1.1, color: 0xb0655c, alpha: 0.9 * fade });
          gg.moveTo(g.tail[0], g.tail[1]);
          for (let i = 2; i < g.tail.length; i += 2) gg.lineTo(g.tail[i], g.tail[i + 1]);
          gg.stroke({ width: g.r * 0.4, color: 0xd89a8e, alpha: 0.5 * fade });
        }
        gg.circle(g.x, g.y, g.r * 0.8).fill({ color: 0xb0655c, alpha: fade });
      } else {
        // Flesh: an irregular chunk, green outside and red where it was torn.
        const n = 6;
        const cpts = [];
        for (let i = 0; i < n; i++) {
          const a = g.rot + (i / n) * TAU;
          const rad = g.r * (0.7 + noise(i * 811 + Math.round(g.r * 10)) * 0.6);
          cpts.push(g.x + Math.cos(a) * rad, g.y + Math.sin(a) * rad);
        }
        gg.poly(cpts).fill({ color: 0x3f9c38, alpha: fade });
        gg.poly(cpts.map((v, i) => (i % 2 ? v + g.r * 0.2 : v - g.r * 0.15)))
          .fill({ color: 0x7d1c1c, alpha: 0.75 * fade });
      }
    }

    // ── the lens ─────────────────────────────────────────────────────
    // Hits the glass, holds briefly, then slides off FAST. It must never sit on
    // the picture — the slide-off is the whole trick.
    const gl = F.gLens;
    gl.clear();
    for (const Lg of F.lens) {
      Lg.age += dt;
      const grow = clamp01(Lg.age / 0.09);
      Lg.scale = 0.2 + grow * 1.0;
      const hold = 0.42;
      if (Lg.age > hold) Lg.y += (Lg.age - hold) * 1500 * dt;
      if (Lg.y > STAGE_H + 90) continue;
      const R = 26 * Lg.scale;
      // The wet splat it lands in.
      gl.ellipse(Lg.x, Lg.y, R * 1.7, R * 1.25).fill({ color: 0x8c1414, alpha: 0.55 });
      for (let i = 0; i < 7; i++) {
        const a = noise(i * 313 + Math.round(Lg.x)) * TAU;
        const d = R * (1.3 + noise(i * 71) * 0.9);
        gl.circle(Lg.x + Math.cos(a) * d, Lg.y + Math.sin(a) * d, R * (0.12 + noise(i * 97) * 0.22))
          .fill({ color: 0xa81616, alpha: 0.5 });
      }
      // A run of blood dragging behind it once it starts sliding.
      if (Lg.age > hold) {
        gl.ellipse(Lg.x, Lg.y - R * 2.2, R * 0.5, R * 2.2).fill({ color: 0x7a1212, alpha: 0.32 });
      }
      if (Lg.kind === 'eye') {
        gl.circle(Lg.x, Lg.y, R * 0.8).fill({ color: 0xf2f0e6 });
        gl.circle(Lg.x + R * 0.16, Lg.y + R * 0.1, R * 0.34).fill({ color: 0x1a1410 });
        gl.circle(Lg.x - R * 0.22, Lg.y - R * 0.26, R * 0.16).fill({ color: 0xffffff, alpha: 0.85 });
        gl.moveTo(Lg.x, Lg.y).quadraticCurveTo(Lg.x - R, Lg.y + R * 1.6, Lg.x - R * 0.4, Lg.y + R * 2.6)
          .stroke({ width: 3, color: 0xc85c5c, alpha: 0.8 });
      } else if (Lg.kind === 'brain') {
        gl.ellipse(Lg.x, Lg.y, R * 0.95, R * 0.75).fill({ color: 0xd89aa4 });
        for (let i = 0; i < 5; i++) {
          const a = i * 1.2;
          gl.moveTo(Lg.x - Math.cos(a) * R * 0.7, Lg.y - Math.sin(a) * R * 0.45)
            .quadraticCurveTo(Lg.x, Lg.y + R * 0.2, Lg.x + Math.cos(a) * R * 0.7, Lg.y + Math.sin(a) * R * 0.45)
            .stroke({ width: 2, color: 0xa8626c, alpha: 0.9 });
        }
      } else {
        const lpts = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          const rad = R * (0.7 + noise(i * 617) * 0.55);
          lpts.push(Lg.x + Math.cos(a) * rad, Lg.y + Math.sin(a) * rad);
        }
        gl.poly(lpts).fill({ color: 0x3f9c38 });
        gl.poly(lpts.map((v, i) => (i % 2 ? v + R * 0.15 : v))).fill({ color: 0x7d1c1c, alpha: 0.8 });
      }
    }
    F.lens = F.lens.filter(Lg => Lg.y <= STAGE_H + 90);

    // ── him, through all of it ───────────────────────────────────────
    let exprId;
    if (bt < P_QM) exprId = 'calm';
    else if (bt < P_BUMP) exprId = 'focused';
    else if (bt < P_ARM) exprId = 'hurt';
    else if (bt < P_BEAT) exprId = 'rage';
    else exprId = 'angry';
    const A = {
      faceX: armed ? 0.55 : 0.35,
      faceY: 1,
      blink: 0,
      lookX: 0.7, lookY: 0.1,
      exprId,
      expr: EXPRESSIONS[exprId] || EXPRESSIONS.calm,
    };
    const r = 26;
    // He leans into each swing, on the same clock as the plate.
    const lean = armed ? Math.sin((bt - P_ARM) * 62) * 0.10 : 0;
    const gb = S.gBody;
    gb.clear();
    const half = heroHalfPoints(r, 14);
    const bpts = [];
    for (let i = 0; i < half.length; i += 2) bpts.push(half[i], half[i + 1]);
    for (let i = half.length - 2; i >= 0; i -= 2) bpts.push(-half[i], half[i + 1]);
    const bca = Math.cos(lean), bsa = Math.sin(lean);
    const spun = [];
    for (let i = 0; i < bpts.length; i += 2) {
      spun.push(bpts[i] * bca - bpts[i + 1] * bsa, bpts[i + 1] * bca + bpts[i] * bsa);
    }
    gb.poly(spun).fill({ color: 0x1a6f96 });
    const inner = [];
    for (let i = 0; i < spun.length; i += 2) inner.push(spun[i] * 0.82 - r * 0.05, spun[i + 1] * 0.82 - r * 0.06);
    gb.poly(inner).fill({ color: 0x5fd6ff, alpha: 0.92 });
    gb.poly(spun).stroke({ width: 1.6, color: 0xdff4ff, alpha: 0.55 });
    // Blood on HIM, building up. He is standing in it.
    if (F.slimeHp < 0.8) {
      for (let i = 0; i < 5; i++) {
        const a = noise(i * 449 + 7) * TAU;
        gb.circle(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * (0.07 + noise(i * 53) * 0.09))
          .fill({ color: 0x8a1414, alpha: 0.55 * (1 - F.slimeHp) });
      }
    }
    const gf = S.gFace;
    gf.clear();
    drawHeroFace(gf, 0, 0, r, lean, 1, 1, A, null);

    // ── and then there are more of them ──────────────────────────────
    const gm = F.gMore;
    gm.clear();
    if (bt > P_MORE) {
      const k = easeOut(clamp01((bt - P_MORE) / (1 - P_MORE)));
      for (let i = 0; i < 7; i++) {
        const n = noise(i * 1301 + 11);
        const ex = lerp(-60 - n * 120, 60 + n * 200, k) + (i % 2 ? 0 : STAGE_W - 120 * n);
        const ey = 150 + n * 220;
        const er = 16 + n * 12;
        gm.ellipse(ex, ey, er, er * 0.86).fill({ color: 0x3f9c38, alpha: 0.95 });
        gm.ellipse(ex, ey, er, er * 0.86).stroke({ width: 1.6, color: 0x14340f, alpha: 0.8 });
        for (const s2 of [-1, 1]) {
          gm.circle(ex + s2 * er * 0.34, ey - er * 0.16, er * 0.18).fill({ color: 0xffffff });
          gm.circle(ex + s2 * er * 0.34, ey - er * 0.16, er * 0.08).fill({ color: 0x100c08 });
        }
      }
      this._once('moreArrive', () => { Audio.hit && Audio.hit(); });
    }
  }


  // ══════════════════════════════════════════════════════════════════
  // BEAT 0 — THE COMIC BOOK
  // ══════════════════════════════════════════════════════════════════
  // Timmy's brief, 2026-08-23: the origin is told as comic panels that SLAM
  // onto a black page one at a time, each with a thick white border and a
  // slight irregular rotation, the whole stage shaking on every landing.
  //
  // HE SUGGESTED generating the panel art in Leonardo.ai. That cannot ship:
  // this project has ZERO image assets by rule, and a raster panel would sit
  // inside a game whose every other pixel is drawn in code. So the panels are
  // hand-built vector, in flat comic ink — which is also the style that suits
  // code-built art best: heavy black holding lines, few flat colours, no
  // gradients to go subtly wrong.
  //
  // Deliberately NO FillGradient anywhere below. In Pixi v8 a gradient defaults
  // to LOCAL texture space, so absolute coordinates collapse to one flat colour
  // and the failure is silent (waterdrop-pixi-pitfalls, trap 2). Flat fills
  // with alpha stacking give the same read and cannot break.
  //
  // Panels are painted ONCE into their own Graphics and then only transformed,
  // matching the discipline the rest of this file already follows.

  /** The page. Coordinates are stage units; overlaps are intentional. */
  _comicPanels() {
    return [
      { x:  38, y:  30, w: 384, h: 214, rot: -1.4, at: 0.55,
        paint: (g, w, h) => this._comicLake(g, w, h),
        cap: 'DALARNA. A lake nobody had ever\nhad a reason to look at.' },

      { x: 452, y:  26, w: 252, h: 146, rot:  1.9, at: 2.35,
        paint: (g, w, h) => this._comicTear(g, w, h),
        cap: 'Then the sky tore open.' },

      { x: 556, y: 150, w: 372, h: 232, rot: -0.9, at: 4.15,
        paint: (g, w, h) => this._comicCrash(g, w, h),
        cap: 'It did not land. It PLOUGHED.' },

      { x:  38, y: 268, w: 236, h: 176, rot:  1.3, at: 6.05,
        paint: (g, w, h) => this._comicDrop(g, w, h),
        cap: 'One drop drank it.' },

      { x: 292, y: 300, w: 292, h: 206, rot: -1.7, at: 7.95,
        paint: (g, w, h) => this._comicGrey(g, w, h),
        cap: 'The pilot was already dead.\nSomething tore the arm off.' },

      { x: 604, y: 398, w: 320, h: 126, rot:  1.0, at: 9.85,
        paint: (g, w, h) => this._comicAida(g, w, h),
        cap: '"Oh good. You are awake."' },
    ];
  }

  _buildComic() {
    const S = new Container();
    S.visible = false;
    this.sceneComic = S;
    this.root.addChild(S);

    // The page itself: black, with a faint newsprint tone so the white borders
    // have something to sit on rather than floating in a void.
    const page = new Graphics();
    page.rect(0, 0, STAGE_W, STAGE_H).fill({ color: 0x05070c, alpha: 1 });
    page.rect(0, 0, STAGE_W, STAGE_H).fill({ color: 0x0d1420, alpha: 0.45 });
    S.addChild(page);

    this.cm = { panels: [], shake: 0 };

    this._comicPanels().forEach((spec, i) => {
      const P = new Container();
      P.x = spec.x + spec.w / 2;
      P.y = spec.y + spec.h / 2;
      P.visible = false;
      S.addChild(P);

      // Drop shadow first, so a panel reads as lying ON the page.
      const sh = new Graphics();
      sh.rect(-spec.w / 2 + 6, -spec.h / 2 + 7, spec.w, spec.h)
        .fill({ color: 0x000000, alpha: 0.55 });
      P.addChild(sh);

      // The white border, then the ink plate inside it.
      const border = new Graphics();
      border.rect(-spec.w / 2, -spec.h / 2, spec.w, spec.h)
        .fill({ color: 0xf4f1e8, alpha: 1 });
      border.rect(-spec.w / 2 + 5, -spec.h / 2 + 5, spec.w - 10, spec.h - 10)
        .fill({ color: 0x070b12, alpha: 1 });
      P.addChild(border);

      // Art, drawn in its own 0..w / 0..h space and shifted into place, so each
      // painter can think in plain panel coordinates.
      const art = new Graphics();
      art.x = -spec.w / 2 + 5;
      art.y = -spec.h / 2 + 5;
      spec.paint(art, spec.w - 10, spec.h - 10);
      P.addChild(art);

      // A mask, so no painter can bleed past its own frame.
      const mask = new Graphics();
      mask.rect(-spec.w / 2 + 5, -spec.h / 2 + 5, spec.w - 10, spec.h - 10)
        .fill({ color: 0xffffff });
      P.addChild(mask);
      art.mask = mask;

      // Caption box, bottom-left, the way a comic sets narration.
      if (spec.cap) {
        const lines = spec.cap.split('\n').length;
        const boxH = 12 + lines * 15;
        const boxW = Math.min(spec.w - 26, 250);
        const cbox = new Graphics();
        cbox.rect(-spec.w / 2 + 13, spec.h / 2 - 13 - boxH, boxW, boxH)
          .fill({ color: 0xf4f1e8, alpha: 0.96 });
        cbox.rect(-spec.w / 2 + 13, spec.h / 2 - 13 - boxH, boxW, boxH)
          .stroke({ width: 2, color: 0x070b12, alpha: 1 });
        P.addChild(cbox);

        const txt = new Text({
          text: spec.cap,
          style: new TextStyle({
            fontFamily: 'VT323, monospace',
            fontSize: 15,
            fill: 0x0a1018,
            lineHeight: 15,
            letterSpacing: 0.5,
            wordWrap: true,
            wordWrapWidth: boxW - 14,
          }),
        });
        txt.x = -spec.w / 2 + 20;
        txt.y = spec.h / 2 - 13 - boxH + 6;
        P.addChild(txt);
      }

      this.cm.panels.push({ spec, node: P, i });
    });

    // ── The title card ────────────────────────────────────────────────
    // Lands last, over everything, and is the full stop on the sequence.
    const T = new Container();
    T.x = STAGE_W / 2;
    T.y = STAGE_H / 2;
    T.visible = false;
    S.addChild(T);

    const wash = new Graphics();
    wash.rect(-STAGE_W / 2, -STAGE_H / 2, STAGE_W, STAGE_H)
      .fill({ color: 0x02040a, alpha: 0.82 });
    T.addChild(wash);

    const t1 = new Text({
      text: 'WATERDROP SURVIVOR',
      style: new TextStyle({
        fontFamily: 'Cinzel, serif', fontSize: 54, fontWeight: '800',
        fill: 0xe9dcb6, letterSpacing: 6,
      }),
    });
    t1.anchor.set(0.5); t1.y = -26;
    T.addChild(t1);

    const t2 = new Text({
      text: 'THE CONSPIRACY CUT',
      style: new TextStyle({
        fontFamily: 'VT323, monospace', fontSize: 26,
        fill: 0x7ce0ea, letterSpacing: 10,
      }),
    });
    t2.anchor.set(0.5); t2.y = 26;
    T.addChild(t2);

    const rule = new Graphics();
    rule.rect(-190, 6, 380, 2).fill({ color: 0xc9a463, alpha: 0.8 });
    T.addChild(rule);

    this.cm.title = T;
    this.cm.titleAt = 12.2;
  }

  /** Per-frame. Slams each panel in on its cue and shakes the page. */
  _beatComic(dt) {
    const C = this.cm;
    if (!C) return;
    const t = this.beatT;
    const SLAM = 0.26;               // how long a panel takes to land

    C.panels.forEach((p) => {
      const { spec, node, i } = p;
      const k = (t - spec.at) / SLAM;
      if (k < 0) { node.visible = false; return; }
      node.visible = true;

      if (k < 1) {
        // Overshoot on the way in: a panel thrown down bounces once. Scale
        // starts large so it reads as coming AT the reader, not growing.
        const e = 1 - Math.pow(1 - k, 3);
        const over = 1 + Math.sin(k * Math.PI) * 0.06;
        node.scale.set(lerp(1.55, 1, e) * over);
        node.alpha = clamp01(k * 2.2);
        node.rotation = ((spec.rot * 3.4) * (1 - e) + spec.rot) * (Math.PI / 180);
      } else {
        node.scale.set(1);
        node.alpha = 1;
        node.rotation = spec.rot * (Math.PI / 180);
      }

      this._once('comic' + i, () => {
        Audio.comicSlam && Audio.comicSlam(i);
        C.shake = 1;
      });
    });

    // Title card.
    if (C.title) {
      const k = (t - C.titleAt) / 0.5;
      if (k < 0) { C.title.visible = false; }
      else {
        C.title.visible = true;
        const e = 1 - Math.pow(1 - clamp01(k), 3);
        C.title.alpha = clamp01(k * 1.8);
        C.title.scale.set(lerp(1.22, 1, e));
        this._once('comicTitleSfx', () => { Audio.comicTitle && Audio.comicTitle(); C.shake = 1.4; });
      }
    }

    // Shake decays on the SAME root offsets the fight beat uses, so the two
    // can never fight over the stage position.
    C.shake = Math.max(0, C.shake - dt * 4.2);
    const s = C.shake * 9;
    this.root.x = this._rootX0 + (Math.random() - 0.5) * s;
    this.root.y = this._rootY0 + (Math.random() - 0.5) * s;

    // Fade the whole page out into the lake beat.
    const dur = BEATS[this.beatIdx].dur;
    if (t > dur - 1.1) this.fade.alpha = clamp01((t - (dur - 1.1)) / 1.1);
    else this.fade.alpha = 0;
  }

  // ── Panel art ───────────────────────────────────────────────────────
  // Flat comic ink: a few solid colours, heavy black holding lines, no
  // gradients. Each painter works in plain 0..w / 0..h panel space.

  /** 1. The lake in Dalarna, before any of it. */
  _comicLake(g, w, h) {
    const hz = h * 0.52;
    g.rect(0, 0, w, hz).fill({ color: 0x2a3a5c });               // dusk sky
    g.rect(0, 0, w, hz * 0.45).fill({ color: 0x3c4a6b, alpha: 0.7 });
    g.circle(w * 0.74, hz * 0.34, 15).fill({ color: 0xf0ead2 }); // moon
    g.rect(0, hz, w, h - hz).fill({ color: 0x101d33 });          // water
    // Moon streak on the water: stacked bars, widest near the shore.
    for (let i = 0; i < 8; i++) {
      const yy = hz + 6 + i * ((h - hz) / 9);
      const ww = 10 + i * 5;
      g.rect(w * 0.74 - ww / 2, yy, ww, 2).fill({ color: 0xd8e6f2, alpha: 0.30 - i * 0.03 });
    }
    // Pine treeline — deterministic, so it never shimmers between rebuilds.
    for (let i = 0; i < 26; i++) {
      const x = (i / 25) * w;
      const th = 26 + noise(i * 7) * 40;
      g.moveTo(x, hz)
        .lineTo(x - 7 - noise(i * 3) * 4, hz)
        .lineTo(x, hz - th)
        .lineTo(x + 7 + noise(i * 5) * 4, hz)
        .fill({ color: 0x0a1420 });
    }
    g.rect(0, hz - 1, w, 2).fill({ color: 0x05080f });
  }

  /** 2. The sky tears. */
  _comicTear(g, w, h) {
    g.rect(0, 0, w, h).fill({ color: 0x0b1226 });
    for (let i = 0; i < 22; i++) {
      g.circle(noise(i * 11) * w, noise(i * 17) * h, 1 + noise(i * 5) * 1.2)
        .fill({ color: 0xdbe8ff, alpha: 0.5 + noise(i) * 0.5 });
    }
    // A ragged rip: two mirrored zigzags meeting at the middle.
    const cx = w * 0.52;
    const pts = [];
    for (let i = 0; i <= 9; i++) {
      const t = i / 9;
      pts.push({ x: cx + (noise(i * 13) - 0.5) * 26, y: t * h });
    }
    g.moveTo(pts[0].x - 3, pts[0].y);
    pts.forEach(p => g.lineTo(p.x - 3 - noise(p.y) * 5, p.y));
    for (let i = pts.length - 1; i >= 0; i--) {
      g.lineTo(pts[i].x + 3 + noise(pts[i].y * 2) * 5, pts[i].y);
    }
    g.fill({ color: 0xc9ffe6 });
    // The green bleeding out of it.
    g.moveTo(cx - 26, 0).lineTo(cx + 26, 0).lineTo(cx + 14, h).lineTo(cx - 14, h)
      .fill({ color: 0x5fe08a, alpha: 0.16 });
  }

  /** 3. The saucer ploughs into the water. */
  _comicCrash(g, w, h) {
    g.rect(0, 0, w, h * 0.46).fill({ color: 0x141f38 });
    g.rect(0, h * 0.46, w, h * 0.54).fill({ color: 0x0b1728 });
    // Speed lines coming in from the upper left.
    for (let i = 0; i < 16; i++) {
      const y0 = -20 + i * 9;
      g.moveTo(-10, y0).lineTo(w * 0.62, y0 + w * 0.30)
        .stroke({ width: 1 + noise(i) * 2, color: 0xffffff, alpha: 0.10 + noise(i * 3) * 0.14 });
    }
    // The saucer: a squashed hull with a dome, tilted into the dive.
    const cx = w * 0.60, cy = h * 0.50;
    g.ellipse(cx, cy, 76, 20).fill({ color: 0x8fa6b8 });
    g.ellipse(cx, cy - 3, 76, 16).fill({ color: 0xc3d3df });
    g.ellipse(cx - 6, cy - 14, 30, 16).fill({ color: 0x7ce0ea, alpha: 0.9 });
    g.ellipse(cx - 6, cy - 16, 22, 10).fill({ color: 0xd8fbff, alpha: 0.8 });
    g.ellipse(cx, cy, 76, 20).stroke({ width: 3, color: 0x060a11 });
    // Impact spray: wedges thrown up and out.
    for (let i = 0; i < 13; i++) {
      const a = -Math.PI * (0.15 + noise(i * 9) * 0.7);
      const len = 34 + noise(i * 5) * 62;
      const x0 = cx - 40 + noise(i * 3) * 90;
      g.moveTo(x0, cy + 12)
        .lineTo(x0 + Math.cos(a) * len - 5, cy + 12 + Math.sin(a) * len)
        .lineTo(x0 + Math.cos(a) * len + 5, cy + 12 + Math.sin(a) * len)
        .fill({ color: 0x5fe08a, alpha: 0.55 });
    }
    // The sludge already spreading.
    g.ellipse(cx, h * 0.86, 110, 20).fill({ color: 0x2f8f5e, alpha: 0.6 });
    g.ellipse(cx, h * 0.86, 70, 12).fill({ color: 0x5fe08a, alpha: 0.5 });
  }

  /** 4. One drop, changed. */
  _comicDrop(g, w, h) {
    g.rect(0, 0, w, h).fill({ color: 0x081422 });
    g.ellipse(w / 2, h * 0.62, w * 0.42, h * 0.30).fill({ color: 0x0f2b3d, alpha: 0.8 });
    // The drop: a teardrop built from a point and a bowl.
    const cx = w / 2, cy = h * 0.54, r = Math.min(w, h) * 0.27;
    g.moveTo(cx, cy - r * 1.75);
    g.bezierCurveTo(cx + r * 0.95, cy - r * 0.5, cx + r, cy + r * 0.35, cx, cy + r);
    g.bezierCurveTo(cx - r, cy + r * 0.35, cx - r * 0.95, cy - r * 0.5, cx, cy - r * 1.75);
    g.fill({ color: 0x6fc9ef });
    // Neon veins crawling through it.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.4;
      g.moveTo(cx, cy - r * 0.2);
      g.lineTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
      g.lineTo(cx + Math.cos(a + 0.28) * r * 0.85, cy + Math.sin(a + 0.28) * r * 0.85);
      g.stroke({ width: 2.4, color: 0x5fe08a, alpha: 0.95 });
    }
    g.circle(cx, cy - r * 0.15, r * 0.24).fill({ color: 0xc9ffe6, alpha: 0.85 });
    // Holding line last, over the fills, the way ink sits over colour.
    g.moveTo(cx, cy - r * 1.75);
    g.bezierCurveTo(cx + r * 0.95, cy - r * 0.5, cx + r, cy + r * 0.35, cx, cy + r);
    g.bezierCurveTo(cx - r, cy + r * 0.35, cx - r * 0.95, cy - r * 0.5, cx, cy - r * 1.75);
    g.stroke({ width: 3, color: 0x04080e });
  }

  /** 5. The dead pilot. */
  _comicGrey(g, w, h) {
    g.rect(0, 0, w, h).fill({ color: 0x0a1018 });
    // Wreck interior: a few canted bulkhead panels.
    for (let i = 0; i < 5; i++) {
      const x = i * (w / 5);
      g.moveTo(x, 0).lineTo(x + w / 5, 0).lineTo(x + w / 5 - 8, h).lineTo(x - 8, h)
        .fill({ color: i % 2 ? 0x14202e : 0x101a26 });
    }
    g.rect(0, h * 0.72, w, 3).fill({ color: 0x1d2c3d });
    // One dying lamp.
    g.circle(w * 0.82, h * 0.16, 26).fill({ color: 0x5fe08a, alpha: 0.12 });
    g.circle(w * 0.82, h * 0.16, 7).fill({ color: 0x9df5c2, alpha: 0.8 });
    // The Grey: slumped, head tipped, one arm gone at the shoulder.
    const bx = w * 0.42, by = h * 0.60;
    g.ellipse(bx, by, 26, 34).fill({ color: 0xbfc9c4 });          // torso
    g.ellipse(bx - 4, by - 46, 24, 29).fill({ color: 0xcfd8d2 }); // head
    g.ellipse(bx - 13, by - 50, 7, 10).fill({ color: 0x070b12 }); // eyes
    g.ellipse(bx + 5, by - 50, 7, 10).fill({ color: 0x070b12 });
    g.moveTo(bx + 20, by - 16).lineTo(bx + 44, by + 10).lineTo(bx + 36, by + 16)
      .lineTo(bx + 14, by - 8).fill({ color: 0xbfc9c4 });         // remaining arm
    // The torn shoulder, and the arm lying apart from it.
    g.circle(bx - 24, by - 18, 9).fill({ color: 0x2f8f5e });
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.7 + noise(i * 7) * 0.9);
      g.moveTo(bx - 24, by - 18)
        .lineTo(bx - 24 + Math.cos(a) * 22, by - 18 + Math.sin(a) * 22)
        .stroke({ width: 2, color: 0x5fe08a, alpha: 0.75 });
    }
    g.ellipse(bx - 66, h * 0.80, 30, 8).fill({ color: 0xbfc9c4 });
    g.ellipse(bx - 66, h * 0.80, 30, 8).stroke({ width: 2, color: 0x070b12 });
    g.ellipse(bx - 90, h * 0.80, 9, 7).fill({ color: 0xcfd8d2 });
  }

  /** 6. A.I.D.A. wakes. */
  _comicAida(g, w, h) {
    g.rect(0, 0, w, h).fill({ color: 0x060d14 });
    // A console screen coming on.
    const sx = 14, sy = 12, sw = w - 28, sh = h - 24;
    g.rect(sx, sy, sw, sh).fill({ color: 0x07202a });
    g.rect(sx, sy, sw, sh).stroke({ width: 3, color: 0x1b3b48 });
    // Scanlines.
    for (let i = 0; i < 14; i++) {
      g.rect(sx + 3, sy + 5 + i * (sh / 14), sw - 6, 1)
        .fill({ color: 0x7ce0ea, alpha: 0.10 });
    }
    // The eye: a lens with a slit, which is all A.I.D.A. ever shows.
    const cx = sx + sw * 0.30, cy = sy + sh * 0.5;
    g.ellipse(cx, cy, 34, 22).fill({ color: 0x0c3a49 });
    g.ellipse(cx, cy, 34, 22).stroke({ width: 2.5, color: 0x7ce0ea });
    g.ellipse(cx, cy, 11, 19).fill({ color: 0x9df5ff });
    g.ellipse(cx, cy, 4, 15).fill({ color: 0x04121a });
    g.circle(cx - 9, cy - 7, 4).fill({ color: 0xffffff, alpha: 0.75 });
    // A voice waveform to its right.
    const wx = sx + sw * 0.56;
    for (let i = 0; i < 22; i++) {
      const a = 4 + Math.abs(Math.sin(i * 1.7)) * (sh * 0.30);
      g.rect(wx + i * 7, cy - a / 2, 3.5, a).fill({ color: 0x7ce0ea, alpha: 0.85 });
    }
  }

  // ── The runner ─────────────────────────────────────────────────────
  _tick(ticker) {
    if (this.destroyed) return;
    // Clamped so a tab-switch or a long GC pause cannot teleport the film.
    const dt = Math.min(0.05, (ticker.deltaMS || 16.7) / 1000);
    this.t += dt;
    this.beatT += dt;

    let beat = BEATS[this.beatIdx];
    if (!beat) { this._finish(); return; }
    if (this.beatT >= beat.dur) {
      this.beatIdx += 1;
      this.beatT = 0;
      beat = BEATS[this.beatIdx];
      if (!beat) { this._finish(); return; }
    }

    // Only the live scene is drawn. _paintAmbient repaints the lake's water,
    // ripples and glitter every frame — 176 stroked curves — so running it
    // under a beat that cannot show them is pure cost.
    const lake = beat.id === 'lake';
    const conspiracy = beat.id === 'conspiracy';
    const comic = beat.id === 'comic';
    if (this.sceneLake) this.sceneLake.visible = lake;
    if (this.sceneConspiracy) this.sceneConspiracy.visible = conspiracy;
    if (this.sceneComic) this.sceneComic.visible = comic;
    if (this.sceneSpace) this.sceneSpace.visible = !lake && !conspiracy && !comic;
    if (comic) this._beatComic(dt);
    else if (lake) { this._paintAmbient(dt); this._beatLake(); }
    else if (conspiracy) this._beatConspiracy();
    else if (beat.id === 'space') this._beatSpace();
    else if (beat.id === 'fight') this._beatFight();
  }

  /** One-shot latch — fire `fn` the first time this is reached. */
  _once(key, fn) {
    if (this._fired[key]) return;
    this._fired[key] = true;
    try { fn(); } catch (e) { /* a missing SFX must never take the film down */ }
  }

  // ── Ambient (runs under every beat) ────────────────────────────────
  _paintAmbient(dt) {
    const t = this.t;

    for (const c of this.clouds) {
      c.g.x += c.sp * dt;
      if (c.g.x > STAGE_W + 260) c.g.x = -300;
    }

    // Reeds sway with a shear, not a rotation — grass bends, it does not pivot.
    for (const r of this.reeds.children) {
      r.skew.x = Math.sin(t * 0.9 + r._ph) * r._amp;
    }

    const g = this.water;
    g.clear();
    // Perspective ripple bands — closer together and thinner toward the far
    // shore, which is the whole reason a flat plane reads as receding water.
    for (let i = 0; i < 46; i++) {
      const f = i / 46;
      const y = HORIZON + Math.pow(f, 2.05) * (STAGE_H - HORIZON);
      const amp = 1.2 + f * 7;
      const wob = Math.sin(t * (0.7 + f * 0.9) + i * 0.7) * amp;
      const alpha = (0.05 + f * 0.13) * (0.6 + 0.4 * Math.sin(t * 0.8 + i));
      g.moveTo(-20, y + wob);
      // Two control points give the band a lazy S rather than a straight rule.
      g.quadraticCurveTo(STAGE_W * 0.33, y - wob * 0.8, STAGE_W * 0.5, y + wob * 0.4);
      g.quadraticCurveTo(STAGE_W * 0.72, y + wob * 1.1, STAGE_W + 20, y - wob * 0.5);
      g.stroke({ width: 0.8 + f * 1.7, color: 0xbcd8ee, alpha });
    }

    // The glitter path: a cone of broken specular under the sun, widening
    // toward the camera. The shot's brightest thing, and its anchor.
    for (let i = 0; i < 130; i++) {
      const n = noise(i * 7717 + 3);
      const n2 = noise(i * 12289 + 29);
      const f = (n + t * 0.045 * (0.4 + n2)) % 1;      // drifts toward camera
      const y = HORIZON + Math.pow(f, 2.0) * (STAGE_H - HORIZON);
      const spread = 8 + f * 190;
      const x = this.sunX + (n2 - 0.5) * spread * 2;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.4 + i * 1.7));
      const len = 1.6 + f * 9;
      g.roundRect(x - len / 2, y - 0.7 - f * 0.5, len, 1.4 + f * 1.1, 1)
        .fill({ color: 0xfff0c8, alpha: (1 - f * 0.55) * tw * 0.7 });
    }

    // Expanding splash rings. Ellipses, not circles — the water plane is seen
    // at a grazing angle.
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age < 0) continue;                 // staggered rings wait their turn
      const k = r.age / r.life;
      if (k >= 1) { this.rings.splice(i, 1); continue; }
      const rad = easeOut(k) * r.max;
      const a = (1 - k) * 0.6;
      g.ellipse(r.x, r.y, rad, rad * 0.30)
        .stroke({ width: 1.6 * (1 - k) + 0.5, color: 0xdff0ff, alpha: a });
      if (rad > 8) {
        g.ellipse(r.x, r.y, rad * 0.62, rad * 0.19)
          .stroke({ width: 1.1 * (1 - k), color: 0xdff0ff, alpha: a * 0.7 });
      }
    }

    // Motes.
    const mg = this.moteG;
    mg.clear();
    let fireIdx = 0;
    for (const m of this.motes) {
      m.x += Math.sin(t * 0.6 + m.ph) * m.sp * dt * 22;
      m.y += Math.cos(t * 0.45 + m.ph * 1.7) * m.sp * dt * 9;
      if (m.x < -10) m.x = STAGE_W + 10;
      if (m.x > STAGE_W + 10) m.x = -10;
      if (m.fire && fireIdx < this.fireflyLights.length) {
        const pulse = Math.max(0, Math.sin(t * 1.6 + m.ph * 3));
        const lit = this.fireflyLights[fireIdx++];
        lit.x = m.x; lit.y = m.y;
        lit.alpha = pulse * 0.55;
        lit.width = lit.height = 18 + pulse * 12;
        mg.circle(m.x, m.y, m.r * 1.1).fill({ color: 0xd9ffa8, alpha: 0.25 + pulse * 0.6 });
      } else {
        mg.circle(m.x, m.y, m.r).fill({ color: 0xffe9c8, alpha: 0.16 + 0.1 * Math.sin(t + m.ph) });
      }
    }
    for (; fireIdx < this.fireflyLights.length; fireIdx++) this.fireflyLights[fireIdx].alpha = 0;

    // A very slow drift so the frame is never perfectly static.
    this.forest.x = Math.sin(t * 0.10) * 2.2;
    this.reflection.x = Math.sin(t * 0.10) * 2.2;
  }

  // ── BEAT 1: the lake ───────────────────────────────────────────────
  // "de e lugnt å fint en fågel flyger förbi en fisk hoppar" — calm, then a
  // bird, then the fish. Nothing threatening happens yet; this beat exists so
  // the crash has something to ruin.
  _beatLake() {
    // Fade up from black.
    this.fade.alpha = 1 - easeOut(clamp01(this.beatT / 1.6));

    this._once('birds', () => Audio.birdChirp && Audio.birdChirp());
    // A second, answering call from further off.
    if (this.beatT > 3.4) this._once('birds2', () => Audio.birdChirp && Audio.birdChirp(0.6));

    // ── The bird ── crosses right-to-left, high, small, unhurried.
    const bStart = 1.2, bDur = 5.4;
    const bg = this.bird;
    bg.clear();
    if (this.beatT > bStart && this.beatT < bStart + bDur) {
      const k = (this.beatT - bStart) / bDur;
      const x = lerp(STAGE_W + 40, -40, k);
      const y = 78 + Math.sin(k * Math.PI * 2.1) * 16 + Math.sin(k * Math.PI * 6) * 3;
      // Flap fast on the climb, slow on the glide — a real bird is not a
      // metronome, so the RATE itself is modulated, not just the wing angle.
      const flapRate = 7 + Math.sin(k * Math.PI * 3) * 4;
      const rise = Math.sin(this.beatT * flapRate) * 6;
      const span = 9;
      bg.moveTo(x - span, y - rise * 0.5)
        .quadraticCurveTo(x - span * 0.45, y - rise, x, y)
        .quadraticCurveTo(x + span * 0.45, y - rise, x + span, y - rise * 0.5)
        .stroke({ width: 1.7, color: 0x1a232e, alpha: 0.85 });
    }

    // ── The fish ── one breach, arcing, splash out and splash back in.
    const fStart = 5.0, fDur = 1.25;
    const fg = this.fish;
    fg.clear();
    if (this.beatT > fStart && this.beatT < fStart + fDur) {
      const k = (this.beatT - fStart) / fDur;
      const fx = STAGE_W * 0.34 + k * 46;
      const surfaceY = HORIZON + 96;
      const fy = surfaceY - arch(k) * 62;
      // Rotate along the flight path: nose up on the way out, down on the way in.
      const ang = lerp(-0.95, 0.95, k);
      const L = 17, Hh = 6.2;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const px = (dx, dy) => [fx + dx * cos - dy * sin, fy + dx * sin + dy * cos];
      const [nx, ny] = px(L, 0);
      const [t1x, t1y] = px(-L, -Hh * 1.15);
      const [t2x, t2y] = px(-L, Hh * 1.15);
      const [ux, uy] = px(0, -Hh);
      const [bx2, by2] = px(0, Hh);
      fg.moveTo(nx, ny)
        .quadraticCurveTo(ux, uy, t1x, t1y)
        .lineTo(t2x, t2y)
        .quadraticCurveTo(bx2, by2, nx, ny)
        .closePath()
        .fill({ color: 0x9fb4c4, alpha: 0.95 });
      // Wet highlight along the back, catching the low sun.
      const [h1x, h1y] = px(L * 0.55, -Hh * 0.45);
      const [h2x, h2y] = px(-L * 0.2, -Hh * 0.72);
      fg.moveTo(h1x, h1y).quadraticCurveTo(ux, uy, h2x, h2y)
        .stroke({ width: 1.5, color: 0xffe4bd, alpha: 0.85 });
      // Droplets thrown off the tail, falling behind it.
      for (let i = 0; i < 7; i++) {
        const n = noise(i * 4099 + 13);
        const dk = clamp01(k - 0.05 - n * 0.22);
        const [ddx, ddy] = px(-L - n * 16, (n - 0.5) * 16);
        fg.circle(ddx, ddy + dk * 90, 0.9 + n * 1.3)
          .fill({ color: 0xdff0ff, alpha: (1 - dk) * 0.75 });
      }

      this._once('fishOut', () => {
        this.rings.push({ x: fx, y: surfaceY, age: 0, life: 1.5, max: 52 });
        Audio.waterDrop && Audio.waterDrop();
      });
      if (k > 0.93) {
        this._once('fishIn', () => {
          this.rings.push({ x: fx, y: surfaceY, age: 0, life: 2.1, max: 74 });
          // A second, wider ring a beat later — one ring reads as a pebble,
          // two staggered read as something with mass going under.
          this.rings.push({ x: fx, y: surfaceY, age: -0.12, life: 2.4, max: 96 });
          Audio.waterDrop && Audio.waterDrop();
        });
      }
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  _finish() {
    if (this._done) return;
    this._done = true;
    this.onDone();
  }

  /** Player pressed SKIP. */
  skip() { this._finish(); }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
    }
    if (this.app) {
      try { this.app.ticker.remove(this._tick, this); } catch (e) { /* already torn down */ }
      try { this.app.destroy(true, { children: true, texture: true }); } catch (e) { /* ignore */ }
      this.app = null;
    }
  }
}

export default IntroCinema;
