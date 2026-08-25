// =============================================
// PET TCG — a real deck-built card battler, fought with your pets
// =============================================
// Deliberately a different shape from game/cardbattle.js (the Patrol
// encounter minigame). That one is a thirty-second coin-flip with generic
// cards and no identity on either side. This is the real thing: a deck you
// build from cards you collect, fought turn by turn with HP and energy,
// where WHICH pet you bring is a real match-up decision because pet types
// have a real advantage wheel over each other — same shape as the 5 pet
// types already in PetPanel.jsx (Attack/Defend/Crit/Super/Heal), not a
// second parallel type system invented for this.
//
// This file is the engine only: card templates, drops, deck rules, and the
// turn resolver. No rendering, no save-writing — callers own both.
//
// Deliberately does NOT import PET_TYPES/petStageMult from PetPanel.jsx —
// game/*.js modules never depend on components/*.jsx (see engine.js vs
// pixiRenderer.js), and PetPanel will need to import FROM this file for the
// deck-builder UI, so importing the other way would risk a circular import.
// Anything pet-specific (level, growth-stage multiplier) is passed in by
// the caller as plain numbers instead.

// ---- The type wheel ---------------------------------------------------
// Each pet type beats the next one round and loses to the one before it —
// a 5-point cycle, same idea as rock-paper-scissors with two extra hands.
// Keyed on the actual PET_TYPES ids so a card's element IS the pet type
// that taught it the move, not a made-up TCG-only taxonomy.
export const TYPE_BEATS = {
  aquaSprite: 'emberFairy',
  emberFairy: 'lifeSprite',
  lifeSprite: 'shadowWisp',
  shadowWisp: 'stormHawk',
  stormHawk:  'aquaSprite',
};

export function typeMult(attackerType, defenderType) {
  if (TYPE_BEATS[attackerType] === defenderType) return 1.3;
  if (TYPE_BEATS[defenderType] === attackerType) return 0.75;
  return 1.0;
}

