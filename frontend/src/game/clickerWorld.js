// =============================================
// CLICKER CONSPIRACY WORLD — High-Fidelity PixiJS Arena & Illuminati Engine
// =============================================

import { Application, Container, Graphics, Sprite, Rectangle, FillGradient, ColorMatrixFilter } from 'pixi.js';
import { bakeLightTexture } from './litShading';
import { HERO_COLORS, heroHalfPoints } from './heroShape';
import { HeroGait } from './heroGait';
import { drawHeroFace, drawArms, drawHeadband, drawHeldWeapon } from './heroDraw';
import { EXPRESSIONS } from './heroAnim';
import { Audio } from './audio';

const TAU = Math.PI * 2;
const W = 800, H = 440;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const noise = (i) => ((i * 2654435761) >>> 0) / 4294967295;

const CLICKER_RIB = {
  accent: '#dce8f2', muzzle: 36,
  parts: [
    [-11, -1.7, 11, 3.4, '#17110c'],
    [-9.5, -1.9, 2, 3.8, '#3b2f22'], [-6, -1.9, 2, 3.8, '#3b2f22'],
    [-2.5, -1.9, 2, 3.8, '#3b2f22'],
    [-12.5, -2.2, 1.8, 4.4, '#6b5a2e'],
    [0.6, -4.6, 2.6, 9.2, '#6b5a2e'],
    [0.6, -4.6, 2.6, 2.0, '#a08a4a'],
    [3.4, -1.6, 29, 3.2, '#aebecd'],
    [3.4, -1.6, 29, 1.1, '#eef6ff'],
    [3.4, 0.9, 29, 0.7, '#f8fdff', 0.75],
    [32.2, -1.2, 3.0, 2.4, '#c6d6e4'],
    [35.0, -0.8, 2.2, 1.6, '#eef6ff'],
  ],
};

