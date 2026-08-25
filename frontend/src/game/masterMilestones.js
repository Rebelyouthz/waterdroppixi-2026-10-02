/**
 * masterMilestones.js
 * 
 * Core logic module for the Master Milestone Reward System.
 * This system scans the entire game state (save) and awards "Mastery Points" (MP)
 * for various activities (runs, clicker, base defence, etc.). 
 * Players unlock sequential reward tiers (chests) as they accumulate MP.
 * 
 * Design Pattern: "One place, one pass"
 * We calculate the theoretical total MP from the current state and diff it against
 * a snapshot (`save.mastery.snap`) to find the delta. This avoids double-counting 
 * and makes the system resilient to state manipulations or updates.
 */

/**
 * Compact number formatter for Mastery Points (and related UI values).
 * Converts large numbers into K, M, B formats.
 * 
 * @param {number} n - The number to format
 * @returns {string} Formatted string (e.g., "1.5K")
 */
export function fmtMP(n) {
  if (n === undefined || n === null) return '0';
  if (n < 1000) return n.toString();
  if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1000000000) return (n / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
  return (n / 1000000000).toFixed(2).replace(/\.00$/, '') + 'B';
}

/**
 * Visual metadata for chest types.
 * Used for CSS classes, glowing effects, and icons in the UI.
 */
export const CHEST_VISUALS = {
  bronze:   { label: 'Bronze Crate',      glow: '#cd7f32', icon: 'ui_chest' },
  silver:   { label: 'Silver Chest',      glow: '#c0c0c0', icon: 'ui_chest' },
  gold:     { label: 'Gold Chest',        glow: '#ffd700', icon: 'ui_chest' },
  epic:     { label: 'Epic Vault',        glow: '#b362ff', icon: 'ui_chest' },
  legend:   { label: 'Legendary Cache',   glow: '#ff7a1a', icon: 'ui_chest' },
  annunaki: { label: 'Annunaki Vault',    glow: '#4dffd4', icon: 'ui_chest' },
  cosmic:   { label: 'Cosmic Reliquary',  glow: '#ff55aa', icon: 'ui_chest' },
  void:     { label: 'Void Archive',      glow: '#7744ff', icon: 'ui_chest' },
  monolith: { label: 'THE MONOLITH',      glow: '#ffffff', icon: 'ui_chest' },
};

/**
 * The 20 tiers of Master Milestones.
 * Rewards scale up significantly as players reach higher tiers.
 */
