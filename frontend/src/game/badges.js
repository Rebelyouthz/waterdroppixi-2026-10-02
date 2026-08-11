// =============================================
// BADGES — the profile's trophy case
// =============================================
// The game already tracks a great many milestones; almost none of them left a
// visible mark on the player. Achievements paid gold and vanished. A badge is
// the opposite: it pays nothing on its own and is purely something you WEAR,
// which is why it can afford to be handed out for the things that are actually
// hard rather than the things that are merely long.
//
// Three rules the catalog follows:
//
// 1. **A badge is a proof, not a participation token.** Every entry below is
//    something a player could point at and say what it took. "Played the game"
//    is not a badge. "Cleared the whole story on Nightmare" is.
//
// 2. **Tier is legibility, not power.** The five tiers (bronze → prismatic)
//    exist so a stranger reading your profile can rank three badges at a
//    glance without knowing the game — the same job Steam's badge levels and
//    the Google Developer Program's tiers do. They grant nothing.
//
// 3. **Exactly three can be displayed.** A wall of every badge you own says
//    nothing; three says what you are proud of. The choice is the content.
//
// Shape: each badge is drawn (see BadgeIcon.jsx) from `glyph` + `tier` +
// `hue` — no image assets, so a badge costs nothing to add and scales to any
// size the UI needs.

export const BADGE_TIERS = {
  bronze:    { id: 'bronze',    name: 'Bronze',    rank: 1, ring: '#c87a3f', core: '#f0b27a', glow: '#c87a3f' },
  silver:    { id: 'silver',    name: 'Silver',    rank: 2, ring: '#9fb2c4', core: '#e3edf5', glow: '#9fb2c4' },
  gold:      { id: 'gold',      name: 'Gold',      rank: 3, ring: '#e0a526', core: '#ffe08a', glow: '#ffc94d' },
  platinum:  { id: 'platinum',  name: 'Platinum',  rank: 4, ring: '#4dffd4', core: '#c9fff3', glow: '#4dffd4' },
  prismatic: { id: 'prismatic', name: 'Prismatic', rank: 5, ring: '#b362ff', core: '#ffd6ff', glow: '#ff6ad5' },
};

export const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'prismatic'];

