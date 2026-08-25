// =============================================
// CLICKER CONSPIRACY WORLD — Interactive Survivor-Clicker Arena
// =============================================
// The visual and interactive heart of the Illuminati Well clicker.
// Features:
// 1. Dollar-Bill Stepped Pyramid with the floating radiant Eye of Providence.
// 2. Playable Survivor-Clicker mechanics: Hero aims and shoots, clicks defeat
//    monsters, drag-to-lase rapid fire, and collect bouncing H2O gems.
// 3. Spawning Enemies: Reptilian spies, Illuminati Eye-Bats, Shadow Agents,
//    UFOs, and HAARP Drones with HP bars and death splatters.
// 4. Mystery Treasure Chesrts (Clicker Heroes style): Multi-hit cracking chests
//    that burst into huge drop payouts!
// 5. Elite Celebrity Automation (Arnold on his real miniature pony)!
// 6. Ancient Wonders: Göbekli Tepe T-pillars, Stonehenge Solstice, and Obelisks.
// 7. Waterdrop Lighting: Pooled additive lights from baked radial textures.

import { Application, Container, Graphics, Sprite, FillGradient, ColorMatrixFilter, Rectangle } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { bakeLightTexture } from './litShading';
import { HERO_BODY } from './heroShape';

const TAU = Math.PI * 2;
const W = 620, H = 360;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const noise = (i) => ((i * 2654435761) >>> 0) / 4294967295;

const THEME_COLORS = {
  municipal: { sky: 0x060c18, ground: 0x09141e, accent: 0x4dc4ff, glow: [0.30, 0.76, 1.00], dollar: 0x143322 },
  fluoride: { sky: 0x07120a, ground: 0x0a1a0e, accent: 0x4dff91, glow: [0.30, 1.00, 0.57], dollar: 0x163d1a },
  haarp: { sky: 0x05101a, ground: 0x081c28, accent: 0x00e5ff, glow: [0.00, 0.90, 1.00], dollar: 0x0e3238 },
  deepstate: { sky: 0x0c080a, ground: 0x140a0e, accent: 0xff4444, glow: [1.00, 0.27, 0.27], dollar: 0x2e1218 },
  pyramid: { sky: 0x161208, ground: 0x1c160a, accent: 0xffd166, glow: [1.00, 0.82, 0.40], dollar: 0x28200a },
  reptilian: { sky: 0x061408, ground: 0x0a1e0c, accent: 0x39ff14, glow: [0.22, 1.00, 0.08], dollar: 0x123610 },
  cosmic: { sky: 0x0e081c, ground: 0x140822, accent: 0xb362ff, glow: [0.70, 0.38, 1.00], dollar: 0x240e34 },
};

export class ClickerWorld {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.theme = opts.theme || 'municipal';
    this.chapter = opts.chapter || 0;
    this.onTapWell = opts.onTapWell || (() => { });
    this.onTapObject = opts.onTapObject || (() => { });
    this.onCollectDrop = opts.onCollectDrop || (() => { });
    this.onEnemyDefeated = opts.onEnemyDefeated || (() => { });
    this.onChestUnlocked = opts.onChestUnlocked || (() => { });
    this.onArnoldTapped = opts.onArnoldTapped || (() => { });

    this.app = null;
    this.destroyed = false;
    this.t = 0;

    // Mouse / Aim state
    this.pointerX = W / 2;
    this.pointerY = H / 2;
    this.isPointerDown = false;
    this.laserDragT = 0;

    // Eye tracking state
    this.eyeTargetX = 0;
    this.eyeTargetY = 0;
    this.eyeX = 0;
    this.eyeY = 0;
    this.eyeBlink = 0;
    this._eyeBlinkT = 3.5;

    // Tap feedback
    this._tapFlash = 0;
    this._tapX = W / 2;
    this._tapY = H / 2;
    this._ripples = [];
    this._sparks = [];

    // Projectiles
    this.projectiles = [];

    // Interactive monsters
    this.enemies = [];
    this._enemySpawnT = 1.5;

    // Ground drops
    this.groundDrops = [];

    // Mystery Treasure Chests
    this.chests = [];
    this._chestSpawnT = 12.0;

    // Arnold on his dachshund-sized miniature pony
    this.arnold = {
      active: false,
      x: -120,
      y: H * 0.68 - 14,
      vx: 90,
      gallopT: 0,
      t: 0,
      hitFlash: 0,
    };
    this._arnoldSpawnT = 10.0;

    // Interactive monument hitboxes
    this._interactives = [];

    // Waterdrop Hero state
    this.hero = {
      x: W * 0.35,
      y: H * 0.70 - 10,
      targetX: W * 0.35,
      targetY: H * 0.70 - 10,
      vx: 0,
      wobble: 0,
      bobT: 0,
      facing: 1,
      cheerT: 0,
      shootT: 0,
    };

    // Stars
    this._stars = [];
    for (let i = 0; i < 75; i++) {
      this._stars.push({
        x: noise(i * 47) * W,
        y: noise(i * 53 + 7) * H * 0.54,
        size: 0.6 + noise(i * 67) * 1.8,
        twinkle: noise(i * 71) * TAU,
        speed: 0.6 + noise(i * 79) * 2.2,
      });
    }