export const MASTERY_TIERS = [
  { threshold: 500,     chestType: 'bronze',   name: 'Tier 1',  rewards: { gold: 300, gems: 1 } },
  { threshold: 1500,    chestType: 'bronze',   name: 'Tier 2',  rewards: { gold: 500, gearParts: 5 } },
  { threshold: 3500,    chestType: 'silver',   name: 'Tier 3',  rewards: { sp: 2, gems: 3, slotCoins: 1 } },
  { threshold: 7000,    chestType: 'silver',   name: 'Tier 4',  rewards: { gold: 800, gachaTokens: 1, gearParts: 10 } },
  { threshold: 12000,   chestType: 'gold',     name: 'Tier 5',  rewards: { sp: 3, gems: 5, slotCoins: 2 } },
  { threshold: 20000,   chestType: 'gold',     name: 'Tier 6',  rewards: { gold: 1500, gachaTokens: 2, tcgCard: 1 } },
  { threshold: 32000,   chestType: 'epic',     name: 'Tier 7',  rewards: { sp: 5, gems: 10, rune: 1 } },
  { threshold: 50000,   chestType: 'epic',     name: 'Tier 8',  rewards: { gold: 3000, gachaTokens: 3, tcgCard: 2 } },
  { threshold: 75000,   chestType: 'epic',     name: 'Tier 9',  rewards: { sp: 8, gems: 15, flux: 1, slotCoins: 5 } },
  { threshold: 110000,  chestType: 'legend',   name: 'Tier 10', rewards: { gold: 5000, gachaTokens: 5, rune: 2 } },
  { threshold: 160000,  chestType: 'legend',   name: 'Tier 11', rewards: { sp: 12, gems: 25, flux: 3 } },
  { threshold: 220000,  chestType: 'legend',   name: 'Tier 12', rewards: { gold: 8000, tcgCard: 5, rune: 3 } },
  { threshold: 300000,  chestType: 'annunaki', name: 'Tier 13', rewards: { sp: 20, gems: 40, gachaTokens: 10 } },
  { threshold: 400000,  chestType: 'annunaki', name: 'Tier 14', rewards: { gold: 15000, flux: 5, rune: 5 } },
  { threshold: 550000,  chestType: 'annunaki', name: 'Tier 15', rewards: { sp: 30, gems: 60, slotCoins: 15 } },
  { threshold: 750000,  chestType: 'cosmic',   name: 'Tier 16', rewards: { gold: 25000, flux: 10, rune: 8 } },
  { threshold: 1000000, chestType: 'cosmic',   name: 'Tier 17', rewards: { sp: 50, gems: 100, gachaTokens: 20 } },
  { threshold: 1500000, chestType: 'cosmic',   name: 'Tier 18', rewards: { gold: 50000, flux: 15, rune: 10 } },
  { threshold: 2500000, chestType: 'void',     name: 'Tier 19', rewards: { sp: 80, gems: 150, slotCoins: 30 } },
  { threshold: 5000000, chestType: 'monolith', name: 'Tier 20', rewards: { sp: 100, gems: 200, gachaTokens: 50, flux: 20, rune: 15 } },
];

/**
 * Computes the delta of Mastery Points (MP) earned since the last snapshot.
 * We calculate the total points the player *should* have from each category
 * based on current state, and subtract the points they had in the snapshot.
 * 
 * @param {Object} save - The current game save state
 * @returns {Object} { delta: number, newSnap: Object }
 */
export function computeMasteryDelta(save) {
  const snap = save.mastery?.snap || {};
  let totalDelta = 0;
  const newSnap = {};

  // Helper to calculate delta for a specific category
  const calcDelta = (category, currentTotal) => {
    const previousTotal = snap[category] || 0;
    const earned = Math.max(0, currentTotal - previousTotal);
    newSnap[category] = currentTotal;
    totalDelta += earned;
  };

  // 1. Main Game: Kills (1 MP per 50 kills)
  calcDelta('kills', Math.floor((save.totalKills || 0) / 50));

  // 2. Main Game: Runs (50 + bestLevel * 10 per run)
  const bestLevel = save.bestLevel || 1;
  calcDelta('runs', (save.runsCompleted || 0) * (50 + bestLevel * 10));

  // 3. Main Game: Bosses (75 MP each)
  const bossesSlain = (save.aidaSlain || 0) + (save.necroSlain || 0) + 
                      (save.voidSlain || 0) + (save.horusSlain || 0);
  calcDelta('bosses', bossesSlain * 75);

  // 4. Clicker: Milestones (50 MP each)
  const clickerClaimed = Object.keys(save.clicker?.claimed || {}).length;
  calcDelta('clickerMilestones', clickerClaimed * 50);

  // 5. Clicker: Prestiges (150 MP each)
  calcDelta('clickerPrestiges', (save.clicker?.prestiges || 0) * 150);

  // 6. Star Raid (150 MP per unlocked stage)
  calcDelta('starRaid', (save.starRaid?.stageUnlocked || 0) * 150);

  // 7. Base Defence (15 MP per wave)
  calcDelta('baseDefence', (save.defenceBest || 0) * 15);

  // 8. Account: Level (50 MP per level)
  calcDelta('accountLevel', (save.profile?.level || 0) * 50);

  // 9. Account: Achievements (100 MP each)
  const achClaimedCount = Object.keys(save.achClaimed || {}).length;
  calcDelta('achievements', achClaimedCount * 100);

  // 10. Account: Daily Quests (20 MP each)
  const dailyQuestsCount = Object.keys(save.quests?.claimed || {}).length;
  calcDelta('dailyQuests', dailyQuestsCount * 20);

  // 11. Account: Weekly Quests (75 MP each)
  const weeklyQuestsCount = Object.keys(save.weeklyQuests?.claimed || {}).length;
  calcDelta('weeklyQuests', weeklyQuestsCount * 75);

  return { delta: totalDelta, newSnap };
}

