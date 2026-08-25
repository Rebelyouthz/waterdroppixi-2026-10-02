/* ECONOMY SIMULATOR — run it, read the numbers, change one lever, run it again.
 *
 * Timmy, 2026-08-23: "hur får ja dig att balansera detta på nästa sätt ja såg
 * en mcp som skulle balanse the game ekonomy". The answer is this file rather
 * than an MCP: a balance service can only reason about generic genre curves,
 * but the actual problem lives in THIS game's tables. This reads them.
 *
 *   node --import ./test/resolver-register.mjs test/balance-sim.mjs
 *   node --import ./test/resolver-register.mjs test/balance-sim.mjs --proposed
 *
 * It is an ANALYSIS TOOL, not a test. It asserts nothing and changes nothing —
 * it prints what the current numbers actually produce, so a balance decision
 * is made against measured values instead of a memory of them. Recount, don't
 * recall: every figure below is derived from the real modules at run time.
 */
import { META_UPGRADES, metaCost, WEAPONS, ENEMIES } from '../src/game/data.js';
import { campaignNodes, rollCampaignChest } from '../src/game/campaign.js';
import { accountXpToNext } from '../src/game/data_ext.js';

const PROPOSED = process.argv.includes('--proposed');
const n = (v) => v.toLocaleString('sv-SE');
const bar = (frac, w = 28) => '#'.repeat(Math.max(0, Math.round(frac * w))).padEnd(w, '.');
const h = (t) => console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`);

// ---------------------------------------------------------------------------
// THE PROPOSAL
// ---------------------------------------------------------------------------
// Same total power, far fewer levels, each level fat enough to FEEL.
//
// The rule is deliberately conservative: `max * amount` is held constant per
// track, so nothing about the game's balance at full power changes. Only the
// GRAIN changes. That means this can ship without a combat retune, which is
// the difference between a change we can make now and one that needs another
// week of play-testing.
//
// Genre anchor: Vampire Survivors ships 28 PowerUps at 3-5 tiers each — on the
// order of 100-130 total levels. This game currently has 1404.
const PROPOSAL = {
  // big identity stats — the ones a player actually chases
  m_dmg: 10, m_crit: 10, m_critd: 10, m_hp: 10, m_atks: 10, m_armor: 10,
  // economy / utility — smaller tracks, they are support not identity
  m_xp: 8, m_gold: 8, m_luck: 8, m_regen: 8, m_spd: 8, m_pickup: 8,
  m_projspd: 8, m_projrange: 8, m_dodge: 8,
  // rare, high-impact — deliberately short so each one is an event
  m_superCrit: 5, m_megaCrit: 5, m_heal: 5, m_zoom: 5,
  m_lvlBoomDmg: 5, m_lvlBoomKB: 5,
  // already correctly tiny
  m_start: 3, m_revive: 1,
};
// A named milestone every N levels, granting a real effect rather than more
// percent. This is what carries the dopamine once the levels are rare.
const MILESTONE_EVERY = 5;

// Cost curve for the proposal. Levels are ~6x rarer, so each must cost more —
// Timmy: "de ska va lite mer jobba för å köpa 1 level". Total gold to max the
// tree is held near the current figure so the long tail keeps its length.
const propCost = (u, lvl, maxLvl) => {
  const scale = u.max / maxLvl;               // how much fatter each level got
  return Math.round(u.baseCost * scale * Math.pow(Math.pow(u.curve, scale), lvl));
};

// ---------------------------------------------------------------------------
// 1. WHAT THE META TREE COSTS TODAY
// ---------------------------------------------------------------------------
h('1. META UPGRADES — what is actually in the file');

let curLevels = 0, curGold = 0;
let propLevels = 0, propGold = 0;
const rows = [];
for (const u of META_UPGRADES) {
  let c = 0;
  for (let i = 0; i < u.max; i++) c += metaCost(u, i);
  curLevels += u.max; curGold += c;

  const pm = PROPOSAL[u.id] ?? u.max;
  let pc = 0;
  for (let i = 0; i < pm; i++) pc += propCost(u, i, pm);
  propLevels += pm; propGold += pc;

  rows.push({
    id: u.id, stat: u.stat, max: u.max, amount: u.amount, total: c,
    pmax: pm, pamount: (u.amount * u.max) / pm, ptotal: pc,
    // "Is one level perceptible?" A percentage stat below ~0.5% per level is
    // under the threshold where a human can tell two adjacent levels apart.
    perceptible: u.amount < 1 ? u.amount >= 0.005 : true,
  });
}

console.log(`tracks:            ${META_UPGRADES.length}`);
console.log(`levels, total:     ${n(curLevels)}${PROPOSED ? `   -> ${n(propLevels)}` : ''}`);
console.log(`gold to max all:   ${n(curGold)}${PROPOSED ? `   -> ${n(propGold)}` : ''}`);
console.log(`avg gold / level:  ${n(Math.round(curGold / curLevels))}${PROPOSED ? `   -> ${n(Math.round(propGold / propLevels))}` : ''}`);

const dead = rows.filter(r => !r.perceptible);
console.log(`\nlevels too small to feel: ${dead.length} of ${rows.length} tracks`);
for (const r of dead) {
  console.log(`  ${r.id.padEnd(14)} +${(r.amount * 100).toFixed(2)}% ${String(r.stat).padEnd(11)} per level, x${r.max} levels`);
}

if (PROPOSED) {
  console.log('\nPROPOSED per-track shape (max * amount held constant):');
  console.log(`  ${'id'.padEnd(14)} ${'levels'.padEnd(12)} ${'per level'.padEnd(26)} milestones`);
  for (const r of rows) {
    const f = (v) => (r.amount < 1 ? (v * 100).toFixed(2) + '%' : String(Math.round(v * 100) / 100));
    console.log(`  ${r.id.padEnd(14)} ${`${r.max} -> ${r.pmax}`.padEnd(12)} ${`${f(r.amount)} -> ${f(r.pamount)}`.padEnd(26)} ${Math.floor(r.pmax / MILESTONE_EVERY)}`);
  }
  console.log(`\n  total milestones to design: ${rows.reduce((a, r) => a + Math.floor(r.pmax / MILESTONE_EVERY), 0)}`);
}

// ---------------------------------------------------------------------------
// 2. WHAT A CAMPAIGN RUN PAYS
// ---------------------------------------------------------------------------
h('2. THE CAMPAIGN — what one full clear pays out');

const nodes = campaignNodes();
// rollCampaignChest is random, so average it rather than trusting one roll.
const SAMPLES = 400;
let campGold = 0;
for (const node of nodes) {
  let sum = 0;
  for (let s = 0; s < SAMPLES; s++) {
    for (let i = 0; i < 3; i++) {
      for (const it of rollCampaignChest(node, i === 2, 1)) if (it.type === 'gold') sum += it.amount;
    }
  }
  campGold += sum / SAMPLES;
}
campGold = Math.round(campGold);
console.log(`nodes:                     ${nodes.length} across ${new Set(nodes.map(x => x.mapId)).size} maps`);
console.log(`gold, one full clear:      ${n(campGold)}  (averaged over ${SAMPLES} rolls/node)`);
console.log(`campaign runs to max meta: ${(curGold / campGold).toFixed(1)}${PROPOSED ? `   -> ${(propGold / campGold).toFixed(1)}` : ''}`);

// ---------------------------------------------------------------------------
// 3. TIMMY'S TARGET RATE
// ---------------------------------------------------------------------------
h('3. AGAINST THE TARGET RATE — "1 skill point, 1 talent, 1-2 meta per map"');

const MAPS = nodes.length;
for (const perMap of [1, 1.5, 2]) {
  const perRun = MAPS * perMap;
  console.log(`  ${perMap} meta level(s) / map  = ${perRun.toFixed(0)} levels per campaign run`
    + `  -> ${(curLevels / perRun).toFixed(1)} runs to max today`
    + (PROPOSED ? `, ${(propLevels / perRun).toFixed(1)} runs proposed` : ''));
}
console.log(`\n  1 skill point / map  = ${MAPS} SP per campaign run`);
console.log(`  1 talent      / map  = ${MAPS} TP per campaign run`);
console.log('\n  Today TP comes from PROFILE LEVELS (+2 flat each), not from maps —');
console.log('  which is why talent points pile up. Moving both to map clears is');
console.log('  what makes "mycket mindre" true and ties them to playing, not idling.');

// ---------------------------------------------------------------------------
// 4. GOLD-ONLY-ON-FAILURE
// ---------------------------------------------------------------------------
h('4. "GOLD ONLY IF YOU DO NOT CLEAR THE MAP" — modelled both ways');

// A player's clear rate rises as they get stronger. Model it as a simple ramp
// so the two economies can be compared over a realistic career, not at one
// fixed skill level.
const career = (clearRateAt, goldOnClear) => {
  let gold = 0;
  for (let run = 0; run < 40; run++) {
    const cr = clearRateAt(run);
    const perMapGold = campGold / MAPS;
    gold += MAPS * (cr * perMapGold * goldOnClear + (1 - cr) * perMapGold * 0.45);
  }
  return Math.round(gold);
};
const ramp = (run) => Math.min(0.95, 0.15 + run * 0.03);

const A = career(ramp, 1.0);     // today: clearing pays full
const B = career(ramp, 0.0);     // his version: clearing pays NO gold
const C = career(ramp, 0.35);    // the middle: clearing pays less, never zero

console.log('  over a 40-run career, clear rate ramping 15% -> 95%:');
console.log(`    today  (clear pays full):     ${n(A).padStart(9)} gold`);
console.log(`    yours  (clear pays nothing):  ${n(B).padStart(9)} gold   ${bar(B / A)}`);
console.log(`    middle (clear pays 35%):      ${n(C).padStart(9)} gold   ${bar(C / A)}`);
console.log(`
  THE RISK, stated once: in "yours", gold income FALLS as the player improves.
  A player who has learned the game stops earning the currency that buys meta
  upgrades — the classic "punished for getting good" trap, and it bites hardest
  exactly when the remaining upgrades are most expensive.

  The intent behind it is right and worth keeping: a failed run must never be
  wasted time. "middle" delivers that without the inversion — failing pays MORE
  gold per map than clearing does, so a loss still feels paid, but the total
  still rises with skill because clearing also pays SP, TP and progress.
  Your call; the two are one constant apart in the code.`);

// ---------------------------------------------------------------------------
// 5. PROFILE LEVELS
// ---------------------------------------------------------------------------
h('5. PROFILE LEVELS — the other tap');

let xp = 0;
const marks = [10, 25, 50];
console.log('  XP curve is 60 * 1.18^level (geometric — this part is healthy).');
for (let lv = 1; lv <= Math.max(...marks); lv++) {
  xp += accountXpToNext(lv);
  if (marks.includes(lv)) {
    const sp = Array.from({ length: lv }, (_, i) => Math.max(1, Math.floor((i + 1) / 4))).reduce((a, b) => a + b, 0);
    console.log(`    to level ${String(lv).padEnd(3)} = ${n(Math.round(xp)).padStart(13)} XP   -> ${lv * 2} TP and ${sp} SP at today's rate`);
  }
}

