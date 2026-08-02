// Waterdrop Survivor — Iter 4 data: blueprints, parts, missions, achievements, stages, challenges, active skills, new lvlup cards.
import { WEAPONS } from './data';

// ---------- 5 STARTER WEAPONS (all manual-aim) ----------
export const STARTER_WEAPONS = {
  hydropistol: {  // already in WEAPONS - this is canonical starter
    id: 'hydropistol', name: 'Hydro Pistol', icon: '💧',
    blueprint: null, // already owned by default
  },
  twinSMG: {
    id: 'twinSMG', name: 'Twin SMG', icon: '🔫',
    blueprintCost: 5,
    desc: 'Dual SMGs. Rapid fire, low damage, huge mag.',
    base: { damage: 9, fireRate: 9.0, projSpeed: 760, projSize: 4, magazine: 32, reloadTime: 1.3, pierce: 0, knockback: 30, spread: 0.10, crit: 0.05, color: '#4dffd4' },
    type: 'manual', behaviour: 'projectile',
    levelUps: [
      { stat: 'damage', mult: 1.15 }, { stat: 'fireRate', mult: 1.1 }, { stat: 'magazine', add: 12 },
      { stat: 'damage', mult: 1.2 }, { stat: 'pierce', add: 1 }, { stat: 'crit', add: 0.06 }, { stat: 'damage', mult: 1.4, evolve: true },
    ],
  },
  tidalShotgun: {
    id: 'tidalShotgun', name: 'Tidal Shotgun', icon: '💥',
    blueprintCost: 6,
    desc: 'Wide spray, 5 pellets, brutal close range.',
    base: { damage: 14, fireRate: 1.4, projSpeed: 680, projSize: 6, magazine: 6, reloadTime: 1.8, pierce: 0, knockback: 200, spread: 0.45, crit: 0.06, color: '#ff7a1a', pellets: 5 },
    type: 'manual', behaviour: 'shotgun',
    levelUps: [
      { stat: 'pellets', add: 1 }, { stat: 'damage', mult: 1.2 }, { stat: 'magazine', add: 2 },
      { stat: 'pellets', add: 1 }, { stat: 'fireRate', mult: 1.2 }, { stat: 'damage', mult: 1.3 }, { stat: 'damage', mult: 1.5, evolve: true },
    ],
  },
  runicRifle: {
    id: 'runicRifle', name: 'Runic Rifle', icon: '🎯',
    blueprintCost: 8,
    desc: 'Slow, hard-hitting, piercing rifle.',
    base: { damage: 55, fireRate: 1.5, projSpeed: 1200, projSize: 5, magazine: 5, reloadTime: 1.8, pierce: 4, knockback: 140, spread: 0.005, crit: 0.18, color: '#ffd166' },
    type: 'manual', behaviour: 'projectile',
    levelUps: [
      { stat: 'damage', mult: 1.25 }, { stat: 'pierce', add: 2 }, { stat: 'crit', add: 0.10 },
      { stat: 'damage', mult: 1.3 }, { stat: 'fireRate', mult: 1.2 }, { stat: 'crit', add: 0.10 }, { stat: 'damage', mult: 1.7, evolve: true },
    ],
  },
  plasmaLance: {
    id: 'plasmaLance', name: 'Plasma Lance', icon: '⚡',
    blueprintCost: 10,
    desc: 'Charged plasma bolts that explode on impact.',
    base: { damage: 32, fireRate: 2.5, projSpeed: 900, projSize: 9, magazine: 10, reloadTime: 1.5, pierce: 1, knockback: 90, spread: 0.02, crit: 0.10, color: '#b362ff', explode: 60 },
    type: 'manual', behaviour: 'projectile',
    levelUps: [
      { stat: 'damage', mult: 1.2 }, { stat: 'explode', add: 20 }, { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.25 }, { stat: 'pierce', add: 1 }, { stat: 'explode', add: 30 }, { stat: 'damage', mult: 1.5, evolve: true },
    ],
  },
};
// merge into WEAPONS so existing code finds them
for (const k of Object.keys(STARTER_WEAPONS)) {
  if (!WEAPONS[k]) WEAPONS[k] = STARTER_WEAPONS[k];
}

// ---------- WEAPON PARTS (AK47 style attachment system) ----------
export const PART_SLOTS = ['barrel', 'magazine', 'sight', 'muzzle', 'stock', 'bullets', 'grip'];
export const PART_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];
export const PART_RARITY_COLORS = { common: '#9a8fa6', magic: '#4dc4ff', rare: '#ffd166', epic: '#b362ff', legendary: '#ff7a1a' };
export const PART_RARITY_MULT  = { common: 1.0, magic: 1.5, rare: 2.1, epic: 2.9, legendary: 4.0 };
export const PART_SLOT_INFO = {
  barrel:   { icon: '🔫', primary: 'damage', secondary: ['range', 'projSpeed'] },
  magazine: { icon: '📦', primary: 'magBonus', secondary: ['reloadMult', 'magBonus'] },
  sight:    { icon: '🎯', primary: 'crit', secondary: ['critd', 'headshot'] },
  muzzle:   { icon: '💢', primary: 'fireRate', secondary: ['knockback', 'spreadReduce'] },
  stock:    { icon: '🪵', primary: 'recoil', secondary: ['atks', 'reloadMult'] },
  bullets:  { icon: '🔸', primary: 'pierce', secondary: ['damage', 'burn', 'shock'] },
  grip:     { icon: '🪢', primary: 'mspd', secondary: ['atks', 'reloadMult'] },
};
const PART_NAME_BASE = {
  barrel: ['Stub', 'Heavy', 'Annunaki', 'Voidsteel', 'Eldritch'],
  magazine: ['Standard', 'Extended', 'Drum', 'Cosmic', 'Infinite'],
  sight: ['Iron', 'Red Dot', 'Tactical', 'Eye of Horus', 'A.I.D.A. Vision'],
  muzzle: ['Plain', 'Compensator', 'Suppressor', 'Echo', 'Voidlash'],
  stock: ['Wooden', 'Carbon', 'Tactical', 'Stabilized', 'Aida-Tech'],
  bullets: ['FMJ', 'AP', 'Incendiary', 'Shock', 'Voidshard'],
  grip: ['Rubber', 'Carbon', 'Bone', 'Voidweave', 'Aida-Grip'],
};
export function partName(slot, rarity) {
  const rIdx = PART_RARITIES.indexOf(rarity);
  const base = PART_NAME_BASE[slot][Math.min(rIdx, PART_NAME_BASE[slot].length - 1)];
  return base + ' ' + PART_SLOT_INFO[slot].icon;
}
export function rollPart(slot, forcedRarity = null) {
  const rarity = forcedRarity || rollPartRarity();
  const mult = PART_RARITY_MULT[rarity];
  const info = PART_SLOT_INFO[slot];
  // Primary stat always
  const primary = { stat: info.primary, val: rollStatValue(info.primary, mult, true) };
  // Secondary 0..2 by rarity
  const rIdx = PART_RARITIES.indexOf(rarity);
  const subCount = Math.max(0, rIdx); // common=0, magic=1, rare=2, epic=2, legendary=3 (capped at 2 unique)
  const sub = [];
  const used = new Set([info.primary]);
  const pool = info.secondary.filter(s => !used.has(s));
  for (let i = 0; i < Math.min(subCount, pool.length); i++) {
    const stat = pool[i];
    used.add(stat);
    sub.push({ stat, val: rollStatValue(stat, mult, false) });
  }
  return {
    id: 'pt_' + Math.random().toString(36).slice(2, 9),
    slot, rarity, name: partName(slot, rarity),
    primary, sub,
  };
}
function rollPartRarity() {
  const weights = { common: 60, magic: 28, rare: 9, epic: 2.5, legendary: 0.5 };
  const tot = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (const [k, v] of Object.entries(weights)) { r -= v; if (r <= 0) return k; }
  return 'common';
}
function rollStatValue(stat, mult, primary) {
  const base = primary ? 0.10 : 0.05;
  if (stat === 'magBonus') return Math.ceil(2 * mult);
  if (stat === 'damage')   return +(base * mult).toFixed(2);
  if (stat === 'pierce')   return mult >= 2 ? Math.ceil(mult / 2) : 0;
  if (stat === 'burn' || stat === 'shock') return +(0.04 * mult).toFixed(2);
  if (stat === 'headshot') return +(0.02 * mult).toFixed(2);
  if (stat === 'recoil' || stat === 'spreadReduce') return +(0.10 * mult).toFixed(2);
  if (stat === 'range' || stat === 'projSpeed') return +(0.08 * mult).toFixed(2);
  return +((0.03 + Math.random() * 0.04) * mult).toFixed(2);
}
export const STAT_DISPLAY = {
  damage: 'Damage', fireRate: 'Atk Speed', crit: 'Crit', critd: 'Crit Dmg', magBonus: 'Magazine',
  pierce: 'Pierce', range: 'Range', projSpeed: 'Velocity', burn: 'Burn', shock: 'Shock',
  headshot: 'Headshot', recoil: 'Recoil-', reloadMult: 'Reload-', mspd: 'Move Spd',
  knockback: 'Knockback', atks: 'Atk Speed', spreadReduce: 'Accuracy',
};

