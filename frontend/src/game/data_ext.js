// Extended game data: skills, equipment, chests, quests, daily rewards, parts, avatars.
import { WEAPONS } from './data';
import { GEAR_SLOTS, generateGearItem } from './gear';

// ---------- AVATARS ----------
export const AVATARS = [
  { id: 'drop',    icon: 'ui_waterdrop', name: 'Pure Drop',    desc: 'A waterdrop of the Lake.' },
  { id: 'flame',   icon: 'ui_flame',     name: 'Emberkin',     desc: 'Born from fire and tide.' },
  { id: 'void',    icon: 'ui_tornado',   name: 'Voidwalker',   desc: 'Touched by the eldritch.' },
  { id: 'rune',    icon: 'ui_star',      name: 'Runebearer',   desc: 'Marked by A.I.D.A.' },
  { id: 'horus',   icon: 'ui_eye',       name: 'Eye-bound',    desc: 'Sees through Horus.' },
  { id: 'spectre', icon: 'ui_void',      name: 'Spectre',      desc: 'Already dead.' },
];

// ---------- RANK / PROFILE COSMETICS ----------
// Rank is derived from account level (save.profile.level), NOT stored —
// it's always max(0, floor(level/4)), capped at 25, so level 100 lands
// exactly on rank 25 (the explicit calibration point). That reads as
// "roughly every 4-5 levels", close enough to the "every 5th level" ask
// while still hitting the level-100-=-rank-25 anchor exactly.
export const MAX_RANK = 25;
export function getRank(level) {
  return Math.max(0, Math.min(MAX_RANK, Math.floor((level || 1) / 4)));
}
export const RANK_TITLES = [
  'NewDroplet', 'Trickle', 'Puddle', 'Splash', 'Ripple',
  'Stream', 'Brook', 'Creek', 'Rivulet', 'Current',
  'Cascade', 'Rapids', 'Torrent', 'Tempest', 'Maelstrom',
  'Tsunami', 'Deluge', 'Monsoon', 'Typhoon', 'Hurricane',
  'Vortex Bound', 'Leviathan', 'Tidal Master', 'Ocean Sovereign', 'Aqua Ascendant',
  'H2O — ELITE OF WATERDROP SURVIVOR',
];

// Every rank-up grants something for the profile — a frame, a headband, a
// name color, or (once, at a fun milestone) the idle cigar cosmetic. Ship
// colors unlock for Star Raid on the same ladder.
export const PROFILE_FRAMES = [
  { id: 'none',    rank: 0,  name: 'Plain',        css: 'none' },
  { id: 'bronze',  rank: 5,  name: 'Bronze Ring',  css: '3px solid #a5673f' },
  { id: 'silver',  rank: 10, name: 'Silver Ring',  css: '3px solid #c8ccd4' },
  { id: 'gold',    rank: 15, name: 'Gold Ring',    css: '3px solid #ffd166' },
  { id: 'mist',    rank: 20, name: 'Mist Frame',   css: '3px solid #4dffe0', glow: '0 0 14px #4dffe099' },
  { id: 'elite',   rank: 25, name: 'Elite Frame',  css: '3px solid #ff3146', glow: '0 0 20px #ff3146cc' },
];
export const HEADBANDS = [
  { id: 'none',   rank: 0,  name: 'None',           color: null },
  { id: 'red',    rank: 3,  name: 'Red Bandana',    color: '#ff3146' },
  { id: 'blue',   rank: 8,  name: 'Blue Bandana',   color: '#4dc4ff' },
  { id: 'gold',   rank: 13, name: 'Gold Headband',  color: '#ffd166' },
  { id: 'void',   rank: 18, name: 'Void Wrap',      color: '#b362ff' },
  { id: 'elite',  rank: 25, name: 'Elite Crown',    color: '#ff3146' },
];
export const NAME_COLORS = [
  { id: 'white',  rank: 0,  name: 'White',   color: '#f0f0f5' },
  { id: 'teal',   rank: 4,  name: 'Teal',    color: '#4dffd4' },
  { id: 'gold',   rank: 9,  name: 'Gold',    color: '#ffd166' },
  { id: 'purple', rank: 14, name: 'Purple',  color: '#b362ff' },
  { id: 'red',    rank: 19, name: 'Crimson', color: '#ff3146' },
  { id: 'rainbow',rank: 25, name: 'Prismatic', color: 'rainbow' },
];
export const SHIP_COLORS = [
  { id: 'teal',   rank: 0,  name: 'Teal',    color: '#5fd6ff' },
  { id: 'orange', rank: 6,  name: 'Ember',   color: '#ff9033' },
  { id: 'green',  rank: 11, name: 'Toxic',   color: '#7ad96b' },
  { id: 'purple', rank: 16, name: 'Void',    color: '#b362ff' },
  { id: 'gold',   rank: 21, name: 'Royal',   color: '#ffd166' },
];
export const CIGAR_UNLOCK_RANK = 7; // idle cigar cosmetic (see task: character polish)

export const STATION_VISTAS = [
  { id: 'earth', rank: 0, name: 'Earth Twilight', desc: 'Azure orbital atmospheric glow & city lights', src: '/backgrounds/vista_earth.jpg', color: '#5fd6ff' },
  { id: 'void', rank: 0, name: 'Deep Quasar', desc: 'Purple nebula & glowing pulsar disk', src: '/backgrounds/vista_void.jpg', color: '#b362ff' },
  { id: 'solstice', rank: 0, name: 'Solstice Sun', desc: 'Golden solar flares & sacred geometry corona', src: '/backgrounds/vista_solstice.jpg', color: '#ffd166' },
  { id: 'bloodmoon', rank: 0, name: 'Blood Moon', desc: 'Crimson eclipse & dark occult orbital trees', src: '/backgrounds/vista_bloodmoon.jpg', color: '#ff3355' },
  { id: 'cyber', rank: 0, name: 'Cyber Megacity', desc: 'High-altitude neon highway ecumenopolis', src: '/backgrounds/vista_cyber.jpg', color: '#39ff14' },
];

