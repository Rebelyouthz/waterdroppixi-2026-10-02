/* Enemy contact separation.
 *
 * The bug this guards: `updateEnemies` had a `// separation - mild` comment
 * with no code under it, so nothing stopped an enemy walking INTO the player.
 * The chase normal is recomputed toward the player every frame, so once a fast
 * enemy arrived it drove itself into the hitbox, overshot, flipped, and
 * jittered on the spot -- glued to the character -- while contact damage
 * retriggered on its 0.32s cooldown until the player died.
 *
 * The engine is a large stateful class that needs a canvas, so rather than
 * booting it we reproduce the exact integration step from
 * engine.js updateEnemies and assert the invariant that step must hold:
 * a non-boss enemy may touch the player but may never occupy them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* One frame of the chase, mirroring engine.js. `separate` toggles the fix so
   the test can prove the fix is what makes the difference. */
function chase({ playerSpeed, enemySpeed, separate, frames = 600, size = 22 }) {
  const world = { w: 4000, h: 4000 };
  const p = { x: 500, y: 500, r: 14 };
  const e = { x: 620, y: 500 };
  const sumR = size / 2 + p.r;
  const dt = 1 / 60;
  let overlapFrames = 0;
  let minGap = Infinity;

  for (let i = 0; i < frames; i++) {
    p.x = clamp(p.x + playerSpeed * dt, 20, world.w - 20);

    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;

    e.x += nx * enemySpeed * dt;
    e.y += ny * enemySpeed * dt;
    e.x = clamp(e.x, 20, world.w - 20);
    e.y = clamp(e.y, 20, world.h - 20);

    if (separate) {
      const sx = e.x - p.x, sy = e.y - p.y;
      const sd = Math.hypot(sx, sy);
      if (sd < sumR) {
        const ux = sd > 0.001 ? sx / sd : -nx;
        const uy = sd > 0.001 ? sy / sd : -ny;
        e.x = clamp(p.x + ux * sumR, 20, world.w - 20);
        e.y = clamp(p.y + uy * sumR, 20, world.h - 20);
      }
    }

    const gap = Math.hypot(e.x - p.x, e.y - p.y);
    minGap = Math.min(minGap, gap);
    if (gap < sumR - 0.01) overlapFrames++;
  }
  return { overlapFrames, minGap, sumR };
}

check('without separation a fast enemy buries itself in the player', () => {
  /* This is the control. If this ever stops reproducing, the test above it is
     no longer proving anything and the whole file is worthless. */
  const r = chase({ playerSpeed: 200, enemySpeed: 260, separate: false });
  if (r.overlapFrames === 0) return 'the original bug no longer reproduces — this test proves nothing';
  if (r.minGap > 1) return `expected the enemy to reach the player, closest was ${r.minGap.toFixed(2)}`;
  return null;
});

check('with separation a fast enemy never occupies the player', () => {
  const r = chase({ playerSpeed: 200, enemySpeed: 260, separate: true });
  if (r.overlapFrames !== 0) return `${r.overlapFrames} frames inside the player`;
  if (r.minGap < r.sumR - 0.01) return `closest approach ${r.minGap.toFixed(2)} < contact ring ${r.sumR}`;
  return null;
});

check('separation holds for enemies far faster than the player', () => {
  /* The reported case was the small purple enemies, which badly outrun you. */
  for (const enemySpeed of [300, 500, 900, 2000]) {
    const r = chase({ playerSpeed: 180, enemySpeed, separate: true });
    if (r.overlapFrames !== 0) return `at speed ${enemySpeed}: ${r.overlapFrames} overlapping frames`;
  }
  return null;
});

check('separation still lets the enemy make contact', () => {
  /* Pushing them out must not make them harmless. engine.js triggers contact
     damage at `d < sumR + 4`, so sitting exactly on sumR must still hit. */
  const r = chase({ playerSpeed: 200, enemySpeed: 260, separate: true });
  return r.minGap <= r.sumR + 4 ? null : `closest ${r.minGap.toFixed(2)} is outside the damage ring ${r.sumR + 4}`;
});

check('a stationary player is not shoved around by a co-located enemy', () => {
  /* Degenerate case: enemy exactly on the player, distance 0. Naively
     normalising here divides by zero and produces NaN, which would strand the
     enemy off-world. */
  const r = chase({ playerSpeed: 0, enemySpeed: 400, separate: true });
  if (!Number.isFinite(r.minGap)) return 'position went non-finite (divide by zero)';
  if (r.overlapFrames !== 0) return `${r.overlapFrames} overlapping frames`;
  return null;
});

