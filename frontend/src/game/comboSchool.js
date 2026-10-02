// =============================================
// COMBO SCHOOL — large skippable nodes, Combo Points
// =============================================
// Timmy 2026-09-21: combos sit in the talent tree as LARGE nodes. They cost
// Combo Points (not TP), you can walk PAST them (they never gate a talent
// step), and buying one unlocks that string in the school strip. First is
// the weakest, then they climb. Points come from story finales, minigames,
// and THE DRAIN after the first pipe.
//
// This is NOT a 46th talent. talents.test still locks TALENTS at 45. Combo
// node ids must not start with t_ (meleeCombo.test). The engine reads
// formLH / formHL / formLLL / formLLH off the same flags bag as talents.
// Light (TEAR) and Heavy (GIRDER) always swing — locking those behind a
// minigame would brick melee until the first Combo Point.

import { RIB_FORMS } from './meleeCombo';

const COST = [1, 2, 3, 4, 5, 6];
const STEPS = [2, 5, 8, 11, 13, 15];
const ICONS = ['pSharp', 'ui_blade', 'pRush', 'pShield', 'pWhirl', 'pStarBurst'];

export const COMBO_NODES = RIB_FORMS.map((f, i) => ({
  id: 'rib_' + f.id,
  formId: f.id,
  seq: f.seq,
  name: f.name,
  desc: f.desc,
  hint: f.hint,
  needs: f.needs,
  needsName: f.needsName,
  cost: COST[i],
  step: STEPS[i],
  icon: ICONS[i],
}));

export const COMBO_INDEX = COMBO_NODES.reduce((m, n) => { m[n.id] = n; return m; }, {});
export const COMBO_TOTAL_COST = COMBO_NODES.reduce((a, n) => a + n.cost, 0);

export const COMBO_POINT_SOURCES = [
  { id: 'story_pond_3',    amount: 1, where: 'Story — The Overflow',
    check: (s) => !!(s.mapProgress || {}).pond_3 },
  { id: 'story_lake_3',    amount: 1, where: 'Story — The Abyss',
    check: (s) => !!(s.mapProgress || {}).lake_3 },
  { id: 'story_ruins_3',   amount: 1, where: 'Story — Throne Room',
    check: (s) => !!(s.mapProgress || {}).ruins_3 },
  { id: 'story_gobekli_3', amount: 1, where: 'Story — Primordial Megalith',
    check: (s) => !!(s.mapProgress || {}).gobekli_3 },
  { id: 'story_void_3',    amount: 1, where: 'Story — Void Heart',
    check: (s) => !!(s.mapProgress || {}).void_3 },
  { id: 'story_ship_3',    amount: 1, where: 'Story — Core Override',
    check: (s) => !!(s.mapProgress || {}).ship_3 },
  { id: 'story_sky_3',     amount: 1, where: 'Story — Eye of Thunder',
    check: (s) => !!(s.mapProgress || {}).sky_3 },
  { id: 'story_deep_3',    amount: 1, where: 'Story — The Last Current',
    check: (s) => !!(s.mapProgress || {}).deep_3 },
  { id: 'drain_map1',      amount: 1, where: 'THE DRAIN — first pipe',
    check: (s) => (s.drainBestDepth || 0) >= 1 },
  { id: 'drain_bottom',    amount: 1, where: 'THE DRAIN — the bottom',
    check: (s) => (s.drainBestDepth || 0) >= 3 },
  { id: 'well_drops',      amount: 1, where: 'THE WELL — 10,000 drops',
    check: (s) => (s.clicker?.total || 0) >= 10000 },
  { id: 'well_prestige',   amount: 1, where: 'THE WELL — first prestige',
    check: (s) => (s.clicker?.prestiges || 0) >= 1 },
  { id: 'defence_w5',      amount: 1, where: 'Base Defence — hold wave 5',
    check: (s) => (s.defenceBest || 0) >= 5 },
  { id: 'defence_w12',     amount: 1, where: 'Base Defence — hold wave 12',
    check: (s) => (s.defenceBest || 0) >= 12 },
  { id: 'raid_stage1',     amount: 1, where: 'Star Atlas — Debris Field',
    check: (s) => (s.starRaid?.stageUnlocked || 0) >= 1 },
  { id: 'raid_stage3',     amount: 1, where: 'Star Atlas — The Deep Void',
    check: (s) => (s.starRaid?.stageUnlocked || 0) >= 3 },
  { id: 'tcg_win1',        amount: 1, where: 'Pet TCG — first win',
    check: (s) => (s.tcgWins || 0) >= 1 },
  { id: 'tcg_win5',        amount: 1, where: 'Pet TCG — 5 wins',
    check: (s) => (s.tcgWins || 0) >= 5 },
  { id: 'explore_1',       amount: 1, where: 'Exploration — finish a walk',
    check: (s) => (s.exploreClears || 0) >= 1 },
  { id: 'probe_1',         amount: 1, where: 'Lootmine — bank a dive',
    check: (s) => (s.prospectorDives || 0) >= 1 },
  { id: 'probe_5',         amount: 1, where: 'Lootmine — 5 dives banked',
    check: (s) => (s.prospectorDives || 0) >= 5 },
];

export const COMBO_POINT_SUPPLY = COMBO_POINT_SOURCES.reduce((a, s) => a + s.amount, 0);

export function comboFormOwned(save, formId) {
  return !!(save?.comboForms || {})[formId];
}

export function comboNodeOwned(save, node) {
  return comboFormOwned(save, node.formId);
}

export function isComboAvailable(save, node) {
  if (!node || comboNodeOwned(save, node)) return false;
  const idx = COMBO_NODES.findIndex(n => n.id === node.id);
  if (idx <= 0) return true;
  return comboNodeOwned(save, COMBO_NODES[idx - 1]);
}

export function canBuyCombo(save, node) {
  return isComboAvailable(save, node) && (save.comboPoints || 0) >= node.cost;
}

export function buyComboNode(save, nodeId) {
  const node = COMBO_INDEX[nodeId];
  if (!node || !canBuyCombo(save, node)) return save;
  return {
    ...save,
    comboPoints: (save.comboPoints || 0) - node.cost,
    comboForms: { ...(save.comboForms || {}), [node.formId]: true },
  };
}

export function comboCeremonyOf(node) {
  if (!node) return null;
  return {
    type: 'move',
    id: node.id,
    name: node.name,
    icon: node.icon,
    sub: node.seq + ' STRING',
    how: node.desc,
  };
}

// Same flags bag the engine already reads. L/H are never flagged — they
// always resolve in ribStyle so melee cannot brick on a missing Combo Point.
export function buildComboFormFlags(save) {
  const forms = save?.comboForms || {};
  return {
    formLH: !!forms.LH,
    formHL: !!forms.HL,
    formLLL: !!forms.LLL,
    formLLH: !!forms.LLH,
  };
}

export function applyComboPointSources(save) {
  if (!save) return { save, newly: [] };
  const sources = { ...(save.comboPointSources || {}) };
  let pts = save.comboPoints || 0;
  const newly = [];
  for (const src of COMBO_POINT_SOURCES) {
    if (sources[src.id]) continue;
    if (!src.check(save)) continue;
    sources[src.id] = true;
    pts += src.amount;
    newly.push(src);
  }
  if (!newly.length) return { save, newly };
  return {
    save: { ...save, comboPointSources: sources, comboPoints: pts },
    newly,
  };
}

export function comboNodeAtStep(step) {
  return COMBO_NODES.find(n => n.step === step) || null;
}