// ---- Card templates ------------------------------------------------------
// Four per pet type, chosen so each type plays like a different archetype
// rather than five reskins of the same four numbers:
//   aquaSprite (Attack)  — pure aggression, strike/strike/drain/overload
//   shadowWisp (Defend)  — stall and control, guard/guard/heal/rally
//   emberFairy (Crit)    — burst, strike/strike/drain/overload
//   stormHawk  (Super)   — high-risk tempo, strike/overload/rally/guard
//   lifeSprite (Heal)    — sustain, heal/heal/rally/guard
export const CARD_TEMPLATES = [
  // aquaSprite — Attack
  { id: 't_torrentSlash', type: 'aquaSprite', kind: 'strike', name: 'Torrent Slash', icon: 'blade', cost: 1, power: 8 },
  { id: 't_piercingJet',  type: 'aquaSprite', kind: 'strike', name: 'Piercing Jet',  icon: 'beam',  cost: 2, power: 14 },
  { id: 't_riptideLash',  type: 'aquaSprite', kind: 'drain',  name: 'Riptide Lash',  icon: 'whip',  cost: 2, power: 11 },
  { id: 't_deluge',       type: 'aquaSprite', kind: 'overload', name: 'Deluge',      icon: 'bow',   cost: 4, power: 26 },
  { id: 't_tsunamiBurst', type: 'aquaSprite', kind: 'overload', name: 'Tsunami Burst',icon: 'pWave',cost: 5, power: 36 },
  { id: 't_vortexShield', type: 'aquaSprite', kind: 'guard',   name: 'Vortex Shield',icon: 'tornado',cost: 2, power: 17 },

  // shadowWisp — Defend
  { id: 't_umbralWard',   type: 'shadowWisp', kind: 'guard', name: 'Umbral Ward',   icon: 'shield', cost: 1, power: 9 },
  { id: 't_fadingStep',   type: 'shadowWisp', kind: 'guard', name: 'Fading Step',   icon: 'boot',   cost: 2, power: 16 },
  { id: 't_nightCloak',   type: 'shadowWisp', kind: 'heal',  name: 'Night Cloak',   icon: 'orb',    cost: 2, power: 12 },
  { id: 't_hex',          type: 'shadowWisp', kind: 'rally', name: 'Hex',           icon: 'rune',   cost: 1, power: 0.30 },
  { id: 't_voidSingularity',type: 'shadowWisp',kind: 'overload',name: 'Void Singularity',icon: 'ui_void',cost: 5, power: 34 },
  { id: 't_bloodPact',    type: 'shadowWisp', kind: 'drain', name: 'Blood Pact',    icon: 'pVamp',  cost: 3, power: 22 },

  // emberFairy — Crit
  { id: 't_sparkBite',    type: 'emberFairy', kind: 'strike', name: 'Spark Bite',   icon: 'flame',  cost: 1, power: 9 },
  { id: 't_cinderSlash',  type: 'emberFairy', kind: 'strike', name: 'Cinder Slash', icon: 'blade',  cost: 2, power: 15 },
  { id: 't_emberDrain',   type: 'emberFairy', kind: 'drain',  name: 'Ember Drain',  icon: 'flame',  cost: 2, power: 12 },
  { id: 't_inferno',      type: 'emberFairy', kind: 'overload', name: 'Inferno',    icon: 'meteor', cost: 4, power: 28 },
  { id: 't_solarFlare',   type: 'emberFairy', kind: 'strike', name: 'Solar Flare',  icon: 'pExplode',cost: 3, power: 22 },
  { id: 't_pyroclasm',    type: 'emberFairy', kind: 'overload',name: 'Pyroclasm',   icon: 'meteor', cost: 5, power: 38 },

  // stormHawk — Super
  { id: 't_staticPeck',   type: 'stormHawk', kind: 'strike', name: 'Static Peck',  icon: 'bolt',   cost: 1, power: 8 },
  { id: 't_cataclysm',    type: 'stormHawk', kind: 'overload', name: 'Cataclysm',  icon: 'meteor', cost: 4, power: 30 },
  { id: 't_windup',       type: 'stormHawk', kind: 'rally',   name: 'Wind-Up',     icon: 'drone',  cost: 1, power: 0.40 },
  { id: 't_stormWall',    type: 'stormHawk', kind: 'guard',   name: 'Storm Wall',  icon: 'shield', cost: 2, power: 13 },
  { id: 't_thunderStrike',type: 'stormHawk', kind: 'strike',  name: 'Thunder Strike',icon: 'bolt',  cost: 3, power: 21 },
  { id: 't_chainLightning',type:'stormHawk', kind: 'drain',   name: 'Chain Spark',  icon: 'bolt',   cost: 3, power: 18 },

  // lifeSprite — Heal
  { id: 't_mend',         type: 'lifeSprite', kind: 'heal', name: 'Mend',          icon: 'heart',  cost: 1, power: 11 },
  { id: 't_verdantBloom', type: 'lifeSprite', kind: 'heal', name: 'Verdant Bloom', icon: 'star',   cost: 2, power: 19 },
  { id: 't_regrowth',     type: 'lifeSprite', kind: 'rally', name: 'Regrowth',     icon: 'orb',    cost: 1, power: 0.30 },
  { id: 't_thornGuard',   type: 'lifeSprite', kind: 'guard', name: 'Thorn Guard',  icon: 'shield', cost: 2, power: 14 },
  { id: 't_sanctuary',    type: 'lifeSprite', kind: 'guard', name: 'Sanctuary',     icon: 'pHoly',  cost: 3, power: 24 },
  { id: 't_astralBlessing',type:'lifeSprite', kind: 'heal',  name: 'Astral Blessing',icon: 'ui_star',cost: 4, power: 32 },
];
export const CARD_TEMPLATE_INDEX = CARD_TEMPLATES.reduce((m, t) => { m[t.id] = t; return m; }, {});

export const CARD_RARITIES = ['common', 'magic', 'rare', 'epic', 'legendary', 'mythical'];
export const CARD_RARITY_COLORS = {
  common: '#9a8fa6', magic: '#4dc4ff', rare: '#ffd166',
  epic: '#b362ff', legendary: '#ff7a1a', mythical: '#ff3146',
};
// Tempered compared to gear/runes (up to ~9.8x there) — these numbers land
// directly as battle damage, and a mythical card that hit ten times harder
// than a common one would make the deck you built matter less than the one
// lucky pull you got.
const CARD_RARITY_MULT = { common: 1.0, magic: 1.25, rare: 1.55, epic: 1.9, legendary: 2.3, mythical: 2.8 };

