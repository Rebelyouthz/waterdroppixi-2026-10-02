// THE HERO, DRAWN ONCE.
//
// These three functions were methods on PixiRenderer. Every one of them turned
// out to use NO `this` at all — they were pure functions that happened to live
// on a class — so they are lifted here verbatim and the renderer now delegates
// to them.
//
// The reason is the intro film. Timmy: "tänk på göra han som han är ingame de
// han vi ska vara de måste se lika ut." The face rig in particular is hard-won
// (six expressions, per-eye perspective, blinking, a brow clamped against the
// teardrop silhouette after it was found hanging in open space) and a second
// copy of it drawn for the cinematic would drift from the real character
// within one session. heroShape.js already opens with "ONE SOURCE OF TRUTH"
// for the same reason.
//
// `rot` and `rotPoly` came along because these functions need them; the
// renderer imports them back, so its 48 existing call sites are unchanged.
import { heroHalfWidthAt } from './heroShape';

export function rot(x, y, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [x * c - y * s, y * c + x * s];
}

export function rotPoly(cx, cy, ang, localPts) {
  const out = [];
  for (let i = 0; i < localPts.length; i += 2) {
    const [rx, ry] = rot(localPts[i], localPts[i + 1], ang);
    out.push(cx + rx, cy + ry);
  }
  return out;
}

export function drawHeldWeapon(gf, model, gx, gy, ang, rl, p, game) {
  const box = (lx, ly, lw, lh, color, alpha) => {
    const shape = gf.poly(rotPoly(gx, gy, ang, [lx, ly, lx + lw, ly, lx + lw, ly + lh, lx, ly + lh]));
    shape.fill(alpha != null ? { color, alpha } : color);
  };
  for (const [lx, ly, lw, lh, col, alpha] of model.parts) box(lx, ly, lw, lh, col, alpha);

  if (model.kind === 'bow') {
    // A bow is a curve and a string, not a box stack. The string draws back
    // as the shot charges and snaps forward on release.
    const draw = Math.max(0, Math.min(1, p.recoil * 2.6));
    const limb = model.limb;
    const tipA = rot(2, -limb, ang), tipB = rot(2, limb, ang);
    const belly = rot(10, 0, ang);
    gf.moveTo(gx + tipA[0], gy + tipA[1])
      .quadraticCurveTo(gx + belly[0], gy + belly[1], gx + tipB[0], gy + tipB[1])
      .stroke({ width: 2.6, color: model.accent });
    const nock = rot(-2 - draw * 7, 0, ang);
    gf.moveTo(gx + tipA[0], gy + tipA[1])
      .lineTo(gx + nock[0], gy + nock[1])
      .lineTo(gx + tipB[0], gy + tipB[1])
      .stroke({ width: 1, color: '#e8e2d0', alpha: 0.85 });
    if (draw > 0.05) {
      const aTail = rot(-2 - draw * 7, 0, ang), aHead = rot(14, 0, ang);
      gf.moveTo(gx + aTail[0], gy + aTail[1]).lineTo(gx + aHead[0], gy + aHead[1])
        .stroke({ width: 1.6, color: '#cfd6de' });
    }
  }

  // Attachments. Drawn from the same local-space box helper as the weapon
  // itself, so a socketed part sits ON the gun rather than floating near
  // it. If you cannot see it, it is a stat, not a part — see
  // game/attachments.js.
  const att = game._attachLooks;
  if (att) {
    const m = model.muzzle;
    if (att.barrel) {
      const c = att.barrel.color;
      if (att.barrel.look === 'long')   { box(m - 2, -1.8, 12, 3.6, '#2a313d'); box(m + 9, -2.4, 2, 4.8, c); }
      if (att.barrel.look === 'short')  { box(m - 8, -2.6, 4, 5.2, c); }
      if (att.barrel.look === 'ported') { box(m - 9, -3.2, 8, 1.4, c); box(m - 9, 1.8, 8, 1.4, c); }
    }
    if (att.optic) {
      const c = att.optic.color;
      if (att.optic.look === 'dot')   { box(4, -8.4, 6, 3.2, '#11161e'); box(5.5, -9.6, 3, 1.6, c); }
      if (att.optic.look === 'scope') { box(2, -9.6, 15, 4.4, '#11161e'); box(15, -9.2, 2, 3.6, c); box(3, -10.6, 3, 1.4, '#2a313d'); }
      if (att.optic.look === 'wide')  { box(3, -8.0, 11, 2.6, '#11161e'); box(3, -8.8, 11, 1.0, c); }
    }
    if (att.magazine) {
      const c = att.magazine.color;
      if (att.magazine.look === 'drum')  { box(-5, 3, 10, 11, '#2a313d'); box(-3.5, 5, 7, 7, c); }
      if (att.magazine.look === 'short') { box(-4, 3, 6, 6, c); }
      if (att.magazine.look === 'belt')  { for (let i = 0; i < 5; i++) box(-6 - i * 3, 4 + i * 1.6, 2.4, 2.4, c); }
    }
    if (att.underbarrel) {
      const c = att.underbarrel.color;
      if (att.underbarrel.look === 'grip')    { box(11, 2.6, 3.4, 8, c); }
      if (att.underbarrel.look === 'bipod')   { box(m - 10, 2.6, 1.6, 7, c); box(m - 4, 2.6, 1.6, 7, c); }
      if (att.underbarrel.look === 'bayonet') { box(m - 2, -0.8, 13, 1.8, c); }
    }
    if (att.coating) {
      // A wash tints the whole weapon rather than adding geometry.
      for (const [lx, ly, lw, lh] of model.parts.map(p => p)) {
        box(lx, ly, lw, lh, att.coating.color, 0.22);
      }
    }
  }

  // Slide travel from the reload pose lands on the model's own slide box.
  if (rl.slide !== 0 && model.slide) {
    const [sx, sy, sw, sh] = model.slide;
    box(sx + rl.slide, sy, sw, sh, model.slideColor || '#3a4658');
  }
  return model.accent;
}

