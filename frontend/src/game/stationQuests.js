// =============================================================================
// STATION STORYLINE QUEST SYSTEM
// =============================================================================
// A guided, reward-rich base reconstruction campaign. Every step visually
// restores and upgrades a piece of the walkable space station sanctuary.

import { buildingLevel, buildingCost, isStationRepaired } from './base';

export const STATION_QUESTS = [
  {
    id: 'quest_awaken',
    title: '1. Awakening of Sanctuary',
    desc: 'Insert the A.I.D.A. Core into the central command terminal to restore station power.',
    icon: 'ui_base',
    accent: '#5fd6ff',
    reward: { gold: 500, scrap: 50, gems: 5 },
    check: (save) => isStationRepaired(save),
    dialogueKey: 'awakening_intro'
  },
  {
    id: 'quest_clean_rubble',
    title: '2. Seal the Hull & Clear Rubble',
    desc: 'Patch the four hull breaches in the Main Hall to pressurize the station.',
    icon: 'ui_shield',
    accent: '#9fb6c6',
    module: 'hull',
    reward: { gold: 800, scrap: 80, gearParts: 15 },
    check: (save) => buildingLevel(save, 'hull') >= 1,
    dialogueKey: 'awakening_plan'
  },
  {
    id: 'quest_interior_window',
    title: '3. Unseal the Panoramic Earth Window',
    desc: 'Build the Main Hall so the blast shutters open onto Earth.',
    icon: 'ui_star',
    accent: '#ffd166',
    module: 'rampart',
    reward: { gold: 1200, scrap: 120, gems: 10 },
    check: (save) => buildingLevel(save, 'rampart') >= 1,
    dialogueKey: 'quest_window_hint'
  },
  {
    id: 'quest_forge',
    title: '4. Thermal Fabrication Forge',
    desc: 'Reactivate the western plasma anvil to enable weapon forging and blueprint merging.',
    icon: 'bolt',
    accent: '#ff9a4d',
    module: 'forge',
    reward: { gold: 1500, scrap: 150, gearParts: 25 },
    check: (save) => buildingLevel(save, 'forge') >= 1,
    dialogueKey: 'quest_forge_hint'
  },
  {
    id: 'quest_well',
    title: '5. Hydro Reclamation Reservoir',
    desc: 'Restore the water recycling pipes to start generating passive drops.',
    icon: 'orb',
    accent: '#7cd6ff',
    module: 'well',
    reward: { gold: 1800, scrap: 180, gems: 15 },
    check: (save) => buildingLevel(save, 'well') >= 1,
    dialogueKey: 'ambient_greeting'
  },
  {
    id: 'quest_biolab',
    title: '6. Bio-Lab Cryo Incubator',
    desc: 'Power up the eastern nutrient pods to begin hatching and breeding companion pets.',
    icon: 'heart',
    accent: '#4dff91',
    module: 'incubator',
    reward: { gold: 2200, scrap: 220, gems: 20 },
    check: (save) => buildingLevel(save, 'incubator') >= 1,
    dialogueKey: 'quest_biolab_hint'
  },
  {
    id: 'quest_hangar',
    title: '7. Rebuild the Expedition Starship',
    desc: 'Clear the maintenance tarp in the southern hangar bay and prep the starship.',
    icon: 'drone',
    accent: '#5fd6ff',
    module: 'hangar',
    reward: { gold: 3000, scrap: 300, gems: 25 },
    check: (save) => buildingLevel(save, 'hangar') >= 1,
    dialogueKey: 'quest_hangar_hint'
  },
  {
    id: 'quest_drain',
    title: '8. The Grate Under the Hangar',
    desc: 'Unscrew the bolted hatch in the hangar floor. A.I.D.A. calls it THE DRAIN.',
    icon: 'ui_hatch',
    accent: '#5fd6ff',
    module: 'drain',
    reward: { gold: 2500, scrap: 200, gems: 20 },
    check: (save) => buildingLevel(save, 'drain') >= 1,
    dialogueKey: 'quest_drain_hint'
  },
  {
    id: 'quest_defenses',
    title: '9. Fortify Exterior Hull Defenses',
    desc: 'Install defensive perimeter turrets and shield emitters to defend against alien raids.',
    icon: 'shield',
    accent: '#ff5f7a',
    module: 'rampart',
    reward: { gold: 4000, scrap: 400, gems: 35 },
    check: (save) => buildingLevel(save, 'rampart') >= 2,
    dialogueKey: 'ambient_greeting'
  }
];

/**
 * Check if a quest is ready to be claimed or already completed.
 */
export function getStationQuestStatus(save, questId) {
  const claimed = (save?.stationQuestsClaimed || {})[questId];
  if (claimed) return 'claimed';
  const q = STATION_QUESTS.find(x => x.id === questId);
  if (!q) return 'locked';
  return q.check(save) ? 'ready' : 'in_progress';
}

/**
 * Claim quest rewards and mutate save cleanly.
 */
export function claimStationQuest(save, questId) {
  const q = STATION_QUESTS.find(x => x.id === questId);
  if (!q || !q.check(save)) return save;
  const claimedMap = { ...(save.stationQuestsClaimed || {}) };
  if (claimedMap[questId]) return save;
  
  claimedMap[questId] = Date.now();
  const s = { ...save };
  s.stationQuestsClaimed = claimedMap;
  
  // Award rewards
  const rwd = q.reward || {};
  if (rwd.gold) s.gold = (s.gold || 0) + rwd.gold;
  if (rwd.scrap) s.scrap = (s.scrap || 0) + rwd.scrap;
  if (rwd.gems) s.gems = (s.gems || 0) + rwd.gems;
  if (rwd.gearParts) s.gearParts = (s.gearParts || 0) + rwd.gearParts;
  
  return s;
}

/**
 * Get the current active quest the player should focus on next.
 */
export function getCurrentStationQuest(save) {
  for (const q of STATION_QUESTS) {
    const status = getStationQuestStatus(save, q.id);
    if (status !== 'claimed') {
      return { ...q, status };
    }
  }
  return null;
}

/** The next MODULE to install. Skips awaken (no buy) and claim-ready quests. */
export function getActiveBuildQuest(save) {
  for (const q of STATION_QUESTS) {
    if (!q.module) continue;
    if (getStationQuestStatus(save, q.id) === 'in_progress') {
      return { ...q, status: 'in_progress' };
    }
  }
  return null;
}

/**
 * The next hall purchase the story wants, if the player cannot pay for it.
 * Null means either there is nothing to buy, or the stores cover it.
 */
export function cannotAffordStationQuest(save) {
  const q = getActiveBuildQuest(save);
  if (!q) return null;
  const lvl = buildingLevel(save, q.module);
  const cost = buildingCost(q.module, lvl);
  const goldShort = (save.gold || 0) < cost.gold;
  const partsShort = (save.gearParts || 0) < cost.parts;
  if (!goldShort && !partsShort) return null;
  return { id: q.id, module: q.module, cost, goldShort, partsShort };
}
