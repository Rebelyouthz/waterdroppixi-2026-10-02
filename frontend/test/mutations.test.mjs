/* Mutations are THE DRAIN's unique payout into the survivor run.
 *
 * Same rule as talents.test.mjs: a flag nothing reads is worse than no
 * mutation. Equipped id is save.mutationLoadout; flags merge into the same
 * run.stats.flags bag GameScreen already builds for talents.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUTATIONS, unlockMutation, buildMutationFlags } from '../src/game/mutations.js';
import { applyDrainPayout, drainClearReward } from '../src/game/drain.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const engine = strip(fs.readFileSync(path.join(ROOT, 'game', 'engine.js'), 'utf8'));
const screen = fs.readFileSync(path.join(ROOT, 'components', 'GameScreen.jsx'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

check('GameScreen merges mutation flags into the talent flag bag', () => {
  if (!/buildMutationFlags/.test(screen)) return 'GameScreen never calls buildMutationFlags';
  if (!/\.\.\.buildMutationFlags\(save\)/.test(screen)) {
    return 'buildMutationFlags is imported but not spread into result.flags';
  }
  return null;
});

check('every mutation flag is read as a property in the engine', () => {
  const dead = MUTATIONS.filter(m => !new RegExp(`\\.${m.flag}\\b`).test(engine));
  return dead.length
    ? `engine never reads: ${dead.map(m => `${m.id} -> .${m.flag}`).join(', ')}`
    : null;
});

check('unlocking marrow equips it and a second clear does not duplicate', () => {
  const a = unlockMutation({ mutationsUnlocked: [] }, 'mut_marrow');
  if (!(a.mutationsUnlocked || []).includes('mut_marrow')) return 'first unlock missing';
  if (a.mutationLoadout !== 'mut_marrow') return 'first unlock did not equip';
  const b = unlockMutation(a, 'mut_marrow');
  if (b.mutationsUnlocked.length !== 1) return 'second unlock duplicated the id';
  const flags = buildMutationFlags(b);
  if (!flags.mutMarrow) return 'equipped marrow did not produce mutMarrow';
  if (buildMutationFlags({ mutationLoadout: 'mut_marrow', mutationsUnlocked: [] }).mutMarrow) {
    return 'uneared loadout still applied';
  }
  return null;
});

check('a drain clear pays gold/SP/TP and unlocks marrow', () => {
  const save = { gold: 0, sp: 0, talentPoints: 0, mutationsUnlocked: [] };
  const next = applyDrainPayout(save, { depth: 3 });
  const r = drainClearReward(3);
  if (next.gold !== r.gold) return `gold ${next.gold} != ${r.gold}`;
  if (next.sp !== r.sp) return `sp ${next.sp} != ${r.sp}`;
  if (next.talentPoints !== r.talentPoints) return `tp ${next.talentPoints} != ${r.talentPoints}`;
  if (!(next.mutationsUnlocked || []).includes('mut_marrow')) return 'marrow not unlocked on clear';
  if (next.drainRuns !== 1) return 'drainRuns not counted';
  return null;
});

check('a second drain clear unlocks Coolant Film without swapping loadout', () => {
  const first = applyDrainPayout({ gold: 0, sp: 0, talentPoints: 0, mutationsUnlocked: [] }, { depth: 3 });
  const second = applyDrainPayout(first, { depth: 3 });
  if (!(second.mutationsUnlocked || []).includes('mut_film')) return 'film not unlocked on second clear';
  if (second.mutationsUnlocked.filter((id) => id === 'mut_marrow').length !== 1) return 'marrow duplicated';
  if (second.drainRuns !== 2) return 'drainRuns not 2';
  if (second.mutationLoadout !== 'mut_marrow') return 'second clear swapped the equipped mutation';
  if (!buildMutationFlags(second).mutMarrow) return 'equipped marrow lost its flag';
  return null;
});

console.log(`\nmutations.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
