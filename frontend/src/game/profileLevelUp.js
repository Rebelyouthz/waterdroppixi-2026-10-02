// Profile / account level-up — one payout + one unlock list.
// Camp's overlay used to pay from a stale save snapshot and only listed
// cosmetics at the FINAL rank, so a jump that crossed two ranks silently
// skipped the middle prize (Bronze Ring at 5 if you landed on 6).
import { applyReward, DEFAULT_SAVE } from '../store';
import {
  getRank, RANK_TITLES, MAX_RANK,
  PROFILE_FRAMES, HEADBANDS, NAME_COLORS, SHIP_COLORS, CIGAR_UNLOCK_RANK,
} from './data_ext';

export function pendingRewardBag(pending) {
  if (!pending) return {};
  return {
    gold: pending.gold || 0,
    sp: pending.sp || 0,
    gems: pending.gems || 0,
    slotCoins: pending.slotCoins || 0,
    talentPoints: pending.talentPoints || 0,
    pieces: pending.pieces || 0,
    shards: pending.shards || 0,
    freeSpin: pending.freeSpin ? 1 : 0,
  };
}

/** Mutates a fresh save copy. Clears pendingLevelUp. */
export function applyPendingLevelUp(save) {
  const r = save.pendingLevelUp;
  if (!r) return save;
  applyReward(save, pendingRewardBag(r));
  save.pendingLevelUp = null;
  return save;
}

export function collectPendingLevelUp(save) {
  const ns = {
    ...save,
    character: { ...(save.character || DEFAULT_SAVE.character) },
    profile: { ...(save.profile || DEFAULT_SAVE.profile) },
  };
  return applyPendingLevelUp(ns);
}

export function rankUnlocksBetween(fromLevel, toLevel) {
  const from = getRank(fromLevel);
  const to = getRank(toLevel);
  if (to <= from) return [];
  const out = [];
  const take = (list, label) => {
    for (const x of list) {
      if (x.id === 'none' || !x.rank) continue;
      if (x.rank > from && x.rank <= to) out.push({ label, name: x.name, rank: x.rank });
    }
  };
  take(PROFILE_FRAMES, 'Profile frame');
  take(HEADBANDS, 'Headband');
  take(NAME_COLORS, 'Name colour');
  take(SHIP_COLORS, 'Ship colour');
  for (let rk = from + 1; rk <= to; rk++) {
    if (rk === CIGAR_UNLOCK_RANK) out.push({ label: 'Cosmetic', name: 'The cigar', rank: rk });
  }
  return out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}

export function nextRankPrize(level) {
  const rank = getRank(level);
  if (rank >= MAX_RANK) return null;
  const next = rank + 1;
  const atLevel = next * 4;
  return {
    rank: next,
    title: RANK_TITLES[next],
    levelsLeft: Math.max(0, atLevel - (level || 1)),
    unlocks: rankUnlocksBetween(atLevel - 1, atLevel),
  };
}

export function rewardTiles(pending) {
  if (!pending) return [];
  const out = [
    { key: 'gold', icon: 'cur_gold', label: 'Gold', amount: pending.gold, color: '#ffd166' },
    { key: 'sp', icon: 'cur_sp', label: 'SP', amount: pending.sp, color: '#8fe6ff' },
    { key: 'tp', icon: 'cur_tp', label: 'TP', amount: pending.talentPoints, color: '#7ad96b' },
    { key: 'gems', icon: 'cur_gems', label: 'Gems', amount: pending.gems, color: '#4dffd4' },
    { key: 'coins', icon: 'cur_slot', label: 'Slot Coins', amount: pending.slotCoins, color: '#ffcc00' },
    { key: 'pieces', icon: 'cur_pieces', label: 'Char. Pieces', amount: pending.pieces, color: '#b362ff' },
    { key: 'shards', icon: 'cur_shards', label: 'Evo. Shards', amount: pending.shards, color: '#ff7a1a' },
  ].filter((x) => (x.amount || 0) > 0);
  if (pending.freeSpin) {
    out.push({ key: 'spin', icon: 'cur_slot', label: 'Free Shop Spin', amount: 1, color: '#4dffd4' });
  }
  return out;
}
