// =============================================
// EQUIPMENT / GEAR SYSTEM
// =============================================
import { resolveMerge } from './forge';

export const GEAR_SLOTS = ['helmet','chest','arms','legs','boots','ring','amulet'];
export const GEAR_SLOT_ICONS = {
  helmet:'🪖', chest:'🎽', arms:'🥊', legs:'👖', boots:'🥾', ring:'💍', amulet:'📿'
};
export const GEAR_SLOT_NAMES = {
  helmet:'Helmet', chest:'Chest', arms:'Gloves', legs:'Legs', boots:'Boots', ring:'Ring', amulet:'Amulet'
};

export const GEAR_RARITIES = ['common','magic','rare','epic','legendary','mythical'];
export const GEAR_RARITY_COLORS = {
  common:    '#9a8fa6',
  magic:     '#4dc4ff',
  rare:      '#ffd166',
  epic:      '#b362ff',
  legendary: '#ff7a1a',
  mythical:  '#ff3146',
};
export const GEAR_RARITY_MULT = {
  common: 1.0, magic: 1.6, rare: 2.5, epic: 3.8, legendary: 6.0, mythical: 9.5,
};

// Primary stat by slot — expanded pool per slot for more build variety
// (was 2 possible rolls/slot, now 3-4).
const SLOT_STATS = {
  helmet:  ['maxHp', 'armor', 'crit', 'headshot'],
  chest:   ['maxHp', 'armor', 'regen'],
  arms:    ['dmg',   'atks',  'pierce'],
  legs:    ['mspd',  'dodge', 'armor'],
  boots:   ['mspd',  'pickup', 'dodge'],
  ring:    ['crit',  'critd', 'proj'],
  amulet:  ['xp',    'gold',  'area'],
};

// Base stat value (before rarity mult)
const BASE_VALS = {
  maxHp: 6, armor: 0.8, dmg: 0.008, atks: 0.008, mspd: 0.008,
  dodge: 0.015, pickup: 0.04, crit: 0.008, critd: 0.04, xp: 0.015, gold: 0.015,
  headshot: 0.004, regen: 0.006, pierce: 0.15, proj: 0.08, area: 0.006,
};
// Almost every piece also carries a small flat armor roll on top of its
// primary stat, per spec ("most pieces should have at least a little
// armor") — small enough it never outshines the primary roll.
const SECONDARY_ARMOR_CHANCE = 0.8;
const SECONDARY_ARMOR_BASE = 0.35;

const NAME_PREFIX = {
  common:    ['Cracked','Worn','Crude'],
  magic:     ['Shimmering','Refined','Balanced'],
  rare:      ['Enchanted','Pulsing','Etched'],
  epic:      ['Voidforged','Ancient','Resonant'],
  legendary: ['Annunaki','Celestial','Eternal'],
  mythical:  ['Waterborn','Genesis','Primordial'],
};
const SLOT_NAME_SUFFIX = {
  helmet:'Helm', chest:'Plate', arms:'Grips', legs:'Greaves',
  boots:'Treads', ring:'Band', amulet:'Pendant',
};

export function generateGearItem(slot, rarity) {
  const stats = SLOT_STATS[slot];
  const stat = stats[Math.floor(Math.random() * stats.length)];
  const mult = GEAR_RARITY_MULT[rarity];
  const base = BASE_VALS[stat] || 0.01;
  const val  = parseFloat((base * mult).toFixed(4));
  const prefixes = NAME_PREFIX[rarity];
  const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suf = SLOT_NAME_SUFFIX[slot];
  // Small secondary armor roll on most pieces (skip if armor IS the primary
  // stat already, to avoid double-rolling the same stat on one item).
  let secondary = null;
  if (stat !== 'armor' && Math.random() < SECONDARY_ARMOR_CHANCE) {
    secondary = { stat: 'armor', val: parseFloat((SECONDARY_ARMOR_BASE * mult).toFixed(3)) };
  }
  return {
    id:     `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    slot,
    rarity,
    stat,
    val,
    secondary,
    name:   `${pre} ${suf}`,
  };
}

// Generate a random item for a given time-in-run (later = higher rarity
// chance). `isBoss` was accepted on the caller's drop-request object for a
// while (killEnemy's boss-kill branch, Tidal Shrine) but never actually
// reached this function or affected the roll — wired it up here so a boss
// kill/shrine blessing really does roll better odds than a random mid-run
// drop, instead of being functionally identical to one.
export function rollGearDrop(timeInRun = 0, isBoss = false) {
  const r = Math.random();
  // Later in run → higher rarity chance
  const bossBonus = isBoss ? 0.15 : 0;
  const bonusEpic = Math.min(0.04, timeInRun / 2000) + bossBonus;
  const bonusRare = Math.min(0.12, timeInRun / 800) + bossBonus;
  const bonusMythical = Math.min(0.01, timeInRun / 6000) + (isBoss ? 0.01 : 0);
  let rarity;
  if (r < 0.002 + bonusMythical) rarity = 'mythical';
  else if (r < 0.012 + bonusEpic) rarity = 'legendary';
  else if (r < 0.05 + bonusEpic) rarity = 'epic';
  else if (r < 0.20 + bonusRare) rarity = 'rare';
  else if (r < 0.45) rarity = 'magic';
  else rarity = 'common';
  const slot = GEAR_SLOTS[Math.floor(Math.random() * GEAR_SLOTS.length)];
  return generateGearItem(slot, rarity);
}

// Apply gear stats to buildMetaEffects result
export function applyGearToStats(save, result) {
  const inv = save.gearInventory || [];
  const eq  = save.gearEquipped  || {};
  for (const slot of GEAR_SLOTS) {
    const itemId = eq[slot];
    if (!itemId) continue;
    const item = inv.find(x => x.id === itemId);
    if (!item) continue;
    const { stat, val } = item;
    if (stat === 'maxHp') result.maxHp = (result.maxHp || 0) + val;
    else if (result[stat] !== undefined) result[stat] += val;
    else result[stat] = val;
    if (item.secondary) result.armor = (result.armor || 0) + item.secondary.val;
  }
  return result;
}

// Can merge: 3 items of same slot + same rarity in inventory
export function getMergeGroups(inventory) {
  const groups = {};
  for (const item of inventory) {
    const key = `${item.slot}_${item.rarity}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.values(groups).filter(g => g.length >= 3);
}

// Merge three matching items. This can FAIL — see game/forge.js for why, and
// for the shared odds/catalyst rules that artifacts and runes use too.
//
// On success the three are consumed and replaced by one item of the next
// rarity. On failure two are consumed and one survives, so a bad roll costs
// you material without wiping the attempt entirely.
export function mergeItems(inventory, ids, flux = 0) {
  const items = ids.map(id => inventory.find(x => x.id === id)).filter(Boolean);
  if (items.length < 3) return { inventory, newItem: null, result: null };
  const base = items[0];
  const result = resolveMerge(GEAR_RARITIES, base.rarity, flux);
  if (result.atMax) return { inventory, newItem: null, result };

  const doomed = new Set(ids.slice(0, result.consumed));
  const kept = inventory.filter(x => !doomed.has(x.id));
  if (!result.ok) return { inventory: kept, newItem: null, result };

  const newItem = generateGearItem(base.slot, result.targetRarity);
  return { inventory: kept.concat(newItem), newItem, result };
}
