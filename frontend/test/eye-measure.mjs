// The eyes, swept through a full 360 degrees of aim.
//
// Two bugs Timmy reported by playing: the eyes drifted off the body when
// walking and aiming right ("glider ut, blir 2"), worse right than left, and
// an eye stayed visible while walking away from the camera.
//
// This runs the OLD and NEW layouts side by side over every aim direction and
// reports, for each: how far outside the silhouette an eye reaches, and how
// many eyes are drawn. A face turned away must draw zero.
import { heroHalfWidthAt } from '../src/game/heroShape.js';

const R = 1; // body radii

function oldLayout(faceX, faceY) {
  const cx = faceX * 0.24;
  const cy = -0.34 + faceY * 0.08;
  const persp = 1 - Math.abs(faceX) * 0.42;
  const nearIsRight = faceX >= 0;
  const eyes = [];
  for (const side of [-1, 1]) {
    const isFar = nearIsRight ? side < 0 : side > 0;
    const wScale = isFar ? Math.max(0, persp * 1.15 - 0.15) : 1;
    if (wScale <= 0.04) continue;
    eyes.push({ ex: cx + side * 0.33 * persp, rx: 0.235 * wScale, ry: 0.27, cy });
  }
  return eyes;
}

function newLayout(faceX, faceY) {
  const cy = -0.34 + faceY * 0.08;
  const headTurn = Math.atan2(faceX, faceY);
  const headR = Math.max(0.35, heroHalfWidthAt(cy / R) * R);
  const eyeAng = Math.asin(Math.min(0.95, 0.33 / headR));
  const cosRest = Math.cos(eyeAng) || 1;
  const eyes = [];
  for (const side of [-1, 1]) {
    const ang = headTurn + side * eyeAng;
    const depth = Math.cos(ang);
    if (depth <= 0.06) continue;
    const wScale = Math.min(1.15, depth / cosRest);
    let rx = 0.235 * wScale;
    const ry = 0.27;
    let ex = headR * Math.sin(ang);
    const bodyHalf = heroHalfWidthAt((cy - ry) / R) * R;
    if (bodyHalf > rx) {
      const limit = bodyHalf * 0.97 - rx;
      ex = Math.max(-limit, Math.min(limit, ex));
    } else if (bodyHalf > 0) { rx = bodyHalf * 0.9; ex = 0; }
    eyes.push({ ex, rx, ry, cy });
  }
  return eyes;
}

// `faceVis` gates the whole face; below this the back of the head is drawn.
const faceVisible = (faceY) => (faceY + 0.85) / 0.75 > 0.02;

const overhang = (eyes) => Math.max(0, ...eyes.map((e) => {
  const half = heroHalfWidthAt((e.cy - e.ry) / R) * R;
  return Math.abs(e.ex) + e.rx - half;
}), 0);

let worstOld = 0, worstNew = 0;
let badBackOld = 0, badBackNew = 0;
const rows = [];
for (let deg = 0; deg < 360; deg += 15) {
  const t = (deg * Math.PI) / 180;
  // Aim vector: +x right, +y toward the camera (down the screen).
  const faceX = Math.sin(t), faceY = Math.cos(t);
  const vis = faceVisible(faceY);
  const o = vis ? oldLayout(faceX, faceY) : [];
  const n = vis ? newLayout(faceX, faceY) : [];
  const oo = overhang(o), no = overhang(n);
  worstOld = Math.max(worstOld, oo); worstNew = Math.max(worstNew, no);
  // "Walking up must show no eyes." The threshold is -0.5, not 0: at faceY
  // -0.26 the head is only 15 degrees past a clean profile, and a real head
  // still shows one eye there. Demanding zero that early would be demanding a
  // worse drawing. Past -0.5 he is turned 120 degrees away and both must go.
  if (faceY < -0.5) { badBackOld += o.length; badBackNew += n.length; }
  rows.push({ deg, faceX, faceY, vis, o: o.length, n: n.length, oo, no });
}

const dir = (d) => (d === 0 ? 'toward camera' : d === 90 ? 'RIGHT' : d === 180 ? 'away (up)' : d === 270 ? 'LEFT' : '');
console.log('aim   faceX   faceY  | OLD eyes  outside | NEW eyes  outside |');
console.log('------|--------------|-------------------|-------------------|');
for (const r of rows) {
  console.log(
    `${String(r.deg).padStart(4)}  ${r.faceX.toFixed(2).padStart(5)} ${r.faceY.toFixed(2).padStart(6)}  |` +
    `    ${r.o}     ${(r.oo > 0.001 ? r.oo.toFixed(3) : '  -  ').padStart(6)} |` +
    `    ${r.n}     ${(r.no > 0.001 ? r.no.toFixed(3) : '  -  ').padStart(6)} | ${dir(r.deg)}`);
}

console.log('\nworst overhang past the silhouette:');
console.log(`  old ${worstOld.toFixed(3)}r      new ${worstNew.toFixed(3)}r`);
console.log('eyes still drawn while facing away from the camera:');
console.log(`  old ${badBackOld}            new ${badBackNew}`);

let fail = 0;
if (worstNew > 0.005) { console.log(`FAIL: an eye still reaches ${worstNew.toFixed(3)}r outside the body`); fail = 1; }
if (badBackNew > 0) { console.log(`FAIL: ${badBackNew} eyes drawn while facing away`); fail = 1; }
if (!fail) console.log('\nOK: no eye leaves the body at any aim, and none is drawn facing away.');
process.exit(fail);
