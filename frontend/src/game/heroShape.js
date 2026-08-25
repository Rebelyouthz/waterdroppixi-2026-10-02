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
  // These were DEAD until 2026-08-24: declared here since the rig was written,
  // and `pixiRenderer.js` drew the band from its own hardcoded -0.70 / 0.58 /
  // 0.13 instead. Nothing read them. That is this project's dominant bug class
  // — a table that looks live and has no consumer — found again in the one
  // file whose whole premise is "one source of truth".
  //
  // Realigned to what the renderer was actually drawing, because that is the
  // band Timmy has been looking at and approves of, and the renderer now calls
  // drawHeadband() so there is one band everywhere.
  headband: { y: -0.70, halfW: 0.58, drop: 0.26, tail: 0.44 },
  // Where the legs hang from, and how long they are. The reference art has
  // short thick limbs — he is a drop, not a runway model — and the numbers are
  // in body radii like everything else here so they survive any scale.
  hip: [0.30, 0.86],
  leg: { len: 0.52, width: 0.26, footLen: 0.34, footH: 0.17 },
};

// ── EQUIPMENT SOCKETS ────────────────────────────────────────────────
// Timmy, 2026-08-24, with the CHARACTER VARIANTS sheet: "han ska aven kunna ha
// equipment pa sig a byta panband a ha hjalmar p rustning osv".
//
// Six variants on that sheet — headband, printed bandana, combat helmet,
// wizard hat, full plate helm, horned helm; vest, riot shield, backpack, fuel
// cell, staff, medkit, cigar, war paint, a rage aura — and every one of them is
// the SAME body wearing different things. So the body must not know about any
// of it. It exposes named points, and gear draws itself at a point.
//
// That contract is what makes the whole list possible without the character
// being redrawn once per variant, and it is what backlog #46 (a portrait per
// level, headband colour = rarity tier) has been waiting for.
//
// Positions are in body radii, in the character's own upright frame, BEFORE
// lean/squash/gait are applied — the rig applies those, so a hat added later
// automatically leans, bobs and squashes with him and nobody has to remember.
// `ang` is the natural resting angle of a thing mounted there.
export const HERO_SOCKETS = {
  crown:   { x: 0,     y: -1.05, ang: 0,     scale: 0.95 },  // hats, helms — sits ON the tip
  brow:    { x: 0,     y: -0.85, ang: 0,     scale: 1.00 },  // headbands, bandanas, goggles
  face:    { x: 0,     y: -0.42, ang: 0,     scale: 1.00 },  // war paint, visors, scars
  mouth:   { x: 0.18,  y: -0.18, ang: -0.18, scale: 0.80 },  // the cigar
  chest:   { x: 0,     y: 0.34,  ang: 0,     scale: 1.00 },  // vests, plate, bandoliers
  back:    { x: -0.10, y: 0.22,  ang: 0,     scale: 0.92 },  // backpacks, fuel cells, tanks
  handL:   { x: -0.95, y: 0.30,  ang: 0,     scale: 1.00 },  // shields, staves, medkits
  handR:   { x: 0.95,  y: 0.30,  ang: 0,     scale: 1.00 },  // the gun hand
  hipL:    { x: -0.30, y: 0.86,  ang: 0,     scale: 1.00 },
  hipR:    { x: 0.30,  y: 0.86,  ang: 0,     scale: 1.00 },
  aura:    { x: 0,     y: 0,     ang: 0,     scale: 1.60 },  // rage flames, shields, buffs
};

/** A socket resolved into drawing coordinates.
 *
 *  Everything a piece of gear needs and nothing it should know: where, how big,
 *  which way up. Gear that reaches past this into the body's own numbers is how
 *  a helmet ends up floating when the walk cycle changes. */
export function heroSocket(name, r, cx = 0, cy = 0, opts = {}) {
  const s = HERO_SOCKETS[name];
  if (!s) return null;
  const { lean = 0, sqx = 1, sqy = 1, faceX = 0 } = opts;
  // Squash first, then lean — the same order the body itself is built in, or
  // gear drifts off him at the extremes of a jump or a hard stop.
  let x = s.x * r * sqx;
  let y = s.y * r * sqy;
  const ca = Math.cos(lean), sa = Math.sin(lean);
  const rx = x * ca - y * sa;
  const ry = y * ca + x * sa;
  return {
    x: cx + rx,
    // A profile turn slides face-mounted gear across the head rather than
    // rotating it, matching how heroDraw lays the face out on two axes rather
    // than one angle.
    y: cy + ry,
    ang: s.ang + lean,
    r: r * s.scale,
    flip: faceX < 0 ? -1 : 1,
  };
}

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