// ---------- DAILY MISSIONS ----------
export const MISSION_DEFS = [
  {
    id: 'm_easy',  name: 'Recon Sweep',  icon: '🪶', stage: 1,
    desc: 'Survive 90 seconds. 60% spawn rate. Easy.',
    duration: 90,  spawnMult: 0.6, hpMult: 0.8,
    reward: { blueprintShards: { random: true, count: 1 }, parts: { common: 2 }, gold: 80 },
  },
  {
    id: 'm_med',   name: 'Salvage Run',  icon: '⚙️', stage: 2,
    desc: 'Survive 3 minutes. Normal spawn. Magic parts drop.',
    duration: 180, spawnMult: 1.0, hpMult: 1.0,
    reward: { blueprintShards: { random: true, count: 2 }, parts: { magic: 2, common: 1 }, gold: 200 },
  },
  {
    id: 'm_hard',  name: 'Boss Hunt',    icon: '👁', stage: 3,
    desc: 'Survive 5 min — boss waves. Rare+ parts drop.',
    duration: 300, spawnMult: 1.3, hpMult: 1.2, forceBoss: true,
    reward: { blueprintShards: { random: true, count: 3 }, parts: { rare: 2, magic: 1 }, gold: 500 },
  },
];
export const MISSION_DAILY_LIMIT = 3;
export const MISSION_REGEN_MS = 8 * 60 * 60 * 1000;
export function rollMissionRewards(reward, weapons) {
  const out = { gold: reward.gold || 0, blueprintShards: {}, parts: [] };
  if (reward.blueprintShards) {
    const pool = ['twinSMG', 'tidalShotgun', 'runicRifle', 'plasmaLance'];
    for (let i = 0; i < reward.blueprintShards.count; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      out.blueprintShards[id] = (out.blueprintShards[id] || 0) + 1;
    }
  }
  if (reward.parts) {
    for (const [rarity, count] of Object.entries(reward.parts)) {
      for (let i = 0; i < count; i++) {
        const slot = PART_SLOTS[Math.floor(Math.random() * PART_SLOTS.length)];
        out.parts.push(rollPart(slot, rarity));
      }
    }
  }
  return out;
}