h('SUMMARY');
console.log(`  ${n(curLevels)} levels is ~11x the genre benchmark (Vampire Survivors: 28
  PowerUps at 3-5 tiers). ${dead.length} of ${rows.length} tracks move a stat by an amount
  no player can perceive in a single purchase.

  The whole meta tree costs ${n(curGold)} gold. One campaign clear pays ${n(campGold)}.
  So the entire permanent-progression layer is exhausted in ${(curGold / campGold).toFixed(1)} campaign
  runs — which is exactly what Timmy reported feeling: "man kor 5 ggr".

  Run with --proposed to see the reshaped tree.`);

// ═══════════════════════════════════════════════════════════════════════════
// 6. WEAPONS — the DPS spread across the whole arsenal
// ═══════════════════════════════════════════════════════════════════════════
// Timmy, 2026-08-23: "equipment weapons rarity levvel up cards.. allt fiender
// hp skada standard stats allt maste simuleras forst a sen bygga nasta sak".
//
// A 39-weapon arsenal where nobody has ever compared the weapons to each other
// is the same silent failure as 1404 meta levels: the table looks full, and
// half of it is unreachable or pointless. This ranks every weapon by the one
// number that decides whether it ever gets picked twice.
//
// DPS = damage x fireRate x projectileCount x expected-crit
// Expected crit uses the engine's default crit multiplier (2.0), so a weapon
// that trades raw damage for crit chance is not undercounted.

