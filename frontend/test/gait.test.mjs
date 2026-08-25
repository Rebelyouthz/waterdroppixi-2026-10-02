/* THE GAIT — the properties that ARE the weight.
 *
 * Timmy asked for "tyng i sig när han går ... rena rama Assassin's Creed".
 * Almost none of that is a drawing decision, and almost all of it is one
 * property that can be measured:
 *
 *     A PLANTED FOOT DOES NOT MOVE. The body travels over it.
 *
 * Every weightless 2D character has the same defect — feet that translate with
 * the body — and it is invisible in a screenshot, because a still frame of a
 * skating character and a still frame of a walking one are identical. It only
 * shows in motion, which is exactly the thing that is expensive to review by
 * eye and cheap to check here.
 *
 * The rest of the checks below are the ones that produce the classic tells:
 * moonwalking (a time-driven cycle), a bouncing-ball bob (wrong vertical
 * phase), a mannequin (no counter-rotation), and a frame-rate dependent walk.
 *
 * Every check was proved to go red by injecting the fault before it was
 * trusted.
 */
import { HeroGait, GAIT, PERSP_Y } from '../src/game/heroGait.js';

let pass = 0;
const fails = [];
function check(name, fn) {
  try {
    const why = fn();
    if (why) fails.push(`${name}\n    ${why}`);
    else pass++;
  } catch (e) {
    fails.push(`${name}\n    threw: ${e.message}`);
  }
}

const R = 20;
/** Walk him in a straight line and sample the pose every frame. */
function walk({ vx = 120, vy = 0, seconds = 2.0, dt = 1 / 60, speed = 120 } = {}) {
  const g = new HeroGait().setRadius(R);
  const frames = [];
  let bodyX = 0, bodyY = 0;
  for (let t = 0; t < seconds; t += dt) {
    g.update(vx, vy, speed, dt);
    bodyX += vx * dt; bodyY += vy * dt;
    frames.push({
      t, bodyX, bodyY,
      // The foot's position IN THE WORLD: the body's position plus the foot's
      // offset from the body. This is the number that must hold still.
      feet: [0, 1].map(i => {
        const f = g.footDraw(i);
        return { wx: bodyX + f.x * R, wy: bodyY + f.shadowY * R, lift: f.lift, planted: f.planted };
      }),
      rise: g.rise, shift: g.shift, hip: g.hip, shoulder: g.shoulder,
      travel: g.travel, speed01: g.speed01,
    });
  }
  return { g, frames };
}

// ── 1. THE ONE THAT MATTERS ─────────────────────────────────────────
check('a planted foot does not slide across the world', () => {
  const { frames } = walk({ seconds: 2.5 });
  let worst = 0, worstAt = -1;
  // Skip the first quarter second: he is accelerating into the stride and the
  // rest-to-stride blend is legitimately moving the feet there.
  for (let i = 30; i < frames.length; i++) {
    for (let k = 0; k < 2; k++) {
      const a = frames[i - 1].feet[k], b = frames[i].feet[k];
      if (!a.planted || !b.planted) continue;
      const slip = Math.abs(b.wx - a.wx);
      if (slip > worst) { worst = slip; worstAt = i; }
    }
  }
  // One frame at 60fps covers 2 world units at this speed. A planted foot may
  // drift a small fraction of that from the stride/rest blend; anything near a
  // whole frame of travel is skating.
  const budget = 0.35;
  if (worst > budget) return `worst planted-foot slip ${worst.toFixed(3)} units at frame ${worstAt} (budget ${budget})`;
  return null;
});

check('at least one foot is planted while walking', () => {
  const { frames } = walk({ seconds: 2.0 });
  const airborne = frames.slice(30).filter(f => !f.feet[0].planted && !f.feet[1].planted);
  // He walks. He does not have a flight phase — that is a run, and it is not
  // what any of the reference art shows.
  if (airborne.length) return `${airborne.length} frames with both feet off the ground`;
  return null;
});

// ── 2. Distance-driven, not time-driven ─────────────────────────────
check('the cycle advances with DISTANCE, never with time', () => {
  // Half speed for twice as long must produce the same number of steps. A
  // time-driven cycle fails this, and the visible symptom is moonwalking.
  const a = walk({ vx: 120, seconds: 2.0, speed: 120 });
  const b = walk({ vx: 60, seconds: 4.0, speed: 120 });
  const da = a.g.travel, db = b.g.travel;
  if (Math.abs(da - db) / Math.max(da, 1e-6) > 0.02)
    return `same distance walked gave different cycle progress: ${da.toFixed(3)} vs ${db.toFixed(3)}`;
  return null;
});

check('standing still does not advance the cycle', () => {
  const g = new HeroGait().setRadius(R);
  for (let i = 0; i < 120; i++) g.update(0, 0, 120, 1 / 60);
  if (g.travel > 1e-6) return `travel advanced to ${g.travel} while standing`;
  return null;
});

