// Level-up card frames — the rarity MATERIALS, drawn in PixiJS.
//
// Why this file exists at all: these frames were built in CSS first and it
// failed three separate times for three unrelated reasons that all come from
// the same place — CSS gives an element one ::before and one ::after, a
// box-shadow that cannot follow a clip-path, and a border-radius children only
// honour if they inherit it. A frame that has to run the WHOLE edge and break
// past it both outward and inward needs dozens of independently placed,
// independently animated shapes. In CSS that is dozens of elements fighting
// over two pseudo-slots and an overflow rule. Here it is a path and a loop.
//
// Everything is drawn against a PERIMETER: a sampled walk around the card's
// rounded rectangle where every sample carries its outward normal. That single
// abstraction is what makes "vines growing along the frame" and "flames licking
// the whole edge" the same twenty lines with a different shape function, and
// it is what guarantees the material actually tracks the border instead of
// being four decorations parked in the corners (which is what the CSS version
// kept collapsing into).
//
// Scale note: the frame layer is rendered at half resolution and upscaled with
// nearest-neighbour sampling, because Timmy wants the chunky pixel look and
// made the reference that way on purpose. So nothing here should rely on
// detail finer than ~2px — sub-pixel hairlines simply disappear. Strokes are
// 2px minimum and shapes are chunky by design.

const TAU = Math.PI * 2;

// Deterministic noise. Materials must look the same every time a card is
// shown — a vine that regrows in a different place each frame reads as static,
// not as foliage.
export function hash(i, seed = 0) {
  let h = (i * 374761393 + seed * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const rnd = (i, seed, lo, hi) => lo + hash(i, seed) * (hi - lo);


/**
 * The plate the whole card row stands on: a dark panel with a machined frame,
 * corner ornaments and a runed head. Drawn once — nothing here animates except
 * through the separate light layer above it.
 */
export function paintStagePlate(g, x, y, w, h) {
  const R = 22;
  const BW = 30;                          // band width — heavy, as in the mockups
  const half = BW / 2;

  // Cast shadow.
  for (let i = 6; i >= 1; i--) {
    const o2 = i * 5;
    g.roundRect(x - half - o2 * 0.5, y - half + o2 * 1.1, w + BW + o2, h + BW + o2 * 0.7, R + o2 * 0.4)
      .fill({ color: 0x000000, alpha: 0.09 * (1 - i / 7) });
  }

  // Interior: near black, so the card bursts have something to burn against.
  g.roundRect(x, y, w, h, R).fill({ color: 0x05060b, alpha: 0.97 });

  // --- the steel band -------------------------------------------------------
  // Brushed silver, lit from above: a dark outer lip, a bright face with a
  // highlight along its top third, a shadow along its bottom third, and a dark
  // inner lip. That four-part stack is what reads as thick metal.
  g.roundRect(x - half, y - half, w + BW, h + BW, R + half)
    .stroke({ width: 4, color: 0x0a0d14, alpha: 1 });
  g.roundRect(x - half + 2, y - half + 2, w + BW - 4, h + BW - 4, R + half - 1)
    .stroke({ width: BW - 5, color: 0x717c8c, alpha: 1 });
  g.roundRect(x - half + BW * 0.26, y - half + BW * 0.26,
    w + BW - BW * 0.52, h + BW - BW * 0.52, R + half - BW * 0.26)
    .stroke({ width: BW * 0.30, color: 0xc6cedb, alpha: 0.55 });
  g.roundRect(x - half + BW * 0.70, y - half + BW * 0.70,
    w + BW - BW * 1.40, h + BW - BW * 1.40, Math.max(3, R + half - BW * 0.70))
    .stroke({ width: BW * 0.24, color: 0x4d5665, alpha: 0.9 });
  g.roundRect(x - 1, y - 1, w + 2, h + 2, R)
    .stroke({ width: 3.5, color: 0x0a0d14, alpha: 1 });

  // Brushed grain along the band's face.
  for (let i = 0; i < 90; i++) {
    const t2 = hash(i, 21);
    const along = t2 * (w + BW * 2);
    const gx = x - half + along;
    if (gx < x - half || gx > x + w + half) continue;
    const up = hash(i * 3, 21) > 0.5;
    g.moveTo(gx, y - half + BW * 0.22).lineTo(gx + 7, y - half + BW * 0.22)
      .stroke({ width: 1, color: up ? 0xffffff : 0x000000, alpha: up ? 0.05 : 0.07 });
    g.moveTo(gx, y + h + half - BW * 0.22).lineTo(gx + 7, y + h + half - BW * 0.22)
      .stroke({ width: 1, color: up ? 0xffffff : 0x000000, alpha: 0.05 });
  }

  // --- corner blocks --------------------------------------------------------
  const cb = BW * 1.9;
  for (const [cx0, cy0, sx, sy] of [
    [x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1],
  ]) {
    const bx = cx0 - half + (sx > 0 ? 0 : -cb + BW);
    const by = cy0 - half + (sy > 0 ? 0 : -cb + BW);
    g.roundRect(bx, by, cb, cb, 6).fill({ color: 0x8d97a6 })
      .stroke({ width: 3.5, color: 0x0a0d14, alpha: 1 });
    g.roundRect(bx + 4, by + 4, cb - 8, cb - 8, 4)
      .stroke({ width: 2, color: 0xc6cedb, alpha: 0.55 });
    // The angled cut across each block, pointing at the card row.
    g.moveTo(bx + (sx > 0 ? cb * 0.30 : cb * 0.70), by + (sy > 0 ? cb * 0.12 : cb * 0.88))
      .lineTo(bx + (sx > 0 ? cb * 0.12 : cb * 0.88), by + (sy > 0 ? cb * 0.30 : cb * 0.70))
      .stroke({ width: 4, color: 0x4d5665, alpha: 0.9 });
    // The corner rivet, upgraded to a small pressure gauge — a dial face,
    // four tick marks and a needle resting at a fixed (deterministic) angle,
    // as the reference mockup's corner instruments read.
    // Sized up from the first pass — sub-2px ticks vanished under the
    // half-res pixel treatment (see the file-top scale note), so this reads
    // as a smudge instead of a gauge at actual card size.
    const gr = cb * 0.22;
    const gcx = bx + cb * 0.5, gcy = by + cb * 0.5;
    g.circle(gcx, gcy, gr).fill({ color: 0x11151d });
    g.circle(gcx, gcy, gr).stroke({ width: 2.4, color: 0xc6cedb, alpha: 0.8 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.4;
      g.moveTo(gcx + Math.cos(a) * gr * 0.48, gcy + Math.sin(a) * gr * 0.48)
        .lineTo(gcx + Math.cos(a) * gr * 0.86, gcy + Math.sin(a) * gr * 0.86)
        .stroke({ width: 2, color: 0x8fe6ff, alpha: 0.8 });
    }
    const needleA = hash(sx * 3 + sy * 7, 44) * TAU;
    g.moveTo(gcx, gcy).lineTo(gcx + Math.cos(needleA) * gr * 0.72, gcy + Math.sin(needleA) * gr * 0.72)
      .stroke({ width: 2, color: 0xffd166, alpha: 0.95 });
    g.circle(gcx, gcy, gr * 0.22).fill({ color: 0xc6cedb, alpha: 0.95 });

    // Ice icicles off the two TOP corners, vine tendrils off the two BOTTOM
    // ones — the frame reads as built, then half-reclaimed by the world
    // around it, same idea as the reference's frost-and-growth corners.
    if (sy > 0) {
      const ix0 = bx + (sx > 0 ? cb * 0.15 : cb * 0.85);
      const iy0 = by;
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * 9;
        const len = 14 + hash(k, sx + 90) * 10;
        g.moveTo(ix0 + off - 4, iy0).lineTo(ix0 + off + 4, iy0)
          .lineTo(ix0 + off, iy0 - len).closePath()
          .fill({ color: 0xbfe8ff, alpha: 0.85 }).stroke({ width: 1.2, color: 0x2f7fae, alpha: 0.8 });
        g.moveTo(ix0 + off - 1, iy0 - 2).lineTo(ix0 + off - 1, iy0 - len + 3)
          .stroke({ width: 1, color: 0xffffff, alpha: 0.55 });
      }
    } else {
      const vx0 = bx + (sx > 0 ? cb * 0.2 : cb * 0.8);
      const vy0 = by + cb;
      const dir = sx > 0 ? 1 : -1;
      g.moveTo(vx0, vy0)
        .quadraticCurveTo(vx0 + dir * 10, vy0 + 10, vx0 + dir * 4, vy0 + 22)
        .stroke({ width: 2.4, color: 0x2c6b2f, alpha: 0.9 });
      for (const t2 of [0.4, 0.8]) {
        const lx = vx0 + dir * 10 * t2, ly = vy0 + (10 + 12 * t2) * (t2 * 0.9 + 0.4);
        g.moveTo(lx, ly)
          .lineTo(lx + dir * 6, ly - 3).lineTo(lx + dir * 5, ly + 4).closePath()
          .fill({ color: 0x3f9c3a, alpha: 0.85 }).stroke({ width: 1, color: 0x184017, alpha: 0.8 });
      }
    }
  }

  // --- engraved rune ticks along the top and bottom rail faces --------------
  // A row of small carved marks, not letters — each is one of a handful of
  // simple glyph shapes so the strip reads as script from a normal viewing
  // distance without needing an actual alphabet.
  for (const oy2 of [y - half + BW * 0.5, y + h + half - BW * 0.5]) {
    const step = 26;
    const n2 = Math.floor((w + BW) / step);
    for (let i = 0; i <= n2; i++) {
      const rx = x - half + BW * 0.5 + i * step;
      if (rx < x - half + BW * 0.6 || rx > x + w + half - BW * 0.6) continue;
      const kind = Math.floor(hash(i, 71) * 4);
      const rh = 6;
      g.moveTo(rx, oy2 - rh).lineTo(rx, oy2 + rh).stroke({ width: 1.6, color: 0x0a0d14, alpha: 0.55 });
      if (kind === 1) {
        g.moveTo(rx - 4, oy2).lineTo(rx + 4, oy2).stroke({ width: 1.6, color: 0x0a0d14, alpha: 0.55 });
      } else if (kind === 2) {
        g.moveTo(rx - 3, oy2 - rh).lineTo(rx + 3, oy2 + rh).stroke({ width: 1.4, color: 0x0a0d14, alpha: 0.5 });
      } else if (kind === 3) {
        g.moveTo(rx - 3, oy2 + rh * 0.4).lineTo(rx, oy2 - rh).lineTo(rx + 3, oy2 + rh * 0.4)
          .stroke({ width: 1.4, color: 0x0a0d14, alpha: 0.5 });
      }
    }
  }

  // --- centre ornaments on the top and bottom rails -------------------------
  for (const [oy, sy] of [[y - half, 1], [y + h + half, -1]]) {
    const ox = x + w / 2;
    // A wide shallow chevron, as the mockups have.
    g.moveTo(ox - BW * 2.6, oy).lineTo(ox, oy + sy * BW * 0.90).lineTo(ox + BW * 2.6, oy)
      .lineTo(ox + BW * 2.0, oy).lineTo(ox, oy + sy * BW * 0.55).lineTo(ox - BW * 2.0, oy)
      .closePath().fill({ color: 0x8d97a6 })
      .stroke({ width: 3, color: 0x0a0d14, alpha: 1 });
    // The gem in the middle of it.
    const gy = oy + sy * BW * 0.30;
    const r2 = BW * 0.34;
    g.moveTo(ox, gy - r2).lineTo(ox + r2, gy).lineTo(ox, gy + r2).lineTo(ox - r2, gy)
      .closePath().fill({ color: 0x2b3a63 })
      .stroke({ width: 2.5, color: 0xc6cedb, alpha: 0.9 });
    g.moveTo(ox, gy - r2).lineTo(ox - r2, gy).lineTo(ox, gy).closePath()
      .fill({ color: 0x7fa8ff, alpha: 0.5 });
    g.circle(ox - r2 * 0.3, gy - r2 * 0.3, r2 * 0.18).fill({ color: 0xffffff, alpha: 0.8 });
  }
}

/**
 * The LEVEL UP plaque: a metal tablet with winged ends that sits ON the frame's
 * top rail. In every mockup the title is a separate object bolted to the frame,
 * not text printed inside it — that is what gives it the weight.
 */
export function paintTitlePlaque(g, cx, cy, w, h) {
  const hw = w / 2, hh = h / 2;

  // The tablet: chamfered ends, so it reads as cast rather than cut from a bar.
  const ch = hh * 0.55;
  const body = (gg, inset) => {
    const L = cx - hw + inset, Rr = cx + hw - inset;
    const T = cy - hh + inset, B = cy + hh - inset;
    gg.moveTo(L + ch, T).lineTo(Rr - ch, T).lineTo(Rr, T + ch)
      .lineTo(Rr, B - ch).lineTo(Rr - ch, B).lineTo(L + ch, B)
      .lineTo(L, B - ch).lineTo(L, T + ch).closePath();
  };
  body(g, 0); g.fill({ color: 0x2b3140 });
  body(g, 0); g.stroke({ width: 5, color: 0x0a0d14, alpha: 1 });
  body(g, 3); g.stroke({ width: 4, color: 0x8d97a6, alpha: 1 });
  body(g, 7); g.stroke({ width: 2, color: 0xc6cedb, alpha: 0.55 });
  // Lit top edge, shadowed bottom.
  g.moveTo(cx - hw + ch + 4, cy - hh + 5).lineTo(cx + hw - ch - 4, cy - hh + 5)
    .stroke({ width: 3, color: 0xffffff, alpha: 0.22 });
  g.moveTo(cx - hw + ch + 4, cy + hh - 5).lineTo(cx + hw - ch - 4, cy + hh - 5)
    .stroke({ width: 3, color: 0x000000, alpha: 0.45 });
  // Bolts at the four inner corners.
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const bx = cx + sx * (hw - ch * 0.55), by = cy + sy * (hh - 8);
    g.circle(bx, by, 3.4).fill({ color: 0x1a1f2b });
    g.circle(bx, by, 3.4).stroke({ width: 1.4, color: 0xc6cedb, alpha: 0.7 });
    g.circle(bx - 1, by - 1, 1.3).fill({ color: 0xffffff, alpha: 0.55 });
  }
}

/**
 * A four-point star. Used beside the title instead of an emoji — the project's
 * standing rule is that no glyph on screen is an emoji, and this one can pulse
 * with the rest of the scene besides.
 */
export function paintStar(g, cx, cy, r, color, alpha) {
  const t2 = r * 0.22;
  g.moveTo(cx, cy - r).lineTo(cx + t2, cy - t2).lineTo(cx + r, cy)
    .lineTo(cx + t2, cy + t2).lineTo(cx, cy + r).lineTo(cx - t2, cy + t2)
    .lineTo(cx - r, cy).lineTo(cx - t2, cy - t2).closePath()
    .fill({ color, alpha });
}

// ---------------------------------------------------------------------------
// PERIMETER
// ---------------------------------------------------------------------------
// A rounded rect sampled into points that each know which way is "out". Arc
// length is accumulated so `at(t)` walks at constant speed — without that,
// ornaments bunch up in the corners, where the parameter moves through a lot
// of angle over very little distance.
export function makePerimeter(x, y, w, h, r, step = 4) {
  const pts = [];
  const add = (px, py, nx, ny) => pts.push({ x: px, y: py, nx, ny });

  const line = (x0, y0, x1, y1, nx, ny) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const u = i / n;
      add(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, nx, ny);
    }
  };
  const arc = (cx, cy, a0, a1) => {
    const n = Math.max(2, Math.round((Math.abs(a1 - a0) * r) / step));
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      add(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a));
    }
  };

  line(x + r, y, x + w - r, y, 0, -1);
  arc(x + w - r, y + r, -Math.PI / 2, 0);
  line(x + w, y + r, x + w, y + h - r, 1, 0);
  arc(x + w - r, y + h - r, 0, Math.PI / 2);
  line(x + w - r, y + h, x + r, y + h, 0, 1);
  arc(x + r, y + h - r, Math.PI / 2, Math.PI);
  line(x, y + h - r, x, y + r, -1, 0);
  arc(x + r, y + r, Math.PI, Math.PI * 1.5);

  // Cumulative arc length, so t is distance-uniform rather than index-uniform.
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  const total = cum[pts.length];

  function at(t) {
    const d = ((t % 1) + 1) % 1 * total;
    // Linear scan is fine: a card perimeter is ~300 samples and we place at
    // most ~60 ornaments, so this is a few thousand comparisons per frame.
    let i = 1;
    while (i < pts.length && cum[i] < d) i++;
    const a = pts[i - 1], b = pts[i % pts.length];
    const seg = cum[i] - cum[i - 1] || 1;
    const u = (d - cum[i - 1]) / seg;
    let nx = a.nx + (b.nx - a.nx) * u, ny = a.ny + (b.ny - a.ny) * u;
    const nl = Math.hypot(nx, ny) || 1;
    return {
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
      nx: nx / nl,
      ny: ny / nl,
    };
  }
  return { pts, total, at, x, y, w, h, r };
}