h('6. WEAPONS — DPS, every weapon, measured from data.js');

const CRIT_DMG = 2.0;          // engine default; cards raise it, this is base

// ORBIT WEAPONS DO NOT FIRE. The first version of this section multiplied by
// `fireRate` for everything and reported five weapons at ZERO DPS - Ember Orbs,
// Whirlwind, Frost Orb, Inferno Ring, Blizzard. They are `behaviour: 'orbit'`:
// bodies circling the player that damage on CONTACT, so `fireRate` is
// meaningless for them (whirlwind even carries an explicit `fireRate: 0.0`).
// engine.js does `dmgPerSec = s.damage * damageMult * 2  // tick rate baked in`,
// per enemy in contact. The table was about to send someone off to "fix" five
// weapons that were never broken - which is the exact failure a simulator is
// supposed to PREVENT, so it is worth the extra branch.
const ORBIT_TICKS = 2;         // engine.js: dmgPerSec = damage * mult * 2
const isOrbit = (w) => (w.base && w.base.behaviour) === 'orbit'
  || w.behaviour === 'orbit'
  || (w.base && w.base.orbitCount != null && !w.base.fireRate);

const wRows = Object.entries(WEAPONS).map(([id, w]) => {
  const b = w.base || {};
  const dmg = b.damage || 0;
  const crit = b.crit || 0;
  const orbit = isOrbit(w);
  const rate = orbit ? ORBIT_TICKS : (b.fireRate || 0);
  const count = orbit ? 1 : (b.count || b.projectiles || 1);
  const dps = dmg * rate * count * (1 + crit * (CRIT_DMG - 1));
  return { id, name: w.name || id, type: w.type || '?', dmg, rate, count, crit, dps, orbit };
}).sort((a, b) => b.dps - a.dps);

