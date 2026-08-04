// =============================================
// WATERDROP CLICKER — the idle layer
// =============================================
// Tap the well for drops, spend drops on condensers that produce drops on
// their own, and the production keeps running while the game is closed.
//
// The load-bearing decision (see docs/ROADMAP-modes.md): drops are the
// clicker's INTERNAL currency and buy nothing outside it. Real payouts come
// from lifetime-production milestones instead. If drops converted directly
// into gold or gems, the clicker would immediately out-earn actually playing
// the game, and every other mode would become pointless — which is the usual
// way an idle layer bolted onto an action game eats the action game.

export const CLICKER_BUILDINGS = [
  { id: 'condenser', name: 'Dew Condenser', icon: 'gem',    base: 15,      growth: 1.15, rate: 1,     desc: 'Pulls moisture out of the air.' },
  { id: 'net',       name: 'Mist Net',      icon: 'shield', base: 120,     growth: 1.16, rate: 5,     desc: 'Catches fog on a lattice and lets it run down.' },
  { id: 'trap',      name: 'Cloud Trap',    icon: 'orb',    base: 900,     growth: 1.17, rate: 22,    desc: 'Holds a cloud still long enough to wring it out.' },
  { id: 'aquifer',   name: 'Aquifer Tap',   icon: 'beam',   base: 7000,    growth: 1.18, rate: 100,   desc: 'Reaches the water table under the ruins.' },
  { id: 'coil',      name: 'Storm Coil',    icon: 'bolt',   base: 55000,   growth: 1.19, rate: 480,   desc: 'Calls rain down on purpose.' },
  { id: 'engine',    name: 'Tide Engine',   icon: 'meteor', base: 420000,  growth: 1.20, rate: 2400,  desc: 'Moves the sea itself, a little.' },
];

// Click power scales off a bought upgrade AND a slice of passive production,
// so tapping stays worth doing late instead of becoming a rounding error.
export const CLICK_UPGRADE = { base: 40, growth: 1.28, per: 1 };

export function buildingCost(def, owned) {
  return Math.ceil(def.base * Math.pow(def.growth, owned));
}

export function clickUpgradeCost(lvl) {
  return Math.ceil(CLICK_UPGRADE.base * Math.pow(CLICK_UPGRADE.growth, lvl));
}

export function dropsPerSec(clicker) {
  const owned = clicker?.buildings || {};
  let rate = 0;
  for (const def of CLICKER_BUILDINGS) rate += (owned[def.id] || 0) * def.rate;
  return rate;
}

export function dropsPerClick(clicker) {
  const lvl = clicker?.clickLvl || 0;
  // 1% of your per-second production folded into each tap.
  return 1 + lvl * CLICK_UPGRADE.per + Math.floor(dropsPerSec(clicker) * 0.01);
}

// ---- Milestones ------------------------------------------------------------
// Paid out against LIFETIME drops produced, claimed once each. This is the
// only bridge from the clicker into the rest of the economy, and it is
// deliberately a slow, chunky ladder rather than a steady trickle.
export const CLICKER_MILESTONES = [
  { at: 100,           reward: { gold: 250 },                       label: '250 gold' },
  { at: 1000,          reward: { gems: 1 },                         label: '1 gem' },
  { at: 10000,         reward: { gold: 900, gearParts: 15 },        label: '900 gold + 15 parts' },
  { at: 60000,         reward: { gems: 3, slotCoins: 2 },           label: '3 gems + 2 coins' },
  { at: 300000,        reward: { sp: 2, gearParts: 40 },            label: '2 SP + 40 parts' },
  { at: 1500000,       reward: { gachaTokens: 1, tcgCard: 1 },      label: '1 gacha token + a TCG card' },
  { at: 8000000,       reward: { rune: 1, gems: 6 },                label: 'a rune + 6 gems' },
  { at: 40000000,      reward: { sp: 6, gachaTokens: 2, tcgCard: 2 }, label: '6 SP + 2 tokens + 2 TCG cards' },
  { at: 200000000,     reward: { flux: 2, rune: 1, tcgCard: 3 },    label: '2 Flux + a rune + 3 TCG cards' },
];

export function pendingMilestones(clicker) {
  const total = clicker?.total || 0;
  const claimed = clicker?.claimed || {};
  return CLICKER_MILESTONES.filter(m => total >= m.at && !claimed[m.at]);
}

export function nextMilestone(clicker) {
  const total = clicker?.total || 0;
  return CLICKER_MILESTONES.find(m => total < m.at) || null;
}

// Compact display for numbers that run to the hundreds of millions.
export function fmtDrops(n) {
  if (n < 1000) return Math.floor(n).toString();
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 2 : 1) + 'K';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 2 : 1) + 'M';
  return (n / 1e9).toFixed(2) + 'B';
}