    // Floating runes
    this._floaters = [];
    for (let i = 0; i < 20; i++) {
      this._floaters.push({
        x: noise(i * 7) * W,
        y: noise(i * 13 + 3) * H * 0.68 + H * 0.10,
        phase: noise(i * 17) * TAU,
        speed: 0.2 + noise(i * 23) * 0.6,
        size: 2.2 + noise(i * 31) * 4.5,
        alpha: 0.12 + noise(i * 37) * 0.28,
        symbol: i % 7,
      });
    }
  }

  async init() {
    const app = new Application();
    this.app = app;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    await app.init({
      canvas: this.canvas,
      width: this.canvas.clientWidth || W,
      height: this.canvas.clientHeight || H,
      resolution: dpr,
      autoDensity: true,
      backgroundColor: 0x050a10,
      antialias: true,
      preference: 'webgl',
    });
    if (this.destroyed) { app.destroy(true); return; }

    this.root = new Container();
    app.stage.addChild(this.root);

    // Bake light texture
    const baked = bakeLightTexture(app, 48);
    this.lightTex = baked;

    this.gSky = new Graphics(); this.root.addChild(this.gSky);
    this.gStars = new Graphics(); this.root.addChild(this.gStars);
    this.gGround = new Graphics(); this.root.addChild(this.gGround);
    this.gMonuments = new Graphics(); this.root.addChild(this.gMonuments);
    this.lightLayer = new Container(); this.root.addChild(this.lightLayer);
    this.gFloaters = new Graphics(); this.root.addChild(this.gFloaters);
    this.gPyramid = new Graphics(); this.root.addChild(this.gPyramid);
    this.gProjectiles = new Graphics(); this.root.addChild(this.gProjectiles);
    this.gEnemies = new Graphics(); this.root.addChild(this.gEnemies);
    this.gChests = new Graphics(); this.root.addChild(this.gChests);
    this.gArnold = new Graphics(); this.root.addChild(this.gArnold);
    this.gDrops = new Graphics(); this.root.addChild(this.gDrops);
    this.gHero = new Graphics(); this.root.addChild(this.gHero);
    this.gEffects = new Graphics(); this.root.addChild(this.gEffects);

    // Light pool
    this._lightSprites = [];
    for (let i = 0; i < 36; i++) {
      const sp = new Sprite(this.lightTex);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.alpha = 0;
      this.lightLayer.addChild(sp);
      this._lightSprites.push(sp);
    }

    this._paintSky();
    this._paintGround();

    try {
      const bloom = new AdvancedBloomFilter({ threshold: 0.52, bloomScale: 0.6, brightness: 1.0 });
      const grade = new ColorMatrixFilter();
      grade.brightness(1.06, true);
      grade.contrast(0.52, true);
      grade.saturate(0.18, true);
      this.root.filters = [bloom, grade];
      this.root.filterArea = new Rectangle(0, 0, W, H);
    } catch (e) {
      // ignore
    }

    this.root.eventMode = 'static';
    this.root.hitArea = new Rectangle(0, 0, W, H);

    this.root.on('pointermove', (e) => {
      const local = this.root.toLocal(e.global);
      this.pointerX = local.x;
      this.pointerY = local.y;
      this.eyeTargetX = (local.x / W - 0.5) * 2;
      this.eyeTargetY = (local.y / H - 0.5) * 2;
    });

    this.root.on('pointerdown', (e) => {
      const local = this.root.toLocal(e.global);
      this.pointerX = local.x;
      this.pointerY = local.y;
      this.isPointerDown = true;
      this.handleTap(local.x, local.y);
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
    });

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();

    app.ticker.add((tk) => this._tick(tk));
    return this;
  }

  resize() {
    if (!this.app || this.destroyed) return;
    const w = this.canvas.clientWidth || W;
    const h = this.canvas.clientHeight || H;
    this.app.renderer.resize(w, h);
    const scale = Math.min(w / W, h / H);
    this.root.scale.set(scale);
    this.root.position.set((w - W * scale) / 2, (h - H * scale) / 2);
    if (this.root.filterArea) {
      this.root.filterArea.width = w / scale;
      this.root.filterArea.height = h / scale;
    }
  }

  setTheme(theme, chapter) {
    this.theme = theme;
    this.chapter = chapter || 0;
    this._paintSky();
    this._paintGround();
  }

  flashTap() {
    this._tapFlash = 1.0;
    this.hero.cheerT = 0.8;
  }

  handleTap(x, y) {
    this._tapFlash = 1.0;
    this._tapX = x;
    this._tapY = y;

    this._ripples.push({ x, y, t: 0, maxR: 30 + Math.random() * 20 });
    if (this._ripples.length > 8) this._ripples.shift();

    // Check Arnold click
    if (this.arnold.active && Math.hypot(x - this.arnold.x, y - this.arnold.y) < 36) {
      this.arnold.hitFlash = 1.0;
      this._spawnSparks(this.arnold.x, this.arnold.y - 10, 0xffd166, 20);
      this._spawnDropFountain(this.arnold.x, this.arnold.y - 10, 8);
      this.onArnoldTapped(this.arnold);
      return;
    }

    // Check Chest clicks
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const ch = this.chests[i];
      if (Math.hypot(x - ch.x, y - ch.y) < 32) {
        ch.hits--;
        ch.hitFlash = 1.0;
        this._spawnSparks(ch.x, ch.y, 0xffd166, 12);
        if (ch.hits <= 0) {
          this.chests.splice(i, 1);
          this._spawnDropFountain(ch.x, ch.y, 10);
          this.onChestUnlocked(ch);
        }
        return;
      }
    }

    // Check Enemy clicks
    let hitEnemy = false;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (Math.hypot(x - en.x, y - en.y) < en.radius + 8) {
        en.hp--;
        en.hitFlash = 1.0;
        hitEnemy = true;
        this._spawnSparks(en.x, en.y, en.color, 10);
        if (en.hp <= 0) {
          this._spawnSparks(en.x, en.y, en.color, 20);
          this._spawnDropFountain(en.x, en.y, en.dropsCount || 3);
          this.onEnemyDefeated(en);
          this.enemies.splice(i, 1);
        }
        break;
      }
    }

    // Fire hero projectile
    this._fireHeroProjectile(x, y);

    // Check Pyramid click
    const dx = x - W / 2, dy = y - H * 0.46;
    if (Math.abs(dx) < 65 && Math.abs(dy) < 60) {
      this.hero.cheerT = 1.0;
      this._spawnSparks(W / 2, H * 0.38, 0xffd166, 12);
      this.onTapWell(x, y);
      return;
    }

    // Check Monuments
    for (const obj of this._interactives) {
      const odx = x - obj.x, ody = y - obj.y;
      if (odx * odx + ody * ody < obj.r * obj.r) {
        obj.hit = 1.0;
        this._spawnSparks(obj.x, obj.y, THEME_COLORS[this.theme]?.accent || 0xffd166, 12);
        this.onTapObject(obj.id, obj);
        return;
      }
    }

    // Ground move
    if (!hitEnemy && y > H * 0.58) {
      this.hero.targetX = clamp(x, 40, W - 40);
    }
  }

  _fireHeroProjectile(targetX, targetY) {
    const h = this.hero;
    const ang = Math.atan2(targetY - (h.y - 12), targetX - h.x);
    const spd = 380;
    this.projectiles.push({
      x: h.x,
      y: h.y - 12,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.9,
      maxLife: 0.9,
      color: THEME_COLORS[this.theme]?.accent || 0x4dc4ff,
    });
    h.shootT = 0.25;
  }

  _spawnSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * TAU;
      const spd = 30 + Math.random() * 90;
      this._sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 30,
        color,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  _spawnDropFountain(x, y, count) {
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const spd = 50 + Math.random() * 120;
      this.groundDrops.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: 4.5,
        life: 12.0,
        bounceY: H * 0.68 + Math.random() * (H * 0.25),
        bounces: 0,
      });
    }
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('resize', this._onResize);
    if (this.app) { this.app.destroy(true); this.app = null; }
  }

  _paintSky() {
    const g = this.gSky;
    g.clear();
    const tc = THEME_COLORS[this.theme] || THEME_COLORS.municipal;
    const skyGrad = new FillGradient({
      colorStops: [
        { offset: 0, color: tc.sky },
        { offset: 0.74, color: tc.sky },
        { offset: 1, color: tc.dollar || 0x0a1c12 },
      ],
    });
    g.rect(0, 0, W, H).fill(skyGrad);
  }

  _paintGround() {
    const g = this.gGround;
    g.clear();
    const tc = THEME_COLORS[this.theme] || THEME_COLORS.municipal;
    const groundY = H * 0.68;

    const groundGrad = new FillGradient({
      colorStops: [
        { offset: 0, color: tc.ground },
        { offset: 1, color: 0x020604 },
      ],
    });
    g.rect(0, groundY, W, H - groundY).fill(groundGrad);
    g.rect(0, groundY - 1, W, 2).fill({ color: tc.accent, alpha: 0.25 });

    for (let i = 0; i < 55; i++) {
      const x = noise(i * 97) * W;
      const y = groundY + noise(i * 103 + 5) * (H - groundY) * 0.7 + 4;
      const len = 4 + noise(i * 107) * 12;
      g.rect(x, y, len, 1).fill({ color: tc.accent, alpha: 0.05 + noise(i * 113) * 0.06 });
    }
  }

  _tick(tk) {
    if (this.destroyed) return;
    const dt = tk.deltaTime / 60;
    this.t += dt;

    this.eyeX = lerp(this.eyeX, this.eyeTargetX, 1 - Math.exp(-8 * dt));
    this.eyeY = lerp(this.eyeY, this.eyeTargetY, 1 - Math.exp(-8 * dt));

    this._eyeBlinkT -= dt;
    if (this._eyeBlinkT <= 0) {
      this.eyeBlink = 1.0;
      this._eyeBlinkT = 2.8 + Math.random() * 3.2;
    }
    if (this.eyeBlink > 0) this.eyeBlink = Math.max(0, this.eyeBlink - dt * 6);

    if (this._tapFlash > 0) this._tapFlash = Math.max(0, this._tapFlash - dt * 4);

    if (this.isPointerDown) {
      this.laserDragT += dt;
      if (this.laserDragT >= 0.12) {
        this.laserDragT = 0;
        this._fireHeroProjectile(this.pointerX, this.pointerY);
      }
    } else {
      this.laserDragT = 0;
    }

    for (let i = this._ripples.length - 1; i >= 0; i--) {
      this._ripples[i].t += dt * 2.2;
      if (this._ripples[i].t > 1) this._ripples.splice(i, 1);
    }

    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const s = this._sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 140 * dt;
      s.life -= dt;
      if (s.life <= 0) this._sparks.splice(i, 1);
    }

    for (const obj of this._interactives) {
      if (obj.hit > 0) obj.hit = Math.max(0, obj.hit - dt * 3);
    }

    this._updateProjectiles(dt);
    this._updateEnemies(dt);
    this._updateChests(dt);
    this._updateArnold(dt);
    this._updateDrops(dt);
    this._updateHero(dt);

    this._drawStars();
    this._drawMonuments();
    this._drawLights();
    this._drawFloaters();
    this._drawPyramid();
    this._drawProjectiles();
    this._drawEnemies();
    this._drawChests();
    this._drawArnold();
    this._drawDrops();
    this._drawHero();
    this._drawEffects();
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const en = this.enemies[j];
        if (Math.hypot(p.x - en.x, p.y - en.y) < en.radius + 6) {
          en.hp--;
          en.hitFlash = 1.0;
          hit = true;
          this._spawnSparks(en.x, en.y, en.color, 8);
          if (en.hp <= 0) {
            this._spawnSparks(en.x, en.y, en.color, 16);
            this._spawnDropFountain(en.x, en.y, en.dropsCount || 3);
            this.onEnemyDefeated(en);
            this.enemies.splice(j, 1);
          }
          break;
        }
      }

      if (hit || p.life <= 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  _updateEnemies(dt) {
    this._enemySpawnT -= dt;
    if (this._enemySpawnT <= 0 && this.enemies.length < 5) {
      this._enemySpawnT = 2.5 + Math.random() * 3.5;
      const type = Math.random();
      if (type < 0.35) {
        this.enemies.push({
          kind: 'bat',
          x: Math.random() < 0.5 ? -30 : W + 30,
          y: 40 + Math.random() * 60,
          vx: (Math.random() < 0.5 ? 1 : -1) * (35 + Math.random() * 25),
          hp: 2, maxHp: 2,
          radius: 12,
          color: 0x9b59b6,
          t: 0,
          hitFlash: 0,
          dropsCount: 2,
        });
      } else if (type < 0.70) {
        this.enemies.push({
          kind: 'fed',
          x: Math.random() < 0.5 ? -30 : W + 30,
          y: H * 0.68 - 14,
          vx: (Math.random() < 0.5 ? 1 : -1) * (20 + Math.random() * 15),
          hp: 3, maxHp: 3,
          radius: 14,
          color: 0xff4444,
          t: 0,
          hitFlash: 0,
          dropsCount: 3,
        });
      } else {
        this.enemies.push({
          kind: 'reptile',
          x: Math.random() < 0.5 ? -30 : W + 30,
          y: H * 0.68 - 12,
          vx: (Math.random() < 0.5 ? 1 : -1) * (28 + Math.random() * 20),
          hp: 4, maxHp: 4,
          radius: 14,
          color: 0x39ff14,
          t: 0,
          hitFlash: 0,
          dropsCount: 4,
        });
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      en.t += dt;
      en.x += en.vx * dt;
      if (en.kind === 'bat') {
        en.y += Math.sin(en.t * 4) * 0.6;
      }
      if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - dt * 5);

      if (en.x < 20) { en.x = 20; en.vx = Math.abs(en.vx); }
      if (en.x > W - 20) { en.x = W - 20; en.vx = -Math.abs(en.vx); }
    }
  }

  _updateChests(dt) {
    this._chestSpawnT -= dt;
    if (this._chestSpawnT <= 0 && this.chests.length < 2) {
      this._chestSpawnT = 18.0 + Math.random() * 14.0;
      this.chests.push({
        x: W * 0.2 + Math.random() * (W * 0.6),
        y: H * 0.68 - 14,
        hits: 3,
        maxHits: 3,
        t: 0,
        hitFlash: 0,
      });
    }

    for (const ch of this.chests) {
      ch.t += dt;
      if (ch.hitFlash > 0) ch.hitFlash = Math.max(0, ch.hitFlash - dt * 5);
    }
  }

  _updateArnold(dt) {
    const a = this.arnold;
    this._arnoldSpawnT -= dt;
    if (this._arnoldSpawnT <= 0 && !a.active) {
      a.active = true;
      a.x = -120;
      a.y = H * 0.68 - 12;
      a.vx = 95;
      a.gallopT = 0;
      a.t = 0;
      this._arnoldSpawnT = 24.0 + Math.random() * 16.0;
    }

    if (a.active) {
      a.t += dt;
      a.gallopT += dt;
      a.x += a.vx * dt;
      if (a.hitFlash > 0) a.hitFlash = Math.max(0, a.hitFlash - dt * 4);
      if (a.x > W + 120) a.active = false;
    }
  }

  _updateDrops(dt) {
    const hx = this.hero.x, hy = this.hero.y - 10;
    for (let i = this.groundDrops.length - 1; i >= 0; i--) {
      const d = this.groundDrops[i];
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 180 * dt;

      if (d.y >= d.bounceY) {
        d.y = d.bounceY;
        d.vy = -d.vy * 0.45;
        d.vx *= 0.65;
        d.bounces++;
      }

      const distToHero = Math.hypot(d.x - hx, d.y - hy);
      if (distToHero < 85) {
        const pull = (1 - distToHero / 85) * 320;
        const ang = Math.atan2(hy - d.y, hx - d.x);
        d.x += Math.cos(ang) * pull * dt;
        d.y += Math.sin(ang) * pull * dt;
      }

      if (distToHero < 18 || d.life <= 0) {
        this.onCollectDrop(d);
        this.groundDrops.splice(i, 1);
      }
    }
  }

  _updateHero(dt) {
    const h = this.hero;
    const dx = h.targetX - h.x;
    if (Math.abs(dx) > 2) {
      h.facing = Math.sign(dx);
      h.vx = lerp(h.vx, h.facing * 85, 1 - Math.exp(-10 * dt));
      h.x += h.vx * dt;
      h.bobT += dt * 14;
      h.wobble = Math.sin(h.bobT) * 0.15;
    } else {
      h.vx = lerp(h.vx, 0, 1 - Math.exp(-12 * dt));
      h.bobT += dt * 2.5;
      h.wobble = Math.sin(h.bobT) * 0.04;
    }
    if (h.cheerT > 0) h.cheerT = Math.max(0, h.cheerT - dt * 2.5);
    if (h.shootT > 0) h.shootT = Math.max(0, h.shootT - dt * 5);
  }

  _drawStars() {
    const g = this.gStars;
    g.clear();
    for (const s of this._stars) {
      const twinkle = 0.35 + Math.sin(this.t * s.speed + s.twinkle) * 0.5 + 0.2;
      g.circle(s.x, s.y, s.size * twinkle).fill({ color: 0xffffff, alpha: twinkle * 0.7 });
    }
  }

  _drawMonuments() {
    const g = this.gMonuments;
    g.clear();
    const tc = THEME_COLORS[this.theme] || THEME_COLORS.municipal;
    const groundY = H * 0.68;
    this._interactives = [];

    // Stonehenge
    const shX = 95, shY = groundY;
    const stoneColor = 0x2e2b26;
    const stoneHi = 0x46423a;

    const drawTrilithon = (cx, baseY, w, h, gap) => {
      const lw = w * 0.32;
      g.rect(cx - gap / 2 - lw, baseY - h, lw, h).fill(stoneColor)
        .stroke({ width: 1, color: stoneHi, alpha: 0.4 });
      g.rect(cx + gap / 2, baseY - h, lw, h).fill(stoneColor)
        .stroke({ width: 1, color: stoneHi, alpha: 0.4 });
      g.rect(cx - gap / 2 - lw, baseY - h - lw * 0.6, gap + lw * 2, lw * 0.6).fill(stoneHi)
        .stroke({ width: 1, color: 0x5a544c, alpha: 0.35 });
    };

    drawTrilithon(shX - 32, shY, 15, 46, 16);
    drawTrilithon(shX, shY, 17, 52, 18);
    drawTrilithon(shX + 34, shY, 15, 44, 14);

    g.rect(shX - 1, 0, 2, shY).fill({ color: tc.accent, alpha: 0.05 + Math.sin(this.t * 0.8) * 0.03 });
    this._interactives.push({ id: 'stonehenge', x: shX, y: shY - 28, r: 56, hit: 0 });

    // Göbekli Tepe
    const gtX = W - 110, gtY = groundY;
    const pillarColor = 0x3e372b;
    const pillarHi = 0x585040;

    const drawTPillar = (cx, baseY, w, h, headW, animalType) => {
      g.rect(cx - w / 2, baseY - h, w, h).fill(pillarColor)
        .stroke({ width: 1, color: pillarHi, alpha: 0.45 });
      g.rect(cx - headW / 2, baseY - h - w * 0.55, headW, w * 0.55).fill(pillarHi)
        .stroke({ width: 1, color: 0x6e6452, alpha: 0.4 });

      const reliefY = baseY - h * 0.45;
      if (animalType === 'fox') {
        g.moveTo(cx - 3, reliefY).lineTo(cx + 4, reliefY - 2).lineTo(cx + 2, reliefY + 3).closePath()
          .fill({ color: tc.accent, alpha: 0.3 });
      } else if (animalType === 'vulture') {
        g.moveTo(cx - 4, reliefY - 2).lineTo(cx, reliefY + 3).lineTo(cx + 4, reliefY - 2)
          .stroke({ width: 1, color: tc.accent, alpha: 0.3 });
      }
    };

    drawTPillar(gtX - 34, gtY, 12, 50, 24, 'fox');
    drawTPillar(gtX, gtY, 14, 56, 28, 'vulture');
    drawTPillar(gtX + 32, gtY, 12, 48, 22, 'fox');

    g.arc(gtX, gtY, 54, Math.PI * 0.85, Math.PI * 0.15)
      .stroke({ width: 4.5, color: 0x2e2722, alpha: 0.6 });

    this._interactives.push({ id: 'gobekli', x: gtX, y: gtY - 30, r: 56, hit: 0 });
  }

  _drawLights() {
    const tc = THEME_COLORS[this.theme] || THEME_COLORS.municipal;
    let idx = 0;

    const emit = (x, y, r, color, alpha) => {
      if (idx >= this._lightSprites.length) return;
      const sp = this._lightSprites[idx++];
      sp.position.set(x, y);
      sp.scale.set(r / 48);
      sp.tint = color;
      sp.alpha = alpha;
    };

    const pyramidGlow = 0.42 + Math.sin(this.t * 1.2) * 0.18 + this._tapFlash * 0.55;
    emit(W / 2, H * 0.46, 140, tc.accent, pyramidGlow);
    emit(W / 2, H * 0.38, 50, 0xffffff, 0.3 + this._tapFlash * 0.45);

    emit(95, H * 0.68 - 28, 70, tc.accent, 0.10 + Math.sin(this.t * 0.8) * 0.05);
    emit(W - 110, H * 0.68 - 30, 70, tc.accent, 0.10 + Math.sin(this.t * 0.9 + 1) * 0.05);

    emit(this.hero.x, this.hero.y - 10, 42, 0x4dc4ff, 0.3);

    for (const ch of this.chests) {
      emit(ch.x, ch.y, 45, 0xffd166, 0.5 + Math.sin(ch.t * 6) * 0.2);
    }

    if (this.arnold.active) {
      emit(this.arnold.x, this.arnold.y - 10, 60, 0xffd166, 0.4);
    }

    if (this._tapFlash > 0.01) {
      emit(this._tapX, this._tapY, 70, 0xffffff, this._tapFlash * 0.45);
    }

    for (; idx < this._lightSprites.length; idx++) {
      this._lightSprites[idx].alpha = 0;
    }
  }

  _drawFloaters() {
    const g = this.gFloaters;
    g.clear();
    const tc = THEME_COLORS[this.theme] || THEME_COLORS.municipal;

    for (const f of this._floaters) {
      const x = f.x + Math.sin(this.t * f.speed + f.phase) * 9;
      const y = f.y + Math.cos(this.t * f.speed * 0.7 + f.phase) * 6;
      const alpha = f.alpha * (0.65 + Math.sin(this.t * f.speed * 1.3 + f.phase * 2) * 0.35);
      const s = f.size;

      switch (f.symbol) {
        case 0:
          g.moveTo(x, y - s).lineTo(x + s * 0.87, y + s * 0.5).lineTo(x - s * 0.87, y + s * 0.5)
            .closePath().stroke({ width: 0.6, color: tc.accent, alpha });
          break;
        case 1:
          g.circle(x, y, s).stroke({ width: 0.6, color: tc.accent, alpha });
          break;
        case 2:
          g.moveTo(x, y - s).lineTo(x + s * 0.7, y).lineTo(x, y + s).lineTo(x - s * 0.7, y)
            .closePath().stroke({ width: 0.6, color: tc.accent, alpha });
          break;
        case 3:
          g.moveTo(x - s, y).lineTo(x + s, y).stroke({ width: 0.6, color: tc.accent, alpha });
          g.moveTo(x, y - s).lineTo(x, y + s).stroke({ width: 0.6, color: tc.accent, alpha });
          break;
        case 4:
          g.star(x, y, 5, s, s * 0.42, 0).stroke({ width: 0.6, color: tc.accent, alpha });
          break;
        case 5:
          g.ellipse(x, y, s * 1.2, s * 0.6).stroke({ width: 0.6, color: tc.accent, alpha });
          break;
      }
    }
  }

  _drawPyramid() {
    const g = this.gPyramid;
    g.clear();
    const tc = THEME_COLORS[this.theme] || THEME_COLORS.municipal;
    const cx = W / 2, groundY = H * 0.68;
    const pyramidH = 92;
    const pyramidW = 120;
    const tipY = groundY - pyramidH;

    const layers = 13;
    for (let i = 0; i < layers; i++) {
      const topT = i / layers;
      const botT = (i + 1) / layers;
      const y0 = tipY + (groundY - tipY) * topT;
      const y1 = tipY + (groundY - tipY) * botT;
      const halfW0 = (pyramidW / 2) * topT;
      const halfW1 = (pyramidW / 2) * botT;

      const layerColor = i % 2 === 0 ? 0x223828 : 0x1a2e20;
      g.moveTo(cx - halfW0, y0)
        .lineTo(cx + halfW0, y0)
        .lineTo(cx + halfW1, y1)
        .lineTo(cx - halfW1, y1)
        .closePath()
        .fill(layerColor)
        .stroke({ width: 0.8, color: 0x3d6648, alpha: 0.4 });

      const bricksInRow = i + 2;
      for (let b = 1; b < bricksInRow; b++) {
        const bx0 = (cx - halfW0) + (halfW0 * 2) * (b / bricksInRow);
        const bx1 = (cx - halfW1) + (halfW1 * 2) * (b / bricksInRow);
        g.moveTo(bx0, y0).lineTo(bx1, y1)
          .stroke({ width: 0.5, color: 0x101c14, alpha: 0.6 });
      }
    }

    // Roman numeral base banner: MDCCLXXVI
    g.rect(cx - 38, groundY - 8, 76, 7).fill(0x102014)
      .stroke({ width: 0.8, color: tc.accent, alpha: 0.4 });

    const capH = 30, capW = 38;
    const capCY = tipY - 14;
    const floatBob = Math.sin(this.t * 2) * 3;

    const rays = 16;
    for (let r = 0; r < rays; r++) {
      const ang = (r / rays) * TAU + this.t * 0.15;
      const len = 35 + Math.sin(this.t * 4 + r) * 10;
      g.moveTo(cx, capCY + floatBob)
        .lineTo(cx + Math.cos(ang) * len, (capCY + floatBob) + Math.sin(ang) * len * 0.7)
        .stroke({ width: 0.8, color: tc.accent, alpha: 0.12 + Math.sin(this.t * 2 + r) * 0.06 });
    }

    g.moveTo(cx, capCY - capH / 2 + floatBob)
      .lineTo(cx + capW / 2, capCY + capH / 2 + floatBob)
      .lineTo(cx - capW / 2, capCY + capH / 2 + floatBob)
      .closePath()
      .fill(0x182e20)
      .stroke({ width: 1.5, color: tc.accent, alpha: 0.75 + this._tapFlash * 0.25 });

    const eyeH = Math.max(1, 14 * (1 - this.eyeBlink));
    g.ellipse(cx, capCY + 2 + floatBob, 14, eyeH)
      .fill({ color: 0xf0fbf4, alpha: 0.95 })
      .stroke({ width: 1.2, color: tc.accent, alpha: 0.6 });

    if (this.eyeBlink < 0.8) {
      const pupilX = cx + this.eyeX * 4;
      const pupilY = (capCY + 2 + floatBob) + this.eyeY * 3;
      g.circle(pupilX, pupilY, 5.5).fill(0x06140a);
      g.circle(pupilX - 1.5, pupilY - 1.5, 1.8).fill({ color: tc.accent, alpha: 0.85 });
    }
  }

  _drawProjectiles() {
    const g = this.gProjectiles;
    g.clear();
    for (const p of this.projectiles) {
      g.circle(p.x, p.y, 3.5).fill({ color: p.color, alpha: 0.95 });
      g.circle(p.x, p.y, 6).fill({ color: p.color, alpha: 0.35 });
    }
  }

  _drawEnemies() {
    const g = this.gEnemies;
    g.clear();
    for (const en of this.enemies) {
      const flash = en.hitFlash > 0;
      const color = flash ? 0xffffff : en.color;

      if (en.kind === 'bat') {
        const wingSpan = 14 + Math.sin(en.t * 12) * 6;
        g.moveTo(en.x - wingSpan, en.y - 4).lineTo(en.x - 4, en.y).lineTo(en.x - wingSpan, en.y + 4)
          .stroke({ width: 1.2, color });
        g.moveTo(en.x + wingSpan, en.y - 4).lineTo(en.x + 4, en.y).lineTo(en.x + wingSpan, en.y + 4)
          .stroke({ width: 1.2, color });
        g.circle(en.x, en.y, 8).fill(color);
        g.circle(en.x, en.y, 3).fill(0x0a0410);
      } else if (en.kind === 'fed') {
        g.rect(en.x - 5, en.y - 18, 10, 18).fill(color);
        g.rect(en.x - 7, en.y - 22, 14, 4).fill(0x111111);
        g.circle(en.x - 2, en.y - 14, 1.2).fill(0xffd166);
        g.circle(en.x + 2, en.y - 14, 1.2).fill(0xffd166);
      } else if (en.kind === 'reptile') {
        g.ellipse(en.x, en.y - 10, 8, 12).fill(color);
        g.circle(en.x - 2.5, en.y - 12, 1.5).fill(0xff0000);
        g.circle(en.x + 2.5, en.y - 12, 1.5).fill(0xff0000);
        g.moveTo(en.x - 4, en.y - 4).quadraticCurveTo(en.x - 12, en.y, en.x - 14, en.y - 6)
          .stroke({ width: 1.5, color });
      }

      if (en.hp < en.maxHp) {
        g.rect(en.x - 10, en.y - 26, 20, 2.5).fill(0x330000);
        g.rect(en.x - 10, en.y - 26, 20 * (en.hp / en.maxHp), 2.5).fill(0x4dffd4);
      }
    }
  }

  _drawChests() {
    const g = this.gChests;
    g.clear();
    for (const ch of this.chests) {
      const bob = Math.sin(ch.t * 5) * 2;
      const flash = ch.hitFlash > 0;
      const color = flash ? 0xffffff : 0xffd166;

      g.roundRect(ch.x - 14, ch.y - 14 + bob, 28, 20, 3)
        .fill(0x3d2806)
        .stroke({ width: 1.5, color });

      g.rect(ch.x - 16, ch.y - 18 + bob, 32, 6).fill(0x61420d)
        .stroke({ width: 1, color });
      g.circle(ch.x, ch.y - 6 + bob, 3).fill(0xffd166);

      if (ch.hits < ch.maxHits) {
        g.moveTo(ch.x - 8, ch.y - 10 + bob).lineTo(ch.x + 8, ch.y - 2 + bob)
          .stroke({ width: 1.2, color: 0xff4444 });
      }
    }
  }

  _drawArnold() {
    const g = this.gArnold;
    g.clear();
    const a = this.arnold;
    if (!a.active) return;

    const flash = a.hitFlash > 0;
    const ax = a.x;
    const ay = a.y;
    const bob = Math.sin(a.gallopT * 22) * 3;

    // ── Dachshund-Sized Miniature Pony ───────────────────────────
    const ponyColor = flash ? 0xffffff : 0xd2a679;
    const maneColor = 0x6e431f;

    // Tiny galloping legs
    const leg1 = Math.sin(a.gallopT * 24) * 6;
    const leg2 = Math.sin(a.gallopT * 24 + Math.PI) * 6;
    g.moveTo(ax - 10, ay).lineTo(ax - 12 + leg1, ay + 12).stroke({ width: 2, color: ponyColor });
    g.moveTo(ax - 6, ay).lineTo(ax - 4 + leg2, ay + 12).stroke({ width: 2, color: ponyColor });
    g.moveTo(ax + 6, ay).lineTo(ax + 4 + leg1, ay + 12).stroke({ width: 2, color: ponyColor });
    g.moveTo(ax + 10, ay).lineTo(ax + 12 + leg2, ay + 12).stroke({ width: 2, color: ponyColor });

    // Cute tiny pony body
    g.roundRect(ax - 12, ay - 6 + bob, 24, 12, 4).fill(ponyColor);
    // Pony Head
    g.ellipse(ax + 14, ay - 10 + bob, 6, 8).fill(ponyColor);
    g.moveTo(ax + 14, ay - 16 + bob).lineTo(ax + 12, ay - 20 + bob).stroke({ width: 2, color: maneColor });
    // Bushy tail
    g.moveTo(ax - 12, ay - 4 + bob).quadraticCurveTo(ax - 20, ay - 8 + bob, ax - 18, ay + 4 + bob)
      .stroke({ width: 2.5, color: maneColor });

    // ── Arnold on Top (Massive Bodybuilder Torso) ─────────────────
    const skinColor = flash ? 0xffffff : 0xde9f6b;
    const vestColor = 0x1a1a1a;

    // Massive muscular torso
    g.roundRect(ax - 8, ay - 26 + bob, 16, 20, 3).fill(skinColor);
    g.rect(ax - 6, ay - 24 + bob, 12, 16).fill(vestColor);

    // Giant flexing bicep arms
    g.ellipse(ax - 12, ay - 20 + bob, 5, 4).fill(skinColor);
    g.ellipse(ax + 10, ay - 20 + bob, 5, 4).fill(skinColor);

    // Arnold Head
    g.roundRect(ax - 5, ay - 36 + bob, 10, 10, 2).fill(skinColor);
    // Flat top brown hair
    g.rect(ax - 6, ay - 39 + bob, 12, 4).fill(0x5c3a1e);
    // Cool sunglasses
    g.rect(ax - 3, ay - 33 + bob, 8, 3).fill(0x050505);
    // Cigar with smoke
    g.rect(ax + 2, ay - 29 + bob, 5, 1.5).fill(0x523118);
    g.circle(ax + 7, ay - 29 + bob, 1).fill(0xff4400); // burning ember
    // Smoke puffs
    g.circle(ax + 9 + Math.sin(a.t * 8) * 2, ay - 33 + bob, 1.8).fill({ color: 0xcccccc, alpha: 0.5 });

    // Twin miniguns firing water flashes
    g.rect(ax + 6, ay - 22 + bob, 12, 4).fill(0x333333);
    g.circle(ax + 19, ay - 20 + bob, 3).fill({ color: 0x4dc4ff, alpha: 0.8 }); // muzzle flash

    // Floating speech bubble
    g.roundRect(ax - 24, ay - 52 + bob, 48, 12, 3).fill({ color: 0x000000, alpha: 0.85 })
      .stroke({ width: 1, color: 0xffd166 });
    g.circle(ax, ay - 46 + bob, 1.5).fill(0xffd166);
  }

  _drawDrops() {
    const g = this.gDrops;
    g.clear();
    const tc = THEME_COLORS[this.theme] || THEME_COLORS.municipal;
    for (const d of this.groundDrops) {
      g.circle(d.x, d.y, d.radius).fill({ color: tc.accent, alpha: 0.95 });
      g.circle(d.x - 1, d.y - 1, d.radius * 0.4).fill({ color: 0xffffff, alpha: 0.8 });
    }
  }

  _drawHero() {
    const g = this.gHero;
    g.clear();
    const h = this.hero;
    const r = 13;
    const squash = 1 + h.wobble + h.cheerT * 0.25;
    const stretch = 1 / squash;
    const hx = h.x;
    const hy = h.y - r * stretch - h.cheerT * 10;

    g.ellipse(hx, h.y, r * 0.9 * squash, r * 0.35).fill({ color: 0x000000, alpha: 0.45 });

    const tipY = hy + HERO_BODY.tip[1] * r * stretch;
    const baseY = hy + HERO_BODY.base[1] * r * stretch;
    const ctrl1X = HERO_BODY.ctrl1[0] * r * squash;
    const ctrl1Y = hy + HERO_BODY.ctrl1[1] * r * stretch;
    const ctrl2X = HERO_BODY.ctrl2[0] * r * squash;
    const ctrl2Y = hy + HERO_BODY.ctrl2[1] * r * stretch;

    g.moveTo(hx, tipY)
      .bezierCurveTo(hx + ctrl1X, ctrl1Y, hx + ctrl2X, ctrl2Y, hx, baseY)
      .bezierCurveTo(hx - ctrl2X, ctrl2Y, hx - ctrl1X, ctrl1Y, hx, tipY)
      .closePath()
      .fill({ color: 0x2288cc, alpha: 0.95 })
      .stroke({ width: 1.2, color: 0x7cd6ff, alpha: 0.9 });

    g.ellipse(hx - r * 0.28 * squash, hy - r * 0.2 * stretch, r * 0.25, r * 0.45)
      .fill({ color: 0xffffff, alpha: 0.4 });

    const eyeOffsetX = h.facing * 3.5;
    const eyeY = hy + r * 0.05 * stretch;
    g.circle(hx + eyeOffsetX - 3, eyeY, 1.8).fill(0x061422);
    g.circle(hx + eyeOffsetX + 3, eyeY, 1.8).fill(0x061422);
    g.circle(hx + eyeOffsetX - 3.5, eyeY - 0.5, 0.7).fill(0xffffff);
    g.circle(hx + eyeOffsetX + 2.5, eyeY - 0.5, 0.7).fill(0xffffff);

    g.rect(hx - r * 0.65 * squash, hy - r * 0.5 * stretch, r * 1.3 * squash, 2.5).fill(0xff4444);

    const wandX = hx + h.facing * 12;
    const wandY = hy + 2;
    g.rect(wandX - 2, wandY - 2, 8, 4).fill(0x444444);
    g.circle(wandX + 6, wandY, 3).fill(0x4dc4ff);
  }

  _drawEffects() {
    const g = this.gEffects;
    g.clear();
    const tc = THEME_COLORS[this.theme] || THEME_COLORS.municipal;

    for (const s of this._sparks) {
      const alpha = s.life / s.maxLife;
      g.circle(s.x, s.y, s.size * alpha).fill({ color: s.color, alpha });
    }

    for (const r of this._ripples) {
      const rad = r.t * r.maxR;
      const alpha = (1 - r.t) * 0.45;
      g.circle(r.x, r.y, rad).stroke({ width: 1.5 - r.t, color: tc.accent, alpha });
      if (r.t < 0.6) {
        g.circle(r.x, r.y, rad * 0.5).stroke({ width: 0.6, color: 0xffffff, alpha: alpha * 0.5 });
      }
    }

    if (this._tapFlash > 0.01) {
      g.rect(0, 0, W, H).fill({ color: tc.accent, alpha: this._tapFlash * 0.035 });
    }
  }
}