const dpsVals = wRows.map(r => r.dps).filter(v => v > 0).sort((a, b) => a - b);
const median = dpsVals[Math.floor(dpsVals.length / 2)] || 1;

console.log(`  ${wRows.length} weapons.  median DPS ${Math.round(median)}\n`);
console.log('  ' + 'weapon'.padEnd(22) + 'type'.padEnd(9) + 'dmg'.padStart(6)
  + 'rate'.padStart(7) + 'x'.padStart(3) + 'crit'.padStart(7) + 'DPS'.padStart(8) + '   vs median');
for (const r of wRows) {
  const rel = r.dps / median;
  const flag = r.dps === 0 ? '  <-- ZERO DPS'
    : r.orbit ? '  (orbit: x enemies in range)'
    : rel > 2.0 ? '  <-- over 2x median'
    : rel < 0.5 ? '  <-- under half median'
    : '';
  console.log('  ' + r.name.slice(0, 21).padEnd(22) + r.type.padEnd(9)
    + String(r.dmg).padStart(6) + Number(r.rate).toFixed(2).padStart(7)
    + String(r.count).padStart(3) + (r.crit * 100).toFixed(0).padStart(6) + '%'
    + String(Math.round(r.dps)).padStart(8) + '  ' + rel.toFixed(2) + 'x' + flag);
}

