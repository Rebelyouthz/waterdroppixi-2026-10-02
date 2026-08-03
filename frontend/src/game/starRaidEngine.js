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
  { id: 1, name: 'Debris Field',   duration: 40, spawnRate: 1.1, enemyHpMult: 1.0, bossHp: 260, bossDmg: 14, bossName: 'HULL BREAKER' },
  { id: 2, name: 'Ion Storm',      duration: 50, spawnRate: 1.4, enemyHpMult: 1.6, bossHp: 480, bossDmg: 20, bossName: 'ARC WARDEN' },
  { id: 3, name: 'The Deep Void',  duration: 60, spawnRate: 1.8, enemyHpMult: 2.4, bossHp: 820, bossDmg: 28, bossName: 'VOID SOVEREIGN' },
];

// Enemy hull classes. The renderer draws a distinct silhouette per kind
// (starRaidRenderer._drawEnemyShip), so each one also gets movement and a
// threat profile that matches how it looks: the needle dives, the hauler
// lumbers and soaks, the gunship hangs back and shoots.
export const ENEMY_KINDS = {
  drone:       { r: 13, hp: 12, speedY: [70, 120],  drift: 30, weight: 44, color: '#ffb347', score: 1 },
  interceptor: { r: 12, hp: 16, speedY: [170, 230], drift: 90, weight: 22, color: '#8affc8', score: 2 },
  shooter:     { r: 16, hp: 22, speedY: [55, 85],   drift: 26, weight: 24, color: '#ff6a6a', score: 3 },
  bomber:      { r: 21, hp: 54, speedY: [40, 60],   drift: 14, weight: 10, color: '#c58aff', score: 5 },
};
const KIND_IDS = Object.keys(ENEMY_KINDS);
const KIND_TOTAL = KIND_IDS.reduce((a, k) => a + ENEMY_KINDS[k].weight, 0);
function pickKind() {
  let r = Math.random() * KIND_TOTAL;
  for (const k of KIND_IDS) { r -= ENEMY_KINDS[k].weight; if (r <= 0) return k; }
  return 'drone';
}

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

// In-run level-up cards. Star Raid earns XP from kills the same way the main
// game does, and every level offers a choice of three — this is what makes a
// run a roguelite rather than a fixed-loadout shmup. `apply` mutates the live
// stats object, so picks compound within the run and reset between runs.
export const RAID_CARDS = [
  { id: 'twinCannon', name: 'Twin Cannon',    icon: '🔫', max: 4, desc: (l) => `+1 forward cannon (now ${1 + l + 1})`, apply: (s) => { s.guns += 1; } },
  { id: 'overcharge', name: 'Overcharge',     icon: '💥', max: 8, desc: () => '+18% cannon damage',                    apply: (s) => { s.dmg *= 1.18; } },
  { id: 'autoloader', name: 'Autoloader',     icon: '⏱️', max: 8, desc: () => '+15% fire rate',                        apply: (s) => { s.fireRate *= 1.15; } },
  { id: 'railRounds', name: 'Rail Rounds',    icon: '➰', max: 4, desc: () => '+1 pierce',                             apply: (s) => { s.pierce += 1; } },
  { id: 'spreadFire', name: 'Spread Fire',    icon: '🌾', max: 3, desc: () => '+2 angled shots per volley',            apply: (s) => { s.spread += 2; } },
  { id: 'seeker',     name: 'Seeker Warheads',icon: '🎯', max: 3, desc: () => 'Shots curve toward enemies',            apply: (s) => { s.homing += 0.35; } },
  { id: 'plating',    name: 'Ablative Plate', icon: '🛡️', max: 6, desc: () => '+12 max hull, and repair 12',           apply: (s, g) => { s.maxHp += 12; g.player.maxHp += 12; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 12); } },
  { id: 'tractor',    name: 'Tractor Field',  icon: '🧲', max: 5, desc: () => '+30 pickup radius',                     apply: (s) => { s.magnetR += 30; } },
  { id: 'afterburn',  name: 'Afterburner',    icon: '🚀', max: 4, desc: () => '+12% thrust',                           apply: (s) => { s.speed *= 1.12; } },
  { id: 'scavenger',  name: 'Scavenger Rig',  icon: '🔍', max: 4, desc: () => '+25% scrap and XP from wrecks',         apply: (s) => { s.loot += 0.25; } },
];

