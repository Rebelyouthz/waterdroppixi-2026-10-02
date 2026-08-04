// =============================================
// WEAPON ATTACHMENTS — parts you bolt onto a gun
// =============================================
// The loose-parts system already existed as tiers you bought per weapon. This
// is the other half: physical attachments you FIND, socket into a weapon's
// five slots, and can see on the gun in the character's hands.
//
// Two rules keep it from turning into another stat sheet:
//   1. Every attachment is a trade. A longer barrel is more damage and less
//      fire rate. A drum mag is more rounds and a slower reload. A slot you
//      fill should be a decision, not a number going up.
//   2. Every attachment is VISIBLE on the drawn weapon (see pixiRenderer's
//      _drawHeldWeapon). If you cannot see it, it is a stat, not a part.

export const ATTACH_SLOTS = ['barrel', 'optic', 'magazine', 'underbarrel', 'coating'];
export const ATTACH_SLOT_INFO = {
  barrel:      { name: 'Barrel',      icon: 'cannon', desc: 'Where the round leaves.' },
  optic:       { name: 'Optic',       icon: 'beam',   desc: 'What you line up with.' },
  magazine:    { name: 'Magazine',    icon: 'shield', desc: 'How much before you stop.' },
  underbarrel: { name: 'Underbarrel', icon: 'blade',  desc: 'What you hold it steady with.' },
  coating:     { name: 'Coating',     icon: 'flame',  desc: 'What it does on contact.' },
};

export const ATTACH_RARITIES = ['common', 'magic', 'rare', 'epic', 'legendary', 'mythical'];
export const ATTACH_RARITY_COLORS = {
  common: '#9a8fa6', magic: '#4dc4ff', rare: '#ffd166',
  epic: '#b362ff', legendary: '#ff7a1a', mythical: '#ff3146',
};
const RARITY_MULT = { common: 1, magic: 1.5, rare: 2.1, epic: 3.0, legendary: 4.2, mythical: 6.0 };

// Every entry lists what it gives AND what it costs. `mods` are multipliers
// on the computed weapon stats; `add` are flat additions.
export const ATTACH_POOL = [
  // --- barrels ---
  { id: 'longBarrel',  slot: 'barrel', name: 'Long Barrel',    mods: { damage: 0.16, projSpeed: 0.20 }, cost: { fireRate: 0.10 }, look: 'long' },
  { id: 'shortBarrel', slot: 'barrel', name: 'Cutdown',        mods: { fireRate: 0.18 }, cost: { damage: 0.10, spreadAdd: 0.03 }, look: 'short' },
  { id: 'ported',      slot: 'barrel', name: 'Ported Barrel',  mods: { fireRate: 0.10, accuracy: 0.5 }, cost: { damage: 0.05 }, look: 'ported' },

  // --- optics ---
  { id: 'redDot',      slot: 'optic', name: 'Red Dot',        mods: { accuracy: 0.35, crit: 0.02 }, cost: {}, look: 'dot' },
  { id: 'longScope',   slot: 'optic', name: 'Long Scope',     mods: { crit: 0.07, damage: 0.08 }, cost: { fireRate: 0.08 }, look: 'scope' },
  { id: 'wideSight',   slot: 'optic', name: 'Wide Sight',     mods: { fireRate: 0.09 }, cost: { crit: 0.02 }, look: 'wide' },

  // --- magazines ---
  { id: 'drumMag',     slot: 'magazine', name: 'Drum Mag',    mods: { magazine: 0.70 }, cost: { reload: 0.30 }, look: 'drum' },
  { id: 'quickMag',    slot: 'magazine', name: 'Quick Mag',   mods: { reload: -0.32 }, cost: { magazine: 0.20 }, look: 'short' },
  { id: 'beltFeed',    slot: 'magazine', name: 'Belt Feed',   mods: { magazine: 0.35, fireRate: 0.06 }, cost: { reload: 0.15 }, look: 'belt' },

  // --- underbarrel ---
  { id: 'foregrip',    slot: 'underbarrel', name: 'Foregrip', mods: { accuracy: 0.55 }, cost: {}, look: 'grip' },
  { id: 'bipod',       slot: 'underbarrel', name: 'Bipod',    mods: { damage: 0.12, accuracy: 0.30 }, cost: { fireRate: 0.06 }, look: 'bipod' },
  { id: 'bayonet',     slot: 'underbarrel', name: 'Bayonet',  mods: { knockback: 0.5, damage: 0.07 }, cost: {}, look: 'bayonet' },

  // --- coatings (the only slot that changes what a hit DOES) ---
  { id: 'incendiary',  slot: 'coating', name: 'Incendiary Wash', mods: {}, cost: {}, element: 'fire',  look: 'coat' },
  { id: 'cryo',        slot: 'coating', name: 'Cryo Wash',       mods: {}, cost: {}, element: 'ice',   look: 'coat' },
  { id: 'corrosive',   slot: 'coating', name: 'Corrosive Wash',  mods: {}, cost: {}, element: 'poison', look: 'coat' },
  { id: 'voidWash',    slot: 'coating', name: 'Void Wash',       mods: {}, cost: {}, element: 'void',  look: 'coat' },
];