export function drawArms(gf, p, bodyAng, r, gx, gy, gunAng, hand, bodyX, bodyY) {
  const armCol = '#2b7fa8', armDark = '#06121e';
  const ox = bodyX === undefined ? p.x : bodyX;
  const oy = bodyY === undefined ? p.y : bodyY;
  const shoulder = (side) => {
    const [sx, sy] = rot(side * r * 0.62, r * 0.05, bodyAng);
    return [ox + sx, oy + sy];
  };
  // main hand always on the grip
  const [gripX, gripY] = rot(0, 1, gunAng);
  const mainHand = [gx + gripX, gy + gripY];
  // support hand either on the fore-end or wherever the reload puts it
  const supportLocal = hand || { x: 9, y: 1 };
  const [shX, shY] = rot(supportLocal.x, supportLocal.y, gunAng);
  const supportHand = [gx + shX, gy + shY];

  const limb = (from, to) => {
    gf.moveTo(from[0], from[1]).lineTo(to[0], to[1])
      .stroke({ width: 5.4, color: armDark, cap: 'round' });
    gf.moveTo(from[0], from[1]).lineTo(to[0], to[1])
      .stroke({ width: 3.4, color: armCol, cap: 'round' });
  };
  limb(shoulder(1), mainHand);
  limb(shoulder(-1), supportHand);
  // knuckles
  gf.circle(mainHand[0], mainHand[1], 2.4).fill(armCol).stroke({ width: 1, color: armDark });
  gf.circle(supportHand[0], supportHand[1], 2.2).fill(armCol).stroke({ width: 1, color: armDark });
}