// ---------- SKILL TREE ----------
// Branches: Combat, Mobility, Defense, Greed, Arcane
// Each skill has cost (SP), max level, prerequisite, and effect (applied as run modifiers).
// NOTE: this legacy tree's UI is superseded by the radial POE_TREE
// (game/poe_tree.js, rendered by SkillTree.jsx) — only SKILL_INDEX below is
// still read at runtime (GameScreen.jsx, for `sk_`-prefixed effects), so
// these icon fields are never rendered. Kept as GameIcon keys anyway rather
// than emoji so the table doesn't look stale/broken if it's ever surfaced.
export const SKILL_TREE = {
  combat: {
    name: 'COMBAT', color: '#ff3146', icon: 'ui_blade',
    skills: [
      { id: 'sk_atk',     name: 'Edge',          icon: 'ui_blade',  max: 20, costPerLvl: 1, req: null,           desc: '+3% damage / lvl',                 stat: 'dmg',     amount: 0.03 },
      { id: 'sk_crit',    name: 'Sharp Eye',     icon: 'ui_eye',  max: 20, costPerLvl: 1, req: 'sk_atk',       desc: '+2% crit chance / lvl',           stat: 'crit',    amount: 0.02 },
      { id: 'sk_headshot',name: 'Headshot',      icon: 'part_sight', max: 1, costPerLvl: 3, req: 'sk_crit',       desc: 'ACTIVE: 8% chance to one-shot non-bosses', stat: 'headshot', amount: 0.08, active: true },
      { id: 'sk_berserk', name: 'Berserker',     icon: 'pVamp', max: 1, costPerLvl: 4, req: 'sk_headshot',   desc: 'ACTIVE: +40% dmg below 30% HP',   stat: 'berserk', amount: 1, active: true },
      { id: 'sk_pierce',  name: 'Piercing',      icon: 'harpoon', max: 15, costPerLvl: 2, req: 'sk_atk',        desc: '+1 pierce / lvl',                 stat: 'pierce',  amount: 1 },
      { id: 'sk_proj',    name: 'Multishot',     icon: 'scatter', max: 8,  costPerLvl: 3, req: 'sk_pierce',     desc: '+1 projectile / lvl',             stat: 'proj',    amount: 1 },
    ],
  },
  mobility: {
    name: 'MOBILITY', color: '#4dffd4', icon: 'boot',
    skills: [
      { id: 'sk_spd',     name: 'Light Step',    icon: 'boot', max: 20, costPerLvl: 1, req: null,            desc: '+3% move speed / lvl',            stat: 'mspd',    amount: 0.03 },
      { id: 'sk_dash',    name: 'Dash',          icon: 'pQuick', max: 1, costPerLvl: 2, req: 'sk_spd',        desc: 'ACTIVE: SHIFT to dash (i-frames)', stat: 'dash',   amount: 1, active: true },
      { id: 'sk_dashcd',  name: 'Quick Recall',  icon: 'ui_clock',  max: 15, costPerLvl: 2, req: 'sk_dash',       desc: '-15% dash cooldown / lvl',        stat: 'dashcd',  amount: 0.15 },
      { id: 'sk_blink',   name: 'Blink',         icon: 'tornado', max: 1, costPerLvl: 4, req: 'sk_dashcd',     desc: 'ACTIVE: Dash teleports & deals AoE', stat: 'blink', amount: 1, active: true },
      { id: 'sk_dodge',   name: 'Phasing',       icon: 'ui_ghost', max: 15, costPerLvl: 2, req: 'sk_spd',        desc: '+3% dodge / lvl',                 stat: 'dodge',   amount: 0.03 },
    ],
  },
  defense: {
    name: 'DEFENSE', color: '#ffd166', icon: 'ui_shield',
    skills: [
      { id: 'sk_hp',      name: 'Vital',         icon: 'heart', max: 20, costPerLvl: 1, req: null,            desc: '+12 max HP / lvl',                stat: 'maxhp',   amount: 12 },
      { id: 'sk_armor',   name: 'Plated',        icon: 'ui_shield', max: 15, costPerLvl: 2, req: 'sk_hp',         desc: '+1 armor / lvl',                  stat: 'armor',   amount: 1 },
      { id: 'sk_regen',   name: 'Regrowth',      icon: 'ui_leaf', max: 15, costPerLvl: 2, req: 'sk_hp',         desc: '+0.2 HP/s / lvl',                 stat: 'regen',   amount: 0.2 },
      { id: 'sk_shield',  name: 'Aegis',         icon: 'ui_star', max: 1, costPerLvl: 4, req: 'sk_armor',      desc: 'ACTIVE: Absorb 1 hit / 25s',      stat: 'shield',  amount: 1, active: true },
      { id: 'sk_revive',  name: 'Phoenix',       icon: 'pHoly', max: 1, costPerLvl: 6, req: 'sk_regen',      desc: 'ACTIVE: Revive once at 50% HP',   stat: 'revive',  amount: 1, active: true },
    ],
  },
  greed: {
    name: 'GREED', color: '#ffd700', icon: 'gold',
    skills: [
      { id: 'sk_gold',    name: 'Greed',         icon: 'gold', max: 20, costPerLvl: 1, req: null,            desc: '+8% gold / lvl',                  stat: 'gold',    amount: 0.08 },
      { id: 'sk_xp',      name: 'Wisdom',        icon: 'ui_codex', max: 20, costPerLvl: 1, req: null,            desc: '+5% XP / lvl',                    stat: 'xp',      amount: 0.05 },
      { id: 'sk_magnet',  name: 'Magnet',        icon: 'pMagnet', max: 15, costPerLvl: 2, req: 'sk_gold',       desc: '+12% pickup range / lvl',         stat: 'pickup',  amount: 0.12 },
      { id: 'sk_luck',    name: 'Fortune',       icon: 'ui_leaf', max: 15, costPerLvl: 2, req: 'sk_xp',         desc: '+0.5 luck / lvl (better rolls)',  stat: 'luck',    amount: 0.5 },
      { id: 'sk_chest',   name: 'Chest Sense',   icon: 'ui_chest', max: 1, costPerLvl: 4, req: 'sk_magnet',     desc: 'ACTIVE: Chest enemies spawn 2x more often', stat: 'chestSense', amount: 1, active: true },
    ],
  },
  arcane: {
    name: 'ARCANE', color: '#b362ff', icon: 'ui_orb',
    skills: [
      { id: 'sk_area',    name: 'Wider Wake',    icon: 'tornado', max: 20, costPerLvl: 1, req: null,            desc: '+5% area / lvl',                  stat: 'area',    amount: 0.05 },
      { id: 'sk_atks',    name: 'Quickened',     icon: 'ui_clock',  max: 20, costPerLvl: 1, req: null,            desc: '+3% atk speed / lvl',             stat: 'atks',    amount: 0.03 },
      { id: 'sk_critdmg', name: 'Critical Will', icon: 'pVamp', max: 15, costPerLvl: 2, req: 'sk_atks',       desc: '+10% crit damage / lvl',          stat: 'critd',   amount: 0.10 },
      { id: 'sk_aida',    name: 'A.I.D.A. Link', icon: 'ui_eye', max: 1, costPerLvl: 6, req: 'sk_critdmg',    desc: 'ACTIVE: Bonus damage to bosses +30%', stat: 'bossDmg', amount: 0.30, active: true },
      { id: 'sk_void',    name: 'Voidcaller',    icon: 'ui_void', max: 1, costPerLvl: 4, req: 'sk_area',       desc: 'ACTIVE: 10% chance to spawn void burst on kill', stat: 'voidBurst', amount: 0.10, active: true },
    ],
  },
};