// ---------- ACHIEVEMENTS ----------
export const ACHIEVEMENTS = [
  { id: 'a_first_kill',   name: 'First Blood',       icon: '🩸', desc: 'Kill 1 enemy', metric: 'totalKills', goal: 1,    rwd: { gold: 25 } },
  { id: 'a_kills_100',    name: 'Hundred',           icon: '⚔️', desc: '100 total kills',  metric: 'totalKills', goal: 100,  rwd: { gold: 100, sp: 1 } },
  { id: 'a_kills_1k',     name: 'Massacre',          icon: '💀', desc: '1000 total kills', metric: 'totalKills', goal: 1000, rwd: { gold: 600, sp: 3 } },
  { id: 'a_kills_10k',    name: 'Annihilator',       icon: '👹', desc: '10000 total kills',metric: 'totalKills', goal: 10000,rwd: { gold: 3000, sp: 10 } },
  { id: 'a_runs_10',      name: 'Survivor',          icon: '🛡', desc: '10 runs completed',metric: 'runsCompleted', goal: 10, rwd: { gold: 300 } },
  { id: 'a_runs_50',      name: 'Veteran',           icon: '🏅', desc: '50 runs completed',metric: 'runsCompleted', goal: 50, rwd: { gold: 1500, sp: 5 } },
  { id: 'a_time_5m',      name: 'Endurance',         icon: '⏱', desc: 'Survive 5 min',     metric: 'bestRunTime', goal: 300, rwd: { gold: 400, sp: 1 } },
  { id: 'a_time_10m',     name: 'Eternal',           icon: '♾', desc: 'Survive 10 min',    metric: 'bestRunTime', goal: 600, rwd: { gold: 1200, sp: 3 } },
  { id: 'a_aida',         name: 'Bossfall',          icon: '👁', desc: 'Defeat A.I.D.A.',   metric: 'aidaSlain', goal: 1, rwd: { gold: 2000, sp: 5 } },
  { id: 'a_lvl_30',       name: 'Apex',              icon: '⭐', desc: 'Reach run level 30',metric: 'bestKills', goal: 30, rwd: { gold: 400 } },
  { id: 'a_gold_10k',     name: 'Wealthy',           icon: '💰', desc: 'Earn 10000 gold',   metric: 'lifetimeGold', goal: 10000, rwd: { sp: 5 } },
  { id: 'a_blueprint',    name: 'Gunsmith',          icon: '📜', desc: 'Craft a starter weapon', metric: 'weaponsCrafted', goal: 1, rwd: { gold: 200 } },
  { id: 'a_all_weapons',  name: 'Arsenal',           icon: '🗡', desc: 'Craft all 4 weapons', metric: 'weaponsCrafted', goal: 4, rwd: { gold: 2000, sp: 5 } },
  { id: 'a_part_leg',     name: 'Legendary Smith',   icon: '✨', desc: 'Find a legendary part', metric: 'legendaryPartsFound', goal: 1, rwd: { gold: 500, sp: 2 } },
  { id: 'a_skill_25',     name: 'Awakened',          icon: '🧠', desc: 'Learn 25 skill levels', metric: 'skillsLearned', goal: 25, rwd: { gold: 600, sp: 3 } },
  { id: 'a_active_4',     name: 'Hot Bar',           icon: '🔥', desc: 'Equip 4 active skills', metric: 'activeSkillsCount', goal: 4, rwd: { gold: 400 } },
  { id: 'a_chest_50',     name: 'Hoarder',           icon: '📦', desc: 'Open 50 chests',    metric: 'chestsOpened', goal: 50, rwd: { gold: 800, sp: 2 } },
  { id: 'a_no_hit',       name: 'Untouchable',       icon: '👻', desc: 'Complete a mission without taking damage', metric: 'noHitRuns', goal: 1, rwd: { gold: 600, sp: 3 } },
  { id: 'a_challenge_4',  name: 'Trial Master',      icon: '🏆', desc: 'Complete all challenges', metric: 'challengesCompleted', goal: 4, rwd: { gold: 1500, sp: 5 } },
  { id: 'a_daily_7',      name: 'Devoted',           icon: '📅', desc: '7-day daily login streak', metric: 'dailyStreak', goal: 7, rwd: { gold: 500 } },
  // Boss hunters
  { id: 'a_necro',        name: 'Bone Collector',    icon: '💀', desc: 'Defeat The Necromancer',   metric: 'necroSlain', goal: 1, rwd: { gold: 500, sp: 2 } },
  { id: 'a_void',         name: 'Titan Crusher',     icon: '🌌', desc: 'Defeat the Void Titan',    metric: 'voidSlain',  goal: 1, rwd: { gold: 800, sp: 3 } },
  { id: 'a_horus',        name: 'Eye Closer',        icon: '👁', desc: 'Defeat the Eye of Horus',  metric: 'horusSlain', goal: 1, rwd: { gold: 300, sp: 1 } },
  { id: 'a_endless',      name: 'Void Walker',       icon: '♾', desc: 'Reach Endless Mode',        metric: 'endlessReached', goal: 1, rwd: { gold: 2000, sp: 8 } },
  // Progression milestones
  { id: 'a_lvl_50',       name: 'Transcendent',      icon: '🌟', desc: 'Reach level 50 in a run',  metric: 'bestKills', goal: 50, rwd: { gold: 3000, sp: 10 } },
  { id: 'a_kills_50k',    name: 'Reaper',            icon: '⚰', desc: '50,000 total kills',        metric: 'totalKills', goal: 50000, rwd: { gold: 10000, sp: 20 } },
  { id: 'a_runs_100',     name: 'Centurion',         icon: '🎖', desc: '100 runs completed',        metric: 'runsCompleted', goal: 100, rwd: { gold: 5000, sp: 15 } },
  { id: 'a_gold_50k',     name: 'Dragon Hoard',      icon: '💎', desc: 'Earn 50k lifetime gold',   metric: 'lifetimeGold', goal: 50000, rwd: { sp: 10 } },
  { id: 'a_nohit_5',      name: 'Phantom',           icon: '🌫', desc: 'Complete 5 no-hit runs',   metric: 'noHitRuns', goal: 5, rwd: { gold: 2500, sp: 8 } },
  { id: 'a_maps_all',     name: 'Cartographer',      icon: '🗺', desc: 'Complete all map stages',  metric: 'mapsCompleted', goal: 4, rwd: { gold: 5000, sp: 15 } },
];

// ---------- STAGES (visual themes + spawn mods) ----------
export const STAGES = {
  lake:    { id: 'lake',    name: 'The Lake',         icon: '🌊', desc: 'The shallows. Where it all begins.',     bg: '#0c0a16', accent: '#4dc4ff', enemyMix: ['slime', 'bat', 'ghoul'],     spawnMult: 1.0, unlock: { kind: 'default' } },
  ruins:   { id: 'ruins',   name: 'Sunken Ruins',     icon: '🏛',  desc: 'Forgotten halls. Ranged threats lurk.',  bg: '#1a1208', accent: '#ffd166', enemyMix: ['ghoul', 'ranger', 'brute'],   spawnMult: 1.1, unlock: { kind: 'kills',  goal: 200 } },
  void:    { id: 'void',    name: 'Void Lab',         icon: '🌌', desc: 'A.I.D.A.\'s old chambers. Eldritch fiends.', bg: '#0a081a', accent: '#b362ff', enemyMix: ['bat', 'charger', 'necron'],  spawnMult: 1.2, unlock: { kind: 'runs',   goal: 5 } },
  ship:    { id: 'ship',    name: 'Annunaki Ship',    icon: '🛸', desc: 'The final outpost. A.I.D.A. waits.',     bg: '#1a0a08', accent: '#ff7a1a', enemyMix: ['brute', 'charger', 'necron', 'ranger'], spawnMult: 1.4, unlock: { kind: 'boss',   goal: 1 } },
};

// ---------- CHALLENGE MODES ----------
export const CHALLENGES = [
  { id: 'c_bossrush', name: 'Boss Rush',  icon: '👹', desc: 'Endless bosses. No respite.',  mod: { bossRush: true, duration: 999 },  rwd: { gold: 800, sp: 3 } },
  { id: 'c_horde',    name: 'Horde',      icon: '🌊', desc: '10× spawn. Survive 60s.',     mod: { spawnMult: 10, duration: 60 },     rwd: { gold: 500, sp: 2 } },
  { id: 'c_trial',    name: 'Time Trial', icon: '⏱', desc: 'Kill 500 enemies fast.',      mod: { killGoal: 500 },                   rwd: { gold: 1000, sp: 4 } },
  { id: 'c_nohit',    name: 'No-Hit Hero',icon: '👻', desc: 'Survive 3 min. ZERO hits.',   mod: { duration: 180, noHit: true },      rwd: { gold: 1200, sp: 5 } },
];

// ---------- ACTIVE SKILLS (button-icon with cooldown) ----------
export const ACTIVE_SKILLS = {
  lightning: { id: 'lightning', name: 'Lightning Strike', icon: '⚡', cd: 8,  cost: 0, key: '1', desc: 'Strike a foe with lightning. Chains to 4 nearby.' },
  aegis:     { id: 'aegis',     name: 'Aegis Aura',       icon: '🛡', cd: 18, cost: 0, key: '2', desc: 'Invuln + reflect 3s.' },
  timewarp:  { id: 'timewarp',  name: 'Time Warp',        icon: '⏱', cd: 25, cost: 0, key: '3', desc: 'Slow all enemies for 4s.' },
  decoy:     { id: 'decoy',     name: 'Decoy Drop',       icon: '👤', cd: 12, cost: 0, key: '4', desc: 'Drop decoy that pulls aggro 6s.' },
  meteor:    { id: 'meteor',    name: 'Meteor Call',      icon: '☄️', cd: 14, cost: 0, key: '1', desc: 'Call meteor on cursor — massive AoE.' },
  vortex:    { id: 'vortex',    name: 'Void Vortex',      icon: '🌀', cd: 16, cost: 0, key: '2', desc: 'Black hole pulls enemies, drains HP.' },
};
export const ACTIVE_SKILL_KEYS = Object.keys(ACTIVE_SKILLS);
// You can equip up to 4 active skills (out of pool). Unlock via card shop.

