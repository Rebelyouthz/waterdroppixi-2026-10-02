/* Gear economy: per-slot parts, base types, the Mythic+ ceiling, and the
 * rebalanced drop rates. All of this is pure data + pure functions, so it is
 * exactly the sort of thing that should be checked here rather than by
 * squinting at a phone screenshot.
 */
import {
  GEAR_SLOTS, GEAR_BASES, GEAR_BASE_INDEX, GEAR_RARITIES, GEAR_RARITY_MULT,
  GEAR_RARITY_COLORS, GEAR_RARITY_NAMES, generateGearItem, rollGearDrop,
  gearDropHappens, rollPartsDrop, addParts, gearLevelPayment, slotPartsOf,
  PART_SLOTS, PART_NAMES, PART_ICONS, WILDCARD_PART_RATE, GEAR_MAX_LEVEL,
  gearLevelCost, gearStatValue,
  SOCKET_ODDS, GEAR_MAX_SOCKETS, rollSocketCount, gearSocketCount,
} from '../src/game/gear.js';
import { resolveMerge, MERGE_ODDS } from '../src/game/forge.js';
import { applyRunesToStats, gearRunesFor } from '../src/game/runes.js';

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

/* A seeded generator, so any failure below is reproducible rather than a
   once-in-a-thousand-runs mystery. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---- base types -----------------------------------------------------------

check('every slot has exactly 5 base types', () => {
  const wrong = GEAR_SLOTS.filter((s) => (GEAR_BASES[s] || []).length !== 5);
  return wrong.length ? `slots with != 5 bases: ${wrong.join(', ')}` : null;
});

check('base ids and icons are all unique', () => {
  const all = Object.values(GEAR_BASES).flat();
  const ids = all.map((b) => b.id);
  const icons = all.map((b) => b.icon);
  if (new Set(ids).size !== ids.length) return 'duplicate base id';
  if (new Set(icons).size !== icons.length) return 'duplicate base icon';
  if (all.some((b) => !b.icon)) return 'a base type has no icon';
  return null;
});

check('every base weight names a stat its slot can actually roll', () => {
  /* A weight on a stat outside the slot's pool is dead config -- it looks like
     it biases the roll but can never apply. */
  const bad = [];
  for (const slot of GEAR_SLOTS) {
    const sample = new Set();
    const rand = seeded(7);
    for (let i = 0; i < 4000; i++) sample.add(generateGearItem(slot, 'common', rand).stat);
    for (const b of GEAR_BASES[slot] || []) {
      for (const stat of Object.keys(b.weight || {})) {
        if (!sample.has(stat)) bad.push(`${slot}/${b.id} weights "${stat}" which never rolls`);
      }
    }
  }
  return bad.length ? bad.join('\n    ') : null;
});

check('generated items record a base type that resolves', () => {
  const rand = seeded(11);
  for (const slot of GEAR_SLOTS) {
    const it = generateGearItem(slot, 'rare', rand);
    if (!it.base) return `${slot} item has no base`;
    if (!GEAR_BASE_INDEX[it.base]) return `${slot} item base "${it.base}" not in index`;
  }
  return null;
});

// ---- rarity ladder --------------------------------------------------------

check('Mythic+ tops the ladder and is fully described', () => {
  if (GEAR_RARITIES[GEAR_RARITIES.length - 1] !== 'mythicplus') return 'mythicplus is not last';
  for (const r of GEAR_RARITIES) {
    if (!GEAR_RARITY_COLORS[r]) return `no colour for ${r}`;
    if (!GEAR_RARITY_NAMES[r]) return `no display name for ${r}`;
    if (!GEAR_RARITY_MULT[r]) return `no stat multiplier for ${r}`;
  }
  return null;
});

