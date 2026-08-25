/* Dash-swipe gesture guards.
 *
 * Timmy's requirement, in his words: "kanske inte släpp men man måste swipe
 * tydligt så de inte blir av misstag" — the dash must fire on a clear,
 * deliberate flick and must NEVER fire by accident while the player is simply
 * steering. That second half is the one that matters: an accidental dash puts
 * you inside a crowd on a 2.4s cooldown, which is a death.
 *
 * The thresholds are imported from the real module, never restated here. A test
 * that hard-coded 52 and 0.62 would keep passing after someone retuned the
 * gesture and would have stopped testing anything.
 */
import {
  judgeSwipe, hasSettled,
  SWIPE_MIN_DIST, SWIPE_MIN_SPEED, SWIPE_STRAIGHT, SWIPE_REARM,
  SWIPE_FAST_SPEED, SWIPE_LONG_DIST,
} from '../src/game/gestures.js';

let pass = 0;
const fails = [];
function check(name, fn) {
  try {
    const why = fn();
    if (why) fails.push(`${name}\n    ${why}`);
    else { pass++; console.log(`  ok  ${name}`); }
  } catch (e) {
    fails.push(`${name}\n    threw: ${e.message}`);
  }
}

/** A straight-line gesture: `n` samples covering `dist` px over `ms`. */
function line(dist, ms, n = 6, angle = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    out.push({
      x: 200 + Math.cos(angle) * dist * f,
      y: 400 + Math.sin(angle) * dist * f,
      t: 1000 + ms * f,
    });
  }
  return out;
}

/** An ARC: the shape a thumb makes while tracking a moving target.
 *  Laid on a circle whose CHORD is `dist`, so net displacement is held fixed
 *  while the path gets longer as the sweep widens — which isolates the
 *  straightness test from the distance and speed tests. */
function arc(dist, ms, sweepDeg, n = 8) {
  const sweep = (sweepDeg * Math.PI) / 180;
  const r = dist / (2 * Math.sin(sweep / 2));
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const a = -sweep / 2 + sweep * f;
    out.push({ x: 200 + Math.sin(a) * r, y: 400 - Math.cos(a) * r, t: 1000 + ms * f });
  }
  return out;
}

// ── The gesture that MUST fire ──────────────────────────────────────
check('a straight, fast, long flick fires', () => {
  const hit = judgeSwipe(line(120, 90));
  if (!hit) return 'a 120px straight flick in 90ms (1.33 px/ms) did not register';
  if (Math.abs(hit.nx - 1) > 1e-6 || Math.abs(hit.ny) > 1e-6) {
    return `direction should be +x, got (${hit.nx.toFixed(3)}, ${hit.ny.toFixed(3)})`;
  }
  return null;
});

check('the dash goes exactly where you swiped, in any direction', () => {
  for (const deg of [0, 37, 90, 143, 180, 233, 270, 315]) {
    const rad = (deg * Math.PI) / 180;
    const hit = judgeSwipe(line(120, 90, 6, rad));
    if (!hit) return `${deg}° flick did not register`;
    const got = Math.atan2(hit.ny, hit.nx);
    let d = Math.abs(got - rad);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > 1e-6) return `${deg}° flick came back as ${((got * 180) / Math.PI).toFixed(2)}°`;
  }
  return null;
});

// ── The gestures that MUST NOT fire ─────────────────────────────────
check('a slow drag does not dash, however far it travels', () => {
  // 300px is a huge move — but over 900ms it is 0.33 px/ms, i.e. steering.
  if (judgeSwipe(line(300, 900))) return 'a 300px drag over 900ms fired a dash';
  return null;
});

check('a short nudge does not dash, however fast it is', () => {
  // 30px in 12ms is 2.5 px/ms — faster than a full-strength flick, but it is a
  // twitch, not a swipe.
  if (judgeSwipe(line(30, 12))) return 'a 30px twitch fired a dash';
  return null;
});

check('CURVED steering does not dash, even when long and fast', () => {
  // This is the case the whole feature hinges on: the player is tracking a
  // target, so the thumb sweeps an arc — long, fast, and not a dash.
  const samples = arc(130, 85, 110);
  const a = samples[0], b = samples[samples.length - 1];
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const speed = dist / (b.t - a.t);
  if (dist < SWIPE_MIN_DIST) return 'test is not exercising the guard: arc is too short';
  if (speed < SWIPE_MIN_SPEED) return 'test is not exercising the guard: arc is too slow';
  if (judgeSwipe(samples)) {
    return `a 110° arc of ${dist.toFixed(0)}px at ${speed.toFixed(2)} px/ms fired a dash`;
  }
  return null;
});

