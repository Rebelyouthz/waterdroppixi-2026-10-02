// =============================================
// PATROL ENCOUNTERS — a compact card battle
// =============================================
// A patrol can run into something. Rather than rolling a hidden number, the
// fight is played out on one small board: three rounds, both sides commit a
// card per round, higher total takes the round, best of three takes the loot.
//
// Deliberately closer to Gwent than to a full TCG. A deep card game inside a
// bullet-hell is a second game that competes with the first one for attention
// and balance; what this needs to be is a thirty-second decision with real
// stakes, played with cards you earned elsewhere.

export const CARD_TYPES = {
  strike:  { id: 'strike',  name: 'Strike',  icon: 'blade',  desc: 'Straightforward force.' },
  guard:   { id: 'guard',   name: 'Guard',   icon: 'shield', desc: 'Halves the enemy card this round.' },
  surge:   { id: 'surge',   name: 'Surge',   icon: 'bolt',   desc: 'Doubles if you lost the previous round.' },
  drain:   { id: 'drain',   name: 'Drain',   icon: 'orb',    desc: 'Steals 3 power from the enemy card.' },
  rally:   { id: 'rally',   name: 'Rally',   icon: 'heart',  desc: 'Adds your pet level to its power.' },
};

// The player's hand is built from the active pet plus the patrol's tier, so a
// stronger pet is a stronger hand rather than a separate stat somewhere.
export function buildHand(pet, tier) {
  const lvl = pet ? pet.level : 0;
  const base = 4 + tier * 2 + Math.floor(lvl / 6);
  const ids = ['strike', 'guard', 'surge', 'drain', 'rally'];
  const hand = [];
  for (let i = 0; i < 5; i++) {
    const t = ids[i];
    hand.push({
      uid: `c${i}`,
      type: t,
      power: Math.max(1, base + ((i * 7 + lvl) % 5) - 2),
    });
  }
  return hand;
}

export function buildFoe(tier, rounds = 3) {
  const out = [];
  for (let i = 0; i < rounds; i++) {
    out.push({ power: Math.max(1, 4 + tier * 2 + ((i * 5 + tier * 3) % 5) - 2) });
  }
  return out;
}

/**
 * Resolve one round.
 * @param card      the player's chosen card
 * @param foePower  the enemy's power this round
 * @param ctx       { lostLast, petLevel }
 */
export function resolveRound(card, foePower, ctx) {
  let mine = card.power;
  let theirs = foePower;
  switch (card.type) {
    case 'guard': theirs = Math.ceil(theirs / 2); break;
    case 'surge': if (ctx.lostLast) mine *= 2; break;
    case 'drain': theirs = Math.max(0, theirs - 3); mine += 3; break;
    case 'rally': mine += Math.floor((ctx.petLevel || 0) / 4); break;
    default: break;
  }
  return { mine, theirs, won: mine >= theirs };
}

// Loot share by rounds won. Losing still pays something — a patrol you sent
// out hours ago returning with literally nothing because of three card flips
// would make the whole encounter feel like a punishment for engaging with it.
export function lootShare(roundsWon) {
  if (roundsWon >= 3) return 1.5;
  if (roundsWon === 2) return 1.0;
  if (roundsWon === 1) return 0.6;
  return 0.35;
}
