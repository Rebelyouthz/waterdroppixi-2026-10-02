import * as milestones from '../src/game/starRaidMilestones.js';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { console.log(`  ok  ${msg}`); passed++; }
  else { console.log(`FAIL  ${msg}`); failed++; }
}

const emptySave = () => ({
  starRaid: {
    lifetimeScrap: 0,
    bossesSlain: 0,
    levels: {}
  }
});

console.log('\n=== Star Raid SR Delta Calculation ===');
{
  const save = emptySave();
  save.starRaid.lifetimeScrap = 500; // 50 SRP
  save.starRaid.bossesSlain = 2; // 400 SRP
  save.starRaid.levels = { dmg: 5, atks: 5 }; // 10 * 15 = 150 SRP

  const { delta, newSnap } = milestones.computeStarRaidDelta(save);
  ok(delta === 600, `Calculated delta is ${delta}, expected 600`);
  ok(newSnap.scrap === 50, 'Scrap snapshot is correct');
  ok(newSnap.bosses === 400, 'Bosses snapshot is correct');
  ok(newSnap.upgrades === 150, 'Upgrades snapshot is correct');

  // Test no-op delta
  save.starRaid.milestoneSnap = newSnap;
  const { delta: delta2 } = milestones.computeStarRaidDelta(save);
  ok(delta2 === 0, 'Delta is 0 when no progress is made');
}

console.log('\n=== Settlement Pure Function ===');
{
  const save = emptySave();
  save.starRaid.lifetimeScrap = 1000; // 100 SRP
  
  const nextSave = milestones.settleStarRaidMilestones(save);
  ok(nextSave !== save, 'Returned new object reference');
  ok(nextSave.starRaid.milestonePoints === 100, 'Points applied correctly');
  ok(nextSave.starRaid.milestoneSnap.scrap === 100, 'Snapshot updated');
  
  const nextSave2 = milestones.settleStarRaidMilestones(nextSave);
  ok(nextSave2 === nextSave, 'Returned unmodified reference when delta is 0');
}

console.log('\n=== Claiming Chests ===');
{
  let save = emptySave();
  save.starRaid.milestonePoints = 1500; // Unlocks tiers 0, 1, 2
  
  const pending = milestones.pendingStarRaidChests(save);
  ok(pending.length === 3, `Found ${pending.length} pending chests, expected 3`);
  
  // Claim Tier 1 (threshold 100, index 0)
  save = milestones.claimStarRaidChest(save, 0);
  ok(save.starRaid.milestoneClaimed[0], 'Tier 0 marked as claimed');
  ok(save.starRaid.scrap === 50, 'Granted 50 scrap');
  ok(save.gems === 2, 'Granted 2 gems');
  
  // Attempt to claim again
  const save2 = milestones.claimStarRaidChest(save, 0);
  ok(save2 === save, 'Re-claiming returns same save reference');
  
  // Attempt to claim locked tier
  const save3 = milestones.claimStarRaidChest(save, 14); // Tier 15
  ok(save3 === save, 'Claiming locked tier returns same save reference');
}

console.log(`\n${passed + failed} checks passed.`);
if (failed > 0) process.exit(1);