// ---------------------------------------------------------------------------
// MATERIAL PALETTES
// ---------------------------------------------------------------------------
// Two tones and a hot core per tier. The card body already carries the rarity
// colour, so the material's job is to be a *substance* — leaves are darker and
// yellower than the frame line, ice is paler and bluer, flame runs from a deep
// red root to a white tip. Materials that are simply the rarity colour again
// read as a thicker border, which is exactly the note Timmy kept giving.
// `sc` scales everything the painter grows OUTWARD, `in` everything it grows
// INWARD over the card face, and `live` how hard it moves. The ladder is the
// point: each tier has to be visibly bigger than the one below it, not just a
// different substance, or climbing rarities does not feel like climbing.
export const MATERIALS = {
  common:    { kind: 'steel',  bw: 11, face: 0x5d6b7e, sc: 0.34, in: 0.34, live: 0.35, deep: 0x2a3341, mid: 0x53627a, hot: 0x93a6bd },
  uncommon:  { kind: 'vines',  bw: 13, face: 0x3d3529, sc: 0.52, in: 0.62, live: 0.6, deep: 0x14401d, mid: 0x3f9c3a, hot: 0x9ff072 },
  rare:      { kind: 'ice',    bw: 15, face: 0x24405c, sc: 0.72, in: 0.85, live: 0.8, deep: 0x16406e, mid: 0x49a8e8, hot: 0xd6f4ff },
  epic:      { kind: 'arcane', bw: 17, face: 0x3a2352, sc: 0.92, in: 1.05, live: 1.0, deep: 0x3d1263, mid: 0x9a4de0, hot: 0xf0c8ff },
  legendary: { kind: 'flame',  bw: 19, face: 0x4a2a12, sc: 1.18, in: 1.30, live: 1.3, deep: 0x7a2405, mid: 0xff8c1a, hot: 0xffe9a3 },
  mythical:  { kind: 'clouds', bw: 22, face: 0x2b1218, sc: 1.50, in: 1.60, live: 1.6, deep: 0x5c0714, mid: 0xff2e4d, hot: 0xffd0c0 },
};


