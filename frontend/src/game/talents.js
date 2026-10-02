// =============================================
// TALENTS — three branches, fifteen steps each
// =============================================
// Timmy, 2026-08-23: "de ska brancha sig i 3st de ska va finishers, combos, å
// Effects ... Bygg 15 steg x 3 .. 1 på varje ... varje talent ger lite mer
// lixom nått coolt varje ggr inte nå 0.02 % gold gain haha"
//
// What this replaces: `TALENT_NODES` in data_ext2.js — 30 nodes, every single
// one a plain number (`stat: 'dmg', val: 0.002`), 300 levels of nothing you can
// feel. That is precisely the design he is rejecting, and the same disease the
// meta tree was just cured of.
//
// THE SHAPE OF A TALENT HERE
//
// Every talent is ONE step, bought once, and it changes BEHAVIOUR. There are no
// levels and no percentages-per-level, because the whole point is that each
// purchase is an event you notice. A talent carries a `flag` the engine reads
// and, where it needs one, a `val` the engine reads with it.
//
// Benchmark: Skul: The Hero Slayer's unique/legendary items, which Timmy named
// directly. What makes them good is never the number — it is the CONDITION:
//   · Pot of Greed          — a threshold that pays enormously once met
//   · Cowardly Bowmaster    — a bonus for NOT doing the obvious thing
//   · Explosive Arrow       — changes what every projectile IS
// Every talent below is one of those three shapes: a threshold, an inversion,
// or a rule change.
//
// THE HARD RULE: a talent whose flag nothing reads is worse than no talent.
// This project has shipped sixteen dead card flags once already. `test/
// talents.test.mjs` asserts every flag here appears in engine.js, and it is
// proved to go red. Do not add a talent here before its consumer exists.

export const TALENT_BRANCHES = [
  {
    id: 'finishers',
    name: 'FINISHERS',
    color: '#ff3146',
    icon: 'ui_blade',
    blurb: 'Executions. They start rare and end routine.',
  },
  {
    id: 'combos',
    name: 'COMBOS',
    color: '#ffb02e',
    icon: 'pRush',
    blurb: 'The kill chain stops being a score and becomes a resource.',
  },
  {
    id: 'effects',
    name: 'EFFECTS',
    color: '#4dc4ff',
    icon: 'ui_orb',
    blurb: 'Rule changes. What your shots ARE, not how big the number is.',
  },
];

// Cost curve. Step 1 is cheap enough to buy on the first map; step 15 is a real
// commitment. Timmy asked for far fewer talent points to exist, so the tree has
// to cost less in total than the old 300-level one.
export const talentCost = (step) => Math.max(1, Math.round(1 + step * 1.3));

