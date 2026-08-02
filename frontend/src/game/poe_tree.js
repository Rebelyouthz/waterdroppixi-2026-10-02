// =============================================
// POE2-STYLE SKILL TREE — Data & Config
// =============================================

export const POE_BRANCHES = {
  combat:    { name:'COMBAT',    icon:'⚔',  color:'#ff3146', glow:'rgba(255,49,70,0.5)'  },
  mobility:  { name:'MOBILITY',  icon:'💨',  color:'#4dffd4', glow:'rgba(77,255,212,0.5)' },
  defense:   { name:'DEFENSE',   icon:'🛡',  color:'#ffd166', glow:'rgba(255,209,102,0.5)'},
  greed:     { name:'GREED',     icon:'💰',  color:'#ffd700', glow:'rgba(255,215,0,0.5)'  },
  arcane:    { name:'ARCANE',    icon:'🔮',  color:'#b362ff', glow:'rgba(179,98,255,0.5)' },
  bloodline: { name:'BLOODLINE', icon:'🩸',  color:'#ff6b9d', glow:'rgba(255,107,157,0.5)'},
  void:      { name:'VOID',      icon:'🌌',  color:'#4dc4ff', glow:'rgba(77,196,255,0.5)' },
  pets:      { name:'PETS',      icon:'🐾',  color:'#51cf66', glow:'rgba(81,207,102,0.5)' },
  awakening: { name:'AWAKENING', icon:'🔱',  color:'#ff9900', glow:'rgba(255,153,0,0.5)'  },
};

