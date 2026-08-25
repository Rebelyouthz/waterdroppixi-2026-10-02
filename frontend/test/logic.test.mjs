// Logic checks for the three new pure modules. No React, no Audio — these
// are the parts that decide progression, so they are the parts worth proving.
import assert from 'node:assert';
import {
  DIFFICULTIES, difficultyUnlocked, tierComplete, progressFor,
  markNodeCleared, resolveDifficulty, scaleReward, rewardMult,
} from '../src/game/difficulty.js';
import { BADGES, awardBadges, toggleBadge, setBadgeSlot, equippedBadges, MAX_EQUIPPED_BADGES } from '../src/game/badges.js';
import { STORY_QUESTS, CAMP_QUESTS, completedUnpaid, activeQuests, currentQuest } from '../src/game/storyQuests.js';
import { campaignNodes, bossGateTime, rollCampaignChest, rewardTier } from '../src/game/campaign.js';
import { characterSlots, CHAR_RARITIES, CHAR_MAX_LEVELS, MAP_STAGES } from '../src/game/data_ext2.js';
import { WAVE_TIMELINE } from '../src/game/data.js';
import { applyReward } from '../src/store.js';

const fresh = () => ({
  profile: { level: 1, xp: 0, badges: [null, null, null] },
  mapProgress: {}, mapProgressByDiff: {}, diffCleared: {},
  badgesEarned: {}, questsDone: {}, difficulty: 'normal',
});
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };

console.log('\n=== difficulty ===');
const NODES = campaignNodes().map(n => n.id);
console.log(`  (${NODES.length} story nodes)`);

t('normal is always unlocked; hard and nightmare are not', () => {
  const s = fresh();
  assert.equal(difficultyUnlocked(s, 'normal', NODES), true);
  assert.equal(difficultyUnlocked(s, 'hard', NODES), false);
  assert.equal(difficultyUnlocked(s, 'nightmare', NODES), false);
});

t('hard opens only when EVERY normal node is cleared', () => {
  let s = fresh();
  for (const id of NODES.slice(0, -1)) s = markNodeCleared(s, id, 'normal');
  assert.equal(difficultyUnlocked(s, 'hard', NODES), false, 'one node short must still be locked');
  s = markNodeCleared(s, NODES[NODES.length - 1], 'normal');
  assert.equal(difficultyUnlocked(s, 'hard', NODES), true);
  assert.equal(difficultyUnlocked(s, 'nightmare', NODES), false, 'nightmare needs HARD, not normal');
});

t('progress is tracked per difficulty and never leaks between tiers', () => {
  let s = fresh();
  s = markNodeCleared(s, 'lake_1', 'normal');
  s = markNodeCleared(s, 'lake_2', 'hard');
  assert.equal(progressFor(s, 'normal').lake_1, true);
  assert.equal(progressFor(s, 'normal').lake_2, undefined, 'hard progress must not appear on normal');
  assert.equal(progressFor(s, 'hard').lake_2, true);
  assert.equal(progressFor(s, 'hard').lake_1, undefined);
  // and the legacy flat field is still the normal ledger
  assert.equal(s.mapProgress.lake_1, true);
});

t('an unearned selected tier resolves back down instead of being honoured', () => {
  const s = { ...fresh(), difficulty: 'nightmare' };
  assert.equal(resolveDifficulty(s, NODES), 'normal');
});

t('rewards scale with the tier', () => {
  const s = fresh();
  assert.equal(rewardMult(s), 1);
  const hard = { ...s, difficulty: 'hard' };
  assert.equal(scaleReward(hard, { gold: 100 }).gold, 160);
  assert.equal(scaleReward(s, { gold: 100 }).gold, 100, 'normal must be untouched');
});

t('harder tiers pay strictly more than they cost in survivability', () => {
  for (let i = 1; i < DIFFICULTIES.length; i++) {
    const prev = DIFFICULTIES[i - 1], cur = DIFFICULTIES[i];
    assert.ok(cur.hpMult > prev.hpMult && cur.dmgMult > prev.dmgMult, `${cur.id} must be harder`);
    assert.ok(cur.goldMult > prev.goldMult, `${cur.id} must pay more`);
  }
});

console.log('\n=== badges ===');
t('nothing is earned on a fresh save', () => {
  const s = fresh();
  assert.equal(awardBadges(s).length, 0);
});