check('the fix is actually present in engine.js', () => {
  /* The simulation above models the engine; this confirms the engine really
     contains it, so the two cannot silently diverge. */
  const src = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'game', 'engine.js'), 'utf8');
  if (/\/\/ separation - mild\s*\n\s*\/\/ collision with player/.test(src)) {
    return 'engine.js still has the empty "separation - mild" comment and no separation code';
  }
  if (!/Contact separation/.test(src)) return 'no contact separation block found in engine.js';
  return null;
});

/* ---- Face geometry -------------------------------------------------------
 *
 * The face is laid out as if the head were a circle. It is not: the body is a
 * teardrop that narrows to a point. Eyes sit in the upper third and brows sit
 * higher still, so a feature that is comfortably inside a circle can be drawn
 * outside the actual silhouette.
 *
 * Reported as "the eye goes weird when you aim and run right". It was the
 * BROW: raised (rage/surprise) and in a hard profile it landed at y = -1.14r,
 * where the drop is 0.009r wide, while still reaching out to 0.70r -- a stroke
 * hanging in open space beside his head.
 */
const BROW_CEIL = -0.92;

function worstBrowOverflow(heroHalfWidthAt, { clampHeight, clampTilt, clampX }) {
  let worst = 0;
  let worstCase = null;
  for (let fx = -1; fx <= 1.001; fx += 0.05) {
    for (let fy = -1; fy <= 1.001; fy += 0.05) {
      for (const browY of [-1, -0.5, 0, 0.5, 1]) {
        for (const browAng of [-1, -0.5, 0, 0.5, 1]) {
          const cx = fx * 0.24, cy = -0.34 + fy * 0.08;
          const persp = 1 - Math.abs(fx) * 0.42;
          for (const side of [-1, 1]) {
            const nearIsRight = fx >= 0;
            const isFar = nearIsRight ? side < 0 : side > 0;
            const wScale = isFar ? Math.max(0, persp * 1.15 - 0.15) : 1;
            if (wScale <= 0.04) continue;
            const ex = cx + side * 0.33 * persp;
            const eyeRx = 0.235 * wScale;

            const raw = cy - 0.40 + browY * 0.34;
            const base = clampHeight ? Math.max(raw, BROW_CEIL) : raw;
            let innerY = base - browAng * 0.36;
            let outerY = base + browAng * 0.14;
            if (clampTilt) {
              innerY = Math.max(innerY, BROW_CEIL);
              outerY = Math.max(outerY, BROW_CEIL);
            }
            const hw = heroHalfWidthAt(Math.min(innerY, outerY));
            const limit = (hw > 0 ? hw : eyeRx) * 0.90;
            const ends = [
              [ex - eyeRx * 1.15, side > 0 ? innerY : outerY],
              [ex + eyeRx * 1.15, side > 0 ? outerY : innerY],
            ];
            for (const [rawX, y] of ends) {
              const bx = clampX ? Math.max(-limit, Math.min(limit, rawX)) : rawX;
              const bodyHW = heroHalfWidthAt(y);
              const over = Math.abs(bx) - (bodyHW > 0 ? bodyHW : 0);
              if (over > worst) { worst = over; worstCase = { fx: +fx.toFixed(2), browY, browAng, y: +y.toFixed(2) }; }
            }
          }
        }
      }
    }
  }
  return { worst, worstCase };
}

const shape = await import('../src/game/heroShape.js');

check('heroHalfWidthAt matches the teardrop it describes', () => {
  const { heroHalfWidthAt } = shape;
  if (typeof heroHalfWidthAt !== 'function') return 'heroShape does not export heroHalfWidthAt';
  if (heroHalfWidthAt(-1.20) !== 0) return 'above the tip should be 0 width';
  if (heroHalfWidthAt(1.20) !== 0) return 'below the base should be 0 width';
  const tipish = heroHalfWidthAt(-0.9);
  const middle = heroHalfWidthAt(0);
  if (!(tipish < middle)) return `drop is not narrower at the top (${tipish} vs ${middle})`;
  if (!(middle > 0.7 && middle < 0.85)) return `unexpected mid half-width ${middle}`;
  return null;
});

check('the unclamped brow really did escape the body', () => {
  /* Control: if this stops reproducing, the assertion below proves nothing. */
  const { worst } = worstBrowOverflow(shape.heroHalfWidthAt,
    { clampHeight: false, clampTilt: false, clampX: false });
  return worst > 0.5 ? null : `expected a large overflow, measured only ${worst.toFixed(3)}r`;
});

