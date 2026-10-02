// =============================================================================
// A.I.D.A. HOLOGRAPHIC NPC DIALOGUE SYSTEM
// =============================================================================
// A.I.D.A. (Automated Intelligent Defense & Archive) is the sentient AI core
// of the space station. Her voice is calm, witty, and deeply invested in the
// station's restoration and the waterdrop's survival.
//
// Structured as a data-driven dialogue graph with conditions, variables,
// emotional expressions, and player response choices (following dialogue-systems skill).

import { buildingLevel, isStationRepaired } from './base';
import { cannotAffordStationQuest } from './stationQuests';

export const AIDA_MOODS = {
  calm:      { icon: '💧', color: '#5fd6ff', label: 'Calm' },
  curious:   { icon: '✨', color: '#ffd166', label: 'Curious' },
  proud:     { icon: '🌟', color: '#4dff91', label: 'Proud' },
  witty:     { icon: '😏', color: '#ff9a4d', label: 'Witty' },
  alarmed:   { icon: '⚠️', color: '#ff5f7a', label: 'Alert' },
};

export const AIDA_DIALOGUE_GRAPH = {
  // --- 1. AWAKENING SEQUENCE ---
  awakening_intro: {
    id: 'awakening_intro',
    mood: 'curious',
    speaker: 'A.I.D.A.',
    lines: [
      'Core initialization sequence... complete.',
      'Atmospheric sensors calibrating. Wait... you are... a sentient droplet of water?',
      'Station integrity is currently at 12%. Power grids are dark and life support is dormant.'
    ],
    choices: [
      { text: 'I found your core in the drift. Let’s get this station running.', to: 'awakening_plan', set: { met_aida: true } },
      { text: 'Who are you, and where are we?', to: 'awakening_lore', set: { met_aida: true } }
    ]
  },

  awakening_lore: {
    id: 'awakening_lore',
    mood: 'calm',
    speaker: 'A.I.D.A.',
    lines: [
      'I am A.I.D.A., the station’s automated intelligence.',
      'We are aboard Orbital Station Sanctuary, drifting above Earth’s upper thermosphere.',
      'When the cosmic anomaly hit, the crew evacuated and left the bulkheads breached. But with your hydro-matrix, we can rebuild it better than before.'
    ],
    choices: [
      { text: 'What is our first step to restore the base?', to: 'awakening_plan' }
    ]
  },

  awakening_plan: {
    id: 'awakening_plan',
    mood: 'proud',
    speaker: 'A.I.D.A.',
    lines: [
      'First, we must patch the bulkheads and clear the rubble.',
      'I will route emergency power to the central command table and unlock our core module blueprints.',
      'Whenever you return from expeditions out in the void, speak with me here. I will guide each upgrade phase.'
    ],
    choices: [
      { text: 'Understood. Let’s rebuild our home.', to: 'end', questUnlock: 'quest_clean_rubble' }
    ]
  },

  // --- 2. INTERIOR UPGRADE (OBSERVATION WINDOW) ---
  quest_window_hint: {
    id: 'quest_window_hint',
    mood: 'curious',
    speaker: 'A.I.D.A.',
    lines: [
      'The heavy blast shutters on the northern bulkhead are still sealed tight from emergency lockdown.',
      'If we upgrade Station Interior to Level 2, we can unseal the hydraulic motorized shutters and open our panoramic observation bay.',
      'You will be able to look out directly at Earth and the stars while resting in the sanctuary.'
    ],
    choices: [
      { text: 'I will gather the scrap and components to unseal the window.', to: 'end' }
    ]
  },

  // --- 3. FABRICATION FORGE ---
  quest_forge_hint: {
    id: 'quest_forge_hint',
    mood: 'witty',
    speaker: 'A.I.D.A.',
    lines: [
      'Over on the western platform lies our thermal fabrication forge.',
      'Currently it is just a cold heap of scorched titanium, but ignite the plasma conduit and we can forge and merge high-tier weapons and blueprints.',
      'A warrior of pure liquid still needs sharp steel, wouldn’t you agree?'
    ],
    choices: [
      { text: 'Let’s ignite the plasma forge.', to: 'end' }
    ]
  },

  // --- 4. BIO-LAB INCUBATOR ---
  quest_biolab_hint: {
    id: 'quest_biolab_hint',
    mood: 'proud',
    speaker: 'A.I.D.A.',
    lines: [
      'The cryo incubator in the eastern wing is receiving faint biometric pulses.',
      'Reactivating its nutrient synthesizers will let us hatch and nurture companion pets with unique combat synergies and card battling abilities.',
      'Plus, the little creatures seem quite fond of water droplets.'
    ],
    choices: [
      { text: 'I’ll get the Bio-Lab running right away.', to: 'end' }
    ]
  },

  // --- 5. HANGAR & EXPEDITION STARSHIP ---
  quest_hangar_hint: {
    id: 'quest_hangar_hint',
    mood: 'alarmed',
    speaker: 'A.I.D.A.',
    lines: [
      'Our primary expedition starship sits under a dusty maintenance tarp in the southern hangar bay.',
      'Restoring the hangar pressurization doors and refueling the sub-light warp drives will unlock deep Star Raid missions across asteroid belts.',
      'The void is dangerous, but the scrap yield is immense.'
    ],
    choices: [
      { text: 'I’m ready to restore the starship.', to: 'end' }
    ]
  },

  quest_drain_hint: {
    id: 'quest_drain_hint',
    mood: 'witty',
    speaker: 'A.I.D.A.',
    lines: [
      'There is a bolted grate in the hangar deck. Coolant drain. Ignore the singing.',
      'I need the crystal at the bottom for a transmitter I have not named. You will go down because it smells like the lake.',
      'Whatever you drink down there stays in you. That is the point.',
    ],
    choices: [
      { text: 'I will unscrew the hatch.', to: 'end' }
    ]
  },

  quest_gather: {
    id: 'quest_gather',
    mood: 'alarmed',
    speaker: 'A.I.D.A.',
    lines: [
      'The stores are empty. I cannot print steel out of dark.',
      'There is salvage in the Rain Pool. Hold it. Bring the wet coins back. Then we install the next piece.',
      'This is the work — not a side job. The station is the story until the hull, the hall, and the hangar hold.',
    ],
    choices: [
      { text: 'I am going back out.', to: 'end' },
    ]
  },

  // --- 6. IDLE AMBIENT CHATS ---
  ambient_greeting: {
    id: 'ambient_greeting',
    mood: 'calm',
    speaker: 'A.I.D.A.',
    lines: [
      'Welcome back to Sanctuary, operator.',
      'All station systems are stable and the ambient life support is pure.',
      'How may I assist your next phase of development?'
    ],
    choices: [
      { text: 'Check current station status & active objectives.', to: 'check_status' },
      { text: 'Tell me about the anomaly out in space.', to: 'lore_anomaly' },
      { text: 'I’m going to walk around and inspect the modules.', to: 'end' }
    ]
  },

  check_status: {
    id: 'check_status',
    mood: 'proud',
    speaker: 'A.I.D.A.',
    lines: [
      'Every module you construct directly boosts our power grid and your survival stats in the field.',
      'Check your active Station Storyline quests on your tactical HUD — rewards are waiting to be claimed.'
    ],
    choices: [
      { text: 'Thank you, A.I.D.A.', to: 'end' }
    ]
  },

  lore_anomaly: {
    id: 'lore_anomaly',
    mood: 'curious',
    speaker: 'A.I.D.A.',
    lines: [
      'The celestial waves mutating the creatures outside originated from a quantum nebula rupture.',
      'Your liquid form possesses unique resonance harmonics that allow you to absorb and transmute raw elemental drops.',
      'You are not just surviving out there — you are adapting into an unstoppable apex force.'
    ],
    choices: [
      { text: 'Let’s keep pushing the limits.', to: 'end' }
    ]
  }
};

