// Rough forward-simulation of the reworked curve, to check the two design
// targets: run level 5-7 when the first guardian arrives, and a 25-45s
// guardian fight. Deliberately crude — it models kill throughput, not
// positioning — but it is the difference between "the numbers look right"
// and "the numbers are right".

const WAVE = [
  { t: 0, spawn: 1.5, types: ['slime'] },
  { t: 18, spawn: 1.9, types: ['slime', 'bat'] },
  { t: 40, spawn: 2.2, types: ['slime', 'bat', 'ghoul'] },
  { t: 68, spawn: 2.5, types: ['bat', 'ghoul', 'ranger'] },
  { t: 95, spawn: 2.8, types: ['ghoul', 'ranger', 'brute'] },
  { t: 122, spawn: 3.0, types: ['ghoul', 'ranger', 'brute', 'charger'] },
  { t: 150, spawn: 3.1, types: ['ghoul', 'ranger', 'brute', 'charger'] },
];
const E = {
  slime:   { hp: 52,  xp: 2 },
  bat:     { hp: 28,  xp: 2 },
  ghoul:   { hp: 80,  xp: 3 },
  ranger:  { hp: 66,  xp: 4 },
  brute:   { hp: 137, xp: 6 },
  charger: { hp: 68,  xp: 5 },
};
const waveAt = (t) => { let c = WAVE[0]; for (const w of WAVE) if (w.t <= t) c = w; return c; };

// Player DPS model. Hydro pistol is 18 dmg x 4/s = 72 base. Each run level
// contributes via cards: assume the player takes a mix and lands ~+18%
// effective DPS per level compounding, plus a second weapon at level 4 and a
// third at 8 (the new runWeaponCap schedule).
function dps(level) {
  let d = 72 * Math.pow(1.18, level - 1);
  if (level >= 4) d *= 1.55;   // 2nd weapon
  if (level >= 8) d *= 1.35;   // 3rd weapon
  return d;
}
// Fraction of spawned enemies the player actually kills. Low early (you are
// outnumbered and weak), rising as the build comes online.
const killEff = (level) => Math.min(0.92, 0.42 + level * 0.05);

function xpToNextAt(level) {
  let n = 20;
  for (let l = 1; l < level; l++) {
    const g = l < 10 ? 1.46 : l < 20 ? 1.24 : 1.16;
    n = Math.floor(n * g + 8);
  }
  return n;
}

let t = 0, level = 1, xp = 0, spawnedTotal = 0, killedTotal = 0;
const dt = 0.5;
const marks = [];
while (t < 150) {
  const w = waveAt(t);
  const levelDensity = Math.min(1.6, 1 + (level - 1) * 0.018);
  const spawned = w.spawn * levelDensity * dt;
  spawnedTotal += spawned;
  // average enemy of the current mix
  const avgXp = w.types.reduce((a, k) => a + E[k].xp, 0) / w.types.length;
  const killed = spawned * killEff(level);
  killedTotal += killed;
  xp += killed * avgXp;
  while (xp >= xpToNextAt(level)) { xp -= xpToNextAt(level); level++; }
  t += dt;
  if (Math.abs(t % 30) < 1e-9) marks.push({ t, level, dps: Math.round(dps(level)) });
}

console.log('--- opening 150s (up to first guardian) ---');
for (const m of marks) console.log(`t=${String(m.t).padStart(3)}s  level ${m.level}  ~${m.dps} dps`);
console.log(`\nAt the guardian (t=150): level ${level}, ~${Math.round(dps(level))} dps`);
console.log(`spawned ${Math.round(spawnedTotal)}, killed ${Math.round(killedTotal)}`);

// Guardian fight length. bossOcular base 2400.
const menace = Math.min(2.2, 1 + (level - 1) * 0.055);
for (const [name, mult] of [['Normal', 1], ['Hard', 2.6], ['Nightmare', 6.2]]) {
  const hp = 2400 * 2.6 * (1 + 150 / 600) * 1 * menace * mult;
  console.log(`\n${name}: guardian HP ${Math.round(hp)} -> ${(hp / dps(level)).toFixed(1)}s at current dps`);
}
