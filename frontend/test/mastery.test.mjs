import fs from 'fs';
import path from 'path';

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), 'src', file), 'utf8');
}

let pass = 0, fails = [];
function check(name, fn) {
  try {
    const why = fn();
    if (why) fails.push(`${name}\n    ${why}`);
    else { pass++; console.log(`  ok  ${name}`); }
  } catch (e) {
    fails.push(`${name}\n    threw: ${e.message}`);
  }
}

const source = read('game/masterMilestones.js');
let computeMasteryDelta;
let settleMastery;
let claimMasteryChest;
let MASTERY_TIERS;

try {
  // Use a Function wrapper to evaluate the ES module code and extract exports
  const code = source
    .replace(/export function/g, 'function')
    .replace(/export const/g, 'const');
    
  const getExports = new Function(`
    ${code}
    return { computeMasteryDelta, settleMastery, claimMasteryChest, MASTERY_TIERS };
  `);
  
  const exports = getExports();
  computeMasteryDelta = exports.computeMasteryDelta;
  settleMastery = exports.settleMastery;
  claimMasteryChest = exports.claimMasteryChest;
  MASTERY_TIERS = exports.MASTERY_TIERS;
} catch (e) {
  console.error("Failed to parse masterMilestones.js:", e.message);
  process.exit(1);
}

console.log('\n=== MP Delta Calculation ===');

check('counts kills correctly (1 per 50)', () => {
  const save = { totalKills: 100, mastery: { snap: {} } };
  const { delta } = computeMasteryDelta(save);
  if (delta !== 2) return `Expected 2 delta, got ${delta}`;
});

check('counts run progress', () => {
  const save = { runsCompleted: 2, bestLevel: 10, mastery: { snap: {} } };
  const { delta } = computeMasteryDelta(save);
  // (50 + 10 * 10) = 150 per run * 2 runs = 300
  if (delta !== 300) return `Expected 300 delta, got ${delta}`;
});

check('only awards positive deltas against snapshots', () => {
  const save = { 
    totalKills: 150, 
    mastery: { snap: { kills: 2 } } // already claimed 2 * 50 = 100 kills
  };
  const { delta, newSnap } = computeMasteryDelta(save);
  // 150 kills = 3 points. Already had 2. Delta should be 1.
  if (delta !== 1) return `Expected delta of 1, got ${delta}`;
  if (newSnap.kills !== 3) return `Expected snap.kills to be 3, got ${newSnap.kills}`;
});

console.log('\n=== Settlement Pure Function ===');

check('does not mutate unmodified save', () => {
  const save = { gold: 100, mastery: { snap: { kills: 0 } } };
  const next = settleMastery(save);
  if (next !== save) return 'Returned new reference when nothing changed';
});

check('applies points and updates snapshot', () => {
  const save = { totalKills: 100, mastery: { points: 5, claimed: {}, snap: { kills: 0 } } };
  const next = settleMastery(save);
  if (next === save) return 'Mutated original save reference instead of cloning';
  if (next.mastery.points !== 7) return `Expected 7 points, got ${next.mastery.points}`;
  if (next.mastery.snap.kills !== 2) return `Snapshot not updated correctly`;
});

console.log('\n=== Claiming Chests ===');

check('claims correctly and updates currencies', () => {
  // Tier 1 is threshold 500, gives gold: 300, gems: 1
  const save = { 
    gold: 50, gems: 2, 
    mastery: { points: 550, claimed: {}, snap: {} } 
  };
  const next = claimMasteryChest(save, 0);
  if (next.gold !== 350) return `Gold wrong, expected 350 got ${next.gold}`;
  if (next.lifetimeGold !== 300) return `lifetimeGold wrong, expected 300 got ${next.lifetimeGold}`;
  if (next.gems !== 3) return `Gems wrong, expected 3 got ${next.gems}`;
  if (!next.mastery.claimed[0]) return 'Did not mark as claimed';
});

check('rejects claiming unearned tiers', () => {
  const save = { 
    gold: 50,
    mastery: { points: 10, claimed: {}, snap: {} } 
  };
  const next = claimMasteryChest(save, 0); // Need 500
  if (next !== save) return 'Claimed an unearned chest';
});

// run results
process.on('exit', () => {
  console.log('\n' + pass + ' checks passed.');
  if (fails.length) {
    console.log('\nFAILURES:');
    fails.forEach(f => console.log('  x ' + f));
    process.exitCode = 1;
  }
});
