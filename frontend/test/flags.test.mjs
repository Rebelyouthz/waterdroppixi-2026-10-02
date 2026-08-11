/* Every card flag must actually be read by the engine.
 *
 * This exists because ten passive cards shipped declaring flags that NOTHING
 * consumed. `c_ricochet` said "shots bounce once to a nearby foe", entered the
 * level-up pool ungated, and did precisely nothing when picked. The wiring
 * looked correct from every angle I checked at the time -- the card existed,
 * the shop ids matched, applyCardChoice set `run.stats.flags[flagId]` -- and
 * the one thing I never checked was whether anything downstream ever read the
 * flag back out. A code review found it, not a test.
 *
 * So: for every `flag:` declared on a card, assert the flag name appears
 * somewhere in the engine. That is a coarse check, but it is exactly the class
 * of failure that slipped through, and it cannot pass by accident.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const engine = fs.readFileSync(path.join(ROOT, 'game', 'engine.js'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

const d1 = await import('../src/game/data.js');
const d2 = await import('../src/game/data_ext2.js');

// Every card object carrying a `flag`, from every exported card array.
const flagCards = [];
for (const mod of [d1, d2]) {
  for (const v of Object.values(mod)) {
    if (!Array.isArray(v)) continue;
    for (const c of v) {
      if (c && typeof c === 'object' && typeof c.flag === 'string') flagCards.push(c);
    }
  }
}

check('there are flag cards to check', () =>
  flagCards.length > 0 ? null : 'found no cards declaring a `flag`');

check('every card flag is read somewhere in the engine', () => {
  const dead = [];
  for (const c of flagCards) {
    // Word-boundary match so `ricochet` does not falsely match on a longer
    // identifier that merely contains it.
    const re = new RegExp(`\\b${c.flag}\\b`);
    if (!re.test(engine)) dead.push(`${c.id} -> flags.${c.flag} ("${c.name}")`);
  }
  return dead.length
    ? `these cards do nothing when picked:\n    ${dead.join('\n    ')}`
    : null;
});

check('no two cards claim the same flag', () => {
  const seen = new Map();
  const dupes = [];
  for (const c of flagCards) {
    if (seen.has(c.flag)) dupes.push(`${c.flag}: ${seen.get(c.flag)} and ${c.id}`);
    else seen.set(c.flag, c.id);
  }
  return dupes.length ? dupes.join('; ') : null;
});

/* The other half of the same failure: a card can be gated behind a shop
   purchase that no shop entry grants, which makes it unreachable rather than
   inert. Both directions are checked in cards.test.mjs; this one guards the
   flag half specifically for shop-gated cards, which are the easiest to
   forget because they never appear in a normal run. */
check('shop-gated flag cards are also implemented', () => {
  const gated = flagCards.filter((c) => c.shop);
  if (!gated.length) return null;
  const dead = gated.filter((c) => !new RegExp(`\\b${c.flag}\\b`).test(engine));
  return dead.length
    ? `bought with slot coins and still inert: ${dead.map((c) => c.id).join(', ')}`
    : null;
});

/* Pool has `free` / `active` / `forEach` and no `items`. Reaching for `.items`
   threw at runtime inside castSkill('lightning') -- after the cooldown had
   already been spent -- and no test caught it because nothing here boots the
   engine. A source scan is cheap and catches the whole family. */
check('nothing iterates a non-existent pool property', () => {
  const bad = [];
  const re = /this\.(enemies|projs|eprojs|parts|pickups)\.items\b/g;
  let m;
  while ((m = re.exec(engine))) {
    const line = engine.slice(0, m.index).split('\n').length;
    bad.push(`engine.js:${line} uses .${m[1]}.items — Pool exposes free/active/forEach`);
  }
  return bad.length ? bad.join('\n    ') : null;
});

check('helpers referenced by the passive effects exist', () => {
  /* Written while implementing the passives: both of these were invented
     before checking, and neither existed. */
  const missing = [];
  if (/nearestEnemyExcluding\(/.test(engine) && !/^\s*nearestEnemyExcluding\(/m.test(engine)) {
    missing.push('nearestEnemyExcluding is called but not defined');
  }
  if (/_wtype/.test(engine) && !/stats\._wtype\s*=/.test(engine)) {
    missing.push('_wtype is read but never assigned');
  }
  return missing.length ? missing.join('; ') : null;
});

console.log(`\nflags.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