const outliers = wRows.filter(r => r.dps === 0 || r.dps > median * 2 || r.dps < median * 0.5);
console.log(`\n  ${outliers.length} of ${wRows.length} weapons sit outside 0.5x-2.0x the median.`);
console.log('  A survivor arsenal does NOT need every weapon equal - variety is the point -');
console.log('  but under half the median is a pick the player regrets, and over double it');
console.log('  makes every other weapon irrelevant the moment it drops.');

// ═══════════════════════════════════════════════════════════════════════════
// 7. THE COMBAT CURVE — enemy HP and damage against player power, over a run
// ═══════════════════════════════════════════════════════════════════════════
// Every formula below is copied from engine.js's spawnEnemy, not approximated:
//
//   scale     = 1 + time/190
//   menace    = min(2.2, 1 + (level-1) * 0.055)
//   maxHp     = floor(hp * scale * 3 * (1 + bossesKilled*0.25) * menace * D.hpMult)
//   menaceDmg = min(1.9, 1 + (level-1) * 0.035)
//   dmgMult   = (1 + time/200) * (1 + bossesKilled*1.6) * menaceDmg * D.dmgMult
//               x2.5 for the square/brute types
//
// If any of those change in engine.js this section goes stale SILENTLY - the
// one real weakness of a simulator that mirrors formulas instead of importing
// them. Worth extracting into a shared module the day it bites.

h('7. THE COMBAT CURVE — is it "jaga, spela, do, klara"?');

const enemyHpAt = (baseHp, time, level, killed, hpMult = 1) =>
  Math.floor(baseHp * (1 + time / 190) * 3 * (1 + killed * 0.25)
    * Math.min(2.2, 1 + (level - 1) * 0.055) * hpMult);

const enemyDmgMultAt = (time, level, killed, dmgMult = 1, square = false) =>
  (1 + time / 200) * (1 + killed * 1.6)
  * Math.min(1.9, 1 + (level - 1) * 0.035) * dmgMult * (square ? 2.5 : 1);

// The player's expected level at a given time, anchored on the note engine.js
// already carries: "level 7 with ~480 DPS when the first guardian arrives at
// t=150". The rest is interpolated off the same three-stage XP curve.
const levelAtTime = (t) =>
  t < 30 ? 2 : t < 70 ? 4 : t < 110 ? 5 : t < 150 ? 6 : t < 200 ? 7
  : t < 280 ? 9 : t < 360 ? 11 : t < 460 ? 13 : t < 560 ? 15 : 17;

const bossesBy = (t) => (t >= 540 ? 3 : t >= 430 ? 2 : t >= 280 ? 1 : 0);

// Player DPS: the starting weapon plus the cards taken by then. Cards are the
// big power swing BY DESIGN - the genre skill is explicit that in-run cards
// must outweigh meta - modelled as a compounding gain per level. Stated as an
// assumption because it is one.
const CARD_GAIN = 1.18;
const hp0 = WEAPONS.hydropistol && WEAPONS.hydropistol.base;
const startDps = hp0
  ? hp0.damage * hp0.fireRate * (hp0.count || 1) * (1 + (hp0.crit || 0))
  : median;
const playerDpsAt = (level) => startDps * Math.pow(CARD_GAIN, level - 1);

const CHECKS = [
  { t: 0, note: 'the first breath' },
  { t: 60, note: '' },
  { t: 150, note: 'first guardian' },
  { t: 280, note: 'second boss' },
  { t: 430, note: 'third boss' },
  { t: 540, note: 'final boss / campaign end' },
];

