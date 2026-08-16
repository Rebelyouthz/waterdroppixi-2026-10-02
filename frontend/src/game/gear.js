// =============================================
// EQUIPMENT / GEAR SYSTEM
// =============================================
import { resolveMerge } from './forge';

export const GEAR_SLOTS = ['helmet','chest','arms','legs','boots','ring','amulet'];
export const GEAR_SLOT_ICONS = {
  helmet:'gear_helmet', chest:'gear_chest', arms:'gear_arms', legs:'gear_legs',
  boots:'gear_boots', ring:'gear_ring', amulet:'gear_amulet',
};
export const GEAR_SLOT_NAMES = {
  helmet:'Helmet', chest:'Chest', arms:'Gloves', legs:'Legs', boots:'Boots', ring:'Ring', amulet:'Amulet'
};

// `mythicplus` sits above mythical as the ceiling of the whole ladder. It is
// deliberately NOT on the drop table — see rollGearDrop. The only way to hold
// one is to finish a mythical at max level and forge it, which makes it the
// one rarity that is earned rather than found.
export const GEAR_RARITIES = ['common','magic','rare','epic','legendary','mythical','mythicplus'];
export const GEAR_RARITY_COLORS = {
  common:    '#9a8fa6',
  magic:     '#4dc4ff',
  rare:      '#ffd166',
  epic:      '#b362ff',
  legendary: '#ff7a1a',
  mythical:  '#ff3146',
  mythicplus:'#ff5ef5',
};
export const GEAR_RARITY_NAMES = {
  common: 'Common', magic: 'Magic', rare: 'Rare', epic: 'Epic',
  legendary: 'Legendary', mythical: 'Mythical', mythicplus: 'Mythic+',
};
export const GEAR_RARITY_MULT = {
  common: 1.0, magic: 1.6, rare: 2.5, epic: 3.8, legendary: 6.0, mythical: 9.5,
  mythicplus: 14.0,
};

// ---- Per-slot gear parts ---------------------------------------------------
// Levelling used to spend one undifferentiated `gearParts` pile, so every item
// competed for the same currency and there was no reason to care WHERE a part
// came from. Each slot now has its own part, which turns "what dropped" into a
// decision about what you can afford to finish.
//
// The generic `gearParts` currency is deliberately kept, not replaced: the base
// builder and base defence already spend it, and it now doubles as a wildcard
// that can top up any slot at a penalty (see gearLevelPayment). Old saves that
// only have the generic pile therefore keep working untouched.
export const PART_SLOTS = GEAR_SLOTS;
export const PART_ICONS = {
  helmet:'gear_helmet', chest:'gear_chest', arms:'gear_arms', legs:'gear_legs', boots:'gear_boots', ring:'gear_ring', amulet:'gear_amulet',
};
export const PART_NAMES = {
  helmet:'Helmet Parts', chest:'Plate Parts', arms:'Grip Parts', legs:'Greave Parts',
  boots:'Tread Parts', ring:'Band Parts', amulet:'Focus Parts',
};
// Two wildcard parts stand in for one slot part. Cheap enough that a hoard of
// generic parts is never dead weight, expensive enough that slot parts stay
// the thing worth chasing.
export const WILDCARD_PART_RATE = 2;

// NB the key is `gearSlotParts`, NOT `parts`. `save.parts` was already taken:
// it is the loose weapon-parts ARRAY (store.js), read with `.filter`/`.length`
// all over the camp UI. Writing an object there would have silently destroyed
// that inventory and thrown the moment anything tried to filter it.
export function slotPartsOf(save, slot) {
  return (save && save.gearSlotParts && save.gearSlotParts[slot]) || 0;
}

// Work out how to pay `cost` parts for `slot`: slot parts first, wildcards for
// the remainder. Returns null when it cannot be paid, so callers get one
// unambiguous "no" instead of having to re-derive affordability themselves.
export function gearLevelPayment(save, slot, cost) {
  const have = slotPartsOf(save, slot);
  const useSlot = Math.min(have, cost);
  const short = cost - useSlot;
  const useWild = short * WILDCARD_PART_RATE;
  if (short > 0 && (save.gearParts || 0) < useWild) return null;
  return { slot, useSlot, useWild: short > 0 ? useWild : 0, cost };
}

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
  return gearSocketCount(item) > 0;
}