// ---------- NEW LEVEL UP CARDS (15+ interesting passive/active) ----------
export const ADVANCED_CARDS = [
  { id: 'c_lightning',   icon: '⚡', name: 'Lightning Crit',  desc: 'Crits arc lightning to 2 nearby foes',           flag: 'lightningOnCrit' },
  { id: 'c_aura',        icon: '🔥', name: 'Damage Aura',     desc: 'Burning aura damages foes around you',           flag: 'damageAura' },
  { id: 'c_vamp',        icon: '🩸', name: 'Vampirism',       desc: '0.1% lifesteal on hit (upgrade in Meta)',        flag: 'vampire', amount: 0.001 },
  { id: 'c_chain',       icon: '🔗', name: 'Chain Strike',    desc: 'Kills chain to nearby for 50% dmg',              flag: 'chainOnKill' },
  { id: 'c_slow',        icon: '❄', name: 'Slow Field',      desc: 'Aura slows enemies 30%',                         flag: 'slowField' },
  { id: 'c_burn',        icon: '🔥', name: 'Burn',            desc: 'Hits apply burn DoT',                            flag: 'burnDoT' },
  { id: 'c_poison',      icon: '☠', name: 'Poison Cloud',    desc: 'On kill leave poison patch',                     flag: 'poisonOnKill' },
  { id: 'c_glass',       icon: '💀', name: 'Glass Cannon',    desc: '+150% damage, -50% HP',                          flag: 'glassCannon' },
  { id: 'c_reflect',     icon: '🪞', name: 'Reflect',         desc: 'Reflect 30% damage back',                        flag: 'reflect', amount: 0.30 },
  { id: 'c_explode',     icon: '💥', name: 'Explosive Death', desc: 'Killed enemies explode for 30 dmg',              flag: 'explosiveDeath' },
  { id: 'c_lifeline',    icon: '🛟', name: 'Lifeline',        desc: 'Below 20% HP gain temporary shield',             flag: 'lifeline' },
  { id: 'c_mirror',      icon: '👯', name: 'Mirror Image',    desc: 'Spawn a decoy every 12s',                        flag: 'mirrorAura' },
  { id: 'c_knockback',   icon: '💨', name: 'Knockback Wave',  desc: 'Every 8s a wave knocks all back',                flag: 'knockbackWave' },
  { id: 'c_starburst',   icon: '🌟', name: 'Star Burst',      desc: 'Every 5 kills → AoE burst',                      flag: 'starBurst' },
  { id: 'c_doublehit',   icon: '⚔️', name: 'Multistrike',     desc: '20% chance to double-hit',                       flag: 'doubleHit', amount: 0.20 },
  { id: 'c_grit',        icon: '🪨', name: 'Grit',            desc: 'When hit, -30% dmg for 2s',                      flag: 'grit' },
  { id: 'c_vision',      icon: '🔭', name: 'Eagle Vision',     desc: '+25% vision range (camera zoom out)',           flag: 'vision' },
  { id: 'c_double_dmg',  icon: '🗡', name: 'Sharp Steel',      desc: '+25% damage permanently this run',              flag: 'sharpSteel' },
  { id: 'c_speed',       icon: '💨', name: 'Bloodrush',        desc: '+15% move speed + reload',                      flag: 'bloodrush' },
  { id: 'c_magnet',      icon: '🧲', name: 'Iron Pull',        desc: '+80% pickup range',                             flag: 'ironPull' },
  // --- new passive auto-weapons & effects ---
  { id: 'c_thunder',     icon: '🌩', name: 'Thunder Cult',      desc: 'Every 4s strike random foe for 60 dmg',         flag: 'thunderCult' },
  { id: 'c_iceShard',    icon: '🧊', name: 'Ice Shards',        desc: 'Auto-launch homing ice shards every 1.6s',      flag: 'iceShards' },
  { id: 'c_holyWater',   icon: '💧', name: 'Holy Water',        desc: 'Heal ring pulses every 6s (+15 HP)',            flag: 'holyWater' },
  { id: 'c_swarm',       icon: '🐝', name: 'Swarm',             desc: 'Orbiting bees pierce + sting nearby foes',      flag: 'swarmAura' },
  { id: 'c_spike',       icon: '🪤', name: 'Spike Plates',      desc: 'Drop spike traps on dash/spawn (60 dmg)',       flag: 'spikePlates' },
  { id: 'c_overcharge',  icon: '⚡', name: 'Overcharge',        desc: 'Every 6th shot is double damage',               flag: 'overcharge' },
  { id: 'c_railgun',     icon: '🎯', name: 'Railgun Stance',    desc: 'Standing still 1s+ = +60% damage',              flag: 'railStance' },
  { id: 'c_juggernaut',  icon: '💪', name: 'Juggernaut',        desc: '+1 HP regen per 5 enemies in 200u',             flag: 'juggernaut' },
  // Stat-type (not flag) so re-picking it stacks: +1 bounce AND slightly
  // more damage per bounce each time, per level-up.
  { id: 'c_conductive',  icon: '🔌', name: 'Conductive Rounds', desc: 'Bullet hits arc lightning to a nearby foe (stacks: +1 bounce, +bounce damage)', stat: 'conductiveBounces', amount: 1 },
  // ─── New passives ───────────────────────────────────────────
  { id: 'c_ironHide',   icon: '⚙️', name: 'Iron Hide',          desc: '+4 flat armor permanently this run',            stat: 'armor', amount: 4 },
  { id: 'c_soulHarvest',icon: '💀', name: 'Soul Harvest',       desc: 'Every 25 kills restore +1 HP',                  flag: 'soulHarvest' },
  { id: 'c_quickstep',  icon: '💨', name: 'Quickstep',          desc: '+20% speed for 1.5s after taking damage',       flag: 'quickstep' },
  { id: 'c_thorns',     icon: '🌵', name: 'Thorns',             desc: 'Return 25% of dmg received as melee',           flag: 'thorns', amount: 0.25 },
  { id: 'c_berserker',  icon: '🔥', name: 'Berserker',          desc: 'Below 30% HP: +40% attack speed',               flag: 'berserkerMode' },
  { id: 'c_deathmark',  icon: '☠️', name: 'Death Mark',         desc: 'Your shots slow-marked foes take +30% dmg',     flag: 'deathMark' },
];

