// Clicker prestige (Springs).
//
// A reset loop that pays the wrong amount is the worst class of bug in an idle
// game: it is invisible for the first reset and compounds forever after. These
// checks pin the three properties that actually matter — you can never farm
// Springs by resetting repeatedly, a reset never costs you progress you had
// already banked, and the multiplier genuinely applies to production.

import {
  springsFor, prestigeGain, prestigeMult, doPrestige,
  dropsPerSec, SPRING_THRESHOLD, SPRING_BONUS, CLICKER_BUILDINGS,
} from '../src/game/clicker.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : '')); }
};

const mk = (o = {}) => ({ drops: 0, total: 0, buildings: {}, clickLvl: 0, claimed: {}, springs: 0, prestiges: 0, ...o });

console.log('\n=== spring maths ===');
ok('no Springs below the threshold', springsFor(SPRING_THRESHOLD - 1) === 0);
ok('exactly one Spring at the threshold', springsFor(SPRING_THRESHOLD) === 1);
ok('sqrt growth: 4x lifetime is 2x Springs', springsFor(SPRING_THRESHOLD * 4) === 2,
   String(springsFor(SPRING_THRESHOLD * 4)));
ok('sqrt growth: 100x lifetime is 10x Springs', springsFor(SPRING_THRESHOLD * 100) === 10);

console.log('\n=== the exploit that matters ===');
{
  // Reset twice in a row without producing anything in between. If the second
  // reset pays again, the whole economy is broken.
  const a = mk({ total: SPRING_THRESHOLD * 9 });
  const b = doPrestige(a);
  ok('first reset pays', b.springs === 3, 'springs=' + b.springs);
  const c = doPrestige(b);
  ok('an immediate second reset pays NOTHING', c.springs === b.springs, 'springs=' + c.springs);
  ok('gain reads zero when nothing new was produced', prestigeGain(b) === 0);
  // And it must resume paying once more production happens.
  const d = doPrestige({ ...b, total: SPRING_THRESHOLD * 25 });
  ok('resets pay again after more lifetime production', d.springs === 5, 'springs=' + d.springs);
}

console.log('\n=== a reset must not punish ===');
{
  const before = mk({
    total: SPRING_THRESHOLD * 4,
    drops: 5000,
    buildings: { condenser: 12, net: 3 },
    clickLvl: 7,
    claimed: { 100: true, 1000: true },
    springs: 1,
  });
  const after = doPrestige(before);
  ok('lifetime total survives (milestones are paid against it)', after.total === before.total);
  ok('claimed milestones survive', Object.keys(after.claimed).length === 2);
  ok('banked Springs survive and grow', after.springs > before.springs, `${before.springs} -> ${after.springs}`);
  ok('spendable drops reset', after.drops === 0);
  ok('buildings reset', Object.keys(after.buildings).length === 0);
  ok('click level resets', after.clickLvl === 0);
  ok('prestige count increments', after.prestiges === 1);
  ok('the input object is not mutated', before.drops === 5000 && before.clickLvl === 7);
}

console.log('\n=== the multiplier actually applies ===');
{
  const def = CLICKER_BUILDINGS[0];
  const plain = mk({ buildings: { [def.id]: 10 } });
  const boosted = mk({ buildings: { [def.id]: 10 }, springs: 4 });
  const baseRate = def.rate * 10;
  ok('no Springs means no bonus', Math.abs(dropsPerSec(plain) - baseRate) < 1e-9,
     String(dropsPerSec(plain)));
  const expect = baseRate * (1 + 4 * SPRING_BONUS);
  ok(`4 Springs gives x${(1 + 4 * SPRING_BONUS).toFixed(2)} production`,
     Math.abs(dropsPerSec(boosted) - expect) < 1e-9,
     `${dropsPerSec(boosted)} vs ${expect}`);
  ok('multiplier helper agrees with production', Math.abs(prestigeMult(boosted) - 1.2) < 1e-9);
}

console.log('\n=== degenerate inputs ===');
ok('undefined clicker does not throw', prestigeGain(undefined) === 0 && prestigeMult(undefined) === 1);
ok('a reset with nothing earned is a no-op', doPrestige(mk()) === undefined ? false : doPrestige(mk()).springs === 0);
ok('negative/garbage total is clamped', springsFor(-5) === 0 && springsFor(NaN) === 0);

console.log(`\n${pass} checks passed${fail ? `, ${fail} FAILED` : ''}.\n`);
process.exit(fail ? 1 : 0);
