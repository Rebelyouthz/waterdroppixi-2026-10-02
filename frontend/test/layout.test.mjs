/* Layout regression guards.
 *
 * These catch a specific class of bug that is invisible in code review and only
 * shows up on a narrow phone: a CSS Grid track whose `auto` minimum is pinned by
 * a wide, non-shrinkable child, pushing a whole panel off the side of the screen.
 *
 * The meta upgrade board did exactly that. `grid-template-columns: 1fr` is
 * shorthand for `minmax(auto, 1fr)`, and that `auto` floor is the item's
 * min-content width -- a track can never render narrower than it. Two meta
 * upgrades have max: 20, and `.pips` renders one 14px pip per level in a flex
 * row that does not wrap, so the card's min-content was ~377px against a ~327px
 * column on a 393px-wide iPhone. The board hung off the right edge.
 *
 * We cannot run a layout engine here, so instead we assert the two invariants
 * that made the overflow possible, straight from the real source files.
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
    else pass++;
  } catch (e) {
    fails.push(`${name}\n    threw: ${e.message}`);
  }
}

const index = read('index.css');
const overhaul = read('overhaul.css');
const css = index + '\n' + overhaul;

/* Pull every `grid-template-columns` declaration that applies to .upgrade-grid,
   across both sheets and inside media queries. */
function gridTrackDecls(sheet) {
  const out = [];
  const re = /\.upgrade-grid\s*(?:,[^{]*)?\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(sheet))) {
    const decl = /grid-template-columns\s*:([^;}]*)/.exec(m[1]);
    if (decl) out.push(decl[1].trim());
  }
  return out;
}

check('upgrade-grid declares at least one track definition', () => {
  const d = [...gridTrackDecls(index), ...gridTrackDecls(overhaul)];
  return d.length ? null : 'found no grid-template-columns for .upgrade-grid';
});

/* Remove every `minmax(...)` group, matching parentheses properly. A regex
   cannot do this: `minmax(min(220px, 100%), 1fr)` nests, and /minmax\([^)]*\)/
   stops at the FIRST ')' -- leaving a stray "1fr" behind and reporting a
   perfectly good track as broken. An `fr` inside a minmax is the track's
   maximum and is always fine; only the floor can pin a track open. */
function stripMinmax(decl) {
  let out = '';
  for (let i = 0; i < decl.length; i++) {
    if (decl.startsWith('minmax(', i)) {
      let depth = 0;
      let j = i + 'minmax'.length;
      for (; j < decl.length; j++) {
        if (decl[j] === '(') depth++;
        else if (decl[j] === ')' && --depth === 0) break;
      }
      out += 'MINMAX';
      i = j;
      continue;
    }
    out += decl[i];
  }
  return out;
}

check('no upgrade-grid track uses a bare 1fr (min-content floor)', () => {
  const bad = [];
  for (const [file, sheet] of [['index.css', index], ['overhaul.css', overhaul]]) {
    for (const d of gridTrackDecls(sheet)) {
      /* NB: not /\bfr\b/ -- in "1fr" the digit and the f are both word chars,
         so there is no word boundary between them and that pattern never
         matches. Anchor on the number instead. */
      if (/[\d.]\s*fr\b/.test(stripMinmax(d))) bad.push(`${file}: "${d}"`);
    }
  }
  return bad.length
    ? `bare fr track floors at min-content, use minmax(0, 1fr):\n    ${bad.join('\n    ')}`
    : null;
});

check('pips can flex below their 14px ideal width', () => {
  const m = /\.upgrade-card\s+\.pip\s*\{([^}]*)\}/.exec(overhaul);
  if (!m) return '.upgrade-card .pip has no shrink rule in overhaul.css';
  const body = m[1];
  if (!/flex\s*:/.test(body)) return 'pip does not set flex, so it cannot shrink';
  if (!/min-width\s*:/.test(body)) return 'pip does not set min-width';
  const shrink = /flex\s*:\s*\d+\s+(\d+)/.exec(body);
  if (shrink && shrink[1] === '0') return 'pip has flex-shrink: 0, it will overflow the card';
  return null;
});

/* The real arithmetic, recomputed from the data rather than hard-coded, so this
   starts failing the moment someone adds a meta upgrade with a bigger pip max. */
check('worst-case pip row fits a 393px phone column', () => {
  const data = read('game/data.js');
  const i = data.indexOf('META_UPGRADES');
  if (i < 0) return 'could not find META_UPGRADES in data.js';
  const seg = data.slice(i, i + 12000);
  const maxes = [...seg.matchAll(/max:\s*(\d+)/g)].map((m) => +m[1]);
  if (!maxes.length) return 'parsed no max: values';

  /* Camp.jsx renders pips only when max <= 20; above that it draws a bar. */
  const pipCounts = maxes.filter((v) => v <= 20);
  const n = Math.max(...pipCounts);

  const pm = /\.upgrade-card\s+\.pip\s*\{([^}]*)\}/.exec(overhaul);
  const minW = pm ? Number((/min-width\s*:\s*(\d+)px/.exec(pm[1]) || [])[1]) : NaN;
  if (!Number.isFinite(minW)) return 'could not read pip min-width from overhaul.css';

  const gap = 3; // .upgrade-card .pips { gap: 3px }
  const rowMin = n * minW + (n - 1) * gap;

  /* 393px viewport, minus the camp-main gutters and card padding measured off
     the device screenshot. Deliberately conservative. */
  const available = 307;
  return rowMin <= available
    ? null
    : `${n} pips need ${rowMin}px minimum but only ~${available}px is available`;
});

console.log(`\nlayout.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error(`  FAIL ${f}`);
  process.exit(1);
}
