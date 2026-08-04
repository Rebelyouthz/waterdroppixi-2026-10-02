// Star Raid — PixiJS renderer. Pure drawing, mirrors pixiRenderer.js's
// separation of concerns.
//
// Lighting follows the project's ONE approved technique (see
// .claude/skills/waterdrop-lighting/SKILL.md): pooled additive sprites off a
// single baked soft-radial texture, positioned/tinted/scaled per frame.
// Never a community glow filter, never a redrawn vector circle per light.
//
// Layout, back to front:
//   nebula  -> far bodies -> starfield -> asteroid belt -> lights
//   -> gore -> world (ships/shots/orbs) -> sparks -> HUD
import {
  Application, Container, Graphics, Text, TextStyle, FillGradient, Sprite,
  ParticleContainer, Particle, Rectangle,
} from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';

const TAU = Math.PI * 2;

export class StarRaidRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.app = new Application();
    this.ready = false;
    const w = canvas.clientWidth || 480, h = canvas.clientHeight || 800;
    this.readyPromise = this.app.init({
      canvas, width: w, height: h, resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true, backgroundColor: 0x03040a, antialias: true, preference: 'webgl',
    }).then(() => { this._build(); this.ready = true; });
  }

  _build() {
    const stage = this.app.stage;

    // --- baked textures -------------------------------------------------
    this.glowTex = this._bakeRadial(128, [
      { offset: 0, color: 'rgba(255,255,255,1)' },
      { offset: 0.4, color: 'rgba(255,255,255,0.4)' },
      { offset: 1, color: 'rgba(255,255,255,0)' },
    ]);
    // Solid core, soft rim — reads as a wet droplet in normal blend and a hot
    // ember under additive + bloom. Same texture profile as the main game's.
    this.partTex = this._bakeRadial(48, [
      { offset: 0, color: 'rgba(255,255,255,1)' },
      { offset: 0.55, color: 'rgba(255,255,255,1)' },
      { offset: 0.8, color: 'rgba(255,255,255,0.55)' },
      { offset: 1, color: 'rgba(255,255,255,0)' },
    ]);

    // --- background stack ------------------------------------------------
    this.gNebula = new Graphics(); stage.addChild(this.gNebula);
    this.gFar    = new Graphics(); stage.addChild(this.gFar);
    this.gStars  = new Graphics(); stage.addChild(this.gStars);
    this.gBelt   = new Graphics(); stage.addChild(this.gBelt);

    // --- foreground, bloomed --------------------------------------------
    // Bloom only over gameplay: bright projectiles, engine flare, explosions
    // and sparks glow while the dark backdrop stays clean.
    this.fg = new Container();
    this.fg.filters = [new AdvancedBloomFilter({ threshold: 0.55, bloomScale: 0.85, brightness: 1.0, blur: 3, quality: 2 })];
    stage.addChild(this.fg);

    this.gLight = new Container(); this.fg.addChild(this.gLight);
    this._lightPool = [];
    for (let i = 0; i < 40; i++) {
      const s = new Sprite(this.glowTex);
      s.anchor.set(0.5); s.blendMode = 'add'; s.visible = false;
      this.gLight.addChild(s);
      this._lightPool.push(s);
    }

    this._goreLayer  = this._makeParticleLayer(260, false); this.fg.addChild(this._goreLayer.pc);
    this.gWorld = new Graphics(); this.fg.addChild(this.gWorld);
    this._sparkLayer = this._makeParticleLayer(520, true);  this.fg.addChild(this._sparkLayer.pc);

    // --- HUD (unbloomed, on top) -----------------------------------------
    this.gHud = new Graphics(); stage.addChild(this.gHud);
    this.bossText = new Text({ text: '', style: new TextStyle({ fontFamily: 'VT323, monospace', fontSize: 15, fill: '#ff8a8a', letterSpacing: 2 }) });
    this.bossText.anchor.set(0.5); stage.addChild(this.bossText);

    this._starsW = 0; this._starsH = 0;
  }

  _bakeRadial(size, colorStops) {
    const tg = new Graphics();
    tg.rect(0, 0, size, size).fill(new FillGradient({
      type: 'radial', center: { x: 0.5, y: 0.5 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, colorStops,
    }));
    const tex = this.app.renderer.generateTexture({ target: tg, antialias: true });
    tg.destroy();
    return tex;
  }

  _makeParticleLayer(count, additive) {
    const pc = new ParticleContainer({
      texture: this.partTex,
      dynamicProperties: { position: true, scale: true, rotation: true, color: true, uvs: false },
      boundsArea: new Rectangle(-2000, -2000, 6000, 6000),
    });
    if (additive) pc.blendMode = 'add';
    const pool = [];
    for (let i = 0; i < count; i++) pool.push(new Particle({ texture: this.partTex, anchorX: 0.5, anchorY: 0.5 }));
    return { pc, pool };
  }

  // Pooled additive light. Silently no-ops past the cap rather than growing
  // the pool without bound — that ceiling is deliberate.
  _emitLight(x, y, r, color, alpha) {
    const i = this._lightIdx;
    if (i >= this._lightPool.length) return;
    const s = this._lightPool[i];
    this._lightIdx++;
    s.visible = true;
    s.position.set(x, y);
    s.width = s.height = r * 2;
    s.tint = color;
    s.alpha = alpha;
  }

  // --- background generation ---------------------------------------------
  _rebuildBackground(W, H) {
    this._starsW = W; this._starsH = H;
    const rnd = (a, b) => a + Math.random() * (b - a);

    // Starfield: five scroll speeds, and within each layer three brightness
    // tiers skewed toward faint, plus a warm minority. A field of identical
    // dots at one alpha is what makes a sky read as flat noise.
    this._starLayers = [];
    const specs = [
      { n: 90, speed: 14, size: 0.5 },
      { n: 70, speed: 26, size: 0.8 },
      { n: 46, speed: 48, size: 1.1 },
      { n: 26, speed: 82, size: 1.6 },
      { n: 12, speed: 130, size: 2.3 },
    ];
    for (const sp of specs) {
      const arr = [];
      for (let i = 0; i < sp.n; i++) {
        const m = Math.random();
        const tier = m < 0.58 ? 0 : m < 0.87 ? 1 : 2;
        arr.push({
          x: Math.random() * W, y: Math.random() * H,
          size: sp.size * (tier === 0 ? 0.6 : tier === 1 ? 1 : 1.55),
          alpha: (tier === 0 ? 0.30 : tier === 1 ? 0.6 : 0.95),
          warm: Math.random() < 0.12,
          flare: tier === 2 && sp.speed > 60,
          tw: Math.random() * TAU,
        });
      }
      this._starLayers.push({ arr, speed: sp.speed });
    }

    // Planets are deliberately absent — they are coming in as authored
    // sprite art, and procedural ones would fight with them. Depth behind
    // the stars comes from a slow-drifting galaxy instead, which is diffuse
    // enough to sit under a sprite without competing.
    this._galaxy = {
      x: rnd(W * 0.2, W * 0.8), y: rnd(-H * 0.4, H * 0.5),
      r: rnd(H * 0.16, H * 0.24), speed: rnd(3, 6), tilt: rnd(-0.5, 0.5),
    };

    // Asteroid belt — closest background layer, tumbling.
    this._belt = [];
    for (let i = 0; i < 26; i++) {
      this._belt.push({
        x: Math.random() * W, y: Math.random() * H,
        r: rnd(3, 11), rot: Math.random() * TAU, spin: rnd(-1.4, 1.4),
        speed: rnd(60, 120), sides: 5 + ((Math.random() * 3) | 0),
      });
    }

    // Nebula clouds — a handful of soft coloured blobs, slowest of all.
    this._nebulas = [];
    const hues = ['#5a2a8a', '#1f5a7a', '#7a2a4a'];
    for (let i = 0; i < 4; i++) {
      this._nebulas.push({
        x: rnd(-W * 0.2, W * 1.2), y: rnd(-H * 0.5, H * 1.2),
        r: rnd(H * 0.16, H * 0.34), color: hues[(Math.random() * hues.length) | 0],
        speed: rnd(2, 5),
      });
    }
  }

  _drawBackground(W, H, dt) {
    // Nebulas
    const gn = this.gNebula; gn.clear();
    for (const n of this._nebulas) {
      n.y += n.speed * dt;
      if (n.y - n.r > H) { n.y = -n.r * 1.2; n.x = Math.random() * W; }
      for (let i = 4; i >= 1; i--) {
        gn.circle(n.x, n.y, n.r * (i / 4)).fill({ color: n.color, alpha: 0.030 });
      }
    }

    // Distant galaxy — slow, diffuse, no hard silhouette to clash with the
    // planet sprites that will sit on this layer later.
    const gf = this.gFar; gf.clear();
    const gx = this._galaxy;
    gx.y += gx.speed * dt;
    if (gx.y - gx.r * 2 > H) { gx.y = -gx.r * 2; gx.x = Math.random() * W; }
    for (let i = 6; i >= 1; i--) {
      gf.ellipse(gx.x, gx.y, gx.r * (i / 6) * 1.15, gx.r * (i / 6) * 0.6)
        .fill({ color: '#6a4fd0', alpha: 0.030 });
    }
    for (let arm = 0; arm < 2; arm++) {
      const base = arm * Math.PI + gx.tilt;
      for (let pass = 0; pass < 3; pass++) {
        gf.moveTo(gx.x, gx.y);
        for (let s = 1; s <= 22; s++) {
          const f = s / 22;
          const rr = gx.r * 0.08 + f * gx.r;
          const aa = base + f * 3.1;
          gf.lineTo(gx.x + Math.cos(aa) * rr, gx.y + Math.sin(aa) * rr * 0.54);
        }
        gf.stroke({
          width: [14, 8, 3][pass],
          color: ['#4a3aa0', '#7a6ae0', '#cfc4ff'][pass],
          alpha: [0.13, 0.17, 0.22][pass],
        });
      }
    }
    gf.ellipse(gx.x, gx.y, gx.r * 0.3, gx.r * 0.16).fill({ color: '#e6c8ff', alpha: 0.26 });
    gf.ellipse(gx.x, gx.y, gx.r * 0.14, gx.r * 0.075).fill({ color: '#fff4ff', alpha: 0.6 });

    // Starfield — collected into tiers first, because Graphics fills every
    // shape accumulated since the last fill() in one go.
    const gs = this.gStars; gs.clear();
    if (!this._starBuckets) this._starBuckets = [[], [], [], [], [], []];
    const bk = this._starBuckets;
    for (const b of bk) b.length = 0;
    const flares = [];
    for (const layer of this._starLayers) {
      for (const s of layer.arr) {
        s.y += layer.speed * dt;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
        s.tw += dt * 2.2;
        const tw = 0.82 + Math.sin(s.tw) * 0.18;
        const tier = s.alpha > 0.8 ? 2 : s.alpha > 0.45 ? 1 : 0;
        bk[tier * 2 + (s.warm ? 1 : 0)].push(s.x, s.y, s.size * tw);
        if (s.flare) flares.push(s.x, s.y, s.size * 4.4, s.warm ? 1 : 0);
      }
    }
    const cool = '#cfe8ff', warm = '#ffd9b0';
    const tierAlpha = [0.34, 0.62, 0.95];
    for (let i = 0; i < 6; i++) {
      const arr = bk[i];
      if (!arr.length) continue;
      for (let k = 0; k < arr.length; k += 3) gs.circle(arr[k], arr[k + 1], arr[k + 2]);
      gs.fill({ color: (i & 1) ? warm : cool, alpha: tierAlpha[i >> 1] });
    }
    for (let i = 0; i < flares.length; i += 4) {
      const fx = flares[i], fy = flares[i + 1], fl = flares[i + 2];
      gs.moveTo(fx - fl, fy).lineTo(fx + fl, fy).moveTo(fx, fy - fl).lineTo(fx, fy + fl)
        .stroke({ width: 0.7, color: flares[i + 3] ? warm : cool, alpha: 0.4 });
    }

    // Asteroid belt
    const gb = this.gBelt; gb.clear();
    for (const a of this._belt) {
      a.y += a.speed * dt;
      a.rot += a.spin * dt;
      if (a.y - a.r > H) { a.y = -a.r; a.x = Math.random() * W; }
      const pts = [];
      for (let i = 0; i < a.sides; i++) {
        const ang = a.rot + (i / a.sides) * TAU;
        const rr = a.r * (0.72 + ((i * 37) % 5) * 0.07);
        pts.push(a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr);
      }
      gb.poly(pts).fill({ color: '#5a5348', alpha: 0.62 });
      gb.circle(a.x - a.r * 0.25, a.y - a.r * 0.25, a.r * 0.3).fill({ color: '#8a8375', alpha: 0.35 });
    }
  }

  // --- ship silhouettes ---------------------------------------------------
  // Every hull is built from a local point list and rotated into place, so
  // ships bank into their turns instead of sliding around flat. Enemy hulls
  // point DOWN (they are descending on the player); the player's points UP.
  _hull(g, x, y, ang, pts, fill, stroke, strokeW) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const out = [];
    for (let i = 0; i < pts.length; i += 2) {
      out.push(x + pts[i] * c - pts[i + 1] * s, y + pts[i] * s + pts[i + 1] * c);
    }
    const shape = g.poly(out);
    if (fill) shape.fill(fill);
    if (stroke) shape.stroke({ width: strokeW || 1.5, color: stroke });
    return out;
  }

  _drawEnemyShip(g, e, dt) {
    const r = e.r, ang = (e.rot || 0) + Math.PI / 2; // local +X faces down
    const flash = e.hit > 0;
    const body = flash ? '#ffffff' : e.color;
    const dark = flash ? '#ffffff' : '#1b2230';

    switch (e.kind) {
      case 'shooter': {
        // Gunship: broad wings, twin barrels, armoured cockpit.
        this._hull(g, e.x, e.y, ang, [
          r * 1.15, 0, r * 0.2, -r * 0.95, -r * 0.5, -r * 0.72,
          -r * 0.35, 0, -r * 0.5, r * 0.72, r * 0.2, r * 0.95,
        ], body, dark, 2);
        this._hull(g, e.x, e.y, ang, [r * 0.5, -r * 0.3, r * 0.5, r * 0.3, -r * 0.1, r * 0.22, -r * 0.1, -r * 0.22], dark);
        this._hull(g, e.x, e.y, ang, [r * 0.35, -r * 0.16, r * 0.35, r * 0.16, r * 0.05, r * 0.12, r * 0.05, -r * 0.12], '#8fe6ff');
        // barrel tips glow while the shot is charging
        if (e.cd < 0.35) {
          const chg = 1 - e.cd / 0.35;
          for (const side of [-1, 1]) {
            const bx = e.x + Math.cos(ang) * r * 1.0 - Math.sin(ang) * side * r * 0.5;
            const by = e.y + Math.sin(ang) * r * 1.0 + Math.cos(ang) * side * r * 0.5;
            g.circle(bx, by, 2 + chg * 2.5).fill({ color: '#ff8866', alpha: 0.4 + chg * 0.6 });
            this._emitLight(bx, by, 14 * chg, '#ff5533', 0.5 * chg);
          }
        }
        break;
      }
      case 'bomber': {
        // Heavy hauler: fat hull, side pods, slow.
        this._hull(g, e.x, e.y, ang, [
          r * 1.0, -r * 0.35, r * 1.0, r * 0.35, r * 0.1, r * 0.8,
          -r * 0.8, r * 0.55, -r * 0.8, -r * 0.55, r * 0.1, -r * 0.8,
        ], body, dark, 2);
        for (const side of [-1, 1]) {
          this._hull(g, e.x, e.y, ang, [
            r * 0.45, side * r * 0.62, r * 0.45, side * r * 1.0,
            -r * 0.5, side * r * 1.0, -r * 0.5, side * r * 0.62,
          ], dark, body, 1);
        }
        this._hull(g, e.x, e.y, ang, [r * 0.55, -r * 0.2, r * 0.55, r * 0.2, r * 0.1, r * 0.15, r * 0.1, -r * 0.15], '#ffd08a');
        break;
      }
      case 'interceptor': {
        // Needle: swept wings, all forward momentum.
        this._hull(g, e.x, e.y, ang, [
          r * 1.35, 0, -r * 0.25, -r * 0.34, -r * 0.95, -r * 0.85,
          -r * 0.55, 0, -r * 0.95, r * 0.85, -r * 0.25, r * 0.34,
        ], body, dark, 1.6);
        this._hull(g, e.x, e.y, ang, [r * 0.7, -r * 0.1, r * 0.7, r * 0.1, r * 0.2, r * 0.16, r * 0.2, -r * 0.16], '#c8f4ff');
        break;
      }
      default: {
        // Drone: compact delta with a sensor eye.
        this._hull(g, e.x, e.y, ang, [
          r * 1.05, 0, -r * 0.45, -r * 0.85, -r * 0.2, 0, -r * 0.45, r * 0.85,
        ], body, dark, 1.6);
        this._hull(g, e.x, e.y, ang, [r * 0.4, -r * 0.14, r * 0.4, r * 0.14, r * 0.0, r * 0.2, r * 0.0, -r * 0.2], '#0f1622');
        g.circle(
          e.x + Math.cos(ang) * r * 0.25, e.y + Math.sin(ang) * r * 0.25, r * 0.16,
        ).fill({ color: flash ? '#ffffff' : '#ff5a5a', alpha: 0.9 });
        break;
      }
    }

    // Engine flare out the back of every hull, pulsing.
    const ex = e.x - Math.cos(ang) * r * 0.85;
    const ey = e.y - Math.sin(ang) * r * 0.85;
    const pulse = 0.75 + Math.sin((e._t = (e._t || 0) + dt * 14)) * 0.25;
    g.circle(ex, ey, r * 0.26 * pulse).fill({ color: '#ffb066', alpha: 0.85 });
    this._emitLight(ex, ey, r * 1.5 * pulse, '#ff8a33', 0.35);
  }

  _drawPlayerShip(g, p, game, dt) {
    const bank = p.bank * 0.55;
    const hit = p.hit > 0;
    const shipColor = hit ? '#ffffff' : (game.shipColor || '#5fd6ff');
    const dark = hit ? '#ffffff' : '#0a2033';

    // Hull shape follows the ship you actually chose — a roster where every
    // hull looks the same is a roster you cannot see.
    const HULLS = {
      // long, thin, swept right back
      interceptor: [0, -25, -4, -8, -11, 6, -9, 15, -3, 9, 0, 13, 3, 9, 9, 15, 11, 6, 4, -8],
      // wide and blunt with squared shoulders and outboard gun pods
      gunship: [0, -17, -9, -8, -19, -2, -18, 9, -10, 7, -5, 14, 5, 14, 10, 7, 18, 9, 19, -2, 9, -8],
      // fat, slab-sided cargo body
      hauler: [0, -15, -11, -9, -16, 2, -14, 15, 14, 15, 16, 2, 11, -9],
      skiff: [0, -20, -6, -6, -15, 4, -13, 13, -5, 8, 0, 12, 5, 8, 13, 13, 15, 4, 6, -6],
    };
    const hull = HULLS[game.shipId] || HULLS.skiff;
    this._hull(g, p.x, p.y, bank, hull, shipColor, dark, 2);
    // canopy
    this._hull(g, p.x, p.y, bank, [0, -14, -4, -4, 0, 0, 4, -4], '#d8fbff');

    if (game.shipId === 'gunship') {
      // outboard cannons, which is what the extra barrel looks like
      for (const side of [-1, 1]) {
        this._hull(g, p.x, p.y, bank, [side * 13, -6, side * 17, -6, side * 17, 6, side * 13, 6], dark);
        this._hull(g, p.x, p.y, bank, [side * 14, -14, side * 16, -14, side * 16, -5, side * 14, -5], '#9fb4c8');
      }
    } else if (game.shipId === 'hauler') {
      // cargo ribs
      for (const y of [-4, 1, 6]) this._hull(g, p.x, p.y, bank, [-14, y, 14, y, 14, y + 1.6, -14, y + 1.6], dark);
    } else {
      // wing stripes
      this._hull(g, p.x, p.y, bank, [-13, 4, -8, 4, -7, 11, -12, 11], dark);
      this._hull(g, p.x, p.y, bank, [13, 4, 8, 4, 7, 11, 12, 11], dark);
    }

    if (p.iframes > 0) {
      // shield bubble flickers while invulnerable
      const a = 0.25 + Math.abs(Math.sin(p.iframes * 22)) * 0.4;
      g.circle(p.x, p.y, p.r + 7).stroke({ width: 2, color: '#9fe8ff', alpha: a });
      g.circle(p.x, p.y, p.r + 7).fill({ color: '#5fd6ff', alpha: a * 0.12 });
    }

    // Twin engine flares — longer and brighter under thrust, and the real
    // light source is a pooled additive sprite, not a filter.
    const thrust = Math.min(1, Math.hypot(p.vx, p.vy) / 240);
    const flick = 0.8 + Math.random() * 0.2;
    const len = (10 + thrust * 16) * flick;
    for (const side of [-1, 1]) {
      const lx = p.x + Math.cos(bank) * (side * 7) - Math.sin(bank) * 10;
      const ly = p.y + Math.sin(bank) * (side * 7) + Math.cos(bank) * 10;
      this._hull(g, lx, ly, bank, [-3, 0, 3, 0, 1.2, len, -1.2, len], '#ffd9a0');
      this._hull(g, lx, ly, bank, [-1.5, 0, 1.5, 0, 0, len * 0.7], '#ffffff');
      // light sits partway down the flare, in the flare's own direction
      const gx = lx - Math.sin(bank) * -len * 0.45;
      const gy = ly + Math.cos(bank) * len * 0.45;
      this._emitLight(gx, gy, 18 + thrust * 14, game.shipColor || '#5fd6ff', 0.30 + thrust * 0.25);
    }
  }

  _drawBoss(g, b, dt) {
    const r = b.r;
    const flash = b.hit > 0;
    const hull = flash ? '#ffffff' : '#5a2230';
    const trim = flash ? '#ffffff' : '#ff6a6a';
    // Capital ship: wide dagger hull with two weapon sponsons.
    this._hull(g, b.x, b.y, Math.PI / 2, [
      r * 1.0, 0, r * 0.35, -r * 0.55, r * 0.1, -r * 1.0,
      -r * 0.55, -r * 0.9, -r * 0.85, -r * 0.35,
      -r * 0.85, r * 0.35, -r * 0.55, r * 0.9,
      r * 0.1, r * 1.0, r * 0.35, r * 0.55,
    ], hull, trim, 3);
    for (const side of [-1, 1]) {
      this._hull(g, b.x, b.y, Math.PI / 2, [
        r * 0.7, side * r * 0.55, r * 0.7, side * r * 0.92,
        r * 0.05, side * r * 0.92, r * 0.05, side * r * 0.55,
      ], '#2a1018', trim, 2);
    }
    // core — pulses harder the lower its health, reading as "about to blow"
    const frac = Math.max(0, b.hp / b.maxHp);
    const pulse = 0.6 + Math.sin(b._t = (b._t || 0) + dt * (4 + (1 - frac) * 12)) * 0.4;
    g.circle(b.x, b.y, r * 0.34).fill({ color: '#3a1010', alpha: 0.9 });
    g.circle(b.x, b.y, r * 0.24 * (0.8 + pulse * 0.3)).fill({ color: '#ff5533', alpha: 0.5 + pulse * 0.5 });
    this._emitLight(b.x, b.y, r * 1.1 * pulse, '#ff4422', 0.35 + (1 - frac) * 0.3);
    // engine bank
    for (let i = -1; i <= 1; i++) {
      const ex = b.x + i * r * 0.36, ey = b.y - r * 0.95;
      g.circle(ex, ey, r * 0.11).fill({ color: '#ffb066', alpha: 0.85 });
      this._emitLight(ex, ey, r * 0.5, '#ff8a33', 0.3);
    }
  }

  _drawExplodeRing(g, ex, dt, scale = 1) {
    ex.t += dt;
    const a = Math.max(0, 1 - ex.t / (0.7 * scale));
    if (a <= 0) return;
    g.circle(ex.x, ex.y, (10 + ex.t * 200) * scale).stroke({ width: 5 * a * scale, color: '#ff7a1a', alpha: a * 0.8 });
    g.circle(ex.x, ex.y, (6 + ex.t * 110) * scale).stroke({ width: 2, color: '#ffe066', alpha: a * 0.6 });
    this._emitLight(ex.x, ex.y, (60 + ex.t * 220) * scale, '#ff7a1a', a * 0.7);
  }

  resize(w, h) {
    if (!this.ready) return;
    this.app.renderer.resize(w, h);
  }

  destroy() {
    this.readyPromise.then(() => { try { this.app.destroy(true, { children: true }); } catch (e) {} });
  }

  render(game) {
    if (!this.ready) return;
    const W = game.W, H = game.H;
    const dt = Math.min(0.05, game.dt || 1 / 60);
    if (Math.abs(W - this._starsW) > 4 || Math.abs(H - this._starsH) > 4) this._rebuildBackground(W, H);

    this._lightIdx = 0;
    this._drawBackground(W, H, dt);

    const g = this.gWorld; g.clear();
    const p = game.player;

    if (!game._shipExplodeRing) this._drawPlayerShip(g, p, game, dt);
    else this._drawExplodeRing(g, game._shipExplodeRing, dt);
    if (game._bossExplodeRing) this._drawExplodeRing(g, game._bossExplodeRing, dt, 1.8);

    for (const e of game.enemies) {
      this._drawEnemyShip(g, e, dt);
      if (e.hp < e.maxHp) {
        const w = e.r * 1.8;
        g.rect(e.x - w / 2, e.y - e.r - 9, w, 3).fill({ color: '#000000', alpha: 0.65 });
        g.rect(e.x - w / 2, e.y - e.r - 9, w * Math.max(0, e.hp / e.maxHp), 3).fill('#ff5566');
      }
    }

    if (game.boss) {
      this._drawBoss(g, game.boss, dt);
      this.bossText.visible = true;
      this.bossText.text = game.boss.name || 'HULL BREAKER';
      this.bossText.position.set(game.boss.x, game.boss.y - game.boss.r - 20);
    } else {
      this.bossText.visible = false;
    }

    // Player shots — bright bolt with a trailing streak and its own light.
    for (const pr of game.projs) {
      const col = pr.color || '#fff44d';
      const len = 12;
      g.rect(pr.x - 1.6, pr.y - len * 0.5, 3.2, len).fill({ color: col, alpha: 0.55 });
      g.circle(pr.x, pr.y, 2.6).fill('#ffffff');
      g.circle(pr.x, pr.y + 3, 1.8).fill({ color: col, alpha: 0.8 });
      this._emitLight(pr.x, pr.y, 22, col, 0.30);
    }
    // Enemy shots — hostile red, and they light the field too so incoming
    // fire is legible against a busy background.
    for (const ep of game.eprojs) {
      const col = ep.color || '#ff5566';
      g.circle(ep.x, ep.y, 4.6).fill({ color: col, alpha: 0.35 });
      g.circle(ep.x, ep.y, 2.8).fill(col);
      g.circle(ep.x - 0.8, ep.y - 0.8, 1.2).fill({ color: '#ffe0e0', alpha: 0.9 });
      this._emitLight(ep.x, ep.y, 18, col, 0.34);
    }

    // Pickups — faceted crystals, matching the main game's XP orbs.
    for (const o of game.orbs) {
      const isXp = o.kind === 'xp';
      const s = isXp ? 5.5 : 5;
      const cy = o.y + Math.sin((o.t = (o.t || 0) + dt * 5)) * 1.5;
      const hw = s * 0.7;
      const litSide = isXp ? '#7cc4ff' : '#ffd166';
      const darkSide = isXp ? '#2b5da8' : '#8a6420';
      g.poly([o.x, cy - s, o.x, cy + s, o.x - hw, cy]).fill(darkSide);
      g.poly([o.x, cy - s, o.x + hw, cy, o.x, cy + s]).fill(litSide);
      g.poly([o.x, cy - s, o.x - hw * 0.45, cy - s * 0.35, o.x - hw * 0.15, cy - s * 0.15]).fill({ color: '#ffffff', alpha: 0.85 });
    }

    // Particles: sparks additive, gore/debris normal — one draw call each.
    const sparkArr = this._sparkLayer.pc.particleChildren; sparkArr.length = 0;
    const goreArr = this._goreLayer.pc.particleChildren; goreArr.length = 0;
    const sPool = this._sparkLayer.pool, gPool = this._goreLayer.pool;
    const TR = 24; // partTex radius at scale 1
    let si = 0, gi = 0;
    for (const pp of game.parts) {
      const a = Math.max(0, pp.life / (pp.max || 0.35));
      const spd = Math.hypot(pp.vx, pp.vy);
      const isDebris = pp.type === 'debris';
      const pool = isDebris ? gPool : sPool;
      const arr = isDebris ? goreArr : sparkArr;
      const idx = isDebris ? gi : si;
      if (idx >= pool.length) continue;
      const q = pool[idx];
      if (isDebris) gi++; else si++;
      const stretch = !isDebris && spd > 60 ? Math.min(16, spd * 0.026) : 0;
      q.x = pp.x; q.y = pp.y;
      q.rotation = spd > 1 ? Math.atan2(pp.vy, pp.vx) : 0;
      q.scaleX = (pp.size * 1.2 + stretch) / TR;
      q.scaleY = (pp.size * 0.9) / TR;
      q.tint = pp.color;
      q.alpha = Math.min(1, a * 1.15);
      arr.push(q);
    }
    this._sparkLayer.pc.update();
    this._goreLayer.pc.update();

    for (let i = this._lightIdx; i < this._lightPool.length; i++) this._lightPool[i].visible = false;

    this._drawHud(game, W, H);
  }

  _drawHud(game, W, H) {
    const g = this.gHud; g.clear();
    const p = game.player;

    // Hull bar with a delayed "damage ghost" so a big hit is legible.
    const bw = W - 28;
    g.rect(14, 14, bw, 9).fill({ color: '#12070a', alpha: 0.9 });
    const hpF = Math.max(0, p.hp / p.maxHp);
    this._ghostHp = this._ghostHp === undefined ? hpF : Math.max(hpF, this._ghostHp - 0.35 * (game.dt || 1 / 60));
    g.rect(14, 14, bw * this._ghostHp, 9).fill({ color: '#8a2030', alpha: 0.85 });
    g.rect(14, 14, bw * hpF, 9).fill(hpF < 0.3 ? '#ff5566' : '#4dff91');
    g.rect(14, 14, bw, 9).stroke({ width: 1, color: '#ffffff', alpha: 0.18 });

    if (game.boss) {
      g.rect(14, 27, bw, 7).fill({ color: '#12070a', alpha: 0.9 });
      g.rect(14, 27, bw * Math.max(0, game.boss.hp / game.boss.maxHp), 7).fill('#ff5566');
    } else {
      const t01 = Math.min(1, game.time / game.stage.duration);
      g.rect(14, 27, bw, 5).fill({ color: '#060a16', alpha: 0.9 });
      g.rect(14, 27, bw * t01, 5).fill('#5fd6ff');
    }

    // XP bar along the very bottom of the top block.
    if (game.xpToNext) {
      const xf = Math.max(0, Math.min(1, game.xp / game.xpToNext));
      g.rect(14, 36, bw, 4).fill({ color: '#0a1020', alpha: 0.9 });
      g.rect(14, 36, bw * xf, 4).fill('#9fd8ff');
    }
  }
}
