import React, { useEffect, useState } from 'react';
import axios from 'axios';
import MainMenu from './components/MainMenu';
import Welcome from './components/Welcome';
import IntroDialogue from './components/IntroDialogue';
import Camp from './components/Camp';
import GameScreen from './components/GameScreen';
import StarRaidScreen from './components/StarRaidScreen';
import MissionReveal from './components/MissionReveal';
import PaywallModal from './components/PaywallModal';
import { loadSave, saveLocal, syncSave, postRunResult, DEFAULT_SAVE, getPlayerId, addAccountXp, tickIdle } from './store';
import { settleProgression } from './game/progression';
import { markNodeCleared, lootMult } from './game/difficulty';
import RewardScreen from './components/RewardScreen';
import PayoutScreen from './components/PayoutScreen';
import { rollMissionRewards, MISSION_DEFS, CHALLENGES, ACHIEVEMENTS, CHAR_RARITY_COLORS } from './game/data_ext2';
import { AuthProvider, StripeReturnHandler, AuthCallback, useAuth } from './auth';
import { Audio } from './game/audio';
import { rollArtifact } from './game/artifacts';
import { rollGearDrop } from './game/gear';
import { rollRune } from './game/runes';
import { rewardTier, rollCampaignChest, nextCampaignNode, nodeToMission, resolvedRewardMult } from './game/campaign';
import { PET_TYPES } from './components/PetPanel';
import ToastHost from './components/ToastHost';
import { pushToast } from './game/toastBus';

