// Level-up card presentation checks.
//
// statCompare lives on the engine class, which can't be instantiated outside a
// browser (Pixi, canvas, RAF). So this re-implements the two pure functions
// verbatim from engine.js and runs them against the REAL STAT_CARDS table —
// which is what actually catches the bugs, since every failure found here was
// a data/formula interaction, not a wiring one.

import { readFileSync } from 'node:fs';
import { STAT_CARDS, RARITY } from '../src/game/data.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : '')); }
};

// Parsed out of engine.js rather than copied. A duplicated table has to be
// maintained twice and drifts silently — which it promptly did the moment two
// new stats were added. Reading the real source means this test can only ever
// fail for a real reason.
const STAT_LABELS = (() => {
  const src = readFileSync(new URL('../src/game/engine.js', import.meta.url), 'utf8');
  const i = src.indexOf('const STAT_LABELS = {');
  if (i < 0) throw new Error('STAT_LABELS not found in engine.js');
  const seg = src.slice(i, src.indexOf('\n};', i));
  const out = {};
  for (const m of seg.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*):\s*'([^']*)'/g)) out[m[1]] = m[2];
  return out;
})();

// --- verbatim from engine.js statCompare ---
function statCompare(stats, s, amount) {
  if (!s || !s.stat || s.stat === 'heal') return null;
  const from = s.mult ? (stats[s.stat] ?? 1) : (stats[s.stat] ?? 0);
  const to = from + amount;
  const pct = s.mult || s.stat === 'crit' || s.stat === 'dodge';
  const fmt = pct
    ? (v) => Math.round(v * 100) + '%'
    : (v) => (Math.round(v * 100) / 100).toString();
  const lowerIsBetter = s.stat === 'reloadMult' || s.stat === 'skillCdMult';
  const up = lowerIsBetter ? amount <= 0 : amount >= 0;
  return { label: STAT_LABELS[s.stat] || s.stat, from: fmt(from), to: fmt(to), up };
}
// --- verbatim from engine.js buildLevelUpChoices, stat branch ---
function cardDesc(s, mult) {
  const amt = Math.abs(s.amount * mult);
  return s.desc.replace('{v}', s.mult ? Math.round(amt * 100).toString() : (Math.round(amt * 100) / 100).toString());
}

console.log('\n=== card descriptions ===');
{
  let doubled = [];
  let empty = [];
  for (const s of STAT_CARDS) {
    for (const rar of Object.keys(RARITY)) {
      const d = cardDesc(s, RARITY[rar].mult);
      if (/[+-]\s*[+-]/.test(d)) doubled.push(`${s.id}@${rar}: "${d}"`);
      if (d.includes('{v}') || /(^|\s)0%/.test(d)) empty.push(`${s.id}@${rar}: "${d}"`);
    }
  }
  ok('no card renders a doubled sign (the old "--8% reload time")', doubled.length === 0, doubled.slice(0, 4).join('\n       '));
  ok('no card renders a zero or unsubstituted value', empty.length === 0, empty.slice(0, 4).join('\n       '));
}

console.log('\n=== before → after ===');
{
  // A fresh run: multiplier stats sit at 1, flat stats unset.
  const fresh = {};
  const dmg = STAT_CARDS.find(s => s.id === 'dmg');
  const c = statCompare(fresh, dmg, dmg.amount * RARITY.common.mult);
  ok('a multiplier stat reads from its 1.0 base, not 0', c.from === '100%', JSON.stringify(c));
  ok('the after value includes the pick', c.to === '105%', JSON.stringify(c));

  // The same card deep into a run, where +5% is a much smaller deal — the
  // whole reason this row exists.
  const late = statCompare({ damageMult: 3.2 }, dmg, dmg.amount * RARITY.common.mult);
  ok('the row reflects the live sheet, not a fixed baseline', late.from === '320%' && late.to === '325%', JSON.stringify(late));

  const hp = STAT_CARDS.find(s => s.id === 'maxhp');
  const h = statCompare({ maxHp: 70 }, hp, hp.amount * RARITY.common.mult);
  ok('a flat stat renders as a plain number, not a percentage', h.from === '70' && !h.to.includes('%'), JSON.stringify(h));

  const heal = STAT_CARDS.find(s => s.id === 'heal');
  ok('a heal has no before/after row (it is an event, not a sheet value)', statCompare({}, heal, 5) === null);

  const crit = STAT_CARDS.find(s => s.id === 'crit');
  const cr = statCompare({ crit: 0.15 }, crit, crit.amount);
  ok('crit is flat but still renders as a percentage', cr.from === '15%' && cr.to === '18%', JSON.stringify(cr));
}

console.log('\n=== buff direction ===');
{
  const downIsGood = ['reload', 'skillcd'];
  const wrong = [];
  for (const s of STAT_CARDS) {
    if (s.stat === 'heal') continue;
    const c = statCompare({}, s, s.amount);
    if (!c.up) wrong.push(`${s.id} (${s.desc})`);
  }
  ok('every stat card in the game is coloured as a gain', wrong.length === 0, wrong.join(', '));

  for (const id of downIsGood) {
    const s = STAT_CARDS.find(x => x.id === id);
    const c = statCompare({}, s, s.amount);
    ok(`${id}: the number falls but the card still reads as a gain`,
       c.up === true && parseInt(c.to) < parseInt(c.from), JSON.stringify(c));
  }
}

