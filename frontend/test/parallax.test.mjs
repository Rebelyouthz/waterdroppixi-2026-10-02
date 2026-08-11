// Spawn composition of the deep-space backdrop.
//
// pixiRenderer.js can't be imported outside a browser (Pixi, WebGL, canvas),
// so this re-implements _positionHeroBodies' placement maths verbatim and
// asserts the thing that actually broke: at t=0 the galaxy, planet and star
// must be ON SCREEN and spread around the player, not shoved off one edge.
//
// The original bug: offsets were `cx * f` against the ABSOLUTE camera, so the
// authored fractions only held if the camera sat at world 0,0. Spawn is
// ~(3200,3200), which put the planet at x=-99 and the galaxy at x=-214 —
// both off the left edge before the player had moved.

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : '')); }
};

// --- verbatim from pixiRenderer.js ---
const bodies = (W, H) => [
  { id: 'galaxy', bx: W * 0.18, by: H * 0.24, f: 0.10, driftX: -2.6, driftY: 0.7, pad: 460, r: 210 },
  { id: 'planet', bx: W * 0.70, by: H * 0.60, f: 0.14, driftX: -4.2, driftY: 1.1, pad: 340, r: 190 },
  { id: 'star',   bx: W * 0.34, by: H * 0.86, f: 0.18, driftX: 3.6, driftY: -0.9, pad: 240, r: 90 },
];
function place(b, W, H, dcx, dcy, t) {
  const spanX = W + b.pad * 2;
  let sx = b.bx - dcx * b.f + b.driftX * t;
  sx = ((((sx + b.pad) % spanX) + spanX) % spanX) - b.pad;
  const wobble = -dcy * b.f + b.driftY * t;
  const sy = b.by + Math.sin(wobble / (H * 0.75)) * (H * 0.34);
  return { sx, sy };
}
// The OLD formula, kept so the regression is demonstrated rather than asserted
// from memory.
function placeOld(b, W, H, cx, cy, t) {
  const spanX = W + b.pad * 2;
  let sx = b.bx - cx * b.f + b.driftX * t;
  sx = ((((sx + b.pad) % spanX) + spanX) % spanX) - b.pad;
  const rawY = b.by - cy * b.f + b.driftY * t;
  const sy = H * 0.5 + Math.sin(rawY / (H * 0.75)) * (H * 0.40);
  return { sx, sy };
}

const SCREENS = [
  { name: 'phone portrait', W: 393, H: 695 },
  { name: 'phone small',    W: 320, H: 568 },
  { name: 'desktop',        W: 1440, H: 820 },
];
const SPAWN = 3200;

// The bodies as they were BEFORE the fix: old base fractions AND old formula.
// Both halves matter — comparing the old formula against the new fractions
// measures nothing real.
const oldBodies = (W, H) => [
  { id: 'galaxy', bx: W * 0.22, by: H * 0.20, f: 0.10, driftX: -2.6, driftY: 0.7, pad: 460, r: 210 },
  { id: 'planet', bx: W * 0.82, by: H * 0.60, f: 0.14, driftX: -4.2, driftY: 1.1, pad: 340, r: 190 },
  { id: 'star',   bx: W * 0.56, by: H * 0.90, f: 0.18, driftX: 3.6, driftY: -0.9, pad: 240, r: 90 },
];
const visibleFrac = (p, b, W) =>
  Math.max(0, Math.min(W, p.sx + b.r) - Math.max(0, p.sx - b.r)) / (b.r * 2);

console.log('\n=== the bug this fixes ===');
{
  const { W, H } = SCREENS[0];
  const cx = SPAWN - W / 2, cy = SPAWN - H / 2;
  const old = oldBodies(W, H).map(b => ({ b, p: placeOld(b, W, H, cx, cy, 0) }));
  const offscreen = old.filter(({ b, p }) => p.sx + b.r < 0 || p.sx - b.r > W);
  ok('old formula pushed bodies clean off screen at spawn', offscreen.length >= 2,
     old.map(({ b, p }) => `${b.id}@${Math.round(p.sx)}`).join('  '));

  // The player's actual complaint: "man missar hela fina planeten".
  const oldPlanet = old.find(x => x.b.id === 'planet');
  const oldFrac = visibleFrac(oldPlanet.p, oldPlanet.b, W);
  ok(`old formula hid most of the planet (only ${Math.round(oldFrac * 100)}% visible)`, oldFrac < 0.5);
}

console.log('\n=== spawn composition ===');
for (const s of SCREENS) {
  const { W, H } = s;
  // dcx/dcy are ZERO at spawn by construction — that is the whole fix.
  const placed = bodies(W, H).map(b => ({ b, p: place(b, W, H, 0, 0, 0) }));

  const anyVisible = placed.every(({ b, p }) => p.sx + b.r > 0 && p.sx - b.r < W && p.sy + b.r > 0 && p.sy - b.r < H);
  ok(`${s.name}: every body overlaps the screen at t=0`, anyVisible,
     placed.map(({ b, p }) => `${b.id}@${Math.round(p.sx)},${Math.round(p.sy)}`).join('  '));

  // The planet is the thing the player said they wanted to see.
  const planet = placed.find(x => x.b.id === 'planet');
  const visW = Math.min(W, planet.p.sx + planet.b.r) - Math.max(0, planet.p.sx - planet.b.r);
  const frac = visW / (planet.b.r * 2);
  ok(`${s.name}: at least half the planet is on screen (${Math.round(frac * 100)}%)`, frac >= 0.5);

  // Spread: bodies must not all sit on the same side of the player.
  const px = W / 2, py = H / 2;
  const left = placed.filter(x => x.p.sx < px).length;
  const above = placed.filter(x => x.p.sy < py).length;
  ok(`${s.name}: bodies straddle the player horizontally`, left >= 1 && left <= 2, `left=${left}/3`);
  ok(`${s.name}: bodies straddle the player vertically`, above >= 1 && above <= 2, `above=${above}/3`);
}

console.log('\n=== parallax still moves ===');
{
  const { W, H } = SCREENS[0];
  const a = place(bodies(W, H)[1], W, H, 0, 0, 0);
  const b = place(bodies(W, H)[1], W, H, 600, 0, 0);
  ok('moving the camera right slides the planet left', b.sx < a.sx, `${a.sx.toFixed(1)} -> ${b.sx.toFixed(1)}`);
  const c = place(bodies(W, H)[1], W, H, 0, 900, 0);
  ok('moving the camera vertically shifts the planet', Math.abs(c.sy - a.sy) > 1, `${a.sy.toFixed(1)} -> ${c.sy.toFixed(1)}`);
}

console.log(`\n${pass} checks passed${fail ? `, ${fail} FAILED` : ''}.\n`);
process.exit(fail ? 1 : 0);