function makeStats(shipLevels) {
  const lv = shipLevels || {};
  return {
    dmg: 10 * (1 + (lv.dmg || 0) * SHIP_UPGRADES.dmg.perLevel),
    fireRate: 3.2 * (1 + (lv.atks || 0) * SHIP_UPGRADES.atks.perLevel),
    maxHp: 30 + (lv.hp || 0) * SHIP_UPGRADES.hp.perLevel,
    speed: 260 * (1 + (lv.mspd || 0) * SHIP_UPGRADES.mspd.perLevel),
    magnetR: 40 + (lv.magnet || 0) * SHIP_UPGRADES.magnet.perLevel,
    pierce: (lv.pierce || 0) * SHIP_UPGRADES.pierce.perLevel,
    // In-run only — reset every run, grown by RAID_CARDS picks.
    guns: 1,
    spread: 0,
    homing: 0,
    loot: 1,
  };
}

export class StarRaidGame {
  // px the hull rides above the touch point (see setChaseTarget)
  static THUMB_OFFSET = 58;

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
    this.chaseTarget = null; // { x, y } in canvas-pixel space — see setChaseTarget
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
    this.dt = 1 / 60;
    // In-run progression
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 12;
    this.cardLevels = {};      // RAID_CARDS id -> times taken this run
    this.levelUpQueue = 0;     // >0 pauses the sim and shows the card modal
    this.pendingChoices = null;
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  setInput(x, y) { this.input.x = clamp(x, -1, 1); this.input.y = clamp(y, -1, 1); }

  // Direct finger-follow control (Sky Force Reloaded style): the ship
  // chases wherever the finger/cursor is with an "arrive" ease (see
  // update()) instead of snapping to it 1:1, and instead of the old
  // virtual-joystick anchor-drag scheme, which read as fighting the touch
  // rather than following it — holding the finger down anywhere on screen
  // should make the ship head there and trail slightly behind as it moves.
  // The ship flies a fixed distance ABOVE the finger rather than under it —
  // otherwise your own thumb covers the one thing you need to see, which is
  // the ship and the bullets about to hit it. This is the standard touch-shmup
  // grip: hold slightly behind the ship and steer.
  setChaseTarget(x, y) { this.chaseTarget = { x, y: y - StarRaidGame.THUMB_OFFSET }; }
  clearChaseTarget() { this.chaseTarget = null; }

  destroy() { this.running = false; }