/**
 * The structural frame every card has, whatever its rarity. A real band with
 * thickness: dark outer lip, a lit face, a dark inner lip, and solid corner
 * blocks. Materials are painted ON TOP of this — that is the difference
 * between "a frame with ice on it" and "ice floating near a line".
 *
 * `bw` is the band's width in px and grows with the tier, so a mythical frame
 * is physically heavier than a common one before any material is added.
 */
export function paintBand(g, perim, m, bw, faceCol, t) {
  const { x, y, w, h, r } = perim;
  const half = bw / 2;

  // Outer lip — the dark edge that gives the band a silhouette.
  g.roundRect(x - half - 1, y - half - 1, w + bw + 2, h + bw + 2, r + half + 1)
    .stroke({ width: 3, color: 0x05070d, alpha: 1 });

  // The face.
  g.roundRect(x - half + 1.5, y - half + 1.5, w + bw - 3, h + bw - 3, r + half)
    .stroke({ width: bw - 3, color: faceCol, alpha: 1 });

  // Lit along the top and left, shadowed along the bottom and right — one
  // light direction, the same one every bevel on the card uses.
  g.moveTo(x + r * 0.5, y - half + 2.5).lineTo(x + w - r * 0.5, y - half + 2.5)
    .stroke({ width: Math.max(1.5, bw * 0.18), color: 0xffffff, alpha: 0.26 });
  g.moveTo(x - half + 2.5, y + r * 0.5).lineTo(x - half + 2.5, y + h - r * 0.5)
    .stroke({ width: Math.max(1.5, bw * 0.15), color: 0xffffff, alpha: 0.16 });
  g.moveTo(x + r * 0.5, y + h + half - 2.5).lineTo(x + w - r * 0.5, y + h + half - 2.5)
    .stroke({ width: Math.max(1.5, bw * 0.20), color: 0x000000, alpha: 0.45 });
  g.moveTo(x + w + half - 2.5, y + r * 0.5).lineTo(x + w + half - 2.5, y + h - r * 0.5)
    .stroke({ width: Math.max(1.5, bw * 0.18), color: 0x000000, alpha: 0.35 });

  // Inner lip, so the band reads as sitting proud of the card face.
  g.roundRect(x + half - 1, y + half - 1, w - bw + 2, h - bw + 2, Math.max(2, r - half))
    .stroke({ width: 2.5, color: 0x05070d, alpha: 0.9 });
  g.roundRect(x + half + 1, y + half + 1, w - bw - 2, h - bw - 2, Math.max(2, r - half))
    .stroke({ width: 1.5, color: m.hot, alpha: 0.22 });

  // Corner blocks. Every framed object in the reference has them, and they are
  // what stop a rounded band reading as a pill.
  const cb = bw * 1.5;
  for (const [cx0, cy0, sx, sy] of [
    [x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1],
  ]) {
    g.roundRect(cx0 - half + (sx > 0 ? 0 : -cb + bw), cy0 - half + (sy > 0 ? 0 : -cb + bw), cb, cb, 3)
      .fill({ color: faceCol })
      .stroke({ width: 2.5, color: 0x05070d, alpha: 1 });
    // A lit stud in each block.
    const sxp = cx0 + sx * (cb * 0.5 - half + 1);
    const syp = cy0 + sy * (cb * 0.5 - half + 1);
    g.circle(sxp, syp, bw * 0.20).fill({ color: 0x0a0e16 });
    g.circle(sxp, syp, bw * 0.20).stroke({ width: 1.5, color: m.hot, alpha: 0.5 });
    g.circle(sxp - bw * 0.06, syp - bw * 0.06, bw * 0.08).fill({ color: 0xffffff, alpha: 0.5 });
  }
}


/**
 * Diagonal corner gussets: a wedge of material cutting across each corner at
 * 45 degrees and reaching inward over the card face.
 *
 * This is the element that was missing from every tier. Without it the band
 * sits around the card like a picture frame; with it the frame reaches into
 * the card and the two read as one object. Each tier passes its own painter
 * for the detail on top of the wedge, so steel gets plates and ice gets
 * facets — the SHAPE is shared, the substance is not.
 */
export function paintCornerGussets(g, perim, m, t, seed, detail) {
  const { x, y, w, h } = perim;
  const reach = (26 + 30 * m.in) ;          // how far in across the corner
  const thick = 9 + 12 * m.sc;
  const corners = [
    [x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1],
  ];
  for (let ci = 0; ci < corners.length; ci++) {
    const [cx, cy, sx, sy] = corners[ci];
    // The diagonal runs from a point along the top edge to a point down the
    // side, cutting the corner off.
    const ax = cx + sx * reach, ay = cy;
    const bx = cx, by = cy + sy * reach;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    // Inward normal of the diagonal, pointing at the card centre.
    const dx = bx - ax, dy = by - ay;
    const dl = Math.hypot(dx, dy) || 1;
    let nx = -dy / dl, ny = dx / dl;
    if ((mx - (x + w / 2)) * nx + (my - (y + h / 2)) * ny > 0) { nx = -nx; ny = -ny; }

    // The wedge: corner point, along the edge, across the diagonal, back.
    const breathe = 0.85 + 0.15 * Math.sin(t * 1.2 * m.live + ci * 1.6 + seed);
    const push = thick * breathe;
    g.moveTo(cx - sx * 3, cy - sy * 3)
      .lineTo(ax, ay)
      .lineTo(mx + nx * push, my + ny * push)
      .lineTo(bx, by)
      .closePath()
      .fill({ color: m.deep, alpha: 0.92 })
      .stroke({ width: 2, color: 0x05070d, alpha: 0.9 });
    // Lit edge along the diagonal.
    g.moveTo(ax, ay).lineTo(mx + nx * push, my + ny * push).lineTo(bx, by)
      .stroke({ width: 2.5, color: m.mid, alpha: 0.9 });
    g.moveTo(ax, ay).lineTo(mx + nx * push * 0.5, my + ny * push * 0.5)
      .stroke({ width: 1.5, color: m.hot, alpha: 0.45 });

    // Per-tier detail on the wedge, reaching further in along the diagonal.
    if (detail) detail(g, m, t, seed, ci, ax, ay, bx, by, nx, ny, push);
  }
}

// ---------------------------------------------------------------------------
// MATERIALS — each paints the full perimeter of `perim` into `g`.
// ---------------------------------------------------------------------------
// Signature is identical for all of them so the card renderer never branches
// on rarity: it looks up the kind and calls it. Adding a seventh tier is one
// function and one table row.

// COMMON — no growth. A plain machined bezel: two lines and a bevel highlight.
// It has to be visibly the *floor*, so that "uncommon has leaves on it" reads
// as an upgrade rather than as a different colourway.
// A small cog, teeth-out, drawn as one closed polygon (fill) plus a bored
// centre hole and a couple of spokes — cheap enough to redraw every frame at
// this size, and reads as machinery at a glance rather than as a gear
// starship-blueprint icon.
function drawGear(g, cx, cy, r, angle, teeth, faceCol, holeCol) {
  const inner = r * 0.62, toothH = r * 0.30;
  // Cast shadow, offset toward lower-right — a fixed light source, same
  // corner every gear on the card uses, so they read as one lit scene
  // rather than each spinning under its own sun.
  g.circle(cx + r * 0.16, cy + r * 0.20, r * 1.02).fill({ color: 0x000000, alpha: 0.30 });
  // A soft key-light glow UNDER the metal, fixed to the upper-left — the
  // teeth rotate through it, so the rim catches light as they pass instead
  // of the whole gear looking lit from one spot regardless of angle.
  g.circle(cx - r * 0.30, cy - r * 0.34, r * 0.85).fill({ color: 0xffffff, alpha: 0.16 });

  const pts = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = angle + (i / (teeth * 2)) * TAU;
    const rad = i % 2 === 0 ? r : r - toothH;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.poly(pts).fill({ color: faceCol }).stroke({ width: 1.4, color: 0x05070d, alpha: 0.9 });
  // Bevel: a bright rim on the upper-left arc of the tooth ring, a dark one
  // on the lower-right — the same four-part "thick metal" read the outer
  // stage frame uses, just small.
  for (let i = 0; i < teeth * 2; i++) {
    const a = angle + (i / (teeth * 2)) * TAU;
    const rad = i % 2 === 0 ? r : r - toothH;
    const lit = Math.cos(a - Math.PI * 0.78) > 0.25;
    if (!lit) continue;
    g.circle(cx + Math.cos(a) * rad * 0.94, cy + Math.sin(a) * rad * 0.94, r * 0.05)
      .fill({ color: 0xffffff, alpha: 0.28 });
  }
  for (let i = 0; i < 3; i++) {
    const a = angle + (i / 3) * TAU;
    g.moveTo(cx, cy).lineTo(cx + Math.cos(a) * inner * 0.9, cy + Math.sin(a) * inner * 0.9)
      .stroke({ width: r * 0.16, color: 0x05070d, alpha: 0.35 });
  }
  g.circle(cx, cy, inner * 0.42).fill({ color: holeCol }).stroke({ width: 1.2, color: 0x05070d, alpha: 0.9 });
  // A small fixed specular pin on the hole's rim — the "blänk" (shine/glint)
  // — steady rather than spinning, like light off a greased bearing.
  g.circle(cx - inner * 0.16, cy - inner * 0.16, inner * 0.12).fill({ color: 0xffffff, alpha: 0.55 });
}

