// Touch-gesture judgement for the twin-stick pad.
//
// Pulled out of MobileControls.jsx so it can be TESTED. This is the trickiest
// piece of the whole control spec — telling a deliberate dash flick apart from
// ordinary fast steering — and it is pure maths over a list of samples, with no
// React and no DOM in it. Left inside the component it was unreachable by the
// plain-node test suite, and the only alternative would have been a second copy
// of the thresholds in the test, which is the two-parallel-definitions bug this
// codebase keeps getting bitten by.
//
// See test/gestures.test.mjs.

// ── Swipe-to-dash: what counts as DELIBERATE ─────────────────────────
// Timmy: "kanske inte släpp men man måste swipe tydligt så de inte blir av
// misstag" — the dash fires mid-gesture (waiting for the finger to lift adds
// latency you can feel), but the gesture has to be unmistakably a flick.
//
// Three independent tests, and ordinary steering fails at least one:
//   DISTANCE — a nudge while steering never travels this far in 150ms.
//   SPEED    — deliberate flicks are fast; corrective steering is not.
//   STRAIGHTNESS — the real disambiguator. Steering CURVES (you are tracking a
//     target, so the thumb arcs), a dash flick is a straight line. Measured as
//     net displacement ÷ path length: 1.0 is a perfect line, and a curved drag
//     drops well below the threshold even when it is both long and fast.
export const SWIPE_WIN_MS    = 150;   // rolling window the gesture is judged over
export const SWIPE_MIN_DIST  = 52;    // px of NET displacement inside that window
export const SWIPE_MIN_SPEED = 0.62;  // px per ms
// net ÷ path, 1.0 = dead straight. For a circular sweep of θ radians the ratio
// is 2·sin(θ/2)/θ, which is worth knowing because the number is unreadable
// otherwise — it converts straight to a maximum ALLOWED CURVE:
//     0.84  → 118°   (first attempt; the gesture test caught it firing on a
//                     110° arc, i.e. on ordinary target-tracking steering)
//     0.930 →  75°
//     0.975 →  45°   ← chosen
//     0.996 →  18°
// 45° is generous for a flick (a thumb pushing outward from the stick barely
// curves at all) and well short of the 60°+ sweep you make while tracking a
// moving target. Sampling density hardly affects the measurement: a polyline
// of 4 segments across a 45° arc under-measures its length by 0.1%.
// Noise has margin too — a dead-straight 120px flick with ±4px of jitter still
// scores 0.986.
export const SWIPE_STRAIGHT  = 0.975;
export const SWIPE_REARM     = 0.18;  // px/ms — below this the gesture re-arms
// Analog range the flick is mapped onto for `tryDash(x, y, power)`.
export const SWIPE_FAST_SPEED = 2.1;  // px/ms that counts as a full-strength flick
export const SWIPE_LONG_DIST  = 190;  // px that counts as a full-length flick

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Judge a rolling buffer of {x, y, t} samples as a dash flick.
 *
 * @param {{x:number,y:number,t:number}[]} samples oldest first
 * @returns {{nx:number,ny:number,power:number}|null} null when the gesture is
 *   not (yet) a deliberate swipe, otherwise the unit direction plus a 0..1
 *   `power` built from BOTH how fast and how far it travelled — Timmy: "både
 *   hastighet å längd på swipen ska spela in".
 */
export function judgeSwipe(samples) {
  if (!samples || samples.length < 3) return null;
  const a = samples[0], b = samples[samples.length - 1];
  const dt = b.t - a.t;
  if (dt < 24) return null;              // too short a window to judge honestly
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < SWIPE_MIN_DIST) return null;
  const speed = dist / dt;
  if (speed < SWIPE_MIN_SPEED) return null;
  let path = 0;
  for (let i = 1; i < samples.length; i++) {
    path += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  if (path <= 0 || dist / path < SWIPE_STRAIGHT) return null;
  // Equal weight: a short vicious flick and a long sweeping one both read as
  // committed, and only doing both maxes it out.
  const power = clamp01(
    0.5 * clamp01((speed - SWIPE_MIN_SPEED) / (SWIPE_FAST_SPEED - SWIPE_MIN_SPEED)) +
    0.5 * clamp01((dist - SWIPE_MIN_DIST) / (SWIPE_LONG_DIST - SWIPE_MIN_DIST))
  );
  return { nx: dx / dist, ny: dy / dist, power };
}

/**
 * Has the thumb settled enough to re-arm the swipe gesture? Called only while
 * disarmed, so one continuous drag cannot machine-gun dashes: it has to
 * actually slow down first.
 */
export function hasSettled(samples) {
  if (!samples || samples.length < 2) return false;
  const a = samples[0], b = samples[samples.length - 1];
  const dt = b.t - a.t;
  if (dt <= 40) return false;
  return Math.hypot(b.x - a.x, b.y - a.y) / dt < SWIPE_REARM;
}
