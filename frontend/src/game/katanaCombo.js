// THE KATANA'S THREE RHYTHMS.
//
// Timmy: "the attacks need to be better longer and like in combos — 1, 2 and
// threeee, and 1 and twoooo, the fooour — time them like that: fast fast long,
// and fast long fast, fast fast long, and so on, like 3 different that
// switches."
//
// So this is not a hold-to-swing counter like the rib's (meleeCombo.js). It is
// a TIMED STRING: three patterns, each a run of beats whose spacing is the
// pattern — two quick cuts and a long committed one, a quick cut, a long one,
// a quick one, and a four-beat run that ends in a full circle. When a pattern
// finishes the next one starts, so the blade never repeats the same rhythm
// twice in a row.
//
// Every number here is a MULTIPLIER on the weapon's own stats, so levelling
// the katana in a run speeds all three patterns up together instead of only
// the slow beats. `readBeat` never mutates; `advanceBeat` is the only writer,
// and it moves the player through a pattern exactly once per swing.
//
// The rhythm lives on the player object (`p._kPattern`, `p._kBeat`) because
// that is where every other per-swing state already lives, and it dies with
// the run like the rest of it.

export const KATANA_PATTERNS = [
  {
    id: 'fang',
    name: 'TRIPLE FANG',
    // 1 · 2 · THREEE — two snaps and a long cleave.
    beats: [
      { cd: 0.40, dmg: 1.00, reach: 1.02, span: 0.92, swing: 0.15, lean: 1.05, knock: 1.00, style: 1 },
      { cd: 0.40, dmg: 1.06, reach: 1.06, span: 1.05, swing: 0.15, lean: 1.12, knock: 1.02, style: 8 },
      { cd: 2.40, dmg: 2.10, reach: 1.75, span: 1.75, swing: 0.30, lean: 1.55, knock: 1.80, style: 2, long: true },
    ],
  },
  {
    id: 'cross',
    name: 'CROSSFALL',
    // 1 · TWOooo · 3 — a quick thrust, the long sweep, then a snap back.
    beats: [
      { cd: 0.36, dmg: 1.05, reach: 1.10, span: 0.60, swing: 0.14, lean: 1.15, knock: 1.05, style: 3 },
      { cd: 2.00, dmg: 1.90, reach: 1.62, span: 1.60, swing: 0.30, lean: 1.50, knock: 1.70, style: 6, long: true },
      { cd: 0.44, dmg: 1.02, reach: 1.04, span: 1.10, swing: 0.15, lean: 1.08, knock: 1.00, style: 0 },
    ],
  },
  {
    id: 'bell',
    name: 'FOURTH BELL',
    // 1 · 2 · 3 · THE FOOOUR — a four-beat run closing on a full circle.
    beats: [
      { cd: 0.34, dmg: 0.96, reach: 1.00, span: 0.90, swing: 0.14, lean: 1.02, knock: 0.98, style: 8 },
      { cd: 0.34, dmg: 1.00, reach: 1.04, span: 1.00, swing: 0.14, lean: 1.06, knock: 1.00, style: 5 },
      { cd: 0.38, dmg: 1.08, reach: 1.08, span: 1.10, swing: 0.15, lean: 1.10, knock: 1.05, style: 1 },
      // span is measured the same way the rib's Cyclone is: past ~5.4 the
      // engine's hit arc wraps the whole circle, which is what a 360° cut
      // (style 7) has to reach to be honest about what it animated.
      { cd: 2.80, dmg: 2.60, reach: 1.90, span: 5.60, swing: 0.34, lean: 1.70, knock: 2.00, style: 7, long: true, launch: true },
    ],
  },
];

/** The beat the blade is on right now, plus which pattern it belongs to. */
export function readBeat(p) {
  const pi = ((p && p._kPattern) || 0) % KATANA_PATTERNS.length;
  const pattern = KATANA_PATTERNS[pi];
  const bi = ((p && p._kBeat) || 0) % pattern.beats.length;
  return { pattern, beat: pattern.beats[bi], patternIndex: pi, beatIndex: bi, last: bi === pattern.beats.length - 1 };
}

/**
 * Step to the next beat — and when a pattern runs out, to the next pattern.
 * Called once per swing, after the beat has already been used for that swing.
 */
export function advanceBeat(p) {
  if (!p) return;
  const pi = (p._kPattern || 0) % KATANA_PATTERNS.length;
  const pattern = KATANA_PATTERNS[pi];
  let bi = (p._kBeat || 0) + 1;
  if (bi >= pattern.beats.length) {
    bi = 0;
    p._kPattern = (pi + 1) % KATANA_PATTERNS.length;
  }
  p._kBeat = bi;
}

/** Reset the strings (a fresh run, so the first swing is always beat 1). */
export function resetCombo(p) {
  if (!p) return;
  p._kPattern = 0;
  p._kBeat = 0;
}