function paintPlate(g, perim, m, t, seed) {
  const { x, y, w, h, r } = perim;
  // Common is the BAND and machining, and — per Timmy — that read as dead
  // next to vines swaying / ice growing / flame flickering on every other
  // tier. Common has no organic material to animate, so the motion is
  // mechanical instead: a handful of cogs turning in the band's face, at
  // slightly different speeds so they don't read as one rotating texture.
  const half = m.bw / 2;
  g.roundRect(x - half + m.bw * 0.45, y - half + m.bw * 0.45,
    w + m.bw - m.bw * 0.9, h + m.bw - m.bw * 0.9, r + half - m.bw * 0.45)
    .stroke({ width: 1.5, color: 0x05070d, alpha: 0.55 });
  g.roundRect(x - half + m.bw * 0.28, y - half + m.bw * 0.28,
    w + m.bw - m.bw * 0.56, h + m.bw - m.bw * 0.56, r + half - m.bw * 0.28)
    .stroke({ width: 1, color: m.hot, alpha: 0.30 });

  const gearR = m.bw * 0.36;
  for (let i = 0; i < 4; i++) {
    const p = perim.at((i + 0.5) / 4);
    const dir = i % 2 === 0 ? 1 : -1;
    const spin = t * dir * (0.55 + hash(i, seed) * 0.35);
    drawGear(g, p.x, p.y, gearR, spin, 8, m.mid, m.deep);
  }
}

// UNCOMMON — VINES. A stem that snakes along the whole border with leaves
// alternating outward and inward, so the frame is visibly overgrown rather
// than merely green. The stem is drawn as one continuous polyline offset from
// the perimeter by a travelling sine, which is what makes it read as grown
// rather than as a dashed decoration.
function paintVines(g, perim, m, t, seed) {
  // A WOOD band overgrown, not a hedge. The reference keeps the brown frame
  // clearly visible and clings tangled dark growth to it, with only a handful
  // of bright leaves and a scatter of glowing motes. My first version buried
  // the band under big bright leaves everywhere, which read as foliage rather
  // than as a frame that has been overgrown.
  const N = 150;
  const stem = [];
  for (let i = 0; i <= N; i++) {
    const p = perim.at(i / N);
    const off = (Math.sin(i * 0.42 + t * 1.1 * m.live + seed) * 5.0
      + Math.sin(i * 0.13 - t * 0.6 * m.live) * 3.0) * (0.6 + m.sc);
    stem.push({ x: p.x + p.nx * off, y: p.y + p.ny * off, nx: p.nx, ny: p.ny, i });
  }

  // Tangled growth: three thin runners at different offsets, dark, so the wood
  // still shows between them.
  for (const [mul, wdt, col, alp] of [[1.0, 5, m.deep, 0.95], [0.55, 3, 0x255c26, 0.9], [1.5, 2.5, m.deep, 0.7]]) {
    g.moveTo(stem[0].x + stem[0].nx * mul * 2, stem[0].y + stem[0].ny * mul * 2);
    for (let i = 1; i < stem.length; i++) {
      const q = stem[i];
      g.lineTo(q.x + q.nx * mul * 2 * Math.sin(i * 0.3 + mul), q.y + q.ny * mul * 2 * Math.sin(i * 0.3 + mul));
    }
    g.stroke({ width: wdt, color: col, alpha: alp });
  }

  // Moss: small dark clumps clinging along the runners, dense but low-contrast.
  for (let i = 3; i < stem.length - 3; i += 2) {
    const s2 = stem[i];
    const side = i % 4 < 2 ? 1 : -1;
    const d = rnd(i, seed, 2, 7) * (side > 0 ? m.sc : m.in) * 1.6;
    const r2 = rnd(i + 33, seed, 2.5, 5.5);
    g.circle(s2.x + s2.nx * d * side, s2.y + s2.ny * d * side, r2)
      .fill({ color: i % 3 === 0 ? 0x255c26 : m.deep, alpha: 0.9 });
  }

  // The leaves. Far fewer, and the bright ones only where growth has bunched —
  // every eighth station rather than every third.
  for (let i = 4; i < stem.length - 4; i += 8) {
    const s2 = stem[i];
    const side = i % 16 < 8 ? 1 : -1;
    const len = rnd(i, seed, 20, 38) * (side > 0 ? m.sc * 1.5 : m.in * 2.1);
    const sway = Math.sin(t * 1.6 * m.live + i * 0.9 + seed) * 0.22 * m.live;
    const tx = stem[i + 1].x - stem[i - 1].x, ty = stem[i + 1].y - stem[i - 1].y;
    const tl = Math.hypot(tx, ty) || 1;
    const lean = rnd(i + 91, seed, -0.5, 0.5) + sway;
    const ax = (s2.nx * side) * Math.cos(lean) + (tx / tl) * Math.sin(lean) * side;
    const ay = (s2.ny * side) * Math.cos(lean) + (ty / tl) * Math.sin(lean) * side;
    const px = -ay, py = ax;
    const bx = s2.x, by = s2.y;
    const ex = bx + ax * len, ey = by + ay * len;
    const bel = len * 0.60;
    const mx = bx + ax * len * 0.44, my = by + ay * len * 0.44;
    g.moveTo(bx, by).quadraticCurveTo(mx - px * bel, my - py * bel, ex, ey)
      .lineTo(bx, by).closePath().fill({ color: m.deep, alpha: 0.95 });
    g.moveTo(bx, by).quadraticCurveTo(mx + px * bel, my + py * bel, ex, ey)
      .lineTo(bx, by).closePath().fill({ color: m.mid, alpha: 0.97 });
    g.moveTo(bx, by).lineTo(ex, ey).stroke({ width: 2, color: m.hot, alpha: 0.55 });
    for (const f of [0.34, 0.62]) {
      const vx = bx + ax * len * f, vy = by + ay * len * f;
      g.moveTo(vx, vy).lineTo(vx + px * bel * 0.42 + ax * len * 0.14,
        vy + py * bel * 0.42 + ay * len * 0.14)
        .stroke({ width: 1.5, color: m.hot, alpha: 0.30 });
    }
    g.moveTo(bx, by).quadraticCurveTo(mx + px * bel, my + py * bel, ex, ey)
      .stroke({ width: 1.5, color: 0xd8ffc0, alpha: 0.35 });
  }

  // Glowing motes drifting off the growth — the reference has these and they
  // are most of what makes the tier feel alive.
  for (let i = 0; i < 14; i++) {
    const tt = (hash(i, seed + 7) + t * 0.03 * m.live) % 1;
    const p = perim.at(tt);
    const rise = ((t * 12 * m.live + hash(i, seed + 3) * 70) % 70);
    const a = Math.max(0, 1 - rise / 70) * 0.95;
    const d = 4 + rise * 0.5;
    const px = p.x + p.nx * d, py = p.y + p.ny * d;
    const s3 = 2 + hash(i, seed + 11) * 2.4;
    g.circle(px, py, s3 * 2.2).fill({ color: m.hot, alpha: a * 0.22 });
    g.rect(px - s3, py - 1, s3 * 2, 2).fill({ color: m.hot, alpha: a });
    g.rect(px - 1, py - s3, 2, s3 * 2).fill({ color: m.hot, alpha: a });
  }
}

// RARE — ICE. Angular crystal shards rooted on the border and jutting outward,
// with a shorter inward set so the frame appears to be freezing over from the
// edge in both directions. Shards are quads, not triangles: a quad has a
// visible facet, which is what makes them read as crystal rather than as spikes.
function paintIce(g, perim, m, t, seed) {
  // Chunky ice BLOCKS encrusting the band, not spikes. The reference has
  // slabs with flat faces catching light, clustered heavily at the corners and
  // thinning along the runs — a row of even needles reads as a comb.
  const N = 30;
  for (let i = 0; i < N; i++) {
    const p = perim.at(i / N + 0.004);
    const cw = 1 + 0.9 * (Math.abs(Math.abs(p.nx) - Math.abs(p.ny)) < 0.55 ? 1 : 0);
    const out = i % 5 < 3 ? 1 : -1;
    const grow = 0.75 + 0.25 * Math.sin(t * 1.3 * m.live + i * 1.7 + seed);
    const d = rnd(i, seed, 13, 30) * cw * grow * (out > 0 ? m.sc * 1.25 : m.in * 1.35);
    const wid = rnd(i + 40, seed, 12, 26) * (0.7 + m.sc * 0.4);
    const tilt = rnd(i + 80, seed, -0.34, 0.34);
    const ax = (p.nx * Math.cos(tilt) - p.ny * Math.sin(tilt)) * out;
    const ay = (p.nx * Math.sin(tilt) + p.ny * Math.cos(tilt)) * out;
    const px = -ay, py = ax;
    const bx = p.x, by = p.y;
    // A four-sided slab: wide base, a shoulder, and a blunt top. Blunt is what
    // separates a block of ice from an icicle.
    const s1x = bx + ax * d * 0.55, s1y = by + ay * d * 0.55;
    const tpx = bx + ax * d, tpy = by + ay * d;
    const topW = wid * rnd(i + 120, seed, 0.30, 0.62);
    g.moveTo(bx - px * wid * 0.5, by - py * wid * 0.5)
      .lineTo(s1x - px * wid * 0.46, s1y - py * wid * 0.46)
      .lineTo(tpx - px * topW * 0.5, tpy - py * topW * 0.5)
      .lineTo(tpx + px * topW * 0.5, tpy + py * topW * 0.5)
      .lineTo(s1x + px * wid * 0.48, s1y + py * wid * 0.48)
      .lineTo(bx + px * wid * 0.5, by + py * wid * 0.5)
      .closePath()
      .fill({ color: m.mid, alpha: 0.94 })
      .stroke({ width: 2, color: 0x08131f, alpha: 0.9 });
    // Lit face down one side, shadowed face down the other, and a bright top
    // edge where the slab has been cleaved.
    g.moveTo(bx - px * wid * 0.5, by - py * wid * 0.5)
      .lineTo(s1x - px * wid * 0.46, s1y - py * wid * 0.46)
      .lineTo(tpx - px * topW * 0.5, tpy - py * topW * 0.5)
      .lineTo(tpx, tpy).lineTo(bx, by).closePath()
      .fill({ color: 0xffffff, alpha: 0.30 });
    g.moveTo(bx + px * wid * 0.5, by + py * wid * 0.5)
      .lineTo(s1x + px * wid * 0.48, s1y + py * wid * 0.48)
      .lineTo(tpx + px * topW * 0.5, tpy + py * topW * 0.5)
      .lineTo(tpx, tpy).lineTo(bx, by).closePath()
      .fill({ color: 0x061421, alpha: 0.38 });
    g.moveTo(tpx - px * topW * 0.5, tpy - py * topW * 0.5)
      .lineTo(tpx + px * topW * 0.5, tpy + py * topW * 0.5)
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.8 });
    // A smaller block leaning against the big one, so the encrustation reads
    // as accumulated rather than placed.
    if (i % 2 === 0) {
      const d2 = d * 0.52, w2 = wid * 0.5;
      const ox = px * wid * 0.55, oy = py * wid * 0.55;
      g.moveTo(bx + ox - px * w2 * 0.5, by + oy - py * w2 * 0.5)
        .lineTo(bx + ox + ax * d2 - px * w2 * 0.28, by + oy + ay * d2 - py * w2 * 0.28)
        .lineTo(bx + ox + ax * d2 + px * w2 * 0.28, by + oy + ay * d2 + py * w2 * 0.28)
        .lineTo(bx + ox + px * w2 * 0.5, by + oy + py * w2 * 0.5)
        .closePath()
        .fill({ color: m.mid, alpha: 0.85 })
        .stroke({ width: 1.5, color: 0x08131f, alpha: 0.85 });
    }
  }

  // Frost fractures crawling across the inner edge.
  for (let i = 0; i < 14; i++) {
    const p = perim.at(hash(i, seed + 21));
    let cx = p.x - p.nx * 3, cy = p.y - p.ny * 3;
    g.moveTo(cx, cy);
    for (let k = 0; k < 3; k++) {
      const a = rnd(i * 5 + k, seed + 33, 0, TAU);
      cx += Math.cos(a) * 6; cy += Math.sin(a) * 6;
      g.lineTo(cx, cy);
    }
    g.stroke({ width: 2, color: m.hot, alpha: 0.3 + 0.2 * Math.sin(t * 2 + i) });
  }
}