check('rarity multipliers increase monotonically', () => {
  for (let i = 1; i < GEAR_RARITIES.length; i++) {
    const a = GEAR_RARITY_MULT[GEAR_RARITIES[i - 1]];
    const b = GEAR_RARITY_MULT[GEAR_RARITIES[i]];
    if (b <= a) return `${GEAR_RARITIES[i]} (${b}) is not above ${GEAR_RARITIES[i - 1]} (${a})`;
  }
  return null;
});

check('Mythic+ never appears on the drop table', () => {
  /* It is meant to be forge-only. A boss at max run time is the most generous
     roll the game can produce, so if it cannot appear here it cannot drop. */
  for (let i = 0; i < 300000; i++) {
    if (rollGearDrop(99999, true).rarity === 'mythicplus') return 'mythicplus dropped';
  }
  return null;
});

check('the forge reaches Mythic+ and stops there', () => {
  const toMythicPlus = resolveMerge(GEAR_RARITIES, 'mythical', 0, 0);
  if (toMythicPlus.targetRarity !== 'mythicplus') return 'mythical does not merge into mythicplus';
  if (toMythicPlus.atMax) return 'mythical reports atMax';
  const beyond = resolveMerge(GEAR_RARITIES, 'mythicplus', 0, 0);
  if (!beyond.atMax) return 'mythicplus is not the ceiling';
  return null;
});

check('the final merge step is the hardest in the game', () => {
  /* Without an explicit MERGE_ODDS entry the last step fell through to a
     default and was no harder than the step before it. */
  if (MERGE_ODDS.length < GEAR_RARITIES.length) {
    return `MERGE_ODDS has ${MERGE_ODDS.length} entries for ${GEAR_RARITIES.length} rarities`;
  }
  const last = MERGE_ODDS[GEAR_RARITIES.length - 1];
  const prev = MERGE_ODDS[GEAR_RARITIES.length - 2];
  return last < prev ? null : `final odds ${last} are not below the previous ${prev}`;
});

// ---- drop rebalance -------------------------------------------------------

check('a boss always drops equipment', () => {
  const rand = seeded(3);
  for (let i = 0; i < 5000; i++) if (!gearDropHappens(true, rand)) return 'a boss failed to drop';
  return null;
});

check('ordinary kills drop equipment rarely', () => {
  const rand = seeded(5);
  let n = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) if (gearDropHappens(false, rand)) n++;
  const rate = n / N;
  /* The brief was "halve it, and make it very rare outside bosses". Anything
     above ~12% is not rare; anything below 1% makes the pickup feel dead. */
  return rate > 0.01 && rate < 0.12 ? null : `rate ${(rate * 100).toFixed(2)}% is outside 1-12%`;
});

// ---- parts ----------------------------------------------------------------

check('parts always land on a real slot with a positive amount', () => {
  const rand = seeded(13);
  for (let i = 0; i < 20000; i++) {
    const p = rollPartsDrop(rand() * 4, rand);
    if (!PART_SLOTS.includes(p.slot)) return `bad slot ${p.slot}`;
    if (!(p.amount >= 1) || !Number.isInteger(p.amount)) return `bad amount ${p.amount}`;
  }
  return null;
});

check('every part slot has a name and an icon', () => {
  for (const s of PART_SLOTS) {
    if (!PART_NAMES[s]) return `no name for ${s} parts`;
    if (!PART_ICONS[s]) return `no icon for ${s} parts`;
  }
  return null;
});

check('addParts accumulates without mutating the save', () => {
  const save = { gearSlotParts: { boots: 2 } };
  const next = addParts(save, 'boots', 3);
  if (save.gearSlotParts.boots !== 2) return 'addParts mutated the original save';
  if (next.boots !== 5) return `expected 5, got ${next.boots}`;
  if (addParts(save, 'ring', 4).ring !== 4) return 'did not seed a fresh slot';
  return null;
});

// ---- payment --------------------------------------------------------------

check('slot parts are spent before wildcards', () => {
  const p = gearLevelPayment({ gearSlotParts: { boots: 10 }, gearParts: 999 }, 'boots', 10);
  if (!p) return 'affordable payment returned null';
  if (p.useSlot !== 10 || p.useWild !== 0) return `spent ${p.useSlot} slot / ${p.useWild} wild`;
  return null;
});

