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

import { companionDefenceBonus } from './companions';

// THE HULL is the first thing that exists, and it is deliberately different
// from every other entry: max level 1, and its "effect" is that the station
// becomes airtight enough to install anything else in. Gating IS its effect, so
// it does not break this file's rule — it is not handing out a stat that
// belongs to someone else's system, and it invents no field for the engine to
// silently ignore.
//
// Buying it is also the first purchase in the game, so it is what opens the
// Skill Tree / Talents / Meta batch through campNewlyUnlocked.
export const BUILDINGS = {
  hull: {
    id: 'hull', name: 'The Hull', icon: 'ui_base', accent: '#9fb6c6', max: 1,
    blurb: 'Holed in four places. Everything else waits on this.',
    effect: () => 'Station sealed — modules can be installed',
    costGold: 600, costParts: 0, growth: 1,
  },
  hangar: {
    id: 'hangar', name: 'Hangar', icon: 'drone', accent: '#5fd6ff', max: 10,
    blurb: 'Outside the ring. Ships, and nobody left to patch them up.',
    effect: (l) => `+${l * 3}% Star Raid hull and damage`,
    costGold: 900, costParts: 12, growth: 1.42,
  },
  incubator: {
    id: 'incubator', name: 'Bio Lab', icon: 'heart', accent: '#ff9a4d', max: 9,
    blurb: 'Warm racks, humming quietly. Something in one of them moved.',
    effect: (l) => `-${Math.round(l * 4)}% hatch time${l >= 3 ? `, +${Math.floor(l / 3)} slot${Math.floor(l / 3) > 1 ? 's' : ''}` : ''}`,
    costGold: 700, costParts: 8, growth: 1.40,
  },
  patrolPost: {
    id: 'patrolPost', name: 'Navigation', icon: 'shield', accent: '#4dff91', max: 10,
    blurb: 'Charts, a dead screen, and every route plotted wrong.',
    effect: (l) => `+${l * 6}% patrol rewards${l >= 4 ? `, +${l >= 8 ? 2 : 1} mission slot${l >= 8 ? 's' : ''}` : ''}`,
    costGold: 800, costParts: 10, growth: 1.41,
  },
  well: {
    id: 'well', name: 'Reclamation', icon: 'orb', accent: '#7cd6ff', max: 12,
    blurb: 'Recycles the water. Nobody asks how many times.',
    effect: (l) => `+${l * 10}% drop production`,
    costGold: 600, costParts: 6, growth: 1.38,
  },
  forge: {
    id: 'forge', name: 'Fabrication', icon: 'bolt', accent: '#ffd166', max: 10,
    blurb: 'Hot, loud, and the only place a merge might hold.',
    effect: (l) => `+${l * 2}% merge success`,
    costGold: 1100, costParts: 16, growth: 1.45,
  },
  rampart: {
    id: 'rampart', name: 'Main Hall', icon: 'shield', accent: '#ff5f7a', max: 10,
    blurb: 'The big room. A core, and four corridors something keeps walking down.',
    effect: (l) => `+${l * 12} core, +${l * 15} scrap${l >= 4 ? `, ${l >= 8 ? 2 : 1} free tower` : ''}`,
    costGold: 1000, costParts: 14, growth: 1.43,
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

// Base Defence starts from what the Rampart is. Levels buy you a tougher
// core, more opening scrap, and eventually towers already standing when the
// first wave arrives.
export function defenceStart(save) {
  const l = buildingLevel(save, 'rampart');
  // Bram (the rescued companion whose role is Base Defence — see
  // game/companions.js) adds on top of the Rampart rather than replacing
  // it, same as every other bonus source in this file stacks.
  const bonus = companionDefenceBonus(save);
  return {
    coreMax: 100 + l * 12 + bonus.coreMax,
    scrap: 90 + l * 15 + bonus.scrap,
    freeTowers: l >= 8 ? 2 : l >= 4 ? 1 : 0,
  };
}

// ---- Repair, and what it gates ---------------------------------------------
// Timmy's opening: you arrive at a derelict station, and the FIRST thing you can
// touch is cleaning it up. It costs nothing — it has to be available whatever
// happened in that first run, win or lose — and until it is done, nothing else
// in the menu can be pressed.
// GRANDFATHERING, and it is load-bearing. Any save made before the station
// existed already has modules built. Gating those behind a repair the player
// could never have performed would take away things they already own — the
// same class of mistake as re-locking a camp on a difficulty switch.
function hasLegacyModules(save) {
  const b = (save && save.base) || {};
  return Object.keys(BUILDINGS).some(id => id !== 'hull' && (b[id] || 0) > 0);
}

export function isStationRepaired(save) {
  return !!(save && save.stationRepaired) || hasLegacyModules(save);
}

// The repair itself, as a save transform rather than a button handler.
//
// It lives here because there are now TWO places you can do it: the module list
// (BasePanel) and standing in the middle of the room (StationRoom). Two copies
// of "set the flag and hope nothing else was needed" is exactly the failure
// mode this project keeps paying for, so there is one function and both call
// it. Idempotent — repairing an already-repaired station is a no-op, which
// matters because the room and the panel can both be mounted at once.
export function repairStation(save) {
  if (!save || save.stationRepaired) return save;
  return { ...save, stationRepaired: true };
}

// After the repair, exactly ONE thing is buildable: the hull. Every other module
// stays dark until the hull is sealed.
export function isModuleAvailable(save, id) {
  if (!isStationRepaired(save)) return false;
  if (id === 'hull') return true;
  return buildingLevel(save, 'hull') >= 1 || hasLegacyModules(save);
}
