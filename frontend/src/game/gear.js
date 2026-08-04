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

// Base stat value at LEVEL 1 (before rarity mult).
//
// Pulled down roughly 45% from where these started. A fresh common used to
// arrive close to what a levelled one is worth, which left nothing for
// levelling to do — the item was finished the moment it dropped. Growth now
// comes from levels, and levels come from parts.
const BASE_VALS = {
  maxHp: 3.3, armor: 0.45, dmg: 0.0044, atks: 0.0044, mspd: 0.0044,
  dodge: 0.008, pickup: 0.022, crit: 0.0044, critd: 0.022, xp: 0.008, gold: 0.008,
  headshot: 0.0022, regen: 0.0033, pierce: 0.08, proj: 0.044, area: 0.0033,
};

// ---- Gear levelling --------------------------------------------------------
// Every piece levels 1 -> 10 by feeding it Gear Parts. Level 10 is also the
// gate on merging: an item cannot be pushed up a rarity until it is finished
// at its current one, which stops the forge from being a way to skip the
// whole progression by hoovering up fresh drops.
export const GEAR_MAX_LEVEL = 10;
export const GEAR_LEVEL_STAT_STEP = 0.11;   // +11% of base per level over 1

// Parts to take an item from `lvl` to `lvl + 1`. Deliberately steep at the
// top so finishing a piece is a real commitment rather than a formality.
export function gearLevelCost(lvl, rarity) {
  const rarityIdx = Math.max(0, GEAR_RARITIES.indexOf(rarity));
  return Math.round((2 + lvl * 1.6) * (1 + rarityIdx * 0.35));
}

// A levelled item's effective value. Level 1 is the raw roll; level 10 is
// roughly double it. Kept as a function rather than baked into `val` on
// level-up so an item's printed roll always means the same thing.
export function gearStatValue(item) {
  const lvl = item.level || 1;
  return item.val * (1 + (lvl - 1) * GEAR_LEVEL_STAT_STEP);
}

export function gearSecondaryValue(item) {
  if (!item.secondary) return 0;
  const lvl = item.level || 1;
  return item.secondary.val * (1 + (lvl - 1) * GEAR_LEVEL_STAT_STEP);
}

// Rune sockets. Rings and amulets have always taken runes; a piece that
// rolls a socket at generation time can take one too, which gives an
// otherwise-mediocre drop a reason to be kept.
export function gearHasSocket(item) {
  return !!item && (item.socket === true || item.slot === 'ring' || item.slot === 'amulet');
}
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
  // Higher rarities are more likely to arrive with a rune socket, so a
  // legendary is worth chasing for more than its numbers.
  const rIdx = Math.max(0, GEAR_RARITIES.indexOf(rarity));
  const socket = slot === 'ring' || slot === 'amulet' || Math.random() < 0.06 + rIdx * 0.07;
  return {
    id:     `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    slot,
    rarity,
    stat,
    val,
    secondary,
    level:  1,
    socket,
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
  // Early drops are almost always low rarity, and the good tiers open up as
  // a run goes long. The old curve handed out epics within the first minute,
  // which made the whole rarity ladder read as noise. The floors below are
  // deliberately tight; the `bonus` terms are what carry a long run.
  const bossBonus = isBoss ? 0.14 : 0;
  const bonusEpic = Math.min(0.05, timeInRun / 2400) + bossBonus;
  const bonusRare = Math.min(0.16, timeInRun / 900) + bossBonus;
  const bonusMythical = Math.min(0.008, timeInRun / 9000) + (isBoss ? 0.006 : 0);
  let rarity;
  if (r < 0.0005 + bonusMythical) rarity = 'mythical';
  else if (r < 0.004 + bonusEpic * 0.5) rarity = 'legendary';
  else if (r < 0.022 + bonusEpic) rarity = 'epic';
  else if (r < 0.11 + bonusRare) rarity = 'rare';
  else if (r < 0.38) rarity = 'magic';
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
    // Level scaling is applied here rather than baked into `val`, so the
    // number printed on the item always means "the roll", and the level is
    // always a visible multiplier on top of it.
    const stat = item.stat;
    const val = gearStatValue(item);
    if (stat === 'maxHp') result.maxHp = (result.maxHp || 0) + val;
    else if (result[stat] !== undefined) result[stat] += val;
    else result[stat] = val;
    if (item.secondary) result.armor = (result.armor || 0) + gearSecondaryValue(item);
  }
  return result;
}

// Can merge: 3 items of the same slot and rarity, ALL of them finished at
// level 10. The level gate is what stops the forge from being a shortcut
// past the whole progression — without it you could hoover up three fresh
// commons and skip straight to magic.
export function getMergeGroups(inventory) {
  const groups = {};
  for (const item of inventory) {
    if ((item.level || 1) < GEAR_MAX_LEVEL) continue;
    const key = `${item.slot}_${item.rarity}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.values(groups).filter(g => g.length >= 3);
}

// Everything that is ALMOST mergeable, so the forge can show you what you
// are waiting on rather than silently listing nothing.
export function getPendingMergeGroups(inventory) {
  const groups = {};
  for (const item of inventory) {
    const key = `${item.slot}_${item.rarity}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.values(groups)
    .filter(g => g.length >= 3 && g.filter(i => (i.level || 1) >= GEAR_MAX_LEVEL).length < 3);
}

// Merge three matching items. This can FAIL — see game/forge.js for why, and
// for the shared odds/catalyst rules that artifacts and runes use too.
//
// On success the three are consumed and replaced by one item of the next
// rarity. On failure two are consumed and one survives, so a bad roll costs
// you material without wiping the attempt entirely.
export function mergeItems(inventory, ids, flux = 0, bonus = 0) {
  const items = ids.map(id => inventory.find(x => x.id === id)).filter(Boolean);
  if (items.length < 3) return { inventory, newItem: null, result: null };
  const base = items[0];
  const result = resolveMerge(GEAR_RARITIES, base.rarity, flux, bonus);
  if (result.atMax) return { inventory, newItem: null, result };

  const doomed = new Set(ids.slice(0, result.consumed));
  const kept = inventory.filter(x => !doomed.has(x.id));
  if (!result.ok) return { inventory: kept, newItem: null, result };

  const newItem = generateGearItem(base.slot, result.targetRarity);
  return { inventory: kept.concat(newItem), newItem, result };
}
