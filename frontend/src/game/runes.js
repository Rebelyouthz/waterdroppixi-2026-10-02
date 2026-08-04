// =============================================
// RUNE SYSTEM — single-stat socketable items for manual weapons and the
// two "accessory" gear slots (ring/amulet). Mirrors gear.js/artifacts.js's
// shape and merge conventions (3-of-a-kind, chance-based — see forge.js)
// so all three item systems feel like one family. Obtained from Star
// Raid's "Rune Run" mode (see StarRaidScreen.jsx) instead of the Gacha
// Machine, which is Artifact-only.
// =============================================
import { resolveMerge } from './forge';

export const RUNE_RARITIES = ['common', 'magic', 'rare', 'epic', 'legendary', 'mythical'];
export const RUNE_RARITY_COLORS = {
  common: '#9a8fa6', magic: '#4dc4ff', rare: '#ffd166',
  epic: '#b362ff', legendary: '#ff7a1a', mythical: '#ff3146',
};
const RARITY_MULT = { common: 1.0, magic: 1.7, rare: 2.6, epic: 4.0, legendary: 6.2, mythical: 9.8 };

// Combat-flavored stats, since runes only ever socket into a weapon or an
// accessory — kept distinct from artifacts' broader stat pool so runes
// read as "weapon/combat tuning" specifically.
const RUNE_POOL = [
  { stat: 'dmg',          base: 0.01,  name: 'Rune of Might',     icon: '🔺' },
  { stat: 'atks',         base: 0.01,  name: 'Rune of Haste',     icon: '🔻' },
  { stat: 'crit',         base: 0.006, name: 'Rune of Precision', icon: '◆' },
  { stat: 'critd',        base: 0.015, name: 'Rune of Ferocity',  icon: '✦' },
  { stat: 'pierce',       base: 0.3,   name: 'Rune of Piercing',  icon: '➰' },
  { stat: 'proj',         base: 0.15,  name: 'Rune of Barrage',   icon: '❖' },
  { stat: 'elementalDmg', base: 0.015, name: 'Rune of Elements',  icon: '🔥' },
  { stat: 'armor',        base: 0.4,   name: 'Rune of Warding',   icon: '🛡' },
];
const NAME_SUFFIX = {
  common: 'Chip', magic: 'Shard', rare: 'Stone', epic: 'Crystal', legendary: 'Core', mythical: 'Heart',
};

export function generateRune(rarity) {
  const p = RUNE_POOL[Math.floor(Math.random() * RUNE_POOL.length)];
  const mult = RARITY_MULT[rarity];
  const val = Math.round(p.base * mult * 1000) / 1000;
  return {
    id: `rune_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    rarity, stat: p.stat, val, icon: p.icon,
    name: `${p.name} ${NAME_SUFFIX[rarity]}`,
  };
}

export function rollRune(luckBonus = 0) {
  const r = Math.random() - luckBonus * 0.02;
  let rarity;
  if (r < 0.008) rarity = 'mythical';
  else if (r < 0.035) rarity = 'legendary';
  else if (r < 0.11) rarity = 'epic';
  else if (r < 0.28) rarity = 'rare';
  else if (r < 0.55) rarity = 'magic';
  else rarity = 'common';
  return generateRune(rarity);
}

// 3 of the same rarity+stat -> 1 of the next rarity (same shape as
// gear.js's getMergeGroups/mergeItems).
export function getRuneMergeGroups(inventory) {
  const groups = {};
  for (const r of inventory) {
    const key = `${r.stat}_${r.rarity}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return Object.values(groups).filter(g => g.length >= 3);
}
// Chance-based, same rules as gear — see game/forge.js. Success keeps the
// rune's flavour and only bumps its rarity; failure eats two of the three.
export function mergeRunes(inventory, ids, flux = 0, bonus = 0) {
  const items = ids.map(id => inventory.find(x => x.id === id)).filter(Boolean);
  if (items.length < 3) return { inventory, newItem: null, result: null };
  const base = items[0];
  const result = resolveMerge(RUNE_RARITIES, base.rarity, flux, bonus);
  if (result.atMax) return { inventory, newItem: null, result };

  const doomed = new Set(ids.slice(0, result.consumed));
  const kept = inventory.filter(x => !doomed.has(x.id));
  if (!result.ok) return { inventory: kept, newItem: null, result };

  const newItem = generateRune(result.targetRarity);
  newItem.stat = base.stat; newItem.icon = base.icon; // keep the same flavor, just bump rarity
  const mult = RARITY_MULT[result.targetRarity];
  const poolDef = RUNE_POOL.find(p => p.stat === base.stat);
  newItem.val = Math.round((poolDef?.base || 0.01) * mult * 1000) / 1000;
  newItem.name = `${poolDef?.name || 'Rune'} ${NAME_SUFFIX[result.targetRarity]}`;
  return { inventory: kept.concat(newItem), newItem, result };
}

// gearRunes: { ring: runeId, amulet: runeId } — only these 2 "accessory"
// slots take runes, per spec ("några equipment", not all of them).
export const RUNE_GEAR_SLOTS = ['ring', 'amulet'];

export function applyRunesToStats(save, result) {
  const gearRunes = save.gearRunes || {};
  const weaponRunes = save.weaponRunes || {};
  const runeInv = save.runeInventory || [];
  const applyOne = (runeId) => {
    if (!runeId) return;
    const rune = runeInv.find(r => r.id === runeId);
    if (!rune) return;
    if (rune.stat === 'maxHp') result.maxHp = (result.maxHp || 0) + rune.val;
    else if (result[rune.stat] !== undefined) result[rune.stat] += rune.val;
    else result[rune.stat] = rune.val;
  };
  for (const slot of RUNE_GEAR_SLOTS) applyOne(gearRunes[slot]);
  for (const wid of Object.keys(weaponRunes)) applyOne(weaponRunes[wid]);
  return result;
}