// `check` reads the save only — no engine state — so a badge can be evaluated
// anywhere, at any time, including on a cold load. `cat` groups them in the
// picker. `hint` is what an unearned badge shows instead of its description,
// and is always phrased as an instruction, never as a riddle.
export const BADGES = [
  // ── Combat ────────────────────────────────────────────────────────────
  {
    id: 'b_kills_1k', name: 'Bloodletter', tier: 'bronze', cat: 'combat',
    glyph: 'skull', hue: '#ff6b6b',
    desc: 'Cut down 1,000 of them.',
    hint: 'Reach 1,000 total kills',
    check: (s) => (s.totalKills || 0) >= 1000,
    progress: (s) => Math.min(1, (s.totalKills || 0) / 1000),
  },
  {
    id: 'b_kills_10k', name: 'Red Tide', tier: 'silver', cat: 'combat',
    glyph: 'skull', hue: '#ff3146',
    desc: '10,000 kills. The Lake ran red.',
    hint: 'Reach 10,000 total kills',
    check: (s) => (s.totalKills || 0) >= 10000,
    progress: (s) => Math.min(1, (s.totalKills || 0) / 10000),
  },
  {
    id: 'b_kills_100k', name: 'Drowning of Names', tier: 'platinum', cat: 'combat',
    glyph: 'skull', hue: '#b362ff',
    desc: '100,000 kills. Nobody counts past this.',
    hint: 'Reach 100,000 total kills',
    check: (s) => (s.totalKills || 0) >= 100000,
    progress: (s) => Math.min(1, (s.totalKills || 0) / 100000),
  },
  {
    id: 'b_nohit', name: 'Untouched', tier: 'gold', cat: 'combat',
    glyph: 'feather', hue: '#9fe0ff',
    desc: 'Cleared a node without being hit once.',
    hint: 'Finish any run having taken zero damage',
    check: (s) => (s.noHitRuns || 0) >= 1,
    progress: (s) => Math.min(1, (s.noHitRuns || 0)),
  },
  {
    id: 'b_nohit_10', name: 'Ghost of the Shallows', tier: 'prismatic', cat: 'combat',
    glyph: 'feather', hue: '#ff6ad5',
    desc: 'Ten flawless runs. No one saw you take a hit.',
    hint: 'Finish 10 runs without taking damage',
    check: (s) => (s.noHitRuns || 0) >= 10,
    progress: (s) => Math.min(1, (s.noHitRuns || 0) / 10),
  },

  // ── Storyline ─────────────────────────────────────────────────────────
  {
    id: 'b_story_first', name: 'First Light', tier: 'bronze', cat: 'story',
    glyph: 'scroll', hue: '#4dc4ff',
    desc: 'Cleared the first node of the story.',
    hint: 'Clear your first storyline node',
    check: (s) => Object.keys(s.mapProgress || {}).length >= 1,
    progress: (s) => Math.min(1, Object.keys(s.mapProgress || {}).length),
  },
  {
    id: 'b_story_normal', name: 'The Lake Remembers', tier: 'gold', cat: 'story',
    glyph: 'crown', hue: '#4dc4ff',
    desc: 'The whole story, cleared on Normal.',
    hint: 'Clear every storyline node on Normal',
    check: (s) => !!(s.diffCleared || {}).normal,
    progress: (s) => (s.diffCleared || {}).normal ? 1 : 0,
  },
  {
    id: 'b_story_hard', name: 'Against the Current', tier: 'platinum', cat: 'story',
    glyph: 'crown', hue: '#ff7a1a',
    desc: 'The whole story, cleared on Hard.',
    hint: 'Clear every storyline node on Hard',
    check: (s) => !!(s.diffCleared || {}).hard,
    progress: (s) => (s.diffCleared || {}).hard ? 1 : 0,
  },
  {
    id: 'b_story_nightmare', name: 'Nothing Held Back', tier: 'prismatic', cat: 'story',
    glyph: 'crown', hue: '#ff3146',
    desc: 'The whole story, cleared on Nightmare.',
    hint: 'Clear every storyline node on Nightmare',
    check: (s) => !!(s.diffCleared || {}).nightmare,
    progress: (s) => (s.diffCleared || {}).nightmare ? 1 : 0,
  },
  {
    id: 'b_aida', name: 'Machine Unmade', tier: 'silver', cat: 'story',
    glyph: 'eye', hue: '#b362ff',
    desc: 'A.I.D.A. fell.',
    hint: 'Defeat A.I.D.A.',
    check: (s) => (s.aidaSlain || 0) >= 1,
    progress: (s) => Math.min(1, (s.aidaSlain || 0)),
  },
  {
    id: 'b_allbosses', name: 'Guardian Breaker', tier: 'gold', cat: 'story',
    glyph: 'eye', hue: '#ffd166',
    desc: 'Every named guardian, put down at least once.',
    hint: 'Defeat Horus, the Necromancer, the Void Titan and A.I.D.A.',
    check: (s) => (s.horusSlain || 0) >= 1 && (s.necroSlain || 0) >= 1 && (s.voidSlain || 0) >= 1 && (s.aidaSlain || 0) >= 1,
    progress: (s) => (['horusSlain', 'necroSlain', 'voidSlain', 'aidaSlain'].filter(k => (s[k] || 0) >= 1).length) / 4,
  },

  // ── Endless ───────────────────────────────────────────────────────────
  {
    id: 'b_endless', name: 'Past the Edge', tier: 'silver', cat: 'endless',
    glyph: 'infinity', hue: '#4dffd4',
    desc: 'Reached Endless. The void did not close.',
    hint: 'Reach Endless mode',
    check: (s) => (s.endlessReached || 0) >= 1,
    progress: (s) => Math.min(1, (s.endlessReached || 0)),
  },
  {
    id: 'b_survive_20', name: 'Long Dark', tier: 'gold', cat: 'endless',
    glyph: 'hourglass', hue: '#ffd166',
    desc: 'Twenty minutes in a single run.',
    hint: 'Survive 20 minutes in one run',
    check: (s) => (s.bestRunTime || 0) >= 1200,
    progress: (s) => Math.min(1, (s.bestRunTime || 0) / 1200),
  },
  {
    id: 'b_survive_40', name: 'Deep Current', tier: 'prismatic', cat: 'endless',
    glyph: 'hourglass', hue: '#4dffe0',
    desc: 'Forty minutes. The Lake stopped counting.',
    hint: 'Survive 40 minutes in one run',
    check: (s) => (s.bestRunTime || 0) >= 2400,
    progress: (s) => Math.min(1, (s.bestRunTime || 0) / 2400),
  },
  {
    id: 'b_top10', name: 'Named in Stone', tier: 'platinum', cat: 'endless',
    glyph: 'star', hue: '#ffd166',
    desc: 'Top ten on the leaderboard.',
    hint: 'Place in the global top 10',
    check: (s) => (s.bestLeaderboardRank || 0) >= 1 && (s.bestLeaderboardRank || 99) <= 10,
    progress: (s) => ((s.bestLeaderboardRank || 0) >= 1 && s.bestLeaderboardRank <= 10) ? 1 : 0,
  },

  // ── Mastery (systems) ─────────────────────────────────────────────────
  {
    id: 'b_rank10', name: 'Standing', tier: 'bronze', cat: 'mastery',
    glyph: 'chevron', hue: '#4dff91',
    desc: 'Reached profile Rank 10.',
    hint: 'Reach profile level 40 (Rank 10)',
    check: (s) => Math.floor((s.profile?.level || 1) / 4) >= 10,
    progress: (s) => Math.min(1, Math.floor((s.profile?.level || 1) / 4) / 10),
  },
  {
    id: 'b_rank25', name: 'Tidewarden', tier: 'platinum', cat: 'mastery',
    glyph: 'chevron', hue: '#4dffd4',
    desc: 'Maximum rank. There is nothing above this.',
    hint: 'Reach the maximum profile rank',
    check: (s) => Math.floor((s.profile?.level || 1) / 4) >= 25,
    progress: (s) => Math.min(1, Math.floor((s.profile?.level || 1) / 4) / 25),
  },
  {
    id: 'b_path', name: 'Every Door Opened', tier: 'gold', cat: 'mastery',
    glyph: 'compass', hue: '#4dc4ff',
    desc: 'Walked the whole guided path. Every system, used once.',
    hint: 'Finish every step of the guided path',
    check: (s) => Object.keys(s.pathClaimed || {}).length >= 16,
    progress: (s) => Math.min(1, Object.keys(s.pathClaimed || {}).length / 16),
  },
  {
    id: 'b_achievements', name: 'Completionist', tier: 'prismatic', cat: 'mastery',
    glyph: 'trophy', hue: '#ffd166',
    desc: 'Every achievement in the game, claimed.',
    hint: 'Claim every achievement',
    check: (s) => Object.keys(s.achClaimed || {}).length >= 30,
    progress: (s) => Math.min(1, Object.keys(s.achClaimed || {}).length / 30),
  },
  {
    id: 'b_evolved', name: 'Refined', tier: 'silver', cat: 'mastery',
    glyph: 'gem', hue: '#b362ff',
    desc: 'Evolved your character past Rare.',
    hint: 'Evolve your character to Epic or beyond',
    check: (s) => ['epic', 'legendary', 'mythical'].includes(s.character?.rarity),
    // Clamped like every other badge here. Without it legendary reads 1.33 and
    // mythical 1.67, and any bar rendering `progress * 100 + '%'` overflows
    // its own track once you are past the tier the badge asks for.
    progress: (s) => Math.min(1, ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].indexOf(s.character?.rarity || 'common') / 3),
  },
  {
    id: 'b_talents', name: 'Deep Roots', tier: 'gold', cat: 'mastery',
    glyph: 'leaf', hue: '#4dff91',
    desc: '150 talent levels sunk into the tree.',
    hint: 'Buy 150 talent levels',
    check: (s) => Object.values(s.talent || {}).reduce((a, b) => a + b, 0) >= 150,
    progress: (s) => Math.min(1, Object.values(s.talent || {}).reduce((a, b) => a + b, 0) / 150),
  },
  {
    id: 'b_collector', name: 'Hoard', tier: 'silver', cat: 'mastery',
    glyph: 'gem', hue: '#4dffd4',
    desc: 'A full collection: gear, runes, artifacts and a hatched pet.',
    hint: 'Own 20 gear, 8 runes, 5 artifacts and 3 pets',
    check: (s) => (s.gearInventory || []).length >= 20 && (s.runeInventory || []).length >= 8
      && (s.artifactInventory || []).length >= 5 && (s.pets || []).length >= 3,
    progress: (s) => (
      Math.min(1, (s.gearInventory || []).length / 20) +
      Math.min(1, (s.runeInventory || []).length / 8) +
      Math.min(1, (s.artifactInventory || []).length / 5) +
      Math.min(1, (s.pets || []).length / 3)
    ) / 4,
  },
  {
    id: 'b_tcg', name: 'Deckbuilder', tier: 'bronze', cat: 'mastery',
    glyph: 'cards', hue: '#ffcc00',
    desc: 'Built a full TCG deck for a pet.',
    hint: 'Fill one pet deck with cards',
    check: (s) => Object.values(s.tcgDecks || {}).some(d => (d || []).length >= 5),
    progress: (s) => Math.min(1, Math.max(0, ...Object.values(s.tcgDecks || {}).map(d => (d || []).length), 0) / 5),
  },
  {
    id: 'b_rich', name: 'Deep Pockets', tier: 'silver', cat: 'mastery',
    glyph: 'coin', hue: '#ffd166',
    desc: 'A quarter million gold earned, lifetime.',
    hint: 'Earn 250,000 lifetime gold',
    check: (s) => (s.lifetimeGold || 0) >= 250000,
    progress: (s) => Math.min(1, (s.lifetimeGold || 0) / 250000),
  },
];