// Flatten skill lookup
export const SKILL_INDEX = (() => {
  const m = {};
  for (const k of Object.keys(SKILL_TREE)) for (const s of SKILL_TREE[k].skills) m[s.id] = { ...s, branch: k };
  return m;
})();

// ---------- WEAPON PARTS (Weaponsmith) ----------
// Each part has 4 tiers. Applied to one weapon owned permanently across runs.
//
// NOTE ON SHAPE: these six tracks are the MECHANICS. Which of them a given
// weapon actually offers, and what they are called, is decided by
// `weaponTracks()` further down — a katana has no magazine and no bullets, and
// offering it "Extended Magazine" made the whole screen read as a spreadsheet
// bolted onto the weapons rather than as a smith who knows what he is holding.
export const WEAPON_PARTS = {
  magazine: { name: 'Magazine', icon: 'part_magazine', tiers: [
    { name: 'Standard',  bonus: 0,   cost: 0 },
    { name: 'Extended',  bonus: 4,   cost: 80 },
    { name: 'Drum',      bonus: 10,  cost: 240 },
    { name: 'Cosmic',    bonus: 20,  cost: 600 },
  ], stat: 'magazine' },
  sight: { name: 'Sight', icon: 'part_sight', tiers: [
    { name: 'Iron',      crit: 0,    cost: 0 },
    { name: 'Red Dot',   crit: 0.04, cost: 100 },
    { name: 'Tactical',  crit: 0.08, cost: 280 },
    { name: 'Eye Of Horus', crit: 0.16, cost: 700 },
  ], stat: 'sight' },
  barrel: { name: 'Barrel', icon: 'part_barrel', tiers: [
    { name: 'Short',     dmg: 0,     cost: 0 },
    { name: 'Standard',  dmg: 0.10,  cost: 120 },
    { name: 'Long',      dmg: 0.22,  cost: 320 },
    { name: 'Annunaki',  dmg: 0.45,  cost: 800 },
  ], stat: 'barrel' },
  bullets: { name: 'Bullets', icon: 'part_bullets', tiers: [
    { name: 'FMJ',       effect: 'none',  bonus: 0,     cost: 0 },
    { name: 'AP',        effect: 'pierce', bonus: 1,    cost: 150 },
    { name: 'Incendiary',effect: 'burn',   bonus: 0.06, cost: 350 },
    { name: 'Voidlash',  effect: 'chain',  bonus: 0.25, cost: 900 },
  ], stat: 'bullets' },
  rarity: { name: 'Rarity', icon: 'ui_star', tiers: [
    { name: 'Common',    mult: 1.00, cost: 0 },
    { name: 'Magic',     mult: 1.15, cost: 200 },
    { name: 'Rare',      mult: 1.32, cost: 500 },
    { name: 'Epic',      mult: 1.55, cost: 1200 },
    { name: 'Legendary', mult: 1.85, cost: 3000 },
  ], stat: 'rarity' },
  // Unlocks slots to assign Elements (see data_ext2.js ELEMENTS) to this
  // weapon's bullets — Weaponsmith.jsx shows an element picker once slots > 0.
  element: { name: 'Elemental Rounds', icon: 'ui_orb', tiers: [
    { name: 'None',          slots: 0, cost: 0 },
    { name: 'Single Element',slots: 1, cost: 250 },
    { name: 'Dual Cycling',  slots: 2, cost: 700 },
  ], stat: 'element' },
};