/**
 * Pure function to settle new mastery points into the save state.
 * Returns a new save object if changes occurred, otherwise returns the same reference.
 * Designed to be called continuously in a progression settlement loop.
 * 
 * @param {Object} save - The current game state
 * @returns {Object} A new save state or the unmodified save
 */
export function settleMastery(save) {
  if (!save) return save;
  
  const { delta, newSnap } = computeMasteryDelta(save);
  
  // If no new points were earned, return the exact same reference to prevent unneeded renders
  if (delta <= 0) return save;
  
  const mastery = { 
    ...(save.mastery || { points: 0, claimed: {}, snap: {} }) 
  };
  
  mastery.points = (mastery.points || 0) + delta;
  mastery.snap = newSnap;
  
  return { ...save, mastery };
}

/**
 * Returns an array of tier objects that have been unlocked but not yet claimed.
 * 
 * @param {Object} save - The current game state
 * @returns {Array} Unclaimed tier objects with their index attached
 */
export function pendingMasteryChests(save) {
  if (!save?.mastery) return [];
  const { points = 0, claimed = {} } = save.mastery;
  
  const pending = [];
  for (let i = 0; i < MASTERY_TIERS.length; i++) {
    const tier = MASTERY_TIERS[i];
    if (points >= tier.threshold && !claimed[i]) {
      pending.push({ ...tier, index: i });
    }
  }
  return pending;
}

/**
 * Claims a mastery chest, applying its rewards and marking it as claimed.
 * Returns a completely new save object (pure).
 * 
 * @param {Object} save - The current game state
 * @param {number} tierIndex - The index of the tier to claim in MASTERY_TIERS
 * @returns {Object} The updated save state
 */
export function claimMasteryChest(save, tierIndex) {
  if (!save?.mastery) return save;
  const tier = MASTERY_TIERS[tierIndex];
  if (!tier) return save;
  
  // Guard against re-claiming or claiming unreached tiers
  if (save.mastery.claimed[tierIndex] || save.mastery.points < tier.threshold) {
    return save;
  }

  // Deep clone structural parts we are about to mutate
  const newSave = { 
    ...save,
    mastery: {
      ...save.mastery,
      claimed: { ...save.mastery.claimed, [tierIndex]: true }
    }
  };

  const rewards = tier.rewards;
  
  // Apply standard currencies
  if (rewards.gold) { newSave.gold = (newSave.gold || 0) + rewards.gold; newSave.lifetimeGold = (newSave.lifetimeGold || 0) + rewards.gold; }
  if (rewards.gems) newSave.gems = (newSave.gems || 0) + rewards.gems;
  if (rewards.sp) newSave.sp = (newSave.sp || 0) + rewards.sp;
  if (rewards.gachaTokens) newSave.gachaTokens = (newSave.gachaTokens || 0) + rewards.gachaTokens;
  if (rewards.slotCoins) newSave.slotCoins = (newSave.slotCoins || 0) + rewards.slotCoins;
  if (rewards.flux) newSave.flux = (newSave.flux || 0) + rewards.flux;
  if (rewards.gearParts) newSave.gearParts = (newSave.gearParts || 0) + rewards.gearParts;

  // Rune and TCG card rolling is handled by the UI component (MasteryTrack.jsx)
  // which calls rollRune() and rollCard() with the player's luck stat. The
  // reward keys `rune` and `tcgCard` are read directly by the component.

  return newSave;
}