export function drawHeroFace(gf, bx, by, r, bodyAng, sqx, sqy, A, p) {
  // How much of the face is toward the camera. Only a steep upward aim
  // hides it entirely — at a horizontal aim he is in profile, which is still
  // fully readable and must not fade.
  const faceVis = Math.max(0, Math.min(1, (A.faceY + 0.85) / 0.75));
  if (faceVis <= 0.02) {
    // Facing away: draw the back instead of nothing. A spine of surface
    // tension down the middle plus the light rim reads unmistakably as
    // "you are looking at his back".
    const [sx0, sy0] = rot(0, -r * 0.55, bodyAng);
    const [sx1, sy1] = rot(0, r * 0.55, bodyAng);
    gf.moveTo(bx + sx0, by + sy0).lineTo(bx + sx1, by + sy1)
      .stroke({ width: 2, color: '#bff0ff', alpha: 0.22 });
    return;
  }

  const E = A.expr;
  const a = bodyAng;
  // Features ride toward the side he is facing, and sit slightly lower as he
  // turns toward the camera — the same foreshortening a real head has.
  //
  // Sizing note, and it is the whole reason this reads at all: the body is
  // only ~14 world px of radius, which is roughly 30 px on screen. The first
  // pass used anatomically sensible proportions (eyes at r*0.155) and they
  // came out barely two pixels across — invisible in play. Everything here
  // is deliberately oversized and pushed into the UPPER third of the drop,
  // both so it is legible at the real rendered size and so the arms, which
  // radiate from the shoulders at r*0.62, cannot cross it.
  const cx = A.faceX * r * 0.24;
  const cy = -r * 0.34 + A.faceY * r * 0.08;
  // Perspective squeeze on the axis he is turning around.
  const persp = 1 - Math.abs(A.faceX) * 0.42;

  const eyeDX = r * 0.33;
  const eyeY = cy;

  // Eyes ride a turning head, not a flat face.
  //
  // The old layout placed them at `cx + side * eyeDX * persp` and shrank
  // whichever eye was on the far side of the turn. Two things were wrong with
  // that, and together they are what Timmy reported as "ögonen glider ut,
  // blir 2" when walking and aiming right:
  //
  //   1. `cx` pushed the whole face outward while `persp` only narrowed the
  //      SPREAD, so the near eye MIGRATED off the body as he turned — from
  //      0.010r outside the silhouette at rest to 0.112r outside at a full
  //      profile, a fifth of the body's half-width hanging in open space.
  //   2. The wrong eye vanished. Turning right, it kept the RIGHT eye at full
  //      width out at the edge and shrank the LEFT one. A head that turns
  //      right does the opposite: the right eye is the one that swings around
  //      the edge and disappears. So instead of a profile you got a big eye
  //      off the rim plus a shrunken one near the middle — two disconnected
  //      blobs rather than one face.
  //
  // `faceX` and `faceY` are the normalised aim vector, so they ARE the sine
  // and cosine of the head's turn: atan2 recovers the angle directly. Each
  // eye sits at a fixed angle either side of "forward" on the head, and its
  // position and foreshortening both fall out of where that angle has
  // rotated to. The correct eye now hides itself, for the right reason.
  // NOT clamped to the front hemisphere. `faceY` goes negative when he aims
  // away from the camera, and the turn angle has to be allowed past 90° for
  // that to mean anything — otherwise "walking up" reads as a hard profile
  // and an eye stays on screen when he is facing away from you. Past 90°
  // both eyes fall behind the head on their own, which is the whole point of
  // modelling it this way instead of special-casing it.
  const headTurn = Math.atan2(A.faceX, A.faceY);
  // Head radius taken from the drop's OWN half-width at eye height, so an eye
  // on its surface is on the body by construction rather than by luck.
  const headR = Math.max(r * 0.35, heroHalfWidthAt(cy / r) * r);
  const eyeAng = Math.asin(Math.min(0.95, eyeDX / headR));
  const cosRest = Math.cos(eyeAng) || 1;

  for (let side = -1; side <= 1; side += 2) {
    const ang = headTurn + side * eyeAng;
    const depth = Math.cos(ang);
    // Rotated past the edge of the head: gone, not squeezed to a sliver.
    if (depth <= 0.06) continue;
    // Normalised so both eyes are full width when he faces the camera.
    const wScale = Math.min(1.15, depth / cosRest);

    const openAmt = Math.max(0.05, E.eyeOpen * (1 - A.blink));
    let eyeRx = r * 0.235 * wScale;
    const eyeRy = r * 0.270 * openAmt;

    // Where the eye projects to, then held inside the silhouette. The clamp
    // measures at the TOP of the eye because that is where the teardrop is
    // narrowest across the eye's own height, and so where an overhang shows
    // first. Same guard the brows already had — the eyes never got it.
    let ex = headR * Math.sin(ang);
    const bodyHalf = heroHalfWidthAt((eyeY - eyeRy) / r) * r;
    if (bodyHalf > eyeRx) {
      const limit = bodyHalf * 0.97 - eyeRx;
      ex = Math.max(-limit, Math.min(limit, ex));
    } else if (bodyHalf > 0) {
      // Degenerate: the drop is narrower than the eye. Shrink to fit rather
      // than drawing a wide eye on a narrow head.
      eyeRx = bodyHalf * 0.9;
      ex = 0;
    }

    const [px0, py0] = rot(ex, eyeY, a);
    const wx = bx + px0, wy = by + py0;

    // Sclera. Kept a cold near-white so it reads against the blue body.
    gf.ellipse(wx, wy, eyeRx, eyeRy).fill({ color: '#f2fbff', alpha: 0.94 * faceVis });

    // Pupil, offset by where he is looking.
    const pupR = Math.min(eyeRx, eyeRy) * 0.58 * E.pupil;
    if (pupR > 0.3 && A.blink < 0.7) {
      const lookOffX = A.lookX * eyeRx * 0.55;
      const lookOffY = A.lookY * eyeRy * 0.55;
      const [ppx, ppy] = rot(ex + lookOffX, eyeY + lookOffY, a);
      gf.circle(bx + ppx, by + ppy, pupR).fill({ color: '#07141f', alpha: faceVis });
      // Catchlight — one tiny dot, and the single cheapest thing that makes
      // eyes look alive rather than printed on.
      const [gpx, gpy] = rot(ex + lookOffX - pupR * 0.34, eyeY + lookOffY - pupR * 0.4, a);
      gf.circle(bx + gpx, by + gpy, Math.max(0.5, pupR * 0.30))
        .fill({ color: '#ffffff', alpha: 0.9 * faceVis });
    }

    // Brow. One thick stroke whose inner end rises or falls — this carries
    // more of the expression than the eye or the mouth does.
    // Brow tilt. `innerY`/`outerY` are SIDE-INDEPENDENT heights — how high
    // the nose-end of a brow sits versus its temple-end — and the mirroring
    // is done once, below, when they are assigned to the two ends. An
    // earlier version also multiplied by `side` here, which applied the
    // mirror twice and left the character with one angry brow and one sad
    // one: a permanent quizzical look no matter what he was feeling.
    //
    // Sign: negative browAng is angry, and angry means the nose-end drops.
    // Screen Y grows downward, so "drops" is +Y — hence the minus.
    // The brow sits 0.40r above the eye, and a raised brow (rage, surprise)
    // pushes it another 0.34r. That put it at y = -1.14r in a hard profile --
    // the very tip of the teardrop, where the body is 0.009r wide -- while
    // the stroke still reached out to 0.70r. The result was a brow hanging
    // in open space beside his head, which is what read as "the eye goes
    // weird when aiming and running right".
    //
    // Two clamps, because either one alone leaves a case broken: cap how
    // high the brow may travel, then pull its ENDS inside whatever the
    // silhouette actually is at that height. Both are proportional, so the
    // brow still animates -- it just cannot leave the body.
    const BROW_CEIL = -r * 0.92;   // highest a brow may sit and still be on the body
    const browRaw = eyeY - r * 0.40 + E.browY * r * 0.34;
    const browBaseY = Math.max(browRaw, BROW_CEIL);
    // The tilt has to be clamped as well as the base height. Clamping only
    // the base still let a hard angry/surprised tilt lift the inner end past
    // the tip of the drop, where the silhouette has no width at all and the
    // horizontal clamp below had nothing to clamp against.
    const innerY = Math.max(browBaseY - E.browAng * r * 0.36, BROW_CEIL);
    const outerY = Math.max(browBaseY + E.browAng * r * 0.14, BROW_CEIL);
    // 0.90 keeps the stroke's round cap off the outline rather than exactly
    // on it. Guard the degenerate case where the clamp height still lands
    // outside the body by falling back to the eye's own half-width.
    const browHalfW = heroHalfWidthAt(Math.min(innerY, outerY) / r) * r;
    const browLimit = (browHalfW > 0 ? browHalfW : eyeRx) * 0.90;
    const bx0 = Math.max(-browLimit, Math.min(browLimit, ex - eyeRx * 1.15));
    const bx1 = Math.max(-browLimit, Math.min(browLimit, ex + eyeRx * 1.15));
    // side +1 is the right eye, whose nose-end is its LEFT (smaller x) end.
    const [b0x, b0y] = rot(bx0, side > 0 ? innerY : outerY, a);
    const [b1x, b1y] = rot(bx1, side > 0 ? outerY : innerY, a);
    gf.moveTo(bx + b0x, by + b0y).lineTo(bx + b1x, by + b1y)
      .stroke({ width: Math.max(1.6, r * 0.12), color: '#08202e', alpha: 0.88 * faceVis, cap: 'round' });
  }

  // Mouth. A quadratic arc sampled to points: `E.mouth` bends it from a deep
  // frown to a grin, `E.mouthOpen` gives it height.
  const mouthY = cy + r * 0.44;
  const mouthW = r * 0.34 * persp;
  const curve = E.mouth * r * 0.26;
  const open = E.mouthOpen * r * 0.30;
  const mpts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, mt = 1 - t;
    const lx = cx - mouthW + t * mouthW * 2;
    const ly = mouthY + (mt * mt * 0 + 2 * mt * t * curve + t * t * 0);
    const [wx2, wy2] = rot(lx, ly, a);
    mpts.push(bx + wx2, by + wy2);
  }
  // Threshold on the NORMALISED parameter, not on the pixel result. `open`
  // is scaled by r, so a pixel threshold meant the same expression drew an
  // open mouth on a big character and a closed one on a small character —
  // the calm face was open-mouthed in the preview harness and closed in the
  // actual game.
  if (E.mouthOpen > 0.12) {
    // Open mouth: mirror the upper curve downward into a closed shape.
    const lower = [];
    for (let i = 8; i >= 0; i--) {
      const t = i / 8, mt = 1 - t;
      const lx = cx - mouthW + t * mouthW * 2;
      const ly = mouthY + (2 * mt * t * curve) + Math.sin(t * Math.PI) * open;
      const [wx2, wy2] = rot(lx, ly, a);
      lower.push(bx + wx2, by + wy2);
    }
    gf.poly([...mpts, ...lower]).fill({ color: '#0a1b26', alpha: 0.85 * faceVis });
  } else {
    gf.poly(mpts, false).stroke({ width: Math.max(1.4, r * 0.105), color: '#08202e', alpha: 0.85 * faceVis, cap: 'round' });
  }

  // Rage vents steam. Cheap, and it is the one expression that should be
  // obvious from across the screen without reading the face at all.
  if (A.exprId === 'rage' && Math.random() < 0.5) {
    for (let s = -1; s <= 1; s += 2) {
      const [vx, vy] = rot(cx + s * r * 0.42, cy + r * 0.05, a);
      gf.circle(bx + vx, by + vy, 1.2 + Math.random() * 1.6)
        .fill({ color: '#ffb066', alpha: 0.35 });
    }
  }
}
