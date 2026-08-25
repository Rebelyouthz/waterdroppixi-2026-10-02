// =============================================
// CLICKER CONSPIRACY WORLD — Multi-Map Survivor Arena & 24h Blood Moon Cycle
// =============================================
// Features:
// 1. 6 Distinct Playable Expedition Maps:
//    - Göbekli Tepe (10,000 BC T-Pillars & Carved Animal Reliefs)
//    - Stonehenge Solstice & Glowing Wheat Crop Circles
//    - The Great Seal Stepped Pyramid (All-Seeing Eye tracking the hero)
//    - DUMB TOWER & Golden Escalator (President Dumb with golden combover & long red tie)
//    - Armold's Belgian Blue Mansion (Mini-horse paddock & steroid flex gym)
//    - Bohemian Grove (40-ft stone owl statue, dark redwoods, Blood Moon ritual)
// 2. 24-Hour Day / Night & Blood Moon Cycle:
//    - Progresses smoothly: Day -> Dusk -> Night -> Blood Moon -> Dawn.
//    - Blood Moon triggers crimson sky, elite enemies, and x3 drop bursts!
// 3. Survivor-Clicker Combat with Hero HP, Leveling & Death/Revive Shield:
//    - Hero takes touch damage from monsters, heals from collecting drops, and levels up!
// 4. Auto-Pause Protection:
//    - Pauses simulation during menu scrolling to prevent unexpected hero deaths.
// 5. Interactive Secret Loot Spots on each map for Blueprints, Meta Points & TCG cards.
// 6. Armold Svartnmeger on his dachshund-sized miniature horse with twin miniguns!

import { Application, Container, Graphics, Sprite, FillGradient, ColorMatrixFilter, Rectangle } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { bakeLightTexture } from './litShading';
import { HERO_BODY } from './heroShape';

const TAU = Math.PI * 2;
const W = 620, H = 360;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const noise = (i) => ((i * 2654435761) >>> 0) / 4294967295;

export class ClickerWorld {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.mapId = opts.mapId || 'pyramid';
    this.theme = opts.theme || 'pyramid';
    this.chapter = opts.chapter || 0;
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
    this.timeOfDay = 8.0; // Starts at 08:00 morning

    // Mouse / Aim state
    this.pointerX = W / 2;
    this.pointerY = H / 2;
    this.isPointerDown = false;
    this.laserDragT = 0;

    // Eye tracking state (Pyramid)
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

    // Armold Svartnmeger on miniature pony
    this.arnold = {
      active: false,
      x: -120,
      y: H * 0.68 - 14,
      vx: 90,
      gallopT: 0,
      t: 0,
      hitFlash: 0,
    };
    this._arnoldSpawnT = 12.0;

    // President Dumb at DUMB TOWER
    this.presidentDumb = {
      x: W * 0.72,
      y: H * 0.68 - 18,
      facing: -1,
      t: 0,
      talkT: 0,
      hitFlash: 0,
    };

    // Interactive secret loot spots
    this._interactives = [];