// ---------------------------------------------------------------------------
// BRANCH 1 — FINISHERS
// ---------------------------------------------------------------------------
// Built directly on the execution system in engine.js (`tryFinisher`,
// `_startKatanaFinisher`, `_startHydroFinisher`). Step 1 is what turns the
// finisher from a rare accident into something you own.
const FINISHERS = [
  { step: 1,  id: 't_fin_open',   name: 'First Blood',
    desc: 'Executions can happen on any killing blow, not only a mega crit.',
    flag: 'finAnyKill', icon: 'ui_blade' },
  { step: 2,  id: 't_fin_chance', name: 'Wet Work',
    desc: 'Executions trigger far more often.',
    flag: 'finChance', val: 0.16, icon: 'pSharp' },
  { step: 3,  id: 't_fin_hydro',  name: 'Hydro Protocol',
    desc: 'Unlocks the Hydro Gun execution: kick him down, three shots, land on him.',
    flag: 'finHydro', icon: 'hydropistol' },
  { step: 4,  id: 't_fin_cd',     name: 'Short Fuse',
    desc: 'The gap between executions drops from 2.4s to 1.4s.',
    flag: 'finCd', val: 1.4, icon: 'ui_clock' },
  { step: 5,  id: 't_fin_heal',   name: 'Arterial Feed',
    desc: 'Every execution heals you for 5% of max HP.',
    flag: 'finHeal', val: 0.05, icon: 'heart' },
  { step: 6,  id: 't_fin_wave',   name: 'Crowd Work',
    desc: 'An execution tears through everything within 130px for 45% of its max HP.',
    flag: 'finWave', val: 0.45, icon: 'pAura' },
  { step: 7,  id: 't_fin_rage',   name: "Executioner's Toll",
    desc: '+8% damage for 8s after an execution. Stacks to 4.',
    flag: 'finRage', val: 0.08, icon: 'pBurn' },
  { step: 8,  id: 't_fin_gold',   name: 'Overkill Bounty',
    desc: 'Executions pay double gold.',
    flag: 'finGold', val: 2, icon: 'gold' },
  { step: 9,  id: 't_fin_slow',   name: 'Slow Dance',
    desc: 'Time crawls harder and longer through an execution.',
    flag: 'finSlow', val: 1.6, icon: 'ui_clock' },
  { step: 10, id: 't_fin_pool',   name: 'Bloodbath',
    desc: 'The mess left behind burns anything standing in it for 5s.',
    flag: 'finPool', val: 5, icon: 'pBurn' },
  { step: 11, id: 't_fin_free',   name: 'Second Serving',
    desc: '25% chance an execution costs no cooldown at all.',
    flag: 'finFree', val: 0.25, icon: 'ui_infinity' },
  { step: 12, id: 't_fin_thirds', name: 'Twin Cut',
    desc: 'The katana execution comes apart in three, not two.',
    flag: 'finThirds', icon: 'ui_daggers' },
  { step: 13, id: 't_fin_fourth', name: 'Point Blank',
    desc: 'The Hydro execution fires a fourth shot. 84% of the body, not 65%.',
    flag: 'finFourth', icon: 'hydropistol' },
  { step: 14, id: 't_fin_exec',   name: 'Mercy Rule',
    desc: 'Anything under 25% HP can simply be executed where it stands.',
    flag: 'finExec', val: 0.25, icon: 'ui_void' },
  { step: 15, id: 't_fin_apex',   name: 'APEX PREDATOR', keystone: true,
    desc: 'An execution that kills three or more refunds its own cooldown instantly.',
    flag: 'finApex', val: 3, icon: 'pStarBurst' },
];

// ---------------------------------------------------------------------------
// BRANCH 2 — COMBOS
// ---------------------------------------------------------------------------
// `run.comboCount` and `run.comboTimer` already exist and already feed move
// speed. This branch turns that counter into something you spend and protect.
const COMBOS = [
  { step: 1,  id: 't_cmb_decay',  name: 'Momentum',
    desc: 'The chain takes 40% longer to break.',
    flag: 'comboDecay', val: 0.7, icon: 'pRush' },
  { step: 2,  id: 't_cmb_dmg',    name: 'Chain Reaction',
    desc: '+0.5% damage per point of combo, up to +60%.',
    flag: 'comboDmg', val: 0.005, icon: 'damageMult' },
  { step: 3,  id: 't_cmb_pickup', name: 'Greedy Streak',
    desc: 'Above 10 combo, XP and gold fly to you from anywhere on screen.',
    flag: 'comboMagnet', val: 10, icon: 'pMagnet' },
  { step: 4,  id: 't_cmb_vamp',   name: "VAMPIRE'S DREAM",
    desc: 'Above 15 combo you drain HP from everything you hit. Above 25, every 25th kill executes for free.',
    flag: 'comboVampire', val: 15, icon: 'pLifesteal' },
  { step: 5,  id: 't_cmb_crit',   name: 'Killing Rhythm',
    desc: '+1% crit per 5 combo. It resets when the chain does.',
    flag: 'comboCrit', val: 0.01, icon: 'crit' },
  { step: 6,  id: 't_cmb_shield', name: 'Untouchable',
    desc: 'Reaching 20 combo grants a shield.',
    flag: 'comboShield', val: 20, icon: 'armor' },
  { step: 7,  id: 't_cmb_bank',   name: 'Cash Out',
    desc: 'Breaking a chain of 30+ pays gold instead of simply ending.',
    flag: 'comboBank', val: 30, icon: 'gold' },
  { step: 8,  id: 't_cmb_speed',  name: 'Blur',
    desc: 'Attack speed climbs with the chain, up to +45%.',
    flag: 'comboHaste', val: 0.45, icon: 'fireRateMult' },
  // Restored to its original meaning. It was briefly rewritten because a hit
  // did not break the chain — but Timmy then specified that it MUST ("den
  // moste nollas ... utan att bli traffad eller vanta for lange, de ar riktigt
  // Pinball system"). The penalty is now a base rule, so the cure is real.
  { step: 9,  id: 't_cmb_keep',   name: 'Cold Blood',
    desc: 'Taking a hit no longer wipes the chain. It only halves it.',
    flag: 'comboSalvage', val: 0.5, icon: 'pShield' },
  { step: 10, id: 't_cmb_boom',   name: 'Detonator',
    desc: 'Every 40th kill in a chain detonates the screen.',
    flag: 'comboBoom', val: 40, icon: 'pBurn' },
  { step: 11, id: 't_cmb_xp',     name: 'Scholar of Violence',
    desc: 'XP gain scales with the chain, up to +80%.',
    flag: 'comboXp', val: 0.8, icon: 'xpMult' },
  { step: 12, id: 't_cmb_freeze', name: 'Held Breath',
    desc: 'Standing still holds the chain instead of letting it drain.',
    flag: 'comboHold', icon: 'ui_clock' },
  { step: 13, id: 't_cmb_start',  name: 'Warm Start',
    desc: 'Every run begins at 15 combo.',
    flag: 'comboStart', val: 15, icon: 'pRush' },
  { step: 14, id: 't_cmb_double', name: 'Two For One',
    desc: 'Above 50 combo, every kill counts twice.',
    flag: 'comboDouble', val: 50, icon: 'ui_infinity' },
  { step: 15, id: 't_cmb_god',    name: 'UNBROKEN', keystone: true,
    desc: 'The chain never falls below 25 once you have reached 100.',
    flag: 'comboFloor', val: 100, icon: 'pStarBurst' },
];