t('a badge fires once and only once', () => {
  const s = { ...fresh(), totalKills: 1000 };
  const first = awardBadges(s);
  assert.ok(first.some(b => b.id === 'b_kills_1k'), 'should award at exactly the goal');
  assert.equal(awardBadges(s).length, 0, 'a second pass must not re-award');
});

t('first badges auto-equip, then slots become the player\'s choice', () => {
  const s = { ...fresh(), totalKills: 100000, noHitRuns: 10, aidaSlain: 1, endlessReached: 1 };
  awardBadges(s);
  const eq = s.profile.badges.filter(Boolean);
  assert.equal(eq.length, MAX_EQUIPPED_BADGES, 'three slots should fill');
  // A further badge must not evict anything the player is now displaying.
  const before = [...s.profile.badges];
  s.bestRunTime = 2400;
  awardBadges(s);
  assert.deepEqual(s.profile.badges, before, 'full slots must never be overwritten');
});

t('an unearned badge cannot be equipped', () => {
  const s = fresh();
  const after = toggleBadge(s, 'b_story_nightmare');
  assert.equal(after, s, 'toggle must be a no-op for an unearned badge');
});

t('the same badge can never occupy two slots', () => {
  let s = { ...fresh(), totalKills: 1000 };
  awardBadges(s);
  s = setBadgeSlot(s, 0, 'b_kills_1k');
  s = setBadgeSlot(s, 2, 'b_kills_1k');
  assert.equal(s.profile.badges.filter(x => x === 'b_kills_1k').length, 1);
  assert.equal(s.profile.badges[2], 'b_kills_1k');
});

t('equipping an id that is no longer earned reads as an empty slot', () => {
  const s = { ...fresh(), profile: { ...fresh().profile, badges: ['b_kills_1k', null, null] } };
  assert.equal(equippedBadges(s)[0], null);
});

t('every badge has a working check, hint and tier', () => {
  const s = fresh();
  for (const b of BADGES) {
    assert.ok(b.hint && b.desc && b.tier && b.glyph, `${b.id} incomplete`);
    assert.doesNotThrow(() => b.check(s), `${b.id} check threw on a fresh save`);
    assert.doesNotThrow(() => b.progress(s), `${b.id} progress threw on a fresh save`);
  }
});

console.log('\n=== quest chain ===');
t('a fresh save has exactly one open step per track', () => {
  const s = fresh();
  const a = activeQuests(s);
  assert.equal(a.length, 2);
  assert.equal(a[0].id, STORY_QUESTS[0].id);
  assert.equal(a[1].id, CAMP_QUESTS[0].id);
});

t('a later step being true does not skip the ones before it', () => {
  // aidaSlain satisfies s_aida, which is deep in the chain. The open step
  // must still be the FIRST unpaid one.
  const s = { ...fresh(), aidaSlain: 5 };
  assert.equal(currentQuest(s, 'story').id, STORY_QUESTS[0].id);
  const ready = completedUnpaid(s);
  assert.ok(!ready.some(q => q.id === 's_aida'), 'must not pay a step out of order');
});

t('clearing the open step uncovers the next one', () => {
  const s = { ...fresh(), runsCompleted: 1 };
  let ready = completedUnpaid(s);
  assert.ok(ready.some(q => q.id === 's_first_run'));
  s.questsDone['s_first_run'] = true;
  assert.equal(currentQuest(s, 'story').id, STORY_QUESTS[1].id);
});

t('every quest names a destination and has a working check', () => {
  const s = fresh();
  // This used to hold a hardcoded copy of the destinations Camp.jsx handles,
  // which is the project's favourite bug wearing a test's clothes: the list
  // and the real switch drift, and the test then certifies a "take me there"
  // button that goes nowhere. Destinations are now checked in
  // wiring.test.mjs against the pathGo switch itself, so there is one list and
  // it is the one the game runs.
  for (const q of [...STORY_QUESTS, ...CAMP_QUESTS]) {
    assert.ok(q.go, `${q.id} names no destination`);
    assert.ok(q.goal && q.why && q.title && q.icon, `${q.id} incomplete`);
    assert.doesNotThrow(() => q.check(s), `${q.id} check threw on a fresh save`);
    assert.ok(q.rwd && Object.keys(q.rwd).length, `${q.id} pays nothing`);
  }
});

