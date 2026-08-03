// Waterdrop Survivor — Canvas 2D engine with pooling, twin-stick combat, juicy effects.
import { WEAPONS, ENEMIES, STAT_CARDS, RARITY, rollRarity, waveAt, nextBossEvent, WEAPON_EVO_MAP, metaCost } from './data';
import { ACTIVE_SKILLS, KILL_FX, ENEMY_KILL_FX, ADVANCED_CARDS, ELEMENTS, getWeaponForkChoices, WEAPON_SET_BONUSES } from './data_ext2';
import { Audio } from './audio';
import { PixiRenderer } from './pixiRenderer';

const TAU = Math.PI * 2;
// Heavy "square" melee enemies — hit noticeably harder than the rest of the
// roster once the first boss is down, on top of the general post-boss scaling.
const SQUARE_ENEMY_TYPES = new Set(['brute', 'charger', 'necron', 'steelbrute']);
// 'aoe'-behaviour weapons that pulse radially around the player (reuse
// weaponShockwave) rather than sweeping a directional arc in the aim
// direction (weaponScythe, the default for 'aoe').
const RADIAL_AOE_WEAPONS = new Set(['shockwave', 'plasmaTurret', 'solarFlare']);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
// Points to fully buy back the Agility/Aim attributes' -33%..+33% curve —
// matches the 20-point scale other attributes already use.
const ATTR_CURVE_MAX = 20;
// Local hex->rgb01 helper (pixiRenderer.js has its own copy for its own
// purposes — this one is only used for the coarse element-color read in
// spawnHitSparks/_elementHintFor below).
function hexToRgb01Local(hex) {
  const h = (hex || '#ffffff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16) || 0xffffff;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const len = (x, y) => Math.hypot(x, y);

// Uniform spatial hash over enemies, rebuilt once per frame.
//
// Every "what's near this point" question in the engine used to be a linear
// scan of the whole enemy pool — nearestEnemy() alone is called from ten
// sites, and projectile collision ran enemies x projectiles every frame. At
// 60+ enemies and 40+ projectiles that quadratic term is exactly where the
// frame time went during heavy waves. Bucket arrays are reused between
// frames (clear() only resets the buckets actually touched) so a steady
// fight allocates nothing.
class SpatialGrid {
  constructor(cell) {
    this.cell = cell;
    this.buckets = new Map();
    this._used = [];
  }
  // Math.floor, not |0 — truncation toward zero collapses the cells either
  // side of the origin into one, and world coordinates go negative.
  _key(cx, cy) { return (cx + 8192) * 16384 + (cy + 8192); }
  clear() {
    for (let i = 0; i < this._used.length; i++) {
      const arr = this.buckets.get(this._used[i]);
      if (arr) arr.length = 0;
    }
    this._used.length = 0;
  }
  insert(o) {
    const k = this._key(Math.floor(o.x / this.cell), Math.floor(o.y / this.cell));
    let arr = this.buckets.get(k);
    if (arr === undefined) { arr = []; this.buckets.set(k, arr); }
    if (arr.length === 0) this._used.push(k);
    arr.push(o);
  }
  // Visits every object in the cells overlapping the circle (x, y, r). Cell
  // granularity means callers still need their own exact distance test.
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.buckets.get(this._key(cx, cy));
        if (arr === undefined) continue;
        for (let i = 0; i < arr.length; i++) fn(arr[i]);
      }
    }
  }
}

