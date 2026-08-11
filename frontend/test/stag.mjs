// Replays updateStagnation's exact arithmetic against four play patterns.
// The bug the review caught was that a sprinting player ramped to full
// penalty, so "sprinting must stay at 0" is the load-bearing assertion here.
const SAMPLE = 1.5, MOVED_MIN = 75, RAMP = 9, DECAY = 3;
const dt = 1 / 60;

function run(label, posAt, seconds = 30) {
  let stag = 0, sampleT = 0, dist = 0, moving = true;
  let prev = posAt(0);
  let peak = 0;
  for (let f = 1; f * dt <= seconds; f++) {
    const t = f * dt;
    const p = posAt(t);
    dist += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    sampleT += dt;
    if (sampleT >= SAMPLE) { sampleT = 0; moving = dist > MOVED_MIN; dist = 0; }
    stag = moving ? Math.max(0, stag - dt / DECAY) : Math.min(1, stag + dt / RAMP);
    peak = Math.max(peak, stag);
  }
  console.log(`${label.padEnd(34)} final ${stag.toFixed(2)}   peak ${peak.toFixed(2)}`);
  return { stag, peak };
}

const S = 200; // base move speed px/s
const r1 = run('sprinting in a line (200px/s)',   t => ({ x: S * t, y: 0 }));
const r2 = run('circle-strafing, 45px radius',    t => ({ x: 45 * Math.cos(S / 45 * t), y: 45 * Math.sin(S / 45 * t) }));
const r3 = run('slow drift (40px/s)',             t => ({ x: 40 * t, y: 0 }));
const r4 = run('fully AFK',                       () => ({ x: 0, y: 0 }));
const r5 = run('AFK 12s then sprints away',       t => (t < 12 ? { x: 0, y: 0 } : { x: S * (t - 12), y: 0 }));

import assert from 'node:assert';
assert.ok(r1.peak < 0.05, 'a sprinting player must never accrue stagnation');
assert.ok(r2.peak < 0.05, 'circle-strafing is active play and must not be punished');
assert.ok(r3.peak > 0.9,  'a near-idle drift should still trip the penalty');
assert.ok(r4.stag > 0.95, 'a fully AFK player must reach the full penalty');
assert.ok(r5.stag < 0.05, 'moving again must clear the penalty');
console.log('\nall stagnation behaviours correct.');