check('the walk is frame-rate independent', () => {
  const hi = walk({ seconds: 2.0, dt: 1 / 144 });
  const lo = walk({ seconds: 2.0, dt: 1 / 30 });
  const d = Math.abs(hi.g.travel - lo.g.travel) / Math.max(hi.g.travel, 1e-6);
  if (d > 0.02) return `144fps and 30fps disagree by ${(d * 100).toFixed(1)}% on distance walked`;
  return null;
});

// ── 3. The phases that separate a walk from a bounce ────────────────
check('the body is LOWEST at contact and HIGHEST at mid-stance', () => {
  const { frames } = walk({ seconds: 3.0 });
  // The two feet are half a cycle apart, so a CONTACT happens every half
  // stride — at frac(s) = 0 AND at 0.5. Mid-stance is therefore at 0.25 and
  // 0.75, not at 0.5.
  //
  // The first version of this check sampled 0.5 as mid-stance, which is
  // another contact, so it compared two lows and failed a correct gait. It
  // also summed instead of averaging, so the two sides were not comparable.
  // Both are fixed; a guard that fails correct code is worse than no guard.
  let contact = 0, cN = 0, mid = 0, mN = 0;
  const near = (a, b) => Math.abs(a - b) < 0.05;
  for (const f of frames.slice(40)) {
    const s = f.travel / GAIT.stepLen;
    const frac = s - Math.floor(s);
    if (near(frac, 0) || near(frac, 0.5) || near(frac, 1)) { contact += f.rise; cN++; }
    if (near(frac, 0.25) || near(frac, 0.75)) { mid += f.rise; mN++; }
  }
  if (!cN || !mN) return `sampled ${cN} contacts and ${mN} mid-stances — the test is measuring nothing`;
  const cAvg = contact / cN, mAvg = mid / mN;
  // rise is negative-is-up, so mid-stance must be MORE negative than contact.
  if (!(mAvg < cAvg)) return `mid-stance (${mAvg.toFixed(3)}) is not higher than contact (${cAvg.toFixed(3)}) — that is a bouncing ball, not a walk`;
  return null;
});

check('there are TWO rises per stride, and ONE weight shift', () => {
  const { frames } = walk({ seconds: 4.0 });
  const zc = (key) => {
    let n = 0;
    for (let i = 41; i < frames.length; i++) {
      const a = frames[i - 1][key], b = frames[i][key];
      if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) n++;
    }
    return n;
  };
  const rises = zc('rise'), shifts = zc('shift');
  // The bob crosses zero twice as often as the sway, because the body rises
  // once per STEP and leans once per STRIDE. If those are equal, the weight is
  // not moving from foot to foot at all.
  if (rises < shifts * 1.6) return `bob crossings ${rises} vs sway crossings ${shifts} — the weight is not alternating between the feet`;
  return null;
});

check('hips and shoulders counter-rotate', () => {
  const { frames } = walk({ seconds: 2.0 });
  let sameSign = 0, n = 0;
  for (const f of frames.slice(40)) {
    if (Math.abs(f.hip) < 1e-4) continue;
    n++;
    if (Math.sign(f.hip) === Math.sign(f.shoulder)) sameSign++;
  }
  if (!n) return 'the hips never rotate at all';
  if (sameSign > n * 0.02) return `${sameSign}/${n} frames rotate hips and shoulders the SAME way — that is a mannequin on a conveyor`;
  return null;
});

// ── 4. 360 degrees ──────────────────────────────────────────────────
check('he walks in every direction, and none of them break', () => {
  const bad = [];
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    const { g, frames } = walk({ vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120, seconds: 1.5 });
    const last = frames[frames.length - 1];
    if (!Number.isFinite(g.travel) || g.travel <= 0) bad.push(`${Math.round(ang * 57.3)}deg: no travel`);
    for (const f of last.feet) {
      if (!Number.isFinite(f.wx) || !Number.isFinite(f.wy)) bad.push(`${Math.round(ang * 57.3)}deg: non-finite foot`);
    }
  }
  return bad.length ? bad.join('; ') : null;
});

check('vertical steps are foreshortened, horizontal ones are not', () => {
  // The camera looks down at an angle. A step away from it must cover less
  // screen distance than the same step taken sideways, or the perspective
  // falls apart the moment he turns a corner.
  const side = walk({ vx: 120, vy: 0, seconds: 2.0 });
  const away = walk({ vx: 0, vy: 120, seconds: 2.0 });
  const spread = (r) => {
    let m = 0;
    for (const f of r.frames.slice(40)) m = Math.max(m, Math.abs(f.feet[0].wy - f.bodyY), Math.abs(f.feet[1].wy - f.bodyY));
    return m;
  };
  const spreadX = (r) => {
    let m = 0;
    for (const f of r.frames.slice(40)) m = Math.max(m, Math.abs(f.feet[0].wx - f.bodyX), Math.abs(f.feet[1].wx - f.bodyX));
    return m;
  };
  const across = spreadX(side), toward = spread(away);
  if (!(toward < across)) return `stepping away spreads the feet ${toward.toFixed(1)} vs ${across.toFixed(1)} across — no foreshortening`;
  if (PERSP_Y >= 1) return `PERSP_Y is ${PERSP_Y}; it must compress, not stretch`;
  return null;
});

