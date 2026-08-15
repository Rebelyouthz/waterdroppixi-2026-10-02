// =============================================
// STORYLINE CAMPAIGN — the default way to play
// =============================================
// A campaign node runs like a Jotunnslayer stage: you survive a set stretch
// while objectives tick over, the gate opens, and a boss arrives. Killing it
// clears the node.
//
// The point of the structure is that a node has a SHAPE — a beginning where
// you are building, a middle where the objectives push you, and an ending you
// either reach or don't. A flat "survive N minutes" has none of that, which
// is why the old nodes all felt the same regardless of length.

import { MAP_STAGES } from './data_ext2';
import { companionForNode } from './companions';
import { progressFor, resolveDifficulty, difficultyMods, rewardMult } from './difficulty';
import { BUILDINGS, buildingLevel } from './base';

// Which boss closes each map. Ordered so a map's finale escalates with how
// far into the story it sits.
export const MAP_BOSS = {
  // The Rain Pool closes on the same guardian the Lake does. Deliberately not
  // a new, weaker boss: meeting the Eye here at diff 0/1 scaling and then
  // meeting it again in the Lake at diff 1-3 teaches the player that a
  // guardian is a fight they can learn, which a one-off pushover would not.
  pond:  'bossOcular',
  lake:  'bossOcular',
  ruins: 'bossNecromancer',
  void:  'bossVoidTitan',
  ship:  'bossAida',
  sky:   'bossTidebreaker',
  // The Deep Current is the last map and had NO entry here at all, so its
  // nodes' "put the guardian down" objective could never be satisfied — the
  // final map of the campaign was uncompletable. The Hollow Queen is the one
  // boss not already spoken for, and a shape-shifting siege fight suits the
  // endless-mode capstone.
  deepcurrent: 'bossHollowQueen',
};

// How long you hold out before the boss gate opens.
//
// The old floor was 180s, which was ABOVE the derived gate for the first five
// nodes — so lake_1, lake_2, ruins_1 and ruins_2 all opened their gate at
// exactly three minutes regardless of their stated duration, and the whole
// early campaign read as one node repeated. The floor is now 150s (still a
// real middle) and the durations in MAP_STAGES have been spread far enough
// apart that the derived value is what actually decides, which is what the
// per-node duration was always supposed to mean.
export function bossGateTime(node) {
  const dur = node.duration || 300;
  // The floor has to stay BELOW the node's own length or the guardian can
  // never appear. At a flat 150 the new Rain Pool nodes (165s and 200s) would
  // have gated at 150s and 150s — the first one barely inside its own runtime,
  // and any shorter node would have been literally uncompletable. The floor is
  // now capped by the node itself, so a short intro node gates early and the
  // long ones are unchanged (lake_1 still 151s).
  const floor = Math.min(150, Math.round(dur * 0.6));
  return Math.max(floor, Math.min(600, Math.round(dur * 0.72)));
}

// Objectives for a node. Derived rather than authored per node: five maps of
// three nodes each is fifteen hand-written lists to keep in sync with the
// durations, and they would drift the first time a duration changed.
export function nodeObjectives(node) {
  const gate = bossGateTime(node);
  const killGoal = 40 + node.diff * 45;
  return [
    { id: 'clear',   icon: '⚔', label: `Cut down ${killGoal} of them`, goal: killGoal, metric: 'kills' },
    { id: 'survive', icon: '⏳', label: `Hold out ${Math.round(gate / 60)} minutes`, goal: gate, metric: 'time' },
    { id: 'boss',    icon: '💀', label: 'Put the guardian down', goal: 1, metric: 'bossKilled' },
  ];
}

// ---- Reward tiers ----------------------------------------------------------
// Three chests for clearing, two for reaching the boss, one for getting
// meaningfully into the node. Rewarding partial progress is what keeps a
// failed attempt from being wasted time.
export const REWARD_TIERS = [
  { chests: 0, label: 'Nothing recovered' },
  { chests: 1, label: 'Partial haul' },
  { chests: 2, label: 'Reached the guardian' },
  { chests: 3, label: 'Node cleared' },
];

export function rewardTier(result, node) {
  if (!node) return 0;
  const gate = bossGateTime(node);
  if (result.victory) return 3;
  if (result.time >= gate) return 2;
  if (result.time >= gate * 0.45) return 1;
  return 0;
}

