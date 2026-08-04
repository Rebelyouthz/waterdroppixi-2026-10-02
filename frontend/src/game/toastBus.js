// =============================================
// TOAST BUS — one notification queue, reachable from anywhere
// =============================================
// Every claim/reward/loot moment used to invent its own local feedback —
// a `claimMsg` string state in Patrol, another one in Prospector, another
// in the Clicker, achievements with none at all. A simple module-level
// pub-sub instead of prop-drilling a callback through every screen: call
// pushToast() from wherever a reward actually happens (deep inside a
// modal, inside the engine's onTick handler, wherever), and the single
// <ToastHost/> mounted once in App.js picks it up. Same pattern Audio
// already uses as a singleton — this is the same shape for visuals.

let _listeners = [];
let _seq = 0;

export function pushToast(toast) {
  const t = { id: ++_seq, tone: 'default', ...toast };
  _listeners.forEach(fn => fn(t));
  return t.id;
}

export function subscribeToast(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}
