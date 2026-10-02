// MUTATIONS — THE DRAIN's unique payout into the survivor run.
//
// Star Raid pays artifacts. The clicker pays Springs. This mode pays a
// Dead Cells-shaped thing: one equipped rule-change, not another percent
// track. Equipped id is save.mutationLoadout; unlocked ids live in
// save.mutationsUnlocked. Flags land in the SAME run.stats.flags bag as
// talents (GameScreen.buildMetaEffects) so the engine never grows a second
// flag map.
//
// THE HARD RULE is the talent rule: a flag nothing reads is worse than no
// mutation. engine.js must contain `.flagName` as a property read.

export const MUTATIONS = [
  {
    id: 'mut_marrow',
    name: 'Marrow Rush',
    desc: 'Dash stretches. The drop drank what was under the hangar.',
    flag: 'mutMarrow',
    icon: 'ui_hatch',
  },
  {
    id: 'mut_film',
    name: 'Coolant Film',
    desc: 'A skin of drain-ice. Hits land softer.',
    flag: 'mutFilm',
    icon: 'ui_hatch',
  },
];

export const MUTATION_INDEX = MUTATIONS.reduce((m, t) => { m[t.id] = t; return m; }, {});

export function unlockMutation(save, id) {
  if (!MUTATION_INDEX[id] || !save) return save;
  const have = save.mutationsUnlocked || [];
  if (have.includes(id)) {
    return { ...save, mutationLoadout: save.mutationLoadout || id };
  }
  return {
    ...save,
    mutationsUnlocked: [...have, id],
    mutationLoadout: save.mutationLoadout || id,
  };
}

export function buildMutationFlags(save) {
  const id = save && save.mutationLoadout;
  if (!id) return {};
  const have = save.mutationsUnlocked || [];
  if (!have.includes(id)) return {};
  const m = MUTATION_INDEX[id];
  if (!m) return {};
  return { [m.flag]: true };
}
