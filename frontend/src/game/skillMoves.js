// Skill-tree nodes that grant a NEW VERB in a run — not a stat tick.
// Buying one fires the same UNLOCKED banner the camp uses for new menus.
// Keep this list explicit: `active:true` on a node is not enough (Decapitation
// is a chance, Berserker is a HP threshold). A move is something you DO.

export const SKILL_MOVES = {
  poe_mob3: {
    name: 'Shadow Dash', icon: 'pQuick',
    how: 'SHIFT on PC. Swipe the left stick on phone. You slide with i-frames.',
    sub: 'SHIFT  ·  SWIPE THE LEFT STICK  ·  I-FRAMES',
  },
  poe_mob3b: {
    name: 'Execution Swipe', icon: 'ui_blade',
    how: 'A nearby wounded enemy dies in a gore burst.',
    sub: 'NEARBY KILL BECOMES A CUT',
  },
  poe_mob6: {
    name: 'Blink Rupture', icon: 'tornado',
    how: 'Dash teleports. Landing detonates.',
    sub: 'DASH TELEPORTS AND DETONATES',
  },
  poe_mob7: {
    name: 'Phase Form', icon: 'ui_ghost',
    how: 'Dash through anything. Longer i-frames.',
    sub: 'DASH THROUGH ANYTHING',
  },
  poe_def6: {
    name: 'Aegis Barrier', icon: 'ui_star',
    how: 'Once every 25s a lethal hit is eaten.',
    sub: 'SURVIVE ONE LETHAL BLOW',
  },
  poe_def7: {
    name: 'Phoenix Rebirth', icon: 'pHoly',
    how: 'Once per run you stand back up at half HP.',
    sub: 'REVIVE ONCE PER RUN',
  },
  poe_bld6: {
    name: 'Adrenal Overdrive', icon: 'pQuick',
    how: 'Opens Abilities. Overdrive is a burst of fire rate and speed.',
    sub: 'ABILITIES MENU + OVERDRIVE',
  },
  poe_tmp5: {
    name: 'Evolution Vortex', icon: 'tornado',
    how: 'Every weapon forks four ways at level 5.',
    sub: 'WEAPON FORKS AT LEVEL 5',
  },
  poe_tmp6: {
    name: 'Undertow Vortex', icon: 'pQuick',
    how: 'Dash pulls enemies in. Longer i-frames.',
    sub: 'DASH PULLS ENEMIES IN',
  },
  poe_tmp7: {
    name: 'Riptide Cataclysm', icon: 'pWave',
    how: 'Riptide hits harder and roots.',
    sub: 'RIPTIDE ROOTS AND HITS HARDER',
  },
  h2o_core: {
    name: 'Dual Guns', icon: 'ui_waterdrop',
    how: 'Your manual weapon fires from both hands.',
    sub: 'DUAL-WIELD YOUR MANUAL WEAPON',
  },
  h2o_ring_1: {
    name: 'Tidal Aegis', icon: 'ui_shield',
    how: 'Once per run, dropping below 15% HP shields and heals.',
    sub: 'EMERGENCY SHIELD AT LOW HP',
  },
  h2o_ring_3: {
    name: 'Abyssal Deluge', icon: 'pWave',
    how: 'Every 20 kills a screen-wide wave.',
    sub: 'WAVE EVERY 20 KILLS',
  },
};

export function skillMoveOf(nodeOrId) {
  const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId && nodeOrId.id;
  const row = id && SKILL_MOVES[id];
  if (!row) return null;
  return { type: 'move', id, ...row };
}

export function unlockBannerFrom(item) {
  if (!item) return null;
  if (typeof item === 'string') return { type: 'tab', id: item };
  if (item.type === 'move' || item.how) return skillMoveOf(item.id) || item;
  return { type: item.type || 'tab', id: item.id, icon: item.icon, name: item.name, sub: item.sub };
}