export const BADGE_INDEX = BADGES.reduce((m, b) => { m[b.id] = b; return m; }, {});

export const BADGE_CATS = [
  { id: 'story',   name: 'Storyline', icon: '📜' },
  { id: 'combat',  name: 'Combat',    icon: '⚔' },
  { id: 'endless', name: 'Endless',   icon: '∞' },
  { id: 'mastery', name: 'Mastery',   icon: '🧠' },
];

// Five, not three. Three left a short row of hexagons under a full-width name
// and XP bar with a visible gap to their right, so the identity block read as
// unfinished. Five spans the same width as the bar above them and the currency
// row below, which is what makes the plaque look like one designed block
// rather than three stacked ones.
//
// Everything downstream derives from this constant — the slot renderer, the
// picker's "N can be displayed" line, and the save migration that pads the
// array — so raising it needs no other change. Existing saves keep the badges
// they had and gain two empty slots.
export const MAX_EQUIPPED_BADGES = 5;

// ---- Award pass ------------------------------------------------------------
// Called after anything that could have moved a stat. Returns the list of
// badges that JUST became true, and mutates `save.badgesEarned` in place — the
// caller owns pushing the toasts and banking the reward screen entries, so
// this stays a pure "what changed" query plus its ledger write.
export function awardBadges(save) {
  const earned = save.badgesEarned || (save.badgesEarned = {});
  const fresh = [];
  for (const b of BADGES) {
    if (earned[b.id]) continue;
    let ok = false;
    try { ok = !!b.check(save); } catch { ok = false; }
    if (!ok) continue;
    earned[b.id] = Date.now();
    fresh.push(b);
  }
  // A player's first badges should land in their slots without them having to
  // go find the picker — an empty trophy case teaches nothing about the
  // system. But this stops the moment the player touches the picker: once
  // they have arranged their own slots, a newly-earned badge filling a gap
  // they DELIBERATELY left empty is the UI overruling them. `badgesTouched`
  // is set by toggleBadge/setBadgeSlot and is the whole condition.
  if (fresh.length && !save.badgesTouched) {
    const slots = Array.isArray(save.profile?.badges) ? [...save.profile.badges] : [null, null, null];
    while (slots.length < MAX_EQUIPPED_BADGES) slots.push(null);
    for (const b of fresh) {
      const empty = slots.indexOf(null);
      if (empty === -1) break;
      slots[empty] = b.id;
    }
    save.profile = { ...(save.profile || {}), badges: slots };
  }
  return fresh;
}

