/* Every talent must actually DO something.
 *
 * The failure this exists to prevent has already happened in this project:
 * sixteen level-up cards shipped declaring flags that nothing consumed. They
 * appeared in the UI, cost a pick, and did nothing at all. Nobody noticed until
 * a paid code review found it.
 *
 * Forty-five talents is forty-five chances to repeat that. So this walks the
 * talent table, finds each flag in engine.js, and reports LIVE vs PENDING —
 * and fails on any talent that is presented to the player as buyable while
 * being inert.
 *
 * A talent is allowed to be pending. It is NOT allowed to be pending and
 * silently sold.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const engine = fs.readFileSync(path.join(ROOT, 'game', 'engine.js'), 'utf8');
const screen = fs.readFileSync(path.join(ROOT, 'components', 'GameScreen.jsx'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

const T = await import('../src/game/talents.js');

// A flag counts as consumed if the engine reads it as a PROPERTY somewhere.
//
// Comments are stripped first, because engine.js is heavily commented and a
// talent's name appearing in prose must never be able to wave a dead flag
// through — that is exactly how sixteen dead card flags survived review once.
//
// Matching `.flagName` rather than a specific receiver (`f.` / `flags.`) is
// deliberate: the first version required the receiver and reported a genuinely
// wired talent as dead purely because the code read it off
// `(r.stats.flags || {}).comboXp`. A guard that lies in the safe direction is
// still a guard that lies, and this one is read as a work list.
const engineCode = engine
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
const isLive = (flag) => new RegExp(`\\.${flag}\\b`).test(engineCode);

const live = T.TALENTS.filter(t => isLive(t.flag));
const pending = T.TALENTS.filter(t => !isLive(t.flag));

check('three branches of fifteen steps, as specified', () => {
  if (T.TALENT_BRANCHES.length !== 3) return `expected 3 branches, got ${T.TALENT_BRANCHES.length}`;
  for (const b of T.TALENT_BRANCHES) {
    const n = T.talentsFor(b.id).length;
    if (n !== 15) return `branch ${b.id} has ${n} steps, expected 15`;
  }
  if (T.TALENTS.length !== 45) return `expected 45 talents, got ${T.TALENTS.length}`;
  return null;
});

check('every talent has a unique id and a unique flag', () => {
  const ids = new Set(), flags = new Set(), bad = [];
  for (const t of T.TALENTS) {
    if (ids.has(t.id)) bad.push(`duplicate id ${t.id}`);
    if (flags.has(t.flag)) bad.push(`duplicate flag ${t.flag}`);
    ids.add(t.id); flags.add(t.flag);
  }
  return bad.length ? bad.join('; ') : null;
});

check('no talent is a bare stat percentage', () => {
  // The whole point of the rewrite. Timmy: "inte nå 0.02 % gold gain haha".
  const bad = T.TALENTS.filter(t => t.stat !== undefined);
  return bad.length ? `${bad.length} talent(s) still carry a raw .stat: ${bad.map(t => t.id).join(', ')}` : null;
});

check('talent flags reach the engine at all', () => {
  if (!/buildTalentFlags/.test(screen)) {
    return 'GameScreen never calls buildTalentFlags, so NO talent can ever apply';
  }
  if (!/flags:\s*\{\s*\.\.\.buildTalentFlags\(save\)/.test(screen)) {
    return 'buildTalentFlags is imported but not merged into result.flags';
  }
  return null;
});

check('the combo readout is published AND read', () => {
  // Publishing a value nothing consumes is this project's signature bug, and I
  // made it here on purpose-by-accident: `comboDanger` and `multDrop` were
  // added to snapshot() a full step before the HUD read them. This closes it.
  const hud = fs.readFileSync(path.join(ROOT, 'components', 'Hud.jsx'), 'utf8');
  const missing = [];
  for (const k of ['comboDanger', 'multDrop']) {
    // The `\b` is load-bearing. Without it `snap.multDrop` matched
    // `snap.multDropX` as a substring, so a fault-injection run came back
    // green and the guard proved nothing. Word boundaries, every time.
    if (!new RegExp(`\\b${k}\\b:`).test(engine)) missing.push(`${k} is not in snapshot()`);
    if (!new RegExp(`snap\\.${k}\\b`).test(hud)) missing.push(`${k} is published but the HUD never reads it`);
  }
  // The escalating size table only works if nothing !important overrides it.
  const overhaul = fs.readFileSync(path.join(ROOT, 'overhaul.css'), 'utf8');
  if (/\.combo-count\s*\{[^}]*font-size[^}]*!important/.test(overhaul)) {
    missing.push('.combo-count has an !important font-size, which beats the inline per-tier size');
  }
  return missing.length ? missing.join('; ') : null;
});

check('the steps climb — each one requires the one below it', () => {
  const save = { talent: {} };
  const first = T.talentsFor('finishers')[0];
  const second = T.talentsFor('finishers')[1];
  if (!T.isTalentAvailable(save, first)) return 'step 1 is not available on a fresh save';
  if (T.isTalentAvailable(save, second)) return 'step 2 is available without step 1';
  save.talent[first.id] = true;
  if (!T.isTalentAvailable(save, second)) return 'step 2 stayed locked after buying step 1';
  return null;
});

check('buildTalentFlags returns only what is owned', () => {
  const t1 = T.talentsFor('combos')[0];
  const empty = T.buildTalentFlags({ talent: {} });
  if (Object.keys(empty).length) return 'a fresh save produced flags';
  const one = T.buildTalentFlags({ talent: { [t1.id]: true } });
  if (one[t1.flag] === undefined) return `owning ${t1.id} did not set ${t1.flag}`;
  if (Object.keys(one).length !== 1) return 'owning one talent set more than one flag';
  return null;
});

check('the point economy is in the range the campaign can pay', () => {
  // 21 campaign nodes, and Timmy's target is 1 talent point per map. A branch
  // should be a season's work, not a weekend and not a year.
  const MAPS = 21;
  const perBranch = T.talentsFor('finishers').reduce((a, t) => a + t.cost, 0);
  const runs = perBranch / MAPS;
  if (runs < 4) return `one branch costs only ${runs.toFixed(1)} campaign runs — too cheap to be a chase`;
  if (runs > 20) return `one branch costs ${runs.toFixed(1)} campaign runs — nobody will finish it`;
  return null;
});

check('no talent is sold to the player while inert', () => {
  // The load-bearing one. A pending talent must be marked, so the panel can
  // grey it out and the player is never charged for nothing.
  const sold = pending.filter(t => !t.pending);
  if (!sold.length) return null;
  return `${sold.length} talent(s) have no engine consumer and are not marked `
    + `\`pending: true\`:\n      ` + sold.map(t => `${t.branch}/${t.step} ${t.id} (${t.flag})`).join('\n      ');
});

check('the talent panel shows all 45 by name, and pending is not also locked', () => {
  const jsx = fs.readFileSync(path.join(ROOT, 'components', 'TalentTree.jsx'), 'utf8');
  if (!/\{t\.name\}/.test(jsx)) return 'tiles dropped names — the ladder looks empty';
  if (!/TALENTS\.length/.test(jsx)) return 'the count is not TALENTS.length';
  if (!/!t\.pending \? 'is-locked'/.test(jsx)) {
    return 'pending talents must not also take is-locked (that pair erased the Effects column)';
  }
  return null;
});

check('combo school is taught, not sold as a 46th talent, and ceremonies are real talents', () => {
  const jsx = fs.readFileSync(path.join(ROOT, 'components', 'TalentTree.jsx'), 'utf8');
  if (/TALENTS\.length !== 45/.test(jsx)) return 'panel started counting a 46th';
  if (!/rib-form-detail/.test(jsx)) return 'rib forms cannot be inspected';
  if (!/combo-node-/.test(jsx)) return 'large combo nodes never landed in the tree';
  for (const id of Object.keys(T.TALENT_CEREMONIES || {})) {
    if (!T.TALENT_INDEX[id]) return `ceremony ${id} is not a talent`;
  }
  if (!T.TALENT_CEREMONIES || Object.keys(T.TALENT_CEREMONIES).length < 4) {
    return 'TALENT_CEREMONIES is missing';
  }
  return null;
});

console.log(`\n  LIVE:    ${live.length}/45`);
for (const b of T.TALENT_BRANCHES) {
  const l = T.talentsFor(b.id).filter(t => isLive(t.flag)).length;
  console.log(`    ${b.name.padEnd(10)} ${l}/15  ${'#'.repeat(l).padEnd(15, '.')}`);
}
if (pending.length) {
  console.log(`  PENDING: ${pending.length} — designed, not yet wired:`);
  for (const b of T.TALENT_BRANCHES) {
    const ids = T.talentsFor(b.id).filter(t => !isLive(t.flag)).map(t => t.flag);
    if (ids.length) console.log(`    ${b.name.padEnd(10)} ${ids.join(', ')}`);
  }
}

console.log(`\ntalents.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