    // Waterdrop Hero state with HP & Level
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
      hp: 100,
      maxHp: 100,
      lvl: 1,
      xp: 0,
      maxXp: 100,
      reviveShieldT: 0,
    };

    // Stars
    this._stars = [];
    for (let i = 0; i < 80; i++) {
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

    this.gSky = new Graphics();        this.root.addChild(this.gSky);
    this.gStars = new Graphics();      this.root.addChild(this.gStars);
    this.gGround = new Graphics();     this.root.addChild(this.gGround);
    this.gMapEnvironment = new Graphics(); this.root.addChild(this.gMapEnvironment);
    this.lightLayer = new Container();  this.root.addChild(this.lightLayer);
    this.gFloaters = new Graphics();    this.root.addChild(this.gFloaters);
    this.gProjectiles = new Graphics(); this.root.addChild(this.gProjectiles);
    this.gEnemies = new Graphics();    this.root.addChild(this.gEnemies);
    this.gChests = new Graphics();     this.root.addChild(this.gChests);
    this.gArnold = new Graphics();     this.root.addChild(this.gArnold);
    this.gPresident = new Graphics();  this.root.addChild(this.gPresident);
    this.gDrops = new Graphics();      this.root.addChild(this.gDrops);
    this.gHero = new Graphics();       this.root.addChild(this.gHero);
    this.gEffects = new Graphics();    this.root.addChild(this.gEffects);
    this.gHud = new Graphics();        this.root.addChild(this.gHud);

    // Light pool
    this._lightSprites = [];
    for (let i = 0; i < 40; i++) {
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
    this.hero.cheerT = 0.8;
  }

  handleTap(x, y) {
    this._tapFlash = 1.0;
    this._tapX = x;
    this._tapY = y;

    this._ripples.push({ x, y, t: 0, maxR: 30 + Math.random() * 20 });
    if (this._ripples.length > 8) this._ripples.shift();

    // Check Armold click
    if (this.arnold.active && Math.hypot(x - this.arnold.x, y - this.arnold.y) < 38) {
      this.arnold.hitFlash = 1.0;
      this._spawnSparks(this.arnold.x, this.arnold.y - 10, 0xffd166, 22);
      this._spawnDropFountain(this.arnold.x, this.arnold.y - 10, 10);
      this.onArnoldTapped(this.arnold);
      return;
    }

    // Check President Dumb click at DUMB TOWER
    if (this.mapId === 'dumbtower' && Math.hypot(x - this.presidentDumb.x, y - this.presidentDumb.y) < 36) {
      this.presidentDumb.hitFlash = 1.0;
      this.presidentDumb.talkT = 2.0;
      this._spawnSparks(this.presidentDumb.x, this.presidentDumb.y - 12, 0xffaa00, 18);
      this._spawnDropFountain(this.presidentDumb.x, this.presidentDumb.y - 12, 8);
      this.onPresidentDumbTapped(this.presidentDumb);
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
          this._spawnDropFountain(ch.x, ch.y, 12);
          this.onChestUnlocked(ch);
        }
        return;
      }
    }

    // Check Enemy clicks
    let hitEnemy = false;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (Math.hypot(x - en.x, y - en.y) < en.radius + 10) {
        en.hp--;
        en.hitFlash = 1.0;
        hitEnemy = true;
        this._spawnSparks(en.x, en.y, en.color, 10);
        if (en.hp <= 0) {
          this._spawnSparks(en.x, en.y, en.color, 20);
          this._spawnDropFountain(en.x, en.y, en.dropsCount || 4);
          this.onEnemyDefeated(en);
          this.enemies.splice(i, 1);
        }
        break;
      }
    }

    // Fire hero projectile
    this._fireHeroProjectile(x, y);

    // Check Pyramid Center / Well
    if (this.mapId === 'pyramid') {
      const dx = x - W / 2, dy = y - H * 0.46;
      if (Math.abs(dx) < 65 && Math.abs(dy) < 60) {
        this.hero.cheerT = 1.0;
        this._spawnSparks(W / 2, H * 0.38, 0xffd166, 12);
        this.onTapWell(x, y);
        return;
      }
    }

    // Check Map Secret Loot Spots & Monuments
    for (const obj of this._interactives) {
      const odx = x - obj.x, ody = y - obj.y;
      if (odx * odx + ody * ody < obj.r * obj.r) {
        obj.hit = 1.0;
        this._spawnSparks(obj.x, obj.y, 0xffd166, 14);
        if (obj.isLoot) {
          this.onLootDiscovered(obj.id);
        } else {
          this.onTapObject(obj.id, obj);
        }
        return;
      }
    }

    // Move hero on ground
    if (!hitEnemy && y > H * 0.58) {
      this.hero.targetX = clamp(x, 40, W - 40);
    }
  }

  _fireHeroProjectile(targetX, targetY) {
    const h = this.hero;
    const ang = Math.atan2(targetY - (h.y - 12), targetX - h.x);
    const spd = 390;
    this.projectiles.push({
      x: h.x,
      y: h.y - 12,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.9,
      color: this._isBloodMoon() ? 0xff3355 : 0x4dc4ff,
    });
    h.shootT = 0.25;
  }

  _isBloodMoon() {
    if (this.mapId === 'bohemian') return true;
    return this.timeOfDay >= 2.0 && this.timeOfDay < 6.0;
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
    const isBlood = this._isBloodMoon();
    const isNight = this.timeOfDay < 6.0 || this.timeOfDay >= 18.0;

    let skyTop = 0x060c18, skyBot = 0x143322;
    if (isBlood) {
      skyTop = 0x220508;
      skyBot = 0x3d0a14;
    } else if (isNight) {
      skyTop = 0x040810;
      skyBot = 0x0a1420;
    } else {
      skyTop = 0x0c2438;
      skyBot = 0x1a4d38;
    }

    const skyGrad = new FillGradient({
      colorStops: [
        { offset: 0, color: skyTop },
        { offset: 0.74, color: skyTop },
        { offset: 1, color: skyBot },
      ],
    });
    g.rect(0, 0, W, H).fill(skyGrad);
  }

  _paintGround() {
    const g = this.gGround;
    g.clear();
    const groundY = H * 0.68;
    const isBlood = this._isBloodMoon();

    const groundGrad = new FillGradient({
      colorStops: [
        { offset: 0, color: isBlood ? 0x1f080c : 0x0a1a0e },
        { offset: 1, color: 0x020604 },
      ],
    });
    g.rect(0, groundY, W, H - groundY).fill(groundGrad);
    g.rect(0, groundY - 1, W, 2).fill({ color: isBlood ? 0xff3355 : 0x4dc4ff, alpha: 0.25 });
  }

  _tick(tk) {
    if (this.destroyed) return;
    const dt = tk.deltaTime / 60;

    // Pause physics/spawns if paused during menu scroll
    if (!this.isPaused) {
      this.t += dt;

      // Advance 24h day/night clock (1s = 0.5h, 24h = 48s)
      const prevHour = this.timeOfDay;
      this.timeOfDay = (this.timeOfDay + dt * 0.5) % 24.0;
      if (prevHour > 23.0 && this.timeOfDay < 1.0) {
        this.onDaySurvived();
      }

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
    }

    this._paintSky();
    this._paintGround();
    this._drawStars();
    this._drawMapEnvironment();
    this._drawLights();
    this._drawFloaters();
    this._drawProjectiles();
    this._drawEnemies();
    this._drawChests();
    this._drawArnold();
    this._drawPresidentDumb();
    this._drawDrops();
    this._drawHero();
    this._drawEffects();
    this._drawHud();
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
            this._spawnDropFountain(en.x, en.y, en.dropsCount || 4);
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
    const isBlood = this._isBloodMoon();
    this._enemySpawnT -= dt * (isBlood ? 1.6 : 1.0);
    if (this._enemySpawnT <= 0 && this.enemies.length < (isBlood ? 8 : 5)) {
      this._enemySpawnT = 2.2 + Math.random() * 3.0;
      const type = Math.random();
      if (type < 0.35) {
        this.enemies.push({
          kind: 'bat',
          x: Math.random() < 0.5 ? -30 : W + 30,
          y: 40 + Math.random() * 60,
          vx: (Math.random() < 0.5 ? 1 : -1) * (38 + Math.random() * 25),
          hp: isBlood ? 4 : 2, maxHp: isBlood ? 4 : 2,
          radius: 12,
          color: isBlood ? 0xff2244 : 0x9b59b6,
          t: 0, hitFlash: 0, dropsCount: isBlood ? 6 : 3,
        });
      } else if (type < 0.70) {
        this.enemies.push({
          kind: 'fed',
          x: Math.random() < 0.5 ? -30 : W + 30,
          y: H * 0.68 - 14,
          vx: (Math.random() < 0.5 ? 1 : -1) * (24 + Math.random() * 15),
          hp: isBlood ? 6 : 3, maxHp: isBlood ? 6 : 3,
          radius: 14,
          color: isBlood ? 0xff0033 : 0xff4444,
          t: 0, hitFlash: 0, dropsCount: isBlood ? 8 : 4,
        });
      } else {
        this.enemies.push({
          kind: 'reptile',
          x: Math.random() < 0.5 ? -30 : W + 30,
          y: H * 0.68 - 12,
          vx: (Math.random() < 0.5 ? 1 : -1) * (30 + Math.random() * 20),
          hp: isBlood ? 8 : 4, maxHp: isBlood ? 8 : 4,
          radius: 14,
          color: isBlood ? 0xff5500 : 0x39ff14,
          t: 0, hitFlash: 0, dropsCount: isBlood ? 10 : 5,
        });
      }
    }

    const hx = this.hero.x, hy = this.hero.y - 10;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      en.t += dt;
      en.x += en.vx * dt;
      if (en.kind === 'bat') en.y += Math.sin(en.t * 4) * 0.6;
      if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - dt * 5);

      // Hero collision damage
      if (this.hero.reviveShieldT <= 0 && Math.hypot(en.x - hx, en.y - hy) < en.radius + 12) {
        this.hero.hp = Math.max(0, this.hero.hp - 15);
        this.hero.cheerT = 0.5;
        this._spawnSparks(hx, hy, 0xff0044, 8);
        if (this.hero.hp <= 0) {
          // Respawn with revive shield
          this.hero.hp = this.hero.maxHp;
          this.hero.reviveShieldT = 3.0;
          this._spawnSparks(hx, hy, 0xffd166, 25);
        }
      }

      if (en.x < 20) { en.x = 20; en.vx = Math.abs(en.vx); }
      if (en.x > W - 20) { en.x = W - 20; en.vx = -Math.abs(en.vx); }
    }
  }

  _updateChests(dt) {
    this._chestSpawnT -= dt;
    if (this._chestSpawnT <= 0 && this.chests.length < 2) {
      this._chestSpawnT = 16.0 + Math.random() * 12.0;
      this.chests.push({
        x: W * 0.2 + Math.random() * (W * 0.6),
        y: H * 0.68 - 14,
        hits: 3, maxHits: 3,
        t: 0, hitFlash: 0,
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
      this._arnoldSpawnT = 22.0 + Math.random() * 14.0;
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
      if (distToHero < 90) {
        const pull = (1 - distToHero / 90) * 340;
        const ang = Math.atan2(hy - d.y, hx - d.x);
        d.x += Math.cos(ang) * pull * dt;
        d.y += Math.sin(ang) * pull * dt;
      }

      if (distToHero < 18 || d.life <= 0) {
        // Collect drop: heals hero & gives XP
        this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 6);
        this.hero.xp += 15;
        if (this.hero.xp >= this.hero.maxXp) {
          this.hero.lvl++;
          this.hero.xp -= this.hero.maxXp;
          this.hero.maxXp = Math.round(this.hero.maxXp * 1.35);
          this._spawnSparks(hx, hy, 0xffd166, 30);
          this.onHeroLevelUp(this.hero.lvl);
        }
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
    if (h.reviveShieldT > 0) h.reviveShieldT = Math.max(0, h.reviveShieldT - dt);
  }

  _drawStars() {
    const g = this.gStars;
    g.clear();
    const isBlood = this._isBloodMoon();
    const isNight = this.timeOfDay < 6.0 || this.timeOfDay >= 18.0;

    // Celestial orb (Sun / Moon / Blood Moon)
    const orbX = W * 0.82;
    const orbY = H * 0.22;
    if (isBlood) {
      g.circle(orbX, orbY, 24).fill(0xcc1122);
      g.circle(orbX, orbY, 32).fill({ color: 0xff3344, alpha: 0.25 });
    } else if (isNight) {
      g.circle(orbX, orbY, 20).fill(0xe8f0f8);
      g.circle(orbX + 6, orbY - 4, 18).fill(0x060c18); // crescent
    } else {
      g.circle(orbX, orbY, 22).fill(0xffd166);
      g.circle(orbX, orbY, 36).fill({ color: 0xffaa00, alpha: 0.2 });
    }

    for (const s of this._stars) {
      const twinkle = 0.35 + Math.sin(this.t * s.speed + s.twinkle) * 0.5 + 0.2;
      g.circle(s.x, s.y, s.size * twinkle).fill({ color: isBlood ? 0xff8899 : 0xffffff, alpha: twinkle * 0.7 });
    }
  }

  _drawMapEnvironment() {
    const g = this.gMapEnvironment;
    g.clear();
    this._interactives = [];
    const groundY = H * 0.68;

    if (this.mapId === 'gobekli') {
      // ── GÖBEKLI TEPE SANCTUARY ─────────────────────────────────
      const drawTPillar = (cx, baseY, w, h, headW, animal) => {
        g.rect(cx - w / 2, baseY - h, w, h).fill(0x3e372b).stroke({ width: 1, color: 0x585040, alpha: 0.5 });
        g.rect(cx - headW / 2, baseY - h - w * 0.55, headW, w * 0.55).fill(0x585040).stroke({ width: 1, color: 0x6e6452, alpha: 0.4 });
        const reliefY = baseY - h * 0.45;
        if (animal === 'fox') {
          g.moveTo(cx - 3, reliefY).lineTo(cx + 4, reliefY - 2).lineTo(cx + 2, reliefY + 3).closePath().fill({ color: 0xe0a050, alpha: 0.6 });
        } else if (animal === 'vulture') {
          g.moveTo(cx - 4, reliefY - 2).lineTo(cx, reliefY + 3).lineTo(cx + 4, reliefY - 2).stroke({ width: 1.5, color: 0xe0a050, alpha: 0.6 });
        }
      };

      drawTPillar(W * 0.22, groundY, 16, 60, 32, 'fox');
      drawTPillar(W * 0.50, groundY, 18, 70, 36, 'vulture');
      drawTPillar(W * 0.78, groundY, 16, 58, 30, 'fox');

      // Stone ring enclosure
      g.arc(W * 0.50, groundY, 140, Math.PI * 0.85, Math.PI * 0.15).stroke({ width: 5, color: 0x2e2722, alpha: 0.6 });
      this._interactives.push({ id: 'gobekli_sanctuary', x: W * 0.50, y: groundY - 40, r: 60, isLoot: true });

    } else if (this.mapId === 'stonehenge') {
      // ── STONEHENGE & CROP CIRCLES ──────────────────────────────
      const drawTrilithon = (cx, baseY, w, h, gap) => {
        const lw = w * 0.32;
        g.rect(cx - gap / 2 - lw, baseY - h, lw, h).fill(0x2e2b26).stroke({ width: 1, color: 0x46423a, alpha: 0.5 });
        g.rect(cx + gap / 2, baseY - h, lw, h).fill(0x2e2b26).stroke({ width: 1, color: 0x46423a, alpha: 0.5 });
        g.rect(cx - gap / 2 - lw, baseY - h - lw * 0.6, gap + lw * 2, lw * 0.6).fill(0x46423a);
      };

      drawTrilithon(W * 0.25, groundY, 18, 54, 18);
      drawTrilithon(W * 0.50, groundY, 22, 64, 22);
      drawTrilithon(W * 0.75, groundY, 18, 52, 16);

      // Solstice light beam
      g.rect(W * 0.50 - 1, 0, 2, groundY).fill({ color: 0x4dffd4, alpha: 0.15 + Math.sin(this.t * 2) * 0.08 });

      // Glowing crop circle on ground
      g.ellipse(W * 0.50, groundY + 18, 55, 14).stroke({ width: 1.5, color: 0x39ff14, alpha: 0.45 });
      this._interactives.push({ id: 'crop_circle', x: W * 0.50, y: groundY - 30, r: 60, isLoot: true });

    } else if (this.mapId === 'dumbtower') {
      // ── DUMB TOWER & GOLDEN ESCALATOR ──────────────────────────
      const bX = W * 0.50, bW = 140, bH = 160;
      // Tower glass
      g.rect(bX - bW / 2, groundY - bH, bW, bH).fill(0x181c10).stroke({ width: 2, color: 0xffaa00, alpha: 0.7 });
      // Golden floors grid
      for (let f = 1; f < 8; f++) {
        g.rect(bX - bW / 2 + 4, groundY - bH + f * 20, bW - 8, 1).fill({ color: 0xffd166, alpha: 0.4 });
      }
      // Glowing DUMB sign
      g.roundRect(bX - 45, groundY - bH + 8, 90, 22, 4).fill(0x000000).stroke({ width: 1.5, color: 0xffaa00 });
      // Golden antenna
      g.rect(bX - 2, groundY - bH - 30, 4, 30).fill(0xffd166);
      g.circle(bX, groundY - bH - 30, 5).fill(0xff0000);

      this._interactives.push({ id: 'dumb_tower_elevator', x: bX, y: groundY - 50, r: 60, isLoot: true });

    } else if (this.mapId === 'armold_mansion') {
      // ── ARMOLD'S BELGIAN BLUE MANSION ──────────────────────────
      const mX = W * 0.50;
      // Heavy iron gym gate & sign
      g.roundRect(mX - 90, groundY - 80, 180, 80, 6).fill(0x1a2218).stroke({ width: 2, color: 0x39ff14, alpha: 0.6 });
      // Barbell logo
      g.rect(mX - 30, groundY - 60, 60, 4).fill(0xcccccc);
      g.circle(mX - 30, groundY - 58, 12).fill(0x333333);
      g.circle(mX + 30, groundY - 58, 12).fill(0x333333);
      // Mini-horse stable
      g.rect(W * 0.18, groundY - 45, 50, 45).fill(0x3a2618).stroke({ width: 1.5, color: 0x7a4d23 });
      this._interactives.push({ id: 'armold_gym_vault', x: mX, y: groundY - 40, r: 60, isLoot: true });

    } else if (this.mapId === 'bohemian') {
      // ── BOHEMIAN GROVE (40-FT STONE OWL) ───────────────────────
      const owlX = W * 0.50;
      // Dark redwoods
      g.rect(W * 0.12, groundY - 140, 24, 140).fill(0x2a1410);
      g.rect(W * 0.84, groundY - 150, 26, 150).fill(0x2a1410);

      // Giant Stone Owl
      g.roundRect(owlX - 36, groundY - 110, 72, 110, 16).fill(0x2e2926).stroke({ width: 2, color: 0x48423d });
      // Glowing Ruby Eyes
      g.circle(owlX - 14, groundY - 80, 6).fill(0xff0044);
      g.circle(owlX + 14, groundY - 80, 6).fill(0xff0044);
      // Beak
      g.moveTo(owlX - 5, groundY - 72).lineTo(owlX + 5, groundY - 72).lineTo(owlX, groundY - 62).closePath().fill(0x1a1614);

      // Occult Torches
      g.circle(owlX - 55, groundY - 40, 5).fill(0xff6600);
      g.circle(owlX + 55, groundY - 40, 5).fill(0xff6600);
      this._interactives.push({ id: 'bohemian_owl_altar', x: owlX, y: groundY - 60, r: 60, isLoot: true });

    } else {
      // ── THE GREAT SEAL PYRAMID ─────────────────────────────────
      const cx = W / 2, tipY = groundY - 92, pyramidW = 120;
      const layers = 13;
      for (let i = 0; i < layers; i++) {
        const topT = i / layers, botT = (i + 1) / layers;
        const y0 = tipY + (groundY - tipY) * topT;
        const y1 = tipY + (groundY - tipY) * botT;
        const halfW0 = (pyramidW / 2) * topT;
        const halfW1 = (pyramidW / 2) * botT;
        g.moveTo(cx - halfW0, y0).lineTo(cx + halfW0, y0).lineTo(cx + halfW1, y1).lineTo(cx - halfW1, y1).closePath()
          .fill(i % 2 === 0 ? 0x223828 : 0x1a2e20).stroke({ width: 0.8, color: 0x3d6648, alpha: 0.4 });
      }

      // Capstone with Eye of Providence
      const capCY = tipY - 14 + Math.sin(this.t * 2) * 3;
      g.moveTo(cx, capCY - 15).lineTo(cx + 19, capCY + 15).lineTo(cx - 19, capCY + 15).closePath()
        .fill(0x182e20).stroke({ width: 1.5, color: 0xffd166, alpha: 0.85 });

      const eyeH = Math.max(1, 14 * (1 - this.eyeBlink));
      g.ellipse(cx, capCY + 2, 14, eyeH).fill(0xf0fbf4).stroke({ width: 1.2, color: 0xffd166, alpha: 0.6 });
      if (this.eyeBlink < 0.8) {
        const pupilX = cx + this.eyeX * 4;
        const pupilY = (capCY + 2) + this.eyeY * 3;
        g.circle(pupilX, pupilY, 5.5).fill(0x06140a);
        g.circle(pupilX - 1.5, pupilY - 1.5, 1.8).fill(0xffd166);
      }
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
    const glowColor = isBlood ? 0xff3355 : 0x4dc4ff;

    // Center focal glow
    emit(W / 2, H * 0.46, 140, glowColor, 0.35 + Math.sin(this.t * 1.5) * 0.15);

    // Hero light
    emit(this.hero.x, this.hero.y - 10, 45, 0x4dc4ff, 0.35);

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
    const isBlood = this._isBloodMoon();
    const accent = isBlood ? 0xff3366 : 0x4dc4ff;

    for (const f of this._floaters) {
      const x = f.x + Math.sin(this.t * f.speed + f.phase) * 9;
      const y = f.y + Math.cos(this.t * f.speed * 0.7 + f.phase) * 6;
      const alpha = f.alpha * (0.65 + Math.sin(this.t * f.speed * 1.3 + f.phase * 2) * 0.35);
      const s = f.size;
      g.circle(x, y, s).stroke({ width: 0.6, color: accent, alpha });
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
        g.moveTo(en.x - wingSpan, en.y - 4).lineTo(en.x - 4, en.y).lineTo(en.x - wingSpan, en.y + 4).stroke({ width: 1.2, color });
        g.moveTo(en.x + wingSpan, en.y - 4).lineTo(en.x + 4, en.y).lineTo(en.x + wingSpan, en.y + 4).stroke({ width: 1.2, color });
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
      g.roundRect(ch.x - 14, ch.y - 14 + bob, 28, 20, 3).fill(0x3d2806).stroke({ width: 1.5, color });
      g.rect(ch.x - 16, ch.y - 18 + bob, 32, 6).fill(0x61420d).stroke({ width: 1, color });
      g.circle(ch.x, ch.y - 6 + bob, 3).fill(0xffd166);
    }
  }

  _drawArnold() {
    const g = this.gArnold;
    g.clear();
    const a = this.arnold;
    if (!a.active) return;

    const flash = a.hitFlash > 0;
    const ax = a.x, ay = a.y;
    const bob = Math.sin(a.gallopT * 22) * 3;

    // Miniature Dachshund Pony
    const ponyColor = flash ? 0xffffff : 0xd2a679;
    const leg1 = Math.sin(a.gallopT * 24) * 6;
    const leg2 = Math.sin(a.gallopT * 24 + Math.PI) * 6;
    g.moveTo(ax - 10, ay).lineTo(ax - 12 + leg1, ay + 12).stroke({ width: 2, color: ponyColor });
    g.moveTo(ax + 10, ay).lineTo(ax + 12 + leg2, ay + 12).stroke({ width: 2, color: ponyColor });
    g.roundRect(ax - 12, ay - 6 + bob, 24, 12, 4).fill(ponyColor);
    g.ellipse(ax + 14, ay - 10 + bob, 6, 8).fill(ponyColor);

    // Armold on top
    const skinColor = flash ? 0xffffff : 0xde9f6b;
    g.roundRect(ax - 8, ay - 26 + bob, 16, 20, 3).fill(skinColor);
    g.rect(ax - 6, ay - 24 + bob, 12, 16).fill(0x111111);
    g.roundRect(ax - 5, ay - 36 + bob, 10, 10, 2).fill(skinColor);
    g.rect(ax - 3, ay - 33 + bob, 8, 3).fill(0x050505); // sunglasses
    g.rect(ax + 6, ay - 22 + bob, 12, 4).fill(0x333333); // minigun

    // Name tag banner
    g.roundRect(ax - 30, ay - 50 + bob, 60, 11, 2).fill({ color: 0x000000, alpha: 0.85 }).stroke({ width: 1, color: 0xffd166 });
  }

  _drawPresidentDumb() {
    const g = this.gPresident;
    g.clear();
    if (this.mapId !== 'dumbtower') return;
    const p = this.presidentDumb;
    const px = p.x, py = p.y;
    const flash = p.hitFlash > 0;

    // Blue suit
    g.roundRect(px - 7, py - 20, 14, 20, 2).fill(flash ? 0xffffff : 0x1b2e59);
    // Red extra long tie
    g.rect(px - 1.5, py - 18, 3, 16).fill(0xcc1122);
    // Head
    g.roundRect(px - 5, py - 28, 10, 9, 2).fill(flash ? 0xffffff : 0xffaa77);
    // Golden wild combover hair
    g.ellipse(px, py - 29, 8, 5).fill(0xffcc00);

    // Speech bubble
    if (p.talkT > 0) {
      g.roundRect(px - 45, py - 46, 90, 14, 3).fill({ color: 0x000000, alpha: 0.9 }).stroke({ width: 1, color: 0xffd166 });
    }
  }

  _drawDrops() {
    const g = this.gDrops;
    g.clear();
    const isBlood = this._isBloodMoon();
    const dropColor = isBlood ? 0xff3355 : 0x4dc4ff;
    for (const d of this.groundDrops) {
      g.circle(d.x, d.y, d.radius).fill({ color: dropColor, alpha: 0.95 });
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

    // Shadow
    g.ellipse(hx, h.y, r * 0.9 * squash, r * 0.35).fill({ color: 0x000000, alpha: 0.45 });

    // Revive shield
    if (h.reviveShieldT > 0) {
      g.circle(hx, hy, r + 8).stroke({ width: 2, color: 0xffd166, alpha: 0.8 + Math.sin(this.t * 12) * 0.2 });
    }

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

    // Hero HP bar
    g.rect(hx - 14, hy - r - 10, 28, 3.5).fill(0x330000);
    g.rect(hx - 14, hy - r - 10, 28 * (h.hp / h.maxHp), 3.5).fill(0x4dffd4);
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
      const alpha = (1 - r.t) * 0.45;
      g.circle(r.x, r.y, rad).stroke({ width: 1.5 - r.t, color: 0x4dc4ff, alpha });
    }
  }

  _drawHud() {
    const g = this.gHud;
    g.clear();
    const isBlood = this._isBloodMoon();

    // 24H Clock badge frame in top left
    g.roundRect(10, 10, 95, 20, 3).fill({ color: 0x000000, alpha: 0.75 })
      .stroke({ width: 1, color: isBlood ? 0xff3355 : 0x4dc4ff });

    // Hero Level in top right
    g.roundRect(W - 85, 10, 75, 20, 3).fill({ color: 0x000000, alpha: 0.75 })
      .stroke({ width: 1, color: 0xffd166 });

    // Pause overlay
    if (this.isPaused) {
      g.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.35 });
    }
  }
}
