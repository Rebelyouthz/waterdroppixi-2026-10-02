// SNAPPED RIB — light / heavy strings.
//
// Hades attack+special, Dead Cells brutality, DMC light/heavy. The rib is
// not a katana: it is a torn station girder, so the strings are weighty
// rather than sword-kata. Taught in the Talents COMBOS column (RIB_FORMS),
// not sold as extra nodes — talents.test locks the tree at 45.
//
// Light and Heavy always work — they are the two swings you have before any
// Combo Point. HOOK / RIPOSTE / CYCLONE / RISE need their school node
// (formLH / formHL / formLLL / formLLH). Cyclone and Rise still also need
// Blur / Chain Reaction. Taught as large skippable nodes in Talents.

export const RIB_FORMS = [
  { id: 'L',   seq: 'L',   name: 'TEAR',    desc: 'Light. Fast torn-edge cut.', hint: 'LMB / RT / right stick' },
  { id: 'H',   seq: 'H',   name: 'GIRDER',  desc: 'Heavy. Slow smash, big knockback.', hint: 'RMB / Triangle / HEAVY stick' },
  { id: 'LH',  seq: 'LH',  name: 'HOOK',    desc: 'Light into a committed smash.', hint: 'L then H' },
  { id: 'HL',  seq: 'HL',  name: 'RIPOSTE', desc: 'Heavy then a snap cut.', hint: 'H then L' },
  { id: 'LLL', seq: 'LLL', name: 'CYCLONE', desc: 'Third light spins if you own Blur.', hint: 'L L L', needs: 'comboHaste', needsName: 'Blur' },
  { id: 'LLH', seq: 'LLH', name: 'RISE',    desc: 'Two lights then heavy launches if you own Chain Reaction.', hint: 'L L H', needs: 'comboDmg', needsName: 'Chain Reaction' },
];

const STYLES = {
  L:   { dmg: 1.10, reach: 1.00, span: 1.22, life: 0.16, th: 0.24, knock: 1.08, cd: 0.82, step: 96,  swing: 0.22, lean: 1.08 },
  H:   { dmg: 1.70, reach: 1.18, span: 1.58, life: 0.26, th: 0.36, knock: 1.62, cd: 1.48, step: 148, swing: 0.32, lean: 1.42 },
  LH:  { dmg: 1.48, reach: 1.12, span: 1.42, life: 0.26, th: 0.30, knock: 1.40, cd: 1.35, step: 120, swing: 0.32, lean: 1.22 },
  HL:  { dmg: 1.18, reach: 0.96, span: 0.95, life: 0.16, th: 0.18, knock: 0.85, cd: 0.72, step: 70,  swing: 0.20, lean: 0.90 },
  LLL: { dmg: 1.28, reach: 1.22, span: 5.80, life: 0.36, th: 0.28, knock: 1.10, cd: 1.20, step: 40,  swing: 0.40, lean: 1.40 },
  LLH: { dmg: 1.70, reach: 1.08, span: 1.35, life: 0.28, th: 0.32, knock: 1.20, cd: 1.50, step: 160, swing: 0.34, lean: 1.50, launch: true },
};

export function tickRibCombo(p, dt) {
  p._ribSeqT = Math.max(0, (p._ribSeqT || 0) - dt);
  if (p._ribSeqT <= 0) p._ribSeq = [];
}

export function pushRibHit(p, heavy, flags = {}) {
  if (!p._ribSeq) p._ribSeq = [];
  p._ribSeq.push(heavy ? 'H' : 'L');
  if (p._ribSeq.length > 3) p._ribSeq = p._ribSeq.slice(-3);
  const linger = (flags.comboDecay && flags.comboDecay < 1) ? 0.64 : 0.46;
  p._ribSeqT = linger;
  return p._ribSeq.join('');
}

export function ribStyle(seq, flags = {}) {
  let key = seq;
  if (key === 'LH' && !flags.formLH) key = 'H';
  if (key === 'HL' && !flags.formHL) key = 'L';
  if (key === 'LLL' && !(flags.comboHaste && flags.formLLL)) key = 'L';
  if (key === 'LLH' && !(flags.comboDmg && flags.formLLH)) key = 'H';
  if (key === 'LL') key = 'L';
  if (key === 'HH' || key === 'HHH') key = 'H';
  if (key === 'LHL') key = flags.formHL ? 'HL' : 'L';
  return { key, ...(STYLES[key] || STYLES.L) };
}

export function wantsAttack(input) {
  return !!(input && (input.shooting || input.heavy));
}

// Hold-to-swing: a 3–4 hit string that snappier than tap-fire, and scales
// with the pinball combo the way the first week of this weapon felt.
export function bumpHoldString(p) {
  p._ribHoldN = ((p._ribHoldN || 0) % 4) + 1;
  p._ribHoldT = 0;
  return p._ribHoldN;
}

export function tickHoldString(p, attacking, dt) {
  if (attacking) {
    p._ribHoldT = 0;
    return;
  }
  p._ribHoldT = (p._ribHoldT || 0) + dt;
  if (p._ribHoldT > 0.32) {
    p._ribHoldN = 0;
    p._ribHoldT = 0;
  }
}

export function applyHoldString(p, form, comboCount = 0) {
  const n = Math.min(4, Math.max(1, p._ribHoldN || 1));
  const pin = Math.min(24, comboCount || 0);
  const chain = 1 + (n - 1) * 0.16;
  const pinMul = 1 + pin * 0.018;
  return {
    ...form,
    dmg: form.dmg * chain * pinMul,
    cd: Math.max(0.52, form.cd * (1 - (n - 1) * 0.11 - pin * 0.008)),
    lean: form.lean * (1 + (n - 1) * 0.12),
    swing: Math.max(0.14, (form.swing || 0.22) * (1 - (n - 1) * 0.08)),
    step: form.step * (1 + (n - 1) * 0.08),
    holdN: n,
  };
}
