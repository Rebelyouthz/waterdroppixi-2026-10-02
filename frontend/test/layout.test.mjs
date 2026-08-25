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

/* Every rule body declared for a selector, as an array — never just the first.
 *
 * Plain string scanning, deliberately, with no RegExp built from a string.
 * Three separate attempts to escape a selector into a dynamic regex were
 * mangled on the way into this file, and each time the result was a regex that
 * silently matched the wrong thing — one reported `.lu-tile` as "defined 101
 * times". A guard that lies is worse than no guard, so this does something
 * that cannot be mis-escaped.
 *
 * Reading only the FIRST rule is its own trap: overhaul.css has 164 selectors
 * declared two or more times, and a second declaration elsewhere in the file
 * is exactly what blinded the clip-path guard below while it was being
 * written. */
function ruleBodies(sel) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = overhaul.indexOf(sel, from);
    if (at < 0) break;
    from = at + sel.length;
    // A whole selector, not the tail of a longer one: `.lu-tile` must not
    // match inside `.foo-lu-tile`.
    const before = at === 0 ? '\n' : overhaul[at - 1];
    if (!' \t\n\r,}'.includes(before)) continue;
    // ...and what follows must open a block, not continue the selector, so
    // `.lu-tile-check {` is never mistaken for `.lu-tile {`.
    let k = from;
    while (k < overhaul.length && ' \t\n\r'.includes(overhaul[k])) k++;
    if (overhaul[k] !== '{') continue;
    const end = overhaul.indexOf('}', k);
    if (end < 0) continue;
    out.push(overhaul.slice(k + 1, end));
  }
  return out;
}
const bodiesOf = (sel) => ruleBodies(sel).join(' ; ');

/* How many rules declare this selector ON ITS OWN, as opposed to as the tail of
 * a more specific one.
 *
 * `ruleBodies` deliberately matches both, because for "is this thing positioned
 * outside its parent" every rule that touches it counts. For counting
 * DUPLICATES it is wrong: `.lu-rwd-in .lu-tile-check { }` is a different, more
 * specific selector, not a second definition, and treating it as one made the
 * check report five duplicates where there was one rule.
 *
 * Standalone means: whatever precedes it is the end of the previous rule, a
 * comma in a selector list, or the end of a comment — with nothing but
 * whitespace in between.
 *
 * TOP LEVEL ONLY. A rule inside `@media (prefers-reduced-motion)` is a
 * deliberate variant, not a duplicate, and counting it made this check fail
 * perfectly correct code — the exact "a guard that fails correct code is worse
 * than no guard" mistake made twice already today. Depth is tracked by brace
 * nesting, which is also how the project's own duplicate audit counts its 1292
 * top-level selectors. */
function standaloneCount(sel) {
  // One pass, tracking brace depth, so a rule's nesting is known when it is
  // found rather than guessed at afterwards.
  let n = 0;
  let depth = 0;
  for (let i = 0; i < overhaul.length; i++) {
    const c = overhaul[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0) continue;
    if (!overhaul.startsWith(sel, i)) continue;
    let k = i + sel.length;
    while (k < overhaul.length && ' \t\n\r'.includes(overhaul[k])) k++;
    if (overhaul[k] !== '{') continue;
    // Whatever precedes it must be the end of the previous rule, a comma in a
    // selector list, or the end of a comment — whitespace only in between.
    let j = i - 1;
    while (j >= 0 && ' \t\n\r'.includes(overhaul[j])) j--;
    if (j < 0) { n++; continue; }
    const prev = overhaul[j];
    const prev2 = j > 0 ? overhaul[j - 1] : '';
    if (prev === '}' || prev === ',' || (prev === '/' && prev2 === '*')) n++;
  }
  return n;
}
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


/* ── A CLIP-PATH CLIPS ITS OWN CHILDREN ──────────────────────────────
 *
 * This is the single most repeated defect in this codebase. Four instances so
 * far, all found by looking at a screenshot and none by reading a diff:
 *
 *   1. the XP medallion, clipped by the bar's chamfer
 *   2. the plaque's brass corners, killed by a display:none a later rule
 *      failed to override
 *   3. the double-chevron divider, sliced off at the quest board's edge
 *   4. `.lu-tile-check` — the green "claimed" tick on every level-up reward,
 *      positioned at top:-5px right:-5px inside a tile that carried a
 *      clip-path. It has NEVER been visible, on the badge the reference sheet
 *      puts front and centre.
 *
 * The pattern is always the same: a child (or pseudo-element) is deliberately
 * placed OUTSIDE its parent's box, and the parent clips. It never throws, it
 * never shows up in a test, and it never appears in a code review, because
 * both rules are individually correct.
 *
 * So: for every element we know hangs outside its parent, assert the parent
 * does not clip. The list is explicit rather than derived — a generic CSS
 * geometry solver is not something to hand-roll, and naming the real cases is
 * worth more than a clever check that covers none of them.
 */