// What a chest holds. Weighted toward the levelling currency, because gear
// parts are the steady progression and a whole item is the occasional event.
//
// `rm` is the difficulty reward multiplier (see game/difficulty.js). It scales
// the AMOUNTS and lifts the drop CHANCES, but the chance lift is capped — at
// Nightmare's ×2.4 an uncapped roll would put gear and runes at ~100%, which
// would turn the rarest outcome in the chest into the default one and flatten
// the whole loot table into "you always get everything".
export function rollCampaignChest(node, isFinal, rm = 1) {
  const diff = node?.diff || 1;
  const amt = (n) => Math.max(1, Math.round(n * rm));
  const chance = (p) => Math.min(0.85, p * (1 + (rm - 1) * 0.5));
  const out = [];
  out.push({ type: 'gold', amount: amt(220 * diff + Math.round(Math.random() * 180)) });
  out.push({ type: 'gearParts', amount: amt(8 + diff * 6 + Math.floor(Math.random() * 8)) });
  if (Math.random() < chance(0.42 + diff * 0.08)) out.push({ type: 'gear' });
  if (Math.random() < chance(0.18 + diff * 0.06)) out.push({ type: 'rune' });
  if (Math.random() < chance(0.22)) out.push({ type: 'gems', amount: amt(1 + Math.floor(Math.random() * 3)) });
  if (Math.random() < chance(0.30)) out.push({ type: 'petFood', amount: amt(1 + Math.floor(Math.random() * 3)) });
  // The last chest of a cleared node is the one worth chasing.
  if (isFinal) {
    out.push({ type: 'sp', amount: amt(1 + diff) });
    if (Math.random() < 0.5) out.push({ type: 'gearParts', amount: amt(20 + diff * 10) });
  }
  return out;
}

// Flattens MAP_STAGES into the ordered node list the campaign walks through,
// tagging each node with its map so the boss and story beat can be resolved
// from the node alone.
export function campaignNodes() {
  const out = [];
  for (const map of MAP_STAGES) {
    for (const node of map.nodes) {
      out.push({ ...node, mapId: map.id, mapName: map.name, mapIcon: map.icon, mapColor: map.color });
    }
  }
  return out;
}

// The next node the player has not cleared ON THE ACTIVE DIFFICULTY — what
// "Continue story" resumes. Switching to Hard therefore restarts the thread at
// the very first node, which is the intent: Hard is the story again, not the
// story's leftovers.
export function nextCampaignNode(save) {
  const progress = progressFor(save);
  return campaignNodes().find(n => !progress[n.id]) || null;
}

// ---- Camp unlock gating -----------------------------------------------------
// Timmy's intro pitch: the waterdrop washes up with nothing, the camp starts
// LOCKED, and he unlocks it panel by panel by going out from it and finding
// resources — which is just the story reason to play the three Rain Pool
// nodes that already existed as a deliberately gentle on-ramp (see
// paintCampaignNodes / MAP_STAGES's 'pond' entry: "the onramp... spawn rates
// start at 45% of normal"). No new mission type needed — reframe, don't
// rebuild. Always checked against NORMAL's mapProgress regardless of the
// player's selected difficulty, because the unlock is about having played
// the story beat at all, not about which difficulty tier it happened on —
// gating it to the active tier would re-lock the whole camp the moment
// someone switches to Hard, which is not the point of a Hard mode.
const CAMP_UNLOCK_NODES = ['pond_1', 'pond_2', 'pond_3'];

// 0 = fresh save, nothing but the story cleared yet. 1/2/3 = that many Rain
// Pool nodes cleared. Stage 3 is "the camp is fully built" — normal play
// from here on.
//
// Grandfathers every existing save: this gate did not exist before it was
// added, so a save that is already past it (cleared a later map, or has
// simply played enough to reach account rank 3+) unlocks everything rather
// than being retroactively locked out of progress it already earned. The
// new-player locked intro only ever fires for a save that has never
// cleared a campaign node at all.
export function campUnlockStage(save) {
  const cleared = save.mapProgress || {};
  const clearedNonPond = campaignNodes().some(n => !CAMP_UNLOCK_NODES.includes(n.id) && cleared[n.id]);
  if (clearedNonPond || (save.profile?.level || 1) >= 3) return 3;
  let n = 0;
  for (const id of CAMP_UNLOCK_NODES) { if (cleared[id]) n++; else break; }
  return n;
}

// ---- Camp menu unlock cascade -----------------------------------------------
// Timmy's refinement on top of the pond gate above: locking isn't keyed to
// WHICH pond node you cleared, it's keyed to building at the base. THE BASE
// is the one tab visible from the very start (dimmed until pond_1 is clear
// and there's something to spend) — everything else is fully absent from the
// tab bar, not just dimmed, per "bara base ska finnas där" — until its batch
// unlocks. Buying a building's first level (or any level after) is the
// dopamine moment: it cracks open the next batch of menus, revealed one at a
// time with a banner (see Camp.jsx's unlock-reveal queue).
//
// Deliberately not 1:1 with any single building — Timmy: "de behöver inte va
// exakt de building, de kan låsa upp mer menyer än själva building." So the
// gate is total levels bought across every building, not which one.
export function totalBuildingLevels(save) {
  return Object.keys(BUILDINGS).reduce((a, id) => a + buildingLevel(save, id), 0);
}