class Pool {
  constructor(factory, size) {
    this.factory = factory;
    this.free = []; this.active = [];
    for (let i = 0; i < size; i++) this.free.push(factory());
  }
  acquire() {
    const o = this.free.pop() || this.factory();
    o.alive = true;
    o._gen = (o._gen || 0) + 1;
    this.active.push(o);
    return o;
  }
  release(o) {
    if (!o.alive) return;
    o.alive = false;
    const i = this.active.indexOf(o);
    if (i >= 0) this.active.splice(i, 1);
    this.free.push(o);
  }
  // Safe iteration: snapshot active array length and skip dead-during-iteration.
  forEach(fn) {
    const arr = this.active;
    for (let i = arr.length - 1; i >= 0; i--) {
      const o = arr[i];
      if (o && o.alive) fn(o, i);
    }
  }
}

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new PixiRenderer(canvas);
    this.meta = opts.meta || {}; // permanent upgrades effects
    this.attrs = opts.attrs || {}; // raw POE_ATTRS points (save.attrs) — Agility/Aim use a
    // non-linear -33%/+33% curve that can't be expressed through the generic
    // linear meta-effects pipeline, so they read straight from here.
    this.weaponElements = opts.weaponElements || {}; // { weaponId: [elementId, ...] } — Weaponsmith
    this.cosmetics = opts.cosmetics || {}; // { headbandColor, cigarOn } — see ProfilePanel rank unlocks
    this.callbacks = opts.callbacks || {};
    // Active pet in-game
    this.activePet = opts.activePet || null;
    this.pet = this.activePet ? { x: 0, y: 0, vx: 0, vy: 0, wobble: 0, attackCD: 0.5, healCD: 5, orbit: 0 } : null;
    this.W = 0; this.H = 0; this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.input = { x: 0, y: 0, mx: 0, my: 0, shooting: false, keys: {}, pause: false };
    this.cam = { x: 0, y: 0, shake: 0, slowmo: 0 };
    this.world = { w: 6400, h: 6400 };
    this.time = 0; // game seconds
    this.dt = 0;
    this.last = performance.now();
    this.acc = 0;
    this.over = false;
    this.paused = false;
    this.levelUpQueue = 0;
    this.victory = false;
    this.fps = 60;

    // Pools
    this.enemies = new Pool(() => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, hp: 0, maxHp: 0, t: null, hit: 0, cd: 0, dz: 0, kbX: 0, kbY: 0, _woundStage: 0, _wounds: [] }), 600);
    // Broadphase over the enemy pool. Cell ~96px: comfortably wider than a
    // normal enemy body, narrow enough that a 320px homing search still only
    // walks a handful of cells.
    this.enemyGrid = new SpatialGrid(96);
    this._maxEnemyR = 0;
    // Second broadphase over friendly projectiles. The renderer needs it to
    // answer "which projectile is lighting this enemy" without scanning every
    // projectile for every enemy (see pixiRenderer._drawEnemies).
    this.projGrid = new SpatialGrid(96);
    this.maxProjSize = 0;
    this.projs = new Pool(() => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, pierce: 0, life: 0, hit: new Set(), color: '', size: 4, homing: 0, friendly: true, crit: false }), 400);
    this.eprojs = new Pool(() => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0, color: '#ff3146', size: 5 }), 200);
    this.parts = new Pool(() => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, color: '', size: 1, type: 'blood' }), 1200);
    this.gems = new Pool(() => ({ alive: false, x: 0, y: 0, xp: 0, gold: 0, t: 0, heart: 0 }), 400);
    this.dmgNums = new Pool(() => ({ alive: false, x: 0, y: 0, life: 0, text: '', color: '#fff', vy: 0, size: 14 }), 300);
    this.corpses = []; // simple corpse list (rendered floor decals)
    this.bloodDecals = []; // floor blood (capped)
    this.skyEvents = []; // passing meteors/UFOs — decorative + real light casters
    this._nextSkyEventAt = rand(5, 10);

    // Player
    this.player = this.createPlayer();

    // Stats / run state
    this.run = {
      time: 0, kills: 0, level: 1, xp: 0, xpToNext: 16, gold: 0,
      comboCount: 0, comboTimer: 0, maxCombo: 0,
      score: 0, multiplier: 1, maxMultiplier: 1,
      ownedWeapons: opts.startWeapons || ['hydropistol'],
      weaponLvls: {},
      weaponForks: {}, // { weaponId: forkId } — level-5 evolution fork pick, see computeWeaponStats
      setsUnlocked: new Set(), // Weapon Pairing Set Bonuses already granted this run, see tickCardFlags
      noHit: true,
      activeSkillUses: 0,
      stats: {
        damageMult: 1.0 + (this.meta.dmg || 0),
        fireRateMult: 1.0 + (this.meta.atks || 0),
        moveMult: 1.0 + (this.meta.mspd || 0),
        maxHp: 50 + (this.meta.maxHp || 0),
        regen: (this.meta.regen || 0),
        armor: (this.meta.armor || 0),
        crit: 0.05 + (this.meta.crit || 0),
        critDmgMult: 1.5 + (this.meta.critd || 0),
        superCritChance: (this.meta.superCrit || 0),
        megaCritChance:  (this.meta.megaCrit  || 0),
        areaMult: 1.0 + (this.meta.area || 0),
        projBonus: (this.meta.proj || 0),
        pickupMult: 1.0 + (this.meta.pickup || 0),
        xpMult: 1.0 + (this.meta.xp || 0),
        goldMult: 1.0 + (this.meta.gold || 0),
        pierceBonus: (this.meta.pierce || 0),
        dodge: (this.meta.dodge || 0),
        reloadMult: 1.0,
        magBonus: 0,
        luck: 0.5 + (this.meta.luck || 0),
        revive: this.meta.revive ? 1 : 0,
        headshot: (this.meta.headshot || 0),
        berserk: this.meta.berserk ? 1 : 0,
        dash: this.meta.dash ? 1 : 0,
        dashCDMult: 1.0 - (this.meta.dashcd || 0),
        blink: this.meta.blink ? 1 : 0,
        shield: this.meta.shield ? 1 : 0,
        swipeAttack: !!this.meta.swipeAttack,
        elementalDmg: (this.meta.elementalDmg || 0),
        bossDmg: 1.0 + (this.meta.bossDmg || 0),
        voidBurst: (this.meta.voidBurst || 0),
        heartHeal: (this.meta.heartHeal || 0),
        zoom:      (this.meta.zoom || 0),
        levelUpDmg: 20 + (this.meta.lvlBoomDmg || 0),
        levelUpKB:  150 + (this.meta.lvlBoomKB  || 0),
        evoUnlocked: !!(opts.skills && opts.skills.poe_awk0 >= 1),
        unlockedEvos: opts.unlockedEvos || [],
        // Tempest skill tree (poe_tmp5/6/7) — see buildLevelUpChoices/
        // tryDash/castSkill('riptide') for where these are consumed.
        skillCdMult: 1.0, // Overclock stat card — see tryActiveSkill
        forksUnlocked: !!this.meta.forksUnlocked,
        undertowDash: !!this.meta.undertowDash,
        riptideMastery: !!this.meta.riptideMastery,
        // Advanced card flags
        flags: this.meta.flags || {},
      },
    };
    for (const w of this.run.ownedWeapons) this.run.weaponLvls[w] = 0;
    // Glass cannon adjust
    if (this.run.stats.flags.glassCannon) {
      this.run.stats.damageMult *= 2.5;
      this.run.stats.maxHp = Math.floor(this.run.stats.maxHp * 0.5);
    }
    this.player.maxHp = Math.min(100, this.run.stats.maxHp);
    this.player.hp = this.player.maxHp;

    // Wave spawn state
    this.spawnTimer = 0;
    this.bossActive = null;
    this.nextBoss = nextBossEvent(0);
    this.bossesKilled = 0;
    this._aidaKilled = false;
    this._endlessAnnounced = false;
    // Enemy tier escalation — tier N activates the instant boss N-1 dies, and
    // keeps climbing forever for a long endless run (see spawnEnemy/killBoss).
    this._tierBannerT = 0;
    // Boss guide-arrow state
    this._bossArrowWasOffscreen = false;
    this._bossArrowLast = null;
    this._bossArrowDissolve = null;
    this._bossArrowOffscreenNow = false;

    // Canvas visual effects state
    this._bossDeathFlash = 0;
    this._critPunch = 0;
    this._levelUpFlash = 0;
    this._levelUpTextTimer = 0;
    this._levelUpTextPos = null;
    this._lightningFlash = 0;
    // Boss-specific kill tracking
    this._necroKilled = false;
    this._voidKilled = false;
    this._horusKilled = false;

    // Active skills slots and cooldowns
    this.activeSkills = (opts.activeSkills || []).slice(0, this.meta.skillSlots || 2);
    this.skillCD = {};
    for (const k of this.activeSkills) this.skillCD[k] = 0;

    // Stage / challenge config
    this.stage = opts.stage || null;
    this.challenge = opts.challenge || null;
    this.targetDuration = (this.challenge && this.challenge.duration) || (opts.missionDuration || 9999);
    this.killGoal = (this.challenge && this.challenge.killGoal) || 0;
    this.spawnMultExtra = (this.challenge && this.challenge.spawnMult) || (opts.spawnMult || 1.0);

    // periodic ticks for card flags
    this._auraTick = 0; this._knockTick = 0; this._mirrorTick = 0;

    // Dock Station: a structure that spawns randomly on the map; standing
    // inside it fills a ring over time, then grants a random bonus.
    this.dockStation = null;
    this._nextDockStationAt = rand(35, 60);

    // ===== ORIGINAL SYSTEM 3/3: Tidal Shrine Trials =====
    // A rare, higher-stakes alternative to the Dock Station: channeling it
    // requires standing still inside its radius for a full 10s WITHOUT
    // leaving even once (leaving resets the channel to 0 instantly, unlike
    // the Dock Station's gradual drain), while the shrine actively pulls in
    // a small wave of enemies to pressure the player into defending it. A
    // completed trial rolls from a much stronger reward pool than the Dock
    // Station — real risk/reward, not just a passive fill-the-bar.
    this.tidalShrine = null;
    this._nextShrineAt = rand(150, 210);

    // Swipe-attack miniboss (swipeWarden): rare tanky elite, only killable
    // via a swipe attack while its guard is down. Starts appearing mid-run,
    // same beat as the first scripted boss.
    this._nextWardenAt = rand(95, 140);

    this.bindInput();
    this.resize();

    // Initial starter cards
    const boons = this.meta.startBoon || 0;
    for (let i = 0; i < boons; i++) this.levelUpQueue++;

    this.frame = this.frame.bind(this);
    this.running = true;
    requestAnimationFrame(this.frame);
  }

  createPlayer() {
    return {
      x: this.world.w / 2, y: this.world.h / 2,
      r: 14, hp: 100, maxHp: 100,
      iframes: 0, hit: 0, regenCarry: 0,
      aimX: 1, aimY: 0,
      reloading: false, reloadT: 0, mag: 12,
      shootCD: 0,
      moving: false,
      // velocity smoothing
      vx: 0, vy: 0, dirX: 0, dirY: 0,
      // visual feedback
      squish: 0, tilt: 0, bob: 0,
      recoil: 0,
      orbitAngle: 0,
      shockwaveCD: 0, scytheCD: 0, beamCD: 0, boltCD: 0, teslaCD: 0,
      meteorCD: 0,
      dashCD: 0, dashing: 0, dashVX: 0, dashVY: 0,
      shieldCharge: 1, shieldCD: 0,
    };
  }

  resize() {
    const c = this.canvas;
    this.W = c.clientWidth; this.H = c.clientHeight;
    if (this.renderer) this.renderer.resize(this.W, this.H);
  }

  destroy() {
    this.running = false;
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('mousemove', this._mm); // window-level
    window.removeEventListener('mousedown', this._md);
    window.removeEventListener('mouseup', this._mu);
    document.removeEventListener('visibilitychange', this._vis);
    this.canvas.removeEventListener('touchstart', this._ts);
    this.canvas.removeEventListener('touchmove', this._tm);
    this.canvas.removeEventListener('touchend', this._te);
    window.removeEventListener('resize', this._rs);
    if (this._gpLoop) cancelAnimationFrame(this._gpLoop);
    if (this.renderer) this.renderer.destroy();
  }

  bindInput() {
    this._kd = (e) => {
      const k = e.key.toLowerCase();
      this.input.keys[k] = true;
      if (k === 'r') this.tryReload();
      if (k === ' ' || k === 'shift') { e.preventDefault(); this.tryDash(); }
      if (k === 'e') this.trySwipeAttack(this.player.aimX, this.player.aimY);
      if (k === '1') this.tryActiveSkill(0);
      if (k === '2') this.tryActiveSkill(1);
      if (k === '3') this.tryActiveSkill(2);
      if (k === '4') this.tryActiveSkill(3);
      if (e.key === 'Escape' || k === 'p') {
        if (this.callbacks.onPauseToggle) this.callbacks.onPauseToggle();
      }
    };
    this._vis = () => { if (document.hidden && this.callbacks.onPauseToggle && !this.paused) this.callbacks.onPauseToggle(); };
    document.addEventListener('visibilitychange', this._vis);
    this._ku = (e) => { this.input.keys[e.key.toLowerCase()] = false; };

    // === Mouse: window-level so aim never gets stuck when leaving canvas ===
    this._mm = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.input.mx = e.clientX - rect.left;
      this.input.my = e.clientY - rect.top;
    };
    this._md = (e) => { if (e.button === 0) this.input.shooting = true; };
    this._mu = (e) => { if (e.button === 0) this.input.shooting = false; };

    // touch (mobile fallback)
    this._ts = (e) => { this.input.shooting = true; this._tm(e); };
    this._tm = (e) => {
      if (e.touches.length) {
        const rect = this.canvas.getBoundingClientRect();
        this.input.mx = e.touches[0].clientX - rect.left;
        this.input.my = e.touches[0].clientY - rect.top;
      }
    };
    this._te = () => { this.input.shooting = false; };
    this._rs = () => this.resize();

    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('mousemove', this._mm);   // FIXED: window-level
    window.addEventListener('mousedown', this._md);   // FIXED: window-level
    window.addEventListener('mouseup', this._mu);     // FIXED: window-level
    this.canvas.addEventListener('touchstart', this._ts, { passive: true });
    this.canvas.addEventListener('touchmove', this._tm, { passive: true });
    this.canvas.addEventListener('touchend', this._te);
    window.addEventListener('resize', this._rs);

    // === Gamepad support ===
    this._pollGamepad();
  }

  _pollGamepad() {
    const poll = () => {
      if (!this.running) return;
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        // Left stick: movement
        const lx = Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : 0;
        const ly = Math.abs(gp.axes[1]) > 0.12 ? gp.axes[1] : 0;
        if (lx || ly) this.input.joyMove = { x: lx, y: ly };
        else if (this.input.joyMove) this.input.joyMove = { x: 0, y: 0 };

        // Right stick: aim
        const rx = Math.abs(gp.axes[2]) > 0.12 ? gp.axes[2] : 0;
        const ry = Math.abs(gp.axes[3]) > 0.12 ? gp.axes[3] : 0;
        if (rx || ry) this.input.joyAim = { x: rx, y: ry };
        else if (rx === 0 && ry === 0) this.input.joyAim = this.input.joyAim || { x: 0, y: 0 };

        // Right trigger (RT / R2): shoot
        const rt = gp.buttons[7]?.value || 0;
        const rb = gp.buttons[5]?.pressed;
        this.input.shooting = rt > 0.4 || rb;

        // A button: dash
        if (gp.buttons[0]?.pressed) this.tryDash();
        // B: reload
        if (gp.buttons[1]?.pressed) this.tryReload();
        // Y: skill 1
        if (gp.buttons[3]?.pressed) this.tryActiveSkill(0);
        // X: skill 2
        if (gp.buttons[2]?.pressed) this.tryActiveSkill(1);
        // Start: pause
        if (gp.buttons[9]?.pressed && this.callbacks.onPauseToggle) this.callbacks.onPauseToggle();
        break; // use first connected gamepad
      }
      this._gpLoop = requestAnimationFrame(poll);
    };
    this._gpLoop = requestAnimationFrame(poll);
  }

  setPaused(p) { this.paused = p; this.last = performance.now(); }

  frame(now) {
    if (!this.running) return;
    try {
      let dt = (now - this.last) / 1000;
      this.last = now;
      // Cap dt to avoid spiral-of-death, min to avoid NaN
      if (dt > 0.1) dt = 0.1;
      if (dt < 0.0001) dt = 0.0001;
      this.dt = dt;
      // FPS tracking (EWMA)
      this.fps = this.fps * 0.92 + (1 / dt) * 0.08;
      // Adaptive quality: reduce shadows/blur when FPS < 55
      this._qualityHigh = this.fps > 55;

      if (!this.paused && !this.over && this.levelUpQueue === 0) {
        const speed = this.cam.slowmo > 0 ? 0.35 : 1.0;
        try { this.update(dt * speed); } catch (e) { console.error('[engine.update]', e); }
        this.cam.slowmo = Math.max(0, this.cam.slowmo - dt);
      }
      try { this.renderer.render(this); } catch (e) { console.error('[engine.render]', e); }
      // Throttle the React/HUD sync to ~30Hz — the sim+renderer now run far
      // faster than 60fps thanks to PixiJS, but calling setState on every
      // single one of those frames floods React's reconciler and creates a
      // growing backlog that paradoxically tanks real throughput over time.
      // A human can't perceive HUD number ticks faster than this anyway.
      if (this.callbacks.onTick && (now - (this._lastTick || 0) > 33 || this.over)) {
        this._lastTick = now;
        try { this.callbacks.onTick(this.snapshot()); } catch (e) { console.error('[engine.onTick]', e); }
      }
    } catch (e) {
      console.error('[engine.frame fatal]', e);
    }
    // ALWAYS re-queue — never let an error kill the loop
    requestAnimationFrame(this.frame);
  }

  snapshot() {
    return {
      time: this.run.time,
      hp: this.player.hp, maxHp: this.player.maxHp,
      level: this.run.level, xp: this.run.xp, xpToNext: this.run.xpToNext,
      kills: this.run.kills, gold: this.run.gold,
      mag: Math.max(0, Math.floor(this.player.mag)),
      reloading: this.player.reloading,
      weapons: this.run.ownedWeapons.map(id => ({
        id, icon: WEAPONS[id].icon, lvl: (this.run.weaponLvls[id] || 0) + 1, name: WEAPONS[id].name,
      })),
      over: this.over,
      victory: this.victory,
      fps: this.fps,
      pendingLevelUp: this.levelUpQueue > 0,
      wave: waveAt(this.run.time),
      bossActive: !!this.bossActive,
      bossHp: this.bossActive ? this.bossActive.hp : 0,
      bossMaxHp: this.bossActive ? this.bossActive.maxHp : 0,
      bossName: this.bossActive ? this.bossActive.t.name : '',
      dashCD: this.player.dashCD,
      // Max is reported alongside the remaining time so the joystick dial can
      // draw an accurate 0..1 charge arc — it can't derive it, the dash CD is
      // agility/meta-scaled at the moment of the dash.
      dashMaxCD: this.player.dashMaxCD || 2.4,
      dashReady: this.run.stats.dash > 0,
      swipeAttackUnlocked: !!this.run.stats.swipeAttack,
      swipeAttackCD: this.player.swipeAttackCD || 0,
      swipeAttackMaxCD: 1.1,
      shieldReady: this.run.stats.shield > 0 && this.player.shieldCharge > 0,
      activeSkills: this.activeSkills.map(id => ({
        id, icon: ACTIVE_SKILLS[id] ? ACTIVE_SKILLS[id].icon : '?',
        name: ACTIVE_SKILLS[id] ? ACTIVE_SKILLS[id].name : id,
        cd: this.skillCD[id] || 0,
        maxCd: ACTIVE_SKILLS[id] ? ACTIVE_SKILLS[id].cd : 1,
      })),
      noHit: this.run.noHit,
      targetDuration: this.targetDuration,
      killGoal: this.killGoal,
      challenge: this.challenge,
      aidaKilled: this._aidaKilled,
      endless: this._endlessAnnounced,
      enemyTier: this.bossesKilled + 1,
      tierBannerT: this._tierBannerT || 0,
      necroKilled: this._necroKilled,
      voidKilled:  this._voidKilled,
      horusKilled: this._horusKilled,
      passiveIcons: (this.run.pickedPassives || []).slice(0, 14),
      combo: this.run.comboCount,
      comboTimer: this.run.comboTimer,
      maxCombo: this.run.maxCombo,
      score: this.run.score || 0,
      multiplier: this.run.multiplier || 1,
      maxMultiplier: this.run.maxMultiplier || 1,
    };
  }

  setMobileInput(joyMove, joyAim, firing) {
    this.input.joyMove = joyMove;
    this.input.joyAim = joyAim;
    if (firing !== undefined) this.input.shooting = firing;
  }

  // ====== UPDATE ======
  update(dt) {
    this.run.time += dt;
    // Combo decay
    if (this.run.comboTimer > 0) {
      this.run.comboTimer -= dt;
      if (this.run.comboTimer <= 0) {
        this.run.comboTimer = 0; this.run.comboCount = 0;
        // Pinball-style multiplier drop: losing the combo resets it to 1x —
        // the risk/reward tension of climbing it back up is the whole point.
        if (this.run.multiplier > 1) {
          this.run.multiplier = 1;
          this.spawnDamageNumber(this.player.x, this.player.y - 70, 'MULTIPLIER LOST', '#ff5566', 14);
        }
      }
    }
    this.time += dt;
    this.cam.shake = Math.max(0, this.cam.shake - dt * 30);

    // Active skill cooldown ticks
    for (const k of Object.keys(this.skillCD)) this.skillCD[k] = Math.max(0, this.skillCD[k] - dt);
    // Timewarp + Vortex timers
    this._timewarpT = Math.max(0, (this._timewarpT || 0) - dt);
    this._vortexT = Math.max(0, (this._vortexT || 0) - dt);

    this._updateFxBudget();

    // Rebuild the enemy broadphase before anything queries it this frame.
    // Enemies spawned later in the frame (spawnWave) land in it next frame —
    // they enter off-screen, so nothing can miss them meanwhile.
    this._rebuildEnemyGrid();

    this.updatePlayer(dt);
    this.updateBossArrow(dt);
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateProjs(dt);
    this.updateEProjs(dt);
    this.updateParts(dt);
    this.updateGems(dt);
    this.updateDmgNums(dt);
    this.spawnWave(dt);
    this.updateDockStation(dt);
    this.updateTidalShrine(dt);
    this._nextWardenAt -= dt;
    if (this._nextWardenAt <= 0) {
      let hasWarden = false;
      this.enemies.forEach(e => { if (e.alive && e.t && e.t.id === 'swipeWarden') hasWarden = true; });
      if (!hasWarden) { this.spawnEnemy('swipeWarden'); this._nextWardenAt = rand(120, 180); }
      else this._nextWardenAt = 8; // recheck soon rather than spawning a second one
    }
    // Flying swarm burst — a handful of Sky Wisps drop in together every
    // ~45-70s, same periodic-timer pattern as the Warden above.
    this._nextSwarmAt = this._nextSwarmAt !== undefined ? this._nextSwarmAt - dt : rand(45, 70);
    if (this._nextSwarmAt <= 0) {
      this._nextSwarmAt = rand(45, 70);
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.spawnEnemy('skyWisp');
    }
    // Iron Sentinel / Blight Weaver minibosses — independent timers so they
    // don't always show up bundled with the Warden.
    this._nextIronAt = this._nextIronAt !== undefined ? this._nextIronAt - dt : rand(150, 210);
    if (this._nextIronAt <= 0) {
      let has = false;
      this.enemies.forEach(e => { if (e.alive && e.t && e.t.id === 'ironSentinel') has = true; });
      if (!has) { this.spawnEnemy('ironSentinel'); this._nextIronAt = rand(150, 210); }
      else this._nextIronAt = 10;
    }
    this._nextBlightAt = this._nextBlightAt !== undefined ? this._nextBlightAt - dt : rand(140, 200);
    if (this._nextBlightAt <= 0) {
      let has = false;
      this.enemies.forEach(e => { if (e.alive && e.t && e.t.id === 'blightWeaver') has = true; });
      if (!has) { this.spawnEnemy('blightWeaver'); this._nextBlightAt = rand(140, 200); }
      else this._nextBlightAt = 10;
    }
    this.tickCardFlags(dt);
    if (this.pet) this.updatePet(dt);

    // Reveal the level-up card modal after the explosion has had a moment
    // to actually play out (see _maybeLevelUp).
    if ((this._pendingLevelUps || 0) > 0) {
      this._levelUpRevealT -= dt;
      if (this._levelUpRevealT <= 0) {
        this.levelUpQueue += this._pendingLevelUps;
        this._pendingLevelUps = 0;
      }
    }

    // Canvas effects decay
    this._bossDeathFlash = Math.max(0, this._bossDeathFlash - dt * 2.5);
    this._critPunch      = Math.max(0, this._critPunch - dt * 5);
    this._levelUpFlash   = Math.max(0, this._levelUpFlash - dt * 4);
    this._levelUpTextTimer = Math.max(0, (this._levelUpTextTimer || 0) - dt);
    this._lightningFlash = Math.max(0, (this._lightningFlash || 0) - dt * 6);
    this._tierBannerT = Math.max(0, (this._tierBannerT || 0) - dt);

    // Passing sky objects (meteors / UFOs) — decorative, and real light casters
    this._nextSkyEventAt -= dt;
    if (this._nextSkyEventAt <= 0) {
      this._nextSkyEventAt = rand(9, 16);
      this.spawnSkyEvent();
    }
    this.updateSkyEvents(dt);

    if (this.nextBoss && this.run.time >= this.nextBoss.t && !this.bossActive) {
      this.spawnBoss(this.nextBoss.event);
      this.nextBoss = nextBossEvent(this.run.time + 0.1);
    }

    // Challenge / mission completion
    if (this.killGoal > 0 && this.run.kills >= this.killGoal && !this.over) {
      this.victory = true; this.over = true;
      if (this.callbacks.onGameOver) this.callbacks.onGameOver({ ...this.snapshot(), victory: true, completed: 'killGoal' });
    }
    if (this.targetDuration && this.targetDuration < 999 && this.run.time >= this.targetDuration && !this.over) {
      this.victory = true; this.over = true;
      if (this.callbacks.onGameOver) this.callbacks.onGameOver({ ...this.snapshot(), victory: true, completed: 'duration' });
    }

    if (this._aidaKilled && !this._endlessAnnounced) {
      this._endlessAnnounced = true;
      this.cam.shake = 22; this.cam.slowmo = 0.25;
      this.spawnDamageNumber(this.player.x, this.player.y - 80, '∞ ENDLESS', '#ff4dff');
      this.spawnDamageNumber(this.player.x, this.player.y - 50, '+500 GOLD', '#ffd166');
      this.run.gold += 500;
      this.spawnRing(this.player.x, this.player.y, 200, '#ff4dff', 0.6);
    }

    if (this.player.hp <= 0 && !this.over) {
      if (this.run.stats.revive > 0) {
        this.run.stats.revive = 0;
        this.player.hp = this.player.maxHp * 0.5;
        this.player.iframes = 2;
        this.cam.shake = 12;
        this.spawnHitBurst(this.player.x, this.player.y, '#ffd166', 60);
      } else {
        this.over = true;
        if (this.callbacks.onGameOver) this.callbacks.onGameOver({ ...this.snapshot(), victory: false });
      }
    }
  }

  tickCardFlags(dt) {
    const s = this.run.stats; const p = this.player; const f = s.flags || {};
    // Damage aura
    if (f.damageAura) {
      this._auraTick = (this._auraTick || 0) + dt;
      if (this._auraTick >= 0.5) {
        this._auraTick = 0;
        const r = 90 * s.areaMult;
        const dmg = 18 * s.damageMult;
        this.enemies.forEach(e => { if (dist2(e.x, e.y, p.x, p.y) <= r * r) this.dealDamage(e, dmg, false, 0, p.x, p.y, true); });
      }
    }
    // Slow field — done in enemy update via flag check
    // Knockback wave
    if (f.knockbackWave) {
      this._knockTick = (this._knockTick || 0) + dt;
      if (this._knockTick >= 8) {
        this._knockTick = 0;
        this.enemies.forEach(e => {
          const dx = e.x - p.x, dy = e.y - p.y; const d = Math.hypot(dx, dy) || 1;
          e.kbX += (dx / d) * 280; e.kbY += (dy / d) * 280;
        });
        this.spawnRing(p.x, p.y, 200, '#bff0ff', 0.4);
      }
    }
    // Mirror image
    if (f.mirrorAura) {
      this._mirrorTick = (this._mirrorTick || 0) + dt;
      if (this._mirrorTick >= 12) {
        this._mirrorTick = 0;
        const e = this.enemies.acquire();
        e.x = p.x + rand(-30, 30); e.y = p.y + rand(-30, 30);
        e.t = { id: 'mirror', name: 'Mirror', size: 14, hp: 100, dmg: 0, speed: 0, color: '#bff0ff', xp: 0, gold: 0, ai: 'decoy', boss: false };
        e.maxHp = 100; e.hp = 100; e.hit = 0; e.cd = 0; e.kbX = 0; e.kbY = 0; e._decoy = 5;
      }
    }
    // Lifeline (shield below 20%)
    if (f.lifeline && p.hp < p.maxHp * 0.2 && !p._lifelineUsed) {
      p._lifelineUsed = this.run.time + 30;
      p.iframes = Math.max(p.iframes, 1.5);
      this.spawnRing(p.x, p.y, 60, '#ffd166', 0.4);
    }
    if (p._lifelineUsed && this.run.time >= p._lifelineUsed) p._lifelineUsed = 0;
    // Burn DoT
    this.enemies.forEach(e => {
      if (e._burn > 0) {
        e._burn -= dt;
        e._burnAcc = (e._burnAcc || 0) + dt;
        if (e._burnAcc >= 0.5) { e._burnAcc = 0; this.dealDamage(e, 6 * s.damageMult, false, 0, e.x, e.y, true); if (Math.random() < 0.5) this.spawnSpark(e.x, e.y, '#ff7a1a'); }
      }
      if (e._comboCD > 0) e._comboCD -= dt; // Elemental Combo Reactions cooldown, see checkElementalCombo
    });
    // Stasis Beacon field — deployed by the 'beacon' active skill (castSkill)
    if (this._beaconT > 0) {
      this._beaconT -= dt;
      this._beaconTick = (this._beaconTick || 0) + dt;
      if (this._beaconTick >= 0.4) {
        this._beaconTick = 0;
        this.enemies.forEach(e => {
          if (dist2(e.x, e.y, this._beaconX, this._beaconY) <= 150 * 150) {
            this.dealDamage(e, 10 * s.damageMult, false, 0, this._beaconX, this._beaconY, true);
            e._slowT = Math.max(e._slowT || 0, 0.5); e._slowMult = 0.25;
          }
        });
        this.spawnRing(this._beaconX, this._beaconY, 150, '#ffd166', 0.35);
      }
    }
    // Vortex pull
    if (this._vortexT > 0) {
      const vx = this._vortexX, vy = this._vortexY;
      this.enemies.forEach(e => {
        const dx = vx - e.x, dy = vy - e.y; const d = Math.hypot(dx, dy);
        if (d < 320) {
          e.x += (dx / Math.max(d, 1)) * 300 * dt;
          e.y += (dy / Math.max(d, 1)) * 300 * dt;
          if (Math.random() < 0.04) this.dealDamage(e, 8 * s.damageMult, false, 0, vx, vy, true);
        }
      });
    }
    // ===== NEW PASSIVE WEAPONS =====
    if (f.thunderCult) {
      this._thunderT = (this._thunderT || 0) + dt;
      if (this._thunderT >= 4) {
        this._thunderT = 0;
        // Strike a random enemy within 480
        const candidates = [];
        this.enemies.forEach(e => { if (dist2(e.x, e.y, p.x, p.y) <= 480 * 480) candidates.push(e); });
        if (candidates.length) {
          const t = candidates[Math.floor(Math.random() * candidates.length)];
          this.dealDamage(t, 60 * s.damageMult, false, 60, p.x, p.y);
          this.spawnLightning(t.x, t.y - 200, t.x, t.y);
          this.spawnRing(t.x, t.y, 36, '#bff0ff', 0.3);
          this.cam.shake = Math.max(this.cam.shake, 3);
        }
      }
    }
    if (f.iceShards) {
      this._iceT = (this._iceT || 0) + dt;
      if (this._iceT >= 1.6) {
        this._iceT = 0;
        const tgt = this.nearestEnemy(p.x, p.y, 600);
        if (tgt) {
          const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          this.fireProjectile(p.x, p.y, ang, { damage: 28, projSpeed: 520, projSize: 6, color: '#bff0ff', pierce: 2, crit: 0.1, _behaviour: 'projectile' }, true, 1.0);
        }
      }
    }
    if (f.holyWater) {
      this._holyT = (this._holyT || 0) + dt;
      if (this._holyT >= 6) {
        this._holyT = 0;
        p.hp = Math.min(p.maxHp, p.hp + 8);
        this.spawnRing(p.x, p.y, 80, '#bff0ff', 0.5);
        this.spawnDamageNumber(p.x, p.y - 12, '+8 HP', '#4dffd4', 16);
      }
    }
    if (f.swarmAura) {
      // 3 bees orbiting + damaging
      this._swarmT = (this._swarmT || 0) + dt;
      const a0 = this.time * 4;
      for (let i = 0; i < 3; i++) {
        const a = a0 + (i / 3) * TAU;
        const bx = p.x + Math.cos(a) * 60, by = p.y + Math.sin(a) * 60;
        if (Math.random() < 0.15) this.spawnSpark(bx, by, '#ffd166');
      }
      if (this._swarmT >= 0.4) {
        this._swarmT = 0;
        this.enemies.forEach(e => {
          if (dist2(e.x, e.y, p.x, p.y) <= 70 * 70) this.dealDamage(e, 12 * s.damageMult, false, 0, p.x, p.y, true);
        });
      }
    }
    if (f.juggernaut) {
      let count = 0;
      this.enemies.forEach(e => { if (dist2(e.x, e.y, p.x, p.y) <= 200 * 200) count++; });
      if (count > 0) {
        p.regenCarry += (count / 5) * dt;
        while (p.regenCarry >= 1) { p.hp = Math.min(p.maxHp, p.hp + 1); p.regenCarry -= 1; }
      }
    }
    if (f.railStance) {
      // Track standing-still time
      if (Math.hypot(p.vx || 0, p.vy || 0) < 10) {
        p._stillT = (p._stillT || 0) + dt;
      } else {
        p._stillT = 0;
      }
    }
    // Soul Harvest — heal every 25 kills
    if (f.soulHarvest) {
      const threshold = 25;
      p._harvestKills = p._harvestKills || 0;
      const newKills = this.run.kills;
      if (Math.floor(newKills / threshold) > Math.floor(p._harvestKills / threshold)) {
        p.hp = Math.min(p.maxHp, p.hp + 1);
        this.spawnDamageNumber(p.x, p.y - 14, 'HARVEST +1', '#4dffd4');
      }
      p._harvestKills = newKills;
    }
    // Quickstep — speed boost after taking damage
    if (f.quickstep && p._quickstepT > 0) {
      p._quickstepT = Math.max(0, p._quickstepT - dt);
    }
    // Thorns — return 25% dmg (applied in damage calc flag)
    // Berserker — attack speed below 30% HP
    if (f.berserkerMode) {
      const isBerserk = p.hp < p.maxHp * 0.30;
      s._berserkerActive = isBerserk;
    }
    // holyWater nerf: heal 8 HP instead of 15
    if (f.holyWater) { /* handled above, no change */ }
    // Tidal Wave — periodic knockback + damage pulse
    if (f.tidalWave) {
      this._tidalT = (this._tidalT || 0) + dt;
      if (this._tidalT >= 10) {
        this._tidalT = 0;
        const r = 220 * s.areaMult;
        this.enemies.forEach(e => {
          const dx = e.x - p.x, dy = e.y - p.y; const d = Math.hypot(dx, dy) || 1;
          if (d <= r) {
            e.kbX += (dx / d) * 340; e.kbY += (dy / d) * 340;
            this.dealDamage(e, 22 * s.damageMult, false, 0, p.x, p.y, true);
          }
        });
        this.spawnTidalWave(p.x, p.y, r);
        this.cam.shake = Math.max(this.cam.shake, 7);
      }
    }
    // Second Wind — once per run, a safety net when HP crashes low
    if (f.secondWind && !p._secondWindUsed && p.hp < p.maxHp * 0.15) {
      p._secondWindUsed = true;
      p.iframes = Math.max(p.iframes, 1.2);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
      this.spawnRing(p.x, p.y, 90, '#4dffd4', 0.6);
      this.spawnDamageNumber(p.x, p.y - 20, 'SECOND WIND!', '#4dffd4', 20);
      this.cam.shake = Math.max(this.cam.shake, 8);
    }
    // Gravity Charge — every 15 kills, pull nearby foes in
    if (f.gravityPull) {
      const threshold = 15;
      p._gravityKills = p._gravityKills || 0;
      if (Math.floor(this.run.kills / threshold) > Math.floor(p._gravityKills / threshold)) {
        const r = 260;
        this.enemies.forEach(e => {
          const dx = p.x - e.x, dy = p.y - e.y; const d = Math.hypot(dx, dy) || 1;
          if (d <= r) { e.kbX += (dx / d) * 260; e.kbY += (dy / d) * 260; }
        });
        this.spawnRing(p.x, p.y, r, '#b362ff', 0.4);
      }
      p._gravityKills = this.run.kills;
    }
    // ===== ORIGINAL SYSTEM 2/3: Weapon Pairing Set Bonuses =====
    // Owning both weapons of a curated pair simultaneously unlocks a
    // permanent (for this run) stat bonus, checked once per frame — cheap
    // since the pool is only 5 entries and each is a simple .every() over
    // a 2-element array.
    for (const set of WEAPON_SET_BONUSES) {
      if (this.run.setsUnlocked.has(set.id)) continue;
      if (set.weapons.every(w => this.run.ownedWeapons.includes(w))) {
        this.run.setsUnlocked.add(set.id);
        set.apply(s);
        this.spawnRing(p.x, p.y, 70, '#ffd166', 0.5);
        this.spawnDamageNumber(p.x, p.y - 40, `SET: ${set.name}!`, '#ffd166', 16);
        this.cam.shake = Math.max(this.cam.shake, 5);
      }
    }
  }

  // Agility attribute (save.attrs.mob): 0 points = 33% slower/sluggier than
  // today's baseline, ATTR_MAX points = 33% faster/snappier than today's
  // baseline — i.e. a curve centered on "how the game already felt",
  // not centered on 0. Drives move speed, turn/accel responsiveness, and
  // dash speed/cooldown.
  agilityMult() {
    const pts = Math.min(ATTR_CURVE_MAX, this.attrs.mob || 0);
    return 0.67 + (pts / ATTR_CURVE_MAX) * 0.66;
  }

  // Aim attribute (save.attrs.aim): inverse curve — 0 points = 33% MORE
  // base shot imprecision than baseline, max points = 33% LESS. This is a
  // small imprecision applied on top of each weapon's own spread stat, so
  // even a "0 spread" weapon can clip a miss at 0 points (see
  // weaponManualPistol/weaponShotgun) — investing buys back a genuinely
  // tighter, more reliable shot.
  aimSpreadMult() {
    const pts = Math.min(ATTR_CURVE_MAX, this.attrs.aim || 0);
    return 1.33 - (pts / ATTR_CURVE_MAX) * 0.66;
  }

  updatePlayer(dt) {
    const p = this.player, s = this.run.stats, k = this.input.keys;
    let dx = 0, dy = 0;
    if (k['w'] || k['arrowup'])    dy -= 1;
    if (k['s'] || k['arrowdown'])  dy += 1;
    if (k['a'] || k['arrowleft'])  dx -= 1;
    if (k['d'] || k['arrowright']) dx += 1;
    // mobile joystick
    if (this.input.joyMove && (this.input.joyMove.x || this.input.joyMove.y)) {
      dx = this.input.joyMove.x; dy = this.input.joyMove.y;
    }
    const l = Math.hypot(dx, dy) || 1;
    const agi = this.agilityMult();
    const baseSpd = 200 * s.moveMult * agi;
    // Target velocity (normalized) + accel/decel smoothing for that nice "weight" feel
    const moving = !!(dx || dy);
    const targetX = moving ? (dx / l) : 0;
    const targetY = moving ? (dy / l) : 0;
    // accelerate toward target dir — Agility attribute scales how snappy
    // (vs sluggish) both accelerating into and out of a turn feels.
    const accel = (moving ? 9.0 : 12.0) * agi;
    p.dirX += (targetX - p.dirX) * Math.min(1, accel * dt);
    p.dirY += (targetY - p.dirY) * Math.min(1, accel * dt);
    p.vx = p.dirX * baseSpd;
    p.vy = p.dirY * baseSpd;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // visual squish & tilt (decays toward 0 when idle)
    const speedRel = Math.hypot(p.dirX, p.dirY);
    p.squish += (speedRel * 0.18 - p.squish) * Math.min(1, dt * 8);
    // tilt: lean into movement direction
    const aimAng = Math.atan2(p.aimY, p.aimX);
    const moveAng = Math.atan2(p.dirY, p.dirX);
    const tiltTarget = moving ? Math.sin(moveAng - aimAng) * 0.35 * speedRel : 0;
    p.tilt += (tiltTarget - p.tilt) * Math.min(1, dt * 10);
    p.bob = (p.bob || 0) + dt * (moving ? 14 : 3);
    // Idle cigar cosmetic (rank-unlocked, see ProfilePanel): puffs a soft
    // drifting smoke particle every couple seconds while standing still.
    if (!moving && this.cosmetics.cigarOn) {
      this._cigarPuffT = (this._cigarPuffT || 0) - dt;
      if (this._cigarPuffT <= 0) {
        this._cigarPuffT = rand(1.6, 2.6);
        const sm = this.parts.acquire();
        const cigarAng = (p.tilt || 0) + 0.3;
        sm.x = p.x + Math.cos(cigarAng) * p.r * 0.45; sm.y = p.y + Math.sin(cigarAng) * p.r * 0.45 - p.r * 0.15;
        sm.vx = rand(-8, 8); sm.vy = -rand(18, 32);
        sm.life = rand(1.2, 1.8); sm.max = sm.life; sm.color = '#cfd0d6'; sm.size = rand(2, 3.5); sm.type = 'ash';
      }
    }
    p.recoil = Math.max(0, (p.recoil || 0) - dt * 4);
    p._muzzleFlashT = Math.max(0, (p._muzzleFlashT || 0) - dt);

    // Dash motion
    if (p.dashing > 0) {
      p.x += p.dashVX * dt;
      p.y += p.dashVY * dt;
      p.dashing -= dt;
      p.iframes = Math.max(p.iframes, 0.05);
      if (Math.random() < 0.5) this.spawnSpark(p.x, p.y, '#4dffd4');
      if (p.dashing <= 0 && s.blink) {
        // blink AoE on dash end — per-enemy crit roll
        const r = 90 * s.areaMult;
        const baseDmg = 60 * s.damageMult;
        this.enemies.forEach(e => {
          if (dist2(e.x, e.y, p.x, p.y) <= r * r) {
            const dmg = this.rollDamage(baseDmg);
            this.dealDamage(e, dmg.dmg, dmg.crit, 120, p.x, p.y);
          }
        });
        this.spawnRing(p.x, p.y, r, '#b362ff', 0.4);
        this.cam.shake = Math.max(this.cam.shake, 4);
      }
    }
    p.dashCD = Math.max(0, p.dashCD - dt);
    p.swipeAttackCD = Math.max(0, (p.swipeAttackCD || 0) - dt);
    p.shieldCD = Math.max(0, p.shieldCD - dt);
    if (s.shield && p.shieldCharge === 0 && p.shieldCD <= 0) { p.shieldCharge = 1; }

    p.x = clamp(p.x, 20, this.world.w - 20);
    p.y = clamp(p.y, 20, this.world.h - 20);
    p.moving = !!(dx || dy);

    // Aim — desktop mouse OR mobile aim joystick
    let aimX, aimY;
    if (this.input.joyAim && (this.input.joyAim.x || this.input.joyAim.y)) {
      aimX = this.input.joyAim.x; aimY = this.input.joyAim.y;
    } else {
      const wmx = this.input.mx - this.W / 2 + p.x - this.cam.x;
      const wmy = this.input.my - this.H / 2 + p.y - this.cam.y;
      const ax = wmx - p.x, ay = wmy - p.y;
      const al = Math.hypot(ax, ay) || 1;
      aimX = ax / al; aimY = ay / al;
    }
    p.aimX = aimX; p.aimY = aimY;

    p.hit = Math.max(0, p.hit - dt);
    p.iframes = Math.max(0, p.iframes - dt);

    if (s.regen > 0 && p.hp < p.maxHp) {
      p.regenCarry += s.regen * dt;
      while (p.regenCarry >= 1) { p.hp = Math.min(p.maxHp, p.hp + 1); p.regenCarry -= 1; }
    }

    const tx = p.x - this.W / 2, ty = p.y - this.H / 2;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);

    p.orbitAngle += dt * 2.0;
  }

  tryDash(dirX, dirY) {
    const p = this.player; const s = this.run.stats;
    if (!s.dash) return;
    if (p.dashCD > 0 || p.dashing > 0) return;
    let vx, vy;
    if (dirX !== undefined && dirY !== undefined && (dirX || dirY)) {
      // Explicit direction (e.g., from swipe gesture)
      vx = dirX; vy = dirY;
    } else {
      // Fall back to movement keys / aim
      const dx = p.aimX, dy = p.aimY;
      const k = this.input.keys;
      let mvx = 0, mvy = 0;
      if (k['w'] || k['arrowup']) mvy -= 1;
      if (k['s'] || k['arrowdown']) mvy += 1;
      if (k['a'] || k['arrowleft']) mvx -= 1;
      if (k['d'] || k['arrowright']) mvx += 1;
      if (this.input.joyMove && (this.input.joyMove.x || this.input.joyMove.y)) {
        mvx = this.input.joyMove.x; mvy = this.input.joyMove.y;
      }
      vx = mvx; vy = mvy;
      if (!vx && !vy) { vx = dx; vy = dy; }
    }
    const l = Math.hypot(vx, vy) || 1;
    const agi = this.agilityMult();
    const speed = 1100 * agi;
    p.dashVX = (vx / l) * speed;
    p.dashVY = (vy / l) * speed;
    p.dashing = 0.16;
    p.dashCD = (2.4 * (s.dashCDMult || 1)) / agi;
    p.dashMaxCD = p.dashCD;   // snapshot reports this so the dial can draw the fill
    p.iframes = s.undertowDash ? 0.33 : 0.22;
    this.cam.shake = Math.max(this.cam.shake, 2);
    for (let i = 0; i < 12; i++) this.spawnSpark(p.x, p.y, '#4dffd4');
    if (s.undertowDash) {
      const pullR = 180;
      this.enemies.forEach(e => {
        const dx = p.x - e.x, dy = p.y - e.y; const d = Math.hypot(dx, dy) || 1;
        if (d <= pullR) { e.kbX += (dx / d) * 220; e.kbY += (dy / d) * 220; }
      });
      this.spawnRing(p.x, p.y, pullR, '#1fb6ff', 0.3);
    }
    Audio.dash();
  }

  // Melee instant-kill triggered by a fast swipe gesture (aim stick on
  // mobile, 'E' in the current aim direction on desktop) — gated behind the
  // swipeAttack skill-tree node. Finds the nearest enemy roughly in the
  // swipe direction within melee range; normal enemies die instantly with a
  // "cut in half" animation (reuses the existing 'bisect' KILL_FX). The
  // swipeWarden miniboss only dies to this while its guard is down
  // (e._swipeVulnerable, see updateEnemies) — landing it while guarded
  // instead deals heavy chip damage so the input never feels wasted.
  trySwipeAttack(dx, dy) {
    const p = this.player; const s = this.run.stats;
    if (!s.swipeAttack) return;
    if ((p.swipeAttackCD || 0) > 0) return;
    const l = Math.hypot(dx, dy) || 1;
    const ndx = dx / l, ndy = dy / l;
    const range = 78;
    let target = null, bestDot = 0.35;
    this.enemies.forEach(e => {
      if (!e.alive || target === e) return;
      const ex = e.x - p.x, ey = e.y - p.y;
      const d = Math.hypot(ex, ey);
      if (d > range + e.t.size * 0.5) return;
      const dot = (ex / (d || 1)) * ndx + (ey / (d || 1)) * ndy;
      if (dot > bestDot) { bestDot = dot; target = e; }
    });
    if (!target) return;
    p.swipeAttackCD = 1.1;
    this.cam.shake = Math.max(this.cam.shake, 5);
    for (let i = 0; i < 8; i++) this.spawnSpark(target.x, target.y, '#ffffff');
    if (target.t.id === 'swipeWarden' && !target._swipeVulnerable) {
      this.dealDamage(target, target.maxHp * 0.22, false, 40, p.x, p.y);
      this.spawnDamageNumber(target.x, target.y - target.t.size, 'GUARD UP', '#ff5566', 14);
      return;
    }
    this.run.stats._lastHitWeapon = 'swipeAttack';
    target.hp = 0;
    this.spawnDamageNumber(target.x, target.y - target.t.size, target.t.id === 'swipeWarden' ? 'EXECUTED!' : 'SWIPE KILL', '#ffffff', 18);
    this.killEnemy(target);
    Audio.crit();
  }

  tryActiveSkill(idx) {
    const id = this.activeSkills[idx]; if (!id) return;
    const sk = ACTIVE_SKILLS[id]; if (!sk) return;
    if ((this.skillCD[id] || 0) > 0) return;
    this.skillCD[id] = sk.cd * Math.max(0.2, this.run.stats.skillCdMult || 1);
    this.run.activeSkillUses++;
    Audio.active(id);
    this.castSkill(id);
  }

  castSkill(id) {
    const p = this.player; const s = this.run.stats;
    if (id === 'lightning') {
      const targets = [];
      let from = { x: p.x + p.aimX * 80, y: p.y + p.aimY * 80 };
      for (let i = 0; i < 5; i++) {
        const t = this.nearestEnemy(from.x, from.y, 280);
        if (!t || targets.includes(t)) break;
        targets.push(t); from = { x: t.x, y: t.y };
      }
      let prev = { x: p.x, y: p.y };
      for (const t of targets) {
        const dmg = this.rollDamage(120 * s.damageMult);
        this.dealDamage(t, dmg.dmg, dmg.crit, 80, p.x, p.y);
        this.spawnLightning(prev.x, prev.y, t.x, t.y);
        prev = { x: t.x, y: t.y };
      }
      this.cam.shake = Math.max(this.cam.shake, 6);
    } else if (id === 'aegis') {
      p.iframes = Math.max(p.iframes, 3);
      p._reflectTimer = 3;
      this.spawnRing(p.x, p.y, 60, '#4dffd4', 0.5);
    } else if (id === 'timewarp') {
      this._timewarpT = 4; this.cam.slowmo = 0.6;
      this.spawnRing(p.x, p.y, 200, '#b362ff', 1.0);
    } else if (id === 'steamvent') {
      // Replaced Decoy Drop. A stationary aggro magnet asked nothing of the
      // player and did nothing visually — you dropped it and carried on.
      // Steam Vent is the archetype the roster was missing: mobility that is
      // also offence and sustain, so using it well means choosing WHERE to
      // punch through a crowd, not just when.
      const dirX = p.aimX || 1, dirY = p.aimY || 0;
      const dl = Math.hypot(dirX, dirY) || 1;
      const nx = dirX / dl, ny = dirY / dl;
      const range = 260;
      const x0 = p.x, y0 = p.y;
      const x1 = clamp(p.x + nx * range, 20, this.world.w - 20);
      const y1 = clamp(p.y + ny * range, 20, this.world.h - 20);

      let healed = 0;
      const hitR = 46;
      this.enemies.forEach(e => {
        if (!e.alive) return;
        // distance from the enemy to the dash segment, not just to the
        // endpoints — everything the vent passes through gets scalded
        const vx = x1 - x0, vy = y1 - y0;
        const segLen2 = vx * vx + vy * vy || 1;
        let tt = ((e.x - x0) * vx + (e.y - y0) * vy) / segLen2;
        tt = clamp(tt, 0, 1);
        const px = x0 + vx * tt, py = y0 + vy * tt;
        if (dist2(e.x, e.y, px, py) > hitR * hitR) return;
        this.dealDamage(e, 42 * s.damageMult, false, 180, x0, y0, false, '#dff6ff');
        this.applyElementalEffect(e, 'fire', 42 * s.damageMult * 0.5);
        if (healed < 5) { healed++; }
      });
      if (healed > 0) p.hp = Math.min(p.maxHp, p.hp + healed * 2);

      // Steam plume along the whole path, thickest where you launched from.
      const puffs = this.fxCount(26);
      for (let i = 0; i < puffs; i++) {
        const f = i / puffs;
        const pp = this.parts.acquire();
        pp.x = x0 + (x1 - x0) * f + rand(-10, 10);
        pp.y = y0 + (y1 - y0) * f + rand(-10, 10);
        const a = Math.random() * TAU;
        pp.vx = Math.cos(a) * rand(20, 90) - nx * 40;
        pp.vy = Math.sin(a) * rand(20, 90) - ny * 40 - rand(10, 50);
        pp.life = rand(0.3, 0.7) * (1 - f * 0.4); pp.max = pp.life;
        pp.color = i % 3 === 0 ? '#ffffff' : '#cfeeff';
        pp.size = rand(2.4, 5.5) * (1 - f * 0.35); pp.type = 'spark';
      }
      this.spawnRing(x0, y0, 70, '#dff6ff', 0.4);
      this.spawnRing(x1, y1, 54, '#9fe8ff', 0.35);
      p.x = x1; p.y = y1;
      p.iframes = Math.max(p.iframes, 0.35);
      this.cam.shake = Math.max(this.cam.shake, 6);
    } else if (id === 'meteor') {
      const tx = p.x + p.aimX * 200, ty = p.y + p.aimY * 200;
      const warn = this.parts.acquire();
      warn.x = tx; warn.y = ty; warn.vx = 0; warn.vy = 0;
      warn.life = 0.9; warn.max = 0.9; warn.color = '#ff7a1a'; warn.size = 180;
      warn.type = 'meteorMark'; warn._dmg = 200 * s.damageMult; warn._radius = 180;
      warn._fallFrom = -480; warn._fallOffX = rand(-100, 100);
    } else if (id === 'vortex') {
      this._vortexT = 2; this._vortexX = p.x + p.aimX * 60; this._vortexY = p.y + p.aimY * 60;
    } else if (id === 'riptide') {
      // A forward piercing wave in the aim direction — damages + slows
      // everything in a 100° cone out to 260 range, one instant hit.
      const aimAng = Math.atan2(p.aimY, p.aimX);
      const range = 260;
      const mastery = !!s.riptideMastery;
      this.enemies.forEach(e => {
        const edx = e.x - p.x, edy = e.y - p.y; const ed = Math.hypot(edx, edy);
        if (ed > range) return;
        let da = Math.atan2(edy, edx) - aimAng;
        while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        if (Math.abs(da) <= Math.PI * 0.5) {
          const dmg = this.rollDamage(90 * s.damageMult * (mastery ? 1.5 : 1));
          this.dealDamage(e, dmg.dmg, dmg.crit, 120, p.x, p.y);
          e._slowT = Math.max(e._slowT || 0, mastery ? 1.0 : 2.5);
          e._slowMult = mastery ? 0.02 : 0.45; // mastery: near-total root for 1s
        }
      });
      this.spawnArc(p.x, p.y, range, '#1fb6ff', aimAng);
      this.cam.shake = Math.max(this.cam.shake, 6);
    } else if (id === 'beacon') {
      // Deploys a stationary field (same stateful-timer pattern as vortex
      // above) that repeatedly damages + roots enemies inside it — see the
      // tick in tickCardFlags.
      this._beaconT = 5; this._beaconX = p.x + p.aimX * 140; this._beaconY = p.y + p.aimY * 140;
      this.spawnRing(this._beaconX, this._beaconY, 150, '#ffd166', 0.6);
    } else if (id === 'nova') {
      const r = 190 * s.areaMult;
      this.enemies.forEach(e => {
        if (dist2(e.x, e.y, p.x, p.y) <= r * r) {
          const dmg = this.rollDamage(70 * s.damageMult);
          this.dealDamage(e, dmg.dmg, dmg.crit, 60, p.x, p.y);
          e._slowT = Math.max(e._slowT || 0, 3); e._slowMult = 0.4;
        }
      });
      this.spawnRing(p.x, p.y, r, '#bff0ff', 0.5);
      this.spawnRing(p.x, p.y, r * 0.6, '#ffffff', 0.35);
      this.cam.shake = Math.max(this.cam.shake, 7);
    }
  }

  // AOE burst on impact for projectiles with `explode` > 0 (radius). This
  // field existed on the projectile pool object already but was never
  // actually consumed anywhere — wired it up here rather than adding a new
  // field, so Comet Launcher (and anything else that sets base.explode)
  // gets a real splash-damage payoff.
  explodeProjectile(pr) {
    const r = pr.explode;
    this.enemies.forEach(en => {
      if (dist2(en.x, en.y, pr.x, pr.y) <= r * r) {
        this.dealDamage(en, pr.dmg * 0.6, false, 100, pr.x, pr.y, true);
      }
    });
    this.spawnRing(pr.x, pr.y, r, pr.color || '#ff7a1a', 0.4);
    this.spawnHitBurst(pr.x, pr.y, pr.color || '#ff7a1a', 22);
    this.cam.shake = Math.max(this.cam.shake, 5);
  }

  // Tidal Wave used to be a single thin ring, which is why a passive that
  // knocks back and damages everything within 220px read as "nothing
  // happened, some enemies bled". It is now an actual body of water: a thick
  // crest that thins as it expands, an inner surge, foam along the leading
  // edge, and spray thrown outward ahead of it.
  spawnTidalWave(x, y, r) {
    const w = this.parts.acquire();
    w.x = x; w.y = y; w.vx = 0; w.vy = 0;
    w.life = 0.55; w.max = 0.55;
    w.color = '#1fb6ff'; w.size = 0; w.type = 'wave'; w._radius = r;

    // Spray leading the crest outward — thrown, not sprinkled.
    const n = this.fxCount(22);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.12, 0.12);
      const sp = rand(r * 1.5, r * 2.6);
      const pp = this.parts.acquire();
      pp.x = x + Math.cos(a) * 18; pp.y = y + Math.sin(a) * 18;
      pp.vx = Math.cos(a) * sp; pp.vy = Math.sin(a) * sp - rand(20, 90);
      pp.life = rand(0.28, 0.5); pp.max = pp.life;
      pp.color = i % 3 === 0 ? '#dff6ff' : '#4fc9ff';
      pp.size = rand(1.4, 3.2); pp.type = 'spark';
    }
  }

  // NOTE: vx/vy hold the arc's END POINT here, not a velocity. updateParts
  // special-cases 'lightning' for exactly that reason — don't remove it.
  spawnLightning(x1, y1, x2, y2, color) {
    const pp = this.parts.acquire();
    pp.x = x1; pp.y = y1; pp.vx = x2; pp.vy = y2;
    // Long enough to actually register as a strike. At 0.18s an arc was
    // roughly ten frames — technically drawn, practically invisible.
    pp.life = 0.30; pp.max = 0.30;
    pp.color = color || '#bff0ff'; pp.size = 0; pp.type = 'lightning';
  }


  // ====== WEAPONS ======
  updateWeapons(dt) {
    const owned = this.run.ownedWeapons;
    for (const wid of owned) {
      const w = WEAPONS[wid];
      const lvl = this.run.weaponLvls[wid] || 0;
      const stats = this.computeWeaponStats(w, lvl, wid);
      stats._wid = wid;
      stats._wlvl = lvl;
      // Weapon-dependent gore: whichever weapon is about to deal damage
      // "owns" this frame's blood/wound tint (read inside dealDamage) — e.g.
      // hydropistol wounds run pale blue-white, flameburst runs ember-orange,
      // icespike runs frosty cyan, instead of every kill bleeding plain red.
      this._curWeaponColor = stats.color || null;
      switch (w.behaviour) {
        case 'projectile':
          stats._behaviour = w.behaviour;
          if (w.type === 'manual') this.weaponManualPistol(stats, dt);
          else this.weaponAutoBolts(stats, dt);
          break;
        case 'shotgun':
          stats._behaviour = w.behaviour;
          this.weaponShotgun(stats, dt);
          break;
        case 'orbit':   stats._behaviour = w.behaviour; this.weaponOrbit(stats, dt); break;
        case 'aoe':     stats._behaviour = w.behaviour; RADIAL_AOE_WEAPONS.has(w.id) ? this.weaponShockwave(stats, dt) : this.weaponScythe(stats, dt); break;
        case 'beam':    stats._behaviour = w.behaviour; this.weaponBeam(stats, dt); break;
        case 'meteor':  stats._behaviour = w.behaviour; this.weaponMeteor(stats, dt); break;
        case 'chain':   stats._behaviour = w.behaviour; this.weaponChain(stats, dt); break;
        case 'drone':   stats._behaviour = w.behaviour; this.weaponDrone(stats, dt); break;
        default: break;
      }
    }
  }

  computeWeaponStats(w, lvl, wid) {
    const s = { ...w.base };
    for (let i = 0; i < lvl; i++) {
      const up = w.levelUps[i]; if (!up) break;
      if (up.mult != null) s[up.stat] = (s[up.stat] || 0) * up.mult;
      else if (up.add != null) s[up.stat] = (s[up.stat] || 0) + up.add;
      s._evolved = s._evolved || up.evolve === true;
    }
    // Level-5 evolution fork (see buildLevelUpChoices/applyCardChoice) —
    // one chosen path per weapon per run, re-applied every time stats are
    // computed since computeWeaponStats always rebuilds from w.base fresh.
    const forkId = wid && this.run.weaponForks ? this.run.weaponForks[wid] : null;
    if (forkId) {
      const fork = getWeaponForkChoices(w).find(f => f.id === forkId);
      if (fork) fork.apply(s);
    }
    return s;
  }

  weaponManualPistol(s, dt) {
    const p = this.player; const rs = this.run.stats;
    if (p.reloading) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        p.reloading = false;
        p.mag = (s.magazine || 12) + rs.magBonus;
      }
      return;
    }
    p.shootCD -= dt;
    const mag = (s.magazine || 12) + rs.magBonus;
    if (p.mag === undefined || p.mag > mag) p.mag = mag;
    if (p.mag <= 0) { this.startReload(s); return; }
    if (this.input.shooting && p.shootCD <= 0) {
      const fr = s.fireRate * rs.fireRateMult;
      p.shootCD = 1 / fr;
      // Base aim imprecision (Aim attribute) stacks on top of the weapon's
      // own spread — even a "0 spread" precision weapon can clip a miss at
      // low Aim investment, per spec ("siktar rakt men missar ändå").
      const spread = (s.spread || 0) + 0.035 * this.aimSpreadMult();
      const ang = Math.atan2(p.aimY, p.aimX) + (Math.random() - 0.5) * spread;
      this.fireProjectile(p.x + p.aimX * 14, p.y + p.aimY * 14, ang, s, true);
      p.mag -= 1;
      this.cam.shake = Math.max(this.cam.shake, 1.4);
      Audio.shoot();
      this.spawnMuzzle(p.x + p.aimX * 18, p.y + p.aimY * 18, ang, s.color);
      if (p.mag <= 0) this.startReload(s);
    }
  }

  startReload(s) {
    const p = this.player;
    if (p.reloading) return;
    p.reloading = true;
    p.reloadT = (s.reloadTime || 1.0) * this.run.stats.reloadMult;
    p.reloadTotal = p.reloadT; // full duration, so the renderer can compute progress without weapon lookups
    p._reloadMag = (s.magazine || 12) + this.run.stats.magBonus; // capacity, for the revolver-cylinder notch count
    p._reloadWid = s._wid || null; // which weapon is reloading, so the renderer picks the right visual
  }

  tryReload() {
    const w = WEAPONS['hydropistol'];
    const lvl = this.run.weaponLvls['hydropistol'] || 0;
    const s = this.computeWeaponStats(w, lvl, 'hydropistol');
    this.startReload(s);
  }

  weaponAutoBolts(s, dt) {
    const p = this.player; const rs = this.run.stats;
    p.boltCD -= dt;
    const fr = s.fireRate * rs.fireRateMult;
    if (p.boltCD > 0) return;
    p.boltCD = 1 / fr;
    const tgt = this.nearestEnemy(p.x, p.y, 700);
    if (!tgt) return;
    const projCount = (s.projectiles || 1) + rs.projBonus;
    const baseAng = Math.atan2(tgt.y - p.y, tgt.x - p.x);
    const spread = 0.18;
    for (let i = 0; i < projCount; i++) {
      const off = (i - (projCount - 1) / 2) * spread;
      this.fireProjectile(p.x, p.y, baseAng + off, s, true, s.homing || 0);
    }
    this.spawnMuzzle(p.x + Math.cos(baseAng) * 18, p.y + Math.sin(baseAng) * 18, baseAng, s.color);
  }

  weaponShockwave(s, dt) {
    const p = this.player; const rs = this.run.stats;
    p.shockwaveCD -= dt;
    const fr = s.fireRate * rs.fireRateMult;
    if (p.shockwaveCD > 0) return;
    p.shockwaveCD = 1 / fr;
    const r = (s.area || 180) * rs.areaMult;
    const baseDmg = s.damage * rs.damageMult;
    this.enemies.forEach(e => {
      if (dist2(e.x, e.y, p.x, p.y) <= r * r) {
        const dmg = this.rollDamage(baseDmg); // per-enemy crit roll
        this.dealDamage(e, dmg.dmg, dmg.crit, s.knockback || 0, p.x, p.y);
        if (s.bleedDot) e._burn = Math.max(e._burn || 0, 2); // Bleed Field fork
      }
    });
    // Visual ring
    this.spawnRing(p.x, p.y, r, s.color, 0.5);
    this.cam.shake = Math.max(this.cam.shake, 3);
  }

  weaponScythe(s, dt) {
    const p = this.player; const rs = this.run.stats;
    p.scytheCD -= dt;
    const fr = s.fireRate * rs.fireRateMult;
    if (p.scytheCD > 0) return;
    p.scytheCD = 1 / fr;
    const r = (s.area || 120) * rs.areaMult;
    const baseDmg = s.damage * rs.damageMult;
    const aimAng = Math.atan2(p.aimY, p.aimX);
    this.enemies.forEach(e => {
      const edx = e.x - p.x, edy = e.y - p.y;
      const ed = Math.hypot(edx, edy);
      if (ed > r) return;
      // Only hit enemies in the forward 180° arc (within 90° of aim direction)
      const eAng = Math.atan2(edy, edx);
      let da = eAng - aimAng;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      if (Math.abs(da) <= Math.PI * 0.55) {
        const dmg = this.rollDamage(baseDmg); // per-enemy crit roll
        this.dealDamage(e, dmg.dmg, dmg.crit, s.knockback || 0, p.x, p.y);
        if (s.bleedDot) e._burn = Math.max(e._burn || 0, 2); // Bleed Field fork
      }
    });
    // visual sweeping arc in aim direction
    this.spawnArc(p.x, p.y, r, s.color, aimAng);
  }

  weaponOrbit(s, dt) {
    const p = this.player; const rs = this.run.stats;
    const count = s.orbitCount || 2;
    const radius = (s.orbitRadius || 80) * rs.areaMult;
    const speed = (s.orbitSpeed || 2);
    const angBase = this.time * speed;
    // Damage check: for each orb, hit enemies within s.area each frame; cooldown per enemy via e.dz (damage zone cooldown small)
    const dmgPerSec = s.damage * rs.damageMult * 2; // tick rate baked in
    const tickDmg = dmgPerSec * dt;
    for (let i = 0; i < count; i++) {
      const a = angBase + (i / count) * TAU;
      const ox = p.x + Math.cos(a) * radius;
      const oy = p.y + Math.sin(a) * radius;
      const ar = (s.area || 24);
      this.enemies.forEach(e => {
        if (dist2(e.x, e.y, ox, oy) <= ar * ar) {
          this.dealDamage(e, tickDmg, false, 0, ox, oy, true);
          if (Math.random() < 0.2) this.spawnSpark(e.x, e.y, s.color);
        }
      });
    }
  }

  weaponBeam(s, dt) {
    const p = this.player; const rs = this.run.stats;
    p.beamCD -= dt;
    const fr = s.fireRate * rs.fireRateMult;
    if (p.beamCD > 0) {
      return;
    }
    p.beamCD = 1 / fr;
    const t = this.nearestEnemy(p.x, p.y, s.range || 320);
    p._beamTarget = t || null;
    if (t) {
      const dmg = this.rollDamage(s.damage * rs.damageMult);
      this.dealDamage(t, dmg.dmg, dmg.crit, 0, p.x, p.y, true);
      if (Math.random() < 0.4) this.spawnSpark(t.x, t.y, s.color);
    }
  }

  weaponMeteor(s, dt) {
    const p = this.player; const rs = this.run.stats;
    p.meteorCD -= dt;
    const fr = s.fireRate * rs.fireRateMult;
    if (p.meteorCD > 0) return;
    p.meteorCD = 1 / fr;
    const tgt = this.nearestEnemy(p.x, p.y, 500) || { x: p.x + rand(-200, 200), y: p.y + rand(-200, 200) };
    const tx = tgt.x + rand(-30, 30), ty = tgt.y + rand(-30, 30);
    const warn = this.parts.acquire();
    warn.x = tx; warn.y = ty; warn.vx = 0; warn.vy = 0;
    warn.life = 0.9; warn.max = 0.9; warn.color = s.color; warn.size = (s.area || 90) * rs.areaMult;
    warn.type = 'meteorMark';
    warn._dmg = s.damage * rs.damageMult;
    warn._radius = (s.area || 90) * rs.areaMult;
    warn._fallFrom = -420 + rand(-60, 60); // sky height above target
    warn._fallOffX = rand(-80, 80);         // angle from sky
  }

  weaponShotgun(s, dt) {
    const p = this.player; const rs = this.run.stats;
    if (p.reloading) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) { p.reloading = false; p.mag = (s.magazine || 6) + rs.magBonus; Audio.reload(); }
      return;
    }
    p.shootCD -= dt;
    if (p.mag === undefined || p.mag > (s.magazine || 6) + rs.magBonus) p.mag = (s.magazine || 6) + rs.magBonus;
    if (p.mag <= 0) { this.startReload(s); return; }
    if (this.input.shooting && p.shootCD <= 0) {
      const fr = s.fireRate * rs.fireRateMult;
      p.shootCD = 1 / fr;
      const baseAng = Math.atan2(p.aimY, p.aimX);
      const pellets = s.pellets || 5;
      const spread = (s.spread || 0.4) + 0.035 * this.aimSpreadMult();
      for (let i = 0; i < pellets; i++) {
        const off = (Math.random() - 0.5) * spread;
        this.fireProjectile(p.x + p.aimX * 14, p.y + p.aimY * 14, baseAng + off, s, true);
      }
      p.mag -= 1;
      this.cam.shake = Math.max(this.cam.shake, 3);
      Audio.shoot();
      this.spawnMuzzle(p.x + p.aimX * 22, p.y + p.aimY * 22, baseAng, s.color);
      if (p.mag <= 0) this.startReload(s);
    }
  }

  fireProjectile(x, y, ang, s, friendly = true, homing = 0) {
    const pr = this.projs.acquire();
    pr.x = x; pr.y = y;
    pr.vx = Math.cos(ang) * (s.projSpeed || 600);
    pr.vy = Math.sin(ang) * (s.projSpeed || 600);
    const dmg = this.rollDamage((s.damage || 10) * this.run.stats.damageMult, s.crit);
    pr.dmg = dmg.dmg; pr.crit = dmg.crit;
    pr.pierce = (s.pierce || 0) + this.run.stats.pierceBonus;
    pr.life = 1.6;
    pr.color = s.color || '#fff';
    pr.size = s.projSize || 6;
    pr.homing = homing;
    pr.knockback = s.knockback || 0;
    pr.explode = s.explode || 0;
    pr._weaponBehaviour = s._behaviour || 'projectile';
    pr._wid = s._wid || null;          // weapon id for custom render
    pr._wlvl = s._wlvl || 0;           // weapon level for visual scaling
    pr._ang = ang;                     // facing for sprite orientation
    pr.hit.clear();
    pr.friendly = friendly;

    // Elemental Rounds (Weaponsmith): cycle through this weapon's assigned
    // elements shot-by-shot within the same magazine, tinting the bolt to
    // match whichever element this particular shot carries.
    pr._element = null;
    if (friendly && pr._wid && this.weaponElements[pr._wid] && this.weaponElements[pr._wid].length) {
      const elems = this.weaponElements[pr._wid];
      this._elemCycleIdx = this._elemCycleIdx || {};
      const idx = (this._elemCycleIdx[pr._wid] || 0) % elems.length;
      this._elemCycleIdx[pr._wid] = idx + 1;
      pr._element = elems[idx];
      const edef = ELEMENTS.find(el => el.id === pr._element);
      if (edef) pr.color = edef.color;
    }
  }

  // Applies an element's on-hit effect to a struck enemy. Each element
  // reuses an existing combat mechanic where one already existed (fire =
  // the same _burn DoT tick as the Burn card, electric = the same
  // applyConductiveBounce chain as Conductive Rounds/Arc Tesla) rather than
  // building parallel systems.
  // ===== ORIGINAL SYSTEM 1/3: Elemental Combo Reactions =====
  // Landing a DIFFERENT element on a target that already has one active
  // triggers a bonus reaction — rewards mixing elemental weapons/artifacts
  // instead of each element just doing its own isolated thing. Gated by a
  // short per-enemy cooldown so it can't refire every single hit while both
  // effects happen to overlap for several seconds.
  checkElementalCombo(e, incomingId) {
    if ((e._comboCD || 0) > 0) return;
    const has = {
      fire: e._burn > 0, ice: e._slowT > 0,
      poison: e._poisonStacks > 0, void: e._voidVulnT > 0,
    };
    has[incomingId] = false; // the incoming hit itself doesn't count as "already active"
    const rs = this.run.stats;
    if (incomingId === 'ice' && has.fire) {
      // Shatter: the sudden thermal shock does a burst of bonus damage.
      e._comboCD = 2;
      this.dealDamage(e, 45 * rs.damageMult, false, 140, e.x, e.y, true);
      this.spawnRing(e.x, e.y, e.t.size * 1.1, '#bff0ff', 0.4);
      this.spawnDamageNumber(e.x, e.y - e.t.size * 0.6, 'SHATTER!', '#bff0ff', 15);
    } else if (incomingId === 'fire' && has.ice) {
      e._comboCD = 2;
      this.dealDamage(e, 45 * rs.damageMult, false, 140, e.x, e.y, true);
      this.spawnRing(e.x, e.y, e.t.size * 1.1, '#bff0ff', 0.4);
      this.spawnDamageNumber(e.x, e.y - e.t.size * 0.6, 'SHATTER!', '#bff0ff', 15);
    } else if (incomingId === 'electric' && has.poison) {
      // Toxic Overload: detonates all banked poison stacks at once + spreads
      // a stack to nearby foes instead of ticking out slowly.
      e._comboCD = 2;
      const stacks = e._poisonStacks || 1;
      this.dealDamage(e, 10 * stacks * rs.damageMult, false, 0, e.x, e.y, true);
      this.spawnRing(e.x, e.y, 90, '#7ad96b', 0.4);
      this.spawnDamageNumber(e.x, e.y - e.t.size * 0.6, 'TOXIC OVERLOAD!', '#7ad96b', 15);
      this.enemies.forEach(en => {
        if (en === e || !en.alive) return;
        if (dist2(en.x, en.y, e.x, e.y) <= 90 * 90) { en._poisonStacks = Math.min(8, (en._poisonStacks || 0) + 1); en._poisonT = 4; }
      });
    } else if (incomingId === 'fire' && has.poison) {
      // Combustion: banked poison stacks convert into one big burn tick.
      e._comboCD = 2;
      const stacks = e._poisonStacks || 1;
      e._poisonStacks = 0; e._poisonT = 0;
      this.dealDamage(e, 14 * stacks * rs.damageMult, false, 60, e.x, e.y, true);
      this.spawnRing(e.x, e.y, e.t.size * 1.0, '#ff7a1a', 0.4);
      this.spawnDamageNumber(e.x, e.y - e.t.size * 0.6, 'COMBUSTION!', '#ff7a1a', 15);
    } else if (incomingId === 'void' && (has.fire || has.ice || has.poison)) {
      // Unstable Rift: void amplifies whatever other element is already
      // active by extending the vulnerability window further.
      e._comboCD = 2;
      e._voidVulnT = 3.5; e._voidVulnMult = 1.6;
      this.spawnRing(e.x, e.y, e.t.size * 1.2, '#b362ff', 0.5);
      this.spawnDamageNumber(e.x, e.y - e.t.size * 0.6, 'UNSTABLE RIFT!', '#b362ff', 15);
    }
  }

  applyElementalEffect(e, elementId, dmg) {
    if (!e.alive) return;
    this.checkElementalCombo(e, elementId);
    if (elementId === 'fire') {
      e._burn = Math.max(e._burn || 0, 3);
    } else if (elementId === 'ice') {
      e._slowT = Math.max(e._slowT || 0, 1.5);
      e._slowMult = 0.5;
    } else if (elementId === 'electric') {
      this.applyConductiveBounce(e.x, e.y, dmg, 1, new Set([e]));
    } else if (elementId === 'poison') {
      e._poisonStacks = Math.min(8, (e._poisonStacks || 0) + 1);
      e._poisonT = 4;
      if (Math.random() < 0.3) this.spawnSpark(e.x, e.y, '#7ad96b');
    } else if (elementId === 'void') {
      // No enemy "armor" defense stat currently reduces incoming damage
      // anywhere in dealDamage (checked — it's an unused ENEMIES field), so
      // "shred armor" would be a no-op; instead Void directly marks the
      // target more vulnerable for a moment, consumed in dealDamage's own
      // damage-multiplier step below.
      e._voidVulnT = 2;
      e._voidVulnMult = 1.3;
      this.spawnRing(e.x, e.y, e.t.size * 0.7, '#b362ff', 0.3);
    }
  }

  rollDamage(base, baseCrit) {
    const p = this.player; const s = this.run.stats;
    let dmg = base;
    if (s.berserk && p.hp < p.maxHp * 0.3) dmg *= 1.4;
    const f = s.flags || {};
    if (f.railStance && (p._stillT || 0) >= 1.0) dmg *= 1.6;
    if (f.overcharge) {
      p._overchargeN = (p._overchargeN || 0) + 1;
      if (p._overchargeN % 6 === 0) dmg *= 2.0;
    }
    if (f.doubleHit && Math.random() < 0.20) dmg *= 2.0;
    const c = (baseCrit || 0) + s.crit;
    const isCrit = Math.random() < c;
    let critTier = 0;
    if (isCrit) {
      critTier = 1;
      if ((s.superCritChance || 0) > 0 && Math.random() < s.superCritChance) critTier = 2;
      if (critTier >= 2 && (s.megaCritChance || 0) > 0 && Math.random() < s.megaCritChance) critTier = 3;
    }
    const critMults = [1, s.critDmgMult, s.critDmgMult * 2.0, s.critDmgMult * 3.5];
    if (isCrit) dmg *= critMults[critTier];
    s._lastCritTier = critTier;
    return { dmg: Math.floor(dmg), crit: isCrit, critTier };
  }

  // ====== ENEMIES ======
  spawnWave(dt) {
    if (this.over) return;
    const w = waveAt(this.run.time);
    this.spawnTimer += dt;
    const spawnInterval = 1 / (w.spawn * (this.spawnMultExtra || 1));
    while (this.spawnTimer >= spawnInterval) {
      this.spawnTimer -= spawnInterval;
      const n = 1 + (Math.random() < (this.run.time / 600) ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const type = w.types[randi(0, w.types.length)];
        this.spawnEnemy(type);
      }
    }
  }

  spawnEnemy(typeId) {
    const t = ENEMIES[typeId]; if (!t) return;
    const p = this.player;
    // spawn ring just outside view
    const ang = Math.random() * TAU;
    const dist = Math.max(this.W, this.H) * 0.42 + rand(20, 60);
    const x = clamp(p.x + Math.cos(ang) * dist, 30, this.world.w - 30);
    const y = clamp(p.y + Math.sin(ang) * dist, 30, this.world.h - 30);
    const e = this.enemies.acquire();
    e.x = x; e.y = y; e.vx = 0; e.vy = 0;
    e.t = t;
    const scale = 1 + this.run.time / 240; // gradual scale
    e.dmgMult = 1 + this.bossesKilled * 2.0; // ~3x after boss 1, scales hard
    if (SQUARE_ENEMY_TYPES.has(typeId)) e.dmgMult *= 2.5; // brute/charger/necron/steelbrute hit harder
    // Tier escalation (task: T1..T5+, one boss kill = one tier up, keeps
    // climbing indefinitely for a long endless). Speed/HP grow WITH the
    // existing damage/time scaling above rather than replacing it, and the
    // per-tier steps are deliberately mild (12%/25%) since dmgMult already
    // scales hard — stacking two harsh curves would make the game unplayable
    // past tier 3, which contradicts "never so strong you can facetank it".
    e.tier = this.bossesKilled + 1;
    // Baseline pace lifted 12%: the game read noticeably more sluggish after
    // the player's agility/aim attributes were rebased down by a third, and
    // enemy speed had never been adjusted to match.
    e.speedMult = 1.12 * (1 + this.bossesKilled * 0.12);
    e.maxHp = Math.floor(t.hp * scale * 3 * (1 + this.bossesKilled * 0.25));
    e.hp = e.maxHp;
    e.hit = 0; e.cd = 0; e.dz = 0;
    e.kbX = 0; e.kbY = 0;
    e._woundStage = 0; e._wounds.length = 0;
    // Melee-strike state — pooled objects keep whatever the previous
    // occupant left behind, so a recycled enemy could otherwise spawn
    // mid-windup or permanently unable to attack.
    e._windup = 0; e._strikeT = 0; e._atkCD = rand(0.6, 2.0);
    e._atkDX = 0; e._atkDY = 0;
    e._lunging = false; e._lungeT = 0;
  }

  // ====== DOCK STATION ======
  // A structure that spawns randomly on the map. Standing inside its radius
  // fills a ring over ~4.5s; leaving early lets it drain back down (roughly
  // twice as fast as it fills) rather than resetting instantly, so a brief
  // step-out to dodge a hit doesn't waste the whole attempt. Completing it
  // grants one random bonus, then a new station appears elsewhere after a
  // cooldown — a recurring map objective to route toward between wave chaos,
  // per the genre's "constant small reward" cadence (see
  // survivor-bullethell-design skill).
  updateDockStation(dt) {
    if (!this.dockStation) {
      this._nextDockStationAt -= dt;
      if (this._nextDockStationAt <= 0) this.spawnDockStation();
      return;
    }
    const st = this.dockStation;
    const p = this.player;
    const inRange = dist2(p.x, p.y, st.x, st.y) <= st.r * st.r;
    if (inRange) {
      st.progress = Math.min(1, st.progress + dt / 4.5);
      st.charging = true;
    } else {
      st.progress = Math.max(0, st.progress - dt / 2.2);
      st.charging = false;
    }
    if (st.progress >= 1) this.completeDockStation();
  }

  spawnDockStation() {
    const p = this.player;
    const ang = Math.random() * TAU;
    // Far enough to require real travel, not so far it's never reachable
    // relative to the current view.
    const dist = Math.max(this.W, this.H) * (0.55 + Math.random() * 0.5);
    const x = clamp(p.x + Math.cos(ang) * dist, 80, this.world.w - 80);
    const y = clamp(p.y + Math.sin(ang) * dist, 80, this.world.h - 80);
    this.dockStation = { x, y, r: 46, progress: 0, charging: false };
  }

  completeDockStation() {
    const st = this.dockStation;
    if (!st) return;
    const p = this.player;
    const roll = Math.random();
    let label = '';
    if (roll < 0.35) {
      // Random in-run stat buff, same code path as a level-up stat card —
      // stays balanced against the exact same pool the player already knows.
      const s = STAT_CARDS[randi(0, STAT_CARDS.length)];
      const rar = rollRarity(this.run.stats.luck);
      this.applyCardChoice({ kind: 'stat', statId: s.id, statRef: s, multiplier: RARITY[rar].mult });
      label = '+' + RARITY[rar].name + ' ' + this.statName(s.stat).toUpperCase();
    } else if (roll < 0.62) {
      const heal = Math.floor(p.maxHp * 0.5);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      label = '+' + heal + ' HP';
    } else if (roll < 0.90) {
      for (const k of Object.keys(this.skillCD)) this.skillCD[k] = 0;
      label = 'SKILLS RESET';
    } else {
      // Rare: an extra guaranteed card pick, uncapped by the normal luck roll.
      this.levelUpQueue += 1;
      label = 'BONUS CARD';
    }
    Audio.levelUp();
    this.cam.shake = Math.max(this.cam.shake, 6);
    this.spawnRing(st.x, st.y, 70, '#4dffe0', 0.5);
    this.spawnRing(st.x, st.y, 40, '#ffffff', 0.35);
    this.spawnDamageNumber(st.x, st.y - 30, label, '#4dffe0', 15);
    this.dockStation = null;
    this._nextDockStationAt = rand(55, 95);
  }

  updateTidalShrine(dt) {
    if (!this.tidalShrine) {
      this._nextShrineAt -= dt;
      if (this._nextShrineAt <= 0) this.spawnTidalShrine();
      return;
    }
    const sh = this.tidalShrine;
    const p = this.player;
    const inRange = dist2(p.x, p.y, sh.x, sh.y) <= sh.r * sh.r;
    if (inRange) {
      sh.channelT += dt;
      sh.summonCD -= dt;
      if (sh.summonCD <= 0) {
        // Pull in 2-3 enemies to actively pressure the channel — the risk
        // half of the risk/reward, not just a passive timer.
        sh.summonCD = 3;
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const e = this.enemies.acquire();
          e.x = sh.x + Math.cos(a) * (sh.r + 40); e.y = sh.y + Math.sin(a) * (sh.r + 40);
          e.vx = 0; e.vy = 0; e.t = ENEMIES.ghoul;
          e.maxHp = 40; e.hp = 40; e.hit = 0; e.cd = 0; e.dz = 0; e.kbX = 0; e.kbY = 0;
          e.tier = this.bossesKilled + 1; e.speedMult = 1 + this.bossesKilled * 0.12;
        }
      }
      if (sh.channelT >= 10) { this.completeTidalShrine(); return; }
    } else if (sh.channelT > 0) {
      // Leaving resets the channel instantly — real risk, unlike the Dock
      // Station's forgiving gradual drain.
      sh.channelT = 0;
      this.spawnDamageNumber(sh.x, sh.y - 30, 'CHANNEL BROKEN!', '#ff3146', 16);
    }
  }

  spawnTidalShrine() {
    const p = this.player;
    const ang = Math.random() * TAU;
    const dist = Math.max(this.W, this.H) * (0.6 + Math.random() * 0.5);
    const x = clamp(p.x + Math.cos(ang) * dist, 90, this.world.w - 90);
    const y = clamp(p.y + Math.sin(ang) * dist, 90, this.world.h - 90);
    this.tidalShrine = { x, y, r: 60, channelT: 0, summonCD: 3 };
  }

  completeTidalShrine() {
    const sh = this.tidalShrine;
    if (!sh) return;
    const p = this.player;
    const roll = Math.random();
    let label = '';
    if (roll < 0.30) {
      // A guaranteed weapon-fork-tier choice screen, but as an EXTRA
      // level-up card pick rather than gated behind reaching level 5.
      this.levelUpQueue += 2;
      label = '2 BONUS CARDS';
    } else if (roll < 0.55) {
      const heal = p.maxHp; // full heal, much stronger than Dock Station's 50%
      p.hp = Math.min(p.maxHp, p.hp + heal);
      p.shieldCharge = 1; p.shieldCD = 0;
      label = 'FULL HEAL + SHIELD';
    } else if (roll < 0.80) {
      this.run.stats.damageMult *= 1.15;
      label = '+15% DAMAGE (PERMANENT)';
    } else {
      // Guaranteed gear drop (vs. the normal 8%-per-kill chance) at boosted
      // boss-tier rarity odds (see gear.js rollGearDrop's isBoss param).
      this._pendingGearDrop = { timeInRun: this.run.time, boss: true };
      label = 'BLESSED GEAR DROP';
    }
    Audio.levelUp();
    this.cam.shake = Math.max(this.cam.shake, 10);
    this.spawnRing(sh.x, sh.y, 120, '#1fb6ff', 0.6);
    this.spawnRing(sh.x, sh.y, 70, '#ffffff', 0.4);
    this.spawnDamageNumber(sh.x, sh.y - 40, 'SHRINE BLESSING: ' + label, '#1fb6ff', 16);
    this.tidalShrine = null;
    this._nextShrineAt = rand(150, 210);
  }

  spawnBoss(typeId) {
    const t = ENEMIES[typeId]; if (!t) return;
    const p = this.player;
    const ang = Math.random() * TAU;
    const dist = Math.max(this.W, this.H) * 0.42;
    const e = this.enemies.acquire();
    // Clamp to world bounds so the boss always spawns on the actual map —
    // otherwise the guide arrow can point at an unreachable off-map location.
    e.x = clamp(p.x + Math.cos(ang) * dist, 60, this.world.w - 60);
    e.y = clamp(p.y + Math.sin(ang) * dist, 60, this.world.h - 60);
    e.t = t;
    e.maxHp = Math.floor(t.hp * 3 * (1 + this.run.time / 600));
    e.hp = e.maxHp;
    e.hit = 0; e.cd = 0; e.dz = 0; e.kbX = 0; e.kbY = 0;
    e._woundStage = 0; e._wounds.length = 0;
    // Reset boss-specific state flags so recycled pool objects start clean
    e._hasFleed = false; e._fleeing = false; e._fleeTimer = 0;
    e._summonCD = undefined; e._voidCD = undefined;
    this.bossActive = e;
    this.cam.shake = 18;
    this.cam.slowmo = 0.6;
    this.spawnDamageNumber(p.x, p.y - 60, t.name.toUpperCase() + '!', t.color || '#fff');
  }

  updateEnemies(dt) {
    const p = this.player;
    const slowMul = this._timewarpT > 0 ? 0.35 : ((this.run.stats.flags || {}).slowField ? 0.7 : 1);
    this.enemies.forEach(e => {
      if (!e.alive) return;
      const t = e.t;
      // Warden guard cycle: vulnerable (swipe-attack executable) for the
      // last 2s of every 6s — telegraphed visually in pixiRenderer.
      if (t.id === 'swipeWarden') {
        e._vulnCycle = ((e._vulnCycle || 0) + dt) % 6;
        e._swipeVulnerable = e._vulnCycle >= 4;
      }
      // Elemental status ticks (Ice/Poison/Void from Weaponsmith Elemental
      // Rounds and elemental artifacts — see applyElementalEffect).
      if (e._slowT > 0) { e._slowT -= dt; if (e._slowT <= 0) e._slowMult = 1; }
      if (e._voidVulnT > 0) e._voidVulnT -= dt;
      if (e._poisonT > 0) {
        e._poisonT -= dt;
        e._poisonAcc = (e._poisonAcc || 0) + dt;
        if (e._poisonAcc >= 0.5) {
          e._poisonAcc = 0;
          const stacks = e._poisonStacks || 1;
          this.dealDamage(e, 3 * stacks * this.run.stats.damageMult, false, 0, e.x, e.y, true);
          if (Math.random() < 0.4) this.spawnSpark(e.x, e.y, '#7ad96b');
        }
        if (e._poisonT <= 0) e._poisonStacks = 0;
      }
      if (t.ai === 'decoy' || e._decoy !== undefined) {
        // decoys absorb projectiles, drain timer
        e._decoy -= dt;
        if (e._decoy <= 0) this.killEnemy(e);
        return;
      }
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      if (e._blightBuffT > 0) { e._blightBuffT -= dt; if (e._blightBuffT <= 0) e._blightSpeedBuff = 1; }
      let spd = t.speed * slowMul * (e._slowT > 0 ? (e._slowMult || 1) : 1) * (e.speedMult || 1) * (e._blightSpeedBuff || 1);
      if (t.ai === 'ranged') {
        if (d < (t.shootRange || 320) - 50) spd = -spd * 0.6;
        else if (d < (t.shootRange || 320) + 20) spd = 0;
        e.cd -= dt;
        if (e.cd <= 0 && d < (t.shootRange || 320) + 60) {
          e.cd = (t.shootCD || 2);
          const ep = this.eprojs.acquire();
          ep.x = e.x; ep.y = e.y;
          ep.vx = nx * (t.projSpeed || 300);
          ep.vy = ny * (t.projSpeed || 300);
          ep.dmg = t.dmg * (e.dmgMult || 1) * 0.95;
          ep.life = 2.5;
          ep.color = t.color;
          ep.size = 5;
          ep.homing = 0; // pooled object — clear any stale homing from a previous Sentinel Prime missile
        }
      } else if (t.ai === 'charge') {
        e.cd -= dt;
        if (e.cd <= 0 && d < 240) { e.cd = 2.5; e.kbX = nx * 380; e.kbY = ny * 380; }
        spd *= (Math.random() < 0.3 ? 1.2 : 1.0);
      } else if (t.ai === 'boss') {
        e.cd -= dt;
        if (e.cd <= 0 && d < 800) {
          e.cd = t.shootCD || 1.2;
          // shoot triple burst
          const baseAng = Math.atan2(ny, nx);
          for (let i = -1; i <= 1; i++) {
            const a = baseAng + i * 0.25;
            const ep = this.eprojs.acquire();
            ep.x = e.x; ep.y = e.y;
            ep.vx = Math.cos(a) * 280;
            ep.vy = Math.sin(a) * 280;
            ep.dmg = t.dmg * (e.dmgMult || 1) * 0.6;
            ep.life = 3.5;
            ep.color = t.color;
            ep.size = 7;
            ep.homing = 0;
          }
        }
      }

      // === Eye of Horus: flyr vid 50% HP ===
      if (t.id === 'bossOcular') {
        if (!e._hasFleed && e.hp < e.maxHp * 0.5) {
          e._hasFleed = true; e._fleeing = true; e._fleeTimer = 15;
          this.spawnDamageNumber(e.x, e.y - 35, 'FLEES!', '#ffd166');
          this.cam.shake = 10;
        }
        if (e._fleeing) {
          e._fleeTimer -= dt;
          if (e._fleeTimer <= 0) {
            e._fleeing = false;
            const retAng = Math.random() * TAU;
            const retDist = Math.max(this.W, this.H) * 0.75;
            e.x = p.x + Math.cos(retAng) * retDist;
            e.y = p.y + Math.sin(retAng) * retDist;
            e.kbX = 0; e.kbY = 0;
            this.spawnDamageNumber(e.x, e.y - 35, 'RETURNS!', '#ff3146');
          } else {
            const fdx = e.x - p.x, fdy = e.y - p.y;
            const fd = Math.hypot(fdx, fdy) || 1;
            e.x += (fdx / fd) * t.speed * 2.8 * dt;
            e.y += (fdy / fd) * t.speed * 2.8 * dt;
            e.hit = Math.max(0, e.hit - dt);
            return; // skip normal movement + player collision
          }
        }
      }

      // === Nekromansen: kallar in skelettar ===
      if (t.id === 'bossNecromancer') {
        e._summonCD = (e._summonCD !== undefined ? e._summonCD : 5) - dt;
        if (e._summonCD <= 0) {
          e._summonCD = 6;
          for (let si = 0; si < 3; si++) {
            const sa = Math.random() * TAU;
            const sm = this.enemies.acquire();
            sm.x = e.x + Math.cos(sa) * 70; sm.y = e.y + Math.sin(sa) * 70;
            sm.t = ENEMIES.ghoul; sm.maxHp = 45; sm.hp = 45;
            sm.hit = 0; sm.cd = 0; sm.dz = 0; sm.kbX = 0; sm.kbY = 0;
          }
          this.spawnDamageNumber(e.x, e.y - 42, 'RISE!', '#7ad96b');
          this.cam.shake = Math.max(this.cam.shake, 4);
        }
      }

      // === Void Titan: spiralskjuter void-orbs ===
      if (t.id === 'bossVoidTitan') {
        e._voidCD = (e._voidCD !== undefined ? e._voidCD : 2) - dt;
        if (e._voidCD <= 0) {
          e._voidCD = 2.2;
          for (let vi = 0; vi < 6; vi++) {
            const va = (vi / 6) * TAU + this.time * 0.4;
            const evp = this.eprojs.acquire();
            evp.x = e.x; evp.y = e.y;
            evp.vx = Math.cos(va) * 155; evp.vy = Math.sin(va) * 155;
            evp.dmg = t.dmg * 0.45; evp.life = 5.5; evp.color = '#b362ff'; evp.size = 11; evp.homing = 0;
          }
        }
      }

      // === The Tidebreaker: telegraphed ground slam + strafeable bullet fan ===
      if (t.id === 'bossTidebreaker') {
        e._slamCD = (e._slamCD !== undefined ? e._slamCD : 3.5) - dt;
        if (e._slamCD <= 0) {
          e._slamCD = 4.5;
          const warn = this.parts.acquire();
          warn.x = p.x; warn.y = p.y; warn.vx = 0; warn.vy = 0;
          warn.life = 1.1; warn.max = 1.1; warn.type = 'bossSlamWarn';
          warn._radius = 130; warn._dmg = t.dmg * (e.dmgMult || 1) * 2.2;
          this.spawnDamageNumber(e.x, e.y - 48, 'TIDAL SLAM!', '#1fb6ff');
        }
        e._fanCD = (e._fanCD !== undefined ? e._fanCD : 1.6) - dt;
        if (e._fanCD <= 0) {
          e._fanCD = 3.0;
          const baseAng = Math.atan2(p.y - e.y, p.x - e.x);
          for (let fi = -3; fi <= 3; fi++) {
            const a = baseAng + fi * 0.16;
            const evp = this.eprojs.acquire();
            evp.x = e.x; evp.y = e.y;
            evp.vx = Math.cos(a) * 240; evp.vy = Math.sin(a) * 240;
            evp.dmg = t.dmg * (e.dmgMult || 1) * 0.4; evp.life = 3.5; evp.color = '#1fb6ff'; evp.size = 8; evp.homing = 0;
          }
        }
      }

      // === Sentinel Prime: 3 HP-gated phases, each a different pattern ===
      if (t.id === 'bossSentinel') {
        const hpPct = e.hp / e.maxHp;
        const phase = hpPct > 0.66 ? 1 : hpPct > 0.33 ? 2 : 3;
        if (e._phase !== phase) {
          e._phase = phase;
          this.spawnDamageNumber(e.x, e.y - 50, phase === 2 ? 'TURRETS ONLINE' : phase === 3 ? 'OVERDRIVE!' : 'PHASE 1', '#44aaff');
          this.cam.shake = Math.max(this.cam.shake, 10);
          this.spawnRing(e.x, e.y, t.size * 0.9, '#44aaff', 0.6);
          if (phase === 2) {
            for (let ti = 0; ti < 2; ti++) {
              const ta = (ti === 0 ? -1 : 1) * 1.1;
              const tx = e.x + Math.cos(ta) * 160, ty = e.y + Math.sin(ta) * 160;
              const turret = this.enemies.acquire();
              turret.x = clamp(tx, 20, this.world.w - 20); turret.y = clamp(ty, 20, this.world.h - 20);
              turret.vx = 0; turret.vy = 0; turret.t = ENEMIES.ranger;
              turret.maxHp = 90; turret.hp = 90; turret.hit = 0; turret.cd = 0; turret.dz = 0;
              turret.kbX = 0; turret.kbY = 0; turret.dmgMult = e.dmgMult;
            }
          }
        }
        if (phase === 1) {
          e._sweepAngle = (e._sweepAngle || 0) + dt * 1.6;
          e._laserCD = (e._laserCD !== undefined ? e._laserCD : 0.15) - dt;
          if (e._laserCD <= 0) {
            e._laserCD = 0.09;
            const evp = this.eprojs.acquire();
            evp.x = e.x; evp.y = e.y;
            evp.vx = Math.cos(e._sweepAngle) * 260; evp.vy = Math.sin(e._sweepAngle) * 260;
            evp.dmg = t.dmg * (e.dmgMult || 1) * 0.28; evp.life = 2.2; evp.color = '#9fe0ff'; evp.size = 6; evp.homing = 0;
          }
        } else if (phase === 3) {
          e._missileCD = (e._missileCD !== undefined ? e._missileCD : 1.8) - dt;
          if (e._missileCD <= 0) {
            e._missileCD = 1.8;
            for (let mi = 0; mi < 3; mi++) {
              const ma = Math.atan2(p.y - e.y, p.x - e.x) + (mi - 1) * 0.4;
              const evp = this.eprojs.acquire();
              evp.x = e.x; evp.y = e.y;
              evp.vx = Math.cos(ma) * 130; evp.vy = Math.sin(ma) * 130;
              evp.dmg = t.dmg * (e.dmgMult || 1) * 0.5; evp.life = 4.5; evp.color = '#ff3146'; evp.size = 9;
              evp.homing = 2.2;
            }
          }
        }
      }

      // === The Hollow Queen: swarm adds + telegraphed lunge + molt shield ===
      if (t.id === 'bossHollowQueen') {
        e._swarmCD = (e._swarmCD !== undefined ? e._swarmCD : 4) - dt;
        if (e._swarmCD <= 0 && !e._molting) {
          e._swarmCD = 6;
          for (let bi = 0; bi < 3; bi++) {
            const ba = Math.random() * TAU;
            const b = this.enemies.acquire();
            b.x = e.x + Math.cos(ba) * 60; b.y = e.y + Math.sin(ba) * 60;
            b.vx = 0; b.vy = 0; b.t = ENEMIES.bat;
            b.maxHp = 30; b.hp = 30; b.hit = 0; b.cd = 0; b.dz = 0; b.kbX = 0; b.kbY = 0;
            b.dmgMult = e.dmgMult;
          }
          this.spawnDamageNumber(e.x, e.y - 44, 'SWARM CALL', '#8a3fd4');
        }
        e._moltCD = (e._moltCD !== undefined ? e._moltCD : 8) - dt;
        if (!e._molting && e._moltCD <= 0) {
          e._molting = true; e._moltT = 2.5;
          this.spawnDamageNumber(e.x, e.y - 44, 'MOLTING...', '#8a3fd4');
          this.cam.shake = Math.max(this.cam.shake, 6);
        }
        if (e._molting) {
          e._moltT -= dt;
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
          if (e._moltT <= 0) {
            e._molting = false; e._moltCD = 9;
            this.spawnRing(e.x, e.y, t.size * 1.4, '#8a3fd4', 0.5);
            if (dist2(e.x, e.y, p.x, p.y) <= (t.size * 1.4) ** 2 && p.iframes <= 0 && Math.random() > this.run.stats.dodge) {
              p.hp -= Math.max(1, t.dmg * (e.dmgMult || 1) * 0.6 - this.run.stats.armor);
              p.hit = 0.15; p.iframes = 0.3;
            }
          }
          e.hit = Math.max(0, e.hit - dt);
          return; // invulnerable + rooted while molting — skip movement/lunge
        }
        e._lungeCD = (e._lungeCD !== undefined ? e._lungeCD : 3) - dt;
        if (!e._lunging && e._lungeCD <= 0) {
          e._lunging = true; e._lungeWindup = 0.55; e._lungeTargetX = p.x; e._lungeTargetY = p.y;
        }
        if (e._lunging) {
          if (e._lungeWindup > 0) {
            e._lungeWindup -= dt;
            this.spawnRing(e.x, e.y, t.size * 0.55, '#ff3146', 0.15);
          } else {
            const ldx = e._lungeTargetX - e.x, ldy = e._lungeTargetY - e.y, ld = Math.hypot(ldx, ldy);
            if (ld < 14 || (e._lungeT = (e._lungeT || 0) + dt) > 0.5) {
              e._lunging = false; e._lungeT = 0; e._lungeCD = 5;
            } else {
  e.x += (ldx / (ld || 1)) * 520 * dt;
              e.y += (ldy / (ld || 1)) * 520 * dt;
            }
            e.x = clamp(e.x, 20, this.world.w - 20);
            e.y = clamp(e.y, 20, this.world.h - 20);
            // Don't `return` here — the shared collision-with-player check
            // below is exactly what makes the lunge deal contact damage, so
            // it must still run this frame. Zero out spd instead so the
            // shared chase-movement line just below becomes a no-op on top
            // of the dash position we already set.
            spd = 0;
          }
        }
      }

      // === Blight Weaver: support miniboss — periodically heals + speeds
      // up nearby enemies, giving it a real reason to be prioritized/killed
      // first instead of just being a reskinned regular chaser. ===
      if (t.id === 'blightWeaver') {
        e._weaveCD = (e._weaveCD !== undefined ? e._weaveCD : 5) - dt;
        if (e._weaveCD <= 0) {
          e._weaveCD = 5;
          let buffed = 0;
          this.enemies.forEach(en => {
            if (en === e || !en.alive || en.t.boss) return;
            if (dist2(en.x, en.y, e.x, e.y) <= 160 * 160) {
              en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.25);
              // Separate multiplicative field from the tier-based e.speedMult
              // (spawnEnemy) so repeated buffs refresh the duration instead of
              // compounding 1.15x every 5s forever — decayed back to 1 in
              // updateEnemies' per-enemy tick once _blightBuffT runs out.
              en._blightSpeedBuff = 1.15;
              en._blightBuffT = 6;
              buffed++;
            }
          });
          if (buffed > 0) this.spawnRing(e.x, e.y, 160, '#7ad96b', 0.35);
        }
      }

      // ---- Melee strike ------------------------------------------------
      // Plain melee enemies used to have no attack at all: they walked into
      // you and the shared contact check below did the rest, which is why a
      // crowd read as a slow tide rather than a fight. They now commit to a
      // real strike — plant, wind up with a visible tell, then lunge — so
      // there is something to dodge and a moment where backing off wins.
      // Skipped for ranged/boss AI and for anything already doing its own
      // scripted lunge.
      const meleeAI = t.ai !== 'ranged' && t.ai !== 'boss' && !e._lunging;
      if (meleeAI) {
        e._atkCD = (e._atkCD !== undefined ? e._atkCD : rand(0.6, 2.0)) - dt;
        const reach = (t.size / 2) + p.r + 30;
        if (e._windup > 0) {
          e._windup -= dt;
          spd = -spd * 0.25;      // rock back onto the trailing foot
          if (e._windup <= 0) {
            // Strike: commit along the direction locked in at wind-up start,
            // so a player who moved after the tell can be missed entirely.
            e.kbX += (e._atkDX || nx) * 620;
            e.kbY += (e._atkDY || ny) * 620;
            e._strikeT = 0.18;
            e._atkCD = rand(1.5, 2.6);
            const sa = this.parts.acquire();
            sa.x = e.x + (e._atkDX || nx) * t.size * 0.5;
            sa.y = e.y + (e._atkDY || ny) * t.size * 0.5;
            sa.vx = 0; sa.vy = 0;
            sa.life = 0.2; sa.max = 0.2; sa.color = t.color;
            sa.size = t.size * 0.85; sa.type = 'arc';
            sa._ang = Math.atan2(e._atkDY || ny, e._atkDX || nx);
          }
        } else if (e._strikeT > 0) {
          e._strikeT -= dt;
          spd = 0;                // the lunge is carried entirely by knockback
        } else if (e._atkCD <= 0 && d < reach) {
          e._windup = 0.34;
          e._atkDX = nx; e._atkDY = ny;
          spd = 0;
        }
      }

      e.x += nx * spd * dt + e.kbX * dt;
      e.y += ny * spd * dt + e.kbY * dt;
      e.x = clamp(e.x, 20, this.world.w - 20);
      e.y = clamp(e.y, 20, this.world.h - 20);
      e.kbX *= Math.pow(0.001, dt);
      e.kbY *= Math.pow(0.001, dt);
      // separation - mild
      // collision with player
      const sumR = (t.size / 2) + p.r;
      if (d < sumR + 4 && (this.run.stats.flags || {}).venomBite) {
        e._venomCD = (e._venomCD || 0) - dt;
        if (e._venomCD <= 0) {
          e._venomCD = 1.0;
          e._poisonStacks = Math.min(8, (e._poisonStacks || 0) + 1);
          e._poisonT = 4;
          this.spawnSpark(e.x, e.y, '#7ad96b');
        }
      }
      if (d < sumR + 4 && p.iframes <= 0) {
        if (p.shieldCharge > 0) {
          p.shieldCharge = 0; p.shieldCD = 25;
          p.iframes = 0.7;
          this.spawnRing(p.x, p.y, 40, '#4dffd4', 0.4);
          this.spawnDamageNumber(p.x, p.y - 10, 'BLOCK', '#4dffd4');
          this.cam.shake = Math.max(this.cam.shake, 3);
        } else if (Math.random() > this.run.stats.dodge) {
          const f = this.run.stats.flags || {};
          const dmg = Math.max(1, t.dmg * (e.dmgMult || 1) - this.run.stats.armor);
          // Reflect
          if (f.reflect) { this.dealDamage(e, dmg * 0.3, false, 0, p.x, p.y, true); }
          // Grit damage reduction
          const reduce = f.grit && (p._gritT || 0) > this.run.time ? 0.7 : 1.0;
          p.hp -= dmg * reduce;
          if (f.grit) p._gritT = this.run.time + 2;
          this.run.noHit = false;
          p.hit = 0.15;
          p.iframes = 0.5;
          if (p._reflectTimer > 0) { this.dealDamage(e, dmg * 0.6, true, 0, p.x, p.y, true); }
          this.cam.shake = Math.max(this.cam.shake, 5);
          this.spawnHitBurst(p.x, p.y, '#b51d28', 18);
          Audio.hit();
        } else {
          this.spawnDamageNumber(p.x, p.y - 10, 'DODGE', '#4dffd4');
        }
      }
      e.hit = Math.max(0, e.hit - dt);
    });
  }

  updateProjs(dt) {
    this.projs.forEach(pr => {
      if (!pr.alive) return;
      // homing
      if (pr.homing > 0) {
        const tgt = this.nearestEnemy(pr.x, pr.y, 320);
        if (tgt) {
          const ang = Math.atan2(tgt.y - pr.y, tgt.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          const sp = Math.hypot(pr.vx, pr.vy);
          let na = cur;
          let da = ang - cur;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          na = cur + clamp(da, -pr.homing * 6, pr.homing * 6);
          pr.vx = Math.cos(na) * sp;
          pr.vy = Math.sin(na) * sp;
        }
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0) { this.projs.release(pr); return; }

      // collision with enemies — broadphase first, exact circle test after
      this.enemyGrid.query(pr.x, pr.y, this._maxEnemyR + pr.size, e => {
        if (!pr.alive || !e.alive) return;
        if (pr.hit.has(e)) return;
        const sumR = e.t.size / 2 + pr.size;
        if (dist2(pr.x, pr.y, e.x, e.y) <= sumR * sumR) {
          this.dealDamage(e, pr.dmg, pr.crit, pr.knockback, pr.x, pr.y, false, pr.color);
          this.spawnHitBurst(pr.x, pr.y, pr.color || e.t.color, 8);
          if (pr._element) {
            const bonus = 1 + (this.run.stats.elementalDmg || 0);
            this.applyElementalEffect(e, pr._element, pr.dmg * bonus);
          }
          if (pr._wid === 'stormLance') {
            // Storm Lance: a real bolt visibly strikes down from the sky
            // onto the target on impact, not just a hit-spark.
            this.spawnLightning(e.x, e.y - 220, e.x, e.y, pr.color || '#fff44d');
            this.cam.shake = Math.max(this.cam.shake, 3);
          }
          pr.hit.add(e);
          // Conductive Rounds passive: plain bullet-type hits (not
          // orbit/aoe/beam/chain weapons, which already have their own
          // multi-target mechanics) can arc to nearby enemies.
          const bounces = Math.floor(this.run.stats.conductiveBounces || 0);
          if (bounces > 0 && pr._weaponBehaviour === 'projectile') {
            this.applyConductiveBounce(e.x, e.y, pr.dmg, bounces, new Set([e]));
          }
          if (pr.pierce <= 0) {
            if (pr.explode > 0) this.explodeProjectile(pr);
            this.projs.release(pr); return;
          }
          pr.pierce -= 1;
        }
      });
    });
  }

  // Conductive Rounds: chases up to `bouncesLeft` additional enemies from
  // (x,y), each one closer-range and 25%+ of the original hit's damage
  // (ratio climbs slightly with more stacked picks). Reuses the exact same
  // jagged 'lightning' particle + falloff pattern as the Arc Tesla/Chain
  // Lightning weapons' weaponChain() for a consistent "real electricity"
  // look (see waterdrop-lighting skill).
  applyConductiveBounce(x, y, baseDmg, bouncesLeft, hitSet) {
    if (bouncesLeft <= 0) return;
    let next = null, bestD = 170;
    this.enemies.forEach(en => {
      if (!en.alive || hitSet.has(en)) return;
      const d = Math.hypot(en.x - x, en.y - y);
      if (d < bestD) { bestD = d; next = en; }
    });
    if (!next) return;
    const ratio = Math.min(0.6, 0.25 + (Math.floor(this.run.stats.conductiveBounces || 1) - 1) * 0.05);
    const bounceDmg = Math.max(1, Math.round(baseDmg * ratio));
    hitSet.add(next);
    this.dealDamage(next, bounceDmg, false, 15, x, y, true);
    this.spawnLightning(x, y, next.x, next.y, '#a0e4ff');
    this.applyConductiveBounce(next.x, next.y, baseDmg, bouncesLeft - 1, hitSet);
  }

  updateEProjs(dt) {
    const p = this.player;
    this.eprojs.forEach(ep => {
      if (!ep.alive) return;
      if (ep.homing) {
        const hdx = p.x - ep.x, hdy = p.y - ep.y, hd = Math.hypot(hdx, hdy) || 1;
        const spd = Math.hypot(ep.vx, ep.vy) || 1;
        const turn = Math.min(1, ep.homing * dt);
        ep.vx += ((hdx / hd) * spd - ep.vx) * turn;
        ep.vy += ((hdy / hd) * spd - ep.vy) * turn;
      }
      ep.x += ep.vx * dt; ep.y += ep.vy * dt;
      ep.life -= dt;
      if (ep.life <= 0) { this.eprojs.release(ep); return; }
      if (dist2(ep.x, ep.y, p.x, p.y) <= (p.r + ep.size) * (p.r + ep.size) && p.iframes <= 0) {
        if (Math.random() > this.run.stats.dodge) {
          const dmg = Math.max(1, ep.dmg - this.run.stats.armor);
          p.hp -= dmg;
          p.hit = 0.12;
          p.iframes = 0.3;
          this.cam.shake = Math.max(this.cam.shake, 3);
          this.spawnHitBurst(p.x, p.y, '#b51d28', 14);
        } else {
          this.spawnDamageNumber(p.x, p.y - 10, 'DODGE', '#4dffd4');
        }
        this.eprojs.release(ep);
      }
    });
  }

  updateParts(dt) {
    this.parts.forEach(p => {
      if (!p.alive) return;
      if (p.type === 'meteorMark') {
        p.life -= dt;
        if (p.life <= 0) {
          // impact! Big explosion
          this.enemies.forEach(en => {
            if (dist2(en.x, en.y, p.x, p.y) <= p._radius * p._radius) {
              const dmg = this.rollDamage(p._dmg);
              this.dealDamage(en, dmg.dmg, dmg.crit, 220, p.x, p.y);
            }
          });
          this.spawnRing(p.x, p.y, p._radius, p.color, 0.5);
          this.spawnRing(p.x, p.y, p._radius * 0.6, '#fff5d6', 0.35);
          this.spawnHitBurst(p.x, p.y, p.color, 32);
          // fire chunks flying out
          for (let k = 0; k < 14; k++) {
            const a = Math.random() * TAU;
            const sp = rand(180, 420);
            const cp = this.parts.acquire();
            cp.x = p.x; cp.y = p.y;
            cp.vx = Math.cos(a) * sp; cp.vy = Math.sin(a) * sp;
            cp.life = rand(0.5, 0.9); cp.max = cp.life;
            cp.color = k % 2 ? '#ffb84d' : '#ff7a1a';
            cp.size = rand(3, 5); cp.type = 'spark';
          }
          this.cam.shake = Math.max(this.cam.shake, 9);
          this.parts.release(p);
        }
        return;
      }
      if (p.type === 'bossSlamWarn') {
        p.life -= dt;
        if (p.life <= 0) {
          // Detonate: telegraphed AOE hits the player only if they're still
          // standing in the ring when it lands (see Tidebreaker AI below).
          const pl = this.player;
          if (dist2(pl.x, pl.y, p.x, p.y) <= p._radius * p._radius && pl.iframes <= 0) {
            if (Math.random() > this.run.stats.dodge) {
              const dmg = Math.max(1, p._dmg - this.run.stats.armor);
              pl.hp -= dmg; pl.hit = 0.15; pl.iframes = 0.3;
              this.cam.shake = Math.max(this.cam.shake, 14);
              this.spawnHitBurst(pl.x, pl.y, '#1fb6ff', 20);
            } else {
              this.spawnDamageNumber(pl.x, pl.y - 10, 'DODGE', '#4dffd4');
            }
          }
          this.spawnRing(p.x, p.y, p._radius, '#1fb6ff', 0.6);
          this.spawnRing(p.x, p.y, p._radius * 0.55, '#dff6ff', 0.4);
          this.spawnHitBurst(p.x, p.y, '#1fb6ff', 26);
          this.parts.release(p);
        }
        return;
      }
      // 'lightning' stores the arc's END POINT in vx/vy, not a velocity —
      // running it through the integrator below hurled the start point away
      // at ~900px/s and decayed the endpoint at the same time, so the arc was
      // off-screen within a frame or two of its 0.18s life. That is why chain
      // lightning, Storm Lance strikes and Conductive Rounds bounces were
      // firing and dealing damage with nothing visible on screen.
      // Same story for 'wave' — its radius lives in _radius and its position
      // is the fixed epicentre, so it must not be integrated either.
      if (p.type === 'lightning' || p.type === 'wave') {
        p.life -= dt;
        if (p.life <= 0) this.parts.release(p);
        return;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.05, dt);
      p.vy *= Math.pow(0.05, dt);
      if (p.type === 'blood') p.vy += 200 * dt;
      if (p.type === 'chunk') p.vy += 260 * dt; // dismembered flesh chunks fall
      if (p.type === 'casing') { p.vy += 420 * dt; p._rot = (p._rot || 0) + (p._rotSpd || 0) * dt; }
      p.life -= dt;
      if (p.life <= 0) {
        if (p.type === 'blood') {
          this.pushBloodDecal({ x: p.x, y: p.y, r: 2 + Math.random() * 3, a: 0.45, bornAt: this.time });
        } else if (p.type === 'chunk') {
          this.pushBloodDecal({ x: p.x, y: p.y, r: p.size * 0.9, a: 0.5, bornAt: this.time });
        }
        this.parts.release(p);
      }
    });
  }

  updateGems(dt) {
    const p = this.player;
    const pickupR = 18 * this.run.stats.pickupMult;
    const magnetR = pickupR * 2.2;
    this.gems.forEach(g => {
      if (!g.alive) return;
      const dx = p.x - g.x, dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      g.t += dt;
      if (d < magnetR) {
        const pull = 240 + (magnetR - d) * 4;
        g.x += (dx / Math.max(d, 0.001)) * pull * dt;
        g.y += (dy / Math.max(d, 0.001)) * pull * dt;
      }
      if (d < p.r + 6) {
        if (g.xp > 0) { this.addXp(g.xp); Audio.xpPing(Math.min(1, this.run.xp / this.run.xpToNext)); }
        if (g.gold > 0) this.run.gold += g.gold;
        if (g.heart > 0) {
          const heal = Math.min(5 + (this.run.stats?.heartHeal || 0), p.maxHp - p.hp);
          p.hp = Math.min(p.maxHp, p.hp + heal);
          Audio.heartPickup();
        }
        this.gems.release(g);
      }
    });
  }

  updateDmgNums(dt) {
    this.dmgNums.forEach(d => {
      if (!d.alive) return;
      d.life -= dt;
      d.y += d.vy * dt;
      d.vy *= Math.pow(0.1, dt);
      if (d.life <= 0) this.dmgNums.release(d);
    });
  }

  // ====== COMBAT ======
  dealDamage(e, dmg, crit, kb, ox, oy, silent = false, wcolor = null) {
    if (!e.alive) return;
    const s = this.run.stats;
    if (e._decoy !== undefined) { e._decoy -= 0.5; if (e._decoy <= 0) this.killEnemy(e); return; }
    if (e._molting) { // Hollow Queen shield phase — no damage, just a block ping
      if (!silent) this.spawnDamageNumber(e.x, e.y - e.t.size * 0.6, 'BLOCKED', '#8a3fd4');
      return;
    }
    if (e.t.boss && s.bossDmg > 1) dmg *= s.bossDmg;
    if (e._voidVulnT > 0) dmg *= e._voidVulnMult || 1;
    let head = false;
    if (!e.t.boss && s.headshot > 0 && Math.random() < s.headshot) { dmg = e.hp + 1; head = true; }
    s._lastHitDmg = dmg; s._lastHitWeapon = s._behaviour || 'projectile';
    if (crit) { Audio.crit(); this._critPunch = Math.min(0.22, this._critPunch + 0.18); }
    if ((s.flags || {}).burnDoT) e._burn = Math.max(e._burn || 0, 3);
    if ((s.flags || {}).vampire && !silent) {
      const vAmt = s.vampireAmt || 0.001;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + dmg * vAmt);
    }
    e.hp -= dmg;
    e.hit = 0.08;
    // Progressive gore: every 10% HP lost peels a new chunk of flesh off, right
    // at the point of impact — "Terminator-style" localized damage buildup.
    // Blood/wounds are tinted by the ENEMY'S OWN color (a green enemy always
    // bleeds green) — the projectile/weapon color is reserved for the actual
    // light it casts (see _drawGroundIllum/_drawEnemies in pixiRenderer.js),
    // not for recoloring gore. wcolor/_curWeaponColor kept only as a very
    // minor accent inside spawnWoundBurst/spawnBrutalKill (alternating
    // particles), never as the dominant blood color.
    const bloodColor = e.t.color;
    const impactAccent = wcolor || this._curWeaponColor || bloodColor;
    e._lastHitColor = bloodColor;
    if (!e.t.boss || true) {
      const hpPct = Math.max(0, e.hp / e.maxHp);
      const stage = Math.min(9, Math.floor((1 - hpPct) * 10));
      if (stage > (e._woundStage || 0)) {
        e._woundStage = stage;
        this.spawnWoundBurst(e, ox, oy, stage, bloodColor, impactAccent);
      }
    }
    if (kb > 0) {
      const dx = e.x - ox, dy = e.y - oy;
      const d = Math.hypot(dx, dy) || 1;
      e.kbX += (dx / d) * kb; e.kbY += (dy / d) * kb;
    }
    if (!silent) {
      const tier = head ? 4 : (crit ? (s._lastCritTier || 1) : 0);
      if (tier > 0) {
        const critLabels = ['', 'CRIT', 'SUPER', 'MEGA', 'HEAD!'];
        const critColors = ['', '#ff8c00', '#ff4444', '#cc0000', '#ff0000'];
        const critSizes  = [ 0,       18,       20,       22,       24];
        this.spawnDamageNumber(e.x + rand(-6, 6), e.y - 14, critLabels[tier], critColors[tier], critSizes[tier]);
      } else {
        this.spawnDamageNumber(e.x + rand(-6, 6), e.y - 14, Math.floor(dmg).toString(), '#fff', 14);
      }
    }
    if (Math.random() < 0.55) this.spawnBlood(e.x, e.y, bloodColor);
    // Puncture hole + a short pumping spurt right at the exact impact point
    // (ox,oy — the projectile's own position at collision, not the enemy
    // center), so hits visibly "punch in" somewhere specific on the body
    // rather than just tinting the whole silhouette.
    this.spawnPunctureHit(ox, oy, bloodColor);
    // Hit sparks use the impact accent (weapon/muzzle light color) — small,
    // transient, additive-looking flash particles are the right place for
    // "what hit me" color feedback; the blood itself stays enemy-colored.
    // Elemental flavor (embers/ice/etc) is inferred from that same accent
    // color so it reads correctly per-weapon without needing every weapon
    // tagged yet (see the Elemental system backlog item).
    if (!silent) this.spawnHitSparks(e.x, e.y, impactAccent, dmg, crit);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (!e.alive) return;
    const t = e.t; const s = this.run.stats;
    if (e._decoy !== undefined) { this.enemies.release(e); return; }
    e.alive = false;
    this.run.kills += 1;
    this.run.comboCount += 1;
    this.run.comboTimer = 1.8;
    if (this.run.comboCount > this.run.maxCombo) this.run.maxCombo = this.run.comboCount;

    // ---- Pinball-style score + multiplier ----
    // Multiplier is a step function of the current combo (every 8 kills in
    // a row = +0.5x, capped at 6x) — climbing it is the "risk/reward" hook:
    // letting the combo timer expire (see update(dt)) drops it straight
    // back to 1x, same tension as a pinball multiplier ladder.
    const newMult = Math.min(6, 1 + Math.floor(this.run.comboCount / 8) * 0.5);
    if (newMult > this.run.multiplier) {
      this.run.multiplier = newMult;
      this.run.maxMultiplier = Math.max(this.run.maxMultiplier, newMult);
      this.spawnDamageNumber(this.player.x, this.player.y - 90, this.run.multiplier.toFixed(1) + 'x MULTIPLIER!', '#ffd166', 18);
      this.cam.shake = Math.max(this.cam.shake, 4);
    }
    const scoreGain = Math.round((10 + t.size * 1.5) * this.run.multiplier * (t.boss ? 12 : 1));
    this.run.score = (this.run.score || 0) + scoreGain;

    // ---- Boss-specific kill tracking ----
    if (t.id === 'bossNecromancer') this._necroKilled = true;
    if (t.id === 'bossVoidTitan')   this._voidKilled = true;
    if (t.id === 'bossOcular')      this._horusKilled = true;
    const inCascade = this._inCascade; this._inCascade = true;
    if (!inCascade) {
      if (s.voidBurst > 0 && Math.random() < s.voidBurst) {
        const r = 80 * s.areaMult;
        this.enemies.forEach(en => { if (en !== e && en.alive && dist2(en.x, en.y, e.x, e.y) <= r * r) this.dealDamage(en, 40 * s.damageMult, false, 60, e.x, e.y, true); });
        this.spawnRing(e.x, e.y, r, '#b362ff', 0.3);
      }
      const f = s.flags || {};
      if (f.chainOnKill) {
        const t2 = this.nearestEnemy(e.x, e.y, 200);
        if (t2 && t2.alive && t2 !== e) this.dealDamage(t2, 0.5 * (s._lastHitDmg || 30), false, 40, e.x, e.y, true);
      }
      if (f.explosiveDeath) {
        const r = 70 * s.areaMult;
        this.enemies.forEach(en => { if (en !== e && en.alive && dist2(en.x, en.y, e.x, e.y) <= r * r) this.dealDamage(en, 30 * s.damageMult, false, 80, e.x, e.y, true); });
        this.spawnRing(e.x, e.y, r, '#ff7a1a', 0.3);
      }
      if (f.staticChainKill && Math.random() < 0.25) {
        let prev = e; const hit = new Set([e]);
        const activeEnemies = this.enemies.active;
        for (let ci = 0; ci < 2; ci++) {
          let next = null; let bestD = 220;
          for (let ai = 0; ai < activeEnemies.length; ai++) {
            const en = activeEnemies[ai];
            if (hit.has(en) || !en.alive) continue;
            const cd = Math.hypot(en.x - prev.x, en.y - prev.y);
            if (cd < bestD) { bestD = cd; next = en; }
          }
          if (!next) break;
          this.dealDamage(next, 26 * s.damageMult, false, 30, prev.x, prev.y, true);
          this.spawnLightning(prev.x, prev.y, next.x, next.y);
          hit.add(next); prev = next;
        }
      }
    }
    this._inCascade = inCascade;
    // Enemy identity overrides weapon-based FX when it has one (crystal foes
    // shatter, undead/rot foes decay, metallic foes spark-explode, slimes
    // ooze) — falls back to the old weapon-behaviour-based FX otherwise, so
    // every enemy doesn't die the exact same "green splat" regardless of type.
    const fx = ENEMY_KILL_FX[t.id] || KILL_FX[s._lastHitWeapon] || 'gibs';
    const finalBlood = e._lastHitColor || t.color;
    this.spawnBrutalKill(e.x, e.y, finalBlood, t.size, fx);
    Audio.kill();
    // Ground mark where the body fell — was a body-sized (0.85x) flat pool
    // that read as "the enemy went flat and is lying here", which the user
    // explicitly disliked ("de gillar ja inte") in favor of the body just
    // breaking into pieces (spawnBrutalKill's particles) and being gone.
    // Kept much smaller (a modest splash, not a silhouette-sized stain), and
    // skipped entirely for FX types that shouldn't leave a blood pool at all
    // (crystal shatter / dust decay / metal spark burst).
    if (fx !== 'crystallize' && fx !== 'decay' && fx !== 'sparkExplode') {
      this.pushBloodDecal({ x: e.x, y: e.y, r: t.size * 0.3, a: 0.4, bornAt: this.time, color: finalBlood });
    }
    // drop XP gem
    const gm = this.gems.acquire();
    gm.x = e.x; gm.y = e.y; gm.t = 0;
    gm.xp = Math.max(1, Math.floor(t.xp * (Math.random() < 0.05 ? 3 : 1)));
    gm.gold = 0;
    if (Math.random() < 0.6) {
      const g = this.gems.acquire();
      g.x = e.x + rand(-8, 8); g.y = e.y + rand(-8, 8); g.t = 0;
      g.gold = Math.max(1, Math.floor(t.gold * s.goldMult));
      g.xp = 0; g.heart = 0;
    }
    // Rare heart drop — heals 5 HP base (upgradeable via m_heal meta)
    if (Math.random() < 0.0165 && !t.boss) {
      const h = this.gems.acquire();
      h.x = e.x + rand(-10, 10); h.y = e.y + rand(-10, 10); h.t = 0;
      h.xp = 0; h.gold = 0; h.heart = 1;
    }
    // Gear drop — 8% chance per non-boss kill; boss = guaranteed
    if (!t.boss && Math.random() < 0.08) {
      this._pendingGearDrop = { timeInRun: this.run.time };
    }
    // Codex: track enemy kills
    if (this.onCodexKill) this.onCodexKill(t.id);
    if (t.boss) {
      this._pendingGearDrop = { timeInRun: this.run.time, boss: true };
      this.cam.shake = 18; this.cam.slowmo = 0.5;
      this.bossesKilled += 1; this.bossActive = null;
      this._tierBannerT = 3.4; // "TIER N NOW ACTIVATED" banner, see snapshot()/HUD
      // Massive boss death rings
      this.spawnRing(e.x, e.y, 240, '#ff7a1a', 0.8);
      this.spawnRing(e.x, e.y, 160, '#ffd166', 0.6);
      this.spawnRing(e.x, e.y, 80,  '#fff', 0.4);
      if (t.id === 'bossAida') { this._aidaKilled = true; }
      for (let i = 0; i < 12; i++) {
        const g = this.gems.acquire();
        const a = Math.random() * TAU;
        g.x = e.x + Math.cos(a) * rand(10, 80); g.y = e.y + Math.sin(a) * rand(10, 80); g.t = 0;
        g.gold = Math.floor(t.gold / 12); g.xp = Math.floor(t.xp / 6);
      }
    } else {
      this.cam.shake = Math.max(this.cam.shake, 1.8);
    }
    this.enemies.release(e);
  }

  spawnBrutalKill(x, y, color, size, fx) {
    const qualHi = this._qualityHigh !== false;
    // Kills spend against the same budget as everything else but with a much
    // higher floor than routine hits — the death burst is the payoff moment,
    // so it degrades gently rather than being the first thing sacrificed.
    const cnt = 0.55 + 0.45 * (this._fxScale ?? 1);
    if (fx === 'voidImplode') {
      for (let i = 0; i < Math.round(18 * cnt); i++) {
        const pp = this.parts.acquire();
        const a = Math.random() * TAU; const r = size * 1.4;
        pp.x = x + Math.cos(a) * r; pp.y = y + Math.sin(a) * r;
        pp.vx = -Math.cos(a) * 240; pp.vy = -Math.sin(a) * 240;
        pp.life = rand(0.3,0.5); pp.max = pp.life; pp.color = '#b362ff'; pp.size = 1.8; pp.type = 'spark';
      }
      this.spawnRing(x, y, size * 1.8, '#b362ff', 0.4);
      this.spawnRing(x, y, size * 0.8, '#ffffff', 0.25);
    } else if (fx === 'crystallize') {
      // Shatters into angular glassy shards instead of soft blood chunks.
      for (let i = 0; i < Math.round(16 * cnt); i++) {
        const pp = this.parts.acquire();
        const a = Math.random() * TAU; const sp = rand(120, 380);
        pp.x = x + rand(-3, 3); pp.y = y + rand(-3, 3);
        pp.vx = Math.cos(a) * sp; pp.vy = Math.sin(a) * sp - rand(40, 140);
        pp.life = rand(0.5, 0.9); pp.max = pp.life;
        pp.color = i % 3 === 0 ? '#ffffff' : color;
        pp.size = rand(2, 4.5); pp.type = 'chunk';
      }
      this.spawnRing(x, y, size * 1.1, '#ffffff', 0.35);
      this.spawnRing(x, y, size * 0.6, color, 0.3);
    } else if (fx === 'decay') {
      // Crumbles into dust/ash and sinks — no violent blood spray, a quiet
      // rot-and-collapse instead of a gib explosion.
      for (let i = 0; i < Math.round(20 * cnt); i++) {
        const pp = this.parts.acquire();
        pp.x = x + rand(-size * 0.4, size * 0.4); pp.y = y + rand(-size * 0.4, size * 0.4);
        pp.vx = rand(-30, 30); pp.vy = rand(-20, 60);
        pp.life = rand(0.6, 1.2); pp.max = pp.life;
        pp.color = i % 3 === 0 ? '#5a4a3a' : color;
        pp.size = rand(1.5, 3.2); pp.type = 'spark';
      }
      this.spawnRing(x, y, size * 0.9, '#3a2a1a', 0.3);
    } else if (fx === 'sparkExplode') {
      // Metallic burst: bright white-hot sparks + a shockwave ring, minimal
      // blood since these are steel/tech-bodied enemies.
      for (let i = 0; i < Math.round(26 * cnt); i++) {
        const pp = this.parts.acquire();
        const a = Math.random() * TAU; const sp = rand(160, 460);
        pp.x = x; pp.y = y;
        pp.vx = Math.cos(a) * sp; pp.vy = Math.sin(a) * sp;
        pp.life = rand(0.25, 0.55); pp.max = pp.life;
        pp.color = i % 2 === 0 ? '#fff8d0' : color;
        pp.size = rand(1.5, 3); pp.type = 'spark';
      }
      this.spawnRing(x, y, size * 1.3, '#fff8d0', 0.35);
      this.cam.shake = Math.max(this.cam.shake, 4);
    } else if (fx === 'ooze') {
      // Slimes ooze/splash outward instead of leaving hard gib chunks.
      for (let i = 0; i < Math.round(22 * cnt); i++) {
        const pp = this.parts.acquire();
        const a = Math.random() * TAU; const sp = rand(60, 260);
        pp.x = x; pp.y = y;
        pp.vx = Math.cos(a) * sp; pp.vy = Math.sin(a) * sp - rand(10, 60);
        pp.life = rand(0.5, 1.1); pp.max = pp.life;
        pp.color = color; pp.size = rand(2, 4.5); pp.type = 'blood';
      }
      this.spawnRing(x, y, size * 1.0, color, 0.3);
    } else if (fx === 'ash') {
      for (let i = 0; i < Math.round(14 * cnt); i++) {
        const pp = this.parts.acquire();
        pp.x = x + rand(-size*0.5,size*0.5); pp.y = y + rand(-size*0.5,size*0.5);
        pp.vx = rand(-50, 50); pp.vy = -rand(80, 180);
        pp.life = rand(0.7, 1.4); pp.max = pp.life; pp.color = i%3===0?'#ff7a1a':'#888'; pp.size = rand(1.2, 3); pp.type = 'spark';
      }
      this.spawnRing(x, y, size * 1.2, '#ff7a1a', 0.25);
    } else if (fx === 'bisect') {
      for (let i = 0; i < Math.round(30 * cnt); i++) {
        const pp = this.parts.acquire();
        pp.x = x + rand(-4,4); pp.y = y + rand(-4,4);
        const a = Math.random() * TAU; const sp = rand(160, 440);
        pp.vx = Math.cos(a)*sp; pp.vy = Math.sin(a)*sp - rand(30, 120);
        pp.life = rand(0.5,1.0); pp.max = pp.life; pp.color = i%4===0?'#b51d28':color; pp.size = rand(1.6,3.4); pp.type = 'blood';
      }
      for (let i = 0; i < 3; i++) {
        const pp = this.parts.acquire();
        pp.x = x; pp.y = y;
        const a = (i / 3) * TAU - 0.4;
        pp.vx = Math.cos(a) * 300; pp.vy = Math.sin(a) * 300 - 180;
        pp.life = 0.9; pp.max = 0.9; pp.color = color; pp.size = size * 0.22; pp.type = 'chunk';
      }
    } else {
      // Enhanced standard death: blood spray + body chunks + spark ring
      const bloodCnt = Math.round(32 * cnt);
      for (let i = 0; i < bloodCnt; i++) {
        const pp = this.parts.acquire();
        pp.x = x + rand(-4,4); pp.y = y + rand(-4,4);
        const a = Math.random() * TAU; const sp = rand(100, 480);
        pp.vx = Math.cos(a)*sp; pp.vy = Math.sin(a)*sp - rand(40,160);
        pp.life = rand(0.4, 1.0); pp.max = pp.life;
        pp.color = i % 4 === 0 ? '#b51d28' : color;
        pp.size = rand(1.2, 3); pp.type = 'blood';
      }
      // Body chunks
      const chunks = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < chunks; i++) {
        const pp = this.parts.acquire();
        pp.x = x; pp.y = y;
        const a = Math.random() * TAU; const sp = rand(200, 420);
        pp.vx = Math.cos(a)*sp; pp.vy = Math.sin(a)*sp - rand(100, 280);
        pp.life = rand(0.6, 1.1); pp.max = pp.life;
        pp.color = color; pp.size = size * (0.14 + Math.random() * 0.13); pp.type = 'chunk';
      }
      // Spark burst (small combo of colored sparks)
      if (qualHi) {
        for (let i = 0; i < 8; i++) {
          const pp = this.parts.acquire();
          pp.x = x; pp.y = y;
          const a = (i / 8) * TAU;
          pp.vx = Math.cos(a)*180; pp.vy = Math.sin(a)*180;
          pp.life = 0.22; pp.max = pp.life; pp.color = '#ffcc44'; pp.size = 1.3; pp.type = 'spark';
        }
      }
    }

    // Combo kill effect: extra ring + screen pulse
    if (this.run.comboCount >= 10) {
      this.spawnRing(x, y, size * 2.5, '#ffd700', 0.35);
      if (this.run.comboCount % 25 === 0) {
        this.cam.shake = Math.max(this.cam.shake, 5);
        this.cam.slowmo = Math.max(this.cam.slowmo, 0.12);
      }
    }
  }

  // Enhanced hit sparks (called when projectile hits enemy)
  // Coarse color->element read used purely for hit-spark FLAVOR right now
  // (fire embers drift up, ice shards fall+sparkle, electric already gets
  // real jagged bolts via weaponChain elsewhere) — will become the real
  // elemental-damage-type lookup once the Elemental system is wired in.
  _elementHintFor(hexColor) {
    if (!hexColor) return null;
    const [r, g, b] = hexToRgb01Local(hexColor);
    if (r > 0.75 && g < 0.55 && b < 0.35) return 'fire';
    if (b > 0.75 && g > 0.6 && r < 0.7) return 'ice';
    if (g > 0.7 && r < 0.5 && b < 0.55) return 'poison';
    return null;
  }

  spawnHitSparks(x, y, color, dmg, isCrit) {
    const qualHi = this._qualityHigh !== false;
    const sparkColor = isCrit ? '#ffffff' : color;
    const num = this.fxCount(isCrit ? 8 : 4);
    const elem = this._elementHintFor(color);
    for (let i = 0; i < num; i++) {
      const pp = this.parts.acquire();
      pp.x = x; pp.y = y;
      const a = Math.random() * TAU; const sp = rand(70, 170);
      pp.vx = Math.cos(a) * sp;
      // Fire embers drift/flick upward against gravity; ice shards fall
      // faster and settle; everything else is a neutral flat spark.
      pp.vy = elem === 'fire' ? Math.sin(a) * sp - rand(30, 70) : Math.sin(a) * sp;
      pp.life = elem === 'ice' ? rand(0.14, 0.26) : rand(0.07, 0.15);
      pp.max = pp.life; pp.color = sparkColor;
      pp.size = rand(0.8, isCrit ? 2.6 : 1.6); pp.type = 'spark';
    }
    if (isCrit && qualHi) this.spawnRing(x, y, 22, '#ffffff', 0.15);
  }

  // Tiny dark puncture mark exactly where a projectile/hit landed, plus a
  // few staggered droplets that "pump" outward over the next moment instead
  // of all popping at once — reads as a real spurting wound, not a single
  // static splash. Distinct from (and much smaller than) the 10%-HP wound
  // patches in spawnWoundBurst, which track cumulative damage rather than
  // this-exact-shot feedback.
  spawnPunctureHit(x, y, color) {
    this.pushBloodDecal({ x, y, r: rand(1.2, 2.2), a: 0.75, bornAt: this.time, color });
    const n = 2 + randi(0, 2);
    for (let i = 0; i < n; i++) {
      const p = this.parts.acquire();
      p.x = x; p.y = y;
      const a = Math.random() * TAU; const sp = rand(30, 90);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rand(10, 40);
      // Staggered life so droplets visibly separate in time (the "pump")
      // instead of one simultaneous burst.
      p.life = rand(0.15, 0.5) + i * 0.06; p.max = p.life;
      p.color = color; p.size = rand(0.8, 1.8); p.type = 'blood';
    }
  }

  addXp(amount) {
    const r = this.run;
    r.xp += Math.floor(amount * r.stats.xpMult);
    this._maybeLevelUp();
  }

  _maybeLevelUp() {
    const r = this.run;
    // Only level up if there's no pending card to pick (or one already
    // queued-but-not-yet-revealed). This prevents the modal from looping
    // the "same" level-up screen (it was actually multiple levels stacking
    // in one frame from a single big gem).
    if (this.levelUpQueue > 0 || (this._pendingLevelUps || 0) > 0) return;
    if (r.xp < r.xpToNext) return;
    r.xp -= r.xpToNext;
    r.level += 1;
    r.xpToNext = Math.floor(r.xpToNext * 1.25 + 6);
    // Reveal the card modal (and pause the sim, per frame()'s
    // levelUpQueue===0 gate) half a second AFTER the explosion below, so
    // the player actually sees and feels the blast play out in real,
    // still-running gameplay before everything freezes for the card choice
    // — previously levelUpQueue was set instantly, freezing the sim the
    // same frame the explosion spawned, so it never visibly animated.
    this._pendingLevelUps = (this._pendingLevelUps || 0) + 1;
    this._levelUpRevealT = 0.6;
    this.cam.slowmo = 0.3;
    this.cam.shake = 10;
    this._levelUpFlash = 1.0;
    this._levelUpTextTimer = 1.4;
    Audio.levelUp();
    // BIG level-up blast — visual + KNOCKBACK + small damage
    const p = this.player;
    this._levelUpTextPos = { x: p.x, y: p.y - 40 };
    // Small floating orange "LEVEL UP!" text above the head, same lightweight
    // pooled-text system as hit/dodge feedback (spawnDamageNumber) — distinct
    // from the big centered banner (_drawLevelUpText), reads as an instant
    // "got it" ping the same instant the blast lands.
    this.spawnDamageNumber(p.x, p.y - 60, 'LEVEL UP!', '#ffb347', 20);
    const blastR = 180 * (r.stats.areaMult || 1);
    const blastR2 = blastR * blastR;
    const blastKB  = r.stats.levelUpKB  || 150;
    const blastDmg = r.stats.levelUpDmg || 20;
    // snapshot enemies array to a static list to avoid any pool-mutation surprises
    const enemiesSnapshot = [];
    this.enemies.forEach(e => { enemiesSnapshot.push(e); });
    for (let i = 0; i < enemiesSnapshot.length; i++) {
      const e = enemiesSnapshot[i];
      if (!e || !e.alive) continue;
      if (dist2(e.x, e.y, p.x, p.y) > blastR2) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      e.kbX += (dx / d) * blastKB;
      e.kbY += (dy / d) * blastKB;
      e.iframes = Math.max(e.iframes || 0, 0.25);
      // Deal shockwave damage (guarded by _inCascade to prevent chain XP loops)
      const prevCascade = this._inCascade;
      this._inCascade = true;
      this.dealDamage(e, blastDmg * (r.stats.damageMult || 1), false, 0, p.x, p.y, true);
      this._inCascade = prevCascade;
    }
    this.spawnRing(p.x, p.y, blastR, '#ffd166', 0.55);
    this.spawnRing(p.x, p.y, blastR * 0.55, '#4dffd4', 0.45);
    this.spawnRing(p.x, p.y, blastR * 0.25, '#fff', 0.32);
    // golden spark burst
    for (let k = 0; k < 36; k++) {
      const a = Math.random() * TAU;
      const sp = rand(220, 520);
      const pp = this.parts.acquire();
      pp.x = p.x; pp.y = p.y;
      pp.vx = Math.cos(a) * sp; pp.vy = Math.sin(a) * sp - 40;
      pp.life = rand(0.45, 0.85); pp.max = pp.life;
      pp.color = k % 3 === 0 ? '#fff' : (k % 3 === 1 ? '#ffd166' : '#4dffd4');
      pp.size = rand(2, 4); pp.type = 'spark';
    }
    // "water-to-ash" motes drifting up from the level-up text — cool blue
    // droplets that cool into grey ash flecks as they rise and fade.
    for (let k = 0; k < 16; k++) {
      const pp = this.parts.acquire();
      pp.x = p.x + rand(-24, 24); pp.y = p.y - rand(10, 50);
      pp.vx = rand(-20, 20); pp.vy = -rand(30, 70);
      pp.life = rand(0.9, 1.4); pp.max = pp.life;
      pp.color = '#9fd8ff'; pp.size = rand(2, 4); pp.type = 'ash';
    }
    // brief iframes for safety
    p.iframes = Math.max(p.iframes, 0.6);
  }

  // Refills the enemy broadphase and tracks the largest enemy radius on
  // screen, which collision queries need in order to size their search
  // circle (a boss's body reaches much further out of its own cell than a
  // slime's does).
  _rebuildEnemyGrid() {
    const grid = this.enemyGrid;
    grid.clear();
    let maxR = 0;
    this.enemies.forEach(e => {
      grid.insert(e);
      const r = e.t ? e.t.size / 2 : 0;
      if (r > maxR) maxR = r;
    });
    this._maxEnemyR = maxR;

    const pg = this.projGrid;
    pg.clear();
    let maxS = 0;
    this.projs.forEach(pr => {
      if (pr.friendly === false) return;
      pg.insert(pr);
      const s = pr.size || 6;
      if (s > maxS) maxS = s;
    });
    this.maxProjSize = maxS;
  }

  nearestEnemy(x, y, maxR) {
    let best = null, bd = maxR * maxR;
    this.enemyGrid.query(x, y, maxR + this._maxEnemyR, e => {
      if (!e.alive) return;
      const d = dist2(e.x, e.y, x, y);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  }

  // ====== EFFECTS ======
  spawnDamageNumber(x, y, text, color = '#fff', size = 14) {
    const d = this.dmgNums.acquire();
    d.x = x; d.y = y; d.text = text; d.color = color;
    d.vy = -50; d.life = 0.8; d.size = size;
  }

  // Blood decal pool: oldest splats are evicted once the cap is hit instead
  // of silently dropping ALL new gore for the rest of the run (old decals
  // have long since finished their grow-in animation and faded visually into
  // the ground clutter, so evicting them is unnoticeable).
  pushBloodDecal(decal) {
    if (this.bloodDecals.length >= 150) this.bloodDecals.shift();
    this.bloodDecals.push(decal);
  }

  spawnBlood(x, y, color) {
    const n = this.fxCount(3 + randi(0, 4));
    for (let i = 0; i < n; i++) {
      const p = this.parts.acquire();
      p.x = x; p.y = y;
      const a = Math.random() * TAU;
      const sp = rand(80, 260);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rand(30, 120);
      p.life = rand(0.4, 0.9); p.max = p.life;
      p.color = color; p.size = rand(1.2, 2.6);
      p.type = 'blood';
    }
  }

  // Localized "flesh peel" burst — triggers whenever an enemy crosses a new
  // 10%-HP-lost threshold. Chunks fly off exactly where the hit landed, and a
  // persistent wound patch is recorded on the enemy's body (revealed
  // progressively, drawn by the renderer) so heavily-damaged enemies visibly
  // look torn up before they die.
  spawnWoundBurst(e, ox, oy, stage, bloodColor, impactAccent) {
    const t = e.t;
    const bc = bloodColor || t.color;
    const dx = e.x - (ox ?? e.x), dy = e.y - (oy ?? e.y);
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const wx = e.x - nx * t.size * 0.22, wy = e.y - ny * t.size * 0.22;
    const n = this.fxCount(3 + Math.floor(stage * 0.45));
    // Chunks are mostly enemy-colored flesh; one in four flashes the weapon's
    // impact-accent color instead of duplicating the enemy color, so the
    // gore still reads as "this weapon just hit" without turning blue/etc.
    for (let i = 0; i < n; i++) {
      const p = this.parts.acquire();
      p.x = wx + rand(-3, 3); p.y = wy + rand(-3, 3);
      const a = Math.random() * TAU; const sp = rand(60, 210);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rand(20, 100);
      p.life = rand(0.4, 0.85); p.max = p.life;
      p.color = i % 4 === 0 ? (impactAccent || bc) : bc;
      p.size = rand(1.2, 2.6); p.type = 'chunk';
    }
    this.spawnBlood(wx, wy, bc);
    const localAng = Math.atan2(ny, nx) + rand(-0.35, 0.35);
    const localR = t.size * rand(0.12, 0.4);
    e._wounds.push({ lx: Math.cos(localAng) * localR, ly: Math.sin(localAng) * localR, size: t.size * rand(0.13, 0.21) });
    // Capped like bloodDecals — an unbounded per-enemy wound list during a
    // very long boss fight would otherwise keep growing for the fight's
    // whole duration (found in a code review pass).
    if (e._wounds.length > 24) e._wounds.shift();
    this.pushBloodDecal({ x: wx, y: wy, r: 3 + stage * 0.55, a: 0.5, bornAt: this.time, color: bc });
  }

  // ---- Particle budget --------------------------------------------------
  // The old control was a single binary "_qualityHigh = fps > 55" flag wired
  // into two spawn helpers. That reacts only after the frame rate has already
  // dropped, and it does nothing about the actual cause: a wall of enemies is
  // about to produce a wall of simultaneous hit bursts. So the budget now
  // combines two pressures — measured FPS (reactive) and live enemy count
  // (predictive) — and every gore/spark helper spends against it.
  _updateFxBudget() {
    const fpsP = this.fps >= 58 ? 1
      : this.fps <= 30 ? 0.35
      : 0.35 + ((this.fps - 30) / 28) * 0.65;
    const n = this.enemies.active.length;
    const crowdP = n <= 35 ? 1
      : n >= 110 ? 0.4
      : 1 - ((n - 35) / 75) * 0.6;
    this._fxScale = Math.min(fpsP, crowdP);
    this._qualityHigh = this.fps > 55;
  }

  // Scales a particle count against the budget. Never returns 0 for a
  // non-zero request — feedback thins out, it never disappears, or hits stop
  // reading as hits exactly when the screen is busiest.
  fxCount(n) {
    if (n <= 0) return 0;
    return Math.max(1, Math.round(n * (this._fxScale ?? 1)));
  }

  spawnHitBurst(x, y, color, count) {
    const num = this.fxCount(count);
    for (let i = 0; i < num; i++) {
      const p = this.parts.acquire();
      p.x = x; p.y = y;
      const a = Math.random() * TAU;
      const sp = rand(120, 360);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.life = rand(0.3, 0.6); p.max = p.life;
      p.color = color; p.size = rand(2, 5);
      p.type = i % 3 === 0 ? 'spark' : 'blood';
    }
  }

  spawnSpark(x, y, color) {
    const p = this.parts.acquire();
    p.x = x; p.y = y;
    const a = Math.random() * TAU;
    const sp = rand(60, 180);
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.life = 0.3; p.max = 0.3; p.color = color; p.size = 2; p.type = 'spark';
  }

  spawnMuzzle(x, y, ang, color) {
    const p = this.player;
    p.recoil = Math.min(1, (p.recoil || 0) + 0.4);
    // Brief bright strobe — read by the renderer as a real additive light
    // burst (this is what should light the character up most, per spec).
    p._muzzleFlashT = 0.10;
    p._muzzleFlashAng = ang;
    p._muzzleFlashColor = color;
    p._muzzleFlashSeed = (Math.random() - 0.5) * 1.2;
    p._muzzleFlashSeed2 = Math.random();
    for (let i = 0; i < 5; i++) {
      const pp = this.parts.acquire();
      pp.x = x; pp.y = y;
      const a = ang + (Math.random() - 0.5) * 0.4;
      const sp = rand(120, 320);
      pp.vx = Math.cos(a) * sp; pp.vy = Math.sin(a) * sp;
      pp.life = 0.12; pp.max = 0.12; pp.color = color; pp.size = 3; pp.type = 'spark';
    }
    // Ejected shell casing: pops out sideways from the ejection port, tumbles
    // and cools from hot orange to dull brass before it fades.
    const side = ang + Math.PI * 0.5 * (Math.random() < 0.5 ? 1 : -1);
    const cs = this.parts.acquire();
    cs.x = x - Math.cos(ang) * 5; cs.y = y - Math.sin(ang) * 5;
    const sp = rand(70, 150);
    cs.vx = Math.cos(side) * sp * 0.6; cs.vy = Math.sin(side) * sp * 0.6 - rand(60, 110);
    cs.life = rand(0.5, 0.75); cs.max = cs.life;
    cs.color = '#ffb84d'; cs.size = rand(2, 3); cs.type = 'casing';
    cs._rot = Math.random() * TAU; cs._rotSpd = rand(-16, 16);
  }

  // Passing sky object: a fiery meteor with a tail, or a slow UFO trailing a
  // colored light beam — both cross the sky above the play area and cast a
  // real (if faint) moving light onto the world below as they pass.
  spawnSkyEvent() {
    const p = this.player;
    const isUfo = Math.random() < 0.3;
    const ang = Math.random() * TAU;
    const dist = Math.max(this.W, this.H) * 0.7 + 80;
    const sx = p.x + Math.cos(ang) * dist, sy = p.y + Math.sin(ang) * dist;
    const dirAng = ang + Math.PI + rand(-0.35, 0.35);
    const speed = isUfo ? rand(55, 85) : rand(480, 720);
    this.skyEvents.push({
      type: isUfo ? 'ufo' : 'meteor',
      x: sx, y: sy,
      vx: Math.cos(dirAng) * speed, vy: Math.sin(dirAng) * speed,
      life: isUfo ? rand(9, 13) : rand(1.6, 2.3),
      maxLife: isUfo ? 0 : 0, // set below for meteors (need a fixed reference for the burn-up curve)
      color: isUfo ? '#8fffc0' : (Math.random() < 0.5 ? '#ff7a1a' : '#ffdf80'),
      t: 0,
      bob: rand(0, TAU),
      hoverT: isUfo ? rand(2, 4) : 0,
    });
    const ev = this.skyEvents[this.skyEvents.length - 1];
    ev.maxLife = ev.life;
  }

  updateSkyEvents(dt) {
    for (let i = this.skyEvents.length - 1; i >= 0; i--) {
      const ev = this.skyEvents[i];
      ev.t += dt;
      if (ev.type === 'ufo') {
        // Gentle hover-bob instead of a flat straight-line flythrough, and an
        // occasional near-stop "scanning" pause so it reads as scripted/alive.
        ev.hoverT -= dt;
        const speedMult = ev.hoverT > 0 && ev.hoverT < 0.6 ? 0.12 : 1;
        ev.x += ev.vx * dt * speedMult; ev.y += ev.vy * dt * speedMult + Math.sin(ev.t * 1.6 + ev.bob) * 10 * dt;
        if (ev.hoverT <= 0) ev.hoverT = rand(3, 6);
      } else {
        // Atmospheric entry: fragments once it's burned deep enough into its
        // lifetime — 2-3 embers drift apart and fade independently, like a
        // meteor breaking up instead of a single dot crossing the sky.
        ev.x += ev.vx * dt; ev.y += ev.vy * dt;
        const burnFrac = 1 - ev.life / ev.maxLife;
        if (burnFrac > 0.55 && !ev.frags) {
          ev.frags = [];
          const n = 2 + Math.floor(Math.random() * 2);
          for (let k = 0; k < n; k++) {
            ev.frags.push({ ox: rand(-8, 8), oy: rand(-8, 8), dx: rand(-40, 40), dy: rand(-20, 20) });
          }
        }
        if (ev.frags) for (const f of ev.frags) { f.ox += f.dx * dt; f.oy += f.dy * dt; }
      }
      ev.life -= dt;
      if (ev.life <= 0) this.skyEvents.splice(i, 1);
    }
  }

  spawnRing(x, y, r, color, life) {
    const p = this.parts.acquire();
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = life; p.max = life; p.color = color; p.size = r; p.type = 'ring';
  }

  // Boss guide-arrow STATE ONLY (pure logic, no drawing — PixiRenderer reads
  // these fields to draw the solid arrow / tail-first pixel-dissolve).
  updateBossArrow(dt) {
    let offscreen = false;
    if (this.bossActive) {
      const b = this.bossActive;
      // cam.x/cam.y store the camera's top-left world origin (see updatePlayer:
      // tx = p.x - W/2), matching ctx.translate(-cam.x, ...) used for world
      // rendering — so screen pos is simply world - cam, no extra +W/2.
      const sx = b.x - this.cam.x;
      const sy = b.y - this.cam.y;
      const margin = 50;
      const inWorld = b.x >= 0 && b.x <= this.world.w && b.y >= 0 && b.y <= this.world.h;
      offscreen = inWorld && (sx < margin || sx > this.W - margin || sy < margin || sy > this.H - margin);

      if (offscreen) {
        const cx = this.W / 2, cy = this.H / 2;
        const dx = sx - cx, dy = sy - cy;
        const ang = Math.atan2(dy, dx);
        const maxX = cx - margin, maxY = cy - margin;
        const k = Math.min(maxX / Math.abs(Math.cos(ang) || 0.0001), maxY / Math.abs(Math.sin(ang) || 0.0001));
        const ax = cx + Math.cos(ang) * k;
        const ay = cy + Math.sin(ang) * k;
        const distPx = Math.hypot(b.x - this.player.x, b.y - this.player.y);
        const meters = Math.max(0, Math.round(distPx / 20));
        this._bossArrowLast = { ax, ay, ang, meters };
        this._bossArrowWasOffscreen = true;
        this._bossArrowDissolve = null;
      } else if (this._bossArrowWasOffscreen) {
        // Boss just entered view (or left the map) -> dissolve the arrow into
        // falling pixels/ash instead of popping it away instantly.
        if (!this._bossArrowDissolve && this._bossArrowLast) {
          this._bossArrowDissolve = { t: 0, dur: 1.0, ...this._bossArrowLast };
        }
        this._bossArrowWasOffscreen = false;
      }
    } else {
      this._bossArrowWasOffscreen = false;
      this._bossArrowDissolve = null;
    }
    this._bossArrowOffscreenNow = offscreen;

    if (this._bossArrowDissolve) {
      this._bossArrowDissolve.t += dt;
      if (this._bossArrowDissolve.t >= this._bossArrowDissolve.dur) this._bossArrowDissolve = null;
    }
  }

  spawnArc(x, y, r, color, angle) {
    const p = this.parts.acquire();
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = 0.32; p.max = 0.32; p.color = color; p.size = r; p.type = 'arc';
    p._ang = angle != null ? angle : 0;
  }

  // Arc Tesla — bouncing chain lightning weapon
  weaponChain(s, dt) {
    const p = this.player; const rs = this.run.stats;
    p.teslaCD -= dt;
    const fr = s.fireRate * rs.fireRateMult;
    if (p.teslaCD > 0) return;
    p.teslaCD = 1 / fr;
    const range = (s.range || 320) * rs.areaMult;
    const dmg = this.rollDamage(s.damage * rs.damageMult);
    const chainCount = Math.floor((s.chainCount || 3) + (rs.projBonus || 0));
    const chainRange = (s.chainRange || 200) * rs.areaMult;

    const first = this.nearestEnemy(p.x, p.y, range);
    if (!first) return;

    this.dealDamage(first, dmg.dmg, dmg.crit, 30, p.x, p.y);
    this.cam.shake = Math.max(this.cam.shake, 6);
    this._lightningFlash = Math.max(this._lightningFlash || 0, 0.16);

    // Initial bolt: player → first target
    this.spawnLightning(p.x, p.y, first.x, first.y, s.color || '#a0e4ff');

    // Chain to nearby enemies — each bounce is a real jagged arc + its own
    // brief flash, so it reads as electricity actually jumping between foes.
    let prev = first;
    const hit = new Set([first]);
    for (let ci = 0; ci < chainCount; ci++) {
      const chainFrom = prev;
      let next = null; let bestD = chainRange;
      this.enemies.forEach(e => {
        if (hit.has(e)) return;
        const cd = Math.hypot(e.x - chainFrom.x, e.y - chainFrom.y);
        if (cd < bestD) { bestD = cd; next = e; }
      });
      if (!next) break;
      this.spawnLightning(chainFrom.x, chainFrom.y, next.x, next.y, s.color || '#a0e4ff');
      this.dealDamage(next, dmg.dmg * 0.65, dmg.crit, 20, chainFrom.x, chainFrom.y);
      this.spawnSpark(next.x, next.y, s.color || '#a0e4ff');
      hit.add(next); prev = next;
    }
  }

  // Drone Squadron — 1-2 small drones orbit the player and independently
  // auto-fire at the nearest enemy in range. Positions are recomputed every
  // frame (no persistent entity needed since they're purely visual+firing
  // points, not collidable) and stashed on `this._dronePositions[wid]` so
  // pixiRenderer can draw them without duplicating this orbit math.
  weaponDrone(s, dt) {
    const p = this.player; const rs = this.run.stats;
    const wid = s._wid || 'droneSquad';
    const count = Math.max(1, Math.floor(s.droneCount || 1));
    const radius = 62;
    this._droneCD = this._droneCD || {};
    this._dronePositions = this._dronePositions || {};
    const cds = (this._droneCD[wid] = this._droneCD[wid] || [0, 0]);
    const positions = [];
    for (let i = 0; i < count; i++) {
      const ang = this.time * 1.6 + (i / count) * TAU;
      const dx = p.x + Math.cos(ang) * radius, dy = p.y + Math.sin(ang) * radius;
      positions.push({ x: dx, y: dy });
      cds[i] = (cds[i] || 0) - dt;
      if (cds[i] <= 0) {
        const tgt = this.nearestEnemy(dx, dy, s.range || 380);
        if (tgt) {
          cds[i] = 1 / (s.fireRate * rs.fireRateMult);
          const ang2 = Math.atan2(tgt.y - dy, tgt.x - dx);
          this.fireProjectile(dx, dy, ang2, {
            damage: s.damage, projSpeed: s.projSpeed || 520, projSize: s.projSize || 5,
            color: s.color, pierce: s.pierce || 0, crit: s.crit, _behaviour: 'drone', _wid: wid,
          }, true, 0);
        } else {
          cds[i] = 0.2; // no target yet — check again soon rather than stalling the cooldown
        }
      }
    }
    this._dronePositions[wid] = positions;
  }

  // ====== LEVEL UP CHOICES ======
  buildLevelUpChoices() {
    const r = this.run;
    const owned = r.ownedWeapons;
    const choices = [];
    const usedIds = new Set();

    // Level-5 evolution fork: the instant any owned weapon's next pick would
    // bring it to level 5, replace the WHOLE normal 3-card modal with a
    // special 4-way fork screen for that one weapon (one fork per weapon per
    // run — see run.weaponForks / computeWeaponStats / applyCardChoice).
    const forkWeaponId = r.stats.forksUnlocked
      ? owned.find(id => (r.weaponLvls[id] || 0) === 4 && !r.weaponForks[id])
      : null;
    if (forkWeaponId) {
      const def = WEAPONS[forkWeaponId];
      const forks = getWeaponForkChoices(def);
      return forks.map(f => ({
        kind: 'weapon-fork',
        weaponId: forkWeaponId,
        forkId: f.id,
        icon: f.icon,
        name: `${def.name}: ${f.name}`,
        desc: f.desc,
        rarity: 'epic',
      }));
    }

    // Weapon upgrade options (allow infinite stacking past list)
    const newWeaponIds = Object.keys(WEAPONS)
      .filter(id => !owned.includes(id))
      .filter(id => !WEAPONS[id].requireUnlock || (this.meta.unlockedWeapons || []).includes(id));
    const canAddWeapon = owned.length < (this.meta.weaponSlots || 2) && newWeaponIds.length > 0;

    // We want a mix; produce up to 4 choices, then random 3
    const pool = [];
    const upgradable = owned;
    for (const id of upgradable) {
      const lvl = r.weaponLvls[id] || 0;
      const def = WEAPONS[id];
      if (!def) continue;
      const upg = lvl < def.levelUps.length ? def.levelUps[lvl] : { stat: 'damage', mult: 1.10 };
      const evoId = upg?.evolve ? WEAPON_EVO_MAP[id] : null;
      const evoDef = evoId ? WEAPONS[evoId] : null;
      const evoText = evoDef ? ` → ${evoDef.name}` : '';
      const canEvo = upg?.evolve && r.stats.evoUnlocked && evoId && r.stats.unlockedEvos.includes(id);
      pool.push({
        kind: 'weapon-upgrade', weaponId: id, icon: def.icon,
        name: def.name + (upg?.evolve ? ` — EVOLVE!${evoText}` : (lvl >= def.levelUps.length ? ' +' + (lvl - def.levelUps.length + 2) : ' +')),
        desc: this.describeWeaponUpgrade(def, upg) + (canEvo ? `\n✦ TRANSFORMS into ${evoDef.name}!` : (evoId && !r.stats.evoUnlocked ? '\n🔒 Evo locked (need Awakening Gate)' : '')),
        rarity: upg?.evolve ? 'epic' : (lvl >= 4 ? 'rare' : 'uncommon'),
        evoTarget: evoDef ? evoDef.name : null,
        // For the level-up card UI: current/max tier so it can render level
        // pips, and whether this pick is an evolution step (distinct badge).
        lvl, maxLvl: def.levelUps.length, isEvolve: !!(upg && upg.evolve),
      });
    }
    // 2: new weapons
    if (canAddWeapon) {
      for (const id of newWeaponIds) {
        pool.push({
          kind: 'weapon-new',
          weaponId: id,
          icon: WEAPONS[id].icon,
          name: 'New: ' + WEAPONS[id].name,
          desc: WEAPONS[id].desc,
          rarity: 'rare',
        });
      }
    }
    // 3: stat cards
    for (const s of STAT_CARDS) {
      const rar = rollRarity(r.stats.luck);
      const mult = RARITY[rar].mult;
      const desc = s.desc.replace('{v}', s.mult ? Math.round(s.amount * mult * 100).toString() : (Math.round(s.amount * mult * 100) / 100).toString());
      pool.push({ kind: 'stat', statId: s.id, statRef: s, icon: s.icon, name: s.name, desc, rarity: rar, multiplier: mult });
    }
    // 4: advanced flag/stat cards (rare/epic only) — only if not already active
    for (const ac of ADVANCED_CARDS) {
      if (ac.flag) {
        if (r.stats.flags && r.stats.flags[ac.flag]) continue;
        const rar = rollRarity(r.stats.luck + 1);
        pool.push({ kind: 'flag', flagId: ac.flag, icon: ac.icon, name: ac.name, desc: ac.desc, rarity: rar, amount: ac.amount });
      } else if (ac.stat) {
        // Flat stat boost card (like ironHide: +armor)
        const rar = rollRarity(r.stats.luck + 1);
        const statRef = { id: ac.stat, amount: ac.amount, mult: false };
        pool.push({ kind: 'stat', statId: ac.id, statRef, icon: ac.icon, name: ac.name, desc: ac.desc, rarity: rar, multiplier: 1 });
      }
    }
    // pick 3 unique
    while (choices.length < 3 && pool.length > 0) {
      const idx = randi(0, pool.length);
      const c = pool.splice(idx, 1)[0];
      const key = c.kind + '|' + (c.weaponId || c.statId || c.flagId);
      if (usedIds.has(key)) continue;
      usedIds.add(key);
      choices.push(c);
    }
    return choices;
  }

  describeWeaponUpgrade(weapon, upg) {
    if (!upg) return 'Mastered.';
    const k = upg.stat;
    if (upg.evolve) {
      const evoId = WEAPON_EVO_MAP[weapon.id];
      const evoDef = evoId ? WEAPONS[evoId] : null;
      const suffix = evoDef ? ` | Evolves into: ${evoDef.name}` : '';
      return 'EVOLVED: +' + Math.round((upg.mult - 1) * 100) + '% ' + k + '. Awakened form.' + suffix;
    }
    if (upg.mult != null) return '+' + Math.round((upg.mult - 1) * 100) + '% ' + this.statName(k);
    if (upg.add != null) return '+' + upg.add + ' ' + this.statName(k);
    return '...';
  }

  statName(k) {
    return ({
      damage: 'damage', fireRate: 'attack speed', magazine: 'magazine size',
      pierce: 'pierce', crit: 'crit chance', projSpeed: 'projectile speed',
      area: 'area', range: 'range', orbitCount: 'orbs', orbitRadius: 'orbit radius',
      orbitSpeed: 'orbit speed', homing: 'homing', projectiles: 'projectiles',
    })[k] || k;
  }

  applyCardChoice(choice) {
    const r = this.run;
    if (!choice) { // safety: never leave queue stuck
      this.levelUpQueue = Math.max(0, this.levelUpQueue - 1);
      this.cam.slowmo = 0;
      return;
    }
    if (choice.kind === 'weapon-upgrade') {
      const baseId = choice.weaponId;
      r.weaponLvls[baseId] = (r.weaponLvls[baseId] || 0) + 1;
      // Evolution check: if this levelUp has evolve:true AND evo gate + evo unlocked
      const def = WEAPONS[baseId];
      const newLvl = r.weaponLvls[baseId];
      const upg = def && newLvl <= def.levelUps.length ? def.levelUps[newLvl - 1] : null;
      if (upg && upg.evolve) {
        const evoId = WEAPON_EVO_MAP[baseId];
        const canEvo = r.stats.evoUnlocked && evoId && r.stats.unlockedEvos.includes(baseId);
        if (canEvo && WEAPONS[evoId] && !r.ownedWeapons.includes(evoId)) {
          // Remove base weapon, add evolved weapon
          const idx = r.ownedWeapons.indexOf(baseId);
          if (idx !== -1) r.ownedWeapons.splice(idx, 1);
          r.ownedWeapons.push(evoId);
          r.weaponLvls[evoId] = 0;
          delete r.weaponLvls[baseId];
          // Flash notification
          this.spawnRing(this.player.x, this.player.y, 180, '#ff9900', 0.8);
          this.spawnRing(this.player.x, this.player.y, 120, '#fff', 0.5);
          this.cam.shake = 12;
          this._evoFlash = 2.5; // seconds of gold border flash
          if (this.callbacks.onEvo) this.callbacks.onEvo(evoId);
        }
      }
    } else if (choice.kind === 'weapon-new') {
      r.ownedWeapons.push(choice.weaponId);
      r.weaponLvls[choice.weaponId] = 0;
    } else if (choice.kind === 'weapon-fork') {
      r.weaponForks[choice.weaponId] = choice.forkId;
      r.weaponLvls[choice.weaponId] = Math.max(r.weaponLvls[choice.weaponId] || 0, 5);
      this.spawnRing(this.player.x, this.player.y, 150, '#b362ff', 0.7);
      this.cam.shake = 8;
      if (!r.pickedPassives) r.pickedPassives = [];
      r.pickedPassives.push({ icon: choice.icon || '🔀', name: choice.name || '' });
    } else if (choice.kind === 'stat') {
      const s = choice.statRef;
      const mult = choice.multiplier;
      const amount = s.amount * mult;
      if (s.stat === 'heal') {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
      } else if (s.mult) {
        r.stats[s.stat] = (r.stats[s.stat] || 1) + amount;
      } else {
        r.stats[s.stat] = (r.stats[s.stat] || 0) + amount;
      }
      if (s.stat === 'maxHp') {
        r.stats.maxHp = Math.min(100, r.stats.maxHp); // HP cap: never exceed 100
        this.player.maxHp = r.stats.maxHp;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
      }
      if (!r.pickedPassives) r.pickedPassives = [];
      if (!r.pickedPassives.some(p => p.icon === choice.icon)) r.pickedPassives.push({ icon: choice.icon || '⚡', name: choice.name || '' });
    } else if (choice.kind === 'flag') {
      r.stats.flags[choice.flagId] = true;
      if (choice.flagId === 'glassCannon') { r.stats.damageMult *= 2.5; r.stats.maxHp = Math.floor(r.stats.maxHp * 0.5); this.player.maxHp = r.stats.maxHp; this.player.hp = Math.min(this.player.hp, this.player.maxHp); }
      if (choice.flagId === 'sharpSteel') r.stats.damageMult *= 1.25;
      if (choice.flagId === 'bloodrush') { r.stats.moveMult *= 1.15; r.stats.reloadMult *= 0.85; }
      if (choice.flagId === 'ironPull') r.stats.pickupMult *= 1.80;
      if (choice.flagId === 'vision') this._visionZoom = (this._visionZoom || 1) * 1.25;
      if (!r.pickedPassives) r.pickedPassives = [];
      if (!r.pickedPassives.some(p => p.icon === choice.icon)) r.pickedPassives.push({ icon: choice.icon || '★', name: choice.name || '' });
    }
    this.levelUpQueue -= 1;
    this.cam.slowmo = 0;
    // Process any remaining banked XP — gives ONE level-up per pick, so the
    // user sees the level number tick up between picks instead of multiple
    // identical-looking modals appearing in one frame.
    this._maybeLevelUp();
  }

}