check('wildcards cover the shortfall at the stated rate', () => {
  const p = gearLevelPayment({ gearSlotParts: { boots: 4 }, gearParts: 12 }, 'boots', 10);
  if (!p) return 'should have been affordable';
  const short = 10 - 4;
  if (p.useWild !== short * WILDCARD_PART_RATE) {
    return `expected ${short * WILDCARD_PART_RATE} wildcards, got ${p.useWild}`;
  }
  return null;
});

check('an unaffordable level-up returns null rather than a partial spend', () => {
  const p = gearLevelPayment({ gearSlotParts: { boots: 4 }, gearParts: 11 }, 'boots', 10);
  return p === null ? null : `expected null, got ${JSON.stringify(p)}`;
});

check('slotPartsOf tolerates a save with no parts at all', () => {
  /* Every existing save is exactly this shape, so getting it wrong would break
     the game for everyone who already plays it. */
  if (slotPartsOf({}, 'boots') !== 0) return 'undefined parts did not read as 0';
  if (slotPartsOf({ gearSlotParts: {} }, 'boots') !== 0) return 'empty parts did not read as 0';
  if (slotPartsOf(null, 'boots') !== 0) return 'null save did not read as 0';
  const legacy = { gearParts: 40 };
  const p = gearLevelPayment(legacy, 'boots', 10);
  if (!p) return 'a legacy save with only generic parts could not level anything';
  return null;
});

// ---- levelling ------------------------------------------------------------

check('levelling raises the effective stat and costs more each level', () => {
  const item = generateGearItem('boots', 'rare', seeded(17));
  const l1 = gearStatValue({ ...item, level: 1 });
  const lmax = gearStatValue({ ...item, level: GEAR_MAX_LEVEL });
  if (!(lmax > l1)) return 'max level is not worth more than level 1';
  let prev = 0;
  for (let l = 1; l < GEAR_MAX_LEVEL; l++) {
    const c = gearLevelCost(l, 'rare');
    if (c <= prev) return `cost did not rise at level ${l} (${c} after ${prev})`;
    prev = c;
  }
  return null;
});

// ---- rune sockets ---------------------------------------------------------

check('socket odds are a valid distribution within the cap', () => {
  for (const r of GEAR_RARITIES) {
    const o = SOCKET_ODDS[r];
    if (!o) return `no socket odds for ${r}`;
    const sum = o.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-9) return `${r} odds sum to ${sum}, not 1`;
    if (o.length - 1 > GEAR_MAX_SOCKETS) return `${r} can roll above ${GEAR_MAX_SOCKETS} sockets`;
  }
  return null;
});

check('sockets are the preserve of higher rarities', () => {
  const rand = seeded(23);
  for (let i = 0; i < 30000; i++) {
    if (rollSocketCount('common', rand) !== 0) return 'a common rolled a socket';
    if (rollSocketCount('mythicplus', rand) < 2) return 'a mythicplus rolled under 2 sockets';
  }
  return null;
});

check('rings and amulets always keep at least one socket', () => {
  const rand = seeded(29);
  for (let i = 0; i < 3000; i++) {
    for (const s of ['ring', 'amulet']) {
      if (generateGearItem(s, 'common', rand).sockets < 1) return `a common ${s} had no socket`;
    }
  }
  return null;
});

check('legacy items are read through without a save migration', () => {
  /* Every item already in a player's save predates `sockets`. Getting this
     wrong would silently strip runes from gear people are wearing. */
  if (gearSocketCount({ socket: true, slot: 'helmet' }) !== 1) return 'legacy boolean socket lost';
  if (gearSocketCount({ slot: 'ring' }) !== 1) return 'legacy ring lost its implicit socket';
  if (gearSocketCount({ slot: 'helmet' }) !== 0) return 'a plain legacy helmet invented a socket';
  if (gearSocketCount(null) !== 0) return 'null item did not read as 0';
  return null;
});