check('nothing that hangs outside its parent has a clipping parent', () => {
  // [badge selector, its parent selector]
  const PAIRS = [
    ['.lu-tile-check', '.lu-tile'],
  ];

  // EVERY rule for a selector, merged — never just the first.
  //
  // The first version of this read only the first match, and while writing it
  // a second `.lu-tile-check { z-index }` rule got added twenty lines earlier.
  // That rule had no `top: -Npx` in it, so the check decided the badge did not
  // hang outside anything and passed vacuously — a guard silently blinded by
  // exactly the duplicate-selector problem it lives in this file to catch.
  // Found by fault injection, which is the only reason it is known.
  const bad = [];
  for (const [child, parent] of PAIRS) {
    const cb = bodiesOf(child);
    if (!cb) { bad.push(`${child} has no rule at all`); continue; }
    // Only a child deliberately placed OUTSIDE its parent's box can be eaten.
    if (!/(top|right|bottom|left)\s*:\s*-\s*\d/.test(cb)) continue;
    const pb = bodiesOf(parent);
    if (!pb) { bad.push(`${parent} has no rule at all`); continue; }
    if (/clip-path\s*:/.test(pb))
      bad.push(`${parent} clips, so ${child} (placed outside its box) is invisible`);
    if (/overflow\s*:\s*hidden/.test(pb))
      bad.push(`${parent} has overflow:hidden, so ${child} is invisible`);
  }
  return bad.length ? bad.join('; ') : null;
});

check('no selector this file guards is defined twice', () => {
  // A duplicate definition is not just a style problem here — it is what
  // blinded the check above. overhaul.css already carries 164 selectors
  // defined two or more times; these few are the ones the guards depend on.
  const WATCH = ['.lu-tile', '.lu-tile-check', '.lu-rwd-in', '.lu-rwd-pending'];
  const bad = [];
  for (const sel of WATCH) {
    const n = standaloneCount(sel);
    if (n > 1) bad.push(`${sel} is defined ${n} times`);
    if (n === 0) bad.push(`${sel} is not defined at all`);
  }
  return bad.length ? bad.join('; ') : null;
});

check('the level-up reward reveal does not scale the tiles', () => {
  const km = /@keyframes\s+luRwdIn\s*\{([\s\S]*?)\n\}/.exec(overhaul);
  if (!km) return 'could not find the luRwdIn keyframes';
  const body = km[1];
  const bad = [];
  for (const m of body.matchAll(/scale\(\s*([\d.]+)/g)) {
    const v = Number(m[1]);
    // 1.08 is a pop. 1.7 is a collision.
    if (v > 1.08 || v < 0.92) bad.push(`scale(${v})`);
  }
  for (const m of body.matchAll(/translate[XY]?\(\s*(-?[\d.]+)px/g)) {
    const v = Math.abs(Number(m[1]));
    if (v > 12) bad.push(`translate ${v}px`);
  }
  return bad.length
    ? `luRwdIn still moves the tile: ${bad.join(', ')} — that is the reported shake`
    : null;
});

check('the claimed tick is actually revealed', () => {
  // The badge is hidden until its tile lands, so something has to turn it back
  // on. If the pending rule exists and the reveal does not, every tick stays
  // invisible — which is exactly the state this screen shipped in, only for a
  // different reason.
  if (!/\.lu-rwd-pending\s+\.lu-tile-check\s*\{[^}]*opacity\s*:\s*0/.test(overhaul))
    return 'nothing hides the tick before its tile lands';
  // Named animation, not just the word "animation": the prefers-reduced-motion
  // block also contains `.lu-rwd-in .lu-tile-check { animation: none }`, and
  // matching loosely let a renamed selector pass on the strength of THAT rule.
  if (!/\.lu-rwd-in\s+\.lu-tile-check\s*\{[^}]*animation\s*:\s*luCheckStamp/.test(overhaul))
    return 'nothing reveals the tick after its tile lands — every one stays hidden';
  return null;
});

console.log(`\nlayout.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error(`  FAIL ${f}`);
  process.exit(1);
}