// EPIC — ARCANE. A machined violet band with engraved notches, filigree
// brackets at the corners and light spikes radiating off the whole edge. The
// first draft used unwinding spirals and they read as pale question marks
// stuck to the border — an ornament has to be legible as a SHAPE at card size,
// and a spiral is not.
function paintArcane(g, perim, m, t, seed) {
  const { x, y, w, h, r } = perim;

  // Radiating light spikes — thin outward triangles all the way round, pulsing
  // in a travelling wave so the edge looks charged rather than merely lit.
  const N = 56;
  for (let i = 0; i < N; i++) {
    const p = perim.at(i / N);
    const wave = 0.45 + 0.55 * Math.sin(t * 2.2 * m.live - i * 0.42 + seed);
    const len = (i % 2 ? 9 : 18) * (0.5 + wave) * (m.sc * 1.25);
    const wid = 3.4;
    const px = -p.ny, py = p.nx;
    g.moveTo(p.x - px * wid, p.y - py * wid)
      .lineTo(p.x + p.nx * len, p.y + p.ny * len)
      .lineTo(p.x + px * wid, p.y + py * wid)
      .closePath()
      .fill({ color: i % 2 ? m.hot : m.mid, alpha: 0.35 + 0.45 * wave });
  }

  // Inward spikes over the card face — the frame grows both ways from epic on.
  for (let i = 0; i < 30; i++) {
    const p = perim.at(i / 30 + 0.02);
    const len = (11 + 15 * Math.abs(Math.sin(t * 1.7 * m.live + i))) * m.in;
    const px2 = -p.ny, py2 = p.nx;
    g.moveTo(p.x - px2 * 2.6, p.y - py2 * 2.6)
      .lineTo(p.x - p.nx * len, p.y - p.ny * len)
      .lineTo(p.x + px2 * 2.6, p.y + py2 * 2.6)
      .closePath().fill({ color: m.hot, alpha: 0.30 });
  }

  // A charged inlay running the band's face — the band itself is drawn by
  // paintBand, this is the energy in it.
  g.roundRect(x, y, w, h, r).stroke({ width: 4, color: m.mid, alpha: 0.9 });
  g.roundRect(x, y, w, h, r).stroke({ width: 1.5, color: m.hot, alpha: 0.6 });

  // Engraved notches cut into the band at a regular pitch — the detail that
  // makes it read as worked metal rather than as a coloured outline.
  const M = 44;
  for (let i = 0; i < M; i++) {
    const p = perim.at(i / M + 0.008);
    const px = -p.ny, py = p.nx;
    g.moveTo(p.x - px * 2.2, p.y - py * 2.2)
      .lineTo(p.x - px * 2.2 + p.nx * 3, p.y - py * 2.2 + p.ny * 3)
      .lineTo(p.x + px * 2.2 + p.nx * 3, p.y + py * 2.2 + p.ny * 3)
      .lineTo(p.x + px * 2.2, p.y + py * 2.2)
      .closePath()
      .fill({ color: m.deep, alpha: 0.85 });
  }

  // Corner filigree: a stepped bracket with a gem at the elbow. Drawn per
  // corner rather than from the perimeter walk, because a corner ornament has
  // to know which way both of its arms run.
  const arm = 34 * (0.7 + m.sc * 0.5);
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]]) {
    g.moveTo(cx + sx * arm, cy - sy * 6)
      .lineTo(cx + sx * 12, cy - sy * 6)
      .lineTo(cx - sx * 6, cy + sy * 12)
      .lineTo(cx - sx * 6, cy + sy * arm)
      .stroke({ width: 3.5, color: m.hot, alpha: 0.9 });
    g.moveTo(cx + sx * (arm - 10), cy + sy * 3)
      .lineTo(cx + sx * 9, cy + sy * 3)
      .lineTo(cx + sx * 3, cy + sy * 9)
      .lineTo(cx + sx * 3, cy + sy * (arm - 10))
      .stroke({ width: 2.5, color: m.deep, alpha: 0.95 });
    const gem = 4.5 + Math.sin(t * 2.6 + sx * sy) * 1.4;
    g.moveTo(cx + sx * 7, cy + sy * 7 - gem).lineTo(cx + sx * 7 + gem, cy + sy * 7)
      .lineTo(cx + sx * 7, cy + sy * 7 + gem).lineTo(cx + sx * 7 - gem, cy + sy * 7)
      .closePath().fill({ color: m.hot, alpha: 0.95 });
  }

  // Rune motes drifting off the frame.
  for (let i = 0; i < 16; i++) {
    const p = perim.at(hash(i, seed + 5) + t * (i % 2 ? 0.024 : -0.017));
    const d = (14 + Math.sin(t * 1.9 * m.live + i * 2.1) * 10) * (0.7 + m.sc * 0.5);
    const cx = p.x + p.nx * d, cy = p.y + p.ny * d;
    const s = 3.5 + hash(i, seed + 9) * 3.5;
    const a = 0.35 + 0.5 * Math.sin(t * 2.6 + i);
    g.rect(cx - s, cy - 1.5, s * 2, 3).fill({ color: m.hot, alpha: a });
    g.rect(cx - 1.5, cy - s, 3, s * 2).fill({ color: m.hot, alpha: a });
  }
}

// LEGENDARY — FLAME. Tongues rooted along the entire border, licking outward
// with a per-tongue phase so the edge ripples instead of pulsing as one unit,
// plus a short inward set that puts fire on the inside of the frame too.
// Three stacked fills per tongue (deep root, body, hot core) is what separates
// fire from an orange triangle.
function paintFlame(g, perim, m, t, seed) {
  const { x, y, w, h, r } = perim;

  const tongue = (p, out, len, wid, phase, color, alpha) => {
    const ax = p.nx * out, ay = p.ny * out;
    const px = -ay, py = ax;
    const bend = Math.sin(phase) * len * 0.34;
    const bx = p.x, by = p.y;
    const tipx = bx + ax * len + px * bend, tipy = by + ay * len + py * bend;
    const c1x = bx + ax * len * 0.4 + px * (wid * 0.9 + bend * 0.2);
    const c1y = by + ay * len * 0.4 + py * (wid * 0.9 + bend * 0.2);
    const c2x = bx + ax * len * 0.4 - px * (wid * 0.9 - bend * 0.2);
    const c2y = by + ay * len * 0.4 - py * (wid * 0.9 - bend * 0.2);
    g.moveTo(bx - px * wid, by - py * wid)
      .quadraticCurveTo(c1x, c1y, tipx, tipy)
      .quadraticCurveTo(c2x, c2y, bx + px * wid, by + py * wid)
      .closePath()
      .fill({ color, alpha });
  };

  const N = 64;
  for (let i = 0; i < N; i++) {
    const p = perim.at(i / N);
    const out = i % 3 === 2 ? -1 : 1;
    const ph = t * 3.1 * m.live + i * 1.31 + seed;
    const flick = 0.72 + 0.28 * Math.sin(ph * 1.7);
    const len = rnd(i, seed, 30, 72) * flick * (out > 0 ? m.sc : m.in * 0.80);
    const wid = rnd(i + 30, seed, 7, 13) * (0.7 + m.sc * 0.3);
    tongue(p, out, len, wid, ph, m.deep, 0.95);
    tongue(p, out, len * 0.72, wid * 0.72, ph + 0.4, m.mid, 0.95);
    tongue(p, out, len * 0.4, wid * 0.42, ph + 0.8, m.hot, 0.9);
  }

  g.roundRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3))
    .stroke({ width: 2, color: m.hot, alpha: 0.5 });

  // Embers rising off the frame and burning out.
  for (let i = 0; i < 18; i++) {
    const life = ((t * 0.35 * m.live + hash(i, seed + 13)) % 1);
    const p = perim.at(hash(i, seed + 17));
    const d = 3 + life * 34;
    const cx = p.x + p.nx * d + Math.sin(life * 9 + i) * 4;
    const cy = p.y + p.ny * d - life * 12;
    const s = 2 + (1 - life) * 2;
    g.rect(cx - s / 2, cy - s / 2, s, s)
      .fill({ color: life > 0.6 ? m.deep : m.hot, alpha: (1 - life) * 0.95 });
  }
}