// Tree canvas: 1800 × 2600 px
// Branches centered at x: 120, 320, 520, 720, 920, 1120, 1320, 1520
// Y levels (bottom→top): 2380, 2080, 1780, 1480, 1180, 880, 550, 250
//
// Node types:
//   minor    — r=18, max 3 levels
//   notable  — r=27, max 1-2 levels
//   keystone — r=40, max 1 level, active skill or powerful passive
export const POE_TREE_NODES = [

  // ═══════════════════════════════════════════
  // COMBAT (cx=120, #ff3146)
  // ═══════════════════════════════════════════
  { id:'poe_com0', branch:'combat', type:'minor',    x:120,  y:2380, req:[],                    max:3, c:1, stat:'dmg',      val:0.02,  name:'Strike Path',    icon:'⚔',  desc:'+2% damage per level. The warrior\'s first step.' },
  { id:'poe_com1', branch:'combat', type:'minor',    x:120,  y:2080, req:['poe_com0'],           max:3, c:1, stat:'dmg',      val:0.02,  name:'Edge Honing',    icon:'⚔',  desc:'+2% damage per level. Your blade finds its purpose.' },
  { id:'poe_com2', branch:'combat', type:'minor',    x:60,   y:1780, req:['poe_com1'],           max:3, c:1, stat:'pierce',   val:1,     name:'Pierce Arts',    icon:'➰',  desc:'+1 pierce per level. Cut through the horde.' },
  { id:'poe_com3', branch:'combat', type:'minor',    x:180,  y:1780, req:['poe_com1'],           max:3, c:2, stat:'proj',     val:1,     name:'Multishot',      icon:'🎯',  desc:'+1 projectile per level. More lead, more dead.' },
  { id:'poe_com4', branch:'combat', type:'notable',  x:120,  y:1480, req:['poe_com2','poe_com3'],max:1, c:4, stat:'crit',     val:0.08,  name:'True Aim',       icon:'💢',  desc:'+8% crit chance. Precision becomes instinct.' },
  { id:'poe_com5', branch:'combat', type:'minor',    x:120,  y:1180, req:['poe_com4'],           max:3, c:2, stat:'crit',     val:0.03,  name:'Dead Eye',       icon:'👁',  desc:'+3% crit per level. Nothing escapes your sight.' },
  { id:'poe_com6', branch:'combat', type:'keystone', x:120,  y:880,  req:['poe_com5'],           max:1, c:8, stat:'headshot', val:0.08,  name:'Headshot',       icon:'🎯',  desc:'ACTIVE: 8% chance to one-shot non-bosses.', active:true },
  { id:'poe_com7', branch:'combat', type:'keystone', x:120,  y:500,  req:['poe_com6'],           max:1, c:8, stat:'berserk',  val:1,     name:'Berserker',      icon:'🩸',  desc:'ACTIVE: Below 30% HP, gain +40% damage.', active:true },

  // ═══════════════════════════════════════════
  // MOBILITY (cx=320, #4dffd4)
  // ═══════════════════════════════════════════
  { id:'poe_mob0', branch:'mobility', type:'minor',    x:320, y:2380, req:[],                     max:3, c:1, stat:'mspd',  val:0.02,  name:'Light Step',    icon:'🥾',  desc:'+2% move speed per level.' },
  { id:'poe_mob1', branch:'mobility', type:'minor',    x:320, y:2080, req:['poe_mob0'],            max:3, c:1, stat:'mspd',  val:0.02,  name:'Wind Runner',   icon:'💨',  desc:'+2% speed per level. The wind follows you.' },
  { id:'poe_mob2', branch:'mobility', type:'minor',    x:260, y:1780, req:['poe_mob1'],            max:3, c:2, stat:'dodge', val:0.03,  name:'Evasion',       icon:'👻',  desc:'+3% dodge per level. Let them hit air.' },
  { id:'poe_mob3', branch:'mobility', type:'notable',  x:380, y:1780, req:['poe_mob1'],            max:1, c:3, stat:'dash',  val:1,     name:'Dash',          icon:'💨',  desc:'ACTIVE: SHIFT to dash with invincibility frames.', active:true },
  { id:'poe_mob3b',branch:'mobility', type:'notable',  x:460, y:1630, req:['poe_mob3'],            max:1, c:4, stat:'swipeAttack', val:1, name:'Swipe Strike', icon:'🗡',  desc:'ACTIVE: a fast swipe (flick the aim stick, or E on desktop) executes a nearby enemy instantly in a shower of blood. Tough enemies take heavy damage instead.', active:true },
  { id:'poe_mob4', branch:'mobility', type:'minor',    x:320, y:1480, req:['poe_mob2','poe_mob3'], max:3, c:2, stat:'dashcd',val:0.10,  name:'Quick Recall',  icon:'⏱',  desc:'-10% dash cooldown per level. Unlocks Meta: Dash CD.' },
  { id:'poe_mob5', branch:'mobility', type:'notable',  x:320, y:1180, req:['poe_mob4'],            max:1, c:4, stat:'mspd',  val:0.10,  name:'Ghoststep',     icon:'🌫',  desc:'+10% speed. Unlocks Meta: Eagle Eye.' },
  { id:'poe_mob6', branch:'mobility', type:'keystone', x:320, y:880,  req:['poe_mob5'],            max:1, c:8, stat:'blink', val:1,     name:'Blink Strike',  icon:'🌀',  desc:'ACTIVE: Dash teleports; deals AoE at landing.', active:true },
  { id:'poe_mob7', branch:'mobility', type:'keystone', x:320, y:500,  req:['poe_mob6'],            max:1, c:8, stat:'mspd',  val:0.20,  name:'Phantom Form',  icon:'🌌',  desc:'+20% speed. You leave afterimages.' },

  // ═══════════════════════════════════════════
  // DEFENSE (cx=520, #ffd166)
  // ═══════════════════════════════════════════
  { id:'poe_def0', branch:'defense', type:'minor',    x:520, y:2380, req:[],                      max:3, c:1, stat:'maxHp', val:3,    name:'Iron Will',     icon:'❤',  desc:'+3 max HP per level. Fortify your core.' },
  { id:'poe_def1', branch:'defense', type:'minor',    x:460, y:2080, req:['poe_def0'],             max:3, c:1, stat:'armor', val:0.3,  name:'Plating',       icon:'🛡',  desc:'+0.3 armor per level.' },
  { id:'poe_def2', branch:'defense', type:'minor',    x:580, y:2080, req:['poe_def0'],             max:3, c:1, stat:'regen', val:0.03, name:'Regrowth',      icon:'🌿',  desc:'+0.03 HP/s per level. Unlocks Meta: Regen.' },
  { id:'poe_def3', branch:'defense', type:'notable',  x:460, y:1780, req:['poe_def1'],             max:1, c:3, stat:'armor', val:2,    name:'Steel Ward',    icon:'🛡',  desc:'+2 armor. Your skin becomes like iron.' },
  { id:'poe_def4', branch:'defense', type:'notable',  x:580, y:1780, req:['poe_def2'],             max:1, c:3, stat:'regen', val:0.15, name:'Vital Flow',    icon:'🌿',  desc:'+0.15 HP/s regen. The Lake\'s energy flows through you.' },
  { id:'poe_def5', branch:'defense', type:'notable',  x:520, y:1480, req:['poe_def3','poe_def4'],  max:1, c:4, stat:'maxHp', val:10,   name:'Battle Scars',  icon:'⚔',  desc:'+10 max HP. Each wound makes you stronger.' },
  { id:'poe_def6', branch:'defense', type:'keystone', x:460, y:1180, req:['poe_def5'],             max:1, c:8, stat:'shield',val:1,    name:'Aegis',         icon:'✨',  desc:'ACTIVE: Absorb 1 hit every 25s.', active:true },
  { id:'poe_def7', branch:'defense', type:'keystone', x:580, y:1180, req:['poe_def5'],             max:1, c:8, stat:'revive',val:1,    name:'Phoenix',       icon:'🪽',  desc:'ACTIVE: Revive once per run at 50% HP. Unlocks Meta: Revive.', active:true },
  { id:'poe_def8', branch:'defense', type:'keystone', x:520, y:800,  req:['poe_def6','poe_def7'],  max:1, c:12,stat:'maxHp', val:20,   name:'Titan Skin',    icon:'🗿',  desc:'+20 max HP. Annunaki-forged body.' },

  // ═══════════════════════════════════════════
  // GREED (cx=720, #ffd700)
  // ═══════════════════════════════════════════
  { id:'poe_grd0', branch:'greed', type:'minor',    x:720, y:2380, req:[],                      max:3, c:1, stat:'gold',  val:0.04,  name:'Greed Path',    icon:'💰',  desc:'+4% gold per level.' },
  { id:'poe_grd1', branch:'greed', type:'minor',    x:660, y:2080, req:['poe_grd0'],             max:3, c:1, stat:'gold',  val:0.04,  name:'Hoarder',       icon:'💰',  desc:'+4% gold per level. Your pockets grow deeper.' },
  { id:'poe_grd2', branch:'greed', type:'minor',    x:780, y:2080, req:['poe_grd0'],             max:3, c:1, stat:'xp',    val:0.04,  name:'Scholar',       icon:'📖',  desc:'+4% XP per level.' },
  { id:'poe_grd3', branch:'greed', type:'notable',  x:660, y:1780, req:['poe_grd1'],             max:1, c:3, stat:'pickup',val:0.20,  name:'Iron Magnet',   icon:'🧲',  desc:'+20% pickup range. Gold flies to you.' },
  { id:'poe_grd4', branch:'greed', type:'notable',  x:780, y:1780, req:['poe_grd2'],             max:1, c:3, stat:'luck',  val:1.5,   name:'Fortune',       icon:'🍀',  desc:'+1.5 luck. The odds bend in your favor.' },
  { id:'poe_grd5', branch:'greed', type:'notable',  x:720, y:1480, req:['poe_grd3','poe_grd4'],  max:1, c:4, stat:'gold',  val:0.15,  name:'Gold Sense',    icon:'💎',  desc:'+15% gold. Unlocks Meta: Starter Cache.' },
  { id:'poe_grd6', branch:'greed', type:'keystone', x:720, y:1180, req:['poe_grd5'],             max:1, c:8, stat:'chestSense',val:1,  name:'Chest Finder',  icon:'📦',  desc:'ACTIVE: Chest enemies spawn 2x more often.', active:true },
  { id:'poe_grd7', branch:'greed', type:'keystone', x:720, y:800,  req:['poe_grd6'],             max:1, c:10,stat:'gold',  val:0.30,  name:'Golden Touch',  icon:'⭐',  desc:'+30% gold. Everything you touch turns to coin.' },

  // ═══════════════════════════════════════════
  // ARCANE (cx=920, #b362ff)
  // ═══════════════════════════════════════════
  { id:'poe_arc0', branch:'arcane', type:'minor',    x:920, y:2380, req:[],                      max:3, c:1, stat:'atks',     val:0.02,  name:'Arcane Touch',  icon:'🔮',  desc:'+2% attack speed per level.' },
  { id:'poe_arc1', branch:'arcane', type:'minor',    x:860, y:2080, req:['poe_arc0'],             max:3, c:1, stat:'atks',     val:0.02,  name:'Flow State',    icon:'⏱',  desc:'+2% attack speed per level. You enter the zone.' },
  { id:'poe_arc2', branch:'arcane', type:'minor',    x:980, y:2080, req:['poe_arc0'],             max:3, c:1, stat:'area',     val:0.04,  name:'Wider Wake',    icon:'🌀',  desc:'+4% area per level. Your presence expands.' },
  { id:'poe_arc3', branch:'arcane', type:'notable',  x:860, y:1780, req:['poe_arc1'],             max:1, c:3, stat:'critd',    val:0.15,  name:'Critical Will', icon:'🩸',  desc:'+15% crit damage. Crits punish mercilessly.' },
  { id:'poe_arc4', branch:'arcane', type:'notable',  x:980, y:1780, req:['poe_arc2'],             max:1, c:3, stat:'area',     val:0.15,  name:'Void Expanse',  icon:'🌌',  desc:'+15% area. Your AoE envelops the battlefield.' },
  { id:'poe_arc5', branch:'arcane', type:'notable',  x:920, y:1480, req:['poe_arc3','poe_arc4'],  max:1, c:5, stat:'superCrit',val:0.05,  name:'Super Strike',  icon:'💥',  desc:'+5% super crit chance. Unlocks Meta: Super Crit.' },
  { id:'poe_arc6', branch:'arcane', type:'notable',  x:920, y:1180, req:['poe_arc5'],             max:1, c:6, stat:'megaCrit', val:0.03,  name:'Mega Strike',   icon:'💢',  desc:'+3% mega crit chance. Unlocks Meta: Mega Crit.' },
  { id:'poe_arc7', branch:'arcane', type:'keystone', x:920, y:800,  req:['poe_arc6'],             max:1, c:10,stat:'bossDmg',  val:0.30,  name:'A.I.D.A. Link', icon:'👁',  desc:'ACTIVE: +30% damage to all bosses. A.I.D.A. fears you.', active:true },

  // ═══════════════════════════════════════════
  // BLOODLINE (cx=1120, #ff6b9d)
  // ═══════════════════════════════════════════
  { id:'poe_bld0', branch:'bloodline', type:'minor',    x:1120, y:2380, req:[],                        max:3, c:1, stat:'maxHp', val:2,    name:'Blood Bond',     icon:'🩸',  desc:'+2 max HP per level. Your lineage runs deep.' },
  { id:'poe_bld1', branch:'bloodline', type:'minor',    x:1060, y:2080, req:['poe_bld0'],               max:3, c:1, stat:'maxHp', val:2,    name:'Vital Core',     icon:'❤',  desc:'+2 max HP per level. Life energy reinforced.' },
  { id:'poe_bld2', branch:'bloodline', type:'minor',    x:1180, y:2080, req:['poe_bld0'],               max:3, c:1, stat:'regen', val:0.03, name:'Life Tap',       icon:'💊',  desc:'+0.03 HP/s per level. Drain the ether.' },
  { id:'poe_bld3', branch:'bloodline', type:'notable',  x:1060, y:1780, req:['poe_bld1'],               max:1, c:3, stat:'maxHp', val:8,    name:'Heartswell',     icon:'❤',  desc:'+8 max HP. Your heart grows.' },
  { id:'poe_bld4', branch:'bloodline', type:'notable',  x:1180, y:1780, req:['poe_bld2'],               max:1, c:4, stat:'regen', val:0.20, name:'Blood Pact',     icon:'🩸',  desc:'+0.2 HP/s. Pain feeds your regeneration.' },
  { id:'poe_bld5', branch:'bloodline', type:'notable',  x:1120, y:1480, req:['poe_bld3','poe_bld4'],    max:1, c:5, stat:'dmg',   val:0.10, name:'Ancestral Fury', icon:'🔥',  desc:'+10% damage. The fury of your ancestors awakens.' },
  { id:'poe_bld6', branch:'bloodline', type:'keystone', x:1120, y:1180, req:['poe_bld5'],               max:1, c:8, stat:'berserk',val:1,   name:'Berserker Vow',  icon:'⚔',  desc:'ACTIVE: Below 30% HP, gain +40% damage.', active:true },
  { id:'poe_bld7', branch:'bloodline', type:'keystone', x:1120, y:800,  req:['poe_bld6'],               max:1, c:12,stat:'maxHp', val:15,   name:'Undying Legacy', icon:'🌟',  desc:'+15 max HP. Your bloodline cannot end here.' },

  // ═══════════════════════════════════════════
  // VOID (cx=1320, #4dc4ff)
  // ═══════════════════════════════════════════
  { id:'poe_vd0', branch:'void', type:'minor',    x:1320, y:2380, req:[],                      max:3, c:1, stat:'area',     val:0.03,  name:'Void Touch',    icon:'🌌',  desc:'+3% area per level. The void answers your call.' },
  { id:'poe_vd1', branch:'void', type:'minor',    x:1260, y:2080, req:['poe_vd0'],             max:3, c:1, stat:'area',     val:0.03,  name:'Dark Matter',   icon:'🌑',  desc:'+3% area per level.' },
  { id:'poe_vd2', branch:'void', type:'minor',    x:1380, y:2080, req:['poe_vd0'],             max:3, c:1, stat:'bossDmg',  val:0.05,  name:'Boss Bane',     icon:'👁',  desc:'+5% boss damage per level.' },
  { id:'poe_vd3', branch:'void', type:'notable',  x:1260, y:1780, req:['poe_vd1'],             max:1, c:3, stat:'voidBurst',val:0.10,  name:'Void Burst',    icon:'💫',  desc:'+10% void burst on-kill chance.' },
  { id:'poe_vd4', branch:'void', type:'notable',  x:1380, y:1780, req:['poe_vd2'],             max:1, c:4, stat:'bossDmg',  val:0.15,  name:'Hunter\'s Mark',icon:'🎯',  desc:'+15% boss damage. They cannot hide from you.' },
  { id:'poe_vd5', branch:'void', type:'notable',  x:1320, y:1480, req:['poe_vd3','poe_vd4'],  max:1, c:5, stat:'area',     val:0.15,  name:'Eldritch Realm',icon:'🌀',  desc:'+15% area. You reshape reality.' },
  { id:'poe_vd6', branch:'void', type:'keystone', x:1320, y:1180, req:['poe_vd5'],             max:1, c:8, stat:'voidBurst',val:0.20,  name:'Void Caller',   icon:'🌌',  desc:'+20% void burst chance. Death begets death.' },
  { id:'poe_vd7', branch:'void', type:'keystone', x:1320, y:800,  req:['poe_vd6'],             max:1, c:12,stat:'bossDmg',  val:0.25,  name:'Eldritch King', icon:'👑',  desc:'+25% boss damage. You have become the apex predator.' },

  // ═══════════════════════════════════════════
  // PETS (cx=1520, #51cf66)
  // ═══════════════════════════════════════════
  { id:'poe_pet0', branch:'pets', type:'minor',    x:1520, y:2380, req:[],                       max:3, c:1, stat:'pickup', val:0.05,  name:'Bond',           icon:'🐾',  desc:'+5% pickup range. Your companions aid collection.' },
  { id:'poe_pet1', branch:'pets', type:'minor',    x:1460, y:2080, req:['poe_pet0'],              max:3, c:1, stat:'gold',   val:0.03,  name:'Harvest',        icon:'🌿',  desc:'+3% gold per level. Pets find treasures you miss.' },
  { id:'poe_pet2', branch:'pets', type:'minor',    x:1580, y:2080, req:['poe_pet0'],              max:3, c:1, stat:'xp',     val:0.03,  name:'Pack Wisdom',    icon:'📖',  desc:'+3% XP per level. Together you grow faster.' },
  { id:'poe_pet3', branch:'pets', type:'notable',  x:1460, y:1780, req:['poe_pet1'],              max:1, c:3, stat:'pickup', val:0.20,  name:'Pack Forager',   icon:'🧲',  desc:'+20% pickup range. Your pack covers every inch.' },
  { id:'poe_pet4', branch:'pets', type:'notable',  x:1580, y:1780, req:['poe_pet2'],              max:1, c:3, stat:'luck',   val:1.0,   name:'Lucky Pack',     icon:'🍀',  desc:'+1 luck. Your pets bring fortune.' },
  { id:'poe_pet5', branch:'pets', type:'notable',  x:1520, y:1480, req:['poe_pet3','poe_pet4'],   max:1, c:5, stat:'gold',   val:0.15,  name:'Alpha Bond',     icon:'⭐',  desc:'+15% gold. The alpha commands the finest tribute.' },
  { id:'poe_pet6', branch:'pets', type:'keystone', x:1520, y:1180, req:['poe_pet5'],              max:1, c:8, stat:'pickup', val:0.30,  name:'Apex Pack',      icon:'🐾',  desc:'+30% pickup range. Your pack is legendary.' },
  { id:'poe_pet7', branch:'pets', type:'keystone', x:1520, y:800,  req:['poe_pet6'],              max:1, c:12,stat:'gold',   val:0.25,  name:'Pack Sovereign', icon:'👑',  desc:'+25% gold. The sovereign pack claims everything.' },

  // ═══════════════════════════════════════════
  // AWAKENING (cx=1720, #ff9900) — evolution + level-up shockwave
  // ═══════════════════════════════════════════
  { id:'poe_awk0', branch:'awakening', type:'notable',  x:1720, y:2380, req:[],               max:1, c:6, stat:'area',  val:0.05,  name:'Awakening Gate',    icon:'🔱', desc:'Unlocks WEAPON EVOLUTION. Grants +5% area.' },
  { id:'poe_awk1', branch:'awakening', type:'notable',  x:1720, y:2080, req:['poe_awk0'],     max:3, c:3, stat:'area',  val:0.03,  name:'Shockwave Mastery', icon:'💥', desc:'+3% area per level. Unlocks: Explosion Dmg meta upgrade.' },
  { id:'poe_awk2', branch:'awakening', type:'keystone', x:1720, y:1780, req:['poe_awk1'],     max:1, c:8, stat:'area',  val:0.10,  name:'Earthshaker',       icon:'🌍', desc:'+10% area. Unlocks: Explosion Knockback meta upgrade.' },
];

