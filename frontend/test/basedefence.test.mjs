/* Base Defence payout and wiring guards.
 *
 * Injected faults: goldForWavesHeld(2) collapsing to waveReward(2) only;
 * sellRefund returning the full spend; HangarRoom loop restarting on select
 * used to live as `}, [selected])` — that check must stay red if it returns.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TOWERS, waveReward, goldForWavesHeld, sellRefund, spentOnTower, defenceBuff, wavePreview,
  pickFirst, applyCoolantDump,
} from '../src/game/basedefence.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const screen = fs.readFileSync(path.join(ROOT, 'components', 'BaseDefenceScreen.jsx'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const code = strip(screen);

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

check('holding two waves pays both, not only the last', () => {
  const a = goldForWavesHeld(2);
  const one = waveReward(2).gold;
  if (a <= one) return `goldForWavesHeld(2)=${a} collapsed to last-wave ${one}`;
  if (a !== waveReward(1).gold + waveReward(2).gold) return `sum drifted: ${a}`;
  if (goldForWavesHeld(0) !== 0) return 'zero waves paid gold';
  return null;
});

check('sell refunds half of what was spent on the tower', () => {
  const def = TOWERS.spitter;
  const spent = spentOnTower(def, 2);
  const back = sellRefund(def, 2);
  if (back !== Math.floor(spent * 0.5)) return `refund ${back} != half of ${spent}`;
  if (back >= spent) return 'sell is not a sink';
  return null;
});

check('defence buff needs three waves before it is worth carrying', () => {
  if (defenceBuff(0) || defenceBuff(2)) return 'buff fired before 3 waves';
  if (!defenceBuff(3) || defenceBuff(3).dmg !== 0.05) return 'tier 1 at 3 waves is wrong';
  return null;
});

check('the sim loop does not restart when a tower is selected', () => {
  if (/\}, \[selected\]\)/.test(code)) {
    return 'useEffect still lists [selected] — picking a tower remounts the RAF loop';
  }
  if (!/selectedRef/.test(code)) return 'selected is not mirrored into a ref for the draw pass';
  return null;
});

check('canvas is not resized every frame', () => {
  if (/cv\.width\s*=\s*cv\.clientWidth/.test(code)) {
    return 'assigning canvas.width every frame wipes the GPU buffer';
  }
  if (!/devicePixelRatio/.test(code)) return 'no dpr backing store — blurry on phone';
  return null;
});

check('Bram stands on the field when rescued, not only as a caption', () => {
  if (!/bramHome/.test(code)) return 'rescued Bram never reaches reset()';
  if (!/hero:\s*true/.test(code)) return 'no hero tower is spawned for Bram';
  if (!/drawBram/.test(code)) return 'Bram has no draw';
  return null;
});

check('TAKE THE BUFF fires ClaimFx', () => {
  if (!/fireClaimFx/.test(screen)) return 'defence payout is silent';
  return null;
});

check('towers shoot the leak, not the nearest swarm', () => {
  const laneY = () => 0;
  const foes = [
    { x: 180, lane: 0, hp: 10 },
    { x: 40, lane: 0, hp: 80 },
  ];
  const hit = pickFirst(foes, 200, 0, 200, laneY);
  if (!hit || hit.x !== 40) return `picked x=${hit && hit.x} instead of the leak at 40`;
  return null;
});

check('coolant dump hits every foe on the field', () => {
  const foes = [{ hp: 40, slow: 0 }, { hp: 40, slow: 0 }];
  const n = applyCoolantDump(foes, 10, 1);
  if (n !== 2) return `hit ${n} foes`;
  if (foes[0].hp !== 30 || foes[1].hp !== 30) return 'dump did not apply damage to all';
  if (foes[0].slow < 1) return 'dump did not slow';
  return null;
});

check('AGAIN does not wipe an unclaimed payout', () => {
  if (!/bankRef/.test(code)) return 'no bankRef — AGAIN after over used to reset gold before TAKE';
  return null;
});

check('Kingdom Rush spells exist as dump + vent, not a targeting menu', () => {
  if (!/DUMP COOLANT/.test(screen) || !/VENT BLOCK/.test(screen)) return 'player spells are missing';
  if (!/pickFirst/.test(code)) return 'towers still pick closest';
  return null;
});

check('wave preview is counted from buildWave, not a second table', () => {
  const p = wavePreview(1);
  if (!p.grunt) return 'wave 1 has no grunts';
  if (p.brute) return 'wave 1 spawned a brute the sim does not';
  return null;
});

console.log(`\nbasedefence.test.mjs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.error(`  FAIL ${f}`); process.exit(1); }