// Batch 1 is "the first 3 houses" Timmy names explicitly: Meta Upgrades,
// Skilltree, Talents — unlocked by the very first building purchase.
// Batch 2 ("ta de viktigast efter 3 saker" — take the most important next)
// fires on the SECOND, matching pond_1 + pond_2's gold rewards (700g, then
// 900g) each affording exactly one more building — so the two scripted
// missions map onto two unlock waves, one per mission, rather than the
// second wave waiting on a third mission that doesn't exist yet. Every
// batch after that keeps the cascade going a level at a time so the rest of
// the camp opens smoothly as building continues, without gating on
// missions beyond the two that currently exist.
const CAMP_UNLOCK_BATCHES = [
  { at: 1, tabs: ['cards', 'skills', 'talent'] },
  { at: 2, tabs: ['gear', 'character', 'pets', 'prospector'] },
  { at: 3, tabs: ['starraid', 'patrol', 'clicker'] },
  { at: 4, tabs: ['forge', 'chest', 'shop'] },
  { at: 5, tabs: ['loadout', 'pass', 'codex'] },
];

export function campTabsUnlockedAt(levels) {
  const out = new Set();
  for (const b of CAMP_UNLOCK_BATCHES) if (levels >= b.at) for (const t of b.tabs) out.add(t);
  return out;
}

// Tabs that cross from locked to unlocked between two building-level totals —
// what BasePanel hands Camp.jsx to drive the reveal-banner cascade after a
// purchase.
export function campNewlyUnlocked(beforeLevels, afterLevels) {
  const before = campTabsUnlockedAt(beforeLevels);
  const after = campTabsUnlockedAt(afterLevels);
  return [...after].filter(t => !before.has(t));
}

// Always open, regardless of stage: 'campaign' (how you play at all),
// 'stats' and 'settings' (not game content). Anything not named by 'base' or
// a batch above is also always open — this is an allow-list of what to LOCK,
// so a future tab that forgets to be added here fails open rather than
// trapping the player behind an unwinnable gate.
export function isCampTabLocked(tabId, save) {
  if (tabId === 'base') return campUnlockStage(save) < 1;
  if (!CAMP_UNLOCK_BATCHES.some(b => b.tabs.includes(tabId))) return false;
  return !campTabsUnlockedAt(totalBuildingLevels(save)).has(tabId);
}
export function campUnlockHint(tabId, save) {
  if (tabId === 'base') return 'Clear "The Rain Pool" to unlock';
  const batch = CAMP_UNLOCK_BATCHES.find(b => b.tabs.includes(tabId));
  if (!batch) return null;
  return `Build at the base to unlock`;
}

// The difficulty numbers a run should actually use, with the selected tier
// clamped to what the player has earned. Lives here rather than in
// difficulty.js because it needs the node list, and difficulty.js is
// deliberately free of the data layer (campaign.js already imports it, so
// putting the dependency the other way would be a cycle).
//
// Every site that decides combat or payout should go through this rather than
// reading save.difficulty directly.
export function resolvedDifficultyMods(save) {
  const ids = campaignNodes().map(n => n.id);
  return difficultyMods({ ...save, difficulty: resolveDifficulty(save, ids) });
}

export function resolvedRewardMult(save) {
  const ids = campaignNodes().map(n => n.id);
  return rewardMult({ ...save, difficulty: resolveDifficulty(save, ids) });
}

// Turns a campaign node into the `mission` object GameScreen already knows
// how to start a run with.
export function nodeToMission(node) {
  if (!node) return null;
  return {
    id: node.id,
    name: `${node.mapName} — ${node.name}`,
    isCampaign: true,
    mapId: node.mapId,
    diff: node.diff,
    // No target duration: the node ends when the guardian dies, not when a
    // clock runs out. The gate is what the timer is for.
    duration: 999,
    bossAt: bossGateTime(node),
    // A node can name its own guardian (pond_1's 'sludgeWarden' — a real
    // threat at a fresh-save baseline, not the shared bossOcular scaled for
    // a much later, geared-up fight) before falling back to the map's usual
    // boss.
    bossId: node.bossId || MAP_BOSS[node.mapId] || 'bossOcular',
    spawnMult: node.spawnMult || 1,
    enemyMix: node.enemyMix,
    // If this node is where a companion is found, the run spawns them as a
    // defendable second body — see engine.js's rescueCompanion.
    companion: companionForNode(node.id),
    // pond_1's baseline-reset + forced katana start — see GameScreen.jsx's
    // `forceBaseline` handling and data_ext2.js's pond_1 comment.
    forceBaseline: !!node.forceBaseline,
    startWeapons: node.startWeapons || null,
    node,
  };
}
