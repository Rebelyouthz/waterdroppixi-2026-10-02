/* Facing / turn kinematics on the LIVE gait.
 *
 * Gemini left a file here that imported `angleTo16Index`, `dampAngle` and
 * `gait.facingAngle` / `gait.angle16Index` from heroGait.js. None of those
 * exist. The character faces via `dirX` / `dirY`. The 16-direction sheet
 * pipeline lives in a Python bake script, not in the walk. gait.test.mjs
 * is still the planted-foot suite; this file only checks that facing
 * turns toward travel and KEEPS that heading when you stop.
 */
import { HeroGait } from '../src/game/heroGait.js';

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

check('a fresh gait faces down the screen', () => {
  const g = new HeroGait();
  if (Math.abs(g.dirX) > 1e-6) return `dirX ${g.dirX} — expected 0`;
  if (g.dirY < 0.9) return `dirY ${g.dirY} — expected +1 (south)`;
  return null;
});

check('walking east turns the mass east, and stopping keeps that heading', () => {
  const g = new HeroGait().setRadius(20);
  for (let i = 0; i < 40; i++) g.update(150, 0, 150, 0.016);
  if (g.dirX < 0.7) return `after walking east, dirX is ${g.dirX}`;
  if (Math.abs(g.dirY) > 0.4) return `after walking east, dirY is ${g.dirY}`;
  for (let i = 0; i < 30; i++) g.update(0, 0, 150, 0.016);
  if (g.speed01 !== 0) return `speed01 ${g.speed01} after a stop`;
  if (g.dirX < 0.7) return `idle facing forgot east — dirX ${g.dirX}`;
  return null;
});

check('walking north-west turns into both negative axes', () => {
  const g = new HeroGait().setRadius(20);
  for (let i = 0; i < 50; i++) g.update(-100, -100, 150, 0.016);
  if (g.dirX >= 0) return `dirX ${g.dirX} should be west (negative)`;
  if (g.dirY >= 0) return `dirY ${g.dirY} should be north (negative)`;
  return null;
});

if (fails.length) {
  console.error(`\n  kinematics.test.mjs: ${pass} passed, ${fails.length} failed\n`);
  for (const f of fails) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`  kinematics.test.mjs: ${pass} passed, 0 failed`);
