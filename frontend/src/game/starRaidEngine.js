// =============================================
// STAR RAID — standalone vertical-scroll space shmup minigame ("Patrol"
// idea from spec, renamed to avoid colliding with the existing idle-mission
// PATROL tab). Deliberately lean v1 scope, see PatrolScreen.jsx header
// comment for what's Phase 2. Pure state/logic, no drawing (mirrors
// engine.js's separation — StarRaidRenderer does all PixiJS drawing).
// =============================================

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

export const STAGES = [
  { id: 1, name: 'Debris Field',   duration: 40, spawnRate: 1.1, enemyHpMult: 1.0, bossHp: 260, bossDmg: 14 },
  { id: 2, name: 'Ion Storm',      duration: 50, spawnRate: 1.4, enemyHpMult: 1.6, bossHp: 480, bossDmg: 20 },
  { id: 3, name: 'The Deep Void',  duration: 60, spawnRate: 1.8, enemyHpMult: 2.4, bossHp: 820, bossDmg: 28 },
];

// Permanent ship upgrade tree — many small leveled stats (spec: "more
// upgradeable than Sky Force"), bought with Scrap earned in-run. Functions
// as the "skill tree" for this mode; a dedicated radial UI is a Phase 2
// polish item, the progression itself is fully here and live.
export const SHIP_UPGRADES = {
  dmg:    { name: 'Cannon Power', icon: '💥', max: 20, costBase: 8,  costGrowth: 1.18, perLevel: 0.08 },
  atks:   { name: 'Fire Rate',    icon: '⏱️', max: 20, costBase: 8,  costGrowth: 1.18, perLevel: 0.06 },
  hp:     { name: 'Hull',         icon: '🛡️', max: 20, costBase: 6,  costGrowth: 1.16, perLevel: 6 },
  mspd:   { name: 'Thrusters',    icon: '🚀', max: 15, costBase: 6,  costGrowth: 1.16, perLevel: 0.04 },
  magnet: { name: 'Tractor Beam', icon: '🧲', max: 15, costBase: 5,  costGrowth: 1.14, perLevel: 8 },
  pierce: { name: 'Rail Rounds',  icon: '➰', max: 10, costBase: 12, costGrowth: 1.22, perLevel: 1 },
};

export function upgradeCost(id, curLvl) {
  const u = SHIP_UPGRADES[id];
  return Math.round(u.costBase * Math.pow(u.costGrowth, curLvl));
}

function makeStats(shipLevels) {
  const lv = shipLevels || {};
  return {
    dmg: 10 * (1 + (lv.dmg || 0) * SHIP_UPGRADES.dmg.perLevel),
    fireRate: 3.2 * (1 + (lv.atks || 0) * SHIP_UPGRADES.atks.perLevel),
    maxHp: 30 + (lv.hp || 0) * SHIP_UPGRADES.hp.perLevel,
    speed: 260 * (1 + (lv.mspd || 0) * SHIP_UPGRADES.mspd.perLevel),
    magnetR: 40 + (lv.magnet || 0) * SHIP_UPGRADES.magnet.perLevel,
    pierce: (lv.pierce || 0) * SHIP_UPGRADES.pierce.perLevel,
  };
}

export class StarRaidGame {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.callbacks = opts.callbacks || {};
    this.shipColor = opts.shipColor || '#5fd6ff'; // ProfilePanel rank-unlocked cosmetic
    this.shipLevels = opts.shipLevels || {};
    this.stats = makeStats(this.shipLevels);
    this.stageIdx = clamp(opts.stageIdx || 0, 0, STAGES.length - 1);
    this.stage = STAGES[this.stageIdx];

    this.W = canvas.clientWidth || 480;
    this.H = canvas.clientHeight || 800;

    this.player = {
      x: this.W / 2, y: this.H - 90, r: 16,
      hp: this.stats.maxHp, maxHp: this.stats.maxHp,
      vx: 0, vy: 0, bank: 0, fireT: 0, iframes: 0, hit: 0,
    };
    this.input = { x: 0, y: 0 };
    this.enemies = [];
    this.eprojs = [];
    this.projs = [];
    this.orbs = [];
    this.parts = [];
    this.time = 0;
    this.spawnT = 0;
    this.scrap = 0;
    this.boss = null;
    this.bossSpawned = false;
    this.over = false;
    this.cleared = false;
    this.running = true;
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  setInput(x, y) { this.input.x = clamp(x, -1, 1); this.input.y = clamp(y, -1, 1); }

  destroy() { this.running = false; }

