/**
 * Star Raid (Star Atlas) Milestones
 * Progression system specifically for the Star Raid minigame.
 * Driven by Star Raid Points (SRP) which are gained by clearing stages and earning Scrap.
 */

// 15 tiers of rewards
export const STAR_RAID_TIERS = [
  { threshold: 100,    chestType: 'bronze',   name: 'Tier 1',  rewards: { scrap: 50, gems: 2 } },
  { threshold: 400,    chestType: 'bronze',   name: 'Tier 2',  rewards: { scrap: 100, gearParts: 10 } },
  { threshold: 1000,   chestType: 'silver',   name: 'Tier 3',  rewards: { scrap: 250, sp: 2, slotCoins: 1 } },
  { threshold: 2500,   chestType: 'silver',   name: 'Tier 4',  rewards: { scrap: 500, gems: 5, tcgCard: 1 } },
  { threshold: 5000,   chestType: 'gold',     name: 'Tier 5',  rewards: { scrap: 1000, gachaTokens: 2, gearParts: 25 } },
  { threshold: 8000,   chestType: 'gold',     name: 'Tier 6',  rewards: { scrap: 1500, sp: 5, rune: 1 } },
  { threshold: 12000,  chestType: 'epic',     name: 'Tier 7',  rewards: { scrap: 2500, gems: 15, flux: 1 } },
  { threshold: 18000,  chestType: 'epic',     name: 'Tier 8',  rewards: { scrap: 4000, gachaTokens: 5, tcgCard: 2 } },
  { threshold: 26000,  chestType: 'epic',     name: 'Tier 9',  rewards: { scrap: 6000, sp: 10, rune: 2 } },
  { threshold: 38000,  chestType: 'legend',   name: 'Tier 10', rewards: { scrap: 10000, gems: 30, flux: 2 } },
  { threshold: 55000,  chestType: 'legend',   name: 'Tier 11', rewards: { scrap: 15000, gachaTokens: 10, tcgCard: 3 } },
  { threshold: 80000,  chestType: 'legend',   name: 'Tier 12', rewards: { scrap: 25000, sp: 20, rune: 4 } },
  { threshold: 120000, chestType: 'annunaki', name: 'Tier 13', rewards: { scrap: 40000, gems: 60, flux: 5 } },
  { threshold: 180000, chestType: 'cosmic',   name: 'Tier 14', rewards: { scrap: 60000, gachaTokens: 20, tcgCard: 5 } },
  { threshold: 300000, chestType: 'void',     name: 'Tier 15', rewards: { scrap: 100000, gems: 150, flux: 10, rune: 8 } },
];

export function computeStarRaidDelta(save) {
  const sr = save.starRaid || {};
  const snap = sr.milestoneSnap || {};
  let totalDelta = 0;
  const newSnap = {};

  const calcDelta = (category, currentTotal) => {
    const previousTotal = snap[category] || 0;
    const earned = Math.max(0, currentTotal - previousTotal);
    newSnap[category] = currentTotal;
    totalDelta += earned;
  };

  // 1 SRP per 10 lifetime scrap
  calcDelta('scrap', Math.floor((sr.lifetimeScrap || 0) / 10));

  // 200 SRP per boss slain (cumulative stages cleared)
  calcDelta('bosses', (sr.bossesSlain || 0) * 200);

  // 15 SRP per ship upgrade level
  let totalUpgrades = 0;
  Object.values(sr.levels || {}).forEach(lvl => { totalUpgrades += lvl; });
  calcDelta('upgrades', totalUpgrades * 15);

  return { delta: totalDelta, newSnap };
}

export function settleStarRaidMilestones(save) {
  if (!save) return save;
  
  const { delta, newSnap } = computeStarRaidDelta(save);
  if (delta <= 0) return save;
  
  const sr = { ...(save.starRaid || {}) };
  sr.milestonePoints = (sr.milestonePoints || 0) + delta;
  sr.milestoneSnap = newSnap;
  
  return { ...save, starRaid: sr };
}

export function pendingStarRaidChests(save) {
  if (!save?.starRaid) return [];
  const { milestonePoints = 0, milestoneClaimed = {} } = save.starRaid;
  
  const pending = [];
  for (let i = 0; i < STAR_RAID_TIERS.length; i++) {
    const tier = STAR_RAID_TIERS[i];
    if (milestonePoints >= tier.threshold && !milestoneClaimed[i]) {
      pending.push({ ...tier, index: i });
    }
  }
  return pending;
}

export function claimStarRaidChest(save, tierIndex) {
  if (!save?.starRaid) return save;
  const tier = STAR_RAID_TIERS[tierIndex];
  if (!tier) return save;
  
  const sr = save.starRaid;
  if (sr.milestoneClaimed?.[tierIndex] || (sr.milestonePoints || 0) < tier.threshold) {
    return save;
  }

  const newSave = { 
    ...save,
    starRaid: {
      ...sr,
      milestoneClaimed: { ...(sr.milestoneClaimed || {}), [tierIndex]: true }
    }
  };

  const rewards = tier.rewards;
  
  if (rewards.scrap) newSave.starRaid.scrap = (newSave.starRaid.scrap || 0) + rewards.scrap;
  
  if (rewards.gems) newSave.gems = (newSave.gems || 0) + rewards.gems;
  if (rewards.sp) newSave.sp = (newSave.sp || 0) + rewards.sp;
  if (rewards.gachaTokens) newSave.gachaTokens = (newSave.gachaTokens || 0) + rewards.gachaTokens;
  if (rewards.slotCoins) newSave.slotCoins = (newSave.slotCoins || 0) + rewards.slotCoins;
  if (rewards.flux) newSave.flux = (newSave.flux || 0) + rewards.flux;
  if (rewards.gearParts) newSave.gearParts = (newSave.gearParts || 0) + rewards.gearParts;

  // Rune and TCG card rolling is handled by the UI component
  return newSave;
}