// ── 5. Idle is alive, and nothing ever goes NaN ─────────────────────
check('standing still still moves, on more than one cycle', () => {
  const g = new HeroGait().setRadius(R);
  const breath = [], rock = [], shift = [];
  for (let i = 0; i < 900; i++) {
    g.update(0, 0, 120, 1 / 60);
    breath.push(g.breath); rock.push(g.idleRock); shift.push(g.idleShift);
  }
  const range = (a) => Math.max(...a) - Math.min(...a);
  // EACH LAYER, separately.
  //
  // The first version summed them and asked for lots of distinct values — and
  // an injected fault that killed breathing entirely still passed, because the
  // rock alone varies plenty. A check that survives the removal of the thing
  // it exists to protect is not a check. Caught by fault injection, which is
  // the only reason it was ever known.
  if (range(breath) < 0.01) return `breathing has a range of ${range(breath).toFixed(4)} — he is holding his breath`;
  if (range(rock) < 0.01) return `the weight rock has a range of ${range(rock).toFixed(4)} — he is standing to attention`;
  if (range(shift) < 0.01) return `he never shifts his weight (range ${range(shift).toFixed(4)}) — the one unpredictable beat is missing`;
  // The rock and the breath must not run at the same rate, or the layering
  // buys nothing. Measured on the two pure sines, with the random shift kept
  // out of it — that is why they are separate fields.
  const cross = (a) => { let n = 0; for (let i = 1; i < a.length; i++) if ((a[i - 1] <= 0) !== (a[i] <= 0)) n++; return n; };
  const bz = cross(breath), rz = cross(rock);
  if (!bz || !rz) return `a layer never crosses zero (breath ${bz}, rock ${rz})`;
  if (Math.max(bz, rz) / Math.min(bz, rz) < 1.5)
    return `breath and rock run at almost the same rate (${bz} vs ${rz}) — they will line up`;

  // And the combined idle must not REPEAT — measured by autocorrelation, not
  // by counting zero crossings.
  //
  // Counting crossings was the first attempt and it was measuring the wrong
  // thing: `idleRock` deliberately carries an occasional random weight-shift
  // on top of its sine, so its crossing count reflects the shift rather than
  // its period, and the check failed a perfectly good idle twice. The property
  // actually wanted is "you cannot see it loop", and that is exactly what
  // autocorrelation asks: does the signal match itself at any lag?
  const sig = breath.map((b, i) => b + rock[i] + shift[i]);
  const mean = sig.reduce((a, b) => a + b, 0) / sig.length;
  const dev = sig.map(v => v - mean);
  const energy = dev.reduce((a, b) => a + b * b, 0) || 1e-9;
  let worst = 0, worstLag = 0;
  // Lags from half a second to eight seconds: shorter than that is not a loop
  // anyone perceives, longer than that and he has moved on.
  for (let lag = 30; lag < 480; lag++) {
    let c = 0;
    for (let i = 0; i + lag < dev.length; i++) c += dev[i] * dev[i + lag];
    const norm = c / energy;
    if (norm > worst) { worst = norm; worstLag = lag; }
  }
  if (worst > 0.85) return `the idle repeats itself at ${(worstLag / 60).toFixed(1)}s (correlation ${worst.toFixed(2)}) — that is a visible loop`;
  return null;
});

check('nothing goes non-finite, however it is driven', () => {
  const g = new HeroGait().setRadius(R);
  const nasty = [
    [0, 0, 0], [1e9, -1e9, 1 / 60], [NaN, 0, 1 / 60], [0, NaN, 1 / 60],
    [120, 0, 0], [120, 0, 10], [120, 0, -1], [0, 0, 1 / 240],
  ];
  for (const [vx, vy, dt] of nasty) {
    g.update(vx, vy, 120, dt);
    const vals = [g.travel, g.rise, g.shift, g.hip, g.shoulder, g.lean, g.speed01,
      ...g.feet.flatMap(f => [f.x, f.y, f.lift])];
    const bad = vals.filter(v => !Number.isFinite(v));
    if (bad.length) return `vx=${vx} vy=${vy} dt=${dt} produced ${bad.length} non-finite values`;
  }
  return null;
});

check('a lifted foot casts its shadow on the GROUND, not on itself', () => {
  // The separation of foot and shadow is the entire read of "this foot left
  // the floor". If they move together he floats, however good the shading is.
  const { g } = walk({ seconds: 1.2 });
  let sawLift = false;
  for (let i = 0; i < 200; i++) {
    g.update(120, 0, 120, 1 / 60);
    for (const k of [0, 1]) {
      const f = g.footDraw(k);
      if (f.lift > 0.05) {
        sawLift = true;
        if (Math.abs(f.y - f.shadowY) < f.lift * 0.5)
          return `a foot lifted ${f.lift.toFixed(3)} but its shadow followed it up`;
      }
    }
  }
  if (!sawLift) return 'no foot ever left the ground';
  return null;
});

// ── Report ──────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n  gait.test.mjs: ${pass} passed, ${fails.length} failed\n`);
  for (const f of fails) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`  gait.test.mjs: ${pass} passed, 0 failed`);
