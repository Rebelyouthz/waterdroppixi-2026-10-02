// Extended game data: skills, equipment, chests, quests, daily rewards, parts, avatars.
import { WEAPONS } from './data';

// ---------- AVATARS ----------
export const AVATARS = [
  { id: 'drop',    icon: '💧', name: 'Pure Drop',    desc: 'A waterdrop of the Lake.' },
  { id: 'flame',   icon: '🔥', name: 'Emberkin',     desc: 'Born from fire and tide.' },
  { id: 'void',    icon: '🌀', name: 'Voidwalker',   desc: 'Touched by the eldritch.' },
  { id: 'rune',    icon: '✨', name: 'Runebearer',   desc: 'Marked by A.I.D.A.' },
  { id: 'horus',   icon: '👁', name: 'Eye-bound',    desc: 'Sees through Horus.' },
  { id: 'spectre', icon: '💀', name: 'Spectre',      desc: 'Already dead.' },
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

// ---------- SKILL TREE ----------
// Branches: Combat, Mobility, Defense, Greed, Arcane
// Each skill has cost (SP), max level, prerequisite, and effect (applied as run modifiers).
export const SKILL_TREE = {
  combat: {
    name: 'COMBAT', color: '#ff3146', icon: '⚔️',
    skills: [
      { id: 'sk_atk',     name: 'Edge',          icon: '⚔️',  max: 20, costPerLvl: 1, req: null,           desc: '+3% damage / lvl',                 stat: 'dmg',     amount: 0.03 },
      { id: 'sk_crit',    name: 'Sharp Eye',     icon: '👁',  max: 20, costPerLvl: 1, req: 'sk_atk',       desc: '+2% crit chance / lvl',           stat: 'crit',    amount: 0.02 },
      { id: 'sk_headshot',name: 'Headshot',      icon: '🎯', max: 1, costPerLvl: 3, req: 'sk_crit',       desc: 'ACTIVE: 8% chance to one-shot non-bosses', stat: 'headshot', amount: 0.08, active: true },
      { id: 'sk_berserk', name: 'Berserker',     icon: '🩸', max: 1, costPerLvl: 4, req: 'sk_headshot',   desc: 'ACTIVE: +40% dmg below 30% HP',   stat: 'berserk', amount: 1, active: true },
      { id: 'sk_pierce',  name: 'Piercing',      icon: '➰', max: 15, costPerLvl: 2, req: 'sk_atk',        desc: '+1 pierce / lvl',                 stat: 'pierce',  amount: 1 },
      { id: 'sk_proj',    name: 'Multishot',     icon: '🎯', max: 8,  costPerLvl: 3, req: 'sk_pierce',     desc: '+1 projectile / lvl',             stat: 'proj',    amount: 1 },
    ],
  },
  mobility: {
    name: 'MOBILITY', color: '#4dffd4', icon: '🥾',
    skills: [
      { id: 'sk_spd',     name: 'Light Step',    icon: '🥾', max: 20, costPerLvl: 1, req: null,            desc: '+3% move speed / lvl',            stat: 'mspd',    amount: 0.03 },
      { id: 'sk_dash',    name: 'Dash',          icon: '💨', max: 1, costPerLvl: 2, req: 'sk_spd',        desc: 'ACTIVE: SHIFT to dash (i-frames)', stat: 'dash',   amount: 1, active: true },
      { id: 'sk_dashcd',  name: 'Quick Recall',  icon: '⏱',  max: 15, costPerLvl: 2, req: 'sk_dash',       desc: '-15% dash cooldown / lvl',        stat: 'dashcd',  amount: 0.15 },
      { id: 'sk_blink',   name: 'Blink',         icon: '🌀', max: 1, costPerLvl: 4, req: 'sk_dashcd',     desc: 'ACTIVE: Dash teleports & deals AoE', stat: 'blink', amount: 1, active: true },
      { id: 'sk_dodge',   name: 'Phasing',       icon: '👻', max: 15, costPerLvl: 2, req: 'sk_spd',        desc: '+3% dodge / lvl',                 stat: 'dodge',   amount: 0.03 },
    ],
  },
  defense: {
    name: 'DEFENSE', color: '#ffd166', icon: '🛡',
    skills: [
      { id: 'sk_hp',      name: 'Vital',         icon: '❤️', max: 20, costPerLvl: 1, req: null,            desc: '+12 max HP / lvl',                stat: 'maxhp',   amount: 12 },
      { id: 'sk_armor',   name: 'Plated',        icon: '🛡', max: 15, costPerLvl: 2, req: 'sk_hp',         desc: '+1 armor / lvl',                  stat: 'armor',   amount: 1 },
      { id: 'sk_regen',   name: 'Regrowth',      icon: '🌿', max: 15, costPerLvl: 2, req: 'sk_hp',         desc: '+0.2 HP/s / lvl',                 stat: 'regen',   amount: 0.2 },
      { id: 'sk_shield',  name: 'Aegis',         icon: '✨', max: 1, costPerLvl: 4, req: 'sk_armor',      desc: 'ACTIVE: Absorb 1 hit / 25s',      stat: 'shield',  amount: 1, active: true },
      { id: 'sk_revive',  name: 'Phoenix',       icon: '🪽', max: 1, costPerLvl: 6, req: 'sk_regen',      desc: 'ACTIVE: Revive once at 50% HP',   stat: 'revive',  amount: 1, active: true },
    ],
  },
  greed: {
    name: 'GREED', color: '#ffd700', icon: '💰',
    skills: [
      { id: 'sk_gold',    name: 'Greed',         icon: '💰', max: 20, costPerLvl: 1, req: null,            desc: '+8% gold / lvl',                  stat: 'gold',    amount: 0.08 },
      { id: 'sk_xp',      name: 'Wisdom',        icon: '📖', max: 20, costPerLvl: 1, req: null,            desc: '+5% XP / lvl',                    stat: 'xp',      amount: 0.05 },
      { id: 'sk_magnet',  name: 'Magnet',        icon: '🧲', max: 15, costPerLvl: 2, req: 'sk_gold',       desc: '+12% pickup range / lvl',         stat: 'pickup',  amount: 0.12 },
      { id: 'sk_luck',    name: 'Fortune',       icon: '🍀', max: 15, costPerLvl: 2, req: 'sk_xp',         desc: '+0.5 luck / lvl (better rolls)',  stat: 'luck',    amount: 0.5 },
      { id: 'sk_chest',   name: 'Chest Sense',   icon: '📦', max: 1, costPerLvl: 4, req: 'sk_magnet',     desc: 'ACTIVE: Chest enemies spawn 2x more often', stat: 'chestSense', amount: 1, active: true },
    ],
  },
  arcane: {
    name: 'ARCANE', color: '#b362ff', icon: '🔮',
    skills: [
      { id: 'sk_area',    name: 'Wider Wake',    icon: '🌀', max: 20, costPerLvl: 1, req: null,            desc: '+5% area / lvl',                  stat: 'area',    amount: 0.05 },
      { id: 'sk_atks',    name: 'Quickened',     icon: '⏱',  max: 20, costPerLvl: 1, req: null,            desc: '+3% atk speed / lvl',             stat: 'atks',    amount: 0.03 },
      { id: 'sk_critdmg', name: 'Critical Will', icon: '🩸', max: 15, costPerLvl: 2, req: 'sk_atks',       desc: '+10% crit damage / lvl',          stat: 'critd',   amount: 0.10 },
      { id: 'sk_aida',    name: 'A.I.D.A. Link', icon: '👁', max: 1, costPerLvl: 6, req: 'sk_critdmg',    desc: 'ACTIVE: Bonus damage to bosses +30%', stat: 'bossDmg', amount: 0.30, active: true },
      { id: 'sk_void',    name: 'Voidcaller',    icon: '🌌', max: 1, costPerLvl: 4, req: 'sk_area',       desc: 'ACTIVE: 10% chance to spawn void burst on kill', stat: 'voidBurst', amount: 0.10, active: true },
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
  magazine: { name: 'Magazine', icon: '📦', tiers: [
    { name: 'Standard',  bonus: 0,   cost: 0 },
    { name: 'Extended',  bonus: 4,   cost: 80 },
    { name: 'Drum',      bonus: 10,  cost: 240 },
    { name: 'Cosmic',    bonus: 20,  cost: 600 },
  ], stat: 'magazine' },
  sight: { name: 'Sight', icon: '🎯', tiers: [
    { name: 'Iron',      crit: 0,    cost: 0 },
    { name: 'Red Dot',   crit: 0.04, cost: 100 },
    { name: 'Tactical',  crit: 0.08, cost: 280 },
    { name: 'Eye Of Horus', crit: 0.16, cost: 700 },
  ], stat: 'sight' },
  barrel: { name: 'Barrel', icon: '🔫', tiers: [
    { name: 'Short',     dmg: 0,     cost: 0 },
    { name: 'Standard',  dmg: 0.10,  cost: 120 },
    { name: 'Long',      dmg: 0.22,  cost: 320 },
    { name: 'Annunaki',  dmg: 0.45,  cost: 800 },
  ], stat: 'barrel' },
  bullets: { name: 'Bullets', icon: '🔥', tiers: [
    { name: 'FMJ',       effect: 'none',  bonus: 0,     cost: 0 },
    { name: 'AP',        effect: 'pierce', bonus: 1,    cost: 150 },
    { name: 'Incendiary',effect: 'burn',   bonus: 0.06, cost: 350 },
    { name: 'Voidlash',  effect: 'chain',  bonus: 0.25, cost: 900 },
  ], stat: 'bullets' },
  rarity: { name: 'Rarity', icon: '✨', tiers: [
    { name: 'Common',    mult: 1.00, cost: 0 },
    { name: 'Magic',     mult: 1.15, cost: 200 },
    { name: 'Rare',      mult: 1.32, cost: 500 },
    { name: 'Epic',      mult: 1.55, cost: 1200 },
    { name: 'Legendary', mult: 1.85, cost: 3000 },
  ], stat: 'rarity' },
  // Unlocks slots to assign Elements (see data_ext2.js ELEMENTS) to this
  // weapon's bullets — Weaponsmith.jsx shows an element picker once slots > 0.
  element: { name: 'Elemental Rounds', icon: '🔮', tiers: [
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
    magazine: { name: 'Meteor Volume',  icon: '☄️', tierNames: ['Solo', 'Pair', 'Cluster', 'Swarm'] },
    sight:    { name: 'Targeting',      icon: '🎯', tierNames: ['Manual', 'Tracking', 'Predictive', 'Eye of Horus'] },
    barrel:   { name: 'Impact',         icon: '💥', tierNames: ['Light', 'Heavy', 'Devastating', 'Annunaki'] },
    bullets:  { name: 'Meteor Type',    icon: '🔥', tierNames: ['Stone', 'Burning', 'Splitting', 'Voidshard'] },
  },
  voidBeam: {
    magazine: { name: 'Power Cell',     icon: '🔋', tierNames: ['Standard', 'Extended', 'Reactor', 'Cosmic'] },
    sight:    { name: 'Lens',           icon: '🔭', tierNames: ['Plain', 'Coated', 'Prismatic', 'Eye of Horus'] },
    barrel:   { name: 'Aperture',       icon: '🌀', tierNames: ['Narrow', 'Standard', 'Wide', 'Annunaki'] },
    bullets:  { name: 'Beam Type',      icon: '✨', tierNames: ['Pure', 'Pierce', 'Burning', 'Voidlash'] },
  },
  emberOrbs: {
    magazine: { name: 'Orb Count',      icon: '🟠', tierNames: ['Two', 'Three', 'Four', 'Six'] },
    sight:    { name: 'Orbit Pattern',  icon: '🎯', tierNames: ['Tight', 'Wide', 'Elliptical', 'Eye of Horus'] },
    barrel:   { name: 'Ember Power',    icon: '🔥', tierNames: ['Spark', 'Flame', 'Inferno', 'Annunaki'] },
    bullets:  { name: 'Burn',           icon: '🔥', tierNames: ['None', 'Brief', 'Lasting', 'Voidburn'] },
  },
  // (A `shotgun:` block lived here. Same mistake as `meteor` — keyed to the
  // behaviour rather than to a weapon, so never read — and its contents are
  // now ARCHETYPES.shotgun, which reaches every scattergun in the game
  // instead of one id that does not exist.)
  tidalShotgun: {
    magazine: { name: 'Shell Box',      icon: '📦', tierNames: ['Standard', 'Extended', 'Drum', 'Cosmic'] },
    sight:    { name: 'Choke',          icon: '🎯', tierNames: ['Open', 'Modified', 'Tight', 'Eye of Horus'] },
    barrel:   { name: 'Wave Length',    icon: '🌊', tierNames: ['Ripple', 'Wave', 'Tidal', 'Tsunami'] },
    bullets:  { name: 'Shell Type',     icon: '💧', tierNames: ['Buckshot', 'Slugs', 'Bursting', 'Voidshell'] },
  },
  iceLance: {
    magazine: { name: 'Shard Stack',    icon: '🧊', tierNames: ['Single', 'Pair', 'Triple', 'Hailstorm'] },
    sight:    { name: 'Lock',           icon: '🎯', tierNames: ['Manual', 'Tracking', 'Auto-Lock', 'Eye of Horus'] },
    barrel:   { name: 'Spear Length',   icon: '🔱', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
    bullets:  { name: 'Frost Type',     icon: '❄️', tierNames: ['Chill', 'Pierce', 'Freezing', 'Voidfrost'] },
  },
  plasmaLance: {
    magazine: { name: 'Plasma Cell',    icon: '🔋', tierNames: ['Standard', 'Extended', 'Reactor', 'Cosmic'] },
    sight:    { name: 'Optics',         icon: '🎯', tierNames: ['Plain', 'Holographic', 'Smart', 'Eye of Horus'] },
    barrel:   { name: 'Coil',           icon: '⚡', tierNames: ['Single', 'Twin', 'Triple', 'Annunaki'] },
    bullets:  { name: 'Charge',         icon: '✨', tierNames: ['Standard', 'Pierce', 'Overcharged', 'Voidcharge'] },
  },
  runicRifle: {
    magazine: { name: 'Rune Quiver',    icon: '📜', tierNames: ['Standard', 'Extended', 'Bound', 'Cosmic Tome'] },
    sight:    { name: 'Rune Sight',     icon: '👁', tierNames: ['Plain', 'Etched', 'Inscribed', 'Eye of Horus'] },
    barrel:   { name: 'Shaft',          icon: '🪵', tierNames: ['Oak', 'Bone', 'Ash', 'Annunaki'] },
    bullets:  { name: 'Rune Type',      icon: '🔮', tierNames: ['Common', 'Pierce', 'Burning', 'Voidrune'] },
  },
  twinSMG: {
    magazine: { name: 'Twin Mag',       icon: '📦', tierNames: ['Standard', 'Extended', 'Drum', 'Cosmic'] },
    sight:    { name: 'Sight',          icon: '🎯', tierNames: ['Iron', 'Red Dot', 'Tactical', 'Eye of Horus'] },
    barrel:   { name: 'Twin Barrel',    icon: '🔫', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
    bullets:  { name: 'Bullets',        icon: '🔥', tierNames: ['FMJ', 'AP', 'Incendiary', 'Voidlash'] },
  },
  runebolts: {
    magazine: { name: 'Bolt Quiver',    icon: '🏹', tierNames: ['Standard', 'Extended', 'Bound', 'Cosmic'] },
    sight:    { name: 'Rune Sight',     icon: '👁', tierNames: ['Plain', 'Etched', 'Bound', 'Eye of Horus'] },
    barrel:   { name: 'Bow Tension',    icon: '🪶', tierNames: ['Standard', 'Heavy', 'Master', 'Annunaki'] },
    bullets:  { name: 'Bolt Type',      icon: '🔮', tierNames: ['Wood', 'Pierce', 'Burning', 'Voidrune'] },
  },
  bloodscythe_legacy: {
    magazine: { name: 'Swing Range',    icon: '📏', tierNames: ['Short', 'Extended', 'Wide', 'Cosmic'] },
    sight:    { name: 'Focus',          icon: '🎯', tierNames: ['Iron', 'Sharp', 'Razor', 'Eye of Horus'] },
    barrel:   { name: 'Blade',          icon: '🌑', tierNames: ['Standard', 'Heavy', 'Long', 'Annunaki'] },
    bullets:  { name: 'Edge Type',      icon: '🩸', tierNames: ['Plain', 'Bleeding', 'Burning', 'Voidedge'] },
  },
  hydropistol: {
    magazine: { name: 'Water Chamber',  icon: '💧', tierNames: ['Standard', 'Extended', 'Pressurized', 'Cosmic'] },
    sight:    { name: 'Scope',          icon: '🎯', tierNames: ['Iron', 'Red Dot', 'Tactical', 'Eye of Horus'] },
    barrel:   { name: 'Nozzle',         icon: '🔫', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
    bullets:  { name: 'Ammo Type',      icon: '💦', tierNames: ['Aqua', 'Burst', 'Pressurized', 'Voidwater'] },
  },
  bloodscythe: {
    magazine: { name: 'Blade Width',    icon: '🌑', tierNames: ['Thin', 'Standard', 'Wide', 'Void-Forged'] },
    sight:    { name: 'Blood Sense',    icon: '🩸', tierNames: ['None', 'Aware', 'Keen', 'Eye of Horus'] },
    barrel:   { name: 'Blade Edge',     icon: '⚔️', tierNames: ['Dull', 'Sharp', 'Razor', 'Annunaki'] },
    bullets:  { name: 'Cut Type',       icon: '🔪', tierNames: ['Slash', 'Bleeding', 'Vorpal', 'Voidedge'] },
  },
  arcTesla: {
    magazine: { name: 'Voltage Cell',   icon: '🔋', tierNames: ['Standard', 'Extended', 'Capacitor', 'Cosmic'] },
    sight:    { name: 'Conductor',      icon: '⚡', tierNames: ['Copper', 'Silver', 'Gold', 'Eye of Horus'] },
    barrel:   { name: 'Arc Range',      icon: '🌩️', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
    bullets:  { name: 'Tesla Type',     icon: '🔌', tierNames: ['Static', 'Pulse', 'Chain', 'Voidbolt'] },
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
      barrel: { name: 'Edge',   icon: '⚔️', tierNames: ['Dull', 'Honed', 'Razor', 'Annunaki'] },
      sight:  { name: 'Temper', icon: '🔥', tierNames: ['Soft', 'Tempered', 'Folded', 'Eye of Horus'] },
    },
  },
  beam: {
    label: 'Emitter',
    // No magazine: a beam draws from a cell rather than carrying rounds, and
    // that cell is what the `bullets` track represents here.
    tracks: ['barrel', 'sight', 'bullets', 'rarity', 'element'],
    names: {
      barrel:  { name: 'Aperture',  icon: '🌀', tierNames: ['Narrow', 'Standard', 'Wide', 'Annunaki'] },
      sight:   { name: 'Lens',      icon: '🔭', tierNames: ['Plain', 'Coated', 'Prismatic', 'Eye of Horus'] },
      bullets: { name: 'Beam Type', icon: '✨', tierNames: ['Pure', 'Piercing', 'Burning', 'Voidlash'] },
    },
  },
  orbit: {
    label: 'Orbital',
    tracks: ['magazine', 'barrel', 'bullets', 'rarity', 'element'],
    names: {
      magazine: { name: 'Orb Count',  icon: '🟠', tierNames: ['Two', 'Three', 'Four', 'Six'] },
      barrel:   { name: 'Orb Power',  icon: '🔥', tierNames: ['Spark', 'Flame', 'Inferno', 'Annunaki'] },
      bullets:  { name: 'Orb Effect', icon: '🌟', tierNames: ['Plain', 'Searing', 'Lasting', 'Voidburn'] },
    },
  },
  chain: {
    label: 'Conductor',
    tracks: ['barrel', 'sight', 'bullets', 'rarity', 'element'],
    names: {
      barrel:  { name: 'Arc Range', icon: '🌩️', tierNames: ['Short', 'Standard', 'Long', 'Annunaki'] },
      sight:   { name: 'Conductor', icon: '⚡', tierNames: ['Copper', 'Silver', 'Gold', 'Eye of Horus'] },
      bullets: { name: 'Arc Type',  icon: '🔌', tierNames: ['Static', 'Pulse', 'Chaining', 'Voidbolt'] },
    },
  },
  aoe: {
    label: 'Ordnance',
    tracks: ['barrel', 'sight', 'bullets', 'rarity', 'element'],
    names: {
      barrel:  { name: 'Yield',   icon: '💥', tierNames: ['Light', 'Heavy', 'Devastating', 'Annunaki'] },
      sight:   { name: 'Focus',   icon: '🎯', tierNames: ['Loose', 'Tuned', 'Precise', 'Eye of Horus'] },
      bullets: { name: 'Payload', icon: '☣️', tierNames: ['Plain', 'Piercing', 'Burning', 'Voidcharge'] },
    },
  },
  shotgun: {
    label: 'Scattergun',
    tracks: ['magazine', 'sight', 'barrel', 'bullets', 'rarity', 'element'],
    names: {
      magazine: { name: 'Shell Box',  icon: '📦', tierNames: ['Standard', 'Extended', 'Drum', 'Cosmic'] },
      sight:    { name: 'Choke',      icon: '🎯', tierNames: ['Open', 'Modified', 'Full', 'Eye of Horus'] },
      barrel:   { name: 'Barrel',     icon: '🔫', tierNames: ['Sawn-Off', 'Standard', 'Long', 'Annunaki'] },
      bullets:  { name: 'Shell Type', icon: '🟡', tierNames: ['Buckshot', 'Slugs', 'Incendiary', 'Voidshell'] },
    },
  },
  meteor: {
    label: 'Bombardment',
    tracks: ['magazine', 'sight', 'barrel', 'bullets', 'rarity', 'element'],
    names: {
      magazine: { name: 'Volume',    icon: '☄️', tierNames: ['Solo', 'Pair', 'Cluster', 'Swarm'] },
      sight:    { name: 'Targeting', icon: '🎯', tierNames: ['Manual', 'Tracking', 'Predictive', 'Eye of Horus'] },
      barrel:   { name: 'Impact',    icon: '💥', tierNames: ['Light', 'Heavy', 'Devastating', 'Annunaki'] },
      bullets:  { name: 'Warhead',   icon: '🔥', tierNames: ['Stone', 'Burning', 'Splitting', 'Voidshard'] },
    },
  },
  drone: {
    label: 'Wing',
    tracks: ['magazine', 'sight', 'barrel', 'rarity', 'element'],
    names: {
      magazine: { name: 'Bay Size', icon: '🛩', tierNames: ['One', 'Two', 'Three', 'Squadron'] },
      sight:    { name: 'Optics',   icon: '🎯', tierNames: ['Plain', 'Tracking', 'Smart', 'Eye of Horus'] },
      barrel:   { name: 'Ordnance', icon: '💥', tierNames: ['Light', 'Standard', 'Heavy', 'Annunaki'] },
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
export const EQUIP_SLOTS = ['head', 'chest', 'boots', 'trinket'];
export const EQUIP_BASE = {
  head:    { icon: '👑', stats: ['crit', 'crit'] },
  chest:   { icon: '🦺', stats: ['maxhp', 'armor'] },
  boots:   { icon: '🥾', stats: ['mspd', 'dodge'] },
  trinket: { icon: '🔮', stats: ['xp', 'gold', 'luck', 'pickup'] },
};
// rarity adds a stat slot and multiplies values
export const EQUIP_RARITY = {
  common:    { mult: 1.0, slots: 1, color: '#9a8fa6', cls: 'r-common' },
  uncommon:  { mult: 1.5, slots: 2, color: '#4dff91', cls: 'r-uncommon' },
  rare:      { mult: 2.0, slots: 3, color: '#4dc4ff', cls: 'r-rare' },
  epic:      { mult: 2.7, slots: 4, color: '#b362ff', cls: 'r-epic' },
  legendary: { mult: 3.6, slots: 5, color: '#ff7a1a', cls: 'r-legendary' },
  mythical:  { mult: 5.5, slots: 6, color: '#ff3146', cls: 'r-mythical' },
};
const EQUIP_NAMES = {
  head: ['Helm of Tides', 'Drowned Crown', 'Visor of Horus', 'Skull of A.I.D.A.', 'Cap of Echoes'],
  chest: ['Plate of Nirvana', 'Robe of Ash', 'Vest of Voidsteel', 'Hauberk of Lake', 'Shroud of Annunaki'],
  boots: ['Tideboots', 'Lightstep', 'Voidwalkers', 'Phasing Greaves', 'Boots of Drift'],
  trinket: ['Eye Pendant', 'Coin of Drown', 'Sigil of Aida', 'Lake Heart', 'Wisp Ring'],
};
const STAT_NAMES = {
  maxhp: 'Max HP', dmg: 'Damage %', atks: 'Atk Speed %', mspd: 'Move Speed %',
  crit: 'Crit %', critd: 'Crit Dmg %', armor: 'Armor', regen: 'Regen',
  pickup: 'Pickup %', xp: 'XP %', gold: 'Gold %', luck: 'Luck',
  dodge: 'Dodge %', area: 'Area %', proj: 'Projectiles',
};
export function rollEquip(rarity, level = 1) {
  const slotsAll = ['maxhp', 'dmg', 'atks', 'mspd', 'crit', 'critd', 'armor', 'pickup', 'xp', 'gold', 'luck', 'dodge', 'area'];
  const slot = EQUIP_SLOTS[Math.floor(Math.random() * EQUIP_SLOTS.length)];
  const r = EQUIP_RARITY[rarity];
  const name = EQUIP_NAMES[slot][Math.floor(Math.random() * EQUIP_NAMES[slot].length)];
  const baseStats = EQUIP_BASE[slot].stats;
  const statsRolled = [];
  const used = new Set();
  for (let i = 0; i < r.slots; i++) {
    const pool = i < baseStats.length ? [baseStats[i]] : slotsAll.filter(s => !used.has(s));
    const stat = pool[Math.floor(Math.random() * pool.length)];
    used.add(stat);
    let val;
    if (stat === 'maxhp') val = Math.floor((8 + Math.random() * 12) * r.mult * level);
    else if (stat === 'armor') val = Math.floor((1 + Math.random() * 2) * r.mult);
    else if (stat === 'regen') val = (0.1 + Math.random() * 0.2) * r.mult;
    else val = (0.02 + Math.random() * 0.05) * r.mult; // percent
    statsRolled.push({ stat, val, name: STAT_NAMES[stat] || stat });
  }
  return {
    id: 'eq_' + Math.random().toString(36).slice(2, 9),
    slot, name, rarity, level,
    stats: statsRolled,
    icon: EQUIP_BASE[slot].icon,
  };
}

// ---------- CHESTS ----------
export const CHESTS = [
  { id: 'wood',     name: 'Standard Chest',  icon: '📦',  cost: 50,   currency: 'gems', rolls: 1, rarityWeights: { common: 80, uncommon: 18, rare: 2 } },
  { id: 'iron',     name: 'Premium Chest',   icon: '🗄',  cost: 200,  currency: 'gems', rolls: 1, rarityWeights: { uncommon: 55, rare: 32, epic: 12, legendary: 1 } },
  { id: 'gold',     name: 'Epic Chest',      icon: '🏆',  cost: 500,  currency: 'gems', rolls: 2, rarityWeights: { rare: 52, epic: 36, legendary: 12 } },
  { id: 'resource', name: 'Resource Cache',  icon: '💼',  cost: 10,   currency: 'gems', rolls: 1, rarityWeights: { common: 90, uncommon: 10 }, resourceOnly: true },
  { id: 'petEgg',   name: 'Pet Egg Chest',   icon: '🥚',  cost: 50,   currency: 'gems', rolls: 1, rarityWeights: { common: 70, uncommon: 22, rare: 7, epic: 1 }, petOnly: true },
  { id: 'petPrem',  name: 'Premium Pet Chest',icon: '🥚', cost: 250,  currency: 'gems', rolls: 1, rarityWeights: { uncommon: 40, rare: 38, epic: 18, legendary: 4 }, petOnly: true },
  { id: 'parts',    name: 'Parts Chest',     icon: '🔩',  cost: 100,  currency: 'gems', rolls: 2, rarityWeights: { common: 60, uncommon: 30, rare: 10 }, partsOnly: true },
  { id: 'annunaki', name: 'Annunaki Cache',  icon: '🛸',  cost: 4500, rolls: 3, rarityWeights: { epic: 70, legendary: 30 } },
];
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
    drops.push(rollEquip(chosen, 1));
  }
  return drops;
}

// ---------- QUESTS (rotates daily) ----------
export const QUEST_POOL = [
  { id: 'q_kill_100',   icon: '⚔️', name: 'Slay 100',        desc: 'Kill 100 enemies in one run', goal: 100, type: 'kills',  reward: { gold: 200 } },
  { id: 'q_kill_300',   icon: '⚔️', name: 'Slay 300',        desc: 'Kill 300 enemies in one run', goal: 300, type: 'kills',  reward: { gold: 300, gems: 1 } },
  { id: 'q_kill_500',   icon: '⚔️', name: 'Blood Bath',      desc: 'Kill 500 enemies in one run', goal: 500, type: 'kills',  reward: { gold: 500, slotCoins: 1 } },
  { id: 'q_surv_3',     icon: '⏱',  name: 'Survive 3m',      desc: 'Survive 3 minutes in a run',  goal: 180, type: 'time',   reward: { gold: 200, petFood: 1 } },
  { id: 'q_surv_5',     icon: '⏱',  name: 'Survive 5m',      desc: 'Survive 5 minutes in a run',  goal: 300, type: 'time',   reward: { gold: 400, gems: 1 } },
  { id: 'q_surv_8',     icon: '⏱',  name: 'Endurance',       desc: 'Survive 8 minutes in a run',  goal: 480, type: 'time',   reward: { gold: 800, slotCoins: 1 } },
  { id: 'q_lvl_10',     icon: '⭐',  name: 'Reach Level 10',  desc: 'Reach character level 10',    goal: 10,  type: 'level',  reward: { gold: 200, sp: 1 } },
  { id: 'q_lvl_20',     icon: '⭐',  name: 'Reach Level 20',  desc: 'Reach character level 20',    goal: 20,  type: 'level',  reward: { gold: 400, gems: 1 } },
  { id: 'q_lvl_30',     icon: '⭐',  name: 'Power Spike',     desc: 'Reach character level 30',    goal: 30,  type: 'level',  reward: { gold: 700, slotCoins: 1 } },
  { id: 'q_boss',       icon: '👁',  name: 'Slay the Eye',   desc: 'Defeat the Eye of Horus',     goal: 1,   type: 'boss',   reward: { gold: 600, gems: 2 } },
  { id: 'q_gold_500',   icon: '💰',  name: 'Hoard 500',      desc: 'Collect 500 gold in one run', goal: 500, type: 'gold',   reward: { gold: 200, petFood: 1 } },
  { id: 'q_gold_1000',  icon: '💰',  name: 'Gold Rush',      desc: 'Collect 1000 gold in one run',goal: 1000,type: 'gold',   reward: { gold: 500, slotCoins: 1 } },
  { id: 'q_nohit',      icon: '👻',  name: 'Ghost Run',      desc: 'Complete a run without being hit', goal: 1, type: 'nohit', reward: { gold: 1000, gems: 3 } },
  { id: 'q_runs_3',     icon: '🔄',  name: 'Grind Mode',     desc: 'Complete 3 runs today',       goal: 3,   type: 'runs',   reward: { gold: 400, petFood: 2 } },
  { id: 'q_combo_50',   icon: '🔥',  name: 'Combo Master',   desc: 'Reach a 50x kill combo',      goal: 50,  type: 'combo',  reward: { gold: 300, gems: 1 } },
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
  { id: 'wq_runs_15',   icon: '🔄', name: 'Weekly Grind',    desc: 'Complete 15 runs this week',        goal: 15,   type: 'weekRuns',  reward: { gold: 2000, gems: 5 } },
  { id: 'wq_kills_1000',icon: '☠️', name: 'Thousand Cuts',   desc: 'Get 1000 kills this week',           goal: 1000, type: 'weekKills', reward: { gold: 2500, slotCoins: 3 } },
  { id: 'wq_boss_5',    icon: '👑', name: 'Boss Hunter',     desc: 'Defeat 5 bosses this week',          goal: 5,    type: 'weekBosses',reward: { gold: 1800, gems: 4 } },
  { id: 'wq_lvl_100',   icon: '⭐', name: 'Century Climb',   desc: 'Gain 100 character levels this week',goal: 100,  type: 'weekLevels',reward: { gold: 2200, talentPoints: 3 } },
  { id: 'wq_gold_5000', icon: '💰', name: 'Fortune Week',    desc: 'Collect 5000 gold this week',        goal: 5000, type: 'weekGold',  reward: { gold: 1000, gems: 5, petFood: 5 } },
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
export const SPIN_WHEEL_SLICES = [
  { id: 'sw_gold_s',  icon: '💰', label: '150 Gold',  type: 'gold',      amount: 150,  weight: 22 },
  { id: 'sw_gold_m',  icon: '💰', label: '400 Gold',  type: 'gold',      amount: 400,  weight: 14 },
  { id: 'sw_gems_s',  icon: '💎', label: '2 Gems',    type: 'gems',      amount: 2,    weight: 16 },
  { id: 'sw_gems_m',  icon: '💎', label: '5 Gems',    type: 'gems',      amount: 5,    weight: 8  },
  { id: 'sw_slot',    icon: '🎰', label: '2 Coins',   type: 'slotCoins', amount: 2,    weight: 14 },
  { id: 'sw_food',    icon: '🍖', label: '4 Pet Food',type: 'petFood',   amount: 4,    weight: 14 },
  { id: 'sw_sp',      icon: '◆',  label: '2 SP',      type: 'sp',        amount: 2,    weight: 10 },
  { id: 'sw_jackpot',  icon: '🏆', label: 'JACKPOT: 1500 Gold + 10 Gems', type: 'jackpot', amount: 0, weight: 2 },
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
  { day: 1, icon: '💰', label: '+200 Gold',  type: 'gold', amount: 200 },
  { day: 2, icon: '⭐', label: '+1 SP',      type: 'sp',   amount: 1 },
  { day: 3, icon: '💰', label: '+400 Gold',  type: 'gold', amount: 400 },
  { day: 4, icon: '📦', label: 'Wood Chest', type: 'chest', chestId: 'wood' },
  { day: 5, icon: '⭐', label: '+2 SP',      type: 'sp',   amount: 2 },
  { day: 6, icon: '💰', label: '+800 Gold',  type: 'gold', amount: 800 },
  { day: 7, icon: '🏆', label: 'Gold Chest', type: 'chest', chestId: 'gold' },
  // Days 8-14. A seven-day track resets the week you finally get into a habit,
  // right at the point it starts paying — the second week is where a login
  // streak actually becomes one. The curve steepens rather than repeating, so
  // day 14 is a genuine destination and not just another Tuesday.
  { day: 8,  icon: '🔩', label: '+30 Parts',   type: 'gearParts', amount: 30 },
  { day: 9,  icon: '💰', label: '+1200 Gold',  type: 'gold', amount: 1200 },
  { day: 10, icon: '🔑', label: '+2 Probe Keys', type: 'probeKeys', amount: 2 },
  { day: 11, icon: '⭐', label: '+3 SP',       type: 'sp',   amount: 3 },
  { day: 12, icon: '📦', label: 'Iron Chest',  type: 'chest', chestId: 'iron' },
  { day: 13, icon: '💎', label: '+5 Gems',     type: 'gems', amount: 5 },
  // 'annunaki' is the top chest that actually exists. I first wrote 'prism',
  // which is not a chest id — CHESTS is looked up with `find(c => c.id === x)`,
  // so a wrong id resolves to undefined and the day pays NOTHING while still
  // ticking the streak. Exactly the silent class the wiring sweep exists for,
  // which is why it now has a check for this.
  { day: 14, icon: '👑', label: 'Annunaki Chest', type: 'chest', chestId: 'annunaki' },
];

// ---------- ACCOUNT LEVEL XP CURVE ----------
export function accountXpToNext(level) {
  return Math.floor(60 * Math.pow(1.18, level));
}
// rewards per account level
export function accountLevelReward(level) {
  if (level % 10 === 0) return { type: 'chest', chestId: 'gold', icon: '🏆', label: 'Gold Chest' };
  if (level % 5 === 0)  return { type: 'sp', amount: 2, icon: '⭐', label: '+2 SP' };
  if (level % 3 === 0)  return { type: 'gold', amount: 300, icon: '💰', label: '+300 Gold' };
  return { type: 'gold', amount: 100, icon: '💰', label: '+100 Gold' };
}

// ---------- MILESTONES ----------
export const MILESTONES = [
  { id: 'ms_kills_1k',  name: '1K Kills',        desc: 'Nå 1000 totala kills',        metric: 'totalKills',    goal: 1000,  reward: { gold: 500,  sp: 2  } },
  { id: 'ms_kills_5k',  name: '5K Kills',        desc: 'Nå 5000 totala kills',        metric: 'totalKills',    goal: 5000,  reward: { gold: 1500, sp: 5  } },
  { id: 'ms_kills_20k', name: '20K Kills',       desc: 'Nå 20000 totala kills',       metric: 'totalKills',    goal: 20000, reward: { gold: 5000, sp: 15 } },
  { id: 'ms_runs_10',   name: '10 Runs',          desc: 'Fullfölj 10 rundor',          metric: 'runsCompleted', goal: 10,    reward: { gold: 400,  sp: 1  } },
  { id: 'ms_runs_50',   name: '50 Runs',          desc: 'Fullfölj 50 rundor',          metric: 'runsCompleted', goal: 50,    reward: { gold: 2000, sp: 5  } },
  { id: 'ms_runs_100',  name: '100 Runs',         desc: 'Fullfölj 100 rundor',         metric: 'runsCompleted', goal: 100,   reward: { gold: 6000, sp: 12 } },
  { id: 'ms_boss',      name: 'A.I.D.A. Slayer',  desc: 'Besegra A.I.D.A.',            metric: 'aidaSlain',     goal: 1,     reward: { gold: 5000, sp: 10 } },
  { id: 'ms_necro',     name: 'Bone Breaker',     desc: 'Besegra Nekromansen',         metric: 'necroSlain',    goal: 1,     reward: { gold: 1200, sp: 3  } },
  { id: 'ms_void',      name: 'Titan Toppler',    desc: 'Besegra Void Titan',          metric: 'voidSlain',     goal: 1,     reward: { gold: 2500, sp: 6  } },
  { id: 'ms_ocular',    name: 'Eye Opener',       desc: 'Besegra Eye of Horus',        metric: 'ocularSlain',   goal: 1,     reward: { gold: 800,  sp: 2  } },
  { id: 'ms_time_3m',   name: 'Survivor',         desc: 'Överlev 3 minuter',           metric: 'bestRunTime',   goal: 180,   reward: { gold: 400,  sp: 1  } },
  { id: 'ms_time_5m',   name: 'Endurance',        desc: 'Överlev 5 minuter',           metric: 'bestRunTime',   goal: 300,   reward: { gold: 600,  sp: 2  } },
  { id: 'ms_time_10m',  name: 'Marathonist',      desc: 'Överlev 10 minuter',          metric: 'bestRunTime',   goal: 600,   reward: { gold: 2000, sp: 6  } },
  { id: 'ms_level_10',  name: 'Rising',           desc: 'Nå level 10 i en runda',      metric: 'bestLevel',     goal: 10,    reward: { gold: 300,  sp: 1  } },
  { id: 'ms_level_25',  name: 'Power Surge',      desc: 'Nå level 25 i en runda',      metric: 'bestLevel',     goal: 25,    reward: { gold: 800,  sp: 3  } },
  { id: 'ms_level_40',  name: 'Ascendant',        desc: 'Nå level 40 i en runda',      metric: 'bestLevel',     goal: 40,    reward: { gold: 2500, sp: 8  } },
  { id: 'ms_nohit',     name: 'Untouchable',      desc: 'Fullfölj en runda utan att träffas', metric: 'noHitRuns', goal: 1, reward: { gold: 3000, sp: 8  } },
  { id: 'ms_endless',   name: 'Void Walker',      desc: 'Nå Endless Mode',             metric: 'endlessReached',goal: 1,     reward: { gold: 8000, sp: 20 } },
];

// ---------- EXTRA WEAPON (extra variety) ----------
export const EXTRA_WEAPONS = {
  iceLance: {
    id: 'iceLance', name: 'Ice Lance', icon: '❄️',
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
    id: 'meteorRain', name: 'Meteor Rain', icon: '☄️',
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
export const AIDA_INTRO = [
  { who: '', text: 'Space is mostly nothing.', emote: 'void' },
  { who: '', text: 'You are a very small amount of water in it.', emote: 'drop' },
  { who: '', text: 'This is statistically the worst place you could be.', emote: 'drop' },
  { who: '', text: 'Behind you: the Lake. Every drop you have ever known.', emote: 'lake' },
  { who: '', text: 'It is on fire. Water can do that now, apparently.', emote: 'burn' },
  { who: '', text: 'Nobody is coming. There is nobody left to come.', emote: 'void' },
  { who: '', text: 'So.', emote: 'beat' },
  { who: '', text: 'Evaporate quietly, or go and be a problem.', emote: 'choice' },
  { who: 'THE DROP', text: 'Problem it is.', emote: 'resolve' },
];