export function isEarned(save, badgeId) {
  return !!(save.badgesEarned || {})[badgeId];
}

export function earnedBadges(save) {
  return BADGES.filter(b => isEarned(save, b.id));
}

export function equippedBadges(save) {
  const slots = Array.isArray(save.profile?.badges) ? save.profile.badges : [];
  const out = [];
  for (let i = 0; i < MAX_EQUIPPED_BADGES; i++) {
    const id = slots[i];
    // A badge id that is equipped but not (or no longer) earned reads as an
    // empty slot rather than rendering something the player cannot claim.
    out.push(id && isEarned(save, id) ? BADGE_INDEX[id] || null : null);
  }
  return out;
}

// Toggle a badge in/out of the display. Equipping one already displayed
// removes it; equipping a new one when full replaces the first slot, so the
// action is never a no-op the player has to guess at.
export function toggleBadge(save, badgeId) {
  if (!isEarned(save, badgeId)) return save;
  const slots = Array.isArray(save.profile?.badges) ? [...save.profile.badges] : [null, null, null];
  while (slots.length < MAX_EQUIPPED_BADGES) slots.push(null);
  const at = slots.indexOf(badgeId);
  if (at !== -1) slots[at] = null;
  else {
    const empty = slots.indexOf(null);
    slots[empty === -1 ? 0 : empty] = badgeId;
  }
  // From here on the arrangement is the player's; awardBadges stops
  // auto-filling. See the `badgesTouched` check there.
  return { ...save, badgesTouched: true, profile: { ...save.profile, badges: slots } };
}

export function setBadgeSlot(save, slotIdx, badgeId) {
  const slots = Array.isArray(save.profile?.badges) ? [...save.profile.badges] : [null, null, null];
  while (slots.length < MAX_EQUIPPED_BADGES) slots.push(null);
  // The same badge cannot occupy two slots — clear any prior home first.
  if (badgeId) {
    const prior = slots.indexOf(badgeId);
    if (prior !== -1) slots[prior] = null;
  }
  slots[slotIdx] = badgeId || null;
  return { ...save, badgesTouched: true, profile: { ...save.profile, badges: slots } };
}