// ---------------------------------------------------------------------------
// BRANCH 3 — EFFECTS
// ---------------------------------------------------------------------------
// Rule changes. Nothing in this branch is a percentage on a stat that already
// exists — each one alters what a shot, a hit or a level-up DOES.
const EFFECTS = [
  { step: 1,  id: 't_eff_boom',   name: 'Explosive Rounds',
    desc: 'Your shots detonate on impact. Small blast, no falloff.',
    flag: 'fxExplode', val: 42, icon: 'pBurn' },
  { step: 2,  id: 't_eff_coward', name: "Coward's Aim",
    desc: '+55% damage while nothing is within 200px of you.',
    flag: 'fxCoward', val: 0.55, icon: 'part_sight' },
  { step: 3,  id: 't_eff_pierce', name: 'Through And Through',
    desc: 'Shots pass through one extra body and gain damage doing it.',
    flag: 'fxPierce', val: 0.2, icon: 'pPierce' },
  { step: 4,  id: 't_eff_chain',  name: 'Conduction',
    desc: 'Every 6th hit arcs to two nearby enemies.',
    flag: 'fxChain', val: 6, icon: 'pLightning' },
  { step: 5,  id: 't_eff_bleed',  name: 'Serrated',
    desc: 'Wounds keep bleeding. Damage over time that stacks.',
    flag: 'fxBleed', val: 0.25, icon: 'pSharp' },
  { step: 6,  id: 't_eff_freeze', name: 'Cold Spray',
    desc: 'Hits slow. Enough hits and it stops moving entirely.',
    flag: 'fxChill', val: 0.3, icon: 'pFrost' },
  { step: 7,  id: 't_eff_split',  name: 'Fork',
    desc: 'A killing shot splits into two that carry on.',
    flag: 'fxSplit', val: 2, icon: 'ui_daggers' },
  { step: 8,  id: 't_eff_orbit',  name: 'Satellites',
    desc: 'Two drops orbit you and hurt what they touch.',
    flag: 'fxOrbit', val: 2, icon: 'pOrbit' },
  { step: 9,  id: 't_eff_ricochet', name: 'Bank Shot',
    desc: 'Shots bounce to a new target instead of dying on impact.',
    flag: 'fxBounce', val: 2, icon: 'pRicochet' },
  { step: 10, id: 't_eff_lvlnova', name: 'Level Nova',
    desc: 'Levelling up now clears the screen rather than nudging it.',
    flag: 'fxLevelNova', val: 2.2, icon: 'pAura' },
  { step: 11, id: 't_eff_thorns', name: 'Backwash',
    desc: 'Anything that touches you takes what it dealt, doubled.',
    flag: 'fxThorns', val: 2, icon: 'pShield' },
  { step: 12, id: 't_eff_drought', name: 'Drought',
    desc: 'Enemies below 15% HP evaporate when anything of yours touches them.',
    flag: 'fxDrought', val: 0.15, icon: 'ui_void' },
  { step: 13, id: 't_eff_echo',   name: 'Echo',
    desc: 'Every shot fires a second, weaker copy a moment later.',
    flag: 'fxEcho', val: 0.45, icon: 'ui_infinity' },
  { step: 14, id: 't_eff_rain',   name: 'Downpour',
    desc: 'Water falls where enemies are thickest, continuously.',
    flag: 'fxRain', val: 1, icon: 'ui_waterdrop' },
  { step: 15, id: 't_eff_flood',  name: 'THE FLOOD', keystone: true,
    desc: 'Everything you kill leaves water. The water kills. The water spreads.',
    flag: 'fxFlood', val: 1, icon: 'pStarBurst' },
];

