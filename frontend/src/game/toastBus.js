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
//
// Timmy 2026-09-17: the SAME toast was firing in a run and then again in
// the menu. Identical title+text within a couple of seconds is a duplicate;
// a milestone (`once: true`, stable `key`) is once per save — until the
// NEXT tier of that family, which uses a different key and different copy.

import { Audio } from './audio';

let _listeners = [];
let _seq = 0;
let _lastSoundAt = 0;
const _recentToasts = new Map(); // key -> timestamp
const _onceSeen = new Set();     // session + hydrated-from-save

const REPEAT_MS = 4000;

export function toastKey(raw) {
  if (!raw || typeof raw === 'string') return String(raw || '');
  return raw.key || raw.id || `${raw.title || ''}::${raw.text || ''}`;
}

export function hydrateToastSeen(map) {
  if (!map || typeof map !== 'object') return;
  for (const k of Object.keys(map)) {
    if (k && k !== '__migrated') _onceSeen.add(k);
  }
}

export function resetToastBusForTests() {
  _onceSeen.clear();
  _recentToasts.clear();
  _seq = 0;
  _lastSoundAt = 0;
}

export function pushToast(toast) {
  if (!toast) return null;
  const raw = typeof toast === 'string' ? { title: toast } : toast;
  const key = toastKey(raw);
  const now = Date.now();
  const once = raw.once === true || raw.once === 'save';

  if (once && key && _onceSeen.has(key)) return null;
  if (key && _recentToasts.has(key)) {
    const lastTime = _recentToasts.get(key);
    if (now - lastTime < REPEAT_MS) return null;
  }
  if (once && key) _onceSeen.add(key);
  if (key) {
    _recentToasts.set(key, now);
    if (_recentToasts.size > 100) {
      for (const [k, t] of _recentToasts.entries()) {
        if (now - t > 20000) _recentToasts.delete(k);
      }
    }
  }

  const t = { id: ++_seq, tone: 'default', ...raw, key };
  // The sound lives HERE, not at the 25 call sites. Putting it at the choke
  // point is what guarantees every reward moment in the game — camp, clicker,
  // patrol, mid-run loot, anything added later — gets the same notification
  // chime without anyone having to remember to add it.
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
