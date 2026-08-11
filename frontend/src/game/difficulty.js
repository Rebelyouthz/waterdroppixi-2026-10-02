// =============================================
// DIFFICULTY TIERS — Normal → Hard → Nightmare
// =============================================
// One global multiplier set, applied at exactly three places (enemy spawn
// stats in engine.js, spawn rate in spawnWave, and payout in the reward
// sites). Everything else in the game stays difficulty-agnostic, which is
// what keeps this from turning into a second balance surface nobody can
// reason about.
//
// The gating rule is the whole point of the feature: a tier does not open
// because you asked for it, it opens because you finished the previous one
// COMPLETELY — every node of every map. And it is deliberately tuned so the
// build that just barely finished Normal gets flattened by Hard: the ×2.2 HP
// / ×1.55 damage step is roughly two full map's worth of gear, talents and
// meta ahead of where clearing Normal leaves you. You come back for it, you
// do not walk into it.
//
// Rewards scale with the tier too, and by MORE than the effort — Hard pays
// 1.6× for 1.55× incoming damage. If the harder tier paid proportionally,
// nobody would ever leave Normal, because Normal is where a fixed amount of
// player skill converts to the most currency per minute.

export const DIFFICULTIES = [
  {
    id: 'normal',
    name: 'Normal',
    short: 'NRM',
    icon: '🌊',
    color: '#4dc4ff',
    desc: 'The Lake as it was. Hard enough to teach you, fair enough to let you learn.',
    // Combat
    hpMult: 1.00,
    dmgMult: 1.00,
    speedMult: 1.00,
    spawnMult: 1.00,
    bossHpMult: 1.00,
    // Economy
    xpMult: 1.00,
    goldMult: 1.00,
    lootMult: 1.00,
    // Gate
    requires: null,
    requiresLabel: null,
  },
  {
    id: 'hard',
    name: 'Hard',
    short: 'HRD',
    icon: '🔥',
    color: '#ff7a1a',
    desc: 'Everything hits harder and takes longer to fall. Bring the build Normal built you.',
    hpMult: 2.20,
    dmgMult: 1.55,
    speedMult: 1.10,
    spawnMult: 1.25,
    bossHpMult: 2.60,
    xpMult: 1.45,
    goldMult: 1.60,
    lootMult: 1.55,
    requires: 'normal',
    requiresLabel: 'Clear every story node on Normal',
  },
  {
    id: 'nightmare',
    name: 'Nightmare',
    short: 'NGT',
    icon: '💀',
    color: '#ff3146',
    desc: 'The Lake with nothing held back. Every mistake is the last one.',
    hpMult: 5.00,
    dmgMult: 2.40,
    speedMult: 1.20,
    spawnMult: 1.55,
    bossHpMult: 6.20,
    xpMult: 2.10,
    goldMult: 2.60,
    lootMult: 2.40,
    requires: 'hard',
    requiresLabel: 'Clear every story node on Hard',
  },
];

export const DIFF_INDEX = DIFFICULTIES.reduce((m, d) => { m[d.id] = d; return m; }, {});
export const DIFF_IDS = DIFFICULTIES.map(d => d.id);
export const DEFAULT_DIFFICULTY = 'normal';

export function difficultyDef(id) {
  return DIFF_INDEX[id] || DIFF_INDEX[DEFAULT_DIFFICULTY];
}

// ---- Per-difficulty story progress ----------------------------------------
// `save.mapProgress` (flat { nodeId: true }) predates this system and is still
// the source of truth for Normal, so no existing save loses its campaign. The
// higher tiers live in `save.mapProgressByDiff`, which only ever holds hard
// and nightmare. Reading through these two helpers instead of touching either
// field directly is what keeps that split from leaking everywhere.

export function progressFor(save, diffId = null) {
  const d = diffId || activeDifficulty(save);
  if (d === 'normal') return save.mapProgress || {};
  return (save.mapProgressByDiff || {})[d] || {};
}

// Returns a NEW save with `nodeId` marked cleared on `diffId`. Never mutates.
export function markNodeCleared(save, nodeId, diffId = null) {
  const d = diffId || activeDifficulty(save);
  if (d === 'normal') {
    return { ...save, mapProgress: { ...(save.mapProgress || {}), [nodeId]: true } };
  }
  const byDiff = { ...(save.mapProgressByDiff || {}) };
  byDiff[d] = { ...(byDiff[d] || {}), [nodeId]: true };
  return { ...save, mapProgressByDiff: byDiff };
}

// ---- Unlocking -------------------------------------------------------------
// `allNodeIds` is injected rather than imported so this module stays free of
// the data layer — data_ext2 imports nothing from here, and keeping it that
// way avoids a cycle the bundler would have to break.

export function tierComplete(save, diffId, allNodeIds) {
  if (!allNodeIds || !allNodeIds.length) return false;
  const prog = progressFor(save, diffId);
  return allNodeIds.every(id => !!prog[id]);
}

export function difficultyUnlocked(save, diffId, allNodeIds) {
  const def = difficultyDef(diffId);
  if (!def.requires) return true;
  return tierComplete(save, def.requires, allNodeIds);
}

// The tier the player is currently SET to. This is the raw stored value and
// does no validation — use resolveDifficulty (or campaign.js's
// resolvedDifficultyMods, which wires the node list in for you) anywhere the
// answer decides combat or payout.
export function activeDifficulty(save) {
  return save?.difficulty || DEFAULT_DIFFICULTY;
}

// The tier the player is set to, clamped to what they have actually earned. A
// save edited by hand — or one that unlocked a tier and later had its progress
// reset — can never end up running Nightmare rewards on Normal effort.
//
// `allNodeIds` is injected rather than imported to keep this module free of
// the data layer; campaign.js closes over it for callers.
export function resolveDifficulty(save, allNodeIds) {
  const want = activeDifficulty(save);
  if (difficultyUnlocked(save, want, allNodeIds)) return want;
  // Walk back to the highest tier that IS unlocked.
  for (let i = DIFF_IDS.indexOf(want) - 1; i >= 0; i--) {
    if (difficultyUnlocked(save, DIFF_IDS[i], allNodeIds)) return DIFF_IDS[i];
  }
  return DEFAULT_DIFFICULTY;
}

// ---- The numbers the rest of the game asks for -----------------------------
// One call site each. `mods` goes into the engine, `rewardMult` multiplies a
// payout, `lootMult` biases a drop roll.

export function difficultyMods(save) {
  const d = difficultyDef(activeDifficulty(save));
  return {
    id: d.id,
    name: d.name,
    color: d.color,
    icon: d.icon,
    hpMult: d.hpMult,
    dmgMult: d.dmgMult,
    speedMult: d.speedMult,
    spawnMult: d.spawnMult,
    bossHpMult: d.bossHpMult,
    xpMult: d.xpMult,
  };
}

export function rewardMult(save) {
  return difficultyDef(activeDifficulty(save)).goldMult;
}

export function lootMult(save) {
  return difficultyDef(activeDifficulty(save)).lootMult;
}

// Scales a whole reward object at once — every payout site already builds one
// of these `{ gold, sp, gems, ... }` bags, so this is the single place that
// decides "a Nightmare chest is worth more than a Normal chest."
export function scaleReward(save, reward) {
  if (!reward) return reward;
  const m = rewardMult(save);
  if (m === 1) return reward;
  const out = {};
  for (const [k, v] of Object.entries(reward)) {
    out[k] = (typeof v === 'number') ? Math.max(1, Math.round(v * m)) : v;
  }
  return out;
}
