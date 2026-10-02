// =============================================
// BASE DEFENCE — hold the base against waves
// =============================================
// Slime-Castle-shaped: enemies walk lanes toward the core, you place and
// upgrade towers to stop them. What makes it worth having here rather than
// being a separate game is that it is played with the base you already
// built — your building levels ARE your starting resources, and what you
// win is a buff on your next run.
//
// Pure logic. Rendering lives in BaseDefenceScreen.

export const LANES = 4;

// Towers. Four roles, each answering a different lane problem, so a layout
// is a set of decisions rather than "place the best one everywhere".
export const TOWERS = {
  spitter: {
    id: 'spitter', name: 'Spitter', icon: 'orb', accent: '#5fd6ff', cost: 30,
    desc: 'Single target, quick. The default answer.',
    dmg: 9, rate: 1.6, range: 190, splash: 0, slow: 0,
  },
  mortar: {
    id: 'mortar', name: 'Mortar', icon: 'meteor', accent: '#ff9a4d', cost: 65,
    desc: 'Slow, heavy, hits a cluster. Wasted on stragglers.',
    dmg: 26, rate: 0.5, range: 260, splash: 62, slow: 0,
  },
  frost: {
    id: 'frost', name: 'Frost Coil', icon: 'frost', accent: '#8fe6ff', cost: 50,
    desc: 'Barely hurts. Buys every other tower more time.',
    dmg: 4, rate: 1.1, range: 165, splash: 0, slow: 0.45,
  },
  tesla: {
    id: 'tesla', name: 'Tesla Post', icon: 'bolt', accent: '#fff44d', cost: 85,
    desc: 'Chains down a packed lane. Poor against one big thing.',
    dmg: 12, rate: 0.9, range: 175, splash: 0, slow: 0, chain: 3,
  },
};

export function towerUpgradeCost(def, lvl) {
  return Math.round(def.cost * 0.8 * Math.pow(1.55, lvl));
}

export function towerStats(def, lvl) {
  const k = 1 + lvl * 0.35;
  return {
    dmg: def.dmg * k,
    rate: def.rate * (1 + lvl * 0.10),
    range: def.range * (1 + lvl * 0.06),
    splash: def.splash * (1 + lvl * 0.08),
    slow: def.slow ? Math.min(0.72, def.slow + lvl * 0.05) : 0,
    chain: def.chain ? def.chain + Math.floor(lvl / 2) : 0,
  };
}

// Wave composition. Grunts fill lanes, runners punish a slow layout, brutes
// punish a layout with no burst, and a swarm punishes single-target-only.
export function buildWave(n) {
  const out = [];
  const push = (kind, count, hp, speed, reward) => {
    for (let i = 0; i < count; i++) out.push({ kind, hp, maxHp: hp, speed, reward });
  };
  const t = 1 + n * 0.22;
  push('grunt', 5 + n, 26 * t, 34, 3);
  if (n >= 2) push('runner', 2 + Math.floor(n / 2), 16 * t, 68, 4);
  if (n >= 4) push('brute', 1 + Math.floor(n / 4), 130 * t, 22, 12);
  if (n % 5 === 0) push('swarm', 14 + n * 2, 9 * t, 46, 1);
  return out;
}

export function waveReward(n) {
  return { scrap: 24 + n * 8, gold: 120 + n * 45 };
}

/** Gold for every wave actually held, not only the last one.
 *  finish() used to pay waveReward(held) once, so holding 5 paid the same
 *  as if waves 1–4 had been charity. */
export function goldForWavesHeld(held) {
  const n = Math.max(0, held | 0);
  let g = 0;
  for (let i = 1; i <= n; i++) g += waveReward(i).gold;
  return g;
}

export function spentOnTower(def, lvl) {
  let n = def.cost;
  for (let i = 0; i < lvl; i++) n += towerUpgradeCost(def, i);
  return n;
}

export function sellRefund(def, lvl) {
  return Math.floor(spentOnTower(def, lvl) * 0.5);
}

export function wavePreview(n) {
  const c = { grunt: 0, runner: 0, brute: 0, swarm: 0 };
  for (const f of buildWave(n)) c[f.kind] = (c[f.kind] || 0) + 1;
  return c;
}

/** Bram on the wall — Kingdom Rush hero, not a buyable tower. */
export function bramHeroStats() {
  return { dmg: 16, rate: 1.4, range: 220, splash: 0, slow: 0, chain: 0 };
}

/** Player spells. KR's actual depth is Rain of Fire + Call Reinforcements
 *  on cooldown, not per-tower First/Last/Strong menus. Coolant dump is the
 *  Waterdrop analogue; vent block stalls a leaking lane. */
export const SPELLS = {
  dump: { id: 'dump', name: 'DUMP COOLANT', cd: 16, dmg: 22, slow: 2.4 },
  vent: { id: 'vent', name: 'VENT BLOCK', cd: 10, hp: 48, life: 14 },
};

/** Furthest along the lane (smallest x). Closest-to-tower was leaking
 *  brutes past frost while spitters emptied the nearest swarm. */
export function pickFirst(foes, tx, ty, range, laneYFn) {
  let best = null;
  let bx = Infinity;
  const r2 = range * range;
  for (const f of foes) {
    const fy = laneYFn(f.lane);
    const dx = f.x - tx;
    const dy = fy - ty;
    if (dx * dx + dy * dy <= r2 && f.x < bx) {
      bx = f.x;
      best = f;
    }
  }
  return best;
}

export function applyCoolantDump(foes, dmg = SPELLS.dump.dmg, slow = SPELLS.dump.slow) {
  let n = 0;
  for (const f of foes) {
    f.hp -= dmg;
    f.slow = Math.max(f.slow || 0, slow);
    n++;
  }
  return n;
}

// What holding out earns you: a buff applied to your NEXT run. This is the
// whole reason the mode connects to the game rather than sitting beside it.
export function defenceBuff(wavesHeld) {
  if (wavesHeld <= 0) return null;
  const tier = Math.min(4, Math.floor(wavesHeld / 3));
  if (tier <= 0) return null;
  return {
    waves: wavesHeld,
    dmg: 0.05 * tier,
    armor: 2 * tier,
    gold: 0.10 * tier,
    label: `+${Math.round(5 * tier)}% damage · +${2 * tier} armour · +${Math.round(10 * tier)}% gold`,
  };
}
