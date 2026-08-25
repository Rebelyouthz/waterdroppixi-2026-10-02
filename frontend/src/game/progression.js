// =============================================
// PROGRESSION SETTLE — one pass, called from one place
// =============================================
// Quest payouts, badge awards and difficulty-tier completion all have the same
// shape: "look at the save, notice something became true, pay for it once."
// Written three times in three components they would drift, double-pay, or
// silently stop firing when a system stopped routing through the component
// that owned its check.
//
// So it is one function, called from App.js on every save change — the same
// contract as tickIdle: returns a NEW save when something moved, the SAME
// reference when nothing did, so a caller can do
//
//   const ns = settleProgression(save); if (ns !== save) setSave(ns);
//
// without looping.
//
// Toasts fire from here too. A reward that lands while the player is inside a
// modal, mid-run, or on the Star Raid screen still gets its moment, because
// this does not care which view is mounted.

import { applyReward, bankReward } from '../store';
import { completedUnpaid, QUEST_TRACKS } from './storyQuests';
import { awardBadges, BADGE_TIERS } from './badges';
import { DIFF_IDS, progressFor, difficultyDef } from './difficulty';
import { campaignNodes } from './campaign';
import { pushToast } from './toastBus';
import { Audio } from './audio';
import { settleMastery } from './masterMilestones';
import { settleStarRaidMilestones } from './starRaidMilestones';

// Turns a reward bag into the compact item list the camp-entry screen renders.
// Exported so the claim-juice overlay (components/ClaimFx.jsx) renders a payout
// with the SAME icon table the reward screen uses. A second copy of this map is
// exactly the failure this project keeps hitting: the two drift, and one screen
// starts showing a currency the other one silently drops.
export const REWARD_ICONS = {
  gold: 'gold', sp: 'sp', gems: 'gems', slotCoins: 'slotCoins', talentPoints: 'cur_tp',
  petFood: 'petFood', gearParts: 'ui_part', flux: 'cur_shards', cores: 'ui_gem', gachaTokens: 'ui_ticket',
  // `rewardItems` filters on this table, so a payout with no entry is silently
  // DROPPED from the reward screen — the player is paid and never told. That
  // was true of every item reward: finish a run, earn a piece of gear, a rune,
  // an artifact and an egg, and the screen listed none of them. Found by the
  // wiring sweep after it was taught to read App.js's `give()` ledger, which is
  // where run rewards are actually granted.
  probeKeys: 'cur_key',
  gear: 'ui_shield',
  rune: 'rune',
  artifact: 'ui_orb',
  egg: 'ui_egg',
  xp: 'ui_star',
};

export function rewardItems(rwd) {
  if (!rwd) return [];
  return Object.entries(rwd)
    .filter(([k, v]) => REWARD_ICONS[k] && v)
    .map(([k, v]) => ({ icon: REWARD_ICONS[k], key: k, amount: v }));
}

// ---- Difficulty tier completion --------------------------------------------
// A tier is "cleared" the moment every story node on it is done. Recorded as a
// flag rather than recomputed at every read site because it is what the badge
// checks, the quest chain and the unlock gate all key off — and because the
// node list could change in a future patch, at which point a player who had
// already finished should not lose the tier.
function settleTierClearing(save) {
  const allIds = campaignNodes().map(n => n.id);
  if (!allIds.length) return null;
  let changed = null;
  for (const d of DIFF_IDS) {
    if ((save.diffCleared || {})[d]) continue;
    const prog = progressFor(save, d);
    if (!allIds.every(id => prog[id])) continue;
    changed = changed || { ...(save.diffCleared || {}) };
    changed[d] = true;
  }
  return changed;
}