const withBranch = (list, branch) => list.map(t => ({ ...t, branch, cost: talentCost(t.step) }));

export const TALENTS = [
  ...withBranch(FINISHERS, 'finishers'),
  ...withBranch(COMBOS, 'combos'),
  ...withBranch(EFFECTS, 'effects'),
];

export const TALENT_INDEX = TALENTS.reduce((m, t) => { m[t.id] = t; return m; }, {});

export const talentsFor = (branchId) =>
  TALENTS.filter(t => t.branch === branchId).sort((a, b) => a.step - b.step);

// A step is available once the step below it in the SAME branch is owned —
// that is what makes it a branch you climb rather than a shopping list.
export function isTalentAvailable(save, talent) {
  if (talent.step === 1) return true;
  const owned = save.talent || {};
  const below = talentsFor(talent.branch).find(t => t.step === talent.step - 1);
  return !below || !!owned[below.id];
}

export function talentOwned(save, id) {
  return !!(save.talent || {})[id];
}

// Flags the engine should switch on this run, resolved from the save. One
// place, so the tree and the engine can never disagree about what is active.
export function buildTalentFlags(save) {
  const owned = save.talent || {};
  const out = {};
  for (const t of TALENTS) {
    if (!owned[t.id]) continue;
    out[t.flag] = t.val === undefined ? true : t.val;
  }
  return out;
}

// Total points spent, for the panel's header and for balance work.
export function talentPointsSpent(save) {
  const owned = save.talent || {};
  return TALENTS.reduce((a, t) => a + (owned[t.id] ? t.cost : 0), 0);
}

// What all three branches cost end to end — the number the talent-point
// economy has to be balanced against.
export const TALENT_TOTAL_COST = TALENTS.reduce((a, t) => a + t.cost, 0);

// Real verbs / keystones that get the camp UNLOCKED plate — not every
// talent. A meter tick is not a ceremony. Hydro Protocol, orbiting drops,
// rain, flood, and the three capstones are things you can DO.
export const TALENT_CEREMONIES = {
  t_fin_hydro: { sub: 'HYDRO GUN EXECUTION' },
  t_fin_apex:  { sub: 'MASS KILL REFUNDS THE EXECUTION' },
  t_cmb_god:   { sub: 'THE CHAIN NEVER DIES' },
  t_eff_orbit: { sub: 'TWO DROPS ORBIT YOU' },
  t_eff_rain:  { sub: 'RAIN WHERE THEY CLUSTER' },
  t_eff_flood: { sub: 'THE WATER KILLS AND SPREADS' },
};

export function talentCeremonyOf(talent) {
  if (!talent) return null;
  const row = TALENT_CEREMONIES[talent.id];
  if (!row) return null;
  return {
    type: 'move',
    id: talent.id,
    name: talent.name,
    icon: talent.icon,
    sub: row.sub,
    how: talent.desc,
  };
}
