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

// Which boss closes each map. Ordered so a map's finale escalates with how
// far into the story it sits.
export const MAP_BOSS = {
  lake:  'bossOcular',
  ruins: 'bossNecromancer',
  void:  'bossVoidTitan',
  ship:  'bossAida',
  sky:   'bossTidebreaker',
};

// How long you hold out before the boss gate opens. Scales with the node's
// difficulty, floored so even a first node has a real middle, and capped so a
// late node never becomes a slog.
export function bossGateTime(node) {
  return Math.max(180, Math.min(600, Math.round((node.duration || 300) * 0.72)));
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
export function rollCampaignChest(node, isFinal) {
  const diff = node?.diff || 1;
  const out = [];
  out.push({ type: 'gold', amount: 220 * diff + Math.round(Math.random() * 180) });
  out.push({ type: 'gearParts', amount: 8 + diff * 6 + Math.floor(Math.random() * 8) });
  if (Math.random() < 0.42 + diff * 0.08) out.push({ type: 'gear' });
  if (Math.random() < 0.18 + diff * 0.06) out.push({ type: 'rune' });
  if (Math.random() < 0.22) out.push({ type: 'gems', amount: 1 + Math.floor(Math.random() * 3) });
  if (Math.random() < 0.30) out.push({ type: 'petFood', amount: 1 + Math.floor(Math.random() * 3) });
  // The last chest of a cleared node is the one worth chasing.
  if (isFinal) {
    out.push({ type: 'sp', amount: 1 + diff });
    if (Math.random() < 0.5) out.push({ type: 'gearParts', amount: 20 + diff * 10 });
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

// The next node the player has not cleared — what "Continue story" resumes.
export function nextCampaignNode(save) {
  const progress = save.mapProgress || {};
  return campaignNodes().find(n => !progress[n.id]) || null;
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
    bossId: MAP_BOSS[node.mapId] || 'bossOcular',
    spawnMult: node.spawnMult || 1,
    enemyMix: node.enemyMix,
    node,
  };
}
