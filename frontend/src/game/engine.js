// Waterdrop Survivor — Canvas 2D engine with pooling, twin-stick combat, juicy effects.
import { WEAPONS, ENEMIES, STAT_CARDS, RARITY, rollRarity, waveAt, nextBossEvent, WEAPON_EVO_MAP, metaCost } from './data';
import { ACTIVE_SKILLS, KILL_FX, ENEMY_KILL_FX, ADVANCED_CARDS, ELEMENTS, getWeaponForkChoices, WEAPON_SET_BONUSES, WEAPON_UPGRADE_NAMES } from './data_ext2';
import { applyAttachments } from './attachments';
import { Audio } from './audio';
import { PixiRenderer } from './pixiRenderer';

const TAU = Math.PI * 2;
// Timmy: blood is always blood-red, full stop — every enemy used to bleed
// its own identity color (a green slime spraying green "blood"), which read
// as colored paint rather than a wound. Chunks/gibs stay the enemy's own
// color (that part already read right) and stay untouched; this constant is
// only for the liquid — spray, spatter, arterial fans, bleed pulses, floor
// pools, puncture/bullet-hole wounds. Slime "ooze" is a deliberate exception
// (see spawnBrutalKill's 'ooze' branch) — it was never blood to begin with.
const BLOOD_RED = '#b51d28';
// Heavy "square" melee enemies — hit noticeably harder than the rest of the
// roster once the first boss is down, on top of the general post-boss scaling.
const SQUARE_ENEMY_TYPES = new Set(['brute', 'charger', 'necron', 'steelbrute']);

// Enemy variants. Prefixes applied to EXISTING types rather than new enemy
// models — they change how a wave has to be played far more than another
// silhouette would, for a fraction of the work. Deliberately three, each
// answering a different question:
//   armored  — "can you burst it?"    (rewards single big hits)
//   volatile — "where are you standing?" (punishes hugging the pack)
//   leeching — "what do you kill first?" (rewards target priority)
const VARIANTS = {
  armored:  { id: 'armored',  name: 'Armored',  color: '#9fb4c8' },
  volatile: { id: 'volatile', name: 'Volatile', color: '#ff7a1a' },
  leeching: { id: 'leeching', name: 'Leeching', color: '#7ad96b' },
};
const VARIANT_IDS = Object.keys(VARIANTS);

// Camera scale is 1:1 — one world unit is one CSS pixel, on every device.
//
// This was briefly derived from screen size, on the reasoning that a 393px
// phone showing 393 world units makes everything ~3.5x larger relative to the
// screen than a 1400px desktop does. That reasoning is sound in the abstract
// and wrong in practice: at the resulting zoom (1.78 on a phone) the player
// and enemies read as distant specks, and the game stopped being legible.
// The reference the design is tuned against is 1:1, so 1:1 it is.
//
// Kept as a function rather than inlining `1` because the two things that
// actually needed fixing during that experiment are still fixed and still
// depend on a single agreed zoom: viewSpan() below (spawn rings were being
// measured in screen pixels but used as world distances) and the off-screen
// boss arrow (was reading world deltas as screen coordinates). Both are real
// bugs at any zoom above 1 — which the Vision upgrade still produces.
function deviceZoomFor(W, H) {
  // How much WORLD a screen of this size should show.
  //
  // This returned a flat 1, which meant the visible world span was simply the
  // window size: ~390 world px on a phone, ~1920 on a desktop. A desktop
  // player was looking at five times as much world, so the hero was a speck,
  // enemies crossed the screen slowly, and the whole game felt sluggish
  // compared to the phone — the same content at a fifth of the apparent size.
  //
  // Targeting a world SPAN instead makes the two feel alike. The clamp at 1 is
  // deliberate and load-bearing: a phone is already showing less than the
  // target, so it never zooms out, and the phone framing that was checked
  // against the reference screenshot is untouched. Only larger screens move.
  if (!W || !H) return 1;
  const TARGET_W = 760;   // world px across, on any screen big enough
  const TARGET_H = 520;   // and down — guards a wide, short window
  const z = Math.min(W / TARGET_W, H / TARGET_H);
  // Upper bound so an ultrawide or a 4K panel does not zoom in so far that the
  // player cannot see what is walking at them.
  return Math.max(1, Math.min(2.4, z));
}

// Human-readable names for the run-stat keys, used by the level-up cards'
// before/after row. Keyed by the internal `stat` field on STAT_CARDS /
// ADVANCED_CARDS; anything missing falls back to the raw key rather than
// rendering blank.
const STAT_LABELS = {
  damageMult: 'DAMAGE', fireRateMult: 'ATK SPEED', moveMult: 'MOVE SPEED',
  maxHp: 'MAX HP', regen: 'REGEN/S', armor: 'ARMOR', crit: 'CRIT',
  critDmgMult: 'CRIT DMG', areaMult: 'AREA', projBonus: 'PROJECTILES',
  pickupMult: 'PICKUP', xpMult: 'XP GAIN', goldMult: 'GOLD',
  pierceBonus: 'PIERCE', dodge: 'DODGE', reloadMult: 'RELOAD',
  magBonus: 'MAGAZINE', luck: 'LUCK', skillCdMult: 'SKILL CD',
  projSpeedMult: 'PROJ SPEED', projRangeMult: 'PROJ RANGE',
};

// Weather fronts. A run is ten minutes in one open field; weather is the
// cheapest way to make minute eight play differently from minute two without
// adding enemies. Each one is a genuine trade rather than a pure buff, so a
// front changes how you play instead of just how fast you clear.
export const WEATHER = {
  rain:  { id: 'rain',  name: 'RAINFALL',   color: '#5fb8ff', desc: '+25% fire rate · you see less' },
  drought: { id: 'drought', name: 'DROUGHT', color: '#ffb04d', desc: 'They move faster · gold runs richer' },
  storm: { id: 'storm', name: 'ION STORM',  color: '#c8a0ff', desc: 'Lightning strikes at random — it does not care who' },
};
const WEATHER_IDS = Object.keys(WEATHER);
// 'aoe'-behaviour weapons that pulse radially around the player (reuse
// weaponShockwave) rather than sweeping a directional arc in the aim
// direction (weaponScythe, the default for 'aoe').
const RADIAL_AOE_WEAPONS = new Set(['shockwave', 'plasmaTurret', 'solarFlare']);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