// MYTHICAL — CRACKS. A band of dark stone wrapped round the card, split by
// fissures that glow from inside. The first draft drew the fissures as loose
// red lines floating off the border and it read as scribble: a crack is only a
// crack if there is something for it to be a crack IN. So the rock is laid
// down first, as a wide stroke along a wobbling offset of the perimeter, and
// every fissure lives inside it.
function paintCracks(g, perim, m, t, seed) {
  const { x, y, w, h, r } = perim;
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 * m.live + seed);

  // The rock. A wide stroke along a wobbling path gives a chunky irregular
  // silhouette without needing a boolean subtract, and the wobble is what stops
  // it reading as a rounded rectangle painted brown.
  const N = 120;
  const ring = [];
  for (let i = 0; i <= N; i++) {
    const p = perim.at(i / N);
    const off = (6 + Math.sin(i * 0.7 + seed) * 4.2 + Math.sin(i * 0.23 + seed * 2) * 5.5) * (0.5 + m.sc * 0.5);
    ring.push({ x: p.x + p.nx * off, y: p.y + p.ny * off, nx: p.nx, ny: p.ny });
  }
  const trace = () => {
    g.moveTo(ring[0].x, ring[0].y);
    for (let i = 1; i < ring.length; i++) g.lineTo(ring[i].x, ring[i].y);
  };
  trace(); g.stroke({ width: 34 * m.sc, color: 0x090207, alpha: 1 });
  trace(); g.stroke({ width: 27 * m.sc, color: 0x241017, alpha: 1 });
  trace(); g.stroke({ width: 14 * m.sc, color: 0x120509, alpha: 0.95 });

  // Facets. Short strokes cut across the band at random angles, half light and
  // half dark, which is what turns a smooth ribbon into stone — without them
  // the band reads as a soft maroon halo, which is exactly how it first came
  // out.
  for (let i = 0; i < 60; i++) {
    const q = ring[Math.floor(hash(i, seed + 61) * (ring.length - 1))];
    const a = rnd(i, seed + 63, 0, TAU);
    const l = rnd(i + 5, seed + 67, 5, 13);
    const light = i % 3 === 0;
    g.moveTo(q.x - Math.cos(a) * l, q.y - Math.sin(a) * l)
      .lineTo(q.x + Math.cos(a) * l, q.y + Math.sin(a) * l)
      .stroke({ width: light ? 2 : 3, color: light ? 0x4a2430 : 0x070105, alpha: light ? 0.7 : 0.9 });
  }

  // Fissures. Each runs across the band and part of the way out of it, forking
  // once, with a hot core inside the widest section.
  const F = 30;
  for (let i = 0; i < F; i++) {
    const p = perim.at(i / F + 0.006);
    const out = i % 3 === 2 ? -1 : 1;
    const branch = (sx, sy, ax, ay, len, depth) => {
      let cx = sx, cy = sy;
      const pts = [[cx, cy]];
      const steps = 3 + depth;
      for (let k = 0; k < steps; k++) {
        const jit = rnd(i * 13 + k + depth * 7, seed, -0.55, 0.55);
        const dx = ax * Math.cos(jit) - ay * Math.sin(jit);
        const dy = ax * Math.sin(jit) + ay * Math.cos(jit);
        cx += dx * (len / steps); cy += dy * (len / steps);
        pts.push([cx, cy]);
      }
      g.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
      // Dark trench first, then a thin hot line inside it. A crack is a gap
      // with light at the bottom; a single bright stroke is a wire laid on top.
      g.stroke({ width: depth > 0 ? 7 : 4, color: 0x050004, alpha: 1 });
      g.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
      g.stroke({ width: depth > 0 ? 2.5 : 1.5, color: m.mid, alpha: (depth > 0 ? 1 : 0.75) * pulse });
      if (depth > 0) {
        const a = rnd(i + 200, seed, -1.0, 1.0);
        branch(cx, cy, ax * Math.cos(a) - ay * Math.sin(a), ax * Math.sin(a) + ay * Math.cos(a), len * 0.5, depth - 1);
      }
    };
    branch(p.x - p.nx * 4 * out, p.y - p.ny * 4 * out, p.nx * out, p.ny * out,
      rnd(i, seed, 13, 26) * (out > 0 ? m.sc : m.in * 1.25), 1);
  }

  // Light bleeding out of the rock, and a hot inner rim.
  trace(); g.stroke({ width: 3, color: m.mid, alpha: 0.35 * pulse });
  g.roundRect(x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 2))
    .stroke({ width: 3, color: m.mid, alpha: 0.9 });
  g.roundRect(x + 7, y + 7, w - 14, h - 14, Math.max(2, r - 5))
    .stroke({ width: 2, color: m.hot, alpha: 0.4 * pulse });

  // Shards that have already broken off, tumbling outward.
  for (let i = 0; i < 9; i++) {
    const p = perim.at(hash(i, seed + 41));
    const drift = 10 + ((t * 6 * m.live + hash(i, seed + 43) * 34) % 34);
    const cx = p.x + p.nx * drift, cy = p.y + p.ny * drift;
    const s = rnd(i, seed + 47, 3, 7);
    const a = t * 0.8 + i;
    const fade = Math.max(0, 1 - drift / 46);
    g.moveTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s)
      .lineTo(cx + Math.cos(a + 2.3) * s * 0.8, cy + Math.sin(a + 2.3) * s * 0.8)
      .lineTo(cx + Math.cos(a + 4.2) * s * 1.1, cy + Math.sin(a + 4.2) * s * 1.1)
      .closePath()
      .fill({ color: 0x1f0a12, alpha: fade })
      .stroke({ width: 2, color: m.mid, alpha: fade * 0.85 });
  }
}


// COMMON — STEEL. Bolted plates riveted over the band, some standing proud of
// it and some sunk into the card face. The lowest tier still grows in and out,
// it just grows in metal rather than in anything alive — which is what keeps
// the ladder consistent while leaving common unmistakably the floor.
function paintSteel(g, perim, m, t, seed) {
  const N = 22;
  for (let i = 0; i < N; i++) {
    const p = perim.at(i / N + 0.01);
    const out = i % 3 === 2 ? -1 : 1;
    const d = rnd(i, seed, 11, 22) * (out > 0 ? m.sc * 1.5 : m.in * 2.6);
    const wid = rnd(i + 30, seed, 18, 34);
    // Slanted, not square on. A plate set at an angle reads as panelling laid
    // over a frame; square tabs read as buttons.
    const tilt = rnd(i + 60, seed, -0.42, 0.42);
    const ax = (p.nx * Math.cos(tilt) - p.ny * Math.sin(tilt)) * out;
    const ay = (p.nx * Math.sin(tilt) + p.ny * Math.cos(tilt)) * out;
    const px = -ay, py = ax;
    const bx = p.x, by = p.y;
    const ex = bx + ax * d, ey = by + ay * d;
    // Plate: a flat slab with a chamfered outer edge.
    const ch = wid * 0.16;
    g.moveTo(bx - px * wid * 0.5, by - py * wid * 0.5)
      .lineTo(ex - px * wid * 0.36 - ax * ch, ey - py * wid * 0.36 - ay * ch)
      .lineTo(ex - px * (wid * 0.36 - ch), ey - py * (wid * 0.36 - ch))
      .lineTo(ex + px * (wid * 0.36 - ch), ey + py * (wid * 0.36 - ch))
      .lineTo(ex + px * wid * 0.36 - ax * ch, ey + py * wid * 0.36 - ay * ch)
      .lineTo(bx + px * wid * 0.5, by + py * wid * 0.5)
      .closePath()
      .fill({ color: 0x5d6b7e })
      .stroke({ width: 2, color: 0x05070d, alpha: 0.95 });
    // Brushed highlight along the lit side and a shadow on the other.
    g.moveTo(bx - px * wid * 0.42, by - py * wid * 0.42)
      .lineTo(ex - px * wid * 0.30, ey - py * wid * 0.30)
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.26 });
    g.moveTo(bx + px * wid * 0.44, by + py * wid * 0.44)
      .lineTo(ex + px * wid * 0.32, ey + py * wid * 0.32)
      .stroke({ width: 2, color: 0x000000, alpha: 0.40 });
    // Two bolts per plate — sunk holes with a lit lip.
    for (const sgn of [-1, 1]) {
      const rx = bx + ax * d * 0.45 + px * sgn * wid * 0.24;
      const ry = by + ay * d * 0.45 + py * sgn * wid * 0.24;
      g.circle(rx, ry, 2.8).fill({ color: 0x2c3644 });
      g.circle(rx, ry, 2.8).stroke({ width: 1.2, color: 0x05070d, alpha: 0.9 });
      g.circle(rx - 0.9, ry - 0.9, 1.2).fill({ color: 0xffffff, alpha: 0.45 });
    }
  }
  // A cold sheen creeping along the band, the only thing on this tier that
  // moves at all.
  for (let i = 0; i < 3; i++) {
    const tt = ((t * 0.05 * m.live + i / 3) % 1);
    const p = perim.at(tt);
    g.circle(p.x, p.y, 9).fill({ color: 0xffffff, alpha: 0.07 });
    g.circle(p.x, p.y, 4).fill({ color: 0xffffff, alpha: 0.10 });
  }
}