  frame(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.dt = dt;
    // levelUpQueue gates the sim the same way the main game does — the card
    // modal is a real pause, not an overlay you get shot through.
    if (!this.over && this.levelUpQueue === 0) { try { this.update(dt); } catch (e) { console.error('[starraid.update]', e); } }
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

    // Movement: touch/mouse chases the pointer with an "arrive" ease (slows
    // as it nears the target instead of snapping) — falls back to the old
    // direct-velocity scheme for keyboard input when no chase target is set.
    let steerX = this.input.x;
    if (this.chaseTarget) {
      const dx = this.chaseTarget.x - p.x, dy = this.chaseTarget.y - p.y;
      const d = Math.hypot(dx, dy);
      const arriveRadius = 90; // starts easing off within this many px of the finger
      const speedFrac = d < arriveRadius ? d / arriveRadius : 1;
      const nx = d > 0.01 ? dx / d : 0, ny = d > 0.01 ? dy / d : 0;
      p.vx = nx * this.stats.speed * speedFrac;
      p.vy = ny * this.stats.speed * speedFrac;
      steerX = nx * speedFrac;
    } else {
      p.vx = this.input.x * this.stats.speed;
      p.vy = this.input.y * this.stats.speed;
    }
    p.x = clamp(p.x + p.vx * dt, p.r, this.W - p.r);
    p.y = clamp(p.y + p.vy * dt, this.H * 0.15, this.H - p.r - 10);
    p.bank = clamp(p.bank + (steerX * 0.6 - p.bank) * Math.min(1, dt * 8), -1, 1);
    p.iframes = Math.max(0, p.iframes - dt);
    p.hit = Math.max(0, p.hit - dt);

    // Autofire — spec: "1 tumme, auto fire"
    p.fireT -= dt;
    if (p.fireT <= 0) {
      p.fireT = 1 / this.stats.fireRate;
      const s = this.stats;
      // Forward bank: `guns` barrels side by side, evenly spaced about centre.
      const gunSpan = 9;
      for (let i = 0; i < s.guns; i++) {
        const off = (i - (s.guns - 1) / 2) * gunSpan;
        this.projs.push({
          x: p.x + off, y: p.y - p.r, vx: 0, vy: -900,
          dmg: s.dmg, pierce: s.pierce, homing: s.homing, hit: new Set(), color: '#fff44d',
        });
      }
      // Spread wings: angled shots at reduced damage, symmetric pairs.
      for (let i = 1; i <= s.spread; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const step = Math.ceil(i / 2);
        const ang = -Math.PI / 2 + side * step * 0.19;
        this.projs.push({
          x: p.x, y: p.y - p.r, vx: Math.cos(ang) * 880, vy: Math.sin(ang) * 880,
          dmg: s.dmg * 0.6, pierce: 0, homing: s.homing, hit: new Set(), color: '#ffd166',
        });
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
      // Ship breaks apart instead of just vanishing — a real explosion burst
      // (sparks + a couple of hull chunks) plus a shockwave ring.
      for (let i = 0; i < 30; i++) this.spawnSpark(p.x, p.y, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ff7a1a' : '#4dc4ff');
      this.spawnDebris(p.x, p.y, '#5a6a7a', 10);
      this._shipExplodeRing = { x: p.x, y: p.y, t: 0 };
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
      const kind = pickKind();
      const K = ENEMY_KINDS[kind];
      const hp = K.hp * this.stage.enemyHpMult;
      this.enemies.push({
        x: rand(30, this.W - 30), y: -24, r: K.r,
        hp, maxHp: hp,
        vy: rand(K.speedY[0], K.speedY[1]), vx: rand(-K.drift, K.drift),
        kind, cd: rand(0.5, 1.5), color: K.color, score: K.score,
        rot: 0, hit: 0,
      });
    }
  }

  spawnBoss() {
    this.bossSpawned = true;
    this.boss = {
      x: this.W / 2, y: 90, r: 46,
      hp: this.stage.bossHp, maxHp: this.stage.bossHp,
      vx: 90, cd: 1.1, dmg: this.stage.bossDmg,
      name: this.stage.bossName || 'HULL BREAKER', hit: 0,
    };
  }

  updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hit = Math.max(0, e.hit - dt);

      // Interceptors actively steer toward the player's column instead of
      // drifting — they are the pressure that stops you parking in one lane.
      if (e.kind === 'interceptor') {
        e.vx += Math.sign(p.x - e.x) * 260 * dt;
        e.vx = clamp(e.vx, -220, 220);
      }
      e.y += e.vy * dt; e.x += e.vx * dt;
      if (e.x < e.r || e.x > this.W - e.r) e.vx *= -1;
      // Hulls bank into their horizontal motion; the renderer rotates the
      // silhouette by this, so ships lean instead of sliding around flat.
      e.rot += (clamp(e.vx / 220, -1, 1) * 0.5 - e.rot) * Math.min(1, dt * 7);

      if (e.kind === 'shooter' || e.kind === 'bomber') {
        e.cd -= dt;
        if (e.cd <= 0 && e.y > 0 && e.y < this.H * 0.7) {
          if (e.kind === 'bomber') {
            // Bombers lob a slow spread — area denial, not aimed fire.
            e.cd = rand(2.2, 3.2);
            for (let k = -1; k <= 1; k++) {
              const ang = Math.PI / 2 + k * 0.42;
              this.eprojs.push({ x: e.x, y: e.y + e.r * 0.5, vx: Math.cos(ang) * 165, vy: Math.sin(ang) * 165, dmg: 8, color: '#c58aff' });
            }
          } else {
            e.cd = rand(1.2, 2.0);
            const ang = Math.atan2(p.y - e.y, p.x - e.x);
            this.eprojs.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 280, vy: Math.sin(ang) * 280, dmg: 6, color: '#ff5566' });
          }
        }
      }
      if (e.y > this.H + 30) { this.enemies.splice(i, 1); continue; }
      if (p.iframes <= 0 && dist2(e.x, e.y, p.x, p.y) <= (e.r + p.r) * (e.r + p.r)) {
        this.damagePlayer(10);
        this.killEnemy(e, true);
      }
    }
    if (this.boss) {
      const b = this.boss;
      b.hit = Math.max(0, b.hit - dt);
      b.x += b.vx * dt;
      if (b.x < b.r + 20 || b.x > this.W - b.r - 20) b.vx *= -1;
      if (b.y < 90) b.y += 60 * dt;
      b.cd -= dt;
      if (b.cd <= 0) {
        // Second phase below half health: wider spread, faster cadence, so
        // the fight escalates instead of repeating one pattern.
        const enraged = b.hp < b.maxHp * 0.5;
        b.cd = enraged ? 0.62 : 0.9;
        const arms = enraged ? 2 : 1;
        for (let i = -arms; i <= arms; i++) {
          const ang = Math.PI / 2 + i * 0.26;
          this.eprojs.push({ x: b.x, y: b.y + b.r * 0.6, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, dmg: b.dmg, color: '#ff5566' });
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
      // Seeker Warheads: steer toward the nearest target ahead, capped so a
      // fully-invested build still can't turn 180 degrees.
      if (pr.homing > 0) {
        const tgt = this.nearestTarget(pr.x, pr.y, 260);
        if (tgt) {
          const want = Math.atan2(tgt.y - pr.y, tgt.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          const sp = Math.hypot(pr.vx, pr.vy);
          let d = want - cur;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          const na = cur + clamp(d, -pr.homing * 5 * dt * 60, pr.homing * 5 * dt * 60);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.y < -20 || pr.x < -30 || pr.x > this.W + 30) { this.projs.splice(i, 1); continue; }
      let consumed = false;
      for (const e of this.enemies) {
        if (pr.hit.has(e)) continue;
        if (dist2(pr.x, pr.y, e.x, e.y) <= (e.r + 4) * (e.r + 4)) {
          e.hp -= pr.dmg;
          e.hit = 0.07;
          pr.hit.add(e);
          this.spawnImpact(pr.x, pr.y, pr.color || '#fff44d', e.color);
          if (e.hp <= 0) this.killEnemy(e);
          if (pr.pierce <= 0) { consumed = true; break; }
          pr.pierce -= 1;
        }
      }
      if (this.boss && !pr.hit.has(this.boss) && dist2(pr.x, pr.y, this.boss.x, this.boss.y) <= (this.boss.r + 4) * (this.boss.r + 4)) {
        this.boss.hp -= pr.dmg;
        this.boss.hit = 0.06;
        pr.hit.add(this.boss);
        this.spawnImpact(pr.x, pr.y, pr.color || '#fff44d', '#ff6a6a');
        if (this.boss.hp <= 0) this.killBoss();
        if (pr.pierce <= 0) consumed = true; else pr.pierce -= 1;
      }
      if (consumed) this.projs.splice(i, 1);
    }
  }

  nearestTarget(x, y, maxR) {
    let best = null, bd = maxR * maxR;
    for (const e of this.enemies) {
      const d = dist2(e.x, e.y, x, y);
      if (d < bd) { bd = d; best = e; }
    }
    if (this.boss) {
      const d = dist2(this.boss.x, this.boss.y, x, y);
      if (d < bd) best = this.boss;
    }
    return best;
  }

  // Impact reads as "this weapon hit that hull": a few sparks in the shot's
  // own colour plus a couple of fragments in the target's colour.
  spawnImpact(x, y, shotColor, hullColor) {
    for (let i = 0; i < 4; i++) this.spawnSpark(x, y, i === 0 ? '#ffffff' : shotColor);
    if (Math.random() < 0.6) this.spawnDebris(x, y, hullColor || shotColor, 1);
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
        const amt = Math.max(1, Math.round(o.val * this.stats.loot));
        if (o.kind === 'xp') this.addXp(amt);
        else this.scrap += amt;
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
    for (let i = 0; i < 8; i++) this.spawnSpark(p.x, p.y, i % 2 ? '#ff7a1a' : '#ffffff');
    this.spawnDebris(p.x, p.y, '#5a6a7a', 2);
  }

  addXp(n) {
    this.xp += n;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      // Gentle curve: levels stay frequent enough that a run is a build, not
      // a single pick, but slow enough that the last levels feel earned.
      this.xpToNext = Math.round(12 * Math.pow(1.28, this.level - 1));
      this.levelUpQueue += 1;
    }
    if (this.levelUpQueue > 0 && !this.pendingChoices) this.pendingChoices = this.buildCardChoices();
  }

  // Three distinct cards, skipping anything already maxed this run.
  buildCardChoices() {
    const avail = RAID_CARDS.filter(c => (this.cardLevels[c.id] || 0) < c.max);
    const pool = avail.length ? avail.slice() : RAID_CARDS.slice();
    const out = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const idx = (Math.random() * pool.length) | 0;
      const c = pool.splice(idx, 1)[0];
      const lvl = this.cardLevels[c.id] || 0;
      out.push({ id: c.id, name: c.name, icon: c.icon, level: lvl + 1, max: c.max, desc: c.desc(lvl) });
    }
    return out;
  }

  pickCard(id) {
    const card = RAID_CARDS.find(c => c.id === id);
    if (card) {
      card.apply(this.stats, this);
      this.cardLevels[id] = (this.cardLevels[id] || 0) + 1;
    }
    this.levelUpQueue = Math.max(0, this.levelUpQueue - 1);
    this.pendingChoices = this.levelUpQueue > 0 ? this.buildCardChoices() : null;
    // A pick that changed max hull must not leave current hp above it.
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
  }

  killEnemy(e, rammed) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    const score = e.score || 1;
    this.orbs.push({ x: e.x, y: e.y, val: score, kind: 'scrap' });
    // XP is what feeds the in-run card levels; scrap is the between-run
    // currency. Both drop so a run reads as progress on two timescales.
    this.orbs.push({ x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), val: 1 + score, kind: 'xp' });
    // Ships break apart: a flash of sparks plus real hull fragments that
    // tumble away and fade, rather than a puff of dots.
    for (let i = 0; i < (rammed ? 14 : 9); i++) this.spawnSpark(e.x, e.y, i % 3 === 0 ? '#ffffff' : e.color);
    this.spawnDebris(e.x, e.y, e.color, Math.max(2, Math.round(e.r / 5)));
  }

  killBoss() {
    const b = this.boss;
    const bx = b ? b.x : this.W / 2, by = b ? b.y : 100;
    this.boss = null;
    for (let i = 0; i < 40; i++) this.spawnSpark(bx + rand(-30, 30), by + rand(-30, 30), i % 3 === 0 ? '#ffffff' : '#ff9900');
    this.spawnDebris(bx, by, '#7a3040', 14);
    // Separate field from _shipExplodeRing — that one doubles as the "player
    // is dead, stop drawing the hull" flag, so reusing it here would make
    // your own ship vanish the instant you killed the boss.
    this._bossExplodeRing = { x: bx, y: by, t: 0 };
    for (let i = 0; i < 8; i++) this.orbs.push({ x: bx + rand(-40, 40), y: by + rand(-20, 20), val: 8, kind: 'scrap' });
    for (let i = 0; i < 6; i++) this.orbs.push({ x: bx + rand(-40, 40), y: by + rand(-20, 20), val: 6, kind: 'xp' });
    this.over = true;
    this.cleared = true;
    if (this.callbacks && this.callbacks.onGameOver) this.callbacks.onGameOver(this.snapshot());
  }

  spawnSpark(x, y, color) {
    const a = Math.random() * TAU, sp = rand(90, 300);
    const life = rand(0.14, 0.34);
    this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, color, size: rand(1.2, 3), type: 'spark' });
  }

  // Tumbling hull fragments — slower and longer-lived than sparks, drifting
  // downward with the scroll so they read as wreckage falling behind you.
  spawnDebris(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = rand(40, 150);
      const life = rand(0.5, 1.1);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 40,
        life, max: life, color, size: rand(1.6, 3.6), type: 'debris',
      });
    }
  }

  snapshot() {
    return {
      time: this.time, stageDuration: this.stage.duration, stageName: this.stage.name,
      hp: this.player.hp, maxHp: this.player.maxHp,
      scrap: this.scrap, over: this.over, cleared: this.cleared,
      bossActive: !!this.boss, bossHp: this.boss ? this.boss.hp : 0, bossMaxHp: this.boss ? this.boss.maxHp : 0,
      bossName: this.boss ? this.boss.name : '',
      level: this.level, xp: this.xp, xpToNext: this.xpToNext,
      levelUpChoices: this.levelUpQueue > 0 ? this.pendingChoices : null,
    };
  }
}