check('only runes in EQUIPPED gear pay out, and never twice', () => {
  const rune = { id: 'r1', stat: 'dmg', val: 0.1, rarity: 'rare' };
  const worn = { id: 'i1', slot: 'ring', sockets: 2 };
  const spare = { id: 'i2', slot: 'amulet', sockets: 1 };
  const save = {
    runeInventory: [rune],
    gearInventory: [worn, spare],
    gearEquipped: { ring: 'i1' },
    // Same rune listed on a worn piece AND an unworn one.
    gearRunes: { i1: ['r1'], i2: ['r1'] },
  };
  const res = {};
  applyRunesToStats(save, res);
  return Math.abs(res.dmg - 0.1) < 1e-9 ? null : `expected 0.1, got ${res.dmg}`;
});

check('a legacy slot-keyed save keeps its rune bonus', () => {
  const rune = { id: 'r1', stat: 'dmg', val: 0.1, rarity: 'rare' };
  const legacy = { runeInventory: [rune], gearInventory: [], gearEquipped: {}, gearRunes: { ring: 'r1' } };
  const res = {};
  applyRunesToStats(legacy, res);
  return Math.abs(res.dmg - 0.1) < 1e-9 ? null : `legacy save lost its rune (got ${res.dmg})`;
});

check('gearRunesFor understands both save shapes', () => {
  const item = { id: 'i1', slot: 'ring', sockets: 2 };
  const modern = gearRunesFor({ gearRunes: { i1: ['a', 'b'] } }, item);
  if (modern.length !== 2) return `modern shape gave ${modern.length} runes`;
  const legacy = gearRunesFor({ gearRunes: { ring: 'a' } }, item);
  if (legacy.length !== 1 || legacy[0] !== 'a') return 'legacy slot shape not read';
  if (gearRunesFor({ gearRunes: {} }, item).length !== 0) return 'empty save gave runes';
  return null;
});


// ---------------------------------------------------------------------------
// EVERY rarity must be constructible, and the ceiling must stay unfindable
// ---------------------------------------------------------------------------
// Added 2026-08-24 after a live crash. `mythicplus` was declared in
// GEAR_RARITIES, given the largest multiplier in GEAR_RARITY_MULT (14x), and
// documented as the forge-only ceiling - but it was missing from NAME_PREFIX,
// so generateGearItem(slot, mythicplus) THREW on
// prefixes[Math.floor(rand() * prefixes.length)] every single time. The best
// item in the game could never be created, and nothing noticed because no test
// had ever asked for the top rarity.
//
// Two invariants, and they pull against each other on purpose:
//   1. every rarity in the ladder can be BUILT   (or the forge is broken)
//   2. mythicplus can never be FOUND             (or the ladder loses its top)
check('every rarity in GEAR_RARITIES can actually be generated', () => {
  for (const slot of GEAR_SLOTS) {
    for (const rarity of GEAR_RARITIES) {
      try {
        const it = generateGearItem(slot, rarity);
        if (!it || !it.name) return 'generateGearItem(' + slot + ',' + rarity + ') returned nothing usable';
      } catch (e) {
        return 'generateGearItem(' + slot + ',' + rarity + ') THREW: ' + e.message
             + '. A rarity listed in GEAR_RARITIES that cannot be constructed is '
             + 'a crash waiting for the player who finally earns it.';
      }
    }
  }
  return null;
});

check('mythicplus is forge-only and never drops', () => {
  for (let i = 0; i < 40000; i++) {
    const r = rollGearDrop(900, i % 10 === 0);
    const rarity = r && (r.rarity || r);
    if (rarity === 'mythicplus') {
      return 'rollGearDrop produced a mythicplus. It is the one tier that is '
           + 'earned rather than found - forged from maxed mythicals - and '
           + 'putting it on the drop table removes the ladder top.';
    }
  }
  return null;
});

console.log(`\ngear.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
