// =============================================
// EQUIPMENT / GEAR SYSTEM
// =============================================

export const GEAR_SLOTS = ['helmet','chest','arms','legs','boots','ring','amulet'];
export const GEAR_SLOT_ICONS = {
  helmet:'🪖', chest:'🎽', arms:'🥊', legs:'👖', boots:'🥾', ring:'💍', amulet:'📿'
};
export const GEAR_SLOT_NAMES = {
  helmet:'Helmet', chest:'Chest', arms:'Gloves', legs:'Legs', boots:'Boots', ring:'Ring', amulet:'Amulet'
};

export const GEAR_RARITIES = ['common','magic','rare','epic','legendary'];
export const GEAR_RARITY_COLORS = {
  common:    '#9a8fa6',
  magic:     '#4dc4ff',
  rare:      '#ffd166',
  epic:      '#b362ff',
  legendary: '#ff7a1a',
};
export const GEAR_RARITY_MULT = {
  common: 1.0, magic: 1.6, rare: 2.5, epic: 3.8, legendary: 6.0
};

// Primary stat by slot
const SLOT_STATS = {
  helmet:  ['maxHp', 'armor'],
  chest:   ['maxHp', 'armor'],
  arms:    ['dmg',   'atks'],
  legs:    ['mspd',  'dodge'],
  boots:   ['mspd',  'pickup'],
  ring:    ['crit',  'critd'],
  amulet:  ['xp',    'gold'],
};

// Base stat value (before rarity mult)
const BASE_VALS = {
  maxHp: 6, armor: 0.8, dmg: 0.008, atks: 0.008, mspd: 0.008,
  dodge: 0.015, pickup: 0.04, crit: 0.008, critd: 0.04, xp: 0.015, gold: 0.015,
};

const NAME_PREFIX = {
  common:    ['Cracked','Worn','Crude'],
  magic:     ['Shimmering','Refined','Balanced'],
  rare:      ['Enchanted','Pulsing','Etched'],
  epic:      ['Voidforged','Ancient','Resonant'],
  legendary: ['Annunaki','Celestial','Eternal'],
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
  return {
    id:     `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    slot,
    rarity,
    stat,
    val,
    name:   `${pre} ${suf}`,
  };
}

// Generate a random item for a given time-in-run (later = higher rarity chance)
export function rollGearDrop(timeInRun = 0) {
  const r = Math.random();
  // Later in run → higher rarity chance
  const bonusEpic = Math.min(0.04, timeInRun / 2000);
  const bonusRare = Math.min(0.12, timeInRun / 800);
  let rarity;
  if (r < 0.01 + bonusEpic) rarity = 'legendary';
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

export function mergeItems(inventory, ids) {
  // Remove 3 items by IDs, return new item with +1 rarity
  const items = ids.map(id => inventory.find(x => x.id === id)).filter(Boolean);
  if (items.length < 3) return { inventory, newItem: null };
  const base = items[0];
  const nextRarity = GEAR_RARITIES[GEAR_RARITIES.indexOf(base.rarity) + 1] || 'legendary';
  const newItem = generateGearItem(base.slot, nextRarity);
  const newIds = new Set(ids.slice(0, 3));
  return {
    inventory: inventory.filter(x => !newIds.has(x.id)).concat(newItem),
    newItem,
  };
}
