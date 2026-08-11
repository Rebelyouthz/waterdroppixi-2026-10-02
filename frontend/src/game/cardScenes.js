// Card art as procedural PixiJS scenes.
//
// The SVG icon set (components/GameIcon.jsx) is right for a 32px chip in the
// Weaponsmith. It is not right for the level-up card, where the picture is
// ~200px and is the most important thing on screen. Blown up, a 32-unit glyph
// is a flat symbol, and next to the reference sheet it reads as clip art.
//
// The quality bar is already in this project: `_drawDistantWorld` in
// pixiRenderer.js draws the background planet with real continent coordinates
// projected onto a sphere, a stacked terminator, a specular sun-glint with
// broken trailing ripples, and real city coordinates on the night side faded
// by how far each has rotated into darkness. That is what "detailed" means
// here, and it is procedural Graphics, not an imported picture.
//
// So card art is drawn the same way. The techniques below are lifted from
// that renderer on purpose, so the cards and the game agree on what light does:
//
//   * a terminator is stacked shadow discs each offset FURTHER than it is
//     shrunk — equal-sized offset discs just darken the whole disc evenly,
//     which is a flat circle, not a sphere
//   * a corona is an irregular rim (two sine harmonics), never a clean circle
//   * a ray fan uses deterministic pseudo-noise and alternating lengths; a fan
//     of identical evenly-spaced spokes reads as a cartoon sun
//   * a specular highlight is elongated across the light direction and trails
//     broken glints, because a reflection off a curved moving surface smears
//
// Scenes are painted ONCE at card build time — Pixi caches the geometry, so
// there is no per-frame rebuild. Anything that has to move lives in the
// renderer's per-frame art layer instead.

import { FillGradient } from 'pixi.js';

const TAU = Math.PI * 2;

// Deterministic pseudo-noise, same trick the star's ray fan uses, so a scene
// never shimmers between rebuilds.
const noise = (i) => ((i * 2654435761) >>> 0) / 4294967295;

/** A smooth radial highlight — a near-white core fading through `lit` to
 * transparent — standing in for a stack of flat-alpha discs. One continuous
 * falloff instead of visible concentric rings, which is what a photographed
 * specular highlight actually looks like. */
function radialHi(cx, cy, r, lit) {
  return new FillGradient({
    type: 'radial',
    center: { x: cx, y: cy }, innerRadius: 0,
    outerCenter: { x: cx, y: cy }, outerRadius: r,
    colorStops: [
      { offset: 0, color: 0xffffff },
      { offset: 0.38, color: lit },
      { offset: 1, color: lit },
    ],
  });
}

/**
 * A body lit from `lx, ly` with a real terminator.
 * Shared by every scene that contains a sphere, so they all curve the same way.
 */
function sphere(g, cx, cy, R, lx, ly, base, lit) {
  g.circle(cx, cy, R).fill({ color: base });
  // Terminator first, so the smooth highlight painted after it glazes over
  // the seam between lit and dark rather than sitting under a hard edge.
  for (const [off, rad, a] of [[0.30, 0.98, 0.16], [0.52, 0.88, 0.20], [0.72, 0.72, 0.26]]) {
    g.circle(cx - lx * R * off, cy - ly * R * off, R * rad)
      .fill({ color: 0x02060f, alpha: a });
  }
  // Day side: one continuous gradient instead of three stacked flat discs.
  const hx = cx + lx * R * 0.30, hy = cy + ly * R * 0.30;
  g.circle(cx, cy, R).fill({ fill: radialHi(hx, hy, R * 1.05, lit), alpha: 0.6 });
  g.circle(hx, hy, R * 0.32).fill({ color: 0xffffff, alpha: 0.30 });
  // Lit limb: a hard crescent where the light clips the edge.
  g.circle(cx + lx * R * 0.10, cy + ly * R * 0.10, R * 0.985)
    .stroke({ width: R * 0.055, color: lit, alpha: 0.45 });
  g.circle(cx + lx * R * 0.05, cy + ly * R * 0.05, R)
    .stroke({ width: R * 0.02, color: 0xffffff, alpha: 0.6 });
  // A soft rim-light on the shadow side, opposite the key light.
  g.circle(cx - lx * R * 0.02, cy - ly * R * 0.02, R * 0.99)
    .stroke({ width: R * 0.05, color: lit, alpha: 0.16 });
}

/** Specular glint, elongated across the light and trailing broken ripples. */
function glint(g, cx, cy, R, lx, ly, strength = 1) {
  const gx = cx + lx * R * 0.42, gy = cy + ly * R * 0.42;
  const ang = Math.atan2(ly, lx) + Math.PI / 2;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (const [w, h, a] of [[0.30, 0.13, 0.10], [0.20, 0.08, 0.16], [0.11, 0.045, 0.30]]) {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * TAU;
      const ex = Math.cos(t) * R * w, ey = Math.sin(t) * R * h;
      pts.push(gx + ex * ca - ey * sa, gy + ex * sa + ey * ca);
    }
    g.poly(pts).fill({ color: 0xffffff, alpha: a * strength });
  }
  for (let i = 0; i < 5; i++) {
    const f = (i + 1) / 6;
    const jx = gx - lx * R * f * 0.34 + Math.sin(i * 2.3) * R * 0.07;
    const jy = gy - ly * R * f * 0.34 + Math.cos(i * 1.7) * R * 0.05;
    g.ellipse(jx, jy, R * (0.045 - f * 0.02), R * (0.018 - f * 0.008))
      .fill({ color: 0xffffff, alpha: 0.18 * (1 - f) * strength });
  }
}

/** An irregular corona rim. Two harmonics, never a clean circle. */
function corona(g, cx, cy, R, color, alpha, wobA = 0.045, wobB = 0.025) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    const wob = 1 + Math.sin(a * 5.3) * wobA + Math.sin(a * 11.7) * wobB;
    pts.push(cx + Math.cos(a) * R * wob, cy + Math.sin(a) * R * wob);
  }
  g.poly(pts).fill({ color, alpha });
}

/** A meteor: nose-lit rock, layered fire trail, heat shimmer, shed sparks. */
function meteor(g, x, y, ang, len, size, hot, mid, deep) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const px = -dy, py = dx;
  // Trail, widest and coolest at the back so it reads as burning off.
  for (const [f, w, col, a] of [
    [1.00, 1.5, deep, 0.30], [0.74, 1.05, mid, 0.45],
    [0.48, 0.7, hot, 0.55], [0.26, 0.38, 0xffffff, 0.55],
  ]) {
    const tx = x - dx * len * f, ty = y - dy * len * f;
    g.moveTo(x + px * size * 0.7, y + py * size * 0.7)
      .lineTo(tx + px * size * w * 0.16, ty + py * size * w * 0.16)
      .lineTo(tx - px * size * w * 0.16, ty - py * size * w * 0.16)
      .lineTo(x - px * size * 0.7, y - py * size * 0.7)
      .closePath()
      .fill({ color: col, alpha: a });
  }
  // The rock. Dark body, fire-lit leading face, white-hot nose.
  g.circle(x, y, size).fill({ color: 0x1a1016 });
  g.circle(x + dx * size * 0.30, y + dy * size * 0.30, size * 0.78).fill({ color: mid, alpha: 0.75 });
  g.circle(x + dx * size * 0.48, y + dy * size * 0.48, size * 0.46).fill({ color: hot, alpha: 0.9 });
  g.circle(x + dx * size * 0.58, y + dy * size * 0.58, size * 0.24).fill({ color: 0xffffff, alpha: 0.95 });
  // Ablation sparks shedding sideways off the trail.
  for (let i = 0; i < 4; i++) {
    const f = 0.25 + i * 0.2;
    const s = noise(i * 7 + Math.round(x)) - 0.5;
    g.circle(x - dx * len * f + px * size * s * 2.4,
      y - dy * len * f + py * size * s * 2.4, size * (0.20 - i * 0.03))
      .fill({ color: i % 2 ? hot : mid, alpha: 0.7 - i * 0.13 });
  }
}


/**
 * A forked electric arc from a to b. Three passes: a wide dim halo, the body,
 * and a thin white core, plus one branch. Real lightning tapers and forks —
 * a single zigzag stroke reads as a icon of lightning, not as a discharge.
 */
function arc(g, x0, y0, x1, y1, amp, seed, hot, mid, bw) {
  const build = () => {
    const N = 7;
    g.moveTo(x0, y0);
    for (let i = 1; i <= N; i++) {
      const f = i / N;
      const nx = x0 + (x1 - x0) * f, ny = y0 + (y1 - y0) * f;
      const dx = -(y1 - y0), dy = (x1 - x0);
      const dl = Math.hypot(dx, dy) || 1;
      const j = (noise(seed * 31 + i) - 0.5) * amp * Math.sin(f * Math.PI);
      g.lineTo(nx + (dx / dl) * j, ny + (dy / dl) * j);
    }
  };
  build(); g.stroke({ width: bw * 4.2, color: mid, alpha: 0.16 });
  build(); g.stroke({ width: bw * 1.8, color: mid, alpha: 0.85 });
  build(); g.stroke({ width: bw * 0.7, color: 0xffffff, alpha: 0.95 });
  // One branch, leaving at a third of the way along.
  const bf = 0.34 + noise(seed * 7) * 0.3;
  const bx = x0 + (x1 - x0) * bf, by = y0 + (y1 - y0) * bf;
  const ba = Math.atan2(y1 - y0, x1 - x0) + (noise(seed * 11) - 0.5) * 1.7;
  const bl = Math.hypot(x1 - x0, y1 - y0) * 0.34;
  g.moveTo(bx, by).lineTo(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl)
    .stroke({ width: bw * 1.0, color: hot, alpha: 0.8 });
}

/**
 * A blade: dark spine, a body that lightens toward the edge, and a hard
 * specular line ON the edge. The edge highlight is the whole trick — steel is
 * recognisable because one line on it is brighter than anything around it.
 */
function blade(g, x0, y0, x1, y1, halfW, edgeCol, bodyCol) {
  const dx = x1 - x0, dy = y1 - y0;
  const L = Math.hypot(dx, dy) || 1;
  const px = -dy / L, py = dx / L;
  // One continuous across-the-width gradient (dark spine -> body -> bright
  // near the edge) instead of a flat fill plus a separate lit-side triangle —
  // that seam was the single biggest "vector clip-art" tell next to a
  // photographed blade's actual falloff.
  const bodyGrad = new FillGradient({
    start: { x: x0 - px * halfW, y: y0 - py * halfW },
    end: { x: x0 + px * halfW, y: y0 + py * halfW },
    colorStops: [
      { offset: 0, color: 0x0d141f },
      { offset: 0.30, color: bodyCol },
      { offset: 0.62, color: bodyCol },
      { offset: 0.92, color: 0xffffff },
      { offset: 1, color: edgeCol },
    ],
  });
  g.moveTo(x0 + px * halfW, y0 + py * halfW)
    .lineTo(x1, y1)
    .lineTo(x0 - px * halfW, y0 - py * halfW)
    .closePath()
    .fill({ fill: bodyGrad })
    .stroke({ width: halfW * 0.22, color: 0x0d141f, alpha: 0.95 });
  // The edge itself: a hard bright stroke on top of the gradient.
  g.moveTo(x0 + px * halfW * 0.92, y0 + py * halfW * 0.92).lineTo(x1, y1)
    .stroke({ width: halfW * 0.30, color: edgeCol, alpha: 0.95 });
}

/** A cylindrical metal body: a smooth top-lit gradient instead of two flat
 * light/dark bands, so it reads as a round barrel rather than a striped box. */
function tube(g, x, y, w, h, r, tone) {
  const bodyGrad = new FillGradient({
    start: { x, y }, end: { x, y: y + h },
    colorStops: [
      { offset: 0, color: 0xd8e2f0 },
      { offset: 0.22, color: 0x9aabc2 },
      { offset: 0.55, color: 0x445062 },
      { offset: 0.85, color: 0x1c2530 },
      { offset: 1, color: 0x0d1219 },
    ],
  });
  g.roundRect(x, y, w, h, r).fill({ fill: bodyGrad });
  g.roundRect(x, y, w, h, r).stroke({ width: Math.max(1, h * 0.06), color: 0x0d141f, alpha: 0.9 });
  g.moveTo(x + w * 0.06, y + h * 0.16).lineTo(x + w * 0.94, y + h * 0.16)
    .stroke({ width: Math.max(1, h * 0.05), color: 0xffffff, alpha: 0.45 });
  // A dim bounce of the picture's own tone up from underneath, so the metal
  // doesn't read as generically grey on every card regardless of weapon.
  g.roundRect(x, y + h * 0.78, w, h * 0.22, r)
    .fill({ color: tone, alpha: 0.14 });
}

// ---------------------------------------------------------------------------
// SCENES
// ---------------------------------------------------------------------------
// Signature: (g, cx, cy, R, tone) where R is the scene's half-size in px and
// `tone` is the picture's own accent (never the rarity colour).

