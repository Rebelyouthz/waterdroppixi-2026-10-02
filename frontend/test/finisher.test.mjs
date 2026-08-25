/* The finisher sequences actually RUN.
 *
 * Timmy's 2026-08-23 brief: a katana execution (thrust through -> blade drip
 * -> uppercut launch -> 60%-severed airborne spin -> a spin cut on the descent
 * that splits him somewhere NEW) and a Hydro Gun execution (jump -> kick him
 * over -> three downward shots taking 18/21/26% of the body -> land on him).
 *
 * Why this test exists rather than "it compiled":
 *
 * A finisher is a TIMED sequence, and the failure mode of a timed sequence is
 * silent. A beat whose `at` is past the sequence's own `dur` simply never
 * fires; a body released twice throws nothing; a spray loop guarded on a field
 * that is never set produces no blood and no error. None of that shows up in a
 * syntax check, and on screen it just looks like "the cool thing didn't
 * happen" — which is exactly the dead-config failure class this project keeps
 * paying for.
 *
 * So this drives the real `Game.prototype` methods against a stub `this`,
 * steps the clock, and asserts what came out. No canvas, no Pixi, no DOM.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const engineSrc = fs.readFileSync(path.join(ROOT, 'game', 'engine.js'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'game', 'pixiRenderer.js'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

const { Game } = await import('../src/game/engine.js');
const G = Game.prototype;

// ---- A stub `this` with just enough of a Game to run a sequence ----------
// Every spawn call is recorded rather than executed, so an assertion can ask
// "did the exit wound get sprayed on the FAR side" instead of "did it crash".
function makeStub() {
  const spawned = [];
  const calls = [];
  const parts = {
    acquire() {
      const p = { alive: true, type: null, x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 1, color: null };
      spawned.push(p);
      return p;
    },
    release(p) { p.alive = false; },
    forEach(fn) { for (const p of spawned) if (p.alive) fn(p); },
  };
  const rec = (name) => (...args) => calls.push({ name, args });
  return {
    spawned, calls, parts,
    time: 0,
    player: { x: 100, y: 100 },
    cam: { shake: 0, slowmo: 0 },
    run: { stats: {} },
    fin: null,
    _finCD: 0,
    spawnArterialCone: rec('arterial'),
    _cutFlash: rec('cutFlash'),
    spawnHitBurst: rec('hitBurst'),
    spawnRing: rec('ring'),
    pushBloodDecal: rec('decal'),
    // The real ones, under test.
    _finBody: G._finBody,
    _spawnBladeDrip: G._spawnBladeDrip,
    _spawnSpinArc: G._spawnSpinArc,
    _spawnFinPiece: G._spawnFinPiece,
    _spawnHydroSplat: G._spawnHydroSplat,
    _startKatanaFinisher: G._startKatanaFinisher,
    _startHydroFinisher: G._startHydroFinisher,
    updateFinisher: G.updateFinisher,
    tryFinisher: G.tryFinisher,
  };
}

const ENEMY = { x: 220, y: 100, alive: false };
const ETYPE = { size: 22, boss: false, color: '#57d96b' };

// Runs a whole sequence at a fixed step and reports what happened along the
// way. 60fps, because a beat that only fires on an unusually long frame is a
// beat that does not fire.
function runSequence(stub, dt = 1 / 60, maxT = 3) {
  const seen = { types: new Map(), maxZ: 0, sever: 0, eaten: 0, topple: 0, playerZ: 0 };
  let t = 0;
  while (t < maxT) {
    const body = stub.fin && stub.fin.body;
    if (body) {
      seen.maxZ = Math.max(seen.maxZ, body._z || 0);
      seen.sever = Math.max(seen.sever, body._sever || 0);
      seen.eaten = Math.max(seen.eaten, body._eaten || 0);
      seen.topple = Math.max(seen.topple, body._topple || 0);
    }
    seen.playerZ = Math.max(seen.playerZ, stub.player._finZ || 0);
    stub.updateFinisher(dt);
    t += dt;
    if (!stub.fin && t > 0.05) break;
  }
  for (const p of stub.spawned) {
    if (!p.type) continue;
    seen.types.set(p.type, (seen.types.get(p.type) || 0) + 1);
  }
  seen.t = t;
  return seen;
}

// ---- The katana execution ------------------------------------------------

check('katana finisher runs every beat and ends cleanly', () => {
  const s = makeStub();
  s._startKatanaFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const total = s.fin.beats.length;
  const dur = s.fin.dur;
  const late = s.fin.beats.filter(b => b.at > dur);
  if (late.length) return `${late.length} beat(s) scheduled after dur=${dur}s and can never fire`;
  runSequence(s);
  if (s.fin !== null) return 'sequence never released; this.fin is still set';
  if (s.player._finZ !== 0) return 'player left airborne after the sequence ended';
  // thrust, drip, drip, uppercut, leap+spin, second cut, land.
  if (total !== 7) return `expected 7 beats, found ${total}`;
  return null;
});

check('katana: the exit wound sprays on the FAR side of the body', () => {
  const s = makeStub();
  s._startKatanaFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  s.updateFinisher(1 / 60);            // fires beat 1
  const art = s.calls.find(c => c.name === 'arterial');
  if (!art) return 'no arterial cone on the thrust';
  const [ax] = art.args;
  // The player is at x=100 and the enemy at x=220, so the far side is > 220.
  if (!(ax > ENEMY.x)) return `exit wound at x=${ax.toFixed(1)}, not past the body at x=${ENEMY.x}`;
  return null;
});

check('katana: the uppercut launches him ~2.5 enemy heights', () => {
  const s = makeStub();
  s._startKatanaFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const seen = runSequence(s);
  // 2.5 heights = 5x size = 110px for a size-22 enemy. Allow real slack for
  // the discrete timestep, but a body that barely leaves the floor is a bug.
  const wanted = ETYPE.size * 5;
  if (seen.maxZ < wanted * 0.7) return `peaked at ${seen.maxZ.toFixed(0)}px, wanted about ${wanted}px`;
  if (seen.maxZ > wanted * 1.4) return `overshot to ${seen.maxZ.toFixed(0)}px, wanted about ${wanted}px`;
  return null;
});

check('katana: he is 60% severed while airborne, and sprays', () => {
  const s = makeStub();
  s._startKatanaFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const seen = runSequence(s);
  if (Math.abs(seen.sever - 0.6) > 0.001) return `sever reached ${seen.sever}, expected 0.6`;
  if (!seen.types.get('blood')) return 'no blood sprayed during the airborne spin';
  return null;
});

check('katana: the second cut splits him into TWO ragged pieces', () => {
  const s = makeStub();
  s._startKatanaFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const seen = runSequence(s);
  const pieces = seen.types.get('finPiece') || 0;
  if (pieces !== 2) return `expected 2 finPiece halves, got ${pieces}`;
  const halves = s.spawned.filter(p => p.type === 'finPiece');
  // Asymmetric on purpose — he was already 60% through, so a clean 50/50 would
  // be wrong.
  if (Math.abs(halves[0].size - halves[1].size) < 1) {
    return 'the two halves are the same size; they must be asymmetric';
  }
  // Each piece must remember where the FIRST cut ran, and the second cut must
  // be on a different line.
  for (const h of halves) {
    if (h._prevCut === undefined) return 'a piece lost the first cut angle';
    const delta = Math.abs((h._ang - h._prevCut) % (Math.PI * 2));
    if (delta < 0.6) return `second cut is only ${delta.toFixed(2)} rad off the first; it must not land in the same place`;
  }
  return null;
});

check('katana: blade drip and the spin arc both fire', () => {
  const s = makeStub();
  s._startKatanaFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const seen = runSequence(s);
  if (!seen.types.get('bladeDrip')) return 'the blade never dripped';
  if (!seen.types.get('spinArc')) return 'the 180/360 spin attack never drew';
  if (!(seen.playerZ > 20)) return `the player never left the ground (peak ${seen.playerZ})`;
  return null;
});

// ---- The Hydro Gun execution --------------------------------------------

check('hydro finisher runs every beat and ends cleanly', () => {
  const s = makeStub();
  s._startHydroFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const late = s.fin.beats.filter(b => b.at > s.fin.dur);
  if (late.length) return `${late.length} beat(s) scheduled after dur and can never fire`;
  runSequence(s);
  if (s.fin !== null) return 'sequence never released';
  if (s.player._finZ !== 0) return 'player left airborne';
  return null;
});

check('hydro: he kicks off, the enemy topples, and the player goes up', () => {
  const s = makeStub();
  s._startHydroFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const seen = runSequence(s);
  if (seen.topple !== 1) return 'the enemy was never knocked over';
  if (!(seen.playerZ >= 60)) return `the player only reached ${seen.playerZ}px; the kick should send him up`;
  return null;
});

check('hydro: three shots remove 65% of the body', () => {
  const s = makeStub();
  s._startHydroFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const seen = runSequence(s);
  // 18 + 21 + 26 = 65, his number.
  if (Math.abs(seen.eaten - 0.65) > 0.005) return `body removed reached ${(seen.eaten * 100).toFixed(0)}%, expected 65%`;
  return null;
});

check('hydro: he is STILL IN THE AIR for all three shots', () => {
  // The one that caught a real bug. `_finZ` used to decay exponentially toward
  // zero, so the 62px kick was down to ~16px by the first shot and he was
  // firing from the floor — not "snett ner fran luften" at all. Height is a
  // held target now, and this asserts it stays held.
  const s = makeStub();
  s._startHydroFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const dt = 1 / 60;
  const shotTimes = [0.46, 0.72, 0.98];
  const lows = [];
  let t = 0, next = 0;
  while (t < 1.2 && s.fin) {
    s.updateFinisher(dt);
    t += dt;
    if (next < shotTimes.length && t >= shotTimes[next]) {
      const z = s.player._finZ || 0;
      if (z < 40) lows.push(`shot ${next + 1} fired from ${z.toFixed(0)}px`);
      next++;
    }
  }
  if (next < shotTimes.length) return 'the sequence ended before all three shots';
  return lows.length ? `${lows.join('; ')} — he should still be airborne` : null;
});

check('hydro: chunks are projectile-sized, and blood is BLOOD_RED', () => {
  const s = makeStub();
  s._startHydroFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  runSequence(s);
  const chunks = s.spawned.filter(p => p.type === 'chunk');
  const blood = s.spawned.filter(p => p.type === 'blood');
  if (!chunks.length) return 'no body chunks came off';
  if (!blood.length) return 'no blood came off';
  // Projectile radius is 6, so a chunk lands in 0.55..1.15 of that.
  const bad = chunks.filter(c => c.size < 6 * 0.5 || c.size > 6 * 1.2);
  if (bad.length) return `${bad.length} chunk(s) are not projectile-sized`;
  // The standing colour rule: solids keep the enemy colour, liquid is red.
  if (chunks.some(c => c.color !== ETYPE.color)) return 'a solid chunk lost the enemy colour';
  if (blood.some(b => b.color === ETYPE.color)) return 'blood was drawn in the enemy colour instead of BLOOD_RED';
  return null;
});

check('hydro: the splatter is smeared into the ground at an angle', () => {
  const s = makeStub();
  s._startHydroFinisher(ENEMY, ETYPE, '#57d96b', 'gibs');
  const seen = runSequence(s);
  const smears = seen.types.get('groundSmear') || 0;
  if (smears < 9) return `only ${smears} ground smears; three shots plus the landing should leave more`;
  const sm = s.spawned.filter(p => p.type === 'groundSmear');
  if (sm.some(m => m._ang === undefined)) return 'a smear has no direction, so it cannot read as angled';
  return null;
});

// ---- MULTI-KILL NAMING: playtested, then cut back -----------------------

check('DOUBLE KILL is gone, and cannot come back', () => {
  // It shipped for exactly one playtest. Timmy, immediately: "double kill de
  // star hela tiden". With fifty enemies on screen two dying together is the
  // NORMAL case, so naming it made the praise meaningless and buried the rarer
  // calls under it.
  if (Game.MULTI_KILL.some(x => x && /DOUBLE/i.test(x))) {
    return 'DOUBLE KILL is back in MULTI_KILL';
  }
  if (Game.MULTI_KILL[2] !== null) return 'index 2 (two kills) must name nothing';
  if (Game.MULTI_KILL[3] !== 'TRIPLE KILL') return 'three kills should be TRIPLE KILL';
  return null;
});

check('TRIPLE is throttled to once per 10s, QUADRA and PENTA are not', () => {
  const s = makeStub();
  s.time = 0;
  s.run = { stats: {} };
  s.spawnDamageNumber = (...a) => s.calls.push({ name: 'text', args: a });
  s._registerKillForMultiKill = G._registerKillForMultiKill;
  const said = () => s.calls.filter(c => c.name === 'text').map(c => c.args[2]);

  const burst = (n, at) => {
    s.time = at;
    s._mkN = 0; s._mkShown = 0; s._mkAt = -99;
    for (let i = 0; i < n; i++) { s.time = at + i * 0.01; s._registerKillForMultiKill(); }
  };

  burst(3, 0);      // TRIPLE — allowed
  burst(3, 4);      // TRIPLE 4s later — must be swallowed
  if (said().filter(t => t === 'TRIPLE KILL').length !== 1) {
    return `TRIPLE fired ${said().filter(t => t === 'TRIPLE KILL').length} times inside 10s`;
  }
  burst(3, 11);     // past the cooldown — allowed again
  if (said().filter(t => t === 'TRIPLE KILL').length !== 2) return 'TRIPLE never came back after its cooldown';

  // Higher tiers are rare by nature. His call: "men hogre gar bra".
  s.calls.length = 0;
  burst(4, 12); burst(4, 12.5);
  if (said().filter(t => t === 'QUADRA KILL').length !== 2) return 'QUADRA was throttled; it should not be';
  return null;
});

check('two simultaneous kills say nothing at all', () => {
  const s = makeStub();
  s.time = 0;
  s.run = { stats: {} };
  s.spawnDamageNumber = (...a) => s.calls.push({ name: 'text', args: a });
  s._registerKillForMultiKill = G._registerKillForMultiKill;
  s._registerKillForMultiKill();
  s.time = 0.05;
  s._registerKillForMultiKill();
  const texts = s.calls.filter(c => c.name === 'text');
  return texts.length ? `two kills announced "${texts[0].args[2]}"` : null;
});

// ---- FLOURISHES: the signature moves a hot chain buys -------------------

function flourishStub(enemies) {
  const s = makeStub();
  s.enemies = {
    forEach(fn) { for (const e of enemies) fn(e); },
  };
  s.run = { stats: { _wid: 'katana', damageMult: 1 }, multiplier: 3 };
  s.flr = null;
  s._flrCD = 0;
  s.damaged = [];
  s.dealDamage = (e, dmg) => { s.damaged.push(e); s.calls.push({ name: 'dmg', args: [e, dmg] }); };
  s.rollDamage = (base) => ({ dmg: base, crit: false, critTier: 0 });
  s.spawnDamageNumber = (...a) => s.calls.push({ name: 'text', args: a });
  s.spawnHitBurst = (...a) => s.calls.push({ name: 'burst', args: a });
  s.maybeFlourish = G.maybeFlourish;
  s._startSpin360 = G._startSpin360;
  s._startDashThrough = G._startDashThrough;
  s._startLeapShot = G._startLeapShot;
  s.updateFlourish = G.updateFlourish;
  return s;
}

// A ring of enemies at known angles, deliberately handed over in a SCRAMBLED
// order so the "every other one around the circle" test cannot pass by accident.
function ringOf(n, r = 100) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI;
    out.push({ alive: true, hp: 999, maxHp: 999, _a: a,
      x: 100 + Math.cos(a) * r, y: 100 + Math.sin(a) * r,
      t: { size: 22, boss: false, color: '#57d96b', id: 'slime' } });
  }
  return [out[3], out[0], out[5], out[1], out[4], out[2]].filter(Boolean).concat(out.slice(6));
}

check('360 spin hits every OTHER enemy, ordered around the circle', () => {
  const ring = ringOf(8);
  const s = flourishStub(ring);
  s._startSpin360(true);
  if (!s.flr) return 'no flourish started';
  const beats = s.flr.beats.length;
  if (beats !== 4) return `expected 4 targets from 8 enemies, got ${beats}`;
  runSequence(s, 1 / 60, 1.5);
  return null;
});

function runFlourish(s, dt = 1 / 60, maxT = 1.6) {
  let t = 0, peakZ = 0;
  while (t < maxT && s.flr) {
    s.updateFlourish(dt);
    peakZ = Math.max(peakZ, s.player._finZ || 0);
    t += dt;
  }
  return { t, peakZ };
}

check('360 spin damages exactly its targets and then ends', () => {
  const s = flourishStub(ringOf(8));
  s._startSpin360(true);
  const total = s.flr.beats.length;
  runFlourish(s);
  if (s.flr !== null) return 'the spin never released';
  if (s.damaged.length !== total) return `damaged ${s.damaged.length} of ${total} chosen targets`;
  // Every OTHER one around the circle means chosen targets sit TWO steps
  // apart, not one. With 8 enemies a step is 2pi/8 = 0.785 rad, so the gap
  // must be about 1.57.
  //
  // The first version of this compared against 0.7 — below one step — which
  // made it vacuous: it stayed green even with the angular sort deleted, and a
  // fault-injection run proved it. The threshold has to sit BETWEEN one step
  // and two, or the assertion is decoration.
  const step = (Math.PI * 2) / 8;
  const angles = s.damaged.map(e => e._a).sort((a, b) => a - b);
  for (let i = 1; i < angles.length; i++) {
    if (angles[i] - angles[i - 1] < step * 1.5) {
      return 'two enemies one step apart were both hit; it is not every OTHER one around the circle';
    }
  }
  return null;
});

check('katana dash-through travels ACROSS the ground, never up', () => {
  // It replaced an air slam because a leap is nearly invisible from a top-down
  // camera. Timmy, after playing it: "nej hoppet ar inte bra alls". So this
  // asserts the move stays on the floor — a future "improvement" that adds
  // height back is a regression, not a polish.
  const target = { alive: true, hp: 999, maxHp: 999, x: 240, y: 100,
    t: { size: 22, boss: false, color: '#57d96b', id: 'slime' } };
  const s = flourishStub([target]);
  s.player.vx = 0; s.player.vy = 0;
  s._startDashThrough(target);
  const { peakZ } = runFlourish(s);
  if (s.flr !== null) return 'the dash never released';
  if (peakZ > 1) return `the player left the ground (${peakZ.toFixed(0)}px); this move must stay flat`;
  if (!s.damaged.includes(target)) return 'the dash never hit its target';
  // It has to actually MOVE him, or it is a stationary swing with a new name.
  if (Math.abs(s.player.vx) < 100) return `barely any forward momentum (vx=${s.player.vx.toFixed(0)})`;
  return null;
});

check('the dash-through cuts a CORRIDOR, not a circle', () => {
  const target = { alive: true, hp: 999, maxHp: 999, x: 200, y: 100,
    t: { size: 22, boss: false, color: '#57d96b', id: 'slime' } };
  // One enemy on the dash line, one the same distance away but off to the side.
  const onLine  = { alive: true, hp: 999, maxHp: 999, x: 220, y: 100,
    t: { size: 22, boss: false, color: '#57d96b', id: 'slime' } };
  const offLine = { alive: true, hp: 999, maxHp: 999, x: 120, y: 220,
    t: { size: 22, boss: false, color: '#57d96b', id: 'slime' } };
  const s = flourishStub([target, onLine, offLine]);
  s._startDashThrough(target);
  runFlourish(s);
  if (!s.damaged.includes(onLine)) return 'an enemy directly on the dash line was not cut';
  if (s.damaged.includes(offLine)) return 'an enemy off to the side was cut; this is a corridor, not an AoE';
  return null;
});

check('leap shot fires three rounds from above', () => {
  const target = { alive: true, hp: 999, maxHp: 999, x: 200, y: 100,
    t: { size: 22, boss: false, color: '#57d96b', id: 'slime' } };
  const s = flourishStub([target]);
  s._startLeapShot(target);
  const { peakZ } = runFlourish(s);
  if (s.flr !== null) return 'the leap never released';
  if (peakZ < 60) return `the player only reached ${peakZ.toFixed(0)}px`;
  const hits = s.damaged.filter(e => e === target).length;
  if (hits !== 3) return `fired ${hits} shots, expected 3`;
  return null;
});

check('a flourish never starts on top of a finisher, or itself', () => {
  const s = flourishStub(ringOf(8));
  s.fin = {};                       // an execution is running
  s.maybeFlourish();
  if (s.flr) return 'a flourish started during a finisher';
  s.fin = null;
  s.flr = {};                       // one is already running
  s.maybeFlourish();
  s.flr = null;
  s._flrCD = 5;                     // still on cooldown
  s.maybeFlourish();
  if (s.flr) return 'a flourish started while on cooldown';
  s._flrCD = 0;
  s.run.multiplier = 1;             // chain not hot enough
  for (let i = 0; i < 50; i++) s.maybeFlourish();
  if (s.flr) return 'a flourish started at multiplier 1';
  return null;
});

check('flourish beats all fire inside the sequence duration', () => {
  const s = flourishStub(ringOf(8));
  for (const start of [() => s._startSpin360(true)]) {
    s.flr = null; s._flrCD = 0; start();
    const late = s.flr.beats.filter(b => b.at > s.flr.dur);
    if (late.length) return `${late.length} beat(s) scheduled past dur and can never fire`;
  }
  return null;
});

// ---- Wiring: the parts that are easy to build and then never connect -----

check('the finisher is actually reachable from the kill path', () => {
  if (!/const _finTook = this\.tryFinisher\(/.test(engineSrc)) {
    return 'dealDamage never calls tryFinisher, so no kill can ever start one';
  }
  if (!/if \(!_finTook\) \{[\s\S]{0,120}spawnBrutalKill/.test(engineSrc)) {
    return 'the ordinary death FX are not suppressed; the enemy would die twice';
  }
  if (!/this\.updateFinisher\(dt\);/.test(engineSrc)) {
    return 'updateFinisher is never called from update(), so no beat would ever fire';
  }
  return null;
});

check('every finisher particle type has a renderer branch', () => {
  const missing = [];
  for (const t of ['finBody', 'finPiece', 'bladeDrip', 'spinArc', 'groundSmear']) {
    if (!engineSrc.includes(`'${t}'`)) missing.push(`${t} is never spawned`);
    if (!rendererSrc.includes(`p.type === '${t}'`)) missing.push(`${t} has no renderer branch and would draw as a default dot`);
  }
  return missing.length ? missing.join('; ') : null;
});

check('the player lift is visual only and never moves the hitbox', () => {
  if (!/const bx = p\.x \+ finOx/.test(rendererSrc) || !/const by = p\.y \+ finOy - finZ/.test(rendererSrc)) {
    return 'the renderer does not apply the finisher offsets, so the leap would not be visible';
  }
  // The engine must never write p.x/p.y from a finisher — that would desync
  // the hitbox, the aim and every dodge.
  const start = engineSrc.indexOf('tryFinisher(e, t, bloodColor, fx)');
  const body = engineSrc.slice(start, engineSrc.indexOf('\n  updateParts(', start));
  if (/\bp\.x\s*=[^=]/.test(body) || /\bp\.y\s*=[^=]/.test(body)) {
    return 'a finisher assigns the player position directly; it must only set _finOx/_finOy/_finZ';
  }
  return null;
});

console.log(`\nfinisher.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