function AppInner() {
  const [view, setView] = useState(null);
  const [save, setSaveState] = useState(loadSave());
  const [booted, setBooted] = useState(false);
  const [activeMission, setActiveMission] = useState(null);
  const [missionReward, setMissionReward] = useState(null);
  const [campaignPayout, setCampaignPayout] = useState(null);
  const [runKey, setRunKey] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const { paid, loading: authLoading, user } = useAuth();

  // Start menu music on first user interaction (browsers block autoplay).
  // Keeps playing across views; only the GameScreen will swap music on game start.
  useEffect(() => {
    const start = () => { try { Audio.startMusic(); } catch (e) {} };
    document.addEventListener('pointerdown', start, { once: true });
    document.addEventListener('keydown', start, { once: true });
    document.addEventListener('touchstart', start, { once: true });
    return () => {
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
      document.removeEventListener('touchstart', start);
    };
  }, []);

  useEffect(() => {
    getPlayerId();
    setTimeout(() => {
      setBooted(true);
      if (!save.profile.name) setView('welcome');
      else if (!save.introSeen) setView('intro');
      else setView('welcome');
    }, 220);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === 'game') document.body.classList.add('in-game');
    else document.body.classList.remove('in-game');
    return () => document.body.classList.remove('in-game');
  }, [view]);

  // Accepts either a save object or a React-style updater function. The
  // updater form matters wherever a caller must not clobber changes made
  // between render and commit (e.g. GameScreen burning a one-run buff on
  // mount) — passing a function straight through to saveLocal used to
  // persist the function itself.
  const setSave = (next) => {
    setSaveState(cur => {
      const ns = typeof next === 'function' ? next(cur) : next;
      saveLocal(ns);
      syncSave(ns);
      return ns;
    });
  };

  // Progression settle — quest payouts, badge awards, difficulty-tier
  // completion. Runs on every save change from ONE place, which is what
  // guarantees a step can never be earned somewhere that forgot to check.
  //
  // It lives in an effect rather than inside setSave's updater on purpose:
  // settleProgression pushes toasts and plays audio, and React is free to
  // invoke a state updater more than once (StrictMode does exactly that), so
  // a side effect in there would double every toast. It returns the same
  // reference when nothing moved, so this converges after one extra pass
  // instead of looping.
  // Gated on `booted` for a reason beyond tidiness: on the very first load of
  // an EXISTING save the chain catches up on everything already satisfied,
  // which can be dozens of steps at once. Before boot, `view` is still null
  // and no <ToastHost/> is mounted anywhere, so every one of those toasts was
  // pushed into a bus with no listener and silently dropped. Waiting means the
  // welcome screen is up and its ToastHost catches them — and the reward
  // screen on the next camp entry carries the full list regardless.
  useEffect(() => {
    if (!booted) return;
    const ns = settleProgression(save);
    if (ns !== save) { setSaveState(ns); saveLocal(ns); syncSave(ns); }
  }, [save, booted]);

  // Settle every time-based system (patrol, incubator, and later the clicker)
  // from one place, on load and then periodically. tickIdle returns the same
  // reference when nothing moved, so this cannot loop.
  useEffect(() => {
    const settle = () => {
      setSaveState(cur => {
        const next = tickIdle(cur, Date.now());
        if (next !== cur) saveLocal(next);
        return next;
      });
    };
    settle();
    const t = setInterval(settle, 10000);
    // iOS Safari ignores user-scalable=no in the viewport meta, so a pinch or
    // a double-tap still zooms the whole page — which during a run means the
    // canvas scales out from under the joysticks. These are the only two
    // paths left, and neither is ever a wanted gesture here.
    const killGesture = (e) => e.preventDefault();
    // Double-tap zoom killer — and the reason rapid tapping did nothing
    // ANYWHERE in the app.
    //
    // `preventDefault()` on touchend does not only cancel the zoom: it also
    // cancels the synthetic click the browser would have produced. So every
    // tap landing within 320ms of the previous one was swallowed whole. That
    // is precisely "I cannot tap fast on the meta board or the clicker" — and
    // it is global, which is why fixing each screen's state handling (real
    // bugs, both) did not help.
    //
    // The fix is to only suppress a tap that is a genuine double-tap: a second
    // tap in the same PLACE. Rapid tapping a buy button walks a few pixels
    // between taps at most... but so does a real double-tap, so position alone
    // is not enough either. What actually separates them is that iOS only
    // zooms on a double tap when the target is not an interactive control —
    // so buttons, links and labels are exempt outright, which covers every
    // rapid-tap surface in the game.
    let lastTap = 0;
    const killDoubleTap = (e) => {
      const now = Date.now();
      const el = e.target;
      const interactive = el && typeof el.closest === 'function'
        && el.closest('button, a, label, input, [role="button"], .clk-well, .upgrade-card');
      if (!interactive && now - lastTap < 320) e.preventDefault();
      lastTap = now;
    };
    document.addEventListener('gesturestart', killGesture, { passive: false });
    document.addEventListener('gesturechange', killGesture, { passive: false });
    document.addEventListener('dblclick', killGesture, { passive: false });
    document.addEventListener('touchend', killDoubleTap, { passive: false });
    // Coming back from a backgrounded tab is exactly when a lot of offline
    // time has just elapsed, so settle immediately rather than waiting out
    // the interval.
    const onVis = () => { if (!document.hidden) settle(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('gesturestart', killGesture);
      document.removeEventListener('gesturechange', killGesture);
      document.removeEventListener('dblclick', killGesture);
      document.removeEventListener('touchend', killDoubleTap);
    };
  }, []);

  const onRunEnd = (result, newSave, mission) => {
    const ns = { ...newSave };
    // ---- Payout ledger -----------------------------------------------------
    // Everything granted by finishing a run, recorded as it is granted, so the
    // payout screen can report ALL of it. Previously the screen listed only
    // the chest contents, while talent points, SP, gems, profile XP and the
    // boss drops were added silently further down — the player was told about
    // maybe half of what they had just earned, and the rest simply appeared in
    // the currency row with no explanation.
    const ledger = {};
    const give = (k, v) => { if (v) ledger[k] = (ledger[k] || 0) + v; };
    let pendingPayout = null;
    ns.quests = { ...ns.quests, completed: { ...ns.quests.completed } };
    const bump = (id, v) => { const q = ns.quests.completed; q[id] = Math.max(q[id] || 0, v); };
    bump('q_kill_100', result.kills); bump('q_kill_300', result.kills); bump('q_kill_500', result.kills);
    bump('q_surv_3', result.time); bump('q_surv_5', result.time); bump('q_surv_8', result.time);
    bump('q_lvl_10', result.level); bump('q_lvl_20', result.level); bump('q_lvl_30', result.level);
    bump('q_gold_500', result.gold); bump('q_gold_1000', result.gold);
    if (result.victory) { bump('q_boss', 1); }
    if (result.noHit && result.victory) { bump('q_nohit', 1); }
    if (result.maxCombo) { bump('q_combo_50', result.maxCombo); }
    // runs quest: count today's completed runs
    ns.quests.completed['q_runs_3'] = (ns.quests.completed['q_runs_3'] || 0) + 1;

    // Gear Parts banked from the run — the currency that levels equipment.
    if (result.gearParts) ns.gearParts = (ns.gearParts || 0) + result.gearParts;

    // Weekly quests accumulate (sum) across runs all week, unlike daily
    // quests above (which track the best single run via Math.max).
    ns.weeklyQuests = { ...ns.weeklyQuests, completed: { ...ns.weeklyQuests.completed } };
    const wsum = (id, v) => { const q = ns.weeklyQuests.completed; q[id] = (q[id] || 0) + v; };
    wsum('wq_runs_15', 1);
    wsum('wq_kills_1000', result.kills || 0);
    wsum('wq_boss_5', result.victory ? 1 : 0);
    wsum('wq_lvl_100', result.level || 0);
    wsum('wq_gold_5000', result.gold || 0);
    // ---- Campaign node payout ----
    // Tiered by how far you got, so a failed attempt is still worth something
    // — a node you nearly cleared should not pay the same as one you walked
    // out of after thirty seconds.
    if (mission && mission.isCampaign && mission.node) {
      const tier = rewardTier(result, mission.node);
      // A harder tier pays more per chest, and by MORE than the extra effort
      // costs — if Hard paid proportionally nobody would ever leave Normal,
      // since Normal is where a fixed amount of skill converts to the most
      // currency per minute.
      const rm = resolvedRewardMult(ns);
      const chests = [];
      for (let i = 0; i < tier; i++) chests.push(rollCampaignChest(mission.node, i === tier - 1 && result.victory, rm));
      for (const chest of chests) {
        for (const item of chest) {
          if (item.type === 'gold') { ns.gold = (ns.gold || 0) + item.amount; ns.lifetimeGold = (ns.lifetimeGold || 0) + item.amount; give('gold', item.amount); }
          else if (item.type === 'gearParts') { ns.gearParts = (ns.gearParts || 0) + item.amount; give('gearParts', item.amount); }
          else if (item.type === 'gems') { ns.gems = (ns.gems || 0) + item.amount; give('gems', item.amount); }
          else if (item.type === 'sp') { ns.sp = (ns.sp || 0) + item.amount; give('sp', item.amount); }
          else if (item.type === 'petFood') { ns.petFood = (ns.petFood || 0) + item.amount; give('petFood', item.amount); }
          else if (item.type === 'gear') { ns.gearInventory = [...(ns.gearInventory || []), rollGearDrop(result.time, true)]; give('gear', 1); }
          else if (item.type === 'rune') {
            // lootMult is a MULTIPLIER on reward quantities (1.0 / 1.55 / 2.4),
            // and rollRune takes a luck bonus used as `luckBonus * 0.02`.
            // Adding one to the other meant Normal silently granted +1 luck it
            // should not have, while Nightmare's advertised "x2.4 loot" moved
            // the rarity roll by 0.048 -- i.e. the multiplier was nearly inert
            // exactly where it is supposed to matter. Convert it instead: a
            // difficulty with no loot bonus adds no luck, and Nightmare adds a
            // bonus you can actually feel.
            const diffLuck = (lootMult(ns) - 1) * 4;
            ns.runeInventory = [...(ns.runeInventory || []), rollRune((ns.attrs?.luck || 0) + diffLuck)];
            give('rune', 1);
          }
        }
      }
      // Cleared nodes are recorded PER DIFFICULTY — clearing lake_1 on Hard
      // must not tick the Normal ledger, or the tier-complete badge and the
      // Nightmare unlock would both fire off the wrong evidence.
      if (result.victory) Object.assign(ns, markNodeCleared(ns, mission.node.id));
      // The ledger is still being filled below (talent points, SP, XP, boss
      // drops), so the screen is opened at the END of this function — see the
      // setCampaignPayout call there. Only the shape is decided here.
      pendingPayout = { tier, node: mission.node, chests };
      // Reaching or beating the guardian is the whole point of a node — the
      // dopamine crash-swell belongs here, not on a generic chest tier.
      if (tier >= 2) Audio.rewardFanfare();

      // Companion rescue — requires the node actually cleared AND the
      // companion still alive at the end. A player death fails the whole
      // run, same as everything else that would have been banked from it;
      // the companion going down mid-fight fails just the rescue, node
      // clear still pays out normally.
      if (result.victory && mission.companion && result.companionNpc && result.companionNpc.alive) {
        const cid = mission.companion.id;
        ns.companions = { ...(ns.companions || {}), [cid]: { rescued: true } };
        pushToast({ tone: 'legendary', icon: 'heart', title: `${mission.companion.name} rescued`, text: mission.companion.homeLine });
        Audio.rewardFanfare();
      }
    }

    if (result.victory && mission && mission.id && mission.id.startsWith('m_')) {
      // Mission success — roll rewards
      const md = MISSION_DEFS.find(m => m.id === mission.id);
      if (md) {
        const rwd = rollMissionRewards(md.reward);
        const ns2 = { ...ns };
        ns2.gold = (ns2.gold || 0) + (rwd.gold || 0);
        ns2.lifetimeGold = (ns2.lifetimeGold || 0) + (rwd.gold || 0);
        // shards
        const bs = { ...(ns2.blueprintShards || {}) };
        for (const [k, v] of Object.entries(rwd.blueprintShards || {})) bs[k] = (bs[k] || 0) + v;
        ns2.blueprintShards = bs;
        // parts
        const inv = [...(ns2.parts || []), ...(rwd.parts || [])];
        ns2.parts = inv;
        // track legendary
        const legCount = (rwd.parts || []).filter(p => p.rarity === 'legendary').length;
        if (legCount > 0) ns2.legendaryPartsFound = (ns2.legendaryPartsFound || 0) + legCount;
        setSaveState(ns2); saveLocal(ns2); syncSave(ns2);
        setMissionReward(rwd);
        postRunResult({ duration: result.time, level: result.level, kills: result.kills, gold: result.gold, wave: Math.ceil(result.time / 30) });
        return;
      }
    }
    if (mission && mission.isChallenge && result.victory) {
      const c = CHALLENGES.find(x => x.id === mission.id);
      if (c) {
        ns.challengesDone = { ...(ns.challengesDone || {}), [c.id]: true };
        ns.gold = (ns.gold || 0) + c.rwd.gold;
        ns.sp = (ns.sp || 0) + c.rwd.sp;
      }
    }
    if (result.victory) ns.aidaSlain = (ns.aidaSlain || 0) + 1;
    if (result.necroKilled) ns.necroSlain = (ns.necroSlain || 0) + 1;
    if (result.voidKilled)  ns.voidSlain  = (ns.voidSlain  || 0) + 1;
    if (result.horusKilled) ns.horusSlain = (ns.horusSlain || 0) + 1;
    if (result.endless)     ns.endlessReached = (ns.endlessReached || 0) + 1;
    if (mission && mission.isDailyChallenge && result.victory && mission.doneKey) {
      ns.dailyChallengesDone = { ...(ns.dailyChallengesDone || {}), [mission.doneKey]: true };
      ns.gold = (ns.gold || 0) + (mission.rwd?.gold || 0);
      ns.sp   = (ns.sp   || 0) + (mission.rwd?.sp   || 0);
    }
    if (mission && mission.isMap && result.victory && mission.mapNodeId) {
      const mm = resolvedRewardMult(ns);
      Object.assign(ns, markNodeCleared(ns, mission.mapNodeId));
      ns.gold = (ns.gold || 0) + Math.round((mission.rwd?.gold || 0) * mm);
      ns.sp   = (ns.sp   || 0) + Math.round((mission.rwd?.sp   || 0) * mm);
      ns.gems = (ns.gems || 0) + Math.round(3 * mm);
      if (Math.random() < 0.25) ns.slotCoins = (ns.slotCoins || 0) + 1;
    }
    // Tutorial completion: mark done (keep earnings)
    if (mission && mission.isTutorial) {
      ns.tutorialDone = true;
    }
    // ---- Gem economy ------------------------------------------------------
    // Gems were flowing far too freely: 1 per 50 kills plus 8-15 per boss
    // meant a single good run paid out more than the incubator, the gacha and
    // the speed-ups could absorb, and every gem sink in the game stopped being
    // a decision. Kill-rate income is halved (1 per 100) and boss income is
    // roughly halved, with the difficulty multiplier restoring the old rate
    // for players who go and earn it on Hard.
    //
    // Bosses stay the dominant source on purpose — gems should come from
    // beating something, not from grinding minutes.
    const rmul = resolvedRewardMult(ns);
    const gems = (n) => { const v = Math.max(1, Math.round(n * rmul)); ns.gems = (ns.gems || 0) + v; give('gems', v); };
    if ((result.kills || 0) >= 100) gems(Math.floor((result.kills || 0) / 100));
    if (result.necroKilled) gems(5);
    if (result.voidKilled)  gems(6);
    if (result.horusKilled) gems(4);
    if (result.victory)     gems(9);

    // Post-boss variation: each boss grants something distinct beyond gear
    // drops + gems, so beating one doesn't always feel like the same
    // reward. Eye of Horus -> guaranteed artifact; Void Titan -> Gacha
    // Token (feeds the Artifact Gacha Machine); Necromancer -> a free pet
    // egg; A.I.D.A. (the run-ending victory) -> a bigger artifact pull +
    // extra Gacha Tokens, since it's the campaign's actual finale.
    if (result.horusKilled) {
      ns.artifactInventory = [...(ns.artifactInventory || []), rollArtifact(1)];
      give('artifact', 1);
    }
    if (result.voidKilled) {
      ns.gachaTokens = (ns.gachaTokens || 0) + 1;
      give('gachaTokens', 1);
    }
    if (result.necroKilled) {
      const petType = PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)];
      ns.petEggs = [...(ns.petEggs || []), { id: Date.now() + '_necroegg', type: petType.id, rarity: 'rare' }];
      give('egg', 1);
    }
    if (result.victory) {
      ns.artifactInventory = [...(ns.artifactInventory || []), rollArtifact(3)];
      ns.gachaTokens = (ns.gachaTokens || 0) + 2;
      give('artifact', 1); give('gachaTokens', 2);
    }
    // Probe Keys. A key is worth a whole Lootmine dive, so they are paid for
    // getting somewhere rather than for showing up: one for a long run, one
    // more for a clear. Together with the 20-minute trickle that is enough to
    // keep the mine open without making it free.
    {
      let keys = 0;
      if ((result.time || 0) >= 300) keys += 1;     // survived five minutes
      if (result.victory) keys += 1;
      if (keys > 0) {
        ns.probeKeys = (ns.probeKeys || 0) + keys;
        give('probeKeys', keys);
      }
    }
    // ---- Talent points, SP, profile XP ------------------------------------
    // All three used to pay a flat amount regardless of how the run went,
    // which made a 30-second suicide run and a 12-minute clear worth nearly
    // the same. They now scale with what you actually did, with a small
    // guaranteed floor so a genuinely bad run still moves something — that
    // floor is what makes the "first node takes 3-5 tries" pacing bearable.
    const tp = 2 + Math.floor((result.level || 1) / 3) + (result.victory ? 3 : 0)
      + ((result.kills || 0) >= 800 ? 2 : 0);
    const tpGain = Math.round(tp * rmul);
    ns.talentPoints = (ns.talentPoints || 0) + tpGain; give('talentPoints', tpGain);
    const xpGain = Math.round((result.kills * 2 + result.level * 5 + (result.victory ? 200 : 0) + Math.floor(result.time / 6)) * rmul);
    addAccountXp(ns, xpGain); give('xp', xpGain);
    const spGain = Math.round((1 + Math.floor(result.level / 5) + (result.victory ? 2 : 0)) * rmul);
    ns.sp = (ns.sp || 0) + spGain; give('sp', spGain);
    // Gold banked from the run itself (GameScreen already added it to the
    // save). Recorded last so it sits at the top of the payout list.
    give('gold', result.gold || 0);
    setSave(ns);
    // Opened here, not where the chests were rolled, so the ledger is complete
    // by the time the screen reads it.
    if (pendingPayout) setCampaignPayout({ ...pendingPayout, ledger });
    postRunResult({ duration: result.time, level: result.level, kills: result.kills, gold: result.gold, wave: Math.ceil(result.time / 30) });
    // Submit to leaderboard (fire-and-forget; backend ignores if not authenticated)
    if (user) {
      const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';
      axios.post(`${API}/leaderboard/submit`, {
        time: result.time, level: result.level, kills: result.kills,
        victory: !!result.victory, no_hit: !!result.noHit,
      }, { withCredentials: true })
        // The submit endpoint does not report a placement, and adding one
        // server-side would mean a second query on every write. Reading the
        // top ten straight back is cheaper and only happens on run end. It
        // feeds `bestLeaderboardRank`, which is the sole evidence the "Named
        // in Stone" badge accepts — a badge for placing has to be earned
        // against the real board, not against a local best.
        .then(() => axios.get(`${API}/leaderboard?limit=10&sort_by=time`, { withCredentials: true }))
        .then(res => {
          const rows = res?.data?.rows || res?.data || [];
          const idx = Array.isArray(rows) ? rows.findIndex(r => r && r.user_id && r.user_id === user.user_id) : -1;
          if (idx === -1) return;
          const rank = idx + 1;
          setSave(cur => {
            const best = cur.bestLeaderboardRank || 0;
            // 0 means "never placed", so any placement beats it; otherwise a
            // LOWER number is better.
            if (best !== 0 && best <= rank) return cur;
            return { ...cur, bestLeaderboardRank: rank };
          });
        })
        .catch(() => {});
    }
  };

  const onMission = (mission) => {
    setActiveMission(mission);
    setRunKey(k => k + 1);
    setView('game');
  };

  const reset = () => {
    if (!window.confirm('Erase your save? All progress will be lost.')) return;
    const fresh = { ...DEFAULT_SAVE };
    setSaveState(fresh); saveLocal(fresh);
    setView('welcome');
  };

  // Tutorial: first time fight → start tutorial mission
  const TUTORIAL_MISSION = {
    isTutorial: true,
    id: 'tutorial',
    name: 'Tutorial',
    duration: 240, // 4 minutes
    tutorialMode: true,
    startMeta: { maxHp: 25, dmg: 0.3, mspd: 0.25, crit: 0.05 },
    startWeapons: ['hydropistol', 'runebolts'],
    startCards: ['power_i', 'vital_i', 'swift_i'],
  };

  // Gate function: try to start gameplay. Show paywall if not entitled.
  const tryStartGame = (proceed, missionOverride) => {
    if (paid) { proceed(missionOverride); return; }
    const starts = save.runStarts || 0;
    if (starts < 3) {
      setSave({ ...save, runStarts: starts + 1 });
      proceed(missionOverride);
      return;
    }
    setShowPaywall(true);
  };

  const startNormalGame = () => {
    tryStartGame(() => { setActiveMission(null); setRunKey(k => k + 1); setView('game'); });
  };

  const startTutorialIfNeeded = () => {
    if (!save.tutorialDone) {
      // The combat tutorial run used to auto-launch here. Timmy retired it:
      // a fresh save now lands in the camp instead, where the unlock
      // cascade (see campaign.js's campUnlockStage) already shows nothing
      // but "THE BASE" (dark) and the one available story mission — that IS
      // the tutorial now, taught by the real first mission rather than a
      // separate throwaway one. Marking tutorialDone here means this branch
      // only ever fires once; TUTORIAL_MISSION itself is left intact rather
      // than deleted, since nothing else that reads `save.tutorialDone`
      // should have to change.
      setSave({ ...save, tutorialDone: true });
      setView('camp');
    } else {
      startNormalGame();
    }
  };

  if (!booted || !view || authLoading) {
    return (<div className="boot"><div className="boot-spin" /><div>WATERDROP SURVIVOR</div></div>);
  }

  if (view === 'welcome') {
    return (<>
      <Welcome save={save} setSave={setSave}
        onContinue={() => { if (!save.introSeen) { setView('intro'); } else { startTutorialIfNeeded(); } }}
        onCamp={() => setView('camp')} />
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
      {/* The welcome screen is where the first post-boot settle lands, so it
          needs a toast host as much as the camp does. */}
      <ToastHost />
    </>);
  }
  if (view === 'intro') {
    return (<IntroDialogue
      rarColor={CHAR_RARITY_COLORS[save.character?.rarity] || CHAR_RARITY_COLORS.common}
      onDone={() => { setSave({ ...save, introSeen: true }); startTutorialIfNeeded(); }}
    />);
  }
  if (view === 'menu') {
    return (<MainMenu save={save} onStart={() => startTutorialIfNeeded()} onCamp={() => setView('camp')} onReset={reset} />);
  }
  if (view === 'camp') {
    // Everything banked while the player was elsewhere — quest steps, badges,
    // a difficulty tier opening — is drained here, on arrival, before the camp
    // is interactive. Draining it rather than showing it inline is what stops
    // a five-reward return from being five things the player has to notice.
    const pending = save.pendingRewards || [];
    return (<>
      <Camp save={save} setSave={setSave}
        onBack={() => setView('welcome')}
        onStart={() => startTutorialIfNeeded()}
        onMission={(m) => tryStartGame(() => onMission(m), m)}
        onStory={() => {
          // "Continue story" resumes at the first node not yet cleared on the
          // ACTIVE difficulty.
          const node = nextCampaignNode(save);
          if (!node) return;
          const m = nodeToMission(node);
          tryStartGame(() => onMission(m), m);
        }}
        onStarRaid={() => setView('starraid')} />
      {!!pending.length && (
        <RewardScreen entries={pending} onClose={() => setSave({ ...save, pendingRewards: [] })} />
      )}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
      <ToastHost />
    </>);
  }
  if (view === 'starraid') {
    return (<><StarRaidScreen save={save} setSave={setSave} onExit={() => setView('camp')} /><ToastHost /></>);
  }
  if (view === 'game') {
    return (<>
      <GameScreen key={runKey} save={save} setSave={setSave} mission={activeMission}
        onRunEnd={onRunEnd}
        onExit={(where) => {
          if (where === 'retry') { setRunKey(k => k + 1); }
          else if (where === 'menu') setView('welcome');
          else setView(where);
        }} />
      <ToastHost />
      {missionReward && <MissionReveal rewards={missionReward} onClose={() => { setMissionReward(null); setView('camp'); }} />}
      {campaignPayout && (
        <PayoutScreen
          payout={campaignPayout}
          onClose={() => { setCampaignPayout(null); setView('camp'); }}
        />
      )}
    </>);
  }
  return null;
}

export default function App() {
  // OAuth callback: detect session_id in URL fragment SYNCHRONOUSLY during render
  // (NOT inside useEffect — that runs after first render, too late to prevent
  // the rest of the app from trying to render with no auth).
  const hash = (typeof window !== 'undefined') ? window.location.hash : '';
  if (hash && hash.indexOf('session_id=') !== -1) {
    return (
      <AuthProvider>
        <AuthCallback />
      </AuthProvider>
    );
  }
  return (
    <AuthProvider>
      <StripeReturnHandler>
        <AppInner />
      </StripeReturnHandler>
    </AuthProvider>
  );
}
