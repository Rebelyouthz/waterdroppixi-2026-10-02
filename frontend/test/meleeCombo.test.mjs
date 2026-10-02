/* Snapped Rib light/heavy strings. Injected faults: ungated Cyclone,
 * missing Tear fallback, gamepad steal left in engine. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ribStyle, pushRibHit, tickRibCombo, wantsAttack, RIB_FORMS, bumpHoldString, applyHoldString } from '../src/game/meleeCombo.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const engineSrc = fs.readFileSync(path.join(ROOT, 'game', 'engine.js'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, fn) => {
  try { const why = fn(); if (why) fails.push(`${name}\n    ${why}`); else pass++; }
  catch (e) { fails.push(`${name}\n    threw: ${e.message}`); }
};

check('six taught forms, none of them buyable talent ids', () => {
  if (RIB_FORMS.length !== 6) return `expected 6 forms, got ${RIB_FORMS.length}`;
  if (RIB_FORMS.some(f => String(f.id).startsWith('t_'))) return 'forms look like talent ids';
});

check('base strings always resolve; Hook and Riposte stay gated', () => {
  if (ribStyle('L').key !== 'L') return 'L is not Tear';
  if (ribStyle('H').key !== 'H') return 'H is not Girder';
  if (ribStyle('LH').key !== 'H') return 'ungated LH should smash, not Hook';
  if (ribStyle('HL').key !== 'L') return 'ungated HL should snap to Tear';
  if (ribStyle('LH', { formLH: true }).key !== 'LH') return 'Hook needs the school node';
  if (ribStyle('HL', { formHL: true }).key !== 'HL') return 'Riposte needs the school node';
});

check('Cyclone and Rise stay gated', () => {
  if (ribStyle('LLL').key !== 'L') return 'ungated LLL should fall back to Tear';
  if (ribStyle('LLH').key !== 'H') return 'ungated LLH should fall back to Girder';
  if (ribStyle('LLL', { comboHaste: true }).key !== 'L') return 'Blur alone must not open Cyclone';
  if (ribStyle('LLH', { comboDmg: true }).key !== 'H') return 'Chain Reaction alone must not open Rise';
  if (ribStyle('LLL', { comboHaste: true, formLLL: true }).key !== 'LLL') return 'Blur + school node should open Cyclone';
  if (ribStyle('LLH', { comboDmg: true, formLLH: true }).key !== 'LLH') return 'Chain Reaction + school node should open Rise';
});

check('window decays and linger lengthens with comboDecay', () => {
  const p = {};
  pushRibHit(p, false, {});
  if (p._ribSeq.join('') !== 'L') return 'first hit is not L';
  if (p._ribSeqT < 0.4) return 'default window too short';
  tickRibCombo(p, 1);
  if ((p._ribSeq || []).length) return 'expired window did not clear';
  pushRibHit(p, true, { comboDecay: 0.7 });
  if (p._ribSeqT < 0.6) return 'Linger did not lengthen';
});

check('wantsAttack reads light or heavy', () => {
  if (wantsAttack({ shooting: false, heavy: false })) return 'idle should not attack';
  if (!wantsAttack({ shooting: true, heavy: false })) return 'light should attack';
  if (!wantsAttack({ shooting: false, heavy: true })) return 'heavy should attack';
});

check('hold string cycles 4 and scales with pinball combo', () => {
  const p = {};
  if (bumpHoldString(p) !== 1) return 'first hold is not 1';
  bumpHoldString(p); bumpHoldString(p);
  if (bumpHoldString(p) !== 4) return 'fourth hold is not 4';
  if (bumpHoldString(p) !== 1) return 'hold string did not wrap';
  const base = ribStyle('L');
  p._ribHoldN = 4;
  const boosted = applyHoldString(p, base, 20);
  if (boosted.dmg <= base.dmg) return 'hold+combo did not hit harder';
  if (boosted.cd >= base.cd) return 'hold+combo did not swing faster';
});

check('engine no longer lets an idle pad kill mouse fire', () => {
  if (/this\.input\.shooting = rt > 0\.4 \|\| rb;/.test(engineSrc)) {
    return 'gamepad still writes shooting unconditionally';
  }
  if (!/from '\.\/meleeCombo'/.test(engineSrc)) return 'engine does not import meleeCombo';
});

if (fails.length) {
  console.error(`meleeCombo.test FAIL ${fails.length}  pass ${pass}\n` + fails.map(f => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log(`meleeCombo.test ok  ${pass} checks`);