// Fast lookup by ID
export const POE_INDEX = {};
for (const n of POE_TREE_NODES) POE_INDEX[n.id] = n;

// ── Meta upgrade unlock requirements ──────────────
// A meta upgrade is locked until the specified POE node is purchased (lvl >= 1).
export const META_UNLOCK_REQS = {
  m_superCrit: 'poe_arc5',   // Super Strike (ARCANE)
  m_megaCrit:  'poe_arc6',   // Mega Strike  (ARCANE)
  m_revive:    'poe_def7',   // Phoenix      (DEFENSE)
  m_zoom:      'poe_mob5',   // Ghoststep    (MOBILITY) — Eagle Eye meta
  m_dodge:     'poe_mob2',   // Evasion      (MOBILITY)
  m_regen:     'poe_def2',   // Regrowth     (DEFENSE)
  m_start:     'poe_grd5',   // Gold Sense   (GREED) — Starter Cache meta
  c_vamp:      'poe_bld0',   // Vampirism card — requires Bloodline start
  m_lvlBoomDmg:'poe_awk1',   // Shockwave Mastery — explosion damage meta
  m_lvlBoomKB: 'poe_awk2',   // Earthshaker — explosion knockback meta
};

// ── 360° RADIAL LAYOUT ───────────────────────────
// Converts each node's (branch, x, y) into polar coordinates radiating from
// a single center point — same 65-node dataset & depth (no rewrite of node
// costs/reqs), just reprojected: branch → angular sector (evenly spaced
// around the full circle), tier (y-level, inner→outer) → ring radius,
// left/right fan offset (x - branchRootX, always exactly ±60 or 0 in the
// source data) → angular offset within the sector.
export const RADIAL_CENTER = 1500;
const RING_BASE = 175;
const RING_STEP = 140;
const MAX_FAN_OFFSET = 60;

