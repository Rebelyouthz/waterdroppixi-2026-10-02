// =============================================
// FORGE — shared 3-of-a-kind rarity merge
// =============================================
// One routine behind gear, artifacts and runes so the odds, the failure cost
// and the catalyst rules can never drift apart between them.
//
// Design (see docs/ROADMAP-modes.md):
//  - Three identical items, not two. Two is too easy and floods the top
//    rarities within a couple of sessions.
//  - The merge can FAIL. A guaranteed upgrade turns duplicates into a queue
//    you process rather than a decision you make.
//  - Failure consumes 2 of the 3 and leaves you 1. Never all three: a total
//    wipe on a 30% roll is how you get people to stop using a system.
//  - Flux catalysts (from Astro Prospector) add +15% each, up to 3, which is
//    what makes that mode's rare drop worth chasing.

// Keyed by the TARGET tier index rather than by name, because the ladders
// disagree on the second tier's label — gear calls it 'magic', artifacts and
// runes call it 'uncommon'.
// Index = the rarity being merged INTO. The last entry is Mythic+, the ceiling
// of the ladder and the only rarity that cannot drop -- it is reachable solely
// by forging three maxed mythicals, so it gets the steepest odds in the game.
// Without an explicit entry it fell through to the `?? 0.18` default and the
// final step was no harder than the one before it.
export const MERGE_ODDS = [0, 0.75, 0.60, 0.45, 0.30, 0.18, 0.09];

export const FLUX_PER_MERGE_MAX = 3;
export const FLUX_BONUS = 0.15;

// Success chance for a merge into `targetIdx`, given `flux` catalysts spent
// and a flat `bonus` from elsewhere (the Forge building).
//
// `bonus` is a separate argument rather than being folded into `flux` on the
// caller's side, because flux is capped at FLUX_PER_MERGE_MAX — passing the
// building's contribution as extra flux-equivalents would have been silently
// clamped away.
//
// Capped just below certainty either way: a 100% merge is the guaranteed
// upgrade this whole system exists to avoid.
export function mergeChance(targetIdx, flux = 0, bonus = 0) {
  const base = MERGE_ODDS[targetIdx] ?? 0.18;
  const used = Math.max(0, Math.min(FLUX_PER_MERGE_MAX, Math.floor(flux)));
  return Math.min(0.95, base + used * FLUX_BONUS + Math.max(0, bonus));
}

/**
 * Resolve a merge.
 *
 * @param {string[]} ladder    rarity ladder for this item family
 * @param {string}   rarity    current rarity of the three items
 * @param {number}   flux      catalysts spent (0..3)
 * @returns {{ ok, atMax, chance, targetRarity, consumed, roll }}
 *   consumed = how many of the three are destroyed (3 on success, since the
 *   upgraded item replaces them; 2 on failure, leaving one behind).
 */
export function resolveMerge(ladder, rarity, flux = 0, bonus = 0) {
  const idx = ladder.indexOf(rarity);
  const targetIdx = idx + 1;
  if (idx < 0 || targetIdx >= ladder.length) {
    return { ok: false, atMax: true, chance: 0, targetRarity: rarity, consumed: 0, roll: 1 };
  }
  const chance = mergeChance(targetIdx, flux, bonus);
  const roll = Math.random();
  const ok = roll < chance;
  return {
    ok,
    atMax: false,
    chance,
    targetRarity: ladder[targetIdx],
    consumed: ok ? 3 : 2,
    roll,
  };
}