export function settleProgression(save) {
  if (!save) return save;
  let ns = null;
  const touch = () => { if (!ns) ns = { ...save }; return ns; };

  // 1. Tier clearing FIRST — the badge and quest checks below read the flags
  //    it writes, so doing it after would delay both by one settle pass and
  //    make "cleared the story" feel like it registered a beat late.
  const tiers = settleTierClearing(save);
  if (tiers) {
    const s = touch();
    const newly = DIFF_IDS.filter(d => tiers[d] && !(save.diffCleared || {})[d]);
    s.diffCleared = tiers;
    for (const d of newly) {
      const def = difficultyDef(d);
      pushToast({
        tone: 'legendary', icon: def.icon,
        title: `${def.name} complete`,
        text: d === 'nightmare' ? 'There is nothing above this.' : `${difficultyDef(DIFF_IDS[DIFF_IDS.indexOf(d) + 1])?.name || 'The next tier'} is open.`,
      });
      bankReward(s, {
        icon: def.icon, tone: 'legendary',
        title: `${def.name} storyline complete`,
        text: def.id === 'nightmare' ? 'The Lake is yours.' : 'A harder version of the story is now open.',
        items: [],
      });
    }
    if (newly.length) Audio.rewardFanfare?.();
  }

  // 2. Quest chain. `completedUnpaid` only ever reports the OPEN step of each
  //    track, so clearing one uncovers the next — which for an existing save
  //    that already satisfies a long run of steps means the chain has to be
  //    drained in a LOOP here rather than one step per settle. Paying one per
  //    pass would work (the effect re-runs on every save change) but would
  //    cost a full React render per step, and the player would watch a
  //    catch-up stutter through twenty renders.
  //
  //    The iteration cap is a guard, not a limit: it is well above the total
  //    number of steps in the chain, and it exists only so a future step with
  //    a `check` that never turns false after payout cannot hang the app.
  let paidAny = false;
  let toasted = 0;
  // On an existing save's first settle this can drain dozens of steps at once.
  // Every one of them still banks a reward-screen entry — that screen is the
  // record — but a wall of forty toasts is not a celebration, it is a denial
  // of service on the corner of the screen. Past the cap the payouts happen
  // silently and the reward screen does the reporting.
  const TOAST_CAP = 6;
  for (let guard = 0; guard < 80; guard++) {
    const ready = completedUnpaid(ns || save);
    if (!ready.length) break;
    const s = touch();
    s.questsDone = { ...(s.questsDone || {}) };
    for (const q of ready) {
      s.questsDone[q.id] = true;
      applyReward(s, q.rwd, null);
      if (q.rwd?.gold) s.lifetimeGold = (s.lifetimeGold || 0) + q.rwd.gold;
      const track = QUEST_TRACKS.find(t => t.id === q.track);
      if (toasted++ < TOAST_CAP) {
        pushToast({
          tone: q.track === 'story' ? 'legendary' : 'default',
          icon: q.icon,
          title: `${track?.name || 'QUEST'} — ${q.title}`,
          text: '✓ ' + q.goal,
        });
      }
      bankReward(s, {
        icon: q.icon, tone: q.track === 'story' ? 'legendary' : 'default',
        title: q.title, text: q.goal, items: rewardItems(q.rwd),
      });
      paidAny = true;
    }
  }
  if (paidAny) Audio.claimPing?.();

  // 3. Badges. Last, so a badge that depends on a quest reward (lifetime gold,
  //    say) sees the payout from this same pass rather than the next one.
  const base = ns || save;
  const before = Object.keys(base.badgesEarned || {}).length;
  const probe = { ...base, badgesEarned: { ...(base.badgesEarned || {}) }, profile: { ...(base.profile || {}) } };
  const fresh = awardBadges(probe);
  if (fresh.length || Object.keys(probe.badgesEarned).length !== before) {
    const s = touch();
    s.badgesEarned = probe.badgesEarned;
    s.profile = probe.profile;
    for (const b of fresh) {
      const tier = BADGE_TIERS[b.tier];
      pushToast({
        tone: tier.rank >= 4 ? 'legendary' : 'default',
        icon: 'ui_medal',
        title: `Badge earned — ${b.name}`,
        text: `${tier.name} · ${b.desc}`,
      });
      bankReward(s, {
        icon: 'ui_medal', tone: tier.rank >= 4 ? 'legendary' : 'default',
        badgeId: b.id,
        title: `${b.name}`, text: `${tier.name} badge — ${b.desc}`, items: [],
      });
    }
    if (fresh.length) Audio.rewardFanfare?.();
  }

  // 4. Mastery Points.
  {
    const base = ns || save;
    const settled = settleMastery(base);
    if (settled !== base) {
      if (!ns) ns = settled;
      else Object.assign(ns, { mastery: settled.mastery });
    }
  }

  // 5. Star Raid Milestones.
  {
    const base = ns || save;
    const settledSR = settleStarRaidMilestones(base);
    if (settledSR !== base) {
      if (!ns) ns = settledSR;
      else Object.assign(ns, { starRaid: settledSR.starRaid });
    }
  }

  return ns || save;
}
