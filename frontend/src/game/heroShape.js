// =============================================
// HERO SILHOUETTE — one source of truth
// =============================================
// The in-game character and the equipment paperdoll used to be two unrelated
// drawings: a bezier teardrop in the PixiJS renderer, and a stack of CSS divs
// (head, torso, arms, legs) in the gear panel. They looked like different
// characters, because they were.
//
// Both now derive from the numbers here. The renderer samples the outline as
// polygon points because Graphics needs points; the paperdoll asks for the
// same curve as an SVG path. Change the shape in one place and both follow.

// Teardrop outline, expressed as one cubic bezier per side, mirrored about x.
// Units are multiples of the body radius `r`.
export const HERO_BODY = {
  tip:   [0, -1.15],   // the point at the top of the drop
  ctrl1: [1.05, -0.40],
  ctrl2: [1.05, 0.65],
  base:  [0, 1.00],    // the round bottom
};

// Where the arms attach, and where the hands rest when idle. Also in units
// of `r` — the renderer converts to world pixels, the paperdoll to viewBox
// units.
export const HERO_RIG = {
  shoulder: [0.62, 0.05],
  handRest: [0.95, 0.30],
  headband: { y: -0.85, halfW: 0.55, drop: 0.23 },
};

export const HERO_COLORS = {
  body: '#5fd6ff',
  bodyDeep: '#1a6f96',
  outline: '#06121e',
  arm: '#2b7fa8',
  gloss: '#ffffff',
};

// Samples one half of the outline; the caller mirrors it. `steps` controls
// smoothness — the renderer uses 8 to keep the per-frame polygon cheap.
export function heroHalfPoints(r, steps = 8) {
  const p0 = [0, HERO_BODY.tip[1] * r];
  const c1 = [HERO_BODY.ctrl1[0] * r, HERO_BODY.ctrl1[1] * r];
  const c2 = [HERO_BODY.ctrl2[0] * r, HERO_BODY.ctrl2[1] * r];
  const p1 = [0, HERO_BODY.base[1] * r];
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, mt = 1 - t;
    out.push(
      mt ** 3 * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t ** 3 * p1[0],
      mt ** 3 * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t ** 3 * p1[1],
    );
  }
  return out;
}

// Half-width of the silhouette at a given height. Both `y` and the result are
// in units of the body radius, matching the rest of this module.
//
// This exists because the face is laid out as if the head were a circle, and
// it is not -- the body is a teardrop that narrows to a point at the top. Eyes
// sit in the upper third and brows sit higher still, so features that were
// comfortably inside a circle could be drawn well outside the actual drop. The
// brow was the worst of it: at a raised brow in a full profile it landed at
// y = -1.14r, where the drop is 0.009r wide, while reaching out to 0.70r --
// a stroke hanging in empty space beside his head.
//
// Sampled into a lookup table once at module load rather than solved per call:
// this runs twice per frame per hero and the curve never changes.
const HALFW_STEPS = 128;
const HALFW_LUT = (() => {
  const lut = new Float32Array(HALFW_STEPS + 1);
  const p0 = HERO_BODY.tip, c1 = HERO_BODY.ctrl1, c2 = HERO_BODY.ctrl2, p1 = HERO_BODY.base;
  const yTop = p0[1], yBot = p1[1];
  // Walk the curve and record the widest x seen in each y bucket. The curve is
  // not monotonic in y near the base, so "widest wins" is the correct rule.
  for (let i = 0; i <= 2048; i++) {
    const t = i / 2048, mt = 1 - t;
    const x = mt ** 3 * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t ** 3 * p1[0];
    const y = mt ** 3 * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t ** 3 * p1[1];
    const k = Math.round(((y - yTop) / (yBot - yTop)) * HALFW_STEPS);
    if (k >= 0 && k <= HALFW_STEPS && x > lut[k]) lut[k] = x;
  }
  return lut;
})();

export function heroHalfWidthAt(y) {
  const yTop = HERO_BODY.tip[1], yBot = HERO_BODY.base[1];
  const f = (y - yTop) / (yBot - yTop);
  if (f <= 0 || f >= 1) return 0;             // above the tip or below the base
  const k = f * HALFW_STEPS;
  const i = Math.floor(k), frac = k - i;
  const a = HALFW_LUT[i], b = HALFW_LUT[Math.min(HALFW_STEPS, i + 1)];
  return a + (b - a) * frac;
}

// Closed outline as an SVG path, centred on (cx, cy).
export function heroBodyPath(r, cx = 0, cy = 0) {
  const t = [cx + HERO_BODY.tip[0] * r, cy + HERO_BODY.tip[1] * r];
  const b = [cx + HERO_BODY.base[0] * r, cy + HERO_BODY.base[1] * r];
  const c1 = [cx + HERO_BODY.ctrl1[0] * r, cy + HERO_BODY.ctrl1[1] * r];
  const c2 = [cx + HERO_BODY.ctrl2[0] * r, cy + HERO_BODY.ctrl2[1] * r];
  const c1m = [cx - HERO_BODY.ctrl1[0] * r, cy + HERO_BODY.ctrl1[1] * r];
  const c2m = [cx - HERO_BODY.ctrl2[0] * r, cy + HERO_BODY.ctrl2[1] * r];
  return `M ${t[0]},${t[1]} C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${b[0]},${b[1]}`
       + ` C ${c2m[0]},${c2m[1]} ${c1m[0]},${c1m[1]} ${t[0]},${t[1]} Z`;
}