// ---------- CAMP CARD SHOP POOL (slot-machine pulls) ----------
// Each pull = random pick from this pool weighted by rarity. Permanent boosts and skill unlocks.
export const SHOP_CARD_POOL = [
  // ── Passive stat cards ──
  { id: 'sh_hp',    icon: '❤️', name: '+30 Max HP',      category:'passive', effect: { stat: 'maxHp', amount: 30 } },
  { id: 'sh_dmg',   icon: '⚔️', name: '+8% Damage',      category:'passive', effect: { stat: 'dmg', amount: 0.08 } },
  { id: 'sh_atks',  icon: '⏱', name: '+6% Atk Speed',   category:'passive', effect: { stat: 'atks', amount: 0.06 } },
  { id: 'sh_crit',  icon: '💢', name: '+4% Crit',        category:'passive', effect: { stat: 'crit', amount: 0.04 } },
  { id: 'sh_critd', icon: '🩸', name: '+20% Crit Dmg',   category:'passive', effect: { stat: 'critd', amount: 0.20 } },
  { id: 'sh_spd',   icon: '🥾', name: '+5% Move Speed', category:'passive', effect: { stat: 'mspd', amount: 0.05 } },
  { id: 'sh_armor', icon: '🛡', name: '+2 Armor',        category:'passive', effect: { stat: 'armor', amount: 2 } },
  { id: 'sh_gold',  icon: '💰', name: '+15% Gold',       category:'passive', effect: { stat: 'gold', amount: 0.15 } },
  { id: 'sh_xp',    icon: '📖', name: '+10% XP',         category:'passive', effect: { stat: 'xp', amount: 0.10 } },
  { id: 'sh_luck',  icon: '🍀', name: '+1 Luck',         category:'passive', effect: { stat: 'luck', amount: 1 } },
  { id: 'sh_pick',  icon: '🧲', name: '+25% Pickup',     category:'passive', effect: { stat: 'pickup', amount: 0.25 } },
  // ── Active skill unlocks ──
  { id: 'sh_skill_lightning', icon: '⚡', name: 'Unlock: Lightning',   category:'active', effect: { unlockSkill: 'lightning' } },
  { id: 'sh_skill_aegis',     icon: '🛡', name: 'Unlock: Aegis',       category:'active', effect: { unlockSkill: 'aegis' } },
  { id: 'sh_skill_timewarp',  icon: '⏱', name: 'Unlock: Time Warp',   category:'active', effect: { unlockSkill: 'timewarp' } },
  { id: 'sh_skill_decoy',     icon: '👤', name: 'Unlock: Decoy',       category:'active', effect: { unlockSkill: 'decoy' } },
  { id: 'sh_skill_meteor',    icon: '☄️', name: 'Unlock: Meteor',      category:'active', effect: { unlockSkill: 'meteor' } },
  { id: 'sh_skill_vortex',    icon: '🌀', name: 'Unlock: Void Vortex', category:'active', effect: { unlockSkill: 'vortex' } },
  // ── Auto weapon unlocks ──
  { id: 'sh_wep_chainlightning', icon: '⚡', name: 'Unlock: Chain Lightning', category:'auto', effect: { unlockWeapon: 'chainlightning' } },
  { id: 'sh_wep_staticField',    icon: '🔌', name: 'Unlock: Static Field',    category:'auto', effect: { unlockWeapon: 'staticField' } },
  { id: 'sh_wep_whirlwind',      icon: '🌪️', name: 'Unlock: Whirlwind',       category:'auto', effect: { unlockWeapon: 'whirlwind' } },
  { id: 'sh_wep_boneshards',     icon: '💀', name: 'Unlock: Bone Shards',     category:'auto', effect: { unlockWeapon: 'boneshards' } },
  // ── Manual weapon unlocks ──
  { id: 'sh_wep_daggers',    icon: '🗡️', name: 'Unlock: Dagger Fan',    category:'manual', effect: { unlockWeapon: 'daggers' } },
  { id: 'sh_wep_flameburst', icon: '🔥', name: 'Unlock: Flame Burst',  category:'manual', effect: { unlockWeapon: 'flameburst' } },
  { id: 'sh_wep_icespike',   icon: '🧊', name: 'Unlock: Ice Spike',    category:'manual', effect: { unlockWeapon: 'icespike' } },
  // ── New auto weapons ──
  { id: 'sh_wep_frostOrb',   icon: '❄️', name: 'Unlock: Frost Orb',    category:'auto',   effect: { unlockWeapon: 'frostOrb' } },
  { id: 'sh_wep_voidPulse',  icon: '🔮', name: 'Unlock: Void Pulse',   category:'auto',   effect: { unlockWeapon: 'voidPulse' } },
  // ── New manual weapons ──
  { id: 'sh_wep_sniperDrop', icon: '🎯', name: 'Unlock: Sniper Drop',  category:'manual', effect: { unlockWeapon: 'sniperDrop' } },
  { id: 'sh_wep_acidSprayer',icon: '☠️', name: 'Unlock: Acid Sprayer', category:'manual', effect: { unlockWeapon: 'acidSprayer' } },
  // ── EVO Unlocks (requires poe_awk0 in skill tree) ──────────────────
  { id: 'sh_evo_hydropistol', icon: '🌊', name: 'EVO: Torrent Cannon',  category:'evo', evoFrom:'hydropistol',  effect: { unlockEvo: 'hydropistol'  } },
  { id: 'sh_evo_bloodscythe', icon: '💀', name: 'EVO: Soul Reaper',     category:'evo', evoFrom:'bloodscythe',  effect: { unlockEvo: 'bloodscythe'  } },
  { id: 'sh_evo_emberOrbs',   icon: '🌋', name: 'EVO: Inferno Ring',    category:'evo', evoFrom:'emberOrbs',    effect: { unlockEvo: 'emberOrbs'    } },
  { id: 'sh_evo_runebolts',   icon: '🌩️', name: 'EVO: Storm Array',    category:'evo', evoFrom:'runebolts',    effect: { unlockEvo: 'runebolts'    } },
  { id: 'sh_evo_frostOrb',    icon: '🌨️', name: 'EVO: Blizzard',       category:'evo', evoFrom:'frostOrb',     effect: { unlockEvo: 'frostOrb'     } },
  { id: 'sh_evo_daggers',     icon: '⚔️', name: 'EVO: Blade Storm',    category:'evo', evoFrom:'daggers',      effect: { unlockEvo: 'daggers'      } },
];
export function shopCardCost(pullCount) {
  // Escalating: 150, 220, 320, 470, 690, ...
  return Math.floor(150 * Math.pow(1.45, pullCount));
}

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythical'];
export function bumpRarity(rar, steps = 1) {
  const idx = RARITY_ORDER.indexOf(rar);
  return RARITY_ORDER[Math.min(idx + steps, RARITY_ORDER.length - 1)];
}

