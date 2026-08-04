// =============================================
// EXPLORATION — a short, active walk to where the TCG actually lives
// =============================================
// Patrol stays exactly what it was: send them off, come back later, pure
// idle. This is the opposite on purpose — a ~30 second session you watch,
// your character and active pet visibly walking node to node on a path,
// stopping to loot or fight. The trainer node is where Pet TCG's wagering
// happens; everything else here is what makes reaching that node feel like
// something happened, not a menu click.
//
// Pure logic only — game/petTcg.js already owns cards and the battle
// engine; this file owns the path, the loot table, and the trainers.

import { rollCard } from './petTcg';

export const NODE_SECONDS = 5; // ~5s per node, 6 nodes ≈ 30s total walk

// A fixed shape rather than randomized types per slot — the trainer is
// always the dramatic mid-point of the walk, not a coin flip on whether one
// shows up at all.
const NODE_SHAPE = ['loot', 'loot', 'encounter', 'trainer', 'loot', 'loot'];

export function generatePath() {
  return NODE_SHAPE.map((type, i) => ({ i, type, done: false }));
}

// ---- Loot nodes -------------------------------------------------------
export function rollLootNode(luckBonus = 0) {
  const r = Math.random() - luckBonus * 0.03;
  if (r < 0.45) return { type: 'gold', amount: 50 + Math.floor(Math.random() * 70) };
  if (r < 0.72) return { type: 'card', card: rollCard(luckBonus) };
  if (r < 0.88) return { type: 'petFood', amount: 1 + Math.floor(Math.random() * 2) };
  return { type: 'gearParts', amount: 3 + Math.floor(Math.random() * 5) };
}

// ---- Trainers -----------------------------------------------------------
// Fixed roster, met in order — a returning player faces the same three
// personalities rather than an anonymous name generator, same reason the
// campaign's bosses are authored rather than rolled.
export const TRAINERS = [
  { id: 't_reed',  name: 'Reed',  type: 'shadowWisp', level: 8,  accent: '#b362ff', line: "Lost a bet once. Never lost a battle." },
  { id: 't_sable', name: 'Sable', type: 'emberFairy', level: 12, accent: '#ff7a1a', line: 'You brought that deck? Bold.' },
  { id: 't_orin',  name: 'Orin',  type: 'stormHawk',  level: 16, accent: '#ffe44d', line: "Storm's coming either way. Might as well be your loss." },
];

export function rollTrainer(winsSoFar = 0) {
  return TRAINERS[Math.min(TRAINERS.length - 1, winsSoFar)];
}

// ---- Wagering -------------------------------------------------------------
// Eggs are the safe stake — a spare one costs nothing you have grown
// attached to. Only offered as a fallback when there is no egg: the
// player's own ACTIVE pet, clearly flagged, a real and permanent loss if
// the fight is lost. Never both at once — the egg is always the answer
// when one exists, so the risky option only ever appears when it is the
// only option.
export function stakeOptions(save) {
  const opts = [];
  const goldStake = Math.min(600, Math.floor((save.gold || 0) * 0.2));
  if (goldStake >= 20) opts.push({ kind: 'gold', label: `${goldStake} Gold`, amount: goldStake });
  const gemStake = Math.min(12, Math.floor((save.gems || 0) * 0.3));
  if (gemStake >= 2) opts.push({ kind: 'gems', label: `${gemStake} Gems`, amount: gemStake });
  const eggs = save.petEggs || [];
  if (eggs.length > 0) {
    opts.push({ kind: 'egg', label: `Egg (${eggs[0].rarity})`, eggId: eggs[0].id });
  } else {
    const activePet = (save.pets || []).find(p => p.active);
    if (activePet) {
      opts.push({ kind: 'pet', label: `${activePet.name} — your active pet, real risk`, petId: activePet.id, risky: true });
    }
  }
  return opts;
}

// Three rolled options to negotiate between, or a gamble for a random one
// with slightly better average value as the compensation for not knowing.
export function rollNegotiatedPrizes(luckBonus = 0) {
  const roll = () => {
    const r = Math.random();
    if (r < 0.4) return { type: 'card', card: rollCard(luckBonus) };
    if (r < 0.7) return { type: 'egg', rarity: ['common', 'common', 'uncommon', 'rare'][Math.floor(Math.random() * 4)] };
    return { type: 'gold', amount: 250 + Math.floor(Math.random() * 350) };
  };
  return [roll(), roll(), roll()];
}

export function rollGamblePrize(luckBonus = 0) {
  const r = Math.random();
  if (r < 0.30) return { type: 'card', card: rollCard(luckBonus), card2: rollCard(luckBonus) };
  if (r < 0.55) return { type: 'egg', rarity: ['uncommon', 'rare', 'rare', 'epic'][Math.floor(Math.random() * 4)] };
  if (r < 0.85) return { type: 'gold', amount: 150 + Math.floor(Math.random() * 200) };
  return { type: 'card', card: rollCard(luckBonus) }; // the "gamble didn't pay off" floor is still a card, never nothing
}
