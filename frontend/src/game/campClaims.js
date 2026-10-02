// =============================================
// CAMP CLAIMABLES — one query site for the board, the badges, and Welcome
// =============================================
// Camp.jsx, store.campHasClaimable, and BattlePassPanel each used to answer
// "is the season pass ready?" with a different shape. The pass stores
// `{ free: [], premium: [] }` but the badges read `.claimed.length` as if it
// were a flat array, and the node index was `floor(profile.xp / 200)` even
// though addAccountXp WRAPS leftover XP every rank. Result: the waterdrop on
// PASS never lit, and nodes 1–39 could not unlock.
//
// Rank is the honest clock. accountXpToNext is a curve (~70 at rank 1, not
// 200). One profile level = one pass node. 40 nodes = rank 40.

import { ACHIEVEMENTS, achMetric, achievementFamily } from './data_ext2';

export const BP_NODE_COUNT = 40;

export function normalizeBpClaimed(save) {
  const raw = save?.battlePass?.claimed;
  if (raw && !Array.isArray(raw)) {
    return { free: raw.free || [], premium: raw.premium || [] };
  }
  return { free: Array.isArray(raw) ? raw : [], premium: [] };
}

export function battlePassReachedNode(save) {
  const lvl = Math.max(1, save?.profile?.level || 1);
  return Math.min(BP_NODE_COUNT - 1, lvl - 1);
}

export function battlePassUnclaimedCount(save) {
  const reached = battlePassReachedNode(save);
  const c = normalizeBpClaimed(save);
  let n = 0;
  for (let i = 0; i <= reached; i++) {
    if (!c.free.includes(i)) n++;
    if (!c.premium.includes(i)) n++;
  }
  return n;
}

export function patrolReadyCount(save, now = Date.now()) {
  return (save?.patrol?.missions || []).filter((m) => (
    m.status === 'complete'
    || (m.status === 'active' && now - m.startMs >= m.durationMs)
  )).length;
}

export function codexUnclaimedCount(save) {
  const claimed = new Set(save?.codex?.claimedDiscoveries || []);
  const ids = [
    ...Object.keys(save?.codex?.enemies || {}),
    ...Object.keys(save?.codex?.weapons || {}),
  ];
  return ids.filter((id) => !claimed.has(id)).length;
}

export function achievementsReady(save) {
  const claimed = save?.achClaimed || {};
  return ACHIEVEMENTS.filter((a) => !claimed[a.id] && achMetric(save, a.metric) >= a.goal);
}

export function openAchievementTier(save, a) {
  const claimed = save?.achClaimed || {};
  const fam = achievementFamily(a);
  return fam.find((x) => !claimed[x.id]) || null;
}

export function nearestOpenAchievement(save) {
  const ready = achievementsReady(save);
  if (ready[0]) {
    return { a: ready[0], ready: true, pct: 1, v: achMetric(save, ready[0].metric) };
  }
  const claimed = save?.achClaimed || {};
  const seen = new Set();
  let best = null;
  for (const a of ACHIEVEMENTS) {
    if (claimed[a.id]) continue;
    const open = openAchievementTier(save, a);
    if (!open || seen.has(open.id)) continue;
    seen.add(open.id);
    const v = achMetric(save, open.metric);
    if (v >= open.goal) continue;
    const pct = Math.min(1, v / open.goal);
    if (!best || pct > best.pct) best = { a: open, ready: false, pct, v };
  }
  return best;
}

// The camp-IA "nearest achievement / claimable" row. Priority is CLAIM first,
// then the closest in-progress family — never a wall of systems.
export function whatsOnSide(save) {
  const ready = achievementsReady(save);
  if (ready.length) {
    return {
      kind: 'achievements', go: 'achievements', icon: ready[0].icon,
      title: ready.length > 1 ? `${ready.length} ready to claim` : ready[0].name,
      goal: ready.length > 1 ? 'CLAIM ALL IN ACHIEVEMENTS' : 'CLAIM',
      why: ready[0].desc, ready: true,
    };
  }
  const patrol = patrolReadyCount(save);
  if (patrol) {
    return {
      kind: 'patrol', go: 'patrol', icon: 'ui_map',
      title: patrol === 1 ? 'A patrol is back' : `${patrol} patrols are back`,
      goal: 'COMPLETE — CLAIM NOW', ready: true,
    };
  }
  const bp = battlePassUnclaimedCount(save);
  if (bp) {
    return {
      kind: 'pass', go: 'pass', icon: 'ui_medal',
      title: 'Season Pass',
      goal: `${bp} rewards ready`, ready: true,
    };
  }
  const cx = codexUnclaimedCount(save);
  if (cx) {
    return {
      kind: 'codex', go: 'codex', icon: 'ui_codex',
      title: 'Codex',
      goal: `${cx} discoveries to claim`, ready: true,
    };
  }
  const near = nearestOpenAchievement(save);
  if (near) {
    return {
      kind: 'achievements', go: 'achievements', icon: near.a.icon,
      title: near.a.name,
      goal: `${Math.floor(near.v)} / ${near.a.goal}`,
      why: near.a.desc, ready: false, pct: near.pct,
    };
  }
  return null;
}

export function bpRewardBag(rwd) {
  if (!rwd) return {};
  if (rwd.type === 'gold') return { gold: rwd.amount };
  if (rwd.type === 'gem') return { gems: rwd.amount };
  if (rwd.type === 'slot') return { slotCoins: rwd.amount };
  if (rwd.type === 'talent') return { talentPoints: rwd.amount };
  if (rwd.type === 'shard') return { shards: rwd.amount };
  if (rwd.type === 'petFood') return { petFood: rwd.amount };
  return {};
}