export function rollShopPull(luck = 0, section = null) {
  const pool = section ? SHOP_CARD_POOL.filter(c => c.category === section) : SHOP_CARD_POOL;
  const safePool = pool.length ? pool : SHOP_CARD_POOL;
  const card = safePool[Math.floor(Math.random() * safePool.length)];
  // Rarity affects amount scaling (for stat cards)
  const rarityRoll = Math.random() - (luck * 0.05);
  let rarity = 'common';
  if (rarityRoll < 0.005) rarity = 'legendary';
  else if (rarityRoll < 0.04) rarity = 'epic';
  else if (rarityRoll < 0.16) rarity = 'rare';
  else if (rarityRoll < 0.45) rarity = 'uncommon';
  const mult = { common: 1.0, uncommon: 1.5, rare: 2.0, epic: 2.8, legendary: 4.0, mythical: 6.5 }[rarity];
  return { ...card, rarity, mult, finalEffect: card.effect.amount ? { ...card.effect, amount: card.effect.amount * mult } : card.effect };
}

// Roll 3 reels and detect jackpot (3 matching) or 2-match bonus
export function rollShopPull3(luck = 0, section = null) {
  const r1 = rollShopPull(luck, section);
  const r2 = rollShopPull(luck, section);
  const r3 = rollShopPull(luck, section);
  const reels = [r1, r2, r3];
  const allMatch = r1.id === r2.id && r2.id === r3.id;
  const twoMatch = !allMatch && (r1.id === r2.id || r2.id === r3.id || r1.id === r3.id);
  let winner = r1;
  if (allMatch) winner = { ...r1, rarity: bumpRarity(r1.rarity, 2), jackpot: true, mult: { common:2.0, uncommon:3.0, rare:4.5, epic:6.0, legendary:8.0, mythical:10 }[bumpRarity(r1.rarity,2)] || r1.mult };
  else if (twoMatch) {
    const matchCard = r1.id === r2.id ? r1 : r1.id === r3.id ? r1 : r2;
    winner = { ...matchCard, rarity: bumpRarity(matchCard.rarity, 1), twoMatch: true, mult: { common:1.5, uncommon:2.0, rare:3.0, epic:4.0, legendary:6.0, mythical:8.0 }[bumpRarity(matchCard.rarity,1)] || matchCard.mult };
  }
  winner = { ...winner, finalEffect: winner.effect?.amount ? { ...winner.effect, amount: winner.effect.amount * winner.mult } : winner.effect };
  return { reels, winner, jackpot: allMatch, twoMatch };
}

// ---------- MILESTONE REWARD BAR (account level) ----------
export const MILESTONE_BAR = [
  { atLevel: 2,  rwd: { gold: 100 } },
  { atLevel: 5,  rwd: { gold: 300, sp: 1 } },
  { atLevel: 10, rwd: { gold: 600, sp: 2, chest: 'wood' } },
  { atLevel: 15, rwd: { gold: 1200, sp: 3 } },
  { atLevel: 20, rwd: { gold: 2000, sp: 5, chest: 'iron' } },
  { atLevel: 30, rwd: { gold: 5000, sp: 10, chest: 'gold' } },
  { atLevel: 50, rwd: { gold: 12000, sp: 25, chest: 'annunaki' } },
  { atLevel: 100,rwd: { gold: 50000, sp: 100, chest: 'annunaki' } },
];

// ---------- BRUTAL KILL ANIMATIONS by weapon behaviour ----------
export const KILL_FX = {
  projectile: 'gibs',       // pellets/bullets cause chunks
  shotgun:    'gibs',       // big chunks
  aoe:        'bisect',     // sliced clean
  beam:       'voidImplode',// pulled into a point
  orbit:      'ash',        // burnt to ash
  meteor:     'gibs',
  swipeAttack: 'bisect',    // cut clean in half
};

// ---------- DAILY CHALLENGES ----------
export const DAILY_CHALLENGE_POOL = [
  { id: 'dc_blitz',   name: 'Blitz Run',       icon: '⚡', desc: 'Survive 60 seconds',         duration: 60,  killGoal: 0, spawnMult: 2.2, rwd: { gold: 400, sp: 2 } },
  { id: 'dc_hunter',  name: 'Bounty Hunt',      icon: '🎯', desc: 'Kill 80 enemies in 90s',     duration: 90,  killGoal: 80, spawnMult: 1.8, rwd: { gold: 600, sp: 2 } },
  { id: 'dc_void',    name: 'Void Rush',         icon: '🌌', desc: 'Survive 3 minutes (hard)',   duration: 180, killGoal: 0, spawnMult: 2.5, rwd: { gold: 800, sp: 3 } },
  { id: 'dc_swarm',   name: 'Swarm Protocol',   icon: '🐝', desc: 'Kill 200 enemies',           duration: 999, killGoal: 200, spawnMult: 2.8, rwd: { gold: 1000, sp: 4 } },
  { id: 'dc_undying', name: 'Undying',           icon: '❤', desc: 'Survive 2 min: no pickups',  duration: 120, killGoal: 0, spawnMult: 1.5, rwd: { gold: 700, sp: 3 } },
  { id: 'dc_bullet',  name: 'Bullet Hell',       icon: '💢', desc: 'Kill 50 enemies in 45s',     duration: 45,  killGoal: 50, spawnMult: 3.0, rwd: { gold: 900, sp: 4 } },
  { id: 'dc_elite',   name: 'Elite Gauntlet',   icon: '🏆', desc: 'Survive 5 minutes',         duration: 300, killGoal: 0, spawnMult: 2.0, rwd: { gold: 1500, sp: 6 } },
  { id: 'dc_boss',    name: 'Boss Rush',         icon: '💀', desc: '90s high-density survival',  duration: 90,  killGoal: 0, spawnMult: 2.0, rwd: { gold: 1200, sp: 5 } },
];

export function getDailyChallenges() {
  const day = Math.floor(Date.now() / 86400000);
  return [
    DAILY_CHALLENGE_POOL[day % DAILY_CHALLENGE_POOL.length],
    DAILY_CHALLENGE_POOL[(day + 3) % DAILY_CHALLENGE_POOL.length],
  ];
}

