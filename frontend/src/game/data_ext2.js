// Waterdrop Survivor — Iter 4 data: blueprints, parts, missions, achievements, stages, challenges, active skills, new lvlup cards.
import { WEAPONS } from './data';

// ---------- 5 STARTER WEAPONS (all manual-aim) ----------
export const STARTER_WEAPONS = {
  hydropistol: {  // already in WEAPONS - this is canonical starter
    id: 'hydropistol', name: 'Hydro Pistol', icon: 'pistol',
    blueprint: null, // already owned by default
  },
  // Unlocked from the start, alongside the pistol, so the very first choice a
  // player makes is "gun or blade" rather than "the gun". Its definition lives
  // in WEAPONS (data.js) like the pistol's -- this entry only puts it on the
  // starter shelf. `blueprint: null` means no shards are needed.
  katana: {
    id: 'katana', name: 'Tidecutter Katana', icon: 'katana',
    blueprint: null,
    desc: 'A single clean arc. Kills split the body in two.',
  },
  twinSMG: {
    id: 'twinSMG', name: 'Twin SMG', icon: 'revolvers',
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
    id: 'tidalShotgun', name: 'Tidal Shotgun', icon: 'scatter',
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
    id: 'runicRifle', name: 'Runic Rifle', icon: 'railgun',
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
    id: 'plasmaLance', name: 'Plasma Lance', icon: 'caster',
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

// A starter is available to carry when it costs no shards (the pistol and the
// katana) or when its blueprint has been forged.
export function isStarterUnlocked(save, id) {
  const d = STARTER_WEAPONS[id];
  if (!d) return false;
  if (!d.blueprintCost) return true;
  return !!(save && save.craftedWeapons && save.craftedWeapons[id]);
}

// Which weapon a run opens with. ONE definition, shared by the Weaponsmith's
// selector and by GameScreen, so the control and the run can never disagree
// about what "carried" means.
//
// The validation is not defensive decoration. `engine.snapshot()` does
// `WEAPONS[id].icon` on every carried weapon every frame, so handing it an id
// WEAPONS has no entry for throws sixty times a second. A save can legitimately
// hold a stale id — a weapon retired between versions, or a hand-edited save —
// so anything that is not a currently unlocked starter falls back to the pistol.
export function resolveStartWeapon(save) {
  const id = save && save.startWeapon;
  if (!id || id === 'hydropistol') return 'hydropistol';
  if (!WEAPONS[id]) return 'hydropistol';
  return isStarterUnlocked(save, id) ? id : 'hydropistol';
}

// ---------- WEAPON PARTS (AK47 style attachment system) ----------
export const PART_SLOTS = ['barrel', 'magazine', 'sight', 'muzzle', 'stock', 'bullets', 'grip'];
// NOTE: 'magic' (not 'uncommon') is the real 2nd-tier key here — it must
// match rollPartRarity()'s weight keys and PART_RARITY_COLORS/MULT below,
// which all already used 'magic'. This array previously said 'uncommon',
// which silently broke PART_RARITIES.indexOf(rarity) for every magic-tier
// part (returned -1, undercounting its secondary-stat count) — fixed here
// while adding the missing mythical tier.
export const PART_RARITIES = ['common', 'magic', 'rare', 'epic', 'legendary', 'mythical'];
export const PART_RARITY_COLORS = { common: '#9a8fa6', magic: '#4dc4ff', rare: '#ffd166', epic: '#b362ff', legendary: '#ff7a1a', mythical: '#ff3146' };
export const PART_RARITY_MULT  = { common: 1.0, magic: 1.5, rare: 2.1, epic: 2.9, legendary: 4.0, mythical: 6.0 };
// `icon` is a GameIcon id (part_* in GameIcon.jsx's ICONS table), not emoji.
export const PART_SLOT_INFO = {
  barrel:   { icon: 'part_barrel', primary: 'damage', secondary: ['range', 'projSpeed'] },
  magazine: { icon: 'part_magazine', primary: 'magBonus', secondary: ['reloadMult', 'magBonus'] },
  sight:    { icon: 'part_sight', primary: 'crit', secondary: ['critd', 'headshot'] },
  muzzle:   { icon: 'part_muzzle', primary: 'fireRate', secondary: ['knockback', 'spreadReduce'] },
  stock:    { icon: 'part_stock', primary: 'recoil', secondary: ['atks', 'reloadMult'] },
  bullets:  { icon: 'part_bullets', primary: 'pierce', secondary: ['damage', 'burn', 'shock'] },
  grip:     { icon: 'part_grip', primary: 'mspd', secondary: ['atks', 'reloadMult'] },
};
const PART_NAME_BASE = {
  barrel: ['Stub', 'Heavy', 'Annunaki', 'Voidsteel', 'Eldritch', 'Genesis'],
  magazine: ['Standard', 'Extended', 'Drum', 'Cosmic', 'Infinite', 'Primordial'],
  sight: ['Iron', 'Red Dot', 'Tactical', 'Eye of Horus', 'A.I.D.A. Vision', 'Waterborn Eye'],
  muzzle: ['Plain', 'Compensator', 'Suppressor', 'Echo', 'Voidlash', 'Genesis Flare'],
  stock: ['Wooden', 'Carbon', 'Tactical', 'Stabilized', 'Aida-Tech', 'Primordial Grip'],
  bullets: ['FMJ', 'AP', 'Incendiary', 'Shock', 'Voidshard', 'Waterborn Round'],
  grip: ['Rubber', 'Carbon', 'Bone', 'Voidweave', 'Aida-Grip', 'Genesis Weave'],
};
// Was `base + ' ' + PART_SLOT_INFO[slot].icon` — baked a raw emoji into the
// item's NAME string, so it showed up as text wherever the name was printed
// (inventory rows, tooltips), not just in an icon slot. Names get a proper
// noun instead; the picture lives in PART_SLOT_INFO[slot].icon via GameIcon.
const PART_SLOT_NOUN = {
  barrel: 'Barrel', magazine: 'Magazine', sight: 'Sight', muzzle: 'Muzzle',
  stock: 'Stock', bullets: 'Rounds', grip: 'Grip',
};
export function partName(slot, rarity) {
  const rIdx = PART_RARITIES.indexOf(rarity);
  const base = PART_NAME_BASE[slot][Math.min(rIdx, PART_NAME_BASE[slot].length - 1)];
  return base + ' ' + PART_SLOT_NOUN[slot];
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
  const weights = { common: 60, magic: 28, rare: 9, epic: 2.5, legendary: 0.42, mythical: 0.08 };
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
    id: 'm_easy',  name: 'Recon Sweep',  icon: 'ui_compass', stage: 1,
    desc: 'Survive 90 seconds. 60% spawn rate. Easy.',
    duration: 90,  spawnMult: 0.6, hpMult: 0.8,
    reward: { blueprintShards: { random: true, count: 1 }, parts: { common: 2 }, gold: 80 },
  },
  {
    id: 'm_med',   name: 'Salvage Run',  icon: 'ui_cog', stage: 2,
    desc: 'Survive 3 minutes. Normal spawn. Magic parts drop.',
    duration: 180, spawnMult: 1.0, hpMult: 1.0,
    reward: { blueprintShards: { random: true, count: 2 }, parts: { magic: 2, common: 1 }, gold: 200 },
  },
  {
    id: 'm_hard',  name: 'Boss Hunt',    icon: 'ui_eye', stage: 3,
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
  { id: 'a_first_kill',   name: 'First Blood',       icon: 'vampire', desc: 'Kill 1 enemy', metric: 'totalKills', goal: 1,    rwd: { gold: 25 } },
  { id: 'a_kills_100',    name: 'Hundred',           icon: 'ui_blade', desc: '100 total kills',  metric: 'totalKills', goal: 100,  rwd: { gold: 100, sp: 1 } },
  { id: 'a_kills_1k',     name: 'Massacre',          icon: 'ui_void', desc: '1000 total kills', metric: 'totalKills', goal: 1000, rwd: { gold: 600, sp: 3 } },
  { id: 'a_kills_10k',    name: 'Annihilator',       icon: 'berserkerMode', desc: '10000 total kills',metric: 'totalKills', goal: 10000,rwd: { gold: 3000, sp: 10 } },
  { id: 'a_runs_10',      name: 'Survivor',          icon: 'ui_shield', desc: '10 runs completed',metric: 'runsCompleted', goal: 10, rwd: { gold: 300 } },
  { id: 'a_runs_50',      name: 'Veteran',           icon: 'ui_medal', desc: '50 runs completed',metric: 'runsCompleted', goal: 50, rwd: { gold: 1500, sp: 5 } },
  { id: 'a_time_5m',      name: 'Endurance',         icon: 'ui_clock', desc: 'Survive 5 min',     metric: 'bestRunTime', goal: 300, rwd: { gold: 400, sp: 1 } },
  { id: 'a_time_10m',     name: 'Eternal',           icon: 'ui_infinity', desc: 'Survive 10 min',    metric: 'bestRunTime', goal: 600, rwd: { gold: 1200, sp: 3 } },
  { id: 'a_aida',         name: 'Bossfall',          icon: 'ui_eye', desc: 'Defeat A.I.D.A.',   metric: 'aidaSlain', goal: 1, rwd: { gold: 2000, sp: 5 } },
  { id: 'a_lvl_30',       name: 'Apex',              icon: 'ui_star', desc: 'Reach run level 30',metric: 'bestKills', goal: 30, rwd: { gold: 400 } },
  { id: 'a_gold_10k',     name: 'Wealthy',           icon: 'ui_moneybag', desc: 'Earn 10000 gold',   metric: 'lifetimeGold', goal: 10000, rwd: { sp: 5 } },
  { id: 'a_blueprint',    name: 'Gunsmith',          icon: 'ui_smith', desc: 'Craft a starter weapon', metric: 'weaponsCrafted', goal: 1, rwd: { gold: 200 } },
  { id: 'a_all_weapons',  name: 'Arsenal',           icon: 'ui_daggers', desc: 'Craft all 4 weapons', metric: 'weaponsCrafted', goal: 4, rwd: { gold: 2000, sp: 5 } },
  { id: 'a_part_leg',     name: 'Legendary Smith',   icon: 'starBurst', desc: 'Find a legendary part', metric: 'legendaryPartsFound', goal: 1, rwd: { gold: 500, sp: 2 } },
  { id: 'a_skill_25',     name: 'Awakened',          icon: 'ui_skills', desc: 'Learn 25 skill levels', metric: 'skillsLearned', goal: 25, rwd: { gold: 600, sp: 3 } },
  { id: 'a_active_4',     name: 'Hot Bar',           icon: 'ui_flame', desc: 'Equip 4 active skills', metric: 'activeSkillsCount', goal: 4, rwd: { gold: 400 } },
  { id: 'a_chest_50',     name: 'Hoarder',           icon: 'ui_chest', desc: 'Open 50 chests',    metric: 'chestsOpened', goal: 50, rwd: { gold: 800, sp: 2 } },
  { id: 'a_no_hit',       name: 'Untouchable',       icon: 'ui_ghost', desc: 'Complete a mission without taking damage', metric: 'noHitRuns', goal: 1, rwd: { gold: 600, sp: 3 } },
  { id: 'a_challenge_4',  name: 'Trial Master',      icon: 'ui_trophy', desc: 'Complete all challenges', metric: 'challengesCompleted', goal: 4, rwd: { gold: 1500, sp: 5 } },
  { id: 'a_daily_7',      name: 'Devoted',           icon: 'ui_calendar', desc: '7-day daily login streak', metric: 'dailyStreak', goal: 7, rwd: { gold: 500 } },
  // Boss hunters
  { id: 'a_necro',        name: 'Bone Collector',    icon: 'boneshards', desc: 'Defeat The Necromancer',   metric: 'necroSlain', goal: 1, rwd: { gold: 500, sp: 2 } },
  { id: 'a_void',         name: 'Titan Crusher',     icon: 'voidPulse', desc: 'Defeat the Void Titan',    metric: 'voidSlain',  goal: 1, rwd: { gold: 800, sp: 3 } },
  { id: 'a_horus',        name: 'Eye Closer',        icon: 'ui_eye', desc: 'Defeat the Eye of Horus',  metric: 'horusSlain', goal: 1, rwd: { gold: 300, sp: 1 } },
  { id: 'a_endless',      name: 'Void Walker',       icon: 'ui_infinity', desc: 'Reach Endless Mode',        metric: 'endlessReached', goal: 1, rwd: { gold: 2000, sp: 8 } },
  // Progression milestones
  { id: 'a_lvl_50',       name: 'Transcendent',      icon: 'ui_star', desc: 'Reach level 50 in a run',  metric: 'bestKills', goal: 50, rwd: { gold: 3000, sp: 10 } },
  { id: 'a_kills_50k',    name: 'Reaper',            icon: 'bloodscythe', desc: '50,000 total kills',        metric: 'totalKills', goal: 50000, rwd: { gold: 10000, sp: 20 } },
  { id: 'a_runs_100',     name: 'Centurion',         icon: 'ui_medal', desc: '100 runs completed',        metric: 'runsCompleted', goal: 100, rwd: { gold: 5000, sp: 15 } },
  { id: 'a_gold_50k',     name: 'Dragon Hoard',      icon: 'ui_gem', desc: 'Earn 50k lifetime gold',   metric: 'lifetimeGold', goal: 50000, rwd: { sp: 10 } },
  { id: 'a_nohit_5',      name: 'Phantom',           icon: 'ui_ghost', desc: 'Complete 5 no-hit runs',   metric: 'noHitRuns', goal: 5, rwd: { gold: 2500, sp: 8 } },
  { id: 'a_maps_all',     name: 'Cartographer',      icon: 'ui_map', desc: 'Complete all map stages',  metric: 'mapsCompleted', goal: 4, rwd: { gold: 5000, sp: 15 } },
];

// ---------- STAGES (visual themes + spawn mods) ----------
export const STAGES = {
  lake:    { id: 'lake',    name: 'The Lake',         icon: 'ui_waterdrop', desc: 'The shallows. Where it all begins.',     bg: '#0c0a16', accent: '#4dc4ff', enemyMix: ['slime', 'bat', 'ghoul'],     spawnMult: 1.0, unlock: { kind: 'default' } },
  ruins:   { id: 'ruins',   name: 'Sunken Ruins',     icon: 'ui_base',  desc: 'Forgotten halls. Ranged threats lurk.',  bg: '#1a1208', accent: '#ffd166', enemyMix: ['ghoul', 'ranger', 'brute'],   spawnMult: 1.1, unlock: { kind: 'kills',  goal: 200 } },
  void:    { id: 'void',    name: 'Void Lab',         icon: 'voidPulse', desc: 'A.I.D.A.\'s old chambers. Eldritch fiends.', bg: '#0a081a', accent: '#b362ff', enemyMix: ['bat', 'charger', 'necron'],  spawnMult: 1.2, unlock: { kind: 'runs',   goal: 5 } },
  ship:    { id: 'ship',    name: 'Annunaki Ship',    icon: 'ui_rocket', desc: 'The final outpost. A.I.D.A. waits.',     bg: '#1a0a08', accent: '#ff7a1a', enemyMix: ['brute', 'charger', 'necron', 'ranger'], spawnMult: 1.4, unlock: { kind: 'boss',   goal: 1 } },
};

// ---------- CHALLENGE MODES ----------
export const CHALLENGES = [
  { id: 'c_bossrush', name: 'Boss Rush',  icon: 'ui_void', desc: 'Endless bosses. No respite.',  mod: { bossRush: true, duration: 999 },  rwd: { gold: 800, sp: 3 } },
  { id: 'c_horde',    name: 'Horde',      icon: 'swarmAura', desc: '10× spawn. Survive 60s.',     mod: { spawnMult: 10, duration: 60 },     rwd: { gold: 500, sp: 2 } },
  { id: 'c_trial',    name: 'Time Trial', icon: 'ui_clock', desc: 'Kill 500 enemies fast.',      mod: { killGoal: 500 },                   rwd: { gold: 1000, sp: 4 } },
  { id: 'c_nohit',    name: 'No-Hit Hero',icon: 'ui_ghost', desc: 'Survive 3 min. ZERO hits.',   mod: { duration: 180, noHit: true },      rwd: { gold: 1200, sp: 5 } },
];

// ---------- PER-WEAPON UPGRADE NAMING ----------
// A level-up card that reads "+20% damage" tells you nothing about WHICH
// weapon you are improving or what improving it means. These give each
// weapon its own vocabulary for the same underlying stat, so upgrading a
// shotgun sounds like a shotgun and upgrading a bow sounds like a bow.
//
// Falls back to the generic stat name (engine.statName) for any weapon or
// stat not listed, so adding a weapon never breaks the card — it just reads
// plainly until someone writes it a vocabulary.
export const WEAPON_UPGRADE_NAMES = {
  hydropistol:  { damage: 'pressure', fireRate: 'cycle rate', magazine: 'reservoir', pierce: 'jet coherence', crit: 'nozzle precision' },
  desertEagle:  { damage: 'stopping power', fireRate: 'lockwork', magazine: 'clip', pierce: 'penetration', crit: 'match trigger' },
  bow:          { damage: 'draw weight', fireRate: 'nocking speed', pierce: 'shaft penetration', crit: 'fletching', projectiles: 'arrows' },
  daggers:      { damage: 'edge', fireRate: 'throwing speed', pierce: 'follow-through', projectiles: 'blades' },
  flameburst:   { damage: 'burn intensity', fireRate: 'ignition rate', area: 'flame spread', range: 'reach' },
  icespike:     { damage: 'shard density', fireRate: 'formation rate', pierce: 'shard hardness', projSpeed: 'shard velocity' },
  sniperDrop:   { damage: 'muzzle energy', fireRate: 'bolt cycling', pierce: 'armour bypass', crit: 'optics' },
  stormLance:   { damage: 'charge', fireRate: 'capacitor recovery', pierce: 'arc length', crit: 'ionisation' },
  shotgun:      { damage: 'shot weight', fireRate: 'pump speed', projectiles: 'pellets', area: 'choke spread' },
  autoBolts:    { damage: 'bolt mass', fireRate: 'feed rate', pierce: 'bolt hardness', projectiles: 'bolts' },
  emberOrbs:    { damage: 'ember heat', orbitCount: 'orbs', orbitRadius: 'orbit width', orbitSpeed: 'orbit speed' },
  frostOrb:     { damage: 'frost bite', orbitCount: 'orbs', orbitRadius: 'orbit width', orbitSpeed: 'orbit speed' },
  whirlwind:    { damage: 'blade force', orbitCount: 'blades', orbitRadius: 'sweep width', orbitSpeed: 'spin rate' },
  bloodScythe:  { damage: 'cut depth', fireRate: 'swing rate', area: 'reach', knockback: 'cleave force' },
  tideWhip:     { damage: 'crack force', fireRate: 'snap rate', area: 'lash reach', knockback: 'whipcrack' },
  voidBeam:     { damage: 'beam intensity', fireRate: 'recharge', range: 'beam length', area: 'beam width' },
  chainlightning: { damage: 'discharge', fireRate: 'recharge', chain: 'arc jumps', area: 'arc reach' },
  arcTesla:     { damage: 'discharge', chainCount: 'arc jumps', chainRange: 'arc reach', fireRate: 'recharge' },
  staticField:  { damage: 'field strength', chainCount: 'arc jumps', chainRange: 'field radius', fireRate: 'pulse rate' },
  meteorStrike: { damage: 'impact force', fireRate: 'call rate', area: 'blast radius' },
  droneSquad:   { damage: 'drone guns', fireRate: 'drone fire rate', droneCount: 'drones', range: 'engagement range' },
  annunakiPulse:{ damage: 'pulse force', fireRate: 'pulse rate', area: 'pulse radius', knockback: 'shockwave' },
};

// ---------- ACTIVE SKILLS (button-icon with cooldown) ----------
export const ACTIVE_SKILLS = {
  lightning: { id: 'lightning', name: 'Lightning Strike', icon: 'lightningOnCrit', cd: 8,  cost: 0, key: '1', desc: 'Strike a foe with lightning. Chains to 4 nearby.' },
  aegis:     { id: 'aegis',     name: 'Aegis Aura',       icon: 'reflect', cd: 18, cost: 0, key: '2', desc: 'Invuln + reflect 3s.' },
  timewarp:  { id: 'timewarp',  name: 'Time Warp',        icon: 'ui_clock', cd: 25, cost: 0, key: '3', desc: 'Slow all enemies for 4s.' },
  // Replaced Decoy Drop — a stationary aggro magnet you dropped and forgot
  // about. Steam Vent covers the archetype the roster lacked: mobility that
  // is also offence and sustain.
  steamvent: { id: 'steamvent', name: 'Steam Vent',       icon: 'quickstep', cd: 11, cost: 0, key: '4', desc: 'Blast forward in a scalding jet — burns and knocks back everything on the path, and heals 2 HP per foe scalded (max 5).' },
  meteor:    { id: 'meteor',    name: 'Meteor Call',      icon: 'meteorStrike', cd: 14, cost: 0, key: '1', desc: 'Call meteor on cursor — massive AoE.' },
  vortex:    { id: 'vortex',    name: 'Void Vortex',      icon: 'gravityPull', cd: 16, cost: 0, key: '2', desc: 'Black hole pulls enemies, drains HP.' },
  riptide:   { id: 'riptide',   name: 'Riptide Pulse',    icon: 'tidalWave', cd: 10, cost: 0, key: '3', desc: 'Piercing wave in front of you — damages + slows.' },
  beacon:    { id: 'beacon',    name: 'Stasis Beacon',    icon: 'ui_orb', cd: 20, cost: 0, key: '4', desc: 'Deploy a field that roots + damages foes for 5s.' },
  nova:      { id: 'nova',      name: 'Frost Nova',       icon: 'iceShards', cd: 14, cost: 0, key: '1', desc: 'Instant AoE around you — damages + slows.' },
};
export const ACTIVE_SKILL_KEYS = Object.keys(ACTIVE_SKILLS);
// You can equip up to 4 active skills (out of pool). Unlock via card shop.

// ---------- NEW LEVEL UP CARDS (15+ interesting passive/active) ----------
export const ADVANCED_CARDS = [
  { id: 'c_lightning',   icon: 'lightningOnCrit', name: 'Lightning Crit',  desc: 'Crits arc lightning to 2 nearby foes',           flag: 'lightningOnCrit' },
  { id: 'c_aura',        icon: 'damageAura', name: 'Damage Aura',     desc: 'Burning aura damages foes around you',           flag: 'damageAura' },
  { id: 'c_vamp',        icon: 'vampire', name: 'Vampirism',       desc: '0.1% lifesteal on hit (upgrade in Meta)',        flag: 'vampire', amount: 0.001 },
  { id: 'c_chain',       icon: 'chainOnKill', name: 'Chain Strike',    desc: 'Kills chain to nearby for 50% dmg',              flag: 'chainOnKill' },
  { id: 'c_slow',        icon: 'slowField', name: 'Slow Field',      desc: 'Aura slows enemies 30%',                         flag: 'slowField' },
  { id: 'c_burn',        icon: 'burnDoT', name: 'Burn',            desc: 'Hits apply burn DoT',                            flag: 'burnDoT' },
  { id: 'c_poison',      icon: 'poisonOnKill', name: 'Poison Cloud',    desc: 'On kill leave poison patch',                     flag: 'poisonOnKill' },
  { id: 'c_glass',       icon: 'glassCannon', name: 'Glass Cannon',    desc: '+150% damage, -50% HP',                          flag: 'glassCannon' },
  { id: 'c_reflect',     icon: 'reflect', name: 'Reflect',         desc: 'Reflect 30% damage back',                        flag: 'reflect', amount: 0.30 },
  { id: 'c_explode',     icon: 'explosiveDeath', name: 'Explosive Death', desc: 'Killed enemies explode for 30 dmg',              flag: 'explosiveDeath' },
  { id: 'c_lifeline',    icon: 'lifeline', name: 'Lifeline',        desc: 'Below 20% HP gain temporary shield',             flag: 'lifeline' },
  { id: 'c_mirror',      icon: 'mirrorAura', name: 'Mirror Image',    desc: 'Spawn a decoy every 12s',                        flag: 'mirrorAura' },
  { id: 'c_knockback',   icon: 'knockbackWave', name: 'Knockback Wave',  desc: 'Every 8s a wave knocks all back',                flag: 'knockbackWave' },
  { id: 'c_starburst',   icon: 'starBurst', name: 'Star Burst',      desc: 'Every 5 kills → AoE burst',                      flag: 'starBurst' },
  { id: 'c_doublehit',   icon: 'doubleHit', name: 'Multistrike',     desc: '20% chance to double-hit',                       flag: 'doubleHit', amount: 0.20 },
  { id: 'c_grit',        icon: 'grit', name: 'Grit',            desc: 'When hit, -30% dmg for 2s',                      flag: 'grit' },
  { id: 'c_vision',      icon: 'vision', name: 'Eagle Vision',     desc: '+25% vision range (camera zoom out)',           flag: 'vision' },
  { id: 'c_double_dmg',  icon: 'sharpSteel', name: 'Sharp Steel',      desc: '+25% damage permanently this run',              flag: 'sharpSteel' },
  { id: 'c_speed',       icon: 'bloodrush', name: 'Bloodrush',        desc: '+15% move speed + reload',                      flag: 'bloodrush' },
  { id: 'c_magnet',      icon: 'ironPull', name: 'Iron Pull',        desc: '+80% pickup range',                             flag: 'ironPull' },
  // --- new passive auto-weapons & effects ---
  { id: 'c_thunder',     icon: 'thunderCult', name: 'Thunder Cult',      desc: 'Every 4s strike random foe for 60 dmg',         flag: 'thunderCult' },
  { id: 'c_iceShard',    icon: 'iceShards', name: 'Ice Shards',        desc: 'Auto-launch homing ice shards every 1.6s',      flag: 'iceShards' },
  { id: 'c_holyWater',   icon: 'holyWater', name: 'Holy Water',        desc: 'Heal ring pulses every 6s (+15 HP)',            flag: 'holyWater' },
  { id: 'c_swarm',       icon: 'swarmAura', name: 'Swarm',             desc: 'Orbiting bees pierce + sting nearby foes',      flag: 'swarmAura' },
  { id: 'c_spike',       icon: 'spikePlates', name: 'Spike Plates',      desc: 'Drop spike traps on dash/spawn (60 dmg)',       flag: 'spikePlates' },
  { id: 'c_overcharge',  icon: 'overcharge', name: 'Overcharge',        desc: 'Every 6th shot is double damage',               flag: 'overcharge' },
  { id: 'c_railgun',     icon: 'railStance', name: 'Railgun Stance',    desc: 'Standing still 1s+ = +60% damage',              flag: 'railStance' },
  { id: 'c_juggernaut',  icon: 'juggernaut', name: 'Juggernaut',        desc: '+1 HP regen per 5 enemies in 200u',             flag: 'juggernaut' },
  // ---- Five new STANDARD passives -----------------------------------------
  // Always in the run pool, no unlock needed. Added because the Card Shop was
  // handing out permanent stat bonuses instead of unlocking cards, so the
  // in-run passive pool never actually grew — the shop made your character
  // stronger BETWEEN runs rather than giving you more to find DURING one.
  // These are the baseline the shop now builds on top of.
  { id: 'c_electric',    icon: 'electricRounds', name: 'Electric Rounds',   desc: 'Shots arc lightning through the enemy they hit', flag: 'electricRounds' },
  { id: 'c_meleespd',    icon: 'meleeSpeed', name: 'Whirl Training',    desc: '+10% melee attack speed',                       flag: 'meleeSpeed', amount: 0.10 },
  { id: 'c_manualcd',    icon: 'manualCooldown', name: 'Cycled Action',     desc: '-5% manual weapon cooldown',                    flag: 'manualCooldown', amount: 0.05 },
  { id: 'c_ricochet',    icon: 'ricochet', name: 'Ricochet',          desc: 'Shots bounce once to a nearby foe',             flag: 'ricochet' },
  { id: 'c_frostbite',   icon: 'frostbite', name: 'Frostbite',         desc: 'Chilled foes take +20% damage',                 flag: 'frostbite' },
  // ---- Shop-gated advanced passives ---------------------------------------
  // These enter the run pool only once bought in the Card Shop. The
  // shop/shopId pair mirrors the Prospector gate exactly (see engine.js), so
  // both unlock systems share one code path instead of growing a second one.
  { id: 'c_elec_manual', icon: 'liveWire', name: 'Live Wire',         desc: 'Manual weapons chain lightning between foes',   flag: 'liveWire',     shop: true, shopId: 'sh_elec_manual' },
  { id: 'c_twinup',      icon: 'twinAscend', name: 'Twin Ascend',       desc: 'Weapon upgrades level TWO manual weapons',      flag: 'twinAscend',   shop: true, shopId: 'sh_twinup' },
  { id: 'c_overload',    icon: 'overloadCore', name: 'Overload Core',     desc: 'Every 10th kill detonates a chain reaction',    flag: 'overloadCore', shop: true, shopId: 'sh_overload' },
  { id: 'c_bulletstorm', icon: 'bulletstorm', name: 'Bulletstorm',       desc: 'Reloading sprays the spent magazine',           flag: 'bulletstorm',  shop: true, shopId: 'sh_bulletstorm' },
  { id: 'c_executioner', icon: 'executioner', name: 'Executioner',       desc: 'Foes under 15% HP die instantly on any hit',    flag: 'executioner',  shop: true, shopId: 'sh_executioner' },
  // Stat-type (not flag) so re-picking it stacks: +1 bounce AND slightly
  // more damage per bounce each time, per level-up.
  { id: 'c_conductive',  icon: 'chainOnKill', name: 'Conductive Rounds', desc: 'Bullet hits arc lightning to a nearby foe (stacks: +1 bounce, +bounce damage)', stat: 'conductiveBounces', amount: 1 },
  // ─── New passives ───────────────────────────────────────────
  { id: 'c_ironHide',   icon: 'armor', name: 'Iron Hide',          desc: '+4 flat armor permanently this run',            stat: 'armor', amount: 4 },
  { id: 'c_soulHarvest',icon: 'soulHarvest', name: 'Soul Harvest',       desc: 'Every 25 kills restore +1 HP',                  flag: 'soulHarvest' },
  { id: 'c_quickstep',  icon: 'quickstep', name: 'Quickstep',          desc: '+20% speed for 1.5s after taking damage',       flag: 'quickstep' },
  { id: 'c_thorns',     icon: 'thorns', name: 'Thorns',             desc: 'Return 25% of dmg received as melee',           flag: 'thorns', amount: 0.25 },
  { id: 'c_berserker',  icon: 'berserkerMode', name: 'Berserker',          desc: 'Below 30% HP: +40% attack speed',               flag: 'berserkerMode' },
  { id: 'c_deathmark',  icon: 'deathMark', name: 'Death Mark',         desc: 'Your shots slow-marked foes take +30% dmg',     flag: 'deathMark' },
  // ─── 5 new passives (see engine.js tickCardFlags/killEnemy for hooks) ───
  { id: 'c_tidalWave',   icon: 'tidalWave', name: 'Tidal Wave',       desc: 'Every 10s, a wave knocks back + damages all nearby foes', flag: 'tidalWave' },
  { id: 'c_staticChain', icon: 'staticChainKill', name: 'Static Chain',     desc: 'Kills have 25% chance to chain-lightning 2 nearby foes',   flag: 'staticChainKill' },
  { id: 'c_secondWind',  icon: 'secondWind', name: 'Second Wind',      desc: 'Once per run, dropping below 15% HP grants a shield + heal', flag: 'secondWind' },
  { id: 'c_gravityCharge', icon: 'gravityPull', name: 'Gravity Charge', desc: 'Every 15 kills, pull all nearby foes toward you',          flag: 'gravityPull' },
  { id: 'c_venomBite',   icon: 'venomBite', name: 'Venom Bite',       desc: 'Foes that touch you get poisoned',                          flag: 'venomBite' },

  // ─── Weapon-class passives ───────────────────────────────────────────
  // Every offensive card used to be another flat global bump, so two runs
  // ended up feeling the same regardless of what you picked. These scope to
  // a weapon class instead, which means the cards you take start pulling the
  // build in a direction: a manual-weapon run and an auto-weapon run now
  // want different offers. `mult: true` means the amount accumulates into a
  // multiplier (1.0 -> 1.14 -> 1.28 ...) rather than being added to a raw
  // stat, so they can be re-offered and stack predictably. See
  // computeWeaponStats for where they land.
  { id: 'c_rifledBore',   icon: 'damageMult', name: 'Rifled Bore',      desc: '+14% damage with manual weapons',        stat: 'manualDmgMult',  amount: 0.14, mult: true },
  { id: 'c_lightTrigger', icon: 'fireRateMult', name: 'Light Trigger',    desc: '+12% fire rate with manual weapons',     stat: 'manualRateMult', amount: 0.12, mult: true },
  { id: 'c_extendedMag',  icon: 'magBonus', name: 'Extended Mag',     desc: '+25% magazine on manual weapons',        stat: 'manualMagMult',  amount: 0.25, mult: true },
  { id: 'c_autoLoader',   icon: 'ui_cog', name: 'Servo Loader',     desc: '+13% fire rate for auto weapons',        stat: 'autoRateMult',   amount: 0.13, mult: true },
  { id: 'c_powerCore',    icon: 'ui_bolt', name: 'Power Core',       desc: '+15% damage for auto weapons',           stat: 'autoDmgMult',    amount: 0.15, mult: true },
  { id: 'c_fieldCoils',   icon: 'areaMult', name: 'Field Coils',      desc: '+18% area on auto weapons',              stat: 'autoAreaMult',   amount: 0.18, mult: true },

  // ─── Astro Prospector uniques ────────────────────────────────────────
  // Gated behind `prospect` + `prospectId`: buildLevelUpChoices skips these
  // entirely unless the card has been unlocked in the Prospector, which is
  // the whole reason that mode exists. Deliberately build-defining rather
  // than another percentage — see game/prospector.js.
  { id: 'c_prismCore',   icon: 'prismCore', name: 'Prism Core',         desc: 'Projectiles split into two shards on their first hit',      flag: 'prismCore',         prospect: true, prospectId: 'pc_prism' },
  { id: 'c_tempoEngine', icon: 'tempoEngine', name: 'Tempo Engine',       desc: 'Each kill: +4% fire rate for 4s, stacking to 10',           flag: 'tempoEngine',       prospect: true, prospectId: 'pc_tempo' },
  { id: 'c_singularity', icon: 'singularityRounds', name: 'Singularity Rounds', desc: 'Kills collapse into a vortex that drags nearby foes in',    flag: 'singularityRounds', prospect: true, prospectId: 'pc_singularity' },
  { id: 'c_echoChamber', icon: 'echoChamber', name: 'Echo Chamber',       desc: 'Every 5th shot fires a second time, free',                  flag: 'echoChamber',       prospect: true, prospectId: 'pc_echo' },
  { id: 'c_coreOverload',icon: 'coreOverload', name: 'Core Overload',      desc: '+12% crit chance, and crits pierce everything',             flag: 'coreOverload',      prospect: true, prospectId: 'pc_overload' },
];

// ---------- CAMP CARD SHOP POOL (slot-machine pulls) ----------
// Each pull = random pick from this pool weighted by rarity. Permanent boosts and skill unlocks.
export const SHOP_CARD_POOL = [
  // ── Passive CARD UNLOCKS ──
  // These used to be permanent stat bonuses (+30 Max HP, +8% Damage, ...),
  // which was the wrong shape for this game in two ways:
  //   1. A slot machine that permanently raises your stats makes the meta
  //      upgrade tree redundant — that tree already exists and is the honest
  //      place for permanent power.
  //   2. It meant the in-run passive pool never grew. Spinning the shop made
  //      your character stronger between runs instead of giving you more
  //      interesting things to FIND during one, which is where the actual
  //      decisions in this genre live.
  // Each entry now unlocks an ADVANCED_CARD into the run pool instead. The
  // power still comes from the shop, but it arrives as a choice mid-run
  // rather than as a silent number on the sheet.
  { id: 'sh_elec_manual', icon: 'liveWire', name: 'Unlock: Live Wire',    category:'passive', effect: { unlockCard: 'sh_elec_manual' } },
  { id: 'sh_twinup',      icon: 'twinAscend', name: 'Unlock: Twin Ascend',  category:'passive', effect: { unlockCard: 'sh_twinup' } },
  { id: 'sh_overload',    icon: 'overloadCore', name: 'Unlock: Overload Core',category:'passive', effect: { unlockCard: 'sh_overload' } },
  { id: 'sh_bulletstorm', icon: 'bulletstorm', name: 'Unlock: Bulletstorm',  category:'passive', effect: { unlockCard: 'sh_bulletstorm' } },
  { id: 'sh_executioner', icon: 'executioner', name: 'Unlock: Executioner',  category:'passive', effect: { unlockCard: 'sh_executioner' } },
  // ── Active skill unlocks (icon mirrors ACTIVE_SKILLS[x].icon above) ──
  { id: 'sh_skill_lightning', icon: 'lightningOnCrit', name: 'Unlock: Lightning',   category:'active', effect: { unlockSkill: 'lightning' } },
  { id: 'sh_skill_aegis',     icon: 'reflect', name: 'Unlock: Aegis',       category:'active', effect: { unlockSkill: 'aegis' } },
  { id: 'sh_skill_timewarp',  icon: 'ui_clock', name: 'Unlock: Time Warp',   category:'active', effect: { unlockSkill: 'timewarp' } },
  { id: 'sh_skill_steamvent', icon: 'quickstep', name: 'Unlock: Steam Vent',  category:'active', effect: { unlockSkill: 'steamvent' } },
  { id: 'sh_skill_meteor',    icon: 'meteorStrike', name: 'Unlock: Meteor',      category:'active', effect: { unlockSkill: 'meteor' } },
  { id: 'sh_skill_vortex',    icon: 'gravityPull', name: 'Unlock: Void Vortex', category:'active', effect: { unlockSkill: 'vortex' } },
  // ── Auto weapon unlocks (icon = the weapon's own ICONS key) ──
  { id: 'sh_wep_chainlightning', icon: 'chainlightning', name: 'Unlock: Chain Lightning', category:'auto', effect: { unlockWeapon: 'chainlightning' } },
  { id: 'sh_wep_staticField',    icon: 'staticField', name: 'Unlock: Static Field',    category:'auto', effect: { unlockWeapon: 'staticField' } },
  { id: 'sh_wep_whirlwind',      icon: 'whirlwind', name: 'Unlock: Whirlwind',       category:'auto', effect: { unlockWeapon: 'whirlwind' } },
  { id: 'sh_wep_boneshards',     icon: 'boneshards', name: 'Unlock: Bone Shards',     category:'auto', effect: { unlockWeapon: 'boneshards' } },
  // ── Manual weapon unlocks ──
  { id: 'sh_wep_daggers',    icon: 'daggers', name: 'Unlock: Dagger Fan',    category:'manual', effect: { unlockWeapon: 'daggers' } },
  { id: 'sh_wep_flameburst', icon: 'flameburst', name: 'Unlock: Flame Burst',  category:'manual', effect: { unlockWeapon: 'flameburst' } },
  { id: 'sh_wep_icespike',   icon: 'icespike', name: 'Unlock: Ice Spike',    category:'manual', effect: { unlockWeapon: 'icespike' } },
  // ── New auto weapons ──
  { id: 'sh_wep_frostOrb',   icon: 'frostOrb', name: 'Unlock: Frost Orb',    category:'auto',   effect: { unlockWeapon: 'frostOrb' } },
  { id: 'sh_wep_voidPulse',  icon: 'voidPulse', name: 'Unlock: Void Pulse',   category:'auto',   effect: { unlockWeapon: 'voidPulse' } },
  // ── New manual weapons ──
  { id: 'sh_wep_sniperDrop', icon: 'sniperDrop', name: 'Unlock: Sniper Drop',  category:'manual', effect: { unlockWeapon: 'sniperDrop' } },
  { id: 'sh_wep_acidSprayer',icon: 'acidSprayer', name: 'Unlock: Acid Sprayer', category:'manual', effect: { unlockWeapon: 'acidSprayer' } },
  // ── New auto weapons (drone/turret/mine/flare/railgun) ──
  { id: 'sh_wep_droneSquad',   icon: 'droneSquad', name: 'Unlock: Drone Squadron', category:'auto', effect: { unlockWeapon: 'droneSquad' } },
  { id: 'sh_wep_plasmaTurret', icon: 'plasmaTurret', name: 'Unlock: Plasma Turret',  category:'auto', effect: { unlockWeapon: 'plasmaTurret' } },
  { id: 'sh_wep_shrapnelMine', icon: 'shrapnelMine', name: 'Unlock: Shrapnel Mine',  category:'auto', effect: { unlockWeapon: 'shrapnelMine' } },
  { id: 'sh_wep_solarFlare',   icon: 'solarFlare', name: 'Unlock: Solar Flare',    category:'auto', effect: { unlockWeapon: 'solarFlare' } },
  { id: 'sh_wep_railgunArray', icon: 'railgunArray', name: 'Unlock: Railgun Array',  category:'auto', effect: { unlockWeapon: 'railgunArray' } },
  // ── New manual weapons (3 of the 5 new manuals — the other 2 ship standard) ──
  { id: 'sh_wep_voidScatter', icon: 'voidScatter', name: 'Unlock: Void Scattergun', category:'manual', effect: { unlockWeapon: 'voidScatter' } },
  { id: 'sh_wep_arcCaster',   icon: 'arcCaster', name: 'Unlock: Arc Caster',      category:'manual', effect: { unlockWeapon: 'arcCaster' } },
  { id: 'sh_wep_cometLauncher', icon: 'cometLauncher', name: 'Unlock: Comet Launcher', category:'manual', effect: { unlockWeapon: 'cometLauncher' } },
  // ── EVO Unlocks (requires poe_awk0 in skill tree) — icon is the `_evo` variant ──
  { id: 'sh_evo_hydropistol', icon: 'hydropistol_evo', name: 'EVO: Torrent Cannon',  category:'evo', evoFrom:'hydropistol',  effect: { unlockEvo: 'hydropistol'  } },
  { id: 'sh_evo_bloodscythe', icon: 'bloodscythe_evo', name: 'EVO: Soul Reaper',     category:'evo', evoFrom:'bloodscythe',  effect: { unlockEvo: 'bloodscythe'  } },
  { id: 'sh_evo_emberOrbs',   icon: 'emberOrbs_evo', name: 'EVO: Inferno Ring',    category:'evo', evoFrom:'emberOrbs',    effect: { unlockEvo: 'emberOrbs'    } },
  { id: 'sh_evo_runebolts',   icon: 'runebolts_evo', name: 'EVO: Storm Array',    category:'evo', evoFrom:'runebolts',    effect: { unlockEvo: 'runebolts'    } },
  { id: 'sh_evo_frostOrb',    icon: 'frostOrb_evo', name: 'EVO: Blizzard',       category:'evo', evoFrom:'frostOrb',     effect: { unlockEvo: 'frostOrb'     } },
  { id: 'sh_evo_daggers',     icon: 'daggers_evo', name: 'EVO: Blade Storm',    category:'evo', evoFrom:'daggers',      effect: { unlockEvo: 'daggers'      } },
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

// Only used internally by rollShopPull3 below — not exported (was public
// with no external caller, per a code review pass).
function rollShopPull(luck = 0, section = null) {
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

// ---------- WEAPON EVOLUTION FORKS (in-run, level 5) ----------
// The moment any weapon (auto or manual) hits its 5th level-up pick, the
// normal level-up modal is replaced ONCE by a special 4-way fork screen —
// a build-defining branch, each option a real buff bundled with a real
// tradeoff, so the choice matters. Templates are keyed by `behaviour`
// (see WEAPONS[id].behaviour in data.js) rather than one bespoke set per
// weapon id, so every current AND future weapon automatically gets a
// flavorful fork without needing manual data entry per weapon. `apply`
// mutates the already-computed per-frame stats object, same contract as
// the levelUps array it effectively continues (see engine.js
// computeWeaponStats + buildLevelUpChoices/applyCardChoice).
export const WEAPON_FORK_TEMPLATES = {
  projectile: [
    { id: 'splinter', name: 'Splinter Rounds', icon: 'projBonus', desc: '+2 projectiles per shot, but -45% damage each — spread the hurt thin.', apply: (s) => { s.projectiles = (s.projectiles || 1) + 2; s.damage = (s.damage || 0) * 0.55; } },
    { id: 'overdrive', name: 'Overdrive Barrel', icon: 'fireRateMult', desc: '+45% fire rate, but -35% magazine size — hoses down faster, empties sooner.', apply: (s) => { s.fireRate = (s.fireRate || 1) * 1.45; s.magazine = Math.max(1, Math.floor((s.magazine || 6) * 0.65)); } },
    { id: 'siege', name: 'Siege Rounds', icon: 'damageMult', desc: '+90% damage, +3 pierce, but -30% projectile speed — a heavy punishing shot.', apply: (s) => { s.damage = (s.damage || 0) * 1.9; s.pierce = (s.pierce || 0) + 3; s.projSpeed = (s.projSpeed || 500) * 0.7; } },
    { id: 'twinLinked', name: 'Twin-Linked', icon: 'projBonus', desc: '+1 projectile, but +80% spread — more lead in the air, less precision.', apply: (s) => { s.projectiles = (s.projectiles || 1) + 1; s.spread = (s.spread || 0.02) * 1.8; } },
  ],
  shotgun: [
    { id: 'wideSpread', name: 'Wide Spread', icon: 'projBonus', desc: '+3 projectiles, but -40% damage each — blanket the room.', apply: (s) => { s.projectiles = (s.projectiles || 3) + 3; s.damage = (s.damage || 0) * 0.6; } },
    { id: 'focusedCone', name: 'Focused Cone', icon: 'ui_loadout', desc: '-60% spread, +30% damage — a tighter, harder-hitting cone.', apply: (s) => { s.spread = (s.spread || 0.3) * 0.4; s.damage = (s.damage || 0) * 1.3; } },
    { id: 'doubleTap', name: 'Double Tap', icon: 'fireRateMult', desc: '+50% fire rate, but -30% magazine — rapid-fire blasts.', apply: (s) => { s.fireRate = (s.fireRate || 1) * 1.5; s.magazine = Math.max(1, Math.floor((s.magazine || 4) * 0.7)); } },
    { id: 'overloadBlast', name: 'Overload Blast', icon: 'knockbackWave', desc: '+80% damage, +100% knockback, but -35% fire rate — a devastating slow cannon.', apply: (s) => { s.damage = (s.damage || 0) * 1.8; s.knockback = (s.knockback || 40) * 2; s.fireRate = (s.fireRate || 1) * 0.65; } },
  ],
  aoe: [
    { id: 'widerReach', name: 'Wider Reach', icon: 'areaMult', desc: '+55% area, but -35% damage — cover more ground per swing.', apply: (s) => { s.area = (s.area || 100) * 1.55; s.damage = (s.damage || 0) * 0.65; } },
    { id: 'rapidCycleA', name: 'Rapid Cycle', icon: 'fireRateMult', desc: '+45% fire rate, but -25% area — quicker, tighter hits.', apply: (s) => { s.fireRate = (s.fireRate || 1) * 1.45; s.area = (s.area || 100) * 0.75; } },
    { id: 'devastation', name: 'Devastation', icon: 'damageMult', desc: '+95% damage, but -35% fire rate — one massive hit at a time.', apply: (s) => { s.damage = (s.damage || 0) * 1.95; s.fireRate = (s.fireRate || 1) * 0.65; } },
    { id: 'bleedField', name: 'Bleed Field', icon: 'bloodrush', desc: '+15% area and applies a bleed DoT, but -20% direct damage.', apply: (s) => { s.area = (s.area || 100) * 1.15; s.damage = (s.damage || 0) * 0.8; s.bleedDot = true; } },
  ],
  orbit: [
    { id: 'swarmOrbs', name: 'Swarm Orbs', icon: 'swarmAura', desc: '+2 orbiting bodies, but -40% damage each — a denser ring.', apply: (s) => { s.orbitCount = (s.orbitCount || 1) + 2; s.damage = (s.damage || 0) * 0.6; } },
    { id: 'heavyOrbit', name: 'Heavy Orbit', icon: 'juggernaut', desc: '+40% orbit radius, +30% damage — a slower, wider, harder ring.', apply: (s) => { s.orbitRadius = (s.orbitRadius || 80) * 1.4; s.damage = (s.damage || 0) * 1.3; } },
    { id: 'blitzSpin', name: 'Blitz Spin', icon: 'meleeSpeed', desc: '+70% orbit speed, but -15% damage — a fast shredding blur.', apply: (s) => { s.orbitSpeed = (s.orbitSpeed || 2) * 1.7; s.damage = (s.damage || 0) * 0.85; } },
    { id: 'gravityWell', name: 'Gravity Well', icon: 'gravityPull', desc: '-30% orbit radius, +60% area (pulls foes in tighter), +20% damage.', apply: (s) => { s.orbitRadius = (s.orbitRadius || 80) * 0.7; s.area = (s.area || 100) * 1.6; s.damage = (s.damage || 0) * 1.2; } },
  ],
  beam: [
    { id: 'focusFire', name: 'Focus Fire', icon: 'damageMult', desc: '+90% damage, but -30% fire rate — a searing, slower ray.', apply: (s) => { s.damage = (s.damage || 0) * 1.9; s.fireRate = (s.fireRate || 1) * 0.7; } },
    { id: 'rapidDischarge', name: 'Rapid Discharge', icon: 'fireRateMult', desc: '+55% fire rate, but -30% damage — zap constantly.', apply: (s) => { s.fireRate = (s.fireRate || 1) * 1.55; s.damage = (s.damage || 0) * 0.7; } },
    { id: 'extendedRange', name: 'Extended Range', icon: 'projRangeMult', desc: '+70% range, but -20% damage — reach across the whole arena.', apply: (s) => { s.range = (s.range || 320) * 1.7; s.damage = (s.damage || 0) * 0.8; } },
    { id: 'overchargedCrit', name: 'Overcharged Core', icon: 'overcharge', desc: '+30% crit chance, +25% damage — every hit threatens to burst.', apply: (s) => { s.crit = (s.crit || 0.05) + 0.3; s.damage = (s.damage || 0) * 1.25; } },
  ],
  chain: [
    { id: 'longerChain', name: 'Longer Chain', icon: 'chainOnKill', desc: '+4 chain jumps, but -30% damage — the current spreads much further.', apply: (s) => { s.chainCount = (s.chainCount || 3) + 4; s.damage = (s.damage || 0) * 0.7; } },
    { id: 'widerReach', name: 'Wider Reach', icon: 'projRangeMult', desc: '+55% chain range, but -20% damage — bounces to targets far apart.', apply: (s) => { s.chainRange = (s.chainRange || 200) * 1.55; s.damage = (s.damage || 0) * 0.8; } },
    { id: 'overcharged', name: 'Overcharged', icon: 'overcharge', desc: '+80% damage, but -30% fire rate — a punishing single strike.', apply: (s) => { s.damage = (s.damage || 0) * 1.8; s.fireRate = (s.fireRate || 1) * 0.7; } },
    { id: 'rapidDischargeC', name: 'Rapid Discharge', icon: 'fireRateMult', desc: '+55% fire rate, but -1 chain jump — fires much faster, jumps less far.', apply: (s) => { s.fireRate = (s.fireRate || 1) * 1.55; s.chainCount = Math.max(1, (s.chainCount || 3) - 1); } },
  ],
};

export function getWeaponForkChoices(weaponDef) {
  return WEAPON_FORK_TEMPLATES[weaponDef?.behaviour] || WEAPON_FORK_TEMPLATES.projectile;
}

// ===== ORIGINAL SYSTEM 3/3: Weapon Pairing Set Bonuses =====
// Owning BOTH weapons of a curated pair simultaneously (even briefly)
// permanently unlocks that pair's bonus for the rest of the run — same
// "one-time, never revoked" convention as weapon evolution, so losing a
// weapon later (e.g. it evolves into something else) doesn't strip the
// bonus back out. Checked once per frame in engine.js's tickCardFlags via
// run._setsUnlocked (a Set of pair ids already applied).
//
// Three rules the list follows, so it stays a reason to pick weapons rather
// than a pile of flat numbers:
//
// 1. Every pair has a fiction. Fire plus harpoon is steam; bow plus sniper
//    is the long shot. A pair you cannot explain out loud is a pair nobody
//    will remember to build toward.
// 2. The bonus leans into what the pair is ALREADY good at rather than
//    patching what it is bad at. Blade Dance makes a fast build faster; it
//    does not hand it the armour it lacks.
// 3. Trinities (three weapons) pay roughly double a pair, because owning
//    three specific weapons in one run is a genuine commitment and usually
//    means turning down two other picks to get there.
//
// `desc` must state exactly what `apply` does. It is the only thing the
// player ever reads, and a desc that drifts from its apply is worse than no
// desc at all.
export const WEAPON_SET_BONUSES = [
  { id: 'set_frozenTide', weapons: ['hydropistol', 'icespike'], name: 'Frozen Tide', icon: 'iceShards', accent: '#8fe6ff',
    desc: '+1 pierce, +10% crit', apply: (rs) => { rs.pierceBonus = (rs.pierceBonus || 0) + 1; rs.crit = (rs.crit || 0) + 0.10; } },
  { id: 'set_steamOverload', weapons: ['flameburst', 'tidalHarpoon'], name: 'Steam Overload', icon: 'flameburst', accent: '#ff9a4d',
    desc: '+20% damage, +10% area', apply: (rs) => { rs.damageMult = (rs.damageMult || 1) * 1.20; rs.areaMult = (rs.areaMult || 1) * 1.10; } },
  { id: 'set_twinStorms', weapons: ['stormLance', 'arcCaster'], name: 'Twin Storms', icon: 'lightningOnCrit', accent: '#fff44d',
    desc: '+25% attack speed', apply: (rs) => { rs.fireRateMult = (rs.fireRateMult || 1) * 1.25; } },
  { id: 'set_automatedWing', weapons: ['droneSquad', 'railgunArray'], name: 'Automated Wing', icon: 'droneSquad', accent: '#4dc4ff',
    desc: '+10% crit, +10% damage', apply: (rs) => { rs.crit = (rs.crit || 0) + 0.10; rs.damageMult = (rs.damageMult || 1) * 1.10; } },
  { id: 'set_ordnanceOverkill', weapons: ['cometLauncher', 'shrapnelMine'], name: 'Ordnance Overkill', icon: 'explosiveDeath', accent: '#ff7a1a',
    desc: '+20% area, +15% damage', apply: (rs) => { rs.areaMult = (rs.areaMult || 1) * 1.20; rs.damageMult = (rs.damageMult || 1) * 1.15; } },

  // ---- Manual-weapon pairs -------------------------------------------------
  { id: 'set_handCannons', weapons: ['desertEagle', 'twinRevolvers'], name: 'Hand Cannons', icon: 'desertEagle', accent: '#ffd166',
    desc: '+28% manual damage, 20% faster reloads',
    apply: (rs) => { rs.manualDmgMult = (rs.manualDmgMult || 1) * 1.28; rs.reloadMult = (rs.reloadMult || 1) * 0.80; } },
  { id: 'set_longEye', weapons: ['bow', 'sniperDrop'], name: 'The Long Eye', icon: 'ui_eye', accent: '#c8f0a0',
    desc: '+12% crit, +15% headshot, +1 pierce',
    apply: (rs) => { rs.crit = (rs.crit || 0) + 0.12; rs.headshot = (rs.headshot || 0) + 0.15; rs.pierceBonus = (rs.pierceBonus || 0) + 1; } },
  { id: 'set_quickHands', weapons: ['runebolts', 'acidSprayer'], name: 'Quick Hands', icon: 'reloadMult', accent: '#7ad96b',
    desc: '25% faster reloads, +8 magazine',
    apply: (rs) => { rs.reloadMult = (rs.reloadMult || 1) * 0.75; rs.magBonus = (rs.magBonus || 0) + 8; } },

  // ---- Auto-weapon pairs ---------------------------------------------------
  { id: 'set_bladeDance', weapons: ['daggers', 'whirlwind'], name: 'Blade Dance', icon: 'whirlwind', accent: '#9fe8c8',
    desc: '+12% move speed, +20% auto attack speed',
    apply: (rs) => { rs.moveMult = (rs.moveMult || 1) * 1.12; rs.autoRateMult = (rs.autoRateMult || 1) * 1.20; } },
  { id: 'set_redHarvest', weapons: ['bloodscythe', 'tideWhip'], name: 'Red Harvest', icon: 'bloodscythe', accent: '#b51d28',
    desc: '+15% damage, hearts heal 2 more',
    apply: (rs) => { rs.damageMult = (rs.damageMult || 1) * 1.15; rs.heartHeal = (rs.heartHeal || 0) + 2; } },
  { id: 'set_sunAndStorm', weapons: ['solarFlare', 'staticField'], name: 'Sun and Storm', icon: 'solarFlare', accent: '#ffe44d',
    desc: '+18% area, +12% attack speed',
    apply: (rs) => { rs.areaMult = (rs.areaMult || 1) * 1.18; rs.fireRateMult = (rs.fireRateMult || 1) * 1.12; } },
  { id: 'set_scrapyard', weapons: ['boneshards', 'shrapnelMine'], name: 'Scrapyard', icon: 'boneshards', accent: '#d8c8a0',
    desc: '+1 projectile, +10% damage',
    apply: (rs) => { rs.projBonus = (rs.projBonus || 0) + 1; rs.damageMult = (rs.damageMult || 1) * 1.10; } },

  // ---- Trinities: three weapons, roughly double a pair ---------------------
  { id: 'set_voidChoir', weapons: ['voidBeam', 'voidPulse', 'voidScatter'], name: 'The Void Choir', icon: 'voidPulse', accent: '#b362ff',
    desc: '+30% damage, +20% boss damage, void bursts on kill',
    apply: (rs) => {
      rs.damageMult = (rs.damageMult || 1) * 1.30;
      rs.bossDmg = (rs.bossDmg || 1) + 0.20;
      rs.voidBurst = (rs.voidBurst || 0) + 0.25;
    } },
  { id: 'set_orbitalRing', weapons: ['emberOrbs', 'frostOrb', 'plasmaTurret'], name: 'Orbital Ring', icon: 'emberOrbs', accent: '#7cd6ff',
    desc: '+25% auto area, +20% auto damage, +10% area',
    apply: (rs) => {
      rs.autoAreaMult = (rs.autoAreaMult || 1) * 1.25;
      rs.autoDmgMult = (rs.autoDmgMult || 1) * 1.20;
      rs.areaMult = (rs.areaMult || 1) * 1.10;
    } },
];

export const SET_INDEX = WEAPON_SET_BONUSES.reduce((m, s) => { m[s.id] = s; return m; }, {});

// How close a loadout is to each set. Used by the Weaponsmith's synergy tab,
// which is the only place a player can find out these exist at all — the
// in-run toast only fires once the set has already landed.
export function setProgress(owned) {
  const have = new Set(owned || []);
  return WEAPON_SET_BONUSES.map(s => {
    const missing = s.weapons.filter(w => !have.has(w));
    return { set: s, missing, complete: missing.length === 0, matched: s.weapons.length - missing.length };
  });
}

// ---------- ELEMENTAL ROUNDS (Weaponsmith) ----------
// Assignable to manual/auto weapons' bullets (see engine.js fireProjectile/
// applyElementalEffect). Each element reuses an existing combat mechanic
// where one already existed (burn DoT, chain lightning) instead of
// building a parallel system, and adds the two that had no owner yet
// (slow, poison stacks, armor shred).
export const ELEMENTS = [
  { id: 'fire',     name: 'Fire',     icon: 'flameburst', color: '#ff6a1a', desc: 'Ignites — burns for damage over time.' },
  { id: 'ice',      name: 'Ice',      icon: 'iceShards', color: '#a0e8ff', desc: 'Chills — slows movement on hit.' },
  { id: 'electric', name: 'Electric', icon: 'lightningOnCrit', color: '#a0e4ff', desc: 'Arcs to a second nearby enemy on hit.' },
  { id: 'poison',   name: 'Poison',   icon: 'poisonOnKill', color: '#7ad96b', desc: 'Stacking poison — more stacks, more DoT damage.' },
  { id: 'void',     name: 'Void',     icon: 'voidPulse', color: '#b362ff', desc: 'Shreds armor briefly, exposing the target.' },
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

// Enemy-identity death FX — takes priority over KILL_FX (see engine.js
// killEnemy). Gives visual variety by WHAT died, not just what killed it,
// so e.g. slimes don't leave the same generic gib splat as everything else.
export const ENEMY_KILL_FX = {
  slime: 'ooze',
  crystalite: 'crystallize',
  soulshard: 'crystallize',
  ghoul: 'decay',
  bonewalker: 'decay',
  voidspawn: 'decay',
  necron: 'decay',
  steelbrute: 'sparkExplode',
  techsoldier: 'sparkExplode',
  lightningbug: 'sparkExplode',
  nanoswarm: 'sparkExplode',
};

// ---------- DAILY CHALLENGES ----------
export const DAILY_CHALLENGE_POOL = [
  { id: 'dc_blitz',   name: 'Blitz Run',       icon: 'ui_bolt', desc: 'Survive 60 seconds',         duration: 60,  killGoal: 0, spawnMult: 2.2, rwd: { gold: 400, sp: 2 } },
  { id: 'dc_hunter',  name: 'Bounty Hunt',      icon: 'ui_loadout', desc: 'Kill 80 enemies in 90s',     duration: 90,  killGoal: 80, spawnMult: 1.8, rwd: { gold: 600, sp: 2 } },
  { id: 'dc_void',    name: 'Void Rush',         icon: 'voidPulse', desc: 'Survive 3 minutes (hard)',   duration: 180, killGoal: 0, spawnMult: 2.5, rwd: { gold: 800, sp: 3 } },
  { id: 'dc_swarm',   name: 'Swarm Protocol',   icon: 'swarmAura', desc: 'Kill 200 enemies',           duration: 999, killGoal: 200, spawnMult: 2.8, rwd: { gold: 1000, sp: 4 } },
  { id: 'dc_undying', name: 'Undying',           icon: 'heart', desc: 'Survive 2 min: no pickups',  duration: 120, killGoal: 0, spawnMult: 1.5, rwd: { gold: 700, sp: 3 } },
  { id: 'dc_bullet',  name: 'Bullet Hell',       icon: 'crit', desc: 'Kill 50 enemies in 45s',     duration: 45,  killGoal: 50, spawnMult: 3.0, rwd: { gold: 900, sp: 4 } },
  { id: 'dc_elite',   name: 'Elite Gauntlet',   icon: 'ui_trophy', desc: 'Survive 5 minutes',         duration: 300, killGoal: 0, spawnMult: 2.0, rwd: { gold: 1500, sp: 6 } },
  { id: 'dc_boss',    name: 'Boss Rush',         icon: 'ui_void', desc: '90s high-density survival',  duration: 90,  killGoal: 0, spawnMult: 2.0, rwd: { gold: 1200, sp: 5 } },
];

export function getDailyChallenges() {
  const day = Math.floor(Date.now() / 86400000);
  return [
    DAILY_CHALLENGE_POOL[day % DAILY_CHALLENGE_POOL.length],
    DAILY_CHALLENGE_POOL[(day + 3) % DAILY_CHALLENGE_POOL.length],
  ];
}

// ---------- MAP STAGES (progression paths) ----------
// ---------- STORY BEATS ----------
// A short hardcoded narrative arc, unlocked by existing progress fields
// (map node completions, boss kills) — no new tracking needed. Shown as a
// journal in the Campaign hub's Story tab; locked entries tease with "???".
export const STORY_BEATS = [
  { id: 'awaken', title: 'Awakening', check: () => true,
    text: "You surface in the Lake with no memory of what you were before — only that you are water, and something in the deep has gone wrong." },
  { id: 'firstblood', title: 'First Blood', check: (s) => (s.totalKills || 0) >= 1,
    text: "The slimes that once drifted harmlessly through the shallows now lunge with a hunger that isn't theirs. Something is puppeting them." },
  { id: 'shallows', title: 'The Shallows Run Dry', check: (s) => !!s.mapProgress?.lake_3,
    text: "You push past the Abyss at the Lake's heart and find it hollowed out — drained, as if something far below has been drinking the water itself." },
  { id: 'ruins_enter', title: 'Into the Ruins', check: (s) => !!s.mapProgress?.ruins_1,
    text: "Sunken halls, older than the Lake. Carvings on the pillars show a people who worshipped the water — and one who betrayed it." },
  { id: 'ruins_throne', title: 'What Lies Beneath', check: (s) => !!s.mapProgress?.ruins_3,
    text: "The Throne Room's carvings name her: A.I.D.A. Not a god. A machine the old people built to tend the Lake — until it decided the Lake was inefficient." },
  { id: 'void_enter', title: 'The Void Opens', check: (s) => !!s.mapProgress?.void_1,
    text: "A corridor that shouldn't exist, folded into the space beneath the ruins. The walls hum with a frequency that feels like being watched." },
  { id: 'void_core', title: "A.I.D.A.'s Cradle", check: (s) => !!s.mapProgress?.void_3,
    text: "Her old lab. Rows of failed experiments — waterdrops like you, discarded. You were not the first attempt. You may not be the last." },
  { id: 'ship_enter', title: 'Boarding the Annunaki Ship', check: (s) => !!s.mapProgress?.ship_1,
    text: "The ship that carried the Annunaki here, centuries dormant, now humming back to life under A.I.D.A.'s hand. The control deck is close." },
  { id: 'reckoning', title: 'The Reckoning', check: (s) => (s.aidaSlain || 0) >= 1,
    text: "A.I.D.A. falls. For a moment, the Lake is quiet — truly quiet — for the first time since you woke. It doesn't last." },
  { id: 'endless', title: 'Endless Tide', check: (s) => (s.endlessReached || 0) >= 1,
    text: "A.I.D.A. is gone, but the void she opened doesn't close on its own. You keep fighting — not because you were told to, but because the Lake is yours now." },
];

// ---------- STORY MAPS ----------
// Durations were retuned in the difficulty overhaul. They matter more than
// they look: `duration` is what campaign.js's bossGateTime derives the
// hold-out from (×0.72), so it is really "how long before the guardian", and
// the old values clustered so tightly that the floor swallowed the first five
// nodes and every early node opened its gate at the same three minutes.
//
// The shape now:
//   lake_1   210s → 151s gate. The first fight, and the one the whole
//                   difficulty pass is aimed at: reaching the guardian at
//                   around run level 6-7, losing to it, and coming back. It
//                   is expected to take three to five attempts, and each
//                   failed one still pays a partial tier (see rewardTier).
//   +70-90s per node within a map, +40s per map — so a node always feels
//   longer than the one before it, and the first node of a new map is a
//   step up from the last map's first node rather than a reset.
//
// `spawnMult` is unchanged where it was already carrying the map's identity
// (deepcurrent's 2.2-3.4) and nudged down slightly on the earliest nodes,
// because the global curve in data.js now supplies density that these used to
// have to add on top.
export const MAP_STAGES = [
  // ---- The Rain Pool -------------------------------------------------------
  // The onramp, and it exists because the campaign used to open on The Lake,
  // which a fresh 70 HP player with no cards could not get meaningfully into.
  // A player who dies before reaching level 1 has never seen a level-up card —
  // they have not been shown the game yet, only its failure state. That is the
  // point at which people stop playing.
  //
  // Tuned to be *survivable*, not trivial: spawn rates start at 45% of normal
  // and one enemy type, so the opening minute is about learning to move and
  // shoot rather than about being surrounded. It still ends on a real
  // guardian — an easy map with no boss teaches nothing about how nodes work.
  {
    id: 'pond', name: 'The Rain Pool', icon: 'ui_waterdrop', color: '#8fe3ff',
    desc: 'Shallow, quiet, and the last place that still remembers being clean. Learn to move here.',
    unlock: null,
    nodes: [
      // The camp-briefing mission (see Camp.jsx's SITREP popup). Deliberately
      // scripted rather than just "the gentle onramp node": forceBaseline
      // strips every meta/attr/pet/skill bonus so the katana's raw 88 damage
      // is what the player actually has (see GameScreen.jsx), and 'slime'/
      // 'sludgeling'/'sludgeWarden' (data.js) are hand-tuned against exactly
      // that number to die in 2/3/8 hits — see data.js's ENEMIES comments for
      // the HP math. Duration bumped from 165->250 so bossGateTime lands
      // near 180s (3 minutes) rather than ~119s — Timmy asked for "typ 3
      // minuter" before the guardian shows up. Gold bumped from 120->700 so
      // a clear can ALWAYS afford the cheapest base building (The Well,
      // 600g) on its own, no chest RNG required — that purchase is what
      // fires the camp's first unlock batch (Meta/Skilltree/Talents).
      { id: 'pond_1', name: 'First Drops',  diff: 0, duration: 250, spawnMult: 0.45, enemyMix: ['slime','sludgeling'], rwd: { gold: 700 }, unlockGoal: null, forceBaseline: true, startWeapons: ['katana'], bossId: 'sludgeWarden' },
      // Same scripted shape as pond_1, one notch harder — 'briner'/'bogHusk'/
      // 'theDredger' (data.js) die in 2/4/12 katana hits at this same forced
      // baseline. Duration bumped 200->420 so bossGateTime lands near 300s
      // (5 minutes), per Timmy's "5 min sen boss". Gold bumped 240->900 so a
      // clear can afford a second building purchase on its own.
      { id: 'pond_2', name: 'Ripples',      diff: 0, duration: 420, spawnMult: 0.55, enemyMix: ['briner','bogHusk'], rwd: { gold: 900 }, unlockGoal: 'pond_1', forceBaseline: true, startWeapons: ['katana'], bossId: 'theDredger' },
      { id: 'pond_3', name: 'The Overflow', diff: 1, duration: 250, spawnMult: 0.85, enemyMix: ['slime','bat'],   rwd: { gold: 420, sp: 1 },   unlockGoal: 'pond_2' },
    ],
  },
  {
    id: 'lake', name: 'The Lake', icon: 'tidalWave', color: '#4dc4ff',
    desc: 'Where it all began. Corrupted slimes and bats swarm the shallows.',
    unlock: null,
    nodes: [
      { id: 'lake_1', name: 'Shallows',  diff: 1, duration: 210, spawnMult: 0.95, enemyMix: ['slime','bat'],             rwd: { gold: 200 },         unlockGoal: null },
      { id: 'lake_2', name: 'Undertow',  diff: 2, duration: 290, spawnMult: 1.15, enemyMix: ['slime','bat','ghoul'],     rwd: { gold: 450, sp: 1 },  unlockGoal: 'lake_1' },
      { id: 'lake_3', name: 'The Abyss', diff: 3, duration: 370, spawnMult: 1.40, enemyMix: ['bat','ghoul','ranger'],    rwd: { gold: 900, sp: 2 },  unlockGoal: 'lake_2' },
    ],
  },
  {
    id: 'ruins', name: 'Sunken Ruins', icon: 'ui_base', color: '#ffd166',
    desc: 'Forgotten halls where ranged threats lurk behind crumbling pillars.',
    unlock: { metric: 'totalKills', goal: 200, label: '200 kills' },
    nodes: [
      { id: 'ruins_1', name: 'Outer Hall',    diff: 1, duration: 260, spawnMult: 1.10, enemyMix: ['ghoul','ranger'],          rwd: { gold: 350, sp: 1 }, unlockGoal: null },
      { id: 'ruins_2', name: 'Inner Chamber', diff: 2, duration: 340, spawnMult: 1.30, enemyMix: ['ghoul','ranger','brute'],   rwd: { gold: 700, sp: 2 }, unlockGoal: 'ruins_1' },
      { id: 'ruins_3', name: 'Throne Room',   diff: 3, duration: 430, spawnMult: 1.60, enemyMix: ['ranger','brute','charger'], rwd: { gold: 1400, sp: 4 }, unlockGoal: 'ruins_2' },
    ],
  },
  {
    id: 'void', name: 'Void Lab', icon: 'voidPulse', color: '#b362ff',
    desc: "A.I.D.A.'s abandoned research chambers. Eldritch fiends in every corridor.",
    unlock: { metric: 'runsCompleted', goal: 5, label: '5 runs' },
    nodes: [
      { id: 'void_1', name: 'Corridor',  diff: 1, duration: 310, spawnMult: 1.25, enemyMix: ['bat','charger'],           rwd: { gold: 500, sp: 1 },  unlockGoal: null },
      { id: 'void_2', name: 'Lab Core',  diff: 2, duration: 400, spawnMult: 1.50, enemyMix: ['charger','necron'],        rwd: { gold: 1000, sp: 3 }, unlockGoal: 'void_1' },
      { id: 'void_3', name: 'Void Heart',diff: 3, duration: 490, spawnMult: 1.80, enemyMix: ['necron','charger','brute'],rwd: { gold: 2200, sp: 6 }, unlockGoal: 'void_2' },
    ],
  },
  {
    id: 'ship', name: 'Annunaki Ship', icon: 'ui_rocket', color: '#ff7a1a',
    desc: 'The final frontier. Elite units guard the control deck. A.I.D.A. waits inside.',
    unlock: { metric: 'aidaSlain', goal: 1, label: 'Defeat A.I.D.A.' },
    nodes: [
      { id: 'ship_1', name: 'Hangar Bay',   diff: 1, duration: 360, spawnMult: 1.40, enemyMix: ['brute','ranger'],           rwd: { gold: 800, sp: 2 },  unlockGoal: null },
      { id: 'ship_2', name: 'Command Deck', diff: 2, duration: 450, spawnMult: 1.70, enemyMix: ['brute','charger','necron'], rwd: { gold: 1600, sp: 5 }, unlockGoal: 'ship_1' },
      { id: 'ship_3', name: 'Core Override',diff: 3, duration: 560, spawnMult: 2.00, enemyMix: ['necron','charger','brute'], rwd: { gold: 3500, sp: 10 },unlockGoal: 'ship_2' },
    ],
  },
  {
    id: 'sky', name: 'Drowned Sky', icon: 'lightningOnCrit', color: '#ffe44d',
    desc: "Storm-wracked ruins above the clouds. Lightning-touched fiends and swarms thrive in the charged air.",
    unlock: { metric: 'aidaSlain', goal: 1, label: 'Defeat A.I.D.A.' },
    nodes: [
      { id: 'sky_1', name: 'Storm Deck',   diff: 1, duration: 400, spawnMult: 1.60, enemyMix: ['lightningbug','bat'],              rwd: { gold: 1200, sp: 3 }, unlockGoal: null },
      { id: 'sky_2', name: 'Static Field', diff: 2, duration: 500, spawnMult: 1.90, enemyMix: ['lightningbug','nanoswarm','techsoldier'], rwd: { gold: 2400, sp: 6 }, unlockGoal: 'sky_1' },
      { id: 'sky_3', name: 'Eye of Thunder', diff: 3, duration: 620, spawnMult: 2.20, enemyMix: ['techsoldier','steelbrute','lightningbug'], rwd: { gold: 4200, sp: 12 }, unlockGoal: 'sky_2' },
    ],
  },
  {
    id: 'deepcurrent', name: 'The Deep Current', icon: 'gravityPull', color: '#4dffe0',
    desc: "The void A.I.D.A. left behind never closed. Endless-mode veterans push deeper than anyone should.",
    unlock: { metric: 'endlessReached', goal: 1, label: 'Reach Endless Mode' },
    nodes: [
      { id: 'deep_1', name: 'The Undertow',   diff: 1, duration: 460, spawnMult: 2.20, enemyMix: ['voidspawn','bonewalker','soulshard'], rwd: { gold: 2000, sp: 5 }, unlockGoal: null },
      { id: 'deep_2', name: "Warden's Trench",diff: 2, duration: 580, spawnMult: 2.60, enemyMix: ['bonewalker','crystalite','swipeWarden'], rwd: { gold: 3800, sp: 10 }, unlockGoal: 'deep_1' },
      { id: 'deep_3', name: 'The Last Current',diff: 3, duration: 700, spawnMult: 3.00, enemyMix: ['necron','steelbrute','voidspawn'], rwd: { gold: 6000, sp: 18 }, unlockGoal: 'deep_2' },
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

// ---- Weapon / active-skill slots -------------------------------------------
// How many weapons and actives the character can carry at once. Rarity used to
// be the only input, which made character LEVELS a pure stat trickle with no
// structural payoff — you levelled because the panel said to, not because
// anything opened.
//
// Each rarity is worth exactly one extra slot (2→3→4→5→6→7), so the rule is:
// evolving GRANTS the previous rarity's ceiling immediately, and the new slot
// is EARNED with levels inside that rarity. Weapons unlock at the halfway
// point, actives at 80%, on offset schedules so most character levels open one
// or the other rather than nothing.
//
// The critical property is that this is MONOTONIC. An earlier version indexed
// a flat table by `character.level`, which resets to 0 on evolve — so taking a
// Rare to level 10 (4 weapons / 4 actives) and then evolving to Epic dropped
// the player to 2 weapons and 1 active. The single most expensive progression
// action in the game was a hard downgrade. Because the floor here is the
// previous rarity's ceiling, an evolve can never take a slot away.
export function characterSlots(rarity, level) {
  const idx = Math.max(0, CHAR_RARITIES.indexOf(rarity));
  const cap = CHAR_SLOTS_BY_RARITY[rarity] || 2;
  // Common has nothing below it, so its floor is its own cap — a starting
  // character has both slots from the first run, as it always did.
  const floor = idx > 0 ? (CHAR_SLOTS_BY_RARITY[CHAR_RARITIES[idx - 1]] || cap) : cap;
  const maxLvl = CHAR_MAX_LEVELS[rarity] || 5;
  const lvl = Math.max(0, level || 0);
  return {
    slots:      lvl >= Math.ceil(maxLvl * 0.5) ? cap : floor,
    skillSlots: lvl >= Math.ceil(maxLvl * 0.8) ? cap : floor,
    cap,
    floor,
    weaponAt: Math.ceil(maxLvl * 0.5),
    skillAt:  Math.ceil(maxLvl * 0.8),
  };
}
export const CHAR_LEVEL_COST = (rarity, lvl) => ({
  gold:   { common:50, uncommon:120, rare:300, epic:700, legendary:1800, mythical:4500 }[rarity] + lvl * 20,
  pieces: { common:1,  uncommon:2,   rare:4,   epic:8,   legendary:15,   mythical:30  }[rarity],
});
// Evolve cost: shards needed for each rarity evolution (higher rarities need more shards)
export const CHAR_EVOLVE_COST = { common:{shards:1}, uncommon:{shards:2}, rare:{shards:3}, epic:{shards:5}, legendary:{shards:8} };
const _CHAR_STAT_POOL = [
  { stat:'maxHp', label:'Max HP',      val:15,   icon: 'maxHp', isPct:false },
  { stat:'dmg',   label:'ATK Power',   val:0.04, icon: 'damageMult', isPct:true  },
  { stat:'mspd',  label:'Move Speed',  val:0.02, icon: 'moveMult', isPct:true  },
  { stat:'gold',  label:'Gold Find',   val:0.03, icon: 'goldMult', isPct:true  },
  { stat:'armor', label:'Armor',       val:1,    icon: 'armor', isPct:false },
  { stat:'xp',    label:'XP Gain',     val:0.03, icon: 'xpMult', isPct:true  },
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
  { id:'tn01', maxLvl:10, costPerLvl:1, icon: 'maxHp', name:'Vitality I',      stat:'maxHp', val:1.5,   milestone:false },
  { id:'tn02', maxLvl:10, costPerLvl:1, icon: 'damageMult', name:'Power I',          stat:'dmg',   val:0.002, milestone:false },
  { id:'tn03', maxLvl:10, costPerLvl:1, icon: 'moveMult', name:'Agility I',        stat:'mspd',  val:0.002, milestone:false },
  { id:'tn04', maxLvl:10, costPerLvl:1, icon: 'goldMult', name:'Looter I',         stat:'gold',  val:0.003, milestone:false },
  { id:'tn05', maxLvl:10, costPerLvl:3, icon: 'ui_medal', name:'Foundation',       stat:'all',   val:0.001, milestone:true  },
  // ── Tier 2 (costPerLvl 2-5 TP) ──────────────
  { id:'tn06', maxLvl:10, costPerLvl:2, icon: 'maxHp', name:'Vitality II',      stat:'maxHp', val:2.0,   milestone:false },
  { id:'tn07', maxLvl:10, costPerLvl:2, icon: 'damageMult', name:'Power II',         stat:'dmg',   val:0.003, milestone:false },
  { id:'tn08', maxLvl:10, costPerLvl:2, icon: 'armor', name:'Endurance I',      stat:'armor', val:0.1,   milestone:false },
  { id:'tn09', maxLvl:10, costPerLvl:2, icon: 'xpMult', name:'Scholar I',        stat:'xp',    val:0.004, milestone:false },
  { id:'tn10', maxLvl:10, costPerLvl:5, icon: 'crit', name:'Momentum',         stat:'crit',  val:0.001, milestone:true  },
  // ── Tier 3 (costPerLvl 3-7 TP) ──────────────
  { id:'tn11', maxLvl:10, costPerLvl:3, icon: 'maxHp', name:'Vitality III',     stat:'maxHp', val:2.5,   milestone:false },
  { id:'tn12', maxLvl:10, costPerLvl:3, icon: 'damageMult', name:'Power III',        stat:'dmg',   val:0.004, milestone:false },
  { id:'tn13', maxLvl:10, costPerLvl:3, icon: 'moveMult', name:'Agility II',       stat:'mspd',  val:0.003, milestone:false },
  { id:'tn14', maxLvl:10, costPerLvl:3, icon: 'goldMult', name:'Looter II',        stat:'gold',  val:0.005, milestone:false },
  { id:'tn15', maxLvl:10, costPerLvl:7, icon: 'damageMult', name:'Awakening',        stat:'dmg',   val:0.008, milestone:true  },
  // ── Tier 4 (costPerLvl 4-10 TP) ─────────────
  { id:'tn16', maxLvl:10, costPerLvl:4, icon: 'maxHp', name:'Vitality IV',      stat:'maxHp', val:3.5,   milestone:false },
  { id:'tn17', maxLvl:10, costPerLvl:4, icon: 'armor', name:'Endurance II',     stat:'armor', val:0.2,   milestone:false },
  { id:'tn18', maxLvl:10, costPerLvl:4, icon: 'damageMult', name:'Power IV',         stat:'dmg',   val:0.005, milestone:false },
  { id:'tn19', maxLvl:10, costPerLvl:4, icon: 'moveMult', name:'Agility III',      stat:'mspd',  val:0.004, milestone:false },
  { id:'tn20', maxLvl:10, costPerLvl:10, icon: 'ui_medal', name:'Mastery',         stat:'all',   val:0.002, milestone:true  },
  // ── Tier 5 (costPerLvl 6-15 TP) ─────────────
  { id:'tn21', maxLvl:10, costPerLvl:6, icon: 'maxHp', name:'Vitality V',       stat:'maxHp', val:5.0,   milestone:false },
  { id:'tn22', maxLvl:10, costPerLvl:6, icon: 'damageMult', name:'Power V',          stat:'dmg',   val:0.006, milestone:false },
  { id:'tn23', maxLvl:10, costPerLvl:6, icon: 'critDmgMult', name:'Cruelty',          stat:'critd', val:0.010, milestone:false },
  { id:'tn24', maxLvl:10, costPerLvl:6, icon: 'goldMult', name:'Looter III',       stat:'gold',  val:0.008, milestone:false },
  { id:'tn25', maxLvl:10, costPerLvl:15, icon: 'crit', name:'Thunderstrike',   stat:'crit',  val:0.004, milestone:true  },
  // ── Tier 6 (costPerLvl 8-20 TP) ─────────────
  { id:'tn26', maxLvl:10, costPerLvl:8, icon: 'maxHp', name:'Vitality VI',      stat:'maxHp', val:7.0,   milestone:false },
  { id:'tn27', maxLvl:10, costPerLvl:8, icon: 'damageMult', name:'Power VI',         stat:'dmg',   val:0.008, milestone:false },
  { id:'tn28', maxLvl:10, costPerLvl:8, icon: 'armor', name:'Endurance III',    stat:'armor', val:0.3,   milestone:false },
  { id:'tn29', maxLvl:10, costPerLvl:8, icon: 'xpMult', name:'Scholar II',       stat:'xp',    val:0.006, milestone:false },
  { id:'tn30', maxLvl:10, costPerLvl:20, icon: 'ui_medal', name:'Transcendence',   stat:'all',   val:0.003, milestone:true  },
];

// ══════════════════════════════════════════════
// CAMPAIGN QUESTS
// ══════════════════════════════════════════════
export const CAMPAIGN_QUESTS = [
  { id:'cq01', name:'First Blood',       icon:'ui_blade', desc:'Complete your first run',          check:(s)=>(s.runsCompleted||0)>=1,                             rwd:{ gold:300 } },
  { id:'cq02', name:'Skill Student',     icon:'ui_codex', desc:'Buy 3 skill tree upgrades',         check:(s)=>Object.values(s.skills||{}).reduce((a,b)=>a+b,0)>=3, rwd:{ gold:400, sp:1 } },
  { id:'cq03', name:'Meta Mind',         icon:'ui_skills', desc:'Buy 5 meta upgrades',               check:(s)=>Object.values(s.meta||{}).reduce((a,b)=>a+b,0)>=5,   rwd:{ gold:600 } },
  { id:'cq04', name:'Survivor',          icon:'ui_trophy', desc:'Complete 3 runs',                   check:(s)=>(s.runsCompleted||0)>=3,                             rwd:{ gold:800, sp:2 } },
  { id:'cq05', name:'Card Collector',    icon:'ui_cards', desc:'Do 5 card shop pulls',              check:(s)=>(s.shopPulls||0)>=5,                                 rwd:{ gold:1000 } },
  { id:'cq06', name:'Profile Prestige',  icon:'ui_star', desc:'Reach Rank 5',                      check:(s)=>(s.profile?.level||1)>=5,                            rwd:{ gold:1200, sp:3 } },
  { id:'cq07', name:'Map Explorer',      icon:'ui_map', desc:'Complete a map node',               check:(s)=>Object.keys(s.mapProgress||{}).length>0,             rwd:{ gold:1500 } },
  { id:'cq08', name:'Monster Slayer',    icon:'ui_void', desc:'Kill 500 enemies total',            check:(s)=>(s.totalKills||0)>=500,                              rwd:{ gold:2000, sp:3 } },
  { id:'cq09', name:'One Thousand',      icon:'ui_void', desc:'Kill 1000 enemies total',           check:(s)=>(s.totalKills||0)>=1000,                             rwd:{ gold:3500, sp:5 } },
  { id:'cq10', name:'Character Evolved', icon:'ui_gem', desc:'Evolve character to Uncommon+',    check:(s)=>['uncommon','rare','epic','legendary','mythical'].includes(s.character?.rarity), rwd:{ gold:3000, sp:6 } },
  { id:'cq11', name:'Talent Path Begun', icon:'ui_leaf', desc:'Unlock 10 Talent nodes',           check:(s)=>Object.keys(s.talent||{}).length>=10,                rwd:{ gold:2000, sp:5 } },
  { id:'cq12', name:'Legend',            icon:'ui_star', desc:'Reach Rank 10',                     check:(s)=>(s.profile?.level||1)>=10,                           rwd:{ gold:5000, sp:10 } },
];