// ---- Rune sockets ----------------------------------------------------------
// Sockets used to be a single boolean, and only rings and amulets could
// actually be socketed -- anything else that rolled `socket: true` showed a
// socket pip in the list and then had nowhere to put a rune. Now the count is
// rolled per item and scales with rarity, and every slot can carry runes.
//
// Rarity sets the ODDS, not a flat number, so two legendaries are not
// interchangeable: pulling a 3-socket legendary is its own small jackpot.
// Weights are [P(0), P(1), P(2), P(3)].
export const SOCKET_ODDS = {
  common:     [1.00, 0,    0,    0   ],
  magic:      [0.85, 0.15, 0,    0   ],
  rare:       [0.45, 0.55, 0,    0   ],
  epic:       [0.10, 0.60, 0.30, 0   ],
  legendary:  [0,    0.30, 0.55, 0.15],
  mythical:   [0,    0.05, 0.45, 0.50],
  mythicplus: [0,    0,    0.20, 0.80],
};
export const GEAR_MAX_SOCKETS = 3;

export function rollSocketCount(rarity, rand = Math.random) {
  const odds = SOCKET_ODDS[rarity] || SOCKET_ODDS.common;
  let r = rand();
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return i;
  }
  return 0;
}

// Legacy items stored a boolean `socket` and had no count. Rather than
// migrating the save, read through: an old item with socket true is worth one
// socket, and rings/amulets keep the single socket they always implicitly had.
export function gearSocketCount(item) {
  if (!item) return 0;
  if (typeof item.sockets === 'number') return item.sockets;
  if (item.socket === true) return 1;
  return item.slot === 'ring' || item.slot === 'amulet' ? 1 : 0;
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

// ---- Base types ------------------------------------------------------------
// Every slot used to produce exactly one shape, so the only thing separating
// two helmets was the prefix and the number. Each slot now has three base
// types, and the base type biases the roll: `weight` skews which primary stat
// comes up, and `mult` trades raw stat size against that bias. A Bulwark plate
// is reliably defensive; a Duelist plate is a gamble that pays more.
//
// This is generation-side only -- an item still stores a plain `stat`/`val`,
// so nothing downstream needs to know base types exist.
export const GEAR_BASES = {
  helmet: [
    { id: 'visor',     name: 'Visor',      icon: 'gbVisor',     mult: 1.00, weight: { crit: 3, headshot: 3 } },
    { id: 'greathelm', name: 'Greathelm',  icon: 'gbGreathelm', mult: 1.12, weight: { maxHp: 4, armor: 3 } },
    { id: 'crown',     name: 'Crown',      icon: 'gbCrown',     mult: 0.94, weight: { crit: 2, headshot: 4 } },
    { id: 'diveHood',  name: 'Dive Hood',  icon: 'gbDiveHood',  mult: 1.05, weight: { maxHp: 5 } },
    { id: 'circlet',   name: 'Circlet',    icon: 'gbCirclet',   mult: 0.90, weight: { headshot: 5, crit: 3 } },
  ],
  chest: [
    { id: 'bulwark',   name: 'Bulwark',    icon: 'gbBulwark',   mult: 1.14, weight: { armor: 5, maxHp: 3 } },
    { id: 'duelist',   name: 'Duelist',    icon: 'gbDuelist',   mult: 0.92, weight: { regen: 4, maxHp: 2 } },
    { id: 'carapace',  name: 'Carapace',   icon: 'gbCarapace',  mult: 1.05, weight: { maxHp: 5, armor: 2 } },
    { id: 'drownvest', name: 'Drown Vest', icon: 'gbDrownVest', mult: 0.97, weight: { regen: 5 } },
    { id: 'aegis',     name: 'Aegis',      icon: 'gbAegis',     mult: 1.20, weight: { armor: 6 } },
  ],
  arms: [
    { id: 'gauntlet',  name: 'Gauntlet',   icon: 'gbGauntlet',  mult: 1.08, weight: { dmg: 4, pierce: 2 } },
    { id: 'wraps',     name: 'Wraps',      icon: 'gbWraps',     mult: 0.95, weight: { atks: 5 } },
    { id: 'claws',     name: 'Claws',      icon: 'gbClaws',     mult: 1.02, weight: { pierce: 4, dmg: 2 } },
    { id: 'pistons',   name: 'Pistons',    icon: 'gbPistons',   mult: 1.12, weight: { dmg: 5 } },
    { id: 'flowcuffs', name: 'Flowcuffs',  icon: 'gbFlowcuffs', mult: 0.93, weight: { atks: 6 } },
  ],
  legs: [
    { id: 'greaves',   name: 'Greaves',    icon: 'gbGreaves',   mult: 1.10, weight: { armor: 4 } },
    { id: 'striders',  name: 'Striders',   icon: 'gbStriders',  mult: 0.96, weight: { mspd: 5 } },
    { id: 'phase',     name: 'Phaseplate', icon: 'gbPhase',     mult: 1.00, weight: { dodge: 5 } },
    { id: 'tideguard', name: 'Tideguard',  icon: 'gbTideguard', mult: 1.06, weight: { armor: 5, mspd: 2 } },
    { id: 'slipleg',   name: 'Slipplate',  icon: 'gbSlipleg',   mult: 0.91, weight: { dodge: 6 } },
  ],
  boots: [
    { id: 'treads',    name: 'Treads',     icon: 'gbTreads',    mult: 1.00, weight: { mspd: 4 } },
    { id: 'skimmers',  name: 'Skimmers',   icon: 'gbSkimmers',  mult: 0.97, weight: { dodge: 4, mspd: 2 } },
    { id: 'magnets',   name: 'Magboots',   icon: 'gbMagboots',  mult: 1.06, weight: { pickup: 5 } },
    { id: 'finblades', name: 'Finblades',  icon: 'gbFinblades', mult: 0.94, weight: { mspd: 6 } },
    { id: 'anchors',   name: 'Anchorshoes',icon: 'gbAnchors',   mult: 1.14, weight: { pickup: 6 } },
  ],
  ring: [
    { id: 'band',      name: 'Band',       icon: 'gbBand',      mult: 1.00, weight: { crit: 4 } },
    { id: 'signet',    name: 'Signet',     icon: 'gbSignet',    mult: 1.08, weight: { critd: 5 } },
    { id: 'loop',      name: 'Loop',       icon: 'gbLoop',      mult: 0.95, weight: { proj: 5 } },
    { id: 'coil',      name: 'Coil',       icon: 'gbCoil',      mult: 1.04, weight: { proj: 6 } },
    { id: 'seal',      name: 'Seal',       icon: 'gbSeal',      mult: 1.11, weight: { critd: 6, crit: 2 } },
  ],
  amulet: [
    { id: 'pendant',   name: 'Pendant',    icon: 'gbPendant',   mult: 1.00, weight: { xp: 4 } },
    { id: 'sigil',     name: 'Sigil',      icon: 'gbSigil',     mult: 1.04, weight: { gold: 5 } },
    { id: 'orb',       name: 'Orb',        icon: 'gbOrb',       mult: 1.10, weight: { area: 5 } },
    { id: 'tear',      name: 'Tear',       icon: 'gbTear',      mult: 0.93, weight: { xp: 6 } },
    { id: 'compass',   name: 'Compass',    icon: 'gbCompass',   mult: 1.07, weight: { gold: 6 } },
  ],
};

// Flat id -> base lookup, so a stored item can find its base type without
// knowing its slot.
export const GEAR_BASE_INDEX = Object.values(GEAR_BASES)
  .flat()
  .reduce((acc, b) => { acc[b.id] = b; return acc; }, {});

// Weighted pick over a slot's stat pool. Stats not named in `weight` still get
// a baseline chance of 1, so a base type biases the roll without ever locking
// a stat out entirely.
function pickStat(slot, base, rand) {
  const pool = SLOT_STATS[slot];
  const w = (base && base.weight) || {};
  const weights = pool.map((s) => w[s] || 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function generateGearItem(slot, rarity, rand = Math.random) {
  const bases = GEAR_BASES[slot] || [];
  const baseType = bases.length ? bases[Math.floor(rand() * bases.length)] : null;
  const stat = pickStat(slot, baseType, rand);
  const mult = GEAR_RARITY_MULT[rarity] * (baseType ? baseType.mult : 1);
  const base = BASE_VALS[stat] || 0.01;
  const val  = parseFloat((base * mult).toFixed(4));
  const prefixes = NAME_PREFIX[rarity];
  const pre = prefixes[Math.floor(rand() * prefixes.length)];
  // The base type supplies the noun when there is one, so the name says what
  // the item actually is ("Etched Magboots") rather than a generic slot word.
  const suf = baseType ? baseType.name : SLOT_NAME_SUFFIX[slot];
  // Small secondary armor roll on most pieces (skip if armor IS the primary
  // stat already, to avoid double-rolling the same stat on one item).
  let secondary = null;
  if (stat !== 'armor' && rand() < SECONDARY_ARMOR_CHANCE) {
    secondary = { stat: 'armor', val: parseFloat((SECONDARY_ARMOR_BASE * mult).toFixed(3)) };
  }
  // Higher rarities are more likely to arrive with a rune socket, so a
  // legendary is worth chasing for more than its numbers.
  // Rings and amulets are the rune-bearing slots by tradition, so they get a
  // floor of one socket regardless of what the rarity table rolls.
  const rolled = rollSocketCount(rarity, rand);
  const sockets = (slot === 'ring' || slot === 'amulet') ? Math.max(1, rolled) : rolled;
  return {
    id:     `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    slot,
    rarity,
    stat,
    val,
    secondary,
    level:  1,
    sockets,
    socket: sockets > 0,   // kept so older code paths reading the boolean still agree
    base:   baseType ? baseType.id : null,
    // Which gear set this piece belongs to. Rolled flat rather than weighted
    // by slot: a set that could only ever appear on three slots could never
    // reach its 4-piece tier.
    set:    GEAR_SET_IDS[Math.floor(rand() * GEAR_SET_IDS.length)],
    name:   `${pre} ${suf}`,
  };
}

// Generate a random item for a given time-in-run (later = higher rarity
// chance). `isBoss` was accepted on the caller's drop-request object for a
// while (killEnemy's boss-kill branch, Tidal Shrine) but never actually
// reached this function or affected the roll — wired it up here so a boss
// kill/shrine blessing really does roll better odds than a random mid-run
// drop, instead of being functionally identical to one.
// How often a gear drop is even ATTEMPTED. Equipment used to rain down from
// ordinary kills, which made the inventory a chore and made a boss feel like
// nothing special. Ordinary drops are now rare; a boss kill is where equipment
// actually comes from, and the trickle in between is what parts are for.
//
// `rollGearDrop` decides the rarity once a drop happens; this decides whether
// one happens at all, so callers get a single place to ask.
export const GEAR_DROP_CHANCE_NORMAL = 0.5; // multiplier on the caller's own rate: halved
export function gearDropHappens(isBoss, rand = Math.random) {
  if (isBoss) return true;          // a boss always pays equipment
  return rand() < 0.06;             // otherwise genuinely uncommon
}

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

// ---- Parts drops -----------------------------------------------------------
// The trickle that replaces the old flood of equipment. Every source in the
// game -- runs, the clicker, Star Atlas, exploration, the card game -- calls
// this, so parts arrive from wherever the player actually spends time instead
// of only from combat.
//
// `scale` lets a source tune generosity without inventing its own maths: a long
// Star Atlas stage passes a bigger scale than a single clicker milestone.
export function rollPartsDrop(scale = 1, rand = Math.random) {
  const slot = PART_SLOTS[Math.floor(rand() * PART_SLOTS.length)];
  const amount = Math.max(1, Math.round((1 + rand() * 2) * scale));
  return { slot, amount };
}

// Fold a parts drop into a save. Kept here rather than in each screen so the
// shape of `save.parts` is defined in exactly one place.
export function addParts(save, slot, amount) {
  const parts = { ...(save.gearSlotParts || {}) };
  parts[slot] = (parts[slot] || 0) + amount;
  return parts;
}

// ---- Gear sets -------------------------------------------------------------
// The equipment-side answer to weapon synergies. Same idea, different shape:
// weapons pair, gear accumulates. A set pays at 2 pieces and again at 4, so
// a half-committed set is still worth something and a full one is worth
// deliberately turning down a better single item for.
//
// Set bonuses use the same stat names buildMetaEffects already understands,
// so nothing new has to be plumbed through to the engine.
export const GEAR_SETS = {
  tidewalker: {
    id: 'tidewalker', name: 'Tidewalker', icon: 'tidalWave', accent: '#4fd8ff',
    t2: { label: '+8% move speed', apply: (r) => { r.mspd += 0.08; } },
    t4: { label: '+8% dodge, +15% pickup range', apply: (r) => { r.dodge += 0.08; r.pickup += 0.15; } },
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', icon: 'ui_shield', accent: '#9fb3c8',
    t2: { label: '+22 max HP', apply: (r) => { r.maxHp += 22; } },
    t4: { label: '+7 armour, +0.4 regen', apply: (r) => { r.armor += 7; r.regen += 0.4; } },
  },
  marksman: {
    id: 'marksman', name: "Marksman's Kit", icon: 'ui_loadout', accent: '#ffd166',
    t2: { label: '+6% crit', apply: (r) => { r.crit += 0.06; } },
    t4: { label: '+30% crit damage, +8% headshot', apply: (r) => { r.critd += 0.30; r.headshot += 0.08; } },
  },
  prospector: {
    id: 'prospector', name: "Prospector's Rig", icon: 'ui_pickaxe', accent: '#c8f0a0',
    t2: { label: '+12% gold', apply: (r) => { r.gold += 0.12; } },
    t4: { label: '+14% XP, +1 luck', apply: (r) => { r.xp += 0.14; r.luck += 1; } },
  },
  voidtouched: {
    id: 'voidtouched', name: 'Voidtouched', icon: 'rune', accent: '#b362ff',
    t2: { label: '+7% damage', apply: (r) => { r.dmg += 0.07; } },
    t4: { label: '+18% boss damage, +1 pierce', apply: (r) => { r.bossDmg += 0.18; r.pierce += 1; } },
  },
};
export const GEAR_SET_IDS = Object.keys(GEAR_SETS);

// Which set a piece belongs to. New drops carry `set` explicitly. Items that
// predate the system get one derived from their id, which is stable (the
// same item always resolves to the same set) and spreads evenly — the
// alternative was leaving every existing inventory outside the system, which
// would have made it invisible to exactly the players who have the most gear.
export function itemSet(item) {
  if (!item) return null;
  if (item.set) return item.set;
  let h = 0;
  const s = String(item.id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return GEAR_SET_IDS[Math.abs(h) % GEAR_SET_IDS.length];
}

// How many equipped pieces each set has. Only equipped pieces count —
// a set bonus you get from the stash would make the stash the build.
export function equippedSetCounts(save) {
  const inv = save.gearInventory || [];
  const eq = save.gearEquipped || {};
  const counts = {};
  for (const slot of GEAR_SLOTS) {
    const item = inv.find(x => x.id === eq[slot]);
    if (!item) continue;
    const sid = itemSet(item);
    counts[sid] = (counts[sid] || 0) + 1;
  }
  return counts;
}

// [{ set, count, tiers: ['t2','t4'] }] for everything currently paying out.
export function activeGearSets(save) {
  const counts = equippedSetCounts(save);
  const out = [];
  for (const sid of Object.keys(counts)) {
    const set = GEAR_SETS[sid];
    if (!set) continue;
    const count = counts[sid];
    const tiers = [];
    if (count >= 2) tiers.push('t2');
    if (count >= 4) tiers.push('t4');
    if (tiers.length) out.push({ set, count, tiers });
  }
  return out;
}

export function applyGearSetsToStats(save, result) {
  for (const { set, tiers } of activeGearSets(save)) {
    for (const t of tiers) set[t].apply(result);
  }
  return result;
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
  applyGearSetsToStats(save, result);
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