// ---------- MAP STAGES (progression paths) ----------
export const MAP_STAGES = [
  {
    id: 'lake', name: 'The Lake', icon: '🌊', color: '#4dc4ff',
    desc: 'Where it all began. Corrupted slimes and bats swarm the shallows.',
    unlock: null,
    nodes: [
      { id: 'lake_1', name: 'Shallows',  diff: 1, duration: 120, spawnMult: 1.0, enemyMix: ['slime','bat'],             rwd: { gold: 200 },         unlockGoal: null },
      { id: 'lake_2', name: 'Undertow',  diff: 2, duration: 240, spawnMult: 1.3, enemyMix: ['slime','bat','ghoul'],     rwd: { gold: 450, sp: 1 },  unlockGoal: 'lake_1' },
      { id: 'lake_3', name: 'The Abyss', diff: 3, duration: 420, spawnMult: 1.7, enemyMix: ['bat','ghoul','ranger'],    rwd: { gold: 900, sp: 2 },  unlockGoal: 'lake_2' },
    ],
  },
  {
    id: 'ruins', name: 'Sunken Ruins', icon: '🏛', color: '#ffd166',
    desc: 'Forgotten halls where ranged threats lurk behind crumbling pillars.',
    unlock: { metric: 'totalKills', goal: 200, label: '200 kills' },
    nodes: [
      { id: 'ruins_1', name: 'Outer Hall',    diff: 1, duration: 150, spawnMult: 1.1, enemyMix: ['ghoul','ranger'],          rwd: { gold: 350, sp: 1 }, unlockGoal: null },
      { id: 'ruins_2', name: 'Inner Chamber', diff: 2, duration: 300, spawnMult: 1.4, enemyMix: ['ghoul','ranger','brute'],   rwd: { gold: 700, sp: 2 }, unlockGoal: 'ruins_1' },
      { id: 'ruins_3', name: 'Throne Room',   diff: 3, duration: 480, spawnMult: 2.0, enemyMix: ['ranger','brute','charger'], rwd: { gold: 1400, sp: 4 }, unlockGoal: 'ruins_2' },
    ],
  },
  {
    id: 'void', name: 'Void Lab', icon: '🌌', color: '#b362ff',
    desc: "A.I.D.A.'s abandoned research chambers. Eldritch fiends in every corridor.",
    unlock: { metric: 'runsCompleted', goal: 5, label: '5 runs' },
    nodes: [
      { id: 'void_1', name: 'Corridor',  diff: 1, duration: 180, spawnMult: 1.2, enemyMix: ['bat','charger'],           rwd: { gold: 500, sp: 1 },  unlockGoal: null },
      { id: 'void_2', name: 'Lab Core',  diff: 2, duration: 360, spawnMult: 1.6, enemyMix: ['charger','necron'],        rwd: { gold: 1000, sp: 3 }, unlockGoal: 'void_1' },
      { id: 'void_3', name: 'Void Heart',diff: 3, duration: 540, spawnMult: 2.2, enemyMix: ['necron','charger','brute'],rwd: { gold: 2200, sp: 6 }, unlockGoal: 'void_2' },
    ],
  },
  {
    id: 'ship', name: 'Annunaki Ship', icon: '🛸', color: '#ff7a1a',
    desc: 'The final frontier. Elite units guard the control deck. A.I.D.A. waits inside.',
    unlock: { metric: 'aidaSlain', goal: 1, label: 'Defeat A.I.D.A.' },
    nodes: [
      { id: 'ship_1', name: 'Hangar Bay',   diff: 1, duration: 240, spawnMult: 1.4, enemyMix: ['brute','ranger'],           rwd: { gold: 800, sp: 2 },  unlockGoal: null },
      { id: 'ship_2', name: 'Command Deck', diff: 2, duration: 420, spawnMult: 1.8, enemyMix: ['brute','charger','necron'], rwd: { gold: 1600, sp: 5 }, unlockGoal: 'ship_1' },
      { id: 'ship_3', name: 'Core Override',diff: 3, duration: 600, spawnMult: 2.5, enemyMix: ['necron','charger','brute'], rwd: { gold: 3500, sp: 10 },unlockGoal: 'ship_2' },
    ],
  },
];


// ══════════════════════════════════════════════
// CHARACTER RARITY SYSTEM
// ══════════════════════════════════════════════
// Character max levels per rarity (higher rarity = more levels before next evolution)
export const CHAR_MAX_LEVELS = { common: 3, uncommon: 6, rare: 10, epic: 15, legendary: 20, mythical: 25 };
export const CHAR_RARITIES = ['common','uncommon','rare','epic','legendary','mythical'];
export const CHAR_RARITY_COLORS = { common:'#9a8fa6', uncommon:'#4dff91', rare:'#4dc4ff', epic:'#b362ff', legendary:'#ff7a1a', mythical:'#ff3146' };
export const CHAR_RARITY_NAMES  = { common:'Common', uncommon:'Uncommon', rare:'Rare', epic:'Epic', legendary:'Legendary', mythical:'Mythical' };
export const CHAR_SLOTS_BY_RARITY = { common:2, uncommon:3, rare:4, epic:5, legendary:6, mythical:7 };
export const CHAR_LEVEL_COST = (rarity, lvl) => ({
  gold:   { common:50, uncommon:120, rare:300, epic:700, legendary:1800, mythical:4500 }[rarity] + lvl * 20,
  pieces: { common:1,  uncommon:2,   rare:4,   epic:8,   legendary:15,   mythical:30  }[rarity],
});
// Evolve cost: shards needed for each rarity evolution (higher rarities need more shards)
export const CHAR_EVOLVE_COST = { common:{shards:1}, uncommon:{shards:2}, rare:{shards:3}, epic:{shards:5}, legendary:{shards:8} };
const _CHAR_STAT_POOL = [
  { stat:'maxHp', label:'Max HP',      val:15,   icon:'❤️', isPct:false },
  { stat:'dmg',   label:'ATK Power',   val:0.04, icon:'⚔️', isPct:true  },
  { stat:'mspd',  label:'Move Speed',  val:0.02, icon:'💨', isPct:true  },
  { stat:'gold',  label:'Gold Find',   val:0.03, icon:'💰', isPct:true  },
  { stat:'armor', label:'Armor',       val:1,    icon:'🛡️', isPct:false },
  { stat:'xp',    label:'XP Gain',     val:0.03, icon:'📖', isPct:true  },
];
export function charLevelStat(level, rarity) {
  const rarIdx = CHAR_RARITIES.indexOf(rarity);
  return _CHAR_STAT_POOL[(level + rarIdx * 2) % _CHAR_STAT_POOL.length];
}