// MYTHICAL — CLOUDS. Billowing storm wrapped round the card with light buried
// inside it, not a rock band. Every lobe is a stack of offset discs, lit on
// the side facing the card's own glow and dark on the other, so the mass has
// volume; the light comes from WITHIN the cloud, which is what makes the tier
// read as something powered rather than something heavy.
function paintClouds(g, perim, m, t, seed) {
  const puff = (x, y, r, lit, alpha) => {
    g.circle(x, y, r).fill({ color: 0x140610, alpha });
    g.circle(x - r * 0.26, y - r * 0.30, r * 0.72).fill({ color: 0x2a0f1c, alpha: alpha * 0.9 });
    if (lit) {
      g.circle(x - r * 0.34, y - r * 0.38, r * 0.44).fill({ color: m.deep, alpha: 0.55 });
      g.circle(x - r * 0.40, y - r * 0.44, r * 0.22).fill({ color: m.mid, alpha: 0.35 });
    }
  };

  const N = 46;
  // Outward mass.
  for (let i = 0; i < N; i++) {
    const p = perim.at(i / N + 0.006);
    const breathe = 0.75 + 0.25 * Math.sin(t * 0.9 * m.live + i * 0.8 + seed);
    const d = rnd(i, seed, 4, 16) * m.sc * breathe;
    const r = rnd(i + 40, seed, 11, 22) * (0.6 + m.sc * 0.4) * breathe;
    puff(p.x + p.nx * d, p.y + p.ny * d, r, i % 3 === 0, 0.92);
  }
  // Inward mass, rolling over the card face.
  for (let i = 0; i < Math.round(N * 0.6); i++) {
    const p = perim.at(i / (N * 0.6) + 0.03);
    const breathe = 0.75 + 0.25 * Math.sin(t * 1.1 * m.live - i * 0.7 + seed);
    const d = rnd(i + 90, seed, 3, 13) * m.in * breathe;
    const r = rnd(i + 130, seed, 8, 17) * (0.6 + m.in * 0.4) * breathe;
    puff(p.x - p.nx * d, p.y - p.ny * d, r, i % 4 === 0, 0.80);
  }

  // Light inside the cloud: slow glows that swell and fade at different rates,
  // so the mass looks lit from within rather than tinted.
  for (let i = 0; i < 9; i++) {
    const p = perim.at(hash(i, seed + 31));
    const ph = (t * 0.55 * m.live + hash(i, seed + 37) * 6.28);
    const k = Math.max(0, Math.sin(ph));
    if (k <= 0.02) continue;
    const gx = p.x + p.nx * rnd(i, seed + 41, -8, 10);
    const gy = p.y + p.ny * rnd(i, seed + 43, -8, 10);
    for (let r = 3; r >= 1; r--) {
      g.circle(gx, gy, 9 * r * (0.5 + k * 0.7))
        .fill({ color: r > 2 ? m.deep : m.mid, alpha: 0.10 * k * (4 - r) / 3 });
    }
    g.circle(gx, gy, 4 * k).fill({ color: m.hot, alpha: 0.55 * k });
  }

  // Discharge inside the mass — brief, mostly buried, never a clean bolt.
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.8 * m.live + i * 1.7) % 6.28;
    const k = Math.max(0, Math.sin(ph * 3)) ** 6;
    if (k < 0.05) continue;
    const p = perim.at(hash(i, seed + 51));
    let cx2 = p.x, cy2 = p.y;
    g.moveTo(cx2, cy2);
    for (let s2 = 0; s2 < 4; s2++) {
      const a = rnd(i * 7 + s2, seed + 57, 0, TAU);
      cx2 += Math.cos(a) * 11; cy2 += Math.sin(a) * 11;
      g.lineTo(cx2, cy2);
    }
    g.stroke({ width: 2.5, color: m.hot, alpha: 0.75 * k });
  }

  // A hot rim just inside the card, so the light reads as reaching the plate.
  const { x, y, w, h, r } = perim;
  g.roundRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4))
    .stroke({ width: 2, color: m.mid, alpha: 0.35 + 0.25 * Math.sin(t * 1.6 * m.live) });
}


// What each tier puts on its corner wedges. The wedge shape is shared; this is
// the substance — steel gets studs, ice gets facets, leaves get a spray, flame
// gets tongues, cloud gets a lit puff.
const GUSSET_DETAIL = {
  steel(g, m, t, seed, ci, ax, ay, bx, by, nx, ny, push) {
    for (const f of [0.3, 0.7]) {
      const px2 = ax + (bx - ax) * f + nx * push * 0.55;
      const py2 = ay + (by - ay) * f + ny * push * 0.55;
      g.circle(px2, py2, 3.2).fill({ color: 0x2c3644 });
      g.circle(px2, py2, 3.2).stroke({ width: 1.2, color: 0x05070d, alpha: 0.9 });
      g.circle(px2 - 1, py2 - 1, 1.4).fill({ color: 0xffffff, alpha: 0.5 });
    }
  },
  vines(g, m, t, seed, ci, ax, ay, bx, by, nx, ny, push) {
    // A spray of leaves off the wedge, reaching further in than anything on
    // the straight runs — the reference stacks its foliage in the corners.
    for (let k = 0; k < 4; k++) {
      const f = 0.18 + k * 0.22;
      const bx2 = ax + (bx - ax) * f + nx * push * 0.6;
      const by2 = ay + (by - ay) * f + ny * push * 0.6;
      const ang = Math.atan2(ny, nx) + rnd(ci * 9 + k, seed, -0.9, 0.9)
        + Math.sin(t * 1.4 * m.live + k) * 0.14;
      const len = rnd(ci * 5 + k, seed, 13, 26) * (0.6 + m.in);
      const ex = bx2 + Math.cos(ang) * len, ey = by2 + Math.sin(ang) * len;
      const px3 = -Math.sin(ang), py3 = Math.cos(ang);
      const bel = len * 0.5;
      const mx2 = bx2 + Math.cos(ang) * len * 0.45, my2 = by2 + Math.sin(ang) * len * 0.45;
      g.moveTo(bx2, by2).quadraticCurveTo(mx2 - px3 * bel, my2 - py3 * bel, ex, ey)
        .lineTo(bx2, by2).closePath().fill({ color: m.deep, alpha: 0.95 });
      g.moveTo(bx2, by2).quadraticCurveTo(mx2 + px3 * bel, my2 + py3 * bel, ex, ey)
        .lineTo(bx2, by2).closePath().fill({ color: m.mid, alpha: 0.95 });
      g.moveTo(bx2, by2).lineTo(ex, ey).stroke({ width: 1.5, color: m.hot, alpha: 0.5 });
    }
  },
  ice(g, m, t, seed, ci, ax, ay, bx, by, nx, ny, push) {
    for (let k = 0; k < 3; k++) {
      const f = 0.22 + k * 0.28;
      const bx2 = ax + (bx - ax) * f + nx * push * 0.5;
      const by2 = ay + (by - ay) * f + ny * push * 0.5;
      const len = rnd(ci * 7 + k, seed, 12, 26) * (0.6 + m.in);
      const wid = rnd(ci * 11 + k, seed, 8, 15);
      const ang = Math.atan2(ny, nx) + rnd(ci + k, seed, -0.4, 0.4);
      const dx2 = Math.cos(ang), dy2 = Math.sin(ang);
      const px3 = -dy2, py3 = dx2;
      g.moveTo(bx2 - px3 * wid * 0.5, by2 - py3 * wid * 0.5)
        .lineTo(bx2 + dx2 * len - px3 * wid * 0.24, by2 + dy2 * len - py3 * wid * 0.24)
        .lineTo(bx2 + dx2 * len + px3 * wid * 0.24, by2 + dy2 * len + py3 * wid * 0.24)
        .lineTo(bx2 + px3 * wid * 0.5, by2 + py3 * wid * 0.5)
        .closePath().fill({ color: m.mid, alpha: 0.92 })
        .stroke({ width: 1.5, color: 0x08131f, alpha: 0.9 });
      g.moveTo(bx2 - px3 * wid * 0.4, by2 - py3 * wid * 0.4)
        .lineTo(bx2 + dx2 * len - px3 * wid * 0.2, by2 + dy2 * len - py3 * wid * 0.2)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
    }
  },
  flame(g, m, t, seed, ci, ax, ay, bx, by, nx, ny, push) {
    for (let k = 0; k < 3; k++) {
      const f = 0.24 + k * 0.26;
      const bx2 = ax + (bx - ax) * f + nx * push * 0.5;
      const by2 = ay + (by - ay) * f + ny * push * 0.5;
      const ph = t * 3.0 * m.live + ci * 2 + k;
      const len = rnd(ci * 3 + k, seed, 14, 30) * (0.55 + 0.45 * Math.sin(ph)) * (0.6 + m.in);
      const ang = Math.atan2(ny, nx) + Math.sin(ph * 1.3) * 0.3;
      const dx2 = Math.cos(ang), dy2 = Math.sin(ang);
      const px3 = -dy2, py3 = dx2;
      for (const [sc2, col] of [[1, m.deep], [0.7, m.mid], [0.38, m.hot]]) {
        g.moveTo(bx2 - px3 * 5 * sc2, by2 - py3 * 5 * sc2)
          .quadraticCurveTo(bx2 + dx2 * len * 0.5 * sc2 + px3 * 7 * sc2,
            by2 + dy2 * len * 0.5 * sc2 + py3 * 7 * sc2,
            bx2 + dx2 * len * sc2, by2 + dy2 * len * sc2)
          .quadraticCurveTo(bx2 + dx2 * len * 0.5 * sc2 - px3 * 7 * sc2,
            by2 + dy2 * len * 0.5 * sc2 - py3 * 7 * sc2,
            bx2 + px3 * 5 * sc2, by2 + py3 * 5 * sc2)
          .closePath().fill({ color: col, alpha: 0.9 });
      }
    }
  },
  clouds(g, m, t, seed, ci, ax, ay, bx, by, nx, ny, push) {
    for (let k = 0; k < 3; k++) {
      const f = 0.2 + k * 0.3;
      const breathe = 0.8 + 0.2 * Math.sin(t * 0.9 * m.live + ci + k);
      const bx2 = ax + (bx - ax) * f + nx * push * (0.7 + k * 0.5) * breathe;
      const by2 = ay + (by - ay) * f + ny * push * (0.7 + k * 0.5) * breathe;
      const r2 = rnd(ci * 13 + k, seed, 10, 20) * (0.6 + m.in * 0.5) * breathe;
      g.circle(bx2, by2, r2).fill({ color: 0x140610, alpha: 0.9 });
      g.circle(bx2 - r2 * 0.26, by2 - r2 * 0.30, r2 * 0.7).fill({ color: 0x2a0f1c, alpha: 0.85 });
      if (k === 1) {
        g.circle(bx2 - r2 * 0.32, by2 - r2 * 0.36, r2 * 0.4).fill({ color: m.deep, alpha: 0.5 });
        g.circle(bx2 - r2 * 0.36, by2 - r2 * 0.40, r2 * 0.2).fill({ color: m.mid, alpha: 0.35 });
      }
    }
  },
  arcane(g, m, t, seed, ci, ax, ay, bx, by, nx, ny, push) {
    // A filigree bracket following the diagonal, with a gem at its middle.
    const mx2 = (ax + bx) / 2 + nx * push * 0.7, my2 = (ay + by) / 2 + ny * push * 0.7;
    g.moveTo(ax, ay).quadraticCurveTo(mx2, my2, bx, by)
      .stroke({ width: 3, color: m.hot, alpha: 0.75 });
    g.moveTo(ax, ay).quadraticCurveTo(mx2 + nx * 6, my2 + ny * 6, bx, by)
      .stroke({ width: 1.5, color: m.mid, alpha: 0.6 });
    const gem = 5 + Math.sin(t * 2.4 * m.live + ci) * 1.8;
    g.moveTo(mx2, my2 - gem).lineTo(mx2 + gem, my2).lineTo(mx2, my2 + gem)
      .lineTo(mx2 - gem, my2).closePath().fill({ color: m.hot, alpha: 0.95 });
  },
};