console.log('\n=== labels ===');
{
  const missing = STAT_CARDS.filter(s => s.stat !== 'heal' && !STAT_LABELS[s.stat]).map(s => s.stat);
  ok('every stat card has a human-readable label', missing.length === 0, missing.join(', '));
}

/* The slot-machine shop used to sell PERMANENT stat bonuses (+30 Max HP and
 * so on) under a "passive" label. That was the wrong shape: it made the shop a
 * flat power purchase instead of something that changes what a run can offer.
 * Shop passives now UNLOCK passive level-up cards into the in-run pool.
 *
 * The failure mode this guards is silent and nasty: if a shop entry's
 * `unlockCard` id and the level-up card's `shopId` ever drift apart, the
 * purchase succeeds, the money is gone, and the card still never appears.
 */
console.log('\n=== shop card unlocks ===');
{
  const { SHOP_CARD_POOL } = await import('../src/game/data_ext2.js');
  const d2 = await import('../src/game/data_ext2.js');
  const d1 = await import('../src/game/data.js');

  const cards = [];
  for (const mod of [d1, d2]) {
    for (const v of Object.values(mod)) {
      if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'id' in v[0]) {
        cards.push(...v);
      }
    }
  }

  const gated = cards.filter((c) => c.shop);
  const unlocks = SHOP_CARD_POOL.filter((c) => c.effect && c.effect.unlockCard)
    .map((c) => c.effect.unlockCard);

  ok('the shop sells at least one card unlock', unlocks.length > 0);
  ok('every shop-gated level-up card declares a shopId',
    gated.every((c) => !!c.shopId),
    gated.filter((c) => !c.shopId).map((c) => c.id).join(', '));

  const gatedIds = new Set(gated.map((c) => c.shopId));
  const dangling = unlocks.filter((u) => !gatedIds.has(u));
  ok('every shop unlock maps to a real gated card', dangling.length === 0,
    `unlocks nothing can grant: ${dangling.join(', ')}`);

  const orphans = [...gatedIds].filter((g) => !unlocks.includes(g));
  ok('every gated card can actually be unlocked', orphans.length === 0,
    `cards locked with no shop entry: ${orphans.join(', ')}`);

  const permanent = SHOP_CARD_POOL.filter(
    (c) => c.category === 'passive' && c.effect && !c.effect.unlockCard);
  ok('no permanent-stat passives remain in the shop', permanent.length === 0,
    permanent.map((c) => c.id).join(', '));
}


// ---- THE CANVAS HAS NO OVERFLOW ----------------------------------------
// Timmy has reported this class of bug since the move to Pixi: "de klipper av
// kanterna ... du vet inte om de nar de hander". A Pixi canvas draws nothing
// past width/height, with no error and nothing in the console, so a padding
// trim made to enlarge the cards silently amputates the frame around them.
//
// That happened on 2026-08-23: CARD.TOP/BOTTOM_PAD were cut 208/112 -> 112/40,
// which put the stage plate's bottom edge 6px past the canvas and its cast
// shadow ~56px past. This is the guard.
{
  const { CARD, PLATE_CLEARANCE } = await import('../src/game/cardRenderer.js');

  // Mirrors CardRenderer's own layout arithmetic. If that moves, this has to
  // move with it - which is the point: two places that disagree LOUDLY beat one
  // that fails silently.
  const MARGIN = 46;
  const canvasH = CARD.H + CARD.TOP + CARD.BOTTOM_PAD;
  const above = Math.max(14, (CARD.TOP - 74) - MARGIN);
  const below = canvasH - (CARD.TOP + CARD.H + MARGIN);

  ok('stage plate has clearance ABOVE it inside the canvas',
     above >= PLATE_CLEARANCE,
     'only ' + above + 'px above the plate, needs ' + PLATE_CLEARANCE + ' - the frame is cut off');
  ok('stage plate has clearance BELOW it inside the canvas',
     below >= PLATE_CLEARANCE,
     'only ' + below + 'px below the plate, needs ' + PLATE_CLEARANCE + ' - the frame is cut off');

  const art = readFileSync(new URL('../src/game/cardArt.js', import.meta.url), 'utf8');
  const bw = art.match(/const BW = (\d+);/);
  ok('PLATE_CLEARANCE still covers the plate band overhang',
     !!bw && Number(bw[1]) / 2 <= PLATE_CLEARANCE,
     bw ? 'the band alone hangs ' + (Number(bw[1]) / 2) + 'px past the plate, clearance is ' + PLATE_CLEARANCE
        : 'BW is gone from cardArt.js');
}


console.log(`\n${pass} checks passed${fail ? `, ${fail} FAILED` : ''}.\n`);
process.exit(fail ? 1 : 0);
