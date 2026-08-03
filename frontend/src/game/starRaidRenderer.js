// Star Raid — PixiJS renderer. Pure drawing, mirrors pixiRenderer.js's
// separation of concerns. Engine-glow trail uses the SAME pooled additive
// baked-texture light-sprite technique as the main game's point lights
// (see .claude/skills/waterdrop-lighting/SKILL.md) — not a plain glow
// filter — per the project's one approved lighting approach.
import { Application, Graphics, Text, TextStyle, FillGradient, Sprite } from 'pixi.js';

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
    this.gStars = new Graphics(); stage.addChild(this.gStars);
    this.gWorld = new Graphics(); stage.addChild(this.gWorld);

    // Baked soft-radial texture reused for engine glow + orb glow (same
    // pattern as pixiRenderer.js's this.lightTex).
    const tg = new Graphics();
    tg.rect(0, 0, 128, 128).fill(new FillGradient({
      type: 'radial', center: { x: 0.5, y: 0.5 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,1)' },
        { offset: 0.4, color: 'rgba(255,255,255,0.4)' },
        { offset: 1, color: 'rgba(255,255,255,0)' },
      ],
    }));
    this.glowTex = this.app.renderer.generateTexture({ target: tg, antialias: true });
    tg.destroy();

    this.engineGlow = new Sprite(this.glowTex);
    this.engineGlow.anchor.set(0.5); this.engineGlow.blendMode = 'add'; this.engineGlow.tint = '#5fd6ff';
    stage.addChild(this.engineGlow);

    this._orbGlowPool = [];
    for (let i = 0; i < 24; i++) {
      const s = new Sprite(this.glowTex);
      s.anchor.set(0.5); s.blendMode = 'add'; s.visible = false;
      stage.addChild(s);
      this._orbGlowPool.push(s);
    }

    this.gHpBar = new Graphics(); stage.addChild(this.gHpBar);
    this.bossText = new Text({ text: '', style: new TextStyle({ fontFamily: 'VT323, monospace', fontSize: 14, fill: '#ff6a6a' }) });
    this.bossText.anchor.set(0.5); stage.addChild(this.bossText);

    this._starLayers = [
      { arr: this._makeStars(60, 0.6), speed: 40 },
      { arr: this._makeStars(40, 1.0), speed: 90 },
      { arr: this._makeStars(20, 1.6), speed: 150 },
    ];
  }

  _makeStars(n, size) {
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const arr = [];
    for (let i = 0; i < n; i++) arr.push({ x: Math.random() * w, y: Math.random() * h, size });
    return arr;
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
    const dt = 1 / 60;

    // Scrolling starfield — 3 parallax layers, fast = near.
    this.gStars.clear();
    for (const layer of this._starLayers) {
      for (const s of layer.arr) {
        s.y += layer.speed * dt;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
        this.gStars.circle(s.x, s.y, s.size).fill({ color: '#cfe8ff', alpha: 0.5 + s.size * 0.2 });
      }
    }

    const g = this.gWorld; g.clear();
    const p = game.player;

    // Ship — procedural triangular hull, banks (rotates) with horizontal
    // input instead of swapping between raster lean-left/lean-right frames
    // (no bitmap sprite pipeline in this project — see waterdrop-lighting
    // skill's "no hand-authored art" note; this delivers the same felt
    // effect of banking into a turn).
    const bank = p.bank * 0.5;
    const shipColor = p.hit > 0 ? '#ffffff' : (game.shipColor || '#5fd6ff');
    const pts = [[0, -18], [-13, 12], [-6, 6], [0, 10], [6, 6], [13, 12]];
    const rp = pts.map(([lx, ly]) => {
      const c = Math.cos(bank), s = Math.sin(bank);
      return [p.x + lx * c - ly * s, p.y + lx * s + ly * c];
    });
    g.poly(rp.flat()).fill(shipColor).stroke({ width: 2, color: '#0a2a3a' });
    if (p.iframes > 0) g.circle(p.x, p.y, p.r + 4).stroke({ width: 2, color: '#ffffff', alpha: 0.5 });

    // Engine glow — real pooled additive light sprite, brighter/bigger while
    // actively thrusting (moving), tinted the ship's own color.
    this.engineGlow.visible = true;
    this.engineGlow.position.set(p.x - Math.sin(bank) * 14, p.y + Math.cos(bank) * 14);
    this.engineGlow.tint = game.shipColor || '#5fd6ff';
    const thrust = Math.hypot(p.vx, p.vy) > 10 ? 1 : 0.5;
    this.engineGlow.width = this.engineGlow.height = 34 * thrust;
    this.engineGlow.alpha = 0.55 * thrust;

    // Enemies
    for (const e of game.enemies) {
      if (e.kind === 'shooter') {
        g.poly([e.x, e.y - e.r, e.x - e.r, e.y + e.r * 0.6, e.x + e.r, e.y + e.r * 0.6]).fill(e.color);
      } else {
        g.circle(e.x, e.y, e.r).fill(e.color);
      }
      if (e.hp < e.maxHp) {
        g.rect(e.x - e.r, e.y - e.r - 8, e.r * 2, 3).fill('#000000');
        g.rect(e.x - e.r, e.y - e.r - 8, e.r * 2 * Math.max(0, e.hp / e.maxHp), 3).fill('#ff5566');
      }
    }

    // Boss
    if (game.boss) {
      const b = game.boss;
      g.circle(b.x, b.y, b.r).fill('#7a2a2a').stroke({ width: 3, color: '#ff6a6a' });
      g.circle(b.x, b.y, b.r * 0.5).fill('#3a1010');
      this.bossText.visible = true;
      this.bossText.text = 'HULL BREAKER';
      this.bossText.position.set(b.x, b.y - b.r - 16);
    } else {
      this.bossText.visible = false;
    }

    // Projectiles
    for (const pr of game.projs) g.circle(pr.x, pr.y, 3.5).fill('#fff44d');
    for (const ep of game.eprojs) g.circle(ep.x, ep.y, 4).fill('#ff5566');

    // Orbs — same small-glowing-pickup read as the main game's gold/XP orbs.
    let oi = 0;
    for (const o of game.orbs) {
      g.circle(o.x, o.y, 5).fill('#ffd166');
      if (oi < this._orbGlowPool.length) {
        const spr = this._orbGlowPool[oi++];
        spr.visible = true; spr.position.set(o.x, o.y);
        spr.width = spr.height = 22; spr.alpha = 0.5; spr.tint = '#ffd166';
      }
    }
    for (let i = oi; i < this._orbGlowPool.length; i++) this._orbGlowPool[i].visible = false;

    // Particles
    for (const pp of game.parts) g.circle(pp.x, pp.y, pp.size).fill({ color: pp.color, alpha: Math.max(0, pp.life / 0.35) });

    // Top HUD bars
    this.gHpBar.clear();
    this.gHpBar.rect(14, 14, W - 28, 8).fill('#1a0a0a');
    this.gHpBar.rect(14, 14, (W - 28) * Math.max(0, p.hp / p.maxHp), 8).fill('#4dff91');
    if (game.boss) {
      this.gHpBar.rect(14, 26, W - 28, 6).fill('#1a0a0a');
      this.gHpBar.rect(14, 26, (W - 28) * Math.max(0, game.boss.hp / game.boss.maxHp), 6).fill('#ff5566');
    } else {
      const t01 = Math.min(1, game.time / game.stage.duration);
      this.gHpBar.rect(14, 26, W - 28, 4).fill('#0a0a1a');
      this.gHpBar.rect(14, 26, (W - 28) * t01, 4).fill('#5fd6ff');
    }
  }
}