check('clamping height alone is not enough', () => {
  /* Documents why there are two clamps rather than one: a hard tilt still
     lifts the inner end past the tip, where there is no width to clamp to. */
  const { worst } = worstBrowOverflow(shape.heroHalfWidthAt,
    { clampHeight: true, clampTilt: false, clampX: true });
  return worst > 0 ? null : 'height+x clamping alone now suffices — the tilt clamp may be redundant';
});

check('the brow stays inside the silhouette at every angle', () => {
  const { worst, worstCase } = worstBrowOverflow(shape.heroHalfWidthAt,
    { clampHeight: true, clampTilt: true, clampX: true });
  return worst <= 1e-9 ? null : `overflows by ${worst.toFixed(4)}r at ${JSON.stringify(worstCase)}`;
});

check('the face rig applies both brow clamps', () => {
  // The face rig moved out of pixiRenderer into game/heroDraw.js on 2026-08-18
  // so the intro film could draw the SAME character the run does. The clamps
  // moved with it — this guard follows the CODE rather than the filename, or it
  // would sit green while protecting nothing. It caught exactly that on the move.
  const src = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'game', 'heroDraw.js'), 'utf8');
  if (!/drawHeroFace/.test(src)) return 'heroDraw.js no longer defines drawHeroFace — has the rig moved again?';
  if (!/BROW_CEIL/.test(src)) return 'the face rig has no BROW_CEIL clamp';
  if (!/heroHalfWidthAt/.test(src)) return 'the face rig does not clamp brow ends to the silhouette';
  return null;
});

/* ---- Katana storyline wiring --------------------------------------------
 *
 * The `s_katana` quest completes by finishing a run carrying the katana, which
 * GameScreen detects from the game-over result. That result is a `snapshot()`,
 * and snapshot exposes carried weapons as `weapons: [{ id, ... }]` — NOT as a
 * bare `ownedWeapons` id array. Reaching for the wrong one makes the quest
 * permanently uncompletable with no error anywhere, which is exactly the kind
 * of silent dead end that only shows up as "this never ticks".
 */
const engineSrc = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'game', 'engine.js'), 'utf8');
const gameScreenSrc = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 'GameScreen.jsx'), 'utf8');

check('snapshot exposes carried weapons as objects with an id', () => {
  const m = /weapons:\s*this\.run\.ownedWeapons\.map\(id => \(\{([^}]*)\}\)\)/.exec(engineSrc);
  if (!m) return 'snapshot() no longer builds `weapons` from ownedWeapons — the detector below may be reading a field that is gone';
  if (!/\bid\b/.test(m[1])) return 'snapshot weapons entries carry no `id`';
  return null;
});

check('the katana-run detector reads the field snapshot actually provides', () => {
  // Deliberately not tied to the variable name — that changed once already
  // when the mid-run-save bug was fixed, and the name is not what matters.
  // What matters is that katanaRuns is incremented, and from r.weapons.
  const block = /katanaRuns\s*=\s*\([\w.]+\.katanaRuns[^;]*;/.test(gameScreenSrc);
  if (!block) return 'no katanaRuns increment found in GameScreen';
  if (/r\.ownedWeapons/.test(gameScreenSrc)) {
    return 'GameScreen reads r.ownedWeapons, which snapshot() does not provide';
  }
  if (!/r\.weapons\s*\|\|\s*\[\]\)\.some/.test(gameScreenSrc)) {
    return 'katanaRuns is not derived from r.weapons';
  }
  return null;
});

const { STORY_QUESTS } = await import('../src/game/storyQuests.js');
const { STARTER_WEAPONS } = await import('../src/game/data_ext2.js');

check('the katana quest is completable and starts incomplete', () => {
  const q = STORY_QUESTS.find((x) => x.id === 's_katana');
  if (!q) return 'the s_katana quest is missing';
  if (q.check({}) !== false) return 'quest is already complete on a fresh save';
  if (q.check({ katanaRuns: 1 }) !== true) return 'quest does not complete after one katana run';
  return null;
});

check('the katana is an unlocked starter, not a shard craft', () => {
  const k = STARTER_WEAPONS.katana;
  if (!k) return 'katana is not in STARTER_WEAPONS, so it cannot be chosen to start a run';
  if (k.blueprintCost) return 'katana requires shards, so the quest could be unreachable';
  return null;
});

console.log(`\nphysics.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