/**
 * Apply a dialogue choice's `set` / `questUnlock` onto the save.
 * StationRoom used to ignore both, so talking to Aida never advanced anything.
 */
export function applyAidaChoice(save, choice) {
  if (!save || !choice) return save;
  let next = save;
  if (choice.set) {
    next = { ...next, aida: { ...(save.aida || {}), ...choice.set } };
  }
  if (choice.questUnlock) {
    next = {
      ...next,
      stationQuests: { ...(next.stationQuests || {}), [choice.questUnlock]: true },
    };
  }
  return next;
}

/**
 * Get active A.I.D.A. dialogue node based on station state.
 *
 * Repair writes `stationRepaired` via repairStation(). Gemini's graph read
 * `baseRepaired` and `stationQuests.quest_*` flags that nothing ever set, so
 * inserting the core replayed awakening_intro forever.
 */
export function getActiveAidaNode(save, options = {}) {
  if (!isStationRepaired(save) && !options.repairedNow) {
    return AIDA_DIALOGUE_GRAPH.awakening_intro;
  }

  const flags = save?.stationQuests || {};
  const claimed = save?.stationQuestsClaimed || {};
  const heard = (id) => !!(flags[id] || claimed[id]);

  if (buildingLevel(save, 'hull') < 1) return AIDA_DIALOGUE_GRAPH.awakening_plan;
  if (cannotAffordStationQuest(save)) return AIDA_DIALOGUE_GRAPH.quest_gather;
  if (!heard('quest_interior_window') && (save?.baseInteriorLevel || 1) < 2 && buildingLevel(save, 'rampart') < 1) {
    return AIDA_DIALOGUE_GRAPH.quest_window_hint;
  }
  if (buildingLevel(save, 'forge') < 1) return AIDA_DIALOGUE_GRAPH.quest_forge_hint;
  if (buildingLevel(save, 'incubator') < 1) return AIDA_DIALOGUE_GRAPH.quest_biolab_hint;
  if (buildingLevel(save, 'hangar') < 1) return AIDA_DIALOGUE_GRAPH.quest_hangar_hint;
  if (buildingLevel(save, 'drain') < 1) return AIDA_DIALOGUE_GRAPH.quest_drain_hint;

  return AIDA_DIALOGUE_GRAPH.ambient_greeting;
}
