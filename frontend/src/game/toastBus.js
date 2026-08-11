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

import { Audio } from './audio';

let _listeners = [];
let _seq = 0;
let _lastSoundAt = 0;

export function pushToast(toast) {
  const t = { id: ++_seq, tone: 'default', ...toast };
  // The sound lives HERE, not at the 25 call sites. Putting it at the choke
  // point is what guarantees every reward moment in the game — camp, clicker,
  // patrol, mid-run loot, anything added later — gets the same notification
  // chime without anyone having to remember to add it. It also means menus
  // and in-game sound identical by construction rather than by discipline.
  //
  // Rate-limited because several toasts can land in one frame (claiming five
  // milestones at once, a batch payout). Five copies of the same chime
  // stacking is noise, not reward — the first one carries the message.
  const now = Date.now();
  if (now - _lastSoundAt > 140) {
    _lastSoundAt = now;
    try { Audio.toast(t.tone); } catch (e) { /* audio must never block a toast */ }
  }
  _listeners.forEach(fn => fn(t));
  return t.id;
}

export function subscribeToast(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}
