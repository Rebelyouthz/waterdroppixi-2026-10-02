// =============================================
// COMPANIONS — other waterdrops, found and rescued in the storyline
// =============================================
// Three of them, each tied to a specific campaign node so meeting one is a
// story beat, not a menu unlock. Spread across three different maps rather
// than one per map — most nodes stay exactly as they were, and the ones
// that don't get real weight from being rare.
//
// A companion's node spawns them as a second, defendable body in the
// arena (see engine.js's rescueCompanion wiring). They take contact damage
// from nearby enemies same as the player does; if their hp reaches 0 the
// rescue fails for that attempt (nothing is lost — the node can be
// replayed), and if they're still alive when the node clears they come
// home with you.
//
// Once rescued, a companion is a permanent presence at the base: visible
// there, hosting the system tied to their role, and contributing a small
// mechanical bonus to Base Defence — not a full second character to gear
// up, just someone who was worth saving.
export const COMPANIONS = {
  finn: {
    id: 'finn', name: 'Finn', role: 'weaponsmith',
    build: 'stout',      // wide, low, heavy silhouette — see companionBodyPath
    color: '#ffb347', colorDeep: '#c47a1a',
    nodeId: 'lake_2',
    title: 'THE TINKERER',
    bio: "Built like a barrel and twice as tough. Says he's been fixing other people's guns since before the lake turned.",
    homeLine: 'Finn keeps the workbench now — say the word and he\'ll walk you through anything in the rack.',
    rescueLine: 'A stout waterdrop, boxed in by three ghouls, still swinging a wrench at them.',
  },
  mira: {
    id: 'mira', name: 'Mira', role: 'forge',
    build: 'slender',    // tall, narrow — see companionBodyPath
    color: '#b9a0ff', colorDeep: '#6a4fc2',
    nodeId: 'void_2',
    title: 'THE SMITH',
    bio: "Thin as a wire and just as sharp. Talks about rarity tiers the way other people talk about weather.",
    homeLine: 'Mira runs the forge — she has opinions about every merge you are about to attempt, and she is usually right.',
    rescueLine: 'A narrow shape pinned against a lab wall, void fiends circling, refusing to stop working.',
  },
  bram: {
    id: 'bram', name: 'Bram', role: 'defence',
    build: 'stout',
    color: '#7ad9ff', colorDeep: '#2f7fae',
    nodeId: 'ship_2',
    title: 'THE WARDEN',
    bio: 'Says nothing about how he ended up on an Annunaki ship alone. Fights like he has done this before.',
    homeLine: "Bram stands the wall now — Base Defence starts a little stronger with him on it.",
    rescueLine: 'A broad-shouldered waterdrop holding a collapsed corridor by himself.',
  },
};
export const COMPANION_LIST = Object.values(COMPANIONS);

export function companionForNode(nodeId) {
  return COMPANION_LIST.find(c => c.nodeId === nodeId) || null;
}

export function isRescued(save, id) {
  return !!(save.companions || {})[id]?.rescued;
}

export function rescuedCompanions(save) {
  return COMPANION_LIST.filter(c => isRescued(save, c.id));
}

// The one mechanical payoff outside their own role screen: each rescued
// companion makes Base Defence start a little stronger, stacking with the
// Rampart building rather than replacing it.
export function companionDefenceBonus(save) {
  const n = rescuedCompanions(save).filter(c => c.role === 'defence').length
    + Math.floor(rescuedCompanions(save).length / 3); // any full trio helps a little regardless of role
  return { scrap: n * 25, coreMax: n * 10 };
}
