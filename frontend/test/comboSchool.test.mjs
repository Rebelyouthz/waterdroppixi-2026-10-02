/* Combo school: large skippable nodes, Combo Points, not a 46th talent.
 *
 * Injected faults: costs that do not climb, a source that never pays, Hook
 * unlocking without a Combo Point, a combo node that gates a talent step,
 * ids that look like talents (t_), supply too small to finish the school.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMBO_NODES, COMBO_TOTAL_COST, COMBO_POINT_SOURCES, COMBO_POINT_SUPPLY,
  isComboAvailable, canBuyCombo, buyComboNode, applyComboPointSources,
  buildComboFormFlags, comboFormOwned,
} from '../src/game/comboSchool.js';
import { TALENTS, isTalentAvailable, talentsFor } from '../src/game/talents.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

check('six large nodes, costs 1..6, not talent ids', () => {
  if (COMBO_NODES.length !== 6) return `expected 6, got ${COMBO_NODES.length}`;
  if (COMBO_TOTAL_COST !== 21) return `total cost ${COMBO_TOTAL_COST}, expected 21`;
  for (let i = 0; i < COMBO_NODES.length; i++) {
    const n = COMBO_NODES[i];
    if (n.cost !== i + 1) return `${n.id} cost ${n.cost}, expected ${i + 1}`;
    if (String(n.id).startsWith('t_')) return `${n.id} looks like a talent`;
    if (TALENTS.some(t => t.id === n.id)) return `${n.id} collided with a talent`;
  }
  return null;
});

check('TALENTS is still 45', () => {
  if (TALENTS.length !== 45) return `talents became ${TALENTS.length}`;
  return null;
});

check('supply covers the school and each source pays once', () => {
  if (COMBO_POINT_SUPPLY < COMBO_TOTAL_COST) {
    return `supply ${COMBO_POINT_SUPPLY} < cost ${COMBO_TOTAL_COST}`;
  }
  const ids = new Set();
  for (const s of COMBO_POINT_SOURCES) {
    if (ids.has(s.id)) return `duplicate source ${s.id}`;
    ids.add(s.id);
    if (!s.amount || !s.where || typeof s.check !== 'function') {
      return `${s.id} is missing amount, where, or check`;
    }
  }
  const empty = applyComboPointSources({});
  if (empty.newly.length) return 'a blank save paid Combo Points';
  const pond = applyComboPointSources({ mapProgress: { pond_3: true } });
  if (pond.newly.length !== 1 || pond.save.comboPoints !== 1) {
    return 'clearing The Overflow did not pay exactly one Combo Point';
  }
  const twice = applyComboPointSources(pond.save);
  if (twice.newly.length) return 'The Overflow paid a second time';
  return null;
});

check('you buy in order, and the node does not gate talents', () => {
  const fresh = { comboPoints: 10, comboForms: {}, talent: {} };
  const tear = COMBO_NODES[0];
  const hook = COMBO_NODES[2];
  if (!isComboAvailable(fresh, tear)) return 'TEAR is locked on a fresh save';
  if (isComboAvailable(fresh, hook)) return 'HOOK is open before TEAR';
  if (!canBuyCombo(fresh, tear)) return 'cannot buy TEAR with 10 CP';
  const after = buyComboNode(fresh, tear.id);
  if (!comboFormOwned(after, 'L')) return 'buying TEAR did not unlock the form';
  if (after.comboPoints !== 9) return `spent wrong, left ${after.comboPoints}`;
  const second = talentsFor('finishers')[1];
  if (isTalentAvailable(after, second)) return 'owning TEAR opened talent step 2';
  return null;
});

check('L and H never need a form flag; Hook does', () => {
  const flags = buildComboFormFlags({ comboForms: { LH: true } });
  if (flags.formL || flags.formH) return 'L/H leaked into the flag bag — melee would brick';
  if (!flags.formLH) return 'owned HOOK did not set formLH';
  return null;
});

check('GameScreen merges combo form flags into the one bag', () => {
  const screen = fs.readFileSync(path.join(ROOT, 'components', 'GameScreen.jsx'), 'utf8');
  if (!/buildComboFormFlags/.test(screen)) return 'GameScreen never calls buildComboFormFlags';
  if (!/\.\.\.buildComboFormFlags\(save\)/.test(screen)) {
    return 'buildComboFormFlags is imported but not spread into result.flags';
  }
  return null;
});

check('THE DRAIN first pipe is a source, and TalentTree inspects combo nodes', () => {
  if (!COMBO_POINT_SOURCES.some(s => s.id === 'drain_map1')) return 'Drain first pipe is missing';
  const jsx = fs.readFileSync(path.join(ROOT, 'components', 'TalentTree.jsx'), 'utf8');
  if (!/inspectCombo/.test(jsx)) return 'combo nodes still instant-buy';
  if (!/combo-detail/.test(jsx)) return 'combo sheet is missing';
  const drain = fs.readFileSync(path.join(ROOT, 'components', 'DrainScreen.jsx'), 'utf8');
  if (!/drainBestDepth/.test(drain)) return 'Drain never records first-pipe depth';
  return null;
});

console.log(`comboSchool.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