console.log(`  starting weapon DPS: ${Math.round(startDps)}   (hydropistol, no bonuses)\n`);
console.log('  slime - the baseline chase enemy - on NORMAL:\n');
console.log('  ' + 'time'.padStart(6) + 'lvl'.padStart(5) + 'enemy HP'.padStart(10)
  + 'player DPS'.padStart(12) + 'TTK'.padStart(8) + 'dmg/hit'.padStart(10));
const slime = ENEMIES.slime;
for (const c of CHECKS) {
  const lvl = levelAtTime(c.t);
  const k = bossesBy(c.t);
  const hp = enemyHpAt(slime.hp, c.t, lvl, k, 1);
  const dps = playerDpsAt(lvl);
  const dmg = Math.round(slime.dmg * enemyDmgMultAt(c.t, lvl, k, 1));
  console.log('  ' + (c.t + 's').padStart(6) + String(lvl).padStart(5)
    + n(hp).padStart(10) + n(Math.round(dps)).padStart(12)
    + ((hp / dps).toFixed(2) + 's').padStart(8) + String(dmg).padStart(10)
    + (c.note ? '   ' + c.note : ''));
}

console.log('\n  A chase enemy should die in WELL under a second for the whole campaign -');
console.log('  the genre fantasy is mowing, not duelling. A TTK climbing past ~1s means');
console.log('  the player is losing the race against the HP curve.');
console.log('  Player base HP is 70 (+meta), so watch dmg/hit against that too.\n');

// Boss fight length is the number the genre skill is most specific about.
const BOSS_LO = 20, BOSS_HI = 45;
const bossList = Object.entries(ENEMIES).filter(([id, e]) => /^boss/i.test(id) || e.boss);
if (bossList.length) {
  console.log('  BOSS FIGHT LENGTH - the genre target is 20-45s:\n');
  console.log('  ' + 'boss'.padEnd(22) + 'at t'.padStart(7) + 'HP'.padStart(12)
    + 'player DPS'.padStart(12) + 'fight'.padStart(9) + '   verdict');
  const bossAt = { bossOcular: 150, bossNecromancer: 280, bossVoidTitan: 430, bossAida: 540 };
  for (const [id, b] of bossList) {
    const t = bossAt[id] ?? 300;
    const lvl = levelAtTime(t);
    const k = bossesBy(t);
    const hp = enemyHpAt(b.hp, t, lvl, k, 1);
    const dps = playerDpsAt(lvl);
    const secs = hp / dps;
    const verdict = secs < BOSS_LO ? 'TOO FAST - not an event'
      : secs > BOSS_HI ? 'TOO LONG - a slog' : 'in the window';
    console.log('  ' + (b.name || id).slice(0, 21).padEnd(22) + (t + 's').padStart(7)
      + n(hp).padStart(12) + n(Math.round(dps)).padStart(12)
      + (secs.toFixed(0) + 's').padStart(9) + '   ' + verdict);
  }
}

console.log('\n  ASSUMPTIONS, stated so they can be argued with:');
console.log(`    - player DPS = starting weapon x ${CARD_GAIN} per run level (cards compound)`);
console.log('    - level-at-time anchored on engine.js\'s own note: level 7 at t=150');
console.log('    - no gear, no pet, no meta, no talents - this is the FLOOR, not a build');
console.log('  Change CARD_GAIN at the top of section 7 to model a stronger build.');

// ═══════════════════════════════════════════════════════════════════════════
// 8. THE FULL PERMANENT-POWER AUDIT
// ═══════════════════════════════════════════════════════════════════════════
// Timmy, 2026-08-24: "ja vill allt blir rätt inställt ihop med storylinen ...
// så måste ju mätas på rätt sätt, inte missa nått, du måste analysera allt
// innan så du har hela skiten i minnet."
//
// Every source of PERMANENT power in the game, measured from its real module.
// Permanent means: survives a run. In-run level-up cards are deliberately NOT
// here — they are the other budget, and the genre rule is that they must stay
// dominant over this one.
//
// Anything this cannot measure is printed as UNMEASURED with the reason. A
// silent omission in a balance audit is worse than a gap, because the total
// then looks complete and is not.