const PAINTERS = {
  plate: paintPlate, steel: paintSteel, vines: paintVines, ice: paintIce,
  arcane: paintArcane, flame: paintFlame, cracks: paintCracks, clouds: paintClouds,
};

/**
 * Paint a rarity frame. `g` is cleared first, so this is safe to call every
 * frame with a fresh time value.
 */
export function paintFrame(g, perim, rarity, time, seed) {
  const m = MATERIALS[rarity] || MATERIALS.common;
  g.clear();
  // Band first, material on top. Every tier gets a real structural frame; the
  // material is what grows ON it, which is the whole difference between "a
  // frame with ice on it" and "ice floating near an outline".
  paintBand(g, perim, m, m.bw, m.face, time);
  // The diagonal corner wedges go on before the running material, so vines,
  // ice and flame grow over them rather than being cut off by them.
  paintCornerGussets(g, perim, m, time, seed, GUSSET_DETAIL[m.kind]);
  (PAINTERS[m.kind] || paintPlate)(g, perim, m, time, seed);
  return m;
}

/**
 * The card body: a dark plate with a rarity-tinted vertical wash and a soft
 * inner vignette. Drawn under the frame so the material sits ON the card
 * rather than beside it.
 */
export function paintBody(g, x, y, w, h, r, tint) {
  g.clear();
  // Cast shadow. The card has to sit ABOVE the screen, not on it — without
  // something dark under the bottom edge every frame in the world still reads
  // as a sticker. Stacked offset plates rather than a blur filter, for the
  // same reason the glow is stacked: this layer is downsampled, and a blur
  // would be blurred twice into mush.
  for (let i = 5; i >= 1; i--) {
    const o = i * 2.6;
    g.roundRect(x - o * 0.35, y + o * 0.9, w + o * 0.7, h + o * 0.5, r + o * 0.4)
      .fill({ color: 0x000000, alpha: 0.10 * (1 - i / 6) });
  }
  g.roundRect(x, y, w, h, r).fill({ color: 0x080a12, alpha: 0.98 });
  // Rarity wash, strongest at the top where the art sits, fading to near black
  // at the text. Approximated with stacked bands rather than a gradient fill so
  // it survives the half-resolution downsample without banding artefacts.
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    const u = i / bands;
    g.roundRect(x + 2, y + 2 + (h - 4) * u, w - 4, (h - 4) / bands + 1, i === 0 ? r : 0)
      .fill({ color: tint, alpha: 0.16 * (1 - u) * (1 - u) });
  }
  g.roundRect(x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 1))
    .stroke({ width: 2, color: 0x000000, alpha: 0.5 });
  bevel(g, x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 1), 2.5, 0.20, 0.55);
}

/**
 * The single most useful 3D trick there is: light on the top-left edge, dark
 * on the bottom-right. One consistent light direction across the whole card —
 * plate, panels, badge box, art well — is what makes the layers read as
 * stacked physical parts instead of as rectangles of different colours.
 *
 * `raised` +1 lights the top (a part standing proud), -1 lights the bottom
 * (a part sunk into the card).
 */
export function bevel(g, x, y, w, h, r, width, lightA, darkA, raised = 1) {
  const lit = raised > 0
    ? [[x + r * 0.6, y + width / 2], [x + w - r * 0.6, y + width / 2]]
    : [[x + r * 0.6, y + h - width / 2], [x + w - r * 0.6, y + h - width / 2]];
  const shd = raised > 0
    ? [[x + r * 0.6, y + h - width / 2], [x + w - r * 0.6, y + h - width / 2]]
    : [[x + r * 0.6, y + width / 2], [x + w - r * 0.6, y + width / 2]];
  g.moveTo(lit[0][0], lit[0][1]).lineTo(lit[1][0], lit[1][1])
    .stroke({ width, color: 0xffffff, alpha: lightA });
  g.moveTo(shd[0][0], shd[0][1]).lineTo(shd[1][0], shd[1][1])
    .stroke({ width, color: 0x000000, alpha: darkA });
  // Side walls, half strength — the light is up and slightly left, so the left
  // wall catches a little and the right wall loses a little.
  g.moveTo(x + width / 2, y + r * 0.6).lineTo(x + width / 2, y + h - r * 0.6)
    .stroke({ width, color: 0xffffff, alpha: lightA * 0.5 });
  g.moveTo(x + w - width / 2, y + r * 0.6).lineTo(x + w - width / 2, y + h - r * 0.6)
    .stroke({ width, color: 0x000000, alpha: darkA * 0.5 });
}

/**
 * A specular band sweeping across the card face. Clipped to the card by being
 * drawn as a parallelogram intersected with the plate bounds — cheap, and it
 * is what makes the surface read as something with a finish rather than as
 * flat paint.
 */
export function paintSheen(g, x, y, w, h, r, phase, strength) {
  g.clear();
  if (strength <= 0) return;
  // Travel from off the left edge to off the right, so the band enters and
  // leaves instead of popping.
  const sweep = ((phase % 1) + 1) % 1;
  const cx = x - w * 0.6 + sweep * (w * 2.2);
  const bw = w * 0.30;
  const lean = h * 0.34;
  for (let i = 0; i < 3; i++) {
    const k = 1 - i / 3;
    const bwi = bw * (0.35 + 0.65 * (1 - k));
    g.moveTo(cx - bwi / 2 + lean, y)
      .lineTo(cx + bwi / 2 + lean, y)
      .lineTo(cx + bwi / 2 - lean, y + h)
      .lineTo(cx - bwi / 2 - lean, y + h)
      .closePath()
      .fill({ color: 0xffffff, alpha: 0.05 * k * strength });
  }
}

/**
 * UNUSED by the card renderer — kept only as a reference implementation.
 *
 * The cards now light through baked additive sprites, because the project's
 * lighting rule is "never redraw vector-circle lights per frame; bake once,
 * pool sprites, scale/tint/position only" (.claude/skills/waterdrop-lighting).
 * Do not wire this back in without reading that skill first.
 *
 * Outer glow. Concentric rounded strokes rather than a blur filter: a filter
 * on a half-resolution layer would be blurred twice (once by the filter, once
 * by the downsample) and turn to mush, and this reads correctly under
 * nearest-neighbour upscaling.
 */
export function paintGlow(g, x, y, w, h, r, color, strength) {
  g.clear();
  if (strength <= 0) return;
  const rings = 7;
  for (let i = rings; i >= 1; i--) {
    const o = i * 3.2;
    g.roundRect(x - o, y - o, w + o * 2, h + o * 2, r + o)
      .stroke({ width: 3.2, color, alpha: (strength * 0.13) * (1 - i / (rings + 1)) ** 1.4 });
  }
}