const SCENES = {

  // TIDE LASH — a whip of water, thick at the grip, tapering to a cracked tip.
  whip(g, cx, cy, R, tone) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push([
        cx - R * 0.92 + t * R * 1.86,
        cy + R * 0.62 - Math.sin(t * 3.4) * R * 0.62 * (0.35 + t * 0.9),
      ]);
    }
    for (const [w, col, a] of [[0.115, 0x0d2a3a, 0.9], [0.075, tone, 0.95], [0.026, 0xffffff, 0.65]]) {
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const taper = 1 - (i / pts.length) * 0.7;
        g.lineTo(pts[i][0], pts[i][1]);
        if (i % 8 === 0) { g.stroke({ width: R * w * taper, color: col, alpha: a }); g.moveTo(pts[i][0], pts[i][1]); }
      }
      g.stroke({ width: R * w * 0.3, color: col, alpha: a });
    }
    tube(g, pts[0][0] - R * 0.06, pts[0][1] - R * 0.05, R * 0.24, R * 0.11, R * 0.05, tone);
    const tip = pts[pts.length - 1];
    g.circle(tip[0], tip[1], R * 0.26).fill({ color: tone, alpha: 0.22 });
    for (let i = 0; i < 9; i++) {
      const j = 6 + i * 4;
      if (j >= pts.length) break;
      const rr = R * (0.055 - i * 0.004);
      g.circle(pts[j][0] + (noise(i * 7) - 0.5) * R * 0.16,
        pts[j][1] + R * (0.10 + noise(i * 11) * 0.22), rr).fill({ color: tone, alpha: 0.85 });
      g.circle(pts[j][0] + (noise(i * 7) - 0.5) * R * 0.16 - rr * 0.3,
        pts[j][1] + R * (0.10 + noise(i * 11) * 0.22) - rr * 0.3, rr * 0.35)
        .fill({ color: 0xffffff, alpha: 0.75 });
    }
  },

  // BONE SHARDS — splintered fragments in flight, each lit on one side.
  bone(g, cx, cy, R, tone) {
    const F = [[-0.62, -0.44, -0.5, 0.44], [0.18, -0.62, 0.3, 0.34], [-0.30, 0.24, 0.8, 0.40],
               [0.54, 0.10, -0.3, 0.36], [0.02, 0.58, 1.2, 0.30], [-0.72, 0.52, 0.15, 0.26]];
    for (let i = 0; i < F.length; i++) {
      const [ox, oy, ang, len] = F[i];
      const x = cx + ox * R, y = cy + oy * R;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const L = R * len, w = R * 0.055;
      g.moveTo(x - dx * L * 0.1 - dx * R * 0.14, y - dy * L * 0.1 - dy * R * 0.14)
        .lineTo(x + dx * L, y + dy * L)
        .stroke({ width: R * 0.10, color: tone, alpha: 0.12 });
      g.roundRect(x, y - w, L, w * 2, w).fill({ color: 0xd9d2c4 });
      g.roundRect(x, y - w, L, w * 0.7, w * 0.5).fill({ color: 0xffffff, alpha: 0.6 });
      g.roundRect(x, y - w, L, w * 2, w).stroke({ width: R * 0.014, color: 0x0d141f, alpha: 0.85 });
      for (const ex of [0, L]) {
        g.circle(x + ex, y - w * 0.9, w * 1.05).fill({ color: 0xe8e2d0 })
          .stroke({ width: R * 0.012, color: 0x0d141f, alpha: 0.85 });
        g.circle(x + ex, y + w * 0.9, w * 1.05).fill({ color: 0xc9c1b2 })
          .stroke({ width: R * 0.012, color: 0x0d141f, alpha: 0.85 });
      }
    }
  },

  // ICE SPIKE — one shard driven up through cracked ground.
  iceSpike(g, cx, cy, R, tone) {
    const ground = cy + R * 0.66;
    g.ellipse(cx, ground, R * 0.72, R * 0.16).fill({ color: tone, alpha: 0.16 });
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + noise(i * 5 + 1) * Math.PI;
      g.moveTo(cx, ground).lineTo(cx + Math.cos(a) * R * (0.4 + noise(i * 9) * 0.5),
        ground + Math.abs(Math.sin(a)) * R * 0.12)
        .stroke({ width: R * 0.02, color: 0x1a2c3c, alpha: 0.8 });
    }
    const tipy = cy - R * 0.94, hw = R * 0.22;
    g.moveTo(cx - hw, ground).lineTo(cx - hw * 0.5, ground - R * 0.7).lineTo(cx + R * 0.03, tipy)
      .lineTo(cx + hw * 0.6, ground - R * 0.66).lineTo(cx + hw, ground).closePath()
      .fill({ color: tone, alpha: 0.94 }).stroke({ width: R * 0.016, color: 0x0d141f });
    g.moveTo(cx - hw, ground).lineTo(cx - hw * 0.5, ground - R * 0.7)
      .lineTo(cx + R * 0.03, tipy).lineTo(cx - R * 0.02, ground).closePath()
      .fill({ color: 0xffffff, alpha: 0.34 });
    g.moveTo(cx + hw, ground).lineTo(cx + hw * 0.6, ground - R * 0.66)
      .lineTo(cx + R * 0.03, tipy).lineTo(cx - R * 0.02, ground).closePath()
      .fill({ color: 0x0a1a2e, alpha: 0.36 });
    g.moveTo(cx - R * 0.02, ground - R * 0.1).lineTo(cx + R * 0.03, tipy)
      .stroke({ width: R * 0.022, color: 0xffffff, alpha: 0.6 });
    for (const [ox, h, w] of [[-0.44, 0.42, 0.09], [0.42, 0.52, 0.10], [-0.24, 0.24, 0.06]]) {
      g.moveTo(cx + ox * R - R * w, ground).lineTo(cx + ox * R, ground - h * R)
        .lineTo(cx + ox * R + R * w, ground).closePath()
        .fill({ color: tone, alpha: 0.85 }).stroke({ width: R * 0.012, color: 0x0d141f });
    }
    g.ellipse(cx, ground + R * 0.03, R * 0.5, R * 0.08).fill({ color: 0x02060f, alpha: 0.5 });
  },

  // STATIC FIELD — a disc of charge on the ground with arcs crawling it.
  staticField(g, cx, cy, R, tone) {
    const y = cy + R * 0.18;
    for (let i = 4; i >= 1; i--) {
      g.ellipse(cx, y, R * 0.24 * i, R * 0.24 * i * 0.34)
        .stroke({ width: R * 0.02, color: tone, alpha: 0.14 * (5 - i) / 4 });
    }
    g.ellipse(cx, y, R * 0.92, R * 0.31).fill({ color: tone, alpha: 0.13 });
    g.ellipse(cx, y, R * 0.92, R * 0.31).stroke({ width: R * 0.028, color: tone, alpha: 0.8 });
    for (let i = 0; i < 5; i++) {
      const a0 = noise(i * 7 + 1) * TAU, a1 = a0 + 1.4 + noise(i * 11) * 1.6;
      arc(g, cx + Math.cos(a0) * R * 0.8, y + Math.sin(a0) * R * 0.27,
        cx + Math.cos(a1) * R * 0.8, y + Math.sin(a1) * R * 0.27,
        R * 0.16, i + 51, 0xffffff, tone, R * 0.013);
    }
    // The emitter pylon in the middle.
    tube(g, cx - R * 0.09, y - R * 0.68, R * 0.18, R * 0.62, R * 0.05, tone);
    g.circle(cx, y - R * 0.74, R * 0.15).fill({ color: tone });
    g.circle(cx, y - R * 0.74, R * 0.07).fill({ color: 0xffffff });
    g.circle(cx, y - R * 0.74, R * 0.32).fill({ color: tone, alpha: 0.2 });
  },

  // SNIPER DROP — the shot comes from above: reticle on the ground, round
  // still falling, ranging marks.
  sniperDrop(g, cx, cy, R, tone) {
    const ty = cy + R * 0.34;
    g.ellipse(cx, ty, R * 0.7, R * 0.24).fill({ color: tone, alpha: 0.10 });
    g.ellipse(cx, ty, R * 0.62, R * 0.21).stroke({ width: R * 0.022, color: tone, alpha: 0.85 });
    g.ellipse(cx, ty, R * 0.32, R * 0.11).stroke({ width: R * 0.016, color: tone, alpha: 0.6 });
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      g.moveTo(cx + dx * R * 0.18, ty + dy * R * 0.07)
        .lineTo(cx + dx * R * 0.86, ty + dy * R * 0.30)
        .stroke({ width: R * 0.022, color: tone, alpha: 0.9 });
    }
    g.circle(cx, ty, R * 0.05).fill({ color: 0xffffff, alpha: 0.9 });
    // The round, nose down, with a thin trail.
    const bx = cx, by = cy - R * 0.62;
    g.moveTo(bx, by - R * 0.9).lineTo(bx, by - R * 0.24)
      .stroke({ width: R * 0.03, color: tone, alpha: 0.35 });
    g.moveTo(bx, by + R * 0.20).lineTo(bx - R * 0.09, by - R * 0.02)
      .lineTo(bx - R * 0.09, by - R * 0.24).lineTo(bx + R * 0.09, by - R * 0.24)
      .lineTo(bx + R * 0.09, by - R * 0.02).closePath()
      .fill({ color: 0xc9a227 }).stroke({ width: R * 0.014, color: 0x0d141f });
    g.moveTo(bx - R * 0.05, by + R * 0.06).lineTo(bx - R * 0.05, by - R * 0.22)
      .stroke({ width: R * 0.02, color: 0xffe9a3, alpha: 0.8 });
    for (let i = 0; i < 3; i++) {
      g.moveTo(cx - R * 0.9, ty - R * 0.5 + i * R * 0.2).lineTo(cx - R * 0.78, ty - R * 0.5 + i * R * 0.2)
        .stroke({ width: R * 0.014, color: tone, alpha: 0.4 });
    }
  },

  // ACID SPRAYER — tank, nozzle, and a corrosive cloud eating the ground.
  acid(g, cx, cy, R, tone) {
    g.roundRect(cx - R * 0.92, cy - R * 0.30, R * 0.34, R * 0.72, R * 0.12)
      .fill({ color: 0x2a3341 }).stroke({ width: R * 0.018, color: 0x0d141f });
    g.roundRect(cx - R * 0.84, cy - R * 0.20, R * 0.10, R * 0.50, R * 0.05)
      .fill({ color: tone, alpha: 0.85 });
    g.circle(cx - R * 0.79, cy - R * 0.12, R * 0.03).fill({ color: 0xffffff, alpha: 0.8 });
    g.moveTo(cx - R * 0.58, cy - R * 0.14).lineTo(cx - R * 0.20, cy - R * 0.08)
      .lineTo(cx - R * 0.20, cy + R * 0.16).lineTo(cx - R * 0.58, cy + R * 0.22)
      .closePath().fill({ color: 0x46586e }).stroke({ width: R * 0.016, color: 0x0d141f });
    g.moveTo(cx - R * 0.20, cy - R * 0.10).lineTo(cx + R * 0.02, cy - R * 0.16)
      .lineTo(cx + R * 0.02, cy + R * 0.20).lineTo(cx - R * 0.20, cy + R * 0.16)
      .closePath().fill({ color: 0x7d93ad }).stroke({ width: R * 0.016, color: 0x0d141f });
    // Cloud.
    for (const [ox, oy, rr, a] of [
      [0.36, -0.22, 0.30, 0.85], [0.72, 0.02, 0.24, 0.8], [0.44, 0.26, 0.26, 0.9],
      [0.86, 0.34, 0.17, 0.7], [0.20, 0.06, 0.19, 0.75],
    ]) {
      g.circle(cx + ox * R, cy + oy * R, rr * R * 1.5).fill({ color: tone, alpha: 0.10 });
      g.circle(cx + ox * R, cy + oy * R, rr * R).fill({ color: tone, alpha: a });
      g.circle(cx + ox * R - rr * R * 0.3, cy + oy * R - rr * R * 0.3, rr * R * 0.34)
        .fill({ color: 0xffffff, alpha: 0.30 });
    }
    // Drips eating downward.
    for (const [ox, l] of [[0.30, 0.44], [0.62, 0.34], [0.84, 0.22]]) {
      g.moveTo(cx + ox * R, cy + R * 0.36)
        .quadraticCurveTo(cx + ox * R + R * 0.04, cy + R * (0.36 + l * 0.6),
          cx + ox * R, cy + R * (0.36 + l))
        .stroke({ width: R * 0.03, color: tone, alpha: 0.8 });
      g.circle(cx + ox * R, cy + R * (0.40 + l), R * 0.05).fill({ color: tone });
    }
  },

  // TIDAL HARPOON — a barbed head with a slack line and water behind it.
  tidalHarpoon(g, cx, cy, R, tone) {
    const x1 = cx + R * 0.80, y1 = cy - R * 0.76;
    const x0 = cx - R * 0.50, y0 = cy + R * 0.40;
    const ux = (x1 - x0), uy = (y1 - y0), L = Math.hypot(ux, uy);
    const nx = ux / L, ny = uy / L, px = -ny, py = nx;
    // Slack line coiling away from the butt.
    g.moveTo(x0, y0).quadraticCurveTo(cx - R * 0.92, cy + R * 0.42, cx - R * 0.70, cy + R * 0.86)
      .stroke({ width: R * 0.022, color: 0xe8e2d0, alpha: 0.8 });
    g.moveTo(cx - R * 0.70, cy + R * 0.86).quadraticCurveTo(cx - R * 0.40, cy + R * 0.94, cx - R * 0.30, cy + R * 0.70)
      .stroke({ width: R * 0.02, color: 0xe8e2d0, alpha: 0.6 });
    g.moveTo(x0, y0).lineTo(x1 - nx * R * 0.42, y1 - ny * R * 0.42)
      .stroke({ width: R * 0.07, color: 0x46586e });
    g.moveTo(x0, y0).lineTo(x1 - nx * R * 0.42, y1 - ny * R * 0.42)
      .stroke({ width: R * 0.02, color: 0x7d93ad, alpha: 0.8 });
    blade(g, x1 - nx * R * 0.46, y1 - ny * R * 0.46, x1, y1, R * 0.11, 0xffffff, tone);
    for (const sgn of [-1, 1]) {
      g.moveTo(x1 - nx * R * 0.42 + px * sgn * R * 0.08, y1 - ny * R * 0.42 + py * sgn * R * 0.08)
        .lineTo(x1 - nx * R * 0.70 + px * sgn * R * 0.26, y1 - ny * R * 0.70 + py * sgn * R * 0.26)
        .lineTo(x1 - nx * R * 0.34 + px * sgn * R * 0.05, y1 - ny * R * 0.34 + py * sgn * R * 0.05)
        .closePath().fill({ color: tone }).stroke({ width: R * 0.014, color: 0x0d141f });
    }
    // Water thrown off behind it.
    for (let i = 0; i < 3; i++) {
      g.moveTo(cx - R * 0.9, cy + R * (0.02 + i * 0.22))
        .quadraticCurveTo(cx - R * 0.3, cy + R * (-0.14 + i * 0.22), cx + R * 0.24, cy + R * (0.04 + i * 0.20))
        .stroke({ width: R * 0.026, color: tone, alpha: 0.35 - i * 0.07 });
    }
    for (let i = 0; i < 6; i++) {
      g.circle(cx - R * 0.6 + noise(i * 7) * R * 1.2, cy + R * (0.2 + noise(i * 11) * 0.6),
        R * (0.04 - i * 0.003)).fill({ color: tone, alpha: 0.7 });
    }
  },

  // ARC CASTER — a hand emitter with the arc jumping its two prongs.
  arcCaster(g, cx, cy, R, tone) {
    const gx = cx - R * 0.56, gy = cy + R * 0.52;
    g.moveTo(gx - R * 0.14, gy + R * 0.30).lineTo(gx + R * 0.10, gy - R * 0.16)
      .lineTo(gx + R * 0.36, gy - R * 0.02).lineTo(gx + R * 0.12, gy + R * 0.44)
      .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.018, color: 0x0d141f });
    g.moveTo(gx + R * 0.16, gy - R * 0.10).lineTo(gx + R * 0.62, gy - R * 0.62)
      .lineTo(gx + R * 0.86, gy - R * 0.42).lineTo(gx + R * 0.40, gy + R * 0.10)
      .closePath().fill({ color: 0x46586e }).stroke({ width: R * 0.018, color: 0x0d141f });
    g.moveTo(gx + R * 0.24, gy - R * 0.18).lineTo(gx + R * 0.66, gy - R * 0.60)
      .stroke({ width: R * 0.022, color: 0x7d93ad, alpha: 0.85 });
    // Two prongs.
    const p1x = gx + R * 0.98, p1y = gy - R * 0.86;
    const p2x = gx + R * 1.28, p2y = gy - R * 0.44;
    for (const [ax, ay, bx, by] of [[gx + R * 0.70, gy - R * 0.56, p1x, p1y],
      [gx + R * 0.80, gy - R * 0.36, p2x, p2y]]) {
      g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: R * 0.05, color: 0x7d93ad });
      g.circle(bx, by, R * 0.05).fill({ color: tone });
    }
    arc(g, p1x, p1y, p2x, p2y, R * 0.22, 61, 0xffffff, tone, R * 0.017);
    g.circle((p1x + p2x) / 2, (p1y + p2y) / 2, R * 0.34).fill({ color: tone, alpha: 0.20 });
  },

  // COMET LAUNCHER — a shoulder tube with the comet already away.
  cometLauncher(g, cx, cy, R, tone) {
    tube(g, cx - R * 0.96, cy + R * 0.28, R * 1.02, R * 0.28, R * 0.07, tone);
    g.roundRect(cx - R * 0.70, cy + R * 0.58, R * 0.30, R * 0.14, R * 0.05)
      .fill({ color: 0x2a3341 }).stroke({ width: R * 0.014, color: 0x0d141f });
    g.roundRect(cx - R * 0.30, cy + R * 0.20, R * 0.20, R * 0.12, R * 0.04)
      .fill({ color: 0x7d93ad }).stroke({ width: R * 0.014, color: 0x0d141f });
    for (let i = 0; i < 4; i++) {
      g.moveTo(cx - R * (0.86 - i * 0.20), cy + R * 0.34).lineTo(cx - R * (0.86 - i * 0.20), cy + R * 0.50)
        .stroke({ width: R * 0.014, color: 0x0d141f, alpha: 0.7 });
    }
    // Backblast.
    for (let i = 0; i < 5; i++) {
      const f = i / 5;
      g.circle(cx - R * (1.02 + f * 0.34), cy + R * (0.42 + (noise(i * 7) - 0.5) * 0.2),
        R * (0.14 - f * 0.05)).fill({ color: tone, alpha: 0.28 - f * 0.05 });
    }
    // The comet.
    meteor(g, cx + R * 0.46, cy - R * 0.42, -0.86, R * 1.15, R * 0.15, 0xffe9a3, tone, 0x7a2405);
    g.circle(cx + R * 0.46, cy - R * 0.42, R * 0.42).fill({ color: tone, alpha: 0.16 });
  },

  // RUNE BOLTS — an inscribed bolt in flight through a sigil ring.
  runeBolt(g, cx, cy, R, tone) {
    g.circle(cx, cy, R * 0.62).stroke({ width: R * 0.02, color: tone, alpha: 0.35 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.moveTo(cx + Math.cos(a) * R * 0.56, cy + Math.sin(a) * R * 0.56)
        .lineTo(cx + Math.cos(a) * R * 0.68, cy + Math.sin(a) * R * 0.68)
        .stroke({ width: R * 0.026, color: tone, alpha: 0.55 });
    }
    const x0 = cx - R * 0.86, y0 = cy + R * 0.74, x1 = cx + R * 0.80, y1 = cy - R * 0.70;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, px = -uy, py = ux;
    g.moveTo(x0, y0).lineTo(x1 - ux * R * 0.42, y1 - uy * R * 0.42)
      .stroke({ width: R * 0.06, color: 0x46586e });
    for (let i = 0; i < 5; i++) {
      const f = 0.16 + i * 0.15;
      g.moveTo(x0 + dx * f + px * R * 0.05, y0 + dy * f + py * R * 0.05)
        .lineTo(x0 + dx * (f + 0.05) - px * R * 0.05, y0 + dy * (f + 0.05) - py * R * 0.05)
        .stroke({ width: R * 0.018, color: tone, alpha: 0.9 });
    }
    blade(g, x1 - ux * R * 0.44, y1 - uy * R * 0.44, x1, y1, R * 0.09, 0xffffff, tone);
    for (const sgn of [-1, 1]) {
      g.moveTo(x0 + px * sgn * R * 0.03, y0 + py * sgn * R * 0.03)
        .lineTo(x0 - ux * R * 0.22 + px * sgn * R * 0.18, y0 - uy * R * 0.22 + py * sgn * R * 0.18)
        .lineTo(x0 - ux * R * 0.02, y0 - uy * R * 0.02).closePath()
        .fill({ color: 0x7d93ad, alpha: 0.9 });
    }
    g.circle(x1, y1, R * 0.30).fill({ color: tone, alpha: 0.22 });
  },

  // TORRENT CANNON — the Hydro Pistol grown into a braced two-hander.
  torrentCannon(g, cx, cy, R, tone) {
    const x = cx - R * 0.96, y = cy - R * 0.20;
    g.moveTo(x + R * 0.30, y + R * 0.30).lineTo(x + R * 0.62, y + R * 0.30)
      .lineTo(x + R * 0.48, y + R * 1.02).lineTo(x + R * 0.12, y + R * 1.02)
      .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.018, color: 0x0d141f });
    tube(g, x, y, R * 1.32, R * 0.40, R * 0.07, tone);
    for (const oy of [-0.26, -0.10]) {
      g.roundRect(x + R * 0.16, y + R * oy - R * 0.06, R * 0.62, R * 0.16, R * 0.08)
        .fill({ color: tone, alpha: 0.8 }).stroke({ width: R * 0.014, color: 0x0d141f });
      g.circle(x + R * 0.28, y + R * oy - R * 0.01, R * 0.03).fill({ color: 0xffffff, alpha: 0.8 });
    }
    g.roundRect(x + R * 1.28, y + R * 0.02, R * 0.30, R * 0.36, R * 0.06)
      .fill({ color: 0x7d93ad }).stroke({ width: R * 0.016, color: 0x0d141f });
    // Torrent.
    const mx = x + R * 1.60, my = y + R * 0.20;
    for (const [w, a] of [[0.46, 0.30], [0.30, 0.55], [0.15, 0.85]]) {
      g.moveTo(mx, my - R * w).quadraticCurveTo(mx + R * 0.5, my - R * w * 1.3, mx + R * 1.0, my - R * w * 0.4)
        .quadraticCurveTo(mx + R * 0.5, my + R * w * 1.3, mx, my + R * w)
        .closePath().fill({ color: tone, alpha: a });
    }
    for (let i = 0; i < 8; i++) {
      const f = 0.5 + noise(i * 5) * 0.7;
      g.circle(mx + R * f, my + (noise(i * 9) - 0.5) * R * 0.8, R * (0.06 - i * 0.004))
        .fill({ color: tone, alpha: 0.85 });
    }
  },

  // SOUL REAPER — the scythe doubled, a soul caught on the haft.
  soulReaper(g, cx, cy, R, tone) {
    const crescent = (A0, A1, OUT, IN, alpha) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const a = A0 + (A1 - A0) * (i / 24);
        pts.push(cx + Math.cos(a) * OUT, cy + Math.sin(a) * OUT);
      }
      for (let i = 24; i >= 0; i--) {
        const t = i / 24, a = A0 + (A1 - A0) * t;
        pts.push(cx + Math.cos(a) * (IN + (OUT - IN) * 0.7 * (1 - t)), cy + Math.sin(a) * (IN + (OUT - IN) * 0.7 * (1 - t)));
      }
      g.poly(pts).fill({ color: tone, alpha }).stroke({ width: R * 0.016, color: 0x0d141f, alpha: 0.95 });
      g.moveTo(cx + Math.cos(A0) * OUT, cy + Math.sin(A0) * OUT);
      for (let i = 1; i <= 24; i++) {
        const a = A0 + (A1 - A0) * (i / 24);
        g.lineTo(cx + Math.cos(a) * OUT, cy + Math.sin(a) * OUT);
      }
      g.stroke({ width: R * 0.026, color: 0xffffff, alpha: 0.8 });
    };
    crescent(-2.5, 0.2, R * 0.96, R * 0.66, 1);
    crescent(0.9, 3.5, R * 0.86, R * 0.60, 0.85);
    tube(g, cx - R * 0.05, cy - R * 0.5, R * 0.10, R * 1.0, R * 0.05, tone);
    // The soul.
    const sy = cy - R * 0.02;
    g.circle(cx, sy, R * 0.30).fill({ color: tone, alpha: 0.22 });
    g.moveTo(cx - R * 0.17, sy + R * 0.20)
      .quadraticCurveTo(cx - R * 0.19, sy - R * 0.22, cx, sy - R * 0.24)
      .quadraticCurveTo(cx + R * 0.19, sy - R * 0.22, cx + R * 0.17, sy + R * 0.20)
      .lineTo(cx + R * 0.09, sy + R * 0.13).lineTo(cx, sy + R * 0.21)
      .lineTo(cx - R * 0.09, sy + R * 0.13).closePath()
      .fill({ color: 0xffffff, alpha: 0.85 });
    g.circle(cx - R * 0.07, sy - R * 0.05, R * 0.035).fill({ color: 0x0d141f });
    g.circle(cx + R * 0.07, sy - R * 0.05, R * 0.035).fill({ color: 0x0d141f });
  },

  // INFERNO RING — the orbs fused into one closed ring of fire.
  infernoRing(g, cx, cy, R, tone) {
    g.circle(cx, cy, R * 0.92).fill({ color: tone, alpha: 0.10 });
    g.circle(cx, cy, R * 0.60).stroke({ width: R * 0.20, color: 0x7a2405, alpha: 0.95 });
    g.circle(cx, cy, R * 0.60).stroke({ width: R * 0.12, color: tone, alpha: 0.95 });
    g.circle(cx, cy, R * 0.60).stroke({ width: R * 0.04, color: 0xffe9a3, alpha: 0.9 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const h = R * (0.22 + noise(i * 7) * 0.30);
      const bx = cx + Math.cos(a) * R * 0.66, by = cy + Math.sin(a) * R * 0.66;
      const tx = cx + Math.cos(a + 0.12) * (R * 0.66 + h), ty = cy + Math.sin(a + 0.12) * (R * 0.66 + h);
      g.moveTo(bx + Math.cos(a + 1.57) * R * 0.07, by + Math.sin(a + 1.57) * R * 0.07)
        .quadraticCurveTo(cx + Math.cos(a + 0.3) * R * 0.8, cy + Math.sin(a + 0.3) * R * 0.8, tx, ty)
        .quadraticCurveTo(cx + Math.cos(a - 0.1) * R * 0.78, cy + Math.sin(a - 0.1) * R * 0.78,
          bx - Math.cos(a + 1.57) * R * 0.07, by - Math.sin(a + 1.57) * R * 0.07)
        .closePath().fill({ color: i % 2 ? tone : 0xffe9a3, alpha: 0.85 });
    }
    for (let i = 0; i < 10; i++) {
      const a = noise(i * 11 + 3) * TAU, d = 0.95 + noise(i * 5) * 0.3;
      g.circle(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d, R * (0.03 + noise(i * 3) * 0.03))
        .fill({ color: 0xffe9a3, alpha: 0.6 + noise(i * 7) * 0.4 });
    }
  },

  // STORM ARRAY — a volley of bolts with lightning arcing between them.
  stormArray(g, cx, cy, R, tone) {
    const B = [[-0.86, -0.80, 0.86], [-0.10, -0.52, 0.80], [0.44, 0.10, 0.72]];
    const tips = [];
    for (let i = 0; i < B.length; i++) {
      const [ox, oy, len] = B[i];
      const x0 = cx + ox * R, y0 = cy + oy * R;
      const x1 = x0 + R * len * 0.78, y1 = y0 + R * len * 0.72;
      const ux = (x1 - x0) / (R * len), uy = (y1 - y0) / (R * len);
      const px = -uy, py = ux;
      g.moveTo(x0, y0).lineTo(x1 - ux * R * 0.24, y1 - uy * R * 0.24)
        .stroke({ width: R * 0.045, color: 0x46586e });
      blade(g, x1 - ux * R * 0.26, y1 - uy * R * 0.26, x1, y1, R * 0.07, 0xffffff, tone);
      for (const sgn of [-1, 1]) {
        g.moveTo(x0, y0).lineTo(x0 - ux * R * 0.20 + px * sgn * R * 0.14, y0 - uy * R * 0.20 + py * sgn * R * 0.14)
          .lineTo(x0 + ux * R * 0.04, y0 + uy * R * 0.04).closePath()
          .fill({ color: 0x7d93ad, alpha: 0.9 });
      }
      tips.push([x1, y1]);
    }
    for (let i = 0; i < tips.length - 1; i++) {
      arc(g, tips[i][0], tips[i][1], tips[i + 1][0], tips[i + 1][1], R * 0.22, i + 71, 0xffffff, tone, R * 0.015);
    }
    for (const [tx, ty] of tips) g.circle(tx, ty, R * 0.22).fill({ color: tone, alpha: 0.20 });
  },

  // BLIZZARD — driven snow: a big flake with wind lines and a scatter of small
  // ones being carried past.
  blizzard(g, cx, cy, R, tone) {
    for (let i = 0; i < 5; i++) {
      const y = cy - R * 0.8 + i * R * 0.4;
      g.moveTo(cx - R * 1.0, y)
        .quadraticCurveTo(cx - R * 0.2, y - R * 0.14, cx + R * 0.9, y + R * 0.06)
        .stroke({ width: R * 0.022, color: tone, alpha: 0.20 + i * 0.05 });
    }
    const fx = cx + R * 0.18, fy = cy - R * 0.06, fr = R * 0.62;
    g.circle(fx, fy, fr * 1.5).fill({ color: tone, alpha: 0.12 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.moveTo(fx, fy).lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr)
        .stroke({ width: R * 0.045, color: tone, alpha: 0.95 });
      g.moveTo(fx, fy).lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr)
        .stroke({ width: R * 0.016, color: 0xffffff, alpha: 0.8 });
      for (const s of [0.42, 0.68]) {
        const bx = fx + Math.cos(a) * fr * s, by = fy + Math.sin(a) * fr * s;
        for (const d of [-0.6, 0.6]) {
          g.moveTo(bx, by).lineTo(bx + Math.cos(a + d) * fr * 0.24, by + Math.sin(a + d) * fr * 0.24)
            .stroke({ width: R * 0.024, color: tone, alpha: 0.9 });
        }
      }
    }
    g.circle(fx, fy, fr * 0.16).fill({ color: 0xffffff, alpha: 0.95 });
    for (let i = 0; i < 12; i++) {
      const x = cx - R + noise(i * 7 + 1) * R * 2;
      const y = cy - R + noise(i * 11 + 3) * R * 2;
      const rr = R * (0.02 + noise(i * 5) * 0.035);
      g.circle(x, y, rr).fill({ color: 0xffffff, alpha: 0.4 + noise(i * 13) * 0.5 });
    }
  },

  // BLADE STORM — the dagger fan gone circular.
  bladeStorm(g, cx, cy, R, tone) {
    g.circle(cx, cy, R * 0.86).fill({ color: tone, alpha: 0.08 });
    for (let i = 0; i < 4; i++) {
      g.circle(cx, cy, R * (0.36 + i * 0.16))
        .stroke({ width: R * 0.014, color: tone, alpha: 0.20 - i * 0.03 });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const inR = R * 0.34, outR = R * (0.78 + (i % 2) * 0.14);
      const bx = cx + Math.cos(a) * inR, by = cy + Math.sin(a) * inR;
      const tx = cx + Math.cos(a + 0.22) * outR, ty = cy + Math.sin(a + 0.22) * outR;
      // Motion trail behind each blade, along the spin.
      g.moveTo(cx + Math.cos(a - 0.30) * inR, cy + Math.sin(a - 0.30) * inR)
        .quadraticCurveTo(cx + Math.cos(a - 0.15) * outR * 0.9, cy + Math.sin(a - 0.15) * outR * 0.9, tx, ty)
        .stroke({ width: R * 0.05, color: tone, alpha: 0.18 });
      blade(g, bx, by, tx, ty, R * 0.055, 0xffffff, i % 2 ? tone : 0x7d93ad);
    }
    g.circle(cx, cy, R * 0.20).fill({ color: 0x1a2230 }).stroke({ width: R * 0.02, color: tone, alpha: 0.9 });
    g.circle(cx, cy, R * 0.09).fill({ color: 0xffffff, alpha: 0.85 });
  },

  // ANNUNAKI PULSE — a winged relic disc throwing expanding rings.
  annunakiDisc(g, cx, cy, R, tone) {
    for (let i = 4; i >= 1; i--) {
      corona(g, cx, cy, R * (0.34 + i * 0.16), tone, 0.055 * (5 - i) / 4, 0.03, 0.02);
      g.circle(cx, cy, R * (0.34 + i * 0.16))
        .stroke({ width: R * 0.014, color: tone, alpha: 0.30 - i * 0.05 });
    }
    // Wings, swept back from the disc.
    for (const sx of [-1, 1]) {
      g.moveTo(cx + sx * R * 0.24, cy - R * 0.04)
        .quadraticCurveTo(cx + sx * R * 0.66, cy - R * 0.30, cx + sx * R * 0.96, cy - R * 0.14)
        .quadraticCurveTo(cx + sx * R * 0.64, cy + R * 0.06, cx + sx * R * 0.24, cy + R * 0.10)
        .closePath().fill({ color: 0x46586e })
        .stroke({ width: R * 0.016, color: 0x0d141f, alpha: 0.9 });
      for (let k = 0; k < 4; k++) {
        g.moveTo(cx + sx * R * (0.34 + k * 0.16), cy - R * 0.02)
          .lineTo(cx + sx * R * (0.30 + k * 0.16), cy + R * 0.08)
          .stroke({ width: R * 0.012, color: 0x7d93ad, alpha: 0.8 });
      }
    }
    sphere(g, cx, cy, R * 0.28, 0.5, -0.7, 0x2a1a10, tone);
    glint(g, cx, cy, R * 0.28, 0.5, -0.7, 1);
    g.circle(cx, cy, R * 0.11).fill({ color: 0x0d141f, alpha: 0.85 });
    g.circle(cx, cy, R * 0.05).fill({ color: 0xffffff, alpha: 0.9 });
  },

  // VOID BEAM — an emitter firing a black lance with a lit rim. The beam is
  // darker than the card, which is what makes it read as void and not laser.
  beam(g, cx, cy, R, tone) {
    const ey = cy;
    tube(g, cx - R * 0.96, ey - R * 0.26, R * 0.42, R * 0.52, R * 0.06, tone);
    g.roundRect(cx - R * 0.86, ey - R * 0.15, R * 0.22, R * 0.12, R * 0.04)
      .fill({ color: tone, alpha: 0.9 });
    g.roundRect(cx - R * 0.86, ey + R * 0.03, R * 0.22, R * 0.12, R * 0.04)
      .fill({ color: 0x0d141f, alpha: 0.8 });
    // Focusing horn.
    g.moveTo(cx - R * 0.54, ey - R * 0.30).lineTo(cx - R * 0.30, ey - R * 0.17)
      .lineTo(cx - R * 0.30, ey + R * 0.17).lineTo(cx - R * 0.54, ey + R * 0.30)
      .closePath().fill({ color: 0x7d93ad }).stroke({ width: R * 0.016, color: 0x0d141f });
    // The lance.
    g.moveTo(cx - R * 0.30, ey - R * 0.15).lineTo(cx + R * 1.0, ey - R * 0.20)
      .lineTo(cx + R * 1.0, ey + R * 0.20).lineTo(cx - R * 0.30, ey + R * 0.15)
      .closePath().fill({ color: 0x05020c });
    g.moveTo(cx - R * 0.30, ey - R * 0.15).lineTo(cx + R * 1.0, ey - R * 0.20)
      .stroke({ width: R * 0.035, color: tone, alpha: 0.95 });
    g.moveTo(cx - R * 0.30, ey + R * 0.15).lineTo(cx + R * 1.0, ey + R * 0.20)
      .stroke({ width: R * 0.035, color: tone, alpha: 0.95 });
    g.moveTo(cx - R * 0.30, ey).lineTo(cx + R * 1.0, ey)
      .stroke({ width: R * 0.012, color: 0xffffff, alpha: 0.5 });
    g.circle(cx - R * 0.28, ey, R * 0.30).fill({ color: tone, alpha: 0.20 });
    for (let i = 0; i < 10; i++) {
      const f = noise(i * 5 + 3);
      g.circle(cx + R * (-0.1 + f * 1.05), ey + (noise(i * 9) - 0.5) * R * 0.7, R * 0.022)
        .fill({ color: tone, alpha: 0.35 + f * 0.5 });
    }
  },

  // DESERT EAGLE — a heavy sidearm mid-discharge: slab slide, muzzle brake,
  // a real flash and the case ejecting.
  cannon(g, cx, cy, R, tone) {
    const x = cx - R * 0.86, y = cy - R * 0.20;
    g.moveTo(x + R * 0.34, y + R * 0.30).lineTo(x + R * 0.64, y + R * 0.30)
      .lineTo(x + R * 0.50, y + R * 1.00).lineTo(x + R * 0.16, y + R * 1.00)
      .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.018, color: 0x0d141f });
    for (let i = 0; i < 5; i++) {
      g.moveTo(x + R * (0.22 - i * 0.01), y + R * (0.44 + i * 0.10))
        .lineTo(x + R * (0.58 - i * 0.01), y + R * (0.44 + i * 0.10))
        .stroke({ width: R * 0.014, color: 0x7d93ad, alpha: 0.7 });
    }
    g.moveTo(x + R * 0.64, y + R * 0.32)
      .quadraticCurveTo(x + R * 0.90, y + R * 0.66, x + R * 0.58, y + R * 0.64)
      .stroke({ width: R * 0.03, color: 0x46586e });
    tube(g, x, y, R * 1.24, R * 0.34, R * 0.05, tone);
    g.roundRect(x + R * 0.10, y + R * 0.06, R * 0.72, R * 0.06, R * 0.02)
      .fill({ color: 0x7d93ad, alpha: 0.7 });
    g.roundRect(x + R * 0.22, y + R * 0.16, R * 0.28, R * 0.08, R * 0.02)
      .fill({ color: 0x0d141f, alpha: 0.9 });
    // Muzzle brake.
    g.roundRect(x + R * 1.20, y + R * 0.02, R * 0.34, R * 0.30, R * 0.03)
      .fill({ color: 0x7d93ad }).stroke({ width: R * 0.016, color: 0x0d141f });
    g.rect(x + R * 1.27, y + R * 0.07, R * 0.05, R * 0.20).fill({ color: 0x0d141f });
    g.rect(x + R * 1.39, y + R * 0.07, R * 0.05, R * 0.20).fill({ color: 0x0d141f });
    // Flash and ejected case.
    const fx = x + R * 1.58, fy = y + R * 0.17;
    g.circle(fx, fy, R * 0.34).fill({ color: tone, alpha: 0.28 });
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + i * 0.3;
      g.moveTo(fx, fy).lineTo(fx + Math.cos(a) * R * (0.20 + noise(i * 7) * 0.28),
        fy + Math.sin(a) * R * (0.20 + noise(i * 7) * 0.28))
        .stroke({ width: R * 0.03, color: i % 2 ? 0xffffff : tone, alpha: 0.85 });
    }
    g.circle(fx - R * 0.02, fy, R * 0.13).fill({ color: 0xffffff, alpha: 0.9 });
    g.roundRect(x + R * 0.60, y - R * 0.40, R * 0.10, R * 0.20, R * 0.04)
      .fill({ color: 0xffcf7a }).stroke({ width: R * 0.012, color: 0x0d141f });
  },

  // TIDEWOOD BOW — drawn, arrow nocked, string taut.
  bow(g, cx, cy, R, tone) {
    const bx = cx - R * 0.18;
    // Limb, thick at the grip and tapering to the tips.
    for (const [w, col, a] of [[0.13, 0x2a3341, 1], [0.07, 0x7d93ad, 0.85]]) {
      g.moveTo(bx - R * 0.10, cy - R * 0.92)
        .quadraticCurveTo(bx + R * 0.62, cy, bx - R * 0.10, cy + R * 0.92)
        .stroke({ width: R * w, color: col, alpha: a });
    }
    // Grain.
    for (let i = 0; i < 5; i++) {
      const t = 0.2 + i * 0.15;
      g.circle(bx + R * 0.38 * Math.sin(t * Math.PI), cy - R * 0.9 + R * 1.8 * t, R * 0.012)
        .fill({ color: 0x0d141f, alpha: 0.6 });
    }
    // String, pulled to the nock.
    g.moveTo(bx - R * 0.10, cy - R * 0.92).lineTo(bx - R * 0.52, cy)
      .lineTo(bx - R * 0.10, cy + R * 0.92)
      .stroke({ width: R * 0.02, color: 0xe8e2d0, alpha: 0.9 });
    // Arrow.
    blade(g, bx - R * 0.30, cy, bx + R * 0.96, cy, R * 0.06, 0xffffff, tone);
    g.moveTo(bx - R * 0.52, cy).lineTo(bx - R * 0.30, cy)
      .stroke({ width: R * 0.035, color: 0x46586e });
    for (const sy of [-1, 1]) {
      g.moveTo(bx - R * 0.50, cy).lineTo(bx - R * 0.30, cy + sy * R * 0.16)
        .lineTo(bx - R * 0.18, cy).closePath()
        .fill({ color: tone, alpha: 0.8 });
    }
    g.circle(bx + R * 0.96, cy, R * 0.20).fill({ color: tone, alpha: 0.22 });
  },

  // CHAIN LIGHTNING — three struck points with the discharge jumping between.
  caster(g, cx, cy, R, tone) {
    const P = [[-0.80, -0.62], [0.02, 0.04], [0.80, 0.66]];
    for (let i = 0; i < P.length - 1; i++) {
      arc(g, cx + P[i][0] * R, cy + P[i][1] * R,
        cx + P[i + 1][0] * R, cy + P[i + 1][1] * R, R * 0.26, i + 21, 0xffffff, tone, R * 0.020);
    }
    for (let i = 0; i < P.length; i++) {
      const x = cx + P[i][0] * R, y = cy + P[i][1] * R;
      const rr = R * (0.13 - i * 0.008);
      g.circle(x, y, rr * 2.6).fill({ color: tone, alpha: 0.16 });
      sphere(g, x, y, rr, 0.5, -0.7, 0x30240a, tone);
      g.circle(x - rr * 0.3, y - rr * 0.3, rr * 0.3).fill({ color: 0xffffff, alpha: 0.85 });
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + i;
        g.moveTo(x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr * 1.2)
          .lineTo(x + Math.cos(a) * rr * (1.8 + noise(k * 3 + i) * 0.8),
            y + Math.sin(a) * rr * (1.8 + noise(k * 3 + i) * 0.8))
          .stroke({ width: R * 0.012, color: tone, alpha: 0.55 });
      }
    }
  },

  // DRONE SQUADRON — a lead drone and two wingmen, rotors blurred, each lit.
  drone(g, cx, cy, R, tone) {
    const unit = (x, y, s) => {
      g.ellipse(x, y + R * 0.02, R * 0.34 * s, R * 0.09 * s).fill({ color: 0x02060f, alpha: 0.45 });
      for (const ox of [-1, 1]) {
        g.ellipse(x + ox * R * 0.30 * s, y - R * 0.20 * s, R * 0.24 * s, R * 0.05 * s)
          .fill({ color: tone, alpha: 0.45 });
        g.moveTo(x + ox * R * 0.10 * s, y - R * 0.06 * s)
          .lineTo(x + ox * R * 0.30 * s, y - R * 0.18 * s)
          .stroke({ width: R * 0.03 * s, color: 0x46586e });
      }
      g.moveTo(x, y - R * 0.20 * s).lineTo(x + R * 0.26 * s, y)
        .lineTo(x, y + R * 0.20 * s).lineTo(x - R * 0.26 * s, y)
        .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.018 * s, color: 0x0d141f });
      g.moveTo(x, y - R * 0.20 * s).lineTo(x + R * 0.26 * s, y).lineTo(x, y)
        .closePath().fill({ color: 0x7d93ad, alpha: 0.45 });
      g.circle(x, y, R * 0.09 * s).fill({ color: tone });
      g.circle(x, y, R * 0.04 * s).fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(x, y, R * 0.22 * s).fill({ color: tone, alpha: 0.18 });
    };
    unit(cx, cy - R * 0.30, 1.15);
    unit(cx - R * 0.62, cy + R * 0.42, 0.8);
    unit(cx + R * 0.62, cy + R * 0.42, 0.8);
  },

  // PLASMA TURRET — a deployed emplacement with a charged barrel.
  turret(g, cx, cy, R, tone) {
    const by = cy + R * 0.62;
    g.ellipse(cx, by + R * 0.14, R * 0.62, R * 0.14, 0).fill({ color: 0x02060f, alpha: 0.55 });
    for (const ox of [-1, 0, 1]) {
      g.moveTo(cx + ox * R * 0.10, by - R * 0.10)
        .lineTo(cx + ox * R * 0.52, by + R * 0.14)
        .stroke({ width: R * 0.05, color: 0x46586e });
    }
    g.moveTo(cx - R * 0.34, by - R * 0.06).lineTo(cx - R * 0.22, by - R * 0.34)
      .lineTo(cx + R * 0.22, by - R * 0.34).lineTo(cx + R * 0.34, by - R * 0.06)
      .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.02, color: 0x0d141f });
    tube(g, cx - R * 0.16, by - R * 0.86, R * 0.32, R * 0.54, R * 0.06, tone);
    // Charged muzzle.
    const mx = cx, my = by - R * 0.92;
    g.circle(mx, my, R * 0.36).fill({ color: tone, alpha: 0.20 });
    g.circle(mx, my, R * 0.19).fill({ color: tone, alpha: 0.85 });
    g.circle(mx, my, R * 0.09).fill({ color: 0xffffff });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.moveTo(mx + Math.cos(a) * R * 0.22, my + Math.sin(a) * R * 0.22)
        .lineTo(mx + Math.cos(a) * R * 0.40, my + Math.sin(a) * R * 0.40)
        .stroke({ width: R * 0.016, color: tone, alpha: 0.6 });
    }
    g.circle(cx, by - R * 0.24, R * 0.07).fill({ color: tone, alpha: 0.9 });
  },

  // SHRAPNEL MINE — a spiked casing with a live trigger, sitting in its own
  // scatter of loose fragments.
  mine(g, cx, cy, R, tone) {
    g.ellipse(cx, cy + R * 0.62, R * 0.5, R * 0.12).fill({ color: 0x02060f, alpha: 0.55 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      g.moveTo(cx + Math.cos(a) * R * 0.42, cy + Math.sin(a) * R * 0.42)
        .lineTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78)
        .stroke({ width: R * 0.055, color: 0x46586e });
      g.circle(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78, R * 0.04)
        .fill({ color: 0x7d93ad });
    }
    sphere(g, cx, cy, R * 0.44, 0.5, -0.7, 0x1e2733, 0x7d93ad);
    for (let i = 0; i < 4; i++) {
      g.moveTo(cx - R * 0.40, cy - R * 0.20 + i * R * 0.14)
        .lineTo(cx + R * 0.40, cy - R * 0.20 + i * R * 0.14)
        .stroke({ width: R * 0.012, color: 0x0d141f, alpha: 0.5 });
    }
    g.circle(cx, cy, R * 0.30).fill({ color: tone, alpha: 0.18 });
    g.circle(cx, cy, R * 0.15).fill({ color: tone });
    g.circle(cx, cy, R * 0.07).fill({ color: 0xffffff, alpha: 0.9 });
    for (let i = 0; i < 6; i++) {
      const a = noise(i * 13 + 5) * TAU, d = 0.9 + noise(i * 17) * 0.3;
      g.rect(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d, R * 0.05, R * 0.03)
        .fill({ color: 0x7d93ad, alpha: 0.7 });
    }
  },

  // TWIN REVOLVERS — two, crossed, cylinders and hammers readable.
  revolvers(g, cx, cy, R, tone) {
    const gun = (x, y, flip) => {
      const s = flip ? -1 : 1;
      g.moveTo(x, y + R * 0.10 * s).lineTo(x + s * R * 0.30, y + R * 0.10 * s)
        .lineTo(x + s * R * 0.20, y + R * 0.58 * s).lineTo(x - s * R * 0.06, y + R * 0.58 * s)
        .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.016, color: 0x0d141f });
      g.moveTo(x + s * R * 0.30, y + R * 0.12 * s)
        .quadraticCurveTo(x + s * R * 0.50, y + R * 0.38 * s, x + s * R * 0.26, y + R * 0.36 * s)
        .stroke({ width: R * 0.024, color: 0x46586e });
      // Cylinder.
      g.circle(x + s * R * 0.34, y, R * 0.17).fill({ color: 0x7d93ad })
        .stroke({ width: R * 0.018, color: 0x0d141f });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        g.circle(x + s * R * 0.34 + Math.cos(a) * R * 0.10, y + Math.sin(a) * R * 0.10, R * 0.032)
          .fill({ color: 0x0d141f, alpha: 0.9 });
      }
      g.circle(x + s * R * 0.34, y, R * 0.05).fill({ color: 0x2a3341 });
      // Barrel with a rib and a bright top edge.
      g.roundRect(x + s * (flip ? -R * 1.08 : R * 0.50), y - R * 0.10, R * 0.58, R * 0.20, R * 0.03)
        .fill({ color: 0x46586e }).stroke({ width: R * 0.016, color: 0x0d141f });
      g.moveTo(x + s * (flip ? -R * 1.04 : R * 0.54), y - R * 0.07)
        .lineTo(x + s * (flip ? -R * 0.56 : R * 1.02), y - R * 0.07)
        .stroke({ width: R * 0.024, color: 0x7d93ad, alpha: 0.9 });
      // Hammer.
      g.moveTo(x + s * R * 0.18, y - R * 0.12).lineTo(x + s * R * 0.24, y - R * 0.24)
        .lineTo(x + s * R * 0.32, y - R * 0.16).closePath().fill({ color: 0x7d93ad });
      g.circle(x + s * (flip ? -R * 1.12 : R * 1.10), y, R * 0.22).fill({ color: tone, alpha: 0.28 });
    };
    gun(cx - R * 0.36, cy - R * 0.38, false);
    gun(cx + R * 0.36, cy + R * 0.38, true);
  },

  // VOID SCATTERGUN — a stubby shotgun throwing a cone of dark pellets.
  scatter(g, cx, cy, R, tone) {
    const x = cx - R * 0.94, y = cy - R * 0.14;
    g.moveTo(x + R * 0.20, y + R * 0.26).lineTo(x + R * 0.50, y + R * 0.26)
      .lineTo(x + R * 0.36, y + R * 0.86).lineTo(x + R * 0.04, y + R * 0.86)
      .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.018, color: 0x0d141f });
    tube(g, x, y, R * 0.92, R * 0.28, R * 0.05, tone);
    g.roundRect(x + R * 0.10, y + R * 0.28, R * 0.44, R * 0.12, R * 0.04)
      .fill({ color: 0x46586e }).stroke({ width: R * 0.014, color: 0x0d141f });
    g.roundRect(x + R * 0.86, y - R * 0.02, R * 0.24, R * 0.32, R * 0.04)
      .fill({ color: 0x7d93ad }).stroke({ width: R * 0.016, color: 0x0d141f });
    // Cone.
    const mx = x + R * 1.12, my = y + R * 0.14;
    g.moveTo(mx, my).lineTo(cx + R * 1.02, cy - R * 0.66)
      .lineTo(cx + R * 1.02, cy + R * 0.62).closePath()
      .fill({ color: tone, alpha: 0.14 });
    for (let i = 0; i < 11; i++) {
      const f = 0.2 + noise(i * 7 + 1) * 0.8;
      const sp = (noise(i * 11 + 3) - 0.5) * 1.1 * f;
      const px2 = mx + (cx + R * 1.0 - mx) * f, py2 = my + sp * R;
      const rr = R * (0.055 - f * 0.02);
      g.circle(px2, py2, rr * 2.2).fill({ color: tone, alpha: 0.18 });
      g.circle(px2, py2, rr).fill({ color: 0x05020c });
      g.circle(px2, py2, rr).stroke({ width: R * 0.012, color: tone, alpha: 0.9 });
    }
  },

  // WHIRLWIND — a funnel that narrows toward the ground, with blades caught in
  // the spin and debris pulled off the floor.
  whirlwind(g, cx, cy, R, tone) {
    const top = cy - R * 0.92, bot = cy + R * 0.86;
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const y = top + (bot - top) * t;
      const w = R * (0.92 - t * 0.74);
      g.ellipse(cx + Math.sin(t * 5) * R * 0.06, y, w, w * 0.20)
        .stroke({ width: R * (0.045 - t * 0.02), color: tone, alpha: 0.30 + t * 0.45 });
    }
    g.moveTo(cx - R * 0.92, top).quadraticCurveTo(cx - R * 0.20, cy, cx - R * 0.18, bot)
      .stroke({ width: R * 0.02, color: 0xffffff, alpha: 0.35 });
    g.moveTo(cx + R * 0.92, top).quadraticCurveTo(cx + R * 0.20, cy, cx + R * 0.18, bot)
      .stroke({ width: R * 0.02, color: 0xffffff, alpha: 0.25 });
    // Blades caught in it.
    blade(g, cx - R * 0.70, cy - R * 0.52, cx - R * 0.20, cy - R * 0.72, R * 0.055, 0xffffff, 0x7d93ad);
    blade(g, cx + R * 0.66, cy - R * 0.06, cx + R * 0.18, cy - R * 0.22, R * 0.05, 0xffffff, 0x7d93ad);
    blade(g, cx - R * 0.44, cy + R * 0.44, cx - R * 0.06, cy + R * 0.30, R * 0.042, 0xffffff, 0x7d93ad);
    g.ellipse(cx, bot + R * 0.06, R * 0.32, R * 0.08).fill({ color: 0x02060f, alpha: 0.55 });
    for (let i = 0; i < 8; i++) {
      const a = noise(i * 5 + 2) * TAU;
      g.rect(cx + Math.cos(a) * R * (0.5 + noise(i * 9) * 0.5),
        bot - R * noise(i * 13) * 0.5, R * 0.04, R * 0.025)
        .fill({ color: tone, alpha: 0.5 });
    }
  },

  // STORM LANCE — a thrown spear with the discharge running its shaft.
  harpoon(g, cx, cy, R, tone) {
    const x0 = cx - R * 0.84, y0 = cy + R * 0.86;
    const x1 = cx + R * 0.78, y1 = cy - R * 0.82;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, px = -uy, py = ux;
    tube(g, x0, y0 - R * 0.05, R * 0.10, R * 0.10, R * 0.03, tone);
    g.moveTo(x0, y0).lineTo(x1 - ux * R * 0.42, y1 - uy * R * 0.42)
      .stroke({ width: R * 0.075, color: 0x46586e });
    g.moveTo(x0, y0).lineTo(x1 - ux * R * 0.42, y1 - uy * R * 0.42)
      .stroke({ width: R * 0.022, color: 0x7d93ad, alpha: 0.85 });
    blade(g, x1 - ux * R * 0.44, y1 - uy * R * 0.44, x1, y1, R * 0.10, 0xffffff, tone);
    // Barbs.
    for (const sgn of [-1, 1]) {
      g.moveTo(x1 - ux * R * 0.40 + px * sgn * R * 0.07, y1 - uy * R * 0.40 + py * sgn * R * 0.07)
        .lineTo(x1 - ux * R * 0.62 + px * sgn * R * 0.22, y1 - uy * R * 0.62 + py * sgn * R * 0.22)
        .lineTo(x1 - ux * R * 0.30 + px * sgn * R * 0.05, y1 - uy * R * 0.30 + py * sgn * R * 0.05)
        .closePath().fill({ color: tone, alpha: 0.9 }).stroke({ width: R * 0.014, color: 0x0d141f });
    }
    // Discharge along the shaft.
    for (let i = 0; i < 3; i++) {
      const f0 = 0.16 + i * 0.24, f1 = f0 + 0.18;
      arc(g, x0 + dx * f0, y0 + dy * f0, x0 + dx * f1, y0 + dy * f1,
        R * 0.16, i + 41, 0xffffff, tone, R * 0.013);
    }
    g.circle(x1, y1, R * 0.30).fill({ color: tone, alpha: 0.22 });
  },

  // FROST ORB — three iced spheres on an orbit, each properly terminated, with
  // frost spikes and a cold trail behind. The orbit ellipse passes in front of
  // the near orb and behind the far one, which is what sells the depth.
  frostOrb(g, cx, cy, R, tone) {
    const lx = 0.52, ly = -0.72;
    g.ellipse(cx, cy, R * 0.86, R * 0.34)
      .stroke({ width: R * 0.02, color: tone, alpha: 0.30 });
    const ORBS = [[-0.74, 0.14, 0.20], [0.30, -0.26, 0.15], [0.66, 0.24, 0.26]];
    for (let i = 0; i < ORBS.length; i++) {
      const [ox, oy, r] = ORBS[i];
      const x = cx + ox * R, y = cy + oy * R, rr = R * r;
      // Cold trail, trailing the direction of travel.
      for (let k = 1; k <= 4; k++) {
        g.circle(x - ox * R * 0.10 * k, y - oy * R * 0.10 * k, rr * (1 - k * 0.17))
          .fill({ color: tone, alpha: 0.09 - k * 0.017 });
      }
      g.circle(x, y, rr * 1.7).fill({ color: tone, alpha: 0.10 });
      sphere(g, x, y, rr, lx, ly, 0x123048, tone);
      glint(g, x, y, rr, lx, ly, 0.9);
      // Frost spikes off the rim.
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + i;
        const l = rr * (1.25 + noise(k * 5 + i) * 0.6);
        g.moveTo(x + Math.cos(a) * rr * 0.9, y + Math.sin(a) * rr * 0.9)
          .lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
          .stroke({ width: rr * 0.16, color: k % 2 ? 0xffffff : tone, alpha: 0.75 });
      }
    }
    g.ellipse(cx, cy, R * 0.86, R * 0.34)
      .stroke({ width: R * 0.012, color: 0xffffff, alpha: 0.22 });
  },

  // ARC TESLA — a coil that is actually discharging: stacked windings, a
  // terminal sphere, and four real forked arcs leaving it for grounded rods.
  arcTesla(g, cx, cy, R, tone) {
    const bx = cx, by = cy + R * 0.58;
    g.ellipse(bx, by + R * 0.10, R * 0.42, R * 0.11).fill({ color: 0x02060f, alpha: 0.6 });
    g.moveTo(bx - R * 0.30, by + R * 0.10).lineTo(bx - R * 0.18, by - R * 0.12)
      .lineTo(bx + R * 0.18, by - R * 0.12).lineTo(bx + R * 0.30, by + R * 0.10)
      .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.02, color: 0x0d141f });
    g.moveTo(bx - R * 0.16, by - R * 0.09).lineTo(bx + R * 0.16, by - R * 0.09)
      .stroke({ width: R * 0.02, color: 0xffffff, alpha: 0.20 });
    for (let i = 0; i < 5; i++) {
      tube(g, bx - R * 0.16, by - R * 0.16 - i * R * 0.11, R * 0.32, R * 0.09, R * 0.03, tone);
    }
    const tx = cx, ty = cy - R * 0.28, tr = R * 0.24;
    g.circle(tx, ty, tr * 2.4).fill({ color: tone, alpha: 0.12 });
    sphere(g, tx, ty, tr, 0.45, -0.7, 0x1b2a3a, tone);
    glint(g, tx, ty, tr, 0.45, -0.7, 1);
    const RODS = [[-0.86, -0.52], [0.86, -0.44], [-0.62, 0.30], [0.66, 0.24]];
    for (let i = 0; i < RODS.length; i++) {
      const [ex, ey] = RODS[i];
      const x = cx + ex * R, y = cy + ey * R;
      arc(g, tx, ty, x, y, R * 0.20, i + 3, 0xffffff, tone, R * 0.018);
      g.circle(x, y, R * 0.05).fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(x, y, R * 0.11).fill({ color: tone, alpha: 0.30 });
    }
  },

  // RAILGUN ARRAY — twin rails with current jumping the gap, a slug already
  // away and a Mach cone behind it.
  railgunArray(g, cx, cy, R, tone) {
    const y0 = cy - R * 0.40, y1 = cy + R * 0.40;
    tube(g, cx - R * 0.92, y0 - R * 0.10, R * 1.55, R * 0.20, R * 0.06, tone);
    tube(g, cx - R * 0.92, y1 - R * 0.10, R * 1.55, R * 0.20, R * 0.06, tone);
    // Breech.
    g.roundRect(cx - R * 0.98, y0, R * 0.34, R * 0.80, R * 0.05)
      .fill({ color: 0x2a3341 }).stroke({ width: R * 0.02, color: 0x0d141f });
    g.moveTo(cx - R * 0.94, y0 + R * 0.04).lineTo(cx - R * 0.68, y0 + R * 0.04)
      .stroke({ width: R * 0.018, color: 0xffffff, alpha: 0.22 });
    g.roundRect(cx - R * 0.94, y0 + R * 0.06, R * 0.10, R * 0.68, R * 0.03)
      .fill({ color: tone, alpha: 0.7 });
    // Current jumping between the rails, brighter toward the muzzle.
    for (let i = 0; i < 4; i++) {
      const x = cx - R * 0.55 + i * R * 0.30;
      arc(g, x, y0, x, y1, R * 0.10, i + 11, 0xffffff, tone, R * 0.012 * (1 + i * 0.15));
    }
    // Mach cone and slug.
    const sx = cx + R * 0.62;
    g.moveTo(sx - R * 0.05, cy).lineTo(sx - R * 0.55, cy - R * 0.34)
      .lineTo(sx - R * 0.55, cy + R * 0.34).closePath()
      .fill({ color: tone, alpha: 0.16 });
    g.moveTo(sx + R * 0.30, cy).lineTo(sx - R * 0.06, cy - R * 0.14)
      .lineTo(sx - R * 0.06, cy + R * 0.14).closePath()
      .fill({ color: tone }).stroke({ width: R * 0.018, color: 0x0d141f });
    g.moveTo(sx + R * 0.30, cy).lineTo(sx - R * 0.06, cy - R * 0.14)
      .stroke({ width: R * 0.02, color: 0xffffff, alpha: 0.9 });
    g.circle(sx + R * 0.34, cy, R * 0.20).fill({ color: 0xffffff, alpha: 0.35 });
  },

  // HYDRO PISTOL — a sidearm with a real slide, grip checkering and a
  // pressurised jet leaving the muzzle, breaking into droplets.
  pistol(g, cx, cy, R, tone) {
    const x = cx - R * 0.72, y = cy - R * 0.22;
    // Grip, angled back.
    g.moveTo(x + R * 0.30, y + R * 0.28).lineTo(x + R * 0.56, y + R * 0.28)
      .lineTo(x + R * 0.44, y + R * 0.96).lineTo(x + R * 0.14, y + R * 0.96)
      .closePath().fill({ color: 0x2a3341 }).stroke({ width: R * 0.02, color: 0x0d141f });
    g.moveTo(x + R * 0.31, y + R * 0.32).lineTo(x + R * 0.17, y + R * 0.90)
      .stroke({ width: R * 0.02, color: 0xffffff, alpha: 0.14 });
    for (let i = 0; i < 5; i++) {
      g.moveTo(x + R * (0.20 - i * 0.012), y + R * (0.42 + i * 0.10))
        .lineTo(x + R * (0.50 - i * 0.012), y + R * (0.42 + i * 0.10))
        .stroke({ width: R * 0.016, color: 0x7d93ad, alpha: 0.7 });
    }
    // Trigger guard.
    g.moveTo(x + R * 0.56, y + R * 0.30)
      .quadraticCurveTo(x + R * 0.80, y + R * 0.62, x + R * 0.52, y + R * 0.60)
      .stroke({ width: R * 0.035, color: 0x46586e });
    // Slide.
    tube(g, x, y, R * 1.10, R * 0.30, R * 0.05, tone);
    g.roundRect(x + R * 0.18, y + R * 0.07, R * 0.30, R * 0.07, R * 0.02)
      .fill({ color: 0x0d141f, alpha: 0.85 });
    // Pressure tank on top.
    g.roundRect(x + R * 0.16, y - R * 0.20, R * 0.52, R * 0.18, R * 0.08)
      .fill({ color: tone, alpha: 0.75 }).stroke({ width: R * 0.018, color: 0x0d141f });
    g.circle(x + R * 0.30, y - R * 0.13, R * 0.04).fill({ color: 0xffffff, alpha: 0.8 });
    // The jet.
    const mx = x + R * 1.12, my = y + R * 0.15;
    g.moveTo(mx, my - R * 0.10).quadraticCurveTo(mx + R * 0.42, my - R * 0.16, mx + R * 0.78, my - R * 0.02)
      .quadraticCurveTo(mx + R * 0.42, my + R * 0.10, mx, my + R * 0.10)
      .closePath().fill({ color: tone, alpha: 0.55 });
    g.moveTo(mx, my).quadraticCurveTo(mx + R * 0.40, my - R * 0.06, mx + R * 0.72, my)
      .stroke({ width: R * 0.03, color: 0xffffff, alpha: 0.8 });
    for (let i = 0; i < 6; i++) {
      const f = 0.55 + i * 0.10;
      const dx = mx + R * f, dy = my + (noise(i * 13) - 0.5) * R * 0.34;
      const rr = R * (0.055 - i * 0.006);
      g.circle(dx, dy, rr).fill({ color: tone, alpha: 0.85 });
      g.circle(dx - rr * 0.3, dy - rr * 0.3, rr * 0.35).fill({ color: 0xffffff, alpha: 0.8 });
    }
  },

  // DAGGER FAN — three blades thrown in a stagger: same heading, offset up-left
  // and down-right of each other so the volley reads as a spread in flight
  // rather than as three knives crossing.
  blade(g, cx, cy, R, tone) {
    const ang = -0.62;                       // shared heading, up and to the right
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const px = -dy, py = dx;                 // across the heading
    // Offsets run ALONG the perpendicular, so the three sit stepped
    // diagonally: one high and behind, one centre, one low and ahead.
    const SET = [
      [-0.78, -0.30, 0.86],                  // [along, across, length]
      [0.00, 0.00, 1.00],
      [0.72, 0.30, 0.86],
    ];
    for (let i = 0; i < SET.length; i++) {
      const [al, ac, sc] = SET[i];
      const bx = cx + dx * R * al + px * R * ac - dx * R * 0.34;
      const by = cy + dy * R * al + py * R * ac - dy * R * 0.34;
      const L = R * 0.82 * sc;
      // Motion trail behind each blade, tapering.
      for (let k = 1; k <= 3; k++) {
        g.moveTo(bx - dx * R * 0.10 * k, by - dy * R * 0.10 * k)
          .lineTo(bx + dx * L * 0.55 - dx * R * 0.10 * k, by + dy * L * 0.55 - dy * R * 0.10 * k)
          .stroke({ width: R * (0.085 - k * 0.02) * sc, color: tone, alpha: 0.20 - k * 0.05 });
      }
      // Grip, guard, blade.
      g.moveTo(bx - dx * R * 0.06, by - dy * R * 0.06)
        .lineTo(bx - dx * R * 0.26 * sc, by - dy * R * 0.26 * sc)
        .stroke({ width: R * 0.075 * sc, color: 0x0d141f });
      g.circle(bx - dx * R * 0.27 * sc, by - dy * R * 0.27 * sc, R * 0.032 * sc)
        .fill({ color: 0x7d93ad });
      g.moveTo(bx + px * R * 0.125 * sc, by + py * R * 0.125 * sc)
        .lineTo(bx - px * R * 0.125 * sc, by - py * R * 0.125 * sc)
        .stroke({ width: R * 0.060 * sc, color: 0x46586e });
      blade(g, bx, by, bx + dx * L, by + dy * L, R * 0.125 * sc, 0xffffff, tone);
      // A glint partway up the edge, offset per blade so they do not flash as one.
      const gf = 0.45 + i * 0.12;
      g.circle(bx + dx * L * gf + px * R * 0.03 * sc, by + dy * L * gf + py * R * 0.03 * sc,
        R * 0.028 * sc).fill({ color: 0xffffff, alpha: 0.9 });
    }
  },

  // BLOOD SCYTHE — a real scythe: wide curved blade with an edge highlight,
  // a snath with a grip, and blood running off the point.
  scythe(g, cx, cy, R, tone) {
    const A0 = -2.45, A1 = 0.35;
    const OUT = R * 0.94, IN = R * 0.62;
    const pts = [];
    for (let i = 0; i <= 26; i++) {
      const a = A0 + (A1 - A0) * (i / 26);
      pts.push(cx + Math.cos(a) * OUT, cy + Math.sin(a) * OUT);
    }
    for (let i = 26; i >= 0; i--) {
      const t = i / 26, a = A0 + (A1 - A0) * t;
      // The inner edge closes in toward the point, so the blade tapers.
      const r = IN + (OUT - IN) * 0.72 * (1 - t);
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.poly(pts).fill({ color: tone }).stroke({ width: R * 0.018, color: 0x0d141f, alpha: 0.95 });
    // Edge highlight on the outer arc only.
    g.moveTo(cx + Math.cos(A0) * OUT, cy + Math.sin(A0) * OUT);
    for (let i = 1; i <= 26; i++) {
      const a = A0 + (A1 - A0) * (i / 26);
      g.lineTo(cx + Math.cos(a) * OUT, cy + Math.sin(a) * OUT);
    }
    g.stroke({ width: R * 0.030, color: 0xffffff, alpha: 0.8 });
    // Snath from the heel of the blade, down and right.
    const hx = cx + Math.cos(A1) * OUT * 0.92, hy = cy + Math.sin(A1) * OUT * 0.92;
    tube(g, hx - R * 0.05, hy - R * 0.04, R * 0.11, R * 0.86, R * 0.05, tone);
    g.roundRect(hx - R * 0.10, hy + R * 0.46, R * 0.21, R * 0.12, R * 0.05).fill({ color: 0x0d141f });
    // Blood running off the point.
    const tipx = cx + Math.cos(A0) * OUT, tipy = cy + Math.sin(A0) * OUT;
    g.moveTo(tipx, tipy).quadraticCurveTo(tipx + R * 0.04, tipy + R * 0.18, tipx + R * 0.01, tipy + R * 0.30)
      .stroke({ width: R * 0.026, color: tone, alpha: 0.85 });
    for (let i = 0; i < 3; i++) {
      g.circle(tipx + R * 0.02 * i, tipy + R * (0.34 + i * 0.20), R * (0.05 - i * 0.013))
        .fill({ color: tone, alpha: 0.9 - i * 0.2 });
    }
  },

  // EMBER ORBS — burning spheres on an orbit, each with a flame licking off
  // the top and a heat trail behind.
  emberOrbs(g, cx, cy, R, tone) {
    const lx = 0.5, ly = -0.72;
    g.ellipse(cx, cy, R * 0.88, R * 0.36).stroke({ width: R * 0.018, color: tone, alpha: 0.28 });
    const ORBS = [[-0.70, 0.20, 0.22], [0.24, -0.28, 0.16], [0.72, 0.16, 0.19]];
    for (let i = 0; i < ORBS.length; i++) {
      const [ox, oy, r] = ORBS[i];
      const x = cx + ox * R, y = cy + oy * R, rr = R * r;
      for (let k = 1; k <= 4; k++) {
        g.circle(x - ox * R * 0.09 * k, y - oy * R * 0.09 * k, rr * (1 - k * 0.16))
          .fill({ color: tone, alpha: 0.10 - k * 0.018 });
      }
      g.circle(x, y, rr * 2.0).fill({ color: tone, alpha: 0.12 });
      sphere(g, x, y, rr, lx, ly, 0x5a1a04, tone);
      g.circle(x + lx * rr * 0.3, y + ly * rr * 0.3, rr * 0.42)
        .fill({ color: 0xffe9a3, alpha: 0.85 });
      // Flame off the top.
      for (const [w, h, col, a] of [[0.9, 1.9, tone, 0.85], [0.55, 1.3, 0xffe9a3, 0.9]]) {
        g.moveTo(x - rr * 0.5 * w, y - rr * 0.6)
          .quadraticCurveTo(x - rr * 0.2 * w, y - rr * h, x + rr * 0.12, y - rr * h * 1.15)
          .quadraticCurveTo(x + rr * 0.5 * w, y - rr * h * 0.5, x + rr * 0.5 * w, y - rr * 0.6)
          .closePath().fill({ color: col, alpha: a });
      }
    }
  },

  // TIDECUTTER KATANA — a long blade with a water edge: the steel carries the
  // specular line, the water rides it as a translucent sheet.
  katana(g, cx, cy, R, tone) {
    const x0 = cx - R * 0.72, y0 = cy + R * 0.80;
    const x1 = cx + R * 0.84, y1 = cy - R * 0.74;
    blade(g, x0, y0, x1, y1, R * 0.085, 0xffffff, 0x7d93ad);
    // Water sheet running the edge.
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    const px = -dy / L, py = dx / L;
    g.moveTo(x0 + px * R * 0.08, y0 + py * R * 0.08)
      .lineTo(x1 + px * R * 0.02, y1 + py * R * 0.02)
      .lineTo(x1 + px * R * 0.22, y1 + py * R * 0.22)
      .quadraticCurveTo(cx + px * R * 0.34, cy + py * R * 0.34,
        x0 + px * R * 0.26, y0 + py * R * 0.26)
      .closePath().fill({ color: tone, alpha: 0.45 });
    for (let i = 0; i < 7; i++) {
      const f = 0.12 + i * 0.13;
      const bx = x0 + dx * f + px * R * (0.24 + noise(i * 9) * 0.12);
      const by = y0 + dy * f + py * R * (0.24 + noise(i * 9) * 0.12);
      g.circle(bx, by, R * (0.03 + noise(i * 5) * 0.03)).fill({ color: tone, alpha: 0.85 });
    }
    // Tsuba and wrapped hilt.
    const hx = x0 - dx * 0.10, hy = y0 - dy * 0.10;
    g.circle(hx, hy, R * 0.13).fill({ color: 0x46586e }).stroke({ width: R * 0.018, color: 0x0d141f });
    g.moveTo(hx, hy).lineTo(hx - dx * 0.26, hy - dy * 0.26)
      .stroke({ width: R * 0.075, color: 0x0d141f });
    for (let i = 0; i < 5; i++) {
      const f = 0.04 + i * 0.05;
      g.moveTo(hx - dx * f + px * R * 0.05, hy - dy * f + py * R * 0.05)
        .lineTo(hx - dx * (f + 0.03) - px * R * 0.05, hy - dy * (f + 0.03) - py * R * 0.05)
        .stroke({ width: R * 0.016, color: 0x7d93ad, alpha: 0.8 });
    }
  },

  // FLAME BURST — layered fire from a base, deep red root through orange to a
  // white core, with embers rising off it.
  flame(g, cx, cy, R, tone) {
    const base = cy + R * 0.78;
    g.ellipse(cx, base, R * 0.62, R * 0.16).fill({ color: tone, alpha: 0.22 });
    for (const [w, h, col, a] of [
      [1.00, 1.70, 0x7a2405, 0.95], [0.74, 1.42, tone, 0.95],
      [0.48, 1.08, 0xffb347, 0.95], [0.26, 0.68, 0xffffff, 0.92],
    ]) {
      g.moveTo(cx - R * 0.5 * w, base)
        .quadraticCurveTo(cx - R * 0.62 * w, base - R * h * 0.55, cx - R * 0.10 * w, base - R * h)
        .quadraticCurveTo(cx + R * 0.16 * w, base - R * h * 0.72, cx + R * 0.20 * w, base - R * h * 0.42)
        .quadraticCurveTo(cx + R * 0.56 * w, base - R * h * 0.50, cx + R * 0.5 * w, base)
        .closePath().fill({ color: col, alpha: a });
    }
    for (let i = 0; i < 9; i++) {
      const f = noise(i * 17 + 2);
      const ex = cx + (noise(i * 7) - 0.5) * R * 1.1;
      const ey = base - R * (0.9 + f * 1.1);
      g.circle(ex, ey, R * (0.03 + f * 0.03))
        .fill({ color: i % 2 ? 0xffe9a3 : tone, alpha: 0.5 + f * 0.4 });
    }
  },

  // VOID PULSE — a black hole: accretion disc in front and behind, a lensed
  // photon ring, and the event horizon as a true hole.
  voidpulse(g, cx, cy, R, tone) {
    const rr = R * 0.34;
    // Far half of the disc, seen over the top through lensing.
    g.moveTo(cx - R * 0.86, cy - rr * 0.30);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      g.lineTo(cx - R * 0.86 + t * R * 1.72, cy - rr * 0.30 - Math.sin(t * Math.PI) * R * 0.42);
    }
    g.stroke({ width: R * 0.12, color: tone, alpha: 0.55 });
    g.circle(cx, cy, rr * 2.6).fill({ color: tone, alpha: 0.10 });
    // Photon ring.
    g.circle(cx, cy, rr * 1.30).stroke({ width: R * 0.05, color: tone, alpha: 0.85 });
    g.circle(cx, cy, rr * 1.30).stroke({ width: R * 0.018, color: 0xffffff, alpha: 0.75 });
    // Event horizon.
    g.circle(cx, cy, rr).fill({ color: 0x02010a });
    // Near half of the disc, in front.
    g.moveTo(cx - R * 0.90, cy + rr * 0.34);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      g.lineTo(cx - R * 0.90 + t * R * 1.80, cy + rr * 0.34 + Math.sin(t * Math.PI) * R * 0.20);
    }
    g.stroke({ width: R * 0.15, color: tone, alpha: 0.9 });
    g.moveTo(cx - R * 0.90, cy + rr * 0.34);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      g.lineTo(cx - R * 0.90 + t * R * 1.80, cy + rr * 0.34 + Math.sin(t * Math.PI) * R * 0.20);
    }
    g.stroke({ width: R * 0.04, color: 0xffffff, alpha: 0.55 });
    for (let i = 0; i < 14; i++) {
      const a = noise(i * 3 + 1) * TAU, d = 0.72 + noise(i * 7) * 0.34;
      g.circle(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d * 0.7, R * 0.012)
        .fill({ color: 0xffffff, alpha: 0.3 + noise(i * 11) * 0.5 });
    }
  },

  // COSMIC DEVASTATION — a world taking a swarm. The planet is lit and
  // terminated like the game's own background world; the meteors come in on
  // a shared vector so it reads as a bombardment rather than as scattered
  // decoration.
  cosmicRain(g, cx, cy, R, tone) {
    const lx = 0.58, ly = -0.62;
    const px = cx + R * 0.05, py = cy + R * 0.12, PR = R * 0.52;

    // Deep-space ground: a faint nebula wash and stars, so the planet is
    // somewhere rather than floating on the panel.
    for (let i = 0; i < 3; i++) {
      corona(g, cx - R * 0.3 + i * R * 0.3, cy - R * 0.3 + i * R * 0.2,
        R * (0.7 - i * 0.12), 0x3a1030, 0.10, 0.22, 0.12);
    }
    for (let i = 0; i < 26; i++) {
      const a = noise(i * 3 + 1) * TAU, d = 0.55 + noise(i * 5 + 2) * 0.5;
      const s = 0.006 + noise(i * 11 + 3) * 0.016;
      g.circle(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d, R * s)
        .fill({ color: 0xffffff, alpha: 0.25 + noise(i * 13) * 0.5 });
    }

    // Atmosphere, outside the body so it haloes the limb.
    g.circle(px, py, PR * 1.16).fill({ color: tone, alpha: 0.08 });
    g.circle(px, py, PR * 1.07).fill({ color: tone, alpha: 0.10 });

    sphere(g, px, py, PR, lx, ly, 0x1b1420, tone);

    // Craters, placed on the sphere and shaded from the same light: a bright
    // rim on the lit side, a dark floor opposite. This is what stops them
    // reading as holes punched in a flat disc.
    for (const [ox, oy, r] of [
      [-0.38, 0.22, 0.17], [0.16, 0.44, 0.11], [-0.12, -0.34, 0.09],
      [0.44, -0.10, 0.13], [-0.55, -0.16, 0.07], [0.06, 0.06, 0.06],
    ]) {
      const kx = px + ox * PR, ky = py + oy * PR;
      const kr = PR * r;
      g.circle(kx, ky, kr).fill({ color: 0x0b0710, alpha: 0.75 });
      g.circle(kx + lx * kr * 0.22, ky + ly * kr * 0.22, kr * 0.78)
        .fill({ color: 0x000000, alpha: 0.4 });
      g.circle(kx - lx * kr * 0.30, ky - ly * kr * 0.30, kr)
        .stroke({ width: kr * 0.24, color: tone, alpha: 0.28 });
    }

    // The fresh impact: a molten crater still glowing, with ejecta rays.
    const ix = px + PR * 0.30, iy = py - PR * 0.30, IR = PR * 0.24;
    for (let i = 0; i < 12; i++) {
      const a = noise(i * 17 + 5) * TAU;
      const l = IR * (1.6 + noise(i * 19 + 6) * 2.2);
      g.moveTo(ix, iy).lineTo(ix + Math.cos(a) * l, iy + Math.sin(a) * l)
        .stroke({ width: IR * 0.13, color: 0xffd9a0, alpha: 0.20 });
    }
    g.circle(ix, iy, IR * 1.5).fill({ color: 0xff7a1a, alpha: 0.22 });
    g.circle(ix, iy, IR).fill({ color: 0xff7a1a, alpha: 0.75 });
    g.circle(ix, iy, IR * 0.6).fill({ color: 0xffd9a0, alpha: 0.9 });
    g.circle(ix, iy, IR * 0.28).fill({ color: 0xffffff });

    glint(g, px, py, PR, lx, ly, 0.7);

    // The swarm. One shared entry vector, varied lengths and sizes.
    const ang = Math.atan2(0.72, 0.66);
    for (const [sx, sy, len, size] of [
      [-0.96, -0.92, 0.95, 0.075], [0.30, -1.02, 0.70, 0.055],
      [-0.30, -0.64, 0.55, 0.045], [0.86, -0.52, 0.44, 0.038],
    ]) {
      meteor(g, cx + sx * R, cy + sy * R, ang, R * len, R * size, 0xffd9a0, 0xff7a1a, 0x7a2405);
    }
  },

  // VOID CRYSTAL BARRAGE — a cluster of shards. Each is a solid with a lit
  // facet and a shadowed one, so the group reads as crystal rather than as
  // triangles, and the tallest carries an internal refraction line.
  pIce(g, cx, cy, R, tone) {
    const ground = cy + R * 0.72;

    // Ground glow and frost pool.
    g.ellipse(cx, ground, R * 0.86, R * 0.20).fill({ color: tone, alpha: 0.16 });
    g.ellipse(cx, ground, R * 0.60, R * 0.13).fill({ color: tone, alpha: 0.18 });

    // Shards: [x offset, height, half-width, lean]
    const SHARDS = [
      [-0.62, 0.62, 0.11, -0.16], [0.60, 0.70, 0.12, 0.14],
      [-0.34, 1.02, 0.14, -0.06], [0.36, 0.92, 0.13, 0.06],
      [-0.10, 1.34, 0.17, -0.02], [0.14, 1.16, 0.15, 0.03],
    ];
    for (let i = 0; i < SHARDS.length; i++) {
      const [ox, h, hw, lean] = SHARDS[i];
      const bx = cx + ox * R;
      const tipx = bx + lean * R, tipy = ground - h * R;
      const lw = hw * R, sh = h * R;
      // Body.
      g.moveTo(bx - lw, ground)
        .lineTo(bx - lw * 0.55, ground - sh * 0.55)
        .lineTo(tipx, tipy)
        .lineTo(bx + lw * 0.55, ground - sh * 0.55)
        .lineTo(bx + lw, ground)
        .closePath()
        .fill({ color: tone, alpha: 0.92 })
        .stroke({ width: R * 0.012, color: 0x0d141f, alpha: 0.9 });
      // Lit facet down the left, shadowed wedge down the right — one light
      // direction for the whole cluster.
      g.moveTo(bx - lw, ground).lineTo(bx - lw * 0.55, ground - sh * 0.55)
        .lineTo(tipx, tipy).lineTo(bx, ground).closePath()
        .fill({ color: 0xffffff, alpha: 0.34 });
      g.moveTo(bx + lw, ground).lineTo(bx + lw * 0.55, ground - sh * 0.55)
        .lineTo(tipx, tipy).lineTo(bx, ground).closePath()
        .fill({ color: 0x0a1a2e, alpha: 0.34 });
      // Internal refraction: a bright line running up the tallest shards.
      if (h > 0.9) {
        g.moveTo(bx, ground - sh * 0.1).lineTo(tipx, tipy)
          .stroke({ width: R * 0.018, color: 0xffffff, alpha: 0.55 });
      }
    }

    // Contact shadow, so the cluster sits ON something.
    g.ellipse(cx, ground + R * 0.03, R * 0.72, R * 0.09).fill({ color: 0x02060f, alpha: 0.55 });

    // Frost motes and two four-point sparkles.
    for (let i = 0; i < 10; i++) {
      const a = noise(i * 7 + 4) * TAU, d = 0.5 + noise(i * 9 + 5) * 0.55;
      g.circle(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d * 0.8,
        R * (0.008 + noise(i * 3) * 0.014))
        .fill({ color: 0xffffff, alpha: 0.3 + noise(i * 5) * 0.5 });
    }
    for (const [sx, sy, s] of [[-0.66, -0.62, 0.13], [0.62, -0.42, 0.09]]) {
      const gx = cx + sx * R, gy = cy + sy * R, gr = R * s;
      g.moveTo(gx, gy - gr).lineTo(gx + gr * 0.20, gy - gr * 0.20).lineTo(gx + gr, gy)
        .lineTo(gx + gr * 0.20, gy + gr * 0.20).lineTo(gx, gy + gr)
        .lineTo(gx - gr * 0.20, gy + gr * 0.20).lineTo(gx - gr, gy)
        .lineTo(gx - gr * 0.20, gy - gr * 0.20).closePath()
        .fill({ color: 0xffffff, alpha: 0.85 });
    }
  },

  // SOLAR FLARE — the game's own star treatment: stepped bloom, an irregular
  // corona, a 44-ray fan with alternating lengths, an anamorphic streak and a
  // lens-ghost chain.
  flare(g, cx, cy, R, tone) {
    for (let i = 9; i >= 1; i--) {
      const f = i / 9;
      g.circle(cx, cy, R * 0.13 * i).fill({ color: i > 5 ? 0xffdca0 : 0xffe9b0, alpha: 0.030 * (1 - f * 0.35) });
    }
    const RAYS = 44;
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * TAU;
      const h = noise(i + 1);
      const long = i % 4 === 0;
      const len = R * (long ? 0.62 + h * 0.58 : 0.24 + h * 0.28);
      g.moveTo(cx + Math.cos(a) * R * 0.10, cy + Math.sin(a) * R * 0.10)
        .lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len)
        .stroke({ width: long ? R * 0.016 : R * 0.009, color: long ? 0xfff3d0 : 0xffe1a4, alpha: long ? 0.30 : 0.18 });
    }
    corona(g, cx, cy, R * 0.42, 0xffdfa0, 0.22);
    // Prominences: loops peeling off the limb.
    for (const [a, s] of [[-0.5, 1], [2.1, 0.8], [3.6, 0.9], [5.2, 0.7]]) {
      const bx = cx + Math.cos(a) * R * 0.36, by = cy + Math.sin(a) * R * 0.36;
      const ex = cx + Math.cos(a + 0.55) * R * 0.36, ey = cy + Math.sin(a + 0.55) * R * 0.36;
      const mx = cx + Math.cos(a + 0.27) * R * (0.62 * s), my = cy + Math.sin(a + 0.27) * R * (0.62 * s);
      g.moveTo(bx, by).quadraticCurveTo(mx, my, ex, ey)
        .stroke({ width: R * 0.045, color: tone, alpha: 0.7 });
      g.moveTo(bx, by).quadraticCurveTo(mx, my, ex, ey)
        .stroke({ width: R * 0.018, color: 0xfff3d0, alpha: 0.8 });
    }
    // One smooth radial falloff from the white-hot core out to the corona,
    // instead of three flat-alpha discs stacked into visible rings.
    g.circle(cx, cy, R * 0.32).fill({
      fill: new FillGradient({
        type: 'radial',
        center: { x: cx, y: cy }, innerRadius: 0,
        outerCenter: { x: cx, y: cy }, outerRadius: R * 0.32,
        colorStops: [
          { offset: 0, color: 0xffffff },
          { offset: 0.42, color: 0xfffdf2 },
          { offset: 0.75, color: 0xfff6dc },
          { offset: 1, color: 0xffe9b0 },
        ],
      }),
    });
    g.circle(cx, cy, R * 0.13).fill({ color: 0xffffff });
    for (const [len, w, a, col] of [
      [R * 1.30, R * 0.012, 0.20, 0xcfe4ff],
      [R * 0.78, R * 0.026, 0.14, 0xffeec4],
      [R * 0.38, R * 0.050, 0.09, 0xffd9a0],
    ]) {
      g.moveTo(cx - len, cy).lineTo(cx + len, cy).stroke({ width: w, color: col, alpha: a });
    }
    for (const [t, r, a, col] of [
      [-0.35, 0.05, 0.12, 0xffd0a0], [-0.62, 0.08, 0.09, 0xa0ffd8],
      [-0.95, 0.035, 0.10, 0xcfd0ff], [0.42, 0.06, 0.08, 0xffe0a0],
    ]) {
      const gx = cx + R * 0.9 * t, gy = cy + R * 0.5 * t;
      g.circle(gx, gy, R * r).fill({ color: col, alpha: a })
        .stroke({ width: R * 0.006, color: col, alpha: a * 1.6 });
    }
  },
};


// Weapons that were given their own glyph id in the uniqueness pass but whose
// scene is drawn under the older generic name. Without this the scene exists
// and is simply never reached, which is the same dead-config shape the rest of
// this project keeps producing.
const ALIASES = {
  voidBeam: 'beam',
  twinRevolvers: 'revolvers',
  voidScatter: 'scatter',
  shrapnelMine: 'mine',
  chainLightning: 'caster',
  daggerFan: 'blade',
  stormLance: 'harpoon',
  annunakiDisc: 'annunakiDisc',
};

export function hasScene(key) { return !!(SCENES[key] || SCENES[ALIASES[key]]); }

/** Paint a scene once. `R` is the half-size of the art box in px. */
export function paintScene(g, key, cx, cy, R, tone) {
  const fn = SCENES[key] || SCENES[ALIASES[key]];
  if (!fn) return false;
  fn(g, cx, cy, R, tone);
  return true;
}

export default SCENES;