const PREFIX = {
  common: 'Scrap', magic: 'Tuned', rare: 'Machined',
  epic: 'Precision', legendary: 'Masterwork', mythical: 'Waterborn',
};

export function generateAttachment(rarity) {
  const def = ATTACH_POOL[Math.floor(Math.random() * ATTACH_POOL.length)];
  const m = RARITY_MULT[rarity] || 1;
  const scale = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = parseFloat((v * m).toFixed(4));
    return out;
  };
  return {
    id: `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    defId: def.id,
    slot: def.slot,
    rarity,
    name: `${PREFIX[rarity]} ${def.name}`,
    // Downsides do NOT scale with rarity. A legendary should be strictly
    // better than a common of the same type, otherwise high rarity is a
    // liability and the whole ladder inverts.
    mods: scale(def.mods),
    cost: { ...def.cost },
    element: def.element || null,
    look: def.look,
  };
}

export function rollAttachment(luck = 0) {
  const r = Math.random() - luck * 0.02;
  if (r < 0.004) return generateAttachment('mythical');
  if (r < 0.03) return generateAttachment('legendary');
  if (r < 0.10) return generateAttachment('epic');
  if (r < 0.26) return generateAttachment('rare');
  if (r < 0.55) return generateAttachment('magic');
  return generateAttachment('common');
}

// Applies every attachment socketed into `weaponId` to a computed stats
// object. Called at the end of computeWeaponStats so attachments sit on top
// of levels, forks, mods and class passives.
export function applyAttachments(save, weaponId, s) {
  const sockets = (save?.weaponAttach || {})[weaponId];
  if (!sockets) return s;
  const inv = save.attachInventory || [];
  for (const slot of ATTACH_SLOTS) {
    const a = inv.find(x => x.id === sockets[slot]);
    if (!a) continue;
    const bump = (k, v) => {
      if (k === 'spreadAdd') { s.spread = (s.spread || 0) + v; return; }
      if (k === 'accuracy') { s.spread = Math.max(0, (s.spread || 0) * (1 - Math.min(0.85, v))); return; }
      if (k === 'crit') { s.crit = (s.crit || 0) + v; return; }
      if (k === 'reload') { s.reloadTime = (s.reloadTime || 1) * (1 + v); return; }
      s[k] = (s[k] || 0) * (1 + v);
    };
    for (const [k, v] of Object.entries(a.mods || {})) bump(k, v);
    for (const [k, v] of Object.entries(a.cost || {})) bump(k, k === 'reload' ? v : -v);
    if (a.element) s._attachElement = a.element;
  }
  return s;
}

// What the renderer needs to draw the gun with its attachments on.
export function attachmentLooks(save, weaponId) {
  const sockets = (save?.weaponAttach || {})[weaponId];
  if (!sockets) return null;
  const inv = save.attachInventory || [];
  const out = {};
  for (const slot of ATTACH_SLOTS) {
    const a = inv.find(x => x.id === sockets[slot]);
    if (a) out[slot] = { look: a.look, color: ATTACH_RARITY_COLORS[a.rarity] };
  }
  return out;
}