const _branchKeys = Object.keys(POE_BRANCHES);
const _sectorAngle = (2 * Math.PI) / _branchKeys.length;
const _sectorHalfAngle = (_sectorAngle / 2) * 0.68; // leaves a visible gap between branch wedges

const _branchRootX = {};
for (const n of POE_TREE_NODES) {
  if (!n.req || n.req.length === 0) _branchRootX[n.branch] = n.x;
}

// Global tier ranking: every distinct y used in the dataset, innermost
// (largest y / start nodes) first — gives concentric rings shared across all
// branches so the wheel reads as one coherent structure.
const _tierYs = [...new Set(POE_TREE_NODES.map(n => n.y))].sort((a, b) => b - a);
const _tierOfY = {};
_tierYs.forEach((y, i) => { _tierOfY[y] = i; });

export const BRANCH_ANGLES = {};
_branchKeys.forEach((k, i) => { BRANCH_ANGLES[k] = -Math.PI / 2 + i * _sectorAngle; });

export const MAX_TIER = _tierYs.length - 1;
export const MAX_TIER_RADIUS = RING_BASE + MAX_TIER * RING_STEP;

export const POE_RADIAL_INDEX = {};
export const POE_RADIAL_NODES = POE_TREE_NODES.map(n => {
  const baseAngle = BRANCH_ANGLES[n.branch];
  const rootX = _branchRootX[n.branch] ?? n.x;
  const fanFrac = Math.max(-1, Math.min(1, (n.x - rootX) / MAX_FAN_OFFSET));
  const angle = baseAngle + fanFrac * _sectorHalfAngle;
  const tier = _tierOfY[n.y] ?? 0;
  const radius = RING_BASE + tier * RING_STEP;
  const out = {
    ...n,
    tier, radius, angle,
    rx: RADIAL_CENTER + radius * Math.cos(angle),
    ry: RADIAL_CENTER + radius * Math.sin(angle),
  };
  POE_RADIAL_INDEX[n.id] = out;
  return out;
});

