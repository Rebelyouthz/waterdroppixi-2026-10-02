/* Skill-tree MOVE banners: only real verbs, never chance passives.
 *
 * `active:true` on a node is mixed (Shadow Dash is a verb, Decapitation is
 * an 8% execute). A banner that fired on every active node would lie.
 * SKILL_MOVES is the explicit list Camp's UNLOCKED plate reads.
 */
import assert from 'node:assert/strict';
import { SKILL_MOVES, skillMoveOf, unlockBannerFrom } from '../src/game/skillMoves.js';
import { POE_INDEX, POE_H2O_INDEX, DASH_NODE_ID, DASH_PATH } from '../src/game/poe_tree.js';

const t = (name, fn) => {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n    ' + e.message); process.exitCode = 1; }
};

const lookup = (id) => POE_INDEX[id] || POE_H2O_INDEX[id];

t('Shadow Dash is a move and the dash path still costs 5 SP of nodes', () => {
  const dash = skillMoveOf(DASH_NODE_ID);
  assert.ok(dash, 'poe_mob3 missing from SKILL_MOVES');
  assert.equal(dash.name, 'Shadow Dash');
  assert.equal(dash.type, 'move');
  assert.ok(/SHIFT/.test(dash.how) && /stick/.test(dash.how), 'how-to must name SHIFT and the stick');
  assert.deepEqual(DASH_PATH, ['poe_mob0', 'poe_mob1', 'poe_mob3']);
});

t('chance passives are not moves', () => {
  for (const id of ['poe_com6', 'poe_com7', 'poe_grd6', 'poe_arc7', 'poe_mob0', 'poe_mob1']) {
    assert.equal(skillMoveOf(id), null, `${id} must not fire a move banner`);
  }
});

t('every SKILL_MOVES id exists on the tree and has English how/sub', () => {
  for (const [id, row] of Object.entries(SKILL_MOVES)) {
    assert.ok(lookup(id), `${id} is not a tree node`);
    assert.ok(row.name && row.icon && row.how && row.sub, `${id} is missing name/icon/how/sub`);
    assert.ok(!/[åäöÅÄÖ]/.test(`${row.name}${row.how}${row.sub}`), `${id} is not English`);
  }
});

t('unlockBannerFrom keeps tab strings as tabs and moves as moves', () => {
  const tab = unlockBannerFrom('skills');
  assert.equal(tab.type, 'tab');
  assert.equal(tab.id, 'skills');
  const move = unlockBannerFrom({ id: DASH_NODE_ID, type: 'move' });
  assert.equal(move.type, 'move');
  assert.equal(move.name, 'Shadow Dash');
});

if (process.exitCode) {
  console.error('skillMoves.test FAIL');
  process.exit(1);
}
console.log('skillMoves.test ok  4 checks');
