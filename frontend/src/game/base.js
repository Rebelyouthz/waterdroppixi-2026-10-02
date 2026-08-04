// =============================================
// THE BASE — the camp as a place, not a tab strip
// =============================================
// Every idle/meta system already existed as its own menu entry. Buildings do
// two things those tabs could not: they give each system a location you
// upgrade, and they give gold a sink that improves systems rather than
// improving the character directly.
//
// Rule the whole thing follows: a building's levels must improve its OWN
// system and nothing else. A building that hands out generic stats is just a
// meta-upgrade wearing a hat, and then the base is decoration.

export const BUILDINGS = {
  hangar: {
    id: 'hangar', name: 'Hangar', icon: 'drone', accent: '#5fd6ff', max: 10,
    blurb: 'Ships, and the people who patch them up.',
    effect: (l) => `+${l * 3}% Star Raid hull and damage`,
    costGold: 900, costParts: 12, growth: 1.42,
  },
  incubator: {
    id: 'incubator', name: 'Incubator', icon: 'heart', accent: '#ff9a4d', max: 9,
    blurb: 'Warm racks, humming quietly.',
    effect: (l) => `-${Math.round(l * 4)}% hatch time${l >= 3 ? `, +${Math.floor(l / 3)} slot${Math.floor(l / 3) > 1 ? 's' : ''}` : ''}`,
    costGold: 700, costParts: 8, growth: 1.40,
  },
  patrolPost: {
    id: 'patrolPost', name: 'Patrol Post', icon: 'shield', accent: '#4dff91', max: 10,
    blurb: 'Maps on the wall, boots by the door.',
    effect: (l) => `+${l * 6}% patrol rewards${l >= 4 ? `, +${l >= 8 ? 2 : 1} mission slot${l >= 8 ? 's' : ''}` : ''}`,
    costGold: 800, costParts: 10, growth: 1.41,
  },
  well: {
    id: 'well', name: 'The Well', icon: 'orb', accent: '#7cd6ff', max: 12,
    blurb: 'It goes down further than anyone has measured.',
    effect: (l) => `+${l * 10}% drop production`,
    costGold: 600, costParts: 6, growth: 1.38,
  },
  forge: {
    id: 'forge', name: 'Forge', icon: 'bolt', accent: '#ffd166', max: 10,
    blurb: 'Hot, loud, and the only place a merge might hold.',
    effect: (l) => `+${l * 2}% merge success`,
    costGold: 1100, costParts: 16, growth: 1.45,
  },
};

export function buildingLevel(save, id) {
  return (save?.base || {})[id] || 0;
}

export function buildingCost(id, lvl) {
  const b = BUILDINGS[id];
  const k = Math.pow(b.growth, lvl);
  return { gold: Math.round(b.costGold * k), parts: Math.round(b.costParts * k) };
}

// ---- Derived effects -------------------------------------------------------
// Read from the systems themselves rather than duplicated into the save, so a
// building level can never disagree with the bonus it is supposed to grant.

export function incubatorSlots(save) {
  return 2 + Math.floor(buildingLevel(save, 'incubator') / 3);
}

export function incubatorSpeedMult(save) {
  return Math.max(0.5, 1 - buildingLevel(save, 'incubator') * 0.04);
}

export function patrolSlots(save) {
  const l = buildingLevel(save, 'patrolPost');
  return 3 + (l >= 4 ? 1 : 0) + (l >= 8 ? 1 : 0);
}

export function patrolRewardMult(save) {
  return 1 + buildingLevel(save, 'patrolPost') * 0.06;
}

export function clickerRateMult(save) {
  return 1 + buildingLevel(save, 'well') * 0.10;
}

export function forgeBonus(save) {
  return buildingLevel(save, 'forge') * 0.02;
}

export function raidHullMult(save) {
  return 1 + buildingLevel(save, 'hangar') * 0.03;
}