// ══════════════════════════════════════════════
// TALENT TREE (30 nodes × 10 levels each = 300 total)
// Philosophy: same total endpoint as before, 10× more steps to get there.
// costPerLvl is in Talent Points (TP), earned ~5 per run.
// val is per-level (old val / 10). Total = val × 10 = same as original.
// ══════════════════════════════════════════════
export const TALENT_NODES = [
  // ── Tier 1 (costPerLvl 1-3 TP) ──────────────
  { id:'tn01', maxLvl:10, costPerLvl:1, icon:'❤️', name:'Vitality I',      stat:'maxHp', val:1.5,   milestone:false },
  { id:'tn02', maxLvl:10, costPerLvl:1, icon:'⚔️', name:'Power I',          stat:'dmg',   val:0.002, milestone:false },
  { id:'tn03', maxLvl:10, costPerLvl:1, icon:'💨', name:'Agility I',        stat:'mspd',  val:0.002, milestone:false },
  { id:'tn04', maxLvl:10, costPerLvl:1, icon:'💰', name:'Looter I',         stat:'gold',  val:0.003, milestone:false },
  { id:'tn05', maxLvl:10, costPerLvl:3, icon:'⭐', name:'Foundation',       stat:'all',   val:0.001, milestone:true  },
  // ── Tier 2 (costPerLvl 2-5 TP) ──────────────
  { id:'tn06', maxLvl:10, costPerLvl:2, icon:'❤️', name:'Vitality II',      stat:'maxHp', val:2.0,   milestone:false },
  { id:'tn07', maxLvl:10, costPerLvl:2, icon:'⚔️', name:'Power II',         stat:'dmg',   val:0.003, milestone:false },
  { id:'tn08', maxLvl:10, costPerLvl:2, icon:'🛡️', name:'Endurance I',      stat:'armor', val:0.1,   milestone:false },
  { id:'tn09', maxLvl:10, costPerLvl:2, icon:'📖', name:'Scholar I',        stat:'xp',    val:0.004, milestone:false },
  { id:'tn10', maxLvl:10, costPerLvl:5, icon:'💎', name:'Momentum',         stat:'crit',  val:0.001, milestone:true  },
  // ── Tier 3 (costPerLvl 3-7 TP) ──────────────
  { id:'tn11', maxLvl:10, costPerLvl:3, icon:'❤️', name:'Vitality III',     stat:'maxHp', val:2.5,   milestone:false },
  { id:'tn12', maxLvl:10, costPerLvl:3, icon:'⚔️', name:'Power III',        stat:'dmg',   val:0.004, milestone:false },
  { id:'tn13', maxLvl:10, costPerLvl:3, icon:'💨', name:'Agility II',       stat:'mspd',  val:0.003, milestone:false },
  { id:'tn14', maxLvl:10, costPerLvl:3, icon:'💰', name:'Looter II',        stat:'gold',  val:0.005, milestone:false },
  { id:'tn15', maxLvl:10, costPerLvl:7, icon:'🔥', name:'Awakening',        stat:'dmg',   val:0.008, milestone:true  },
  // ── Tier 4 (costPerLvl 4-10 TP) ─────────────
  { id:'tn16', maxLvl:10, costPerLvl:4, icon:'❤️', name:'Vitality IV',      stat:'maxHp', val:3.5,   milestone:false },
  { id:'tn17', maxLvl:10, costPerLvl:4, icon:'🛡️', name:'Endurance II',     stat:'armor', val:0.2,   milestone:false },
  { id:'tn18', maxLvl:10, costPerLvl:4, icon:'⚔️', name:'Power IV',         stat:'dmg',   val:0.005, milestone:false },
  { id:'tn19', maxLvl:10, costPerLvl:4, icon:'💨', name:'Agility III',      stat:'mspd',  val:0.004, milestone:false },
  { id:'tn20', maxLvl:10, costPerLvl:10, icon:'👑', name:'Mastery',         stat:'all',   val:0.002, milestone:true  },
  // ── Tier 5 (costPerLvl 6-15 TP) ─────────────
  { id:'tn21', maxLvl:10, costPerLvl:6, icon:'❤️', name:'Vitality V',       stat:'maxHp', val:5.0,   milestone:false },
  { id:'tn22', maxLvl:10, costPerLvl:6, icon:'⚔️', name:'Power V',          stat:'dmg',   val:0.006, milestone:false },
  { id:'tn23', maxLvl:10, costPerLvl:6, icon:'💢', name:'Cruelty',          stat:'critd', val:0.010, milestone:false },
  { id:'tn24', maxLvl:10, costPerLvl:6, icon:'💰', name:'Looter III',       stat:'gold',  val:0.008, milestone:false },
  { id:'tn25', maxLvl:10, costPerLvl:15, icon:'⚡', name:'Thunderstrike',   stat:'crit',  val:0.004, milestone:true  },
  // ── Tier 6 (costPerLvl 8-20 TP) ─────────────
  { id:'tn26', maxLvl:10, costPerLvl:8, icon:'❤️', name:'Vitality VI',      stat:'maxHp', val:7.0,   milestone:false },
  { id:'tn27', maxLvl:10, costPerLvl:8, icon:'⚔️', name:'Power VI',         stat:'dmg',   val:0.008, milestone:false },
  { id:'tn28', maxLvl:10, costPerLvl:8, icon:'🛡️', name:'Endurance III',    stat:'armor', val:0.3,   milestone:false },
  { id:'tn29', maxLvl:10, costPerLvl:8, icon:'📖', name:'Scholar II',       stat:'xp',    val:0.006, milestone:false },
  { id:'tn30', maxLvl:10, costPerLvl:20, icon:'🌟', name:'Transcendence',   stat:'all',   val:0.003, milestone:true  },
];

// ══════════════════════════════════════════════
// CAMPAIGN QUESTS
// ══════════════════════════════════════════════
export const CAMPAIGN_QUESTS = [
  { id:'cq01', name:'First Blood',       icon:'⚔️', desc:'Complete your first run',          check:(s)=>(s.runsCompleted||0)>=1,                             rwd:{ gold:300 } },
  { id:'cq02', name:'Skill Student',     icon:'📖', desc:'Buy 3 skill tree upgrades',         check:(s)=>Object.values(s.skills||{}).reduce((a,b)=>a+b,0)>=3, rwd:{ gold:400, sp:1 } },
  { id:'cq03', name:'Meta Mind',         icon:'🧠', desc:'Buy 5 meta upgrades',               check:(s)=>Object.values(s.meta||{}).reduce((a,b)=>a+b,0)>=5,   rwd:{ gold:600 } },
  { id:'cq04', name:'Survivor',          icon:'🏆', desc:'Complete 3 runs',                   check:(s)=>(s.runsCompleted||0)>=3,                             rwd:{ gold:800, sp:2 } },
  { id:'cq05', name:'Card Collector',    icon:'🃏', desc:'Do 5 card shop pulls',              check:(s)=>(s.shopPulls||0)>=5,                                 rwd:{ gold:1000 } },
  { id:'cq06', name:'Profile Prestige',  icon:'⭐', desc:'Reach Rank 5',                      check:(s)=>(s.profile?.level||1)>=5,                            rwd:{ gold:1200, sp:3 } },
  { id:'cq07', name:'Map Explorer',      icon:'🗺️', desc:'Complete a map node',               check:(s)=>Object.keys(s.mapProgress||{}).length>0,             rwd:{ gold:1500 } },
  { id:'cq08', name:'Monster Slayer',    icon:'☠️', desc:'Kill 500 enemies total',            check:(s)=>(s.totalKills||0)>=500,                              rwd:{ gold:2000, sp:3 } },
  { id:'cq09', name:'One Thousand',      icon:'💀', desc:'Kill 1000 enemies total',           check:(s)=>(s.totalKills||0)>=1000,                             rwd:{ gold:3500, sp:5 } },
  { id:'cq10', name:'Character Evolved', icon:'💎', desc:'Evolve character to Uncommon+',    check:(s)=>['uncommon','rare','epic','legendary','mythical'].includes(s.character?.rarity), rwd:{ gold:3000, sp:6 } },
  { id:'cq11', name:'Talent Path Begun', icon:'🌿', desc:'Unlock 10 Talent nodes',           check:(s)=>Object.keys(s.talent||{}).length>=10,                rwd:{ gold:2000, sp:5 } },
  { id:'cq12', name:'Legend',            icon:'🌟', desc:'Reach Rank 10',                     check:(s)=>(s.profile?.level||1)>=10,                           rwd:{ gold:5000, sp:10 } },
];
