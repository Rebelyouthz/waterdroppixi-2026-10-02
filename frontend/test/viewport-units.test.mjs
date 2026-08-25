/* Screen-pixels-as-world-units guard.
 *
 * THE BUG THIS EXISTS FOR, in Timmy's words: "många saker som meteorer och ufo
 * och sånnt slutar animera mitt i bilden på pc för på luren har den gått ur bild
 * och de syns inte."
 *
 * Root cause: `deviceZoomFor()` clamps at `Math.max(1, …)`, so a phone gets
 * EXACTLY zoom 1.0 and screen px == world px there. Every other screen gets
 * more. Any code that uses `game.W` / `game.H` as a WORLD extent is therefore
 * correct on the phone and wrong on desktop — which is precisely why five
 * separate sites drifted into it without anyone noticing, and why the file's own
 * (stale) header comment claiming "camera scale is 1:1 on every device" was so
 * expensive.
 *
 * This checks the invariants that made the bug possible, straight from source.
 * It cannot run the renderer, so it reads the real files as text — the same
 * approach `layout.test.mjs` uses for CSS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

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

const engine = read('game/engine.js');
const renderer = read('game/pixiRenderer.js');

// ── The zoom really is asymmetric, which is the whole premise ────────
check('deviceZoomFor calibrates on the phone and can go BELOW 1 elsewhere', () => {
  // REWRITTEN 2026-08-19, together with the function it guards.
  //
  // It used to assert the OPPOSITE — that `Math.max(1, …)` was still in place —
  // on the reasoning that the phone being the only 1:1 device was this file's
  // premise. Timmy then asked for the framing to be the same on every device
  // ("de ska kännas som de gör på telefonen"), which requires desktops to zoom
  // BELOW 1, so that floor had to go.
  //
  // What has NOT changed is what this file actually protects: screen px and
  // world px are still not interchangeable — and now they are unequal on every
  // device except the reference phone, so the trap is if anything easier to
  // fall into. Every other check below stands unaltered.
  //
  // Re-pointed rather than deleted. It went red on the rewrite with the message
  // "deviceZoomFor not found — this guard is testing nothing", which is the
  // GOOD failure: a guard that quietly stops finding its code protects nothing.
  // Unbounded lazy match to the next line that is a bare `}`, rather than a
  // character budget. The budget was 1600, then 3000, and it went red again the
  // moment the function's own explanatory comment grew past it — a guard that
  // breaks when someone DOCUMENTS the code is a guard that punishes the right
  // behaviour, and the failure looks identical to the function being deleted.
  const m = engine.match(/function deviceZoomFor[\s\S]*?\n\}/);
  if (!m) return 'deviceZoomFor not found — this guard is testing nothing';
  // COMMENTS STRIPPED FIRST. Without this the check matched the function's own
  // documentation: the comment explaining why the old `Math.max(1, …)` floor
  // was removed contains that exact string, so the guard reported the bug it
  // was reading a description of. A guard that cannot tell code from prose
  // makes the codebase harder to document, which is the opposite of the point —
  // `wiring.test.mjs`'s emoji check already learned this and strips first too.
  const body = m[0]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  if (/Math\.max\(\s*1\s*,/.test(body)) {
    return 'the Math.max(1, …) floor is back. That pins every phone to exactly '
         + '1.0 and lets desktop zoom RISE with window size — the bug Timmy '
         + 'reported as "allt har blivit mindre", where a bigger window showed '
         + 'more world and shrank the hero.';
  }
  if (!/TARGET_DIAG/.test(body)) {
    return 'deviceZoomFor no longer calibrates against a target diagonal. The '
         + 'point of the rewrite is that the visible world DIAGONAL is constant, '
         + 'so the hero is the same size on every device and no window change '
         + 'can rescale the game.';
  }
  // The calibration point must stay the phone, exactly. Recomputed here from
  // source rather than trusted: hypot(393, 852) = 938.4. If the constant drifts
  // off it, the phone's framing — which the art was tuned against — moves too.
  const phone = Math.hypot(393, 852);
  const pd = Number((body.match(/PHONE_DIAG\s*=\s*(\d+)/) || [])[1]);
  if (!pd || Math.abs(pd - phone) > 3) {
    return `PHONE_DIAG is ${pd}, but the iPhone 16 diagonal is `
         + `${phone.toFixed(1)}. The phone is the reference the art was tuned `
         + `against; move it and every device's framing moves with it.`;
  }

  // THE DIRECTION OF THE DIVISION. Added 2026-08-23 after this exact bug
  // shipped: the function read `return diag / TARGET_DIAG`, which makes the
  // visible world `diag^2 / TARGET` — it GROWS with the screen instead of
  // staying put. The phone saw 938 world units and 1080p saw 5174, so
  // everything was 7.45x smaller there than it was drawn to be. Timmy reported
  // it as "spelet är för utzoomat".
  //
  // The old version of this check asserted only that TARGET_DIAG *existed*,
  // which the inverted code satisfied perfectly. A guard that cannot tell
  // `a / b` from `b / a` is not guarding the thing that broke.
  if (!/return\s+TARGET_DIAG\s*\/\s*Math\.hypot/.test(body)) {
    return 'deviceZoomFor no longer returns TARGET_DIAG / hypot(W, H). The '
         + 'camera maps world to screen as (world - cam) / zoom, so a CONSTANT '
         + 'framing needs zoom = CONSTANT / diag. Inverting it makes the visible '
         + 'world grow quadratically with the display and shrinks the whole game '
         + 'on anything larger than the phone.';
  }

  // The deliberate zoom-in factor has to stay visible and named. Without it the
  // next person reads TARGET_DIAG as "the phone diagonal" and quietly removes
  // the division that Timmy actually asked for.
  const zi = Number((body.match(/ZOOM_IN\s*=\s*([\d.]+)/) || [])[1]);
  if (!zi || zi < 1) {
    return `ZOOM_IN is ${zi}. It must be a named factor >= 1 — Timmy asked for `
         + `"in 35% minst", which is 1.35, and burying it in a magic number is `
         + `how the framing drifts back.`;
  }

  return null;
});

check('the stale "camera scale is 1:1 on every device" claim has not come back', () => {
  // That exact sentence sat above deviceZoomFor for months while the function
  // below it did the opposite, and is the best explanation for how the five
  // sites got written. If it reappears, the next person will believe it again.
  if (/scale is 1:1[^\n]*on every device/i.test(engine)) {
    return 'engine.js again claims the camera is 1:1 on every device. It is not '
         + '— deviceZoomFor returns 1.65 on a 1440x860 desktop.';
  }
  return null;
});

// ── The specific sites that were wrong ───────────────────────────────
// Each looks for the `* zoom` that converts CSS px to world units. These are
// deliberately narrow: a broad regex over the whole file would pass on any
// unrelated occurrence and quietly stop testing anything.

check('the enemy render cull converts W/H into world units', () => {
  const m = renderer.match(/_drawEnemies\(game\)[\s\S]{0,1600}?game\.enemies\.forEach/);
  if (!m) return '_drawEnemies cull block not found';
  if (!/game\.W \* zoom/.test(m[0]) || !/game\.H \* zoom/.test(m[0])) {
    return 'the cull box uses game.W/H without `* zoom`. On a 1440-wide desktop '
         + 'that leaves the right ~33% and bottom ~28% of the screen drawing no '
         + 'enemies at all.';
  }
  return null;
});

check('the ground wash / grid converts W/H into world units', () => {
  const m = renderer.match(/_drawGround\(game\)[\s\S]{0,1200}?const t = game\.run/);
  if (!m) return '_drawGround header not found';
  if (!/game\.W \* zoom/.test(m[0]) || !/game\.H \* zoom/.test(m[0])) {
    return 'gGround lives under zoomRoot (world space) but is being sized from '
         + 'CSS pixels. This is what produced the dark unpainted band down the '
         + 'right-hand side of a desktop screen.';
  }
  return null;
});

check('the deep-space backdrop converts W/H into world units', () => {
  const m = renderer.match(/_drawDeepSpace\(game\)[\s\S]{0,1600}?const cx = /);
  if (!m) return '_drawDeepSpace header not found';
  if (!/game\.W \* zoom/.test(m[0]) || !/game\.H \* zoom/.test(m[0])) {
    return 'the whole deepSpace subtree is a child of zoomRoot, so authoring it '
         + 'against CSS pixels squeezes the entire sky into the top-left ~60% of '
         + 'a desktop screen.';
  }
  return null;
});

// ── The pacing half ──────────────────────────────────────────────────
check('the enemy spawn ring is guaranteed outside the view on every aspect ratio', () => {
  const m = engine.match(/spawnEnemy\(typeId\)[\s\S]{0,2000}?const x = clamp/);
  if (!m) return 'spawnEnemy header not found';
  // Match the ASSIGNMENT, not the shape. The first version of this check was
  // `/viewSpan\(\)\s*\*\s*0?\.\d+\s*\+\s*rand/`, which went red against the
  // fixed code because it matched the COMMENT quoting the old expression. A
  // guard that reads prose is a guard that lies.
  if (/const dist\s*=\s*this\.viewSpan\(\)/.test(m[0])) {
    return 'the spawn ring is back to a flat fraction of viewSpan(). viewSpan() '
         + 'is the LONG edge, so in landscape 0.42x it lands INSIDE the frame '
         + 'and enemies materialise on screen.';
  }
  if (!/viewEdgeDist\(/.test(m[0])) {
    return 'spawnEnemy no longer calls viewEdgeDist(), which is the only thing '
         + 'that measures the view edge per-axis rather than off the long edge.';
  }
  return null;
});

check('viewEdgeDist measures per-axis, not off the long edge', () => {
  const m = engine.match(/viewEdgeDist\(ang\)\s*\{[\s\S]{0,700}?\n  \}/);
  if (!m) return 'viewEdgeDist not found';
  if (!/Math\.min\(/.test(m[0])) {
    return 'viewEdgeDist should take the MINIMUM of the width- and height-bound '
         + 'distances; without that it is just viewSpan() again.';
  }
  if (/viewSpan\(/.test(m[0])) {
    return 'viewEdgeDist is calling viewSpan(), which is the long edge and the '
         + 'exact thing it exists to replace.';
  }
  return null;
});

check('enemy approach speed is compensated for device zoom', () => {
  if (!/t\.speed \* this\.devicePace\(\)/.test(engine)) {
    return 'the enemy speed line no longer multiplies by devicePace(). Without '
         + 'it, pushing the spawn ring out to the real view edge on desktop '
         + 'makes the pacing WORSE than before the fix.';
  }
  return null;
});

check('devicePace uses the DEVICE zoom only, never the Vision upgrade', () => {
  const m = engine.match(/devicePace\(\)\s*\{[\s\S]{0,240}?\n  \}/);
  if (!m) return 'devicePace not found';
  if (/viewZoom\(/.test(m[0]) || /_visionZoom/.test(m[0])) {
    return 'devicePace() must read _deviceZoom alone. Folding in _visionZoom '
         + 'would speed enemies up in proportion to the Vision card, deleting '
         + 'the upgrade the player spent a pick on.';
  }
  return null;
});

// ── Ambient effects must not expire while still on screen ────────────
check('sky-event lifetime is derived from distance, not a hard-coded constant', () => {
  const m = engine.match(/spawnSkyEvent\(\)\s*\{[\s\S]{0,2600}?\n  \}/);
  if (!m) return 'spawnSkyEvent not found';
  if (/life:\s*isUfo\s*\?\s*rand\(/.test(m[0])) {
    return 'sky-event life is a flat rand() again. Spawn distance scales with '
         + 'the view but a flat lifetime does not, so on desktop every meteor '
         + 'expires inside the visible frame — the original report.';
  }
  if (!/this\.viewZoom\(\)/.test(m[0])) {
    return 'sky-event speed no longer scales with zoom, so its apparent speed '
         + 'differs between phone and desktop.';
  }
  return null;
});

check('sky events fade out instead of being spliced away mid-frame', () => {
  if (!/ev\.fade\s*=/.test(engine)) {
    return 'engine no longer computes ev.fade. A hard splice is a one-frame '
         + 'disappearance, which is what "slutar animera mitt i bilden" looks '
         + 'like even when the position maths is right.';
  }
  if (!/ev\.fade === undefined \? 1 : ev\.fade/.test(renderer)) {
    return 'the renderer is not reading ev.fade, so the engine is computing a '
         + 'value nothing consumes — a dead field, which is exactly the bug '
         + 'class dead-config-sweep.md is about.';
  }
  return null;
});

check('shooting stars cross the whole sky on any screen', () => {
  const m = renderer.match(/Shooting stars[\s\S]{0,1800}?const gs = this\.gShootingStars/);
  if (!m) return 'shooting-star block not found';
  if (!/\* zoom/.test(m[0])) {
    return 'shooting-star speed/spawn no longer scales with zoom; they spawn '
         + 'only in the left 60% of a desktop sky and burn out mid-screen.';
  }
  return null;
});

console.log(`\nviewport-units.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log('\nFAILURES:\n' + fails.map(f => '  x ' + f).join('\n'));
  process.exit(1);
}