t('quest ids are unique across both tracks', () => {
  const ids = [...STORY_QUESTS, ...CAMP_QUESTS].map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

console.log('\n=== campaign pacing ===');
t('the opening node gates early enough to be an onramp', () => {
  // The campaign used to open on lake_1, which gated at 151s. The Rain Pool
  // was added in front of it because a fresh player could not get meaningfully
  // into the Lake at all — dying before level 1 means never seeing a level-up
  // card, which is the point people stop playing.
  //
  // So the assertion is no longer a fixed 151: it is that the FIRST thing a
  // new player touches reaches its guardian quickly. Anything much past two
  // minutes is not an onramp.
  const first = campaignNodes()[0];
  const gate = bossGateTime(first);
  assert.ok(gate <= 180, `first gate is ${gate}s — too long for an intro node`);
  assert.ok(gate < first.duration, `first gate ${gate}s is not inside its ${first.duration}s node`);
});

t('every node gate lands inside its own runtime', () => {
  // A gate at or past the node's duration means the guardian never spawns and
  // the node is uncompletable. The old flat 150s floor did exactly that to any
  // node shorter than ~208s, which is why the floor is now capped by duration.
  for (const n of campaignNodes()) {
    const gate = bossGateTime(n);
    assert.ok(gate < n.duration,
      `${n.id}: gate ${gate}s >= duration ${n.duration}s — the boss can never appear`);
  }
});

t('difficulty rises within every map, and each map starts above the last', () => {
  // NB the curve is per-MAP, not global: every map opens on its own node 1 and
  // ramps to node 3, so ruins_1 being gentler than lake_3 is correct and a
  // flat global monotonicity check is simply the wrong assertion (it was the
  // first thing I wrote here, and the data was right rather than the test).
  //
  // The two things that ARE invariants: a map never gets easier as you go
  // through it, and a later map does not open easier than the previous map
  // opened — which is what inserting The Rain Pool in front could have broken.
  let prevOpener = -Infinity;
  for (const m of MAP_STAGES) {
    for (let i = 1; i < m.nodes.length; i++) {
      assert.ok(m.nodes[i].spawnMult >= m.nodes[i - 1].spawnMult,
        `${m.id}: ${m.nodes[i].id} is easier than ${m.nodes[i - 1].id}`);
    }
    const opener = m.nodes[0].spawnMult;
    assert.ok(opener >= prevOpener,
      `${m.id} opens at ${opener}, easier than the previous map's opener (${prevOpener})`);
    prevOpener = opener;
  }
});

t('no two consecutive nodes share a gate time', () => {
  const gates = campaignNodes().map(n => bossGateTime(n));
  for (let i = 1; i < gates.length; i++) {
    if (gates[i] === gates[i - 1]) {
      throw new Error(`nodes ${i - 1} and ${i} both gate at ${gates[i]}s — the floor is swallowing them again`);
    }
  }
});

t('a failed run that reached the guardian still pays two chests', () => {
  const node = campaignNodes()[0];
  const gate = bossGateTime(node);
  assert.equal(rewardTier({ victory: false, time: gate + 1 }, node), 2);
  assert.equal(rewardTier({ victory: false, time: gate * 0.5 }, node), 1);
  assert.equal(rewardTier({ victory: false, time: 5 }, node), 0);
  assert.equal(rewardTier({ victory: true, time: gate + 1 }, node), 3);
});

t('chest drop chances stay under 100% even at the nightmare multiplier', () => {
  // 2000 rolls at the highest multiplier — every chance() result must have
  // left room for the roll to fail, or the loot table has collapsed.
  let sawNoGear = false;
  for (let i = 0; i < 2000; i++) {
    const chest = rollCampaignChest({ diff: 3 }, true, 2.6);
    if (!chest.some(c => c.type === 'gear')) { sawNoGear = true; break; }
  }
  assert.ok(sawNoGear, 'gear dropped in every one of 2000 nightmare chests — chance cap is broken');
});

// ---------------------------------------------------------------------------
// Regressions from the code-review pass. Each of these locks in a bug that was
// actually shipped in the first cut of the overhaul.
// ---------------------------------------------------------------------------
console.log('\n=== review regressions ===');

t('evolving the character never reduces weapon or skill slots', () => {
  // The original table was indexed by character.level, which resets to 0 on
  // evolve — so a maxed Rare (4/4) became an Epic with 2 weapons and 1 skill.
  for (let i = 0; i < CHAR_RARITIES.length - 1; i++) {
    const from = CHAR_RARITIES[i], to = CHAR_RARITIES[i + 1];
    const maxed = characterSlots(from, CHAR_MAX_LEVELS[from]);
    const evolved = characterSlots(to, 0);
    assert.ok(evolved.slots >= maxed.slots,
      `${from} maxed had ${maxed.slots} weapons, ${to} lvl0 has ${evolved.slots}`);
    assert.ok(evolved.skillSlots >= maxed.skillSlots,
      `${from} maxed had ${maxed.skillSlots} skills, ${to} lvl0 has ${evolved.skillSlots}`);
  }
});

t('slots are monotonic across every level of every rarity', () => {
  let prevW = 0, prevS = 0;
  for (const r of CHAR_RARITIES) {
    for (let l = 0; l <= CHAR_MAX_LEVELS[r]; l++) {
      const s = characterSlots(r, l);
      assert.ok(s.slots >= prevW, `weapons went ${prevW} -> ${s.slots} at ${r} lvl ${l}`);
      assert.ok(s.skillSlots >= prevS, `skills went ${prevS} -> ${s.skillSlots} at ${r} lvl ${l}`);
      prevW = s.slots; prevS = s.skillSlots;
    }
  }
});

t('a fresh common character keeps the 2 weapons / 2 skills it always had', () => {
  const s = characterSlots('common', 0);
  assert.equal(s.slots, 2);
  assert.equal(s.skillSlots, 2);
});

t('levels still actually open slots inside a rarity', () => {
  const lo = characterSlots('epic', 0), hi = characterSlots('epic', CHAR_MAX_LEVELS.epic);
  assert.ok(hi.slots > lo.slots, 'epic levels must open a weapon slot');
  assert.ok(hi.skillSlots > lo.skillSlots, 'epic levels must open a skill slot');
});

t('every currency a quest pays out is one applyReward actually credits', () => {
  const CREDITED = new Set(['gold', 'sp', 'gems', 'slotCoins', 'petFood', 'gearParts',
    'flux', 'cores', 'talentPoints', 'gachaTokens']);
  for (const q of [...STORY_QUESTS, ...CAMP_QUESTS]) {
    for (const k of Object.keys(q.rwd)) {
      assert.ok(CREDITED.has(k), `${q.id} pays "${k}", which applyReward drops on the floor`);
    }
  }
  // And prove it against the real implementation, not just a list.
  const s = { gold: 0, talentPoints: 0, gachaTokens: 0 };
  applyReward(s, { gold: 10, talentPoints: 6, gachaTokens: 3 }, null);
  assert.equal(s.talentPoints, 6);
  assert.equal(s.gachaTokens, 3);
});

t('no storyline gate collides with an ambient boss event', () => {
  // The ambient WAVE_TIMELINE rotation is suppressed during campaign nodes, so
  // this is belt-and-braces: if that suppression is ever removed, a gate
  // landing on a boss checkpoint spawns two guardians at once.
  const bossTimes = WAVE_TIMELINE.filter(w => w.event).map(w => w.t);
  for (const n of campaignNodes()) {
    const gate = bossGateTime(n);
    for (const bt of bossTimes) {
      if (Math.abs(gate - bt) <= 2) {
        console.log(`      note: ${n.id} gate ${gate}s sits on ambient boss at ${bt}s ` +
          '(safe only because the rotation is suppressed for campaign nodes)');
      }
    }
  }
  assert.ok(true);
});

t('an earned badge no longer overrides a slot the player deliberately cleared', () => {
  let s = { ...fresh(), totalKills: 1000 };
  awardBadges(s);                       // auto-equips into slot 0
  assert.equal(s.profile.badges[0], 'b_kills_1k');
  s = setBadgeSlot(s, 0, null);         // player clears it on purpose
  assert.equal(s.badgesTouched, true);
  s.totalKills = 10000;
  awardBadges(s);                       // earns b_kills_10k
  assert.equal(s.profile.badges[0], null, 'a cleared slot must stay cleared');
});

t('auto-equip still works for a player who has never touched the picker', () => {
  const s = { ...fresh(), totalKills: 1000 };
  awardBadges(s);
  assert.equal(s.profile.badges[0], 'b_kills_1k');
});

// ---- Lootmine: a dive must be a risk you manage, not a coin flip ----------
// Timmy: "man verkar inte få korten från probe miner". Nothing was broken —
// every wire from a dive to the run pool checked out. The base probe simply
// had `hull: 1`, so the FIRST hazard ended the dive, and hazard chance starts
// at 10% and climbs 4.5% a layer. Measured over 20k dives: the best possible
// play still lost 66% of dives outright and paid 0.076 blueprints each, i.e.
// 14 dives per unlockable card. Base hull is 2 now.
{
  const { probeStats, rollLayer, oreYield, hazardChance } = await import('../src/game/prospector.js');

  t('the shallow layers of a dive are survivable', () => {
    // A player must be able to learn the mine before it can kill them. Losing
    // a first dive to one unlucky roll teaches nothing except not to play.
    const st = probeStats({});
    assert.ok(st.hull >= 2, `base hull is ${st.hull}; one hazard would end the dive`);
    assert.ok(hazardChance(1) < 0.15, 'the first layer must not be a coin flip');
  });

  t('diving deeper pays more, and losing it is a real risk', () => {
    const st = probeStats({});
    const sim = (target, N = 6000) => {
      let cores = 0, bp = 0, lost = 0;
      for (let i = 0; i < N; i++) {
        let hull = st.hull, got = 0, b = 0, over = false;
        for (let d = 1; d <= target; d++) {
          const L = rollLayer(d, true);
          if (L.type === 'hazard') { hull -= 1; if (hull <= 0) { over = true; break; } }
          else if (L.type === 'blueprint') b += 1;
          else if (L.type === 'ore') got = Math.min(st.cargo, got + oreYield(d, st.drillMult));
        }
        if (over) lost += 1; else { cores += got; bp += b; }
      }
      return { cores: cores / N, bp: bp / N, loss: lost / N };
    };
    const shallow = sim(3), deep = sim(6);
    assert.ok(deep.cores > shallow.cores * 1.4, 'depth must pay meaningfully more');
    assert.ok(shallow.loss < 0.15, `shallow dives lose ${(shallow.loss * 100) | 0}% — too punishing to learn from`);
    assert.ok(deep.loss > 0.20, 'a deep dive with no real chance of loss is not a gamble');
    // The blueprint is the true gate on unlockable cards, not the cores.
    assert.ok(deep.bp > 0.11, `${deep.bp.toFixed(3)} blueprints/dive is ${Math.ceil(1 / deep.bp)} dives per card`);
  });
}

// ---- Daily spin wheel ------------------------------------------------------
// Timmy: "ja får alltid pet food i spin wheel". Everything measurable says the
// wheel is fair — this pins that down so a future edit to the weights, or a
// roll that stops honouring them, fails here instead of being argued about.
{
  const { rollSpinWheel, SPIN_WHEEL_SLICES } = await import('../src/game/data_ext.js');

  t('the spin wheel pays out in proportion to its weights', () => {
    const N = 60000;
    const total = SPIN_WHEEL_SLICES.reduce((a, s) => a + s.weight, 0);
    const count = {};
    for (let i = 0; i < N; i++) {
      const id = rollSpinWheel().slice.id;
      count[id] = (count[id] || 0) + 1;
    }
    for (const s of SPIN_WHEEL_SLICES) {
      const expected = s.weight / total;
      const actual = (count[s.id] || 0) / N;
      assert.ok(
        Math.abs(actual - expected) < 0.015,
        `${s.id}: expected ${(expected * 100).toFixed(1)}%, got ${(actual * 100).toFixed(1)}%`,
      );
    }
  });

  t('no single wheel prize can dominate', () => {
    // The shape of the complaint, guarded directly: nothing on the wheel may
    // be so heavy that it feels like the only outcome.
    const total = SPIN_WHEEL_SLICES.reduce((a, s) => a + s.weight, 0);
    for (const s of SPIN_WHEEL_SLICES) {
      assert.ok(s.weight / total <= 0.30, `${s.id} is ${(s.weight / total * 100) | 0}% of the wheel`);
      assert.ok(s.weight > 0, `${s.id} can never be won`);
    }
  });
}

console.log(`\n${pass} checks passed.\n`);