// ---------- PER-WEAPON PART LABEL OVERRIDES ----------
// Each weapon may override what each "slot" is called + the tier names so the
// upgrades feel native to that weapon. Mechanics stay the same; only labels change.
export const WEAPON_PART_OVERRIDES = {
  // Was keyed `meteor` — the BEHAVIOUR, not a weapon id — so it was never
  // read by anything. The real weapon is `meteorRain`, and these names were
  // clearly written for it.
  meteorRain: {
    magazine: { name: 'Meteor Volume',  icon: 'cosmicRain', tierNames: ['Solo', 'Pair', 'Cluster', 'Swarm'] },
    sight:    { name: 'Targeting',      icon: 'part_sight', tierNames: ['Manual', 'Tracking', 'Predictive', 'Eye of Horus'] },
    barrel:   { name: 'Impact',         icon: 'pExplode', tierNames: ['Light', 'Heavy', 'Devastating', 'Annunaki'] },
    bullets:  { name: 'Meteor Type',    icon: 'part_bullets', tierNames: ['Stone', 'Burning', 'Splitting', 'Voidshard'] },
  },
  voidBeam: {
    magazine: { name: 'Power Cell',     icon: 'part_magazine', tierNames: ['Standard', 'Extended', 'Reactor', 'Cosmic'] },
    sight:    { name: 'Lens',           icon: 'part_sight', tierNames: ['Plain', 'Coated', 'Prismatic', 'Eye of Horus'] },
    barrel:   { name: 'Aperture',       icon: 'tornado', tierNames: ['Narrow', 'Standard', 'Wide', 'Annunaki'] },
    bullets:  { name: 'Beam Type',      icon: 'ui_star', tierNames: ['Pure', 'Pierce', 'Burning', 'Voidlash'] },
  },
  emberOrbs: {
    magazine: { name: 'Orb Count',      icon: 'emberOrbs', tierNames: ['Two', 'Three', 'Four', 'Six'] },
    sight:    { name: 'Orbit Pattern',  icon: 'part_sight', tierNames: ['Tight', 'Wide', 'Elliptical', 'Eye of Horus'] },
    barrel:   { name: 'Ember Power',    icon: 'ui_flame', tierNames: ['Spark', 'Flame', 'Inferno', 'Annunaki'] },
    bullets:  { name: 'Burn',           icon: 'part_bullets', tierNames: ['None', 'Brief', 'Lasting', 'Voidburn'] },
  },
  // (A `shotgun:` block lived here. Same mistake as `meteor` — keyed to the
  // behaviour rather than to a weapon, so never read — and its contents are
  // now ARCHETYPES.shotgun, which reaches every scattergun in the game
  // instead of one id that does not exist.)
  tidalShotgun: {
    magazine: { name: 'Shell Box',      icon: 'part_magazine', tierNames: ['Standard', 'Extended', 'Drum', 'Cosmic'] },
    sight:    { name: 'Choke',          icon: 'part_sight', tierNames: ['Open', 'Modified', 'Tight', 'Eye of Horus'] },
    barrel:   { name: 'Wave Length',    icon: 'pWave', tierNames: ['Ripple', 'Wave', 'Tidal', 'Tsunami'] },
    bullets:  { name: 'Shell Type',     icon: 'ui_waterdrop', tierNames: ['Buckshot', 'Slugs', 'Bursting', 'Voidshell'] },
  },
  iceLance: {
    magazine: { name: 'Shard Stack',    icon: 'frost', tierNames: ['Single', 'Pair', 'Triple', 'Hailstorm'] },
    sight:    { name: 'Lock',           icon: 'part_sight', tierNames: ['Manual', 'Tracking', 'Auto-Lock', 'Eye of Horus'] },
    barrel:   { name: 'Spear Length',   icon: 'trident', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
    bullets:  { name: 'Frost Type',     icon: 'frost', tierNames: ['Chill', 'Pierce', 'Freezing', 'Voidfrost'] },
  },
  plasmaLance: {
    magazine: { name: 'Plasma Cell',    icon: 'part_magazine', tierNames: ['Standard', 'Extended', 'Reactor', 'Cosmic'] },
    sight:    { name: 'Optics',         icon: 'part_sight', tierNames: ['Plain', 'Holographic', 'Smart', 'Eye of Horus'] },
    barrel:   { name: 'Coil',           icon: 'ui_bolt', tierNames: ['Single', 'Twin', 'Triple', 'Annunaki'] },
    bullets:  { name: 'Charge',         icon: 'ui_star', tierNames: ['Standard', 'Pierce', 'Overcharged', 'Voidcharge'] },
  },
  runicRifle: {
    magazine: { name: 'Rune Quiver',    icon: 'scroll', tierNames: ['Standard', 'Extended', 'Bound', 'Cosmic Tome'] },
    sight:    { name: 'Rune Sight',     icon: 'ui_eye', tierNames: ['Plain', 'Etched', 'Inscribed', 'Eye of Horus'] },
    barrel:   { name: 'Shaft',          icon: 'part_barrel', tierNames: ['Oak', 'Bone', 'Ash', 'Annunaki'] },
    bullets:  { name: 'Rune Type',      icon: 'ui_orb', tierNames: ['Common', 'Pierce', 'Burning', 'Voidrune'] },
  },
  twinSMG: {
    magazine: { name: 'Twin Mag',       icon: 'part_magazine', tierNames: ['Standard', 'Extended', 'Drum', 'Cosmic'] },
    sight:    { name: 'Sight',          icon: 'part_sight', tierNames: ['Iron', 'Red Dot', 'Tactical', 'Eye of Horus'] },
    barrel:   { name: 'Twin Barrel',    icon: 'part_barrel', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
    bullets:  { name: 'Bullets',        icon: 'part_bullets', tierNames: ['FMJ', 'AP', 'Incendiary', 'Voidlash'] },
  },
  runebolts: {
    magazine: { name: 'Bolt Quiver',    icon: 'runeBolt', tierNames: ['Standard', 'Extended', 'Bound', 'Cosmic'] },
    sight:    { name: 'Rune Sight',     icon: 'ui_eye', tierNames: ['Plain', 'Etched', 'Bound', 'Eye of Horus'] },
    barrel:   { name: 'Bow Tension',    icon: 'part_barrel', tierNames: ['Standard', 'Heavy', 'Master', 'Annunaki'] },
    bullets:  { name: 'Bolt Type',      icon: 'ui_orb', tierNames: ['Wood', 'Pierce', 'Burning', 'Voidrune'] },
  },
  bloodscythe_legacy: {
    magazine: { name: 'Swing Range',    icon: 'part_magazine', tierNames: ['Short', 'Extended', 'Wide', 'Cosmic'] },
    sight:    { name: 'Focus',          icon: 'part_sight', tierNames: ['Iron', 'Sharp', 'Razor', 'Eye of Horus'] },
    barrel:   { name: 'Blade',          icon: 'ui_blade', tierNames: ['Standard', 'Heavy', 'Long', 'Annunaki'] },
    bullets:  { name: 'Edge Type',      icon: 'pVamp', tierNames: ['Plain', 'Bleeding', 'Burning', 'Voidedge'] },
  },
  hydropistol: {
    magazine: { name: 'Water Chamber',  icon: 'ui_waterdrop', tierNames: ['Standard', 'Extended', 'Pressurized', 'Cosmic'] },
    sight:    { name: 'Scope',          icon: 'part_sight', tierNames: ['Iron', 'Red Dot', 'Tactical', 'Eye of Horus'] },
    barrel:   { name: 'Nozzle',         icon: 'part_barrel', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
    bullets:  { name: 'Ammo Type',      icon: 'ui_waterdrop', tierNames: ['Aqua', 'Burst', 'Pressurized', 'Voidwater'] },
  },
  bloodscythe: {
    magazine: { name: 'Blade Width',    icon: 'ui_blade', tierNames: ['Thin', 'Standard', 'Wide', 'Void-Forged'] },
    sight:    { name: 'Blood Sense',    icon: 'pVamp', tierNames: ['None', 'Aware', 'Keen', 'Eye of Horus'] },
    barrel:   { name: 'Blade Edge',     icon: 'ui_blade', tierNames: ['Dull', 'Sharp', 'Razor', 'Annunaki'] },
    bullets:  { name: 'Cut Type',       icon: 'ui_daggers', tierNames: ['Slash', 'Bleeding', 'Vorpal', 'Voidedge'] },
  },
  arcTesla: {
    magazine: { name: 'Voltage Cell',   icon: 'part_magazine', tierNames: ['Standard', 'Extended', 'Capacitor', 'Cosmic'] },
    sight:    { name: 'Conductor',      icon: 'ui_bolt', tierNames: ['Copper', 'Silver', 'Gold', 'Eye of Horus'] },
    barrel:   { name: 'Arc Range',      icon: 'staticField', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
    bullets:  { name: 'Tesla Type',     icon: 'ui_bolt', tierNames: ['Static', 'Pulse', 'Chain', 'Voidbolt'] },
  },
};

// ---------- WHICH TRACKS A WEAPON EVEN HAS -----------------------------------
// Every weapon used to be offered the same six upgrades. A katana was sold an
// "Extended Magazine" and "AP Bullets"; a beam was sold a "Barrel Length". The
// NAMES could be overridden per weapon, but the SET could not, so the screen
// always described a rifle no matter what was selected.
//
// Tracks are derived from the weapon's own behaviour, so a newly added weapon
// is sensible immediately rather than whenever someone remembers to write an
// override for it. Overrides still apply on top: the archetype makes a weapon
// SENSIBLE, the override makes it SPECIFIC.
//
// `rarity` and `element` are deliberately universal — they are the only two
// tracks that mean the same thing on every weapon in the game.
const ARCHETYPES = {
  melee: {
    label: 'Blade',
    tracks: ['barrel', 'sight', 'rarity', 'element'],
    names: {
      barrel: { name: 'Edge',   icon: 'ui_blade', tierNames: ['Dull', 'Honed', 'Razor', 'Annunaki'] },
      sight:  { name: 'Temper', icon: 'ui_flame', tierNames: ['Soft', 'Tempered', 'Folded', 'Eye of Horus'] },
    },
  },
  beam: {
    label: 'Emitter',
    // No magazine: a beam draws from a cell rather than carrying rounds, and
    // that cell is what the `bullets` track represents here.
    tracks: ['barrel', 'sight', 'bullets', 'rarity', 'element'],
    names: {
      barrel:  { name: 'Aperture',  icon: 'tornado', tierNames: ['Narrow', 'Standard', 'Wide', 'Annunaki'] },
      sight:   { name: 'Lens',      icon: 'part_sight', tierNames: ['Plain', 'Coated', 'Prismatic', 'Eye of Horus'] },
      bullets: { name: 'Beam Type', icon: 'ui_star', tierNames: ['Pure', 'Piercing', 'Burning', 'Voidlash'] },
    },
  },
  orbit: {
    label: 'Orbital',
    tracks: ['magazine', 'barrel', 'bullets', 'rarity', 'element'],
    names: {
      magazine: { name: 'Orb Count',  icon: 'emberOrbs', tierNames: ['Two', 'Three', 'Four', 'Six'] },
      barrel:   { name: 'Orb Power',  icon: 'ui_flame', tierNames: ['Spark', 'Flame', 'Inferno', 'Annunaki'] },
      bullets:  { name: 'Orb Effect', icon: 'ui_star', tierNames: ['Plain', 'Searing', 'Lasting', 'Voidburn'] },
    },
  },
  chain: {
    label: 'Conductor',
    tracks: ['barrel', 'sight', 'bullets', 'rarity', 'element'],
    names: {
      barrel:  { name: 'Arc Range', icon: 'staticField', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
      sight:   { name: 'Conductor', icon: 'ui_bolt', tierNames: ['Copper', 'Silver', 'Gold', 'Eye of Horus'] },
      bullets: { name: 'Arc Type',  icon: 'ui_bolt', tierNames: ['Static', 'Pulse', 'Chaining', 'Voidbolt'] },
    },
  },
  aoe: {
    label: 'Ordnance',
    tracks: ['barrel', 'sight', 'bullets', 'rarity', 'element'],
    names: {
      barrel:  { name: 'Yield',   icon: 'pExplode', tierNames: ['Light', 'Heavy', 'Devastating', 'Annunaki'] },
      sight:   { name: 'Focus',   icon: 'part_sight', tierNames: ['Loose', 'Tuned', 'Precise', 'Eye of Horus'] },
      bullets: { name: 'Payload', icon: 'pExplode', tierNames: ['Plain', 'Piercing', 'Burning', 'Voidcharge'] },
    },
  },
  shotgun: {
    label: 'Scattergun',
    tracks: ['magazine', 'sight', 'barrel', 'bullets', 'rarity', 'element'],
    names: {
      magazine: { name: 'Shell Box',  icon: 'part_magazine', tierNames: ['Standard', 'Extended', 'Drum', 'Cosmic'] },
      sight:    { name: 'Choke',      icon: 'part_sight', tierNames: ['Open', 'Modified', 'Full', 'Eye of Horus'] },
      barrel:   { name: 'Barrel',     icon: 'part_barrel', tierNames: ['Sawn-Off', 'Standard', 'Long', 'Annunaki'] },
      bullets:  { name: 'Shell Type', icon: 'part_bullets', tierNames: ['Buckshot', 'Slugs', 'Incendiary', 'Voidshell'] },
    },
  },
  meteor: {
    label: 'Bombardment',
    tracks: ['magazine', 'sight', 'barrel', 'bullets', 'rarity', 'element'],
    names: {
      magazine: { name: 'Volume',    icon: 'cosmicRain', tierNames: ['Solo', 'Pair', 'Cluster', 'Swarm'] },
      sight:    { name: 'Targeting', icon: 'part_sight', tierNames: ['Manual', 'Tracking', 'Predictive', 'Eye of Horus'] },
      barrel:   { name: 'Impact',    icon: 'pExplode', tierNames: ['Light', 'Heavy', 'Devastating', 'Annunaki'] },
      bullets:  { name: 'Warhead',   icon: 'part_bullets', tierNames: ['Stone', 'Burning', 'Splitting', 'Voidshard'] },
    },
  },
  drone: {
    label: 'Wing',
    tracks: ['magazine', 'sight', 'barrel', 'rarity', 'element'],
    names: {
      magazine: { name: 'Bay Size', icon: 'part_magazine', tierNames: ['One', 'Two', 'Three', 'Squadron'] },
      sight:    { name: 'Optics',   icon: 'part_sight', tierNames: ['Plain', 'Tracking', 'Smart', 'Eye of Horus'] },
      barrel:   { name: 'Ordnance', icon: 'pExplode', tierNames: ['Light', 'Standard', 'Heavy', 'Annunaki'] },
    },
  },
  projectile: {
    label: 'Firearm',
    tracks: ['magazine', 'sight', 'barrel', 'bullets', 'rarity', 'element'],
    names: {},   // the base WEAPON_PARTS names already describe a firearm
  },
};

// The set of tracks one weapon offers.
//
// An auto-firing weapon with no magazine in its base stats has nothing to
// extend, so the magazine track is dropped for it whatever its archetype says.
// This is the rule that stops "Extended Magazine" appearing on a turret. Orbit
// and drone keep theirs because for them it counts orbs and bays, not rounds.
export function weaponTracks(wid, weapon) {
  const arch = ARCHETYPES[(weapon && weapon.behaviour) || 'projectile'] || ARCHETYPES.projectile;
  const countsUnits = arch === ARCHETYPES.orbit || arch === ARCHETYPES.drone || arch === ARCHETYPES.meteor;
  const hasMag = !!(weapon && weapon.base && weapon.base.magazine);
  const tracks = (!hasMag && !countsUnits)
    ? arch.tracks.filter(t => t !== 'magazine')
    : arch.tracks.slice();
  return { tracks, label: arch.label };
}

// Display name/icon/tier names for one track on one weapon. Three layers, most
// specific wins: the base mechanic, then the behaviour archetype, then the
// weapon's own override.
export function trackInfo(wid, weapon, track) {
  const base = WEAPON_PARTS[track] || {};
  const arch = ARCHETYPES[(weapon && weapon.behaviour) || 'projectile'] || ARCHETYPES.projectile;
  const a = (arch.names || {})[track] || {};
  const o = (WEAPON_PART_OVERRIDES[wid] || {})[track] || {};
  return {
    name: o.name || a.name || base.name,
    icon: o.icon || a.icon || base.icon,
    tierNames: o.tierNames || a.tierNames || null,
  };
}

// ---------- EQUIPMENT (chest drops) ----------
// ---------- CHESTS ----------
export const CHESTS = [
  { id: 'wood',     name: 'Standard Chest',  icon: 'ui_chest',  cost: 50,   currency: 'gems', rolls: 1, rarityWeights: { common: 80, uncommon: 18, rare: 2 } },
  { id: 'iron',     name: 'Premium Chest',   icon: 'ui_chest',  cost: 200,  currency: 'gems', rolls: 1, rarityWeights: { uncommon: 55, rare: 32, epic: 12, legendary: 1 } },
  { id: 'gold',     name: 'Epic Chest',      icon: 'ui_trophy', cost: 500,  currency: 'gems', rolls: 2, rarityWeights: { rare: 52, epic: 36, legendary: 12 } },
  { id: 'resource', name: 'Resource Cache',  icon: 'ui_moneybag', cost: 10,   currency: 'gems', rolls: 1, rarityWeights: { common: 90, uncommon: 10 }, resourceOnly: true },
  { id: 'petEgg',   name: 'Pet Egg Chest',   icon: 'ui_egg',  cost: 50,   currency: 'gems', rolls: 1, rarityWeights: { common: 70, uncommon: 22, rare: 7, epic: 1 }, petOnly: true },
  { id: 'petPrem',  name: 'Premium Pet Chest',icon: 'ui_egg', cost: 250,  currency: 'gems', rolls: 1, rarityWeights: { uncommon: 40, rare: 38, epic: 18, legendary: 4 }, petOnly: true },
  { id: 'parts',    name: 'Parts Chest',     icon: 'ui_part',  cost: 100,  currency: 'gems', rolls: 2, rarityWeights: { common: 60, uncommon: 30, rare: 10 }, partsOnly: true },
  { id: 'annunaki', name: 'Annunaki Cache',  icon: 'ui_void',  cost: 4500, rolls: 3, rarityWeights: { epic: 70, legendary: 30 } },
];
// Chest tiers were rolled through their own tiny gear generator (rollEquip)
// that stored loot in save.inventory/save.equipped — a completely separate
// system from the one every other gear surface (GearPanel, Weaponsmith
// sockets/runes, gear leveling) actually reads: save.gearInventory /
// save.gearEquipped via game/gear.js. That meant chest loot was a dead end.
// rollChest now generates real gear items through generateGearItem so a
// chest drop lands in the same inventory GearPanel shows. Chest tier tables
// use 'uncommon' for the second rarity rung; the real gear rarity ladder
// calls that rung 'magic' (see GEAR_RARITIES in gear.js), so it's mapped
// here at the roll boundary rather than renaming every CHESTS table.
export const CHEST_RARITY_TO_GEAR_RARITY = { uncommon: 'magic' };
export function rollChest(chest, luck = 0) {
  const drops = [];
  for (let i = 0; i < chest.rolls; i++) {
    const w = { ...chest.rarityWeights };
    // luck shifts weight up
    if (luck > 0) {
      const keys = Object.keys(w);
      for (let j = 0; j < keys.length; j++) w[keys[j]] = w[keys[j]] * (1 + luck * (j + 1) * 0.3);
    }
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen = Object.keys(w)[0];
    for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) { chosen = k; break; } }
    const rarity = CHEST_RARITY_TO_GEAR_RARITY[chosen] || chosen;
    const slot = GEAR_SLOTS[Math.floor(Math.random() * GEAR_SLOTS.length)];
    drops.push(generateGearItem(slot, rarity));
  }
  return drops;
}

// ---------- QUESTS (rotates daily) ----------
export const QUEST_POOL = [
  { id: 'q_kill_100',   icon: 'ui_blade', name: 'Slay 100',        desc: 'Kill 100 enemies in one run', goal: 100, type: 'kills',  reward: { gold: 200 } },
  { id: 'q_kill_300',   icon: 'ui_blade', name: 'Slay 300',        desc: 'Kill 300 enemies in one run', goal: 300, type: 'kills',  reward: { gold: 300, gems: 1 } },
  { id: 'q_kill_500',   icon: 'ui_blade', name: 'Blood Bath',      desc: 'Kill 500 enemies in one run', goal: 500, type: 'kills',  reward: { gold: 500, slotCoins: 1 } },
  { id: 'q_surv_3',     icon: 'ui_clock',  name: 'Survive 3m',      desc: 'Survive 3 minutes in a run',  goal: 180, type: 'time',   reward: { gold: 200, petFood: 1 } },
  { id: 'q_surv_5',     icon: 'ui_clock',  name: 'Survive 5m',      desc: 'Survive 5 minutes in a run',  goal: 300, type: 'time',   reward: { gold: 400, gems: 1 } },
  { id: 'q_surv_8',     icon: 'ui_clock',  name: 'Endurance',       desc: 'Survive 8 minutes in a run',  goal: 480, type: 'time',   reward: { gold: 800, slotCoins: 1 } },
  { id: 'q_lvl_10',     icon: 'ui_star',  name: 'Reach Level 10',  desc: 'Reach character level 10',    goal: 10,  type: 'level',  reward: { gold: 200, sp: 1 } },
  { id: 'q_lvl_20',     icon: 'ui_star',  name: 'Reach Level 20',  desc: 'Reach character level 20',    goal: 20,  type: 'level',  reward: { gold: 400, gems: 1 } },
  { id: 'q_lvl_30',     icon: 'ui_star',  name: 'Power Spike',     desc: 'Reach character level 30',    goal: 30,  type: 'level',  reward: { gold: 700, slotCoins: 1 } },
  { id: 'q_boss',       icon: 'ui_eye',  name: 'Slay the Eye',   desc: 'Defeat the Eye of Horus',     goal: 1,   type: 'boss',   reward: { gold: 600, gems: 2 } },
  { id: 'q_gold_500',   icon: 'ui_moneybag',  name: 'Hoard 500',      desc: 'Collect 500 gold in one run', goal: 500, type: 'gold',   reward: { gold: 200, petFood: 1 } },
  { id: 'q_gold_1000',  icon: 'ui_moneybag',  name: 'Gold Rush',      desc: 'Collect 1000 gold in one run',goal: 1000,type: 'gold',   reward: { gold: 500, slotCoins: 1 } },
  { id: 'q_nohit',      icon: 'ui_ghost',  name: 'Ghost Run',      desc: 'Complete a run without being hit', goal: 1, type: 'nohit', reward: { gold: 1000, gems: 3 } },
  { id: 'q_runs_3',     icon: 'ui_infinity',  name: 'Grind Mode',     desc: 'Complete 3 runs today',       goal: 3,   type: 'runs',   reward: { gold: 400, petFood: 2 } },
  { id: 'q_combo_50',   icon: 'ui_flame',  name: 'Combo Master',   desc: 'Reach a 50x kill combo',      goal: 50,  type: 'combo',  reward: { gold: 300, gems: 1 } },
];

export function dailyQuests(daySeed) {
  // pick 5 unique deterministic by day
  const seeded = (n) => {
    let s = daySeed * 9301 + n * 49297;
    s = (s % 233280); if (s < 0) s += 233280;
    return s / 233280;
  };
  const chosen = [];
  const used = new Set();
  for (let i = 0; chosen.length < 5; i++) {
    const idx = Math.floor(seeded(i + 1) * QUEST_POOL.length);
    if (!used.has(idx)) { used.add(idx); chosen.push(idx); }
    if (i > 50) break; // safety
  }
  return chosen.map((i, k) => ({ ...QUEST_POOL[i % QUEST_POOL.length], slot: k }));
}

// ---------- WEEKLY QUESTS (bigger goals, bigger rewards, reset weekly) ----------
export const WEEKLY_QUEST_POOL = [
  { id: 'wq_runs_15',   icon: 'ui_infinity', name: 'Weekly Grind',    desc: 'Complete 15 runs this week',        goal: 15,   type: 'weekRuns',  reward: { gold: 2000, gems: 5 } },
  { id: 'wq_kills_1000',icon: 'ui_void', name: 'Thousand Cuts',   desc: 'Get 1000 kills this week',           goal: 1000, type: 'weekKills', reward: { gold: 2500, slotCoins: 3 } },
  { id: 'wq_boss_5',    icon: 'ui_trophy', name: 'Boss Hunter',     desc: 'Defeat 5 bosses this week',          goal: 5,    type: 'weekBosses',reward: { gold: 1800, gems: 4 } },
  { id: 'wq_lvl_100',   icon: 'ui_star', name: 'Century Climb',   desc: 'Gain 100 character levels this week',goal: 100,  type: 'weekLevels',reward: { gold: 2200, talentPoints: 3 } },
  { id: 'wq_gold_5000', icon: 'ui_moneybag', name: 'Fortune Week',    desc: 'Collect 5000 gold this week',        goal: 5000, type: 'weekGold',  reward: { gold: 1000, gems: 5, petFood: 5 } },
];

export function weekIdx() { return Math.floor(Date.now() / (86400000 * 7)); }

export function weeklyQuests(weekSeed) {
  // pick 3 unique deterministic by week (pool is small, so mostly all get used across weeks)
  const seeded = (n) => { let s = weekSeed * 7919 + n * 104729; s = (s % 233280); if (s < 0) s += 233280; return s / 233280; };
  const chosen = []; const used = new Set();
  for (let i = 0; chosen.length < 3 && i < 50; i++) {
    const idx = Math.floor(seeded(i + 1) * WEEKLY_QUEST_POOL.length);
    if (!used.has(idx)) { used.add(idx); chosen.push(idx); }
  }
  return chosen.map((i, k) => ({ ...WEEKLY_QUEST_POOL[i % WEEKLY_QUEST_POOL.length], slot: k }));
}

// ---------- DAILY SPIN WHEEL (separate from the 7-day login streak below) ----------
export const SPIN_JACKPOT = { gold: 1500, gems: 10 };

export const SPIN_WHEEL_SLICES = [
  { id: 'sw_gold_s',  icon: 'cur_gold', label: '150 Gold',  type: 'gold',      amount: 150,  weight: 22 },
  { id: 'sw_gold_m',  icon: 'cur_gold', label: '400 Gold',  type: 'gold',      amount: 400,  weight: 14 },
  { id: 'sw_gems_s',  icon: 'cur_gems', label: '2 Gems',    type: 'gems',      amount: 2,    weight: 16 },
  { id: 'sw_gems_m',  icon: 'cur_gems', label: '5 Gems',    type: 'gems',      amount: 5,    weight: 8  },
  { id: 'sw_slot',    icon: 'cur_slot', label: '2 Coins',   type: 'slotCoins', amount: 2,    weight: 14 },
  { id: 'sw_food',    icon: 'petFood', label: '4 Pet Food',type: 'petFood',   amount: 4,    weight: 14 },
  { id: 'sw_sp',      icon: 'cur_sp',  label: '2 SP',      type: 'sp',        amount: 2,    weight: 10 },
  { id: 'sw_jackpot',  icon: 'jackpot', label: 'JACKPOT: 1500 Gold + 10 Gems', type: 'jackpot', amount: 0, weight: 2 },
];

export function rollSpinWheel() {
  const total = SPIN_WHEEL_SLICES.reduce((a, s) => a + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SPIN_WHEEL_SLICES.length; i++) {
    r -= SPIN_WHEEL_SLICES[i].weight;
    if (r <= 0) return { index: i, slice: SPIN_WHEEL_SLICES[i] };
  }
  return { index: 0, slice: SPIN_WHEEL_SLICES[0] };
}

// ---------- DAILY REWARDS (7-day streak loop) ----------
export const DAILY_REWARDS = [
  { day: 1, icon: 'gold', label: '+200 Gold',  type: 'gold', amount: 200 },
  { day: 2, icon: 'sp', label: '+1 SP',      type: 'sp',   amount: 1 },
  { day: 3, icon: 'gold', label: '+400 Gold',  type: 'gold', amount: 400 },
  { day: 4, icon: 'ui_chest', label: 'Wood Chest', type: 'chest', chestId: 'wood' },
  { day: 5, icon: 'sp', label: '+2 SP',      type: 'sp',   amount: 2 },
  { day: 6, icon: 'gold', label: '+800 Gold',  type: 'gold', amount: 800 },
  { day: 7, icon: 'ui_trophy', label: 'Gold Chest', type: 'chest', chestId: 'gold' },
  // Days 8-14. A seven-day track resets the week you finally get into a habit,
  // right at the point it starts paying — the second week is where a login
  // streak actually becomes one. The curve steepens rather than repeating, so
  // day 14 is a genuine destination and not just another Tuesday.
  { day: 8,  icon: 'ui_part', label: '+30 Parts',   type: 'gearParts', amount: 30 },
  { day: 9,  icon: 'gold', label: '+1200 Gold',  type: 'gold', amount: 1200 },
  { day: 10, icon: 'cur_key', label: '+2 Probe Keys', type: 'probeKeys', amount: 2 },
  { day: 11, icon: 'sp', label: '+3 SP',       type: 'sp',   amount: 3 },
  { day: 12, icon: 'ui_chest', label: 'Iron Chest',  type: 'chest', chestId: 'iron' },
  { day: 13, icon: 'gems', label: '+5 Gems',     type: 'gems', amount: 5 },
  // 'annunaki' is the top chest that actually exists. I first wrote 'prism',
  // which is not a chest id — CHESTS is looked up with `find(c => c.id === x)`,
  // so a wrong id resolves to undefined and the day pays NOTHING while still
  // ticking the streak. Exactly the silent class the wiring sweep exists for,
  // which is why it now has a check for this.
  { day: 14, icon: 'ui_void', label: 'Annunaki Chest', type: 'chest', chestId: 'annunaki' },
];

// ---------- ACCOUNT LEVEL XP CURVE ----------
export function accountXpToNext(level) {
  return Math.floor(60 * Math.pow(1.18, level));
}
// rewards per account level
export function accountLevelReward(level) {
  if (level % 10 === 0) return { type: 'chest', chestId: 'gold', icon: 'ui_trophy', label: 'Gold Chest' };
  if (level % 5 === 0)  return { type: 'sp', amount: 2, icon: 'sp', label: '+2 SP' };
  if (level % 3 === 0)  return { type: 'gold', amount: 300, icon: 'gold', label: '+300 Gold' };
  return { type: 'gold', amount: 100, icon: 'gold', label: '+100 Gold' };
}

// ---------- MILESTONES ----------
export const MILESTONES = [
  { id: 'ms_kills_1k',  name: '1K Kills',        desc: 'Reach 1000 lifetime kills',        metric: 'totalKills',    goal: 1000,  reward: { gold: 500,  sp: 2  } },
  { id: 'ms_kills_5k',  name: '5K Kills',        desc: 'Reach 5000 lifetime kills',        metric: 'totalKills',    goal: 5000,  reward: { gold: 1500, sp: 5  } },
  { id: 'ms_kills_20k', name: '20K Kills',       desc: 'Reach 20000 lifetime kills',       metric: 'totalKills',    goal: 20000, reward: { gold: 5000, sp: 15 } },
  { id: 'ms_runs_10',   name: '10 Runs',          desc: 'Finish 10 runs',                   metric: 'runsCompleted', goal: 10,    reward: { gold: 400,  sp: 1  } },
  { id: 'ms_runs_50',   name: '50 Runs',          desc: 'Finish 50 runs',                   metric: 'runsCompleted', goal: 50,    reward: { gold: 2000, sp: 5  } },
  { id: 'ms_runs_100',  name: '100 Runs',         desc: 'Finish 100 runs',                  metric: 'runsCompleted', goal: 100,   reward: { gold: 6000, sp: 12 } },
  { id: 'ms_boss',      name: 'A.I.D.A. Slayer',  desc: 'Defeat A.I.D.A.',                  metric: 'aidaSlain',     goal: 1,     reward: { gold: 5000, sp: 10 } },
  { id: 'ms_necro',     name: 'Bone Breaker',     desc: 'Defeat the Necromancer',           metric: 'necroSlain',    goal: 1,     reward: { gold: 1200, sp: 3  } },
  { id: 'ms_void',      name: 'Titan Toppler',    desc: 'Defeat the Void Titan',            metric: 'voidSlain',     goal: 1,     reward: { gold: 2500, sp: 6  } },
  { id: 'ms_ocular',    name: 'Eye Opener',       desc: 'Defeat the Eye of Horus',          metric: 'ocularSlain',   goal: 1,     reward: { gold: 800,  sp: 2  } },
  { id: 'ms_time_3m',   name: 'Survivor',         desc: 'Survive 3 minutes',                metric: 'bestRunTime',   goal: 180,   reward: { gold: 400,  sp: 1  } },
  { id: 'ms_time_5m',   name: 'Endurance',        desc: 'Survive 5 minutes',                metric: 'bestRunTime',   goal: 300,   reward: { gold: 600,  sp: 2  } },
  { id: 'ms_time_10m',  name: 'Marathonist',      desc: 'Survive 10 minutes',               metric: 'bestRunTime',   goal: 600,   reward: { gold: 2000, sp: 6  } },
  { id: 'ms_level_10',  name: 'Rising',           desc: 'Reach level 10 in a run',          metric: 'bestLevel',     goal: 10,    reward: { gold: 300,  sp: 1  } },
  { id: 'ms_level_25',  name: 'Power Surge',      desc: 'Reach level 25 in a run',          metric: 'bestLevel',     goal: 25,    reward: { gold: 800,  sp: 3  } },
  { id: 'ms_level_40',  name: 'Ascendant',        desc: 'Reach level 40 in a run',          metric: 'bestLevel',     goal: 40,    reward: { gold: 2500, sp: 8  } },
  { id: 'ms_nohit',     name: 'Untouchable',      desc: 'Finish a run without being hit',   metric: 'noHitRuns',     goal: 1,     reward: { gold: 3000, sp: 8  } },
  { id: 'ms_endless',   name: 'Void Walker',      desc: 'Reach Endless Mode',               metric: 'endlessReached',goal: 1,     reward: { gold: 8000, sp: 20 } },
];

// ---------- EXTRA WEAPON (extra variety) ----------
export const EXTRA_WEAPONS = {
  iceLance: {
    id: 'iceLance', name: 'Ice Lance', icon: 'frost',
    type: 'auto', behaviour: 'projectile',
    desc: 'A piercing lance of cold that slows on hit.',
    base: { damage: 22, fireRate: 1.6, projSpeed: 720, projSize: 12, projectiles: 1, pierce: 3, color: '#bff0ff' },
    levelUps: [
      { stat: 'damage', mult: 1.2 },
      { stat: 'pierce', add: 2 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'pierce', add: 2 },
      { stat: 'fireRate', mult: 1.2 },
      { stat: 'damage', mult: 1.5, evolve: true },
    ],
  },
  meteorRain: {
    id: 'meteorRain', name: 'Meteor Rain', icon: 'cosmicRain',
    type: 'auto', behaviour: 'meteor',
    desc: 'Calls down burning meteors from above.',
    base: { damage: 60, fireRate: 0.4, area: 90, color: '#ff7a1a' },
    levelUps: [
      { stat: 'fireRate', mult: 1.3 },
      { stat: 'damage', mult: 1.25 },
      { stat: 'area', mult: 1.2 },
      { stat: 'fireRate', mult: 1.3 },
      { stat: 'damage', mult: 1.3 },
      { stat: 'area', mult: 1.25 },
      { stat: 'damage', mult: 1.6, evolve: true },
    ],
  },
};

// Merge into WEAPONS at runtime
Object.assign(WEAPONS, EXTRA_WEAPONS);

// ---------- AIDA INTRO DIALOGUE ----------
// The opening. It used to be four lines of A.I.D.A. explaining the plot to
// you — a character you do not meet until she is a boss, narrating exposition
// at someone who has not been given a reason to care yet.
//
// This version has no narrator. It is the drop's own deadpan, and it earns the
// premise by stating the absurd thing flatly and then not apologising for it:
// you are one drop of water, alone in space, and everything you have ever
// known is gone. The joke and the loss are the same sentence. Short lines,
// because a wall of text at the very start is the fastest way to be skipped.
//
// `emote` drives the visual beat behind each line (see IntroDialogue).
// (AIDA_INTRO lived here. Deleted with the old typed-dialogue intro on
// 2026-08-17 — Timmy: "ta bort introt helt som finns inget ska va fran det".
// The film that replaced it is game/introCinema.js and carries no dialogue
// data; its script is beats in code, not lines in a table.)

