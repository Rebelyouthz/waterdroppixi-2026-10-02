// =============================================
// ARTIFACT SYSTEM — rarity-based accessories, generic slots (not body-part
// typed like gear.js). Higher rarity = bigger positive roll, with a rising
// chance of ALSO rolling a drawback stat — the classic "big number, but it
// costs you something" unique-item tradeoff. Mirrors gear.js's shape/
// conventions so the two systems read as one family.
// =============================================

export const ARTIFACT_SLOT_COUNT = 3;

export const ARTIFACT_RARITIES = ['common', 'magic', 'rare', 'epic', 'legendary', 'mythical'];
export const ARTIFACT_RARITY_COLORS = {
  common: '#9a8fa6', magic: '#4dc4ff', rare: '#ffd166',
  epic: '#b362ff', legendary: '#ff7a1a', mythical: '#ff3146',
};
// Bigger swings than gear (artifacts are meant to be build-defining, not a
// small stat stick) and a climbing drawback chance/size at higher rarity.
const RARITY_TUNING = {
  common:    { mult: 1.0, drawbackChance: 0.00 },
  magic:     { mult: 1.8, drawbackChance: 0.15 },
  rare:      { mult: 2.8, drawbackChance: 0.30 },
  epic:      { mult: 4.2, drawbackChance: 0.45 },
  legendary: { mult: 6.5, drawbackChance: 0.60 },
  mythical:  { mult: 10.0, drawbackChance: 0.75 },
};

// NOTE: stat keys here match buildMetaEffects()'s meta-key naming
// convention in GameScreen.jsx (dmg/atks/mspd/critd/area/xp/gold/pickup/
// pierce/proj), NOT the run.stats runtime names (damageMult/fireRateMult/
// etc.) — engine.js's constructor is what translates meta.dmg into
// run.stats.damageMult, same as every other meta/gear/pet source already
// wired into buildMetaEffects. Using the run.stats names here would silently
// no-op since engine.js never reads a meta key by that name.
const POSITIVE_POOL = [
  { stat: 'dmg',    base: 0.006, name: 'Might' },
  { stat: 'atks',   base: 0.006, name: 'Haste' },
  { stat: 'mspd',   base: 0.005, name: 'Swiftness' },
  { stat: 'critd',  base: 0.01,  name: 'Ferocity' },
  { stat: 'crit',   base: 0.004, name: 'Precision' },
  { stat: 'area',   base: 0.006, name: 'Reach' },
  { stat: 'armor',  base: 0.3,   name: 'Warding' },
  { stat: 'maxHp',  base: 2.5,   name: 'Vitality' },
  { stat: 'regen',  base: 0.008, name: 'Renewal' },
  { stat: 'xp',     base: 0.006, name: 'Insight' },
  { stat: 'gold',   base: 0.006, name: 'Fortune' },
  { stat: 'pickup', base: 0.01,  name: 'Gravity' },
  { stat: 'pierce', base: 0.2,   name: 'Piercing' },
  { stat: 'proj',   base: 0.12,  name: 'Barrage' },
  { stat: 'elementalDmg', base: 0.02, name: 'Elemental Attunement' },
  // Three axes artifacts could not previously roll at all. Each is read
  // additively by the engine (dodge -> engine.js dodge check, luck -> rarity
  // rolls, headshot -> the instant-kill check on non-boss enemies), so they
  // slot into the existing `result[stat] += val` application untouched.
  //
  // NB: deliberately NOT projSpeedMult / projRangeMult, tempting as they are.
  // Those are MULTIPLIERS defaulting to 1, and this pool is applied additively
  // onto an undefined key -- an artifact rolling 0.05 would set the multiplier
  // to 0.05 and cut projectile speed to a twentieth rather than adding 5%.
  { stat: 'dodge',    base: 0.006, name: 'Evasion' },
  { stat: 'luck',     base: 0.05,  name: 'Providence' },
  { stat: 'headshot', base: 0.003, name: 'Marksmanship' },
];
// Drawbacks skew toward the OPPOSITE axis of common positives so a roll
// feels like a real tradeoff (e.g. hits harder but frailer), not just a
// smaller version of the same stat.
const NEGATIVE_POOL = [
  { stat: 'maxHp',  base: -3.5,   name: 'Frailty' },
  { stat: 'armor',  base: -0.4,   name: 'Exposed' },
  { stat: 'mspd',   base: -0.015, name: 'Burden' },
  { stat: 'atks',   base: -0.02,  name: 'Sluggish' },
  { stat: 'crit',   base: -0.01,  name: 'Clumsy' },
  { stat: 'regen',  base: -0.006, name: 'Withering' },
];

function rollOne(pool, rarityMult) {
  const p = pool[Math.floor(Math.random() * pool.length)];
  const val = Math.round(p.base * rarityMult * 1000) / 1000;
  return { stat: p.stat, val, label: p.name };
}

export function generateArtifact(rarity) {
  const tune = RARITY_TUNING[rarity] || RARITY_TUNING.common;
  const stats = [rollOne(POSITIVE_POOL, tune.mult)];
  let hasDrawback = false;
  if (Math.random() < tune.drawbackChance) {
    stats.push(rollOne(NEGATIVE_POOL, tune.mult));
    hasDrawback = true;
  }
  // A second, smaller positive roll on higher rarities so legendaries/
  // mythicals read as genuinely powerful, not just "common + a drawback".
  if ((rarity === 'legendary' || rarity === 'mythical') && Math.random() < 0.5) {
    const second = rollOne(POSITIVE_POOL, tune.mult * 0.5);
    if (!stats.some(s => s.stat === second.stat)) stats.push(second);
  }
  const flavor = hasDrawback ? 'Cursed' : 'Blessed';
  return {
    id: `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    rarity,
    name: `${flavor} ${stats[0].label} ${hasDrawback ? 'Relic' : 'Charm'}`,
    stats,
  };
}

// Later runs / deeper gacha pulls skew toward higher rarity, same shape as
// gear.js's rollGearDrop so the two feel like one family of tables.
export function rollArtifact(luckBonus = 0) {
  const r = Math.random() - luckBonus * 0.02;
  let rarity;
  if (r < 0.01) rarity = 'mythical';
  else if (r < 0.04) rarity = 'legendary';
  else if (r < 0.12) rarity = 'epic';
  else if (r < 0.30) rarity = 'rare';
  else if (r < 0.55) rarity = 'magic';
  else rarity = 'common';
  return generateArtifact(rarity);
}

export function applyArtifactsToStats(save, result) {
  const inv = save.artifactInventory || [];
  const eq = save.artifactEquipped || {};
  for (let slotIdx = 0; slotIdx < ARTIFACT_SLOT_COUNT; slotIdx++) {
    const itemId = eq[slotIdx];
    if (!itemId) continue;
    const item = inv.find(x => x.id === itemId);
    if (!item) continue;
    for (const { stat, val } of item.stats) {
      if (stat === 'maxHp') result.maxHp = (result.maxHp || 0) + val;
      else if (result[stat] !== undefined) result[stat] += val;
      else result[stat] = val;
    }
  }
  return result;
}