h('8. PERMANENT POWER — every source, measured');

const pctOf = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%';
const unmeasured = [];
const sources = [];

// ── 1. META UPGRADES ──────────────────────────────────────────────────────
{
  const rows = Object.values(META_UPGRADES);
  const g = (id) => { const r = rows.find(x => x.id === id); return r ? r.max * r.amount : 0; };
  const dmg = g('m_dmg'), atk = g('m_atks'), crit = g('m_crit'), critd = g('m_critd');
  const hp = g('m_hp'), armor = g('m_armor');
  sources.push({
    name: 'META UPGRADES', how: 'gold, ' + rows.length + ' tracks',
    dps: (1 + dmg) * (1 + atk),
    note: `dmg ${pctOf(dmg)}  atkspd ${pctOf(atk)}  crit ${pctOf(crit)}  critdmg ${pctOf(critd)}  +${hp} flat HP  +${armor} armor`,
  });
}

// ── 2. SKILL TREE ─────────────────────────────────────────────────────────
try {
  const T = await import('../src/game/poe_tree.js');
  const nodes = Object.values(T.POE_TREE_NODES || {});
  const agg = {};
  let levels = 0;
  for (const n of nodes) {
    levels += (n.max || 1);
    if (!n.stat) continue;
    agg[n.stat] = (agg[n.stat] || 0) + (n.val || 0) * (n.max || 1);
  }
  const dmg = agg.dmg || 0;
  const atk = agg.atkSpeed || agg.fireRate || agg.atks || 0;
  sources.push({
    name: 'SKILL TREE', how: `SP, ${nodes.length} nodes / ${levels} levels`,
    dps: (1 + dmg) * (1 + atk),
    note: `dmg ${pctOf(dmg)}  atkspd ${pctOf(atk)}  +${(agg.maxHp || 0)} FLAT HP  pierce ${pctOf(agg.pierce || 0)}  proj ${pctOf(agg.proj || 0)}`,
  });
} catch (e) { unmeasured.push(['SKILL TREE', e.message]); }

// ── 3. TALENTS ────────────────────────────────────────────────────────────
try {
  const TA = await import('../src/game/talents.js');
  const list = TA.TALENTS || [];
  const pending = list.filter(t => t.pending).length;
  sources.push({
    name: 'TALENTS', how: `TP, ${list.length} talents in ${Object.keys(TA.TALENT_BRANCHES || {}).length} branches`,
    dps: null,
    note: `${list.length - pending} live, ${pending} PENDING (designed, inert). Total cost ${TA.TALENT_TOTAL_COST || '?'} pts.\n`
        + '     Talents are conditional rule-changes, not multipliers — they cannot be summed into a DPS number and should not be.',
  });
} catch (e) { unmeasured.push(['TALENTS', e.message]); }

// ── 4. EQUIPMENT ──────────────────────────────────────────────────────────
try {
  const G = await import('../src/game/gear.js');
  const slots = G.GEAR_SLOTS || [];
  const rar = G.GEAR_RARITIES || [];
  const mult = G.GEAR_RARITY_MULT || {};
  const top = rar[rar.length - 1];
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const totals = {};
  let built = 0;
  for (const s of slots) {
    try {
      const it = G.generateGearItem(s, top, rand);
      built++;
      for (const st of (it.stats || [])) {
        const k = st.stat || st.key;
        const v = st.val != null ? st.val : st.value;
        if (k != null && typeof v === 'number') totals[k] = (totals[k] || 0) + v;
      }
      if (it.stat && typeof it.val === 'number') totals[it.stat] = (totals[it.stat] || 0) + it.val;
    } catch (e) { /* reflected in `built` */ }
  }
  const dmg = totals.damageMult || totals.dmg || totals.damage || 0;
  const atk = totals.fireRateMult || totals.atkSpeed || 0;
  sources.push({
    name: 'EQUIPMENT', how: `${slots.length} slots x ${rar.length} rarities x ${G.GEAR_MAX_LEVEL || '?'} levels`,
    dps: (1 + dmg) * (1 + atk),
    note: `full ${top} set, level 1, fixed seed: ${Object.entries(totals).map(([k, v]) => k + ' ' + (+v).toFixed(3)).join(', ').slice(0, 140)}\n`
        + `     rarity ladder: ${rar.map(r => r + ' ' + (mult[r] ?? '?') + 'x').join('  ')}\n`
        + `     built ${built}/${slots.length} pieces`,
  });
} catch (e) { unmeasured.push(['EQUIPMENT', e.message]); }