// ── Attribute system ────────────────────────────
// Each profile level grants 1 attribute point.
// Stored in save.attrs: { atk, dex, vit, mob, int, ele, mag }
export const POE_ATTRS = [
  { id:'atk', name:'Attack',       icon:'⚔',  color:'#ff3146', stat:'dmg',   perPoint:0.01,  desc:'+1% damage per attribute point' },
  { id:'dex', name:'Dexterity',    icon:'🎯',  color:'#4dffd4', stat:'crit',  perPoint:0.005, desc:'+0.5% crit chance per point' },
  { id:'vit', name:'Vitality',     icon:'❤',  color:'#ffd166', stat:'maxHp', perPoint:2,     desc:'+2 max HP per point' },
  { id:'mob', name:'Mobility',     icon:'💨',  color:'#4dffd4', stat:'mspd',  perPoint:0.005, desc:'+0.5% move speed per point' },
  { id:'int', name:'Intelligence', icon:'📖',  color:'#b362ff', stat:'xp',    perPoint:0.005, desc:'+0.5% XP per point' },
  { id:'ele', name:'Elemental',    icon:'🌀',  color:'#4dc4ff', stat:'area',  perPoint:0.01,  desc:'+1% area per point' },
  { id:'mag', name:'Magic',        icon:'🔮',  color:'#b362ff', stat:'atks',  perPoint:0.005, desc:'+0.5% attack speed per point' },
];
