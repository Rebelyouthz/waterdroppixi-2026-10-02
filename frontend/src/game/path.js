// =============================================
// THE PATH — one guided walk through every system
// =============================================
// The game has a lot of systems. Every one of them was discoverable only by
// opening the right tab and guessing, which meant most players would see
// maybe half of them and never learn what the other half were for.
//
// The Path fixes that by ordering them. Exactly one step is open at a time;
// it names a system, says in one line why that system exists, sends you
// there, and pays out when you have used it once. After that it never asks
// again — this is an introduction, not a chore list.
//
// Two rules it follows:
//
// 1. A step is satisfied by USING the system, not by owning it. "Build the
//    Rampart" is not a step; "build the Rampart and hold three waves" is.
//    Owning a building you never opened teaches nothing.
//
// 2. Steps are ordered by what they depend on, not by what they pay. Gear
//    comes before gear levelling, the base comes before the things it
//    houses, and the second map's guardian closes the walk because by then
//    you have everything you would want to bring to it.
//
// `go` is a destination id the camp resolves — see Camp.jsx's pathGo.

import { BUILDINGS, buildingLevel } from './base';

const anyValue = (obj) => Object.keys(obj || {}).length > 0;
const totalBuildings = (save) =>
  Object.keys(BUILDINGS).reduce((a, id) => a + buildingLevel(save, id), 0);

