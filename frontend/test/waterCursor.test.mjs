/* Water-drop pointer. Injected faults: old 0.34 lerp still in the
 * component, window pointerleave still parks the drop, hide-on-any-leave. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { followStep, shouldHideOnLeave, isTextTarget, FOLLOW_RATE } from '../src/game/waterCursor.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const jsx = fs.readFileSync(path.join(ROOT, 'components', 'WaterCursor.jsx'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

check('follow is snappy, not the old 0.34 molasses', () => {
  if (FOLLOW_RATE < 70) return `FOLLOW_RATE ${FOLLOW_RATE} is still heavy`;
  if (/FOLLOW = 0\.34/.test(jsx)) return 'WaterCursor still hardcodes FOLLOW 0.34';
  const near = followStep(0, 20, 1 / 60);
  if (near / 20 < 0.65) return `60Hz step only covered ${(near / 20 * 100).toFixed(1)}% — still laggy`;
  const far = followStep(0, 200, 1 / 60);
  if (far / 200 <= near / 20 + 0.05) return 'catch-up did not accelerate on a long jump';
});

check('scroll leave does not hide the drop', () => {
  if (shouldHideOnLeave({ tagName: 'DIV' })) return 'any relatedTarget still hides';
  if (!shouldHideOnLeave(null)) return 'real document exit does not hide';
  if (/window\.addEventListener\('pointerleave'/.test(jsx)) {
    return 'window pointerleave is back — that is the scroll vanish';
  }
});

check('text targets hide the drop so the I-beam can show', () => {
  const input = { closest: (sel) => (sel.includes('input') ? {} : null) };
  const div = { closest: () => null };
  if (!isTextTarget(input)) return 'input is not treated as text';
  if (isTextTarget(div)) return 'plain node is treated as text';
  if (isTextTarget(null)) return 'null is treated as text';
});

if (fails.length) {
  console.error(`waterCursor.test FAIL ${fails.length}  pass ${pass}\n` + fails.map(f => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log(`waterCursor.test ok  ${pass} checks`);