check('the straightness cutoff sits between a gentle arc and a hard one', () => {
  // A nearly-straight correction should still dash; a real curve should not.
  const gentle = judgeSwipe(arc(130, 85, 18));
  const hard   = judgeSwipe(arc(130, 85, 75));
  if (!gentle) return 'an 18° arc (a straight flick with a wobble) failed to dash';
  if (hard)    return 'a 75° arc fired a dash';
  return null;
});

check('too few samples is never a dash', () => {
  if (judgeSwipe([])) return 'empty buffer fired';
  if (judgeSwipe(null)) return 'null buffer fired';
  if (judgeSwipe(line(120, 90, 2))) return 'a 2-sample buffer fired';
  return null;
});

check('a zero-duration buffer cannot fire (no divide-by-zero dash)', () => {
  const same = [
    { x: 200, y: 400, t: 1000 },
    { x: 260, y: 400, t: 1000 },
    { x: 320, y: 400, t: 1000 },
  ];
  if (judgeSwipe(same)) return 'three samples at the same timestamp fired a dash';
  return null;
});

// ── The analog half: speed AND length both feed power ───────────────
check('power rises with swipe SPEED at a fixed length', () => {
  const slow = judgeSwipe(line(120, 140));   // 0.86 px/ms
  const fast = judgeSwipe(line(120, 60));    // 2.00 px/ms
  if (!slow || !fast) return 'one of the two reference flicks did not register';
  if (!(fast.power > slow.power + 0.1)) {
    return `speed barely moved power: slow ${slow.power.toFixed(3)} vs fast ${fast.power.toFixed(3)}`;
  }
  return null;
});

check('power rises with swipe LENGTH at a fixed speed', () => {
  // Same 1.2 px/ms, different distances.
  const short = judgeSwipe(line(60, 50));
  const long  = judgeSwipe(line(180, 150));
  if (!short || !long) return 'one of the two reference flicks did not register';
  if (!(long.power > short.power + 0.1)) {
    return `length barely moved power: short ${short.power.toFixed(3)} vs long ${long.power.toFixed(3)}`;
  }
  return null;
});

check('power stays inside 0..1 at both extremes', () => {
  const weak = judgeSwipe(line(SWIPE_MIN_DIST + 1, Math.ceil((SWIPE_MIN_DIST + 1) / SWIPE_MIN_SPEED) - 1));
  const huge = judgeSwipe(line(SWIPE_LONG_DIST * 3, 30));
  if (!weak) return 'the weakest qualifying flick did not register';
  if (!huge) return 'an extreme flick did not register';
  if (weak.power < 0 || weak.power > 1) return `weak power out of range: ${weak.power}`;
  if (huge.power < 0 || huge.power > 1) return `huge power out of range: ${huge.power}`;
  if (!(huge.power > 0.95)) return `an extreme flick only scored ${huge.power.toFixed(3)}`;
  if (!(weak.power < 0.2)) return `the weakest qualifying flick scored ${weak.power.toFixed(3)}`;
  return null;
});

// ── Re-arming: one drag must not machine-gun dashes ─────────────────
check('a still thumb re-arms the gesture', () => {
  const still = [
    { x: 200, y: 400, t: 1000 },
    { x: 201, y: 400, t: 1060 },
    { x: 201, y: 401, t: 1120 },
  ];
  if (!hasSettled(still)) return 'a thumb that barely moved for 120ms did not re-arm';
  return null;
});

check('a thumb still moving fast does NOT re-arm', () => {
  if (hasSettled(line(200, 100))) return 'a 2 px/ms drag counted as settled';
  return null;
});

check('a sub-window sample pair cannot re-arm on a rounding fluke', () => {
  // Under 40ms there is not enough evidence either way, so it must stay armed.
  if (hasSettled([{ x: 200, y: 400, t: 1000 }, { x: 200, y: 400, t: 1030 }])) {
    return 'a 30ms window re-armed the gesture';
  }
  return null;
});

// ── The thresholds themselves have to stay sane ─────────────────────
check('the thresholds are internally consistent', () => {
  if (!(SWIPE_STRAIGHT > 0 && SWIPE_STRAIGHT < 1)) return 'straightness must be a 0..1 ratio';
  if (!(SWIPE_FAST_SPEED > SWIPE_MIN_SPEED)) return 'full-power speed must exceed the minimum';
  if (!(SWIPE_LONG_DIST > SWIPE_MIN_DIST)) return 'full-power distance must exceed the minimum';
  if (!(SWIPE_REARM < SWIPE_MIN_SPEED)) {
    return 'the re-arm speed must be BELOW the fire speed, or a gesture re-arms while still fast enough to fire and dashes repeat';
  }
  return null;
});

console.log(`\ngestures.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log('\nFAILURES:\n' + fails.map(f => '  ✗ ' + f).join('\n'));
  process.exit(1);
}