export function generateCard(templateId, rarity) {
  const t = CARD_TEMPLATE_INDEX[templateId];
  const mult = CARD_RARITY_MULT[rarity];
  return {
    id: `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    templateId, rarity,
    power: Math.round(t.power * mult * 100) / 100,
  };
}

// Same odds shape as rollRune (see game/runes.js) — kept identical on
// purpose so every collectible in the game has the same feel for "what does
// luck actually do here".
export function rollCard(luckBonus = 0) {
  const t = CARD_TEMPLATES[Math.floor(Math.random() * CARD_TEMPLATES.length)];
  const r = Math.random() - luckBonus * 0.02;
  let rarity;
  if (r < 0.008) rarity = 'mythical';
  else if (r < 0.035) rarity = 'legendary';
  else if (r < 0.11) rarity = 'epic';
  else if (r < 0.28) rarity = 'rare';
  else if (r < 0.55) rarity = 'magic';
  else rarity = 'common';
  return generateCard(t.id, rarity);
}

// Resolves an owned card instance against its template for display/battle —
// every read site needs both halves (the roll and the flavor), so it lives
// in one place instead of being reassembled per caller.
export function resolveCard(instance) {
  const t = CARD_TEMPLATE_INDEX[instance.templateId];
  return { ...t, ...instance };
}

// ---- Decks -----------------------------------------------------------
// A deck is 8 owned card ids belonging to one pet. Cards are NOT
// type-locked to their pet's own type — running a couple of Heal cards on
// an Attack pet is a real, sometimes-correct choice, same way attachments
// let you trade into a weapon's weaknesses (see game/attachments.js).
export const DECK_SIZE = 8;
export const DECK_MIN = 5;

export function deckIsValid(deckIds) {
  return deckIds.length >= DECK_MIN && deckIds.length <= DECK_SIZE;
}

// ---- Battle ------------------------------------------------------------
const MAX_ENERGY = 6;
const START_ENERGY = 2;
const HAND_SIZE = 3;
const OVERLOAD_RECOIL = 0.15; // fraction of an overload's own power, self-inflicted

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// `stageMult` is the pet's growth-stage multiplier (petStageMult in
// PetPanel.jsx) passed in as a plain number by the caller, not imported —
// see the file header for why.
export function computeBattleHp(level, stageMult = 1) {
  return Math.round((50 + level * 1.2) * stageMult);
}

function makeSide(deckIds, cardInventory, type, level, stageMult) {
  const cards = deckIds.map(id => cardInventory.find(c => c.id === id)).filter(Boolean).map(resolveCard);
  const maxHp = computeBattleHp(level, stageMult);
  return {
    type, maxHp, hp: maxHp,
    energy: START_ENERGY, maxEnergy: START_ENERGY,
    draw: shuffle(cards), hand: [], discard: [],
    shield: 0, buffMult: 0,
  };
}

function drawUpTo(side, n) {
  while (side.hand.length < n) {
    if (side.draw.length === 0) {
      if (side.discard.length === 0) return; // out of cards entirely
      side.draw = shuffle(side.discard);
      side.discard = [];
    }
    side.hand.push(side.draw.pop());
  }
}

// `foe` is a synthetic AI opponent for now — a curated NPC-trainer roster
// with authored decks is the next layer on top of this engine, not a
// rewrite of it (see the Exploration mode plan).
export function initBattle({
  deckIds, cardInventory, petType, petLevel, petStageMult = 1,
  foeDeckIds, foeCardInventory, foeType, foeLevel, foeStageMult = 1,
}) {
  const you = makeSide(deckIds, cardInventory, petType, petLevel, petStageMult);
  const foe = makeSide(foeDeckIds, foeCardInventory, foeType, foeLevel, foeStageMult);
  drawUpTo(you, HAND_SIZE);
  drawUpTo(foe, HAND_SIZE);
  return { turn: 0, you, foe, log: [], over: false, winner: null };
}

// Heuristic, not minimax — this is a mobile idle-adjacent game, not a
// ranked ladder. It plays sensibly: heal when hurt, guard when about to
// take a big hit, strike into type advantage, finish a kill when it sees
// one.
export function pickAiCard(side, foeSide) {
  const affordable = side.hand.filter(c => c.cost <= side.energy);
  if (affordable.length === 0) return null;
  let best = null, bestScore = -Infinity;
  for (const c of affordable) {
    const mult = typeMult(c.type, foeSide.type);
    let score;
    if (c.kind === 'heal') score = c.power * (1 - side.hp / side.maxHp) * 1.5;
    else if (c.kind === 'guard') score = c.power * (1 - side.hp / side.maxHp) * 1.2 + c.power * 0.15;
    else if (c.kind === 'rally') score = c.power * 6;
    else {
      const dmg = c.power * mult;
      score = dmg + (dmg >= foeSide.hp + foeSide.shield ? 1000 : 0);
      if (c.kind === 'drain') score += c.power * 0.4;
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// Rally's buff is consumed once, here, regardless of what kind of card it
// lands on — a damage card needs the buffed number for phase B below, so
// this runs before either phase rather than being folded into one of them.
function buffedPower(side, card) {
  if (!card) return 0;
  let power = card.power;
  if (side.buffMult > 0) { power *= 1 + side.buffMult; side.buffMult = 0; }
  return power;
}

// Shields, heals and rally-setup — the effects that don't depend on what
// the OTHER side is about to do. Runs for both sides before any damage, so
// a Guard played this turn protects against the hit thrown at you this
// SAME turn, which is the entire reason to play it reactively rather than
// a turn ahead of time.
function applyNonDamage(side, card, power, log, who) {
  if (!card) return;
  switch (card.kind) {
    case 'guard':
      side.shield += power;
      log.push({ who, text: `${card.name} — +${Math.round(power)} shield` });
      break;
    case 'heal': {
      const healed = Math.min(power, side.maxHp - side.hp);
      side.hp += healed;
      log.push({ who, text: `${card.name} — heals ${Math.round(healed)}` });
      break;
    }
    case 'rally':
      side.buffMult = power;
      log.push({ who, text: `${card.name} — next card +${Math.round(power * 100)}%` });
      break;
    default: break; // damage kinds resolve in applyDamage, once both shields exist
  }
}

// Damage — runs after BOTH sides' applyNonDamage, so it always sees this
// turn's shields, not last turn's.
function applyDamage(side, foeSide, card, power, log, who) {
  if (!card || !['strike', 'drain', 'overload'].includes(card.kind)) return;
  const mult = typeMult(card.type, foeSide.type);
  const raw = power * mult;
  const absorbed = Math.min(foeSide.shield, raw);
  foeSide.shield -= absorbed;
  const dealt = raw - absorbed;
  foeSide.hp = Math.max(0, foeSide.hp - dealt);
  let text = `${card.name} — ${Math.round(dealt)} dmg`;
  if (mult > 1) text += ' (SUPER EFFECTIVE)';
  else if (mult < 1) text += ' (resisted)';
  if (card.kind === 'drain') {
    const healed = Math.min(power * 0.5, side.maxHp - side.hp);
    side.hp += healed;
    text += `, heals ${Math.round(healed)}`;
  } else if (card.kind === 'overload') {
    const recoil = Math.round(power * OVERLOAD_RECOIL);
    side.hp = Math.max(1, side.hp - recoil);
    text += `, ${recoil} recoil`;
  }
  log.push({ who, text });
}

// One full turn: both cards are chosen without seeing the other (the AI
// picks from pickAiCard before either resolves) and then resolve in two
// passes — non-damage effects for both sides, then damage for both sides —
// so a reactive Guard genuinely lands before the hit it was meant to stop.
export function resolveTurn(state, yourCard) {
  if (state.over) return state;
  const s = { ...state, you: { ...state.you }, foe: { ...state.foe }, log: [] };
  s.turn += 1;

  const foeCard = pickAiCard(s.foe, s.you);

  const commit = (side, card) => {
    if (!card) return;
    side.hand = side.hand.filter(c => c.id !== card.id);
    side.discard.push(card);
    side.energy -= card.cost;
  };
  commit(s.you, yourCard);
  commit(s.foe, foeCard);

  const yourPower = buffedPower(s.you, yourCard);
  const foePower = buffedPower(s.foe, foeCard);

  applyNonDamage(s.you, yourCard, yourPower, s.log, 'you');
  applyNonDamage(s.foe, foeCard, foePower, s.log, 'foe');
  applyDamage(s.you, s.foe, yourCard, yourPower, s.log, 'you');
  applyDamage(s.foe, s.you, foeCard, foePower, s.log, 'foe');
  if (!yourCard) s.log.push({ who: 'you', text: 'passes' });
  if (!foeCard) s.log.push({ who: 'foe', text: 'passes' });

  // Shields never carry into the next turn — Guard answers one exchange,
  // not a standing damage reduction.
  s.you.shield = 0;
  s.foe.shield = 0;

  if (s.you.hp <= 0 || s.foe.hp <= 0) {
    s.over = true;
    s.winner = s.you.hp <= 0 && s.foe.hp <= 0 ? 'draw' : (s.foe.hp <= 0 ? 'you' : 'foe');
  } else {
    s.you.maxEnergy = Math.min(MAX_ENERGY, s.you.maxEnergy + 1);
    s.foe.maxEnergy = Math.min(MAX_ENERGY, s.foe.maxEnergy + 1);
    s.you.energy = s.you.maxEnergy;
    s.foe.energy = s.foe.maxEnergy;
    drawUpTo(s.you, HAND_SIZE);
    drawUpTo(s.foe, HAND_SIZE);
  }
  return s;
}

// A synthetic opponent deck for practice/wild-pet battles — rolls fresh
// cards rather than needing a curated roster, so this engine is playable
// standalone before the NPC-trainer layer exists.
export function rollPracticeFoeDeck(count = DECK_SIZE, luckBonus = 0) {
  const cards = [];
  for (let i = 0; i < count; i++) cards.push(rollCard(luckBonus));
  return { deckIds: cards.map(c => c.id), cardInventory: cards };
}