export class ClickerWorld {
  constructor(canvas, opts = {}) {
    const prev = canvas && canvas.__clkWorld;
    if (prev && prev !== this) prev.destroy();
    if (canvas) canvas.__clkWorld = this;

    this.canvas = canvas;
    this.mapId = opts.mapId || 'pyramid';
    this.theme = opts.theme || 'pyramid';
    this.chapter = opts.chapter || 0;
    this.save = opts.save || null;
    this.isPaused = false;

    // Callbacks
    this.onTapWell = opts.onTapWell || (() => {});
    this.onTapObject = opts.onTapObject || (() => {});
    this.onCollectDrop = opts.onCollectDrop || (() => {});
    this.onEnemyDefeated = opts.onEnemyDefeated || (() => {});
    this.onChestUnlocked = opts.onChestUnlocked || (() => {});
    this.onArnoldTapped = opts.onArnoldTapped || (() => {});
    this.onPresidentDumbTapped = opts.onPresidentDumbTapped || (() => {});
    this.onHeroLevelUp = opts.onHeroLevelUp || (() => {});
    this.onDaySurvived = opts.onDaySurvived || (() => {});
    this.onLootDiscovered = opts.onLootDiscovered || (() => {});

    this.app = null;
    this.destroyed = false;
    this.t = 0;

    // 24-Hour Cycle (0.0 to 24.0 hours, 1 sec = 0.5 hours)
    this.timeOfDay = 8.0;

    // Mouse / Aim state
    this.pointerX = W * 0.5;
    this.pointerY = H * 0.4;
    this.isPointerDown = false;
    this.screenShake = 0;

    // Eye tracking state (Pyramid)
    this.eyeTargetX = 0;
    this.eyeTargetY = 0;
    this.eyeX = 0;
    this.eyeY = 0;
    this.eyeBlink = 0;
    this._eyeBlinkT = 3.2;
    this.pyramidCharge = 0; // 0 to 100
    this.pyramidFlash = 0;

    // Tap & Visual feedback
    this._tapFlash = 0;
    this._tapX = W / 2;
    this._tapY = H / 2;
    this._ripples = [];
    this._sparks = [];
    this._floatingNumbers = [];

    // Projectiles
    this.projectiles = [];

    // Interactive monsters
    this.enemies = [];
    this._enemySpawnT = 2.0;

    // Ground drops
    this.groundDrops = [];

    // Mystery Treasure Chests
    this.chests = [];
    this._chestSpawnT = 14.0;

    // Armold Svartnmeger
    this.arnold = {
      active: false,
      x: -120,
      y: H * 0.72 - 14,
      vx: 110,
      gallopT: 0,
      t: 0,
      hitFlash: 0,
    };
    this._arnoldSpawnT = 15.0;

    // President Dumb at DUMB TOWER
    this.presidentDumb = {
      x: W * 0.74,
      y: H * 0.72 - 18,
      facing: -1,
      t: 0,
      talkT: 0,
      hitFlash: 0,
    };

    // Secret loot interactives
    this._interactives = [];

    // Procedural Gait & Rig
    this.gait = new HeroGait();

    // Hardcoded drop — same silhouette as combat. Never a sprite sheet.
    this.hero = {
      x: W * 0.28,
      y: H * 0.74,
      targetX: W * 0.28,
      targetY: H * 0.74,
      vx: 0,
      r: 22,
      aimAngle: 0,
      recoil: 0,
      muzzleFlash: 0,
      attackT: 0,
      cheerT: 0,
      blinkT: 3.0,
      blink: 0,
      tier: 1,
      hp: 100,
      maxHp: 100,
      lvl: 1,
      xp: 0,
      maxXp: 100,
    };

    // Orbiting 3D water droplets around hero
    this.heroDroplets = [];
    for (let i = 0; i < 6; i++) {
      this.heroDroplets.push({
        angle: (i / 6) * TAU,
        radiusX: 30 + (i % 2) * 12,
        radiusY: 10 + (i % 2) * 4,
        speed: 1.4 + (i % 3) * 0.5,
        size: 3.0 + (i % 3) * 1.5,
      });
    }

    // Spaceship Warp / Travel state
    this.shipTravel = {
      active: false,
      phase: 'idle', // 'idle' | 'landing' | 'boarding' | 'warp' | 'arriving'
      t: 0,
      shipX: W * 0.5,
      shipY: -120,
      shipVx: 0,
      shipVy: 0,
      targetMapId: null,
      onComplete: null,
      warpStreakSpeed: 0,
      shipId: 'skiff',
      shipColor: '#5fd6ff',
    };

    // Background Stars & Warp Streaks
    this._stars = [];
    for (let i = 0; i < 90; i++) {
      this._stars.push({
        x: noise(i * 47) * W,
        y: noise(i * 53 + 7) * H * 0.60,
        size: 0.8 + noise(i * 67) * 2.2,
        twinkle: noise(i * 71) * TAU,
        speed: 0.6 + noise(i * 79) * 2.2,
        streakLen: 0,
      });
    }

    // Floating Occult / Sacred Runes
    this._floaters = [];
    for (let i = 0; i < 24; i++) {
      this._floaters.push({
        x: noise(i * 7) * W,
        y: noise(i * 13 + 3) * H * 0.65 + H * 0.08,
        phase: noise(i * 17) * TAU,
        speed: 0.25 + noise(i * 23) * 0.7,
        size: 3.0 + noise(i * 31) * 5.5,
        alpha: 0.15 + noise(i * 37) * 0.35,
        symbol: i % 7,
      });
    }

    // Dynamic Weather / Atmospheric Particles per Map
    this._weatherParticles = [];
    for (let i = 0; i < 60; i++) {
      this._weatherParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0,
        vy: 0,
        size: 1.0 + Math.random() * 2.5,
        life: Math.random(),
        maxLife: 1.5 + Math.random() * 2.0,
        alpha: 0.2 + Math.random() * 0.6,
        rot: Math.random() * TAU,
        vRot: (Math.random() - 0.5) * 4.0,
      });
    }

    // Camera Impact Physics
    this.cameraTrauma = 0;
    this._lightningFlash = 0;

    // Combat Fever / Combo Chain State
    this.combo = 0;
    this.comboT = 0;
    this.feverT = 0;
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
      backgroundColor: 0x040810,
      antialias: true,
      preference: 'webgl',
    });
    if (this.destroyed) { app.destroy(true); return; }

    this.root = new Container();
    app.stage.addChild(this.root);

    // Bake light texture
    this.lightTex = bakeLightTexture(app, 48);

    // Scene Graph Layers
    this.gSky = new Graphics();        this.root.addChild(this.gSky);
    this.gStars = new Graphics();      this.root.addChild(this.gStars);
    this.gGround = new Graphics();     this.root.addChild(this.gGround);
    this.gMapEnvironment = new Graphics(); this.root.addChild(this.gMapEnvironment);
    this.lightLayer = new Container();  this.root.addChild(this.lightLayer);
    this.gFloaters = new Graphics();    this.root.addChild(this.gFloaters);
    this.gWeather = new Graphics();     this.root.addChild(this.gWeather);
    this.gProjectiles = new Graphics(); this.root.addChild(this.gProjectiles);
    this.gEnemies = new Graphics();    this.root.addChild(this.gEnemies);
    this.gChests = new Graphics();     this.root.addChild(this.gChests);
    this.gArnold = new Graphics();     this.root.addChild(this.gArnold);
    this.gPresident = new Graphics();  this.root.addChild(this.gPresident);
    this.gDrops = new Graphics();      this.root.addChild(this.gDrops);
    
    // Hero container & sprite
    this.heroContainer = new Container(); this.root.addChild(this.heroContainer);
    this.gHeroFx = new Graphics();        this.heroContainer.addChild(this.gHeroFx);

    this.gShip = new Graphics();       this.root.addChild(this.gShip);
    this.gEffects = new Graphics();    this.root.addChild(this.gEffects);
    this.gHud = new Graphics();        this.root.addChild(this.gHud);

    // Dynamic Light Pool
    this._lightSprites = [];
    for (let i = 0; i < 50; i++) {
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
      // Grade only. A stock bloom filter here hung Chrome.
      // skill's forbidden path — the clicker already has pooled additive lights.
      const grade = new ColorMatrixFilter();
      grade.brightness(1.04, false);
      grade.contrast(0.5, true);
      grade.saturate(0.12, true);
      this.root.filters = [grade];
    } catch (e) {
      // filters optional
    }

    this.root.eventMode = 'static';
    this.root.hitArea = new Rectangle(0, 0, W, H);

    this.root.on('pointermove', (e) => {
      const local = this.root.toLocal(e.global);
      this.pointerX = local.x;
      this.pointerY = local.y;
      this.eyeTargetX = clamp((local.x - W / 2) / (W * 0.35), -1, 1);
      this.eyeTargetY = clamp((local.y - (H * 0.38)) / (H * 0.3), -1, 1);
      this.hero.aimAngle = Math.atan2(local.y - (this.hero.y - 18), local.x - this.hero.x);
    });

    this.root.on('pointerdown', (e) => {
      const local = this.root.toLocal(e.global);
      this.pointerX = local.x;
      this.pointerY = local.y;
      this.isPointerDown = true;
      this.handleTap(local.x, local.y);
    });

    this._onPointerUp = () => { this.isPointerDown = false; };
    window.addEventListener('pointerup', this._onPointerUp);

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
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    const scale = Math.min(w / W, h / H);
    this.root.scale.set(scale);
    this.root.position.set((w - W * scale) / 2, (h - H * scale) / 2);
    this.root.hitArea = new Rectangle(0, 0, W, H);
    if (this.root.filterArea) {
      this.root.filterArea.width = w / scale;
      this.root.filterArea.height = h / scale;
    }
  }

  setMap(mapId) {
    this.mapId = mapId;
    this._paintSky();
    this._paintGround();
  }

  setPaused(paused) {
    this.isPaused = !!paused;
  }

  flashTap() {
    this._tapFlash = 1.0;
    this.hero.cheerT = 0.6;
    this.hero.recoil = 0.8;
  }

  updateHeroStats(stats = {}) {
    if (stats.lvl !== undefined) this.hero.lvl = stats.lvl;
    if (stats.tier !== undefined) this.hero.tier = stats.tier;
    if (stats.hp !== undefined) this.hero.hp = stats.hp;
    if (stats.maxHp !== undefined) this.hero.maxHp = stats.maxHp;
  }

  startHyperspaceTravel(targetMapId, onComplete, opts = {}) {
    if (this.shipTravel.active) return;
    this.shipTravel.active = true;
    this.shipTravel.phase = 'landing';
    this.shipTravel.t = 0;
    this.shipTravel.shipX = this.hero.x;
    this.shipTravel.shipY = -120;
    this.shipTravel.targetMapId = targetMapId;
    this.shipTravel.onComplete = onComplete;
    this.shipTravel.shipId = opts.shipId || 'skiff';
    this.shipTravel.shipColor = opts.shipColor || '#5fd6ff';
    this.hero.cheerT = 2.0;

    this.pushFloatingText(this.hero.x, this.hero.y - 45, 'WARP SEQUENCE INITIATED', '#4dffd4', 1.3);
  }

  pushFloatingText(x, y, text, color = '#ffd166', scale = 1.0) {
    this._floatingNumbers.push({
      x, y, text, color, scale,
      vy: -55 - Math.random() * 25,
      vx: (Math.random() - 0.5) * 35,
      life: 0.9,
      maxLife: 0.9,
    });
    if (this._floatingNumbers.length > 25) this._floatingNumbers.shift();
  }

  handleTap(x, y) {
    this._tapFlash = 1.0;
    this._tapX = x;
    this._tapY = y;
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + (this.feverT > 0 ? 0.22 : 0.14));

    // Combo Counter & Fever Mode
    this.combo++;
    this.comboT = 1.8;
    if (this.combo >= 15 && this.feverT <= 0) {
      this.feverT = 6.0;
      this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.45);
      if (Audio.rageAwaken) Audio.rageAwaken();
      this.pushFloatingText(this.hero.x, this.hero.y - 45, '★ HYDRO FEVER MODE! ★', '#ffd700', 1.45);
    }

    this._ripples.push({ x, y, t: 0, maxR: 35 + Math.random() * 25 });
    if (this._ripples.length > 10) this._ripples.shift();

    // Aim hero and trigger attack animation
    this.hero.aimAngle = Math.atan2(y - (this.hero.y - 18), x - this.hero.x);
    this.hero.recoil = 1.0;
    this.hero.muzzleFlash = 1.0;
    this.hero.attackT = this.feverT > 0 ? 0.28 : 0.45;

    // Fire visible high-speed projectile
    this._fireHeroProjectile(x, y);
    if (this.feverT > 0 && Audio.katanaFinisher) Audio.katanaFinisher();
    else if (Audio.katanaSlash) Audio.katanaSlash();

    // TAP_PAY_ALWAYS — the idle loop. Used to fire only on the pyramid eye,
    // so every other map (and every miss) produced juice with zero drops.
    this.onTapWell(x, y);

    // Check Armold click
    if (this.arnold.active && Math.hypot(x - this.arnold.x, y - this.arnold.y) < 42) {
      this.arnold.hitFlash = 1.0;
      this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.35);
      this._spawnSparks(this.arnold.x, this.arnold.y - 10, 0xffd166, 25);
      this._spawnDropFountain(this.arnold.x, this.arnold.y - 10, 10);
      this.pushFloatingText(this.arnold.x, this.arnold.y - 30, 'ARMOLD PUMPED! ×3', '#ffd166', 1.25);
      this.hero.cheerT = 1.2;
      if (Audio.rageAwaken) Audio.rageAwaken();
      this.onArnoldTapped(this.arnold);
      return;
    }

    // Check President Dumb click at DUMB TOWER
    if (this.mapId === 'dumbtower' && Math.hypot(x - this.presidentDumb.x, y - this.presidentDumb.y) < 40) {
      this.presidentDumb.hitFlash = 1.0;
      this.presidentDumb.talkT = 2.5;
      this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.30);
      this._spawnSparks(this.presidentDumb.x, this.presidentDumb.y - 12, 0xffaa00, 20);
      this._spawnDropFountain(this.presidentDumb.x, this.presidentDumb.y - 12, 8);
      this.pushFloatingText(this.presidentDumb.x, this.presidentDumb.y - 30, 'HUGE WATER! +GOLD', '#ffd166', 1.2);
      if (Audio.clickerCrit) Audio.clickerCrit();
      this.onPresidentDumbTapped(this.presidentDumb);
      return;
    }

    // Check Chest clicks
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const ch = this.chests[i];
      if (Math.hypot(x - ch.x, y - ch.y) < 36) {
        ch.hits--;
        ch.hitFlash = 1.0;
        this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.22);
        this._spawnSparks(ch.x, ch.y, 0xffd166, 15);
        if (ch.hits <= 0) {
          this.chests.splice(i, 1);
          this._spawnDropFountain(ch.x, ch.y, 14);
          this.pushFloatingText(ch.x, ch.y - 20, 'CACHE UNLOCKED!', '#4dffd4', 1.3);
          this.hero.cheerT = 1.0;
          if (Audio.rewardFanfare) Audio.rewardFanfare();
          this.onChestUnlocked(ch);
        } else {
          this.pushFloatingText(ch.x, ch.y - 15, `${ch.hits} HITS`, '#e0d8c0', 0.9);
          if (Audio.clickerTap) Audio.clickerTap();
        }
        return;
      }
    }

    // Check Enemy clicks
    let hitEnemy = false;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (Math.hypot(x - en.x, y - en.y) < en.radius + 14) {
        en.hp--;
        en.hitFlash = 1.0;
        hitEnemy = true;
        const isCrit = Math.random() < 0.25;

        // Knockback physics impulse
        en.vx += (en.x > this.hero.x ? 1 : -1) * (isCrit ? 110 : 60);
        en.y -= isCrit ? 12 : 6;
        this.cameraTrauma = Math.min(1.0, this.cameraTrauma + (isCrit ? 0.40 : 0.18));

        this._spawnSparks(en.x, en.y, en.color, 14);
        for (let s = 0; s < (isCrit ? 8 : 4); s++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 40 + Math.random() * (isCrit ? 120 : 60);
          this._sparks.push({
            x: en.x, y: en.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 25,
            life: 0.35,
            color: isCrit ? 0xff3366 : 0x5fd6ff,
            size: isCrit ? 3.0 : 1.8,
          });
        }

        const text = isCrit ? 'CRIT! -2' : '-1';
        this.pushFloatingText(en.x, en.y - 18, text, isCrit ? '#ff3366' : '#ffd166', isCrit ? 1.3 : 1.0);
        if (isCrit && Audio.katanaFinisher) Audio.katanaFinisher();

        if (en.hp <= 0) {
          this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.30);
          this._spawnSparks(en.x, en.y, en.color, 28);
          this._spawnDropFountain(en.x, en.y, en.dropsCount || 5);
          this.pushFloatingText(en.x, en.y - 25, 'DESTROYED! +DROPS', '#4dffd4', 1.25);
          this.onEnemyDefeated(en);
          this.enemies.splice(i, 1);
        }
        break;
      }
    }

    // Check Pyramid Center / Well / All-Seeing Eye
    if (this.mapId === 'pyramid') {
      const cx = W / 2, cy = H * 0.44;
      if (Math.hypot(x - cx, y - cy) < 95) {
        this.hero.attackT = 0.35;
        this.pyramidFlash = 1.0;
        this.pyramidCharge = (this.pyramidCharge + 12) % 100;
        this._spawnSparks(cx, H * 0.32, 0xffd166, 20);

        const isCrit = Math.random() < 0.20;
        const critText = isCrit ? '✦ ILLUMINATI CRIT!' : '✦ EYE PULSE';
        this.pushFloatingText(x, y - 20, critText, isCrit ? '#ff3366' : '#ffd166', isCrit ? 1.35 : 1.05);
        if (isCrit && Audio.clickerCrit) Audio.clickerCrit();

        return;
      }
    }

    // Check Map Secret Loot Spots & Monuments
    for (const obj of this._interactives) {
      const odx = x - obj.x, ody = y - obj.y;
      if (odx * odx + ody * ody < obj.r * obj.r) {
        obj.hit = 1.0;
        this._spawnSparks(obj.x, obj.y, 0xffd166, 18);
        this.pushFloatingText(obj.x, obj.y - 20, 'ANCIENT HARMONIC', '#4dffd4', 1.15);
        if (obj.isLoot) {
          this.onLootDiscovered(obj.id);
        } else {
          this.onTapObject(obj.id, obj);
        }
        return;
      }
    }

    // Move hero on ground if clicked ground area
    if (!hitEnemy && y > H * 0.62) {
      this.hero.targetX = clamp(x, 60, W - 60);
    }
  }

  _fireHeroProjectile(targetX, targetY) {
    const h = this.hero;
    const facing = Math.cos(h.aimAngle) >= 0 ? 1 : -1;
    const muzzleX = h.x + facing * 24;
    const muzzleY = h.y - 28;
    const ang = Math.atan2(targetY - muzzleY, targetX - muzzleX);
    const dist = Math.hypot(targetX - muzzleX, targetY - muzzleY);
    const spd = 650;
    const life = dist / spd;

    const isBlood = this._isBloodMoon();
    const col = isBlood ? 0xff3355 : (h.tier >= 4 ? 0xffd166 : 0x4dc4ff);

    this.projectiles.push({
      x: muzzleX,
      y: muzzleY,
      targetX,
      targetY,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life,
      maxLife: life,
      color: col,
    });
  }

  _isBloodMoon() {
    if (this.mapId === 'bohemian') return true;
    return this.timeOfDay >= 2.0 && this.timeOfDay < 6.0;
  }

  _spawnSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * TAU;
      const spd = 40 + Math.random() * 120;
      this._sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        color,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        size: 2.0 + Math.random() * 3.0,
      });
    }
  }

  _spawnDropFountain(x, y, count) {
    const groundY = H * 0.72;
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const spd = 60 + Math.random() * 140;
      this.groundDrops.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: 5.5,
        life: 14.0,
        bounceY: groundY + Math.random() * (H * 0.22),
        bounces: 0,
      });
    }
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointerup', this._onPointerUp);
    if (this.canvas && this.canvas.__clkWorld === this) delete this.canvas.__clkWorld;
    if (this.app) { this.app.destroy(true); this.app = null; }
  }

  _paintSky() {
    const g = this.gSky;
    g.clear();
    const isBlood = this._isBloodMoon();
    const isNight = this.timeOfDay < 6.0 || this.timeOfDay >= 18.0;

    let skyTop = 0x050c18, skyBot = 0x123024;
    if (isBlood) {
      skyTop = 0x24040a;
      skyBot = 0x4a0a1a;
    } else if (isNight) {
      skyTop = 0x03060f;
      skyBot = 0x081624;
    } else {
      skyTop = 0x081e32;
      skyBot = 0x164634;
    }

    const hexC = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
    const skyGrad = new FillGradient({
      type: 'linear',
      textureSpace: 'local',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: hexC(skyTop) },
        { offset: 0.72, color: hexC(skyTop) },
        { offset: 1, color: hexC(skyBot) },
      ],
    });
    g.rect(0, 0, W, H).fill(skyGrad);
  }

  _paintGround() {
    const g = this.gGround;
    g.clear();
    const groundY = H * 0.72;
    const isBlood = this._isBloodMoon();

    const hexC = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
    const groundGrad = new FillGradient({
      type: 'linear',
      textureSpace: 'local',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: hexC(isBlood ? 0x22060c : 0x0a1e12) },
        { offset: 1, color: hexC(0x020604) },
      ],
    });
    g.rect(0, groundY, W, H - groundY).fill(groundGrad);
    g.rect(0, groundY - 1, W, 3).fill({ color: isBlood ? 0xff3355 : 0x4dffd4, alpha: 0.35 });

    // Grid / masonry lines on ground
    for (let x = 30; x < W; x += 55) {
      g.moveTo(x, groundY).lineTo(x + 20, H).stroke({ width: 0.8, color: isBlood ? 0xff3355 : 0x4dffd4, alpha: 0.08 });
    }
  }

  _tick(tk) {
    if (this.destroyed) return;
    const dt = Math.min(tk.deltaTime / 60, 0.05);

    if (!this.isPaused) {
      this.t += dt;

      // 24h clock
      const prevHour = this.timeOfDay;
      this.timeOfDay = (this.timeOfDay + dt * 0.5) % 24.0;
      if (prevHour < 24.0 && this.timeOfDay < prevHour) {
        this.onDaySurvived();
      }

      // Smooth eye movement
      this.eyeX = lerp(this.eyeX, this.eyeTargetX, 0.12);
      this.eyeY = lerp(this.eyeY, this.eyeTargetY, 0.12);

      // Eye blink
      this._eyeBlinkT -= dt;
      if (this._eyeBlinkT <= 0) {
        this.eyeBlink = 1.0;
        this._eyeBlinkT = 3.0 + Math.random() * 4.0;
      }
      this.eyeBlink = Math.max(0, this.eyeBlink - dt * 6.5);

      // Hero movement & gait
      const hdx = this.hero.targetX - this.hero.x;
      if (Math.abs(hdx) > 3) {
        const dir = Math.sign(hdx);
        this.hero.vx = dir * 140;
        this.hero.x += this.hero.vx * dt;
        this.gait.update(this.hero.vx, 0, 140, dt);
      } else {
        this.hero.vx = 0;
        this.gait.update(0, 0, 140, dt);
      }

      // Recover timers & recoil
      this.hero.recoil = Math.max(0, this.hero.recoil - dt * 5.0);
      this.hero.muzzleFlash = Math.max(0, this.hero.muzzleFlash - dt * 10.0);
      this.hero.attackT = Math.max(0, this.hero.attackT - dt);
      this.hero.cheerT = Math.max(0, this.hero.cheerT - dt);
      this.hero.blinkT -= dt;
      if (this.hero.blinkT <= 0) {
        this.hero.blink = 1;
        this.hero.blinkT = 2.2 + Math.random() * 2.4;
      }
      this.hero.blink = Math.max(0, this.hero.blink - dt * 8);
      this._tapFlash = Math.max(0, this._tapFlash - dt * 3.5);
      this.pyramidFlash = Math.max(0, this.pyramidFlash - dt * 4.0);
      this.screenShake = Math.max(0, this.screenShake - dt * 8.0);

      // Update Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          this._spawnSparks(p.targetX, p.targetY, p.color, 8);
          this.projectiles.splice(i, 1);
        }
      }

      // Update Drops
      const groundY = H * 0.72;
      for (let i = this.groundDrops.length - 1; i >= 0; i--) {
        const d = this.groundDrops[i];
        d.vy += 260 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y >= d.bounceY) {
          d.y = d.bounceY;
          d.vy = -d.vy * 0.42;
          d.vx *= 0.65;
          d.bounces++;
        }
        d.life -= dt;

        // Magnet to hero
        const hDist = Math.hypot(this.hero.x - d.x, this.hero.y - d.y);
        if (hDist < 65) {
          d.x += (this.hero.x - d.x) * dt * 7.0;
          d.y += (this.hero.y - d.y) * dt * 7.0;
          if (hDist < 18) {
            this.onCollectDrop();
            this.groundDrops.splice(i, 1);
            continue;
          }
        }
        if (d.life <= 0) this.groundDrops.splice(i, 1);
      }

      // Update Floating Numbers
      for (let i = this._floatingNumbers.length - 1; i >= 0; i--) {
        const fn = this._floatingNumbers[i];
        fn.x += fn.vx * dt;
        fn.y += fn.vy * dt;
        fn.life -= dt;
        if (fn.life <= 0) this._floatingNumbers.splice(i, 1);
      }

      // Update Sparks & Ripples
      for (let i = this._sparks.length - 1; i >= 0; i--) {
        const s = this._sparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 120 * dt;
        s.life -= dt;
        if (s.life <= 0) this._sparks.splice(i, 1);
      }

      for (let i = this._ripples.length - 1; i >= 0; i--) {
        const r = this._ripples[i];
        r.t += dt * 2.2;
        if (r.t >= 1.0) this._ripples.splice(i, 1);
      }

      // Update Armold
      this._updateArnold(dt);

      // Update Enemies
      this._updateEnemies(dt);

      // Update Mystery Chests
      this._updateChests(dt);

      // Update Spaceship Warp
      this._updateShipTravel(dt);

      // Update Map Weather & Atmospheric Physics
      this._updateWeather(dt);

      // Update Combo / Fever
      if (this.comboT > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;
      }
      if (this.feverT > 0) this.feverT -= dt;
    }

    // Render Scene
    this._render();
  }

  _updateWeather(dt) {
    const map = this.mapId;
    const groundY = H * 0.72;

    if (map === 'stonehenge') {
      if (Math.random() < 0.005) this._lightningFlash = 1.0;
    }
    if (this._lightningFlash > 0) {
      this._lightningFlash = Math.max(0, this._lightningFlash - dt * 3.5);
    }

    for (const p of this._weatherParticles) {
      p.life += dt;
      p.rot += p.vRot * dt;

      if (p.life >= p.maxLife) {
        p.life = 0;
        p.maxLife = 1.5 + Math.random() * 2.0;
        p.size = 1.0 + Math.random() * 2.5;
        p.alpha = 0.2 + Math.random() * 0.6;
        if (map === 'pyramid') {
          p.x = -10;
          p.y = Math.random() * groundY;
        } else if (map === 'gobekli') {
          p.x = W * 0.15 + Math.random() * (W * 0.7);
          p.y = groundY + Math.random() * 10;
        } else if (map === 'stonehenge') {
          p.x = Math.random() * (W + 60);
          p.y = -10;
        } else if (map === 'dumbtower') {
          p.x = -20;
          p.y = Math.random() * H;
        } else if (map === 'arnold_mansion') {
          p.x = Math.random() * W;
          p.y = groundY + Math.random() * 20;
        } else if (map === 'bohemian') {
          p.x = Math.random() * (W + 40);
          p.y = -10;
        } else {
          p.x = Math.random() * W;
          p.y = Math.random() * H;
        }
      }

      // Physics per map type
      if (map === 'pyramid') {
        // Golden Desert Sand drift
        p.vx = 65 + Math.sin(this.t * 2 + p.y * 0.02) * 20;
        p.vy = 8 + Math.cos(this.t * 3 + p.x * 0.05) * 6;
      } else if (map === 'gobekli') {
        // Sacred Brazier Ash & Embers rising
        p.vy = -(40 + Math.sin(this.t * 3 + p.x) * 15);
        p.vx = Math.cos(this.t * 2 + p.y * 0.05) * 18;
      } else if (map === 'stonehenge') {
        // Driving Rain
        p.vx = -45;
        p.vy = 340 + Math.sin(p.x * 0.1) * 40;
      } else if (map === 'dumbtower') {
        // High Altitude Fog & Golden Dollar Glitter
        p.vx = 22 + Math.cos(this.t + p.y * 0.03) * 12;
        p.vy = 12 + Math.sin(this.t * 1.5 + p.x * 0.02) * 8;
      } else if (map === 'arnold_mansion') {
        // Neon Cyber Motes
        p.vy = -(24 + Math.sin(this.t * 4 + p.x * 0.1) * 14);
        p.vx = Math.cos(this.t * 3 + p.y * 0.1) * 15;
      } else if (map === 'bohemian') {
        // Redwood Autumn Leaves Tumbling
        p.vx = -18 + Math.sin(this.t * 1.8 + p.y * 0.04) * 22;
        p.vy = 28 + Math.cos(this.t * 1.2 + p.x * 0.03) * 10;
      } else {
        p.vx = Math.sin(this.t + p.x) * 8;
        p.vy = Math.cos(this.t + p.y) * 8;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  _drawWeather() {
    const g = this.gWeather;
    g.clear();
    const map = this.mapId;
    const groundY = H * 0.72;

    // Stonehenge Lightning Ambient Illumination
    if (map === 'stonehenge' && this._lightningFlash > 0.02) {
      g.rect(0, 0, W, H).fill({ color: 0xdff4ff, alpha: this._lightningFlash * 0.40 });
    }

    for (const p of this._weatherParticles) {
      const progress = p.life / p.maxLife;
      const fade = Math.sin(progress * Math.PI) * p.alpha;
      if (fade <= 0.01) continue;

      if (map === 'pyramid') {
        // Golden sand specks
        g.circle(p.x, p.y, p.size * 0.8).fill({ color: 0xffd166, alpha: fade * 0.75 });
      } else if (map === 'gobekli') {
        // Glowing orange/amber fire embers
        const col = p.size > 2.0 ? 0xff6b35 : 0xffb703;
        g.circle(p.x, p.y, p.size).fill({ color: col, alpha: fade });
        g.circle(p.x, p.y, p.size * 0.4).fill({ color: 0xffffff, alpha: fade * 0.85 });
      } else if (map === 'stonehenge') {
        // Rain Streaks
        const rLen = 12 + p.size * 3;
        g.moveTo(p.x, p.y).lineTo(p.x - 2, p.y + rLen)
          .stroke({ width: 1.2, color: 0x9fe8ff, alpha: fade * 0.65 });
      } else if (map === 'dumbtower') {
        // Golden Bill / Gold Sparkle
        if (p.size > 2.2) {
          g.rect(p.x - 4, p.y - 2, 8, 4).fill({ color: 0x2ec4b6, alpha: fade * 0.85 });
          g.rect(p.x - 4, p.y - 2, 8, 4).stroke({ width: 0.8, color: 0xffd166, alpha: fade });
        } else {
          g.circle(p.x, p.y, p.size).fill({ color: 0xffd166, alpha: fade * 0.9 });
        }
      } else if (map === 'arnold_mansion') {
        // Neon green / magenta cyber motes
        const col = p.size > 2.0 ? 0x39ff14 : 0xff007f;
        g.circle(p.x, p.y, p.size).fill({ color: col, alpha: fade * 0.85 });
      } else if (map === 'bohemian') {
        // Autumn Redwood Leaf
        const leafCol = p.size > 2.2 ? 0xd62828 : 0xf77f00;
        const lx = p.x, ly = p.y;
        g.ellipse(lx, ly, p.size * 1.8, p.size * 0.9)
          .fill({ color: leafCol, alpha: fade * 0.85 });
      }
    }
  }

  _updateArnold(dt) {
    if (!this.arnold.active) {
      this._arnoldSpawnT -= dt;
      if (this._arnoldSpawnT <= 0) {
        this.arnold.active = true;
        this.arnold.x = -80;
        this.arnold.y = H * 0.72 - 16;
        this.arnold.vx = 110;
        this._arnoldSpawnT = 20.0 + Math.random() * 15.0;
      }
    } else {
      this.arnold.x += this.arnold.vx * dt;
      this.arnold.gallopT += dt;
      this.arnold.hitFlash = Math.max(0, this.arnold.hitFlash - dt * 4.0);
      if (this.arnold.x > W + 80) this.arnold.active = false;
    }
  }

  _updateEnemies(dt) {
    this._enemySpawnT -= dt;
    if (this._enemySpawnT <= 0 && this.enemies.length < 5) {
      const isBlood = this._isBloodMoon();
      const kinds = isBlood ? ['reptile', 'bat', 'fed'] : ['fed', 'bat'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const fromLeft = Math.random() < 0.5;

      this.enemies.push({
        kind,
        x: fromLeft ? -40 : W + 40,
        y: kind === 'bat' ? H * 0.35 + Math.random() * 60 : H * 0.72 - 12,
        vx: fromLeft ? (40 + Math.random() * 30) : -(40 + Math.random() * 30),
        hp: kind === 'reptile' ? 8 : kind === 'fed' ? 5 : 3,
        maxHp: kind === 'reptile' ? 8 : kind === 'fed' ? 5 : 3,
        radius: kind === 'bat' ? 12 : 14,
        color: kind === 'reptile' ? 0x39ff14 : kind === 'fed' ? 0xffaa00 : 0xb362ff,
        t: Math.random() * TAU,
        hitFlash: 0,
        dropsCount: kind === 'reptile' ? 8 : 4,
      });
      this._enemySpawnT = isBlood ? 2.5 : 4.5;
    }

    for (const en of this.enemies) {
      en.x += en.vx * dt;
      en.t += dt;
      en.hitFlash = Math.max(0, en.hitFlash - dt * 4.0);
      if (en.kind === 'bat') en.y += Math.sin(en.t * 4) * 0.6;
    }
  }

  _updateChests(dt) {
    this._chestSpawnT -= dt;
    if (this._chestSpawnT <= 0 && this.chests.length < 2) {
      this.chests.push({
        x: W * 0.15 + Math.random() * (W * 0.7),
        y: H * 0.72 - 14,
        hits: 3,
        maxHits: 3,
        t: Math.random() * TAU,
        hitFlash: 0,
      });
      this._chestSpawnT = 18.0 + Math.random() * 12.0;
    }
    for (const ch of this.chests) {
      ch.t += dt;
      ch.hitFlash = Math.max(0, ch.hitFlash - dt * 4.0);
    }
  }

  _updateShipTravel(dt) {
    const st = this.shipTravel;
    if (!st.active) return;
    st.t += dt;

    if (st.phase === 'landing') {
      st.shipY = lerp(st.shipY, this.hero.y - 40, 0.08);
      if (Math.abs(st.shipY - (this.hero.y - 40)) < 6) {
        st.phase = 'boarding';
        st.t = 0;
      }
    } else if (st.phase === 'boarding') {
      if (st.t > 0.8) {
        st.phase = 'warp';
        st.t = 0;
      }
    } else if (st.phase === 'warp') {
      st.warpStreakSpeed = Math.min(1.0, st.t * 1.5);
      this.cameraTrauma = Math.max(this.cameraTrauma, 0.65);
      st.shipX += 800 * dt;
      st.shipY -= 200 * dt;

      if (st.t > 1.6) {
        if (st.targetMapId) this.setMap(st.targetMapId);
        if (st.onComplete) st.onComplete();
        st.phase = 'arriving';
        st.t = 0;
        st.shipX = -100;
        st.shipY = this.hero.y - 40;
      }
    } else if (st.phase === 'arriving') {
      st.warpStreakSpeed = Math.max(0, 1.0 - st.t * 2.0);
      st.shipX = lerp(st.shipX, this.hero.x, 0.08);
      if (st.t > 1.2) {
        st.active = false;
        st.phase = 'idle';
        st.warpStreakSpeed = 0;
        this.pushFloatingText(this.hero.x, this.hero.y - 40, 'TRANSITION COMPLETE!', '#4dffd4', 1.25);
      }
    }
  }

  _render() {
    const dt = 0.016;
    const trauma = clamp(this.cameraTrauma + (this.screenShake || 0) * 0.15, 0, 1);
    const shake = Math.pow(trauma, 2);
    if (shake > 0.001) {
      const sx = (Math.sin(this.t * 52) + Math.cos(this.t * 37) * 0.5) * shake * 16;
      const sy = (Math.cos(this.t * 47) + Math.sin(this.t * 29) * 0.5) * shake * 16;
      const sRot = Math.sin(this.t * 41) * shake * 0.035;
      this.root.pivot.set(sx, sy);
      this.root.rotation = sRot;
    } else {
      this.root.pivot.set(0, 0);
      this.root.rotation = 0;
    }
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 4.0);

    this._drawStars();
    this._drawMapEnvironment();
    this._drawWeather();
    this._drawFloaters();
    this._drawChests();
    this._drawEnemies();
    this._drawArnold();
    this._drawPresidentDumb();
    this._drawDrops();
    this._drawHero();
    this._drawShip();
    this._drawProjectiles();
    this._drawEffects();
    this._drawLights();
    this._drawHud();
  }

  _drawStars() {
    const g = this.gStars;
    g.clear();
    const isWarp = this.shipTravel.warpStreakSpeed > 0;
    const warpLen = this.shipTravel.warpStreakSpeed * 80;

    for (const s of this._stars) {
      const alpha = 0.4 + Math.sin(this.t * s.speed + s.twinkle) * 0.4;
      if (isWarp) {
        g.moveTo(s.x, s.y).lineTo(s.x - warpLen, s.y + warpLen * 0.2)
          .stroke({ width: s.size * 1.5, color: 0x9fe8ff, alpha: Math.min(1, alpha + 0.3) });
      } else {
        g.circle(s.x, s.y, s.size).fill({ color: 0xffffff, alpha });
      }
    }
  }

  _drawMapEnvironment() {
    const g = this.gMapEnvironment;
    g.clear();
    this._interactives = [];
    const groundY = H * 0.72;

    if (this.mapId === 'gobekli') {
      // ── GÖBEKLI TEPE SANCTUARY ──────────────────────────
      const drawTPillar = (cx, baseY, w, h, headW, isMain = false) => {
        g.rect(cx - w / 2, baseY - h, w, h).fill(0x322b22).stroke({ width: 2, color: 0x584d3b });
        g.rect(cx - headW / 2, baseY - h - w * 0.6, headW, w * 0.6).fill(0x483e30).stroke({ width: 2, color: 0x6e6049 });
        
        // Engraved animal glyphs glowing in torchlight
        if (isMain) {
          const glyphPulse = 0.5 + Math.sin(this.t * 2.5) * 0.4;
          g.moveTo(cx - 6, baseY - h * 0.6).lineTo(cx + 6, baseY - h * 0.6)
            .lineTo(cx, baseY - h * 0.35).closePath()
            .stroke({ width: 1.5, color: 0xffa436, alpha: glyphPulse });
        }
      };

      drawTPillar(W * 0.20, groundY, 22, 85, 46);
      drawTPillar(W * 0.50, groundY, 28, 105, 58, true);
      drawTPillar(W * 0.80, groundY, 22, 82, 44);

      // Ceremonial Fire Braziers
      for (const fx of [W * 0.35, W * 0.65]) {
        g.rect(fx - 8, groundY - 22, 16, 22).fill(0x221c16).stroke({ width: 1.5, color: 0x443a2e });
        // Fire embers
        for (let e = 0; e < 4; e++) {
          const ep = (this.t * 1.5 + e * 0.25) % 1.0;
          const ex = fx + Math.sin(this.t * 4.0 + e * 2) * 6;
          const ey = groundY - 24 - ep * 20;
          g.circle(ex, ey, 2.0 * (1 - ep)).fill({ color: e % 2 === 0 ? 0xff4d00 : 0xffd166, alpha: (1 - ep) * 0.9 });
        }
      }

      this._interactives.push({ id: 'gobekli_sanctuary', x: W * 0.50, y: groundY - 55, r: 75, isLoot: true });

    } else if (this.mapId === 'stonehenge') {
      // ── STONEHENGE SOLSTICE & CROP CIRCLES ─────────────
      const drawTrilithon = (cx, baseY, w, h, gap) => {
        const lw = w * 0.36;
        g.rect(cx - gap / 2 - lw, baseY - h, lw, h).fill(0x22262b).stroke({ width: 2, color: 0x3d444e });
        g.rect(cx + gap / 2, baseY - h, lw, h).fill(0x22262b).stroke({ width: 2, color: 0x3d444e });
        g.rect(cx - gap / 2 - lw - 2, baseY - h - lw * 0.65, gap + lw * 2 + 4, lw * 0.65).fill(0x353c45).stroke({ width: 1.5, color: 0x4f5966 });
      };

      drawTrilithon(W * 0.24, groundY, 24, 78, 24);
      drawTrilithon(W * 0.50, groundY, 32, 95, 30);
      drawTrilithon(W * 0.76, groundY, 24, 75, 22);

      // Rotating Alien Crop Circle Rings
      const ccX = W * 0.50, ccY = groundY + 25;
      for (let r = 1; r <= 3; r++) {
        const rSize = r * 26;
        const rAng = this.t * (0.3 / r);
        g.ellipse(ccX, ccY, rSize, rSize * 0.35).stroke({ width: 1.2, color: 0x4dffd4, alpha: 0.35 });
        for (let n = 0; n < 4; n++) {
          const nang = rAng + (n / 4) * TAU;
          const nx = ccX + Math.cos(nang) * rSize;
          const ny = ccY + Math.sin(nang) * (rSize * 0.35);
          g.circle(nx, ny, 1.8).fill({ color: 0x7ffdff, alpha: 0.75 });
        }
      }

      // Solstice light beam descending from the heavens
      g.moveTo(W * 0.50 - 24, 0).lineTo(W * 0.50 + 24, 0).lineTo(W * 0.50 + 38, groundY).lineTo(W * 0.50 - 38, groundY).closePath()
        .fill({ color: 0x4dffd4, alpha: 0.08 + Math.sin(this.t * 2.0) * 0.04 });

      this._interactives.push({ id: 'crop_circle', x: W * 0.50, y: groundY - 45, r: 75, isLoot: true });

    } else if (this.mapId === 'dumbtower') {
      // ── DUMB TOWER & GOLDEN ESCALATOR ──────────────────
      const bX = W * 0.50, bW = 190, bH = 220;
      g.rect(bX - bW / 2, groundY - bH, bW, bH).fill(0x0e1410).stroke({ width: 3, color: 0xffaa00, alpha: 0.9 });
      
      // Golden floors & art-deco lines
      for (let f = 1; f < 10; f++) {
        g.rect(bX - bW / 2 + 8, groundY - bH + f * 21, bW - 16, 2).fill({ color: 0xffd166, alpha: 0.5 });
      }

      // Glass Elevator Shaft with moving golden carriage
      const elevY = groundY - bH + 20 + ((this.t * 35) % (bH - 50));
      g.rect(bX - 16, groundY - bH + 10, 32, bH - 20).stroke({ width: 1.5, color: 0xffd166, alpha: 0.4 });
      g.rect(bX - 12, elevY, 24, 20).fill(0xffd166).stroke({ width: 1.5, color: 0xffffff });

      // Penthouse Beacon Light
      const sweepAng = this.t * 1.8;
      g.moveTo(bX, groundY - bH).lineTo(bX + Math.cos(sweepAng) * 140, groundY - bH + Math.sin(sweepAng) * 60)
        .stroke({ width: 2.5, color: 0xffd166, alpha: 0.35 });

      // Neon Logo
      g.roundRect(bX - 60, groundY - bH + 8, 120, 26, 4).fill(0x000000).stroke({ width: 2, color: 0xffaa00 });

      this._interactives.push({ id: 'dumb_tower_elevator', x: bX, y: groundY - 65, r: 75, isLoot: true });

    } else if (this.mapId === 'armold_mansion') {
      // ── ARMOLD'S BELGIAN BLUE MANSION ──────────────────
      const mX = W * 0.50;
      g.roundRect(mX - 120, groundY - 105, 240, 105, 8).fill(0x101c12).stroke({ width: 3, color: 0x39ff14, alpha: 0.8 });
      
      // Chrome Barbells & Hydraulic Lifting Pumps
      const pumpBob = Math.sin(this.t * 5.0) * 8;
      g.rect(mX - 50, groundY - 75 + pumpBob, 100, 6).fill(0xeeeeee);
      g.circle(mX - 50, groundY - 72 + pumpBob, 16).fill(0x1b1b1b).stroke({ width: 2, color: 0x39ff14 });
      g.circle(mX + 50, groundY - 72 + pumpBob, 16).fill(0x1b1b1b).stroke({ width: 2, color: 0x39ff14 });

      // Neon Sign
      g.roundRect(mX - 70, groundY - 125, 140, 22, 4).fill(0x050c06).stroke({ width: 2, color: 0x39ff14 });

      this._interactives.push({ id: 'armold_gym_vault', x: mX, y: groundY - 55, r: 75, isLoot: true });

    } else if (this.mapId === 'bohemian') {
      // ── BOHEMIAN GROVE (BLOOD MOON) ────────────────────
      const owlX = W * 0.50;
      
      // Background Redwood Tree Silhouettes
      for (const rx of [W * 0.15, W * 0.32, W * 0.68, W * 0.85]) {
        g.moveTo(rx, groundY - 180).lineTo(rx - 28, groundY).lineTo(rx + 28, groundY).closePath().fill(0x120c14);
      }

      // 40-Foot Stone Owl Effigy
      g.roundRect(owlX - 52, groundY - 150, 104, 150, 24).fill(0x221a22).stroke({ width: 3, color: 0x483a48 });
      // Glowing Blood Eyes
      const eyePulse = 0.7 + Math.sin(this.t * 3.5) * 0.3;
      g.circle(owlX - 20, groundY - 105, 9).fill({ color: 0xff0044, alpha: eyePulse });
      g.circle(owlX + 20, groundY - 105, 9).fill({ color: 0xff0044, alpha: eyePulse });
      g.circle(owlX - 20, groundY - 105, 3).fill(0xffffff);
      g.circle(owlX + 20, groundY - 105, 3).fill(0xffffff);

      // Sacred Altar Fire Cauldron
      g.ellipse(owlX, groundY - 12, 30, 8).fill(0x160e18).stroke({ width: 2, color: 0xff0044 });
      for (let f = 0; f < 5; f++) {
        const fp = (this.t * 1.8 + f * 0.2) % 1.0;
        const fx = owlX + Math.sin(this.t * 5.0 + f * 2.0) * 12;
        const fy = groundY - 14 - fp * 28;
        g.circle(fx, fy, 2.5 * (1 - fp)).fill({ color: 0xff2255, alpha: (1 - fp) * 0.95 });
      }

      this._interactives.push({ id: 'bohemian_owl_altar', x: owlX, y: groundY - 75, r: 75, isLoot: true });

    } else {
      // ── THE GREAT SEAL ILLUMINATI PYRAMID ──────────────
      const cx = W / 2, tipY = groundY - 125, pyramidW = 180;
      const layers = 13;

      for (let i = 0; i < layers; i++) {
        const topT = i / layers, botT = (i + 1) / layers;
        const y0 = tipY + (groundY - tipY) * topT;
        const y1 = tipY + (groundY - tipY) * botT;
        const halfW0 = (pyramidW / 2) * topT;
        const halfW1 = (pyramidW / 2) * botT;
        const col = (i % 2 === 0) ? 0x1a2e22 : 0x14241b;
        g.moveTo(cx - halfW0, y0).lineTo(cx + halfW0, y0).lineTo(cx + halfW1, y1).lineTo(cx - halfW1, y1).closePath()
          .fill(col).stroke({ width: 1.2, color: 0xffd166, alpha: 0.40 });

        if (i % 3 === 0) {
          g.moveTo(cx - halfW0 + 4, (y0 + y1) / 2).lineTo(cx + halfW0 - 4, (y0 + y1) / 2)
            .stroke({ width: 1.0, color: 0x4dffd4, alpha: 0.35 });
        }
      }

      // Sacred Lotus Fountain at the base (Cascading water drops)
      g.ellipse(cx, groundY - 4, 38, 9).fill(0x0d2830).stroke({ width: 1.5, color: 0x5fd6ff });
      for (let d = 0; d < 4; d++) {
        const dp = (this.t * 1.4 + d * 0.25) % 1.0;
        const dx = cx + Math.sin(this.t * 3.0 + d * 1.7) * 16;
        const dy = groundY - 6 - Math.sin(dp * Math.PI) * 14;
        g.circle(dx, dy, 1.8).fill({ color: 0x5fd6ff, alpha: 0.85 });
      }

      // Radiant Gold Capstone
      const capCY = tipY - 24 + Math.sin(this.t * 2.2) * 4;
      const flash = this.pyramidFlash > 0;
      const capColor = flash ? 0xffffff : 0x1b3324;
      const trimColor = flash ? 0xffffff : 0xffd166;

      // Rotating Sacred Geometry Rings around Capstone
      for (let ring = 1; ring <= 2; ring++) {
        const rRad = 26 + ring * 12;
        const rAng = this.t * (0.8 / ring);
        g.ellipse(cx, capCY, rRad, rRad * 0.45).stroke({ width: 1.0, color: 0xffd166, alpha: 0.45 });
      }

      // Radiant Ray Burst
      const rayCount = 14;
      for (let r = 0; r < rayCount; r++) {
        const rAng = (r / rayCount) * TAU + this.t * 0.35;
        const rLen = 36 + Math.sin(this.t * 3 + r) * 10;
        g.moveTo(cx + Math.cos(rAng) * 22, capCY + Math.sin(rAng) * 22)
          .lineTo(cx + Math.cos(rAng) * (22 + rLen), capCY + Math.sin(rAng) * (22 + rLen))
          .stroke({ width: 1.4, color: 0xffd166, alpha: 0.40 });
      }

      g.moveTo(cx, capCY - 24).lineTo(cx + 28, capCY + 18).lineTo(cx - 28, capCY + 18).closePath()
        .fill(capColor).stroke({ width: 2.5, color: trimColor });

      // The All-Seeing Eye with active dilation and tracker
      const eyeH = Math.max(1, 16 * (1 - this.eyeBlink));
      g.ellipse(cx, capCY + 2, 19, eyeH).fill(0xf2fcf6).stroke({ width: 1.8, color: 0xffd166 });

      if (this.eyeBlink < 0.85) {
        const pupilX = cx + this.eyeX * 6.5;
        const pupilY = (capCY + 2) + this.eyeY * 4.5;
        g.circle(pupilX, pupilY, 7.5).fill(0xcc2233);
        g.ellipse(pupilX, pupilY, 3.4, 6.2).fill(0x06140a);
        g.circle(pupilX - 2.2, pupilY - 2.2, 2.2).fill(0xffffff);
      }
    }
  }

  _drawFloaters() {
    const g = this.gFloaters;
    g.clear();
    const isBlood = this._isBloodMoon();
    const accent = isBlood ? 0xff3366 : 0x4dffd4;

    for (const f of this._floaters) {
      const x = f.x + Math.sin(this.t * f.speed + f.phase) * 12;
      const y = f.y + Math.cos(this.t * f.speed * 0.7 + f.phase) * 8;
      const alpha = f.alpha * (0.6 + Math.sin(this.t * f.speed * 1.4 + f.phase * 2) * 0.4);
      const s = f.size;

      if (f.symbol === 0) {
        g.circle(x, y, s).stroke({ width: 0.8, color: accent, alpha });
      } else if (f.symbol === 1) {
        g.moveTo(x, y - s).lineTo(x + s, y + s).lineTo(x - s, y + s).closePath()
          .stroke({ width: 0.8, color: accent, alpha });
      } else {
        g.rect(x - s / 2, y - s / 2, s, s).stroke({ width: 0.8, color: accent, alpha });
      }
    }
  }

  _drawHero() {
    const g = this.gHeroFx;
    g.clear();
    const h = this.hero;
    const hx = h.x - Math.cos(h.aimAngle) * h.recoil * 6;
    const hy = h.y;
    const aimAng = h.aimAngle;
    const aimX = Math.cos(aimAng);
    const facing = aimX >= 0 ? 1 : -1;

    // Contact shadow
    const bounce = Math.sin(this.t * 6) * 1.5;
    g.ellipse(hx, hy + 2, 28 * (1 + bounce * 0.04), 10).fill({ color: 0x000000, alpha: 0.55 });

    // Tier 1-4 Evolution Auras
    if (h.tier >= 2) {
      const auraColor = h.tier >= 4 ? 0xffd166 : h.tier >= 3 ? 0x4dffd4 : 0x22aaff;
      const pulse = 1.0 + Math.sin(this.t * 6) * 0.15;
      g.circle(hx, hy - 32, 42 * pulse).stroke({ width: 2.0, color: auraColor, alpha: 0.4 });
      g.circle(hx, hy - 32, 42 * pulse).fill({ color: auraColor, alpha: 0.08 });
    }

    // 3D Orbiting Water Droplets
    for (const drop of this.heroDroplets) {
      drop.angle += drop.speed * 0.016;
      const dx = hx + Math.cos(drop.angle) * drop.radiusX;
      const dy = hy - 32 + Math.sin(drop.angle) * drop.radiusY;
      const zScale = 0.7 + (Math.sin(drop.angle) + 1) * 0.3;
      const alpha = 0.5 + (Math.sin(drop.angle) + 1) * 0.25;
      g.circle(dx, dy, drop.size * zScale).fill({ color: 0x4dc4ff, alpha });
      g.circle(dx - 1, dy - 1, drop.size * zScale * 0.4).fill({ color: 0xffffff, alpha: 0.9 });
    }

    const r = h.r || 22;
    const G = this.gait;
    const off = G.bodyOffset();
    const bob = -off.y * r;
    const squash = -off.y * 0.55 + off.roll * 0.4;
    const sqx = 1 + squash;
    const sqy = 1 - squash;
    const lean = G.lean + off.roll * 0.5;
    const by = hy - r * 0.15 - bob;

    const half = heroHalfPoints(r, 14);
    const pts = [];
    for (let i = 0; i < half.length; i += 2) pts.push(half[i] * sqx, half[i + 1] * sqy);
    for (let i = half.length - 2; i >= 0; i -= 2) pts.push(-half[i] * sqx, half[i + 1] * sqy);
    const ca = Math.cos(lean), sa = Math.sin(lean);
    const spun = [];
    for (let i = 0; i < pts.length; i += 2) {
      spun.push(hx + pts[i] * ca - pts[i + 1] * sa, by + pts[i + 1] * ca + pts[i] * sa);
    }
    g.poly(spun).fill({ color: parseInt(HERO_COLORS.bodyDeep.replace('#', ''), 16) });
    g.poly(spun).stroke({ width: 1.5, color: 0x06121e, alpha: 0.85 });

    const faceX = Math.max(-1, Math.min(1, Math.cos(aimAng)));
    const faceY = Math.max(-1, Math.min(1, Math.sin(aimAng)));
    const exprId = h.cheerT > 0 ? 'happy' : (h.attackT > 0 ? 'focused' : (h.hp < h.maxHp * 0.35 ? 'hurt' : 'calm'));
    const A = {
      faceX,
      faceY: Math.max(0.2, faceY * 0.4 + 0.7),
      blink: h.blink || 0,
      lookX: faceX,
      lookY: faceY * 0.4,
      exprId,
      expr: EXPRESSIONS[exprId] || EXPRESSIONS.calm,
    };
    drawHeroFace(g, hx, by, r, lean, sqx, sqy, A, null);
    drawHeadband(g, hx, by, r, '#d1394a', { sqx, sqy, lean });

    const gx = hx + Math.cos(aimAng) * r * 0.95;
    const gy = by + Math.sin(aimAng) * r * 0.35;
    drawArms(g, { x: hx, y: by }, lean, r, gx, gy, aimAng, null, hx, by);
    drawHeldWeapon(g, CLICKER_RIB, gx, gy, aimAng, {}, { recoil: h.recoil || 0 }, {});

    if (h.cheerT > 0) {
      for (let s = 0; s < 3; s++) {
        const sang = this.t * 3.0 + s * 2.1;
        g.circle(hx + Math.cos(sang) * 22, hy - 36 + Math.sin(sang) * 18, 1.8).fill({ color: 0xffd166, alpha: 0.85 });
      }
    }
    if (h.attackT > 0) {
      const progress = 1 - (h.attackT / (this.feverT > 0 ? 0.28 : 0.45));
      const slashR = this.feverT > 0 ? 48 : 38;
      const arcSpread = Math.PI * 0.75;
      const arcProgress = progress * Math.PI;
      const slashColor = this.feverT > 0 ? 0xffd700 : 0x5fd6ff;
      g.moveTo(hx, hy - 20)
        .lineTo(hx + Math.cos(aimAng - arcSpread / 2 + arcProgress) * slashR, hy - 20 + Math.sin(aimAng - arcSpread / 2 + arcProgress) * slashR)
        .stroke({ width: this.feverT > 0 ? 4.5 : 3.5, color: slashColor, alpha: (1 - progress) * 0.90 });
    }

    // Fever Mode Surrounding Electric Sparks & Golden Aura
    if (this.feverT > 0) {
      const feverPulse = Math.sin(this.t * 8.0) * 0.2 + 1.0;
      g.circle(hx, hy - 32, 48 * feverPulse).stroke({ width: 2.0, color: 0xffd700, alpha: 0.55 });
      for (let k = 0; k < 4; k++) {
        const kang = this.t * 5.0 + (k / 4.0) * TAU;
        const kx = hx + Math.cos(kang) * 36;
        const ky = hy - 32 + Math.sin(kang) * 20;
        g.circle(kx, ky, 2.2).fill({ color: 0xfff070, alpha: 0.9 });
      }
    }

    // Muzzle Flash & Laser Spark
    if (h.muzzleFlash > 0.05) {
      const mx = hx + facing * 24;
      const my = hy - 28;
      g.circle(mx, my, 10 * h.muzzleFlash).fill({ color: 0xffffff, alpha: 0.95 });
      g.circle(mx, my, 22 * h.muzzleFlash).fill({ color: 0x4dffd4, alpha: 0.5 });
    }
  }

  _drawShip() {
    const g = this.gShip;
    g.clear();
    const st = this.shipTravel;
    if (!st.active) return;

    const sx = st.shipX, sy = st.shipY;
    const col = st.shipColor || '#5fd6ff';
    const dark = '#0a1a24';

    // Dagger Ship Hull (Star-Atlas Player Ship Model)
    g.moveTo(sx, sy - 28)
      .lineTo(sx - 8, sy - 12).lineTo(sx - 24, sy + 6).lineTo(sx - 18, sy + 22)
      .lineTo(sx - 6, sy + 14).lineTo(sx, sy + 18).lineTo(sx + 6, sy + 14)
      .lineTo(sx + 18, sy + 22).lineTo(sx + 24, sy + 6).lineTo(sx + 8, sy - 12)
      .closePath()
      .fill({ color: col, alpha: 0.95 })
      .stroke({ width: 2, color: dark });

    g.ellipse(sx, sy - 6, 6, 12).fill({ color: '#e8fbff', alpha: 0.95 });

    const thrustLen = 22 + Math.random() * 12;
    for (const side of [-1, 1]) {
      const tx = sx + side * 10, ty = sy + 18;
      g.moveTo(tx - 4, ty).lineTo(tx + 4, ty).lineTo(tx, ty + thrustLen).closePath()
        .fill({ color: 0xffffff, alpha: 0.9 });
      g.moveTo(tx - 7, ty).lineTo(tx + 7, ty).lineTo(tx, ty + thrustLen * 1.4).closePath()
        .fill({ color: 0x4dffd4, alpha: 0.5 });
    }
  }

  _drawProjectiles() {
    const g = this.gProjectiles;
    g.clear();
    for (const p of this.projectiles) {
      g.circle(p.x, p.y, 4.0).fill({ color: p.color, alpha: 0.95 });
      g.circle(p.x, p.y, 8.0).fill({ color: p.color, alpha: 0.35 });
    }
  }

  _drawEnemies() {
    const g = this.gEnemies;
    g.clear();
    for (const en of this.enemies) {
      const flash = en.hitFlash > 0;
      const color = flash ? 0xffffff : en.color;

      if (en.kind === 'bat') {
        const wing = 16 + Math.sin(en.t * 14) * 8;
        g.moveTo(en.x - wing, en.y - 6).lineTo(en.x - 4, en.y).lineTo(en.x - wing, en.y + 6).stroke({ width: 1.5, color });
        g.moveTo(en.x + wing, en.y - 6).lineTo(en.x + 4, en.y).lineTo(en.x + wing, en.y + 6).stroke({ width: 1.5, color });
        g.circle(en.x, en.y, 10).fill(color);
        g.circle(en.x, en.y, 4).fill(0x0a0410);
      } else if (en.kind === 'fed') {
        g.rect(en.x - 7, en.y - 22, 14, 22).fill(color);
        g.rect(en.x - 9, en.y - 27, 18, 5).fill(0x111111);
        g.circle(en.x - 3, en.y - 17, 1.6).fill(0xffd166);
        g.circle(en.x + 3, en.y - 17, 1.6).fill(0xffd166);
      } else if (en.kind === 'reptile') {
        g.ellipse(en.x, en.y - 12, 10, 15).fill(color);
        g.circle(en.x - 3.5, en.y - 15, 2.0).fill(0xff0000);
        g.circle(en.x + 3.5, en.y - 15, 2.0).fill(0xff0000);
      }

      if (en.hp < en.maxHp) {
        g.rect(en.x - 12, en.y - 32, 24, 3).fill(0x330000);
        g.rect(en.x - 12, en.y - 32, 24 * (en.hp / en.maxHp), 3).fill(0x4dffd4);
      }
    }
  }

  _drawChests() {
    const g = this.gChests;
    g.clear();
    for (const ch of this.chests) {
      const bob = Math.sin(ch.t * 5.0) * 2.5;
      const flash = ch.hitFlash > 0;
      const color = flash ? 0xffffff : 0xffd166;
      g.roundRect(ch.x - 16, ch.y - 16 + bob, 32, 24, 4).fill(0x3d2806).stroke({ width: 2.0, color });
      g.rect(ch.x - 18, ch.y - 20 + bob, 36, 7).fill(0x61420d).stroke({ width: 1.2, color });
      g.circle(ch.x, ch.y - 6 + bob, 3.5).fill(0xffd166);
    }
  }

  _drawArnold() {
    const g = this.gArnold;
    g.clear();
    const a = this.arnold;
    if (!a.active) return;

    const flash = a.hitFlash > 0;
    const ax = a.x, ay = a.y;
    const bob = Math.sin(a.gallopT * 22) * 4.0;

    // Gallop dust puffs
    for (let d = 0; d < 3; d++) {
      const dp = (this.t * 3.0 + d * 0.33) % 1.0;
      g.circle(ax - 20 - dp * 24, ay + 8 - dp * 4, 3.5 * (1 - dp)).fill({ color: 0x998877, alpha: (1 - dp) * 0.5 });
    }

    // Mini Dachshund-sized Pony
    const ponyColor = flash ? 0xffffff : 0xc69255;
    const leg1 = Math.sin(a.gallopT * 24) * 8;
    const leg2 = Math.sin(a.gallopT * 24 + Math.PI) * 8;
    g.moveTo(ax - 14, ay).lineTo(ax - 16 + leg1, ay + 14).stroke({ width: 3, color: ponyColor });
    g.moveTo(ax + 14, ay).lineTo(ax + 16 + leg2, ay + 14).stroke({ width: 3, color: ponyColor });
    g.roundRect(ax - 16, ay - 8 + bob, 32, 16, 6).fill(ponyColor).stroke({ width: 1.5, color: 0x8a5a2b });
    g.ellipse(ax + 18, ay - 12 + bob, 8, 10).fill(ponyColor);
    g.circle(ax + 22, ay - 14 + bob, 2.2).fill(0x111111);

    // Hyper-Pumped Armold Figure
    const skinColor = flash ? 0xffffff : 0xde9f6b;
    g.roundRect(ax - 12, ay - 32 + bob, 24, 26, 5).fill(skinColor); // Massive torso
    g.rect(ax - 9, ay - 29 + bob, 18, 20).fill(0x111111); // Black tank top
    g.roundRect(ax - 7, ay - 46 + bob, 14, 14, 4).fill(skinColor); // Head
    g.rect(ax - 6, ay - 42 + bob, 12, 4).fill(0x050505); // Sunglasses
    g.rect(ax - 6, ay - 48 + bob, 12, 4).fill(0x6b4c2b); // Hair

    // Twin Rotary Miniguns
    const spin = this.t * 35;
    g.rect(ax + 10, ay - 28 + bob, 22, 7).fill(0x222222).stroke({ width: 1, color: 0x444444 });
    // Spinning barrels
    for (let b = 0; b < 3; b++) {
      const bang = spin + (b / 3) * TAU;
      g.circle(ax + 32, ay - 24 + bob + Math.sin(bang) * 3, 1.5).fill(0x888888);
    }
    // Minigun Muzzle Flash
    if (Math.sin(this.t * 30) > 0.2) {
      g.circle(ax + 38, ay - 24 + bob, 6).fill({ color: 0xffd166, alpha: 0.9 });
      g.circle(ax + 42, ay - 24 + bob, 9).fill({ color: 0xff4d00, alpha: 0.6 });
      // Ejected brass casings
      const cx = ax + 14 - (this.t * 20 % 15);
      const cy = ay - 20 + bob + (this.t * 30 % 20);
      g.rect(cx, cy, 3, 1.5).fill(0xffd166);
    }
  }

  _drawPresidentDumb() {
    const g = this.gPresident;
    g.clear();
    if (this.mapId !== 'dumbtower') return;
    const p = this.presidentDumb;
    const px = p.x, py = p.y;
    const flash = p.hitFlash > 0;

    // Golden Golf Cart
    g.roundRect(px - 26, py - 12, 52, 16, 4).fill(0xffd166).stroke({ width: 2, color: 0xffaa00 });
    g.circle(px - 16, py + 4, 6).fill(0x111111).stroke({ width: 2, color: 0xffd166 });
    g.circle(px + 16, py + 4, 6).fill(0x111111).stroke({ width: 2, color: 0xffd166 });
    g.rect(px - 20, py - 32, 40, 3).fill(0xffffff); // Cart roof canopy
    g.moveTo(px - 18, py - 12).lineTo(px - 18, py - 32).stroke({ width: 2, color: 0xffd166 });
    g.moveTo(px + 18, py - 12).lineTo(px + 18, py - 32).stroke({ width: 2, color: 0xffd166 });

    // President Figure
    g.roundRect(px - 10, py - 26, 20, 24, 4).fill(flash ? 0xffffff : 0x1b2e59); // Blue suit
    g.rect(px - 2, py - 24, 4, 22).fill(0xcc1122); // Red tie
    g.roundRect(px - 8, py - 38, 16, 13, 4).fill(flash ? 0xffffff : 0xffaa77); // Head
    g.ellipse(px, py - 39, 11, 7).fill(0xffcc00); // Signature golden hair

    // Thumbs Up Gesture & Golden Watch Sparkle
    g.circle(px + 14, py - 22, 4).fill(flash ? 0xffffff : 0xffaa77);
    const watchSparkle = Math.sin(this.t * 6.0) > 0.5 ? 1 : 0;
    if (watchSparkle) {
      g.circle(px + 14, py - 20, 2.5).fill({ color: 0xffffff, alpha: 0.95 });
    }

    // Floating dollar bills fluttering
    for (let b = 0; b < 2; b++) {
      const bp = (this.t * 0.8 + b * 0.5) % 1.0;
      const bx = px + 10 + Math.sin(this.t * 2.5 + b) * 16;
      const by = py - 36 - bp * 24;
      g.rect(bx, by, 7, 4).fill({ color: 0x4dff91, alpha: (1 - bp) * 0.85 });
    }
  }

  _drawDrops() {
    const g = this.gDrops;
    g.clear();
    const isBlood = this._isBloodMoon();
    const dropColor = isBlood ? 0xff3355 : 0x4dc4ff;
    for (const d of this.groundDrops) {
      g.circle(d.x, d.y, d.radius).fill({ color: dropColor, alpha: 0.95 });
      g.circle(d.x - 1.5, d.y - 1.5, d.radius * 0.4).fill({ color: 0xffffff, alpha: 0.85 });
    }
  }

  _drawEffects() {
    const g = this.gEffects;
    g.clear();

    for (const s of this._sparks) {
      const alpha = s.life / s.maxLife;
      g.circle(s.x, s.y, s.size * alpha).fill({ color: s.color, alpha });
    }

    for (const r of this._ripples) {
      const rad = r.t * r.maxR;
      const alpha = (1 - r.t) * 0.55;
      g.circle(r.x, r.y, rad).stroke({ width: 2.0 - r.t, color: 0x4dffd4, alpha });
    }

    for (const fn of this._floatingNumbers) {
      const alpha = fn.life / fn.maxLife;
      g.ellipse(fn.x, fn.y, 16 * fn.scale, 6 * fn.scale).fill({ color: 0x000000, alpha: alpha * 0.6 });
      g.circle(fn.x, fn.y - 4, 3 * fn.scale).fill({ color: fn.color, alpha });
    }
  }

  _drawLights() {
    let idx = 0;
    const emit = (x, y, r, color, alpha) => {
      if (idx >= this._lightSprites.length) return;
      const sp = this._lightSprites[idx++];
      sp.position.set(x, y);
      sp.scale.set(r / 48);
      sp.tint = color;
      sp.alpha = alpha;
    };

    const isBlood = this._isBloodMoon();
    const glowColor = isBlood ? 0xff3355 : 0x4dffd4;

    emit(W / 2, H * 0.42, 160, glowColor, 0.35 + Math.sin(this.t * 1.5) * 0.15);
    emit(this.hero.x, this.hero.y - 12, 55, 0x4dc4ff, 0.4);

    for (const ch of this.chests) {
      emit(ch.x, ch.y, 50, 0xffd166, 0.5 + Math.sin(ch.t * 6) * 0.2);
    }

    if (this._tapFlash > 0.01) {
      emit(this._tapX, this._tapY, 80, 0xffffff, this._tapFlash * 0.5);
    }

    for (; idx < this._lightSprites.length; idx++) {
      this._lightSprites[idx].alpha = 0;
    }
  }

  _drawHud() {
    const g = this.gHud;
    g.clear();
    const isBlood = this._isBloodMoon();

    g.roundRect(14, 12, 110, 24, 4).fill({ color: 0x000000, alpha: 0.85 })
      .stroke({ width: 1.2, color: isBlood ? 0xff3355 : 0x4dffd4 });

    g.roundRect(W - 110, 12, 96, 24, 4).fill({ color: 0x000000, alpha: 0.85 })
      .stroke({ width: 1.2, color: 0xffd166 });

    // Combo Meter HUD Badge
    if (this.combo > 2) {
      const comboX = W * 0.50, comboY = 22;
      const isFever = this.feverT > 0;
      const comboColor = isFever ? 0xffd700 : 0x4dffd4;
      const badgeW = isFever ? 140 : 100;
      
      g.roundRect(comboX - badgeW / 2, comboY - 12, badgeW, 24, 6)
        .fill({ color: 0x071118, alpha: 0.90 })
        .stroke({ width: isFever ? 2.0 : 1.2, color: comboColor, alpha: 0.9 });

      // Combo Decay Progress Bar under badge
      const prog = clamp(this.comboT / 1.8, 0, 1);
      g.rect(comboX - (badgeW - 8) / 2, comboY + 8, (badgeW - 8) * prog, 2.5)
        .fill({ color: comboColor, alpha: 0.95 });

      if (isFever) {
        // Fever Pulsing Sparkles
        for (let i = 0; i < 3; i++) {
          const ang = this.t * 4.0 + (i / 3.0) * TAU;
          const fx = comboX + Math.cos(ang) * (badgeW / 2 + 8);
          const fy = comboY + Math.sin(ang) * 12;
          g.circle(fx, fy, 1.8).fill({ color: 0xffd700, alpha: 0.9 });
        }
      }
    }

    if (this.isPaused) {
      g.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.4 });
    }
  }
}