// How many times a stat/passive card can meaningfully stack, and therefore how
// many level dots it shows. Matched to the weapon trees (10-12 levels) so the
// two kinds of card read on the same scale -- a passive showing 5 dots next to
// a weapon showing 11 would imply the passive was nearly finished when it was
// not. Cards are not hard-capped by this; it is the scale the dots use.
const CARD_MAX_STACKS = 10;
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
    // Read-only view of the save, for systems whose data is too structured to
    // flatten into the meta-key pipeline — currently just weapon attachments,
    // which need the socket map AND the attachment inventory together.
    this.saveRef = opts.saveRef || null;
    this.attachFor = opts.attachFor || null;
    this._attachLooks = null;
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
    // pond_1 only — pixiRenderer.js builds a "WATERDROP CAMP" sign near
    // spawn when this is set. See GameScreen.jsx's opts.campSign.
    this.campSign = !!opts.campSign;

    // Player
    this.player = this.createPlayer();

    // A companion found and rescued in the storyline (see game/companions.js).
    // Spawned as a second, defendable body — not player-controlled, takes
    // gentle contact damage from nearby enemies, and comes home with you if
    // still alive when the node clears.
    this.companionNpc = null;
    if (opts.rescueCompanion) {
      const c = opts.rescueCompanion;
      this.companionNpc = {
        id: c.id, name: c.name, build: c.build, color: c.color, colorDeep: c.colorDeep,
        x: this.player.x + 150, y: this.player.y, r: 13,
        hp: 120, maxHp: 120, alive: true, hit: 0,
      };
    }

    // Stats / run state
    this.run = {
      time: 0, kills: 0, level: 1, xp: 0, xpToNext: 20, gold: 0,
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
        // Weapon-class scoped multipliers. These let a level-up card say
        // something specific ("+14% damage with manual weapons") instead of
        // every offensive card being another flat global bump, which is what
        // makes two runs feel different. Applied in computeWeaponStats.
        manualDmgMult: 1.0,
        manualRateMult: 1.0,
        manualMagMult: 1.0,
        autoDmgMult: 1.0,
        autoRateMult: 1.0,
        autoAreaMult: 1.0,
        moveMult: 1.0 + (this.meta.mspd || 0),
        // 70, up from 50, to pay for removing the hard 100 cap. With the
        // reworked enemy damage a fresh slime hits for 16, so this is a
        // deliberate "four hits from the weakest thing in the game is a real
        // problem" — lethal enough that the opening minute is genuinely
        // dangerous, forgiving enough that a new player gets to make four
        // mistakes rather than three before the run ends.
        maxHp: 70 + (this.meta.maxHp || 0),
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
        // Projectile speed and range. Both seeded from meta so the permanent
        // upgrades apply from the first frame of a run, then raised further by
        // level-up cards during it — the same shape every other stat here uses.
        projSpeedMult: 1.0 + (this.meta.projspd || 0),
        projRangeMult: 1.0 + (this.meta.projrange || 0),
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
    // No cap — see the maxHp branch in the level-up card handler for why the
    // old Math.min(100, …) had to go.
    this.player.maxHp = this.run.stats.maxHp;
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
    // A slower-burning timer than _levelUpFlash (which is a quick whole-
    // screen wash) — this one drives an energy fill rising bottom-to-top
    // over the player's own body in pixiRenderer's _drawPlayer, so a
    // level-up reads as the character visibly charging up, not just a
    // screen flash. See LEVEL_UP_SHIELD_DUR below.
    this._levelUpShieldT = 0;
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

    // Difficulty tier (see game/difficulty.js). Defaulted rather than required
    // so any caller that starts a run without passing one — the tutorial, a
    // challenge, a dev harness — runs on Normal instead of crashing on an
    // undefined multiplier.
    this.diff = opts.diff || {
      id: 'normal', name: 'Normal', color: '#4dc4ff', icon: '🌊',
      hpMult: 1, dmgMult: 1, speedMult: 1, spawnMult: 1, bossHpMult: 1, xpMult: 1,
    };

    // Anti-AFK pressure. See updateStagnation — 0 while you are playing, ramps
    // to 1 if you park. Read by spawnWave and spawnEnemy, and surfaced in the
    // HUD so the player is told what is happening rather than just punished.
    this._stagnation = 0;
    this._stagPrev = null;
    this._stagDist = 0;
    this._stagSampleT = 0;
    // Starts "moving" so the very first sample window cannot ramp before the
    // player has had a chance to take a step.
    this._stagMoving = true;

    // Campaign node: hold out until the gate opens, then the map's guardian
    // arrives and killing it clears the node. Deliberately NOT a target
    // duration — a node ends because you beat something, not because a clock
    // ran out, which is the whole difference between a stage and a timer.
    this.campaignBossAt = opts.bossAt || 0;
    this.campaignBossId = opts.bossId || null;
    this._campaignBossSpawned = false;
    this._campaignBoss = null;

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
    // Dev-only handle. Inspecting anything about a live run otherwise means
    // digging the instance out of a React fiber, which breaks whenever the
    // component tree changes. Stripped from production builds by the bundler's
    // dead-code elimination, so nothing is exposed to players.
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      window.__wdGame = this;
    }
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
    this._deviceZoom = deviceZoomFor(this.W, this.H);
    if (this.renderer) this.renderer.resize(this.W, this.H);
  }

  // The single zoom the camera, the renderer and screen↔world conversion all
  // have to agree on. Two independent factors, deliberately kept apart:
  //   _deviceZoom — how much world a screen of THIS size should show
  //   _visionZoom — the player's Vision upgrade, ×1.25 a pick
  // Multiplying them here means a phone player's Vision card still widens
  // their view by the same proportion a desktop player's does.
  viewZoom() {
    return (this._deviceZoom || 1) * (this._visionZoom || 1);
  }

  // The long edge of the visible area in WORLD units. Every "spawn just
  // outside the view" distance has to be measured in these, not in screen
  // pixels: a screen shows W*zoom world units across, so `max(W,H) * 0.55`
  // put an ambush spawn comfortably *inside* the view the moment zoom rose
  // above ~1.2. That was already true for anyone holding the Vision upgrade
  // and would have become the normal case on every phone.
  viewSpan() {
    return Math.max(this.W, this.H) * this.viewZoom();
  }

  destroy() {
    this.running = false;
    // Release the dev handle. Without this, every destroyed run stays
    // reachable from `window` and its pools, textures and filters can never be
    // collected — which over a long editing session (each hot reload builds a
    // fresh Game) is a real and growing leak.
    if (typeof window !== 'undefined' && window.__wdGame === this) window.__wdGame = null;
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
      gearParts: this.run.gearParts || 0,
      // Companion rescue — see game/companions.js. null when this node has
      // none; otherwise the HUD shows a small "PROTECT [NAME]" bar.
      companionNpc: this.companionNpc
        ? { name: this.companionNpc.name, hp: this.companionNpc.hp, maxHp: this.companionNpc.maxHp, alive: this.companionNpc.alive }
        : null,
      // Campaign HUD: how long until the guardian, and whether it is up.
      campaignBossAt: this.campaignBossAt || 0,
      campaignBossUp: !!(this._campaignBoss && this._campaignBoss.alive),
      // Spawned AND no longer alive. The objective list used to read `victory`
      // for this, which is technically present in the snapshot but is set in
      // the same frame as `over` — so the tick fired at the exact instant the
      // game-over screen replaced the HUD and was never actually seen.
      campaignBossDown: !!(this._campaignBoss && !this._campaignBoss.alive),
      // Difficulty tier + anti-AFK pressure. Both are surfaced because a
      // player who is being punished has to be able to see WHY — an
      // unexplained spike in spawn rate reads as the game cheating.
      diffId: this.diff.id,
      diffName: this.diff.name,
      diffColor: this.diff.color,
      stagnation: this._stagnation || 0,
      mag: Math.max(0, Math.floor(this.player.mag)),
      reloading: this.player.reloading,
      weapons: this.run.ownedWeapons.map(id => ({
        id, icon: WEAPONS[id].icon, lvl: (this.run.weaponLvls[id] || 0) + 1, name: WEAPONS[id].name,
      })),
      // Sets that have fired this run. The unlock toast is one moment; this
      // is what lets you still see, ten minutes later, what you are carrying.
      sets: [...this.run.setsUnlocked],
      over: this.over,
      victory: this.victory,
      fps: this.fps,
      pendingLevelUp: this.levelUpQueue > 0,
      wave: waveAt(this.run.time),
      bossActive: !!this.bossActive,
      bossHp: this.bossActive ? this.bossActive.hp : 0,
      bossMaxHp: this.bossActive ? this.bossActive.maxHp : 0,
      bossName: this.bossActive ? this.bossActive.t.name : '',
      weather: this._weather || null,
      weatherT: this._weatherT || 0,
      weatherBanner: this._weatherBannerT || 0,
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

  // Canvas pixels -> world pixels. The ONE place that knows how the camera and
  // the vision zoom map the two spaces, because there were three copies of
  // this arithmetic and all three were wrong in the same way.
  //
  // The renderer parents `world` (translated by -cam) inside `zoomRoot`
  // (scaled by 1/zoom), so a world point W lands at screen (W - cam) / zoom.
  // Inverting that gives world = cam + screen * zoom.
  //
  // The old inline version computed `mx - W/2 + p.x - cam.x`, which SUBTRACTS
  // the camera origin instead of adding it. With the player near the middle of
  // a 6400px map that is off by roughly 2400px, so the aim vector pointed at a
  // fixed spot far off-map and barely responded to the mouse at all — mouse
  // aiming simply did not work, while the keyboard, firing and everything
  // driven off `aimX/aimY` still behaved, which is exactly how it presented.
  screenToWorld(sx, sy) {
    const zoom = this.viewZoom();
    return [this.cam.x + sx * zoom, this.cam.y + sy * zoom];
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
    this._updateProspectorFlags(dt);
    this._updateWeather(dt);

    // Rebuild the enemy broadphase before anything queries it this frame.
    // Enemies spawned later in the frame (spawnWave) land in it next frame —
    // they enter off-screen, so nothing can miss them meanwhile.
    this._rebuildEnemyGrid();

    this.updatePlayer(dt);
    this.updateBossArrow(dt);
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateCompanion(dt);
    this.updateProjs(dt);
    this.updateEProjs(dt);
    this.updateParts(dt);
    this.updateGems(dt);
    this.updateDmgNums(dt);
    // Before spawnWave, since it reads the value this sets.
    this.updateStagnation(dt);
    this.spawnWave(dt);
    this.updateDockStation(dt);
    this.updateTidalShrine(dt);
    // The ambient miniboss/swarm timers pause during a boss for the same
    // reason the wave does — a Sky Wisp swarm dropping in mid-duel is exactly
    // the interruption the freeze exists to prevent. They are held, not reset,
    // so they resume where they were once the boss is down instead of the
    // player getting a free window after every fight.
    if (!this.bossActive) {
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
    }   // end: ambient spawners paused while a boss is active
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
    this._levelUpShieldT = Math.max(0, (this._levelUpShieldT || 0) - dt);
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

    // Campaign gate: the guardian arrives once you have held out long enough.
    if (this.campaignBossAt && !this._campaignBossSpawned && this.run.time >= this.campaignBossAt) {
      this._campaignBossSpawned = true;
      this.spawnBoss(this.campaignBossId);
      this._campaignBoss = this.bossActive;
      this.cam.shake = 22;
      this.spawnDamageNumber(this.player.x, this.player.y - 90, 'THE GUARDIAN COMES', '#ff4d6a', 20);
    }
    // Clearing the node means killing THAT boss specifically — not merely
    // having a boss die, since the ambient boss timeline can also fire one.
    if (this._campaignBoss && !this._campaignBoss.alive && !this.over) {
      this.victory = true; this.over = true;
      if (this.callbacks.onGameOver) this.callbacks.onGameOver({ ...this.snapshot(), victory: true, completed: 'campaignBoss' });
    }

    // The ambient WAVE_TIMELINE boss rotation is for free/endless runs. A
    // campaign node supplies its OWN guardian at its own gate, and the two
    // collided badly once the timeline's first boss moved to t=150 and the
    // gate floor moved to 150: lake_1 gates at 151s, so the ambient Eye of
    // Horus spawned at t=150 and the campaign Eye of Horus one frame later.
    // Two full-HP guardians at once on the node the whole difficulty pass is
    // tuned around — and because spawnBoss overwrites `bossActive`, killing
    // the ambient one blanked the HUD boss bar while the real guardian was
    // still alive.
    //
    // Suppressing the rotation for the whole campaign node is the honest fix
    // rather than a timing fudge: a node's shape is "hold out, then the
    // guardian", and a second unrelated boss wandering in during the hold-out
    // is not part of that shape at any gate time.
    if (!this.campaignBossAt && this.nextBoss && this.run.time >= this.nextBoss.t && !this.bossActive) {
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
    // Baseline at ZERO points, up to +33% fully invested.
    //
    // This used to run 0.67 -> 1.33, i.e. a 33% speed PENALTY until you had
    // spent half the curve. A fresh player therefore moved at 200 * 0.67 =
    // 134, against bats at 126, nanoswarm at 115, lightningbugs at 145 and
    // skyWisps at 155 — several enemies were outright faster than the player
    // and the rest were within a hair. Retreating did not work, which is
    // exactly the "I die even though I just back away" report.
    //
    // Punishing the player hardest at the one moment they have no points to
    // spend is backwards: the attribute should buy an advantage, not buy back
    // a handicap. Investment is still worth the same 33% swing, it just runs
    // from par instead of from a hole.
    return 1.0 + (pts / ATTR_CURVE_MAX) * 0.33;
  }

  // Aim attribute (save.attrs.aim): inverse curve — 0 points = 33% MORE
  // base shot imprecision than baseline, max points = 33% LESS. This is a
  // small imprecision applied on top of each weapon's own spread stat, so
  // even a "0 spread" weapon can clip a miss at 0 points (see
  // weaponManualPistol/weaponShotgun) — investing buys back a genuinely
  // tighter, more reliable shot.
  aimSpreadMult() {
    const pts = Math.min(ATTR_CURVE_MAX, this.attrs.aim || 0);
    // Baseline at zero, down to -33% spread fully invested. Was 1.33 -> 0.67,
    // the same "buy back a handicap" shape Agility had: an unspent player shot
    // 33% WIDER than the weapon's own stated spread, so every gun felt worse
    // than its numbers until half the curve was paid off. Same reasoning as
    // agilityMult — the attribute should buy an advantage, not undo a tax.
    return 1.0 - (pts / ATTR_CURVE_MAX) * 0.33;
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
    // 172, not 200.
    //
    // The code always said 200, but the Agility curve multiplied it by 0.67 at
    // zero points, so what shipped was 134 — slower than four enemies, which is
    // why retreating did not work. Fixing the curve handed the player the full
    // 200 for the first time, and at 200 NOTHING in the game can catch you:
    // the fastest enemy is 165, and the margin is +35. That reads as "almost
    // too fast" because it is also completely safe.
    //
    // 172 keeps every enemy escapable — the point of the curve fix — while
    // leaving the fastest ones a real threat at +7 rather than a formality.
    // Neither 134 nor 200 was ever a validated number; this one is chosen
    // against the actual enemy speed table.
    const baseSpd = 172 * s.moveMult * agi;
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
      const [wmx, wmy] = this.screenToWorld(this.input.mx, this.input.my);
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

    // Half a SCREEN in world units — with the vision zoom active a screen
    // covers `zoom` times more world, so centring on p.x - W/2 left the player
    // visibly off to one side. Scaling the half-extent by the zoom keeps him
    // centred at every zoom level, and keeps screenToWorld's inverse exact.
    const zoom = this.viewZoom();
    const tx = p.x - (this.W / 2) * zoom, ty = p.y - (this.H / 2) * zoom;
    // First frame SNAPS instead of damping. The camera is constructed at
    // (0,0) while the player spawns at ~(3200,3200), so the damped follow
    // spent the opening half-second flying across the map to catch up — a
    // visible lurch at the start of every run, and it meant anything that
    // sampled the camera on frame one (the parallax backdrop) sampled a
    // position the run never actually uses.
    if (!this._camSeeded) { this.cam.x = tx; this.cam.y = ty; this._camSeeded = true; }
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
    // Spike Plates: dashing leaves a trap where you launched from, so the card
    // rewards dashing THROUGH a crowd rather than away from one.
    if ((s.flags || {}).spikePlates) {
      const trap = this.parts.acquire();
      trap.x = p.x; trap.y = p.y; trap.vx = 0; trap.vy = 0;
      trap.life = 6; trap.max = 6;
      trap.color = '#9fb4c8'; trap.size = 34; trap.type = 'spikeTrap';
      trap._dmg = 60 * s.damageMult;
      trap._armed = 0.25;      // brief arming delay so it cannot hit instantly
      trap._used = false;
    }
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
      // Reworked twice over.
      //
      // It USED to be a chain that crawled outward from the player's own
      // position — visually identical to the Arc Tesla weapon, and nothing
      // about it read as "lightning strike". It now falls from the sky onto
      // the target: telegraph, bolt down out of frame, ground flash, thunder.
      //
      // It also had NO progression whatsoever — a flat 120 damage and a flat
      // 5 targets the instant you unlocked it, which is what made it feel like
      // it started at max level. `skillLvl` scales strike count, damage and
      // splash, so rank 1 is a single bolt and it grows into a storm.
      const lvl = this.skillLvl('lightning');
      const strikes = Math.min(6, 1 + Math.floor(lvl / 2));
      const dmgBase = 46 + lvl * 26;
      const splashR = 54 + lvl * 7;

      // Aim point first, then the nearest foes to it. Strikes land ON enemies
      // rather than chaining between them.
      const ax = p.x + (p.aimX || 0) * 110, ay = p.y + (p.aimY || 0) * 110;
      const targets = [];
      let from = { x: ax, y: ay };
      for (let i = 0; i < strikes; i++) {
        const t = this.nearestEnemy(from.x, from.y, 300);
        if (!t || targets.includes(t)) break;
        targets.push(t); from = { x: t.x, y: t.y };
      }
      // With nothing in range it still strikes where you aimed, so the skill
      // never silently does nothing.
      const points = targets.length
        ? targets.map((t) => ({ x: t.x, y: t.y, e: t }))
        : [{ x: ax, y: ay, e: null }];

      points.forEach((pt, i) => {
        // Staggered so a multi-strike rolls across the field like real
        // thunder instead of every bolt landing on the same frame.
        this.spawnSkyBolt(pt.x, pt.y, i * 0.07, splashR);
        const dmg = this.rollDamage(dmgBase * s.damageMult);
        if (pt.e) this.dealDamage(pt.e, dmg.dmg, dmg.crit, 80, pt.x, pt.y - 200);
        // Everything under the strike takes the splash, so a bolt landing in a
        // crowd is worth more than one landing on a straggler.
        // NB: `Pool` exposes `free` / `active` / `forEach` — there is no
        // `items`. Iterating a non-existent property threw on the first strike
        // AFTER the cooldown had already been spent, so the skill ate its
        // cooldown and then died mid-cast. `forEach` also walks backwards and
        // skips dead entries, which matters here because dealDamage can kill
        // an enemy and release it from the pool during the loop.
        this.enemies.forEach((e2) => {
          if (e2 === pt.e) return;
          if (dist2(e2.x, e2.y, pt.x, pt.y) > splashR * splashR) return;
          const sd = this.rollDamage(dmgBase * 0.45 * s.damageMult);
          this.dealDamage(e2, sd.dmg, sd.crit, 40, pt.x, pt.y - 200);
        });
      });
      this._lightningFlash = Math.max(this._lightningFlash || 0, 0.5);
      this.cam.shake = Math.max(this.cam.shake, 9 + strikes);
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
        // Rolled per enemy from the BASE damage, not scaled off `pr.dmg`.
        // `pr.dmg` already has the shot's crit multiplier baked into it, so
        // passing it on handed every single enemy in the blast radius that one
        // lucky roll's damage — the crit was shared, it just did not show a red
        // number. Each enemy in a blast now takes its own chance.
        const base = (pr._baseDmg !== undefined ? pr._baseDmg : pr.dmg) * 0.6;
        const roll = this.rollDamage(base, pr._baseCrit || 0);
        this.dealDamage(en, roll.dmg, roll.crit, 100, pr.x, pr.y, true);
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
    this._heldWidSet = false;
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
      // What KIND of thing is about to hit, so the wound can match it. Without
      // this every hit that was not fire or ice stamped a bullet hole -- a
      // katana slash, a beam and a shockwave all punched neat round holes.
      this._curWeaponBehaviour = w.behaviour || null;
      // 'manual' | 'auto'. Live Wire and the manual-cooldown passive both need
      // to know which kind of weapon is firing, and `behaviour` does not say:
      // both a manual pistol and an auto turret are 'projectile'.
      stats._wtype = w.type || 'auto';
      switch (w.behaviour) {
        case 'projectile':
          stats._behaviour = w.behaviour;
          // Which manual weapon is in the character's hands, so the renderer
          // can draw that specific model rather than one generic pistol.
          // FIRST manual weapon owned, not the last one iterated — every
          // manual weapon runs through weaponManualPistol each frame, so
          // taking the last would make the held model flicker between them.
          if (w.type === 'manual') {
            if (!this._heldWidSet) {
              if (wid !== this._heldWid) {
                this._heldWid = wid;
                // Resolved on change only — attachments cannot change during
                // a run, so the renderer should not search an inventory
                // sixty times a second for them.
                this._attachLooks = this.attachFor ? this.attachFor(wid) : null;
              }
              this._heldWidSet = true;
            }
            this.weaponManualPistol(stats, dt);
          }
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
        case 'melee':   stats._behaviour = w.behaviour; this.weaponKatana(stats, dt); break;
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

    // Weapon-class scoped multipliers from level-up cards. Applied last so a
    // card that says "manual weapons" genuinely scopes to manual weapons,
    // including anything a fork or mod already changed.
    const rs = this.run.stats;
    if (w.type === 'manual') {
      if (rs.manualDmgMult !== 1) s.damage = (s.damage || 0) * rs.manualDmgMult;
      if (rs.manualRateMult !== 1) s.fireRate = (s.fireRate || 0) * rs.manualRateMult;
      if (rs.manualMagMult !== 1 && s.magazine) s.magazine = Math.ceil(s.magazine * rs.manualMagMult);
      // Cycled Action: -manual weapon cooldown, i.e. faster cycling. Applied
      // here rather than at each of the eight `fireRate * fireRateMult` sites,
      // so it cannot be half-applied by whichever one someone forgets.
      const cd = (rs.flags || {}).manualCooldown ? (rs.manualCooldownAmt || 0.05) : 0;
      if (cd) s.fireRate = (s.fireRate || 0) * (1 + cd);
    } else {
      if (rs.autoDmgMult !== 1) s.damage = (s.damage || 0) * rs.autoDmgMult;
      if (rs.autoRateMult !== 1) s.fireRate = (s.fireRate || 0) * rs.autoRateMult;
      if (rs.autoAreaMult !== 1 && s.area) s.area = s.area * rs.autoAreaMult;
    }
    // Weapon Mastery at level 10. Past the seven authored levelUps a weapon
    // was only getting a generic +10% damage per pick, so committing to one
    // weapon stopped feeling like a decision. Ten is a real milestone.
    if (lvl >= 10) {
      s.damage = (s.damage || 0) * 1.35;
      s.fireRate = (s.fireRate || 0) * 1.15;
      s.pierce = (s.pierce || 0) + 1;
      s._mastered = true;
    }
    // Tempo Engine's kill stacks land here so every weapon picks them up
    // uniformly, rather than having to touch each of the ten sites that read
    // fireRateMult.
    if (this._tempoStacks) s.fireRate = (s.fireRate || 0) * this.tempoMult();
    // Rain quickens everything you fire. Applied here for the same reason
    // Tempo is: one place, every weapon.
    const wf = this.weatherFireRate();
    if (wf !== 1) s.fireRate = (s.fireRate || 0) * wf;
    // Attachments last of all, so a barrel that says "+16% damage" means 16%
    // of everything else you have already built on this weapon.
    if (wid) applyAttachments(this.saveRef, wid, s);
    return s;
  }

  weaponManualPistol(s, dt) {
    const p = this.player; const rs = this.run.stats;
    if (p.reloading) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        p.reloading = false;
        // Bulletstorm: finishing a reload sprays the spent magazine outward.
        // Fired on COMPLETION rather than on the reload starting, so it rewards
        // riding the reload out instead of cancelling it.
        if ((rs.flags || {}).bulletstorm) {
          const n = this.fxCount(10);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + Math.random() * 0.2;
            const pr = this.projs.acquire();
            pr.x = p.x; pr.y = p.y;
            pr.vx = Math.cos(a) * 620; pr.vy = Math.sin(a) * 620;
            pr.dmg = (s.damage || 18) * 0.5 * rs.damageMult;
            pr.life = 0.55; pr.size = (s.projSize || 6) * 0.8;
            pr.color = s.color || '#ffd166';
            pr.pierce = 0; pr.crit = false;
          }
          this.spawnRing(p.x, p.y, 42, '#ffd166', 0.28);
          Audio.shoot(s._wid, s._behaviour);
        }
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
      // Echo Chamber (Prospector unique): every 5th shot arrives twice, and
      // the echo costs no ammo. Slightly offset so the pair reads as two
      // rounds rather than one fat one.
      if (rs.flags && rs.flags.echoChamber) {
        p._echoCount = (p._echoCount || 0) + 1;
        if (p._echoCount % 5 === 0) {
          const ang2 = ang + rand(-0.05, 0.05);
          this.fireProjectile(p.x + p.aimX * 10, p.y + p.aimY * 10, ang2, s, true);
          this.spawnRing(p.x + p.aimX * 22, p.y + p.aimY * 22, 16, s.color || '#9fd8ff', 0.16);
        }
      }
      p.mag -= 1;
      this.cam.shake = Math.max(this.cam.shake, 1.4);
      Audio.shoot(s._wid, s._behaviour);
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
    // One sequence, scheduled against the SAME phase fractions pixiRenderer's
    // _reloadPose uses (0.20 mag drops, 0.66 fresh mag seats, 0.74-0.86 the
    // rack), so the mag-drop thunk, the seat click and the slide rack land
    // on the actual animation beats instead of being one generic beep.
    // Per-weapon reload mechanism. One reload sound across every gun made
    // them all feel like the same weapon; shells, power cells and a bowstring
    // are different machines and should sound like it.
    // `s._wid` is the id the very next line already trusts for picking the
    // reload VISUAL, so it is the right source for picking the reload SOUND —
    // using anything else here would let the two disagree about which weapon
    // is being reloaded.
    Audio.reloadFor(s._wid, p.reloadTotal * 1000);
    p._reloadMag = (s.magazine || 12) + this.run.stats.magBonus; // capacity, for the revolver-cylinder notch count
    p._reloadWid = s._wid || null; // which weapon is reloading, so the renderer picks the right visual
    // The spent magazine is a real object thrown to the ground rather than a
    // shape drawn inside the gun for a moment — it tumbles, lands and lies
    // there, which is what makes the reload read as physical.
    const isRevolver = p._reloadWid === 'hydropistol' || p._reloadWid === 'hydropistol_evo';
    if (!isRevolver) {
      const mp = this.parts.acquire();
      mp.x = p.x + p.aimX * 6; mp.y = p.y + 4;
      mp.vx = -p.aimX * rand(20, 50) + rand(-25, 25);
      mp.vy = rand(-40, -10);
      mp.life = 2.6; mp.max = 2.6;
      mp.color = '#2a313d'; mp.size = 3.4; mp.type = 'casing';
      mp._rot = Math.random() * TAU; mp._rotSpd = rand(-9, 9);
      mp._settled = false; mp._restY = undefined;
    }
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
    const native = s.projectiles || 1;
    const projCount = native + rs.projBonus;
    // Bonus projectiles hit softer than the weapon's own — see
    // bonusProjDamageScale. Applied by handing fireProjectile a scaled copy of
    // the stats rather than by touching `s`, which is a shared object.
    const scale = this.bonusProjDamageScale(native, projCount);
    const shotStats = scale === 1 ? s : { ...s, damage: (s.damage || 10) * scale };
    const baseAng = Math.atan2(tgt.y - p.y, tgt.x - p.x);
    const spread = 0.18;
    for (let i = 0; i < projCount; i++) {
      const off = (i - (projCount - 1) / 2) * spread;
      this.fireProjectile(p.x, p.y, baseAng + off, shotStats, true, s.homing || 0);
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
    Audio.shoot(s._wid, s._behaviour);
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
    // Whips get a lash rather than the generic sweep arc — same hit shape,
    // different read, so a whip build doesn't look like a scythe build.
    if (s.whip) { this.spawnWhip(p.x, p.y, r, s.color, aimAng); Audio.whipCrack(); }
    else { this.spawnArc(p.x, p.y, r, s.color, aimAng); Audio.shoot(s._wid, s._behaviour); }
  }

  // ---- Katana ------------------------------------------------------------
  // The only true melee weapon in the game, and the first user of the 'melee'
  // behaviour (which the wound system already maps to a `gash` -- an open cut
  // across the blow rather than a bullet hole).
  //
  // It reads differently from the scythe on purpose: a much TIGHTER arc, so it
  // is a weapon you have to aim rather than one that clears a room, and a
  // short forward step on the swing so a hit feels committed. In exchange it
  // hits hard and, on a killing blow, cuts the enemy in half.
  weaponKatana(s, dt) {
    const p = this.player; const rs = this.run.stats;
    p.katanaCD = (p.katanaCD || 0) - dt;
    // Whirl Training (+melee attack speed) and Cycled Action (-manual weapon
    // cooldown) both land here: the katana is melee AND manual.
    // Whirl Training (+melee attack speed). The manual-cooldown passive is
    // applied centrally in computeWeaponStats instead, so it is not repeated
    // here -- doing both would stack it twice on the katana, which is the one
    // weapon that is melee AND manual.
    const pf = rs.flags || {};
    let fr = s.fireRate * rs.fireRateMult;
    if (pf.meleeSpeed) fr *= 1 + (rs.meleeSpeedAmt || 0.10);
    if (p.katanaCD > 0) return;
    p.katanaCD = 1 / fr;

    const reach = (s.area || 96) * rs.areaMult;
    const baseDmg = s.damage * rs.damageMult;
    const aimAng = Math.atan2(p.aimY || 0, p.aimX || 1);
    // Alternate the swing direction so consecutive strikes read as a combo
    // rather than the same animation replayed.
    p._katanaSwing = -(p._katanaSwing || 1);

    let anyHit = false;
    this.enemies.forEach((e) => {
      const edx = e.x - p.x, edy = e.y - p.y;
      const ed = Math.hypot(edx, edy);
      if (ed > reach) return;
      let da = Math.atan2(edy, edx) - aimAng;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      // ~78 degrees total, against the scythe's ~198. A katana is a line, not
      // a circle.
      if (Math.abs(da) > 0.68) return;
      anyHit = true;
      const dmg = this.rollDamage(baseDmg);
      const wasAlive = e.alive;
      const hpBefore = e.hp;
      this.dealDamage(e, dmg.dmg, dmg.crit, s.knockback || 40, p.x, p.y);
      // Cleave on a clean kill -- only on a kill, because splitting something
      // that survives would look absurd. Every ordinary enemy is included;
      // bosses are excluded on purpose, since they run their own death
      // sequence and a bisect on top of it would fight with it.
      if (wasAlive && !e.alive && !e.t.boss && hpBefore > 0) {
        this.spawnBisect(e.x, e.y, aimAng, e.t.color, e.t.size);
      }
    });

    // The blade always swings, hit or not -- a swing that only animates on
    // contact makes the weapon feel broken when you miss.
    this.spawnKatanaSlash(p.x, p.y, reach, s.color || '#dff4ff', aimAng, p._katanaSwing);
    if (anyHit) {
      this.cam.shake = Math.max(this.cam.shake, 5);
      // A short step INTO the cut. Carried on knockback so it decays on its
      // own rather than teleporting the player.
      p.vx = (p.vx || 0) + Math.cos(aimAng) * 90;
      p.vy = (p.vy || 0) + Math.sin(aimAng) * 90;
    }
    Audio.shoot(s._wid, s._behaviour);
  }

  // Four ways the blade moves, cycled so no two consecutive strikes look the
  // same. `dir` (+1/-1) still mirrors alternate swings; the STYLE changes how
  // far the arc travels, how fast, and how heavy it reads.
  //
  // The arc was also drawn at the weapon's full `area` (96px), which is the
  // HIT range — so the visual was as long as the reach in every direction at
  // once and read as a huge fan rather than a sword. It is scaled in per style
  // now; the hit box is untouched, so this is purely how it looks.
  static KATANA_STYLES = [
    // name        span(rad) reach  life  thick  lead
    { span: 1.10, reach: 0.55, life: 0.17, th: 0.20, lead: 2.4 },  // level cut
    { span: 0.70, reach: 0.46, life: 0.12, th: 0.14, lead: 2.0 },  // short flick
    { span: 1.52, reach: 0.6, life: 0.22, th: 0.27, lead: 3.0 },  // heavy sweep
    { span: 0.34, reach: 0.66, life: 0.14, th: 0.10, lead: 3.4 },  // thrust
  ];

  spawnKatanaSlash(x, y, reach, color, ang, dir) {
    const p = this.parts.acquire();
    const idx = (this._katanaStyle = ((this._katanaStyle || 0) + 1) % 4);
    const st = Game.KATANA_STYLES[idx];
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = st.life; p.max = st.life;
    p.color = color; p.size = reach * st.reach; p.type = 'katanaSlash';
    p._ang = ang; p._dir = dir || 1;
    p._span = st.span; p._th = st.th; p._lead = st.lead;
  }

  // A killing cut. Five ways a body comes apart, rolled per kill, so cutting
  // down a crowd never plays the same animation twice in a row. One clean
  // bisect every time made the katana's best moment become wallpaper within a
  // minute.
  //
  // Every variant respects `ang` -- the direction the blade actually travelled
  // -- because the whole point is that the cut reads as YOUR cut. A random
  // split angle would look like the body exploded, not like it was cut.
  spawnBisect(x, y, ang, color, size) {
    const S = size || 22;
    const roll = Math.random();
    // Weighted: the clean halves stay the signature, the rest are the spice.
    const variant =
      roll < 0.38 ? 'halves'      // straight through, two pieces
      : roll < 0.60 ? 'quarters'  // a second cut across the first
      : roll < 0.76 ? 'topoff'    // a shallow cut, small piece off one end
      : roll < 0.90 ? 'fan'       // three wedges, fanned apart
      : 'burst';                  // cut through and blown apart

    // Emits one body piece. `off` slides its start along the cut, `frac` sizes
    // it, `push` is how hard it leaves.
    const piece = (pAng, side, frac, off, push, life) => {
      const h = this.parts.acquire();
      const px = Math.cos(pAng + Math.PI / 2) * side;
      const py = Math.sin(pAng + Math.PI / 2) * side;
      // Offset along the cut line so pieces do not all start stacked on the
      // same point -- that is what made a split read as one object twitching.
      h.x = x + Math.cos(pAng) * off;
      h.y = y + Math.sin(pAng) * off;
      h.vx = px * push + Math.cos(pAng) * rand(-25, 25);
      h.vy = py * push + Math.sin(pAng) * rand(-25, 25) - rand(10, 45);
      h.life = life; h.max = life;
      h.color = color; h.size = S * frac;
      h.type = 'bisectHalf';
      h._ang = pAng; h._side = side;
      return h;
    };

    const cross = ang + Math.PI / 2 + rand(-0.3, 0.3);

    if (variant === 'halves') {
      piece(ang, -1, 0.5, 0, rand(40, 90), 1.85);
      piece(ang, 1, 0.5, 0, rand(40, 90), 1.85);
    } else if (variant === 'quarters') {
      // The blade came back through. Four pieces, two cut lines.
      for (const side of [-1, 1]) {
        piece(ang, side, 0.36, -S * 0.22, rand(50, 100), 1.80);
        piece(ang, side, 0.36, S * 0.22, rand(50, 100), 1.80);
      }
      this._cutFlash(x, y, cross, S * 1.3);
    } else if (variant === 'topoff') {
      // A shallow cut: one small piece leaves fast, the rest drops.
      piece(ang, -1, 0.28, S * 0.3, rand(110, 190), 1.90);
      piece(ang, 1, 0.62, -S * 0.1, rand(15, 40), 1.75);
    } else if (variant === 'fan') {
      // Three wedges opening away from the cut like a dealt hand.
      piece(ang, -1, 0.34, -S * 0.18, rand(70, 120), 1.80);
      piece(ang, 0.001, 0.34, 0, rand(20, 45), 1.85);
      piece(ang, 1, 0.34, S * 0.18, rand(70, 120), 1.80);
    } else {
      // Cut through AND blown apart: halves plus a shower of chunks.
      piece(ang, -1, 0.42, 0, rand(120, 200), 1.70);
      piece(ang, 1, 0.42, 0, rand(120, 200), 1.70);
      const n = this.fxCount(6);
      for (let i = 0; i < n; i++) {
        const c = this.parts.acquire();
        c.x = x; c.y = y;
        const a = Math.random() * TAU;
        const sp = rand(90, 230);
        c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp - rand(30, 90);
        c.life = rand(0.35, 0.7); c.max = c.life;
        c.color = color; c.size = rand(1.5, 3.4); c.type = 'chunk';
      }
      this.cam.shake = Math.max(this.cam.shake, 7);
    }

    // The primary cut line always flashes along the blade's path.
    this._cutFlash(x, y, ang, S * 1.6);
    // Two arterial fans, one out of each side of the cut, thrown PERPENDICULAR
    // to the blade — that is the direction a body actually opens. Full power:
    // a clean bisect is the biggest blood moment in the game.
    this.spawnArterialCone(x, y, ang + Math.PI / 2, color, 1.0);
    this.spawnArterialCone(x, y, ang - Math.PI / 2, color, 1.0);
    // Plus the existing droplet spatter along the blade, for texture.
    for (const d of [0, Math.PI]) {
      this.spawnPunctureHit(x, y, color, Math.cos(ang + d), Math.sin(ang + d));
    }
  }

  _cutFlash(x, y, ang, len) {
    const f = this.parts.acquire();
    f.x = x; f.y = y; f.vx = 0; f.vy = 0;
    f.life = 0.22; f.max = 0.22;
    f.color = '#ffffff'; f.size = len;
    f.type = 'cutLine'; f._ang = ang;
  }

  spawnWhip(x, y, len, color, ang) {
    const w = this.parts.acquire();
    w.x = x; w.y = y; w.vx = 0; w.vy = 0;
    w.life = 0.22; w.max = 0.22;
    w.color = color || '#4fd8ff'; w.size = len; w.type = 'whip';
    w._ang = ang;
    // Alternating curl so consecutive cracks mirror each other instead of
    // replaying one identical shape.
    this._whipFlip = !this._whipFlip;
    w._curl = this._whipFlip ? 1 : -1;
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
          if (Math.random() < 0.2) {
            this.spawnSpark(e.x, e.y, s.color);
            // Orbit weapons never "fire" once — they're continuously live —
            // so this ambient tick is the only sound they get, gated the
            // same way the spark itself is, plus Audio.impact's own
            // throttle underneath.
            Audio.impact('orbit');
          }
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
    // A beam ticks many times a second while attached — a sound per tick
    // would be a wall of noise, so this only plays on a NEW lock-on.
    if (t && t !== p._beamTarget) Audio.beamAcquire(s._wid);
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
    // Whistle-in now, boom lands ~420ms later — see meteorWhistleBoom in
    // audio.js, which already carries that same delay internally so the
    // sound and the visual fall land together.
    Audio.shoot(s._wid, s._behaviour);
  }

  weaponShotgun(s, dt) {
    const p = this.player; const rs = this.run.stats;
    if (p.reloading) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) { p.reloading = false; p.mag = (s.magazine || 6) + rs.magBonus; }
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
      Audio.shoot(s._wid, s._behaviour);
      this.spawnMuzzle(p.x + p.aimX * 22, p.y + p.aimY * 22, baseAng, s.color);
      if (p.mag <= 0) this.startReload(s);
    }
  }

  fireProjectile(x, y, ang, s, friendly = true, homing = 0) {
    const pr = this.projs.acquire();
    pr.x = x; pr.y = y;
    // Speed and range are now upgradeable (level-up cards + meta upgrades).
    // Both were hardcoded: every bolt flew at its weapon's fixed speed and
    // every bolt died at exactly 1.6s regardless of build, which is why shots
    // travelled the same enormous distance no matter what you picked.
    const spd = (s.projSpeed || 600) * (this.run.stats.projSpeedMult || 1);
    pr.vx = Math.cos(ang) * spd;
    pr.vy = Math.sin(ang) * spd;
    const dmg = this.rollDamage((s.damage || 10) * this.run.stats.damageMult, s.crit);
    pr.dmg = dmg.dmg; pr.crit = dmg.crit;
    // Kept alongside the resolved hit so a PIERCING shot can re-roll for each
    // enemy it passes through. Without these the single roll made at fire time
    // applied to everything on the line: one lucky shot crit an entire row,
    // one unlucky shot could not crit anything it touched.
    pr._baseDmg = (s.damage || 10) * this.run.stats.damageMult;
    pr._baseCrit = s.crit || 0;
    pr.pierce = (s.pierce || 0) + this.run.stats.pierceBonus;
    // Life is DIVIDED by the speed multiplier so that "range" means distance,
    // not time. A faster bolt covers more ground in the same 1.6s, so without
    // this a speed upgrade would silently be a range upgrade too and the two
    // stats would be impossible to tune independently.
    pr.life = 1.6 * (this.run.stats.projRangeMult || 1) / Math.max(0.25, this.run.stats.projSpeedMult || 1);
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
      Audio.burn();
    } else if (elementId === 'ice') {
      // Only chime the FIRST time this enemy chills, not every re-application
      // while it's already slowed — a burst of frost hits would otherwise
      // stack a wall of identical chimes.
      if (!(e._slowT > 0)) Audio.freeze();
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

  // Damage scale for a weapon once bonus projectiles are added on top of its
  // own count.
  //
  // Every weapon now starts at 1 projectile (2-3 for spread weapons), which
  // silently made "+1 projectile" the strongest effect in the game: it used to
  // be +11%..+50% on weapons that began with 2-9 shots, and became a flat
  // +100% DPS. Multishot maxes at 3 levels, so a single skill node was worth
  // +300%, with the meta Projectile Up stacking on top of that.
  //
  // Rather than gut the node, bonus projectiles simply hit softer than the
  // weapon's native ones — standard practice in the genre, and it keeps the
  // upgrade feeling identical on every weapon instead of being a jackpot on
  // some and a rounding error on others.
  //
  //   1 -> 2 projectiles now reads +65% DPS, not +100%
  //   3 -> 4 reads +22%, near enough the same relative gain
  bonusProjDamageScale(nativeCount, totalCount) {
    const extras = Math.max(0, totalCount - Math.max(1, nativeCount));
    if (extras <= 0) return 1;
    // Each bonus shot is worth 65% of a native one. Averaged across the volley
    // so callers can keep firing one damage value for every projectile.
    return (nativeCount + extras * 0.65) / totalCount;
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
  // ---- Stagnation --------------------------------------------------------
  // The anti-"stand still and win" rule, made mechanical instead of hoped-for.
  // A build strong enough to clear the screen without moving is a build the
  // player has earned — the answer is not to nerf it, it is to make standing
  // in one place stop being where the screen gets cleared FROM.
  //
  // Accumulates PATH LENGTH over a fixed SAMPLE window, then holds that
  // verdict until the next sample. Ramps `_stagnation` 0→1 over STAG_RAMP
  // seconds while parked, drains it three times faster while moving, so
  // re-engaging is rewarded immediately rather than serving a sentence.
  //
  // Two things here are deliberate and both were wrong in the first cut.
  //
  // 1. SAMPLE THE WINDOW, DON'T CHASE AN ANCHOR. The original compared the
  //    player against an anchor re-seeded to their feet on the very frame
  //    they got far enough from it. That made "moving" a ONE-FRAME state: a
  //    player running flat out cleared the radius, got a single frame of
  //    decay, then spent ~27 frames ramping again against a fresh anchor
  //    underneath them. Net +0.10/s while sprinting — stagnation pegged at
  //    1.0 seconds into every run, applying the AFK penalty to everyone and
  //    parking "THEY ARE CLOSING IN" on screen permanently.
  //
  // 2. PATH LENGTH, NOT DISPLACEMENT. Measuring how far the player ended up
  //    FROM a point punishes circle-strafing — and orbiting a tight arc while
  //    kiting is core play in this genre, not idling. Distance travelled is
  //    the honest "is anyone driving" signal: a player working a small circle
  //    at speed racks up path length, and an AFK player racks up zero.
  //    MOVED_MIN is ~25% of the 200px/s base speed over the window, so it
  //    only trips on near-total inactivity — being slowed, reloading or
  //    nudging all clear it comfortably.
  //
  // At full stagnation: +80% spawn rate and +35% enemy speed. That is a wall
  // of bodies converging on a stationary target — survivable for a few
  // seconds by a strong build, which is the point. It is a shove, not a
  // death sentence, and it goes away the instant you play the game.
  updateStagnation(dt) {
    const p = this.player;
    const SAMPLE = 1.5;     // seconds per verdict
    const MOVED_MIN = 75;   // px of path required in a window to count as active
    const STAG_RAMP = 9;
    const STAG_DECAY = 3;
    if (!this._stagPrev) { this._stagPrev = { x: p.x, y: p.y }; this._stagMoving = true; }
    this._stagDist = (this._stagDist || 0) + Math.hypot(p.x - this._stagPrev.x, p.y - this._stagPrev.y);
    this._stagPrev.x = p.x; this._stagPrev.y = p.y;
    this._stagSampleT = (this._stagSampleT || 0) + dt;
    if (this._stagSampleT >= SAMPLE) {
      this._stagSampleT = 0;
      this._stagMoving = this._stagDist > MOVED_MIN;
      this._stagDist = 0;
    }
    if (this._stagMoving) this._stagnation = Math.max(0, this._stagnation - dt / STAG_DECAY);
    else this._stagnation = Math.min(1, this._stagnation + dt / STAG_RAMP);
  }

  spawnWave(dt) {
    if (this.over) return;
    // The wave STOPS the moment a boss is on the field.
    //
    // A boss fight that keeps the ambient stream running is not a boss fight,
    // it is the same crowd with a bigger enemy somewhere in it — you never get
    // to read the boss's pattern because you are still being nibbled from
    // behind. Freezing the spawner turns it into a real duel: clear whatever
    // was already on screen, then it is you and it.
    //
    // Bosses that summon are unaffected: those calls go through spawnEnemy /
    // enemies.acquire directly, so a summoner still fills its own arena — which
    // is the point of being a summoner, and now reads as ITS mechanic rather
    // than as the background noise everyone shares.
    if (this.bossActive) { this.spawnTimer = 0; return; }
    const w = waveAt(this.run.time);
    this.spawnTimer += dt;
    // Density scales with the tier, with stagnation, and very mildly with the
    // player's own level — the same "your power buys the wave's power"
    // contract as the HP/damage menace terms in spawnEnemy.
    const levelDensity = Math.min(1.6, 1 + (this.run.level - 1) * 0.018);
    const rate = w.spawn
      * (this.spawnMultExtra || 1)
      * this.diff.spawnMult
      * levelDensity
      * (1 + this._stagnation * 0.8);
    const spawnInterval = 1 / rate;
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
    const dist = this.viewSpan() * 0.42 + rand(20, 60);
    const x = clamp(p.x + Math.cos(ang) * dist, 30, this.world.w - 30);
    const y = clamp(p.y + Math.sin(ang) * dist, 30, this.world.h - 30);
    const e = this.enemies.acquire();
    e.x = x; e.y = y; e.vx = 0; e.vy = 0;
    e.t = t;
    const D = this.diff;
    // ---- The three pressure curves ----------------------------------------
    // TIME    — the slow bed. Steepened (240→190) because the mid-game had a
    //           long flat stretch you simply out-geared.
    // MILESTONE — bosses killed. Player-paced: struggling for longer between
    //           kills does not also raise the difficulty, and steamrolling
    //           them does. This stays the dominant lever.
    // MENACE  — the player's own run level. This is the one that answers
    //           "you should never be so strong you can stand still": every
    //           card you take makes the wave that much heavier, so power
    //           growth buys you *reach*, not safety. Deliberately mild per
    //           level (5.5% HP / 3.5% damage) because it compounds against
    //           the other two, and it is capped so a 40-minute endless run
    //           does not turn into a wall of unkillable statues.
    const menace = Math.min(2.2, 1 + (this.run.level - 1) * 0.055);
    const menaceDmg = Math.min(1.9, 1 + (this.run.level - 1) * 0.035);
    const scale = 1 + this.run.time / 190;
    e.dmgMult = (1 + this.run.time / 200) * (1 + this.bossesKilled * 1.6) * menaceDmg * D.dmgMult;
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
    // Stagnation (see updateStagnation) rides on top of speed rather than on
    // damage: an AFK player should be OVERRUN, not chipped down. Being caught
    // is the punishment; the enemies that catch you hit for their normal
    // amount.
    e.speedMult = 1.12 * (1 + this.bossesKilled * 0.12) * D.speedMult * (1 + this._stagnation * 0.35);
    const bossHp = t.boss ? D.bossHpMult : D.hpMult;
    e.maxHp = Math.floor(t.hp * scale * 3 * (1 + this.bossesKilled * 0.25) * menace * bossHp);
    e.hp = e.maxHp;
    e.hit = 0; e.cd = 0; e.dz = 0;
    e.kbX = 0; e.kbY = 0;
    e._hitCD = 0;
    e._woundStage = 0; e._wounds.length = 0;
    // Melee-strike state — pooled objects keep whatever the previous
    // occupant left behind, so a recycled enemy could otherwise spawn
    // mid-windup or permanently unable to attack.
    e._windup = 0; e._strikeT = 0; e._atkCD = rand(0.6, 2.0);
    e._atkDX = 0; e._atkDY = 0;
    e._lunging = false; e._lungeT = 0;
    if (e._marks) e._marks.length = 0;
    e._burn = 0; e._slowT = 0; e._poisonT = 0; e._poisonStacks = 0;

    // Variant roll. Nothing is varianted in the opening minute — the first
    // wave should teach the base enemy before it starts teaching exceptions.
    e.variant = null; e._shell = 0; e._leechCD = 0;
    const vChance = Math.min(0.30, Math.max(0, (this.run.time - 60) / 900) + this.bossesKilled * 0.05);
    if (!t.boss && Math.random() < vChance) {
      e.variant = VARIANT_IDS[(Math.random() * VARIANT_IDS.length) | 0];
      if (e.variant === 'armored') {
        // The shell is a damage pool, not a hit count: a big single hit should
        // crack it, which is the whole point of the variant.
        e._shell = e.maxHp * 0.35;
        e.maxHp = Math.floor(e.maxHp * 1.15);
        e.hp = e.maxHp;
      }
      if (e.variant === 'leeching') e._leechCD = rand(1.5, 3);
    }
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
    const dist = this.viewSpan() * (0.55 + Math.random() * 0.5);
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
    const dist = this.viewSpan() * (0.6 + Math.random() * 0.5);
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
    const dist = this.viewSpan() * 0.42;
    const e = this.enemies.acquire();
    // Clamp to world bounds so the boss always spawns on the actual map —
    // otherwise the guide arrow can point at an unreachable off-map location.
    e.x = clamp(p.x + Math.cos(ang) * dist, 60, this.world.w - 60);
    e.y = clamp(p.y + Math.sin(ang) * dist, 60, this.world.h - 60);
    e.t = t;
    // ---- Boss HP is tuned to fight LENGTH, not to difficulty --------------
    // Target window: 25-45 seconds at the player's expected power for the
    // checkpoint. Under 5s and the fight never registers as an event; over
    // 90s and it stops being climactic and starts being a slog.
    //
    // Scaling with the player's run level is what HOLDS that window: player
    // DPS grows roughly with level, so boss HP growing alongside it keeps the
    // fight the same length at level 7 and at level 25. The difficulty tier's
    // bossHpMult is the one term that deliberately breaks the window — a
    // Nightmare guardian is SUPPOSED to take longer than you can survive
    // standing in front of it.
    const bossMenace = Math.min(2.2, 1 + (this.run.level - 1) * 0.055);
    e.maxHp = Math.floor(
      t.hp * 2.6
      * (1 + this.run.time / 600)
      * (1 + this.bossesKilled * 0.35)
      * bossMenace
      * this.diff.bossHpMult
    );
    e.hp = e.maxHp;
    // These come from a POOL. spawnEnemy sets them on every acquire; this
    // function never did, so a boss could inherit whatever damage multiplier,
    // variant or status timers the last enemy to occupy the slot left behind
    // — which made boss damage quietly depend on what died most recently.
    e.dmgMult = (1 + this.run.time / 200) * (1 + this.bossesKilled * 0.8) * this.diff.dmgMult;
    e.speedMult = 1;
    e.tier = this.bossesKilled + 1;
    e.variant = null; e._shell = 0; e._leechCD = 0;
    e._burn = 0; e._slowT = 0; e._poisonT = 0; e._poisonStacks = 0;
    e._windup = 0; e._strikeT = 0; e._atkCD = rand(0.6, 1.6);
    e._atkDX = 0; e._atkDY = 0; e._lunging = false; e._lungeT = 0;
    if (e._marks) e._marks.length = 0;
    e.hit = 0; e.cd = 0; e.dz = 0; e.kbX = 0; e.kbY = 0;
    // Pooled objects otherwise inherit the previous occupant's swing timer, so
    // a freshly spawned enemy could arrive already on cooldown and walk
    // through the player harmlessly for a second.
    e._hitCD = 0;
    e._woundStage = 0; e._wounds.length = 0;
    // Reset boss-specific state flags so recycled pool objects start clean
    e._hasFleed = false; e._fleeing = false; e._fleeTimer = 0;
    e._summonCD = undefined; e._voidCD = undefined;
    this.bossActive = e;
    this.cam.shake = 18;
    this.cam.slowmo = 0.6;
    this.spawnDamageNumber(p.x, p.y - 60, t.name.toUpperCase() + '!', t.color || '#fff');
  }

  // The companion is not player-controlled and doesn't fight back — the
  // objective is purely "clear the crowd around them before they go down".
  // Contact damage is deliberately gentler than the player's own (0.4x,
  // unmitigated by armor/dodge since they have none) so losing them reads
  // as a real failure to clear the area in time, not an unwinnable timer.
  updateCompanion(dt) {
    const c = this.companionNpc;
    if (!c || !c.alive) return;
    c.hit = Math.max(0, c.hit - dt);
    const R = c.r + this._maxEnemyR + 4;
    let dmg = 0;
    this.enemyGrid.query(c.x, c.y, R, (e) => {
      if (!e.alive) return;
      const d2 = dist2(e.x, e.y, c.x, c.y);
      const touchR = c.r + (e.t?.size || 12) * 0.5;
      if (d2 <= touchR * touchR) dmg += (e.t?.dmg || 6) * 0.4 * dt;
    });
    if (dmg > 0) {
      c.hp = Math.max(0, c.hp - dmg);
      c.hit = 0.15;
      if (c.hp <= 0) {
        c.alive = false;
        this.spawnDamageNumber(c.x, c.y - 20, `${c.name} DOWN`, '#ff5566', 16);
        Audio.hit();
      }
    }
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
      // Leeching: periodically heals nearby wounded enemies. Cheap on its
      // own, brutal in a pack — which is exactly the "kill that one first"
      // decision it exists to create.
      if (e.variant === 'leeching') {
        e._leechCD -= dt;
        if (e._leechCD <= 0) {
          e._leechCD = 2.2;
          const R = 150;
          let healed = 0;
          this.enemyGrid.query(e.x, e.y, R + this._maxEnemyR, other => {
            if (healed >= 4 || !other.alive || other === e) return;
            if (other.hp >= other.maxHp) return;
            if (dist2(other.x, other.y, e.x, e.y) > R * R) return;
            other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.08);
            healed++;
            this.spawnSpark(other.x, other.y, '#7ad96b');
          });
          if (healed > 0) this.spawnRing(e.x, e.y, R * 0.5, '#7ad96b', 0.28);
        }
      }

      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      if (e._blightBuffT > 0) { e._blightBuffT -= dt; if (e._blightBuffT <= 0) e._blightSpeedBuff = 1; }
      let spd = t.speed * slowMul * (e._slowT > 0 ? (e._slowMult || 1) : 1) * (e.speedMult || 1) * (e._blightSpeedBuff || 1) * this.weatherEnemySpeed();
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
            const retDist = this.viewSpan() * 0.75;
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
      // === A.I.D.A. — the only boss with no pattern at all ===
      //
      // She is the story's antagonist and she fought like a slime that had
      // been scaled up: walk at the player, touch them. Everything else in the
      // roster had a mechanic and she had a health bar.
      //
      // Hers is BLINK-AND-SWEEP, built to be read rather than dodged by luck:
      // she teleports to a firing position, telegraphs, then sweeps a rotating
      // laser fan. The tell is long enough to react to and the punish is real.
      // Between sweeps she launches homing seekers, so standing still to wait
      // out the laser is its own mistake.
      if (t.id === 'bossAida') {
        e._aidaState = e._aidaState || 'move';
        e._aidaT = (e._aidaT !== undefined ? e._aidaT : 2.4) - dt;

        // Phase 2 below half health: everything cycles faster and the fan
        // gains arms, so the fight escalates without new rules to learn.
        const hard = e.hp < e.maxHp * 0.5;
        if (hard && !e._aidaPhase2) {
          e._aidaPhase2 = true;
          this.spawnDamageNumber(e.x, e.y - 52, 'PROTOCOL: PURGE', '#ff5ef5');
          this.cam.shake = Math.max(this.cam.shake, 12);
          this.spawnRing(e.x, e.y, t.size * 1.6, '#ff5ef5', 0.7);
        }

        if (e._aidaState === 'move') {
          // Drifts, then blinks to a ring position around the player so she
          // never simply body-blocks. Blinking rather than walking is what
          // makes her read as a machine.
          if (e._aidaT <= 0) {
            const ba = Math.random() * TAU;
            const bd = 200 + Math.random() * 90;
            this.spawnRing(e.x, e.y, t.size, '#9fd8ff', 0.35);
            e.x = clamp(p.x + Math.cos(ba) * bd, 40, this.world.w - 40);
            e.y = clamp(p.y + Math.sin(ba) * bd, 40, this.world.h - 40);
            this.spawnRing(e.x, e.y, t.size * 1.2, '#ff5ef5', 0.4);
            e._aidaState = 'telegraph';
            e._aidaT = hard ? 0.75 : 1.05;
            e._aidaAim = Math.atan2(p.y - e.y, p.x - e.x);
          }
        } else if (e._aidaState === 'telegraph') {
          // The tell: thin warning beams along exactly where the fan will go.
          e._aidaAim += (Math.atan2(p.y - e.y, p.x - e.x) - e._aidaAim) * Math.min(1, dt * 2.2);
          const arms = hard ? 5 : 3;
          for (let a2 = 0; a2 < arms; a2++) {
            const ang2 = e._aidaAim + (a2 - (arms - 1) / 2) * 0.42;
            const w2 = this.parts.acquire();
            w2.x = e.x; w2.y = e.y; w2.vx = 0; w2.vy = 0;
            w2.life = 0.08; w2.max = 0.08;
            w2.color = '#ff5ef5'; w2.size = 620; w2.type = 'lightning';
            w2.vx = e.x + Math.cos(ang2) * 620;
            w2.vy = e.y + Math.sin(ang2) * 620;
          }
          if (e._aidaT <= 0) {
            e._aidaState = 'sweep';
            e._aidaT = hard ? 1.5 : 1.1;
            e._aidaSweep = 0;
            Audio.active('lightning');
          }
        } else if (e._aidaState === 'sweep') {
          // The fan rotates through its arc, firing continuously. Standing
          // inside the arc is fatal; the gap between arms is the safe lane.
          const arms = hard ? 5 : 3;
          e._aidaSweep = (e._aidaSweep || 0) + dt * (hard ? 2.1 : 1.5);
          e._aidaFire = (e._aidaFire || 0) - dt;
          if (e._aidaFire <= 0) {
            e._aidaFire = 0.06;
            for (let a2 = 0; a2 < arms; a2++) {
              const ang2 = e._aidaAim + (a2 - (arms - 1) / 2) * 0.42 + e._aidaSweep;
              const evp = this.eprojs.acquire();
              evp.x = e.x; evp.y = e.y;
              evp.vx = Math.cos(ang2) * 330; evp.vy = Math.sin(ang2) * 330;
              evp.dmg = t.dmg * (e.dmgMult || 1) * 0.30;
              evp.life = 2.4; evp.color = '#ff5ef5'; evp.size = 7; evp.homing = 0;
            }
          }
          if (e._aidaT <= 0) { e._aidaState = 'seek'; e._aidaT = 0.5; }
        } else {
          // Seekers between sweeps, so waiting out the laser is not free.
          if (e._aidaT <= 0) {
            const n2 = hard ? 5 : 3;
            for (let i2 = 0; i2 < n2; i2++) {
              const a2 = Math.random() * TAU;
              const evp = this.eprojs.acquire();
              evp.x = e.x + Math.cos(a2) * t.size;
              evp.y = e.y + Math.sin(a2) * t.size;
              evp.vx = Math.cos(a2) * 120; evp.vy = Math.sin(a2) * 120;
              evp.dmg = t.dmg * (e.dmgMult || 1) * 0.45;
              evp.life = 4.5; evp.color = '#9fd8ff'; evp.size = 9; evp.homing = 1.6;
            }
            e._aidaState = 'move';
            e._aidaT = hard ? 1.5 : 2.2;
          }
        }
        // She holds position while telegraphing and sweeping — a boss that
        // walks at you during its own attack cannot be sidestepped.
        if (e._aidaState !== 'move') spd = 0;
      }

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
            if (dist2(e.x, e.y, p.x, p.y) <= (t.size * 1.4) ** 2 && p.iframes <= 0 && !this.rollDodge()) {
              p.hp -= this.mitigate(t.dmg * (e.dmgMult || 1) * 0.6);
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

      // ---- Break up the conga line -------------------------------------
      //
      // Spawn angles are already random around the player, but every enemy
      // then steers at the player's CURRENT position. Once the player is
      // moving, all of them converge onto the same point and collapse into a
      // single trailing column — you spend the run backing away from one queue
      // and the XP orbs are all inside it, which is the opposite of how this
      // genre is supposed to feel. Two forces fix it, and both are needed.
      //
      // 1. SEPARATION. Enemies push each other apart, so a crowd spreads into
      //    a front instead of a file. Uses the existing broadphase, and only
      //    looks at close neighbours, so it stays cheap with hundreds alive.
      let sepX = 0, sepY = 0;
      const sepR = t.size * 1.35;
      this.enemyGrid.query(e.x, e.y, sepR, (o) => {
        if (o === e || !o.alive) return;
        const ox = e.x - o.x, oy = e.y - o.y;
        const od2 = ox * ox + oy * oy;
        if (od2 <= 0.01 || od2 > sepR * sepR) return;
        const od = Math.sqrt(od2);
        // Falls off with distance so contact shoves hard and neighbours drift.
        const w = (1 - od / sepR) / od;
        sepX += ox * w; sepY += oy * w;
      });

      // 2. INTERCEPT. Each enemy aims slightly ahead of where the player is
      //    GOING rather than where they are, by an amount fixed per enemy.
      //    Identical lead would just move the queue; a spread of leads fans
      //    them across the player's path so you have to weave, which is what
      //    opens up the ground the orbs are lying on.
      if (e._lead === undefined) e._lead = rand(0, 0.55);
      const ix = nx + (p.vx || 0) * e._lead * 0.004;
      const iy = ny + (p.vy || 0) * e._lead * 0.004;
      const il = Math.hypot(ix, iy) || 1;

      e.x += (ix / il) * spd * dt + sepX * 26 * dt + e.kbX * dt;
      e.y += (iy / il) * spd * dt + sepY * 26 * dt + e.kbY * dt;
      e.x = clamp(e.x, 20, this.world.w - 20);
      e.y = clamp(e.y, 20, this.world.h - 20);
      e.kbX *= Math.pow(0.001, dt);
      e.kbY *= Math.pow(0.001, dt);

      // Wounded enemies keep bleeding between hits.
      this._updateBleed(e, dt);

      const sumR = (t.size / 2) + p.r;

      // Contact separation.
      //
      // There used to be a `// separation - mild` comment here with no code
      // under it, and that was the whole bug: nothing ever stopped an enemy
      // from walking INTO the player. `nx`/`ny` are recomputed toward the
      // player every frame, so once one arrived it drove itself into the
      // hitbox, overshot, flipped, and jittered on the spot -- visually glued
      // to the character. Contact damage kept retriggering on its 0.32s
      // cooldown the entire time, so anything faster than the player (the
      // small ones especially) was unshakeable and simply ground you down.
      //
      // Pushing the enemy back onto the contact ring keeps it threatening --
      // it still touches, and the damage check below still fires -- but it can
      // no longer occupy the same space as the player, so you can always walk
      // out of it. Bosses are exempt: their size makes the ring huge, and
      // being shoved off a boss would read as the boss backing away.
      if (!t.boss) {
        const sx = e.x - p.x, sy = e.y - p.y;
        const sd = Math.hypot(sx, sy);
        if (sd < sumR) {
          // At sd == 0 there is no meaningful direction to push along, so fall
          // back to the approach normal rather than dividing by zero.
          const ux = sd > 0.001 ? sx / sd : -nx;
          const uy = sd > 0.001 ? sy / sd : -ny;
          e.x = clamp(p.x + ux * sumR, 20, this.world.w - 20);
          e.y = clamp(p.y + uy * sumR, 20, this.world.h - 20);
        }
      }

      // collision with player
      if (d < sumR + 4 && (this.run.stats.flags || {}).venomBite) {
        e._venomCD = (e._venomCD || 0) - dt;
        if (e._venomCD <= 0) {
          e._venomCD = 1.0;
          e._poisonStacks = Math.min(8, (e._poisonStacks || 0) + 1);
          e._poisonT = 4;
          this.spawnSpark(e.x, e.y, '#7ad96b');
        }
      }
      // Per-enemy attack cooldown, on top of the global i-frames.
      //
      // The design intent for 70 starting HP is "four mistakes before you die"
      // (see the maxHp comment). With only a 0.32s global window, four hits
      // from a 17-damage enemy land in 1.3 SECONDS — so the mechanic was
      // counting time-in-contact while the design was counting mistakes.
      // Standing next to something for a second and a bit is one mistake, and
      // it killed you. That is the "I just poof die" report.
      //
      // Giving each enemy its own ~1s swing timer separates the two: an
      // individual enemy can only land a hit a second, so four hits really is
      // four approaches, while the much shorter global window still lets a
      // desynchronised crowd hurt faster than a single chaser — which is the
      // reason the global window was tightened in the first place.
      e._hitCD = Math.max(0, (e._hitCD || 0) - dt);
      if (d < sumR + 4 && p.iframes <= 0 && e._hitCD <= 0) {
        if (p.shieldCharge > 0) {
          p.shieldCharge = 0; p.shieldCD = 25;
          p.iframes = 0.7;
          this.spawnRing(p.x, p.y, 40, '#4dffd4', 0.4);
          this.spawnDamageNumber(p.x, p.y - 10, 'BLOCK', '#4dffd4');
          this.cam.shake = Math.max(this.cam.shake, 3);
        } else if (!this.rollDodge()) {
          const f = this.run.stats.flags || {};
          const dmg = this.mitigate(t.dmg * (e.dmgMult || 1));
          // Reflect
          if (f.reflect) { this.dealDamage(e, dmg * 0.3, false, 0, p.x, p.y, true); }
          // Thorns: return a share of what you just took, to whatever hit you.
          // Separate from `reflect` on purpose -- they stack, and Thorns scales
          // with its own card amount.
          if (f.thorns) {
            this.dealDamage(e, dmg * (this.run.stats.thornsAmt || 0.25), false, 30, p.x, p.y, true);
            this.spawnSpark(e.x, e.y, '#8fe36b');
          }
          // Grit damage reduction
          const reduce = f.grit && (p._gritT || 0) > this.run.time ? 0.7 : 1.0;
          p.hp -= dmg * reduce;
          if (f.grit) p._gritT = this.run.time + 2;
          this.run.noHit = false;
          p.hit = 0.15;
          // Half a second of invulnerability per contact meant a wall of
          // enemies could only ever land two hits a second no matter how
          // many of them were touching you. Standing in a crowd should hurt
          // roughly in proportion to the crowd.
          // Short global window: just enough that two enemies cannot both
          // resolve on the same frame. The real throttle is `_hitCD` above.
          p.iframes = 0.15;
          e._hitCD = 1.0;
          // Shove the attacker back out past the damage ring after it lands a
          // hit.
          //
          // This is the other half of the contact-separation fix. Before that
          // fix, enemies drove into the player and jittered, and the jitter
          // accidentally carried them outside `sumR + 4` between frames — you
          // got intermittent contact and a chance to escape. Pinning them to
          // the ring made contact CONTINUOUS: a fresh 70 HP player against a
          // 17-damage ghoul on a 0.32s cooldown is 53 dps, i.e. dead in 1.3
          // seconds, which reads as dying for no reason at all.
          //
          // A hit now buys space. It decays through the normal knockback
          // damping, so a slow enemy loses a beat and a fast one closes again
          // almost immediately — the pressure stays, the instant death does
          // not.
          {
            const kdx = e.x - p.x, kdy = e.y - p.y;
            const kd = Math.hypot(kdx, kdy) || 1;
            e.kbX += (kdx / kd) * 260;
            e.kbY += (kdy / kd) * 260;
          }
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
          // Every enemy gets its OWN crit roll. The first target uses the roll
          // made when the shot was fired; each further target a piercing shot
          // reaches rolls fresh. Crit is a property of a HIT, not of a bullet —
          // sharing one roll across a row meant a big piercing shot either crit
          // on everything it touched or on nothing, which is exactly the
          // "it crits all of them at once" complaint.
          let hitDmg = pr.dmg, hitCrit = pr.crit;
          if (pr._hitCount) {
            const r = this.rollDamage(pr._baseDmg, pr._baseCrit);
            hitDmg = r.dmg; hitCrit = r.crit;
          }
          pr._hitCount = (pr._hitCount || 0) + 1;
          this.dealDamage(e, hitDmg, hitCrit, pr.knockback, pr.x, pr.y, false, pr.color);
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
          // Prism Core (Prospector unique): the bolt refracts on its FIRST
          // contact only — `_split` is the guard, without which a piercing
          // shot would fork at every enemy it passed through and the screen
          // would fill with shards.
          if ((this.run.stats.flags || {}).prismCore && !pr._split) {
            pr._split = true;
            const baseAng = Math.atan2(pr.vy, pr.vx);
            const sp = Math.hypot(pr.vx, pr.vy);
            for (const side of [-1, 1]) {
              const sh = this.projs.acquire();
              const a2 = baseAng + side * 0.42;
              sh.x = e.x; sh.y = e.y;
              sh.vx = Math.cos(a2) * sp; sh.vy = Math.sin(a2) * sp;
              sh.dmg = pr.dmg * 0.55; sh.crit = false;
              sh.pierce = 0; sh.life = 0.7; sh.size = Math.max(2, (pr.size || 5) * 0.65);
              sh.color = pr.color; sh.friendly = true; sh.homing = 0;
              sh.knockback = 0; sh.explode = 0;
              sh._split = true;              // shards cannot themselves refract
              sh._element = pr._element; sh._wid = pr._wid;
              sh._weaponBehaviour = pr._weaponBehaviour;
              sh.hit.clear(); sh.hit.add(e);
            }
          }
          // Conductive Rounds passive: plain bullet-type hits (not
          // orbit/aoe/beam/chain weapons, which already have their own
          // multi-target mechanics) can arc to nearby enemies.
          const bounces = Math.floor(this.run.stats.conductiveBounces || 0);
          if (bounces > 0 && pr._weaponBehaviour === 'projectile') {
            this.applyConductiveBounce(e.x, e.y, pr.dmg, bounces, new Set([e]));
          }
          // Core Overload (Prospector unique): a critical hit is not stopped
          // by anything it touches.
          const critPierces = pr.crit && (this.run.stats.flags || {}).coreOverload;
          if (!critPierces) {
            if (pr.pierce <= 0) {
              if (pr.explode > 0) this.explodeProjectile(pr);
              this.projs.release(pr); return;
            }
            pr.pierce -= 1;
          }
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
        if (!this.rollDodge()) {
          const dmg = this.mitigate(ep.dmg);
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
            if (!this.rollDodge()) {
              const dmg = this.mitigate(p._dmg);
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
      if (p.type === 'lightning' || p.type === 'wave' || p.type === 'whip') {
        p.life -= dt;
        if (p.life <= 0) this.parts.release(p);
        return;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.05, dt);
      p.vy *= Math.pow(0.05, dt);
      // Spike trap: sits armed until something walks over it, then fires once.
      if (p.type === 'spikeTrap') {
        p._armed = (p._armed || 0) - dt;
        if (!p._used && p._armed <= 0) {
          this.enemies.forEach((en) => {
            if (p._used) return;
            if (dist2(en.x, en.y, p.x, p.y) > p.size * p.size) return;
            p._used = true;
            const r = p.size;
            this.enemies.forEach((e2) => {
              if (dist2(e2.x, e2.y, p.x, p.y) > r * r) return;
              this.dealDamage(e2, p._dmg, false, 120, p.x, p.y, true);
            });
            this.spawnRing(p.x, p.y, r, '#dfe8ff', 0.3);
            p.life = Math.min(p.life, 0.25);
          });
        }
      }
      if (p.type === 'blood') p.vy += 200 * dt;
      // Skin flakes fall, but flutter: light and broad, so they slow down fast
      // and drift rather than arcing like a chunk of meat.
      if (p.type === 'skinFlake') {
        p.vy += 150 * dt;
        p.vx *= Math.pow(0.22, dt);
        p.vy *= Math.pow(0.5, dt);
      }
      if (p.type === 'chunk') p.vy += 260 * dt; // dismembered flesh chunks fall
      if (p.type === 'casing') {
        if (p._settled) {
          // Come to rest on the floor instead of drifting off-screen — the
          // point of the longer lifetime is that spent brass lies where it
          // landed for a moment.
          p.vx = 0; p.vy = 0;
        } else {
          p.vy += 420 * dt;
          p._rot = (p._rot || 0) + (p._rotSpd || 0) * dt;
          if (p._restY === undefined) p._restY = p.y + rand(12, 30);
          if (p.y >= p._restY && p.vy > 0) { p._settled = true; p.y = p._restY; Audio.casingLand(); }
        }
      }
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
        if (g.xp > 0) {
          this.addXp(g.xp);
          // Same size tiers _drawGems uses for the crystal's own scale (see
          // pixiRenderer.js) — a big drop should sound like a bigger moment,
          // not just look like one.
          const orbSize = g.xp <= 2 ? 1 : g.xp <= 6 ? 1.3 : g.xp <= 15 ? 1.7 : 2.2;
          Audio.xpPing(Math.min(1, this.run.xp / this.run.xpToNext), orbSize);
        }
        if (g.gold > 0) { this.run.gold += g.gold; Audio.gold(g.gold); }
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
    else if (!silent) Audio.impact(s._behaviour); // silent hits are per-frame DoT ticks — see orbit/beam
    if ((s.flags || {}).burnDoT) e._burn = Math.max(e._burn || 0, 3);

    // ---- Passive card effects ---------------------------------------------
    // These ten flags were declared on their cards but READ NOWHERE, so every
    // one of them was a dead pick: you chose "Ricochet" out of three offers
    // and got nothing at all. Implemented here, at the one point every hit
    // passes through.
    const pf = s.flags || {};

    // Frostbite: chilled foes take more. Read before the damage lands so it
    // scales the hit that is being dealt right now.
    if (pf.frostbite && (e._slowT > 0 || e._frozen > 0)) dmg *= 1.20;

    // Death Mark: shots into a slowed/marked foe hit harder. Same idea as
    // Frostbite but a bigger bonus on a narrower condition.
    if (pf.deathMark && e._slowT > 0) dmg *= 1.30;

    // Lightning Crit: a crit arcs to two nearby foes. Guarded against
    // re-entry for the same reason the other arcs are.
    if (!silent && crit && pf.lightningOnCrit && !e._critArcNow) {
      e._critArcNow = true;
      let prev = e;
      const hit = new Set([e]);
      for (let j = 0; j < 2; j++) {
        const next = this.nearestEnemyExcluding(prev.x, prev.y, 210, prev);
        if (!next || hit.has(next)) break;
        this.spawnLightning(prev.x, prev.y, next.x, next.y, '#bfe8ff');
        this.dealDamage(next, dmg * 0.5, false, 24, prev.x, prev.y, true);
        hit.add(next); prev = next;
      }
      e._critArcNow = false;
    }

    // Executioner: anything already broken dies to any hit. Bosses exempt --
    // an instant-kill on a boss would trivialise the fight it gates.
    if (pf.executioner && !e.t.boss && e.maxHp > 0 && e.hp / e.maxHp <= 0.15) {
      dmg = e.hp + 1;
      if (!silent) this.spawnDamageNumber(e.x, e.y - e.t.size * 0.7, 'EXECUTE', '#ff3146');
    }

    // Electric Rounds / Live Wire: the hit arcs onward. `silent` hits are
    // per-frame DoT ticks (orbit/beam) -- arcing off those would fire sixty
    // times a second, so they are excluded.
    if (!silent && (pf.electricRounds || pf.liveWire)) {
      const isManual = s._wtype === 'manual';
      // Live Wire is the manual-weapon upgrade of the same idea: more jumps,
      // but only off a manual weapon.
      const jumps = pf.liveWire && isManual ? 3 : (pf.electricRounds ? 1 : 0);
      if (jumps > 0 && !e._arcingNow) {
        // Guard against re-entry: dealDamage below can arc again off the
        // enemy it just hit and recurse until the stack blows.
        e._arcingNow = true;
        let prev = e;
        const hit = new Set([e]);
        for (let j = 0; j < jumps; j++) {
          let next = null; let bestD = 190;
          this.enemies.forEach((en) => {
            if (hit.has(en) || en === e) return;
            const cd = Math.hypot(en.x - prev.x, en.y - prev.y);
            if (cd < bestD) { bestD = cd; next = en; }
          });
          if (!next) break;
          this.spawnLightning(prev.x, prev.y, next.x, next.y, '#9fd8ff');
          this.dealDamage(next, dmg * 0.45, false, 20, prev.x, prev.y, true);
          hit.add(next); prev = next;
        }
        e._arcingNow = false;
      }
    }

    // Ricochet: the shot bounces once to a nearby foe for reduced damage.
    // Same re-entry guard, same reason.
    if (!silent && pf.ricochet && !e._ricochetNow) {
      const t2 = this.nearestEnemyExcluding(e.x, e.y, 170, e);
      if (t2) {
        e._ricochetNow = true;
        this.spawnSpark(t2.x, t2.y, '#dfe8ff');
        this.dealDamage(t2, dmg * 0.5, false, 20, e.x, e.y, true);
        e._ricochetNow = false;
      }
    }
    if ((s.flags || {}).vampire && !silent) {
      const vAmt = s.vampireAmt || 0.001;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + dmg * vAmt);
    }
    // Armored: the shell soaks damage at half rate until it breaks. Absorbed
    // damage is not wasted — half of it still reaches the body — so chipping
    // works, it is just much worse than one big hit.
    if (e._shell > 0) {
      const soak = Math.min(e._shell, dmg);
      e._shell -= soak;
      dmg -= soak * 0.5;
      if (e._shell <= 0) {
        e._shell = 0;
        this.spawnRing(e.x, e.y, e.t.size * 0.9, '#9fb4c8', 0.35);
        this.spawnDamageNumber(e.x, e.y - e.t.size * 0.6, 'SHELL BROKEN', '#9fb4c8', 13);
        for (let i = 0; i < this.fxCount(8); i++) this.spawnSpark(e.x, e.y, '#9fb4c8');
      }
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
    // Direction of travel of whatever hit them: from the impact point toward
    // the body. spawnHitSparks below already derives this; blood now uses the
    // same vector so spatter and sparks agree on where the shot came from.
    const _hdx = e.x - (ox ?? e.x), _hdy = e.y - (oy ?? e.y);
    const _hl = Math.hypot(_hdx, _hdy) || 1;
    this.spawnPunctureHit(ox, oy, bloodColor, _hdx / _hl, _hdy / _hl);
    this._addImpactMark(e, ox, oy, impactAccent);
    // Hit sparks use the impact accent (weapon/muzzle light color) — small,
    // transient, additive-looking flash particles are the right place for
    // "what hit me" color feedback; the blood itself stays enemy-colored.
    // Elemental flavor (embers/ice/etc) is inferred from that same accent
    // color so it reads correctly per-weapon without needing every weapon
    // tagged yet (see the Elemental system backlog item).
    // Pass the incoming direction so sparks spray back along the shot rather
    // than radiating evenly from the enemy's centre.
    if (!silent) {
      const idx = e.x - (ox ?? e.x), idy = e.y - (oy ?? e.y);
      const il = Math.hypot(idx, idy) || 1;
      this.spawnHitSparks(ox ?? e.x, oy ?? e.y, impactAccent, dmg, crit, idx / il, idy / il);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  // A small permanent mark on the enemy's own body at the exact point the
  // shot landed — a bullet hole, a scorch, or a frost bloom depending on what
  // hit it. Distinct from _wounds, which are the big 10%-HP flesh tears:
  // these are per-shot, so a body visibly fills with holes as you work on it.
  //
  // Stored in the enemy's LOCAL space so the marks travel with it. Capped,
  // because a long boss fight would otherwise grow this list for the whole
  // duration of the fight (the same bug _wounds already had).
  _addImpactMark(e, ox, oy, accent) {
    if (!e.alive || !e.t) return;
    if (!e._marks) e._marks = [];
    const R = e.t.size * 0.5;
    let lx = (ox ?? e.x) - e.x, ly = (oy ?? e.y) - e.y;
    const d = Math.hypot(lx, ly);
    // Pull the mark inside the silhouette — the impact point is where the
    // projectile was, which is usually just outside the body.
    if (d > R * 0.82) { const k = (R * 0.82) / (d || 1); lx *= k; ly *= k; }
    // The wound has to say WHAT hit it. Element wins when there is one (fire
    // chars, ice crusts, regardless of delivery), otherwise the weapon's
    // behaviour decides. Previously anything that was not fire or ice stamped
    // a bullet hole, so a katana slash, a laser beam and a shockwave all
    // punched identical neat round holes in the enemy.
    const el = this._elementHintFor(accent);
    let kind;
    if (el === 'fire') kind = 'burn';
    else if (el === 'ice') kind = 'frost';
    else {
      switch (this._curWeaponBehaviour) {
        case 'projectile':
        case 'shotgun':  kind = 'hole';   break;  // only actual bullets punch through
        case 'melee':
        case 'orbit':    kind = 'gash';   break;  // blades open a cut, not a hole
        case 'beam':     kind = 'sear';   break;  // a beam cauterises a line
        case 'chain':    kind = 'arc';    break;  // electricity leaves a burn tree
        case 'aoe':
        case 'meteor':   kind = 'blunt';  break;  // concussive: bruise and split
        default:         kind = 'gash';   break;
      }
    }
    // Direction the hit came from, so directional wounds (gash, sear) can be
    // oriented along the blow instead of at a random angle.
    const ang = Math.atan2(ly, lx);
    e._marks.push({ lx, ly, r: rand(1.4, 2.6), kind, ang });
    if (e._marks.length > 16) e._marks.shift();
  }

  killEnemy(e) {
    if (!e.alive) return;
    const t = e.t; const s = this.run.stats;
    if (e._decoy !== undefined) { this.enemies.release(e); return; }
    e.alive = false;
    this.run.kills += 1;
    this.run.comboCount += 1;
    this.run.comboTimer = 1.8;

    // Volatile: goes off on death, hurting enemies AND the player. The
    // player half is what makes it a positioning problem rather than a free
    // chain reaction.
    if (e.variant === 'volatile') {
      const R = t.size * 2.6;
      const blast = t.dmg * 1.6;
      this.spawnRing(e.x, e.y, R, '#ff7a1a', 0.5);
      this.spawnHitBurst(e.x, e.y, '#ff7a1a', 22);
      this.cam.shake = Math.max(this.cam.shake, 6);
      this.enemyGrid.query(e.x, e.y, R + this._maxEnemyR, other => {
        if (!other.alive || other === e) return;
        if (dist2(other.x, other.y, e.x, e.y) > R * R) return;
        this.dealDamage(other, blast, false, 120, e.x, e.y, true);
      });
      const pl = this.player;
      if (pl.iframes <= 0 && dist2(pl.x, pl.y, e.x, e.y) <= R * R && !this.rollDodge()) {
        pl.hp -= this.mitigate(blast * 0.7);
        pl.hit = 0.15; pl.iframes = 0.4;
        this.run.noHit = false;
      }
    }

    // ---- Prospector uniques that trigger on a kill ----
    const pf = s.flags || {};
    if (pf.tempoEngine) {
      // Stacks refresh their own window rather than each carrying a separate
      // timer — one timer, reset on every kill, is both cheaper and easier to
      // read on the HUD.
      this._tempoStacks = Math.min(10, (this._tempoStacks || 0) + 1);
      this._tempoT = 4;
    }
    if (pf.singularityRounds) {
      // Short, small vortex right where the enemy died. Reuses the same
      // pull-and-graze shape as the Void Vortex skill, at a fraction of its
      // radius and duration, so the two read as related.
      this._microVortex = this._microVortex || [];
      if (this._microVortex.length < 12) this._microVortex.push({ x: e.x, y: e.y, t: 0.55 });
    }
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

      // Poison Cloud: a kill leaves a lingering patch that poisons anything
      // standing in it.
      if (f.poisonOnKill) {
        this.enemies.forEach((en) => {
          if (en === e || dist2(en.x, en.y, e.x, e.y) > 90 * 90) return;
          en._poisonStacks = Math.min(8, (en._poisonStacks || 0) + 2);
          en._poisonT = 4;
        });
        this.spawnRing(e.x, e.y, 90, '#7ad96b', 0.45);
        for (let i = 0; i < this.fxCount(6); i++) this.spawnSpark(
          e.x + rand(-40, 40), e.y + rand(-40, 40), '#7ad96b');
      }

      // Star Burst: every fifth kill goes off as an area burst. Counted on the
      // run so the rhythm is predictable, same as Overload Core.
      if (f.starBurst) {
        this.run._starBurstN = (this.run._starBurstN || 0) + 1;
        if (this.run._starBurstN % 5 === 0) {
          const r = 120 * s.areaMult;
          this.enemies.forEach((en) => {
            if (en === e || dist2(en.x, en.y, e.x, e.y) > r * r) return;
            this.dealDamage(en, 55 * s.damageMult, false, 100, e.x, e.y, true);
          });
          this.spawnRing(e.x, e.y, r, '#ffe9a8', 0.45);
          this.spawnHitBurst(e.x, e.y, '#ffe9a8', 18);
        }
      }

      // Overload Core: every 10th kill detonates a chain reaction. Counted on
      // the run rather than per weapon, so it fires at a predictable rhythm
      // instead of depending on which weapon happened to land the blow.
      if (f.overloadCore) {
        this.run._overloadN = (this.run._overloadN || 0) + 1;
        if (this.run._overloadN % 10 === 0) {
          const r = 150 * s.areaMult;
          this.enemies.forEach((en) => {
            if (en === e || dist2(en.x, en.y, e.x, e.y) > r * r) return;
            this.dealDamage(en, 90 * s.damageMult, false, 140, e.x, e.y, true);
          });
          this.spawnRing(e.x, e.y, r, '#ffd166', 0.5);
          this.spawnHitBurst(e.x, e.y, '#ffd166', 24);
          this.cam.shake = Math.max(this.cam.shake, 10);
          this.spawnDamageNumber(e.x, e.y - 40, 'OVERLOAD', '#ffd166');
        }
      }
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
    // An arterial fan on every kill, thrown along the direction the killing
    // blow came from. Scales with the body, so a big enemy opens up wider —
    // the same effect at a fixed size would look wrong on both a bat and a
    // brute. Bosses are excluded; they have their own death sequence.
    if (!t.boss) {
      const km = e._marks && e._marks.length ? e._marks[e._marks.length - 1] : null;
      const kAng = km && km.ang !== undefined ? km.ang : Math.random() * TAU;
      this.spawnArterialCone(e.x, e.y, kAng, finalBlood, Math.min(1, 0.4 + t.size / 60));
    }
    this.spawnBrutalKill(e.x, e.y, finalBlood, t.size, fx);
    Audio.kill(t.size, !!t.boss);
    // Ground mark where the body fell — was a body-sized (0.85x) flat pool
    // that read as "the enemy went flat and is lying here", which the user
    // explicitly disliked ("de gillar ja inte") in favor of the body just
    // breaking into pieces (spawnBrutalKill's particles) and being gone.
    // Kept much smaller (a modest splash, not a silhouette-sized stain), and
    // skipped entirely for FX types that shouldn't leave a blood pool at all
    // (crystal shatter / dust decay / metal spark burst).
    if (fx !== 'crystallize' && fx !== 'decay' && fx !== 'sparkExplode') {
      // Ooze is the one deliberate exception — slimes were never bleeding to
      // begin with, so their pool stays their own color; every other death
      // leaves an actual blood pool now.
      this.pushBloodDecal({ x: e.x, y: e.y, r: t.size * 0.3, a: 0.4, bornAt: this.time, color: fx === 'ooze' ? finalBlood : BLOOD_RED });
    }
    // drop XP gem
    const gm = this.gems.acquire();
    gm.x = e.x; gm.y = e.y; gm.t = 0;
    gm.xp = Math.max(1, Math.floor(t.xp * (Math.random() < 0.05 ? 3 : 1)));
    gm.gold = 0;
    if (Math.random() < 0.6) {
      const g = this.gems.acquire();
      g.x = e.x + rand(-8, 8); g.y = e.y + rand(-8, 8); g.t = 0;
      g.gold = Math.max(1, Math.floor(t.gold * s.goldMult * this.weatherGold()));
      g.xp = 0; g.heart = 0;
    }
    // Rare heart drop — heals 5 HP base (upgradeable via m_heal meta)
    if (Math.random() < 0.0165 && !t.boss) {
      const h = this.gems.acquire();
      h.x = e.x + rand(-10, 10); h.y = e.y + rand(-10, 10); h.t = 0;
      h.xp = 0; h.gold = 0; h.heart = 1;
    }
    // Gear parts — the levelling currency. Far more common than a whole
    // item, because levelling is the steady progression and a drop is the
    // occasional event. Accumulated on the run and banked at the end.
    if (Math.random() < (t.boss ? 1 : 0.22)) {
      this.run.gearParts = (this.run.gearParts || 0)
        + (t.boss ? 14 + Math.floor(this.run.time / 60) : 1 + (Math.random() < 0.2 ? 1 : 0));
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
      Audio.boss();
      this.bossesKilled += 1;
      // Only clear the HUD pointer if it is THIS boss that died. Blanking it
      // unconditionally meant any second boss on the field taking the bar
      // down with it while the one the bar was tracking was still alive.
      if (this.bossActive === e) this.bossActive = null;
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
        pp.life = rand(0.5,1.0); pp.max = pp.life; pp.color = BLOOD_RED; pp.size = rand(1.6,3.4); pp.type = 'blood';
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
        pp.color = BLOOD_RED;
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

  spawnHitSparks(x, y, color, dmg, isCrit, dirX, dirY) {
    const qualHi = this._qualityHigh !== false;
    const sparkColor = isCrit ? '#ffffff' : color;
    const num = this.fxCount(isCrit ? 10 : 5);
    const elem = this._elementHintFor(color);
    // Sparks throw BACK along the impact, in a cone, when we know which way
    // the hit came from — that is what makes a hit read as directional
    // rather than as a puff centred on the enemy.
    const hasDir = dirX !== undefined && (dirX || dirY);
    const back = hasDir ? Math.atan2(-dirY, -dirX) : 0;
    const spread = isCrit ? 1.5 : 1.1;
    for (let i = 0; i < num; i++) {
      const pp = this.parts.acquire();
      pp.x = x; pp.y = y;
      const a = hasDir ? back + rand(-spread, spread) : Math.random() * TAU;
      const sp = rand(90, 240);
      pp.vx = Math.cos(a) * sp;
      // Fire embers drift/flick upward against gravity; ice shards fall
      // faster and settle; everything else is a neutral flat spark.
      pp.vy = elem === 'fire' ? Math.sin(a) * sp - rand(30, 70) : Math.sin(a) * sp;
      pp.life = elem === 'ice' ? rand(0.14, 0.26) : rand(0.07, 0.18);
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
  // `dirX/dirY` is the direction the shot was travelling. Spatter used to fire
  // off at `Math.random() * TAU` -- a neat ring of droplets around the wound,
  // identical whether you shot them from the left or dropped a meteor on them.
  // Blood now throws along the shot, which is the single biggest thing that
  // makes a hit read as having come from your gun.
  spawnPunctureHit(x, y, color, dirX, dirY) {
    const hasDir = dirX !== undefined && (dirX || dirY);
    const fwd = hasDir ? Math.atan2(dirY, dirX) : 0;
    this.pushBloodDecal({ x, y, r: rand(1.2, 2.2), a: 0.75, bornAt: this.time, color: BLOOD_RED });

    // A small arterial fan out the exit side of a gunshot too. Quarter power,
    // so it is a flick rather than the sheet a blade produces — the katana has
    // to stay the reason to use the katana. Not on every hit: a fan on every
    // bullet from a 9-per-second SMG would be a wall of red.
    if (hasDir && Math.random() < 0.35) {
      this.spawnArterialCone(x, y, fwd, color, 0.25);
    }

    // Exit spatter: a cone of droplets thrown onward past the body, landing as
    // a smear on the ground beyond it rather than a pool underneath.
    if (hasDir) {
      const cast = this.fxCount(3);
      for (let i = 0; i < cast; i++) {
        const a = fwd + rand(-0.5, 0.5);
        const dist = rand(14, 46);
        this.pushBloodDecal({
          x: x + Math.cos(a) * dist,
          y: y + Math.sin(a) * dist,
          r: rand(0.8, 2.0), a: rand(0.25, 0.5), bornAt: this.time, color: BLOOD_RED,
        });
      }
    }

    // Back-spatter: a thinner, faster spray thrown BACK toward the shooter.
    // Real impacts throw material both ways, and having everything go one way
    // was the tell that this was a cone generator rather than a wound.
    if (hasDir && Math.random() < 0.7) {
      const back = fwd + Math.PI;
      const bn = this.fxCount(2 + randi(0, 2));
      for (let i = 0; i < bn; i++) {
        const p = this.parts.acquire();
        p.x = x; p.y = y;
        // Tighter cone and less speed than the exit side.
        const a = back + rand(-0.45, 0.45);
        const sp = rand(60, 150);
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rand(20, 60);
        p.life = rand(0.12, 0.3); p.max = p.life;
        p.color = BLOOD_RED; p.size = rand(0.5, 1.1); p.type = 'blood';
      }
    }

    const n = 2 + randi(0, 2);
    for (let i = 0; i < n; i++) {
      const p = this.parts.acquire();
      p.x = x; p.y = y;
      // Mostly forward along the shot, but not slavishly: one droplet in five
      // goes anywhere at all. A perfectly obedient cone looks generated; the
      // strays are what make it look like it came off something wet.
      const wild = Math.random() < 0.2;
      const a = (hasDir && !wild) ? fwd + rand(-0.9, 0.9) : Math.random() * TAU;
      // Three grades of droplet in every spray: fine mist, ordinary spatter,
      // and the occasional fat slow drop that arcs and lands separately.
      const grade = Math.random();
      const heavy = grade > 0.86;
      const mist = grade < 0.3;
      const sp = (mist ? rand(70, 170) : heavy ? rand(18, 45) : rand(30, 90)) * (hasDir ? 1.6 : 1);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rand(10, 40);
      p._heavy = heavy; p._mist = mist;
      // Staggered life so droplets visibly separate in time (the "pump")
      // instead of one simultaneous burst.
      p.life = rand(0.15, 0.5) + i * 0.06; p.max = p.life;
      p.color = BLOOD_RED;
      // Size follows the grade, so mist really is fine and the fat drops
      // really are fat. A spray of identically sized dots is the giveaway.
      p.size = mist ? rand(0.35, 0.7) : heavy ? rand(1.9, 3.1) : rand(0.8, 1.8);
      p.type = 'blood';
    }
  }

  // ---- Arterial cone -------------------------------------------------------
  // The wide flat fan of blood that erupts along a cut, the way Slash of Sword
  // does it: a sheet rather than a spray. Everything already here throws round
  // droplets, and droplets can never read as a SLASH — a cut is a line, so what
  // comes out of it has to be a shape with an edge and a direction.
  //
  // Kept alongside the existing spatter rather than replacing it: the fan is
  // the silhouette, the droplets are the texture, and together they read as one
  // event. `power` scales the whole thing so a katana kill and a bullet hit can
  // share the code without looking like the same event.
  // `color` is accepted for backward compatibility with every call site but
  // no longer used for the particles themselves — this whole effect IS
  // blood, and blood is always BLOOD_RED now (Timmy). Left in the signature
  // rather than touching every caller.
  spawnArterialCone(x, y, ang, color, power = 1) {
    const c = this.parts.acquire();
    c.x = x; c.y = y; c.vx = 0; c.vy = 0;
    c.life = 0.34 + power * 0.1; c.max = c.life;
    c.color = BLOOD_RED;
    c.size = (58 + power * 46);      // reach of the fan
    c.type = 'bloodCone';
    c._ang = ang;
    c._spread = 0.5 + power * 0.35;  // how wide it opens
    c._seed = Math.random() * 1000;

    // Long thin streaks riding the leading edge. These are what sell the
    // ARC — a fan alone reads as a triangle, the streaks give it motion.
    const n = this.fxCount(Math.round(4 + power * 5));
    for (let i = 0; i < n; i++) {
      const s = this.parts.acquire();
      const a = ang + rand(-c._spread, c._spread);
      const sp = rand(260, 620) * (0.6 + power * 0.6);
      s.x = x; s.y = y;
      s.vx = Math.cos(a) * sp;
      s.vy = Math.sin(a) * sp - rand(20, 120);
      s.life = rand(0.25, 0.55); s.max = s.life;
      s.color = BLOOD_RED;
      s.size = rand(1.4, 3.6) * (0.7 + power * 0.5);
      s.type = 'blood';
      s._mist = false; s._heavy = i % 4 === 0;
    }
    // Airborne droplets thrown high out of the cut, arcing over and landing
    // separately. This is the part that makes it read as ARTERIAL rather than
    // as an impact puff.
    const arcN = this.fxCount(Math.round(2 + power * 4));
    for (let i = 0; i < arcN; i++) {
      const s = this.parts.acquire();
      const a = ang + rand(-0.7, 0.7);
      s.x = x; s.y = y;
      s.vx = Math.cos(a) * rand(60, 190);
      s.vy = Math.sin(a) * rand(60, 190) - rand(180, 340);   // thrown UP
      s.life = rand(0.6, 1.1); s.max = s.life;
      s.color = BLOOD_RED;
      s.size = rand(1.8, 3.8);
      s.type = 'blood';
      s._heavy = true;
    }
  }

  // Arterial bleed. A wounded enemy keeps pumping between hits, in rhythmic
  // spurts out of its worst wound rather than a steady dribble -- the pulse is
  // what reads as something still alive and losing.
  //
  // Called from updateEnemies. Cheap: one timer per enemy, and it only runs on
  // enemies that are actually hurt.
  _updateBleed(e, dt) {
    if (!e._marks || !e._marks.length) return;
    const hurt = 1 - e.hp / Math.max(1, e.maxHp);
    if (hurt < 0.35) return;                  // only real wounds pump
    e._bleedT = (e._bleedT || 0) - dt;
    if (e._bleedT > 0) return;
    // Faster pulse the worse they are: roughly 1.1s down to 0.35s.
    e._bleedT = 1.2 - hurt * 0.85 + Math.random() * 0.25;

    // Pump from the most recent wound, outward along the way it faces.
    const m = e._marks[e._marks.length - 1];
    const wx = e.x + m.lx, wy = e.y + m.ly;
    const a0 = m.ang !== undefined ? m.ang : Math.atan2(m.ly, m.lx);
    const n = this.fxCount(2 + randi(0, 3));
    for (let i = 0; i < n; i++) {
      const p = this.parts.acquire();
      p.x = wx; p.y = wy;
      const a = a0 + rand(-0.35, 0.35);
      // Spurt strength varies shot to shot, so no two pulses look the same.
      const sp = rand(50, 130) * (0.7 + hurt * 0.7);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rand(20, 70);
      p.life = rand(0.25, 0.6); p.max = p.life;
      p.color = BLOOD_RED; p.size = rand(0.7, 1.9); p.type = 'blood';
    }
    // A single small drop left where the pulse fired. This is deliberately
    // one tiny mark, not a growing puddle — a body-sized kill pool was tried
    // before and explicitly rejected (see killEnemy's decal comment: "de
    // gillar ja inte"). But since the enemy has usually moved between pulses
    // (each one reads e.x/e.y fresh), a string of these across a chase reads
    // as a dripping trail rather than one stain — which is the "rinna från
    // skärsår" (running/dripping from the cut) behaviour that was still
    // missing: the existing gore was all airborne spray + periodic pumping,
    // nothing actually landed and stayed.
    this.pushBloodDecal({ x: wx, y: wy, r: rand(1.2, 2.0) * (0.8 + hurt * 0.5), a: 0.5, bornAt: this.time, color: BLOOD_RED });
  }

  addXp(amount) {
    const r = this.run;
    // The tier's XP bonus is applied here rather than folded into the orb
    // values so it also covers every non-orb XP source (shrine rewards, dock
    // stations, boss bonuses) without each of them having to remember.
    r.xp += Math.floor(amount * r.stats.xpMult * this.diff.xpMult);
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
    // Three-stage geometric curve instead of one flat 1.25×. The old curve
    // put the player at level 9-10 by the first guardian, which is roughly a
    // full build ahead of where the fight is tuned — the early game was
    // handing out power faster than it was handing out threat.
    //
    //   1-9   ×1.46 — steep. Forward-simulated against the reworked wave
    //                 curve this puts the player at level 7 with ~480 DPS
    //                 when the first guardian arrives at t=150, which is
    //                 exactly the intended "you got here, and it is still
    //                 stronger than you". Levels 2-4 still cost only 20/37/62,
    //                 so the early dopamine cadence is untouched — the
    //                 steepness lands from level 5 on, which is where the old
    //                 curve was handing out power faster than threat.
    //   10-19 ×1.24 — the build-defining stretch; a level every ~50-90s keeps
    //                 the card cadence alive without it becoming background.
    //   20+   ×1.16 — flattened so a long endless run does not brick-wall
    //                 against an accelerating spawn curve.
    const growth = r.level < 10 ? 1.46 : r.level < 20 ? 1.24 : 1.16;
    r.xpToNext = Math.floor(r.xpToNext * growth + 8);
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
    this._levelUpShieldT = 0.85; // must match the duration read in pixiRenderer's _drawPlayer
    this._levelUpTextTimer = 1.4;
    Audio.levelUp();
    // BIG level-up blast — visual + KNOCKBACK + small damage
    const p = this.player;
    this._levelUpTextPos = { x: p.x, y: p.y - 40 };
    // Timmy: a second, smaller "LEVEL UP!" ping used to spawn here through the
    // shared damage-number pool, on top of the big banner (_drawLevelUpText)
    // driven by _levelUpTextTimer above — same text, two systems, a few px
    // apart, reading as a broken double-exposure instead of two effects. One
    // banner only now.
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

      // Skin torn off the FACING side.
      //
      // The old blast threw 36 golden sparks out of the player in every
      // direction and called it done — from inside a crowd that is just noise
      // on top of noise, and nothing about it said the wave had actually hit
      // anything. These flakes come off the ENEMY instead, only from the arc
      // pointing back at the blast, and they carry the enemy's own colour, so
      // what you read is a row of bodies being stripped on the side the wave
      // reached. Falls off with distance: the ones next to you are shredded,
      // the ones at the rim barely scuff.
      const closeness = 1 - Math.min(1, d / blastR);
      const flakes = this.fxCount(Math.round(3 + closeness * 7));
      const nx = dx / d, ny = dy / d;         // blast -> enemy
      const face = Math.atan2(-ny, -nx);      // the side looking back at it
      for (let fI = 0; fI < flakes; fI++) {
        const fp = this.parts.acquire();
        // Spawned ON the facing surface, not at the centre — a flake that
        // starts inside the body reads as a particle, not as peeled skin.
        const sa = face + rand(-1.0, 1.0);
        const sr = e.t.size * 0.46;
        fp.x = e.x + Math.cos(sa) * sr;
        fp.y = e.y + Math.sin(sa) * sr;
        // Thrown outward along the wave, plus a little scatter and lift.
        const sp2 = rand(120, 300) * (0.5 + closeness);
        const oa = sa + Math.PI + rand(-0.5, 0.5);
        fp.vx = Math.cos(oa) * sp2 * -1 + nx * 60;
        fp.vy = Math.sin(oa) * sp2 * -1 + ny * 60 - rand(20, 90);
        fp.life = rand(0.4, 0.9); fp.max = fp.life;
        fp.color = e.t.color;
        fp.size = rand(1.6, 4.2) * (0.7 + closeness * 0.6);
        fp.type = 'skinFlake';
        fp._spin = rand(-9, 9);
        fp._rot = Math.random() * TAU;
      }
      // The stripped side stays marked, so the damage is visible after the
      // flakes have landed rather than only during the burst.
      this._addImpactMark(e, e.x + Math.cos(face) * e.t.size * 0.4,
        e.y + Math.sin(face) * e.t.size * 0.4, '#ffd166');
    }
    this.spawnRing(p.x, p.y, blastR, '#ffd166', 0.55);
    this.spawnRing(p.x, p.y, blastR * 0.55, '#4dffd4', 0.45);
    this.spawnRing(p.x, p.y, blastR * 0.25, '#fff', 0.32);
    // Golden sparks, cut from 36 to 14 and thrown as a flat RING rather than a
    // sphere. The old burst sprayed in every direction from the player and,
    // fired from inside a crowd, buried the thing that actually matters — the
    // wave front and the enemies coming apart on it. The wave should be the
    // loudest thing on screen, not the confetti in front of it.
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU + rand(-0.12, 0.12);
      const sp = rand(340, 520);
      const pp = this.parts.acquire();
      pp.x = p.x; pp.y = p.y;
      pp.vx = Math.cos(a) * sp; pp.vy = Math.sin(a) * sp;
      pp.life = rand(0.35, 0.6); pp.max = pp.life;
      pp.color = k % 2 === 0 ? '#ffd166' : '#fff';
      pp.size = rand(2, 3.4); pp.type = 'spark';
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

  // ---- Player damage mitigation ------------------------------------------
  // Armour used to be a FLAT subtraction: max(1, dmg - armor). Once armour
  // exceeded an enemy's damage — which happens quickly once a few pieces of
  // gear are equipped — literally everything in the game hit for exactly 1,
  // and you could stand still in a crowd indefinitely. That is the single
  // biggest reason the game stopped being able to kill you.
  //
  // It is a percentage curve now, with diminishing returns and a hard ceiling,
  // so armour is always worth having and never turns damage off.
  mitigate(raw) {
    const armor = Math.max(0, this.run.stats.armor || 0);
    const reduction = Math.min(0.70, armor / (armor + 26));
    return Math.max(1, raw * (1 - reduction));
  }

  // Dodge is capped for the same reason — stacked far enough it was a
  // blanket immunity rather than a stat.
  rollDodge() {
    return Math.random() < Math.min(0.45, this.run.stats.dodge || 0);
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

  // Nearest enemy that is not `skip`. `nearestEnemy` would keep returning the
  // enemy we just hit, so a ricochet would bounce back into its own target.
  nearestEnemyExcluding(x, y, maxR, skip) {
    let best = null; let bestD = maxR;
    this.enemies.forEach((en) => {
      if (en === skip) return;
      const d = Math.hypot(en.x - x, en.y - y);
      if (d < bestD) { bestD = d; best = en; }
    });
    return best;
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
    // Every pool records WHAT made it, so the renderer can settle it correctly:
    // blood clots, fire leaves embers in scorched ground, ice freezes into a
    // shard crust, poison bubbles, electricity keeps arcing. Derived here, in
    // the one funnel every decal passes through, rather than at each of the
    // half-dozen call sites -- they would drift apart otherwise.
    if (decal.kind === undefined) {
      const el = this._elementHintFor(decal.color);
      decal.kind = el
        || (this._curWeaponBehaviour === 'chain' ? 'electric' : 'blood');
    }
    if (this.bloodDecals.length >= 150) this.bloodDecals.shift();
    this.bloodDecals.push(decal);
  }

  // `color` kept in the signature for every existing caller; the particles
  // are always BLOOD_RED now regardless of what's passed (Timmy: blood is
  // always blood-red).
  spawnBlood(x, y, color) {
    const n = this.fxCount(3 + randi(0, 4));
    for (let i = 0; i < n; i++) {
      const p = this.parts.acquire();
      p.x = x; p.y = y;
      const a = Math.random() * TAU;
      const sp = rand(80, 260);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rand(30, 120);
      p.life = rand(0.4, 0.9); p.max = p.life;
      // Droplets vary in size within a single spray. A spray of identically
      // sized dots is the tell that gore is procedural; real spatter is a few
      // fat drops among a lot of fine mist.
      p.color = BLOOD_RED;
      p.size = i === 0 ? rand(2.4, 3.6) : rand(0.7, 1.9);
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
    // Chunks fly along the hit direction in a cone rather than in a full
    // circle. A piece torn off by an impact travels roughly the way the
    // impact was going — spraying them evenly in every direction is what made
    // gore read as a generic puff instead of something being torn away.
    const away = Math.atan2(ny, nx);
    for (let i = 0; i < n; i++) {
      const p = this.parts.acquire();
      p.x = wx + rand(-3, 3); p.y = wy + rand(-3, 3);
      const a = away + rand(-0.85, 0.85);
      const sp = rand(90, 260);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rand(20, 100);
      p.life = rand(0.4, 0.85); p.max = p.life;
      p.color = i % 4 === 0 ? (impactAccent || bc) : bc;
      p.size = rand(1.2, 2.6); p.type = 'chunk';
    }
    // A heavier hit tears off one genuinely large piece that tumbles and
    // lands, so the gore has a size range instead of being uniform flecks.
    if (stage >= 4 && Math.random() < 0.5) {
      const big = this.parts.acquire();
      big.x = wx; big.y = wy;
      const a = away + rand(-0.5, 0.5);
      big.vx = Math.cos(a) * rand(70, 160);
      big.vy = Math.sin(a) * rand(70, 160) - rand(40, 110);
      big.life = rand(0.8, 1.3); big.max = big.life;
      big.color = bc; big.size = rand(3.2, 5.4); big.type = 'chunk';
    }
    this.spawnBlood(wx, wy, bc);
    const localAng = Math.atan2(ny, nx) + rand(-0.35, 0.35);
    const localR = t.size * rand(0.12, 0.4);
    e._wounds.push({ lx: Math.cos(localAng) * localR, ly: Math.sin(localAng) * localR, size: t.size * rand(0.13, 0.21) });
    // Capped like bloodDecals — an unbounded per-enemy wound list during a
    // very long boss fight would otherwise keep growing for the fight's
    // whole duration (found in a code review pass).
    if (e._wounds.length > 24) e._wounds.shift();
    this.pushBloodDecal({ x: wx, y: wy, r: 3 + stage * 0.55, a: 0.5, bornAt: this.time, color: BLOOD_RED });
  }

  // Weather. Global rather than a moving zone: a zone means a per-entity
  // containment test every frame for every enemy, and the readability cost of
  // "am I in it?" is not worth what it buys over "it is raining".
  _updateWeather(dt) {
    if (this._weather) {
      this._weatherT -= dt;
      if (this._weatherT <= 0) { this._weather = null; return; }
      if (this._weather === 'storm') {
        this._stormCD = (this._stormCD || 0) - dt;
        if (this._stormCD <= 0) {
          this._stormCD = rand(0.8, 1.6);
          // Strikes land near the player, not on them — the threat is where
          // you are standing, which you can do something about.
          const p = this.player;
          const a = Math.random() * TAU, d = rand(60, 260);
          const sx = p.x + Math.cos(a) * d, sy = p.y + Math.sin(a) * d;
          this.spawnLightning(sx, sy - 260, sx, sy, '#c8a0ff');
          this.spawnRing(sx, sy, 54, '#c8a0ff', 0.35);
          this.cam.shake = Math.max(this.cam.shake, 4);
          const R = 58;
          this.enemyGrid.query(sx, sy, R + this._maxEnemyR, e => {
            if (!e.alive || dist2(e.x, e.y, sx, sy) > R * R) return;
            this.dealDamage(e, 55 * this.run.stats.damageMult, false, 90, sx, sy, false, '#c8a0ff');
          });
          if (p.iframes <= 0 && dist2(p.x, p.y, sx, sy) <= R * R && !this.rollDodge()) {
            p.hp -= this.mitigate(18);
            p.hit = 0.15; p.iframes = 0.4; this.run.noHit = false;
          }
        }
      }
      return;
    }
    this._nextWeatherAt = (this._nextWeatherAt === undefined ? rand(70, 110) : this._nextWeatherAt) - dt;
    if (this._nextWeatherAt <= 0) {
      this._weather = WEATHER_IDS[(Math.random() * WEATHER_IDS.length) | 0];
      this._weatherT = rand(26, 40);
      this._nextWeatherAt = rand(70, 110);
      this._weatherBannerT = 2.6;
      this.cam.shake = Math.max(this.cam.shake, 5);
    }
    this._weatherBannerT = Math.max(0, (this._weatherBannerT || 0) - dt);
  }

  // Multipliers the rest of the engine reads, so weather never mutates the
  // run's own stats — a temporary effect that writes into permanent state is
  // a temporary effect that eventually forgets to undo itself.
  weatherFireRate() { return this._weather === 'rain' ? 1.25 : 1; }
  weatherEnemySpeed() { return this._weather === 'drought' ? 1.22 : 1; }
  weatherGold() { return this._weather === 'drought' ? 1.5 : 1; }

  // Per-frame upkeep for the Astro Prospector unique cards that need it.
  // Kept in one place rather than scattered through update(), so the set of
  // things these cards touch stays obvious.
  _updateProspectorFlags(dt) {
    if (this._tempoT > 0) {
      this._tempoT -= dt;
      if (this._tempoT <= 0) this._tempoStacks = 0;
    }
    const mv = this._microVortex;
    if (mv && mv.length) {
      for (let i = mv.length - 1; i >= 0; i--) {
        const v = mv[i];
        v.t -= dt;
        if (v.t <= 0) { mv.splice(i, 1); continue; }
        const R = 105;
        this.enemyGrid.query(v.x, v.y, R + this._maxEnemyR, e => {
          if (!e.alive || (e.t && e.t.boss)) return;   // bosses don't get dragged
          const dx = v.x - e.x, dy = v.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > R) return;
          const pull = (1 - d / R) * 620 * dt;
          e.x += (dx / d) * pull;
          e.y += (dy / d) * pull;
        });
        if (Math.random() < 0.5) this.spawnSpark(v.x + rand(-18, 18), v.y + rand(-18, 18), '#b362ff');
      }
    }
  }

  // Fire-rate multiplier contributed by Tempo Engine's current stacks.
  tempoMult() {
    return 1 + (this._tempoStacks || 0) * 0.04;
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
    // Longer-lived than a spark on purpose: brass should stay on the ground
    // for a beat after it stops glowing, so a firefight leaves a trail of
    // spent casings behind you rather than evaporating.
    cs.life = rand(1.6, 2.0); cs.max = cs.life;
    cs.color = ''; cs.size = rand(2, 3); cs.type = 'casing';
    // Pooled objects keep the previous occupant's fields — a recycled casing
    // that inherited _settled would freeze in mid-air the frame it spawned.
    cs._settled = false; cs._restY = undefined;
    cs._rot = Math.random() * TAU; cs._rotSpd = rand(-16, 16);
  }

  // Passing sky object: a fiery meteor with a tail, or a slow UFO trailing a
  // colored light beam — both cross the sky above the play area and cast a
  // real (if faint) moving light onto the world below as they pass.
  spawnSkyEvent() {
    const p = this.player;
    const isUfo = Math.random() < 0.3;
    const ang = Math.random() * TAU;
    const dist = this.viewSpan() * 0.7 + 80;
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
      // tx = p.x - (W/2)*zoom), and the renderer scales the world by 1/zoom —
      // so screen = (world - cam) / zoom. The division was missing, which made
      // the boss arrow believe the boss was off screen while it was plainly
      // visible (and vice versa) at any zoom above 1. That was already wrong
      // for anyone holding the Vision upgrade; now that zoom is device-derived
      // it would have been wrong on every phone, all the time.
      const zoom = this.viewZoom();
      const sx = (b.x - this.cam.x) / zoom;
      const sy = (b.y - this.cam.y) / zoom;
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

  // Active-skill rank. There was no such concept before: every skill fired at
  // one fixed strength from the moment it was unlocked, which is exactly why
  // Lightning Strike felt like it "starts at max level". Rank 1 is the floor,
  // and it climbs with the character's level so a skill grows over a run
  // instead of arriving finished.
  skillLvl(id) {
    const explicit = this.run.skillLvls && this.run.skillLvls[id];
    if (explicit) return explicit;
    return 1 + Math.floor((this.run.level || 1) / 4);
  }

  // Lightning falling from above. `delay` staggers a volley; `splashR` sizes
  // the ground burst. The bolt itself is drawn by the renderer from these
  // fields — see the 'skyBolt' particle branch.
  spawnSkyBolt(x, y, delay = 0, splashR = 60) {
    const p = this.parts.acquire();
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = 0.55 + delay; p.max = p.life;
    p.color = '#cfefff'; p.size = splashR; p.type = 'skyBolt';
    p._delay = delay;
    // Fixed per-bolt seed so the jagged path is stable for the bolt's whole
    // life. Re-randomising per frame makes a bolt shimmer like TV static
    // instead of hanging in the air the way a real strike reads.
    p._seed = Math.random() * 1000;
    Audio.active('lightning');
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
    Audio.shoot(s._wid, s._behaviour);
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
      // Fresh roll per link, same reason as the piercing shot above: the first
      // target's luck should not decide the whole chain.
      const link = this.rollDamage(s.damage * rs.damageMult * 0.65, s.crit);
      this.dealDamage(next, link.dmg, link.crit, 20, chainFrom.x, chainFrom.y);
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
          Audio.shoot(wid, 'drone');
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
    // Two gates on how many weapons you can be carrying, and they answer
    // different questions:
    //
    //   meta.weaponSlots  — what your CHARACTER can hold. Permanent, bought
    //                       with character levels and rarity (see
    //                       buildMetaEffects). This is the meta progression.
    //   runWeaponCap      — what you have earned THIS RUN. One more every
    //                       four run levels. This is what stops a run from
    //                       opening with a full arsenal and turning the first
    //                       two minutes into a formality: at level 1 you have
    //                       what you started with, and the second weapon is a
    //                       thing you fought to level 4 for.
    //
    // The floor at owned.length matters: a character that starts with two
    // weapons must never be told it is over its own cap and be unable to take
    // a weapon card for the rest of the run.
    const runWeaponCap = Math.max(owned.length, 1 + Math.floor(r.level / 4));
    const weaponCap = Math.min(this.meta.weaponSlots || 2, runWeaponCap);
    const canAddWeapon = owned.length < weaponCap && newWeaponIds.length > 0;

    // We want a mix; produce up to 4 choices, then random 3
    const pool = [];
    const upgradable = owned;
    for (const id of upgradable) {
      const lvl = r.weaponLvls[id] || 0;
      const def = WEAPONS[id];
      if (!def) continue;
      const upg = lvl < def.levelUps.length ? def.levelUps[lvl] : this.fallbackUpgrade(def, lvl);
      const evoId = upg?.evolve ? WEAPON_EVO_MAP[id] : null;
      const evoDef = evoId ? WEAPONS[evoId] : null;
      const evoText = evoDef ? ` → ${evoDef.name}` : '';
      // A card may only promise an evolution that actually exists. Thirty of
      // the game's weapons carry `evolve: true` on their last level-up but have
      // no entry in WEAPON_EVO_MAP, and this line used to key on the flag
      // alone — so thirty weapons offered an epic card reading "X — EVOLVE!"
      // with an evolution badge, and taking it applied a damage multiplier and
      // transformed nothing. `hasEvo` is the honest condition; the flag on its
      // own now only means "this is the final upgrade".
      const hasEvo = !!(upg?.evolve && evoDef);
      const isMastery = !!(upg?.evolve && !evoDef);
      const canEvo = hasEvo && r.stats.evoUnlocked && r.stats.unlockedEvos.includes(id);
      let evoNote = '';
      if (canEvo) evoNote = `\n✦ TRANSFORMS into ${evoDef.name}!`;
      else if (hasEvo && !r.stats.evoUnlocked) evoNote = '\nEvolution locked — needs the Awakening Gate';
      // The gap that was never reported: gate open, this weapon's evolution
      // simply not bought yet. Previously silent, so the card looked identical
      // to one that could evolve.
      else if (hasEvo) evoNote = '\nEvolution not unlocked — Card Shop, EVOLUTIONS';
      pool.push({
        kind: 'weapon-upgrade', weaponId: id, icon: def.icon,
        name: def.name + (hasEvo ? ` — EVOLVE!${evoText}`
          : isMastery ? ' — MASTERY'
            : (lvl >= def.levelUps.length ? ' +' + (lvl - def.levelUps.length + 2) : ' +')),
        desc: this.describeWeaponUpgrade(def, upg) + evoNote,
        rarity: hasEvo ? 'epic' : (isMastery || lvl >= 4) ? 'rare' : 'uncommon',
        evoTarget: evoDef ? evoDef.name : null,
        // The recipe the card draws along its bottom edge: what this weapon is
        // now and what it becomes, plus whether the transform is actually
        // available. Ids rather than names, so the card can draw the art.
        evoFromId: hasEvo ? id : null,
        evoToId: evoId || null,
        evoReady: canEvo,
        // For the level-up card UI: current/max tier so it can render level
        // pips, and whether this pick is an evolution step (distinct badge).
        lvl, maxLvl: def.levelUps.length, isEvolve: hasEvo,
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
      // Math.abs: every desc template carries its own sign ("+{v}% damage",
      // "-{v}% reload time"), so a negative amount was rendering the sign
      // twice — Fast Reload read "--8% reload time" and Overclock "--6%
      // active skill cooldown" on every card that has ever been offered.
      const amt = Math.abs(s.amount * mult);
      const desc = s.desc.replace('{v}', s.mult ? Math.round(amt * 100).toString() : (Math.round(amt * 100) / 100).toString());
      pool.push({
        kind: 'stat', statId: s.id, statRef: s, icon: s.icon, name: s.name, desc, rarity: rar, multiplier: mult,
        // What the pick actually does to the sheet, resolved now against the
        // live run so the card can show "42% → 47%" instead of only "+5%".
        // A bare "+5% damage" is unreadable as an offer: +5% of a stat that
        // is already at 300% is a different decision than +5% at 100%.
        cmp: this.statCompare(s, s.amount * mult),
        // Stack count, so the card can show its level dots the same way a
        // weapon card does.
        lvl: (r.cardStacks && r.cardStacks[s.id]) || 0, maxLvl: CARD_MAX_STACKS,
      });
    }
    // 4: advanced flag/stat cards (rare/epic only) — only if not already active
    for (const ac of ADVANCED_CARDS) {
      // Gate FIRST, before the flag/stat branches. Prospector uniques are
      // flag cards, so checking this second would let every one of them
      // through the `ac.flag` branch regardless of whether it was unlocked.
      if (ac.prospect && !(this.meta.prospectCards || []).includes(ac.prospectId)) continue;
      // Card Shop gate, same shape as the Prospector one above. Both unlock
      // systems now feed the SAME pool through the SAME check, so a card can
      // never be reachable from one and invisible to the other.
      if (ac.shop && !(this.meta.shopCards || []).includes(ac.shopId)) continue;
      if (ac.flag) {
        if (r.stats.flags && r.stats.flags[ac.flag]) continue;
        const rar = rollRarity(r.stats.luck + 1);
        // Uniques always present as legendary — they are not incremental
        // bumps and should not be dressed as one.
        pool.push({ kind: 'flag', flagId: ac.flag, icon: ac.icon, name: ac.name, desc: ac.desc, rarity: ac.prospect ? 'legendary' : rar, amount: ac.amount });
      } else if (ac.stat) {
        // Stat card (flat like Iron Hide's +armor, or a multiplier like the
        // weapon-class passives).
        //
        // This built the ref with `id:` while applyCardChoice reads `.stat`,
        // so every one of these cards was writing to run.stats[undefined] and
        // doing absolutely nothing — Iron Hide, Conductive Rounds and the
        // rest have been dead picks. It also hardcoded mult:false, which
        // would have silently flattened the multiplier cards too.
        const rar = rollRarity(r.stats.luck + 1);
        const statRef = { stat: ac.stat, amount: ac.amount, mult: !!ac.mult };
        pool.push({ kind: 'stat', statId: ac.id, statRef, icon: ac.icon, name: ac.name, desc: ac.desc, rarity: rar, multiplier: 1, cmp: this.statCompare(statRef, ac.amount),
          lvl: (r.cardStacks && r.cardStacks[ac.id]) || 0, maxLvl: CARD_MAX_STACKS });
      }
    }
    // pick 3 unique. Flag/stat cards (ADVANCED_CARDS + STAT_CARDS, ~50+
    // entries) heavily outnumber weapon entries (a couple of upgrades for
    // owned weapons plus whatever new weapons are cap-eligible) by raw pool
    // count, so a flat uniform draw over the whole pool statistically starved
    // weapon offers — measured under 10% of picks across real runs, and
    // "upgrade a weapon you already have" almost never appeared at all. One
    // slot is reserved for a weapon card whenever the pool actually has one,
    // so weapon progression stays visible; the other two stay a free draw.
    const weaponIdx = pool.map((c, i) => (c.kind === 'weapon-upgrade' || c.kind === 'weapon-new' || c.kind === 'weapon-fork') ? i : -1).filter(i => i >= 0);
    if (weaponIdx.length > 0) {
      const pick = weaponIdx[randi(0, weaponIdx.length)];
      const c = pool.splice(pick, 1)[0];
      usedIds.add(c.kind + '|' + (c.weaponId || c.statId || c.flagId));
      choices.push(c);
    }
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
      const pct = '+' + Math.round((upg.mult - 1) * 100) + '% ' + this.weaponStatName(weapon, k);
      // Same correction as the card name above: without a target in
      // WEAPON_EVO_MAP this is simply the last upgrade on the track, and
      // calling it an "awakened form" was describing something that does not
      // happen.
      return evoDef
        ? `EVOLVED: ${pct}. Awakened form. | Evolves into: ${evoDef.name}`
        : `MASTERY: ${pct}. Final upgrade.`;
    }
    const label = this.weaponStatName(weapon, k);
    if (upg.mult != null) return '+' + Math.round((upg.mult - 1) * 100) + '% ' + label;
    if (upg.add != null) return '+' + upg.add + ' ' + label;
    return '...';
  }

  // What a weapon gains past its authored levelUps list.
  //
  // This used to be a flat +10% damage forever, which is the reason a weapon
  // stopped feeling like it was growing the moment it ran out of designed
  // levels: every card looked identical and the numbers barely moved. It now
  // cycles through the stats that actually change how a weapon plays, with a
  // projectile added every fifth step, and the damage steps grow slowly with
  // level so a late pick is worth taking.
  fallbackUpgrade(def, lvl) {
    const over = lvl - def.levelUps.length;   // 0 on the first fallback pick
    const cycle = over % 5;
    const grow = 1 + Math.floor(over / 5) * 0.03;   // steps get bigger over time
    switch (cycle) {
      case 0: return { stat: 'damage', mult: 1.14 * grow };
      case 1: return { stat: 'fireRate', mult: 1.10 * grow };
      case 2: return { stat: 'damage', mult: 1.16 * grow };
      // Area weapons grow their area; everything else gains pierce, because
      // "+1 pierce" on a shockwave means nothing.
      case 3: return def.base.area != null
        ? { stat: 'area', mult: 1.12 * grow }
        : { stat: 'pierce', add: 1 };
      default: return { stat: 'projectiles', add: 1 };
    }
  }

  // Weapon-specific vocabulary for a stat, falling back to the generic name.
  // "+20% damage" says nothing about which weapon you are improving; "+20%
  // draw weight" tells you it is the bow without reading the card header.
  weaponStatName(weapon, k) {
    const table = weapon && WEAPON_UPGRADE_NAMES[weapon.id];
    return (table && table[k]) || this.statName(k);
  }

  statName(k) {
    return ({
      damage: 'damage', fireRate: 'attack speed', magazine: 'magazine size',
      pierce: 'pierce', crit: 'crit chance', projSpeed: 'projectile speed',
      area: 'area', range: 'range', orbitCount: 'orbs', orbitRadius: 'orbit radius',
      orbitSpeed: 'orbit speed', homing: 'homing', projectiles: 'projectiles',
    })[k] || k;
  }

  // Before/after preview for a stat card. Deliberately mirrors the arithmetic
  // in applyCardChoice below — if that changes, this has to change with it, or
  // the card promises a number the pick does not deliver.
  //
  // Returns null for anything that has no meaningful "before" (a heal is an
  // event, not a sheet value), so the UI can simply omit the row.
  statCompare(s, amount) {
    if (!s || !s.stat || s.stat === 'heal') return null;
    const r = this.run;
    const from = s.mult ? (r.stats[s.stat] ?? 1) : (r.stats[s.stat] ?? 0);
    const to = from + amount;
    // How the number should read. Multiplier stats live around 1.0 and mean
    // nothing shown raw; crit and dodge are flat but are 0..1 chances, so they
    // are percentages too.
    const pct = s.mult || s.stat === 'crit' || s.stat === 'dodge';
    const fmt = pct
      ? (v) => Math.round(v * 100) + '%'
      : (v) => (Math.round(v * 100) / 100).toString();
    // Two stats are buffs that make the number go DOWN — reload time and
    // skill cooldown both ship negative amounts. Colouring by the raw sign
    // would paint the game's two best economy cards as losses.
    const lowerIsBetter = s.stat === 'reloadMult' || s.stat === 'skillCdMult';
    const up = lowerIsBetter ? amount <= 0 : amount >= 0;
    return { label: STAT_LABELS[s.stat] || s.stat, from: fmt(from), to: fmt(to), up };
  }

  applyCardChoice(choice) {
    const r = this.run;
    if (!choice) { // safety: never leave queue stuck
      this.levelUpQueue = Math.max(0, this.levelUpQueue - 1);
      this.cam.slowmo = 0;
      return;
    }
    // How many times each stat/passive card has been taken. Weapons already
    // tracked this in weaponLvls; passives had no record at all, so a card you
    // had stacked four times looked exactly like one you had never seen. This
    // is what the level dots on the card read from.
    if (choice.kind === 'stat' && choice.statId) {
      if (!r.cardStacks) r.cardStacks = {};
      r.cardStacks[choice.statId] = (r.cardStacks[choice.statId] || 0) + 1;
    }
    if (choice.kind === 'weapon-upgrade') {
      const baseId = choice.weaponId;
      r.weaponLvls[baseId] = (r.weaponLvls[baseId] || 0) + 1;
      // Twin Ascend: a weapon upgrade also levels a SECOND manual weapon.
      // Picks the least-levelled other manual weapon, so it closes the gap in
      // a build rather than running one weapon further ahead.
      if ((r.stats.flags || {}).twinAscend && WEAPONS[baseId]) {
        const others = (r.ownedWeapons || []).filter(
          (id) => id !== baseId && WEAPONS[id] && WEAPONS[id].type === 'manual');
        if (others.length) {
          others.sort((a, b) => (r.weaponLvls[a] || 0) - (r.weaponLvls[b] || 0));
          const twin = others[0];
          r.weaponLvls[twin] = (r.weaponLvls[twin] || 0) + 1;
          this.spawnDamageNumber(this.player.x, this.player.y - 60,
            `TWIN: ${WEAPONS[twin].name} +1`, '#b362ff');
        }
      }
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
        // The hard 100 cap that used to live here (and at run start) is gone.
        // It silently voided every HP source in the game past a very low
        // ceiling: meta's Hardened Core alone reaches +100, gear rolls up to
        // ~60 on a finished mythical chest, six talent nodes feed maxHp, and
        // the Vital Surge card gives +3 a pick — all of it clipped, so a
        // player could spend an entire economy on a stat that did nothing.
        //
        // It also made the reworked damage curve unsurvivable: by the ten
        // minute mark a plain slime hits for more than 100 after dmgMult, so
        // a capped player is one-shot by the weakest enemy in the game.
        // Health is now simply what the stats say it is.
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
      if (choice.flagId === 'coreOverload') r.stats.crit += 0.12;
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