  frame(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (!this.over) { try { this.update(dt); } catch (e) { console.error('[starraid.update]', e); } }
    if (this.renderer) { try { this.renderer.render(this); } catch (e) { console.error('[starraid.render]', e); } }
    // Throttle the React/HUD sync to ~30Hz, same lesson as the main game's
    // engine.js — calling setState every single rendered frame floods
    // React's reconciler (see survivor-bullethell-design skill).
    if (this.callbacks && this.callbacks.onTick && (now - (this._lastTick || 0) > 33 || this.over)) {
      this._lastTick = now;
      this.callbacks.onTick(this.snapshot());
    }
    requestAnimationFrame(this.frame);
  }

  update(dt) {
    this.time += dt;
    const p = this.player;

    // Movement — single stick, all directions, clamped to lower ~70% of screen.
    p.vx = this.input.x * this.stats.speed;
    p.vy = this.input.y * this.stats.speed;
    p.x = clamp(p.x + p.vx * dt, p.r, this.W - p.r);
    p.y = clamp(p.y + p.vy * dt, this.H * 0.15, this.H - p.r - 10);
    p.bank = clamp(p.bank + (this.input.x * 0.6 - p.bank) * Math.min(1, dt * 8), -1, 1);
    p.iframes = Math.max(0, p.iframes - dt);
    p.hit = Math.max(0, p.hit - dt);

    // Autofire — spec: "1 tumme, auto fire"
    p.fireT -= dt;
    if (p.fireT <= 0) {
      p.fireT = 1 / this.stats.fireRate;
      this.projs.push({ x: p.x, y: p.y - p.r, vx: 0, vy: -900, dmg: this.stats.dmg, pierce: this.stats.pierce, hit: new Set() });
      if (this.stats.pierce > 0) {
        // Rail Rounds also grants light side-spread at higher investment.
        this.projs.push({ x: p.x - 10, y: p.y - p.r, vx: -60, vy: -880, dmg: this.stats.dmg * 0.6, pierce: 0, hit: new Set() });
        this.projs.push({ x: p.x + 10, y: p.y - p.r, vx: 60, vy: -880, dmg: this.stats.dmg * 0.6, pierce: 0, hit: new Set() });
      }
    }

    this.updateSpawns(dt);
    this.updateEnemies(dt);
    this.updateProjs(dt);
    this.updateEProjs(dt);
    this.updateOrbs(dt);
    this.updateParts(dt);

    if (p.hp <= 0 && !this.over) {
      this.over = true;
      this.cleared = false;
      if (this.callbacks && this.callbacks.onGameOver) this.callbacks.onGameOver(this.snapshot());
    }
  }

  updateSpawns(dt) {
    if (this.bossSpawned) return;
    if (this.time >= this.stage.duration) {
      this.spawnBoss();
      return;
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1 / (this.stage.spawnRate * (1 + this.time / 90));
      const kind = Math.random() < 0.25 ? 'shooter' : 'drone';
      this.enemies.push({
        x: rand(30, this.W - 30), y: -20, r: kind === 'shooter' ? 16 : 13,
        hp: (kind === 'shooter' ? 22 : 12) * this.stage.enemyHpMult,
        maxHp: (kind === 'shooter' ? 22 : 12) * this.stage.enemyHpMult,
        vy: rand(70, 120), vx: rand(-30, 30), kind, cd: rand(0.5, 1.5),
        color: kind === 'shooter' ? '#ff6a6a' : '#ffb347',
      });
    }
  }

  spawnBoss() {
    this.bossSpawned = true;
    this.boss = {
      x: this.W / 2, y: 90, r: 46,
      hp: this.stage.bossHp, maxHp: this.stage.bossHp,
      vx: 90, cd: 1.1, dmg: this.stage.bossDmg,
    };
  }

  updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.y += e.vy * dt; e.x += e.vx * dt;
      if (e.x < e.r || e.x > this.W - e.r) e.vx *= -1;
      if (e.kind === 'shooter') {
        e.cd -= dt;
        if (e.cd <= 0 && e.y > 0 && e.y < this.H * 0.7) {
          e.cd = rand(1.2, 2.0);
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          this.eprojs.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 280, vy: Math.sin(ang) * 280, dmg: 6 });
        }
      }
      if (e.y > this.H + 30) { this.enemies.splice(i, 1); continue; }
      if (p.iframes <= 0 && dist2(e.x, e.y, p.x, p.y) <= (e.r + p.r) * (e.r + p.r)) {
        this.damagePlayer(10);
        this.enemies.splice(i, 1);
      }
    }
    if (this.boss) {
      const b = this.boss;
      b.x += b.vx * dt;
      if (b.x < b.r + 20 || b.x > this.W - b.r - 20) b.vx *= -1;
      if (b.y < 90) b.y += 60 * dt;
      b.cd -= dt;
      if (b.cd <= 0) {
        b.cd = 0.9;
        for (let i = -1; i <= 1; i++) {
          const ang = Math.PI / 2 + i * 0.28;
          this.eprojs.push({ x: b.x, y: b.y + b.r * 0.6, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, dmg: b.dmg });
        }
      }
      if (p.iframes <= 0 && dist2(b.x, b.y, p.x, p.y) <= (b.r + p.r) * (b.r + p.r)) {
        this.damagePlayer(b.dmg);
      }
    }
  }

  updateProjs(dt) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.y < -20) { this.projs.splice(i, 1); continue; }
      let consumed = false;
      for (const e of this.enemies) {
        if (pr.hit.has(e)) continue;
        if (dist2(pr.x, pr.y, e.x, e.y) <= (e.r + 4) * (e.r + 4)) {
          e.hp -= pr.dmg;
          pr.hit.add(e);
          this.spawnSpark(pr.x, pr.y, '#fff44d');
          if (e.hp <= 0) this.killEnemy(e);
          if (pr.pierce <= 0) { consumed = true; break; }
          pr.pierce -= 1;
        }
      }
      if (this.boss && !pr.hit.has(this.boss) && dist2(pr.x, pr.y, this.boss.x, this.boss.y) <= (this.boss.r + 4) * (this.boss.r + 4)) {
        this.boss.hp -= pr.dmg;
        pr.hit.add(this.boss);
        this.spawnSpark(pr.x, pr.y, '#fff44d');
        if (this.boss.hp <= 0) this.killBoss();
        if (pr.pierce <= 0) consumed = true; else pr.pierce -= 1;
      }
      if (consumed) this.projs.splice(i, 1);
    }
  }

  updateEProjs(dt) {
    const p = this.player;
    for (let i = this.eprojs.length - 1; i >= 0; i--) {
      const ep = this.eprojs[i];
      ep.x += ep.vx * dt; ep.y += ep.vy * dt;
      if (ep.y > this.H + 20 || ep.y < -20 || ep.x < -20 || ep.x > this.W + 20) { this.eprojs.splice(i, 1); continue; }
      if (p.iframes <= 0 && dist2(ep.x, ep.y, p.x, p.y) <= (p.r + 4) * (p.r + 4)) {
        this.damagePlayer(ep.dmg);
        this.eprojs.splice(i, 1);
      }
    }
  }

  updateOrbs(dt) {
    const p = this.player;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const d = Math.hypot(p.x - o.x, p.y - o.y);
      if (d < this.stats.magnetR) {
        o.x += (p.x - o.x) * Math.min(1, dt * 8);
        o.y += (p.y - o.y) * Math.min(1, dt * 8);
      } else {
        o.y += 60 * dt;
      }
      if (d < p.r + 6) {
        this.scrap += o.val;
        this.orbs.splice(i, 1);
      } else if (o.y > this.H + 20) {
        this.orbs.splice(i, 1);
      }
    }
  }

  updateParts(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const pp = this.parts[i];
      pp.life -= dt;
      pp.x += pp.vx * dt; pp.y += pp.vy * dt;
      if (pp.life <= 0) this.parts.splice(i, 1);
    }
  }

  damagePlayer(dmg) {
    const p = this.player;
    p.hp = Math.max(0, p.hp - dmg);
    p.hit = 0.15; p.iframes = 0.6;
  }

  killEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    // Orb pickup reuses the exact same "small glowing pickup" concept as the
    // main game's gold/XP orbs.
    this.orbs.push({ x: e.x, y: e.y, val: e.kind === 'shooter' ? 3 : 1 });
    for (let i = 0; i < 6; i++) this.spawnSpark(e.x, e.y, e.color);
  }

  killBoss() {
    this.boss = null;
    for (let i = 0; i < 24; i++) this.spawnSpark(this.W / 2, 100, '#ff9900');
    for (let i = 0; i < 8; i++) this.orbs.push({ x: this.W / 2 + rand(-40, 40), y: 100 + rand(-20, 20), val: 8 });
    this.over = true;
    this.cleared = true;
    if (this.callbacks && this.callbacks.onGameOver) this.callbacks.onGameOver(this.snapshot());
  }

  spawnSpark(x, y, color) {
    const a = Math.random() * TAU, sp = rand(60, 220);
    this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.15, 0.35), color, size: rand(2, 4) });
  }

  snapshot() {
    return {
      time: this.time, stageDuration: this.stage.duration, stageName: this.stage.name,
      hp: this.player.hp, maxHp: this.player.maxHp,
      scrap: this.scrap, over: this.over, cleared: this.cleared,
      bossActive: !!this.boss, bossHp: this.boss ? this.boss.hp : 0, bossMaxHp: this.boss ? this.boss.maxHp : 0,
    };
  }
}
