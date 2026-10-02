// THE DRAIN — story, payout, stub-run rules.
//
// Timmy's name for the Dead Cells-like descent under the hangar. Do not call
// this THE WELL (that is the clicker) or THE SHAFT (one-session working
// title). The real loop is not in this file. DrainScreen.jsx runs a
// three-floor stub so the hatch is not a dead door. When the descent ships,
// keep applyDrainPayout / DRAIN_STORY and replace the stub.
//
// Unique to the survivor run: mutations (game/mutations.js). Gold / SP / TP
// also drip so a clear is not charity. Do not add a second unique currency.
// This file must not import store.js — store already owns the save shape,
// and a cycle here is how payouts silently stop landing.

import { unlockMutation } from './mutations';

export const DRAIN_STORY = {
  title: 'THE DRAIN',
  aidaLie: 'Coolant drain. Ignore the singing.',
  truth: 'Under the hangar deck is a marrow well. The Greys used it as overflow. One layer down it is the same shape as Stonehenge — an Anunnaki receiver. A.I.D.A. wants the crystal at the bottom for a transmitter she has not named.',
  whyHeGoes: 'It smells like the lake.',
};

export const DRAIN_FLOORS = 3;
export const DRAIN_BLOBS_PER_FLOOR = 6;

/** Gold / SP / TP for a stub clear. Mutations are the unique. */
export function drainClearReward(depth) {
  const d = Math.max(1, depth | 0);
  return {
    gold: 40 + d * 25,
    sp: 1,
    talentPoints: 1,
  };
}

export function applyDrainPayout(save, { depth = DRAIN_FLOORS } = {}) {
  if (!save) return save;
  const r = drainClearReward(depth);
  const ns = {
    ...save,
    gold: (save.gold || 0) + r.gold,
    sp: (save.sp || 0) + r.sp,
    talentPoints: (save.talentPoints || 0) + r.talentPoints,
    drainRuns: (save.drainRuns || 0) + 1,
    drainBestDepth: Math.max(save.drainBestDepth || 0, depth),
  };
  const have = ns.mutationsUnlocked || [];
  if (!have.includes('mut_marrow')) return unlockMutation(ns, 'mut_marrow');
  return unlockMutation(ns, 'mut_film');
}
