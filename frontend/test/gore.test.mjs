/* Gore colour contract + weapon-directed hit/kill juice.
 *
 * Standing rule (Timmy): liquid is always BLOOD_RED; chunks/organs/flesh
 * follow the enemy. The old dealDamage path still tinted blood with e.t.color
 * and spawnArterialCone used whatever colour the caller passed — both were
 * the "green enemy bleeds green" artifact. This drives the real prototype
 * methods against a stub `this`, same pattern as finisher.test.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const engineSrc = fs.readFileSync(path.join(ROOT, 'game', 'engine.js'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'game', 'pixiRenderer.js'), 'utf8');
const heroSrc = fs.readFileSync(path.join(ROOT, 'game', 'heroDraw.js'), 'utf8');
const dataExt2Src = fs.readFileSync(path.join(ROOT, 'game', 'data_ext2.js'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

const { Game } = await import('../src/game/engine.js');
const G = Game.prototype;
const RED = Game.BLOOD_RED;
const GREEN = '#57d96b';

function goreStub() {
  const spawned = [];
  const s = {
    spawned,
    time: 1,
    _fxScale: 1,
    bloodDecals: [],
    _screenGibs: [],
    _bladeBlood: 0,
    _near: [],
    _maxEnemyR: 20,
    enemyGrid: { query(_x, _y, _r, fn) { for (const e of s._near) fn(e); } },
    run: { stats: { _wlvl: 0, _wid: 'hydropistol', _behaviour: 'projectile' }, weaponLvls: {}, comboCount: 0 },
    cam: { shake: 0 },
    player: { x: 0, y: 0, aimX: 1, aimY: 0 },
    parts: {
      acquire() {
        const p = { alive: true, type: null, x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 1, color: null };
        spawned.push(p);
        return p;
      },
      release(p) { p.alive = false; },
      forEach(fn) { for (const p of spawned) if (p.alive) fn(p); },
    },
    pushBloodDecal(d) { this.bloodDecals.push(d); },
  };
  for (const k of [
    'fxCount', 'fxBlood', 'spawnArterialCone', 'spawnNeckSpray', 'spawnAerialSprout',
    'spawnSlashSplatter', 'spawnSideGush', 'spawnMistBurst', 'spawnFloorSplash',
    'spawnBloodDrips', 'spawnPunctureJet', 'spawnDynamicGore', 'spawnWoundBurst',
    'spawnBlood', 'spawnPunctureHit', '_goreMul', '_spawnHitGore', '_spatterNearby',
    '_spawnPartialCleave', '_spawnOrgans', '_spawnSkidSmear', '_spawnScreenGib',
    '_updateScreenGibs', '_dropViscera', '_accumulateBladeBlood', '_updateBladeBlood',
    '_doBladeWipe', '_spawnBladeDrip',
  ]) s[k] = G[k];
  return s;
}

function enemy(extra = {}) {
  return {
    alive: true, x: 50, y: 50, hp: 80, maxHp: 100,
    t: { color: GREEN, size: 18, id: 'grunt' },
    _marks: [], _wounds: [],
    ...extra,
  };
}

check('BLOOD_RED is the documented blood red, not a second copy', () => {
  if (RED !== '#b51d28') return `Game.BLOOD_RED is ${RED}`;
  return null;
});

check('dealDamage no longer tints liquid with the enemy colour', () => {
  if (engineSrc.includes('const bloodColor = e.t.color')) {
    return 'dealDamage still sets bloodColor = e.t.color — the green-bleed artifact is back';
  }
  if (/green enemy always bleeds green/.test(engineSrc)) {
    return 'stale "green enemy always bleeds green" comment is still in engine.js';
  }
  return null;
});

check('spawnArterialCone ignores a green colour argument', () => {
  const s = goreStub();
  s.spawnArterialCone(10, 10, 0.4, GREEN, 1);
  const liquid = s.spawned.filter(p => p.type === 'blood' || p.type === 'bloodCone');
  if (!liquid.length) return 'cone spawned no liquid';
  const bad = liquid.filter(p => p.color !== RED);
  if (bad.length) return `${bad.length} liquid particle(s) kept the passed ${GREEN}`;
  if (!s.spawned.some(p => p.type === 'bloodCone')) return 'no bloodCone fan came out';
  return null;
});

check('wound-burst chunks keep enemy colour; blood is red', () => {
  const s = goreStub();
  const e = enemy();
  s.spawnWoundBurst(e, 40, 50, 5, GREEN, '#6cb4ff');
  const chunks = s.spawned.filter(p => p.type === 'chunk');
  const blood = s.spawned.filter(p => p.type === 'blood');
  if (!chunks.length) return 'no flesh chunks';
  if (chunks.some(c => c.color !== GREEN)) return 'a chunk lost the enemy colour (or took the weapon accent)';
  if (!blood.length) return 'no blood from the peel';
  if (blood.some(b => b.color !== RED)) return 'wound blood was not BLOOD_RED';
  return null;
});

check('shotgun kill gore throws a V-cone; pistol throw is a jet, not the same burst', () => {
  const t = { color: GREEN, size: 22, id: 'grunt' };
  const e = enemy();
  const sg = goreStub();
  sg.spawnDynamicGore(e, t, GREEN, 'shotgunObliterate', 0.2, false);
  if (!sg.spawned.some(p => p.type === 'bloodCone')) return 'shotgun kill had no V-cone fan';
  if (sg.spawned.filter(p => p.type === 'organ').some(p => p.color !== GREEN)) {
    return 'a shotgun organ lost the enemy colour';
  }

  const pistol = goreStub();
  pistol.run.stats._behaviour = 'projectile';
  pistol._curWeaponBehaviour = 'projectile';
  pistol.spawnDynamicGore(e, t, GREEN, 'pierceKinetic', 0.2, false);
  if (pistol.spawned.some(p => p.color === GREEN && (p.type === 'blood' || p.type === 'bloodCone'))) {
    return 'pistol blood was enemy-coloured';
  }
  const pistolJets = pistol.spawned.filter(p => p.type === 'blood' && Math.hypot(p.vx, p.vy) > 300);
  if (!pistolJets.length) return 'pistol kill had no puncture jet';
  return null;
});

check('melee hit is a slash, shotgun first hit opens a cone — they are not the same', () => {
  const melee = goreStub();
  melee._curWeaponBehaviour = 'melee';
  melee.run.stats._wid = 'katana';
  melee.run.stats._behaviour = 'melee';
  melee._spawnHitGore(enemy(), 50, 50, 22, false, 1, 0);
  if (melee.spawned.some(p => p.type === 'bloodCone')) {
    return 'a melee nick spawned a gunshot V-cone';
  }
  if (!melee.spawned.some(p => p.type === 'blood')) return 'melee hit spawned no slash blood';

  const sg = goreStub();
  sg._curWeaponBehaviour = 'shotgun';
  sg.run.stats._behaviour = 'shotgun';
  sg._spawnHitGore(enemy(), 50, 50, 22, false, 1, 0);
  if (!sg.spawned.some(p => p.type === 'bloodCone')) return 'shotgun first hit did not blast a cone';
  return null;
});

check('spatter lands on a nearby enemy as red marks, not their own colour', () => {
  const s = goreStub();
  const src = enemy();
  const other = { alive: true, x: 58, y: 50, t: { color: '#4dc4ff', size: 16 }, _marks: [] };
  s._near = [other];
  let marked = false;
  for (let i = 0; i < 40; i++) {
    other._marks = [];
    s._spatterNearby(src, 50, 50, 2);
    if (other._marks.some(m => m.kind === 'spatter')) { marked = true; break; }
  }
  if (!marked) return 'nearby enemy never received a spatter mark';
  return null;
});

check('weapon level scales gore power, and shotgun grows extra cones', () => {
  const t = { color: GREEN, size: 22, id: 'grunt' };
  const low = goreStub();
  low.run.stats._wlvl = 0;
  if (Math.abs(low._goreMul() - 1) > 0.001) return `_goreMul at lvl 0 is ${low._goreMul()}, not 1`;
  low.spawnDynamicGore(enemy(), t, GREEN, 'shotgunObliterate', 0, false);
  const cones0 = low.spawned.filter(p => p.type === 'bloodCone').length;

  const hi = goreStub();
  hi.run.stats._wlvl = 5;
  if (!(hi._goreMul() > 1.7)) return `_goreMul at lvl 5 is ${hi._goreMul()}, expected ~1.8`;
  hi.spawnDynamicGore(enemy(), t, GREEN, 'shotgunObliterate', 0, false);
  const cones5 = hi.spawned.filter(p => p.type === 'bloodCone').length;
  if (!(cones5 > cones0)) return `shotgun cones did not grow with level (${cones0} → ${cones5})`;
  return null;
});

check('organs follow flesh colour, never BLOOD_RED', () => {
  const s = goreStub();
  s._spawnOrgans(0, 0, GREEN, 20, 4);
  const organs = s.spawned.filter(p => p.type === 'organ');
  if (!organs.length) return 'no organs spawned';
  if (organs.some(o => o.color !== GREEN)) return 'an organ was not the enemy colour';
  if (!organs.some(o => o._kind === 'eye') || !organs.some(o => o._kind === 'gut')) {
    return 'organs are not identifiable (missing eye/gut kinds)';
  }
  return null;
});

check('screen gibs cap at 3 and sit on the edges', () => {
  const s = goreStub();
  for (let i = 0; i < 8; i++) s._spawnScreenGib(GREEN, 'chunk');
  if (s._screenGibs.length !== 3) return `cap failed: ${s._screenGibs.length} gibs`;
  if (s._screenGibs.some(g => g.x > 0.22 && g.x < 0.78)) {
    return 'a screen gib spawned in the middle of the fight';
  }
  return null;
});

check('renderer draws organ, spatter, and screen gibs — a missing branch is a silent default-dot', () => {
  const missing = [];
  if (!rendererSrc.includes("p.type === 'organ'")) missing.push('organ');
  if (!rendererSrc.includes("m.kind === 'spatter'")) missing.push('spatter marks');
  if (!rendererSrc.includes('_screenGibs')) missing.push('screen gibs');
  if (!rendererSrc.includes('_gutTrail')) missing.push('viscera trail');
  return missing.length ? missing.join(', ') + ' has no renderer branch' : null;
});

check('the blade actually accumulates blood, and heroDraw paints it', () => {
  if (!heroSrc.includes("model.kind === 'katana'") || !heroSrc.includes('_bladeBlood')) {
    return 'heroDraw does not paint blood on the camp-rib / katana';
  }
  if (!rendererSrc.includes("kind: 'katana'")) return 'katana model has no kind, so the blood overlay never matches';
  const s = goreStub();
  s.run.stats._wid = 'katana';
  s._accumulateBladeBlood(0.4);
  if (!(s._bladeBlood > 0.3)) return 'blade blood did not accumulate';
  s._doBladeWipe();
  if (!(s._bladeBlood < 0.2)) return 'a wipe did not throw blood off the blade';
  return null;
});

check('spawnBlood is a spray of small drops, not a stack of fat ones', () => {
  if (!/spawnBlood[\s\S]{0,500}fxBlood\(/.test(engineSrc)) {
    return 'spawnBlood still budgets through fxCount / PARTICLE_TRIM';
  }
  const s = goreStub();
  s.spawnBlood(40, 50);
  const blood = s.spawned.filter(p => p.type === 'blood');
  if (blood.length < 12) return `only ${blood.length} drops`;
  const span = Math.max(...blood.map(p => p.x)) - Math.min(...blood.map(p => p.x));
  if (span < 4) return `drops stacked on one x (span ${span})`;
  const mist = blood.filter(p => p.size < 1.0).length;
  if (mist < blood.length * 0.45) return `too few mist-sized drops (${mist}/${blood.length})`;
  return null;
});

check('KILL_FX.melee is bisect, so a blade kill is not a generic gib puff', () => {
  if (!/melee:\s*'bisect'/.test(dataExt2Src)) return 'KILL_FX has no melee → bisect entry';
  return null;
});

console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('FAIL', f);
  process.exit(1);
}