export const PATH_STEPS = [
  {
    id: 'firstRun', icon: 'ui_waterdrop', go: 'story',
    title: 'Take a run',
    why: 'Everything else in the game is paid for by what you carry out of a run.',
    goal: 'Finish one run',
    check: (s) => (s.runsCompleted || 0) >= 1,
    rwd: { gold: 250, gearParts: 6 },
  },
  {
    id: 'firstNode', icon: 'ui_scroll', go: 'story',
    title: 'Clear the first node',
    why: 'A story node ends on its guardian, not on a clock — that is the shape of the whole campaign.',
    goal: 'Put down one guardian',
    check: (s) => Object.keys(s.mapProgress || {}).some(id => id !== 'orbit_find'),
    rwd: { gold: 400, gearParts: 10 },
  },
  {
    id: 'equipGear', icon: 'gear_helmet', go: 'gear',
    title: 'Wear something',
    why: 'Gear is the only stat source that is not spent — it stays on you between runs.',
    goal: 'Equip one piece',
    check: (s) => anyValue(s.gearEquipped),
    rwd: { gold: 300, gearParts: 12 },
  },
  {
    id: 'levelGear', icon: 'catStatBoost', go: 'gear',
    title: 'Level that piece',
    why: 'Gear starts weak on purpose. Levels are where it becomes worth the slot — and rarity only opens at 10.',
    goal: 'Take a piece to level 3',
    check: (s) => (s.gearInventory || []).some(g => (g.level || 1) >= 3),
    rwd: { gold: 450, gearParts: 18 },
  },
  {
    id: 'tuneWeapon', icon: 'ui_smith', go: 'smith',
    title: 'Tune a weapon',
    why: 'The Weaponsmith upgrades one weapon rather than all of them — it is where a favourite becomes a build.',
    goal: 'Buy one tuning tier',
    check: (s) => Object.values(s.weaponParts || {}).some(anyValue),
    rwd: { gold: 500, gearParts: 14 },
  },
  {
    id: 'socketAttach', icon: 'ui_part', go: 'smith',
    title: 'Bolt something on',
    why: 'Every attachment is a trade, and every one of them is visible on the gun in your hands.',
    goal: 'Socket one attachment',
    check: (s) => Object.values(s.weaponAttach || {}).some(anyValue),
    rwd: { gold: 550, gearParts: 16 },
  },
  {
    id: 'socketRune', icon: 'rune', go: 'smith',
    title: 'Set a rune',
    why: 'Runes are the one slot that changes behaviour instead of numbers.',
    goal: 'Socket one rune',
    check: (s) => anyValue(s.weaponRunes) || anyValue(s.gearRunes),
    rwd: { gold: 600, gems: 1 },
  },
  {
    id: 'buildBase', icon: 'ui_base', go: 'base',
    title: 'Raise the base',
    why: 'Buildings are where gold stops buying stats and starts buying systems.',
    goal: 'Build anything, once',
    check: (s) => totalBuildings(s) >= 1,
    rwd: { gold: 700, gearParts: 22 },
  },
  {
    id: 'useWell', icon: 'tornado', go: 'base',
    title: 'Sink The Well',
    why: 'The Well runs while you are gone. It is the only system that pays for time you did not spend.',
    goal: 'Build The Well, then draw 500 drops',
    check: (s) => buildingLevel(s, 'well') >= 1 && ((s.clicker || {}).total || 0) >= 500,
    rwd: { gold: 650, gearParts: 20 },
  },
  {
    id: 'useIncubator', icon: 'ui_egg', go: 'base',
    title: 'Warm an egg',
    why: 'A pet grows through four stages and each one is a real multiplier, not a label.',
    goal: 'Build the Incubator, then hatch one',
    check: (s) => buildingLevel(s, 'incubator') >= 1 && (s.pets || []).length >= 1,
    rwd: { gold: 700, petFood: 4 },
  },
  {
    id: 'usePatrol', icon: 'ui_map', go: 'patrol',
    title: 'Send them out',
    why: 'Patrols are how attachments, runes and food arrive without you playing for them.',
    goal: 'Build the Patrol Post and run a patrol',
    check: (s) => buildingLevel(s, 'patrolPost') >= 1 && (s.patrol?.missions || []).length >= 1,
    rwd: { gold: 750, gearParts: 24 },
  },
  {
    id: 'useForge', icon: 'ui_flame', go: 'gear',
    title: 'Risk a merge',
    why: 'Three of a kind become one better one — or two of them are gone. Flux is what buys down the risk.',
    goal: 'Build the Forge and attempt a merge',
    check: (s) => buildingLevel(s, 'forge') >= 1 && (s.pathMerges || 0) >= 1,
    rwd: { gold: 800, flux: 2 },
  },
  {
    id: 'useRampart', icon: 'ui_shield', go: 'defence',
    title: 'Hold the line',
    why: 'Base Defence does not pay out into itself — what you win there is a buff on your next run.',
    goal: 'Build the Rampart and hold 3 waves',
    check: (s) => buildingLevel(s, 'rampart') >= 1 && (s.defenceBest || 0) >= 3,
    rwd: { gold: 900, gearParts: 28 },
  },
  {
    id: 'useHangar', icon: 'ui_rocket', go: 'hangar',
    title: 'Fly a raid',
    why: 'Star Raid is a different game with the same account — its scrap and artifacts come back here.',
    goal: 'Build the Hangar, walk the bay, and finish a raid',
    check: (s) => buildingLevel(s, 'hangar') >= 1 && ((s.starRaid || {}).stageUnlocked || 0) >= 1,
    rwd: { gold: 950, gems: 2 },
  },
  {
    id: 'useDrain', icon: 'ui_hatch', go: 'drain',
    title: 'Unscrew the grate',
    why: 'Mutations only come from under the hangar. Gold and skill points drip; the dash stretch does not.',
    goal: 'Open THE DRAIN and drink once',
    check: (s) => (s.mutationsUnlocked || []).length >= 1 || (s.drainRuns || 0) >= 1 || (s.shaftRuns || 0) >= 1,
    rwd: { gold: 800, sp: 1, talentPoints: 1 },
  },
  {
    id: 'useProspect', icon: 'ui_pickaxe', go: 'prospect',
    title: 'Go down and come back up',
    why: 'The Prospector is pure push-your-luck: every layer deeper is worth more and likelier to take it all.',
    goal: 'Bank a dive with at least one Core',
    check: (s) => (s.cores || 0) >= 1 || (s.prospectBlueprints || 0) >= 1,
    rwd: { gold: 900, flux: 3 },
  },
  {
    id: 'clearMapTwo', icon: 'ui_void', go: 'story',
    title: 'Finish the second map',
    why: 'You have now touched every system in the game. This is the first fight that expects you to have.',
    goal: 'Clear six story nodes',
    check: (s) => Object.keys(s.mapProgress || {}).length >= 6,
    rwd: { gold: 2000, gems: 5, sp: 2, gearParts: 40 },
  },
];

export const PATH_INDEX = PATH_STEPS.reduce((m, s) => { m[s.id] = s; return m; }, {});

// The step the player is on: the first one they have not been paid for. Note
// this is claim order, not check order — a step whose condition is already
// satisfied still has to be collected, so nothing is skipped silently and
// the player always sees what they just earned.
export function currentStep(save) {
  const done = save.pathClaimed || {};
  return PATH_STEPS.find(s => !done[s.id]) || null;
}

export function pathProgress(save) {
  const done = save.pathClaimed || {};
  return PATH_STEPS.filter(s => done[s.id]).length;
}
