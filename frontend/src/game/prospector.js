// =============================================
// ASTRO PROSPECTOR — push-your-luck asteroid descent
// =============================================
// You drop a probe and decide, layer by layer, whether to bank what you are
// carrying or dig one deeper. Deeper layers pay more and are more likely to
// wreck you. Everything unbanked is lost if the probe dies.
//
// Why it exists (see docs/ROADMAP-modes.md): it is the ONLY source of Cores
// and Flux, and Cores are the only way to unlock the unique level-up cards
// below. That gives the mode a reason to be played that no other mode covers,
// and it feeds straight back into a run.

export const PROBE_UPGRADES = {
  hull:    { name: 'Hull Plating',  icon: '🛡', max: 5, costBase: 12, costGrowth: 1.55, desc: 'Survive one more hazard per level.' },
  drill:   { name: 'Drill Head',    icon: '⛏', max: 8, costBase: 10, costGrowth: 1.42, desc: '+18% Cores from every ore seam.' },
  scanner: { name: 'Deep Scanner',  icon: '📡', max: 5, costBase: 16, costGrowth: 1.60, desc: 'Reveals what the next layer holds before you commit.' },
  cargo:   { name: 'Cargo Bay',     icon: '📦', max: 6, costBase: 14, costGrowth: 1.50, desc: '+40 carrying capacity before a seam starts spilling.' },
};

export function probeCost(id, lvl) {
  const u = PROBE_UPGRADES[id];
  return Math.round(u.costBase * Math.pow(u.costGrowth, lvl));
}

export function probeStats(levels = {}) {
  return {
    hull: 1 + (levels.hull || 0),
    drillMult: 1 + (levels.drill || 0) * 0.18,
    scannerDepth: levels.scanner || 0,
    cargo: 60 + (levels.cargo || 0) * 40,
  };
}

// ---- Unique level-up cards -------------------------------------------------
// Deliberately build-defining rather than another +12%. These only enter the
// in-run card pool once bought here, which is the whole payoff of the mode.
// Each one is a flag the engine reads — see engine.js for the hooks.
export const PROSPECT_CARDS = [
  {
    id: 'pc_prism', flag: 'prismCore', icon: '🔷', name: 'Prism Core', cost: 45,
    desc: 'Projectiles split into two shards on their first hit.',
    lore: 'Refracted through a lattice that should not exist at this depth.',
  },
  {
    id: 'pc_tempo', flag: 'tempoEngine', icon: '🎼', name: 'Tempo Engine', cost: 40,
    desc: 'Each kill grants +4% fire rate for 4s. Stacks up to 10 times.',
    lore: 'It keeps time with the killing, and the killing keeps time with it.',
  },
  {
    id: 'pc_singularity', flag: 'singularityRounds', icon: '🕳', name: 'Singularity Rounds', cost: 55,
    desc: 'Kills collapse into a brief vortex that drags nearby foes inward.',
    lore: 'Every seam here leans very slightly toward the same point.',
  },
  {
    id: 'pc_echo', flag: 'echoChamber', icon: '🔊', name: 'Echo Chamber', cost: 50,
    desc: 'Every 5th shot fires a second time, free.',
    lore: 'The shot arrives twice. Only one of them left the barrel.',
  },
  {
    id: 'pc_overload', flag: 'coreOverload', icon: '☢️', name: 'Core Overload', cost: 60,
    desc: '+12% crit chance, and crits pierce everything they touch.',
    lore: 'Rated for eight hundred cycles. You are on nine thousand.',
  },
];

// ---- Layer generation ------------------------------------------------------
// Hazard odds climb with depth, which is the entire tension: the layer that
// pays best is the layer most likely to end the dive.
export function hazardChance(depth) {
  return Math.min(0.62, 0.06 + depth * 0.045);
}

export function rollLayer(depth, hasLockedCards) {
  if (Math.random() < hazardChance(depth)) {
    const kinds = ['Cave-in', 'Gas pocket', 'Pressure spike', 'Rock burst'];
    return { type: 'hazard', label: kinds[(Math.random() * kinds.length) | 0] };
  }
  // Relics get slightly more likely the deeper you are.
  const relicChance = Math.min(0.24, 0.09 + depth * 0.012);
  if (Math.random() < relicChance) {
    // A blueprint is the rarer half of a relic, and only if anything is
    // still locked — otherwise it silently degrades to Flux rather than
    // rolling a reward that cannot be granted.
    if (hasLockedCards && Math.random() < 0.34) return { type: 'blueprint', label: 'Sealed data core' };
    return { type: 'flux', label: 'Flux vein', amount: 1 + ((Math.random() * 2) | 0) };
  }
  return { type: 'ore', label: 'Core seam' };
}

export function oreYield(depth, drillMult) {
  return Math.max(1, Math.round((2 + depth * 1.35) * drillMult));
}
