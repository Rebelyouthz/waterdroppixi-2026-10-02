// Water-drop pointer maths. Lives here so the suite can prove the lag
// and the scroll-hide without a DOM. WaterCursor.jsx is only the wiring.

// Frame-rate independent catch-up. The old 0.34/frame lerp at 60 Hz took
// ~50ms to cover 70% of a move and read as a heavy OS pointer. 88/s is
// about 12ms to the same cover — lean still has velocity to work with.
export const FOLLOW_RATE = 88;
export const CATCHUP_PX = 64;

export function followStep(x, tx, dt, rate = FOLLOW_RATE) {
  const dist = Math.abs(tx - x);
  const r = dist > CATCHUP_PX ? rate * 2.4 : rate;
  const k = 1 - Math.exp(-r * Math.max(0.001, dt));
  return x + (tx - x) * k;
}

// Chrome fires window `pointerleave` while scrolling an overflow pane.
// Only a leave whose relatedTarget is null is an actual exit.
export function shouldHideOnLeave(relatedTarget) {
  return relatedTarget == null;
}

export function isTextTarget(el) {
  if (!el || !el.closest) return false;
  return !!el.closest('input, textarea, [contenteditable="true"], select');
}