// ── 5. RUNES ──────────────────────────────────────────────────────────────
try {
  const R = await import('../src/game/runes.js');
  const rar = R.RUNE_RARITIES || [];
  const top = rar[rar.length - 1];
  let sample = null;
  try { sample = R.generateRune(top); } catch (e) { /* */ }
  sources.push({
    name: 'RUNES', how: `${rar.length} rarities; socketed into manual weapons and ${(R.RUNE_GEAR_SLOTS || []).join('/')}`,
    dps: null,
    note: sample ? `top-rarity sample: ${JSON.stringify(sample).slice(0, 130)}`
                 : 'could not sample — generateRune signature differs',
  });
} catch (e) { unmeasured.push(['RUNES', e.message]); }

// ── 6. ARTIFACTS ──────────────────────────────────────────────────────────
try {
  const A = await import('../src/game/artifacts.js');
  const rar = A.ARTIFACT_RARITIES || [];
  let sample = null;
  try { sample = A.generateArtifact(rar[rar.length - 1]); } catch (e) { /* */ }
  sources.push({
    name: 'ARTIFACTS', how: `${A.ARTIFACT_SLOT_COUNT} equipped slots, ${rar.length} rarities`,
    dps: null,
    note: sample ? `top-rarity sample: ${JSON.stringify(sample).slice(0, 130)}` : 'could not sample',
  });
} catch (e) { unmeasured.push(['ARTIFACTS', e.message]); }

// ── 7. ATTACHMENTS ────────────────────────────────────────────────────────
try {
  const AT = await import('../src/game/attachments.js');
  const slots = AT.ATTACH_SLOTS || [];
  sources.push({
    name: 'ATTACHMENTS', how: `${slots.length} weapon slots`, dps: null,
    note: `slots: ${slots.join(', ')}`,
  });
} catch (e) { unmeasured.push(['ATTACHMENTS', e.message]); }

// ── 8. COMPANIONS / PETS ──────────────────────────────────────────────────
try {
  const C = await import('../src/game/companions.js');
  const list = C.COMPANIONS || [];
  sources.push({
    name: 'COMPANIONS', how: `${list.length} rescuable`, dps: null,
    note: list.slice(0, 4).map(c => c.name || c.id).join(', '),
  });
} catch (e) { unmeasured.push(['COMPANIONS', e.message]); }

// ── PRINT ─────────────────────────────────────────────────────────────────
let stackedDps = 1;
for (const s of sources) {
  console.log(`\n  ${s.name}   (${s.how})`);
  if (s.dps != null) { console.log(`    DPS multiplier: ${s.dps.toFixed(2)}x`); stackedDps *= s.dps; }
  console.log(`    ${s.note}`);
}

console.log(`\n  ${'-'.repeat(66)}`);
console.log(`  STACKED DPS from every source expressible as one number: ${stackedDps.toFixed(2)}x`);
console.log('  (talents, runes, artifacts and attachments are conditional or');
console.log('   per-item and are deliberately NOT folded into that figure)');

if (unmeasured.length) {
  console.log('\n  UNMEASURED — stated rather than silently skipped:');
  for (const [n, why] of unmeasured) console.log(`    ${n}: ${why}`);
}
