// Waterdrop Survivor — All game data: weapons, enemies, level-up cards, meta upgrades.

export const RARITY = {
  common:    { name: 'COMMON',    weight: 60,   color: '#9a8fa6', cls: 'r-common',    mult: 1.0 },
  uncommon:  { name: 'UNCOMMON',  weight: 28,   color: '#4dff91', cls: 'r-uncommon',  mult: 1.6 },
  rare:      { name: 'RARE',      weight: 9,    color: '#4dc4ff', cls: 'r-rare',      mult: 2.4 },
  epic:      { name: 'EPIC',      weight: 2.5,  color: '#b362ff', cls: 'r-epic',      mult: 3.6 },
  legendary: { name: 'LEGENDARY', weight: 0.5,  color: '#ff7a1a', cls: 'r-legendary', mult: 5.0 },
  mythical:  { name: 'MYTHICAL',  weight: 0.05, color: '#ff3146', cls: 'r-mythical',  mult: 7.5 },
};

export function rollRarity(luck = 0) {
  // luck shifts roll up
  const keys = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];
  const weights = keys.map((k, i) => RARITY[k].weight * (1 + luck * i * 0.5));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= weights[i];
    if (r <= 0) return keys[i];
  }
  return 'common';
}

// ---------- WEAPONS ----------
// type: 'manual' (mouse aim) or 'auto' (auto-aim nearest)
// behaviour: 'projectile' | 'orbit' | 'aura' | 'beam' | 'aoe'
export const WEAPONS = {
  // The only true melee weapon. No magazine, no reload, no projectile — it
  // trades all reach for damage, and on a killing blow it cuts the enemy in
  // half. Its 'melee' behaviour is what makes its wounds read as slashes
  // rather than bullet holes (see _addImpactMark).
  katana: {
    id: 'katana',
    name: 'Tidecutter Katana',
    icon: '🗡',
    type: 'manual',
    behaviour: 'melee',
    desc: 'A single clean arc. Kills split the body in two.',
    base: {
      damage: 88,
      fireRate: 2.1,      // swings per second
      area: 96,           // reach, in world px
      knockback: 40,
      crit: 0.16,
      color: '#dff4ff',
      sound: 'shoot',
    },
    levelUps: [
      { stat: 'damage', mult: 1.20 },
      { stat: 'fireRate', mult: 1.12 },
      { stat: 'area', mult: 1.14 },
      { stat: 'crit', add: 0.05 },
      { stat: 'damage', mult: 1.22 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.12 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'crit', add: 0.06 },
    ],
  },

  hydropistol: {
    id: 'hydropistol',
    name: 'Hydro Pistol',
    icon: '💧',
    type: 'manual',
    behaviour: 'projectile',
    desc: 'Manual-aim sidearm. Crisp, snappy, deadly.',
    base: {
      damage: 18,
      fireRate: 4.0, // shots per second
      projSpeed: 880,
      projSize: 6,
      magazine: 12,
      reloadTime: 1.0,
      pierce: 0,
      knockback: 90,
      spread: 0.02,
      crit: 0.08,
      color: '#4dc4ff',
      sound: 'shoot',
    },
    levelUps: [
      { stat: 'damage', mult: 1.18 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'projectiles', add: 1 },
      { stat: 'magazine', add: 4 },
      { stat: 'pierce', add: 1 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'projSpeed', mult: 1.2 },
      { stat: 'crit', add: 0.10 },
      // final,
      { stat: 'damage', mult: 1.4, evolve: true }
    ],
  },
  bloodscythe: {
    id: 'bloodscythe',
    name: 'Blood Scythe',
    icon: '☠️',
    type: 'auto',
    behaviour: 'aoe',
    desc: 'Spinning scythe that auto-cuts surrounding foes.',
    base: { damage: 24, fireRate: 1.6, range: 110, area: 140, knockback: 40, crit: 0.05, color: '#b51d28' },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'area', mult: 1.15 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'area', mult: 1.2 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  runebolts: {
    id: 'runebolts',
    name: 'Rune Bolts',
    icon: '⚡',
    type: 'auto',
    behaviour: 'projectile',
    desc: 'Homing cyan bolts that seek the nearest foe.',
    // projSize 5, was 8. Runebolts is one of the two weapons the tutorial hands
    // you, it fires 2.8 times a second on its own, and at size 8 — larger than
    // the manual pistol's 6 — those constant slow blobs were the biggest thing
    // on a beginner's screen while doing the least damage of anything on it.
    // A rune bolt should read as a small fast mote, not as a lobbed rock.
    base: { damage: 12, fireRate: 2.8, projSpeed: 620, projSize: 5, projectiles: 1, pierce: 0, homing: 0.08, color: '#4dffd4' },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'homing', mult: 1.5 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.25 },
      { stat: 'pierce', add: 1 },
      { stat: 'damage', mult: 1.20 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  emberOrbs: {
    id: 'emberOrbs',
    name: 'Ember Orbs',
    icon: '🔥',
    type: 'auto',
    behaviour: 'orbit',
    desc: 'Burning orbs orbit the waterdrop, igniting all in reach.',
    base: { damage: 14, orbitCount: 2, orbitRadius: 90, orbitSpeed: 2.2, area: 26, color: '#ff7a1a' },
    levelUps: [
      { stat: 'orbitCount', add: 1 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'projectiles', add: 1 },
      { stat: 'orbitRadius', mult: 1.15 },
      { stat: 'orbitCount', add: 1 },
      { stat: 'orbitSpeed', mult: 1.2 },
      { stat: 'damage', mult: 1.4 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'orbitCount', add: 1, evolve: true }
    ],
  },
  shockwave: {
    id: 'shockwave',
    name: 'Annunaki Pulse',
    icon: '💥',
    type: 'auto',
    behaviour: 'aoe',
    desc: 'Pulse of eldritch energy blasts foes around the player.',
    base: { damage: 30, fireRate: 0.6, range: 0, area: 180, knockback: 220, color: '#b362ff' },
    levelUps: [
      { stat: 'area', mult: 1.2 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'damage', mult: 1.4 },
      { stat: 'area', mult: 1.25 },
      { stat: 'fireRate', mult: 1.25 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.6, evolve: true }
    ],
  },
  voidBeam: {
    id: 'voidBeam',
    name: 'Void Beam',
    icon: '🔮',
    type: 'auto',
    behaviour: 'beam',
    desc: 'Tethers a beam to the closest target, draining life.',
    base: { damage: 8, fireRate: 8.0, range: 320, color: '#b362ff' }, // damage per tick
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'range', mult: 1.15 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'range', mult: 1.2 },
      { stat: 'damage', mult: 1.20 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.14 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  arcTesla: {
    id: 'arcTesla',
    name: 'Arc Tesla',
    icon: '⚡',
    type: 'auto',
    behaviour: 'chain',
    desc: 'Studsande blixt som kedjar till 3 fiender.',
    base: { damage: 28, fireRate: 1.0, range: 320, chainCount: 3, chainRange: 200, color: '#a0e4ff' },
    levelUps: [
      { stat: 'damage', mult: 1.22 },
      { stat: 'chainCount', add: 1 },
      { stat: 'chainCount', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'chainCount', add: 1 },
      { stat: 'chainRange', mult: 1.2 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.14 },
      { stat: 'damage', mult: 1.55, evolve: true }
    ],
  },
  stormLance: {
    id: 'stormLance',
    name: 'Storm Lance',
    icon: '🌩️',
    type: 'manual',
    behaviour: 'projectile',
    desc: 'A precision bolt that strikes down like real lightning on impact.',
    base: { damage: 26, fireRate: 1.4, projSpeed: 900, projSize: 7, projectiles: 1, pierce: 1, spread: 0.03, crit: 0.10, color: '#fff44d', magazine: 8, reloadTime: 0.9 },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'pierce', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'crit', add: 0.08 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'damage', mult: 1.55, evolve: true }
    ],
  },
  // ===== NEW WEAPONS (unlock via Card Shop) =====
  // Hand cannon: very few rounds, very slow, and each one hits like a truck
  // and shoves what it hits. The counterweight to the fast manual weapons.
  desertEagle: {
    id: 'desertEagle', name: 'Desert Eagle', icon: '🦅', type: 'manual', behaviour: 'projectile',
    desc: 'Seven rounds of absurd stopping power. Slow, loud, and it moves whatever it hits.',
    base: {
      damage: 62, fireRate: 1.7, projSpeed: 900, projSize: 7, projectiles: 1,
      pierce: 1, magazine: 7, reloadTime: 1.5, knockback: 240, crit: 0.12,
      spread: 0.02, color: '#ffd166',
    },
    levelUps: [
      { stat: 'damage', mult: 1.24 },
      { stat: 'magazine', add: 2 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.16 },
      { stat: 'pierce', add: 1 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'crit', add: 0.06 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'damage', mult: 1.55, evolve: true }
    ],
  },
  // Charge-and-loose. Slow cadence, no magazine to speak of, but the arrow
  // punches through a whole line of enemies.
  bow: {
    id: 'bow', name: 'Tidewood Bow', icon: '🏹', type: 'manual', behaviour: 'projectile',
    desc: 'Draws heavy and looses an arrow that runs a line clean through the crowd.',
    base: {
      damage: 34, fireRate: 1.4, projSpeed: 1150, projSize: 5, projectiles: 1,
      pierce: 4, magazine: 1, reloadTime: 0.62, knockback: 60, crit: 0.15,
      spread: 0.0, color: '#c8f0a0',
    },
    levelUps: [
      { stat: 'pierce', add: 2 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'crit', add: 0.07 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  // Directional lash in the aim direction — the genre-staple whip. Uses the
  // scythe path (behaviour 'aoe', not in RADIAL_AOE_WEAPONS) because that is
  // already a forward-arc sweep; what makes it a whip rather than a scythe is
  // the long, narrow reach, the fast cadence, and its own lash visual.
  tideWhip: {
    id: 'tideWhip', name: 'Tide Lash', icon: '🪢', type: 'auto', behaviour: 'aoe',
    desc: 'Cracks a whip of hard water wherever you aim. Long reach, fast, hits everything in the lane.',
    base: { damage: 19, fireRate: 2.1, range: 200, area: 190, knockback: 90, crit: 0.06, color: '#4fd8ff', whip: true },
    levelUps: [
      { stat: 'damage', mult: 1.22 },
      { stat: 'area', mult: 1.14 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.18 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'area', mult: 1.16 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.14 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  chainlightning: {
    id: 'chainlightning', name: 'Chain Lightning', icon: '⚡', type: 'auto', behaviour: 'beam', requireUnlock: true,
    desc: 'Arcing bolt that chains between up to 3 foes.',
    base: { damage: 22, fireRate: 1.8, range: 220, area: 90, chain: 2, crit: 0.07, color: '#ffe44d' },
    levelUps: [
      { stat: 'damage', mult: 1.20 },
      { stat: 'chain', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.12 },
      { stat: 'damage', mult: 1.28 },
      { stat: 'chain', add: 1 },
      { stat: 'crit', add: 0.04 },
      { stat: 'projSize', mult: 1.12 },
      { stat: 'damage', mult: 1.20 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  whirlwind: {
    id: 'whirlwind', name: 'Whirlwind', icon: '🌪️', type: 'auto', behaviour: 'orbit', requireUnlock: true,
    desc: 'Spinning blade orbits you — shreds everything nearby.',
    base: { damage: 18, fireRate: 0.0, range: 90, area: 90, orbitSpeed: 3.2, orbitCount: 1, crit: 0.06, color: '#c8e0ff' },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'orbitCount', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'area', mult: 1.15 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'orbitSpeed', mult: 1.2 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  boneshards: {
    id: 'boneshards', name: 'Bone Shards', icon: '💀', type: 'auto', behaviour: 'shotgun', requireUnlock: true,
    desc: 'Erupts in a burst of bone fragments every few seconds.',
    base: { damage: 18, fireRate: 0.9, projSpeed: 360, projSize: 7, projectiles: 3, pierce: 0, spread: 1.45, crit: 0.04, color: '#f0dbb4' },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'pierce', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  daggers: {
    id: 'daggers', name: 'Dagger Fan', icon: '🗡️', type: 'manual', behaviour: 'projectile', requireUnlock: true,
    desc: 'Throws a fan of 3 quick daggers.',
    base: { damage: 38, fireRate: 2.8, projSpeed: 740, projSize: 5, projectiles: 1, pierce: 0, spread: 0.20, crit: 0.14, color: '#d0d0ff', magazine: 9, reloadTime: 0.7 },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'pierce', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projSize', mult: 1.12 },
      { stat: 'damage', mult: 1.20 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  flameburst: {
    id: 'flameburst', name: 'Flame Burst', icon: '🔥', type: 'manual', behaviour: 'shotgun', requireUnlock: true,
    desc: 'Close-range cone of fire — devastating up close.',
    base: { damage: 44, fireRate: 1.1, projSpeed: 350, projSize: 10, projectiles: 3, pierce: 0, spread: 0.58, crit: 0.05, color: '#ff6a00', magazine: 4, reloadTime: 1.5 },
    levelUps: [
      { stat: 'damage', mult: 1.25 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'spread', add: -0.07 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  icespike: {
    id: 'icespike', name: 'Ice Spike', icon: '🧊', type: 'manual', behaviour: 'projectile', requireUnlock: true,
    desc: 'Slow, powerful shot that chills enemies on hit.',
    base: { damage: 70, fireRate: 0.9, projSpeed: 270, projSize: 13, projectiles: 1, pierce: 1, spread: 0.01, crit: 0.08, color: '#a0e8ff', magazine: 3, reloadTime: 2.0, slowOnHit: 0.45 },
    levelUps: [
      { stat: 'damage', mult: 1.3 },
      { stat: 'pierce', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'slowOnHit', add: 0.10 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'damage', mult: 1.20 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.14 },
      { stat: 'damage', mult: 1.6, evolve: true }
    ],
  },
  staticField: {
    id: 'staticField', name: 'Static Field', icon: '🔌', type: 'auto', behaviour: 'chain', requireUnlock: true,
    desc: 'Discharges through the air, arcing between many foes at once — weaker per hit but chains far further than Arc Tesla.',
    base: { damage: 19, fireRate: 1.6, range: 260, chainCount: 3, chainRange: 260, color: '#c8f8ff' },
    levelUps: [
      { stat: 'damage', mult: 1.18 },
      { stat: 'chainCount', add: 1 },
      { stat: 'chainCount', add: 1 },
      { stat: 'chainRange', mult: 1.15 },
      { stat: 'chainCount', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  // ===== ADDITIONAL WEAPONS =====
  frostOrb: {
    id: 'frostOrb', name: 'Frost Orb', icon: '❄️', type: 'auto', behaviour: 'orbit', requireUnlock: true,
    desc: '3 icy orbs circle you, chilling and damaging all enemies.',
    base: { damage: 9, orbitCount: 3, orbitRadius: 72, orbitSpeed: 1.6, area: 20, color: '#a0e8ff', slowOnHit: 0.28 },
    levelUps: [
      { stat: 'orbitCount', add: 1 },
      { stat: 'damage', mult: 1.22 },
      { stat: 'projectiles', add: 1 },
      { stat: 'area', mult: 1.15 },
      { stat: 'orbitCount', add: 1 },
      { stat: 'orbitSpeed', mult: 1.2 },
      { stat: 'damage', mult: 1.20 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.14 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  voidPulse: {
    id: 'voidPulse', name: 'Void Pulse', icon: '🔮', type: 'auto', behaviour: 'aoe', requireUnlock: true,
    desc: 'Emits void shockwaves outward, damaging all nearby foes.',
    base: { damage: 14, fireRate: 1.1, range: 110, area: 110, color: '#9933ff', pierce: 99 },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'area', mult: 1.2 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'area', mult: 1.2 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  sniperDrop: {
    id: 'sniperDrop', name: 'Sniper Drop', icon: '🎯', type: 'manual', behaviour: 'projectile', requireUnlock: true,
    desc: 'Pinpoint shot with extreme range and damage. Reload after each shot.',
    base: { damage: 110, fireRate: 0.45, projSpeed: 1700, projSize: 4, projectiles: 1, pierce: 5, spread: 0.0, crit: 0.38, color: '#ff4dff', magazine: 1, reloadTime: 2.5 },
    levelUps: [
      { stat: 'damage', mult: 1.35 },
      { stat: 'crit', add: 0.10 },
      { stat: 'projectiles', add: 1 },
      { stat: 'pierce', add: 2 },
      { stat: 'damage', mult: 1.40 },
      { stat: 'magazine', add: 1 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'damage', mult: 2.0, evolve: true }
    ],
  },
  acidSprayer: {
    id: 'acidSprayer', name: 'Acid Sprayer', icon: '☠️', type: 'manual', behaviour: 'shotgun', requireUnlock: true,
    desc: 'Short-range acid spray — melts everything in a cone.',
    base: { damage: 10, fireRate: 4.2, projSpeed: 270, projSize: 9, projectiles: 3, pierce: 1, spread: 0.62, crit: 0.04, color: '#7fff00', magazine: 20, reloadTime: 2.0 },
    levelUps: [
      { stat: 'damage', mult: 1.22 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'damage', mult: 1.28 },
      { stat: 'projectiles', add: 1 },
      { stat: 'pierce', add: 1 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // NEW AUTO WEAPONS (5) — see engine.js weaponDrone for the 'drone'
  // behaviour; plasmaTurret/solarFlare reuse weaponShockwave (see the
  // updateWeapons switch's 'aoe' case), shrapnelMine reuses weaponMeteor,
  // railgunArray reuses weaponBeam — all pre-existing generic handlers.
  // ═══════════════════════════════════════════════════════════════
  droneSquad: {
    id: 'droneSquad', name: 'Drone Squadron', icon: '🛸', type: 'auto', behaviour: 'drone', requireUnlock: true,
    desc: 'Deploys drones that independently hunt and fire at nearby foes.',
    base: { damage: 10, fireRate: 1.6, projSpeed: 520, projSize: 5, pierce: 0, crit: 0.06, range: 380, droneCount: 1, color: '#4dc4ff' },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'projectiles', add: 1 },
      { stat: 'droneCount', add: 1 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'range', add: 80 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  plasmaTurret: {
    id: 'plasmaTurret', name: 'Plasma Turret', icon: '🔵', type: 'auto', behaviour: 'aoe', requireUnlock: true,
    desc: 'Pulses a short-range plasma burst around you.',
    base: { damage: 20, fireRate: 1.4, area: 150, knockback: 30, crit: 0.05, color: '#4dc4ff' },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'area', mult: 1.15 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'area', mult: 1.2 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'crit', add: 0.04 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  shrapnelMine: {
    id: 'shrapnelMine', name: 'Shrapnel Mine', icon: '💣', type: 'auto', behaviour: 'meteor', requireUnlock: true,
    desc: 'Auto-drops proximity mines that shred everything in the blast.',
    base: { damage: 55, fireRate: 0.5, area: 100, color: '#ffb347' },
    levelUps: [
      { stat: 'damage', mult: 1.22 },
      { stat: 'area', mult: 1.15 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'area', mult: 1.2 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'crit', add: 0.04 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  solarFlare: {
    id: 'solarFlare', name: 'Solar Flare', icon: '☀️', type: 'auto', behaviour: 'aoe', requireUnlock: true,
    desc: 'A radiant burning nova erupts around you periodically.',
    base: { damage: 26, fireRate: 1.1, area: 170, knockback: 40, crit: 0.05, color: '#ff9900' },
    levelUps: [
      { stat: 'damage', mult: 1.22 },
      { stat: 'area', mult: 1.15 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.32 },
      { stat: 'area', mult: 1.2 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  railgunArray: {
    id: 'railgunArray', name: 'Railgun Array', icon: '📡', type: 'auto', behaviour: 'beam', requireUnlock: true,
    desc: 'Long-range auto-sniper — pins down the nearest foe from afar.',
    base: { damage: 46, fireRate: 0.9, range: 620, crit: 0.15, color: '#9fe0ff' },
    levelUps: [
      { stat: 'damage', mult: 1.22 },
      { stat: 'range', add: 60 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'crit', add: 0.08 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'crit', add: 0.04 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // NEW MANUAL WEAPONS (5) — tidalHarpoon + twinRevolvers ship as
  // standard (no requireUnlock, same as hydropistol/bloodscythe etc.);
  // the other 3 unlock via the card-shop slot machine (SHOP_CARD_POOL).
  // ═══════════════════════════════════════════════════════════════
  tidalHarpoon: {
    id: 'tidalHarpoon', name: 'Tidal Harpoon', icon: '🔱', type: 'manual', behaviour: 'projectile',
    desc: 'Heavy piercing harpoon — skewers everything in its path.',
    base: { damage: 30, fireRate: 2.2, projSpeed: 760, projSize: 7, magazine: 8, reloadTime: 1.3, pierce: 4, knockback: 130, spread: 0.03, crit: 0.1, color: '#1fb6ff', sound: 'shoot' },
    levelUps: [
      { stat: 'damage', mult: 1.18 },
      { stat: 'pierce', add: 2 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.1 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'magazine', add: 3 },
      { stat: 'crit', add: 0.08 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'crit', add: 0.04 },
      { stat: 'damage', mult: 1.4, evolve: true }
    ],
  },
  twinRevolvers: {
    id: 'twinRevolvers', name: 'Twin Revolvers', icon: '🔫', type: 'manual', behaviour: 'projectile',
    desc: 'Dual-wielded sidearms — twice the lead, twice the noise.',
    base: { damage: 16, fireRate: 6.5, projSpeed: 900, projSize: 5, projectiles: 1, magazine: 18, reloadTime: 0.9, pierce: 0, knockback: 60, spread: 0.05, crit: 0.1, color: '#ffd166', sound: 'shoot' },
    levelUps: [
      { stat: 'damage', mult: 1.18 },
      { stat: 'fireRate', mult: 1.12 },
      { stat: 'projectiles', add: 1 },
      { stat: 'magazine', add: 6 },
      { stat: 'damage', mult: 1.22 },
      { stat: 'projectiles', add: 1 },
      { stat: 'crit', add: 0.1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'projSize', mult: 1.12 },
      { stat: 'damage', mult: 1.4, evolve: true }
    ],
  },
  voidScatter: {
    id: 'voidScatter', name: 'Void Scattergun', icon: '🌌', type: 'manual', behaviour: 'shotgun', requireUnlock: true,
    desc: 'A void-charged blast of homing shards in a wide cone.',
    base: { damage: 14, fireRate: 2.6, projSpeed: 400, projSize: 7, projectiles: 3, pierce: 1, spread: 0.7, crit: 0.06, color: '#b362ff', magazine: 14, reloadTime: 1.8 },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'damage', mult: 1.28 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'pierce', add: 1 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  arcCaster: {
    id: 'arcCaster', name: 'Arc Caster', icon: '⚡', type: 'manual', behaviour: 'projectile', requireUnlock: true,
    desc: 'Manual-aim lightning sidearm — fast, sharp, precise.',
    base: { damage: 14, fireRate: 5.5, projSpeed: 950, projSize: 5, magazine: 16, reloadTime: 1.0, pierce: 1, knockback: 40, spread: 0.02, crit: 0.14, color: '#a0e4ff', sound: 'shoot' },
    levelUps: [
      { stat: 'damage', mult: 1.18 },
      { stat: 'fireRate', mult: 1.12 },
      { stat: 'projectiles', add: 1 },
      { stat: 'pierce', add: 1 },
      { stat: 'damage', mult: 1.24 },
      { stat: 'crit', add: 0.1 },
      { stat: 'magazine', add: 5 },
      { stat: 'area', mult: 1.14 },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'damage', mult: 1.4, evolve: true }
    ],
  },
  cometLauncher: {
    id: 'cometLauncher', name: 'Comet Launcher', icon: '☄️', type: 'manual', behaviour: 'projectile', requireUnlock: true,
    desc: 'Fires a slow heavy comet that explodes violently on impact.',
    base: { damage: 65, fireRate: 0.9, projSpeed: 460, projSize: 12, magazine: 4, reloadTime: 2.4, pierce: 0, knockback: 160, spread: 0.04, crit: 0.08, color: '#ff7a1a', explode: 90, sound: 'shoot' },
    levelUps: [
      { stat: 'damage', mult: 1.22 },
      { stat: 'fireRate', mult: 1.12 },
      { stat: 'projectiles', add: 1 },
      { stat: 'magazine', add: 2 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'crit', add: 0.04 },
      { stat: 'projSize', mult: 1.12 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // EVOLVED WEAPONS — unlocked via Skill Tree (poe_awk0) + EVO Slot
  // ═══════════════════════════════════════════════════════════════
  hydropistol_evo: {
    id: 'hydropistol_evo', name: 'Torrent Cannon', icon: '🌊', type: 'manual', behaviour: 'projectile', isEvo: true, evoFrom: 'hydropistol',
    desc: 'Evolution of Hydro Pistol. Fires 3 massive water bolts that pierce everything.',
    base: { damage: 83, fireRate: 2.2, projSpeed: 1020, projSize: 11, projectiles: 1, pierce: 3, spread: 0.08, crit: 0.16, color: '#00b8ff', magazine: 9, reloadTime: 1.2, knockback: 120 },
    levelUps: [
      { stat: 'damage', mult: 1.25 },
      { stat: 'fireRate', mult: 1.12 },
      { stat: 'projectiles', add: 1 },
      { stat: 'pierce', add: 1 },
      { stat: 'damage', mult: 1.3  },
      { stat: 'projectiles', add: 1 },
      { stat: 'projSize', mult: 1.12 },
      { stat: 'damage', mult: 1.20 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  bloodscythe_evo: {
    id: 'bloodscythe_evo', name: 'Soul Reaper', icon: '💀', type: 'auto', behaviour: 'aoe', isEvo: true, evoFrom: 'bloodscythe',
    desc: 'Evolution of Blood Scythe. Massive spinning reaper — each hit restores HP.',
    base: { damage: 55, fireRate: 2.0, range: 200, area: 200, knockback: 30, crit: 0.10, color: '#8b0000', lifesteal: 0.08 },
    levelUps: [
      { stat: 'damage', mult: 1.25 },
      { stat: 'area', mult: 1.2 },
      { stat: 'projectiles', add: 1 },
      { stat: 'fireRate', mult: 1.15 },
      { stat: 'damage', mult: 1.35 },
      { stat: 'area', mult: 1.2  },
      { stat: 'projSize', mult: 1.12 },
      { stat: 'damage', mult: 1.20 },
      { stat: 'fireRate', mult: 1.10 },
      { stat: 'damage', mult: 1.6, evolve: true }
    ],
  },
  emberOrbs_evo: {
    id: 'emberOrbs_evo', name: 'Inferno Ring', icon: '🌋', type: 'auto', behaviour: 'orbit', isEvo: true, evoFrom: 'emberOrbs',
    desc: 'Evolution of Ember Orbs. 6 massive lava orbs leave a burning trail behind them.',
    base: { damage: 22, orbitCount: 6, orbitRadius: 105, orbitSpeed: 2.6, area: 32, color: '#ff3d00' },
    levelUps: [
      { stat: 'orbitCount', add: 1 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'projectiles', add: 1 },
      { stat: 'area', mult: 1.2 },
      { stat: 'orbitSpeed', mult: 1.2 },
      { stat: 'damage', mult: 1.35 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'crit', add: 0.04 },
      { stat: 'projSize', mult: 1.12 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  runebolts_evo: {
    id: 'runebolts_evo', name: 'Storm Array', icon: '🌩️', type: 'auto', behaviour: 'projectile', isEvo: true, evoFrom: 'runebolts',
    desc: 'Evolution of Rune Bolts. 5 chain-lightning bolts that arc between enemies.',
    base: { damage: 62, fireRate: 3.5, projSpeed: 700, projSize: 10, projectiles: 1, pierce: 1, homing: 0.12, color: '#00fff2', chainOnKill: true, chainRange: 180, chainDmgMult: 0.6 },
    levelUps: [
      { stat: 'damage', mult: 1.25 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'projectiles', add: 1 },
      { stat: 'pierce',  add: 1    },
      { stat: 'reloadTime', mult: 0.90 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'crit', add: 0.04 },
      { stat: 'projSize', mult: 1.12 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  frostOrb_evo: {
    id: 'frostOrb_evo', name: 'Blizzard', icon: '🌨️', type: 'auto', behaviour: 'orbit', isEvo: true, evoFrom: 'frostOrb',
    desc: 'Evolution of Frost Orb. 5 giant blizzard orbs that freeze all enemies on contact.',
    base: { damage: 18, orbitCount: 5, orbitRadius: 88, orbitSpeed: 1.9, area: 28, color: '#c8f4ff', slowOnHit: 0.55 },
    levelUps: [
      { stat: 'orbitCount', add: 1 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'projectiles', add: 1 },
      { stat: 'area', mult: 1.2 },
      { stat: 'orbitSpeed', mult: 1.15 },
      { stat: 'slowOnHit', add: 0.10 },
      { stat: 'damage', mult: 1.16 },
      { stat: 'projSpeed', mult: 1.12 },
      { stat: 'crit', add: 0.04 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
  daggers_evo: {
    id: 'daggers_evo', name: 'Blade Storm', icon: '⚔️', type: 'manual', behaviour: 'shotgun', isEvo: true, evoFrom: 'daggers',
    desc: 'Evolution of Dagger Fan. 8 razor blades fired in a full fan — one trigger, mass carnage.',
    base: { damage: 60, fireRate: 2.8, projSpeed: 820, projSize: 7, projectiles: 3, pierce: 2, spread: 0.85, crit: 0.18, color: '#e8e8ff', magazine: 16, reloadTime: 1.4, knockback: 50 },
    levelUps: [
      { stat: 'damage', mult: 1.25 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'crit', add: 0.10 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'damage', mult: 1.30 },
      { stat: 'projectiles', add: 1 },
      { stat: 'projectiles', add: 1 },
      { stat: 'pierce',      add: 1 },
      { stat: 'damage', mult: 1.5, evolve: true }
    ],
  },
};

// Map of base weapon → evo weapon id
export const WEAPON_EVO_MAP = Object.fromEntries(
  Object.values(WEAPONS).filter(w => w.isEvo).map(w => [w.evoFrom, w.id])
);

// ---------- ENEMIES ----------
// Balance pass note — the opening two minutes were the weakest stretch in the
// game: a wall of low-HP slimes that a level-1 pistol shredded, which taught
// the player that standing still and holding fire was a viable strategy. It is
// not supposed to be, ever. Early HP is up across the board (slime 44→52, bat
// 23→28, ghoul 68→80) and early damage is up enough that four hits from
// anything is a real problem at 50 base HP — the first minute should read as
// "I am barely holding", not as target practice.
//
// Everything from `brute` down was left alone: those types arrive after the
// player has cards, and they were already tuned against that.
export const ENEMIES = {
  slime: {
    id: 'slime', name: 'Slime', size: 18, hp: 52, dmg: 16, speed: 62, color: '#7ad96b',
    xp: 2, gold: 1, ai: 'chase',
  },
  // pond_1's ("First Drops") own cast — see data_ext2.js's pond_1 node and
  // GameScreen.jsx's `forceBaseline`. The player has nothing but a katana
  // (base damage 88, no meta/attrs/pet/skill bonuses) for this mission, and
  // these two are tuned against that EXACT number so the fight has the
  // specific shape Timmy asked for: 2 hits, then 3, then a real fight.
  //
  // Runtime HP is not the `hp` below — engine.js's spawnEnemy multiplies it
  // by `scale * 3 * menace * D.hpMult`, which is ~3x at the moment a wave
  // starts (scale/menace ~1 at run start). So "dies in N katana hits"
  // means `hp * 3` sits just above `88 * (N-1)` and at or below `88 * N`.
  // 'slime' above already lands almost exactly on 2 hits (52*3=156, and
  // 88*2=176 >= 156 > 88) — no new enemy needed for that one.
  sludgeling: {
    // 75*3=225: 88*2=176 doesn't kill it, 88*3=264 does. Three hits.
    id: 'sludgeling', name: 'Sludgeling', size: 20, hp: 75, dmg: 20, speed: 58, color: '#c4e63a',
    xp: 3, gold: 2, ai: 'chase',
  },
  sludgeWarden: {
    // 220*3=660: 88*7=616 doesn't kill it, 88*8=704 does. Eight hits — the
    // node's actual guardian (see data_ext2.js pond_1's `bossId` override
    // and campaign.js's `nodeToMission`), NOT the shared bossOcular, whose
    // hp:2400 would need ~80 hits at this same baseline. `ai:'boss'` reuses
    // the generic triple-burst boss AI (engine.js ~L2993) rather than
    // inventing a new one — only the stats are bespoke.
    id: 'sludgeWarden', name: 'Silt Warden', size: 38, hp: 220, dmg: 20, speed: 52, color: '#8a9c3a',
    xp: 25, gold: 20, ai: 'boss', boss: true, shootCD: 2.0,
  },
  bat: {
    id: 'bat', name: 'Voidbat', size: 14, hp: 28, dmg: 12, speed: 126, color: '#b362ff',
    xp: 2, gold: 1, ai: 'chase',
  },
  brute: {
    id: 'brute', name: 'Brute', size: 26, hp: 137, dmg: 65, speed: 48, color: '#c97050',
    xp: 6, gold: 3, ai: 'chase',
  },
  ranger: {
    id: 'ranger', name: 'Ranger', size: 20, hp: 66, dmg: 18, speed: 70, color: '#ffd166',
    xp: 4, gold: 2, ai: 'ranged', shootRange: 320, shootCD: 1.7, projSpeed: 320,
  },
  charger: {
    id: 'charger', name: 'Charger', size: 22, hp: 68, dmg: 70, speed: 80, color: '#ff3146',
    xp: 5, gold: 3, ai: 'charge',
  },
  ghoul: {
    id: 'ghoul', name: 'Ghoul', size: 19, hp: 80, dmg: 17, speed: 98, color: '#9aa6b2',
    xp: 3, gold: 2, ai: 'chase',
  },
  necron: {
    id: 'necron', name: 'Necron', size: 28, hp: 330, dmg: 90, speed: 55, color: '#4dffd4',
    xp: 22, gold: 14, ai: 'chase', boss: false,
  },
  // --- New enemy types (appear after each boss) ---
  crystalite: {
    id: 'crystalite', name: 'Crystalite', size: 20, hp: 165, dmg: 17, speed: 35, color: '#88eeff',
    xp: 6, gold: 3, ai: 'chase', armor: 4,
  },
  soulshard: {
    id: 'soulshard', name: 'Soul Shard', size: 16, hp: 63, dmg: 24, speed: 95, color: '#ccaaff',
    xp: 5, gold: 2, ai: 'chase', noKnockback: true,
  },
  bonewalker: {
    id: 'bonewalker', name: 'Bone Walker', size: 23, hp: 270, dmg: 28, speed: 48, color: '#ddd8c4',
    xp: 10, gold: 5, ai: 'chase', regen: 4,
  },
  voidspawn: {
    id: 'voidspawn', name: 'Void Spawn', size: 18, hp: 113, dmg: 36, speed: 65, color: '#9933ff',
    xp: 8, gold: 4, ai: 'charge',
  },
  steelbrute: {
    id: 'steelbrute', name: 'Steel Brute', size: 30, hp: 450, dmg: 105, speed: 28, color: '#778899',
    xp: 18, gold: 9, ai: 'chase', armor: 8,
  },
  lightningbug: {
    id: 'lightningbug', name: 'Lightning Bug', size: 15, hp: 75, dmg: 30, speed: 145, color: '#ffff55',
    xp: 8, gold: 4, ai: 'chase',
  },
  techsoldier: {
    id: 'techsoldier', name: 'Tech Soldier', size: 24, hp: 375, dmg: 38, speed: 55, color: '#44aaff',
    xp: 16, gold: 8, ai: 'ranged', shootRange: 260, shootCD: 0.9, projSpeed: 360,
  },
  nanoswarm: {
    id: 'nanoswarm', name: 'Nano Swarm', size: 18, hp: 50, dmg: 46, speed: 115, color: '#00ff88',
    xp: 12, gold: 6, ai: 'chase',
  },
  // Swipe-attack miniboss: very tanky and near-immune to normal fire while
  // guarded, but its guard drops on a cycle (see engine.js updateEnemies) —
  // during that window a swipe attack executes it instantly. Spawns
  // periodically as a rare elite, not tied to the WAVE_TIMELINE boss slots.
  swipeWarden: {
    id: 'swipeWarden', name: 'Warden', size: 32, hp: 900, dmg: 42, speed: 40, color: '#ffb347',
    xp: 60, gold: 40, ai: 'chase', armor: 6, noKnockback: true,
  },
  // Flying swarm — small, fast, spawns in bursts of ~5-6 at once via a
  // dedicated periodic timer (see engine.js update()'s _nextSwarmAt), not
  // the normal WAVE_TIMELINE pool, so it reads as a distinct "a swarm
  // just dropped in" moment rather than blending into regular spawns.
  skyWisp: {
    id: 'skyWisp', name: 'Sky Wisp', size: 12, hp: 18, dmg: 9, speed: 155, color: '#9fe0ff',
    xp: 3, gold: 1, ai: 'chase',
  },
  // Minibosses (rare elites, spawn periodically like swipeWarden — not
  // tied to WAVE_TIMELINE boss slots).
  ironSentinel: {
    id: 'ironSentinel', name: 'Iron Sentinel', size: 36, hp: 1600, dmg: 60, speed: 26, color: '#778899',
    xp: 90, gold: 70, ai: 'chase', noKnockback: true,
  },
  blightWeaver: {
    id: 'blightWeaver', name: 'Blight Weaver', size: 26, hp: 620, dmg: 18, speed: 58, color: '#7ad96b',
    xp: 80, gold: 60, ai: 'chase',
  },
  // Bosses (HP doubled)
  bossOcular: {
    id: 'bossOcular', name: 'Eye of Horus', size: 90, hp: 2400, dmg: 26, speed: 165, color: '#ffd166',
    xp: 200, gold: 220, ai: 'boss', boss: true, shootCD: 1.8,
  },
  bossNecromancer: {
    id: 'bossNecromancer', name: 'Nekromansen', size: 75, hp: 5600, dmg: 32, speed: 95, color: '#7ad96b',
    xp: 400, gold: 450, ai: 'boss', boss: true, shootCD: 1.4,
  },
  bossVoidTitan: {
    id: 'bossVoidTitan', name: 'Void Titan', size: 100, hp: 10000, dmg: 50, speed: 62, color: '#b362ff',
    xp: 600, gold: 600, ai: 'boss', boss: true, shootCD: 0.8,
  },
  bossAida: {
    id: 'bossAida', name: 'A.I.D.A.', size: 80, hp: 12000, dmg: 58, speed: 145, color: '#b362ff',
    xp: 800, gold: 800, ai: 'boss', boss: true, shootCD: 0.6,
  },
  // ---- New bosses (endless rotation, unique learnable attack patterns) ----
  bossTidebreaker: {
    id: 'bossTidebreaker', name: 'The Tidebreaker', size: 95, hp: 16000, dmg: 55, speed: 70, color: '#1fb6ff',
    xp: 900, gold: 900, ai: 'boss', boss: true, shootCD: 1.0,
  },
  bossSentinel: {
    id: 'bossSentinel', name: 'Sentinel Prime', size: 85, hp: 20000, dmg: 60, speed: 50, color: '#44aaff',
    xp: 1000, gold: 1000, ai: 'boss', boss: true, shootCD: 0.9,
  },
  bossHollowQueen: {
    id: 'bossHollowQueen', name: 'The Hollow Queen', size: 78, hp: 14000, dmg: 48, speed: 95, color: '#8a3fd4',
    xp: 950, gold: 950, ai: 'boss', boss: true, shootCD: 1.1,
  },
};

// ---------- LEVEL UP CARD POOL (in-run) ----------
// Cards mutate run-state stats or grant/upgrade weapons.
export const STAT_CARDS = [
  { id: 'dmg',       icon: 'damageMult', name: 'Sharpened Edge',  desc: '+{v}% damage',          stat: 'damageMult',    mult: true,  amount: 0.05 },
  { id: 'atks',      icon: 'fireRateMult', name: 'Quickened Hand',  desc: '+{v}% attack speed',    stat: 'fireRateMult',  mult: true,  amount: 0.05 },
  { id: 'spd',       icon: 'moveMult', name: 'Light Step',      desc: '+{v}% move speed',      stat: 'moveMult',      mult: true,  amount: 0.04 },
  { id: 'maxhp',     icon: 'maxHp', name: 'Vital Surge',     desc: '+{v} max HP',           stat: 'maxHp',         mult: false, amount: 3 },
  { id: 'heal',      icon: 'heal', name: 'Cleansing Wave',  desc: 'Heal {v} HP now',       stat: 'heal',          mult: false, amount: 5 },
  { id: 'regen',     icon: 'regen', name: 'Regrowth',        desc: '+{v} HP / sec',         stat: 'regen',         mult: false, amount: 0.025 },
  { id: 'armor',     icon: 'armor', name: 'Iron Skin',       desc: '+{v} armor',            stat: 'armor',         mult: false, amount: 1 },
  { id: 'crit',      icon: 'crit', name: 'Lucky Strikes',   desc: '+{v}% crit chance',     stat: 'crit',          mult: false, amount: 0.03 },
  { id: 'critdmg',   icon: 'critDmgMult', name: 'Critical Mass',   desc: '+{v}% crit damage',     stat: 'critDmgMult',   mult: true,  amount: 0.12 },
  { id: 'area',      icon: 'areaMult', name: 'Wider Wake',      desc: '+{v}% area',            stat: 'areaMult',      mult: true,  amount: 0.05 },
  { id: 'proj',      icon: 'projBonus', name: 'Projectile Up',   desc: '+{v} extra projectile', stat: 'projBonus',     mult: false, amount: 1 },
  { id: 'pickup',    icon: 'pickupMult', name: 'Magnet',          desc: '+{v}% pickup range',    stat: 'pickupMult',    mult: true,  amount: 0.10 },
  { id: 'xpgain',    icon: 'xpMult', name: 'Wisdom',          desc: '+{v}% XP gain',         stat: 'xpMult',        mult: true,  amount: 0.08 },
  { id: 'gold',      icon: 'goldMult', name: 'Greed',           desc: '+{v}% gold drops',      stat: 'goldMult',      mult: true,  amount: 0.10 },
  { id: 'pierce',    icon: 'pierceBonus', name: 'Piercing Shot',   desc: '+{v} pierce',           stat: 'pierceBonus',   mult: false, amount: 1 },
  { id: 'dodge',     icon: 'dodge', name: 'Phasing',         desc: '+{v}% dodge',           stat: 'dodge',         mult: false, amount: 0.03 },
  { id: 'reload',    icon: 'reloadMult', name: 'Fast Reload',     desc: '-{v}% reload time',     stat: 'reloadMult',    mult: true,  amount: -0.08 },
  { id: 'mag',       icon: 'magBonus', name: 'Bigger Mag',      desc: '+{v} magazine size',    stat: 'magBonus',      mult: false, amount: 2 },
  { id: 'luck',      icon: 'luck', name: 'Fortune\'s Favor', desc: '+{v} luck (better card/loot rarity)', stat: 'luck', mult: false, amount: 0.3 },
  { id: 'skillcd',   icon: 'skillCdMult', name: 'Overclock',       desc: '-{v}% active skill cooldown', stat: 'skillCdMult', mult: true, amount: -0.06 },
  // Projectile speed and range. Requested by the user, and they fix a real
  // gap: shots flew at a fixed speed and travelled a fixed (very long)
  // distance no matter what you built, so neither was ever a decision.
  // Range is deliberately the smaller number — extra reach is worth more per
  // point than extra speed in a game where enemies close on you.
  { id: 'projspd',   icon: 'projSpeedMult', name: 'Swift Rounds',    desc: '+{v}% projectile speed', stat: 'projSpeedMult', mult: true,  amount: 0.08 },
  { id: 'projrange', icon: 'projRangeMult', name: 'Long Barrel',     desc: '+{v}% projectile range', stat: 'projRangeMult', mult: true,  amount: 0.06 },
];

// ---------- META UPGRADES (permanent — tiny increments, long grind) ----------
// Philosophy: +1 HP/level max, +0.1-0.2% for %, max 80-100 levels each.
// Total endpoint power ≈ same as before, but requires 10-20× more upgrades.
// `icon` is a GameIcon id (see components/GameIcon.jsx's ICONS table), not
// emoji — reuses existing weapon-stat/passive glyphs rather than drawing 22
// new ones from scratch, since e.g. "Lightfoot" and the boot ICONS already
// used for moveMult on level-up cards are the same idea twice.
export const META_UPGRADES = [
  { id: 'm_projspd',  name: 'Swift Rounds',   icon: 'projSpeedMult', desc: '+0.15% projectile speed per level', stat: 'projspd',   amount: 0.0015, max: 80, baseCost: 13, curve: 1.033 },
  { id: 'm_projrange',name: 'Long Barrel',    icon: 'projRangeMult', desc: '+0.12% projectile range per level', stat: 'projrange', amount: 0.0012, max: 80, baseCost: 15, curve: 1.034 },
  { id: 'm_hp',     name: 'Hardened Core',     icon: 'maxHp', desc: '+1 max HP per level',            stat: 'maxHp',     amount: 1,      max: 100, baseCost: 8,   curve: 1.030 },
  { id: 'm_dmg',    name: 'Sharpened Will',    icon: 'damageMult', desc: '+0.2% damage per level',          stat: 'dmg',       amount: 0.002,  max: 100, baseCost: 12,  curve: 1.035 },
  { id: 'm_atks',   name: 'Resonant Pulse',    icon: 'fireRateMult', desc: '+0.2% attack speed per level',    stat: 'atks',      amount: 0.002,  max: 80,  baseCost: 14,  curve: 1.035 },
  { id: 'm_spd',    name: 'Lightfoot',         icon: 'moveMult', desc: '+0.2% move speed per level',      stat: 'mspd',      amount: 0.002,  max: 80,  baseCost: 10,  curve: 1.030 },
  { id: 'm_crit',   name: 'Eye of Fortune',    icon: 'crit', desc: '+0.1% crit chance per level',     stat: 'crit',      amount: 0.001,  max: 100, baseCost: 16,  curve: 1.038 },
  { id: 'm_critd',  name: 'Vorpal Mind',       icon: 'critDmgMult', desc: '+0.5% crit damage per level',     stat: 'critd',     amount: 0.005,  max: 100, baseCost: 18,  curve: 1.040 },
  { id: 'm_superCrit', name: 'Super Strike',   icon: 'starBurst', desc: '+0.5% Super Crit per level',      stat: 'superCrit', amount: 0.005,  max: 30,  baseCost: 25,  curve: 1.050 },
  { id: 'm_megaCrit',  name: 'Mega Strike',    icon: 'doubleHit', desc: '+0.2% Mega Crit per level',       stat: 'megaCrit',  amount: 0.002,  max: 25,  baseCost: 40,  curve: 1.055 },
  { id: 'm_armor',  name: 'Annunaki Plating',  icon: 'armor', desc: '+0.1 armor per level',            stat: 'armor',     amount: 0.1,    max: 80,  baseCost: 18,  curve: 1.038 },
  { id: 'm_regen',  name: 'Flow of Nirvana',   icon: 'regen', desc: '+0.003 HP/s per level',           stat: 'regen',     amount: 0.003,  max: 80,  baseCost: 20,  curve: 1.040 },
  { id: 'm_lvlBoomDmg', name: 'Shockwave Mastery', icon: 'areaMult', desc: '+10 explosion dmg per level',  stat: 'levelUpDmg',amount: 10,   max: 20,  baseCost: 280, curve: 1.06, unlock: 'poe_awk1' },
  { id: 'm_lvlBoomKB',  name: 'Earthshaker',        icon: 'knockbackWave', desc: '+20 explosion knockback/lvl', stat: 'levelUpKB', amount: 20,   max: 20,  baseCost: 240, curve: 1.05, unlock: 'poe_awk2' },
  { id: 'm_pickup', name: 'Tidal Pull',        icon: 'ironPull', desc: '+1% pickup range per level',      stat: 'pickup',    amount: 0.01,   max: 80,  baseCost: 12,  curve: 1.030 },
  { id: 'm_xp',     name: 'Memory of Lake',    icon: 'ui_codex', desc: '+0.5% XP per level',              stat: 'xp',        amount: 0.005,  max: 80,  baseCost: 22,  curve: 1.040 },
  { id: 'm_gold',   name: 'Goldsense',         icon: 'ui_moneybag', desc: '+0.5% gold per level',            stat: 'gold',      amount: 0.005,  max: 80,  baseCost: 18,  curve: 1.038 },
  { id: 'm_luck',   name: 'Eldritch Luck',     icon: 'luck', desc: '+0.05 luck per level',            stat: 'luck',      amount: 0.05,   max: 60,  baseCost: 25,  curve: 1.045 },
  { id: 'm_heal',   name: 'Vital Drops',       icon: 'heal', desc: '+0.5 HP from heart drops / lvl',  stat: 'heartHeal', amount: 0.5,    max: 40,  baseCost: 20,  curve: 1.040 },
  { id: 'm_zoom',   name: 'Eagle Eye',         icon: 'vision', desc: '+0.5% view range per level',      stat: 'zoom',      amount: 0.005,  max: 35,  baseCost: 30,  curve: 1.048 },
  { id: 'm_revive', name: 'Phoenix Echo',      icon: 'lifeline', desc: 'Revive once per run (50% HP)',    stat: 'revive',    amount: 1,      max: 1,   baseCost: 800, curve: 1.0 },
  { id: 'm_dodge',  name: 'Veil Walker',       icon: 'dodge', desc: '+0.1% dodge per level',           stat: 'dodge',     amount: 0.001,  max: 50,  baseCost: 35,  curve: 1.048 },
  { id: 'm_start',  name: 'Survivor\'s Cache', icon: 'ui_chest', desc: 'Start runs with +1 random card',  stat: 'startBoon', amount: 1,      max: 3,   baseCost: 600, curve: 2.0 },
];

export function metaCost(upg, currentLvl) {
  return Math.floor(upg.baseCost * Math.pow(upg.curve, currentLvl));
}

// ---------- WAVE / DIFFICULTY ----------
// Retuned so the first guardian is a WALL, not a speed bump. It used to arrive
// at t=110 — around run level 9-10 with the old XP curve, which is well past
// the point where a starting build can handle it comfortably. Moving it to
// t=150 against the steeper XP curve in engine.js lands the player at level
// 5-7 when Horus shows up, which is deliberately not enough: the first several
// attempts at a story node are SUPPOSED to end at that fight. The node pays a
// partial tier for reaching it (see campaign.js rewardTier), so those attempts
// are progress, not wasted time.
//
// The variety-before-density rule still holds throughout: every checkpoint in
// the opening five minutes adds a new enemy TYPE at a similar-or-slightly-
// higher spawn rate, never a new type AND a density jump in the same beat.
export const WAVE_TIMELINE = [
  { t: 0,   spawn: 1.5, types: ['slime'] },
  { t: 18,  spawn: 1.9, types: ['slime', 'bat'] },
  { t: 40,  spawn: 2.2, types: ['slime', 'bat', 'ghoul'] },
  { t: 68,  spawn: 2.5, types: ['bat', 'ghoul', 'ranger'] },
  { t: 95,  spawn: 2.8, types: ['ghoul', 'ranger', 'brute'] },
  { t: 122, spawn: 3.0, types: ['ghoul', 'ranger', 'brute', 'charger'] },
  { t: 150, spawn: 3.1, types: ['ghoul', 'ranger', 'brute', 'charger'], event: 'bossOcular' },
  { t: 185, spawn: 3.3, types: ['crystalite', 'soulshard', 'bat', 'ghoul'] },
  { t: 220, spawn: 3.5, types: ['brute', 'ranger', 'charger', 'crystalite'] },
  { t: 265, spawn: 3.8, types: ['brute', 'charger', 'bat', 'ghoul', 'soulshard'] },
  { t: 310, spawn: 4.0, types: ['charger', 'ranger', 'necron'], event: 'bossNecromancer' },
  { t: 345, spawn: 4.2, types: ['bonewalker', 'voidspawn', 'charger', 'ranger'] },
  { t: 400, spawn: 4.5, types: ['charger', 'ranger', 'necron', 'bonewalker'], event: 'bossOcular' },
  { t: 460, spawn: 5.0, types: ['necron', 'charger', 'brute'], event: 'bossVoidTitan' },
  { t: 500, spawn: 5.2, types: ['steelbrute', 'lightningbug', 'necron', 'charger'] },
  { t: 570, spawn: 6.0, types: ['necron', 'charger', 'brute', 'steelbrute'], event: 'bossAida' },
  { t: 605, spawn: 6.2, types: ['techsoldier', 'nanoswarm', 'necron', 'lightningbug'] },
  // Endless waves (after A.I.D.A. besegras) — the 3 new bosses (Tidebreaker,
  // Sentinel Prime, Hollow Queen) are woven into the rotation alongside the
  // originals so a long endless run keeps seeing fresh attack patterns
  // instead of just looping the same 4 bosses.
  { t: 620, spawn: 7.0, types: ['necron', 'charger', 'brute', 'ranger'] },
  { t: 720, spawn: 8.0, types: ['necron', 'charger', 'brute'], event: 'bossTidebreaker' },
  { t: 840, spawn: 9.5, types: ['necron', 'charger', 'brute', 'ranger'] },
  { t: 960, spawn: 11.0, types: ['necron', 'charger', 'brute'], event: 'bossSentinel' },
  { t: 1100, spawn: 12.5, types: ['necron', 'charger', 'brute', 'ranger'] },
  { t: 1240, spawn: 14.0, types: ['necron', 'charger', 'brute'], event: 'bossHollowQueen' },
  { t: 1380, spawn: 15.5, types: ['necron', 'charger', 'brute', 'ranger'] },
  { t: 1520, spawn: 17.0, types: ['necron', 'charger', 'brute'], event: 'bossOcular' },
  { t: 1660, spawn: 18.5, types: ['necron', 'charger', 'brute', 'ranger'] },
  { t: 1800, spawn: 20.0, types: ['necron', 'charger', 'brute'], event: 'bossNecromancer' },
  { t: 1940, spawn: 21.5, types: ['necron', 'charger', 'brute', 'ranger'] },
  { t: 2080, spawn: 23.0, types: ['necron', 'charger', 'brute'], event: 'bossVoidTitan' },
  { t: 2220, spawn: 24.5, types: ['necron', 'charger', 'brute', 'ranger'] },
  { t: 2360, spawn: 26.0, types: ['necron', 'charger', 'brute'], event: 'bossTidebreaker' },
  { t: 2500, spawn: 27.5, types: ['necron', 'charger', 'brute', 'ranger'] },
  { t: 2640, spawn: 29.0, types: ['necron', 'charger', 'brute'], event: 'bossSentinel' },
];

export function waveAt(t) {
  let cur = WAVE_TIMELINE[0];
  for (const w of WAVE_TIMELINE) if (w.t <= t) cur = w;
  return cur;
}

export function nextBossEvent(t) {
  for (const w of WAVE_TIMELINE) if (w.t > t && w.event) return w;
  return null;
}
